# Currency and Gold Converter: Chrome extension

The source of our Chrome extension, version 2.0.0. A pop-up in the browser's toolbar that converts an amount between about 60 currencies and works out what a weight of gold is worth.

* **Currency**: type an amount and choose two currencies. The result appears as you type, with the rate in both directions, the source of each rate and its time. Swap the pair, copy the result, pin up to four pairs.
* **Gold**: a weight in grams, troy ounces, tolas, pavans, baht, taels or kilograms, a purity from 24K to 14K and a currency. It shows the value of the gold in that weight at the international price, and the price of one gram at 24K, 22K and 18K.

Install it from the [Chrome Web Store](https://chromewebstore.google.com/detail/currency-and-gold-convert/golkincnoejbeghbpibdfgmkcclpiapg). What it does, privacy and support: [crystalballmarkets.com/chrome-extension](https://crystalballmarkets.com/chrome-extension).

## How it is built

| File | What it holds |
| --- | --- |
| `manifest.json` | Manifest version 3. One permission, `storage`. No host permissions, no content or background scripts. |
| `core.js` | The sums and the reading of the rate files. No page and no browser APIs, so it can be tested as it is. |
| `popup.html`, `popup.css`, `popup.js` | The pop-up. Every sum is done here, in the package. |
| `snapshot.json` | Rates packed with the version, used only when the rate files cannot be read. They are shown with their date and the line “Could not update”. |
| `icons/` | The crystal ball mark on a transparent ground. |

The pop-up reads two files of the [Rates API](https://crystalballmarkets.com/markets/rates-api), [`rates.json`](https://crystalballmarkets.com/markets/api/v1/rates.json) and [`gold.json`](https://crystalballmarkets.com/markets/api/v1/gold.json), as data, and keeps them for five minutes in the browser's storage for the extension. Nothing fetched is run as code, and nothing you type or choose leaves the browser.

## Try it

1. Open `chrome://extensions` and switch on Developer mode.
2. Choose “Load unpacked” and pick this folder.
3. Click the crystal ball in the toolbar.

A copy loaded this way gets an id of its own from Chrome. The API asks every caller that is not a web page to name a site, so that copy shows the rates packed with it and says “Could not update”. The copy installed from the Chrome Web Store reads the rate files.

## Build your own on the API

An extension is not a web page, so its calls must name the page of your own site that shows our link, with `site`, and send a secret of your own choosing in `X-Site-Key`, as the [terms](https://crystalballmarkets.com/markets/rates-api) describe. Show this link wherever you display the figures: `<a href="https://crystalballmarkets.com/markets">Rates by Crystal Ball Markets</a>`.

MIT licensed, like the rest of this repository.
