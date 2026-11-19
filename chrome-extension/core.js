/**
 * The converter's sums and its reading of the rate files: no page and no browser APIs, so the tests run it as it is.
 * Rates are units of a currency per US dollar, as https://crystalballmarkets.com/markets/api/v1/rates.json gives them.
 */
export const GRAMS_PER_TROY_OUNCE = 31.1034768;

/** Weights gold is quoted in, in grams. */
export const UNITS = [
  { id: 'gram', grams: 1, label: 'grams', one: 'gram', many: 'grams' },
  { id: 'ounce', grams: GRAMS_PER_TROY_OUNCE, label: 'troy ounces', one: 'troy ounce', many: 'troy ounces' },
  { id: 'tola', grams: 11.6638038, label: 'tolas', one: 'tola', many: 'tolas' },
  { id: 'pavan', grams: 8, label: 'pavans (sovereigns)', one: 'pavan', many: 'pavans' },
  { id: 'baht', grams: 15.244, label: 'baht (Thai gold weight)', one: 'baht', many: 'baht' },
  { id: 'tael', grams: 37.429, label: 'taels (Hong Kong)', one: 'tael', many: 'taels' },
  { id: 'kilogram', grams: 1000, label: 'kilograms', one: 'kilogram', many: 'kilograms' },
];

/** Gold purities: the share of the weight that is gold. */
export const PURITIES = [
  { id: 'k24', label: '24K', fine: 1, text: '24K (pure gold)' },
  { id: 'k22', label: '22K', fine: 0.916, text: '22K (91.6% gold)' },
  { id: 'k21', label: '21K', fine: 0.875, text: '21K (87.5% gold)' },
  { id: 'k18', label: '18K', fine: 0.75, text: '18K (75% gold)' },
  { id: 'k14', label: '14K', fine: 0.585, text: '14K (58.5% gold)' },
];

/** Shown first in the currency lists when the rate file has them. */
export const COMMON = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY', 'INR', 'AED'];

/** Pinned pairs kept: four fit the pop-up without scrolling. */
export const MAX_PINS = 4;

/**
 * A typed amount as a number, or null. Takes "1,234.56", "1.234,56", "1 234,56" and "1'234.56": where a single mark
 * could be either, the browser's own decimal mark decides ("1,000" is a thousand in English and one in German).
 */
export function parseAmount(text, decimal = '.') {
  let s = String(text ?? '').trim().replace(/[\s  '’_]/g, '');
  if (!s) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let dec = decimal === ',' ? ',' : '.';
  if (lastDot >= 0 && lastComma >= 0) {
    dec = lastDot > lastComma ? '.' : ',';
  } else if (lastDot >= 0 || lastComma >= 0) {
    const mark = lastDot >= 0 ? '.' : ',';
    const count = s.split(mark).length - 1;
    const tail = s.length - 1 - s.lastIndexOf(mark);
    if (count > 1) dec = mark === '.' ? ',' : '.';
    else if (mark !== dec && tail === 3) dec = decimal === ',' ? ',' : '.';
    else dec = mark;
  }
  const group = dec === '.' ? ',' : '.';
  s = s.split(group).join('').replace(dec, '.');
  if (!/^\d*\.?\d*$/.test(s) || !/\d/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Units of `code` per US dollar, or null when the file has no rate for it. */
export function perUsd(code, rates) {
  if (code === 'USD') return 1;
  const r = rates?.[code]?.rate;
  return typeof r === 'number' && r > 0 && Number.isFinite(r) ? r : null;
}

/** `amount` of `from` in `to`, or null when either rate is missing. */
export function convert(amount, from, to, rates) {
  const a = perUsd(from, rates);
  const b = perUsd(to, rates);
  if (a === null || b === null || typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  return (amount / a) * b;
}

/** What `weight` units of gold of a purity are worth in a currency, from the dollar price of a troy ounce. */
export function goldValue(weight, unitGrams, fine, usdPerOunce, currencyPerUsd) {
  const parts = [weight, unitGrams, fine, usdPerOunce, currencyPerUsd];
  if (parts.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0)) return null;
  return ((weight * unitGrams) / GRAMS_PER_TROY_OUNCE) * fine * usdPerOunce * currencyPerUsd;
}

/**
 * Decimals to show an amount of money with: the currency's own (2 for dollars, 0 for yen, 3 for dinars), and more
 * for an amount so small that those would round it to nothing.
 */
export function moneyDigits(value, currencyDigits = 2) {
  const v = Math.abs(value);
  if (!(v > 0) || v >= 1) return currencyDigits;
  const needed = 3 - Math.floor(Math.log10(v)) - 1;
  return Math.min(8, Math.max(currencyDigits, needed));
}

/** Decimals that show a rate to about six significant figures. */
export function rateDigits(value) {
  const v = Math.abs(value);
  if (!(v > 0)) return 2;
  return Math.min(10, Math.max(2, 5 - Math.floor(Math.log10(v))));
}

/** The rates file as the converter keeps it, or null when it is not what we expect. */
export function readRates(body) {
  const rows = body?.data?.rates;
  if (!rows || typeof rows !== 'object') return null;
  const rates = {};
  for (const [code, row] of Object.entries(rows)) {
    if (!/^[A-Z]{3}$/.test(code) || code === 'USD') continue;
    if (typeof row?.rate !== 'number' || !(row.rate > 0) || !Number.isFinite(row.rate)) continue;
    rates[code] = { rate: row.rate, source: String(row.source ?? ''), time: String(row.time ?? '') };
  }
  return Object.keys(rates).length ? rates : null;
}

/** The gold file's dollar price of a troy ounce and its time, or null. */
export function readGold(body) {
  const d = body?.data;
  if (typeof d?.usdPerOunce !== 'number' || !(d.usdPerOunce > 0) || !Number.isFinite(d.usdPerOunce)) return null;
  return { usdPerOunce: d.usdPerOunce, time: String(d.time ?? body?.updated ?? '') };
}

/** Where a rate comes from, in words. */
export function sourceText(source) {
  switch (source) {
    case 'crystalballmarkets': return 'Crystal Ball Markets quote';
    case 'ecb': return 'European Central Bank reference rate';
    case 'peg': return 'official fixed rate';
    case 'central-bank': return 'central bank reference rate';
    case 'sample': return 'sample figure';
    default: return 'reference rate';
  }
}

/** The currency codes for the lists: the common ones first, then the rest in order. */
export function currencyLists(rates) {
  const all = ['USD', ...Object.keys(rates ?? {})].filter((c, i, a) => a.indexOf(c) === i).sort();
  const common = COMMON.filter((c) => all.includes(c));
  return { common, rest: all.filter((c) => !common.includes(c)), all };
}

/** A pinned pair's key, and back. */
export const pairKey = (from, to) => `${from}-${to}`;
export const pairOf = (key) => {
  const m = /^([A-Z]{3})-([A-Z]{3})$/.exec(String(key));
  return m ? { from: m[1], to: m[2] } : null;
};

/** The pins with `key` added or taken out, newest first, never more than MAX_PINS. */
export function togglePin(pins, key) {
  const list = Array.isArray(pins) ? pins.filter((p) => pairOf(p)) : [];
  if (list.includes(key)) return list.filter((p) => p !== key);
  return pairOf(key) ? [key, ...list].slice(0, MAX_PINS) : list;
}
