# crystal-ball-markets

Python client for the free [Crystal Ball Markets exchange rate and gold price API](https://crystalballmarkets.com/markets/rates-api). It covers exchange rates for 60 currencies against the US dollar, the gold price in local money in 69 countries, and live quotes for forex, metals, energy, indices, shares and crypto. The data is JSON, refreshed every minute, and there is no sign-up. The client uses only the standard library.

```sh
pip install crystal-ball-markets
```

```python
import os
from crystal_ball_markets import Client, ATTRIBUTION_HTML

cbm = Client(
    site="https://your-site.com/rates",   # the page of your site that shows the figures
    key=os.environ["CBM_SITE_KEY"],       # a secret of your own, 16+ characters
)

print(cbm.rate("EUR"))                    # euros per 1 US dollar
print(cbm.convert(100, "GBP", "NGN"))     # 100 pounds in naira
print(cbm.gold_price("IN"))               # gold price in India, in rupees
print(cbm.quote("XAUUSD"))                # live gold quote
```

The first call reserves your site for your key. Responses are cached for at least 60 seconds.

## Terms in short

Wherever the figures appear, show this link. It must be visible and unchanged, with no `nofollow`, `ugc` or `sponsored`. It is also available as `ATTRIBUTION_HTML`:

```html
<a href="https://crystalballmarkets.com/markets">Rates by Crystal Ball Markets</a>
```

The named site must be on a domain of your own. Each address allows up to 60 requests a minute. The figures are indicative and for information only. Full terms: <https://crystalballmarkets.com/markets/rates-api>.

The client is MIT licensed. Questions: support@crystalballmarkets.com.
