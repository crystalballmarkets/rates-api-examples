# Crystal Ball Markets Rates: WordPress plugin

The source of our WordPress plugin, version 2.0.0: a currency converter and gold value calculator for any page, as a block and as shortcodes, with four small shortcodes for figures inside a sentence. It is built on [`rates.json`](https://crystalballmarkets.com/markets/api/v1/rates.json) and [`gold.json`](https://crystalballmarkets.com/markets/api/v1/gold.json) of the [Rates API](https://crystalballmarkets.com/markets/rates-api).

| Shortcode | Shows |
| --- | --- |
| `[cbmarkets_converter]` | the converter: currencies and gold in two tabs (`show="currency"` or `show="gold"` for one alone) |
| `[cbmarkets_rate from="USD" to="EUR"]` | one exchange rate |
| `[cbmarkets_convert amount="100" from="GBP" to="NGN"]` | a converted amount |
| `[cbmarkets_rates base="USD" currencies="EUR,GBP,JPY,INR"]` | a table of rates |
| `[cbmarkets_gold country="IN"]` | the gold price in a country, in its own money and unit |
| `[cbmarkets_gold weight="10" unit="gram" purity="22k" currency="INR"]` | what a weight of gold is worth |

The block is “Currency and Gold Converter”. What the plugin does, what it sends and the link it can add are set out in [`readme.txt`](crystal-ball-markets-rates/readme.txt), the page the WordPress.org directory shows.

## How it is built

| File | What it holds |
| --- | --- |
| `crystal-ball-markets-rates.php` | The plugin's header and its constants. |
| `includes/sums.php` | The sums: conversion, the value of a weight of gold, decimals. No WordPress calls. |
| `includes/data.php` | The settings and the reading of the two rate files: kept five minutes, the last copy for a day, the sample on a test site. |
| `includes/render.php` | The converter's markup, the block and the shortcodes. |
| `includes/settings.php` | The settings page. |
| `assets/core.js`, `assets/converter.js` | The same sums and the converter in the browser. No request leaves the page. |
| `assets/converter.css` | The look: one card, light or dark, every rule under a `cbmarkets-` class. |
| `assets/block/` | The block, written without a build step. |
| `data/snapshot.json` | Rates packed with the version: shown, dated and marked as a sample, on local and test sites, in the editor and in previews. |

Every function, constant, option, transient, hook, shortcode, script handle and style class carries the prefix `cbmarkets` (`cbmarkets_rates_` in PHP), as the directory’s guidelines ask.

Three choices worth knowing:

* **The link is the site owner's choice.** “Rates by Crystal Ball Markets” is off until it is turned on in the settings, and the figures show either way. The API's own terms still ask for the link on the page that shows the figures, and the API stops serving a site without it: the settings page says so in plain words and shows the API's message when that happens.
* **One page is named to the API.** The API checks one page of each site for the link, the page named in its first call. The plugin names the first published page that shows the figures (never the editor, a preview or a draft) and keeps naming it; the settings page shows it and lets the owner change it.
* **A test site asks for nothing.** On `localhost`, a `.test` or `.local` address, an IP address or WordPress Playground, the plugin shows the packed rates and makes no request, so anyone trying it sees a working converter.

## Check it

```sh
php wordpress/tests/run.php          # the plugin's own code against stand-ins for WordPress: names, sums, choices, output
node wordpress/tests/core.test.cjs   # the browser's sums
node wordpress/tests/page.cjs        # the real converter in Chromium: figures, buttons, pins, colours, a hostile theme, a phone
```

The first two need only PHP and Node. The third needs Playwright's Chromium. None of them is a WordPress site: before each release, install the zip on a clean WordPress with `WP_DEBUG` on (WordPress Playground will do) and go through the list in `tests/ON-A-SITE.md`.

## Pack it

```sh
sh wordpress/tools/pack.sh           # runs the checks, writes wordpress/dist/crystal-ball-markets-rates.zip
node wordpress/tests/page.cjs --shots   # the directory's four screenshots
node wordpress/tools/artwork.cjs        # its icon and banner
```

`.wordpress-org/` holds the pictures of the plugin's page in the directory (icon, banner, screenshots). They are not part of the zip: once the plugin is approved they go in the `assets` folder of its SVN repository.

GPLv2 or later, as WordPress requires.
