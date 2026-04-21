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
const sizes = {};
const articleTimes = [];

for (const a of manifest.articles) {
  const p = join(root, 'articles', a.file);
  if (!existsSync(p)) continue;
  const iso = autoIsoForPath(p);
  if (!iso) continue;
  files[a.lsName] = iso;
  try {
    sizes[a.lsName] = statSync(p).size;
  } catch {
    // ignore
  }
  articleTimes.push(new Date(iso).getTime());
}

const profilePath = join(root, 'src', 'content', 'profile.txt');
if (existsSync(profilePath)) {
  const iso = autoIsoForPath(profilePath);
  if (iso) files['profile.txt'] = iso;
  try {
    sizes['profile.txt'] = statSync(profilePath).size;
  } catch {
    // ignore
  }
}

const folderArticles =
  articleTimes.length > 0
    ? new Date(Math.max(...articleTimes)).toISOString()
    : null;

const projectFiles = {};
const projectTimeCandidates = [];

const projects = [
  { lsName: 'animal-feeding-3d-raycaster.html', path: join(root, 'projects', 'raycaster', 'index.html') },
  {
    lsName: 'cuhksz-deadlines-to-google-calendar.html',
    path: join(root, 'projects', 'cuhksz-calendar-sync', 'index.html'),
  },
];
for (const p of projects) {
  if (!existsSync(p.path)) continue;
  const iso = autoIsoForPath(p.path);
  if (!iso) continue;
  projectFiles[p.lsName] = iso;
  try {
    sizes[p.lsName] = statSync(p.path).size;
  } catch {
    // ignore
  }
  projectTimeCandidates.push(new Date(iso).getTime());
}
const folderProjects =
  projectTimeCandidates.length > 0 ? new Date(Math.max(...projectTimeCandidates)).toISOString() : null;

const out = {
  files,
  sizes,
  folderArticles,
  folderProjects,
  projectFiles,
};

const outDir = join(root, 'src', 'generated');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'site-meta.json'), JSON.stringify(out, null, 2));
console.log('gen-site-meta: wrote src/generated/site-meta.json');
