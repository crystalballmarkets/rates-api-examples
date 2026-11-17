# crystal-ball-markets

JavaScript client for the free [Crystal Ball Markets exchange rate and gold price API](https://crystalballmarkets.com/markets/rates-api): exchange rates for 60 currencies against the US dollar, the gold price in local money in 69 countries, and live quotes for forex, metals, energy, indices, shares and crypto. JSON, refreshed every minute, no sign-up.

```sh
npm install crystal-ball-markets
```

## In a web page

The browser names your site, so no options are needed.

```js
import { createClient, ATTRIBUTION_HTML } from 'crystal-ball-markets';

const cbm = createClient();
const eur = await cbm.getRate('EUR');                 // euros per 1 US dollar
const ngn = await cbm.convert(100, 'GBP', 'NGN');     // 100 pounds in naira
const gold = await cbm.getGoldPrice('IN');            // gold price in India, in rupees
document.querySelector('#credit').innerHTML = ATTRIBUTION_HTML;
```

## On a server, in an app or a script

Name the page of your own site that shows the figures and send a secret of your own (16+ characters). The first call reserves that site for your key.

```js
import { createClient } from 'crystal-ball-markets';

const cbm = createClient({
  site: 'https://your-site.com/rates',
  key: process.env.CBM_SITE_KEY,
});
console.log(await cbm.getQuote('XAUUSD'));
```

## Methods

| Method | Returns |
| --- | --- |
| `getRates()` | the full `rates.json` file |
| `getGold()` | the full `gold.json` file |
| `getQuotes()` | the full `quotes.json` file |
| `getRate(code)` | units of `code` per 1 USD |
| `convert(amount, from, to)` | `amount` converted through USD |
| `getGoldPrice(country)` | the gold entry for an ISO country code |
| `getQuote(ticker)` | one market's quote, e.g. `EURUSD` |

Responses are cached for at least 60 seconds, as the terms ask.

## Terms in short

Show this link, visible and unchanged, wherever the figures appear (no `nofollow`, `ugc` or `sponsored`):

```html
<a href="https://crystalballmarkets.com/markets">Rates by Crystal Ball Markets</a>
```

Up to 60 requests a minute per address. Figures are indicative and for information only. Full terms: <https://crystalballmarkets.com/markets/rates-api>.

MIT licence for this client. Questions: support@crystalballmarkets.com.
