# Checking the plugin on a WordPress site

The checks in this folder run the plugin's code without WordPress. This list is the part only a real site can show. Ten minutes on a clean WordPress with debugging on; [WordPress Playground](https://playground.wordpress.net/) will do, and so will any local install.

On a local install, put this in `wp-config.php` first:

```php
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', true );
```

1. **Install and activate.** Plugins > Add New > Upload Plugin, choose `crystal-ball-markets-rates.zip`, activate. No error, no notice, nothing printed at the top of the screen.
2. **Settings.** Settings > Crystal Ball Markets Rates opens. On Playground or a local site its first paragraph says this is a local or test site. The link box is unticked. Save the form: “Settings saved”, no error.
3. **The block.** Create a page, add the block “Currency and Gold Converter”. The converter appears in the editor with sample rates. Change “Show”, the colours and the starting currencies in the side panel: the preview follows.
4. **The shortcodes.** In the same page add a Shortcode block with `[cbmarkets_rates base="USD" currencies="EUR,GBP,JPY,INR"]` and a paragraph with `Today [cbmarkets_rate from="GBP" to="USD"] and gold is [cbmarkets_gold country="IN"].`
5. **Publish and view the page.** The converter works: type an amount, change the currencies, swap, open the Gold tab, change the unit and the purity. Pin a pair, reload: the pair is still there. The line under the figures reads “Sample rates of …” on a test site. No link to Crystal Ball Markets anywhere on the page.
6. **Turn the link on** in the settings and reload the page: “Rates by Crystal Ball Markets” appears once under the converter and once under the table.
7. **Another theme.** Switch to a second theme (a classic one if the first was a block theme): the card looks the same.
8. **Plugin Check.** Install the plugin “Plugin Check” from the directory, open Tools > Plugin Check, choose Crystal Ball Markets Rates, tick every category and run it. No errors.
9. **The log.** `wp-content/debug.log` holds nothing from `crystal-ball-markets-rates`.
10. **Delete the plugin.** Deactivate, delete: no error.

On a public site only: the first visit to the published page reads current rates (“Rates updated …”), and the settings page then shows that page under “Page that shows the figures”.
