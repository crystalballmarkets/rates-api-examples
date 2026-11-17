# Chrome Web Store listing

Copy these into the Chrome Web Store developer dashboard.

## Store listing

**Name:** Gold Price & Currency Converter by Crystal Ball Markets

**Summary (132 characters max):**
Live gold price in 69 countries, a currency converter for 173 pairs and live forex, metals, oil and crypto prices. Free, no sign-up.

**Category:** Tools

**Language:** English

**Description:**

Check the gold price, convert currencies and follow the markets from your browser toolbar, without opening a new tab.

GOLD PRICE IN 69 COUNTRIES
See today's gold price in local money and the local unit: per 10 grams in India, per gram in the UAE and Saudi Arabia, per tola in Pakistan, and so on. It covers 24K, 22K and 18K gold.

CURRENCY CONVERTER, 173 PAIRS
Convert between the US dollar, euro, pound and 60 currencies, including the naira, cedi, shilling, rand, rupee, dirham, riyal and peso. Rates come from our own forex quotes, official pegs, the European Central Bank and national central banks.

LIVE MARKETS
Follow gold, silver, platinum, EUR/USD, GBP/USD, USD/JPY, crude oil, natural gas, the Dow and bitcoin, with the day's change. A table view shows all the major markets at once.

· Free, with no account and no sign-up
· Shows in your browser's language (38 languages) and follows its light or dark theme
· Remembers the country, pair and market you last chose
· Collects no data: no tracking, no analytics, no account

Prices are indicative and for information only. They are not an offer to buy or sell.

More prices, charts and free tools: https://crystalballmarkets.com/markets

**Website:** https://crystalballmarkets.com/markets
**Support email:** support@crystalballmarkets.com

## Graphics

* Icon: `icons/icon128.png`
* Screenshots (1280x800): `screenshot-gold`, `screenshot-convert`, `screenshot-quote` and `screenshot-table`
* Small promo tile (440x280): `promo-small-440x280.png`

## Privacy practices

**Single purpose:** Show live gold prices, currency conversions and market prices from Crystal Ball Markets in a toolbar pop-up.

**declarativeNetRequest justification:** The pop-up shows Crystal Ball Markets' own price widgets in frames. Those widget pages allow framing on any website, but browsers treat extension pages separately. One static rule adds `chrome-extension:` to the widget pages' `frame-ancestors` policy, and nothing else. It only applies to frames loading https://crystalballmarkets.com/markets/widget/.

**Host permission justification:** The rule above needs access to https://crystalballmarkets.com/markets/widget/* only. The extension does not read or change any other site.

**Remote code:** No. All scripts are packaged with the extension. The widgets are web pages shown in frames.

**Data usage:** The extension collects no user data. Tick none of the data types, then certify the three statements (no selling, no unrelated use, no creditworthiness use).

**Privacy policy URL:** https://crystalballmarkets.com/about-us#legal
