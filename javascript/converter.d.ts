import type { Client, PurityId, RatesOnHand, UnitId } from './index.js';

/** The words the converter shows. */
export declare const LABELS: Record<string, string>;
/** The converter's stylesheet, for a page that would rather link it than have it added. */
export declare const CONVERTER_CSS: string;

export interface ConverterOptions {
  /** Both in two tabs (the default), or one alone. */
  show?: 'both' | 'currency' | 'gold';
  /** The tab it opens on, when it shows both. */
  tab?: 'currency' | 'gold';
  amount?: string | number;
  from?: string;
  to?: string;
  weight?: string | number;
  unit?: UnitId;
  purity?: PurityId | '24k' | '22k' | '21k' | '18k' | '14k' | number;
  goldCurrency?: string;
  /** Light (the default), dark, or the visitor's own setting. */
  theme?: 'light' | 'dark' | 'auto';
  /** The language numbers, dates and currency names are written in. Defaults to the page's. */
  lang?: string;
  /** Any of LABELS in your own words. The link's words are not changed. */
  labels?: Partial<Record<string, string>>;
  /** False to add no stylesheet: serve CONVERTER_CSS yourself. */
  styles?: boolean;
  /** False only when the same page shows the link to Crystal Ball Markets elsewhere, as the API's terms ask. */
  credit?: boolean;
  /** Your own client, for example with your own fetch. */
  client?: Pick<Client, 'getData'>;
  /** Rates already on hand, for example read on your server. The converter then asks the API for nothing. */
  data?: RatesOnHand;
}

export interface Converter {
  element: HTMLElement;
  /** Resolves when the first rates are in, or could not be read. */
  ready: Promise<void>;
  refresh(): Promise<void>;
  destroy(): void;
}

/** True for a page the API does not serve: a file, or a local or test address. */
export declare function isTestPage(location?: Pick<Location, 'protocol' | 'hostname'>): boolean;
/** Puts a converter in an element, or in the element a selector finds. */
export declare function mountConverter(target: Element | string, options?: ConverterOptions): Converter;
export default mountConverter;
