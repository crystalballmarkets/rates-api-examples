<?php
/**
 * Plugin Name:       Crystal Ball Markets Rates
 * Plugin URI:        https://crystalballmarkets.com/markets/rates-api
 * Description:       Free exchange rates, currency conversion and the gold price by country, as shortcodes. Data from the free Crystal Ball Markets Rates API.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Crystal Ball Markets
 * Author URI:        https://crystalballmarkets.com
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       crystal-ball-markets-rates
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CBMR_API_BASE', 'https://crystalballmarkets.com/markets/api/v1/' );
define( 'CBMR_CACHE_SECONDS', 300 );

/**
 * Settings: the credit link is opt-in, as the WordPress.org guidelines require.
 * The API terms require the link wherever the figures appear, so nothing is
 * shown on the site until the administrator agrees to display it.
 */
function cbmr_options() {
	$defaults = array(
		'show_credit' => 0,
		'site_key'    => '',
	);
	return wp_parse_args( get_option( 'cbmr_options', array() ), $defaults );
}

function cbmr_activate() {
	$opts = cbmr_options();
	if ( empty( $opts['site_key'] ) ) {
		$opts['site_key'] = wp_generate_password( 32, false, false );
		update_option( 'cbmr_options', $opts );
	}
}
register_activation_hook( __FILE__, 'cbmr_activate' );

function cbmr_admin_menu() {
	add_options_page(
		__( 'Crystal Ball Markets Rates', 'crystal-ball-markets-rates' ),
		__( 'CBM Rates', 'crystal-ball-markets-rates' ),
		'manage_options',
		'cbmr',
		'cbmr_settings_page'
	);
}
add_action( 'admin_menu', 'cbmr_admin_menu' );

function cbmr_register_settings() {
	register_setting(
		'cbmr',
		'cbmr_options',
		array(
			'sanitize_callback' => 'cbmr_sanitize_options',
		)
	);
}
add_action( 'admin_init', 'cbmr_register_settings' );

function cbmr_sanitize_options( $input ) {
	$current = cbmr_options();
	return array(
		'show_credit' => empty( $input['show_credit'] ) ? 0 : 1,
		'site_key'    => $current['site_key'] ? $current['site_key'] : wp_generate_password( 32, false, false ),
	);
}

function cbmr_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$opts = cbmr_options();
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Crystal Ball Markets Rates', 'crystal-ball-markets-rates' ); ?></h1>
		<p>
			<?php esc_html_e( 'The figures come from the free Crystal Ball Markets Rates API. Its terms ask for a visible link to Crystal Ball Markets wherever the figures appear.', 'crystal-ball-markets-rates' ); ?>
			<a href="https://crystalballmarkets.com/markets/rates-api" target="_blank" rel="noopener"><?php esc_html_e( 'Read the terms', 'crystal-ball-markets-rates' ); ?></a>
		</p>
		<form method="post" action="options.php">
			<?php settings_fields( 'cbmr' ); ?>
			<label>
				<input type="checkbox" name="cbmr_options[show_credit]" value="1" <?php checked( 1, $opts['show_credit'] ); ?> />
				<?php esc_html_e( 'Show the "Rates by Crystal Ball Markets" link under the figures (required to display them).', 'crystal-ball-markets-rates' ); ?>
			</label>
			<?php submit_button(); ?>
		</form>
		<h2><?php esc_html_e( 'Shortcodes', 'crystal-ball-markets-rates' ); ?></h2>
		<ul>
			<li><code>[cbm_rate from="USD" to="EUR"]</code> &ndash; <?php esc_html_e( 'one exchange rate', 'crystal-ball-markets-rates' ); ?></li>
			<li><code>[cbm_convert amount="100" from="GBP" to="NGN"]</code> &ndash; <?php esc_html_e( 'a converted amount', 'crystal-ball-markets-rates' ); ?></li>
			<li><code>[cbm_rates base="USD" currencies="EUR,GBP,JPY,INR"]</code> &ndash; <?php esc_html_e( 'a table of rates', 'crystal-ball-markets-rates' ); ?></li>
			<li><code>[cbm_gold country="IN"]</code> &ndash; <?php esc_html_e( 'the gold price in a country, in local money', 'crystal-ball-markets-rates' ); ?></li>
		</ul>
	</div>
	<?php
}

/**
 * Fetch one of the API files from the server, cached in a transient.
 * The site is named by its home URL and the request carries this
 * installation's own secret key, as the API terms require.
 */
function cbmr_get_file( $name ) {
	$allowed = array( 'rates.json', 'gold.json', 'quotes.json' );
	if ( ! in_array( $name, $allowed, true ) ) {
		return null;
	}
	$cache_key = 'cbmr_' . str_replace( '.', '_', $name );
	$cached    = get_transient( $cache_key );
	if ( false !== $cached ) {
		return $cached;
	}
	$opts = cbmr_options();
	if ( empty( $opts['site_key'] ) ) {
		cbmr_activate();
		$opts = cbmr_options();
	}
	$url      = add_query_arg( 'site', rawurlencode( home_url( '/' ) ), CBMR_API_BASE . $name );
	$response = wp_remote_get(
		$url,
		array(
			'timeout' => 10,
			'headers' => array( 'X-Site-Key' => $opts['site_key'] ),
		)
	);
	if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
		return null;
	}
	$data = json_decode( wp_remote_retrieve_body( $response ), true );
	if ( ! is_array( $data ) || ! isset( $data['data'] ) ) {
		return null;
	}
	set_transient( $cache_key, $data, CBMR_CACHE_SECONDS );
	return $data;
}

function cbmr_credit() {
	return '<span class="cbmr-credit"><a href="https://crystalballmarkets.com/markets">Rates by Crystal Ball Markets</a></span>';
}

function cbmr_can_show() {
	$opts = cbmr_options();
	return ! empty( $opts['show_credit'] );
}

function cbmr_unavailable() {
	if ( current_user_can( 'manage_options' ) && ! cbmr_can_show() ) {
		return '<em>' . esc_html__( 'Crystal Ball Markets Rates: turn on the credit link under Settings > CBM Rates to show the figures.', 'crystal-ball-markets-rates' ) . '</em>';
	}
	return '';
}

function cbmr_rate_for( $data, $code ) {
	$code = strtoupper( $code );
	if ( $code === $data['data']['base'] ) {
		return 1.0;
	}
	return isset( $data['data']['rates'][ $code ]['rate'] ) ? (float) $data['data']['rates'][ $code ]['rate'] : null;
}

function cbmr_shortcode_rate( $atts ) {
	if ( ! cbmr_can_show() ) {
		return cbmr_unavailable();
	}
	$a    = shortcode_atts( array( 'from' => 'USD', 'to' => 'EUR', 'decimals' => 4 ), $atts, 'cbm_rate' );
	$data = cbmr_get_file( 'rates.json' );
	if ( ! $data ) {
		return '';
	}
	$from = cbmr_rate_for( $data, $a['from'] );
	$to   = cbmr_rate_for( $data, $a['to'] );
	if ( ! $from || ! $to ) {
		return '';
	}
	$value = $to / $from;
	return sprintf(
		'<span class="cbmr-rate">1 %1$s = %2$s %3$s</span> %4$s',
		esc_html( strtoupper( $a['from'] ) ),
		esc_html( number_format_i18n( $value, absint( $a['decimals'] ) ) ),
		esc_html( strtoupper( $a['to'] ) ),
		cbmr_credit()
	);
}
add_shortcode( 'cbm_rate', 'cbmr_shortcode_rate' );

function cbmr_shortcode_convert( $atts ) {
	if ( ! cbmr_can_show() ) {
		return cbmr_unavailable();
	}
	$a    = shortcode_atts( array( 'amount' => 1, 'from' => 'USD', 'to' => 'EUR', 'decimals' => 2 ), $atts, 'cbm_convert' );
	$data = cbmr_get_file( 'rates.json' );
	if ( ! $data ) {
		return '';
	}
	$from = cbmr_rate_for( $data, $a['from'] );
	$to   = cbmr_rate_for( $data, $a['to'] );
	if ( ! $from || ! $to ) {
		return '';
	}
	$amount = (float) $a['amount'];
	return sprintf(
		'<span class="cbmr-convert">%1$s %2$s = %3$s %4$s</span> %5$s',
		esc_html( number_format_i18n( $amount, 2 ) ),
		esc_html( strtoupper( $a['from'] ) ),
		esc_html( number_format_i18n( $amount / $from * $to, absint( $a['decimals'] ) ) ),
		esc_html( strtoupper( $a['to'] ) ),
		cbmr_credit()
	);
}
add_shortcode( 'cbm_convert', 'cbmr_shortcode_convert' );

function cbmr_shortcode_rates( $atts ) {
	if ( ! cbmr_can_show() ) {
		return cbmr_unavailable();
	}
	$a    = shortcode_atts( array( 'base' => 'USD', 'currencies' => 'EUR,GBP,JPY,CNY,INR', 'decimals' => 4 ), $atts, 'cbm_rates' );
	$data = cbmr_get_file( 'rates.json' );
	if ( ! $data ) {
		return '';
	}
	$base = cbmr_rate_for( $data, $a['base'] );
	if ( ! $base ) {
		return '';
	}
	$rows = '';
	foreach ( array_filter( array_map( 'trim', explode( ',', $a['currencies'] ) ) ) as $code ) {
		$r = cbmr_rate_for( $data, $code );
		if ( ! $r ) {
			continue;
		}
		$rows .= sprintf(
			'<tr><td>%1$s</td><td>%2$s</td></tr>',
			esc_html( strtoupper( $code ) ),
			esc_html( number_format_i18n( $r / $base, absint( $a['decimals'] ) ) )
		);
	}
	return sprintf(
		'<table class="cbmr-rates"><thead><tr><th>%1$s</th><th>%2$s</th></tr></thead><tbody>%3$s</tbody></table><p>%4$s</p>',
		esc_html__( 'Currency', 'crystal-ball-markets-rates' ),
		/* translators: %s: base currency code */
		esc_html( sprintf( __( 'Per 1 %s', 'crystal-ball-markets-rates' ), strtoupper( $a['base'] ) ) ),
		$rows,
		cbmr_credit()
	);
}
add_shortcode( 'cbm_rates', 'cbmr_shortcode_rates' );

function cbmr_shortcode_gold( $atts ) {
	if ( ! cbmr_can_show() ) {
		return cbmr_unavailable();
	}
	$a    = shortcode_atts( array( 'country' => 'IN' ), $atts, 'cbm_gold' );
	$data = cbmr_get_file( 'gold.json' );
	if ( ! $data || empty( $data['data']['countries'] ) ) {
		return '';
	}
	foreach ( $data['data']['countries'] as $c ) {
		if ( strtoupper( $a['country'] ) === $c['country'] ) {
			return sprintf(
				'<span class="cbmr-gold">%1$s %2$s %3$s</span> %4$s',
				esc_html( number_format_i18n( (float) $c['price'], 2 ) ),
				esc_html( $c['currency'] ),
				/* translators: 1: purity such as k24, 2: unit such as "ten grams" */
				esc_html( sprintf( __( 'per %2$s (%1$s)', 'crystal-ball-markets-rates' ), $c['purity'], strtolower( preg_replace( '/(?<!^)([A-Z])/', ' $1', $c['unit'] ) ) ) ),
				cbmr_credit()
			);
		}
	}
	return '';
}
add_shortcode( 'cbm_gold', 'cbmr_shortcode_gold' );
