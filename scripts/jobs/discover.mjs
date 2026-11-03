#!/usr/bin/env node
/**
 * Multi-source job discovery.
 *
 *   node scripts/jobs/discover.mjs [--profile path] [--catalog path]
 *        [--scope all|cn|global] [--limit 40] [--out tmp/jobs] [--inbox]
 *
 * Pipeline: fetch (per-source adapters, isolated failures) -> dedupe ->
 * hard filter (city / years / intern / excluded) -> title-term gate ->
 * score -> shortlist. Captures made by the browser bridge land in
 * tmp/jobs/inbox and are merged in the same pass.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ADAPTERS } from './sources.mjs';
import { NOW, sha256 } from './lib.mjs';

const repo = path.resolve(import.meta.dirname, '..', '..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
};
const has = (name) => argv.includes(name);

const profilePath = flag('--profile', process.env.JOB_PROFILE) ?? 'D:/Codex/简历自动化/job-search-profile.json';
const catalogPath = flag('--catalog', path.join(import.meta.dirname, 'catalog.json'));
const outDir = flag('--out', path.join(repo, 'tmp', 'jobs'));
const limit = Number(flag('--limit', 40));
const scope = String(flag('--scope', 'all'));
const concurrency = Math.max(1, Number(flag('--concurrency', 4)));
const perCompany = Math.max(1, Number(flag('--per-company', 6)));
const withInbox = !has('--no-inbox');

const CN_TERMS = ['营销', '市场', '品牌', '投放', '广告', '增长', '运营', '推广', '商务', '海外', '商业化', 'GTM'];
const GD_CITIES = ['深圳', '广州', '东莞', '佛山', '珠海', '惠州', '中山', '江门', '肇庆'];
const APAC = /singapore|hong kong|shanghai|beijing|shenzhen|guangzhou|taipei|tokyo|seoul|apac|asia|remote|anywhere/i;
const AMERICAS_ONLY = /united states|usa|canada|new york|san francisco|seattle|austin|toronto|remote\s*[-–]\s*(us|america)/i;

function expandCities(locations = []) {
  const set = new Set();
  for (const loc of locations) {
    if (/广东/.test(loc)) GD_CITIES.forEach((c) => set.add(c));
    else set.add(loc);
  }
  return [...set];
}

function parseSalary(text) {
  const s = String(text ?? '');
  const m = /(\d+(?:\.\d+)?)\s*[-~至]\s*(\d+(?:\.\d+)?)\s*[kK千]/.exec(s);
  if (m) return { min: Number(m[1]), max: Number(m[2]), currency: 'CNY', period: 'month', raw: s };
  return undefined;
}

async function mapLimit(items, limitN, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limitN, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

async function runEntry(entry, profile) {
  const adapter = ADAPTERS[entry.adapter];
  if (!adapter) throw new Error(`unknown adapter: ${entry.adapter}`);
  if (entry.enabled === false) return [];
  if (entry.scope === 'cn') {
    const jobs = [];
    for (const keyword of entry.keywords ?? ['营销']) {
      const batch = await adapter({ ...entry, keyword, limit: 50 });
      batch.forEach((job) => (job.rawSource = { ...job.rawSource, keyword }));
      jobs.push(...batch);
    }
    return jobs;
  }
  if (entry.adapter === 'workday') {
    const jobs = [];
    for (const keyword of entry.keywords ?? ['marketing']) {
      jobs.push(...(await adapter({ ...entry, keyword, limit: 20, detailLimit: 8 })));
    }
    return jobs;
  }
  return adapter({ ...entry, limit: 500 });
}

function isRejected(job, constraints, cities) {
  const title = job.title.toLowerCase();
  const jd = job.jd_text.toLowerCase();
  const city = job.location.city ?? '';
  if (/实习|\bintern\b|\binternship\b/.test(title)) return 'internship';
  // Engineering/design titles match "monetization"/"growth" in the JD but are
  // not roles this profile can take; the title gate alone let them through.
  if (/\b(engineer|engineering|developer|scientist|designer|architect|devops|sre)\b/i.test(title)) return 'title-unrelated';
  const maxYears = constraints.max_required_experience_years;
  if (typeof maxYears === 'number' && typeof job._requiredYears === 'number' && job._requiredYears > maxYears) {
    return `requires-${job._requiredYears}y`;
  }
  if (job.rawSource?.scope === 'global' || job._scope === 'global') {
    const locText = `${city} ${job.location.raw ?? ''}`;
    // A US-only remote role is still a night shift from UTC+7; reject unless
    // the posting is genuinely global/APAC. "US, Remote" often arrives as
    // city="US" with remote=true, which the regex below would otherwise miss.
    if (/^(us|usa|u\.s\.?|united states|canada)$/i.test(city)) return 'americas-timezone';
    if (AMERICAS_ONLY.test(locText) && !/global|worldwide|international|apac|asia/i.test(locText)) return 'americas-timezone';
    if (!job.location.remote && !APAC.test(locText)) return 'outside-apac';
  } else if (cities.length) {
    const inCity = cities.some((c) => city.includes(c));
    if (!inCity && !job.location.remote) return 'outside-locations';
  }
  for (const term of constraints.excluded_terms ?? []) {
    if (term && (title.includes(term.toLowerCase()) || jd.includes(term.toLowerCase()))) return `excluded:${term}`;
  }
  return null;
}

function scoreJob(job, terms, cities) {
  const title = job.title.toLowerCase();
  const jd = job.jd_text.toLowerCase();
  let score = 0;
  const hits = [];
  const titleHits = [];
  for (const term of terms) {
    const t = term.toLowerCase();
    if (title.includes(t)) {
      score += 3;
      hits.push(term);
      titleHits.push(term);
    } else if (jd.includes(t)) {
      score += 1;
      hits.push(term);
    }
  }
  if (cities.some((c) => (job.location.city ?? '').includes(c))) score += 2;
  if (job.location.remote) score += 1;
  // A candidate with <=3 years should not see director-level roles at the top
  // just because the JD repeats "增长/投放"; demote, don't drop.
  if (/总监|负责人|vp|head of|director|首席/i.test(job.title)) score -= 6;
  else if (/资深|senior|staff|principal/i.test(job.title)) score -= 2;
  return { score, hits: [...new Set(hits)], titleHits: [...new Set(titleHits)] };
}

async function loadCaptures(dir) {
  if (!withInbox) return [];
  try {
    const files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
    const jobs = [];
    for (const file of files) {
      try {
        const raw = JSON.parse(await readFile(path.join(dir, file), 'utf8'));
        const site = raw.site === 'zhaopin' ? 'zhaopin' : raw.site === 'liepin' ? 'liepin' : 'boss';
        const label = { boss: 'BOSS直聘', liepin: '猎聘', zhaopin: '智联招聘' }[site];
        const job = {
          schema_version: 1,
          id: `${site}:${sha256(raw.url ?? file).slice(0, 16)}`,
          source: site,
          source_job_id: sha256(raw.url ?? file).slice(0, 24),
          url: raw.url,
          apply_url: raw.url,
          title: raw.title ?? '(captured)',
          company: raw.company ?? '(unknown)',
          location: { raw: raw.location ?? '', city: raw.location ?? '', remote: /远程|remote/i.test(raw.location ?? '') },
          salary: parseSalary(raw.salary),
          captured_at: raw.captured_at ?? NOW(),
          posted_at: raw.posted_at,
          jd_text: String(raw.jd ?? '').trim(),
          requirements: [],
          skills: [],
          status: 'discovered',
          rawSource: { board: label, file, channel: site },
          _scope: 'cn',
        };
        job.dedupe_hash = sha256([job.company, job.title.toLowerCase(), job.location.city].join('|'));
        if (job.jd_text.length >= 40) jobs.push(job);
      } catch {
        /* a corrupt capture must not break discovery */
      }
    }
    return jobs;
  } catch {
    return [];
  }
}

function toMarkdown(shortlist, meta) {
  const date = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(meta.generatedAt))
    .replace(/\//g, '-');
  const lines = [
    `# 岗位短名单（${date}）`,
    '',
    `来源 ${meta.sources} 个 → 抓取 ${meta.fetched} 条 → 去重 ${meta.deduped} → 硬筛通过 ${meta.passed} → 取前 ${shortlist.length}。`,
    '',
    '| # | 岗位 | 公司 | 地点 | 经验 | 命中 | 来源 | 链接 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  shortlist.forEach((job, i) => {
    const years = job._requiredYears == null ? '—' : job._requiredYears === 0 ? '不限' : `${job._requiredYears}y`;
    const hits = job._hits.slice(0, 4).join('、') || '—';
    const src = job.rawSource?.board ?? job.source;
    lines.push(`| ${i + 1} | ${job.title} | ${job.company} | ${job.location.city || '—'} | ${years} | ${hits} | ${src} | [JD](${job.url}) |`);
  });
  lines.push('', '## 各来源');
  for (const [name, stat] of Object.entries(meta.perSource)) {
    lines.push(`- ${name}: ${stat.ok ? `${stat.jobs} 条` : `失败 ${stat.error}`}`);
  }
  lines.push('', '## 硬筛淘汰原因');
  for (const [reason, count] of Object.entries(meta.rejectReasons).sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${reason}: ${count}`);
  }
  return lines.join('\n');
}

async function main() {
  const profile = JSON.parse(await readFile(profilePath, 'utf8'));
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const constraints = profile.hard_constraints ?? {};
  const cities = expandCities(constraints.locations);
  const terms = [
    ...new Set([
      ...(profile.target_terms ?? []),
      ...CN_TERMS,
      'growth', 'marketing', 'brand', 'paid media', 'performance', 'campaign', 'gtm', 'acquisition', 'monetization',
    ]),
  ];
  const entries = (catalog.companies ?? []).filter((e) => e.enabled !== false && (scope === 'all' || e.scope === scope));
  const startedAt = new Date();

  const perSource = {};
  const raw = [];
  const settled = await mapLimit(entries, concurrency, async (entry) => {
    try {
      const jobs = await runEntry(entry, profile);
      jobs.forEach((job) => {
        job._scope = entry.scope;
        job.rawSource = { ...(job.rawSource ?? {}), scope: entry.scope, sourceId: entry.id };
      });
      perSource[entry.id] = { ok: true, jobs: jobs.length };
      return jobs;
    } catch (error) {
      perSource[entry.id] = { ok: false, jobs: 0, error: String(error.message ?? error).slice(0, 160) };
      return [];
    }
  });
  settled.flat().forEach((job) => raw.push(job));

  const captures = await loadCaptures(path.join(outDir, 'inbox'));
  captures.forEach((job) => {
    job._scope = 'cn';
    raw.push(job);
  });
  if (captures.length) perSource.captures = { ok: true, jobs: captures.length };

  const seenId = new Set();
  const seenHash = new Set();
  const unique = [];
  for (const job of raw) {
    if (!job.id || seenId.has(job.id) || seenHash.has(job.dedupe_hash)) continue;
    seenId.add(job.id);
    seenHash.add(job.dedupe_hash);
    unique.push(job);
  }

  const rejectReasons = {};
  const passed = [];
  for (const job of unique) {
    const reason = isRejected(job, constraints, cities);
    if (reason) {
      rejectReasons[reason] = (rejectReasons[reason] ?? 0) + 1;
      continue;
    }
    const { score, hits, titleHits } = scoreJob(job, terms, cities);
    if (titleHits.length === 0) {
      rejectReasons['title-unrelated'] = (rejectReasons['title-unrelated'] ?? 0) + 1;
      continue;
    }
    passed.push({ ...job, _score: score, _hits: hits });
  }
  passed.sort((a, b) => b._score - a._score || String(b.posted_at ?? '').localeCompare(String(a.posted_at ?? '')));
  // Diversity: one company cannot flood the list (Tencent alone would take
  // half of it). Fill any leftover slots from the overflow afterwards.
  const shortlist = [];
  const perCompanyCount = new Map();
  for (const job of passed) {
    if (shortlist.length >= limit) break;
    const key = job.company || 'unknown';
    const count = perCompanyCount.get(key) ?? 0;
    if (count >= perCompany) continue;
    perCompanyCount.set(key, count + 1);
    shortlist.push(job);
  }
  if (shortlist.length < limit) {
    const picked = new Set(shortlist);
    for (const job of passed) {
      if (shortlist.length >= limit) break;
      if (!picked.has(job)) shortlist.push(job);
    }
  }

  const meta = {
    generatedAt: startedAt.toISOString(),
    profile: profilePath,
    scope,
    sources: entries.length,
    fetched: raw.length,
    deduped: unique.length,
    passed: passed.length,
    limit,
    rejectReasons,
    perSource,
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'jobs.json'), JSON.stringify(unique, null, 2), 'utf8');
  await writeFile(path.join(outDir, 'shortlist.json'), JSON.stringify(shortlist, null, 2), 'utf8');
  await writeFile(path.join(outDir, 'shortlist.md'), toMarkdown(shortlist, meta), 'utf8');
  await writeFile(path.join(outDir, 'run.json'), JSON.stringify(meta, null, 2), 'utf8');

  console.log(`sources=${entries.length} fetched=${raw.length} deduped=${unique.length} passed=${passed.length} shortlist=${shortlist.length}`);
  for (const [name, stat] of Object.entries(perSource)) {
    console.log(`  ${name}: ${stat.ok ? stat.jobs : `FAIL ${stat.error}`}`);
  }
  for (const [reason, count] of Object.entries(rejectReasons).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`  reject ${reason}: ${count}`);
  }
  console.log(`→ ${outDir}`);
}

await main();
