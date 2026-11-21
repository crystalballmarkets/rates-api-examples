<?php
/**
 * The settings page, under Settings > Crystal Ball Markets Rates.
 *
 * @package CrystalBallMarketsRates
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Adds the settings page.
 *
 * @return void
 */
function cbmarkets_rates_admin_menu() {
	add_options_page(
		__( 'Crystal Ball Markets Rates', 'crystal-ball-markets-rates' ),
		__( 'Crystal Ball Markets Rates', 'crystal-ball-markets-rates' ),
		'manage_options',
		'cbmarkets-rates',
		'cbmarkets_rates_settings_page'
	);
}
add_action( 'admin_menu', 'cbmarkets_rates_admin_menu' );

/**
 * Registers the plugin's one option.
 *
 * @return void
 */
function cbmarkets_rates_register_settings() {
	register_setting(
		'cbmarkets_rates',
		'cbmarkets_rates_options',
		array(
			'type'              => 'array',
			'sanitize_callback' => 'cbmarkets_rates_sanitize_options',
		)
	);
}
add_action( 'admin_init', 'cbmarkets_rates_register_settings' );

/**
 * Cleans the settings before they are saved.
 *
 * @param mixed $input What was sent.
 * @return array
 */
function cbmarkets_rates_sanitize_options( $input ) {
	$current = cbmarkets_rates_options();
	$input   = is_array( $input ) ? $input : array();

	$theme = isset( $input['theme'] ) ? sanitize_key( $input['theme'] ) : $current['theme'];
	$page  = isset( $input['page'] ) ? esc_url_raw( trim( (string) $input['page'] ) ) : $current['page'];
	if ( '' !== $page && ! cbmarkets_rates_is_own_page( $page ) ) {
		add_settings_error( 'cbmarkets_rates_options', 'cbmarkets_rates_page', __( 'The page must be a page of this site. The address was not changed.', 'crystal-ball-markets-rates' ) );
		$page = $current['page'];
	}

	// The key is made by the plugin and never changed from the form.
	$key = $current['site_key'];
	if ( ! is_string( $key ) || strlen( $key ) < 16 ) {
		$sent = isset( $input['site_key'] ) ? (string) $input['site_key'] : '';
		$key  = preg_match( '/^[A-Za-z0-9]{16,64}$/', $sent ) ? $sent : wp_generate_password( 32, false, false );
	}

	return array(
		'show_credit' => empty( $input['show_credit'] ) ? 0 : 1,
		'theme'       => in_array( $theme, cbmarkets_rates_themes(), true ) ? $theme : 'light',
		'page'        => $page,
		'site_key'    => $key,
	);
}

/**
 * Adds a Settings link beside the plugin on the Plugins screen.
 *
 * @param string[] $links The plugin's links.
 * @return string[]
 */
function cbmarkets_rates_action_links( $links ) {
	array_unshift( $links, '<a href="' . esc_url( admin_url( 'options-general.php?page=cbmarkets-rates' ) ) . '">' . esc_html__( 'Settings', 'crystal-ball-markets-rates' ) . '</a>' );
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( CBMARKETS_RATES_FILE ), 'cbmarkets_rates_action_links' );

/**
 * Where the figures come from at the moment, in a sentence for the settings page.
 *
 * @return string
 */
function cbmarkets_rates_where_from() {
	$sample = cbmarkets_rates_snapshot( 'rates' );
	$date   = $sample ? wp_date( get_option( 'date_format' ), $sample['at'] ) : '';
	if ( cbmarkets_rates_is_test_site() ) {
		/* translators: %s: a date */
		return sprintf( __( 'This is a local or test site, which the rates service cannot read. The plugin shows the sample rates packed with it (%s) and asks the service for nothing. On a public site it shows current rates.', 'crystal-ball-markets-rates' ), $date );
	}
	$options = cbmarkets_rates_options();
	if ( ! cbmarkets_rates_is_own_page( $options['page'] ) ) {
		/* translators: %s: a date */
		return sprintf( __( 'The rates service has not been asked for anything yet. Add the converter or a shortcode to a page and publish it: the first visit to that page reads the current rates. Until then the editor and previews show the sample rates packed with the plugin (%s).', 'crystal-ball-markets-rates' ), $date );
	}
	return __( 'The plugin reads the current rates from the rates service and keeps them for five minutes.', 'crystal-ball-markets-rates' );
}

/**
 * The settings page.
 *
 * @return void
 */
function cbmarkets_rates_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$options = cbmarkets_rates_options();
	$note    = cbmarkets_rates_service_note();
	$themes  = array(
		'light' => __( 'Light', 'crystal-ball-markets-rates' ),
		'dark'  => __( 'Dark', 'crystal-ball-markets-rates' ),
		'auto'  => __( 'The visitor’s own setting (light or dark)', 'crystal-ball-markets-rates' ),
	);
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Crystal Ball Markets Rates', 'crystal-ball-markets-rates' ); ?></h1>
		<p><?php echo esc_html( cbmarkets_rates_where_from() ); ?></p>

		<?php if ( $note && ! cbmarkets_rates_is_test_site() ) : ?>
		<div class="<?php echo esc_attr( 'warning' === $note['kind'] ? 'notice notice-warning inline' : 'notice notice-error inline' ); ?>">
			<p>
				<strong>
				<?php
				if ( 'refused' === $note['kind'] ) {
					esc_html_e( 'The rates service is refusing this site, so the figures are not shown.', 'crystal-ball-markets-rates' );
				} elseif ( 'warning' === $note['kind'] ) {
					esc_html_e( 'A message from the rates service:', 'crystal-ball-markets-rates' );
				} else {
					esc_html_e( 'The rates service could not be read the last time the plugin asked.', 'crystal-ball-markets-rates' );
				}
				?>
				</strong>
				<?php echo esc_html( $note['text'] ); ?>
				<em>(<?php echo esc_html( wp_date( get_option( 'date_format' ) . ' ' . get_option( 'time_format' ), (int) $note['at'] ) ); ?>)</em>
			</p>
		</div>
		<?php endif; ?>

		<form method="post" action="options.php">
			<?php settings_fields( 'cbmarkets_rates' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><?php esc_html_e( 'Link to Crystal Ball Markets', 'crystal-ball-markets-rates' ); ?></th>
					<td>
						<label for="cbmarkets-rates-credit">
							<input type="checkbox" id="cbmarkets-rates-credit" name="cbmarkets_rates_options[show_credit]" value="1" <?php checked( 1, (int) $options['show_credit'] ); ?>>
							<?php esc_html_e( 'Show the link “Rates by Crystal Ball Markets” under the figures', 'crystal-ball-markets-rates' ); ?>
						</label>
						<p class="description">
							<?php esc_html_e( 'Off unless you turn it on: the plugin never adds a link to your pages by itself. The rates service is free, and its terms ask each site that shows its figures to carry this link, visible, on the page that shows them. Tick the box and the plugin adds it for you, or place the link on the page yourself. A site that shows the figures without the link is refused by the service a day after it is checked, and the figures then stop showing.', 'crystal-ball-markets-rates' ); ?>
							<a href="https://crystalballmarkets.com/markets/rates-api" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Read the terms of the rates service', 'crystal-ball-markets-rates' ); ?></a>
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="cbmarkets-rates-theme"><?php esc_html_e( 'Colours', 'crystal-ball-markets-rates' ); ?></label></th>
					<td>
						<select id="cbmarkets-rates-theme" name="cbmarkets_rates_options[theme]">
							<?php foreach ( $themes as $key => $label ) : ?>
							<option value="<?php echo esc_attr( $key ); ?>"<?php selected( $options['theme'], $key ); ?>><?php echo esc_html( $label ); ?></option>
							<?php endforeach; ?>
						</select>
						<p class="description"><?php esc_html_e( 'One converter can differ: add theme="dark" to its shortcode, or choose it in the block’s settings.', 'crystal-ball-markets-rates' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="cbmarkets-rates-page"><?php esc_html_e( 'Page that shows the figures', 'crystal-ball-markets-rates' ); ?></label></th>
					<td>
						<input type="url" class="regular-text code" id="cbmarkets-rates-page" name="cbmarkets_rates_options[page]" value="<?php echo esc_attr( $options['page'] ); ?>" placeholder="<?php echo esc_attr( home_url( '/' ) ); ?>">
						<p class="description"><?php esc_html_e( 'The one page of this site that the plugin names to the rates service, which looks there for the link above. The plugin fills this in with the first published page that shows the figures. Change it if that page no longer shows them.', 'crystal-ball-markets-rates' ); ?></p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>

		<h2><?php esc_html_e( 'How to show the figures', 'crystal-ball-markets-rates' ); ?></h2>
		<p><?php esc_html_e( 'In the block editor, add the block “Currency and Gold Converter”. Anywhere else, use a shortcode:', 'crystal-ball-markets-rates' ); ?></p>
		<table class="widefat striped">
			<tbody>
				<tr>
					<td><code>[cbmarkets_converter]</code></td>
					<td><?php esc_html_e( 'The converter: currencies and gold, worked out as the visitor types.', 'crystal-ball-markets-rates' ); ?></td>
				</tr>
				<tr>
					<td><code>[cbmarkets_converter show="currency" from="GBP" to="NGN" amount="100"]</code></td>
					<td><?php esc_html_e( 'The currency converter alone, opening on a pair and an amount of your choice.', 'crystal-ball-markets-rates' ); ?></td>
				</tr>
				<tr>
					<td><code>[cbmarkets_converter show="gold" weight="10" unit="tola" purity="22k" gold_currency="INR"]</code></td>
					<td><?php esc_html_e( 'The gold calculator alone. Units: gram, ounce, tola, pavan, baht, tael, kilogram. Purities: 24k, 22k, 21k, 18k, 14k.', 'crystal-ball-markets-rates' ); ?></td>
				</tr>
				<tr>
					<td><code>[cbmarkets_rate from="USD" to="EUR"]</code></td>
					<td><?php esc_html_e( 'One exchange rate, inside a sentence.', 'crystal-ball-markets-rates' ); ?></td>
				</tr>
				<tr>
					<td><code>[cbmarkets_convert amount="100" from="GBP" to="NGN"]</code></td>
					<td><?php esc_html_e( 'A converted amount, inside a sentence.', 'crystal-ball-markets-rates' ); ?></td>
				</tr>
				<tr>
					<td><code>[cbmarkets_rates base="USD" currencies="EUR,GBP,JPY,INR"]</code></td>
					<td><?php esc_html_e( 'A table of rates.', 'crystal-ball-markets-rates' ); ?></td>
				</tr>
				<tr>
					<td><code>[cbmarkets_gold country="IN"]</code></td>
					<td><?php esc_html_e( 'The gold price in a country, in its own money and unit of weight (a two-letter country code).', 'crystal-ball-markets-rates' ); ?></td>
				</tr>
				<tr>
					<td><code>[cbmarkets_gold weight="10" unit="gram" purity="22k" currency="INR"]</code></td>
					<td><?php esc_html_e( 'What a weight of gold is worth, inside a sentence.', 'crystal-ball-markets-rates' ); ?></td>
				</tr>
			</tbody>
		</table>

		<h2><?php esc_html_e( 'What leaves this site', 'crystal-ball-markets-rates' ); ?></h2>
		<p><?php esc_html_e( 'When the figures are older than five minutes and a page that shows them is opened, this site asks the rates service for two files. The request names the page above and carries a random key made for this installation. Nothing about your visitors is sent, the visitor’s browser asks the service for nothing, and every sum is worked out on your site and in the visitor’s browser. A pair that a visitor pins is kept in that visitor’s own browser.', 'crystal-ball-markets-rates' ); ?></p>
	</div>
	<?php
}
