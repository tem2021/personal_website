import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const manifest = JSON.parse(readFileSync(join(root, 'articles/manifest.json'), 'utf8'));

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(rehypeKatex, {
    strict: false,
    throwOnError: false,
    errorColor: '#cc0000',
  })
  .use(rehypeStringify);

/** KaTeX: numbered amsmath `align` adds (1)(2)…; use star form for no numbers. */
function preprocessMathEnvironments(md) {
  return md
    .replace(/\\begin\{align\}/g, '\\begin{align*}')
    .replace(/\\end\{align\}/g, '\\end{align*}');
}

function articleShell(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="../../katex/katex.min.css" />
  <link rel="stylesheet" href="../../article.css" />
</head>
<body data-home-href="../../index.html">
  <article class="prose-page">
    <header>
      <p class="back"><a href="../../index.html">← home</a></p>
      <h1>${escapeHtml(title)}</h1>
    </header>
    <div class="prose-body">
${bodyHtml}
    </div>
  </article>
  <script src="../../read-nav.js" defer></script>
</body>
</html>
`;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Output to public/articles so `vite dev` and `vite build` both serve articles (public is copied to dist). */
const outRoot = join(root, 'public');

const assetsSrc = join(root, 'articles', 'assets');
const assetsDest = join(outRoot, 'articles', 'assets');
if (existsSync(assetsSrc)) {
  mkdirSync(dirname(assetsDest), { recursive: true });
  cpSync(assetsSrc, assetsDest, { recursive: true });
}

for (const a of manifest.articles) {
  const mdPath = join(root, 'articles', a.file);
  let md = readFileSync(mdPath, 'utf8');
  md = preprocessMathEnvironments(md);
  const file = await processor.process(md);
  const bodyHtml = String(file);
  const outDir = join(outRoot, 'articles', a.slug);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), articleShell(a.title, bodyHtml));
  console.log('article:', a.slug);
}

console.log('build-articles: done → public/articles/');
