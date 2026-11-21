// The free Crystal Ball Markets exchange rate and gold price API: a client, and the sums to use its figures.
// Terms: https://crystalballmarkets.com/markets/rates-api
import { PURITIES, UNITS, convert as convertWith, goldValue as goldValueOf, perUsd, readGold, readRates } from './core.js';

// The sums, for anyone who has the rates on hand: convert(), goldValue(), parseAmount(), UNITS, PURITIES and the rest.
export * from './core.js';

export const BASE_URL = 'https://crystalballmarkets.com/markets/api/v1/';
export const ATTRIBUTION_TEXT = 'Rates by Crystal Ball Markets';
export const ATTRIBUTION_URL = 'https://crystalballmarkets.com/markets';
export const ATTRIBUTION_HTML = `<a href="${ATTRIBUTION_URL}">${ATTRIBUTION_TEXT}</a>`;

const MIN_CACHE_SECONDS = 60;

export class RatesApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'RatesApiError';
    this.status = status;
    this.body = body;
  }
}

/** A weight unit by its id ("gram", "ounce", "tola", "pavan", "baht", "tael", "kilogram"), or undefined. */
export const unitOf = (id) => UNITS.find((u) => u.id === String(id).toLowerCase());

/** A purity as "k22", "22k", "22K" or 22, or undefined. */
export const purityOf = (id) => {
  const digits = String(id).replace(/\D/g, '');
  return digits ? PURITIES.find((p) => p.id === `k${digits}`) : undefined;
};

/**
 * Create a client.
 *
 * In a web page, call createClient() with no options: the browser names your site.
 * On a server, in an app or a script, pass `site` (the page of your own site that
 * shows the figures, or your domain) and `key` (a secret of your own, 16+ characters).
 */
export function createClient(options = {}) {
  const {
    site,
    key,
    cacheSeconds = MIN_CACHE_SECONDS,
    fetch: fetchImpl = globalThis.fetch,
  } = options;

  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch available: use Node 18+ or pass { fetch }.');
  }
  if (key && key.length < 16) {
    throw new Error('The X-Site-Key secret must be 16 characters or more.');
  }
  const ttl = Math.max(MIN_CACHE_SECONDS, cacheSeconds) * 1000;
  const cache = new Map();

  async function getFile(name) {
    const hit = cache.get(name);
    if (hit && Date.now() - hit.at < ttl) return hit.json;

    const url = new URL(name, BASE_URL);
    if (site) url.searchParams.set('site', site);
    const headers = key ? { 'X-Site-Key': key } : undefined;

    const res = await fetchImpl(url.toString(), { headers });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = undefined; }

    if (!res.ok) {
      const hint = res.status === 403
        ? ' Calls from a server or app need { site, key }, and the named page must show the attribution link.'
        : res.status === 429 ? ' Over 60 requests a minute: cache responses for at least 60 seconds.'
        : res.status === 503 ? ' Temporarily unavailable: retry after the Retry-After header.'
        : '';
      throw new RatesApiError(`Rates API returned ${res.status}.${hint}`, res.status, json ?? text);
    }
    if (json && json.warning) {
      console.warn(`[crystal-ball-markets] ${typeof json.warning === 'string' ? json.warning : JSON.stringify(json.warning)}`);
    }
    cache.set(name, { at: Date.now(), json });
    return json;
  }

  const client = {
    /** Full rates.json: data.base is USD, data.rates[CODE] = { rate, source, time }. */
    getRates: () => getFile('rates.json'),
    /** Full gold.json: data.usdPerOunce and data.countries[]. */
    getGold: () => getFile('gold.json'),
    /** Full quotes.json: data[] with ticker, bid, ask, changePct and more. */
    getQuotes: () => getFile('quotes.json'),

    /** Units of `code` per 1 US dollar, or undefined if not covered. */
    async getRate(code) {
      const json = await client.getRates();
      const k = String(code).toUpperCase();
      return k === json.data.base ? 1 : json.data.rates[k]?.rate;
    },

    /** Convert an amount between two currencies through the US dollar. */
    async convert(amount, from, to) {
      const json = await client.getRates();
      const [a, b] = [from, to].map((c) => String(c).toUpperCase());
      for (const k of [a, b]) {
        if (k !== json.data.base && perUsd(k, json.data.rates) === null) throw new Error(`No rate for ${k}`);
      }
      return convertWith(Number(amount), a, b, json.data.rates);
    },

    /**
     * What a weight of gold is worth: goldValue({ weight: 10, unit: 'tola', purity: '22k', currency: 'INR' }).
     * The value of the gold itself at the international price; shop prices add duty, tax and making charges.
     */
    async goldValue({ weight = 1, unit = 'gram', purity = 'k24', currency = 'USD' } = {}) {
      const [gold, rates] = await Promise.all([client.getGold(), client.getRates()]);
      const u = unitOf(unit);
      const p = purityOf(purity);
      const code = String(currency).toUpperCase();
      const per = perUsd(code, rates.data.rates);
      if (!u) throw new Error(`No unit called ${unit}: use one of ${UNITS.map((x) => x.id).join(', ')}`);
      if (!p) throw new Error(`No purity called ${purity}: use one of ${PURITIES.map((x) => x.label).join(', ')}`);
      if (per === null) throw new Error(`No rate for ${code}`);
      const value = goldValueOf(Number(weight), u.grams, p.fine, gold.data.usdPerOunce, per);
      if (value === null) throw new Error('The weight must be a number, zero or more.');
      return value;
    },

    /** Gold price entry for a country (ISO 3166 alpha-2, e.g. "NG", "IN"). */
    async getGoldPrice(country) {
      const json = await client.getGold();
      return json.data.countries.find((c) => c.country === String(country).toUpperCase());
    },

    /** One market's quote by ticker, e.g. "EURUSD", "XAUUSD". */
    async getQuote(ticker) {
      const json = await client.getQuotes();
      return json.data.find((q) => q.ticker === String(ticker).toUpperCase());
    },

    /**
     * The rates and the gold price as the sums take them: { rates, gold: { usdPerOunce, time }, at }.
     * Pass `rates` to convert() and goldValue(), or the whole of it to the converter as `data`.
     */
    async getData() {
      const [ratesFile, goldFile] = await Promise.all([client.getRates(), client.getGold()]);
      const rates = readRates(ratesFile);
      const gold = readGold(goldFile);
      if (!rates || !gold) throw new RatesApiError('The rates API sent files this client could not read.', 200, undefined);
      return { rates, gold, at: Date.now() };
    },
  };
  return client;
}

export default createClient;
