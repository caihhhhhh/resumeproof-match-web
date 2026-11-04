#!/usr/bin/env node
/**
 * Local capture bridge for BOSS直聘 / 猎聘 / 智联招聘.
 *
 * These platforms have no public job API and forbid server-side automation,
 * so the public product never scrapes them. Instead the user's own browser,
 * already logged in, sends the postings they are looking at:
 *
 *   Chrome + tools/capture-extension  ->  POST http://127.0.0.1:7717/capture
 *                                         POST http://127.0.0.1:7717/capture/batch
 *
 * Run the HTTP server:  node scripts/jobs/bridge.mjs
 * Port: CAPTURE_PORT (default 7717), bind 127.0.0.1 only.
 *
 * Or push captured files to a ResumeProof deployment:
 *
 *   node scripts/jobs/bridge.mjs sync --token <token> --site <baseUrl> [--inbox tmp/jobs/inbox]
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..', '..');
const inbox = process.env.CAPTURE_INBOX ?? path.join(repo, 'tmp', 'jobs', 'inbox');
const port = Number(process.env.CAPTURE_PORT ?? 7717);
const MAX_BODY = 4 * 1024 * 1024;
const MAX_JOBS = 30;
const ALLOWED = new Set(['boss', 'liepin', 'zhaopin']);

function cors(res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  // Chrome's Local/Private Network Access preflight asks for this explicitly.
  res.setHeader('access-control-allow-private-network', 'true');
}

function json(res, status, body) {
  cors(res);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function clean(value, max = 20000) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

// A required/optional batch string: null when it is not a string or too long.
function text(value, max) {
  if (typeof value !== 'string') return null;
  const s = value.replace(/\u0000/g, '').trim();
  return s.length <= max ? s : null;
}

function optionalText(value, max) {
  if (value === undefined || value === null) return '';
  return text(value, max);
}

function httpUrl(value, max) {
  const s = typeof value === 'string' ? value.replace(/\u0000/g, '').trim() : '';
  if (!s || s.length > max) return null;
  try {
    const parsed = new URL(s);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? s : null;
  } catch {
    return null;
  }
}

function hashKey(site, url) {
  return createHash('sha256').update(`${site}|${url}`).digest('hex');
}

function validateBatch(body) {
  const site = typeof body?.site === 'string' ? body.site.trim().toLowerCase() : '';
  if (!ALLOWED.has(site)) return { error: 'site must be boss|zhaopin|liepin' };
  const pageUrl = httpUrl(body.pageUrl, 500);
  if (!pageUrl) return { error: 'pageUrl must be an http(s) URL of at most 500 chars' };
  if (!Array.isArray(body.jobs) || body.jobs.length < 1 || body.jobs.length > MAX_JOBS) {
    return { error: `jobs must be an array of 1..${MAX_JOBS}` };
  }
  const jobs = [];
  for (let i = 0; i < body.jobs.length; i += 1) {
    const raw = body.jobs[i];
    const where = `jobs[${i}]`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: `${where} must be an object` };
    const title = text(raw.title, 100);
    if (!title) return { error: `${where}.title must be a string of 1..100 chars` };
    const url = httpUrl(raw.url, 500);
    if (!url) return { error: `${where}.url must be an http(s) URL of at most 500 chars` };
    const company = optionalText(raw.company, 80);
    if (company === null) return { error: `${where}.company must be a string of at most 80 chars` };
    const salary = optionalText(raw.salary, 80);
    if (salary === null) return { error: `${where}.salary must be a string of at most 80 chars` };
    const location = optionalText(raw.location, 80);
    if (location === null) return { error: `${where}.location must be a string of at most 80 chars` };
    const jd = optionalText(raw.jd, 20000);
    if (jd === null) return { error: `${where}.jd must be a string of at most 20000 chars` };
    jobs.push({ title, company, salary, location, url, jd });
  }
  return { site, pageUrl, jobs };
}

// sha256(site|url) of every capture already in the inbox, so a batch can skip
// postings that a previous batch (or the single-job button) already stored.
let seen = new Set();

async function loadSeen() {
  const found = new Set();
  let files;
  try {
    files = await readdir(inbox);
  } catch {
    return found;
  }
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const record = JSON.parse(await readFile(path.join(inbox, file), 'utf8'));
      if (record && typeof record.site === 'string' && typeof record.url === 'string') {
        found.add(hashKey(record.site, record.url));
      }
    } catch {
      // Ignore files another writer is mid-way through.
    }
  }
  return found;
}

async function moveInto(targetDir, source) {
  const target = path.join(targetDir, path.basename(source));
  try {
    await rename(source, target);
  } catch (error) {
    if (error.code !== 'EEXIST' && error.code !== 'EPERM') throw error;
    // Never overwrite an earlier sync with the same timestamped name.
    await rename(source, path.join(targetDir, `${Date.now()}-${path.basename(source)}`));
  }
}

function flagValue(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return value === undefined || value.startsWith('--') ? undefined : value;
}

async function runSync(args) {
  const token = flagValue(args, '--token')?.trim();
  const base = flagValue(args, '--site')?.trim();
  const inboxFlag = flagValue(args, '--inbox')?.trim();
  if (!token || !base) {
    console.error('usage: node scripts/jobs/bridge.mjs sync --token <token> --site <baseUrl> [--inbox tmp/jobs/inbox]');
    process.exitCode = 1;
    return;
  }

  let origin;
  try {
    origin = new URL(base);
  } catch {
    console.error(`sync failed: invalid base URL "${base}"`);
    process.exitCode = 1;
    return;
  }
  if (origin.protocol !== 'http:' && origin.protocol !== 'https:') {
    console.error('sync failed: --site must be an http(s) base URL');
    process.exitCode = 1;
    return;
  }

  const inboxDir = inboxFlag ? path.resolve(inboxFlag) : inbox;
  const syncedDir = path.join(path.dirname(inboxDir), 'synced');
  const endpoint = `${origin.origin}${origin.pathname.replace(/\/+$/, '')}/api/jobs`;

  let names;
  try {
    names = (await readdir(inboxDir)).filter((name) => name.endsWith('.json')).sort();
  } catch (error) {
    console.error(`sync failed: cannot read inbox ${inboxDir}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  if (!names.length) {
    console.log(`inbox is empty: ${inboxDir}`);
    return;
  }

  const groups = new Map();
  let skipped = 0;
  for (const name of names) {
    let record;
    try {
      record = JSON.parse(await readFile(path.join(inboxDir, name), 'utf8'));
    } catch {
      console.warn(`skip ${name}: invalid JSON`);
      skipped += 1;
      continue;
    }
    const site = typeof record?.site === 'string' ? record.site.trim().toLowerCase() : '';
    if (!site || typeof record.url !== 'string' || !record.url) {
      console.warn(`skip ${name}: missing site or url`);
      skipped += 1;
      continue;
    }
    if (!groups.has(site)) groups.set(site, []);
    groups.get(site).push({ name, record });
  }

  await mkdir(syncedDir, { recursive: true });
  let moved = 0;
  let requests = 0;
  for (const [site, items] of groups) {
    for (let start = 0; start < items.length; start += MAX_JOBS) {
      const chunk = items.slice(start, start + MAX_JOBS);
      const payload = {
        site,
        jobs: chunk.map(({ record }) => ({
          title: String(record.title ?? ''),
          company: String(record.company ?? ''),
          salary: String(record.salary ?? ''),
          location: String(record.location ?? ''),
          url: record.url,
          jd: typeof record.jd === 'string' ? record.jd : '',
        })),
      };
      requests += 1;
      let res;
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        console.error(`sync failed: ${error.message}`);
        process.exitCode = 1;
        return;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error(`sync failed: HTTP ${res.status}`);
        if (body) console.error(body);
        process.exitCode = 1;
        return;
      }
      for (const item of chunk) {
        await moveInto(syncedDir, path.join(inboxDir, item.name));
        moved += 1;
      }
      console.log(`synced ${chunk.length} ${site} job(s) → ${syncedDir}`);
    }
  }
  console.log(`sync done: ${moved} file(s) moved in ${requests} request(s)${skipped ? `, ${skipped} skipped` : ''}`);
}

async function startServer() {
  await mkdir(inbox, { recursive: true });
  seen = await loadSeen();

  const server = http.createServer(async (req, res) => {
    const { url } = req;
    if (req.method === 'OPTIONS') {
      cors(res);
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === 'GET' && url === '/health') {
      json(res, 200, { ok: true, inbox });
      return;
    }
    if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
      cors(res);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><meta charset="utf-8"><title>ResumeProof Capture Bridge</title>
<body style="font:16px/1.6 system-ui;max-width:640px;margin:80px auto;padding:0 24px">
<h1>岗位捕获桥已启动</h1>
<p>1. 在 Chrome 打开 <code>chrome://extensions</code>，开启开发者模式，加载 <code>tools/capture-extension</code>。</p>
<p>2. 打开 BOSS直聘 / 猎聘 / 智联招聘 的岗位详情页，点右下角「捕获到 ResumeProof」；在搜索结果页点「采集本页」批量采集当前页。</p>
<p>3. 先运行 <code>node scripts/jobs/discover.mjs</code> 把捕获的岗位并进短名单，或用 <code>node scripts/jobs/bridge.mjs sync --token &lt;token&gt; --site &lt;baseUrl&gt;</code> 推送到线上。</p>
<p>捕获目录：<code>${inbox.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code></p>
</body>`);
      return;
    }
    if (req.method === 'POST' && url === '/capture') {
      try {
        const body = JSON.parse(await readBody(req));
        const site = String(body.site ?? '').toLowerCase();
        if (!ALLOWED.has(site)) return json(res, 400, { ok: false, error: 'site must be boss|liepin|zhaopin' });
        const jobUrl = clean(body.url, 2000);
        if (!/^https?:\/\//.test(jobUrl)) return json(res, 400, { ok: false, error: 'invalid url' });
        const jd = clean(body.jd);
        if (jd.length < 40) return json(res, 400, { ok: false, error: 'jd too short (min 40 chars)' });

        const record = {
          site,
          url: jobUrl,
          title: clean(body.title, 300),
          company: clean(body.company, 200),
          location: clean(body.location, 120),
          salary: clean(body.salary, 120),
          jd,
          posted_at: body.posted_at,
          captured_at: new Date().toISOString(),
          user_agent: clean(req.headers['user-agent'], 300),
        };
        const key = hashKey(site, jobUrl);
        const id = key.slice(0, 20);
        const file = path.join(inbox, `${Date.now()}-${id}.json`);
        // Same posting captured twice: keep only the newest copy.
        const existing = (await readdir(inbox)).filter((f) => f.includes(id));
        for (const old of existing) {
          await unlink(path.join(inbox, old)).catch(() => {});
        }
        await writeFile(file, JSON.stringify(record, null, 2), 'utf8');
        seen.add(key);
        console.log(`captured ${site} ${record.title} → ${path.basename(file)}`);
        return json(res, 200, { ok: true, id, file: path.basename(file) });
      } catch (error) {
        return json(res, 400, { ok: false, error: String(error.message ?? error) });
      }
    }
    if (req.method === 'POST' && url === '/capture/batch') {
      try {
        const body = JSON.parse(await readBody(req));
        const parsed = validateBatch(body);
        if (parsed.error) return json(res, 400, { ok: false, error: parsed.error });

        let accepted = 0;
        let duplicates = 0;
        for (const job of parsed.jobs) {
          const key = hashKey(parsed.site, job.url);
          if (seen.has(key)) {
            duplicates += 1;
            continue;
          }
          const record = {
            site: parsed.site,
            sourceUrl: job.url,
            pageUrl: parsed.pageUrl,
            title: job.title,
            company: job.company,
            salary: job.salary,
            location: job.location,
            url: job.url,
            jd: job.jd,
            capturedAt: Date.now(),
            captureMethod: 'search-batch',
          };
          const file = path.join(inbox, `${Date.now()}-${key.slice(0, 8)}.json`);
          await writeFile(file, JSON.stringify(record, null, 2), 'utf8');
          seen.add(key);
          accepted += 1;
          console.log(`captured batch ${parsed.site} ${job.title} → ${path.basename(file)}`);
        }
        return json(res, 202, { ok: true, accepted, duplicates });
      } catch (error) {
        return json(res, 400, { ok: false, error: String(error.message ?? error) });
      }
    }
    json(res, 404, { ok: false, error: 'not found' });
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`capture bridge listening on http://127.0.0.1:${port}  inbox=${inbox}`);
  });
}

const argv = process.argv.slice(2);
if (argv[0] === 'sync') {
  await runSync(argv.slice(1));
} else {
  await startServer();
}
