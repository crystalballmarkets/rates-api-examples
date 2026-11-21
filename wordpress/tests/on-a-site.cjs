/**
 * Goes through tests/ON-A-SITE.md on a real WordPress, in a real browser.
 *
 *   WP_URL=http://localhost:8891 WP_USER=admin WP_PASS=... WP_PATH=/path/to/wordpress node wordpress/tests/on-a-site.cjs
 *
 * It needs a clean WordPress it may change (it installs, uses and deletes the plugin), with WP_DEBUG, WP_DEBUG_LOG
 * and WP_DEBUG_DISPLAY on, the plugins "Plugin Check" and a second, classic theme ("twentytwentyone") present, and
 * the zip built by tools/pack.sh. WP_PATH is the site's folder, for reading its debug.log and running small PHP
 * helpers against it. Any PHP notice on a screen, any script error in the browser and any request to another site
 * from a visitor's page fails it.
 */
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE = (process.env.WP_URL || 'http://localhost:8891').replace(/\/+$/, '');
const USER = process.env.WP_USER || 'admin';
const PASS = process.env.WP_PASS || '';
const WP_PATH = process.env.WP_PATH || '';
const ZIP = process.env.PLUGIN_ZIP || path.join(__dirname, '../dist/crystal-ball-markets-rates.zip');
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, 'out/site');
const SLUG = 'crystal-ball-markets-rates';
const PACKED = JSON.parse(fs.readFileSync(path.join(__dirname, '../crystal-ball-markets-rates/data/snapshot.json'), 'utf8'));
const RATES = PACKED.rates.data.rates;
const SPOT = PACKED.gold.data.usdPerOunce;

const done = [];
const step = (name) => { done.push(name); console.log(`ok  ${name}`); };
const money = (value, own = 2) => {
  const digits = value > 0 && value < 1 ? Math.min(8, Math.max(own, 3 - Math.floor(Math.log10(value)) - 1)) : own;
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

/** Runs a few lines of PHP inside the site (the business does the same by clicking; this only saves the clicks). */
function php(code) {
  assert.ok(WP_PATH, 'WP_PATH is needed for this step');
  const script = `<?php $_SERVER['HTTP_HOST'] = parse_url(${JSON.stringify(BASE)}, PHP_URL_HOST) . ':' . parse_url(${JSON.stringify(BASE)}, PHP_URL_PORT); $_SERVER['REQUEST_URI'] = '/'; require ${JSON.stringify(path.join(WP_PATH, 'wp-load.php'))}; ${code}`;
  const file = path.join(SHOTS, 'helper.php');
  fs.writeFileSync(file, script);
  return execFileSync('php', [file], { encoding: 'utf8' }).trim();
}

/** A PHP warning, notice or error printed on a screen (WP_DEBUG_DISPLAY is on). */
async function noPhpErrors(page, where) {
  const html = await page.content();
  const found = /<b>(Warning|Notice|Deprecated|Fatal error|Parse error)<\/b>:[^<]*|Uncaught [A-Za-z\\]+: [^<]*|There has been a critical error/.exec(html);
  assert.equal(found ? found[0].slice(0, 400) : null, null, where);
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  assert.ok(fs.existsSync(ZIP), `Build the zip first: sh wordpress/tools/pack.sh (${ZIP})`);
  const browser = await chromium.launch();
  const admin = await browser.newContext({ viewport: { width: 1360, height: 1000 }, locale: 'en-US', timezoneId: 'UTC' });
  const page = await admin.newPage();
  const scriptErrors = [];
  page.on('pageerror', (e) => scriptErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') scriptErrors.push(m.text()); });
  page.on('dialog', (d) => d.accept());

  // Sign in.
  await page.goto(`${BASE}/wp-login.php`);
  await page.fill('#user_login', USER);
  await page.fill('#user_pass', PASS);
  await Promise.all([page.waitForURL(/wp-admin/), page.click('#wp-submit')]);
  const version = await page.evaluate(() => document.querySelector('#footer-upgrade')?.textContent.trim() ?? '');
  console.log(`    WordPress: ${version}`);

  // 1. Install and activate.
  await page.goto(`${BASE}/wp-admin/plugin-install.php?tab=upload`);
  await page.setInputFiles('#pluginzip', ZIP);
  await Promise.all([page.waitForLoadState('load'), page.click('#install-plugin-submit')]);
  await page.waitForSelector('text=Plugin installed successfully', { timeout: 60_000 });
  await noPhpErrors(page, 'installing');
  await Promise.all([page.waitForURL(/plugins\.php/), page.click('a:has-text("Activate Plugin")')]);
  await noPhpErrors(page, 'activating');
  const row = page.locator(`tr[data-slug="${SLUG}"]`);
  assert.match(await row.getAttribute('class'), /\bactive\b/);
  assert.equal(await row.locator('.plugin-title strong').innerText(), 'Crystal Ball Markets Rates');
  assert.match(await row.locator('.plugin-version-author-uri').innerText(), /Version 2\.0\.0/);
  assert.equal(await row.locator('.row-actions a:has-text("Settings")').count(), 1);
  assert.equal(await page.locator('.notice-error, .error').count(), 0, 'an error notice after activation');
  step('1. Install and activate: no error, no notice');

  // 2. Settings.
  await Promise.all([page.waitForURL(/page=cbmarkets-rates/), row.locator('.row-actions a:has-text("Settings")').click()]);
  await noPhpErrors(page, 'the settings page');
  assert.equal(await page.locator('.wrap h1').innerText(), 'Crystal Ball Markets Rates');
  assert.match(await page.locator('.wrap > p').first().innerText(), /^This is a local or test site/);
  assert.equal(await page.isChecked('#cbmarkets-rates-credit'), false, 'the link box starts unticked');
  assert.equal(await page.inputValue('#cbmarkets-rates-theme'), 'light');
  assert.equal(await page.inputValue('#cbmarkets-rates-page'), '');
  await Promise.all([page.waitForLoadState('load'), page.click('#submit')]);
  await page.waitForSelector('text=Settings saved.');
  await noPhpErrors(page, 'saving the settings');
  assert.equal(await page.isChecked('#cbmarkets-rates-credit'), false);
  await page.screenshot({ path: path.join(SHOTS, 'settings.png'), fullPage: true });
  step('2. Settings: opens, says this is a test site, link unticked, saves');

  // A page with the block and the shortcodes, made as a draft.
  const nonce = (await (await admin.request.get(`${BASE}/wp-admin/admin-ajax.php?action=rest-nonce`)).text()).trim();
  const content = [
    '<!-- wp:cbmarkets/converter /-->',
    '<!-- wp:shortcode -->\n[cbmarkets_rates base="USD" currencies="EUR,GBP,JPY,INR"]\n<!-- /wp:shortcode -->',
    '<!-- wp:paragraph -->\n<p>Today [cbmarkets_rate from="GBP" to="USD"] and gold is [cbmarkets_gold country="IN"].</p>\n<!-- /wp:paragraph -->',
    '<!-- wp:shortcode -->\n[cbmarkets_converter show="gold" weight="10" unit="tola" purity="22k" gold_currency="INR" theme="dark"]\n<!-- /wp:shortcode -->',
  ].join('\n\n');
  const made = await admin.request.post(`${BASE}/wp-json/wp/v2/pages`, { headers: { 'X-WP-Nonce': nonce }, data: { title: 'Currency converter', status: 'draft', content } });
  assert.equal(made.status(), 201, await made.text());
  const post = await made.json();

  // 3. The block in the editor.
  scriptErrors.length = 0;
  await page.goto(`${BASE}/wp-admin/post.php?post=${post.id}&action=edit`);
  await page.waitForFunction(() => window.wp?.data?.select('core/block-editor')?.getBlocks().length > 0, null, { timeout: 60_000 });
  await page.evaluate(() => {
    window.wp.data.dispatch('core/preferences').set('core/edit-post', 'welcomeGuide', false);
    window.wp.data.dispatch('core/preferences').set('core', 'enableChoosePatternModal', false);
  });
  await page.keyboard.press('Escape');
  const block = await page.evaluate(() => {
    const type = window.wp.blocks.getBlockType('cbmarkets/converter');
    const first = window.wp.data.select('core/block-editor').getBlocks()[0];
    return { title: type?.title, category: type?.category, description: type?.description, name: first.name, valid: first.isValid, id: first.clientId, attributes: first.attributes };
  });
  assert.equal(block.title, 'Currency and Gold Converter');
  assert.equal(block.category, 'widgets');
  assert.deepEqual([block.name, block.valid], ['cbmarkets/converter', true]);
  assert.equal(block.attributes.show, 'both');
  // The editor's canvas is a frame in some versions and the page itself in others.
  const frame = page.frames().find((f) => f.name() === 'editor-canvas') ?? page.mainFrame();
  const canvas = (await frame.locator('[data-type="cbmarkets/converter"]').count()) ? frame : page.mainFrame();
  const preview = canvas.locator('[data-type="cbmarkets/converter"]');
  await preview.locator('.cbmarkets-converter').waitFor({ timeout: 60_000 });
  assert.match(await preview.locator('.cbmarkets-status').innerText(), /^Sample rates of .*Live rates load/);
  assert.equal(await preview.locator('[role="tablist"]').count(), 1);
  assert.equal(await preview.locator('.cbmarkets-converter').evaluate((el) => getComputedStyle(el).borderRadius), '14px', 'the stylesheet is loaded in the editor');
  // Its settings in the side panel change the preview.
  await page.evaluate((id) => window.wp.data.dispatch('core/block-editor').selectBlock(id), block.id);
  await page.evaluate(() => window.wp.data.dispatch('core/edit-post').openGeneralSidebar('edit-post/block'));
  const show = page.getByLabel('Show', { exact: true });
  await show.waitFor({ timeout: 30_000 });
  await show.selectOption('gold');
  await preview.locator('.cbmarkets-converter:not(:has([role="tablist"]))').waitFor({ timeout: 60_000 });
  assert.equal(await preview.locator('[data-cbmarkets-panel="currency"]').count(), 0);
  await page.getByRole('button', { name: /Gold: what it opens with/ }).click();
  await page.getByLabel('Currency (a code, such as INR)').fill('inr');
  await page.getByLabel('Purity', { exact: true }).selectOption('22k');
  await preview.locator('.cbmarkets-lead:has-text("22K")').waitFor({ timeout: 60_000 });
  assert.match(await preview.locator('[data-cbmarkets="gold-value"]').innerText(), / INR$/);
  await page.getByLabel('Colours', { exact: true }).selectOption('dark');
  await preview.locator('.cbmarkets-theme-dark').waitFor({ timeout: 60_000 });
  assert.deepEqual(await page.evaluate((id) => {
    const a = window.wp.data.select('core/block-editor').getBlock(id).attributes;
    return [a.show, a.goldCurrency, a.purity, a.theme];
  }, block.id), ['gold', 'INR', '22k', 'dark']);
  await page.screenshot({ path: path.join(SHOTS, 'editor.png') });
  // Back to the block as it was, saved from the editor itself.
  await page.evaluate((id) => window.wp.data.dispatch('core/block-editor').updateBlockAttributes(id, { show: 'both', goldCurrency: 'USD', purity: '24k', theme: '' }), block.id);
  await preview.locator('.cbmarkets-converter [role="tablist"]').waitFor({ timeout: 60_000 });
  await page.evaluate(() => window.wp.data.dispatch('core/editor').editPost({ status: 'publish' }));
  await page.evaluate(() => window.wp.data.dispatch('core/editor').savePost());
  await page.waitForFunction(() => !window.wp.data.select('core/editor').isSavingPost() && window.wp.data.select('core/editor').getCurrentPost().status === 'publish', null, { timeout: 60_000 });
  const saved = await page.evaluate(() => window.wp.data.select('core/editor').getCurrentPost().content);
  assert.match(saved, /<!-- wp:cbmarkets\/converter \/-->/, 'the block saves as the block alone');
  await noPhpErrors(page, 'the editor');
  const editorErrors = scriptErrors.filter((e) => /cbmarkets|crystal-ball/i.test(e));
  assert.deepEqual(editorErrors, [], 'a script error from the plugin in the editor');
  step('3. The block: found in the editor, previews with sample rates, its settings change the preview, publishes');

  // 4 and 5. The published page, as a visitor who is not signed in.
  const visitorContext = await browser.newContext({ viewport: { width: 1100, height: 1400 }, locale: 'en-US', timezoneId: 'UTC' });
  const visitor = await visitorContext.newPage();
  const visitorProblems = [];
  visitor.on('pageerror', (e) => visitorProblems.push(String(e)));
  visitor.on('console', (m) => { if (m.type() === 'error') visitorProblems.push(m.text()); });
  // WordPress's own emoji script works from a blob of this same site: that is no other site.
  visitor.on('request', (r) => { if (!r.url().startsWith(BASE) && !r.url().startsWith(`blob:${BASE}`) && !r.url().startsWith('data:')) visitorProblems.push(`asked for ${r.url()}`); });
  const link = (await (await admin.request.get(`${BASE}/wp-json/wp/v2/pages/${post.id}`, { headers: { 'X-WP-Nonce': nonce } })).json()).link;
  await visitor.goto(link);
  await noPhpErrors(visitor, 'the published page');
  await visitor.waitForSelector('.wp-block-cbmarkets-converter .cbmarkets-is-ready');
  const box = visitor.locator('.wp-block-cbmarkets-converter');
  const part = (name) => box.locator(`[data-cbmarkets="${name}"]`);
  assert.match(await part('status').innerText(), /^Sample rates of .*\. Live rates load on a public site\.$/);
  await part('amount').fill('250');
  await part('from').selectOption('GBP');
  await part('to').selectOption('NGN');
  assert.equal(await part('currency-from').innerText(), '250 GBP =');
  assert.equal(await part('currency-value').innerText(), `${money((250 / RATES.GBP.rate) * RATES.NGN.rate)} NGN`);
  await part('swap').click();
  assert.equal(await part('currency-from').innerText(), '250 NGN =');
  assert.equal(await part('currency-value').innerText(), `${money((250 / RATES.NGN.rate) * RATES.GBP.rate)} GBP`);
  await box.locator('[data-cbmarkets-tab="gold"]').click();
  await part('unit').selectOption('tola');
  await part('purity').selectOption('k22');
  assert.equal(await part('gold-from').innerText(), '10 tolas of 22K gold =');
  assert.equal(await part('gold-value').innerText(), `${money(((10 * 11.6638038) / 31.1034768) * 0.916 * SPOT)} USD`);
  await box.locator('[data-cbmarkets-tab="currency"]').click();
  await part('pin').click();
  await visitor.reload();
  await visitor.waitForSelector('.wp-block-cbmarkets-converter .cbmarkets-is-ready');
  assert.equal(await part('pin-list').locator('li').count(), 1, 'the pinned pair is still there after a reload');
  // The shortcodes.
  assert.equal(await visitor.locator('.cbmarkets-card .cbmarkets-table tbody tr').count(), 4);
  const sentence = await visitor.locator('p:has(.cbmarkets-figure)').first().innerText();
  assert.match(sentence, /^Today 1 GBP = [\d.]+ USD \(sample of [^)]+\) and gold is [\d,.]+ INR per 10 grams \(24K\) \(sample of [^)]+\)/);
  const dark = visitor.locator('.cbmarkets-converter.cbmarkets-theme-dark');
  assert.equal(await dark.locator('[role="tablist"]').count(), 0);
  assert.equal(await dark.locator('[data-cbmarkets="gold-from"]').innerText(), '10 tolas of 22K gold =');
  assert.equal(await visitor.locator('a[href*="crystalballmarkets.com"]').count(), 0, 'no link to Crystal Ball Markets unless it is turned on');
  // The stylesheet is in the head, once; the scripts are deferred.
  assert.equal(await visitor.locator('head link#cbmarkets-rates-css').count(), 1);
  assert.equal(await visitor.locator('script[src*="crystal-ball-markets-rates/assets/"]').count(), 2);
  assert.deepEqual(visitorProblems, []);
  const lookOf = (p) => p.evaluate(() => {
    const el = (sel) => document.querySelector(sel);
    const box = (sel) => { const r = el(sel).getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; };
    const style = (sel, prop) => getComputedStyle(el(sel))[prop];
    const card = '.wp-block-cbmarkets-converter .cbmarkets-converter';
    return {
      card: box(card)[0], input: box(`${card} .cbmarkets-input`), select: box(`${card} .cbmarkets-select`)[1], tab: box(`${card} .cbmarkets-tab`)[1],
      font: style(card, 'fontSize'), big: style(`${card} .cbmarkets-big output`, 'fontSize'), bg: style(card, 'backgroundColor'), field: style(`${card} .cbmarkets-input`, 'backgroundColor'),
      tabOn: style(`${card} .cbmarkets-tab[aria-selected="true"]`, 'backgroundColor'), tabCase: style(`${card} .cbmarkets-tab`, 'textTransform'),
      cell: style('.cbmarkets-card .cbmarkets-table td', 'textAlign'), cellBorder: style('.cbmarkets-card .cbmarkets-table td', 'borderTopWidth'),
      // Every card on the page: the block's, the table's and the second converter's.
      widths: [...document.querySelectorAll('.cbmarkets-converter, .cbmarkets-card')].map((card) => Math.round(card.getBoundingClientRect().width)),
    };
  });
  const lookBlockTheme = await lookOf(visitor);
  assert.deepEqual(lookBlockTheme.widths, [400, 400, 400], 'every card keeps its own width');
  await visitor.screenshot({ path: path.join(SHOTS, 'page-block-theme.png'), fullPage: true });
  step('4. The shortcodes: a table, figures inside a sentence and a second converter all show');
  step('5. The published page: the converter works, a pin survives a reload, sample rates are marked, no link, nothing asked of another site');

  // 6. The link, turned on.
  await page.goto(`${BASE}/wp-admin/options-general.php?page=cbmarkets-rates`);
  await page.check('#cbmarkets-rates-credit');
  await Promise.all([page.waitForLoadState('load'), page.click('#submit')]);
  await page.waitForSelector('text=Settings saved.');
  assert.equal(await page.isChecked('#cbmarkets-rates-credit'), true);
  await visitor.reload();
  await visitor.waitForSelector('.wp-block-cbmarkets-converter .cbmarkets-is-ready');
  const credits = visitor.locator('a[href="https://crystalballmarkets.com/markets"]');
  assert.equal(await credits.count(), 3, 'one under each converter and one under the table');
  for (let i = 0; i < 3; i++) {
    assert.equal(await credits.nth(i).innerText(), 'Rates by Crystal Ball Markets');
    assert.equal(await credits.nth(i).getAttribute('rel'), null);
    assert.ok(await credits.nth(i).isVisible());
  }
  assert.equal(await box.locator('.cbmarkets-credit a').count(), 1);
  assert.equal(await visitor.locator('.cbmarkets-card .cbmarkets-credit a').count(), 1);
  await noPhpErrors(visitor, 'the page with the link on');
  step('6. The link: appears once under each converter and under the table when turned on, with no rel');

  // 7. Another theme, a classic one.
  if (WP_PATH) {
    assert.equal(php("switch_theme('twentytwentyone'); echo get_stylesheet();"), 'twentytwentyone');
    await visitor.reload();
    await visitor.waitForSelector('.wp-block-cbmarkets-converter .cbmarkets-is-ready');
    await noPhpErrors(visitor, 'the page in the classic theme');
    const lookClassic = await lookOf(visitor);
    await visitor.screenshot({ path: path.join(SHOTS, 'page-classic-theme.png'), fullPage: true });
    assert.deepEqual(lookClassic, lookBlockTheme, 'the card changed with the theme');
    assert.equal(await visitor.locator('a[href="https://crystalballmarkets.com/markets"]').count(), 3);
    assert.deepEqual(visitorProblems, []);
    step('7. Another theme (Twenty Twenty-One, classic): the card measures the same as in Twenty Twenty-Five');
  }

  // Beyond the list: a public site reading the rates service (a stand-in answers in its place), then being refused.
  if (WP_PATH) {
    const mu = path.join(WP_PATH, 'wp-content/mu-plugins');
    fs.mkdirSync(mu, { recursive: true });
    const stand = (refuse) => `<?php
// Test only: makes this site count as a public one, and answers in place of the rates service.
add_filter( 'cbmarkets_rates_is_test_site', '__return_false' );
add_filter( 'pre_http_request', function ( $pre, $args, $url ) {
	if ( 0 !== strpos( $url, 'https://crystalballmarkets.com/markets/api/v1/' ) ) {
		return $pre;
	}
	$GLOBALS['cbm_seen'] = $url;
	file_put_contents( WP_CONTENT_DIR . '/cbm-requests.log', $url . ' | ' . wp_json_encode( $args['headers'] ) . "\\n", FILE_APPEND );
	${refuse
    ? "return array( 'response' => array( 'code' => 403, 'message' => 'Forbidden' ), 'body' => wp_json_encode( array( 'error' => 'attribution missing', 'message' => 'localhost does not show the link <b>Rates by Crystal Ball Markets</b>.' ) ), 'headers' => array(), 'cookies' => array() );"
    : "$packed = json_decode( file_get_contents( WP_PLUGIN_DIR . '/crystal-ball-markets-rates/data/snapshot.json' ), true ); return array( 'response' => array( 'code' => 200, 'message' => 'OK' ), 'body' => wp_json_encode( false !== strpos( $url, 'rates.json' ) ? $packed['rates'] : $packed['gold'] ), 'headers' => array(), 'cookies' => array() );"}
}, 10, 3 );
`;
    const log = path.join(WP_PATH, 'wp-content/cbm-requests.log');
    fs.rmSync(log, { force: true });
    fs.writeFileSync(path.join(mu, 'cbm-stand-in.php'), stand(false));
    await visitor.reload();
    await visitor.waitForSelector('.wp-block-cbmarkets-converter .cbmarkets-is-ready');
    await noPhpErrors(visitor, 'the page reading the service');
    assert.match(await part('status').innerText(), /^Rates updated /);
    assert.equal(await visitor.locator('.cbmarkets-sample').count(), 0);
    const asked = fs.readFileSync(log, 'utf8').trim().split('\n');
    assert.equal(asked.length, 2, 'one request for each file');
    for (const line of asked) {
      assert.ok(line.includes(`?site=${encodeURIComponent(link)}`), `the page is named: ${line}`);
      assert.match(line, /"X-Site-Key":"[A-Za-z0-9]{32}"/);
    }
    await visitor.reload();
    await visitor.waitForSelector('.wp-block-cbmarkets-converter .cbmarkets-is-ready');
    assert.equal(fs.readFileSync(log, 'utf8').trim().split('\n').length, 2, 'the next view asks for nothing: the files are kept');
    await page.goto(`${BASE}/wp-admin/options-general.php?page=cbmarkets-rates`);
    await noPhpErrors(page, 'the settings page of a public site');
    assert.equal(await page.inputValue('#cbmarkets-rates-page'), link, 'the page that shows the figures is the page named');
    assert.match(await page.locator('.wrap > p').first().innerText(), /^The plugin reads the current rates/);
    // The service refuses the site (no link found): the figures stop, and the administrator is told why.
    fs.writeFileSync(path.join(mu, 'cbm-stand-in.php'), stand(true));
    php("foreach ( array( 'fresh_rates', 'fresh_gold' ) as $t ) { delete_transient( 'cbmarkets_rates_' . $t ); } echo 'cleared';");
    await visitor.reload();
    await noPhpErrors(visitor, 'the page of a refused site');
    assert.equal(await visitor.locator('.cbmarkets-converter.cbmarkets-is-empty').count(), 2);
    assert.match(await visitor.locator('.cbmarkets-empty').first().innerText(), /The rates are unavailable right now\./);
    assert.equal(await visitor.locator('.cbmarkets-admin-hint').count(), 0, 'a visitor is not told the reason');
    assert.equal(await visitor.locator('.cbmarkets-table').count(), 0);
    await page.goto(link);
    assert.match(await page.locator('.cbmarkets-admin-hint').first().innerText(), /only administrators see this.*localhost does not show the link Rates by Crystal Ball Markets\./);
    await page.goto(`${BASE}/wp-admin/options-general.php?page=cbmarkets-rates`);
    assert.match(await page.locator('.notice-error.inline').innerText(), /The rates service is refusing this site.*localhost does not show the link Rates by Crystal Ball Markets\./);
    await page.screenshot({ path: path.join(SHOTS, 'settings-refused.png'), fullPage: true });
    fs.rmSync(path.join(mu, 'cbm-stand-in.php'));
    fs.rmSync(log, { force: true });
    php("foreach ( array( 'fresh_rates', 'fresh_gold', 'kept_rates', 'kept_gold', 'wait_rates', 'wait_gold', 'service_note' ) as $t ) { delete_transient( 'cbmarkets_rates_' . $t ); } echo 'cleared';");
    step('+  A public site (a stand-in for the service): current rates, the page named with the key, files kept, and a refusal shown to the administrator only');
  }

  // 8. Plugin Check.
  if (WP_PATH) {
    php("require_once ABSPATH . 'wp-admin/includes/plugin.php'; $r = activate_plugin( 'plugin-check/plugin.php' ); echo is_wp_error( $r ) ? $r->get_error_message() : 'active';");
    await page.goto(`${BASE}/wp-admin/tools.php?page=plugin-check`);
    await noPhpErrors(page, 'Plugin Check');
    await page.selectOption('#plugin-check__plugins-dropdown', { label: 'Crystal Ball Markets Rates' });
    const boxes = page.locator('input[type="checkbox"][name="categories"], #plugin-check__categories input[type="checkbox"], input[type="checkbox"][id^="plugin-check__type"], input[type="checkbox"][name="types"]');
    for (let i = 0; i < await boxes.count(); i++) await boxes.nth(i).check();
    const ticked = await page.locator('input[type="checkbox"]:checked').evaluateAll((els) => els.map((e) => e.value || e.id));
    console.log(`    Plugin Check, ticked: ${ticked.join(', ')}`);
    await page.click('#plugin-check__submit');
    await page.waitForFunction(() => /Checks complete|No errors found|Errors were found|warnings? were found/i.test(document.querySelector('#plugin-check__results, .plugin-check__results, #wpbody-content')?.innerText ?? ''), null, { timeout: 600_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOTS, 'plugin-check.png'), fullPage: true });
    const report = await page.evaluate(() => {
      const root = document.querySelector('#plugin-check__results') ?? document.querySelector('#wpbody-content');
      const rows = [];
      for (const table of root.querySelectorAll('table')) {
        const file = table.previousElementSibling?.innerText?.trim() ?? '';
        for (const tr of table.querySelectorAll('tbody tr')) rows.push({ file, cells: [...tr.querySelectorAll('td')].map((td) => td.innerText.trim()) });
      }
      return { text: root.innerText.trim().slice(0, 600), rows };
    });
    fs.writeFileSync(path.join(SHOTS, 'plugin-check.json'), JSON.stringify(report, null, 2));
    const errors = report.rows.filter((r) => r.cells.some((c) => /^ERROR$/i.test(c)));
    const warnings = report.rows.filter((r) => r.cells.some((c) => /^WARNING$/i.test(c)));
    console.log(`    Plugin Check: ${errors.length} errors, ${warnings.length} warnings`);
    for (const r of [...errors, ...warnings]) console.log(`      ${r.file} | ${r.cells.join(' | ')}`);
    assert.equal(errors.length, 0, 'Plugin Check found errors');
    step(`8. Plugin Check: no errors (${warnings.length} warnings)`);
  }

  // 9. The log.
  if (WP_PATH) {
    const logFile = path.join(WP_PATH, 'wp-content/debug.log');
    const lines = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean) : [];
    const ours = lines.filter((l) => /crystal-ball-markets-rates|cbmarkets/i.test(l));
    console.log(`    debug.log: ${lines.length} lines, ${ours.length} from this plugin`);
    for (const l of ours.slice(0, 20)) console.log(`      ${l.slice(0, 300)}`);
    assert.equal(ours.length, 0, 'the plugin wrote to the debug log');
    step('9. The log: nothing from the plugin');
  }

  // 10. Deactivate and delete.
  await page.goto(`${BASE}/wp-admin/plugins.php`);
  const ours = page.locator(`tr[data-slug="${SLUG}"]`);
  await Promise.all([page.waitForLoadState('load'), ours.locator('.row-actions a:has-text("Deactivate")').click()]);
  await page.waitForSelector('text=Plugin deactivated.');
  await noPhpErrors(page, 'deactivating');
  await page.locator(`tr[data-slug="${SLUG}"] .row-actions a:has-text("Delete")`).click();
  await page.waitForSelector(`tr[data-slug="${SLUG}"]`, { state: 'detached', timeout: 60_000 }).catch(() => {});
  await page.goto(`${BASE}/wp-admin/plugins.php`);
  assert.equal(await page.locator(`tr[data-slug="${SLUG}"]`).count(), 0, 'the plugin is gone from the list');
  await noPhpErrors(page, 'deleting');
  if (WP_PATH) {
    assert.equal(fs.existsSync(path.join(WP_PATH, 'wp-content/plugins', SLUG)), false, 'its folder is gone');
    assert.equal(php("global $wpdb; echo (int) $wpdb->get_var( \"SELECT COUNT(*) FROM $wpdb->options WHERE option_name LIKE '%cbmarkets%'\" );"), '0', 'nothing of the plugin is left in the options table');
  }
  // The page it was on still opens, with the shortcodes shown as plain text and no error.
  await visitor.goto(link);
  await noPhpErrors(visitor, 'the page after the plugin is deleted');
  step('10. Deactivate and delete: no error, its option and kept rates are removed');

  await browser.close();
  console.log(`\nAll ${done.length} steps passed on ${version}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
