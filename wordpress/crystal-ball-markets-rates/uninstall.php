<?php
/**
 * Removes everything the plugin kept when it is deleted: its one option and the rates it was keeping.
 *
 * @package CrystalBallMarketsRates
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'cbmarkets_rates_options' );
foreach ( array( 'fresh_rates', 'fresh_gold', 'kept_rates', 'kept_gold', 'wait_rates', 'wait_gold', 'service_note' ) as $cbmarkets_rates_kept ) {
	delete_transient( 'cbmarkets_rates_' . $cbmarkets_rates_kept );
}
