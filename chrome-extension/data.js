// Lists of what the Crystal Ball Markets widgets cover.
const CBM_GOLD_COUNTRIES = 'india united-states united-arab-emirates united-kingdom pakistan saudi-arabia nigeria malaysia philippines kenya south-africa canada australia ghana singapore bangladesh egypt qatar kuwait oman algeria angola argentina austria bahrain belgium brazil cameroon chile china colombia cote-d-ivoire czechia denmark dominican-republic finland france germany greece hong-kong hungary indonesia iraq israel italy japan jordan mexico morocco mozambique netherlands norway peru poland portugal romania russia senegal south-korea spain sweden switzerland tanzania thailand tunisia turkey uganda ukraine vietnam'.split(' ');

const CBM_COUNTRY_NAMES = {
  'cote-d-ivoire': 'Côte d’Ivoire',
  'turkey': 'Türkiye',
  'czechia': 'Czechia',
  'hong-kong': 'Hong Kong',
};

const CBM_PAIRS = ('usd-ngn ngn-usd usd-ghs ghs-usd usd-kes kes-usd usd-tzs tzs-usd usd-ugx ugx-usd usd-zar zar-usd usd-egp egp-usd usd-mad mad-usd usd-dzd dzd-usd usd-tnd tnd-usd usd-xof xof-usd usd-xaf xaf-usd usd-aoa aoa-usd usd-mzn mzn-usd usd-aed aed-usd usd-sar sar-usd usd-kwd kwd-usd usd-qar qar-usd usd-omr omr-usd usd-bhd bhd-usd usd-jod jod-usd usd-iqd iqd-usd usd-ils ils-usd usd-try try-usd usd-inr inr-usd usd-pkr pkr-usd usd-bdt bdt-usd usd-cny cny-usd usd-hkd hkd-usd usd-jpy jpy-usd usd-krw krw-usd usd-php php-usd usd-myr myr-usd usd-sgd sgd-usd usd-idr idr-usd usd-thb thb-usd usd-vnd vnd-usd usd-gbp gbp-usd usd-eur eur-usd usd-chf chf-usd usd-pln pln-usd usd-czk czk-usd usd-ron ron-usd usd-huf huf-usd usd-sek sek-usd usd-nok nok-usd usd-dkk dkk-usd usd-uah uah-usd usd-rub rub-usd usd-cad cad-usd usd-mxn mxn-usd usd-cop cop-usd usd-pen pen-usd usd-clp clp-usd usd-ars ars-usd usd-dop dop-usd usd-brl brl-usd usd-aud aud-usd ' +
  'eur-xof eur-xaf eur-mad eur-dzd eur-tnd eur-gbp eur-chf eur-pln eur-czk eur-ron eur-huf eur-sek eur-nok eur-dkk eur-try eur-uah eur-ils gbp-ngn gbp-ghs gbp-kes gbp-inr gbp-pkr gbp-bdt gbp-zar eur-ngn eur-ghs eur-inr eur-pkr eur-brl cad-inr cad-ngn cad-php aud-inr aud-php aed-inr aed-pkr aed-bdt aed-php aed-egp sar-inr sar-pkr sar-bdt sar-egp sar-php kwd-inr kwd-egp kwd-pkr qar-inr qar-pkr omr-inr jpy-php jpy-vnd krw-vnd sgd-myr sgd-inr zar-mzn chf-try').split(' ');

const CBM_MARKETS = [
  ['xauusd', 'Gold (XAU/USD)'],
  ['xagusd', 'Silver (XAG/USD)'],
  ['xptusd', 'Platinum (XPT/USD)'],
  ['eurusd', 'EUR/USD'],
  ['gbpusd', 'GBP/USD'],
  ['usdjpy', 'USD/JPY'],
  ['audusd', 'AUD/USD'],
  ['usdcad', 'USD/CAD'],
  ['usoil', 'US crude oil'],
  ['ukoil', 'Brent crude oil'],
  ['natgas', 'Natural gas'],
  ['us30', 'US 30 (Dow Jones)'],
  ['btcusd', 'Bitcoin (BTC/USD)'],
  ['ethusd', 'Ethereum (ETH/USD)'],
];

const CBM_LANGS = 'en es pt fr ar de it ru tr zh ja ko hi id ms th vi uk pl cs nl ro el hu sv no da fi he ur bn sw tl ta te mr gu ha'.split(' ');
