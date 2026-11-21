// Offline tests with a fake fetch, so they run without network access: npm test
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import createClient, * as api from './index.js';
import { CONVERTER_CSS, LABELS, isTestPage } from './converter.js';
import { SAMPLE } from './sample.js';

const { RatesApiError, ATTRIBUTION_HTML, UNITS, PURITIES, convert, goldValue, parseAmount, moneyDigits, rateDigits, readRates, readGold, unitOf, purityOf, GRAMS_PER_TROY_OUNCE } = api;
const near = (a, b) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} is not ${b}`);

// ---- the client ----

const files = {
  'rates.json': { updated: 'x', data: { base: 'USD', rates: { EUR: { rate: 0.9, source: 'ecb', time: 't' }, GBP: { rate: 0.8, source: 'crystalballmarkets', time: 't' }, INR: { rate: 90, source: 'crystalballmarkets', time: 't' } } } },
  'gold.json': { updated: 'x', data: { usdPerOunce: 3110.34768, time: 't', countries: [{ country: 'IN', currency: 'INR', price: 10 }] } },
  'quotes.json': { updated: 'x', data: [{ ticker: 'EURUSD', bid: 1.1 }] },
};
let calls = [];
const fakeFetch = async (url, init) => {
  calls.push({ url, init });
  const name = url.split('/').pop().split('?')[0];
  return { ok: true, status: 200, text: async () => JSON.stringify(files[name]) };
};

const c = createClient({ site: 'https://example.com/rates', key: 'a-secret-of-16-chars', fetch: fakeFetch });
assert.equal(await c.getRate('eur'), 0.9);
assert.equal(await c.getRate('usd'), 1);
assert.equal(await c.getRate('xxx'), undefined);
near(await c.convert(100, 'GBP', 'EUR'), 112.5);
assert.equal(await c.convert(5, 'USD', 'USD'), 5);
await assert.rejects(c.convert(1, 'USD', 'XXX'), /No rate for XXX/);
assert.equal((await c.getGoldPrice('in')).currency, 'INR');
assert.equal((await c.getQuote('eurusd')).bid, 1.1);
assert.equal(calls.filter((x) => x.url.includes('rates.json')).length, 1, 'rates.json cached');
assert.ok(calls[0].url.includes('site=https%3A%2F%2Fexample.com%2Frates'));
assert.equal(calls[0].init.headers['X-Site-Key'], 'a-secret-of-16-chars');
assert.throws(() => createClient({ key: 'short', fetch: fakeFetch }));
assert.ok(ATTRIBUTION_HTML.includes('https://crystalballmarkets.com/markets') && !ATTRIBUTION_HTML.includes('nofollow'));

// What a weight of gold is worth: 3110.34768 dollars an ounce is 100 dollars a gram.
near(await c.goldValue({ weight: 10, unit: 'gram', purity: '22k', currency: 'INR' }), 10 * 100 * 0.916 * 90);
near(await c.goldValue({ weight: 1, unit: 'tola' }), 1166.38038);
near(await c.goldValue(), 100);
near(await c.goldValue({ purity: 18 }), 75);
await assert.rejects(c.goldValue({ unit: 'stone' }), /No unit called stone/);
await assert.rejects(c.goldValue({ purity: '23k' }), /No purity called 23k/);
await assert.rejects(c.goldValue({ currency: 'XXX' }), /No rate for XXX/);
await assert.rejects(c.goldValue({ weight: -1 }), /zero or more/);

const onHand = await c.getData();
assert.deepEqual(Object.keys(onHand.rates), ['EUR', 'GBP', 'INR']);
assert.equal(onHand.gold.usdPerOunce, 3110.34768);
near(convert(100, 'GBP', 'EUR', onHand.rates), 112.5);
assert.equal(calls.length, 3, 'three files read once each, whatever was asked');

const denied = createClient({ fetch: async () => ({ ok: false, status: 403, text: async () => '{"error":"no site"}' }) });
await assert.rejects(denied.getRates(), (e) => e instanceof RatesApiError && e.status === 403);
const broken = createClient({ fetch: async () => ({ ok: true, status: 200, text: async () => '{"data":{}}' }) });
await assert.rejects(broken.getData(), RatesApiError);

// ---- the sums ----

const rates = { EUR: { rate: 0.9 }, GBP: { rate: 0.8 }, BAD: { rate: 0 } };
near(convert(100, 'GBP', 'EUR', rates), 112.5);
assert.equal(convert(1, 'USD', 'XXX', rates), null);
assert.equal(convert(1, 'USD', 'BAD', rates), null);
near(goldValue(10, 1, 0.916, 3110.34768, 1), 916);
near(goldValue(1, GRAMS_PER_TROY_OUNCE, 1, 3680.47, 0.9), 3312.423);
assert.equal(goldValue(-1, 1, 1, 3000, 1), null);
assert.equal(parseAmount('1,234.56'), 1234.56);
assert.equal(parseAmount('1.234,56'), 1234.56);
assert.equal(parseAmount('1,000', ','), 1);
assert.equal(parseAmount('abc'), null);
assert.equal(moneyDigits(0.00012345, 2), 6);
assert.equal(rateDigits(1552.01), 2);
assert.deepEqual(UNITS.map((u) => u.id), ['gram', 'ounce', 'tola', 'pavan', 'baht', 'tael', 'kilogram']);
assert.deepEqual(PURITIES.map((p) => p.id), ['k24', 'k22', 'k21', 'k18', 'k14']);
assert.equal(unitOf('TOLA').grams, 11.6638038);
assert.equal(unitOf('stone'), undefined);
assert.equal(purityOf('22K').fine, 0.916);
assert.equal(purityOf('k18').label, '18K');
assert.equal(purityOf(''), undefined);
assert.equal(readRates({ data: { rates: { EUR: { rate: 0.9 }, usd: { rate: 1 }, JPY: { rate: 'many' } } } }).EUR.rate, 0.9);
assert.equal(readRates({ data: {} }), null);
assert.equal(readGold({ data: { usdPerOunce: 0 } }), null);

// ---- the converter and its sample ----

assert.ok(CONVERTER_CSS.includes('.cbmarkets-converter') && CONVERTER_CSS.includes('.cbmarkets-refresh'));
assert.equal(LABELS.currency, 'Currency');
for (const [protocol, hostname, expected] of [
  ['file:', '', true], ['http:', 'localhost', true], ['http:', '127.0.0.1', true], ['http:', '[::1]', true], ['https:', 'shop.test', true],
  ['https:', 'intranet', true], ['https:', 'example.com', false], ['https:', 'www.shop.co.uk', false],
]) assert.equal(isTestPage({ protocol, hostname }), expected, `${protocol}//${hostname}`);
assert.equal(isTestPage(undefined), true, 'no page at all (a server) is not a public page');
assert.ok(SAMPLE.at > 0 && SAMPLE.gold.usdPerOunce > 0 && Object.keys(SAMPLE.rates).length >= 50);
near(convert(1, 'USD', 'EUR', SAMPLE.rates), SAMPLE.rates.EUR.rate);

// ---- the package ----

const here = import.meta.dirname;
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
for (const file of pkg.files) assert.ok(existsSync(join(here, file)), `${file} is listed in the package and is missing`);
for (const file of ['index.js', 'converter.js']) {
  for (const [, imported] of readFileSync(join(here, file), 'utf8').matchAll(/from '\.\/([^']+)'/g)) assert.ok(pkg.files.includes(imported), `${file} imports ${imported}, which the package does not ship`);
}
assert.ok(readFileSync(join(here, 'README.md'), 'utf8').includes('crystal-ball-markets/converter'));

// In the repository (not in the published package), the three shared files are as their sources have them.
if (existsSync(join(here, 'tools/sync.mjs')) && existsSync(join(here, '../chrome-extension/core.js'))) {
  const { shared } = await import('./tools/sync.mjs');
  for (const [name, text] of Object.entries(shared())) assert.equal(readFileSync(join(here, name), 'utf8'), text, `${name} has fallen behind its source: node javascript/tools/sync.mjs`);
}

console.log('All tests passed');
