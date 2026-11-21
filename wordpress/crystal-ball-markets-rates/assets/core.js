/**
 * The converter's sums: no page and no browser APIs, so the tests run them as they are.
 * Rates are units of a currency for one US dollar. The same sums run on the server (includes/sums.php).
 */
( function ( root ) {
	'use strict';

	var GRAMS_PER_TROY_OUNCE = 31.1034768;

	/** Weights gold is quoted in, in grams. */
	var UNITS = {
		gram: 1,
		ounce: GRAMS_PER_TROY_OUNCE,
		tola: 11.6638038,
		pavan: 8,
		baht: 15.244,
		tael: 37.429,
		kilogram: 1000
	};

	/** Gold purities: the share of the weight that is gold. */
	var PURITIES = { k24: 1, k22: 0.916, k21: 0.875, k18: 0.75, k14: 0.585 };

	/** Shown first in the currency lists when the rate file has them. */
	var COMMON = [ 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY', 'INR', 'AED' ];

	/** Pinned pairs kept: four fit under the result without crowding it. */
	var MAX_PINS = 4;

	function isNumber( v ) {
		return typeof v === 'number' && isFinite( v );
	}

	/**
	 * A typed amount as a number, or null. Takes "1,234.56", "1.234,56", "1 234,56" and "1'234.56": where a single
	 * mark could be either, the page's own decimal mark decides ("1,000" is a thousand in English and one in German).
	 */
	function parseAmount( text, decimal ) {
		var s = String( text === null || text === undefined ? '' : text ).trim().replace( /[\s  '’_]/g, '' );
		if ( ! s ) {
			return null;
		}
		var own = decimal === ',' ? ',' : '.';
		var lastDot = s.lastIndexOf( '.' );
		var lastComma = s.lastIndexOf( ',' );
		var dec = own;
		if ( lastDot >= 0 && lastComma >= 0 ) {
			dec = lastDot > lastComma ? '.' : ',';
		} else if ( lastDot >= 0 || lastComma >= 0 ) {
			var mark = lastDot >= 0 ? '.' : ',';
			var count = s.split( mark ).length - 1;
			var tail = s.length - 1 - s.lastIndexOf( mark );
			if ( count > 1 ) {
				dec = mark === '.' ? ',' : '.';
			} else if ( mark !== own && tail === 3 ) {
				dec = own;
			} else {
				dec = mark;
			}
		}
		var group = dec === '.' ? ',' : '.';
		s = s.split( group ).join( '' ).replace( dec, '.' );
		if ( ! /^\d*\.?\d*$/.test( s ) || ! /\d/.test( s ) ) {
			return null;
		}
		var n = Number( s );
		return isFinite( n ) ? n : null;
	}

	/** Units of `code` for one US dollar, or null when the file has no rate for it. */
	function perUsd( code, rates ) {
		if ( code === 'USD' ) {
			return 1;
		}
		var row = rates && Object.prototype.hasOwnProperty.call( rates, code ) ? rates[ code ] : null;
		var r = row ? row.rate : null;
		return isNumber( r ) && r > 0 ? r : null;
	}

	/** `amount` of `from` in `to`, or null when either rate is missing. */
	function convert( amount, from, to, rates ) {
		var a = perUsd( from, rates );
		var b = perUsd( to, rates );
		if ( a === null || b === null || ! isNumber( amount ) ) {
			return null;
		}
		return ( amount / a ) * b;
	}

	/** What `weight` units of gold of a purity are worth in a currency, from the dollar price of a troy ounce. */
	function goldValue( weight, unitGrams, fine, usdPerOunce, currencyPerUsd ) {
		var parts = [ weight, unitGrams, fine, usdPerOunce, currencyPerUsd ];
		for ( var i = 0; i < parts.length; i++ ) {
			if ( ! isNumber( parts[ i ] ) || parts[ i ] < 0 ) {
				return null;
			}
		}
		return ( ( weight * unitGrams ) / GRAMS_PER_TROY_OUNCE ) * fine * usdPerOunce * currencyPerUsd;
	}

	/**
	 * Decimals to show an amount of money with: the currency's own (2 for dollars, 0 for yen, 3 for dinars), and
	 * more for an amount so small that those would round it to nothing.
	 */
	function moneyDigits( value, currencyDigits ) {
		var digits = isNumber( currencyDigits ) ? currencyDigits : 2;
		var v = Math.abs( value );
		if ( ! ( v > 0 ) || v >= 1 ) {
			return digits;
		}
		var needed = 3 - Math.floor( Math.log10( v ) ) - 1;
		return Math.min( 8, Math.max( digits, needed ) );
	}

	/** Decimals that show a rate to about six significant figures. */
	function rateDigits( value ) {
		var v = Math.abs( value );
		if ( ! ( v > 0 ) ) {
			return 2;
		}
		return Math.min( 10, Math.max( 2, 5 - Math.floor( Math.log10( v ) ) ) );
	}

	/** The currency codes for the lists: the most used first, then the rest in order. */
	function currencyLists( rates ) {
		var all = Object.keys( rates || {} ).filter( function ( c ) {
			return /^[A-Z]{3}$/.test( c );
		} );
		if ( all.indexOf( 'USD' ) < 0 ) {
			all.push( 'USD' );
		}
		all.sort();
		var common = COMMON.filter( function ( c ) {
			return all.indexOf( c ) >= 0;
		} );
		return {
			common: common,
			rest: all.filter( function ( c ) {
				return common.indexOf( c ) < 0;
			} ),
			all: all
		};
	}

	/** A pinned pair's key, and back. */
	function pairKey( from, to ) {
		return from + '-' + to;
	}
	function pairOf( key ) {
		var m = /^([A-Z]{3})-([A-Z]{3})$/.exec( String( key ) );
		return m ? { from: m[ 1 ], to: m[ 2 ] } : null;
	}

	/** The pins with `key` added or taken out, newest first, never more than MAX_PINS. */
	function togglePin( pins, key ) {
		var list = Array.isArray( pins ) ? pins.filter( function ( p ) {
			return pairOf( p ) !== null;
		} ) : [];
		if ( list.indexOf( key ) >= 0 ) {
			return list.filter( function ( p ) {
				return p !== key;
			} );
		}
		return pairOf( key ) ? [ key ].concat( list ).slice( 0, MAX_PINS ) : list;
	}

	/** A sentence with its numbered places filled: fill( '%1$s to %2$s', 'USD', 'EUR' ). */
	function fill( template ) {
		var args = Array.prototype.slice.call( arguments, 1 );
		var next = 0;
		return String( template === null || template === undefined ? '' : template ).replace( /%(?:(\d+)\$)?s/g, function ( all, n ) {
			var value = args[ n ? Number( n ) - 1 : next++ ];
			return value === null || value === undefined ? '' : String( value );
		} );
	}

	var core = {
		GRAMS_PER_TROY_OUNCE: GRAMS_PER_TROY_OUNCE,
		UNITS: UNITS,
		PURITIES: PURITIES,
		COMMON: COMMON,
		MAX_PINS: MAX_PINS,
		parseAmount: parseAmount,
		perUsd: perUsd,
		convert: convert,
		goldValue: goldValue,
		moneyDigits: moneyDigits,
		rateDigits: rateDigits,
		currencyLists: currencyLists,
		pairKey: pairKey,
		pairOf: pairOf,
		togglePin: togglePin,
		fill: fill
	};

	if ( typeof module === 'object' && module && module.exports ) {
		module.exports = core;
	} else {
		root.cbmarketsRatesCore = core;
	}
} )( typeof window === 'undefined' ? this : window );
