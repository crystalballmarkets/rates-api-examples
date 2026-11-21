<?php
/**
 * What the plugin shows: the converter (a shortcode and a block) and four
 * small shortcodes. Every figure is worked out on this site, from the two rate
 * files (includes/data.php); the browser script (assets/converter.js) redoes
 * the same sums as the visitor types and sends nothing anywhere.
 *
 * @package CrystalBallMarketsRates
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the stylesheet, the two scripts and the block.
 *
 * @return void
 */
function cbmarkets_rates_register() {
	wp_register_style( 'cbmarkets-rates', CBMARKETS_RATES_URL . 'assets/converter.css', array(), CBMARKETS_RATES_VERSION );
	wp_register_script( 'cbmarkets-rates-core', CBMARKETS_RATES_URL . 'assets/core.js', array(), CBMARKETS_RATES_VERSION, true );
	wp_register_script( 'cbmarkets-rates-converter', CBMARKETS_RATES_URL . 'assets/converter.js', array( 'cbmarkets-rates-core' ), CBMARKETS_RATES_VERSION, true );

	register_block_type(
		CBMARKETS_RATES_DIR . 'assets/block',
		array( 'render_callback' => 'cbmarkets_rates_block' )
	);
	wp_set_script_translations( 'cbmarkets-converter-editor-script', 'crystal-ball-markets-rates' );

	add_shortcode( 'cbmarkets_converter', 'cbmarkets_rates_shortcode_converter' );
	add_shortcode( 'cbmarkets_rate', 'cbmarkets_rates_shortcode_rate' );
	add_shortcode( 'cbmarkets_convert', 'cbmarkets_rates_shortcode_convert' );
	add_shortcode( 'cbmarkets_rates', 'cbmarkets_rates_shortcode_rates' );
	add_shortcode( 'cbmarkets_gold', 'cbmarkets_rates_shortcode_gold' );
}
add_action( 'init', 'cbmarkets_rates_register' );

/**
 * Puts the stylesheet in the head of a page whose content uses the plugin, so
 * the figures are never seen unstyled. Anywhere else (a widget area, a
 * template) it is added when the shortcode runs.
 *
 * @return void
 */
function cbmarkets_rates_enqueue_early() {
	if ( ! is_singular() ) {
		return;
	}
	$post = get_queried_object();
	if ( ! $post instanceof WP_Post ) {
		return;
	}
	$uses = has_block( 'cbmarkets/converter', $post );
	foreach ( array( 'cbmarkets_converter', 'cbmarkets_rate', 'cbmarkets_convert', 'cbmarkets_rates', 'cbmarkets_gold' ) as $tag ) {
		$uses = $uses || has_shortcode( $post->post_content, $tag );
	}
	if ( $uses ) {
		wp_enqueue_style( 'cbmarkets-rates' );
	}
}
add_action( 'wp_enqueue_scripts', 'cbmarkets_rates_enqueue_early' );

/**
 * The link to Crystal Ball Markets, when the administrator has turned it on;
 * an empty string otherwise. The plugin never shows it without that choice.
 *
 * @param bool $inline True inside a sentence: shown once on a page, not after every figure.
 * @return string
 */
function cbmarkets_rates_credit( $inline = false ) {
	static $shown = false;
	$options = cbmarkets_rates_options();
	if ( empty( $options['show_credit'] ) || ( $inline && $shown ) ) {
		return '';
	}
	$shown = true;
	$link  = '<a href="https://crystalballmarkets.com/markets">' . esc_html__( 'Rates by Crystal Ball Markets', 'crystal-ball-markets-rates' ) . '</a>';
	return $inline ? ' <small class="cbmarkets-credit">' . $link . '</small>' : '<p class="cbmarkets-credit">' . $link . '</p>';
}

/**
 * A time as the site writes it: the hour for today, the day for an earlier day.
 *
 * @param int $at Seconds since 1970.
 * @return string
 */
function cbmarkets_rates_when( $at ) {
	$at = (int) $at;
	if ( wp_date( 'Y-m-d', $at ) === wp_date( 'Y-m-d' ) ) {
		return wp_date( get_option( 'time_format' ), $at );
	}
	return wp_date( get_option( 'date_format' ), $at );
}

/**
 * The line under the figures that says how old they are.
 *
 * @param array $file A rate file, as `cbmarkets_rates_file()` returns it.
 * @return string
 */
function cbmarkets_rates_status( $file ) {
	$when = cbmarkets_rates_when( $file['at'] );
	if ( 'sample' === $file['state'] ) {
		$why = cbmarkets_rates_is_test_site()
			? __( 'Live rates load on a public site.', 'crystal-ball-markets-rates' )
			: __( 'Live rates load once this is on a published page.', 'crystal-ball-markets-rates' );
		/* translators: %s: a date */
		return sprintf( __( 'Sample rates of %s.', 'crystal-ball-markets-rates' ), $when ) . ' ' . $why;
	}
	if ( 'kept' === $file['state'] ) {
		/* translators: %s: a time or a date */
		return sprintf( __( 'Could not update. Showing the rates of %s.', 'crystal-ball-markets-rates' ), $when );
	}
	/* translators: %s: a time or a date */
	return sprintf( __( 'Rates updated %s', 'crystal-ball-markets-rates' ), $when );
}

/**
 * What an administrator, and nobody else, is told when there is nothing to show.
 *
 * @return string
 */
function cbmarkets_rates_admin_hint() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return '';
	}
	$note = cbmarkets_rates_service_note();
	$said = $note ? $note['text'] : __( 'The rates could not be read.', 'crystal-ball-markets-rates' );
	return '<p class="cbmarkets-admin-hint">'
		. esc_html__( 'Crystal Ball Markets Rates (only administrators see this):', 'crystal-ball-markets-rates' ) . ' '
		. esc_html( $said ) . ' '
		. '<a href="' . esc_url( admin_url( 'options-general.php?page=cbmarkets-rates' ) ) . '">' . esc_html__( 'Open the settings', 'crystal-ball-markets-rates' ) . '</a>'
		. '</p>';
}

/**
 * An amount of money in words: "1,234.50 EUR".
 *
 * @param float  $value The amount.
 * @param string $code  Currency code.
 * @return string
 */
function cbmarkets_rates_money( $value, $code ) {
	return number_format_i18n( $value, cbmarkets_rates_money_digits( $value, cbmarkets_rates_currency_digits( $code ) ) ) . ' ' . $code;
}

/**
 * A number with no more decimals than it has, up to eight.
 *
 * @param float $value The number.
 * @return string
 */
function cbmarkets_rates_plain( $value ) {
	$text     = rtrim( rtrim( number_format( (float) $value, 8, '.', '' ), '0' ), '.' );
	$decimals = false === strpos( $text, '.' ) ? 0 : strlen( $text ) - strpos( $text, '.' ) - 1;
	return number_format_i18n( (float) $value, $decimals );
}

/**
 * Where a rate comes from, in words.
 *
 * @param string $source The source as the rates file names it.
 * @return string
 */
function cbmarkets_rates_source_text( $source ) {
	switch ( $source ) {
		case 'crystalballmarkets':
			return __( 'Crystal Ball Markets quote', 'crystal-ball-markets-rates' );
		case 'ecb':
			return __( 'European Central Bank reference rate', 'crystal-ball-markets-rates' );
		case 'peg':
			return __( 'official fixed rate', 'crystal-ball-markets-rates' );
		case 'central-bank':
			return __( 'central bank reference rate', 'crystal-ball-markets-rates' );
		case 'sample':
			return __( 'sample figure', 'crystal-ball-markets-rates' );
		default:
			return __( 'reference rate', 'crystal-ball-markets-rates' );
	}
}

/**
 * The weights of the converter's gold tab: for each, the name in its list, and one and many of it.
 *
 * @return array<string,array<string,string>>
 */
function cbmarkets_rates_unit_words() {
	return array(
		'gram'     => array(
			'label' => __( 'grams', 'crystal-ball-markets-rates' ),
			'one'   => __( 'gram', 'crystal-ball-markets-rates' ),
			'many'  => __( 'grams', 'crystal-ball-markets-rates' ),
		),
		'ounce'    => array(
			'label' => __( 'troy ounces', 'crystal-ball-markets-rates' ),
			'one'   => __( 'troy ounce', 'crystal-ball-markets-rates' ),
			'many'  => __( 'troy ounces', 'crystal-ball-markets-rates' ),
		),
		'tola'     => array(
			'label' => __( 'tolas', 'crystal-ball-markets-rates' ),
			'one'   => __( 'tola', 'crystal-ball-markets-rates' ),
			'many'  => __( 'tolas', 'crystal-ball-markets-rates' ),
		),
		'pavan'    => array(
			'label' => __( 'pavans (sovereigns)', 'crystal-ball-markets-rates' ),
			'one'   => __( 'pavan', 'crystal-ball-markets-rates' ),
			'many'  => __( 'pavans', 'crystal-ball-markets-rates' ),
		),
		'baht'     => array(
			'label' => __( 'baht (Thai gold weight)', 'crystal-ball-markets-rates' ),
			'one'   => __( 'baht', 'crystal-ball-markets-rates' ),
			'many'  => __( 'baht', 'crystal-ball-markets-rates' ),
		),
		'tael'     => array(
			'label' => __( 'taels (Hong Kong)', 'crystal-ball-markets-rates' ),
			'one'   => __( 'tael', 'crystal-ball-markets-rates' ),
			'many'  => __( 'taels', 'crystal-ball-markets-rates' ),
		),
		'kilogram' => array(
			'label' => __( 'kilograms', 'crystal-ball-markets-rates' ),
			'one'   => __( 'kilogram', 'crystal-ball-markets-rates' ),
			'many'  => __( 'kilograms', 'crystal-ball-markets-rates' ),
		),
	);
}

/**
 * The purities of the converter's gold tab: for each, its short name and its name in the list.
 *
 * @return array<string,array<string,string>>
 */
function cbmarkets_rates_purity_words() {
	return array(
		'k24' => array(
			'label' => '24K',
			'text'  => __( '24K (pure gold)', 'crystal-ball-markets-rates' ),
		),
		'k22' => array(
			'label' => '22K',
			'text'  => __( '22K (91.6% gold)', 'crystal-ball-markets-rates' ),
		),
		'k21' => array(
			'label' => '21K',
			'text'  => __( '21K (87.5% gold)', 'crystal-ball-markets-rates' ),
		),
		'k18' => array(
			'label' => '18K',
			'text'  => __( '18K (75% gold)', 'crystal-ball-markets-rates' ),
		),
		'k14' => array(
			'label' => '14K',
			'text'  => __( '14K (58.5% gold)', 'crystal-ball-markets-rates' ),
		),
	);
}

/**
 * A purity as an attribute may write it ("22k", "22", "k22"), as the key used here; an empty string when unknown.
 *
 * @param mixed $purity What was typed.
 * @return string
 */
function cbmarkets_rates_purity_key( $purity ) {
	$key = 'k' . preg_replace( '/[^0-9]/', '', (string) $purity );
	return array_key_exists( $key, cbmarkets_rates_purities() ) ? $key : '';
}

/**
 * The unit a country's gold is quoted in, in words, from the name the gold file gives it.
 *
 * @param string $unit The unit as the gold file names it.
 * @return string
 */
function cbmarkets_rates_country_unit( $unit ) {
	$words = array(
		'gram'       => __( 'gram', 'crystal-ball-markets-rates' ),
		'tenGrams'   => __( '10 grams', 'crystal-ball-markets-rates' ),
		'ounce'      => __( 'troy ounce', 'crystal-ball-markets-rates' ),
		'kilogram'   => __( 'kilogram', 'crystal-ball-markets-rates' ),
		'tola'       => __( 'tola', 'crystal-ball-markets-rates' ),
		'bhori'      => __( 'bhori', 'crystal-ball-markets-rates' ),
		'chi'        => __( 'chi', 'crystal-ball-markets-rates' ),
		'luong'      => __( 'luong', 'crystal-ball-markets-rates' ),
		'don'        => __( 'don', 'crystal-ball-markets-rates' ),
		'bahtWeight' => __( 'baht of gold', 'crystal-ball-markets-rates' ),
		'tael'       => __( 'tael', 'crystal-ball-markets-rates' ),
		'mithqal'    => __( 'mithqal', 'crystal-ball-markets-rates' ),
		'pavan'      => __( 'pavan', 'crystal-ball-markets-rates' ),
	);
	return isset( $words[ $unit ] ) ? $words[ $unit ] : strtolower( (string) preg_replace( '/(?<!^)([A-Z])/', ' $1', $unit ) );
}

/**
 * A purity as the gold file names it ("k22", "th965"), in words ("22K", "96.5%").
 *
 * @param string $purity The purity as the gold file names it.
 * @return string
 */
function cbmarkets_rates_country_purity( $purity ) {
	if ( preg_match( '/^k(\d{1,2})$/', $purity, $m ) ) {
		return $m[1] . 'K';
	}
	if ( preg_match( '/^[a-z]*(\d{3})$/', $purity, $m ) ) {
		return number_format_i18n( (int) $m[1] / 10, 1 ) . '%';
	}
	return strtoupper( $purity );
}

/**
 * The currency codes for the lists: the most used first, then the rest in order.
 *
 * @param array $rates The rates, by code.
 * @return array An array with `common`, `rest` and `all`.
 */
function cbmarkets_rates_currency_lists( $rates ) {
	$all = array_keys( $rates );
	if ( ! in_array( 'USD', $all, true ) ) {
		$all[] = 'USD';
	}
	sort( $all );
	$common = array_values( array_intersect( array( 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY', 'INR', 'AED' ), $all ) );
	return array(
		'common' => $common,
		'rest'   => array_values( array_diff( $all, $common ) ),
		'all'    => $all,
	);
}

/**
 * The words the browser script shows, in the site's language.
 *
 * @return array<string,string>
 */
function cbmarkets_rates_script_words() {
	return array(
		'enterAmount' => __( 'Enter an amount', 'crystal-ball-markets-rates' ),
		'enterWeight' => __( 'Enter a weight', 'crystal-ball-markets-rates' ),
		/* translators: 1: an amount, 2: a currency code */
		'amountIs'    => __( '%1$s %2$s =', 'crystal-ball-markets-rates' ),
		/* translators: 1: a currency code, 2: a rate, 3: a currency code */
		'oneIs'       => __( '1 %1$s = %2$s %3$s', 'crystal-ball-markets-rates' ),
		/* translators: 1: a currency code, 2: where its rate comes from, 3: a time or a date */
		'sourceOf'    => __( '%1$s: %2$s, %3$s', 'crystal-ball-markets-rates' ),
		/* translators: 1: a weight, 2: a unit of weight, 3: a purity such as 22K */
		'goldIs'      => __( '%1$s %2$s of %3$s gold =', 'crystal-ball-markets-rates' ),
		/* translators: 1: a price, 2: a time or a date */
		'spot'        => __( 'Gold: %1$s USD a troy ounce, %2$s', 'crystal-ball-markets-rates' ),
		'pin'         => __( 'Pin', 'crystal-ball-markets-rates' ),
		'pinned'      => __( 'Pinned', 'crystal-ball-markets-rates' ),
		'pinTitle'    => __( 'Keep this pair below for next time', 'crystal-ball-markets-rates' ),
		'unpinTitle'  => __( 'Remove this pair from your pinned pairs', 'crystal-ball-markets-rates' ),
		'copy'        => __( 'Copy', 'crystal-ball-markets-rates' ),
		'copied'      => __( 'Copied', 'crystal-ball-markets-rates' ),
		/* translators: 1: a currency code, 2: a currency code, 3: a rate */
		'loadPair'    => __( 'Convert %1$s to %2$s, rate %3$s', 'crystal-ball-markets-rates' ),
		/* translators: 1: a currency code, 2: a currency code */
		'removePair'  => __( 'Remove %1$s to %2$s', 'crystal-ball-markets-rates' ),
		'mostUsed'    => __( 'Most used', 'crystal-ball-markets-rates' ),
		'allMoney'    => __( 'All currencies', 'crystal-ball-markets-rates' ),
		/* translators: %s: a time or a date */
		'updated'     => __( 'Rates updated %s', 'crystal-ball-markets-rates' ),
		/* translators: %s: a time or a date */
		'kept'        => __( 'Could not update. Showing the rates of %s.', 'crystal-ball-markets-rates' ),
		/* translators: %s: a date */
		'sample'      => __( 'Sample rates of %s.', 'crystal-ball-markets-rates' ),
		'sampleWhy'   => cbmarkets_rates_is_test_site()
			? __( 'Live rates load on a public site.', 'crystal-ball-markets-rates' )
			: __( 'Live rates load once this is on a published page.', 'crystal-ball-markets-rates' ),
		'sources'     => array(
			'crystalballmarkets' => cbmarkets_rates_source_text( 'crystalballmarkets' ),
			'ecb'                => cbmarkets_rates_source_text( 'ecb' ),
			'peg'                => cbmarkets_rates_source_text( 'peg' ),
			'central-bank'       => cbmarkets_rates_source_text( 'central-bank' ),
			'sample'             => cbmarkets_rates_source_text( 'sample' ),
			''                   => cbmarkets_rates_source_text( '' ),
		),
	);
}

/**
 * Adds the stylesheet and the scripts to the page, with the rates the scripts work from.
 *
 * @param array $rates The rates file.
 * @param array $gold  The gold file.
 * @return void
 */
function cbmarkets_rates_enqueue_converter( $rates, $gold ) {
	static $done = false;
	wp_enqueue_style( 'cbmarkets-rates' );
	wp_enqueue_script( 'cbmarkets-rates-converter' );
	if ( $done ) {
		return;
	}
	$done = true;
	$data = array(
		'rates'    => $rates['data']['rates'],
		'gold'     => array(
			'usdPerOunce' => $gold['data']['usdPerOunce'],
			'time'        => $gold['data']['time'],
		),
		'at'       => min( (int) $rates['at'], (int) $gold['at'] ) * 1000,
		'state'    => 'live' === $rates['state'] && 'live' === $gold['state'] ? 'live' : ( 'sample' === $rates['state'] || 'sample' === $gold['state'] ? 'sample' : 'kept' ),
		'units'    => cbmarkets_rates_unit_words(),
		'purities' => cbmarkets_rates_purity_words(),
		'words'    => cbmarkets_rates_script_words(),
	);
	wp_add_inline_script( 'cbmarkets-rates-converter', 'window.cbmarketsRatesData = ' . wp_json_encode( $data ) . ';', 'before' );
}

/**
 * The converter's settings from a shortcode's or the block's attributes.
 *
 * @param array $atts  Attributes as written.
 * @param array $rates The rates, by code.
 * @return array
 */
function cbmarkets_rates_converter_config( $atts, $rates ) {
	$options = cbmarkets_rates_options();
	$atts    = shortcode_atts(
		array(
			'show'          => 'both',
			'tab'           => 'currency',
			'amount'        => '1',
			'from'          => 'USD',
			'to'            => 'EUR',
			'weight'        => '10',
			'unit'          => 'gram',
			'purity'        => '24k',
			'gold_currency' => 'USD',
			'theme'         => '',
		),
		$atts,
		'cbmarkets_converter'
	);

	$known = static function ( $code, $fallback ) use ( $rates ) {
		$code = cbmarkets_rates_code( $code );
		return null !== cbmarkets_rates_per_usd( $code, $rates ) ? $code : $fallback;
	};
	$show  = in_array( $atts['show'], array( 'both', 'currency', 'gold' ), true ) ? $atts['show'] : 'both';
	$tab   = 'both' === $show ? ( 'gold' === $atts['tab'] ? 'gold' : 'currency' ) : $show;
	$theme = in_array( $atts['theme'], cbmarkets_rates_themes(), true ) ? $atts['theme'] : $options['theme'];
	$from  = $known( $atts['from'], 'USD' );
	$unit  = sanitize_key( $atts['unit'] );

	return array(
		'show'         => $show,
		'tab'          => $tab,
		'amount'       => null !== cbmarkets_rates_amount( $atts['amount'] ) ? (string) $atts['amount'] : '1',
		'from'         => $from,
		'to'           => $known( $atts['to'], 'USD' === $from ? 'EUR' : 'USD' ),
		'weight'       => null !== cbmarkets_rates_amount( $atts['weight'] ) ? (string) $atts['weight'] : '10',
		'unit'         => array_key_exists( $unit, cbmarkets_rates_units() ) ? $unit : 'gram',
		'purity'       => '' !== cbmarkets_rates_purity_key( $atts['purity'] ) ? cbmarkets_rates_purity_key( $atts['purity'] ) : 'k24',
		'goldCurrency' => $known( $atts['gold_currency'], 'USD' ),
		'theme'        => in_array( $theme, cbmarkets_rates_themes(), true ) ? $theme : 'light',
	);
}

/**
 * The options of a currency list.
 *
 * @param array  $lists    The codes, as `cbmarkets_rates_currency_lists()` returns them.
 * @param string $selected The code chosen.
 * @return void
 */
function cbmarkets_rates_currency_options( $lists, $selected ) {
	$groups = array(
		__( 'Most used', 'crystal-ball-markets-rates' )      => $lists['common'],
		__( 'All currencies', 'crystal-ball-markets-rates' ) => $lists['rest'],
	);
	foreach ( $groups as $label => $codes ) {
		if ( ! $codes ) {
			continue;
		}
		echo '<optgroup label="' . esc_attr( $label ) . '">';
		foreach ( $codes as $code ) {
			echo '<option value="' . esc_attr( $code ) . '"' . selected( $selected, $code, false ) . '>' . esc_html( $code ) . '</option>';
		}
		echo '</optgroup>';
	}
}

/**
 * The converter: a currency converter and a gold value calculator in one card.
 *
 * @param array $atts Attributes of the shortcode or the block.
 * @return string
 */
function cbmarkets_rates_converter( $atts ) {
	$rates = cbmarkets_rates_file( 'rates' );
	$gold  = cbmarkets_rates_file( 'gold' );
	if ( ! $rates || ! $gold ) {
		wp_enqueue_style( 'cbmarkets-rates' );
		return '<div class="cbmarkets-converter cbmarkets-is-empty"><p class="cbmarkets-empty">' . esc_html__( 'The rates are unavailable right now.', 'crystal-ball-markets-rates' ) . '</p>' . cbmarkets_rates_admin_hint() . '</div>';
	}
	cbmarkets_rates_enqueue_converter( $rates, $gold );

	$by_code  = $rates['data']['rates'];
	$config   = cbmarkets_rates_converter_config( is_array( $atts ) ? $atts : array(), $by_code );
	$lists    = cbmarkets_rates_currency_lists( $by_code );
	$units    = cbmarkets_rates_unit_words();
	$purities = cbmarkets_rates_purity_words();
	$grams    = cbmarkets_rates_units();
	$fine     = cbmarkets_rates_purities();
	$id       = wp_unique_id( 'cbmarkets-' );
	$both     = 'both' === $config['show'];
	$state    = 'live' === $rates['state'] && 'live' === $gold['state'] ? 'live' : ( 'sample' === $rates['state'] || 'sample' === $gold['state'] ? 'sample' : 'kept' );
	$oldest   = (int) $rates['at'] <= (int) $gold['at'] ? $rates : $gold;
	// Which of the two tabs is open.
	$currency_on = 'currency' === $config['tab'];

	// The first figures, worked out here so the page reads the same before the script runs and without it.
	$amount = cbmarkets_rates_amount( $config['amount'] );
	$value  = cbmarkets_rates_convert( $amount, $config['from'], $config['to'], $by_code );
	$rate   = cbmarkets_rates_convert( 1, $config['from'], $config['to'], $by_code );
	$weight = cbmarkets_rates_amount( $config['weight'] );
	$per    = cbmarkets_rates_per_usd( $config['goldCurrency'], $by_code );
	$spot   = $gold['data']['usdPerOunce'];
	$worth  = cbmarkets_rates_gold_value( $weight, $grams[ $config['unit'] ], $fine[ $config['purity'] ], $spot, $per );

	$rate_line = '';
	if ( null !== $rate && $config['from'] !== $config['to'] ) {
		/* translators: 1: a currency code, 2: a rate, 3: a currency code */
		$one_is    = __( '1 %1$s = %2$s %3$s', 'crystal-ball-markets-rates' );
		$rate_line = sprintf( $one_is, $config['from'], number_format_i18n( $rate, cbmarkets_rates_rate_digits( $rate ) ), $config['to'] )
			. ' · ' . sprintf( $one_is, $config['to'], number_format_i18n( 1 / $rate, cbmarkets_rates_rate_digits( 1 / $rate ) ), $config['from'] );
	}
	$sources = array();
	foreach ( array_unique( array( $config['from'], $config['to'] ) ) as $code ) {
		if ( 'USD' !== $code && isset( $by_code[ $code ] ) ) {
			$time = strtotime( $by_code[ $code ]['time'] );
			/* translators: 1: a currency code, 2: where its rate comes from, 3: a time or a date */
			$sources[] = sprintf( __( '%1$s: %2$s, %3$s', 'crystal-ball-markets-rates' ), $code, cbmarkets_rates_source_text( $by_code[ $code ]['source'] ), $time ? cbmarkets_rates_when( $time ) : '' );
		}
	}
	$spot_time = strtotime( $gold['data']['time'] );

	$currency_lead = __( 'Enter an amount', 'crystal-ball-markets-rates' );
	if ( null !== $amount ) {
		/* translators: 1: an amount, 2: a currency code */
		$currency_lead = sprintf( __( '%1$s %2$s =', 'crystal-ball-markets-rates' ), cbmarkets_rates_plain( $amount ), $config['from'] );
	}
	$gold_lead = __( 'Enter a weight', 'crystal-ball-markets-rates' );
	if ( null !== $weight ) {
		/* translators: 1: a weight, 2: a unit of weight, 3: a purity such as 22K */
		$gold_lead = sprintf( __( '%1$s %2$s of %3$s gold =', 'crystal-ball-markets-rates' ), cbmarkets_rates_plain( $weight ), 1.0 === $weight ? $units[ $config['unit'] ]['one'] : $units[ $config['unit'] ]['many'], $purities[ $config['purity'] ]['label'] );
	}
	/* translators: 1: a price, 2: a time or a date */
	$spot_line = sprintf( __( 'Gold: %1$s USD a troy ounce, %2$s', 'crystal-ball-markets-rates' ), number_format_i18n( $spot, 2 ), $spot_time ? cbmarkets_rates_when( $spot_time ) : '' );

	ob_start();
	?>
	<div class="cbmarkets-converter cbmarkets-theme-<?php echo esc_attr( $config['theme'] ); ?>" data-cbmarkets-converter="<?php echo esc_attr( wp_json_encode( $config ) ); ?>" lang="<?php echo esc_attr( get_bloginfo( 'language' ) ); ?>">
		<?php if ( $both ) : ?>
		<div class="cbmarkets-top">
			<div class="cbmarkets-tabs" role="tablist" aria-label="<?php esc_attr_e( 'What to convert', 'crystal-ball-markets-rates' ); ?>">
				<button type="button" class="cbmarkets-tab" role="tab" id="<?php echo esc_attr( $id ); ?>-tab-currency" aria-controls="<?php echo esc_attr( $id ); ?>-panel-currency" aria-selected="<?php echo esc_attr( $currency_on ? 'true' : 'false' ); ?>" data-cbmarkets-tab="currency"<?php if ( ! $currency_on ) : ?> tabindex="-1"<?php endif; ?>><?php esc_html_e( 'Currency', 'crystal-ball-markets-rates' ); ?></button>
				<button type="button" class="cbmarkets-tab" role="tab" id="<?php echo esc_attr( $id ); ?>-tab-gold" aria-controls="<?php echo esc_attr( $id ); ?>-panel-gold" aria-selected="<?php echo esc_attr( $currency_on ? 'false' : 'true' ); ?>" data-cbmarkets-tab="gold"<?php if ( $currency_on ) : ?> tabindex="-1"<?php endif; ?>><?php esc_html_e( 'Gold', 'crystal-ball-markets-rates' ); ?></button>
			</div>
		</div>
		<?php endif; ?>

		<div class="cbmarkets-main">
			<?php if ( 'gold' !== $config['show'] ) : ?>
			<div class="cbmarkets-panel" data-cbmarkets-panel="currency" id="<?php echo esc_attr( $id ); ?>-panel-currency"<?php if ( $both ) : ?> role="tabpanel" aria-labelledby="<?php echo esc_attr( $id ); ?>-tab-currency"<?php endif; ?><?php if ( ! $currency_on ) : ?> hidden<?php endif; ?>>
				<label class="cbmarkets-field">
					<span class="cbmarkets-label"><?php esc_html_e( 'Amount', 'crystal-ball-markets-rates' ); ?></span>
					<input class="cbmarkets-input" data-cbmarkets="amount" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="<?php echo esc_attr( $config['amount'] ); ?>">
				</label>
				<div class="cbmarkets-pair">
					<label class="cbmarkets-field">
						<span class="cbmarkets-label"><?php esc_html_e( 'From', 'crystal-ball-markets-rates' ); ?></span>
						<select class="cbmarkets-select" data-cbmarkets="from"><?php cbmarkets_rates_currency_options( $lists, $config['from'] ); ?></select>
					</label>
					<button type="button" class="cbmarkets-icon" data-cbmarkets="swap" aria-label="<?php esc_attr_e( 'Swap the two currencies', 'crystal-ball-markets-rates' ); ?>" title="<?php esc_attr_e( 'Swap', 'crystal-ball-markets-rates' ); ?>">
						<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false"><path d="M6 3 2.5 6.5 6 10M2.5 6.5h13M14 10l3.5 3.5L14 17M17.5 13.5h-13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
					</button>
					<label class="cbmarkets-field">
						<span class="cbmarkets-label"><?php esc_html_e( 'To', 'crystal-ball-markets-rates' ); ?></span>
						<select class="cbmarkets-select" data-cbmarkets="to"><?php cbmarkets_rates_currency_options( $lists, $config['to'] ); ?></select>
					</label>
				</div>
				<div class="cbmarkets-result" aria-live="polite">
					<span class="cbmarkets-tools">
						<button type="button" class="cbmarkets-tool" data-cbmarkets="pin" aria-pressed="false" hidden><?php esc_html_e( 'Pin', 'crystal-ball-markets-rates' ); ?></button>
						<button type="button" class="cbmarkets-tool" data-cbmarkets="copy-currency" hidden><?php esc_html_e( 'Copy', 'crystal-ball-markets-rates' ); ?></button>
					</span>
					<p class="cbmarkets-small cbmarkets-lead" data-cbmarkets="currency-from"><?php echo esc_html( $currency_lead ); ?></p>
					<p class="cbmarkets-big"><output data-cbmarkets="currency-value"><?php echo esc_html( null === $value ? '' : cbmarkets_rates_money( $value, $config['to'] ) ); ?></output></p>
					<p class="cbmarkets-small" data-cbmarkets="currency-rate"><?php echo esc_html( $rate_line ); ?></p>
					<p class="cbmarkets-small cbmarkets-muted" data-cbmarkets="currency-source"><?php echo esc_html( implode( ' · ', $sources ) ); ?></p>
				</div>
				<div class="cbmarkets-pins" data-cbmarkets="pins" hidden>
					<p class="cbmarkets-label" id="<?php echo esc_attr( $id ); ?>-pins"><?php esc_html_e( 'Pinned pairs', 'crystal-ball-markets-rates' ); ?></p>
					<ul class="cbmarkets-pin-list" data-cbmarkets="pin-list" aria-labelledby="<?php echo esc_attr( $id ); ?>-pins"></ul>
				</div>
			</div>
			<?php endif; ?>

			<?php if ( 'currency' !== $config['show'] ) : ?>
			<div class="cbmarkets-panel" data-cbmarkets-panel="gold" id="<?php echo esc_attr( $id ); ?>-panel-gold"<?php if ( $both ) : ?> role="tabpanel" aria-labelledby="<?php echo esc_attr( $id ); ?>-tab-gold"<?php endif; ?><?php if ( $currency_on ) : ?> hidden<?php endif; ?>>
				<div class="cbmarkets-pair cbmarkets-two">
					<label class="cbmarkets-field">
						<span class="cbmarkets-label"><?php esc_html_e( 'Weight', 'crystal-ball-markets-rates' ); ?></span>
						<input class="cbmarkets-input" data-cbmarkets="weight" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="<?php echo esc_attr( $config['weight'] ); ?>">
					</label>
					<label class="cbmarkets-field">
						<span class="cbmarkets-label"><?php esc_html_e( 'Unit', 'crystal-ball-markets-rates' ); ?></span>
						<select class="cbmarkets-select" data-cbmarkets="unit">
							<?php foreach ( $units as $key => $words ) : ?>
							<option value="<?php echo esc_attr( $key ); ?>"<?php selected( $config['unit'], $key ); ?>><?php echo esc_html( $words['label'] ); ?></option>
							<?php endforeach; ?>
						</select>
					</label>
				</div>
				<div class="cbmarkets-pair cbmarkets-two">
					<label class="cbmarkets-field">
						<span class="cbmarkets-label"><?php esc_html_e( 'Purity', 'crystal-ball-markets-rates' ); ?></span>
						<select class="cbmarkets-select" data-cbmarkets="purity">
							<?php foreach ( $purities as $key => $words ) : ?>
							<option value="<?php echo esc_attr( $key ); ?>"<?php selected( $config['purity'], $key ); ?>><?php echo esc_html( $words['text'] ); ?></option>
							<?php endforeach; ?>
						</select>
					</label>
					<label class="cbmarkets-field">
						<span class="cbmarkets-label"><?php esc_html_e( 'Currency', 'crystal-ball-markets-rates' ); ?></span>
						<select class="cbmarkets-select" data-cbmarkets="gold-currency"><?php cbmarkets_rates_currency_options( $lists, $config['goldCurrency'] ); ?></select>
					</label>
				</div>
				<div class="cbmarkets-result" aria-live="polite">
					<span class="cbmarkets-tools">
						<button type="button" class="cbmarkets-tool" data-cbmarkets="copy-gold" hidden><?php esc_html_e( 'Copy', 'crystal-ball-markets-rates' ); ?></button>
					</span>
					<p class="cbmarkets-small cbmarkets-lead" data-cbmarkets="gold-from"><?php echo esc_html( $gold_lead ); ?></p>
					<p class="cbmarkets-big"><output data-cbmarkets="gold-value"><?php echo esc_html( null === $worth ? '' : cbmarkets_rates_money( $worth, $config['goldCurrency'] ) ); ?></output></p>
					<p class="cbmarkets-small" data-cbmarkets="gold-spot"><?php echo esc_html( $spot_line ); ?></p>
				</div>
				<table class="cbmarkets-grades">
					<caption class="cbmarkets-label"><?php esc_html_e( 'Per gram, by purity', 'crystal-ball-markets-rates' ); ?></caption>
					<tbody data-cbmarkets="grades">
						<?php foreach ( array( 'k24', 'k22', 'k18' ) as $key ) : ?>
						<tr>
							<th scope="row"><?php echo esc_html( $purities[ $key ]['label'] ); ?></th>
							<td><?php echo esc_html( null === $per ? '' : cbmarkets_rates_money( cbmarkets_rates_gold_value( 1, 1, $fine[ $key ], $spot, $per ), $config['goldCurrency'] ) ); ?></td>
						</tr>
						<?php endforeach; ?>
					</tbody>
				</table>
				<p class="cbmarkets-note"><?php esc_html_e( 'The value of the gold itself at the international price. Shop prices add local duty, tax and making charges.', 'crystal-ball-markets-rates' ); ?></p>
			</div>
			<?php endif; ?>
		</div>

		<div class="cbmarkets-foot">
			<p class="<?php echo esc_attr( 'live' === $state ? 'cbmarkets-status' : 'cbmarkets-status cbmarkets-late' ); ?>" data-cbmarkets="status"><?php echo esc_html( cbmarkets_rates_status( array_merge( $oldest, array( 'state' => $state ) ) ) ); ?></p>
			<?php echo wp_kses_post( cbmarkets_rates_credit() ); ?>
			<p class="cbmarkets-legal"><?php esc_html_e( 'Indicative rates for information only, not an offer to buy or sell.', 'crystal-ball-markets-rates' ); ?></p>
		</div>
	</div>
	<?php
	return (string) ob_get_clean();
}

/**
 * [cbmarkets_converter]: the converter.
 *
 * @param array|string $atts Attributes.
 * @return string
 */
function cbmarkets_rates_shortcode_converter( $atts ) {
	return cbmarkets_rates_converter( is_array( $atts ) ? $atts : array() );
}

/**
 * The block: the same converter, with the block's attributes.
 *
 * @param array $attributes The block's attributes.
 * @return string
 */
function cbmarkets_rates_block( $attributes ) {
	$attributes = is_array( $attributes ) ? $attributes : array();
	$atts       = array();
	$names      = array(
		'show'         => 'show',
		'tab'          => 'tab',
		'amount'       => 'amount',
		'from'         => 'from',
		'to'           => 'to',
		'weight'       => 'weight',
		'unit'         => 'unit',
		'purity'       => 'purity',
		'goldCurrency' => 'gold_currency',
		'theme'        => 'theme',
	);
	foreach ( $names as $attribute => $att ) {
		if ( isset( $attributes[ $attribute ] ) && is_scalar( $attributes[ $attribute ] ) ) {
			$atts[ $att ] = (string) $attributes[ $attribute ];
		}
	}
	$align = isset( $attributes['align'] ) && in_array( $attributes['align'], array( 'left', 'center', 'right' ), true ) ? ' cbmarkets-align-' . $attributes['align'] : '';
	return '<div class="wp-block-cbmarkets-converter' . esc_attr( $align ) . '">' . cbmarkets_rates_converter( $atts ) . '</div>';
}

/**
 * The rates for a small shortcode, or null with nothing to show.
 *
 * @return array|null
 */
function cbmarkets_rates_for_shortcode() {
	$file = cbmarkets_rates_file( 'rates' );
	if ( $file ) {
		wp_enqueue_style( 'cbmarkets-rates' );
	}
	return $file;
}

/**
 * A small line saying the figures are a sample, on a site that shows the sample.
 *
 * @param array $file A rate file.
 * @return string
 */
function cbmarkets_rates_sample_mark( $file ) {
	if ( 'sample' !== $file['state'] ) {
		return '';
	}
	return ' <small class="cbmarkets-sample">' . esc_html( cbmarkets_rates_status( $file ) ) . '</small>';
}

/**
 * [cbmarkets_rate from="USD" to="EUR"]: one exchange rate, in a sentence.
 *
 * @param array|string $atts Attributes.
 * @return string
 */
function cbmarkets_rates_shortcode_rate( $atts ) {
	$atts = shortcode_atts(
		array(
			'from'     => 'USD',
			'to'       => 'EUR',
			'decimals' => '',
		),
		$atts,
		'cbmarkets_rate'
	);
	$file = cbmarkets_rates_for_shortcode();
	if ( ! $file ) {
		return cbmarkets_rates_admin_hint();
	}
	$from = cbmarkets_rates_code( $atts['from'] );
	$to   = cbmarkets_rates_code( $atts['to'] );
	$rate = cbmarkets_rates_convert( 1, $from, $to, $file['data']['rates'] );
	if ( null === $rate ) {
		return '';
	}
	$decimals = '' === $atts['decimals'] ? cbmarkets_rates_rate_digits( $rate ) : min( 10, absint( $atts['decimals'] ) );
	/* translators: 1: a currency code, 2: a rate, 3: a currency code */
	$text = sprintf( __( '1 %1$s = %2$s %3$s', 'crystal-ball-markets-rates' ), $from, number_format_i18n( $rate, $decimals ), $to );
	return '<span class="cbmarkets-figure">' . esc_html( $text ) . '</span>' . cbmarkets_rates_sample_mark( $file ) . cbmarkets_rates_credit( true );
}

/**
 * [cbmarkets_convert amount="100" from="GBP" to="NGN"]: a converted amount, in a sentence.
 *
 * @param array|string $atts Attributes.
 * @return string
 */
function cbmarkets_rates_shortcode_convert( $atts ) {
	$atts = shortcode_atts(
		array(
			'amount'   => '1',
			'from'     => 'USD',
			'to'       => 'EUR',
			'decimals' => '',
		),
		$atts,
		'cbmarkets_convert'
	);
	$file = cbmarkets_rates_for_shortcode();
	if ( ! $file ) {
		return cbmarkets_rates_admin_hint();
	}
	$from   = cbmarkets_rates_code( $atts['from'] );
	$to     = cbmarkets_rates_code( $atts['to'] );
	$amount = cbmarkets_rates_amount( $atts['amount'] );
	$value  = null === $amount ? null : cbmarkets_rates_convert( $amount, $from, $to, $file['data']['rates'] );
	if ( null === $value ) {
		return '';
	}
	$result = '' === $atts['decimals'] ? cbmarkets_rates_money( $value, $to ) : number_format_i18n( $value, min( 10, absint( $atts['decimals'] ) ) ) . ' ' . $to;
	/* translators: 1: an amount with its currency code, 2: the same amount in another currency */
	$text = sprintf( __( '%1$s = %2$s', 'crystal-ball-markets-rates' ), cbmarkets_rates_plain( $amount ) . ' ' . $from, $result );
	return '<span class="cbmarkets-figure">' . esc_html( $text ) . '</span>' . cbmarkets_rates_sample_mark( $file ) . cbmarkets_rates_credit( true );
}

/**
 * [cbmarkets_rates base="USD" currencies="EUR,GBP,JPY,INR"]: a table of rates.
 *
 * @param array|string $atts Attributes.
 * @return string
 */
function cbmarkets_rates_shortcode_rates( $atts ) {
	$atts = shortcode_atts(
		array(
			'base'       => 'USD',
			'currencies' => 'EUR,GBP,JPY,CNY,INR',
			'decimals'   => '',
			'theme'      => '',
		),
		$atts,
		'cbmarkets_rates'
	);
	$file = cbmarkets_rates_for_shortcode();
	if ( ! $file ) {
		return cbmarkets_rates_admin_hint();
	}
	$options = cbmarkets_rates_options();
	$theme   = in_array( $atts['theme'], cbmarkets_rates_themes(), true ) ? $atts['theme'] : $options['theme'];
	$base    = cbmarkets_rates_code( $atts['base'] );
	if ( null === cbmarkets_rates_per_usd( $base, $file['data']['rates'] ) ) {
		return '';
	}
	$rows = '';
	foreach ( array_slice( array_unique( array_filter( array_map( 'cbmarkets_rates_code', explode( ',', (string) $atts['currencies'] ) ) ) ), 0, 80 ) as $code ) {
		$rate = cbmarkets_rates_convert( 1, $base, $code, $file['data']['rates'] );
		if ( null === $rate || $code === $base ) {
			continue;
		}
		$decimals = '' === $atts['decimals'] ? cbmarkets_rates_rate_digits( $rate ) : min( 10, absint( $atts['decimals'] ) );
		$rows    .= '<tr><th scope="row">' . esc_html( $code ) . '</th><td>' . esc_html( number_format_i18n( $rate, $decimals ) ) . '</td></tr>';
	}
	if ( '' === $rows ) {
		return '';
	}
	/* translators: %s: a currency code */
	$heading = sprintf( __( 'Per 1 %s', 'crystal-ball-markets-rates' ), $base );
	return '<div class="cbmarkets-card cbmarkets-theme-' . esc_attr( $theme ) . '">'
		. '<table class="cbmarkets-table"><thead><tr><th scope="col">' . esc_html__( 'Currency', 'crystal-ball-markets-rates' ) . '</th><th scope="col">' . esc_html( $heading ) . '</th></tr></thead><tbody>' . $rows . '</tbody></table>'
		. '<p class="cbmarkets-status' . ( 'live' === $file['state'] ? '' : ' cbmarkets-late' ) . '">' . esc_html( cbmarkets_rates_status( $file ) ) . '</p>'
		. wp_kses_post( cbmarkets_rates_credit() )
		. '</div>';
}

/**
 * [cbmarkets_gold country="IN"]: the gold price in a country, in its own money and unit.
 * [cbmarkets_gold weight="10" unit="gram" purity="22k" currency="INR"]: what a weight of gold is worth.
 *
 * @param array|string $atts Attributes.
 * @return string
 */
function cbmarkets_rates_shortcode_gold( $atts ) {
	$atts = shortcode_atts(
		array(
			'country'  => '',
			'weight'   => '1',
			'unit'     => 'gram',
			'purity'   => '24k',
			'currency' => 'USD',
		),
		$atts,
		'cbmarkets_gold'
	);
	$gold = cbmarkets_rates_file( 'gold' );
	$file = $gold ? cbmarkets_rates_for_shortcode() : null;
	if ( ! $gold || ! $file ) {
		return cbmarkets_rates_admin_hint();
	}
	$mark = cbmarkets_rates_sample_mark( $gold );

	$country = strtoupper( trim( (string) $atts['country'] ) );
	if ( '' !== $country ) {
		if ( ! isset( $gold['data']['countries'][ $country ] ) ) {
			return '';
		}
		$row = $gold['data']['countries'][ $country ];
		/* translators: 1: a price with its currency code, 2: a unit of weight such as "10 grams", 3: a purity such as 24K */
		$text = sprintf( __( '%1$s per %2$s (%3$s)', 'crystal-ball-markets-rates' ), cbmarkets_rates_money( $row['price'], $row['currency'] ), cbmarkets_rates_country_unit( $row['unit'] ), cbmarkets_rates_country_purity( $row['purity'] ) );
		return '<span class="cbmarkets-figure">' . esc_html( $text ) . '</span>' . $mark . cbmarkets_rates_credit( true );
	}

	$units    = cbmarkets_rates_units();
	$fine     = cbmarkets_rates_purities();
	$unit     = sanitize_key( $atts['unit'] );
	$purity   = cbmarkets_rates_purity_key( $atts['purity'] );
	$currency = cbmarkets_rates_code( $atts['currency'] );
	$weight   = cbmarkets_rates_amount( $atts['weight'] );
	$per      = cbmarkets_rates_per_usd( $currency, $file['data']['rates'] );
	if ( ! isset( $units[ $unit ] ) || '' === $purity || null === $weight || null === $per ) {
		return '';
	}
	$value = cbmarkets_rates_gold_value( $weight, $units[ $unit ], $fine[ $purity ], $gold['data']['usdPerOunce'], $per );
	if ( null === $value ) {
		return '';
	}
	$unit_words   = cbmarkets_rates_unit_words();
	$purity_words = cbmarkets_rates_purity_words();
	/* translators: 1: a weight, 2: a unit of weight, 3: a purity such as 22K */
	$lead = sprintf( __( '%1$s %2$s of %3$s gold =', 'crystal-ball-markets-rates' ), cbmarkets_rates_plain( $weight ), 1.0 === $weight ? $unit_words[ $unit ]['one'] : $unit_words[ $unit ]['many'], $purity_words[ $purity ]['label'] );
	return '<span class="cbmarkets-figure">' . esc_html( $lead . ' ' . cbmarkets_rates_money( $value, $currency ) ) . '</span>' . $mark . cbmarkets_rates_credit( true );
}
