import { createHash } from 'node:crypto';

export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36';

export const NOW = () => new Date().toISOString();

export function sha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

export function stripHtml(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div|h\d|tr)>/gi, '\n')
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

export function parseCnDate(text) {
  const s = String(text ?? '');
  const m = /(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(s);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00+08:00`;
  }
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}T00:00:00+08:00`;
  return undefined;
}

export function requiredYears(text) {
  const s = String(text ?? '');
  if (/不限|无要求|不限经验/.test(s)) return 0;
  if (/在校|应届|实习/.test(s)) return 0;
  // "3-5年" -> floor of the range; never treat a calendar year as experience.
  const range = /(\d{1,2})\s*[-–~至]\s*(\d{1,2})\s*年/.exec(s);
  if (range) return Number(range[1]);
  const m =
    /(\d{1,2})\s*年(?:及)?以上/.exec(s) ??
    /(\d{1,2})\s*年(?:工作)?经验/.exec(s) ??
    /工作经验\s*(\d{1,2})\s*年/.exec(s);
  return m ? Number(m[1]) : undefined;
}

const CN_CITIES =
  /北京|上海|广州|深圳|杭州|成都|武汉|南京|西安|苏州|重庆|天津|长沙|郑州|东莞|佛山|珠海|厦门|福州|合肥|青岛|济南|大连|无锡|宁波|昆明|南昌|贵阳|石家庄|太原|沈阳|长春|哈尔滨|香港|澳门|台北/;

export function normaliseLocation(raw, { remoteHint = false } = {}) {
  const text = String(raw ?? '').trim();
  const remote = remoteHint || /remote|远程|居家|anywhere/i.test(text);
  const city = (CN_CITIES.exec(text)?.[0] ?? text.replace(/^中国/, '').split(/[，,、/|·]/)[0]).trim();
  return { raw: text, city, country: /中国|China/i.test(text) || CN_CITIES.test(text) ? '中国' : '', remote };
}

export function makeJob({
  source,
  sourceJobId,
  url,
  applyUrl,
  title,
  company,
  location,
  jdText,
  postedAt,
  requirements = [],
  skills = [],
  salary,
  employmentType,
  rawSource,
  requiredYearsOverride,
}) {
  const loc = normaliseLocation(location?.raw ?? location ?? '', { remoteHint: location?.remote });
  const cleanTitle = String(title ?? '').replace(/\s+/g, ' ').trim() || '(untitled)';
  return {
    schema_version: 1,
    id: `${source}:${sourceJobId}`,
    source,
    source_job_id: String(sourceJobId),
    url,
    apply_url: applyUrl ?? url,
    title: cleanTitle,
    company,
    location: {
      raw: loc.raw,
      city: location?.city ?? loc.city,
      country: location?.country ?? loc.country,
      remote: location?.remote ?? loc.remote,
    },
    employment_type: employmentType,
    salary,
    posted_at: postedAt,
    captured_at: NOW(),
    jd_text: String(jdText ?? '').trim(),
    requirements,
    skills,
    dedupe_hash: sha256([company, cleanTitle.toLowerCase(), loc.city].join('|')),
    status: 'discovered',
    rawSource: rawSource ?? {},
    _requiredYears: requiredYearsOverride ?? requiredYears(jdText),
  };
}

export async function fetchWithTimeout(url, options = {}, ms = 15000) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res;
}

export async function getJson(url, ms = 20000, headers = {}) {
  return retry(async () => {
    const res = await fetchWithTimeout(url, {
      headers: { 'user-agent': UA, accept: 'application/json', ...headers },
    }, ms);
    return res.json();
  });
}

export async function postJson(url, body, ms = 20000, headers = {}) {
  return retry(async () => {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'user-agent': UA, 'content-type': 'application/json', accept: 'application/json', ...headers },
      body: JSON.stringify(body),
    }, ms);
    return res.json();
  });
}

/** One retry for transient network failures; 4xx is permanent, don't retry. */
async function retry(fn, attempts = 2) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (/HTTP 4\d\d/.test(String(error?.message))) throw error;
      if (i < attempts - 1) await sleep(500);
    }
  }
  throw last;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
