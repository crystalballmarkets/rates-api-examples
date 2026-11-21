<?php
/**
 * Writes a page as a WordPress site would send it, with the plugin's real output, stylesheet and scripts, for the
 * browser check (page.cjs) and the directory's screenshots.
 *
 *   php wordpress/tests/fixture.php [live|sample] [credit|nocredit] [plain|hostile] > page.html
 *
 * `hostile` adds a stylesheet that does to buttons, fields, lists and tables what a careless theme does,
 * and sets the width of whatever is directly in the content, as Twenty Twenty-One does.
 */

error_reporting( E_ALL );
set_error_handler(
	function ( $level, $message, $file, $line ) {
		throw new ErrorException( $message . ' (' . basename( $file ) . ':' . $line . ')', 0, $level, $file, $line );
	}
);
require __DIR__ . '/stubs.php';

$mode    = $argv[1] ?? 'live';
$credit  = 'nocredit' !== ( $argv[2] ?? 'credit' );
$hostile = 'hostile' === ( $argv[3] ?? 'plain' );
$plugin  = __DIR__ . '/../crystal-ball-markets-rates/';

if ( 'sample' === $mode ) {
	$GLOBALS['cbm_test']['home'] = 'http://localhost:8080';
} else {
	$post               = new WP_Post();
	$post->permalink    = 'https://shop.example.org/currency-converter/';
	$post->post_content = '[cbmarkets_converter]';
	$GLOBALS['cbm_test']['post'] = $post;
	$GLOBALS['cbm_test']['http'] = function ( $url ) use ( $plugin ) {
		$packed = json_decode( file_get_contents( $plugin . 'data/snapshot.json' ), true );
		return array(
			'code' => 200,
			'body' => json_encode( false !== strpos( $url, 'rates.json' ) ? $packed['rates'] : $packed['gold'] ),
		);
	};
}

require $plugin . 'crystal-ball-markets-rates.php';
do_action( 'init' );
if ( $credit ) {
	cbmarkets_rates_update_options( array( 'show_credit' => 1 ) );
}
$run = function ( $tag, $atts = array() ) {
	return call_user_func( $GLOBALS['cbm_test']['shortcodes'][ $tag ], $atts );
};

$body  = '<section id="both">' . $run( 'cbmarkets_converter' ) . '</section>';
$body .= '<section id="gold">' . $run( 'cbmarkets_converter', array( 'show' => 'gold', 'weight' => '10', 'unit' => 'tola', 'purity' => '22k', 'gold_currency' => 'INR', 'theme' => 'dark' ) ) . '</section>';
$body .= '<section id="currency">' . $run( 'cbmarkets_converter', array( 'show' => 'currency', 'from' => 'GBP', 'to' => 'NGN', 'amount' => '100', 'theme' => 'auto' ) ) . '</section>';
$body .= '<section id="dark">' . $run( 'cbmarkets_converter', array( 'theme' => 'dark', 'from' => 'EUR', 'to' => 'JPY', 'amount' => '250' ) ) . '</section>';
$body .= '<section id="table">' . $run( 'cbmarkets_rates', array( 'base' => 'USD', 'currencies' => 'EUR,GBP,JPY,INR,NGN,AED' ) )
	. '<p class="prose">The pound today: ' . $run( 'cbmarkets_rate', array( 'from' => 'GBP', 'to' => 'USD' ) ) . '. An order of ' . $run( 'cbmarkets_convert', array( 'amount' => '100', 'from' => 'GBP', 'to' => 'USD' ) )
	. '. Gold in India: ' . $run( 'cbmarkets_gold', array( 'country' => 'IN' ) ) . '. A chain: ' . $run( 'cbmarkets_gold', array( 'weight' => '8', 'unit' => 'gram', 'purity' => '22k', 'currency' => 'INR' ) ) . '.</p></section>';

$base  = 'file://' . realpath( $plugin ) . '/assets/';
$theme = $hostile ? '<style>
	button, .entry button:hover { background: #c00 !important; color: #fff !important; text-transform: uppercase !important; letter-spacing: 3px; padding: 22px 30px; border: 4px solid #000 !important; border-radius: 0 !important; min-height: 60px; min-width: 120px; font-size: 20px; box-shadow: 4px 4px 0 #000 !important; }
	input, select, input[type="text"] { border: 3px solid green !important; height: 60px; padding: 20px; font-size: 22px; background: yellow !important; color: purple !important; width: 50%; margin: 12px; }
	table { border: 3px solid pink; margin: 40px 0; width: 50%; } th, td { border: 2px solid pink; padding: 20px; text-transform: uppercase; background: #eee; text-align: center; }
	p { margin: 2em 0; font-size: 22px; letter-spacing: 2px; } ul { list-style: disc; margin: 2em; padding-left: 3em; } li { margin: 1em 0; list-style: square; }
	label { display: inline; font-size: 24px; text-transform: uppercase; } output { font-size: 12px; color: red; } caption { font-size: 30px; padding: 20px; }
	a { color: red; text-decoration: underline wavy; font-weight: 900; } small { font-size: 30px; } b { font-weight: 100; } svg { width: 80px; height: 80px; }
	* { box-sizing: content-box; }
	section > *:not(.alignwide):not(.alignfull):not(.alignleft):not(.alignright):not(.wp-block-separator) { max-width: 610px; margin-left: auto; margin-right: auto; }
</style>' : '';

echo '<!DOCTYPE html><html lang="en-US"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Converter</title>'
	. '<style>body { margin: 0; padding: 24px; font: 17px/1.6 Georgia, serif; color: #222; background: #fff; } section { margin: 0 0 32px; } .prose { max-width: 620px; }</style>'
	. $theme
	. '<link rel="stylesheet" href="' . $base . 'converter.css"></head><body>'
	. $body
	. '<script>' . implode( "\n", $GLOBALS['cbm_test']['inline']['cbmarkets-rates-converter'] ?? array() ) . '</script>'
	. '<script src="' . $base . 'core.js"></script><script src="' . $base . 'converter.js"></script>'
	. '</body></html>';
