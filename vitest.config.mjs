import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const uiComponentsSource = path.resolve(rootDir, '../bp-ui-components/src/index.js');
const calendarSource = path.resolve(rootDir, '../bp-calendar/bp-calendar.js');
const alias = {};

if (existsSync(uiComponentsSource)) {
  alias['@braudypedrosa/bp-ui-components'] = uiComponentsSource;
}

if (existsSync(calendarSource)) {
  alias['@braudypedrosa/bp-calendar'] = calendarSource;
}

export default defineConfig({
  resolve: {
    alias,
  },
  test: {
    environment: 'jsdom',
  },
});
