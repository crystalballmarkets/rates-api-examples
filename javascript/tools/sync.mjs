/**
 * Rewrites the files this package shares with the rest of the repository, so there is one source for each:
 *
 *   core.js             the sums, as the Chrome extension has them (chrome-extension/core.js)
 *   converter-style.js  the converter's look, as the WordPress plugin has it (assets/converter.css)
 *   sample.js           the rates packed with the Chrome extension (chrome-extension/snapshot.json)
 *
 *   node javascript/tools/sync.mjs
 *
 * `npm test` fails when any of the three has fallen behind.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

export function shared() {
  const css = read('wordpress/crystal-ball-markets-rates/assets/converter.css');
  const snapshot = JSON.parse(read('chrome-extension/snapshot.json'));
  return {
    'core.js': read('chrome-extension/core.js'),
    'converter-style.js': `// The converter's look. Written by tools/sync.mjs from the WordPress plugin's stylesheet: change it there.\nexport const BASE_CSS = ${JSON.stringify(css)};\n`,
    'sample.js': `// Rates packed with the package, for local and test pages. Written by tools/sync.mjs from the Chrome extension's.\nexport const SAMPLE = ${JSON.stringify({ at: snapshot.at, rates: snapshot.rates, gold: snapshot.gold })};\n`,
  };
}

if (process.argv[1] === import.meta.filename) {
  for (const [name, text] of Object.entries(shared())) writeFileSync(join(ROOT, 'javascript', name), text);
  console.log('core.js, converter-style.js and sample.js are up to date');
}
