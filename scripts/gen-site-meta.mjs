/**
 * Writes src/generated/site-meta.json from Git last-commit times.
 * Run before Vite so main.ts can import mtimes for `ls -l`.
 */
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const manifest = JSON.parse(readFileSync(join(root, 'articles/manifest.json'), 'utf8'));

function tryGitLastCommitIso(absPath) {
  try {
    const relPath = relative(root, absPath);
    if (!relPath || relPath.startsWith('..')) return null;
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', relPath], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out ? out : null;
  } catch {
    return null;
  }
}

function autoIsoForPath(absPath) {
  const gitIso = tryGitLastCommitIso(absPath);
  if (gitIso) return gitIso;
  try {
    return statSync(absPath).mtime.toISOString();
  } catch {
    return null;
  }
}

const files = {};
const articleTimes = [];

for (const a of manifest.articles) {
  const p = join(root, 'articles', a.file);
  if (!existsSync(p)) continue;
  const iso = autoIsoForPath(p);
  if (!iso) continue;
  files[a.lsName] = iso;
  articleTimes.push(new Date(iso).getTime());
}

const folderArticles =
  articleTimes.length > 0
    ? new Date(Math.max(...articleTimes)).toISOString()
    : null;

const projectFiles = {};
const projectTimeCandidates = [];

const projects = [
  { lsName: 'raycaster.html', path: join(root, 'projects', 'raycaster', 'index.html') },
  { lsName: 'cuhksz-calendar-sync.html', path: join(root, 'projects', 'cuhksz-calendar-sync', 'index.html') },
];
for (const p of projects) {
  if (!existsSync(p.path)) continue;
  const iso = autoIsoForPath(p.path);
  if (!iso) continue;
  projectFiles[p.lsName] = iso;
  projectTimeCandidates.push(new Date(iso).getTime());
}
const folderProjects =
  projectTimeCandidates.length > 0 ? new Date(Math.max(...projectTimeCandidates)).toISOString() : null;

const out = {
  files,
  folderArticles,
  folderProjects,
  projectFiles,
};

const outDir = join(root, 'src', 'generated');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'site-meta.json'), JSON.stringify(out, null, 2));
console.log('gen-site-meta: wrote src/generated/site-meta.json');
