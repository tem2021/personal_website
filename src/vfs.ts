/** Virtual filesystem: ~ contains profile.txt plus articles/ and projects/ (flat files under each). */

function splitPathParts(s: string): string[] {
  return s.split('/').filter((p) => p.length > 0 && p !== '.');
}

function resolveAbsoluteFromRoot(parts: string[]): string[] {
  const stk: string[] = [];
  for (const p of parts) {
    if (p === '..') {
      if (stk.length > 0) stk.pop();
    } else {
      stk.push(p);
    }
  }
  return stk;
}

/**
 * Map a resolved absolute path (from `/`) onto virtual cwd segments under `/home/visitor`.
 * Anything outside `/home/visitor` is `Permission denied`.
 */
function mapAbsoluteToVirtualCd(abs: string[]): { segments: string[] } | { err: string } {
  if (abs.length < 2 || abs[0] !== 'home' || abs[1] !== 'visitor') {
    return { err: 'Permission denied' };
  }
  const virtual = abs.slice(2);
  if (virtual.length > 2) {
    return { err: 'No such file or directory' };
  }
  return { segments: virtual };
}

function walkCdRelative(parts: string[], stack: string[]): { segments: string[] } | { err: string } {
  for (const p of parts) {
    if (p === '..') {
      if (stack.length === 0) return { err: 'Permission denied' };
      stack.pop();
    } else {
      stack.push(p);
    }
  }
  if (stack.length > 2) {
    return { err: 'No such file or directory' };
  }
  return { segments: stack };
}

/**
 * `cd` only: paths must stay within `/home/visitor` (~). Absolute paths must start with `/home/visitor`.
 * Going above ~ (e.g. `cd ..` at ~) yields `Permission denied`.
 */
export function normalizeCdPath(
  spec: string,
  fromCwd: string[],
): { segments: string[] } | { err: string } {
  const raw = spec.trim();
  if (raw === '' || raw === '.') {
    return { segments: [...fromCwd] };
  }
  if (raw === '~' || raw === '~/') {
    return { segments: [] };
  }
  if (raw.startsWith('~/')) {
    return walkCdRelative(splitPathParts(raw.slice(2)), []);
  }
  if (raw.startsWith('/')) {
    const rawPath = raw.replace(/\/{2,}/g, '/');
    const segments = splitPathParts(rawPath.startsWith('/') ? rawPath.slice(1) : rawPath);
    const abs = resolveAbsoluteFromRoot(segments);
    return mapAbsoluteToVirtualCd(abs);
  }
  return walkCdRelative(splitPathParts(raw), [...fromCwd]);
}

export function normalizePath(
  spec: string,
  fromCwd: string[],
): { segments: string[] } | { err: string } {
  const raw = spec.trim();
  if (raw === '' || raw === '.') {
    return { segments: [...fromCwd] };
  }

  let pathPart = raw;
  let absolute = false;
  if (raw === '~' || raw === '~/') {
    pathPart = '';
    absolute = true;
  } else if (raw.startsWith('~/')) {
    pathPart = raw.slice(2);
    absolute = true;
  } else if (raw.startsWith('/')) {
    pathPart = raw.slice(1);
    absolute = true;
  }

  const parts = pathPart.split('/').filter((p) => p.length > 0 && p !== '.');
  const stack = absolute ? [] : [...fromCwd];

  for (const p of parts) {
    if (p === '..') {
      stack.pop();
      continue;
    }
    stack.push(p);
  }

  if (stack.length > 2) {
    return { err: 'No such file or directory' };
  }

  return { segments: stack };
}

export function isDirPath(segments: string[]): boolean {
  if (segments.length === 0) return true;
  if (segments.length === 1) {
    return segments[0] === 'articles' || segments[0] === 'projects';
  }
  return false;
}

export function isFilePath(
  segments: string[],
  articleFileNames: Set<string>,
): boolean {
  if (segments.length === 1) return segments[0] === 'profile.txt';
  if (segments.length !== 2) return false;
  const [dir, name] = segments;
  if (dir === 'articles') return articleFileNames.has(name);
  if (dir === 'projects')
    return name === 'animal-feeding-3d-raycaster.html' || name === 'cuhksz-deadlines-to-google-calendar.html';
  return false;
}

export function listDir(segments: string[], articleLsNames: string[]): string[] {
  if (segments.length === 0) return ['profile.txt', 'articles', 'projects'];
  if (segments.length === 1 && segments[0] === 'articles') return [...articleLsNames];
  if (segments.length === 1 && segments[0] === 'projects')
    return ['cuhksz-deadlines-to-google-calendar.html', 'animal-feeding-3d-raycaster.html'];
  return [];
}

export function longestCommonPrefix(strs: string[]): string {
  if (strs.length === 0) return '';
  let i = 0;
  loop: for (; i < strs[0].length; i++) {
    const c = strs[0][i];
    for (let j = 1; j < strs.length; j++) {
      if (i >= strs[j].length || strs[j][i] !== c) break loop;
    }
  }
  return strs[0].slice(0, i);
}

export function completePathFragment(
  fragment: string,
  fromCwd: string[],
  articleLsNames: string[],
): { matches: string[]; dirnamePrefix: string } {
  const lastSlash = fragment.lastIndexOf('/');
  const dirSpec = lastSlash >= 0 ? fragment.slice(0, lastSlash) : '';
  const partial = lastSlash >= 0 ? fragment.slice(lastSlash + 1) : fragment;
  const dirnamePrefix = lastSlash >= 0 ? fragment.slice(0, lastSlash + 1) : '';

  const dirNorm = normalizePath(dirSpec === '' ? '.' : dirSpec, fromCwd);
  if ('err' in dirNorm) return { matches: [], dirnamePrefix };
  if (!isDirPath(dirNorm.segments)) return { matches: [], dirnamePrefix };

  const names = listDir(dirNorm.segments, articleLsNames);
  const matches = names.filter((n) => n.startsWith(partial));
  return { matches, dirnamePrefix };
}

/** Directory whose children we are completing (for folder vs file + trailing `/`). */
export function getListingDirSegments(
  fragment: string,
  fromCwd: string[],
): string[] | null {
  const lastSlash = fragment.lastIndexOf('/');
  const dirSpec = lastSlash >= 0 ? fragment.slice(0, lastSlash) : '';
  const dirNorm = normalizePath(dirSpec === '' ? '.' : dirSpec, fromCwd);
  if ('err' in dirNorm) return null;
  if (!isDirPath(dirNorm.segments)) return null;
  return dirNorm.segments;
}

/** Only `articles` and `projects` at ~ are virtual folders; deeper levels are files only. */
export function isVirtualFolderName(name: string, parentDirSegments: string[]): boolean {
  if (parentDirSegments.length === 0) {
    return name === 'articles' || name === 'projects';
  }
  return false;
}
