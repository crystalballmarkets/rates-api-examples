<?php
/**
 * Plugin Name:       Crystal Ball Markets Rates
 * Plugin URI:        https://crystalballmarkets.com/markets/rates-api
 * Description:       A currency converter and gold value calculator for your pages, with exchange rates, converted amounts and gold prices as shortcodes. Figures from the Crystal Ball Markets Rates API.
 * Version:           2.0.0
 * Requires at least: 6.3
 * Requires PHP:      7.4
 * Author:            Crystal Ball Markets
 * Author URI:        https://crystalballmarkets.com
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       crystal-ball-markets-rates
 *
 * @package CrystalBallMarketsRates
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CBMARKETS_RATES_VERSION', '2.0.0' );
define( 'CBMARKETS_RATES_FILE', __FILE__ );
define( 'CBMARKETS_RATES_DIR', plugin_dir_path( __FILE__ ) );
define( 'CBMARKETS_RATES_URL', plugin_dir_url( __FILE__ ) );

/** The rates service: two JSON files, read from the server and kept for five minutes. */
define( 'CBMARKETS_RATES_API', 'https://crystalballmarkets.com/markets/api/v1/' );
define( 'CBMARKETS_RATES_KEEP_SECONDS', 300 );

require_once CBMARKETS_RATES_DIR . 'includes/sums.php';
require_once CBMARKETS_RATES_DIR . 'includes/data.php';
require_once CBMARKETS_RATES_DIR . 'includes/render.php';
require_once CBMARKETS_RATES_DIR . 'includes/settings.php';

/**
 * On activation the plugin only makes its own random key. It asks the rates
 * service for nothing until a shortcode or the block is shown on a published page.
 */
function cbmarkets_rates_activate() {
	cbmarkets_rates_site_key();
}
register_activation_hook( __FILE__, 'cbmarkets_rates_activate' );
