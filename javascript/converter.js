/**
 * The converter, for any web page: a currency converter and a gold value calculator in one card.
 *
 *   import { mountConverter } from 'crystal-ball-markets/converter';
 *   mountConverter(document.querySelector('#converter'));
 *
 * It reads the two rate files of the free Crystal Ball Markets Rates API (the browser names your site), keeps them
 * five minutes, and does every sum in the page (core.js). Nothing the visitor types is sent anywhere. The one thing
 * kept is a pair the visitor pins, in the browser's own storage, and only when they press Pin.
 *
 * On a local or test page (localhost, a .test or .local address, a file) it shows the rates packed with the package,
 * marked as a sample with their date, and asks the API for nothing: the API serves public sites.
 *
 * It shows the link the API's terms ask for, "Rates by Crystal Ball Markets", under the figures.
 */
import { MAX_PINS, PURITIES, UNITS, convert, currencyLists, goldValue, moneyDigits, pairKey, pairOf, parseAmount, perUsd, rateDigits, sourceText, togglePin } from './core.js';
import { ATTRIBUTION_TEXT, ATTRIBUTION_URL, createClient, purityOf, unitOf } from './index.js';
import { BASE_CSS } from './converter-style.js';
import { SAMPLE } from './sample.js';

/** How long the rates on hand are used before the converter asks again. */
const KEEP_MS = 5 * 60_000;
/** Refresh answers from the rates on hand inside this time (the API asks for each file to be kept a minute). */
const REFRESH_MS = 60_000;
const PIN_STORE = 'cbmarketsRatesPins';
const PIN_EVENT = 'cbmarketsRatesPins';
const STYLE_ID = 'cbmarkets-converter-style';

/** The few rules this converter needs beyond the shared look: it reads the rates itself, so it can refresh and retry. */
const OWN_CSS = `
.cbmarkets-converter .cbmarkets-status { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.cbmarkets-converter .cbmarkets-refresh, .cbmarkets-converter .cbmarkets-retry { appearance: none; -webkit-appearance: none; min-width: 0; min-height: 0; height: auto; margin: 0; box-shadow: none !important; font: inherit; letter-spacing: normal !important; text-transform: none !important; cursor: pointer; }
.cbmarkets-converter .cbmarkets-refresh { padding: 0; border: 0 !important; background: none !important; color: var(--cbmarkets-accent) !important; font-size: 12px; font-weight: 600; }
.cbmarkets-converter .cbmarkets-refresh:disabled { color: var(--cbmarkets-ink-3) !important; cursor: default; }
.cbmarkets-converter .cbmarkets-retry { margin-top: 12px; padding: 0 16px; height: 36px; border: 0 !important; border-radius: 8px !important; background: var(--cbmarkets-accent) !important; color: var(--cbmarkets-panel) !important; font-weight: 650; }
.cbmarkets-converter .cbmarkets-blank { padding: 28px 8px 20px; text-align: center; }
`;

/** The stylesheet, for a page that would rather link it than have it added. */
export const CONVERTER_CSS = BASE_CSS + OWN_CSS;

/** The words the converter shows. Pass `labels` to mountConverter() to change any of them but the link's. */
export const LABELS = {
  currency: 'Currency',
  gold: 'Gold',
  whatToConvert: 'What to convert',
  amount: 'Amount',
  from: 'From',
  to: 'To',
  swap: 'Swap',
  swapLong: 'Swap the two currencies',
  weight: 'Weight',
  unit: 'Unit',
  purity: 'Purity',
  goldCurrency: 'Currency',
  enterAmount: 'Enter an amount',
  enterWeight: 'Enter a weight',
  amountIs: '%1$s %2$s =',
  oneIs: '1 %1$s = %2$s %3$s',
  sourceOf: '%1$s: %2$s, %3$s',
  goldIs: '%1$s %2$s of %3$s gold =',
  spot: 'Gold: %1$s USD a troy ounce, %2$s',
  pin: 'Pin',
  pinned: 'Pinned',
  pinTitle: 'Keep this pair below for next time',
  unpinTitle: 'Remove this pair from your pinned pairs',
  copy: 'Copy',
  copied: 'Copied',
  loadPair: 'Convert %1$s to %2$s, rate %3$s',
  removePair: 'Remove %1$s to %2$s',
  mostUsed: 'Most used',
  allCurrencies: 'All currencies',
  pinnedPairs: 'Pinned pairs',
  perGram: 'Per gram, by purity',
  goldNote: 'The value of the gold itself at the international price. Shop prices add local duty, tax and making charges.',
  updated: 'Rates updated %s',
  updating: 'Updating the rates…',
  kept: 'Could not update. Showing the rates of %s.',
  sample: 'Sample rates of %s. Live rates load on a public site.',
  loading: 'Loading the rates…',
  failed: 'The rates could not be loaded. Check your connection and try again.',
  retry: 'Try again',
  refresh: 'Refresh',
  legal: 'Indicative rates for information only, not an offer to buy or sell.',
};

/** A sentence with its numbered places filled: fill('%1$s to %2$s', 'USD', 'EUR'). */
function fill(template, ...args) {
  let next = 0;
  return String(template ?? '').replace(/%(?:(\d+)\$)?s/g, (all, n) => String(args[n ? Number(n) - 1 : next++] ?? ''));
}

/** An element with its attributes and children, built without any markup being read as code. */
function h(tag, attrs = {}, ...children) {
  const el = tag === 'svg' || tag === 'path' ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    el.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

/** A page the API does not serve: a file, or a local or test address. Such a page shows the sample. */
export function isTestPage(location = globalThis.location) {
  if (!location) return true;
  if (location.protocol !== 'https:' && location.protocol !== 'http:') return true;
  const host = String(location.hostname ?? '').toLowerCase().replace(/^\[|\]$/g, '');
  return !host || host === 'localhost' || !host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || /\.(localhost|local|test|example|invalid|internal|lan)$/.test(host);
}

// ---- the rates, shared by every converter on the page ----

let shared = null; // { rates, gold, at, state }
let loading = null;

async function load(client, asked) {
  const age = shared ? Date.now() - shared.at : Infinity;
  if (shared && shared.state !== 'sample' && age < (asked ? REFRESH_MS : KEEP_MS)) return shared;
  if (!loading) {
    loading = client.getData()
      .then((data) => { shared = { ...data, state: 'live' }; return shared; })
      .catch((error) => {
        // Nothing read: the last rates stay, marked as kept; with none, the caller shows that they could not be loaded.
        if (shared && shared.state !== 'sample') shared = { ...shared, state: 'kept' };
        else throw error;
        return shared;
      })
      .finally(() => { loading = null; });
  }
  return loading;
}

function readPins() {
  try {
    const list = JSON.parse(globalThis.localStorage.getItem(PIN_STORE) || '[]');
    return Array.isArray(list) ? list.filter((p) => pairOf(p)).slice(0, MAX_PINS) : [];
  } catch {
    return [];
  }
}
function writePins(pins) {
  try {
    globalThis.localStorage.setItem(PIN_STORE, JSON.stringify(pins));
  } catch { /* storage full or switched off: the converter still works, it just forgets */ }
  document.dispatchEvent(new CustomEvent(PIN_EVENT));
}
function canStore() {
  try {
    return typeof globalThis.localStorage?.getItem === 'function';
  } catch {
    return false;
  }
}

let serial = 0;
let defaultClient = null;

/**
 * Puts a converter in `target` (an element, or a selector for one) and returns { element, refresh(), destroy() }.
 *
 * Options: show ('both', 'currency' or 'gold'), tab, amount, from, to, weight, unit, purity, goldCurrency,
 * theme ('light', 'dark' or 'auto'), lang, labels, styles (false to add no stylesheet: link CONVERTER_CSS yourself),
 * credit (false only when the page shows the link elsewhere), client (your own createClient()), and data
 * ({ rates, gold, at } already on hand, for example read on your server).
 */
export function mountConverter(target, options = {}) {
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  if (!(host instanceof Element)) throw new Error('mountConverter needs an element, or a selector that finds one.');

  const words = { ...LABELS, ...(options.labels ?? {}) };
  const show = ['currency', 'gold'].includes(options.show) ? options.show : 'both';
  const theme = ['dark', 'auto'].includes(options.theme) ? options.theme : 'light';
  const id = `cbmarkets-${++serial}`;
  const prefs = {
    tab: show === 'both' ? (options.tab === 'gold' ? 'gold' : 'currency') : show,
    from: String(options.from ?? 'USD').toUpperCase(),
    to: String(options.to ?? 'EUR').toUpperCase(),
    unit: unitOf(options.unit ?? 'gram')?.id ?? 'gram',
    purity: purityOf(options.purity ?? 'k24')?.id ?? 'k24',
    goldCurrency: String(options.goldCurrency ?? 'USD').toUpperCase(),
  };
  let data = null;
  let busy = false;
  let failed = false;
  let listed = '';
  let alive = true;

  if (options.styles !== false && !document.getElementById(STYLE_ID)) {
    document.head.append(h('style', { id: STYLE_ID }, CONVERTER_CSS));
  }

  // ---- words and numbers, in the page's language ----

  let lang = options.lang || document.documentElement.lang || navigator.language || 'en';
  try {
    new Intl.NumberFormat(lang);
  } catch {
    lang = 'en';
  }
  const decimalMark = new Intl.NumberFormat(lang).formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.';
  const names = (() => {
    try {
      return new Intl.DisplayNames([lang, 'en'], { type: 'currency' });
    } catch {
      return null;
    }
  })();
  const nameOf = (code) => {
    try {
      const n = names?.of(code);
      return n && n !== code ? n : '';
    } catch {
      return '';
    }
  };
  const digitsOf = (code) => {
    try {
      return new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits;
    } catch {
      return 2;
    }
  };
  const fixed = (value, digits) => new Intl.NumberFormat(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  const plain = (value) => new Intl.NumberFormat(lang, { maximumFractionDigits: 8 }).format(value);
  const money = (value, code) => `${fixed(value, moneyDigits(value, digitsOf(code)))} ${code}`;
  /** A time today as "14:05", an earlier day as "18 Nov 2026". */
  const when = (time) => {
    const d = new Date(time);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const today = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    return today
      ? new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(d)
      : new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  };

  // ---- the card ----

  const part = {};
  const field = (label, control) => h('label', { class: 'cbmarkets-field' }, h('span', { class: 'cbmarkets-label' }, label), control);
  const input = (name, value) => (part[name] = h('input', { class: 'cbmarkets-input', type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', value }));
  const select = (name) => (part[name] = h('select', { class: 'cbmarkets-select' }));
  const tool = (name, label, attrs = {}) => (part[name] = h('button', { type: 'button', class: 'cbmarkets-tool', ...attrs }, label));
  const line = (name, cls) => (part[name] = h('p', { class: cls }));
  const tabButton = (name) => (part[`tab-${name}`] = h('button', { type: 'button', class: 'cbmarkets-tab', role: 'tab', id: `${id}-tab-${name}`, 'aria-controls': `${id}-panel-${name}` }, words[name]));
  const panel = (name, ...children) => (part[`panel-${name}`] = h('div', { class: 'cbmarkets-panel', id: `${id}-panel-${name}`, role: show === 'both' ? 'tabpanel' : null, 'aria-labelledby': show === 'both' ? `${id}-tab-${name}` : null }, ...children));

  const currencyPanel = show === 'gold' ? null : panel('currency',
    field(words.amount, input('amount', String(options.amount ?? '1'))),
    h('div', { class: 'cbmarkets-pair' },
      field(words.from, select('from')),
      (part.swap = h('button', { type: 'button', class: 'cbmarkets-icon', 'aria-label': words.swapLong, title: words.swap },
        h('svg', { viewBox: '0 0 20 20', width: 18, height: 18, 'aria-hidden': 'true', focusable: 'false' },
          h('path', { d: 'M6 3 2.5 6.5 6 10M2.5 6.5h13M14 10l3.5 3.5L14 17M17.5 13.5h-13', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })))),
      field(words.to, select('to'))),
    h('div', { class: 'cbmarkets-result', 'aria-live': 'polite' },
      h('span', { class: 'cbmarkets-tools' }, tool('pin', words.pin, { 'aria-pressed': 'false', hidden: !canStore() }), tool('copyCurrency', words.copy, { hidden: !navigator.clipboard?.writeText })),
      line('currencyFrom', 'cbmarkets-small cbmarkets-lead'),
      h('p', { class: 'cbmarkets-big' }, (part.currencyValue = h('output'))),
      line('currencyRate', 'cbmarkets-small'),
      line('currencySource', 'cbmarkets-small cbmarkets-muted')),
    (part.pins = h('div', { class: 'cbmarkets-pins', hidden: true },
      h('p', { class: 'cbmarkets-label', id: `${id}-pins` }, words.pinnedPairs),
      (part.pinList = h('ul', { class: 'cbmarkets-pin-list', 'aria-labelledby': `${id}-pins` })))));

  const goldPanel = show === 'currency' ? null : panel('gold',
    h('div', { class: 'cbmarkets-pair cbmarkets-two' }, field(words.weight, input('weight', String(options.weight ?? '10'))), field(words.unit, select('unit'))),
    h('div', { class: 'cbmarkets-pair cbmarkets-two' }, field(words.purity, select('purity')), field(words.goldCurrency, select('goldCurrency'))),
    h('div', { class: 'cbmarkets-result', 'aria-live': 'polite' },
      h('span', { class: 'cbmarkets-tools' }, tool('copyGold', words.copy, { hidden: !navigator.clipboard?.writeText })),
      line('goldFrom', 'cbmarkets-small cbmarkets-lead'),
      h('p', { class: 'cbmarkets-big' }, (part.goldValue = h('output'))),
      line('goldSpot', 'cbmarkets-small')),
    h('table', { class: 'cbmarkets-grades' }, h('caption', { class: 'cbmarkets-label' }, words.perGram), (part.grades = h('tbody'))),
    h('p', { class: 'cbmarkets-note' }, words.goldNote));

  if (part.unit) {
    for (const u of UNITS) part.unit.append(h('option', { value: u.id }, u.label));
    for (const p of PURITIES) part.purity.append(h('option', { value: p.id }, p.text));
    part.unit.value = prefs.unit;
    part.purity.value = prefs.purity;
  }

  const blank = h('div', { class: 'cbmarkets-blank', hidden: true }, (part.blankText = h('p', { class: 'cbmarkets-empty' })), (part.retry = h('button', { type: 'button', class: 'cbmarkets-retry' }, words.retry)));
  const main = h('div', { class: 'cbmarkets-main' }, currencyPanel, goldPanel, blank);
  const foot = h('div', { class: 'cbmarkets-foot' },
    h('p', { class: 'cbmarkets-status' }, (part.updated = h('span', { role: 'status' })), (part.refresh = h('button', { type: 'button', class: 'cbmarkets-refresh' }, words.refresh))),
    options.credit === false ? null : h('p', { class: 'cbmarkets-credit' }, h('a', { href: ATTRIBUTION_URL }, ATTRIBUTION_TEXT)),
    h('p', { class: 'cbmarkets-legal' }, words.legal));
  const root = h('div', { class: `cbmarkets-converter cbmarkets-theme-${theme} cbmarkets-is-ready`, lang },
    show === 'both' ? h('div', { class: 'cbmarkets-top' }, h('div', { class: 'cbmarkets-tabs', role: 'tablist', 'aria-label': words.whatToConvert }, tabButton('currency'), tabButton('gold'))) : null,
    main, foot);

  // ---- the lists ----

  function fillCurrencies() {
    const lists = currencyLists(data.rates);
    const key = lists.all.join(',');
    if (key === listed) return;
    listed = key;
    for (const name of ['from', 'to', 'goldCurrency']) {
      if (!part[name]) continue;
      part[name].textContent = '';
      for (const [label, codes] of [[words.mostUsed, lists.common], [words.allCurrencies, lists.rest]]) {
        if (!codes.length) continue;
        part[name].append(h('optgroup', { label }, codes.map((code) => h('option', { value: code }, nameOf(code) ? `${code} · ${nameOf(code)}` : code))));
      }
    }
    const has = (c) => lists.all.includes(c);
    if (!has(prefs.from)) prefs.from = 'USD';
    if (!has(prefs.to)) prefs.to = has('EUR') && prefs.from !== 'EUR' ? 'EUR' : lists.all.find((c) => c !== prefs.from) ?? 'USD';
    if (!has(prefs.goldCurrency)) prefs.goldCurrency = 'USD';
    if (part.from) part.from.value = prefs.from;
    if (part.to) part.to.value = prefs.to;
    if (part.goldCurrency) part.goldCurrency.value = prefs.goldCurrency;
  }

  // ---- drawing ----

  function showCurrency() {
    if (!currencyPanel) return;
    const amount = parseAmount(part.amount.value, decimalMark);
    const { from, to } = prefs;
    const value = amount === null ? null : convert(amount, from, to, data.rates);
    part.amount.setAttribute('aria-invalid', String(amount === null && part.amount.value.trim() !== ''));

    const rate = convert(1, from, to, data.rates);
    part.currencyFrom.textContent = amount === null ? words.enterAmount : fill(words.amountIs, plain(amount), from);
    part.currencyValue.textContent = value === null ? '' : money(value, to);
    part.currencyRate.textContent = rate === null || from === to
      ? ''
      : `${fill(words.oneIs, from, fixed(rate, rateDigits(rate)), to)} · ${fill(words.oneIs, to, fixed(1 / rate, rateDigits(1 / rate)), from)}`;
    const legs = [...new Set([from, to])].filter((c) => c !== 'USD' && data.rates[c]);
    part.currencySource.textContent = legs.map((c) => fill(words.sourceOf, c, sourceText(data.rates[c].source), when(data.rates[c].time))).join(' · ');

    const pins = readPins();
    const pinned = pins.includes(pairKey(from, to));
    part.pin.disabled = from === to || (!pinned && pins.length >= MAX_PINS);
    part.pin.setAttribute('aria-pressed', String(pinned));
    part.pin.textContent = pinned ? words.pinned : words.pin;
    part.pin.title = pinned ? words.unpinTitle : words.pinTitle;
    part.copyCurrency.disabled = value === null;

    part.pinList.textContent = '';
    const shown = pins.map(pairOf).filter((p) => p && convert(1, p.from, p.to, data.rates) !== null);
    part.pins.hidden = shown.length === 0;
    for (const p of shown) {
      const pairRate = convert(1, p.from, p.to, data.rates);
      const loadPair = h('button', { type: 'button', class: 'cbmarkets-pin-load', 'aria-label': fill(words.loadPair, p.from, p.to, fixed(pairRate, rateDigits(pairRate))) },
        h('b', {}, `${p.from}/${p.to}`), h('span', {}, fixed(pairRate, Math.min(4, rateDigits(pairRate)))));
      loadPair.addEventListener('click', () => {
        prefs.from = p.from;
        prefs.to = p.to;
        part.from.value = p.from;
        part.to.value = p.to;
        draw();
      });
      const remove = h('button', { type: 'button', class: 'cbmarkets-pin-remove', 'aria-label': fill(words.removePair, p.from, p.to) }, '×');
      remove.addEventListener('click', () => writePins(togglePin(readPins(), pairKey(p.from, p.to))));
      part.pinList.append(h('li', {}, loadPair, remove));
    }
  }

  function showGold() {
    if (!goldPanel) return;
    const weight = parseAmount(part.weight.value, decimalMark);
    const unit = unitOf(prefs.unit) ?? UNITS[0];
    const purity = purityOf(prefs.purity) ?? PURITIES[0];
    const code = prefs.goldCurrency;
    const per = perUsd(code, data.rates);
    const { usdPerOunce, time } = data.gold;
    const value = weight === null || per === null ? null : goldValue(weight, unit.grams, purity.fine, usdPerOunce, per);
    part.weight.setAttribute('aria-invalid', String(weight === null && part.weight.value.trim() !== ''));

    part.goldFrom.textContent = weight === null ? words.enterWeight : fill(words.goldIs, plain(weight), weight === 1 ? unit.one : unit.many, purity.label);
    part.goldValue.textContent = value === null ? '' : money(value, code);
    part.goldSpot.textContent = fill(words.spot, fixed(usdPerOunce, 2), when(time));
    part.copyGold.disabled = value === null;

    part.grades.textContent = '';
    if (per === null) return;
    for (const p of PURITIES.filter((x) => ['k24', 'k22', 'k18'].includes(x.id))) {
      part.grades.append(h('tr', {}, h('th', { scope: 'row' }, p.label), h('td', {}, money(goldValue(1, 1, p.fine, usdPerOunce, per), code))));
    }
  }

  function showStatus() {
    const late = !!data && (failed || data.state !== 'live');
    part.updated.parentElement.classList.toggle('cbmarkets-late', late && !busy);
    if (busy) part.updated.textContent = data ? words.updating : '';
    else if (!data) part.updated.textContent = '';
    else if (data.state === 'sample') part.updated.textContent = fill(words.sample, when(data.at));
    else if (data.state === 'kept' || failed) part.updated.textContent = fill(words.kept, when(data.at));
    else part.updated.textContent = fill(words.updated, when(data.at));
    part.refresh.disabled = busy;
    part.refresh.hidden = !data || data.state === 'sample' || !!options.data;
  }

  function draw() {
    if (!alive) return;
    for (const name of ['currency', 'gold']) {
      const on = prefs.tab === name;
      const button = part[`tab-${name}`];
      if (button) {
        button.setAttribute('aria-selected', String(on));
        button.tabIndex = on ? 0 : -1;
      }
      if (part[`panel-${name}`]) part[`panel-${name}`].hidden = !on || !data;
    }
    blank.hidden = !!data;
    if (!data) {
      part.blankText.textContent = busy ? words.loading : words.failed;
      part.retry.hidden = busy;
    } else {
      fillCurrencies();
      showCurrency();
      showGold();
    }
    showStatus();
  }

  // ---- the rates ----

  async function refresh(asked = false) {
    if (!alive || busy) return;
    if (options.data) {
      data = { state: 'live', ...options.data };
      draw();
      return;
    }
    if (!options.client && isTestPage()) {
      shared ??= { ...SAMPLE, state: 'sample' };
      data = shared;
      draw();
      return;
    }
    busy = true;
    draw();
    try {
      data = await load(options.client ?? (defaultClient ??= createClient()), asked);
      failed = data.state === 'kept';
    } catch {
      failed = true;
    }
    busy = false;
    draw();
  }

  // ---- controls ----

  const copy = async (button, text) => {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = words.copied;
      setTimeout(() => { button.textContent = words.copy; }, 1400);
    } catch { /* the clipboard is not available: nothing to do */ }
  };
  const on = (name, event, handler) => part[name]?.addEventListener(event, handler);
  const tabs = show === 'both' ? ['currency', 'gold'] : [];
  for (const name of tabs) {
    on(`tab-${name}`, 'click', () => { prefs.tab = name; draw(); });
    on(`tab-${name}`, 'keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      prefs.tab = tabs[(tabs.indexOf(name) + 1) % tabs.length];
      draw();
      part[`tab-${prefs.tab}`].focus();
    });
  }
  on('amount', 'input', () => data && draw());
  on('weight', 'input', () => data && draw());
  for (const name of ['from', 'to', 'unit', 'purity', 'goldCurrency']) on(name, 'change', () => { prefs[name] = part[name].value; draw(); });
  on('swap', 'click', () => {
    [prefs.from, prefs.to] = [prefs.to, prefs.from];
    part.from.value = prefs.from;
    part.to.value = prefs.to;
    draw();
  });
  on('pin', 'click', () => writePins(togglePin(readPins(), pairKey(prefs.from, prefs.to))));
  on('copyCurrency', 'click', () => copy(part.copyCurrency, `${part.currencyFrom.textContent} ${part.currencyValue.textContent}`));
  on('copyGold', 'click', () => copy(part.copyGold, `${part.goldFrom.textContent} ${part.goldValue.textContent}`));
  on('refresh', 'click', () => refresh(true));
  on('retry', 'click', () => refresh(true));
  const onPins = () => data && draw();
  document.addEventListener(PIN_EVENT, onPins);

  host.append(root);
  draw();
  const ready = refresh(false);

  return {
    element: root,
    /** Resolves when the first rates are in (or could not be read). */
    ready,
    refresh: () => refresh(true),
    destroy() {
      alive = false;
      document.removeEventListener(PIN_EVENT, onPins);
      root.remove();
    },
  };
}

export default mountConverter;
