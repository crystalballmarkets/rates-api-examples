export declare const BASE_URL: string;
export declare const ATTRIBUTION_TEXT: string;
export declare const ATTRIBUTION_URL: string;
export declare const ATTRIBUTION_HTML: string;

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

export interface Rate { rate: number; source: 'crystalballmarkets' | 'peg' | 'ecb' | 'central-bank'; time: string }
export interface RatesData { base: string; rates: Record<string, Rate> }

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

export interface Client {
  getRates(): Promise<ApiFile<RatesData>>;
  getGold(): Promise<ApiFile<GoldData>>;
  getQuotes(): Promise<ApiFile<Quote[]>>;
  getRate(code: string): Promise<number | undefined>;
  convert(amount: number, from: string, to: string): Promise<number>;
  getGoldPrice(country: string): Promise<GoldCountry | undefined>;
  getQuote(ticker: string): Promise<Quote | undefined>;
}

export declare function createClient(options?: ClientOptions): Client;
export default createClient;
