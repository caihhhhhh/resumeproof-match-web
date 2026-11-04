#!/usr/bin/env node
/**
 * Domestic job scan via `@ha7ch/job-pro` (MIT, 50 Chinese companies).
 *
 * The CLI already speaks Moka / Feishu / Beisen / 23 bespoke company APIs.
 * Rather than re-implement every endpoint, this scans with its cross-company
 * `find` verb, normalises positions into our job schema, hydrates the most
 * promising ones with real JD text, and writes tmp/jobs/cn.json for
 * discover.mjs to merge.
 *
 *   node scripts/jobs/jobpro.mjs [--limit 8] [--keywords 增长,营销,投放]
 *        [--hydrate 40] [--out tmp/jobs]
 *
 * Boundary: read-only. Nothing here logs in or submits an application.
 */
import { exec } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { makeJob, sleep } from './lib.mjs';

const run = promisify(exec);
const PINNED = '@ha7ch/job-pro@1.2.1';
const repo = path.resolve(import.meta.dirname, '..', '..');

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
};

const limit = Number(flag('--limit', 8));
const hydrate = Number(flag('--hydrate', 40));
const outDir = flag('--out', path.join(repo, 'tmp', 'jobs'));
const profilePath = flag('--profile', process.env.JOB_PROFILE) ?? 'D:/Codex/简历自动化/job-search-profile.json';
const DEFAULT_KEYWORDS = ['增长', '营销', '市场', '投放', '品牌', '运营', '商务拓展', '海外'];
const keywords = String(flag('--keywords', DEFAULT_KEYWORDS.join(',')))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const CN_TERMS = ['增长', '营销', '市场', '品牌', '投放', '广告', '运营', '推广', '商务', '海外', '商业化', 'GTM'];

const quote = (arg) => `"${String(arg).replace(/"/g, '')}"`;

async function cli(args, timeout = 120000) {
  const command = ['npx', '-y', PINNED, ...args.map(quote)].join(' ');
  const { stdout } = await run(command, {
    maxBuffer: 64 * 1024 * 1024,
    timeout,
    windowsHide: true,
  });
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
  return JSON.parse(lines.at(-1));
}

/** "Tencent / 腾讯" -> "腾讯"; fall back to the key when there is no slash. */
function chineseLabel(label, key) {
  const parts = String(label ?? '').split(' / ');
  return parts.length > 1 ? parts.slice(1).join(' / ') : key;
}

function quickScore(job) {
  const title = job.title ?? '';
  let score = 0;
  for (const term of CN_TERMS) if (title.includes(term)) score += 3;
  if (/海外|国际化|global|international/i.test(title)) score += 4;
  if (/总监|负责人|VP|Head|Director/i.test(title)) score -= 4;
  if (/实习|校招|应届|培训生/.test(title)) score -= 8;
  if (/工程师|开发|算法|设计/.test(title)) score -= 6;
  return score;
}

async function mapLimit(items, limitN, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limitN, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor;
        cursor += 1;
        results[i] = await worker(items[i], i);
      }
    }),
  );
  return results;
}

async function main() {
  const startedAt = new Date();
  const profile = JSON.parse(await readFile(profilePath, 'utf8').catch(() => '{}'));
  const profileCities = profile.hard_constraints?.locations ?? [];

  const companies = await cli(['list', '--compact']);
  const labelByKey = new Map(companies.map((c) => [c.key, chineseLabel(c.label, c.key)]));
  const familyByKey = new Map(companies.map((c) => [c.key, c.family]));

  const found = [];
  const failed = [];
  const seen = new Set();

  for (const keyword of keywords) {
    let payload;
    try {
      payload = await cli(['find', keyword, '--limit', String(limit), '--scope', 'social', '--compact'], 180000);
    } catch (error) {
      failed.push({ keyword, message: String(error.message ?? error).slice(0, 200) });
      continue;
    }
    if (payload.ok === false) {
      failed.push({ keyword, message: payload.message ?? 'find failed' });
      continue;
    }
    for (const bucket of payload.results ?? []) {
      for (const p of bucket.positions ?? []) {
        const key = `${bucket.company}:${p.post_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({
          companyKey: bucket.company,
          family: familyByKey.get(bucket.company) ?? 'unknown',
          position: p,
          keyword,
        });
      }
    }
    console.log(`keyword ${keyword}: ${payload.total ?? '?'} hits, ${payload.company_count ?? '?'} companies`);
  }

  const jobs = found.map(({ companyKey, family, position, keyword }) =>
    makeJob({
      source: 'jobpro',
      sourceJobId: position.post_id,
      url: position.apply_url,
      title: position.title,
      company: labelByKey.get(companyKey) ?? companyKey,
      location: { raw: position.work_cities },
      jdText: [position.title, position.project, position.bgs].filter(Boolean).join('\n'),
      employmentType: position.recruit_label,
      rawSource: {
        board: 'jobpro',
        companyKey,
        family,
        project: position.project,
        recruitLabel: position.recruit_label,
        keyword,
      },
    }),
  );

  console.log(`collected ${jobs.length} unique positions from ${new Set(found.map((f) => f.companyKey)).size} companies`);

  // Hydrate the JDs most likely to survive the hard filter, so the scorer
  // sees real requirements instead of just a title.
  const ranked = jobs
    .map((job) => ({ job, score: quickScore(job) + (profileCities.some((c) => job.location.city.includes(c)) ? 5 : 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, hydrate);

  let hydrated = 0;
  await mapLimit(ranked, 4, async ({ job }) => {
    try {
      const detail = await cli(
        [job.rawSource.companyKey, 'detail', job.source_job_id, '--compact'],
        60000,
      );
      if (detail.ok && detail.description) {
        job.jd_text = String(detail.description).trim();
        job.rawSource.hydrated = true;
        hydrated += 1;
      }
    } catch {
      /* keep the list-level text */
    }
    await sleep(120);
  });
  console.log(`hydrated ${hydrated}/${ranked.length} JDs`);

  const meta = {
    generatedAt: startedAt.toISOString(),
    keywords,
    limit,
    hydrate,
    companiesScanned: companies.length,
    companiesHit: new Set(found.map((f) => f.companyKey)).size,
    total: jobs.length,
    hydrated,
    failed,
    jobs,
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'cn.json'), JSON.stringify(meta, null, 2), 'utf8');
  console.log(`→ ${path.join(outDir, 'cn.json')}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
