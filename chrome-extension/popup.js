const BASE = 'https://crystalballmarkets.com/markets/';
const HEIGHTS = { gold: 236, convert: 206, quote: 150, table: 378 };
const $ = (id) => document.getElementById(id);

const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

const browserLang = (navigator.language || 'en').toLowerCase().split('-')[0];
const lang = CBM_LANGS.includes(browserLang === 'fil' ? 'tl' : browserLang) ? (browserLang === 'fil' ? 'tl' : browserLang) : 'en';
const theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

function countryName(slug) {
  if (CBM_COUNTRY_NAMES[slug]) return CBM_COUNTRY_NAMES[slug];
  return slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function fill(select, items) {
  for (const [value, label] of items) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    select.append(o);
  }
}

fill($('gold-select'), CBM_GOLD_COUNTRIES
  .map((s) => [s, countryName(s)])
  .sort((a, b) => a[1].localeCompare(b[1])));
fill($('convert-select'), CBM_PAIRS.map((p) => [p, p.toUpperCase().replace('-', ' → ')]));
fill($('quote-select'), CBM_MARKETS);

$('gold-select').value = store.get('gold', 'india');
$('convert-select').value = store.get('convert', 'usd-eur');
$('quote-select').value = store.get('quote', 'xauusd');

let tab = store.get('tab', 'gold');

function render() {
  for (const b of document.querySelectorAll('nav button')) {
    b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  }
  for (const k of ['gold', 'convert', 'quote']) $(`${k}-select`).hidden = k !== tab;

  const value = tab === 'table' ? 'all' : $(`${tab}-select`).value;
  const src = `${BASE}widget/${tab}/${value}?lang=${lang}&theme=${theme}`;
  const frame = $('widget');
  if (frame.src !== src) frame.src = src;
  frame.style.height = `${HEIGHTS[tab]}px`;
  store.set('tab', tab);
}

for (const b of document.querySelectorAll('nav button')) {
  b.addEventListener('click', () => { tab = b.dataset.tab; render(); });
}
for (const k of ['gold', 'convert', 'quote']) {
  $(`${k}-select`).addEventListener('change', (e) => { store.set(k, e.target.value); render(); });
}

render();
