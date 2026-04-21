import manifest from '../articles/manifest.json';
import raycasterHtml from '../projects/raycaster/index.html?raw';
import calendarHtml from '../projects/cuhksz-calendar-sync/index.html?raw';

interface ArticleEntry {
  slug: string;
  file: string;
  lsName: string;
  title: string;
}

type ManifestShape = {
  articles: ArticleEntry[];
};

const manifestData = manifest as unknown as ManifestShape;

const articleMdGlob = import.meta.glob('../articles/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Markdown source for virtual `~/articles/<lsName>` files. */
export const articleSourceByLsName = new Map<string, string>();

for (const a of manifestData.articles) {
  const key = `../articles/${a.file}`;
  const content = articleMdGlob[key];
  if (typeof content === 'string') {
    articleSourceByLsName.set(a.lsName, content);
  }
}

/** HTML source for virtual `~/projects/<lsName>` demo pages. */
export const projectSourceByLsName = new Map<string, string>([
  ['animal-feeding-3d-raycaster.html', raycasterHtml],
  ['cuhksz-deadlines-to-google-calendar.html', calendarHtml],
]);
