/**
 * The pop-up: reads the two rate files, keeps them for five minutes, and does every sum here (core.js). Nothing is
 * sent anywhere: the only requests are the two GETs below, and what you choose is kept in this browser's storage.
 * All the code is in this package; the rate files are data (JSON), never script.
 */
import { MAX_PINS, PURITIES, UNITS, convert, currencyLists, goldValue, moneyDigits, pairKey, pairOf, parseAmount, perUsd, rateDigits, readGold, readRates, sourceText, togglePin } from './core.js';

const API = 'https://crystalballmarkets.com/markets/api/v1/';
/** How long the rates on hand are used before the pop-up asks again (the files ask to be kept at least a minute). */
const KEEP_MS = 5 * 60_000;
/** Refresh answers from the rates on hand inside this time. */
const REFRESH_MS = 60_000;
const TIMEOUT_MS = 12_000;

const $ = (id) => document.getElementById(id);
const lang = navigator.language || 'en';
const decimalMark = new Intl.NumberFormat(lang).formatToParts(1.5).find((p) => p.type === 'decimal')?.value ?? '.';

/** chrome.storage in the extension; the page's own storage when the pop-up is opened as a plain page (tests). */
const area = globalThis.chrome?.storage?.local;
const store = {
  async get(key, fallback) {
    try {
      if (area) return (await area.get(key))[key] ?? fallback;
      const raw = localStorage.getItem(`cbm:${key}`);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  async set(key, value) {
    try {
      if (area) await area.set({ [key]: value });
      else localStorage.setItem(`cbm:${key}`, JSON.stringify(value));
    } catch { /* storage full or switched off: the pop-up still works, it just forgets */ }
  },
};

const DEFAULTS = { tab: 'currency', amount: '1', from: 'USD', to: 'EUR', weight: '10', unit: 'gram', purity: 'k24', goldCurrency: 'USD', pins: [] };
let prefs = { ...DEFAULTS };
/** { rates, gold, at } once the files have been read. */
let data = null;
let busy = false;
let failed = false;
let listed = '';

// ---- words and numbers ----

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
function when(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const today = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return today
    ? new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(d)
    : new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

// ---- the lists ----

function option(value, text) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = text;
  return o;
}

function fillCurrencies() {
  const lists = currencyLists(data.rates);
  const key = lists.all.join(',');
  if (key === listed) return;
  listed = key;
  for (const id of ['from', 'to', 'gold-currency']) {
    const select = $(id);
    select.textContent = '';
    for (const [label, codes] of [['Most used', lists.common], ['All currencies', lists.rest]]) {
      if (!codes.length) continue;
      const group = document.createElement('optgroup');
      group.label = label;
      for (const code of codes) group.append(option(code, nameOf(code) ? `${code} · ${nameOf(code)}` : code));
      select.append(group);
    }
  }
  const has = (c) => lists.all.includes(c);
  if (!has(prefs.from)) prefs.from = 'USD';
  if (!has(prefs.to)) prefs.to = has('EUR') ? 'EUR' : lists.all.find((c) => c !== prefs.from) ?? 'USD';
  if (!has(prefs.goldCurrency)) prefs.goldCurrency = 'USD';
  $('from').value = prefs.from;
  $('to').value = prefs.to;
  $('gold-currency').value = prefs.goldCurrency;
}

function fillGoldLists() {
  for (const u of UNITS) $('unit').append(option(u.id, u.label));
  for (const p of PURITIES) $('purity').append(option(p.id, p.text));
  $('unit').value = UNITS.some((u) => u.id === prefs.unit) ? prefs.unit : 'gram';
  $('purity').value = PURITIES.some((p) => p.id === prefs.purity) ? prefs.purity : 'k24';
}

// ---- drawing ----

function showCurrency() {
  const input = $('amount');
  const amount = parseAmount(input.value, decimalMark);
  const { from, to } = prefs;
  const value = amount === null ? null : convert(amount, from, to, data.rates);
  input.setAttribute('aria-invalid', String(amount === null && input.value.trim() !== ''));

  const rate = convert(1, from, to, data.rates);
  $('currency-from-line').textContent = amount === null ? 'Enter an amount' : `${plain(amount)} ${from} =`;
  $('currency-value').textContent = value === null ? '' : money(value, to);
  $('currency-rate').textContent = rate === null || from === to
    ? ''
    : `1 ${from} = ${fixed(rate, rateDigits(rate))} ${to} · 1 ${to} = ${fixed(1 / rate, rateDigits(1 / rate))} ${from}`;
  const legs = [...new Set([from, to])].filter((c) => c !== 'USD' && data.rates[c]);
  $('currency-source').textContent = legs.map((c) => `${c}: ${sourceText(data.rates[c].source)}, ${when(data.rates[c].time)}`).join(' · ');

  const pinned = prefs.pins.includes(pairKey(from, to));
  const pin = $('pin');
  pin.disabled = from === to || (!pinned && prefs.pins.length >= MAX_PINS);
  pin.setAttribute('aria-pressed', String(pinned));
  pin.textContent = pinned ? 'Pinned' : 'Pin';
  pin.title = pinned ? 'Remove this pair from your pinned pairs' : 'Keep this pair below for next time';
  $('copy-currency').disabled = value === null;
  showPins();
}

function showPins() {
  const list = $('pin-list');
  list.textContent = '';
  const pins = prefs.pins.map(pairOf).filter((p) => p && convert(1, p.from, p.to, data.rates) !== null);
  $('pins').hidden = pins.length === 0;
  for (const { from, to } of pins) {
    const rate = convert(1, from, to, data.rates);
    const li = document.createElement('li');
    const load = document.createElement('button');
    load.type = 'button';
    load.className = 'load';
    const pair = document.createElement('b');
    pair.textContent = `${from}/${to}`;
    load.setAttribute('aria-label', `Convert ${from} to ${to}, rate ${fixed(rate, rateDigits(rate))}`);
    const figure = document.createElement('span');
    figure.textContent = fixed(rate, Math.min(4, rateDigits(rate)));
    load.append(pair, figure);
    load.addEventListener('click', () => {
      prefs.from = from;
      prefs.to = to;
      $('from').value = from;
      $('to').value = to;
      changed();
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${from} to ${to}`);
    remove.addEventListener('click', () => {
      prefs.pins = togglePin(prefs.pins, pairKey(from, to));
      changed();
    });
    li.append(load, remove);
    list.append(li);
  }
}

function showGold() {
  const input = $('weight');
  const weight = parseAmount(input.value, decimalMark);
  const unit = UNITS.find((u) => u.id === prefs.unit) ?? UNITS[0];
  const purity = PURITIES.find((p) => p.id === prefs.purity) ?? PURITIES[0];
  const code = prefs.goldCurrency;
  const per = perUsd(code, data.rates);
  const { usdPerOunce, time } = data.gold;
  const value = weight === null || per === null ? null : goldValue(weight, unit.grams, purity.fine, usdPerOunce, per);
  input.setAttribute('aria-invalid', String(weight === null && input.value.trim() !== ''));

  $('gold-from-line').textContent = weight === null ? 'Enter a weight' : `${plain(weight)} ${weight === 1 ? unit.one : unit.many} of ${purity.label} gold =`;
  $('gold-value').textContent = value === null ? '' : money(value, code);
  $('gold-spot').textContent = `Gold: ${fixed(usdPerOunce, 2)} USD a troy ounce, ${when(time)}`;
  $('copy-gold').disabled = value === null;

  const body = $('grades');
  body.textContent = '';
  if (per === null) return;
  for (const p of PURITIES.filter((x) => ['k24', 'k22', 'k18'].includes(x.id))) {
    const row = document.createElement('tr');
    const head = document.createElement('th');
    head.scope = 'row';
    head.textContent = p.label;
    const cell = document.createElement('td');
    cell.textContent = money(goldValue(1, 1, p.fine, usdPerOunce, per), code);
    row.append(head, cell);
    body.append(row);
  }
}

function showStatus() {
  const updated = $('updated');
  updated.classList.toggle('late', failed && !!data);
  if (busy) updated.textContent = 'Updating the rates…';
  else if (failed && data) updated.textContent = `Could not update. Showing the rates of ${when(new Date(data.at).toISOString())}.`;
  else if (data) updated.textContent = `Rates updated ${when(new Date(data.at).toISOString())}`;
  else updated.textContent = '';
  $('refresh').disabled = busy;
}

function draw() {
  for (const tab of ['currency', 'gold']) {
    const on = prefs.tab === tab;
    $(`tab-${tab}`).setAttribute('aria-selected', String(on));
    $(`tab-${tab}`).tabIndex = on ? 0 : -1;
    $(`panel-${tab}`).hidden = !on || !data;
  }
  $('empty').hidden = !!data;
  if (!data) {
    $('empty-text').textContent = busy ? 'Loading the rates…' : 'The rates could not be loaded. Check your connection and try again.';
    $('retry').hidden = busy;
  } else {
    fillCurrencies();
    showCurrency();
    showGold();
  }
  showStatus();
}

// ---- remembering ----

let saving;
function save() {
  clearTimeout(saving);
  saving = undefined;
  return store.set('prefs', prefs);
}
/** A choice (tab, list, pin) is kept at once; typing waits for a pause. Closing the pop-up keeps what is waiting (wire). */
function changed(typing = false) {
  draw();
  if (typing) {
    clearTimeout(saving);
    saving = setTimeout(save, 250);
  } else {
    save();
  }
}

// ---- the rates ----

async function getJson(file) {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API + file, { signal: stop.signal, credentials: 'omit', headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const usable = (d) => !!d && typeof d === 'object' && typeof d.at === 'number' && !!d.rates && typeof d.rates === 'object' && typeof d.gold?.usdPerOunce === 'number' && d.gold.usdPerOunce > 0;

async function load(asked) {
  if (busy) return;
  const age = data ? Date.now() - data.at : Infinity;
  if (age < (asked ? REFRESH_MS : KEEP_MS)) {
    failed = false;
    draw();
    return;
  }
  busy = true;
  draw();
  try {
    const [ratesBody, goldBody] = await Promise.all([getJson('rates.json'), getJson('gold.json')]);
    const rates = readRates(ratesBody);
    const gold = readGold(goldBody);
    if (!rates || !gold) throw new Error('not the files we expect');
    data = { rates, gold, at: Date.now() };
    failed = false;
    await store.set('data', data);
  } catch {
    failed = true;
    // Nothing read and nothing kept from before (a first opening without a connection): the rates packed with this
    // version, shown with their date and the "could not update" line, never kept as if they had been read.
    if (!data) data = await packed();
  }
  busy = false;
  draw();
}

/** The rates packed with the extension (snapshot.json, written by tools/extension/pack.mjs), or null. */
async function packed() {
  try {
    const res = await fetch('snapshot.json');
    const d = res.ok ? await res.json() : null;
    return usable(d) ? d : null;
  } catch {
    return null;
  }
}

// ---- controls ----

async function copy(button, text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    const was = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = was; }, 1400);
  } catch { /* the clipboard is not available: nothing to do */ }
}

function wire() {
  const tabs = ['currency', 'gold'];
  for (const tab of tabs) {
    $(`tab-${tab}`).addEventListener('click', () => { prefs.tab = tab; changed(); });
    $(`tab-${tab}`).addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      prefs.tab = tabs[(tabs.indexOf(tab) + 1) % tabs.length];
      changed();
      $(`tab-${prefs.tab}`).focus();
    });
  }
  $('amount').addEventListener('input', () => { prefs.amount = $('amount').value; changed(true); });
  $('weight').addEventListener('input', () => { prefs.weight = $('weight').value; changed(true); });
  $('from').addEventListener('change', () => { prefs.from = $('from').value; changed(); });
  $('to').addEventListener('change', () => { prefs.to = $('to').value; changed(); });
  $('unit').addEventListener('change', () => { prefs.unit = $('unit').value; changed(); });
  $('purity').addEventListener('change', () => { prefs.purity = $('purity').value; changed(); });
  $('gold-currency').addEventListener('change', () => { prefs.goldCurrency = $('gold-currency').value; changed(); });
  $('swap').addEventListener('click', () => {
    [prefs.from, prefs.to] = [prefs.to, prefs.from];
    $('from').value = prefs.from;
    $('to').value = prefs.to;
    changed();
  });
  $('pin').addEventListener('click', () => { prefs.pins = togglePin(prefs.pins, pairKey(prefs.from, prefs.to)); changed(); });
  $('copy-currency').addEventListener('click', () => copy($('copy-currency'), `${$('currency-from-line').textContent} ${$('currency-value').textContent}`));
  $('copy-gold').addEventListener('click', () => copy($('copy-gold'), `${$('gold-from-line').textContent} ${$('gold-value').textContent}`));
  $('refresh').addEventListener('click', () => load(true));
  $('retry').addEventListener('click', () => load(true));
  // The pop-up closes the moment you click away: keep an amount still waiting for its pause.
  const keep = () => { if (saving !== undefined) save(); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') keep(); });
  window.addEventListener('pagehide', keep);
}

async function start() {
  const [savedPrefs, savedData] = await Promise.all([store.get('prefs', null), store.get('data', null)]);
  if (savedPrefs && typeof savedPrefs === 'object') prefs = { ...DEFAULTS, ...savedPrefs, pins: Array.isArray(savedPrefs.pins) ? savedPrefs.pins.filter((p) => pairOf(p)).slice(0, MAX_PINS) : [] };
  if (!['currency', 'gold'].includes(prefs.tab)) prefs.tab = 'currency';
  if (usable(savedData)) data = savedData;
  $('amount').value = typeof prefs.amount === 'string' && prefs.amount ? prefs.amount : '1';
  $('weight').value = typeof prefs.weight === 'string' && prefs.weight ? prefs.weight : '10';
  fillGoldLists();
  wire();
  draw();
  await load(false);
  if (prefs.tab === 'currency') $('amount').select();
}

start();
