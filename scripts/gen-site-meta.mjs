/**
 * Writes src/generated/site-meta.json from filesystem mtimes (like Unix directory times).
 * Run before Vite so main.ts can import file mtimes for ls -l.
 */
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const manifest = JSON.parse(readFileSync(join(root, 'articles/manifest.json'), 'utf8'));

const files = {};
const articleMtimes = [];

for (const a of manifest.articles) {
  const p = join(root, 'articles', a.file);
  if (!existsSync(p)) continue;
  const iso = statSync(p).mtime.toISOString();
  files[a.lsName] = iso;
  articleMtimes.push(new Date(iso).getTime());
}

const folderArticles =
  articleMtimes.length > 0
    ? new Date(Math.max(...articleMtimes)).toISOString()
    : null;

let folderProjects = null;
const projectPages = [
  join(root, 'projects', 'raycaster', 'index.html'),
  join(root, 'projects', 'cuhksz-calendar-sync', 'index.html'),
];
const projectMtimes = projectPages
  .filter((p) => existsSync(p))
  .map((p) => statSync(p).mtime.toISOString())
  .map((iso) => new Date(iso).getTime());
if (projectMtimes.length > 0) {
  folderProjects = new Date(Math.max(...projectMtimes)).toISOString();
}

const out = {
  files,
  folderArticles,
  folderProjects,
};

const outDir = join(root, 'src', 'generated');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'site-meta.json'), JSON.stringify(out, null, 2));
console.log('gen-site-meta: wrote src/generated/site-meta.json');
