=== Crystal Ball Markets Rates ===
Contributors: crystalballmarkets
Tags: exchange rates, currency converter, gold price, forex, currency
Requires at least: 5.8
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Free exchange rates, currency conversion and the gold price by country, as simple shortcodes.

== Description ==

Show live exchange rates for 60 currencies and the gold price in local money in 69 countries on any page or post. No sign-up and no API key to request: the plugin creates its own secret key when you activate it.

Shortcodes:

* `[cbm_rate from="USD" to="EUR"]` shows one exchange rate.
* `[cbm_convert amount="100" from="GBP" to="NGN"]` shows a converted amount.
* `[cbm_rates base="USD" currencies="EUR,GBP,JPY,INR"]` shows a table of rates.
* `[cbm_gold country="IN"]` shows the gold price in a country, in local money and the local unit.

The figures are refreshed every few minutes and are indicative, for information only.

= Credit link (opt-in) =

The free API asks for a visible "Rates by Crystal Ball Markets" link wherever its figures appear. The plugin never adds this link without your permission. The figures stay hidden until you tick the box under Settings > CBM Rates; once you do, the link appears under each shortcode.

== External services ==

This plugin connects to the Crystal Ball Markets Rates API to get exchange rates and gold prices.

* What is sent and when: when a page with a shortcode is viewed and the cached figures are older than five minutes, your site's home URL and the plugin's own random secret key are sent to https://crystalballmarkets.com/markets/api/v1/. No visitor data is sent.
* Provider: Crystal Ball Markets. Terms of use: https://crystalballmarkets.com/markets/rates-api. Legal and privacy: https://crystalballmarkets.com/about-us#legal

== Installation ==

1. Upload the plugin folder to `/wp-content/plugins/`, or install it from the Plugins screen.
2. Activate it.
3. Go to Settings > CBM Rates and tick the credit link box.
4. Add a shortcode to any page or post.

== Frequently Asked Questions ==

= Is it free? =

Yes. The API and the plugin are free.

= Why do I see nothing on my page? =

The figures are shown only after you turn on the credit link under Settings > CBM Rates. Administrators see a reminder in place of the figures until then.

= Are the prices dealing prices? =

No. They are indicative, for information only. They are not an offer to buy or sell.

== Changelog ==

= 1.0.0 =
* First release.
