=== Crystal Ball Markets Rates ===
Contributors: crystalballmarkets
Tags: currency converter, exchange rates, gold price, currency, calculator
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 2.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A currency converter and gold value calculator for your pages, with exchange rates and gold prices as shortcodes.

== Description ==

Crystal Ball Markets Rates adds a currency converter and a gold value calculator to any page, post or widget area, and four small shortcodes for figures inside your own text.

= The converter =

* **Currency.** A visitor types an amount and chooses two of about 60 currencies. The result appears as they type, with the rate in both directions, where each rate comes from and its time. They can swap the pair, copy the result and pin up to four pairs.
* **Gold.** A weight in grams, troy ounces, tolas, pavans, baht, taels or kilograms, a purity from 24K to 14K and a currency. It shows what the gold in that weight is worth at the international price, and the price of one gram at 24K, 22K and 18K.
* Light colours, dark colours, or the visitor's own setting. It keeps its own look inside any theme.
* Every sum is worked out on your site and in the visitor's browser. The visitor's browser asks no other site for anything.

Add it with the block "Currency and Gold Converter", or with a shortcode:

* `[cbmarkets_converter]` shows both, in two tabs.
* `[cbmarkets_converter show="currency" from="GBP" to="NGN" amount="100"]` shows the currency converter alone, opening on a pair and an amount of your choice.
* `[cbmarkets_converter show="gold" weight="10" unit="tola" purity="22k" gold_currency="INR"]` shows the gold calculator alone.

= Figures inside your own text =

* `[cbmarkets_rate from="USD" to="EUR"]` shows one exchange rate.
* `[cbmarkets_convert amount="100" from="GBP" to="NGN"]` shows a converted amount.
* `[cbmarkets_rates base="USD" currencies="EUR,GBP,JPY,INR"]` shows a table of rates.
* `[cbmarkets_gold country="IN"]` shows the gold price in a country, in its own money and unit of weight.
* `[cbmarkets_gold weight="10" unit="gram" purity="22k" currency="INR"]` shows what a weight of gold is worth.

= Where the figures come from =

The plugin reads exchange rates and the gold price from the Crystal Ball Markets Rates API, a free service with no sign-up, and keeps them for five minutes. The figures are indicative, for information only. They are not dealing prices and not an offer to buy or sell. See "External services" below for exactly what the plugin sends.

= The link to Crystal Ball Markets is your choice =

The plugin adds no link and no credit to your pages unless you turn it on, under Settings > Crystal Ball Markets Rates. It is off when you install the plugin.

The rates service has terms of its own. They ask each site that shows its figures to carry a visible link, "Rates by Crystal Ball Markets", on the page that shows them. You can tick the box and the plugin adds the link under the figures, or you can place the link on the page yourself. The service checks that page. A site that shows the figures without the link is refused by the service a day after the check, and the figures stop showing until the link is there. The settings page tells you when that happens and why.

= Try it before you publish =

On a local or test site, in the editor and in previews, the plugin shows sample rates packed with it, marked as sample rates with their date, and asks the service for nothing. Current rates load once a page with the figures is published on a public site.

== External services ==

This plugin relies on the Crystal Ball Markets Rates API, a service of Crystal Ball Markets, for exchange rates and the gold price. Without the service the plugin can show only the sample rates packed with it.

* **What it reads.** Two files, `rates.json` and `gold.json`, from `https://crystalballmarkets.com/markets/api/v1/`.
* **When.** When a published page that shows the figures is opened and the copy your site holds is older than five minutes. Your server makes the request. A visitor's browser never does.
* **What is sent.** The address of one page of your site, which is the first published page that showed the figures (you can change it in the settings), and a random key that the plugin made for this installation. As with any request WordPress makes, the service also sees your server's IP address and the WordPress user agent, which names your site's address.
* **What is never sent.** Anything about your visitors: no IP address, no cookie, no amount or currency they choose.
* **When nothing is sent at all.** On activation, on a local or test site, in the editor, in previews and on pages that do not use the plugin.

The service is provided by Crystal Ball Markets: [terms of use](https://crystalballmarkets.com/markets/rates-api), [legal notices and privacy](https://crystalballmarkets.com/about-us#legal).

== Installation ==

1. Install the plugin from the Plugins screen, or upload its folder to `/wp-content/plugins/`.
2. Activate it.
3. Add the block "Currency and Gold Converter" to a page, or one of the shortcodes above, and publish the page.
4. Under Settings > Crystal Ball Markets Rates, choose the colours and decide about the link.

== Frequently Asked Questions ==

= Is it free? =

Yes. The plugin and the rates service are free of charge.

= Do I have to show a link to Crystal Ball Markets? =

The plugin does not require it and never adds it without your choice. The rates service does ask for it, as its terms explain, and stops serving a site that shows its figures without the link. You can let the plugin add the link (one box under Settings > Crystal Ball Markets Rates) or place it on the page yourself.

= Why does it say "Sample rates"? =

Because the site is a local or test site, or the page has not been published yet. The service is not asked for anything in those cases. Publish the page on a public site and open it: current rates load on that visit.

= The figures have stopped showing. Why? =

Open Settings > Crystal Ball Markets Rates. If the rates service is refusing the site, its message is shown there. The usual reason is that the page named to the service does not carry the link.

= What is kept about my visitors? =

Nothing on your site and nothing at the rates service. If a visitor presses Pin, that pair of currencies is kept in the visitor's own browser, so that it is there on their next visit.

= Does it work with page caching? =

Yes. The rates are written into the page, so a cached page shows the rates of the time it was cached, with that time under them.

= Will it slow my pages down? =

Your server reads two small files at most once in five minutes. Visitors load one stylesheet and two small scripts, and only on pages that use the plugin.

= Which currencies and countries does it cover? =

About 60 currencies, and the gold price in the money and the unit of weight of 69 countries. The lists come from the rates service.

= Are the prices dealing prices? =

No. They are indicative, for information only. The gold figures are the value of the gold itself at the international price: shop prices add local duty, tax and making charges.

== Screenshots ==

1. The currency converter: the result, the rate both ways and where each rate comes from.
2. The gold calculator: a weight, a unit, a purity and a currency.
3. The converter in dark colours, with pinned pairs.
4. A table of rates, and figures inside a sentence.

== Changelog ==

= 2.0.0 =
* New: a currency converter and gold value calculator, as a block and as the shortcode `[cbmarkets_converter]`, in light or dark colours.
* New: `[cbmarkets_gold]` can show what a weight of gold is worth.
* New: sample rates on local and test sites, in the editor and in previews, with nothing asked of the rates service.
* Changed: the shortcodes are now `[cbmarkets_rate]`, `[cbmarkets_convert]`, `[cbmarkets_rates]` and `[cbmarkets_gold]`, and every name in the code carries the plugin's own prefix.
* Changed: the figures show whether or not the link is turned on. The link stays off until you turn it on.
* Changed: the plugin names the page that shows the figures to the rates service, in place of the home page.
* Changed: when the service cannot be read, the last rates are shown with their time for up to a day.

= 1.0.0 =
* First version.

== Upgrade Notice ==

= 2.0.0 =
The shortcodes have new names, all beginning with `cbmarkets`: `[cbmarkets_rate]`, `[cbmarkets_convert]`, `[cbmarkets_rates]` and `[cbmarkets_gold]`. Replace the old ones on your pages.
