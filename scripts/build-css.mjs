import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass-embedded';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const distDir = path.join(rootDir, 'dist');
const outputPath = path.join(distDir, 'bp-search-widget.css');
const uiCssCandidates = [
  path.join(rootDir, 'node_modules', '@braudypedrosa', 'bp-ui-components', 'dist', 'styles', 'index.css'),
  path.resolve(rootDir, '../bp-ui-components/dist/styles/index.css'),
];
const calendarCssCandidates = [
  path.join(rootDir, 'node_modules', '@braudypedrosa', 'bp-calendar', 'dist', 'bp-calendar.css'),
  path.resolve(rootDir, '../bp-calendar/dist/bp-calendar.css'),
];

async function readFirstAvailable(paths) {
  for (const candidate of paths) {
    try {
      return await readFile(candidate, 'utf8');
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Unable to locate required stylesheet. Checked: ${paths.join(', ')}`);
}

const uiCss = await readFirstAvailable(uiCssCandidates);
const calendarCss = await readFirstAvailable(calendarCssCandidates);
const compiledWidget = await sass.compileAsync(path.join(rootDir, 'bp-search-widget.scss'), {
  style: 'expanded',
  sourceMap: false,
});

await mkdir(distDir, { recursive: true });
await writeFile(outputPath, `${uiCss}\n\n${calendarCss}\n\n${compiledWidget.css}`);
