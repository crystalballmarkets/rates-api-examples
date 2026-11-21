export declare const BASE_URL: string;
export declare const ATTRIBUTION_TEXT: string;
export declare const ATTRIBUTION_URL: string;
export declare const ATTRIBUTION_HTML: string;

// ---- the sums ----

export declare const GRAMS_PER_TROY_OUNCE: number;
export interface Unit { id: UnitId; grams: number; label: string; one: string; many: string }
export type UnitId = 'gram' | 'ounce' | 'tola' | 'pavan' | 'baht' | 'tael' | 'kilogram';
export interface Purity { id: PurityId; label: string; fine: number; text: string }
export type PurityId = 'k24' | 'k22' | 'k21' | 'k18' | 'k14';
/** Weights gold is quoted in, in grams. */
export declare const UNITS: Unit[];
/** Gold purities: the share of the weight that is gold. */
export declare const PURITIES: Purity[];
export declare const COMMON: string[];
export declare const MAX_PINS: number;

export type RateSource = 'crystalballmarkets' | 'peg' | 'ecb' | 'central-bank' | 'sample';
export interface Rate { rate: number; source: RateSource | string; time: string }
/** Rates by currency code: units of each currency for one US dollar. */
export type Rates = Record<string, Rate>;
export interface GoldSpot { usdPerOunce: number; time: string }
/** The rates and the gold price as the sums and the converter take them. */
export interface RatesOnHand { rates: Rates; gold: GoldSpot; at: number }

/** A typed amount as a number, or null: "1,234.56", "1.234,56", "1 234,56" and "1'234.56" are all read. */
export declare function parseAmount(text: unknown, decimal?: '.' | ','): number | null;
/** Units of `code` for one US dollar, or null when there is no rate for it. */
export declare function perUsd(code: string, rates: Rates): number | null;
/** `amount` of `from` in `to`, or null when either rate is missing. */
export declare function convert(amount: number, from: string, to: string, rates: Rates): number | null;
/** What `weight` units of gold of a purity are worth, from the dollar price of a troy ounce. */
export declare function goldValue(weight: number, unitGrams: number, fine: number, usdPerOunce: number, currencyPerUsd: number): number | null;
/** Decimals to show an amount of money with. */
export declare function moneyDigits(value: number, currencyDigits?: number): number;
/** Decimals that show a rate to about six significant figures. */
export declare function rateDigits(value: number): number;
/** The rates of a rates.json file, or null when it is not one. */
export declare function readRates(body: unknown): Rates | null;
/** The gold price of a gold.json file, or null when it is not one. */
export declare function readGold(body: unknown): GoldSpot | null;
/** Where a rate comes from, in words. */
export declare function sourceText(source: string): string;
export declare function currencyLists(rates: Rates): { common: string[]; rest: string[]; all: string[] };
export declare function pairKey(from: string, to: string): string;
export declare function pairOf(key: string): { from: string; to: string } | null;
export declare function togglePin(pins: string[], key: string): string[];
/** A weight unit by its id, or undefined. */
export declare function unitOf(id: string): Unit | undefined;
/** A purity as "k22", "22k" or 22, or undefined. */
export declare function purityOf(id: string | number): Purity | undefined;

// ---- the client ----

export interface ClientOptions {
  /** Page of your own site that shows the figures, or your domain (required off the browser). */
  site?: string;
  /** Your own secret, 16+ characters, sent as X-Site-Key (required off the browser). */
  key?: string;
  /** Seconds to keep each file; never less than 60. */
  cacheSeconds?: number;
  fetch?: typeof fetch;
}

export interface Attribution { required: boolean; text: string; url: string }
export interface ApiFile<T> {
  attribution: Attribution;
  terms: string;
  notice: string;
  updated: string;
  data: T;
  warning?: unknown;
}

export interface RatesData { base: string; rates: Rates }

export interface GoldCountry {
  country: string; currency: string; unit: string; unitGrams: number;
  purity: string; fineness: number; price: number; pricePerGram24k: number;
  rateSource: string; url: string;
}
export interface GoldData { usdPerOunce: number; time: string; countries: GoldCountry[] }

export interface Quote {
  ticker: string; name: string; assetClass: string; currency: string; digits: number;
  bid: number; ask?: number; changePct: number; dayHigh: number; dayLow: number;
  leverage: number | null; time: string; url: string;
}

export declare class RatesApiError extends Error {
  status: number;
  body: unknown;
}

export interface GoldValueOptions {
  weight?: number;
  unit?: UnitId;
  purity?: PurityId | '24k' | '22k' | '21k' | '18k' | '14k' | number;
  currency?: string;
}

export interface Client {
  getRates(): Promise<ApiFile<RatesData>>;
  getGold(): Promise<ApiFile<GoldData>>;
  getQuotes(): Promise<ApiFile<Quote[]>>;
  getRate(code: string): Promise<number | undefined>;
  convert(amount: number, from: string, to: string): Promise<number>;
  /** What a weight of gold is worth in a currency. */
  goldValue(options?: GoldValueOptions): Promise<number>;
  getGoldPrice(country: string): Promise<GoldCountry | undefined>;
  getQuote(ticker: string): Promise<Quote | undefined>;
  /** The rates and the gold price as the sums and the converter take them. */
  getData(): Promise<RatesOnHand>;
}

export declare function createClient(options?: ClientOptions): Client;
export default createClient;
