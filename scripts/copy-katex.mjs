import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const srcDir = join(root, 'node_modules/katex/dist');
const destDir = join(root, 'public/katex');

try {
  if (!existsSync(srcDir)) {
    console.warn('copy-katex: katex not installed yet, skip');
    process.exit(0);
  }
  mkdirSync(join(root, 'public'), { recursive: true });
  cpSync(srcDir, destDir, { recursive: true });
  console.log('copy-katex: copied to public/katex');
} catch (e) {
  console.error('copy-katex:', e);
  process.exit(1);
}
