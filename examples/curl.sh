#!/bin/sh
# Calls from a server or the command line must name the page of your own site
# that shows the figures (site) and send your own secret (16+ characters).
SITE='https://your-site.com/rates'
KEY="${CBM_SITE_KEY:?set CBM_SITE_KEY to a secret of 16+ characters}"
API='https://crystalballmarkets.com/markets/api/v1'

# Euros per 1 US dollar
curl -s -H "X-Site-Key: $KEY" "$API/rates.json?site=$SITE" | jq '.data.rates.EUR.rate'

# Gold price in India, in rupees
curl -s -H "X-Site-Key: $KEY" "$API/gold.json?site=$SITE" | jq '.data.countries[] | select(.country == "IN")'

# Live gold quote
curl -s -H "X-Site-Key: $KEY" "$API/quotes.json?site=$SITE" | jq '.data[] | select(.ticker == "XAUUSD")'
