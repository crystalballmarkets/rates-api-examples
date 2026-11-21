/**
 * Draws the plugin's pictures for its page in the WordPress.org directory, into wordpress/.wordpress-org:
 * the icon (128 and 256 pixels, on a transparent ground) and the banner (772 x 250 and 1544 x 500).
 *
 *   node wordpress/tools/artwork.cjs
 *
 * The converters in the banner are pictures of the real converter, taken from the plugin's own output
 * (tests/fixture.php); nothing in them is drawn by hand. The logo is the brand's own transparent artwork.
 * Needs PHP and Playwright's Chromium. The screenshots come from: node wordpress/tests/page.cjs --shots
 */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '.wordpress-org');
const svg = (name) => `data:image/svg+xml;base64,${fs.readFileSync(path.join(OUT, 'brand', name)).toString('base64')}`;
const png = (buffer) => `data:image/png;base64,${buffer.toString('base64')}`;

(async () => {
  const browser = await chromium.launch();

  // The two converters, as the plugin draws them.
  const fixture = path.join(ROOT, 'tests/out/artwork.html');
  fs.mkdirSync(path.dirname(fixture), { recursive: true });
  fs.writeFileSync(fixture, execFileSync('php', [path.join(ROOT, 'tests/fixture.php'), 'live', 'credit', 'plain'], { maxBuffer: 16 * 1024 * 1024 }));
  const shots = await browser.newContext({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2, locale: 'en-US', timezoneId: 'UTC' });
  const page = await shots.newPage();
  await page.goto(`file://${fixture}`);
  await page.waitForSelector('#both .cbmarkets-is-ready');
  await page.addStyleTag({ content: '.cbmarkets-converter { margin: 0 !important; } :focus-visible { outline: none !important; }' });
  await page.locator('#both [data-cbmarkets="amount"]').fill('250');
  await page.locator('#both [data-cbmarkets="from"]').selectOption('GBP');
  await page.locator('#both [data-cbmarkets="to"]').selectOption('USD');
  await page.locator('body').click({ position: { x: 880, y: 5 } });
  const currency = await page.locator('#both .cbmarkets-converter').screenshot();
  const gold = await page.locator('#gold .cbmarkets-converter').screenshot();
  await shots.close();

  // The icon: the brand's mark, nothing behind it.
  for (const size of [128, 256]) {
    const context = await browser.newContext({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const tile = await context.newPage();
    await tile.setContent(`<style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img src="${svg('mark.svg')}" alt="">`);
    await tile.screenshot({ path: path.join(OUT, `icon-${size}x${size}.png`), omitBackground: true });
    await context.close();
  }
  fs.copyFileSync(path.join(OUT, 'brand/mark.svg'), path.join(OUT, 'icon.svg'));

  // The banner.
  const html = `<!DOCTYPE html><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; }
    body { width: 772px; height: 250px; overflow: hidden; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #f4f8fc;
      background: radial-gradient(520px 340px at 78% 10%, rgba(1, 191, 254, 0.26), transparent 62%), radial-gradient(420px 300px at 0% 120%, rgba(70, 211, 255, 0.12), transparent 60%), #03060c; }
    .copy { position: absolute; left: 40px; top: 0; bottom: 0; width: 330px; display: grid; align-content: center; gap: 12px; }
    .logo { height: 21px; width: auto; justify-self: start; margin-bottom: 6px; }
    h1 { margin: 0; font-size: 33px; line-height: 1.08; font-weight: 800; letter-spacing: -0.02em; }
    h1 em { font-style: normal; color: #46d3ff; }
    p { margin: 0; font-size: 14.5px; line-height: 1.4; color: #a9bcd1; font-weight: 500; }
    .card { position: absolute; top: 28px; width: 190px; border-radius: 9px; box-shadow: 0 30px 60px -24px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(70, 211, 255, 0.14); }
    .one { left: 374px; }
    .two { left: 572px; top: 46px; }
  </style>
  <div class="copy"><img class="logo" src="${svg('logo-dark.svg')}" alt=""><h1>Currency and <em>gold</em> converter</h1><p>A block and shortcodes for your pages.<br>Light or dark, inside any theme.</p></div>
  <img class="card one" src="${png(currency)}" alt=""><img class="card two" src="${png(gold)}" alt="">`;
  for (const scale of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 772, height: 250 }, deviceScaleFactor: scale });
    const banner = await context.newPage();
    await banner.setContent(html);
    await banner.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
    await banner.screenshot({ path: path.join(OUT, `banner-${772 * scale}x${250 * scale}.png`) });
    await context.close();
  }

  await browser.close();
  console.log(`Icon and banner saved in ${path.relative(process.cwd(), OUT)}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
