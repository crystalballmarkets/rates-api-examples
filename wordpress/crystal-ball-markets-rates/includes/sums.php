<?php
/**
 * The sums: currency conversion, the value of a weight of gold, and how many
 * decimals a figure is shown with. No WordPress calls, so they can be tested
 * as they are. The same sums run in the browser (assets/core.js).
 *
 * Rates are units of a currency for one US dollar, as the rates file gives them.
 *
 * @package CrystalBallMarketsRates
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CBMARKETS_RATES_GRAMS_PER_TROY_OUNCE', 31.1034768 );

/**
 * Weights gold is quoted in, in grams.
 *
 * @return array<string,float>
 */
function cbmarkets_rates_units() {
	return array(
		'gram'     => 1.0,
		'ounce'    => CBMARKETS_RATES_GRAMS_PER_TROY_OUNCE,
		'tola'     => 11.6638038,
		'pavan'    => 8.0,
		'baht'     => 15.244,
		'tael'     => 37.429,
		'kilogram' => 1000.0,
	);
}

/**
 * Gold purities: the share of the weight that is gold.
 *
 * @return array<string,float>
 */
function cbmarkets_rates_purities() {
	return array(
		'k24' => 1.0,
		'k22' => 0.916,
		'k21' => 0.875,
		'k18' => 0.75,
		'k14' => 0.585,
	);
}

/**
 * A currency code as the rates file writes it, or an empty string.
 *
 * @param mixed $code What was typed.
 * @return string
 */
function cbmarkets_rates_code( $code ) {
	$code = strtoupper( trim( (string) $code ) );
	return preg_match( '/^[A-Z]{3}$/', $code ) ? $code : '';
}

/**
 * Units of a currency for one US dollar, or null when the file has no rate for it.
 *
 * @param string $code  Currency code.
 * @param array  $rates The rates, by code: each an array with a `rate`.
 * @return float|null
 */
function cbmarkets_rates_per_usd( $code, $rates ) {
	$code = cbmarkets_rates_code( $code );
	if ( 'USD' === $code ) {
		return 1.0;
	}
	if ( '' === $code || ! isset( $rates[ $code ]['rate'] ) ) {
		return null;
	}
	$rate = (float) $rates[ $code ]['rate'];
	return $rate > 0 && is_finite( $rate ) ? $rate : null;
}

/**
 * An amount of one currency in another, or null when either rate is missing.
 *
 * @param float  $amount The amount.
 * @param string $from   Currency it is in.
 * @param string $to     Currency wanted.
 * @param array  $rates  The rates, by code.
 * @return float|null
 */
function cbmarkets_rates_convert( $amount, $from, $to, $rates ) {
	$a = cbmarkets_rates_per_usd( $from, $rates );
	$b = cbmarkets_rates_per_usd( $to, $rates );
	if ( null === $a || null === $b || ! is_numeric( $amount ) || ! is_finite( (float) $amount ) ) {
		return null;
	}
	return ( (float) $amount / $a ) * $b;
}

/**
 * What a weight of gold of a purity is worth in a currency, from the dollar price of a troy ounce.
 *
 * @param float $weight           How many units.
 * @param float $unit_grams       Grams in one unit.
 * @param float $fine             Share of the weight that is gold.
 * @param float $usd_per_ounce    Dollar price of a troy ounce.
 * @param float $currency_per_usd Units of the currency for one dollar.
 * @return float|null
 */
function cbmarkets_rates_gold_value( $weight, $unit_grams, $fine, $usd_per_ounce, $currency_per_usd ) {
	foreach ( array( $weight, $unit_grams, $fine, $usd_per_ounce, $currency_per_usd ) as $part ) {
		if ( ! is_numeric( $part ) || ! is_finite( (float) $part ) || (float) $part < 0 ) {
			return null;
		}
	}
	return ( ( (float) $weight * (float) $unit_grams ) / CBMARKETS_RATES_GRAMS_PER_TROY_OUNCE ) * (float) $fine * (float) $usd_per_ounce * (float) $currency_per_usd;
}

/**
 * The decimals a currency is written with: none for yen, three for dinars, two for most.
 *
 * @param string $code Currency code.
 * @return int
 */
function cbmarkets_rates_currency_digits( $code ) {
	$none  = array( 'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF' );
	$three = array( 'BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND' );
	if ( in_array( $code, $none, true ) ) {
		return 0;
	}
	return in_array( $code, $three, true ) ? 3 : 2;
}

/**
 * Decimals to show an amount of money with: the currency's own, and more for
 * an amount so small that those would round it to nothing.
 *
 * @param float $value           The amount.
 * @param int   $currency_digits The currency's own decimals.
 * @return int
 */
function cbmarkets_rates_money_digits( $value, $currency_digits = 2 ) {
	$v = abs( (float) $value );
	if ( ! ( $v > 0 ) || $v >= 1 ) {
		return (int) $currency_digits;
	}
	$needed = 3 - (int) floor( log10( $v ) ) - 1;
	return (int) min( 8, max( (int) $currency_digits, $needed ) );
}

/**
 * Decimals that show a rate to about six significant figures.
 *
 * @param float $value The rate.
 * @return int
 */
function cbmarkets_rates_rate_digits( $value ) {
	$v = abs( (float) $value );
	if ( ! ( $v > 0 ) ) {
		return 2;
	}
	return (int) min( 10, max( 2, 5 - (int) floor( log10( $v ) ) ) );
}

/**
 * A typed amount as a number, or null: takes "1,234.56" and "1234.56".
 * Shortcode attributes are written by the site's editor, so the English form is enough here;
 * what a visitor types is read in the browser, in the visitor's own form.
 *
 * @param mixed $text What was typed.
 * @return float|null
 */
function cbmarkets_rates_amount( $text ) {
	$s = str_replace( array( ',', ' ', '_' ), '', trim( (string) $text ) );
	if ( '' === $s || ! preg_match( '/^\d*\.?\d*$/', $s ) || ! preg_match( '/\d/', $s ) ) {
		return null;
	}
	$n = (float) $s;
	return is_finite( $n ) ? $n : null;
}
