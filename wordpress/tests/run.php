<?php
/**
 * Runs the plugin's own code against stand-ins for WordPress (stubs.php) and checks what it does.
 *
 *   php wordpress/tests/run.php            every check
 *   php wordpress/tests/run.php <name>     one of them
 *
 * Each check runs in a process of its own, as each page view does on a site. Any PHP warning or notice fails it.
 * This is no substitute for a WordPress site: it proves the plugin's sums, its choices and its output, not that
 * WordPress accepts every call. See wordpress/README.md for the test on a site.
 */

const PLUGIN = __DIR__ . '/../crystal-ball-markets-rates/';

$checks = array();

// ---- helpers ----

function check( $ok, $label ) {
	if ( ! $ok ) {
		throw new Exception( $label );
	}
}
function has( $haystack, $needle, $label = '' ) {
	check( false !== strpos( (string) $haystack, (string) $needle ), ( $label ? $label . ': ' : '' ) . 'expected to find "' . $needle . '"' );
}
function lacks( $haystack, $needle, $label = '' ) {
	check( false === strpos( (string) $haystack, (string) $needle ), ( $label ? $label . ': ' : '' ) . 'did not expect "' . $needle . '"' );
}
function near( $a, $b, $label ) {
	check( is_numeric( $a ) && abs( (float) $a - (float) $b ) <= 1e-9 * max( 1.0, abs( (float) $b ) ), $label . ': ' . var_export( $a, true ) . ' is not ' . var_export( $b, true ) );
}
function boot() {
	require PLUGIN . 'crystal-ball-markets-rates.php';
	do_action( 'init' );
}
function shortcode( $tag, $atts = array() ) {
	return call_user_func( $GLOBALS['cbm_test']['shortcodes'][ $tag ], $atts );
}
function packed() {
	return json_decode( file_get_contents( PLUGIN . 'data/snapshot.json' ), true );
}
/** A published page of the test site, with the converter on it. */
function on_page( $permalink = 'https://shop.example.org/currency-converter/' ) {
	$post               = new WP_Post();
	$post->permalink    = $permalink;
	$post->post_content = '[cbmarkets_converter]';
	$GLOBALS['cbm_test']['post'] = $post;
}
/** The rates service answering as it does: the two files, with an optional warning. */
function service( $warning = null ) {
	return function ( $url ) use ( $warning ) {
		$packed = packed();
		$file   = false !== strpos( $url, 'rates.json' ) ? $packed['rates'] : $packed['gold'];
		if ( null !== $warning ) {
			$file['warning'] = $warning;
		}
		return array(
			'code' => 200,
			'body' => json_encode( $file ),
		);
	};
}
function refusing( $status, $message ) {
	return function () use ( $status, $message ) {
		return array(
			'code' => $status,
			'body' => json_encode(
				array(
					'error'   => 'blocked',
					'message' => $message,
				)
			),
		);
	};
}
function requests() {
	return count( $GLOBALS['cbm_test']['requests'] );
}
function source_files( $pattern = '/\.(php|js|css|json|txt)$/' ) {
	$out = array();
	$it  = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( PLUGIN, FilesystemIterator::SKIP_DOTS ) );
	foreach ( $it as $file ) {
		if ( preg_match( $pattern, $file->getFilename() ) ) {
			$out[ substr( $file->getPathname(), strlen( PLUGIN ) ) ] = file_get_contents( $file->getPathname() );
		}
	}
	ksort( $out );
	return $out;
}

// ---- the checks ----

$checks['names: every name carries the long prefix, as the WordPress.org guidelines ask'] = function () {
	$php = source_files( '/\.php$/' );
	foreach ( $php as $name => $code ) {
		preg_match_all( '/^\s*function\s+([A-Za-z0-9_]+)\s*\(/m', $code, $m );
		foreach ( $m[1] as $function ) {
			check( 0 === strpos( $function, 'cbmarkets_rates_' ), "$name: function $function" );
		}
		preg_match_all( '/\bdefine\(\s*\'([^\']+)\'/', $code, $m );
		foreach ( $m[1] as $constant ) {
			check( 0 === strpos( $constant, 'CBMARKETS_RATES_' ), "$name: constant $constant" );
		}
		preg_match_all( '/\b(?:get|update|delete|add)_option\(\s*\'([^\']+)\'/', $code, $m );
		foreach ( $m[1] as $option ) {
			check( 0 === strpos( $option, 'cbmarkets_rates_' ) || in_array( $option, array( 'time_format', 'date_format' ), true ), "$name: option $option" );
		}
		preg_match_all( '/\b(?:get|set|delete)_transient\(\s*\'([^\']+)\'/', $code, $m );
		foreach ( $m[1] as $transient ) {
			check( 0 === strpos( $transient, 'cbmarkets_rates_' ), "$name: transient $transient" );
		}
		preg_match_all( '/\badd_shortcode\(\s*\'([^\']+)\'/', $code, $m );
		foreach ( $m[1] as $tag ) {
			check( 0 === strpos( $tag, 'cbmarkets_' ), "$name: shortcode $tag" );
		}
		preg_match_all( '/\bwp_(?:register|enqueue)_(?:style|script)\(\s*\'([^\']+)\'/', $code, $m );
		foreach ( $m[1] as $handle ) {
			check( 0 === strpos( $handle, 'cbmarkets-rates' ), "$name: handle $handle" );
		}
		preg_match_all( '/\b(?:apply_filters|do_action)\(\s*\'([^\']+)\'/', $code, $m );
		foreach ( $m[1] as $hook ) {
			check( 0 === strpos( $hook, 'cbmarkets_rates_' ), "$name: hook $hook" );
		}
		preg_match_all( '/^\$([a-z_0-9]+)\s*=/m', $code, $m );
		foreach ( $m[1] as $global ) {
			check( 0 === strpos( $global, 'cbmarkets_rates_' ), "$name: global \$$global" );
		}
		// Every sentence is in the plugin's own text domain, which is its slug.
		$words = '(?:__|_e|esc_html__|esc_html_e|esc_attr__|esc_attr_e)';
		$text  = "'(?:[^'\\\\]|\\\\.)*'";
		check( preg_match_all( '/\b' . $words . '\(/', $code ) === preg_match_all( '/\b' . $words . '\(\s*' . $text . ",\s*'crystal-ball-markets-rates'\s*\)/", $code ), "$name: a sentence without the text domain" );
		check( false !== strpos( $code, "defined( 'ABSPATH' )" ) || false !== strpos( $code, "defined( 'WP_UNINSTALL_PLUGIN' )" ), "$name: can be opened directly" );
	}
	// The short prefixes the review named are gone from every file of the plugin.
	foreach ( source_files() as $name => $code ) {
		check( ! preg_match( '/\bcbmr|\bCBMR|\bcbm_|\[cbm_|\bCBM_/', $code ), "$name: still carries a short prefix" );
	}
	$css = file_get_contents( PLUGIN . 'assets/converter.css' );
	preg_match_all( '/\.([a-zA-Z][a-zA-Z0-9_-]*)/', preg_replace( '#/\*.*?\*/#s', '', preg_replace( '/\d\.\d+/', '', $css ) ), $m );
	foreach ( array_unique( $m[1] ) as $class ) {
		check( 0 === strpos( $class, 'cbmarkets-' ) || 'wp-block-cbmarkets-converter' === $class, "converter.css: class .$class" );
	}
	preg_match_all( '/--([a-z0-9-]+)\s*:/', $css, $m );
	foreach ( array_unique( $m[1] ) as $property ) {
		check( 0 === strpos( $property, 'cbmarkets-' ), "converter.css: property --$property" );
	}
	$block = json_decode( file_get_contents( PLUGIN . 'assets/block/block.json' ), true );
	check( 'cbmarkets/converter' === $block['name'] && 'crystal-ball-markets-rates' === $block['textdomain'], 'block.json: name and text domain' );
};

$checks['the plugin registers what it says, and nothing asks the service on activation'] = function () {
	boot();
	$t = $GLOBALS['cbm_test'];
	check( array( 'cbmarkets_converter', 'cbmarkets_rate', 'cbmarkets_convert', 'cbmarkets_rates', 'cbmarkets_gold' ) === array_keys( $t['shortcodes'] ), 'the five shortcodes' );
	check( isset( $t['styles']['cbmarkets-rates'], $t['scripts']['cbmarkets-rates-core'], $t['scripts']['cbmarkets-rates-converter'] ), 'style and scripts' );
	check( 1 === count( $t['blocks'] ) && 'cbmarkets_rates_block' === current( $t['blocks'] )['render_callback'], 'the block' );
	check( isset( $t['filters']['plugin_action_links_crystal-ball-markets-rates/crystal-ball-markets-rates.php'] ), 'the Settings link' );
	check( array( 'crystal-ball-markets-rates' ) === array_keys( $t['domains'] ?? array( 'crystal-ball-markets-rates' => true ) ), 'one text domain' );
	call_user_func( $t['activation'] );
	$options = get_option( 'cbmarkets_rates_options' );
	check( 32 === strlen( $options['site_key'] ) && 0 === (int) $options['show_credit'], 'activation makes a key and leaves the link off' );
	check( 0 === requests(), 'activation asks the service for nothing' );
	do_action( 'admin_menu' );
	do_action( 'admin_init' );
	check( isset( $GLOBALS['cbm_test']['pages']['cbmarkets-rates'], $GLOBALS['cbm_test']['settings']['cbmarkets_rates_options'] ), 'settings page and setting' );
};

$checks['sums: conversion, gold, decimals and typed amounts'] = function () {
	boot();
	$rates = array(
		'EUR' => array( 'rate' => 0.9 ),
		'GBP' => array( 'rate' => 0.8 ),
		'BAD' => array( 'rate' => 0 ),
	);
	near( cbmarkets_rates_convert( 100, 'GBP', 'EUR', $rates ), 112.5, 'pounds to euros' );
	near( cbmarkets_rates_convert( 5, 'usd', 'USD', $rates ), 5, 'dollars to dollars' );
	check( null === cbmarkets_rates_convert( 1, 'USD', 'XXX', $rates ), 'no rate, no answer' );
	check( null === cbmarkets_rates_convert( 1, 'USD', 'BAD', $rates ), 'a rate of nothing is no rate' );
	check( null === cbmarkets_rates_convert( 'abc', 'USD', 'EUR', $rates ), 'not a number' );
	near( cbmarkets_rates_gold_value( 10, 1, 0.916, 3110.34768, 1 ), 916, 'ten grams of 22K' );
	near( cbmarkets_rates_gold_value( 1, CBMARKETS_RATES_GRAMS_PER_TROY_OUNCE, 1, 3680.47, 0.9 ), 3312.423, 'an ounce in euros' );
	check( null === cbmarkets_rates_gold_value( -1, 1, 1, 3000, 1 ), 'no negative weight' );
	check( 2 === cbmarkets_rates_currency_digits( 'USD' ) && 0 === cbmarkets_rates_currency_digits( 'JPY' ) && 3 === cbmarkets_rates_currency_digits( 'KWD' ), 'decimals by currency' );
	check( 6 === cbmarkets_rates_money_digits( 0.00012345, 2 ) && 2 === cbmarkets_rates_money_digits( 12.5, 2 ) && 0 === cbmarkets_rates_money_digits( 150.2, 0 ), 'decimals of an amount' );
	check( 6 === cbmarkets_rates_rate_digits( 0.8612 ) && 2 === cbmarkets_rates_rate_digits( 1552.01 ) && 2 === cbmarkets_rates_rate_digits( 110401 ) && 4 === cbmarkets_rates_rate_digits( 83.1 ), 'decimals of a rate' );
	near( cbmarkets_rates_amount( '1,234.56' ), 1234.56, 'an amount with a comma' );
	check( null === cbmarkets_rates_amount( 'abc' ) && null === cbmarkets_rates_amount( '' ) && null === cbmarkets_rates_amount( '1.2.3' ) && null === cbmarkets_rates_amount( '-5' ), 'what is not an amount' );
	check( 'k22' === cbmarkets_rates_purity_key( '22K' ) && 'k24' === cbmarkets_rates_purity_key( 'k24' ) && '' === cbmarkets_rates_purity_key( '23' ), 'purities as written' );
	check( '96.5%' === cbmarkets_rates_country_purity( 'th965' ) && '21K' === cbmarkets_rates_country_purity( 'k21' ), 'purities of the gold file' );
	check( 'USD' === cbmarkets_rates_code( ' usd ' ) && '' === cbmarkets_rates_code( 'US' ) && '' === cbmarkets_rates_code( '<b>' ), 'currency codes' );
	check( '1,234.5' === cbmarkets_rates_plain( 1234.5 ) && '10' === cbmarkets_rates_plain( 10.0 ) && '0.125' === cbmarkets_rates_plain( 0.125 ), 'a number as typed' );
};

$checks['which sites show the sample rates'] = function () {
	boot();
	$cases = array(
		'http://localhost:8080'                    => true,
		'http://127.0.0.1'                         => true,
		'http://[::1]:8080'                        => true,
		'https://intranet'                         => true,
		'https://shop.test'                        => true,
		'https://mysite.local'                     => true,
		'https://playground.wordpress.net/scope:a' => true,
		'https://shop.example.org'                 => false,
		'https://www.example.co.uk'                => false,
	);
	foreach ( $cases as $home => $expected ) {
		$GLOBALS['cbm_test']['home'] = $home;
		check( $expected === cbmarkets_rates_is_test_site(), $home );
	}
	$GLOBALS['cbm_test']['home']        = 'https://shop.example.org';
	$GLOBALS['cbm_test']['environment'] = 'local';
	check( true === cbmarkets_rates_is_test_site(), 'an environment marked local' );
};

$checks['a local or test site: the sample rates, dated, and nothing asked of the service'] = function () {
	$GLOBALS['cbm_test']['home'] = 'http://localhost:8080';
	on_page( 'http://localhost:8080/converter/' );
	boot();
	$html = shortcode( 'cbmarkets_converter' );
	has( $html, 'Sample rates of 19 Nov 2026.' );
	has( $html, 'Live rates load on a public site.' );
	has( $html, 'cbmarkets-status cbmarkets-late' );
	has( $html, 'role="tablist"' );
	lacks( $html, 'crystalballmarkets.com', 'no link unless it is turned on' );
	check( 0 === requests(), 'no request' );
	$options = get_option( 'cbmarkets_rates_options', array() );
	check( empty( $options['page'] ), 'no page is named' );
	$inline = implode( '', $GLOBALS['cbm_test']['inline']['cbmarkets-rates-converter'] );
	has( $inline, '"state":"sample"' );
	has( $inline, 'window.cbmarketsRatesData = {' );
	check( isset( $GLOBALS['cbm_test']['enqueued']['style:cbmarkets-rates'], $GLOBALS['cbm_test']['enqueued']['script:cbmarkets-rates-converter'] ), 'style and script are added' );
	shortcode( 'cbmarkets_converter', array( 'show' => 'gold' ) );
	check( 1 === count( $GLOBALS['cbm_test']['inline']['cbmarkets-rates-converter'] ), 'the rates are written into the page once, however many converters it has' );
};

$checks['the editor and previews of a public site: the sample, until a page is published'] = function () {
	$GLOBALS['cbm_test']['rest'] = true;
	define( 'REST_REQUEST', true );
	$GLOBALS['cbm_test']['http'] = service();
	boot();
	$html = cbmarkets_rates_block( array() );
	has( $html, 'Sample rates of 19 Nov 2026.' );
	has( $html, 'Live rates load once this is on a published page.' );
	has( $html, 'wp-block-cbmarkets-converter' );
	check( 0 === requests(), 'no request from the editor' );
	$GLOBALS['cbm_test']['preview'] = true;
	check( '' === cbmarkets_rates_public_view(), 'a preview is not a published page' );
};

$checks['a draft and a private page name nothing to the service'] = function () {
	on_page();
	$GLOBALS['cbm_test']['post']->post_status = 'draft';
	$GLOBALS['cbm_test']['http']              = service();
	boot();
	has( shortcode( 'cbmarkets_rate' ), 'Sample rates of' );
	check( 0 === requests(), 'no request for a draft' );
};

$checks['a published page of a public site: current rates, the page named, the files kept'] = function () {
	on_page();
	$GLOBALS['cbm_test']['http'] = service();
	boot();
	$html = shortcode( 'cbmarkets_converter' );
	has( $html, 'Rates updated ' );
	lacks( $html, 'Sample rates' );
	lacks( $html, 'cbmarkets-late' );
	check( 2 === requests(), 'one request for each file' );
	foreach ( $GLOBALS['cbm_test']['requests'] as $request ) {
		has( $request['url'], 'https://crystalballmarkets.com/markets/api/v1/' );
		has( $request['url'], '?site=' . rawurlencode( 'https://shop.example.org/currency-converter/' ) );
		check( 32 === strlen( $request['args']['headers']['X-Site-Key'] ), 'the key is sent' );
		check( array( 'Accept', 'X-Site-Key' ) === array_keys( $request['args']['headers'] ), 'nothing else is sent' );
	}
	$options = get_option( 'cbmarkets_rates_options' );
	check( 'https://shop.example.org/currency-converter/' === $options['page'], 'the page is kept' );
	foreach ( array( 'fresh_rates', 'fresh_gold', 'kept_rates', 'kept_gold' ) as $name ) {
		check( false !== get_transient( 'cbmarkets_rates_' . $name ), "$name is kept" );
	}
	check( 300 === $GLOBALS['cbm_test']['transients']['cbmarkets_rates_fresh_rates']['for'], 'five minutes' );
	check( false === get_transient( 'cbmarkets_rates_wait_rates' ), 'no pause after a good read' );
	check( null === cbmarkets_rates_service_note(), 'nothing to tell the administrator' );
	$again = cbmarkets_rates_read_file( 'rates' );
	check( 'live' === $again['state'] && 2 === requests(), 'the next page view asks for nothing' );
	has( implode( '', $GLOBALS['cbm_test']['inline']['cbmarkets-rates-converter'] ), '"state":"live"' );
};

$checks['later pages name the first page, whichever page is shown'] = function () {
	update_option( 'cbmarkets_rates_options', array( 'page' => 'https://shop.example.org/currency-converter/', 'site_key' => str_repeat( 'k', 32 ) ) );
	on_page( 'https://shop.example.org/another-page/' );
	$GLOBALS['cbm_test']['http'] = service();
	boot();
	shortcode( 'cbmarkets_rate' );
	has( $GLOBALS['cbm_test']['requests'][0]['url'], rawurlencode( 'https://shop.example.org/currency-converter/' ) );
	check( str_repeat( 'k', 32 ) === $GLOBALS['cbm_test']['requests'][0]['args']['headers']['X-Site-Key'], 'the same key' );
};

$checks['the service cannot be read: the last rates, marked, and a pause before asking again'] = function () {
	on_page();
	$packed = packed();
	boot();
	$old = array(
		'data' => cbmarkets_rates_clean_rates( $packed['rates'] ),
		'at'   => time() - 3600,
	);
	set_transient( 'cbmarkets_rates_kept_rates', $old, DAY_IN_SECONDS );
	set_transient(
		'cbmarkets_rates_kept_gold',
		array(
			'data' => cbmarkets_rates_clean_gold( $packed['gold'] ),
			'at'   => time() - 3600,
		),
		DAY_IN_SECONDS
	);
	$GLOBALS['cbm_test']['http'] = refusing( 503, 'Busy.' );
	$html = shortcode( 'cbmarkets_converter' );
	has( $html, 'Could not update. Showing the rates of ' );
	has( $html, 'cbmarkets-late' );
	check( 1 === requests(), 'asked once: the second file does not wait on a service that just failed' );
	check( 60 === $GLOBALS['cbm_test']['transients']['cbmarkets_rates_wait_rates']['for'] && 60 === $GLOBALS['cbm_test']['transients']['cbmarkets_rates_wait_gold']['for'], 'a minute before asking again' );
	$again = cbmarkets_rates_read_file( 'rates' );
	check( 'kept' === $again['state'] && 1 === requests(), 'no second request inside the minute' );
	$note = cbmarkets_rates_service_note();
	check( 'failed' === $note['kind'] && 'Busy.' === $note['text'], 'the administrator is told' );
};

$checks['no connection and nothing kept: a plain line, and a hint for administrators only'] = function () {
	on_page();
	boot();
	$html = shortcode( 'cbmarkets_converter' );
	has( $html, 'The rates are unavailable right now.' );
	lacks( $html, 'only administrators see this' );
	lacks( $html, 'cbmarkets-big' );
	check( '' === shortcode( 'cbmarkets_rate' ), 'a figure in a sentence shows nothing' );
	$GLOBALS['cbm_test']['can_manage'] = true;
	$hint = cbmarkets_rates_admin_hint();
	has( $hint, 'only administrators see this' );
	has( $hint, 'No connection in this test.' );
	has( $hint, 'options-general.php?page=cbmarkets-rates' );
};

$checks['the service refuses the site: its figures are no longer shown, and the reason is kept'] = function () {
	on_page();
	$packed = packed();
	boot();
	set_transient(
		'cbmarkets_rates_kept_rates',
		array(
			'data' => cbmarkets_rates_clean_rates( $packed['rates'] ),
			'at'   => time() - 600,
		),
		DAY_IN_SECONDS
	);
	$GLOBALS['cbm_test']['http'] = refusing( 403, 'shop.example.org does not show <a href="https://crystalballmarkets.com/markets">the link</a>.' );
	$html = shortcode( 'cbmarkets_rates' );
	check( '' === $html, 'no table for a visitor' );
	check( false === get_transient( 'cbmarkets_rates_kept_rates' ), 'the kept rates are dropped' );
	$note = cbmarkets_rates_service_note();
	check( 'refused' === $note['kind'], 'refused' );
	check( 'shop.example.org does not show the link.' === $note['text'], 'the service’s words, without markup: ' . $note['text'] );
};

$checks['a warning from the service reaches the settings page, and clears when it stops'] = function () {
	on_page();
	$GLOBALS['cbm_test']['http'] = service( 'Within a day we check your page for the link.' );
	boot();
	cbmarkets_rates_read_file( 'rates' );
	$note = cbmarkets_rates_service_note();
	check( 'warning' === $note['kind'] && 'Within a day we check your page for the link.' === $note['text'], 'the warning is kept' );
	$GLOBALS['cbm_test']['can_manage'] = true;
	ob_start();
	cbmarkets_rates_settings_page();
	$page = ob_get_clean();
	has( $page, 'A message from the rates service:' );
	has( $page, 'Within a day we check your page for the link.' );
	has( $page, 'notice notice-warning inline' );
	$GLOBALS['cbm_test']['http'] = service();
	delete_transient( 'cbmarkets_rates_fresh_gold' );
	cbmarkets_rates_read_file( 'gold' );
	check( null === cbmarkets_rates_service_note(), 'cleared by a clean answer' );
};

$checks['the link is off until the administrator turns it on, then shown once where figures are'] = function () {
	$GLOBALS['cbm_test']['home'] = 'http://localhost';
	boot();
	$link = '<a href="https://crystalballmarkets.com/markets">Rates by Crystal Ball Markets</a>';
	foreach ( array( 'cbmarkets_converter', 'cbmarkets_rate', 'cbmarkets_convert', 'cbmarkets_rates', 'cbmarkets_gold' ) as $tag ) {
		lacks( shortcode( $tag, array( 'country' => 'IN' ) ), 'crystalballmarkets.com', "$tag without the choice" );
	}
	cbmarkets_rates_update_options( array( 'show_credit' => 1 ) );
	$first  = shortcode( 'cbmarkets_rate' );
	$second = shortcode( 'cbmarkets_convert' );
	check( 1 === substr_count( $first, $link ), 'the first figure in a sentence carries the link' );
	lacks( $second, 'crystalballmarkets.com', 'the next figure in a sentence does not repeat it' );
	check( 1 === substr_count( shortcode( 'cbmarkets_converter' ), $link ), 'the converter carries it' );
	check( 1 === substr_count( shortcode( 'cbmarkets_rates' ), $link ), 'the table carries it' );
	lacks( $first . shortcode( 'cbmarkets_converter' ), 'nofollow' );
	lacks( $first . shortcode( 'cbmarkets_converter' ), 'target=' );
};

$checks['the small shortcodes: figures match the sums'] = function () {
	$GLOBALS['cbm_test']['home'] = 'http://localhost';
	boot();
	$packed = packed();
	$rates  = $packed['rates']['data']['rates'];
	$spot   = $packed['gold']['data']['usdPerOunce'];

	$eur = $rates['EUR']['rate'];
	has( shortcode( 'cbmarkets_rate' ), '<span class="cbmarkets-figure">1 USD = ' . number_format( $eur, cbmarkets_rates_rate_digits( $eur ) ) . ' EUR</span>' );
	has( shortcode( 'cbmarkets_rate', array( 'from' => 'eur', 'to' => 'usd', 'decimals' => '2' ) ), '1 EUR = ' . number_format( 1 / $eur, 2 ) . ' USD' );
	check( '' === shortcode( 'cbmarkets_rate', array( 'to' => 'XXX' ) ), 'an unknown currency shows nothing' );

	$ngn = 100 / $rates['GBP']['rate'] * $rates['NGN']['rate'];
	has( shortcode( 'cbmarkets_convert', array( 'amount' => '100', 'from' => 'GBP', 'to' => 'NGN' ) ), '100 GBP = ' . number_format( $ngn, 2 ) . ' NGN' );
	has( shortcode( 'cbmarkets_convert', array( 'amount' => '1,000', 'from' => 'USD', 'to' => 'JPY' ) ), '1,000 USD = ' . number_format( 1000 * $rates['JPY']['rate'], 0 ) . ' JPY' );
	check( '' === shortcode( 'cbmarkets_convert', array( 'amount' => 'lots' ) ), 'not an amount' );

	$table = shortcode( 'cbmarkets_rates', array( 'base' => 'GBP', 'currencies' => 'EUR, usd,XXX,GBP,EUR' ) );
	has( $table, '<th scope="col">Per 1 GBP</th>' );
	check( 2 === substr_count( $table, '<tr><th scope="row">' ), 'two rows: the unknown code, the base and the repeat are left out' );
	has( $table, '<th scope="row">USD</th><td>' . number_format( 1 / $rates['GBP']['rate'], cbmarkets_rates_rate_digits( 1 / $rates['GBP']['rate'] ) ) . '</td>' );
	has( $table, 'cbmarkets-card cbmarkets-theme-light' );

	has( shortcode( 'cbmarkets_gold', array( 'country' => 'in' ) ), '110,401.76 INR per 10 grams (24K)' );
	has( shortcode( 'cbmarkets_gold', array( 'country' => 'TH' ) ), 'THB per baht of gold (96.5%)' );
	check( '' === shortcode( 'cbmarkets_gold', array( 'country' => 'ZZ' ) ), 'an unknown country shows nothing' );
	$worth = 10 / CBMARKETS_RATES_GRAMS_PER_TROY_OUNCE * 0.916 * $spot * $rates['INR']['rate'];
	has( shortcode( 'cbmarkets_gold', array( 'weight' => '10', 'unit' => 'gram', 'purity' => '22k', 'currency' => 'INR' ) ), '10 grams of 22K gold = ' . number_format( $worth, 2 ) . ' INR' );
	has( shortcode( 'cbmarkets_gold', array( 'weight' => '1', 'unit' => 'tola' ) ), '1 tola of 24K gold = ' . number_format( 11.6638038 / CBMARKETS_RATES_GRAMS_PER_TROY_OUNCE * $spot, 2 ) . ' USD' );
	check( '' === shortcode( 'cbmarkets_gold', array( 'unit' => 'stone' ) ), 'an unknown unit shows nothing' );
	has( shortcode( 'cbmarkets_rate' ), 'Sample rates of 19 Nov 2026.', 'a sample figure says it is one' );
};

$checks['the converter: first figures, the choices of its attributes, and one tab alone'] = function () {
	$GLOBALS['cbm_test']['home'] = 'http://localhost';
	boot();
	$packed = packed();
	$rates  = $packed['rates']['data']['rates'];
	$spot   = $packed['gold']['data']['usdPerOunce'];

	$html = shortcode( 'cbmarkets_converter', array( 'amount' => '250', 'from' => 'gbp', 'to' => 'ngn', 'weight' => '2', 'unit' => 'tola', 'purity' => '22', 'gold_currency' => 'inr', 'tab' => 'gold', 'theme' => 'dark' ) );
	has( $html, 'cbmarkets-converter cbmarkets-theme-dark' );
	has( $html, '250 GBP =' );
	has( $html, number_format( 250 / $rates['GBP']['rate'] * $rates['NGN']['rate'], 2 ) . ' NGN' );
	has( $html, '2 tolas of 22K gold =' );
	has( $html, number_format( 2 * 11.6638038 / CBMARKETS_RATES_GRAMS_PER_TROY_OUNCE * 0.916 * $spot * $rates['INR']['rate'], 2 ) . ' INR' );
	has( $html, 'Gold: ' . number_format( $spot, 2 ) . ' USD a troy ounce' );
	has( $html, "<option value=\"NGN\" selected='selected'>NGN</option>" );
	has( $html, 'aria-selected="true" data-cbmarkets-tab="gold"' );
	has( $html, 'aria-selected="false" data-cbmarkets-tab="currency" tabindex="-1"' );
	check( 1 === preg_match( '/data-cbmarkets-panel="currency"[^>]* hidden>/', $html ), 'the currency panel waits behind its tab' );
	check( 0 === preg_match( '/data-cbmarkets-panel="gold"[^>]* hidden>/', $html ), 'the gold panel is open' );
	$config = json_decode( html_entity_decode( preg_match( '/data-cbmarkets-converter="([^"]*)"/', $html, $m ) ? $m[1] : '', ENT_QUOTES ), true );
	check( array( 'show' => 'both', 'tab' => 'gold', 'amount' => '250', 'from' => 'GBP', 'to' => 'NGN', 'weight' => '2', 'unit' => 'tola', 'purity' => 'k22', 'goldCurrency' => 'INR', 'theme' => 'dark' ) === $config, 'what the script is told: ' . json_encode( $config ) );

	$gold = shortcode( 'cbmarkets_converter', array( 'show' => 'gold' ) );
	lacks( $gold, 'role="tablist"' );
	lacks( $gold, 'role="tabpanel"' );
	lacks( $gold, 'data-cbmarkets-panel="currency"' );
	check( 0 === preg_match( '/data-cbmarkets-panel="gold"[^>]* hidden>/', $gold ), 'the one panel is open' );
	$currency = shortcode( 'cbmarkets_converter', array( 'show' => 'currency', 'tab' => 'gold' ) );
	lacks( $currency, 'data-cbmarkets-panel="gold"' );
	check( 0 === preg_match( '/data-cbmarkets-panel="currency"[^>]* hidden>/', $currency ), 'asking for the other tab cannot hide the only panel' );
	preg_match_all( '/id="(cbmarkets-\d+)-/', $html, $ids );
	check( 5 === count( $ids[1] ) && 1 === count( array_unique( $ids[1] ) ), 'one converter, one id for its two tabs, two panels and list of pins' );
	preg_match( '/id="(cbmarkets-\d+)-panel-gold"/', $gold, $a );
	preg_match( '/id="(cbmarkets-\d+)-panel-currency"/', $currency, $b );
	check( $a[1] !== $b[1], 'two converters on a page do not share ids' );

	$block = cbmarkets_rates_block( array( 'show' => 'gold', 'goldCurrency' => 'INR', 'purity' => '22k', 'align' => 'center', 'theme' => 'auto', 'extra' => array( 'x' ) ) );
	has( $block, '<div class="wp-block-cbmarkets-converter cbmarkets-align-center">' );
	has( $block, 'cbmarkets-theme-auto' );
	has( $block, '10 grams of 22K gold =' );
};

$checks['attributes are never trusted: markup in them does not reach the page'] = function () {
	$GLOBALS['cbm_test']['home'] = 'http://localhost';
	boot();
	$evil = '"><script>alert(1)</script>';
	$html = shortcode( 'cbmarkets_converter', array( 'amount' => $evil, 'from' => $evil, 'to' => $evil, 'weight' => $evil, 'unit' => $evil, 'purity' => $evil, 'gold_currency' => $evil, 'theme' => $evil, 'show' => $evil, 'tab' => $evil ) )
		. shortcode( 'cbmarkets_rate', array( 'from' => $evil, 'to' => $evil, 'decimals' => $evil ) )
		. shortcode( 'cbmarkets_convert', array( 'amount' => $evil, 'from' => 'USD', 'to' => 'EUR', 'decimals' => '99' ) )
		. shortcode( 'cbmarkets_rates', array( 'base' => 'USD', 'currencies' => $evil . ',EUR', 'theme' => $evil ) )
		. shortcode( 'cbmarkets_gold', array( 'country' => $evil ) )
		. shortcode( 'cbmarkets_gold', array( 'weight' => $evil, 'unit' => $evil, 'purity' => $evil, 'currency' => $evil ) )
		. cbmarkets_rates_block( array( 'align' => $evil, 'from' => $evil, 'theme' => array( $evil ) ) );
	lacks( $html, '<script' );
	lacks( $html, 'alert(1)' );
	has( $html, 'cbmarkets-converter cbmarkets-theme-light' );
	has( $html, '1 USD =' );
};

$checks['what the service sends is cleaned before it is kept'] = function () {
	boot();
	$rates = cbmarkets_rates_clean_rates(
		array(
			'data' => array(
				'rates' => array(
					'EUR'  => array( 'rate' => 0.9, 'source' => 'ecb<script>', 'time' => "2026-11-18T00:00:00.000Z\n<b>" ),
					'usd'  => array( 'rate' => 1 ),
					'GBPX' => array( 'rate' => 0.8 ),
					'JPY'  => array( 'rate' => 'many' ),
					'CHF'  => array( 'rate' => -1 ),
					'INR'  => 'eighty',
					'AED'  => array( 'rate' => '3.6725' ),
				),
			),
		)
	);
	check( array( 'AED', 'EUR' ) === array_keys( $rates['rates'] ), 'only well-formed rates: ' . implode( ',', array_keys( $rates['rates'] ) ) );
	check( 'ecbscript' === $rates['rates']['EUR']['source'] && '2026-11-18T00:00:00.000Z' === $rates['rates']['EUR']['time'], 'words are stripped of markup' );
	check( null === cbmarkets_rates_clean_rates( array( 'data' => array( 'rates' => array() ) ) ) && null === cbmarkets_rates_clean_rates( 'nonsense' ), 'an empty or malformed file is no file' );
	$gold = cbmarkets_rates_clean_gold(
		array(
			'data' => array(
				'usdPerOunce' => 3680.47,
				'time'        => '2026-11-19T15:53:27.851Z',
				'countries'   => array(
					array( 'country' => 'in', 'currency' => 'INR', 'unit' => 'ten<i>Grams', 'purity' => 'K24"', 'price' => 110401.76 ),
					array( 'country' => 'INDIA', 'currency' => 'INR', 'price' => 1 ),
					array( 'country' => 'TH', 'currency' => 'THB', 'price' => 'dear' ),
					'nonsense',
				),
			),
		)
	);
	check( array( 'IN' ) === array_keys( $gold['countries'] ) && 'teniGrams' === $gold['countries']['IN']['unit'] && 'k24' === $gold['countries']['IN']['purity'], 'countries are cleaned: ' . json_encode( $gold['countries'] ) );
	check( null === cbmarkets_rates_clean_gold( array( 'data' => array( 'usdPerOunce' => 0 ) ) ), 'a price of nothing is no file' );
};

$checks['settings: cleaned on the way in, and the page draws'] = function () {
	boot();
	update_option( 'cbmarkets_rates_options', array( 'show_credit' => 0, 'theme' => 'light', 'page' => 'https://shop.example.org/a/', 'site_key' => str_repeat( 'k', 32 ) ) );
	$saved = cbmarkets_rates_sanitize_options( array( 'show_credit' => '1', 'theme' => 'pink', 'page' => 'https://elsewhere.example.com/x', 'site_key' => 'changed-from-the-form-000000000' ) );
	check( array( 'show_credit' => 1, 'theme' => 'light', 'page' => 'https://shop.example.org/a/', 'site_key' => str_repeat( 'k', 32 ) ) === $saved, 'a bad theme, another site’s page and a new key are refused: ' . json_encode( $saved ) );
	check( 1 === count( $GLOBALS['cbm_test']['errors'] ), 'the administrator is told about the page' );
	$saved = cbmarkets_rates_sanitize_options( array( 'theme' => 'auto', 'page' => 'https://www.shop.example.org/b/' ) );
	check( 0 === $saved['show_credit'] && 'auto' === $saved['theme'] && 'https://www.shop.example.org/b/' === $saved['page'], 'an unticked box is off; a page of this site is taken' );
	check( $saved === cbmarkets_rates_sanitize_options( $saved ), 'cleaning twice changes nothing' );
	delete_option( 'cbmarkets_rates_options' );
	$first = cbmarkets_rates_sanitize_options( array( 'site_key' => str_repeat( 'Z', 32 ) ) );
	check( str_repeat( 'Z', 32 ) === $first['site_key'], 'the plugin’s own first key passes' );

	ob_start();
	cbmarkets_rates_settings_page();
	check( '' === ob_get_clean(), 'nothing for someone who may not manage options' );
	$GLOBALS['cbm_test']['can_manage'] = true;
	ob_start();
	cbmarkets_rates_settings_page();
	$page = ob_get_clean();
	has( $page, 'name="cbmarkets_rates_options[show_credit]"' );
	has( $page, 'name="cbmarkets_rates_options[theme]"' );
	has( $page, 'name="cbmarkets_rates_options[page]"' );
	has( $page, 'The rates service has not been asked for anything yet.' );
	has( $page, '[cbmarkets_converter]' );
	lacks( $page, 'site_key' );
	lacks( $page, str_repeat( 'k', 8 ) );
	$links = cbmarkets_rates_action_links( array( 'deactivate' => 'x' ) );
	has( $links[0], 'options-general.php?page=cbmarkets-rates' );
};

$checks['the stylesheet goes in the head of a page that uses the plugin'] = function () {
	on_page();
	boot();
	do_action( 'wp_enqueue_scripts' );
	check( isset( $GLOBALS['cbm_test']['enqueued']['style:cbmarkets-rates'] ), 'a page with the shortcode' );
	$GLOBALS['cbm_test']['enqueued']           = array();
	$GLOBALS['cbm_test']['post']->post_content = '<!-- wp:cbmarkets/converter /-->';
	do_action( 'wp_enqueue_scripts' );
	check( isset( $GLOBALS['cbm_test']['enqueued']['style:cbmarkets-rates'] ), 'a page with the block' );
	$GLOBALS['cbm_test']['enqueued']           = array();
	$GLOBALS['cbm_test']['post']->post_content = 'Nothing of ours.';
	do_action( 'wp_enqueue_scripts' );
	check( array() === $GLOBALS['cbm_test']['enqueued'], 'a page without it loads nothing' );
};

$checks['deleting the plugin removes what it kept'] = function () {
	update_option( 'cbmarkets_rates_options', array( 'site_key' => 'x' ) );
	foreach ( array( 'fresh_rates', 'fresh_gold', 'kept_rates', 'kept_gold', 'wait_rates', 'wait_gold', 'service_note' ) as $name ) {
		set_transient( 'cbmarkets_rates_' . $name, 1 );
	}
	define( 'WP_UNINSTALL_PLUGIN', true );
	require PLUGIN . 'uninstall.php';
	check( false === get_option( 'cbmarkets_rates_options' ), 'the option' );
	check( array() === $GLOBALS['cbm_test']['transients'], 'the kept rates: ' . implode( ',', array_keys( $GLOBALS['cbm_test']['transients'] ) ) );
};

$checks['the readme and the plugin agree'] = function () {
	$readme = file_get_contents( PLUGIN . 'readme.txt' );
	$main   = file_get_contents( PLUGIN . 'crystal-ball-markets-rates.php' );
	preg_match( '/^ \* Version:\s+(\S+)/m', $main, $version );
	has( $readme, 'Stable tag: ' . $version[1] );
	has( $main, "define( 'CBMARKETS_RATES_VERSION', '" . $version[1] . "' )" );
	has( file_get_contents( PLUGIN . 'assets/block/block.json' ), '"version": "' . $version[1] . '"' );
	has( $readme, '= ' . $version[1] . ' =' );
	foreach ( array( 'Requires at least', 'Requires PHP' ) as $field ) {
		preg_match( '/^ \* ' . $field . ':\s+(\S+)/m', $main, $m );
		has( $readme, $field . ': ' . $m[1] );
	}
	has( $readme, '== External services ==' );
	has( $readme, 'https://crystalballmarkets.com/markets/rates-api' );
	foreach ( array( 'cbmarkets_converter', 'cbmarkets_rate', 'cbmarkets_convert', 'cbmarkets_rates', 'cbmarkets_gold' ) as $tag ) {
		has( $readme, '[' . $tag );
	}
	preg_match( '/^Tags:\s*(.+)$/m', $readme, $tags );
	check( count( explode( ',', $tags[1] ) ) <= 5, 'at most five tags' );
	preg_match( '/^(?!=|Contributors|Tags|Requires|Tested|Stable|License)(\S.*)$/m', $readme, $short );
	check( strlen( $short[1] ) <= 150, 'the short description is ' . strlen( $short[1] ) . ' characters; the directory shows 150' );
	check( ! preg_match( '/[\x{2013}\x{2014}]/u', $readme ), 'no dashes as punctuation' );
};

// ---- running ----

$wanted = $argv[1] ?? '';
if ( '' !== $wanted ) {
	error_reporting( E_ALL );
	set_error_handler(
		function ( $level, $message, $file, $line ) {
			throw new ErrorException( $message . ' (' . basename( $file ) . ':' . $line . ')', 0, $level, $file, $line );
		}
	);
	require __DIR__ . '/stubs.php';
	try {
		$checks[ $wanted ]();
	} catch ( Throwable $e ) {
		fwrite( STDOUT, $e->getMessage() . ' [' . basename( $e->getFile() ) . ':' . $e->getLine() . ']' );
		exit( 1 );
	}
	exit( 0 );
}

$failed = 0;
foreach ( array_keys( $checks ) as $name ) {
	$output = array();
	exec( escapeshellarg( PHP_BINARY ) . ' ' . escapeshellarg( __FILE__ ) . ' ' . escapeshellarg( $name ) . ' 2>&1', $output, $status );
	if ( 0 === $status ) {
		echo "ok    $name\n";
	} else {
		++$failed;
		echo "FAIL  $name\n      " . implode( "\n      ", $output ) . "\n";
	}
}
echo $failed ? "\n$failed of " . count( $checks ) . " failed\n" : "\nAll " . count( $checks ) . " checks passed\n";
exit( $failed ? 1 : 0 );
