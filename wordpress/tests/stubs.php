<?php
/**
 * Stand-ins for the WordPress functions the plugin calls, so its own code can be run and checked
 * without a WordPress site: php wordpress/tests/run.php
 *
 * Each does what WordPress does as far as the plugin can tell, and records what the plugin asked of it
 * in $GLOBALS['cbm_test'].
 */

define( 'ABSPATH', __DIR__ . '/' );
define( 'DAY_IN_SECONDS', 86400 );
define( 'MINUTE_IN_SECONDS', 60 );

$GLOBALS['cbm_test'] = array(
	'home'        => 'https://shop.example.org',
	'environment' => 'production',
	'options'     => array(
		'time_format' => 'H:i',
		'date_format' => 'j M Y',
	),
	'transients'  => array(),
	'is_admin'    => false,
	'rest'        => false,
	'did_wp'      => true,
	'preview'     => false,
	'singular'    => true,
	'post'        => null,
	'can_manage'  => false,
	'http'        => null,
	'requests'    => array(),
	'actions'     => array(),
	'filters'     => array(),
	'shortcodes'  => array(),
	'styles'      => array(),
	'scripts'     => array(),
	'inline'      => array(),
	'enqueued'    => array(),
	'blocks'      => array(),
	'settings'    => array(),
	'errors'      => array(),
	'pages'       => array(),
	'unique'      => 0,
);

class WP_Post {
	public $post_status  = 'publish';
	public $post_content = '';
	public $permalink    = '';
}

class WP_Error {
	private $message;
	public function __construct( $code = '', $message = '' ) {
		$this->message = $message;
	}
	public function get_error_message() {
		return $this->message;
	}
}

// ---- hooks ----
function add_action( $hook, $callback ) {
	$GLOBALS['cbm_test']['actions'][ $hook ][] = $callback;
}
function add_filter( $hook, $callback ) {
	$GLOBALS['cbm_test']['filters'][ $hook ][] = $callback;
}
function apply_filters( $hook, $value, ...$more ) {
	foreach ( $GLOBALS['cbm_test']['filters'][ $hook ] ?? array() as $callback ) {
		$value = $callback( $value, ...$more );
	}
	return $value;
}
function do_action( $hook ) {
	foreach ( $GLOBALS['cbm_test']['actions'][ $hook ] ?? array() as $callback ) {
		$callback();
	}
}
function did_action( $hook ) {
	return 'wp' === $hook && $GLOBALS['cbm_test']['did_wp'] ? 1 : 0;
}
function register_activation_hook( $file, $callback ) {
	$GLOBALS['cbm_test']['activation'] = $callback;
}

// ---- the plugin's place ----
function plugin_dir_path( $file ) {
	return rtrim( dirname( $file ), '/' ) . '/';
}
function plugin_dir_url( $file ) {
	return $GLOBALS['cbm_test']['home'] . '/wp-content/plugins/' . basename( dirname( $file ) ) . '/';
}
function plugin_basename( $file ) {
	return basename( dirname( $file ) ) . '/' . basename( $file );
}

// ---- options and transients ----
function get_option( $name, $default = false ) {
	return array_key_exists( $name, $GLOBALS['cbm_test']['options'] ) ? $GLOBALS['cbm_test']['options'][ $name ] : $default;
}
function update_option( $name, $value ) {
	$GLOBALS['cbm_test']['options'][ $name ] = $value;
	return true;
}
function delete_option( $name ) {
	unset( $GLOBALS['cbm_test']['options'][ $name ] );
	return true;
}
function get_transient( $name ) {
	$t = $GLOBALS['cbm_test']['transients'][ $name ] ?? null;
	if ( ! $t || ( $t['until'] && $t['until'] < time() ) ) {
		return false;
	}
	return $t['value'];
}
function set_transient( $name, $value, $seconds = 0 ) {
	$GLOBALS['cbm_test']['transients'][ $name ] = array(
		'value' => $value,
		'until' => $seconds ? time() + $seconds : 0,
		'for'   => $seconds,
	);
	return true;
}
function delete_transient( $name ) {
	unset( $GLOBALS['cbm_test']['transients'][ $name ] );
	return true;
}

// ---- the site and the page being shown ----
function home_url( $path = '' ) {
	return $GLOBALS['cbm_test']['home'] . ( '' === $path ? '' : '/' . ltrim( $path, '/' ) );
}
function admin_url( $path = '' ) {
	return $GLOBALS['cbm_test']['home'] . '/wp-admin/' . $path;
}
function wp_get_environment_type() {
	return $GLOBALS['cbm_test']['environment'];
}
function get_bloginfo( $what ) {
	return 'language' === $what ? 'en-US' : '';
}
function is_admin() {
	return $GLOBALS['cbm_test']['is_admin'];
}
function wp_doing_ajax() {
	return false;
}
function wp_doing_cron() {
	return false;
}
function is_preview() {
	return $GLOBALS['cbm_test']['preview'];
}
function is_feed() {
	return false;
}
function is_customize_preview() {
	return false;
}
function is_404() {
	return false;
}
function is_search() {
	return false;
}
function is_singular() {
	return $GLOBALS['cbm_test']['singular'];
}
function is_front_page() {
	return ! $GLOBALS['cbm_test']['singular'];
}
function is_home() {
	return false;
}
function get_queried_object() {
	return $GLOBALS['cbm_test']['post'];
}
function post_password_required( $post = null ) {
	return false;
}
function get_permalink( $post = null ) {
	return $post instanceof WP_Post ? $post->permalink : false;
}
function user_trailingslashit( $path ) {
	return rtrim( $path, '/' ) . '/';
}
function current_user_can( $capability ) {
	return $GLOBALS['cbm_test']['can_manage'];
}
function has_block( $name, $post = null ) {
	return $post instanceof WP_Post && false !== strpos( $post->post_content, '<!-- wp:' . $name );
}
function has_shortcode( $content, $tag ) {
	return false !== strpos( (string) $content, '[' . $tag );
}

// ---- words ----
function __( $text, $domain = '' ) {
	$GLOBALS['cbm_test']['domains'][ $domain ] = true;
	return $text;
}
function esc_html__( $text, $domain = '' ) {
	return esc_html( __( $text, $domain ) );
}
function esc_attr__( $text, $domain = '' ) {
	return esc_attr( __( $text, $domain ) );
}
function esc_html_e( $text, $domain = '' ) {
	echo esc_html( __( $text, $domain ) );
}
function esc_attr_e( $text, $domain = '' ) {
	echo esc_attr( __( $text, $domain ) );
}
function esc_html( $text ) {
	return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
}
function esc_attr( $text ) {
	return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
}
function esc_url( $url ) {
	return preg_match( '#^https?://#i', (string) $url ) ? htmlspecialchars( (string) $url, ENT_QUOTES, 'UTF-8' ) : '';
}
function esc_url_raw( $url ) {
	return preg_match( '#^https?://[^\s"\'<>]+$#i', (string) $url ) ? (string) $url : '';
}
function wp_kses_post( $html ) {
	return $html;
}
function sanitize_key( $key ) {
	return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $key ) );
}
function wp_strip_all_tags( $text ) {
	return trim( strip_tags( (string) $text ) );
}
function sanitize_text_field( $text ) {
	return trim( preg_replace( '/\s+/', ' ', strip_tags( (string) $text ) ) );
}
function absint( $n ) {
	return abs( (int) $n );
}
function number_format_i18n( $number, $decimals = 0 ) {
	return number_format( (float) $number, (int) $decimals, '.', ',' );
}
function wp_date( $format, $timestamp = null ) {
	return gmdate( $format, null === $timestamp ? time() : (int) $timestamp );
}
function selected( $a, $b = true, $echo = true ) {
	$out = (string) $a === (string) $b ? " selected='selected'" : '';
	if ( $echo ) {
		echo $out;
	}
	return $out;
}
function checked( $a, $b = true, $echo = true ) {
	$out = (string) $a === (string) $b ? " checked='checked'" : '';
	if ( $echo ) {
		echo $out;
	}
	return $out;
}
function wp_generate_password( $length = 12, $special = true, $extra = false ) {
	return substr( str_repeat( 'Ab3dEf6hIj9kLmN0', 8 ), 0, $length );
}
function wp_unique_id( $prefix = '' ) {
	return $prefix . ( ++$GLOBALS['cbm_test']['unique'] );
}
function wp_parse_args( $args, $defaults = array() ) {
	return array_merge( $defaults, (array) $args );
}
function wp_parse_url( $url, $component = -1 ) {
	return parse_url( $url, $component );
}
function wp_json_encode( $data, $flags = 0 ) {
	return json_encode( $data, $flags );
}
function wp_json_file_decode( $file, $options = array() ) {
	return json_decode( file_get_contents( $file ), ! empty( $options['associative'] ) );
}
function shortcode_atts( $pairs, $atts, $shortcode = '' ) {
	$atts = (array) $atts;
	$out  = array();
	foreach ( $pairs as $name => $default ) {
		$out[ $name ] = array_key_exists( $name, $atts ) ? $atts[ $name ] : $default;
	}
	return $out;
}
function add_query_arg( $key, $value, $url ) {
	return $url . ( false === strpos( $url, '?' ) ? '?' : '&' ) . $key . '=' . $value;
}

// ---- asking another server ----
function wp_remote_get( $url, $args = array() ) {
	$GLOBALS['cbm_test']['requests'][] = array(
		'url'  => $url,
		'args' => $args,
	);
	$responder = $GLOBALS['cbm_test']['http'];
	return $responder ? $responder( $url, $args ) : new WP_Error( 'none', 'No connection in this test.' );
}
function is_wp_error( $thing ) {
	return $thing instanceof WP_Error;
}
function wp_remote_retrieve_response_code( $response ) {
	return is_array( $response ) ? $response['code'] : '';
}
function wp_remote_retrieve_body( $response ) {
	return is_array( $response ) ? $response['body'] : '';
}

// ---- styles, scripts, blocks, shortcodes ----
function wp_register_style( $handle, $src, $deps = array(), $ver = false ) {
	$GLOBALS['cbm_test']['styles'][ $handle ] = $src;
}
function wp_register_script( $handle, $src, $deps = array(), $ver = false, $footer = false ) {
	$GLOBALS['cbm_test']['scripts'][ $handle ] = $src;
}
function wp_enqueue_style( $handle ) {
	$GLOBALS['cbm_test']['enqueued'][ 'style:' . $handle ] = true;
}
function wp_enqueue_script( $handle ) {
	$GLOBALS['cbm_test']['enqueued'][ 'script:' . $handle ] = true;
}
function wp_add_inline_script( $handle, $code, $position = 'after' ) {
	$GLOBALS['cbm_test']['inline'][ $handle ][] = $code;
}
function wp_set_script_translations( $handle, $domain ) {
	$GLOBALS['cbm_test']['translations'][ $handle ] = $domain;
}
function register_block_type( $path, $args = array() ) {
	$GLOBALS['cbm_test']['blocks'][ $path ] = $args;
}
function add_shortcode( $tag, $callback ) {
	$GLOBALS['cbm_test']['shortcodes'][ $tag ] = $callback;
}

// ---- the settings screen ----
function add_options_page( $title, $menu, $capability, $slug, $callback ) {
	$GLOBALS['cbm_test']['pages'][ $slug ] = $callback;
}
function register_setting( $group, $name, $args = array() ) {
	$GLOBALS['cbm_test']['settings'][ $name ] = array( $group, $args );
}
function add_settings_error( $setting, $code, $message ) {
	$GLOBALS['cbm_test']['errors'][] = $message;
}
function settings_fields( $group ) {
	echo '<input type="hidden" name="option_page" value="' . esc_attr( $group ) . '">';
}
function submit_button() {
	echo '<button type="submit">Save Changes</button>';
}
