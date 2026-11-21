<?php
/**
 * The plugin's settings and its reading of the two rate files.
 *
 * The files are read from the server, never from a visitor's browser, and kept
 * for five minutes. A request names one page of this site (the page that shows
 * the figures) and carries this installation's own random key: that is all the
 * rates service is told. Nothing about a visitor is sent.
 *
 * On a site the service cannot reach (a local or test site), and until a page
 * with the figures is published, the plugin shows the rates packed with this
 * version (data/snapshot.json), marked as sample rates with their date.
 *
 * @package CrystalBallMarketsRates
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The settings as they are before the administrator changes any.
 *
 * @return array
 */
function cbmarkets_rates_defaults() {
	return array(
		// The link to Crystal Ball Markets is off until the administrator turns it on.
		'show_credit' => 0,
		'theme'       => 'light',
		// The page named to the rates service: set by itself the first time the figures are shown on a published page.
		'page'        => '',
		'site_key'    => '',
	);
}

/**
 * The settings.
 *
 * @return array
 */
function cbmarkets_rates_options() {
	$saved = get_option( 'cbmarkets_rates_options', array() );
	return wp_parse_args( is_array( $saved ) ? $saved : array(), cbmarkets_rates_defaults() );
}

/**
 * Changes some settings and keeps the rest.
 *
 * @param array $changes Settings to change.
 * @return void
 */
function cbmarkets_rates_update_options( $changes ) {
	update_option( 'cbmarkets_rates_options', array_merge( cbmarkets_rates_options(), $changes ) );
}

/**
 * This installation's own random key, made the first time it is needed.
 *
 * @return string
 */
function cbmarkets_rates_site_key() {
	$options = cbmarkets_rates_options();
	if ( ! is_string( $options['site_key'] ) || strlen( $options['site_key'] ) < 16 ) {
		$options['site_key'] = wp_generate_password( 32, false, false );
		cbmarkets_rates_update_options( array( 'site_key' => $options['site_key'] ) );
	}
	return $options['site_key'];
}

/**
 * The themes the converter can be shown in.
 *
 * @return string[]
 */
function cbmarkets_rates_themes() {
	return array( 'light', 'dark', 'auto' );
}

/**
 * Whether this site is one the rates service cannot read: a local or test
 * address. Such a site shows the sample rates and asks the service for nothing.
 *
 * @return bool
 */
function cbmarkets_rates_is_test_site() {
	$host = strtolower( trim( (string) wp_parse_url( home_url(), PHP_URL_HOST ), '[]' ) );
	$test = '' === $host
		|| 'localhost' === $host
		|| false === strpos( $host, '.' )
		|| false !== filter_var( $host, FILTER_VALIDATE_IP )
		|| 'playground.wordpress.net' === $host
		|| (bool) preg_match( '/\.(localhost|local|test|example|invalid|internal|lan)$/', $host )
		|| 'local' === wp_get_environment_type();

	/**
	 * Filters whether this site shows the sample rates in place of the service's.
	 *
	 * @param bool   $test Whether the site is a local or test site.
	 * @param string $host The site's host name.
	 */
	return (bool) apply_filters( 'cbmarkets_rates_is_test_site', $test, $host );
}

/**
 * Whether an address is a page of this site.
 *
 * @param string $url The address.
 * @return bool
 */
function cbmarkets_rates_is_own_page( $url ) {
	$url = (string) $url;
	if ( '' === $url || ! preg_match( '#^https?://#i', $url ) ) {
		return false;
	}
	$own  = strtolower( (string) wp_parse_url( home_url(), PHP_URL_HOST ) );
	$host = strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) );
	return '' !== $own && preg_replace( '/^www\./', '', $own ) === preg_replace( '/^www\./', '', $host );
}

/**
 * The address of the page being shown, when it is a published page any visitor
 * can open; an empty string for a preview, the editor, a feed or a protected page.
 *
 * @return string
 */
function cbmarkets_rates_public_view() {
	if ( is_admin() || wp_doing_ajax() || wp_doing_cron() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || ! did_action( 'wp' ) ) {
		return '';
	}
	if ( is_preview() || is_feed() || is_customize_preview() || is_404() || is_search() ) {
		return '';
	}
	if ( is_singular() ) {
		$post = get_queried_object();
		if ( ! $post instanceof WP_Post || 'publish' !== $post->post_status || post_password_required( $post ) ) {
			return '';
		}
		$url = get_permalink( $post );
		return $url ? (string) $url : '';
	}
	if ( is_front_page() || is_home() ) {
		return home_url( '/' );
	}
	global $wp;
	$path = isset( $wp->request ) ? (string) $wp->request : '';
	return '' === $path ? home_url( '/' ) : home_url( user_trailingslashit( $path ) );
}

/**
 * The page named to the rates service, or an empty string when the figures
 * have not yet been shown on a published page. The first such page is kept;
 * the administrator can change it under Settings.
 *
 * @return string
 */
function cbmarkets_rates_page() {
	$options = cbmarkets_rates_options();
	if ( cbmarkets_rates_is_own_page( $options['page'] ) ) {
		return $options['page'];
	}
	$url = cbmarkets_rates_public_view();
	if ( ! cbmarkets_rates_is_own_page( $url ) ) {
		return '';
	}
	$url = esc_url_raw( $url );
	cbmarkets_rates_update_options( array( 'page' => $url ) );
	return $url;
}

/**
 * The rates of a rate file, cleaned: each code with its rate, source and time.
 *
 * @param mixed $body The decoded file.
 * @return array|null
 */
function cbmarkets_rates_clean_rates( $body ) {
	if ( ! is_array( $body ) || ! isset( $body['data']['rates'] ) || ! is_array( $body['data']['rates'] ) ) {
		return null;
	}
	$rates = array();
	foreach ( $body['data']['rates'] as $code => $row ) {
		$code = cbmarkets_rates_code( $code );
		if ( '' === $code || 'USD' === $code || ! is_array( $row ) || ! isset( $row['rate'] ) || ! is_numeric( $row['rate'] ) ) {
			continue;
		}
		$rate = (float) $row['rate'];
		if ( ! ( $rate > 0 ) || ! is_finite( $rate ) ) {
			continue;
		}
		$rates[ $code ] = array(
			'rate'   => $rate,
			'source' => isset( $row['source'] ) ? sanitize_key( $row['source'] ) : '',
			'time'   => isset( $row['time'] ) ? sanitize_text_field( (string) $row['time'] ) : '',
		);
	}
	if ( ! $rates ) {
		return null;
	}
	ksort( $rates );
	return array( 'rates' => $rates );
}

/**
 * The gold file, cleaned: the dollar price of a troy ounce, its time, and the
 * price in each country's own money and unit.
 *
 * @param mixed $body The decoded file.
 * @return array|null
 */
function cbmarkets_rates_clean_gold( $body ) {
	if ( ! is_array( $body ) || ! isset( $body['data']['usdPerOunce'] ) || ! is_numeric( $body['data']['usdPerOunce'] ) ) {
		return null;
	}
	$spot = (float) $body['data']['usdPerOunce'];
	if ( ! ( $spot > 0 ) || ! is_finite( $spot ) ) {
		return null;
	}
	$countries = array();
	$rows      = isset( $body['data']['countries'] ) && is_array( $body['data']['countries'] ) ? $body['data']['countries'] : array();
	foreach ( $rows as $row ) {
		if ( ! is_array( $row ) || ! isset( $row['country'], $row['currency'], $row['price'] ) || ! is_numeric( $row['price'] ) ) {
			continue;
		}
		$country  = strtoupper( (string) $row['country'] );
		$currency = cbmarkets_rates_code( $row['currency'] );
		if ( ! preg_match( '/^[A-Z]{2}$/', $country ) || '' === $currency ) {
			continue;
		}
		$countries[ $country ] = array(
			'currency' => $currency,
			'unit'     => isset( $row['unit'] ) ? preg_replace( '/[^A-Za-z0-9]/', '', (string) $row['unit'] ) : '',
			'purity'   => isset( $row['purity'] ) ? sanitize_key( $row['purity'] ) : '',
			'price'    => (float) $row['price'],
		);
	}
	return array(
		'usdPerOunce' => $spot,
		'time'        => isset( $body['data']['time'] ) ? sanitize_text_field( (string) $body['data']['time'] ) : '',
		'countries'   => $countries,
	);
}

/**
 * The rates packed with this version of the plugin.
 *
 * @param string $slug `rates` or `gold`.
 * @return array|null The file as `cbmarkets_rates_file()` returns it.
 */
function cbmarkets_rates_snapshot( $slug ) {
	static $packed = null;
	if ( null === $packed ) {
		$packed = wp_json_file_decode( CBMARKETS_RATES_DIR . 'data/snapshot.json', array( 'associative' => true ) );
		$packed = is_array( $packed ) ? $packed : array();
	}
	if ( ! isset( $packed[ $slug ], $packed['taken'] ) ) {
		return null;
	}
	$data = 'rates' === $slug ? cbmarkets_rates_clean_rates( $packed['rates'] ) : cbmarkets_rates_clean_gold( $packed['gold'] );
	$at   = strtotime( (string) $packed['taken'] );
	if ( null === $data || ! $at ) {
		return null;
	}
	return array(
		'data'  => $data,
		'at'    => $at,
		'state' => 'sample',
	);
}

/**
 * What the rates service last said about this site, for the settings page:
 * an array with `kind` (`refused`, `failed` or `warning`), `text` and `at`.
 *
 * @return array|null
 */
function cbmarkets_rates_service_note() {
	$note = get_transient( 'cbmarkets_rates_service_note' );
	return is_array( $note ) && isset( $note['kind'], $note['text'], $note['at'] ) ? $note : null;
}

/**
 * Keeps, or with an empty kind forgets, what the rates service said.
 *
 * @param string $kind `refused`, `failed`, `warning` or an empty string.
 * @param string $text The service's words.
 * @return void
 */
function cbmarkets_rates_set_service_note( $kind, $text = '' ) {
	if ( '' === $kind ) {
		if ( false !== get_transient( 'cbmarkets_rates_service_note' ) ) {
			delete_transient( 'cbmarkets_rates_service_note' );
		}
		return;
	}
	set_transient(
		'cbmarkets_rates_service_note',
		array(
			'kind' => $kind,
			'text' => sanitize_text_field( wp_strip_all_tags( (string) $text ) ),
			'at'   => time(),
		),
		DAY_IN_SECONDS
	);
}

/**
 * Asks the rates service for one file.
 *
 * @param string $slug `rates` or `gold`.
 * @param string $page The page of this site that shows the figures.
 * @return array An array with `data` (the cleaned file) when it came, else `status` (the HTTP status, 0 when none).
 */
function cbmarkets_rates_request( $slug, $page ) {
	$response = wp_remote_get(
		add_query_arg( 'site', rawurlencode( $page ), CBMARKETS_RATES_API . $slug . '.json' ),
		array(
			'timeout' => 5,
			'headers' => array(
				'Accept'     => 'application/json',
				'X-Site-Key' => cbmarkets_rates_site_key(),
			),
		)
	);
	if ( is_wp_error( $response ) ) {
		cbmarkets_rates_set_service_note( 'failed', $response->get_error_message() );
		return array( 'status' => 0 );
	}
	$status = (int) wp_remote_retrieve_response_code( $response );
	$body   = json_decode( wp_remote_retrieve_body( $response ), true );
	if ( 200 !== $status ) {
		$said = is_array( $body ) && isset( $body['message'] ) && is_string( $body['message'] ) ? $body['message'] : '';
		/* translators: %d: HTTP status code */
		cbmarkets_rates_set_service_note( $status >= 400 && $status < 500 ? 'refused' : 'failed', '' !== $said ? $said : sprintf( __( 'The rates service answered with status %d.', 'crystal-ball-markets-rates' ), $status ) );
		return array( 'status' => $status );
	}
	$data = 'rates' === $slug ? cbmarkets_rates_clean_rates( $body ) : cbmarkets_rates_clean_gold( $body );
	if ( null === $data ) {
		cbmarkets_rates_set_service_note( 'failed', __( 'The rates service sent a file this plugin could not read.', 'crystal-ball-markets-rates' ) );
		return array( 'status' => 0 );
	}
	if ( isset( $body['warning'] ) && is_string( $body['warning'] ) && '' !== $body['warning'] ) {
		cbmarkets_rates_set_service_note( 'warning', $body['warning'] );
	} else {
		cbmarkets_rates_set_service_note( '' );
	}
	return array( 'data' => $data );
}

/**
 * One of the two rate files.
 *
 * @param string $slug `rates` or `gold`.
 * @return array|null An array with `data`, `at` (when it was read, in seconds) and `state`:
 *                    `live` (read in the last five minutes), `kept` (the service could not be
 *                    read just now, so the last copy is shown) or `sample` (packed with the plugin).
 *                    Null when there is nothing to show.
 */
function cbmarkets_rates_file( $slug ) {
	static $memo = array();
	if ( 'rates' !== $slug && 'gold' !== $slug ) {
		return null;
	}
	if ( array_key_exists( $slug, $memo ) ) {
		return $memo[ $slug ];
	}
	$memo[ $slug ] = cbmarkets_rates_read_file( $slug );
	return $memo[ $slug ];
}

/**
 * Reads one rate file: from what is kept, from the service, or from the sample.
 *
 * @param string $slug `rates` or `gold`.
 * @return array|null
 */
function cbmarkets_rates_read_file( $slug ) {
	if ( cbmarkets_rates_is_test_site() ) {
		return cbmarkets_rates_snapshot( $slug );
	}
	$fresh = get_transient( 'cbmarkets_rates_fresh_' . $slug );
	if ( is_array( $fresh ) && isset( $fresh['data'], $fresh['at'] ) ) {
		$fresh['state'] = 'live';
		return $fresh;
	}
	$page = cbmarkets_rates_page();
	if ( '' === $page ) {
		// Not yet on a published page (the editor, a preview): the sample, and nothing asked of the service.
		return cbmarkets_rates_snapshot( $slug );
	}
	$kept = get_transient( 'cbmarkets_rates_kept_' . $slug );
	$kept = is_array( $kept ) && isset( $kept['data'], $kept['at'] ) ? $kept : null;
	if ( $kept ) {
		$kept['state'] = 'kept';
	}
	// One request at a time, and a minute's pause after one that failed.
	if ( get_transient( 'cbmarkets_rates_wait_' . $slug ) ) {
		return $kept;
	}
	set_transient( 'cbmarkets_rates_wait_' . $slug, 1, 20 );
	$got = cbmarkets_rates_request( $slug, $page );
	if ( isset( $got['data'] ) ) {
		$file = array(
			'data' => $got['data'],
			'at'   => time(),
		);
		set_transient( 'cbmarkets_rates_fresh_' . $slug, $file, CBMARKETS_RATES_KEEP_SECONDS );
		set_transient( 'cbmarkets_rates_kept_' . $slug, $file, DAY_IN_SECONDS );
		delete_transient( 'cbmarkets_rates_wait_' . $slug );
		$file['state'] = 'live';
		return $file;
	}
	// A minute's pause for both files: a page never waits twice on a service that is not answering.
	set_transient( 'cbmarkets_rates_wait_rates', 1, MINUTE_IN_SECONDS );
	set_transient( 'cbmarkets_rates_wait_gold', 1, MINUTE_IN_SECONDS );
	if ( $got['status'] >= 400 && $got['status'] < 500 ) {
		// The service refuses this site: its figures are no longer shown.
		delete_transient( 'cbmarkets_rates_kept_' . $slug );
		return null;
	}
	return $kept;
}
