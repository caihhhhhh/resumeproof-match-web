import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const templates = [
  ['.env.example', '.env.local'],
  [join('.openai', 'hosting.example.json'), join('.openai', 'hosting.json')],
];

for (const [source, target] of templates) {
  const sourcePath = join(root, source);
  const targetPath = join(root, target);
  if (existsSync(targetPath)) {
    console.log(`keep  ${target}`);
    continue;
  }
  copyFileSync(sourcePath, targetPath);
  console.log(`create ${target}`);
}

console.log('\nNext: add server-side keys to .env.local, then run:');
console.log('  npm run doctor');
console.log('  npm run dev');
