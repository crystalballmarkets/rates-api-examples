/**
 * The block in the editor: its settings in the side panel, and the converter as the server draws it.
 * Written without a build step, so the file in the plugin is the source.
 */
( function ( wp ) {
	'use strict';

	var el = wp.element.createElement;
	var __ = wp.i18n.__;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var useBlockProps = wp.blockEditor.useBlockProps;
	var PanelBody = wp.components.PanelBody;
	var SelectControl = wp.components.SelectControl;
	var TextControl = wp.components.TextControl;
	var Disabled = wp.components.Disabled;
	// The component itself in most versions of WordPress; a module that holds it in others.
	var ServerSideRender = ( wp.serverSideRender && ( wp.serverSideRender.ServerSideRender || wp.serverSideRender.default ) ) || wp.serverSideRender;

	var UNITS = [
		{ value: 'gram', label: __( 'grams', 'crystal-ball-markets-rates' ) },
		{ value: 'ounce', label: __( 'troy ounces', 'crystal-ball-markets-rates' ) },
		{ value: 'tola', label: __( 'tolas', 'crystal-ball-markets-rates' ) },
		{ value: 'pavan', label: __( 'pavans (sovereigns)', 'crystal-ball-markets-rates' ) },
		{ value: 'baht', label: __( 'baht (Thai gold weight)', 'crystal-ball-markets-rates' ) },
		{ value: 'tael', label: __( 'taels (Hong Kong)', 'crystal-ball-markets-rates' ) },
		{ value: 'kilogram', label: __( 'kilograms', 'crystal-ball-markets-rates' ) }
	];
	var PURITIES = [ '24k', '22k', '21k', '18k', '14k' ].map( function ( p ) {
		return { value: p, label: p.toUpperCase() };
	} );

	function code( value ) {
		return String( value || '' ).toUpperCase().replace( /[^A-Z]/g, '' ).slice( 0, 3 );
	}

	function Edit( props ) {
		var a = props.attributes;
		var set = props.setAttributes;
		var showsCurrency = a.show !== 'gold';
		var showsGold = a.show !== 'currency';

		return el(
			wp.element.Fragment,
			null,
			el(
				InspectorControls,
				null,
				el(
					PanelBody,
					{ title: __( 'Converter', 'crystal-ball-markets-rates' ), initialOpen: true },
					el( SelectControl, {
						label: __( 'Show', 'crystal-ball-markets-rates' ),
						value: a.show,
						options: [
							{ value: 'both', label: __( 'Currency and gold, in two tabs', 'crystal-ball-markets-rates' ) },
							{ value: 'currency', label: __( 'The currency converter alone', 'crystal-ball-markets-rates' ) },
							{ value: 'gold', label: __( 'The gold calculator alone', 'crystal-ball-markets-rates' ) }
						],
						onChange: function ( v ) {
							set( { show: v } );
						}
					} ),
					a.show === 'both' && el( SelectControl, {
						label: __( 'Open on', 'crystal-ball-markets-rates' ),
						value: a.tab,
						options: [
							{ value: 'currency', label: __( 'Currency', 'crystal-ball-markets-rates' ) },
							{ value: 'gold', label: __( 'Gold', 'crystal-ball-markets-rates' ) }
						],
						onChange: function ( v ) {
							set( { tab: v } );
						}
					} ),
					el( SelectControl, {
						label: __( 'Colours', 'crystal-ball-markets-rates' ),
						value: a.theme,
						options: [
							{ value: '', label: __( 'As set under Settings', 'crystal-ball-markets-rates' ) },
							{ value: 'light', label: __( 'Light', 'crystal-ball-markets-rates' ) },
							{ value: 'dark', label: __( 'Dark', 'crystal-ball-markets-rates' ) },
							{ value: 'auto', label: __( 'The visitor’s own setting', 'crystal-ball-markets-rates' ) }
						],
						onChange: function ( v ) {
							set( { theme: v } );
						}
					} )
				),
				showsCurrency && el(
					PanelBody,
					{ title: __( 'Currency: what it opens with', 'crystal-ball-markets-rates' ), initialOpen: false },
					el( TextControl, {
						label: __( 'Amount', 'crystal-ball-markets-rates' ),
						value: a.amount,
						onChange: function ( v ) {
							set( { amount: v } );
						}
					} ),
					el( TextControl, {
						label: __( 'From (a currency code, such as USD)', 'crystal-ball-markets-rates' ),
						value: a.from,
						onChange: function ( v ) {
							set( { from: code( v ) } );
						}
					} ),
					el( TextControl, {
						label: __( 'To (a currency code, such as EUR)', 'crystal-ball-markets-rates' ),
						value: a.to,
						onChange: function ( v ) {
							set( { to: code( v ) } );
						}
					} )
				),
				showsGold && el(
					PanelBody,
					{ title: __( 'Gold: what it opens with', 'crystal-ball-markets-rates' ), initialOpen: false },
					el( TextControl, {
						label: __( 'Weight', 'crystal-ball-markets-rates' ),
						value: a.weight,
						onChange: function ( v ) {
							set( { weight: v } );
						}
					} ),
					el( SelectControl, {
						label: __( 'Unit', 'crystal-ball-markets-rates' ),
						value: a.unit,
						options: UNITS,
						onChange: function ( v ) {
							set( { unit: v } );
						}
					} ),
					el( SelectControl, {
						label: __( 'Purity', 'crystal-ball-markets-rates' ),
						value: a.purity,
						options: PURITIES,
						onChange: function ( v ) {
							set( { purity: v } );
						}
					} ),
					el( TextControl, {
						label: __( 'Currency (a code, such as INR)', 'crystal-ball-markets-rates' ),
						value: a.goldCurrency,
						onChange: function ( v ) {
							set( { goldCurrency: code( v ) } );
						}
					} )
				)
			),
			el(
				'div',
				useBlockProps(),
				el( Disabled, null, el( ServerSideRender, { block: 'cbmarkets/converter', attributes: a } ) )
			)
		);
	}

	wp.blocks.registerBlockType( 'cbmarkets/converter', {
		edit: Edit,
		save: function () {
			return null;
		}
	} );
} )( window.wp );
