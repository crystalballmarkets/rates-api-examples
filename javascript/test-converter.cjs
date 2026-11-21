/**
 * The converter in a real browser: node javascript/test-converter.cjs [--shot]
 *
 * Serves this folder on 127.0.0.1 and uses the converter as a visitor would. Needs Playwright's Chromium, so it is
 * not part of `npm test`. Any request away from this folder fails it: the converter must ask nobody on a test page.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const TYPES = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
const PAGE = `<!DOCTYPE html><html lang="en-US"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Converter</title>
<style>body { margin: 0; padding: 24px; font: 17px/1.6 Georgia, serif; } section { margin: 0 0 24px; }
button { background: #c00 !important; color: #fff !important; text-transform: uppercase !important; border: 4px solid #000 !important; padding: 22px; } input, select { border: 3px solid green !important; background: yellow !important; height: 60px; } td, th { border: 2px solid pink; padding: 20px; }</style></head>
<body><section id="a"></section><section id="b"></section><section id="c"></section><section id="d"></section>
<script type="module">
  import { mountConverter } from './converter.js';
  import { SAMPLE } from './sample.js';
  window.SAMPLE = SAMPLE;
  window.sample = mountConverter('#a');
  // A page with its own client: the first read fails, the next ones answer.
  window.reads = 0;
  window.fail = true;
  const client = { getData: async () => { window.reads++; if (window.fail) throw new Error('down'); return { rates: SAMPLE.rates, gold: SAMPLE.gold, at: Date.now() }; } };
  window.live = mountConverter(document.querySelector('#b'), { client, show: 'currency', from: 'gbp', to: 'ngn', amount: 250, theme: 'dark' });
  window.given = mountConverter('#c', { data: { rates: SAMPLE.rates, gold: SAMPLE.gold, at: Date.now() }, show: 'gold', weight: 2, unit: 'tola', purity: '22k', goldCurrency: 'INR', credit: false, labels: { weight: 'Poids' } });
</script></body></html>`;

(async () => {
  const server = http.createServer((req, res) => {
    const name = req.url.split('?')[0];
    if (name === '/' || name === '/index.html') return res.writeHead(200, { 'Content-Type': 'text/html' }).end(PAGE);
    const file = path.join(__dirname, path.normalize(name).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(__dirname) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(fs.readFileSync(file));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 900, height: 1400 }, deviceScaleFactor: process.argv.includes('--shot') ? 2 : 1, locale: 'en-US', timezoneId: 'UTC' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = await context.newPage();
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  page.on('request', (r) => { if (!r.url().startsWith(origin)) problems.push(`asked for ${r.url()}`); });
  await page.goto(origin);
  await page.waitForFunction(() => window.given && document.querySelectorAll('.cbmarkets-converter').length === 3);
  const sample = await page.evaluate(() => window.SAMPLE);
  // An amount as the converter writes it: the currency's decimals, and more for an amount below one.
  const money = (value, own = 2) => {
    const digits = value > 0 && value < 1 ? Math.min(8, Math.max(own, 3 - Math.floor(Math.log10(value)) - 1)) : own;
    return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  };

  // A test page: the sample, dated, nothing asked of anyone.
  const a = page.locator('#a');
  await a.locator('.cbmarkets-status').waitFor();
  assert.match(await a.locator('.cbmarkets-status span').innerText(), /^Sample rates of Nov 19, 2026\. Live rates load on a public site\.$/);
  assert.ok(await a.locator('.cbmarkets-refresh').isHidden());
  assert.equal(await a.locator('.cbmarkets-big output').first().innerText(), `${money(sample.rates.EUR.rate)} EUR`);
  await a.locator('input').first().fill('1.234,56');
  assert.equal(await a.locator('.cbmarkets-big output').first().innerText(), `${money(1234.56 * sample.rates.EUR.rate)} EUR`);
  await a.locator('[role="tab"]').nth(1).click();
  assert.equal(await a.locator('.cbmarkets-lead').nth(1).innerText(), '10 grams of 24K gold =');
  assert.equal(await a.locator('.cbmarkets-big output').nth(1).innerText(), `${money((10 / 31.1034768) * sample.gold.usdPerOunce)} USD`);
  const link = a.locator('.cbmarkets-credit a');
  assert.equal(await link.getAttribute('href'), 'https://crystalballmarkets.com/markets');
  assert.equal(await link.innerText(), 'Rates by Crystal Ball Markets');
  assert.equal(await link.getAttribute('rel'), null);
  assert.ok(await link.isVisible());

  // A page with its own client: a first read that fails says so and offers another try.
  const b = page.locator('#b');
  assert.equal(await b.locator('.cbmarkets-empty').innerText(), 'The rates could not be loaded. Check your connection and try again.');
  assert.ok(await b.locator('[data-nothing], .cbmarkets-panel').first().isHidden());
  await page.evaluate(() => { window.fail = false; });
  await b.locator('.cbmarkets-retry').click();
  await b.locator('.cbmarkets-big output').waitFor();
  assert.equal(await b.locator('.cbmarkets-lead').innerText(), '250 GBP =');
  assert.equal(await b.locator('.cbmarkets-big output').innerText(), `${money((250 / sample.rates.GBP.rate) * sample.rates.NGN.rate)} NGN`);
  assert.match(await b.locator('.cbmarkets-status span').innerText(), /^Rates updated \d\d:\d\d/);
  assert.equal(await b.locator('[role="tablist"]').count(), 0);
  // Refresh inside a minute answers from the rates on hand; a later read that fails keeps them, marked.
  const reads = await page.evaluate(() => window.reads);
  await b.locator('.cbmarkets-refresh').click();
  assert.equal(await page.evaluate(() => window.reads), reads, 'no second read inside a minute');
  // Pins, shared with the other converters on the page.
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  await b.locator('.cbmarkets-tool').first().click();
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('cbmarketsRatesPins'))), ['GBP-NGN']);
  await a.locator('[role="tab"]').first().click();
  assert.equal(await a.locator('.cbmarkets-pin-list li').count(), 1);
  await b.locator('.cbmarkets-icon').click();
  assert.equal(await b.locator('.cbmarkets-lead').innerText(), '250 NGN =');
  // Copy.
  await b.locator('.cbmarkets-tool').nth(1).click();
  await page.waitForFunction(() => document.querySelector('#b .cbmarkets-tool:nth-child(2)').textContent === 'Copied', null, { timeout: 3000 });
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /^250 NGN = 0\.\d+ GBP$/);

  // Rates handed in: no refresh, the link left out when asked, a word changed.
  const c = page.locator('#c');
  assert.equal(await c.locator('.cbmarkets-lead').innerText(), '2 tolas of 22K gold =');
  assert.equal(await c.locator('.cbmarkets-big output').innerText(), `${money(((2 * 11.6638038) / 31.1034768) * 0.916 * sample.gold.usdPerOunce * sample.rates.INR.rate)} INR`);
  assert.equal(await c.locator('.cbmarkets-credit').count(), 0);
  assert.ok(await c.locator('.cbmarkets-refresh').isHidden());
  assert.equal(await c.locator('.cbmarkets-label').first().innerText(), 'Poids');
  assert.deepEqual(await c.locator('.cbmarkets-grades th').allInnerTexts(), ['24K', '22K', '18K']);

  // The page's own rules for buttons and fields change nothing; one stylesheet for the three.
  const look = await page.evaluate(() => {
    const style = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
    const box = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
    return { card: box('#a .cbmarkets-converter')[0], input: box('#a input')[1], tab: style('#a .cbmarkets-tab', 'textTransform'), bg: style('#a .cbmarkets-input', 'backgroundColor'), dark: style('#b .cbmarkets-converter', 'backgroundColor'), retry: style('#b .cbmarkets-retry', 'backgroundColor'), styles: document.querySelectorAll('#cbmarkets-converter-style').length };
  });
  assert.deepEqual(look, { card: 400, input: 38, tab: 'none', bg: 'rgb(255, 255, 255)', dark: 'rgb(3, 6, 12)', retry: 'rgb(70, 211, 255)', styles: 1 });

  if (process.argv.includes('--shot')) {
    await a.locator('input').first().fill('250');
    await page.locator('body').click({ position: { x: 880, y: 5 } });
    await a.locator('.cbmarkets-converter').screenshot({ path: path.join(__dirname, 'converter.png') });
  }

  // Taken away, it leaves nothing behind.
  await page.evaluate(() => window.given.destroy());
  assert.equal(await page.locator('#c .cbmarkets-converter').count(), 0);
  assert.deepEqual(problems, []);

  await browser.close();
  server.close();
  console.log('The converter passed in the browser');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
