/**
 * The converter in the page. The rates arrive with the page (window.cbmarketsRatesData, written by the server);
 * every sum is done here (core.js) as the visitor types. Nothing is sent anywhere. The one thing kept is a pair
 * the visitor pins, in this browser's own storage, and only when they press Pin.
 */
( function () {
	'use strict';

	var core = window.cbmarketsRatesCore;
	var shared = window.cbmarketsRatesData;
	if ( ! core || ! shared || ! shared.rates || ! shared.gold ) {
		return;
	}

	var words = shared.words || {};
	var PIN_STORE = 'cbmarketsRatesPins';
	var PIN_EVENT = 'cbmarketsRatesPins';

	// ---- what the visitor pinned ----

	function readPins() {
		try {
			var list = JSON.parse( window.localStorage.getItem( PIN_STORE ) || '[]' );
			return Array.isArray( list ) ? list.filter( function ( p ) {
				return core.pairOf( p ) !== null;
			} ).slice( 0, core.MAX_PINS ) : [];
		} catch ( e ) {
			return [];
		}
	}

	function writePins( pins ) {
		try {
			window.localStorage.setItem( PIN_STORE, JSON.stringify( pins ) );
			return true;
		} catch ( e ) {
			return false;
		}
	}

	function canStore() {
		try {
			return !! window.localStorage && typeof window.localStorage.getItem === 'function';
		} catch ( e ) {
			return false;
		}
	}

	// ---- one converter ----

	function start( root ) {
		var config = {};
		try {
			config = JSON.parse( root.getAttribute( 'data-cbmarkets-converter' ) || '{}' ) || {};
		} catch ( e ) {
			config = {};
		}
		var rates = shared.rates;
		var gold = shared.gold;
		var lists = core.currencyLists( rates );
		var has = function ( code ) {
			return lists.all.indexOf( code ) >= 0;
		};
		var prefs = {
			tab: config.tab === 'gold' ? 'gold' : 'currency',
			from: has( config.from ) ? config.from : 'USD',
			to: has( config.to ) ? config.to : 'EUR',
			unit: Object.prototype.hasOwnProperty.call( core.UNITS, config.unit ) ? config.unit : 'gram',
			purity: Object.prototype.hasOwnProperty.call( core.PURITIES, config.purity ) ? config.purity : 'k24',
			goldCurrency: has( config.goldCurrency ) ? config.goldCurrency : 'USD'
		};
		var part = function ( name ) {
			return root.querySelector( '[data-cbmarkets="' + name + '"]' );
		};

		// ---- words and numbers, in the page's language ----

		var lang = root.getAttribute( 'lang' ) || document.documentElement.lang || navigator.language || 'en';
		try {
			new Intl.NumberFormat( lang );
		} catch ( e ) {
			lang = 'en';
		}
		var decimalMark = '.';
		try {
			new Intl.NumberFormat( lang ).formatToParts( 1.5 ).forEach( function ( p ) {
				if ( p.type === 'decimal' ) {
					decimalMark = p.value;
				}
			} );
		} catch ( e ) { /* an old browser: the English mark */ }

		var names = null;
		try {
			names = new Intl.DisplayNames( [ lang, 'en' ], { type: 'currency' } );
		} catch ( e ) { /* no names: the codes alone */ }
		function nameOf( code ) {
			try {
				var n = names ? names.of( code ) : '';
				return n && n !== code ? n : '';
			} catch ( e ) {
				return '';
			}
		}
		function digitsOf( code ) {
			try {
				return new Intl.NumberFormat( 'en', { style: 'currency', currency: code } ).resolvedOptions().maximumFractionDigits;
			} catch ( e ) {
				return 2;
			}
		}
		function fixed( value, digits ) {
			return new Intl.NumberFormat( lang, { minimumFractionDigits: digits, maximumFractionDigits: digits } ).format( value );
		}
		function plain( value ) {
			return new Intl.NumberFormat( lang, { maximumFractionDigits: 8 } ).format( value );
		}
		function money( value, code ) {
			return fixed( value, core.moneyDigits( value, digitsOf( code ) ) ) + ' ' + code;
		}
		/** A time today as "14:05", an earlier day as "18 Nov 2026". */
		function when( time ) {
			var d = new Date( time );
			if ( isNaN( d.getTime() ) ) {
				return '';
			}
			var now = new Date();
			var today = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
			return today
				? new Intl.DateTimeFormat( lang, { hour: '2-digit', minute: '2-digit' } ).format( d )
				: new Intl.DateTimeFormat( lang, { day: 'numeric', month: 'short', year: 'numeric' } ).format( d );
		}
		function sourceText( source ) {
			var sources = words.sources || {};
			return sources[ source ] || sources[ '' ] || '';
		}

		// ---- the lists ----

		function nameCurrencies() {
			[ 'from', 'to', 'gold-currency' ].forEach( function ( name ) {
				var select = part( name );
				if ( ! select ) {
					return;
				}
				Array.prototype.forEach.call( select.options, function ( o ) {
					var n = nameOf( o.value );
					if ( n ) {
						o.textContent = o.value + ' · ' + n;
					}
				} );
			} );
		}

		// ---- drawing ----

		function showCurrency() {
			var input = part( 'amount' );
			if ( ! input ) {
				return;
			}
			var amount = core.parseAmount( input.value, decimalMark );
			var from = prefs.from;
			var to = prefs.to;
			var value = amount === null ? null : core.convert( amount, from, to, rates );
			input.setAttribute( 'aria-invalid', String( amount === null && input.value.trim() !== '' ) );

			var rate = core.convert( 1, from, to, rates );
			part( 'currency-from' ).textContent = amount === null ? words.enterAmount : core.fill( words.amountIs, plain( amount ), from );
			part( 'currency-value' ).textContent = value === null ? '' : money( value, to );
			part( 'currency-rate' ).textContent = rate === null || from === to
				? ''
				: core.fill( words.oneIs, from, fixed( rate, core.rateDigits( rate ) ), to ) + ' · ' + core.fill( words.oneIs, to, fixed( 1 / rate, core.rateDigits( 1 / rate ) ), from );
			var legs = [ from, to ].filter( function ( c, i, a ) {
				return a.indexOf( c ) === i && c !== 'USD' && rates[ c ];
			} );
			part( 'currency-source' ).textContent = legs.map( function ( c ) {
				return core.fill( words.sourceOf, c, sourceText( rates[ c ].source ), when( rates[ c ].time ) );
			} ).join( ' · ' );

			var pins = readPins();
			var pinned = pins.indexOf( core.pairKey( from, to ) ) >= 0;
			var pin = part( 'pin' );
			pin.disabled = from === to || ( ! pinned && pins.length >= core.MAX_PINS );
			pin.setAttribute( 'aria-pressed', String( pinned ) );
			pin.textContent = pinned ? words.pinned : words.pin;
			pin.title = pinned ? words.unpinTitle : words.pinTitle;
			part( 'copy-currency' ).disabled = value === null;
			showPins( pins );
		}

		function showPins( all ) {
			var list = part( 'pin-list' );
			if ( ! list ) {
				return;
			}
			list.textContent = '';
			var pins = all.map( core.pairOf ).filter( function ( p ) {
				return p && core.convert( 1, p.from, p.to, rates ) !== null;
			} );
			part( 'pins' ).hidden = pins.length === 0;
			pins.forEach( function ( p ) {
				var rate = core.convert( 1, p.from, p.to, rates );
				var li = document.createElement( 'li' );
				var load = document.createElement( 'button' );
				load.type = 'button';
				load.className = 'cbmarkets-pin-load';
				load.setAttribute( 'aria-label', core.fill( words.loadPair, p.from, p.to, fixed( rate, core.rateDigits( rate ) ) ) );
				var pair = document.createElement( 'b' );
				pair.textContent = p.from + '/' + p.to;
				var figure = document.createElement( 'span' );
				figure.textContent = fixed( rate, Math.min( 4, core.rateDigits( rate ) ) );
				load.appendChild( pair );
				load.appendChild( figure );
				load.addEventListener( 'click', function () {
					prefs.from = p.from;
					prefs.to = p.to;
					part( 'from' ).value = p.from;
					part( 'to' ).value = p.to;
					draw();
				} );
				var remove = document.createElement( 'button' );
				remove.type = 'button';
				remove.className = 'cbmarkets-pin-remove';
				remove.textContent = '×';
				remove.setAttribute( 'aria-label', core.fill( words.removePair, p.from, p.to ) );
				remove.addEventListener( 'click', function () {
					setPins( core.togglePin( readPins(), core.pairKey( p.from, p.to ) ) );
				} );
				li.appendChild( load );
				li.appendChild( remove );
				list.appendChild( li );
			} );
		}

		function showGold() {
			var input = part( 'weight' );
			if ( ! input ) {
				return;
			}
			var weight = core.parseAmount( input.value, decimalMark );
			var unitWords = ( shared.units || {} )[ prefs.unit ] || {};
			var purityWords = ( shared.purities || {} )[ prefs.purity ] || {};
			var code = prefs.goldCurrency;
			var per = core.perUsd( code, rates );
			var value = weight === null || per === null ? null : core.goldValue( weight, core.UNITS[ prefs.unit ], core.PURITIES[ prefs.purity ], gold.usdPerOunce, per );
			input.setAttribute( 'aria-invalid', String( weight === null && input.value.trim() !== '' ) );

			part( 'gold-from' ).textContent = weight === null
				? words.enterWeight
				: core.fill( words.goldIs, plain( weight ), weight === 1 ? unitWords.one : unitWords.many, purityWords.label );
			part( 'gold-value' ).textContent = value === null ? '' : money( value, code );
			part( 'gold-spot' ).textContent = core.fill( words.spot, fixed( gold.usdPerOunce, 2 ), when( gold.time ) );
			part( 'copy-gold' ).disabled = value === null;

			var body = part( 'grades' );
			body.textContent = '';
			if ( per === null ) {
				return;
			}
			[ 'k24', 'k22', 'k18' ].forEach( function ( key ) {
				var row = document.createElement( 'tr' );
				var head = document.createElement( 'th' );
				head.scope = 'row';
				head.textContent = ( ( shared.purities || {} )[ key ] || {} ).label || key;
				var cell = document.createElement( 'td' );
				cell.textContent = money( core.goldValue( 1, 1, core.PURITIES[ key ], gold.usdPerOunce, per ), code );
				row.appendChild( head );
				row.appendChild( cell );
				body.appendChild( row );
			} );
		}

		function showStatus() {
			var status = part( 'status' );
			if ( ! status ) {
				return;
			}
			var time = when( shared.at );
			if ( shared.state === 'sample' ) {
				status.textContent = core.fill( words.sample, time ) + ' ' + ( words.sampleWhy || '' );
			} else if ( shared.state === 'kept' ) {
				status.textContent = core.fill( words.kept, time );
			} else {
				status.textContent = core.fill( words.updated, time );
			}
		}

		function draw() {
			[ 'currency', 'gold' ].forEach( function ( tab ) {
				var on = prefs.tab === tab;
				var button = root.querySelector( '[data-cbmarkets-tab="' + tab + '"]' );
				var panel = root.querySelector( '[data-cbmarkets-panel="' + tab + '"]' );
				if ( button ) {
					button.setAttribute( 'aria-selected', String( on ) );
					button.tabIndex = on ? 0 : -1;
				}
				if ( panel ) {
					panel.hidden = ! on;
				}
			} );
			showCurrency();
			showGold();
			showStatus();
		}

		function setPins( pins ) {
			writePins( pins );
			try {
				document.dispatchEvent( new CustomEvent( PIN_EVENT ) );
			} catch ( e ) {
				draw();
			}
		}

		// ---- controls ----

		function copy( button, text ) {
			if ( ! text || ! navigator.clipboard ) {
				return;
			}
			navigator.clipboard.writeText( text ).then( function () {
				button.textContent = words.copied;
				window.setTimeout( function () {
					button.textContent = words.copy;
				}, 1400 );
			} ).catch( function () { /* the clipboard is not available: nothing to do */ } );
		}

		function on( name, event, handler ) {
			var el = part( name );
			if ( el ) {
				el.addEventListener( event, handler );
			}
		}

		var tabs = Array.prototype.map.call( root.querySelectorAll( '[data-cbmarkets-tab]' ), function ( b ) {
			return b.getAttribute( 'data-cbmarkets-tab' );
		} );
		tabs.forEach( function ( tab ) {
			var button = root.querySelector( '[data-cbmarkets-tab="' + tab + '"]' );
			button.addEventListener( 'click', function () {
				prefs.tab = tab;
				draw();
			} );
			button.addEventListener( 'keydown', function ( e ) {
				if ( e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' ) {
					return;
				}
				e.preventDefault();
				prefs.tab = tabs[ ( tabs.indexOf( tab ) + 1 ) % tabs.length ];
				draw();
				root.querySelector( '[data-cbmarkets-tab="' + prefs.tab + '"]' ).focus();
			} );
		} );
		if ( ! tabs.length ) {
			prefs.tab = root.querySelector( '[data-cbmarkets-panel="gold"]' ) && ! root.querySelector( '[data-cbmarkets-panel="currency"]' ) ? 'gold' : 'currency';
		}

		on( 'amount', 'input', draw );
		on( 'weight', 'input', draw );
		on( 'from', 'change', function () {
			prefs.from = part( 'from' ).value;
			draw();
		} );
		on( 'to', 'change', function () {
			prefs.to = part( 'to' ).value;
			draw();
		} );
		on( 'unit', 'change', function () {
			prefs.unit = part( 'unit' ).value;
			draw();
		} );
		on( 'purity', 'change', function () {
			prefs.purity = part( 'purity' ).value;
			draw();
		} );
		on( 'gold-currency', 'change', function () {
			prefs.goldCurrency = part( 'gold-currency' ).value;
			draw();
		} );
		on( 'swap', 'click', function () {
			var was = prefs.from;
			prefs.from = prefs.to;
			prefs.to = was;
			part( 'from' ).value = prefs.from;
			part( 'to' ).value = prefs.to;
			draw();
		} );
		on( 'pin', 'click', function () {
			setPins( core.togglePin( readPins(), core.pairKey( prefs.from, prefs.to ) ) );
		} );
		on( 'copy-currency', 'click', function () {
			copy( part( 'copy-currency' ), part( 'currency-from' ).textContent + ' ' + part( 'currency-value' ).textContent );
		} );
		on( 'copy-gold', 'click', function () {
			copy( part( 'copy-gold' ), part( 'gold-from' ).textContent + ' ' + part( 'gold-value' ).textContent );
		} );
		document.addEventListener( PIN_EVENT, draw );

		// The buttons that need the script, or the browser's leave, appear only when they can work.
		if ( part( 'pin' ) && canStore() ) {
			part( 'pin' ).hidden = false;
		}
		if ( navigator.clipboard && typeof navigator.clipboard.writeText === 'function' ) {
			[ 'copy-currency', 'copy-gold' ].forEach( function ( name ) {
				if ( part( name ) ) {
					part( name ).hidden = false;
				}
			} );
		}

		nameCurrencies();
		[ 'from', 'to', 'gold-currency', 'unit', 'purity' ].forEach( function ( name ) {
			var select = part( name );
			var key = name === 'gold-currency' ? 'goldCurrency' : name;
			if ( select ) {
				select.value = prefs[ key ];
			}
		} );
		root.classList.add( 'cbmarkets-is-ready' );
		draw();
	}

	function boot() {
		Array.prototype.forEach.call( document.querySelectorAll( '[data-cbmarkets-converter]' ), function ( root ) {
			if ( root.getAttribute( 'data-cbmarkets-ready' ) ) {
				return;
			}
			root.setAttribute( 'data-cbmarkets-ready', '1' );
			start( root );
		} );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', boot );
	} else {
		boot();
	}
} )();
