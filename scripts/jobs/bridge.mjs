#!/usr/bin/env node
/**
 * Local capture bridge for BOSS直聘 / 猎聘 / 智联招聘.
 *
 * These platforms have no public job API and forbid server-side automation,
 * so the public product never scrapes them. Instead the user's own browser,
 * already logged in, sends the one posting they are looking at:
 *
 *   Chrome + tools/capture-extension  ->  POST http://127.0.0.1:7717/capture
 *
 * Run:  node scripts/jobs/bridge.mjs
 * Port: CAPTURE_PORT (default 7717), bind 127.0.0.1 only.
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..', '..');
const inbox = process.env.CAPTURE_INBOX ?? path.join(repo, 'tmp', 'jobs', 'inbox');
const port = Number(process.env.CAPTURE_PORT ?? 7717);
const MAX_BODY = 512 * 1024;
const ALLOWED = new Set(['boss', 'liepin', 'zhaopin']);

await mkdir(inbox, { recursive: true });

function cors(res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
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
<p>2. 打开 BOSS直聘 / 猎聘 / 智联招聘 的岗位详情页，点右下角「捕获到 ResumeProof」。</p>
<p>3. 先运行 <code>node scripts/jobs/discover.mjs</code> 把捕获的岗位并进短名单。</p>
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
      const id = createHash('sha256').update(`${site}|${jobUrl}`).digest('hex').slice(0, 20);
      const file = path.join(inbox, `${Date.now()}-${id}.json`);
      // Same posting captured twice: keep only the newest copy.
      const existing = (await readdir(inbox)).filter((f) => f.includes(id));
      for (const old of existing) {
        await unlink(path.join(inbox, old)).catch(() => {});
      }
      await writeFile(file, JSON.stringify(record, null, 2), 'utf8');
      console.log(`captured ${site} ${record.title} → ${path.basename(file)}`);
      return json(res, 200, { ok: true, id, file: path.basename(file) });
    } catch (error) {
      return json(res, 400, { ok: false, error: String(error.message ?? error) });
    }
  }
  json(res, 404, { ok: false, error: 'not found' });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`capture bridge listening on http://127.0.0.1:${port}  inbox=${inbox}`);
});
