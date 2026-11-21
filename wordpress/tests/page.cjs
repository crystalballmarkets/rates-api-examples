/**
 * Opens the plugin's real output in a browser and uses the converter as a visitor would.
 *
 *   node wordpress/tests/page.cjs            the checks
 *   node wordpress/tests/page.cjs --shots    also saves the directory's screenshots in wordpress/.wordpress-org
 *
 * The page is written by fixture.php: the plugin's own markup, stylesheet and scripts, with stand-ins for WordPress.
 * Needs PHP and Playwright's Chromium. It reads nothing from the network: any request away from this folder fails it.
 */
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const HERE = __dirname;
const OUT = path.join(HERE, 'out');
const SHOTS = path.join(HERE, '../.wordpress-org');
const PACKED = JSON.parse(fs.readFileSync(path.join(HERE, '../crystal-ball-markets-rates/data/snapshot.json'), 'utf8'));
const RATES = PACKED.rates.data.rates;
const SPOT = PACKED.gold.data.usdPerOunce;
const OUNCE = 31.1034768;

function fixture(name, ...args) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${name}.html`);
  fs.writeFileSync(file, execFileSync('php', [path.join(HERE, 'fixture.php'), ...args], { maxBuffer: 16 * 1024 * 1024 }));
  return `file://${file}`;
}
const money = (value, digits = 2) => value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const text = (page, selector) => page.locator(selector).first().innerText();

async function open(browser, url, options = {}) {
  const context = await browser.newContext({ viewport: { width: 900, height: 900 }, deviceScaleFactor: options.scale ?? 1, colorScheme: options.colorScheme ?? 'light', javaScriptEnabled: options.js ?? true, locale: 'en-US', timezoneId: 'UTC' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = await context.newPage();
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(String(e)));
  page.on('request', (r) => { if (!r.url().startsWith('file://')) problems.push(`asked for ${r.url()}`); });
  if (options.viewport) await page.setViewportSize(options.viewport);
  await page.goto(url);
  return { page, context, problems };
}

(async () => {
  const shots = process.argv.includes('--shots');
  const browser = await chromium.launch();
  const live = fixture('live', 'live', 'credit', 'plain');

  // 1. What the server wrote is what the script writes: the two sets of sums agree, figure for figure.
  {
    const plain = await open(browser, live, { js: false });
    const scripted = await open(browser, live);
    await scripted.page.waitForSelector('.cbmarkets-is-ready');
    for (const part of ['currency-from', 'currency-value', 'currency-rate', 'gold-from', 'gold-value']) {
      const sel = (id) => `#${id} [data-cbmarkets="${part}"]`;
      for (const id of ['both', 'gold', 'currency', 'dark']) {
        if (!(await plain.page.locator(sel(id)).count())) continue;
        const before = await plain.page.locator(sel(id)).first().textContent();
        const after = await scripted.page.locator(sel(id)).first().textContent();
        assert.equal(after.trim(), before.trim(), `${id} ${part}: the page and the script disagree`);
      }
    }
    const grades = (p) => p.locator('#gold [data-cbmarkets="grades"] td').allTextContents();
    assert.deepEqual(await grades(scripted.page), await grades(plain.page), 'gold by purity');
    assert.equal(await plain.page.locator('[data-cbmarkets="pin"]:visible, [data-cbmarkets="copy-currency"]:visible').count(), 0, 'without the script, no button that needs it');
    assert.deepEqual(plain.problems.concat(scripted.problems), []);
    await plain.context.close();
    await scripted.context.close();
  }

  // 2. Using it.
  {
    const { page, context, problems } = await open(browser, live);
    const box = '#both';
    const part = (name) => page.locator(`${box} [data-cbmarkets="${name}"]`);
    await page.waitForSelector(`${box} .cbmarkets-is-ready`);

    assert.match(await text(page, `${box} [data-cbmarkets="status"]`), /^Rates updated \d\d:\d\d/);
    assert.equal(await part('from').locator('option:checked').innerText(), 'USD · US Dollar');
    assert.equal(await part('from').locator('optgroup').first().getAttribute('label'), 'Most used');

    await part('amount').fill('250');
    await part('from').selectOption('GBP');
    await part('to').selectOption('NGN');
    const ngn = (250 / RATES.GBP.rate) * RATES.NGN.rate;
    assert.equal(await part('currency-from').innerText(), '250 GBP =');
    assert.equal(await part('currency-value').innerText(), `${money(ngn)} NGN`);
    assert.match(await part('currency-rate').innerText(), /^1 GBP = [\d,.]+ NGN · 1 NGN = [\d.]+ GBP$/);
    assert.match(await part('currency-source').innerText(), /^GBP: Crystal Ball Markets quote, .+ · NGN: central bank reference rate, /);

    // An amount typed the German way, then one that is no amount.
    await part('amount').fill('1.234,56');
    assert.equal(await part('currency-value').innerText(), `${money((1234.56 / RATES.GBP.rate) * RATES.NGN.rate)} NGN`);
    await part('amount').fill('lots');
    assert.equal(await part('currency-from').innerText(), 'Enter an amount');
    assert.equal(await part('currency-value').innerText(), '');
    assert.equal(await part('amount').getAttribute('aria-invalid'), 'true');
    assert.ok(await part('copy-currency').isDisabled());
    await part('amount').fill('250');

    // Swap, yen without decimals, a small amount with enough of them.
    await part('swap').click();
    assert.equal(await part('from').inputValue(), 'NGN');
    // A small result keeps three figures that mean something: 0.141, not 0.14.
    assert.equal(await part('currency-value').innerText(), `${money((250 / RATES.NGN.rate) * RATES.GBP.rate, 3)} GBP`);
    await part('from').selectOption('USD');
    await part('to').selectOption('JPY');
    assert.equal(await part('currency-value').innerText(), `${money(250 * RATES.JPY.rate, 0)} JPY`);
    await part('to').selectOption('USD');
    assert.equal(await part('currency-rate').innerText(), '', 'the same currency twice has no rate line');
    assert.ok(await part('pin').isDisabled());

    // Copy.
    await part('to').selectOption('EUR');
    await part('amount').fill('100');
    await part('copy-currency').click();
    await page.waitForFunction(() => document.querySelector('#both [data-cbmarkets="copy-currency"]').textContent === 'Copied', null, { timeout: 3000 });
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `100 USD = ${money(100 * RATES.EUR.rate)} EUR`);

    // Pins: kept in this browser, shared by every converter on the page, four at most.
    assert.equal(await page.evaluate(() => localStorage.length), 0, 'nothing is kept before Pin is pressed');
    await part('pin').click();
    assert.equal(await part('pin').innerText(), 'Pinned');
    assert.equal(await part('pin').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('cbmarketsRatesPins'))), ['USD-EUR']);
    assert.equal(await page.locator('#currency [data-cbmarkets="pin-list"] li').count(), 1, 'the other converter shows the pin too');
    for (const to of ['GBP', 'JPY', 'INR']) {
      await part('to').selectOption(to);
      await part('pin').click();
    }
    await part('to').selectOption('AED');
    assert.ok(await part('pin').isDisabled(), 'a fifth pair cannot be pinned');
    assert.equal(await part('pin-list').locator('li').count(), 4);
    await part('pin-list').locator('.cbmarkets-pin-load').last().click();
    assert.equal(await part('to').inputValue(), 'EUR', 'a pinned pair loads');
    await part('pin-list').locator('.cbmarkets-pin-remove').first().click();
    assert.equal(await part('pin-list').locator('li').count(), 3);
    await page.reload();
    await page.waitForSelector(`${box} .cbmarkets-is-ready`);
    assert.equal(await part('pin-list').locator('li').count(), 3, 'pins are there on the next visit');
    assert.equal(await part('amount').inputValue(), '1', 'nothing else is remembered');

    // Tabs, by mouse and by keys.
    const tab = (name) => page.locator(`${box} [data-cbmarkets-tab="${name}"]`);
    await tab('gold').click();
    assert.ok(await page.locator(`${box} [data-cbmarkets-panel="gold"]`).isVisible());
    assert.ok(await page.locator(`${box} [data-cbmarkets-panel="currency"]`).isHidden());
    assert.equal(await tab('gold').getAttribute('aria-selected'), 'true');
    await tab('gold').press('ArrowRight');
    assert.equal(await tab('currency').getAttribute('aria-selected'), 'true');
    assert.ok(await tab('currency').evaluate((el) => el === document.activeElement));
    await tab('currency').press('ArrowLeft');

    // Gold.
    await part('weight').fill('2');
    await part('unit').selectOption('tola');
    await part('purity').selectOption('k22');
    await part('gold-currency').selectOption('INR');
    const worth = ((2 * 11.6638038) / OUNCE) * 0.916 * SPOT * RATES.INR.rate;
    assert.equal(await part('gold-from').innerText(), '2 tolas of 22K gold =');
    assert.equal(await part('gold-value').innerText(), `${money(worth)} INR`);
    assert.equal(await part('gold-spot').innerText(), `Gold: ${money(SPOT)} USD a troy ounce, Nov 19, 2026`);
    assert.deepEqual(await part('grades').locator('th').allInnerTexts(), ['24K', '22K', '18K']);
    assert.equal(await part('grades').locator('td').first().innerText(), `${money((1 / OUNCE) * SPOT * RATES.INR.rate)} INR`);
    await part('weight').fill('1');
    assert.equal(await part('gold-from').innerText(), '1 tola of 22K gold =');
    await part('weight').fill('');
    assert.equal(await part('gold-from').innerText(), 'Enter a weight');

    // The converters that show one half, and the link.
    assert.equal(await page.locator('#gold [role="tablist"], #currency [role="tablist"]').count(), 0);
    assert.equal(await page.locator('#gold [data-cbmarkets="gold-from"]').innerText(), '10 tolas of 22K gold =');
    assert.equal(await page.locator('#currency [data-cbmarkets="currency-from"]').innerText(), '100 GBP =');
    const link = page.locator(`${box} .cbmarkets-credit a`);
    assert.equal(await link.getAttribute('href'), 'https://crystalballmarkets.com/markets');
    assert.equal(await link.getAttribute('rel'), null);
    assert.ok(await link.isVisible());
    assert.deepEqual(problems, []);
    await context.close();
  }

  // 3. The link is absent unless it was turned on; a test site says its rates are a sample.
  {
    const { page, context, problems } = await open(browser, fixture('sample', 'sample', 'nocredit', 'plain'));
    await page.waitForSelector('#both .cbmarkets-is-ready');
    assert.equal(await page.locator('a').count(), 0, 'no link of any kind');
    assert.equal(await text(page, '#both [data-cbmarkets="status"]'), 'Sample rates of Nov 19, 2026. Live rates load on a public site.');
    assert.match(await text(page, '#table .cbmarkets-status'), /^Sample rates of 19 Nov 2026\./);
    assert.deepEqual(problems, []);
    await context.close();
  }

  // 4. A theme that restyles everything changes nothing inside the card; a phone screen fits it.
  {
    const measure = async (url, viewport) => {
      const { page, context, problems } = await open(browser, url, { viewport });
      await page.waitForSelector('#both .cbmarkets-is-ready');
      const sizes = await page.evaluate(() => {
        const box = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
        const style = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
        return {
          card: box('#both .cbmarkets-converter'),
          tab: box('#both .cbmarkets-tab'),
          input: box('#both [data-cbmarkets="amount"]'),
          select: box('#both [data-cbmarkets="from"]'),
          swap: box('#both [data-cbmarkets="swap"]'),
          result: box('#both .cbmarkets-result'),
          big: style('#both .cbmarkets-big output', 'fontSize'),
          tabCase: style('#both .cbmarkets-tab', 'textTransform'),
          tabBg: style('#both .cbmarkets-tab[aria-selected="true"]', 'backgroundColor'),
          inputBg: style('#both [data-cbmarkets="amount"]', 'backgroundColor'),
          link: style('#both .cbmarkets-credit a', 'color'),
          table: box('#table .cbmarkets-card'),
          cell: style('#table .cbmarkets-table td', 'textAlign'),
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      assert.deepEqual(problems, []);
      await context.close();
      return sizes;
    };
    const plain = await measure(live);
    const hostile = await measure(fixture('hostile', 'live', 'credit', 'hostile'));
    assert.deepEqual(hostile, plain, 'a theme’s own rules changed the card');
    assert.deepEqual([plain.card[0], plain.input[1], plain.select[1], plain.swap], [400, 38, 38, [38, 38]]);
    assert.equal(plain.tabCase, 'none');

    const phone = await measure(live, { width: 320, height: 640 });
    assert.equal(phone.overflow, false, 'the page scrolls sideways on a phone');
    assert.equal(phone.card[0], 320 - 48);
  }

  // 5. Dark colours when asked, and the visitor's own setting when that is chosen.
  {
    const colours = async (scheme) => {
      const { page, context } = await open(browser, live, { colorScheme: scheme });
      const bg = (id) => page.evaluate((sel) => getComputedStyle(document.querySelector(sel)).backgroundColor, `#${id} .cbmarkets-converter`);
      const out = { light: await bg('both'), dark: await bg('dark'), auto: await bg('currency') };
      await context.close();
      return out;
    };
    const day = await colours('light');
    const night = await colours('dark');
    assert.equal(day.light, 'rgb(244, 247, 251)');
    assert.equal(day.dark, 'rgb(3, 6, 12)');
    assert.equal(day.auto, day.light);
    assert.equal(night.auto, day.dark);
    assert.equal(night.light, day.light, 'a converter set to light stays light');
  }

  // 6. The directory's screenshots.
  if (shots) {
    fs.mkdirSync(SHOTS, { recursive: true });
    const { page, context } = await open(browser, live, { scale: 2 });
    await page.waitForSelector('#both .cbmarkets-is-ready');
    await page.addStyleTag({ content: 'body { background: #eef2f7 !important; } section { display: inline-block; padding: 28px; margin: 0 !important; }' });
    const shoot = (id, file) => page.locator(`#${id}`).screenshot({ path: path.join(SHOTS, file) });

    const part = (name) => page.locator(`#both [data-cbmarkets="${name}"]`);
    await part('amount').fill('250');
    await part('from').selectOption('GBP');
    await part('to').selectOption('NGN');
    await shoot('both', 'screenshot-1.png');
    await page.locator('#both [data-cbmarkets-tab="gold"]').click();
    await part('weight').fill('10');
    await part('unit').selectOption('tola');
    await part('purity').selectOption('k22');
    await part('gold-currency').selectOption('INR');
    await shoot('both', 'screenshot-2.png');
    for (const to of ['USD', 'GBP', 'INR']) {
      await page.locator('#dark [data-cbmarkets="to"]').selectOption(to);
      await page.locator('#dark [data-cbmarkets="pin"]').click();
    }
    await page.locator('#dark [data-cbmarkets="to"]').selectOption('JPY');
    await page.locator('#dark').evaluate((el) => { el.style.background = '#0b1220'; });
    await shoot('dark', 'screenshot-3.png');
    await page.locator('#table').evaluate((el) => { el.style.background = '#ffffff'; });
    await shoot('table', 'screenshot-4.png');
    await context.close();
    console.log(`Screenshots saved in ${path.relative(process.cwd(), SHOTS)}`);
  }

  await browser.close();
  console.log('All browser checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
