import './styles/global.css';
import manifest from '../articles/manifest.json';
import siteMetaJson from './generated/site-meta.json';
import bio from './content/bio.txt?raw';
import {
  normalizePath,
  isDirPath,
  isFilePath,
  listDir,
  longestCommonPrefix,
  completePathFragment,
  getListingDirSegments,
  isVirtualFolderName,
} from './vfs';

const BASE = import.meta.env.BASE_URL;
const STORAGE_KEY = 'term_cwd_v1';

const COMMANDS = [
  'cat',
  'cd',
  'clear',
  'date',
  'help',
  'ls',
  'pwd',
  'tree',
  'whoami',
] as const;

interface ArticleEntry {
  slug: string;
  lsName: string;
  title: string;
}

type ManifestShape = {
  articles: ArticleEntry[];
};

const manifestData = manifest as unknown as ManifestShape;
const articles: ArticleEntry[] = manifestData.articles;

interface SiteMetaFile {
  files: Record<string, string>;
  folderArticles: string | null;
  folderProjects: string | null;
  projectFiles?: Record<string, string>;
}

const siteMeta = siteMetaJson as SiteMetaFile;

function mtimeForArticleLsName(lsName: string): string | undefined {
  return siteMeta.files[lsName];
}

const articleLsNames = articles.map((a) => a.lsName);
const articleFileNames = new Set(articleLsNames);
const articleLookup = new Map<string, string>();
for (const a of articles) {
  articleLookup.set(a.lsName, a.slug);
  articleLookup.set(a.slug, a.slug);
  articleLookup.set(a.slug + '.md', a.slug);
}

let cwd: string[] = [];

function cwdLabel(): string {
  if (cwd.length === 0) return '~';
  return '~/' + cwd.join('/');
}

function promptText(): string {
  return `visitor@welcome:${cwdLabel()}$ `;
}

function saveCwd(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cwd));
  } catch {
    /* ignore */
  }
}

function loadCwd(): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;
    const segs = parsed.filter((x): x is string => typeof x === 'string');
    if (isDirPath(segs)) cwd = segs;
  } catch {
    /* ignore */
  }
}

const loginTime = new Date().toLocaleString('en-US', {
  dateStyle: 'medium',
  timeStyle: 'medium',
});

const welcomeLines = [
  'Welcome to my personal website! ',
  'Type <span class="accent">help</span> for commands. Use Tab for completion; ↑ ↓ for history.',
  '',
  `<span class="accent">session opened</span> ${escapeHtml(loginTime)}`,
  '',
];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function pushLine(html: string, className?: string): void {
  const p = document.createElement('p');
  p.className = 'terminal-line' + (className ? ' ' + className : '');
  p.innerHTML = html;
  outputEl.appendChild(p);
}

function pushText(text: string, className?: string): void {
  for (const line of text.split('\n')) pushLine(escapeHtml(line), className);
}

const outputEl = document.createElement('div');
outputEl.className = 'terminal-output';

const app = document.getElementById('app')!;

loadCwd();

const welcome = document.createElement('div');
welcome.className = 'welcome-block';
welcome.innerHTML = welcomeLines.join('<br/>');

app.appendChild(welcome);
app.appendChild(outputEl);

const promptRow = document.createElement('div');
promptRow.className = 'terminal-prompt-row';

const promptSpan = document.createElement('span');
promptSpan.className = 'terminal-prompt';
promptSpan.textContent = promptText();

const inputWrap = document.createElement('div');
inputWrap.className = 'terminal-input-wrap';

const inputEl = document.createElement('input');
inputEl.id = 'terminal-input';
inputEl.type = 'text';
inputEl.autocomplete = 'off';
inputEl.spellcheck = false;
inputEl.setAttribute('aria-label', 'Terminal input');

promptRow.appendChild(promptSpan);
promptRow.appendChild(inputWrap);
inputWrap.appendChild(inputEl);
app.appendChild(promptRow);

let history: string[] = [];
let histIdx = -1;
let lastTabLine = '';
let lastTabAt = 0;

const nativeBlockCaretSupported =
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('caret-shape: block');

const blockCaretEl = document.createElement('div');
blockCaretEl.className = 'terminal-block-caret';
blockCaretEl.style.display = 'none';
inputWrap.appendChild(blockCaretEl);

function installBlockCaretFallback(): void {
  if (nativeBlockCaretSupported) return;
  inputEl.style.caretColor = 'transparent';
  blockCaretEl.style.display = 'block';
}

function measureTextWidth(text: string, font: string): number {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = font;
  return ctx.measureText(text).width;
}

function updateBlockCaretPosition(): void {
  if (nativeBlockCaretSupported) return;
  if (document.activeElement !== inputEl) {
    blockCaretEl.style.display = 'none';
    return;
  }

  blockCaretEl.style.display = 'block';
  const cs = getComputedStyle(inputEl);
  const font = cs.font;
  const padLeft = Number.parseFloat(cs.paddingLeft || '0') || 0;
  const padTop = Number.parseFloat(cs.paddingTop || '0') || 0;
  const before = inputEl.value.slice(0, inputEl.selectionStart ?? inputEl.value.length);
  const w = measureTextWidth(before, font);
  const x = padLeft + w - inputEl.scrollLeft;

  blockCaretEl.style.transform = `translate(${Math.max(0, x)}px, ${padTop}px)`;
}

function renderPrompt(): void {
  promptSpan.textContent = promptText();
}

function formatMtime(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function parseLsArgs(
  args: string[],
): { long: boolean; target: string } | { err: string } {
  const flags: string[] = [];
  const paths: string[] = [];
  for (const a of args) {
    if (a.startsWith('-')) {
      if (a === '-l' || a === '-la') flags.push(a);
      else return { err: `ls: invalid option -- '${a}'` };
    } else paths.push(a);
  }
  const long = flags.length > 0;
  if (paths.length > 1) return { err: 'ls: too many arguments' };
  return { long, target: paths[0] ?? '.' };
}

function runLs(args: string[]): void {
  const parsed = parseLsArgs(args);
  if ('err' in parsed) {
    pushText(parsed.err, 'terminal-line--error');
    return;
  }
  const { long, target } = parsed;
  const res = normalizePath(target, cwd);
  if ('err' in res) {
    pushText(`ls: cannot access '${target}': ${res.err}`, 'terminal-line--error');
    return;
  }
  const { segments } = res;
  if (segments.length === 2) {
    pushText(`ls: '${target}': Not a directory`, 'terminal-line--error');
    return;
  }
  if (!isDirPath(segments)) {
    pushText(`ls: cannot access '${target}': No such file or directory`, 'terminal-line--error');
    return;
  }
  const names = listDir(segments, articleLsNames);
  if (names.length === 0) {
    pushText(`ls: '${target}': No such file or directory`, 'terminal-line--error');
    return;
  }
  if (!long) {
    pushText(names.join('\n'));
    return;
  }

  const kindW = 8;
  const timeW = 22;
  const rows: { kind: string; mtime: string; name: string }[] = [];
  for (const name of names) {
    if (segments.length === 0) {
      const folderMtime =
        name === 'articles'
          ? siteMeta.folderArticles
          : name === 'projects'
            ? siteMeta.folderProjects
            : undefined;
      rows.push({
        kind: 'folder',
        mtime: formatMtime(folderMtime ?? undefined),
        name,
      });
      continue;
    }
    if (segments[0] === 'articles' && segments.length === 1) {
      rows.push({
        kind: 'file',
        mtime: formatMtime(mtimeForArticleLsName(name)),
        name,
      });
      continue;
    }
    if (segments[0] === 'projects' && segments.length === 1) {
      const m = siteMeta.projectFiles?.[name] ?? siteMeta.folderProjects;
      rows.push({
        kind: 'file',
        mtime: formatMtime(m),
        name,
      });
    }
  }
  for (const r of rows) {
    const line = `${r.kind.padEnd(kindW)} ${r.mtime.padEnd(timeW)} ${r.name}`;
    pushText(line);
  }
}

function runTree(): void {
  const artBranch = articleLsNames.map((n, i) => {
    const last = i === articleLsNames.length - 1;
    return `│   ${last ? '└── ' : '├── '}${n}`;
  });
  const lines = [
    '.',
    '├── articles',
    ...artBranch,
    '└── projects',
    '    ├── cuhksz-calendar-sync.html',
    '    └── raycaster.html',
  ];
  pushText(lines.join('\n'));
}

function runDate(): void {
  pushText(
    new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' }),
  );
}

function runPwd(): void {
  const physical = '/home/visitor' + (cwd.length ? '/' + cwd.join('/') : '');
  pushText(physical);
}

function runCd(arg: string | undefined): void {
  if (!arg || arg === '~') {
    cwd = [];
    renderPrompt();
    saveCwd();
    return;
  }
  const res = normalizePath(arg, cwd);
  if ('err' in res) {
    pushText(`cd: ${arg}: ${res.err}`, 'terminal-line--error');
    return;
  }
  const { segments } = res;
  if (segments.length === 2) {
    pushText(`cd: ${arg}: Not a directory`, 'terminal-line--error');
    return;
  }
  if (!isDirPath(segments)) {
    pushText(`cd: ${arg}: No such file or directory`, 'terminal-line--error');
    return;
  }
  cwd = segments;
  renderPrompt();
  saveCwd();
}

function navigateToArticle(slug: string): void {
  saveCwd();
  window.location.assign(`${BASE}articles/${slug}/`);
}

function runCat(arg: string | undefined): void {
  if (!arg) {
    pushText('cat: missing file operand', 'terminal-line--error');
    return;
  }
  const res = normalizePath(arg, cwd);
  if ('err' in res) {
    pushText(`cat: ${arg}: ${res.err}`, 'terminal-line--error');
    return;
  }
  const { segments } = res;
  if (!isFilePath(segments, articleFileNames)) {
    if (isDirPath(segments) && segments.length === 1) {
      pushText(`cat: ${arg}: Is a directory`, 'terminal-line--error');
      return;
    }
    pushText(`cat: ${arg}: No such file`, 'terminal-line--error');
    return;
  }
  const [dir, name] = segments;
  if (dir === 'articles') {
    const slug = articleLookup.get(name);
    if (slug) navigateToArticle(slug);
    else pushText(`cat: ${arg}: No such file`, 'terminal-line--error');
    return;
  }
  saveCwd();
  const projectPath =
    name === 'raycaster.html'
      ? 'projects/raycaster/index.html'
      : name === 'cuhksz-calendar-sync.html'
        ? 'projects/cuhksz-calendar-sync/index.html'
        : null;
  if (!projectPath) {
    pushText(`cat: ${arg}: No such file`, 'terminal-line--error');
    return;
  }
  window.location.assign(`${BASE}${projectPath}`);
}

function runWhoami(): void {
  pushText(bio.trimEnd(), 'terminal-line--system');
}

function runHelp(): void {
  pushText(
    [
      'Commands:',
      '  help       — this list',
      '  clear      — clear the screen',
      '  date       — current date and time',
      '  pwd        — print working directory (virtual)',
      '  tree       — show directory tree from ~',
      '  ls [PATH]  — list directory; use ls -l for type + mtime + name',
      '  cd DIR     — change directory (articles | projects | .. | ~ | /)',
      '  cat FILE   — open an article or project page',
      '  whoami     — short bio (edit src/content/bio.txt)',
    ].join('\n'),
    'terminal-line--system',
  );
}

function runClear(): void {
  outputEl.innerHTML = '';
}

function execLine(line: string): void {
  const trimmed = line.trim();
  if (!trimmed) return;

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0];
  const rest = parts.slice(1);

  switch (cmd) {
    case 'ls':
      runLs(rest);
      break;
    case 'cd':
      runCd(rest.join(' ') || undefined);
      break;
    case 'cat':
      runCat(rest.join(' ') || undefined);
      break;
    case 'whoami':
      runWhoami();
      break;
    case 'help':
      runHelp();
      break;
    case 'clear':
      runClear();
      break;
    case 'tree':
      runTree();
      break;
    case 'date':
      runDate();
      break;
    case 'pwd':
      runPwd();
      break;
    default:
      pushText(`${cmd}: command not found`, 'terminal-line--error');
  }
}

function onSubmit(): void {
  const line = inputEl.value;
  pushLine(`<span class="terminal-prompt">${escapeHtml(promptText())}</span>${escapeHtml(line)}`);

  if (history[history.length - 1] !== line) history.push(line);
  histIdx = history.length;
  inputEl.value = '';

  execLine(line);
  promptRow.scrollIntoView({ block: 'end' });
  inputEl.focus();
}

/** For `ls -l ...` / `ls -la ...`, strip known flags so the rest is a path fragment. */
function parseLsRestForTab(rest: string): { flagPrefix: string; frag: string } {
  const parts = rest.trim().split(/\s+/).filter(Boolean);
  const flags: string[] = [];
  let i = 0;
  while (i < parts.length && (parts[i] === '-l' || parts[i] === '-la')) {
    flags.push(parts[i]);
    i++;
  }
  const frag = parts.slice(i).join(' ');
  const flagPrefix = flags.length ? `${flags.join(' ')} ` : '';
  return { flagPrefix, frag };
}

function applyTabCompletion(): void {
  const line = inputEl.value;
  const now = Date.now();
  const leadWs = line.match(/^\s*/)?.[0] ?? '';
  const trimmed = line.slice(leadWs.length);
  const sp = trimmed.search(/\s/);

  if (sp === -1) {
    const p = trimmed;
    if (p === '') return;
    const hits = COMMANDS.filter((c) => c.startsWith(p)).sort();
    if (hits.length === 0) return;
    const lcp = longestCommonPrefix(hits);
    if (lcp === p && hits.length > 1) {
      if (lastTabLine === line && now - lastTabAt < 600) {
        pushText(hits.join('  '), 'terminal-line--system');
      }
      lastTabLine = line;
      lastTabAt = now;
      return;
    }
    inputEl.value = leadWs + lcp;
    lastTabLine = '';
    return;
  }

  const cmd = trimmed.slice(0, sp);
  if (!COMMANDS.includes(cmd as (typeof COMMANDS)[number])) return;

  let rest = trimmed.slice(sp + 1).replace(/^\s+/, '');
  let flagPrefix = '';
  if (cmd === 'ls') {
    const parsed = parseLsRestForTab(rest);
    flagPrefix = parsed.flagPrefix;
    rest = parsed.frag;
  }

  const frag = rest;
  const { matches, dirnamePrefix } = completePathFragment(frag, cwd, articleLsNames);
  if (matches.length === 0) return;

  const partialOnly = frag.lastIndexOf('/') >= 0 ? frag.slice(frag.lastIndexOf('/') + 1) : frag;
  const lcpBase = longestCommonPrefix(matches);
  let newPath = dirnamePrefix + lcpBase;

  const parentSeg = getListingDirSegments(frag, cwd);
  if (matches.length === 1 && parentSeg !== null) {
    const m = matches[0];
    if (isVirtualFolderName(m, parentSeg) && !newPath.endsWith('/')) {
      newPath += '/';
    }
  }

  if (matches.length > 1 && lcpBase === partialOnly) {
    if (lastTabLine === line && now - lastTabAt < 600) {
      pushText(matches.map((m) => dirnamePrefix + m).join('  '), 'terminal-line--system');
    }
    lastTabLine = line;
    lastTabAt = now;
    return;
  }

  inputEl.value = `${leadWs}${cmd} ${flagPrefix}${newPath}`;
  lastTabLine = '';
}

renderPrompt();

installBlockCaretFallback();
updateBlockCaretPosition();

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    applyTabCompletion();
    updateBlockCaretPosition();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    onSubmit();
    updateBlockCaretPosition();
    return;
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (history.length === 0) return;
    if (histIdx > 0) histIdx--;
    inputEl.value = history[histIdx] ?? '';
    updateBlockCaretPosition();
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (histIdx < history.length - 1) {
      histIdx++;
      inputEl.value = history[histIdx] ?? '';
    } else {
      histIdx = history.length;
      inputEl.value = '';
    }
    updateBlockCaretPosition();
  }
});

inputEl.addEventListener('input', () => updateBlockCaretPosition());
inputEl.addEventListener('click', () => updateBlockCaretPosition());
inputEl.addEventListener('keyup', () => updateBlockCaretPosition());
inputEl.addEventListener('focus', () => updateBlockCaretPosition());
inputEl.addEventListener('blur', () => updateBlockCaretPosition());

inputEl.focus();
