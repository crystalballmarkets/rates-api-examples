# Free exchange rate and gold price API: code examples

Clients and examples for the free [Crystal Ball Markets Rates API](https://crystalballmarkets.com/markets/rates-api). The API serves three JSON files, each refreshed every minute, with no sign-up:

| File | What it holds |
| --- | --- |
| [`rates.json`](https://crystalballmarkets.com/markets/api/v1/rates.json) | exchange rates for 60 currencies against the US dollar, with the source of each rate |
| [`gold.json`](https://crystalballmarkets.com/markets/api/v1/gold.json) | the gold price in local money and the local unit in 69 countries, plus the price per gram of 24 karat gold |
| [`quotes.json`](https://crystalballmarkets.com/markets/api/v1/quotes.json) | live quotes for forex, metals, energy, agriculture, indices, shares and crypto |

There is also an [OpenAPI 3.1 description](https://crystalballmarkets.com/markets/api/openapi.json).

## What's in this repository

| Folder | Contents |
| --- | --- |
| [`javascript/`](javascript) | `crystal-ball-markets` client for browsers and Node 18+, with TypeScript types |
| [`python/`](python) | `crystal-ball-markets` client for Python 3.8+, standard library only |
| [`wordpress/`](wordpress/crystal-ball-markets-rates) | WordPress plugin with `[cbm_rate]`, `[cbm_convert]`, `[cbm_rates]` and `[cbm_gold]` shortcodes |
| [`examples/`](examples) | a self-contained web page and curl calls |

## Quick start

From a web page, the browser names your site for you:

```js
const res = await fetch('https://crystalballmarkets.com/markets/api/v1/rates.json');
const { data } = await res.json();
console.log(data.rates.EUR.rate); // euros per 1 US dollar
```

From a server, an app or the command line, name the page of your site that shows the figures with `site`. Then send a secret of your own choosing (16 characters or more) in the `X-Site-Key` header:

```sh
curl -H 'X-Site-Key: <your own secret>' \
  'https://crystalballmarkets.com/markets/api/v1/gold.json?site=https://your-site.com/gold'
```

## Terms in short

* Wherever you display the figures, show this link, visible and unchanged, without `nofollow`, `ugc` or `sponsored`: `<a href="https://crystalballmarkets.com/markets">Rates by Crystal Ball Markets</a>`.
* The site you name must be on a domain of your own.
* Each address allows up to 60 requests a minute. Keep each response for at least 60 seconds.
* The figures are indicative, for information only. They are not dealing prices.

Read the [full terms](https://crystalballmarkets.com/markets/rates-api) before you use the API.

## More

* [Live markets, exchange rates and gold prices](https://crystalballmarkets.com/markets)
* [Worked guide in curl, JavaScript and Python](https://crystalballmarkets.com/markets/rates-api)
* Questions: support@crystalballmarkets.com

The code in this repository is MIT licensed, except the WordPress plugin, which is GPLv2 or later as WordPress requires.
