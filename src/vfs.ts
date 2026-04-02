/** Virtual filesystem: ~ contains articles/ and projects/ only (flat files under each). */

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
  if (segments.length !== 2) return false;
  const [dir, name] = segments;
  if (dir === 'articles') return articleFileNames.has(name);
  if (dir === 'projects') return name === 'raycaster.html';
  return false;
}

export function listDir(segments: string[], articleLsNames: string[]): string[] {
  if (segments.length === 0) return ['articles', 'projects'];
  if (segments.length === 1 && segments[0] === 'articles') return [...articleLsNames];
  if (segments.length === 1 && segments[0] === 'projects') return ['raycaster.html'];
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
