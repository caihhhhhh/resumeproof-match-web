import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(root, '.env.local');

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return [];
    const index = trimmed.indexOf('=');
    return [[trimmed.slice(0, index), trimmed.slice(index + 1).replace(/^['"]|['"]$/g, '')]];
  }));
}

const fileEnv = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
const has = (name) => Boolean(process.env[name]?.trim() || fileEnv[name]?.trim());
const all = (...names) => names.every(has);
const mark = (ready) => ready ? 'READY' : 'SETUP NEEDED';

const major = Number(process.versions.node.split('.')[0]);
console.log(`Node.js ${process.versions.node}: ${major >= 22 ? 'READY' : 'UPDATE TO 22.13+'}`);
console.log(`Interface and built-in demo: READY`);
console.log(`AI resume-JD matching: ${mark(has('DEEPSEEK_API_KEY'))}`);
console.log(`OCR for images and scanned PDFs: ${mark(has('ZHIPU_API_KEY'))}`);
console.log(`Private admin allowlist: ${mark(has('ADMIN_EMAILS'))}`);
console.log(`GA4 browser events: ${mark(has('NEXT_PUBLIC_GA_MEASUREMENT_ID'))}`);
console.log(`GA4 reports in admin: ${mark(all('GA4_PROPERTY_ID', 'GA4_SERVICE_ACCOUNT_EMAIL', 'GA4_SERVICE_ACCOUNT_PRIVATE_KEY'))}`);
console.log(`Sites project config: ${mark(existsSync(join(root, '.openai', 'hosting.json')))}`);
console.log('\nNo secret values were printed.');
