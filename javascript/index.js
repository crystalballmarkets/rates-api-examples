// Client for the free Crystal Ball Markets exchange rate and gold price API.
// Terms: https://crystalballmarkets.com/markets/rates-api

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
      return json.data.rates[String(code).toUpperCase()]?.rate;
    },

    /** Convert an amount between two currencies through the US dollar. */
    async convert(amount, from, to) {
      const json = await client.getRates();
      const rate = (c) => {
        const k = String(c).toUpperCase();
        if (k === json.data.base) return 1;
        const r = json.data.rates[k]?.rate;
        if (typeof r !== 'number') throw new Error(`No rate for ${k}`);
        return r;
      };
      return (Number(amount) / rate(from)) * rate(to);
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
  };
  return client;
}

export default createClient;
