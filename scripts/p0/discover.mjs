#!/usr/bin/env node
/**
 * P0 job-discovery harness.
 *
 * Proves the first two stages of the pipeline on real data:
 *   1. fetch normalised postings from public company career endpoints (Tencent BY DEFAULT, Greenhouse OPTIONAL)
 *   2. hard-filter with the candidate's own constraints (city / experience / intern) and rank by term overlap
 *
 * Output (gitignored tmp/p0/):
 *   jobs.raw.json    every normalised posting, before filtering
 *   shortlist.json  filtered + scored, top N
 *   shortlist.md    human-readable shortlist
 *   run.json        counts + filter statistics, for the P0 log
 *
 * Usage:
 *   node scripts/p0/discover.mjs --profile "D:/Codex/简历自动化/job-search-profile.json"
 *   node scripts/p0/discover.mjs --profile ... --intl --limit 20
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..', '..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
};

const profilePath =
  flag('--profile', process.env.JOB_PROFILE) ??
  'D:/Codex/简历自动化/job-search-profile.json';
const outDir = flag('--out', path.join(repo, 'tmp', 'p0'));
const limit = Number(flag('--limit', 20));
const withIntl = Boolean(flag('--intl', false));
const cityWhitelist = ['上海', '深圳', '广州', '广东'];

const TEN_QUERIES = [
  '增长',
  '海外',
  '投放',
  '市场营销',
  '品牌',
  '内容营销',
  '商务拓展',
  'GTM',
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36';

function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

function stripHtml(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseCnDate(text) {
  const m = /(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(String(text ?? ''));
  if (!m) return undefined;
  const [, y, mo, d] = m;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00+08:00`;
}

function requiredYears(text) {
  const s = String(text ?? '');
  const explicit = /(\d+)\s*年(?:以上)?/.exec(s);
  if (/不限|无要求/.test(s)) return 0;
  if (/在校|应届|实习/.test(s)) return 0;
  if (explicit) return Number(explicit[1]);
  return undefined;
}

function normaliseLocation(raw) {
  const text = String(raw ?? '').trim();
  const remote = /remote|远程|居家/i.test(text);
  return { raw: text, city: text.replace(/^中国/, ''), country: '中国', remote };
}

async function fetchTencent(keyword, pageIndex = 1, pageSize = 50) {
  const url =
    'https://careers.tencent.com/tencentcareer/api/post/Query' +
    `?keyword=${encodeURIComponent(keyword)}&pageIndex=${pageIndex}&pageSize=${pageSize}&language=zh-cn`;
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!res.ok) throw new Error(`tencent ${keyword}: HTTP ${res.status}`);
  const json = await res.json();
  if (json.Code !== 200) throw new Error(`tencent ${keyword}: Code ${json.Code}`);
  return json.Data?.Posts ?? [];
}

function tencentJob(post) {
  const title = post.RecruitPostName?.trim() ?? '(untitled)';
  const location = normaliseLocation(post.LocationName);
  const jdParts = [
    title,
    post.CategoryName,
    post.RequireWorkYearsName,
    stripHtml(post.Responsibility),
  ].filter(Boolean);
  return {
    schema_version: 1,
    id: `company:tencent-${post.PostId}`,
    source: 'company',
    source_job_id: post.PostId,
    url: post.PostURL,
    apply_url: post.PostURL,
    title,
    company: '腾讯',
    location,
    posted_at: parseCnDate(post.LastUpdateTime),
    captured_at: new Date().toISOString(),
    jd_text: jdParts.join('\n'),
    requirements: [post.RequireWorkYearsName].filter(Boolean),
    skills: [],
    dedupe_hash: sha256(
      ['腾讯', title.toLowerCase(), location.city].join('|'),
    ),
    status: 'discovered',
    rawSource: {
      keyword: post.__keyword,
      postId: post.PostId,
      bg: post.BGName,
      product: post.ProductName,
      category: post.CategoryName,
      requiredYears: post.RequireWorkYearsName,
    },
    _requiredYears: requiredYears(post.RequireWorkYearsName),
  };
}

async function fetchGreenhouse(slug, company) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!res.ok) throw new Error(`greenhouse ${slug}: HTTP ${res.status}`);
  const json = await res.json();
  return (json.jobs ?? []).map((job) => {
    const location = normaliseLocation(job.location?.name);
    return {
      schema_version: 1,
      id: `greenhouse:${job.id}`,
      source: 'greenhouse',
      source_job_id: String(job.id),
      url: job.absolute_url,
      apply_url: job.absolute_url,
      title: job.title,
      company,
      location,
      posted_at: job.updated_at,
      captured_at: new Date().toISOString(),
      jd_text: stripHtml(job.content),
      requirements: [],
      skills: [],
      dedupe_hash: sha256([company, job.title.toLowerCase(), location.city].join('|')),
      status: 'discovered',
      rawSource: { board: slug, ghId: job.id },
      _requiredYears: undefined,
    };
  });
}

function scoreJob(job, terms) {
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
  if (cityWhitelist.some((city) => job.location.city.includes(city))) score += 2;
  return { score, hits: [...new Set(hits)], titleHits: [...new Set(titleHits)] };
}

function isHardRejected(job, constraints) {
  const title = job.title.toLowerCase();
  if (/实习|intern\b/.test(title)) return 'internship';
  if (job.location.city === '中国香港') return 'outside-locations';
  if (!cityWhitelist.some((city) => job.location.city.includes(city))) return 'outside-locations';
  const maxYears = constraints.max_required_experience_years;
  if (
    typeof maxYears === 'number' &&
    typeof job._requiredYears === 'number' &&
    job._requiredYears > maxYears
  ) {
    return `requires-${job._requiredYears}y`;
  }
  for (const term of constraints.excluded_terms ?? []) {
    if (term && (title.includes(term.toLowerCase()) || job.jd_text.includes(term))) {
      return `excluded:${term}`;
    }
  }
  return null;
}

function toMarkdown(shortlist, meta) {
  const lines = [
    `# P0 岗位短名单（${meta.generatedAt.slice(0, 16).replace('T', ' ')}）`,
    '',
    `抓取 ${meta.fetched} 条 → 去重 ${meta.deduped} 条 → 硬筛通过 ${meta.passed} 条 → 取前 ${shortlist.length} 条。`,
    '',
    '| # | 岗位 | 公司 | 地点 | 经验要求 | 命中词 | 链接 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  shortlist.forEach((job, i) => {
    const years = job._requiredYears == null ? '未注明' : `${job._requiredYears} 年`;
    const link = job.url ? `[JD](${job.url})` : '—';
    lines.push(
      `| ${i + 1} | ${job.title} | ${job.company} | ${job.location.city} | ${years} | ${job._hits.join('、')} | ${link} |`,
    );
  });
  lines.push('', '## 被硬筛掉的原因', '');
  for (const [reason, count] of Object.entries(meta.rejectReasons)) {
    lines.push(`- ${reason}: ${count}`);
  }
  return lines.join('\n');
}

async function main() {
  const profile = JSON.parse(await readFile(profilePath, 'utf8'));
  const constraints = profile.hard_constraints ?? {};
  // Search intents plus the candidate's own terms: a Chinese JD rarely repeats the English track name,
  // so title-level keyword overlap is the honest minimum for "this role is about the same work".
  const terms = [
    ...new Set([
      ...(profile.target_terms ?? []),
      ...TEN_QUERIES,
      '营销',
      '市场',
      '品牌',
      '投放',
      '广告',
      '增长',
      '运营',
      '推广',
      '商务',
    ]),
  ];
  const startedAt = new Date();

  const raw = [];
  const stats = { tencent: { queries: 0, fetched: 0 }, greenhouse: { boards: 0, fetched: 0 } };

  for (const keyword of TEN_QUERIES) {
    try {
      const posts = await fetchTencent(keyword);
      stats.tencent.queries += 1;
      stats.tencent.fetched += posts.length;
      for (const post of posts) raw.push(tencentJob({ ...post, __keyword: keyword }));
      await new Promise((r) => setTimeout(r, 1200));
    } catch (error) {
      stats[`error:${keyword}`] = String(error.message ?? error);
    }
  }

  if (withIntl) {
    for (const [slug, company] of [
      ['coinbase', 'Coinbase'],
      ['gemini', 'Gemini'],
    ]) {
      try {
        const jobs = await fetchGreenhouse(slug, company);
        stats.greenhouse.boards += 1;
        stats.greenhouse.fetched += jobs.length;
        raw.push(...jobs);
      } catch (error) {
        stats[`error:${slug}`] = String(error.message ?? error);
      }
    }
  }

  // De-duplicate on (id) and on (company, title, city) — same role posted under several keywords.
  const seenId = new Set();
  const seenHash = new Set();
  const unique = [];
  for (const job of raw) {
    if (seenId.has(job.id) || seenHash.has(job.dedupe_hash)) continue;
    seenId.add(job.id);
    seenHash.add(job.dedupe_hash);
    unique.push(job);
  }

  const rejectReasons = {};
  const passed = [];
  for (const job of unique) {
    const reason = isHardRejected(job, constraints);
    if (reason) {
      rejectReasons[reason] = (rejectReasons[reason] ?? 0) + 1;
      continue;
    }
    const { score, hits, titleHits } = scoreJob(job, terms);
    if (titleHits.length === 0) {
      rejectReasons['title-unrelated'] = (rejectReasons['title-unrelated'] ?? 0) + 1;
      continue;
    }
    passed.push({ ...job, _score: score, _hits: hits });
  }

  passed.sort((a, b) => b._score - a._score || String(b.posted_at).localeCompare(String(a.posted_at)));
  const shortlist = passed.slice(0, limit).map(({ _requiredYears, _score, _hits, ...job }) => ({
    ...job,
    _requiredYears,
    _score,
    _hits,
  }));

  const meta = {
    generatedAt: startedAt.toISOString(),
    profile: profilePath,
    fetched: raw.length,
    deduped: unique.length,
    passed: passed.length,
    limit,
    rejectReasons,
    stats,
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'jobs.raw.json'), JSON.stringify(raw, null, 2), 'utf8');
  await writeFile(path.join(outDir, 'shortlist.json'), JSON.stringify(shortlist, null, 2), 'utf8');
  await writeFile(path.join(outDir, 'shortlist.md'), toMarkdown(shortlist, meta), 'utf8');
  await writeFile(path.join(outDir, 'run.json'), JSON.stringify(meta, null, 2), 'utf8');

  console.log(
    `fetched=${raw.length} deduped=${unique.length} passed=${passed.length} shortlist=${shortlist.length} → ${outDir}`,
  );
  for (const [reason, count] of Object.entries(rejectReasons).sort((a, b) => b[1] - a[1])) {
    console.log(`  reject ${reason}: ${count}`);
  }
}

await main();
