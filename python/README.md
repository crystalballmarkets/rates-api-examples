# crystal-ball-markets

Exchange rates, currency conversion and the value of gold by weight, in Python: a client for the free [Crystal Ball Markets exchange rate and gold price API](https://crystalballmarkets.com/markets/rates-api), the sums behind it, and a command line. The API covers exchange rates for 60 currencies, the gold price in local money in 69 countries, and live quotes for forex, metals, energy, indices, shares and crypto. JSON, refreshed every minute, no sign-up.

```sh
pip install crystal-ball-markets
```

Python 3.8 or later. Standard library only, with type hints.

## The client

```python
import os
from crystal_ball_markets import Client, ATTRIBUTION_HTML

cbm = Client(
    site="https://your-site.com/rates",   # the page of your site that shows the figures
    key=os.environ["CBM_SITE_KEY"],       # a secret of your own, 16+ characters
)

cbm.rate("EUR")                           # euros per 1 US dollar
cbm.convert(100, "GBP", "NGN")            # 100 pounds in naira
cbm.gold_value(10, "tola", "22k", "INR")  # ten tolas of 22 karat gold in rupees
cbm.gold_price("IN")                      # the gold price in India, in its own money and unit
cbm.quote("XAUUSD")                       # a live quote
```

The first call reserves your site for your key. Responses are cached for at least 60 seconds.

| Method | Returns |
| --- | --- |
| `rates()`, `gold()`, `quotes()` | the three files, in full |
| `rate(code)` | units of `code` per 1 USD |
| `convert(amount, from_code, to_code)` | `amount` converted through USD |
| `gold_value(weight, unit, purity, currency)` | what a weight of gold is worth |
| `gold_price(country)` | the gold entry for an ISO country code |
| `quote(ticker)` | one market's quote, e.g. `EURUSD` |

Gold is weighed in `gram`, `ounce` (troy), `tola`, `pavan`, `baht`, `tael` or `kilogram`, at `24k`, `22k`, `21k`, `18k` or `14k`. The figure is the value of the gold itself at the international price: shop prices add local duty, tax and making charges.

## The sums

For when the rates are already on hand. No network.

```python
from crystal_ball_markets import convert, gold_value, parse_amount, format_money, unit_grams, purity_fineness

rates = cbm.rates()["data"]["rates"]      # units of each currency for one US dollar

convert(100, "GBP", "NGN", rates)         # None when a rate is missing
gold_value(10, unit_grams("tola"), purity_fineness("22k"), usd_per_ounce, rates["INR"]["rate"])
parse_amount("1.234,56")                  # 1234.56: reads the ways people write numbers
format_money(0.1406, "GBP")               # '0.141 GBP': enough decimals for a small amount
```

## The command line

```sh
export CBM_SITE=https://your-site.com/rates
export CBM_SITE_KEY=...                   # your own secret, 16+ characters

cbm-rates rate EUR                        # 1 USD = 0.910481 EUR
cbm-rates convert 100 GBP NGN
cbm-rates gold 10 tola 22k INR
cbm-rates gold-price IN
cbm-rates quote XAUUSD
cbm-rates --json convert 100 GBP NGN      # the same, as JSON
```

`python -m crystal_ball_markets` does the same.

## Terms in short

Wherever the figures appear, show this link. It must be visible and unchanged, with no `nofollow`, `ugc` or `sponsored`. It is also available as `ATTRIBUTION_HTML`:

```html
<a href="https://crystalballmarkets.com/markets">Rates by Crystal Ball Markets</a>
```

The named site must be on a domain of your own. Each address allows up to 60 requests a minute. The figures are indicative and for information only: they are not dealing prices and not an offer to buy or sell. Full terms: <https://crystalballmarkets.com/markets/rates-api>.

## From version 1

Nothing was removed. Version 2 adds `gold_value()`, the sums and the command line. `rate("USD")` now answers 1.0.

The client is MIT licensed. Questions: support@crystalballmarkets.com.
