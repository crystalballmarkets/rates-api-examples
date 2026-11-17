// Offline test with a fake fetch, so it runs without network access.
import assert from 'node:assert/strict';
import { createClient, RatesApiError, ATTRIBUTION_HTML } from './index.js';

const files = {
  'rates.json': { updated: 'x', data: { base: 'USD', rates: { EUR: { rate: 0.9, source: 'ecb', time: 't' }, GBP: { rate: 0.8, source: 'crystalballmarkets', time: 't' } } } },
  'gold.json': { updated: 'x', data: { usdPerOunce: 3800, time: 't', countries: [{ country: 'IN', currency: 'INR', price: 10 }] } },
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
assert.equal(Math.round((await c.convert(100, 'GBP', 'EUR')) * 1000) / 1000, 112.5);
assert.equal(await c.convert(5, 'USD', 'USD'), 5);
assert.equal((await c.getGoldPrice('in')).currency, 'INR');
assert.equal((await c.getQuote('eurusd')).bid, 1.1);
assert.equal(calls.filter((x) => x.url.includes('rates.json')).length, 1, 'rates.json cached');
assert.ok(calls[0].url.includes('site=https%3A%2F%2Fexample.com%2Frates'));
assert.equal(calls[0].init.headers['X-Site-Key'], 'a-secret-of-16-chars');
assert.throws(() => createClient({ key: 'short', fetch: fakeFetch }));
assert.ok(ATTRIBUTION_HTML.includes('https://crystalballmarkets.com/markets') && !ATTRIBUTION_HTML.includes('nofollow'));

const denied = createClient({ fetch: async () => ({ ok: false, status: 403, text: async () => '{"error":"no site"}' }) });
await assert.rejects(denied.getRates(), (e) => e instanceof RatesApiError && e.status === 403);
console.log('All tests passed');
