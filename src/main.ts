import './styles/global.css';
import manifest from '../articles/manifest.json';
import siteMetaJson from './generated/site-meta.json';
import profileText from './content/profile.txt?raw';
import { articleSourceByLsName, projectSourceByLsName } from './cat-sources';
import {
  normalizePath,
  normalizeCdPath,
  isDirPath,
  isFilePath,
  listDir,
  longestCommonPrefix,
  completePathFragment,
  getListingDirSegments,
  isVirtualFolderName,
} from './vfs';

const STORAGE_KEY = 'term_cwd_v1';
const SNAPSHOT_STORAGE_KEY = 'term_snapshot_v1';
const BASE = import.meta.env.BASE_URL;

const COMMANDS = [
  'cat',
  'cd',
  'clear',
  'date',
  'exit',
  'help',
  'ls',
  'pwd',
  'tree',
  'view',
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
  sizes?: Record<string, number>;
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
  for (const line of text.split('\n')) {
    // Empty lines must render as <br />; a bare <p></p> collapses to zero height in the browser.
    pushLine(line === '' ? '<br />' : escapeHtml(line), className);
  }
}

/** Like bash/readline: before listing ambiguous completions, echo prompt + current line into scrollback. */
function pushPromptEcho(line: string): void {
  pushLine(`<span class="terminal-prompt">${escapeHtml(promptText())}</span>${escapeHtml(line)}`);
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
function saveTerminalSnapshot(): void {
  try {
    sessionStorage.setItem(
      SNAPSHOT_STORAGE_KEY,
      JSON.stringify({
        outputHtml: outputEl.innerHTML,
        history,
        histIdx,
      }),
    );
  } catch {
    /* ignore */
  }
}

function restoreTerminalSnapshotIfAny(): void {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) return;
    sessionStorage.removeItem(SNAPSHOT_STORAGE_KEY);
    const data = JSON.parse(raw) as unknown;
    if (typeof data !== 'object' || data === null) return;
    const rec = data as { outputHtml?: unknown; history?: unknown; histIdx?: unknown };
    if (typeof rec.outputHtml !== 'string') return;
    outputEl.innerHTML = rec.outputHtml;
    if (Array.isArray(rec.history) && rec.history.every((x): x is string => typeof x === 'string')) {
      history.length = 0;
      history.push(...rec.history);
    }
    if (typeof rec.histIdx === 'number' && Number.isFinite(rec.histIdx)) {
      histIdx = Math.min(Math.max(-1, rec.histIdx), history.length);
    }
  } catch {
    /* ignore */
  }
}

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

const LS_USER = 'linzhengtan';
const LS_GROUP = 'public';

function two(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatLsTime(iso?: string): string {
  if (!iso) return '??? ?? ??:??';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '??? ?? ??:??';

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mon = months[d.getMonth()] ?? '???';
    const day = String(d.getDate()).padStart(2, ' ');

    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    if (sameYear) {
      return `${mon} ${day} ${two(d.getHours())}:${two(d.getMinutes())}`;
    }
    return `${mon} ${day}  ${d.getFullYear()}`;
  } catch {
    return '??? ?? ??:??';
  }
}

function parseLsArgs(
  args: string[],
): { long: boolean; human: boolean; target: string } | { err: string } {
  const paths: string[] = [];
  let long = false;
  let human = false;
  let all = false;
  for (const a of args) {
    if (a.startsWith('-')) {
      // Support common combined flags: -l, -a, -h, -la, -lh, -alh, ...
      for (const ch of a.slice(1)) {
        if (ch === 'l') long = true;
        else if (ch === 'h') human = true;
        else if (ch === 'a') all = true;
        else return { err: `ls: invalid option -- '${ch}'` };
      }
    } else paths.push(a);
  }
  if (paths.length > 1) return { err: 'ls: too many arguments' };
  return { long, human, target: paths[0] ?? '.' };
}

function lsFileBaseName(segments: string[]): string {
  return segments.length === 2 ? segments[1] : segments[0];
}

function runLs(args: string[]): void {
  const parsed = parseLsArgs(args);
  if ('err' in parsed) {
    pushText(parsed.err, 'terminal-line--error');
    return;
  }
  const { long, human, target } = parsed;
  const res = normalizePath(target, cwd);
  if ('err' in res) {
    pushText(`ls: cannot access '${target}': ${res.err}`, 'terminal-line--error');
    return;
  }
  const { segments } = res;

  const formatSize = (bytes: number): string => {
    if (!human) return String(bytes);
    if (!Number.isFinite(bytes) || bytes < 0) return '0';
    if (bytes < 1024) return String(bytes);
    const units = ['K', 'M', 'G', 'T', 'P', 'E'];
    let v = bytes / 1024;
    let u = 0;
    while (v >= 1024 && u < units.length - 1) {
      v /= 1024;
      u++;
    }
    const num = v < 10 ? v.toFixed(1) : Math.round(v).toString();
    return `${num}${units[u]}`;
  };

  const sizeOf = (name: string): number => siteMeta.sizes?.[name] ?? 0;

  if (isFilePath(segments, articleFileNames)) {
    const baseName = lsFileBaseName(segments);
    if (!long) {
      pushText(baseName);
      return;
    }
    let mtimeIso: string | undefined;
    if (segments.length === 1 && segments[0] === 'profile.txt') {
      mtimeIso = siteMeta.files['profile.txt'];
    } else if (segments[0] === 'articles') {
      mtimeIso = siteMeta.files[baseName];
    } else {
      mtimeIso = siteMeta.projectFiles?.[baseName] ?? siteMeta.folderProjects ?? undefined;
    }
    const rowsFile: {
      mode: string;
      nlink: string;
      user: string;
      group: string;
      size: string;
      time: string;
      name: string;
    }[] = [
      {
        mode: '-rw-r--r--',
        nlink: '1',
        user: LS_USER,
        group: LS_GROUP,
        size: formatSize(sizeOf(baseName)),
        time: formatLsTime(mtimeIso),
        name: baseName,
      },
    ];
    const nlinkWf = Math.max(2, ...rowsFile.map((r) => r.nlink.length));
    const userWf = Math.max(LS_USER.length, ...rowsFile.map((r) => r.user.length));
    const groupWf = Math.max(LS_GROUP.length, ...rowsFile.map((r) => r.group.length));
    const sizeWf = Math.max(1, ...rowsFile.map((r) => r.size.length));
    for (const r of rowsFile) {
      const line =
        `${r.mode} ` +
        `${r.nlink.padStart(nlinkWf, ' ')} ` +
        `${r.user.padEnd(userWf, ' ')} ` +
        `${r.group.padEnd(groupWf, ' ')} ` +
        `${r.size.padStart(sizeWf, ' ')} ` +
        `${r.time} ` +
        `${r.name}`;
      pushText(line);
    }
    return;
  }

  if (segments.length === 2) {
    pushText(`ls: cannot access '${target}': No such file or directory`, 'terminal-line--error');
    return;
  }
  if (!isDirPath(segments)) {
    pushText(`ls: cannot access '${target}': No such file or directory`, 'terminal-line--error');
    return;
  }
  const names = listDir(segments, articleLsNames);
  if (names.length === 0) {
    pushText(`ls: cannot access '${target}': No such file or directory`, 'terminal-line--error');
    return;
  }
  if (!long) {
    pushText(names.join('\n'));
    return;
  }

  const rows: {
    mode: string;
    nlink: string;
    user: string;
    group: string;
    size: string;
    time: string;
    name: string;
  }[] = [];

  for (const name of names) {
    if (segments.length === 0) {
      if (name === 'articles' || name === 'projects') {
        const folderMtime = name === 'articles' ? siteMeta.folderArticles : siteMeta.folderProjects;
        rows.push({
          mode: 'drwxr-xr-x',
          nlink: '2',
          user: LS_USER,
          group: LS_GROUP,
          size: formatSize(4096),
          time: formatLsTime(folderMtime ?? undefined),
          name,
        });
        continue;
      }
      if (name === 'profile.txt') {
        rows.push({
          mode: '-rw-r--r--',
          nlink: '1',
          user: LS_USER,
          group: LS_GROUP,
          size: formatSize(sizeOf(name)),
          time: formatLsTime(siteMeta.files['profile.txt']),
          name,
        });
        continue;
      }
      continue;
    }
    if (segments[0] === 'articles' && segments.length === 1) {
      rows.push({
        mode: '-rw-r--r--',
        nlink: '1',
        user: LS_USER,
        group: LS_GROUP,
        size: formatSize(sizeOf(name)),
        time: formatLsTime(mtimeForArticleLsName(name)),
        name,
      });
      continue;
    }
    if (segments[0] === 'projects' && segments.length === 1) {
      const m = siteMeta.projectFiles?.[name] ?? siteMeta.folderProjects;
      rows.push({
        mode: '-rw-r--r--',
        nlink: '1',
        user: LS_USER,
        group: LS_GROUP,
        size: formatSize(sizeOf(name)),
        time: formatLsTime(m),
        name,
      });
    }
  }

  const nlinkW = Math.max(2, ...rows.map((r) => r.nlink.length));
  const userW = Math.max(LS_USER.length, ...rows.map((r) => r.user.length));
  const groupW = Math.max(LS_GROUP.length, ...rows.map((r) => r.group.length));
  const sizeW = Math.max(1, ...rows.map((r) => r.size.length));

  for (const r of rows) {
    const line =
      `${r.mode} ` +
      `${r.nlink.padStart(nlinkW, ' ')} ` +
      `${r.user.padEnd(userW, ' ')} ` +
      `${r.group.padEnd(groupW, ' ')} ` +
      `${r.size.padStart(sizeW, ' ')} ` +
      `${r.time} ` +
      `${r.name}`;
    pushText(line);
  }
}

/** ASCII tree for a flat list of names (current directory only). */
function treeFlat(names: string[]): string[] {
  const sorted = [...names].sort();
  if (sorted.length === 0) return ['.'];
  const lines: string[] = ['.'];
  for (let i = 0; i < sorted.length; i++) {
    const last = i === sorted.length - 1;
    lines.push(`${last ? '└── ' : '├── '}${sorted[i]}`);
  }
  return lines;
}

function runTree(): void {
  if (cwd.length === 0) {
    const top = listDir([], articleLsNames);
    const lines: string[] = ['.'];
    for (let i = 0; i < top.length; i++) {
      const name = top[i];
      const isLastTop = i === top.length - 1;
      const branch = isLastTop ? '└── ' : '├── ';
      const cont = isLastTop ? '    ' : '│   ';
      if (name === 'articles') {
        lines.push(`${branch}articles`);
        const files = listDir(['articles'], articleLsNames);
        for (let j = 0; j < files.length; j++) {
          const lastF = j === files.length - 1;
          lines.push(`${cont}${lastF ? '└── ' : '├── '}${files[j]}`);
        }
      } else if (name === 'projects') {
        lines.push(`${branch}projects`);
        const files = listDir(['projects'], articleLsNames);
        for (let j = 0; j < files.length; j++) {
          const lastF = j === files.length - 1;
          lines.push(`${cont}${lastF ? '└── ' : '├── '}${files[j]}`);
        }
      } else {
        lines.push(`${branch}${name}`);
      }
    }
    pushText(lines.join('\n'));
    return;
  }
  if (cwd.length === 1 && cwd[0] === 'articles') {
    pushText(treeFlat(listDir(['articles'], articleLsNames)).join('\n'));
    return;
  }
  if (cwd.length === 1 && cwd[0] === 'projects') {
    pushText(treeFlat(listDir(['projects'], articleLsNames)).join('\n'));
    return;
  }
  pushText('.');
}

function runExit(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(SNAPSHOT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  app.innerHTML = '';
  const end = document.createElement('p');
  end.className = 'terminal-session-end';
  end.textContent = 'Session closed.';
  app.appendChild(end);
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
  const res = normalizeCdPath(arg, cwd);
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
    if (isFilePath(segments, articleFileNames)) {
      pushText(`cd: ${arg}: Not a directory`, 'terminal-line--error');
      return;
    }
    pushText(`cd: ${arg}: No such file or directory`, 'terminal-line--error');
    return;
  }
  cwd = segments;
  renderPrompt();
  saveCwd();
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
  if (segments.length === 1 && segments[0] === 'profile.txt') {
    pushText(profileText.trimEnd(), 'terminal-line--system');
    return;
  }
  const [dir, name] = segments;
  if (dir === 'articles') {
    const md = articleSourceByLsName.get(name);
    if (md !== undefined) {
      pushText(md.trimEnd(), 'terminal-line--system');
      return;
    }
    pushText(`cat: ${arg}: No such file`, 'terminal-line--error');
    return;
  }
  const html = projectSourceByLsName.get(name);
  if (html !== undefined) {
    pushText(html.trimEnd(), 'terminal-line--system');
    return;
  }
  pushText(`cat: ${arg}: No such file`, 'terminal-line--error');
}

function runView(arg: string | undefined): void {
  if (!arg) {
    pushText('view: missing file operand', 'terminal-line--error');
    return;
  }
  const res = normalizePath(arg, cwd);
  if ('err' in res) {
    pushText(`view: ${arg}: ${res.err}`, 'terminal-line--error');
    return;
  }
  const { segments } = res;
  if (!isFilePath(segments, articleFileNames)) {
    if (isDirPath(segments) && segments.length === 1) {
      pushText(`view: ${arg}: Is a directory`, 'terminal-line--error');
      return;
    }
    pushText(`view: ${arg}: No such file`, 'terminal-line--error');
    return;
  }
  if (segments.length === 1 && segments[0] === 'profile.txt') {
    saveTerminalSnapshot();
    saveCwd();
    window.location.assign(`${BASE}profile/index.html`);
    return;
  }
  const [dir, name] = segments;
  if (dir === 'articles') {
    const slug = articleLookup.get(name);
    if (slug) {
      saveTerminalSnapshot();
      saveCwd();
      window.location.assign(`${BASE}articles/${slug}/`);
      return;
    }
    pushText(`view: ${arg}: No such file`, 'terminal-line--error');
    return;
  }
  const projectPath =
    name === 'animal-feeding-3d-raycaster.html'
      ? 'projects/raycaster/index.html'
      : name === 'cuhksz-deadlines-to-google-calendar.html'
        ? 'projects/cuhksz-calendar-sync/index.html'
        : null;
  if (!projectPath) {
    pushText(`view: ${arg}: No such file`, 'terminal-line--error');
    return;
  }
  saveTerminalSnapshot();
  saveCwd();
  window.location.assign(`${BASE}${projectPath}`);
}

function runWhoami(): void {
  pushText('visitor', 'terminal-line--system');
}

function runHelp(): void {
  pushText(
    [
      'Commands:',
      '  help                 Print this help',
      '  clear                Clear the screen',
      '  date                 Print date/time',
      '  pwd                  Print current path',
      '  tree                 Print tree from current directory',
      '  exit                 Close this terminal',
      '  whoami               Print effective user',
      '  cd [DIR]             Change directory',
      '  cat [FILE]           Print raw file contents',
      '  view [FILE]          Open formatted page',
      '                       On those pages: ? opens keyboard help; q closes help',
      '                       or returns home. Click ← close help in the panel too.',
      '  ls [OPTION]... [PATH]',
      '                       List file or directory contents',
      '                       -l long listing',
      '                       -h with -l, human-readable sizes',
      '                       -a hidden files',
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
    case 'view':
      runView(rest.join(' ') || undefined);
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
    case 'exit':
      runExit();
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
  if (!app.contains(promptRow)) return;
  promptRow.scrollIntoView({ block: 'end' });
  inputEl.focus();
}

/** For `ls ...`, strip known flags so the rest is a path fragment. */
function parseLsRestForTab(rest: string): { flagPrefix: string; frag: string } {
  const parts = rest.trim().split(/\s+/).filter(Boolean);
  const flags: string[] = [];
  let i = 0;
  while (i < parts.length && parts[i].startsWith('-') && parts[i] !== '-') {
    const token = parts[i];
    // Accept only l/h flags here; anything else should remain so `ls` can error on Enter.
    const body = token.slice(1);
    if (body.length === 0) break;
    const ok = [...body].every((ch) => ch === 'l' || ch === 'h' || ch === 'a');
    if (!ok) break;
    flags.push(token);
    i++;
  }
  const frag = parts.slice(i).join(' ');
  const flagPrefix = flags.length ? `${flags.join(' ')} ` : '';
  return { flagPrefix, frag };
}

function applyTabCompletion(): void {
  const line = inputEl.value;
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
      pushPromptEcho(line);
      pushText(hits.join('  '), 'terminal-line--system');
      return;
    }
    inputEl.value = leadWs + lcp;
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
    pushPromptEcho(line);
    pushText(matches.map((m) => dirnamePrefix + m).join('  '), 'terminal-line--system');
    return;
  }

  inputEl.value = `${leadWs}${cmd} ${flagPrefix}${newPath}`;
}

restoreTerminalSnapshotIfAny();
renderPrompt();
promptRow.scrollIntoView({ block: 'end' });

installBlockCaretFallback();
updateBlockCaretPosition();

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    applyTabCompletion();
    promptRow.scrollIntoView({ block: 'end' });
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
