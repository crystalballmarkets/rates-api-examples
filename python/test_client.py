"""Offline tests with a fake opener: python -m unittest test_client"""
import io
import json
import unittest
import urllib.error
import warnings

import crystal_ball_markets as cbm
from crystal_ball_markets import ATTRIBUTION_HTML, Client, RatesApiError
from crystal_ball_markets.__main__ import main

FILES = {
    "rates.json": {"data": {"base": "USD", "rates": {"EUR": {"rate": 0.9}, "GBP": {"rate": 0.8}, "INR": {"rate": 90}, "JPY": {"rate": 150}}}},
    # 3110.34768 dollars an ounce is 100 dollars a gram.
    "gold.json": {"data": {"usdPerOunce": 3110.34768, "countries": [{"country": "IN", "currency": "INR", "unit": "tenGrams", "purity": "k24", "price": 90000}]}},
    "quotes.json": {"data": [{"ticker": "EURUSD", "bid": 1.1}]},
}


class FakeRes(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class Tests(unittest.TestCase):
    def setUp(self):
        self.calls = []

        def opener(req, timeout):
            self.calls.append(req)
            name = req.full_url.split("/")[-1].split("?")[0]
            return FakeRes(json.dumps(FILES[name]).encode())

        self.c = Client("https://example.com/rates", "a-secret-of-16-chars", opener=opener)

    def test_helpers(self):
        self.assertEqual(self.c.rate("eur"), 0.9)
        self.assertEqual(self.c.rate("usd"), 1.0)
        self.assertIsNone(self.c.rate("xxx"))
        self.assertAlmostEqual(self.c.convert(100, "GBP", "EUR"), 112.5)
        self.assertEqual(self.c.convert(5, "USD", "USD"), 5)
        with self.assertRaises(KeyError):
            self.c.convert(1, "USD", "XXX")
        self.assertEqual(self.c.gold_price("in")["currency"], "INR")
        self.assertEqual(self.c.quote("eurusd")["bid"], 1.1)

    def test_gold_value(self):
        self.assertAlmostEqual(self.c.gold_value(), 100)
        self.assertAlmostEqual(self.c.gold_value(10, "gram", "22k", "INR"), 10 * 100 * 0.916 * 90)
        self.assertAlmostEqual(self.c.gold_value(1, "Tola"), 1166.38038)
        self.assertAlmostEqual(self.c.gold_value(purity=18), 75)
        for bad in ({"unit": "stone"}, {"purity": "23k"}, {"currency": "XXX"}):
            with self.assertRaises(KeyError):
                self.c.gold_value(**bad)
        with self.assertRaises(ValueError):
            self.c.gold_value(-1)

    def test_cache_and_headers(self):
        self.c.rate("EUR")
        self.c.rate("GBP")
        self.assertEqual(len(self.calls), 1)
        req = self.calls[0]
        self.assertIn("site=https%3A%2F%2Fexample.com%2Frates", req.full_url)
        self.assertEqual(req.get_header("X-site-key"), "a-secret-of-16-chars")
        self.assertEqual(req.get_header("User-agent"), "crystal-ball-markets-python/" + cbm.__version__)

    def test_validation(self):
        with self.assertRaises(ValueError):
            Client("https://example.com", "short")
        with self.assertRaises(ValueError):
            Client("", "a-secret-of-16-chars")
        self.assertNotIn("nofollow", ATTRIBUTION_HTML)

    def test_error(self):
        def opener(req, timeout):
            raise urllib.error.HTTPError(req.full_url, 403, "Forbidden", {}, io.BytesIO(b"{}"))

        c = Client("https://example.com", "a-secret-of-16-chars", opener=opener)
        with self.assertRaises(RatesApiError) as ctx:
            c.rates()
        self.assertEqual(ctx.exception.status, 403)

    def test_warning(self):
        def opener(req, timeout):
            return FakeRes(json.dumps({"data": {"base": "USD", "rates": {}}, "warning": "Show the link."}).encode())

        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            Client("https://example.com", "a-secret-of-16-chars", opener=opener).rates()
        self.assertIn("Show the link.", str(caught[0].message))

    def test_sums(self):
        rates = {"EUR": {"rate": 0.9}, "GBP": {"rate": 0.8}, "BAD": {"rate": 0}, "TXT": {"rate": "many"}}
        self.assertAlmostEqual(cbm.convert(100, "GBP", "EUR", rates), 112.5)
        self.assertAlmostEqual(cbm.convert(5, "usd", "USD", rates), 5)
        for code in ("XXX", "BAD", "TXT"):
            self.assertIsNone(cbm.convert(1, "USD", code, rates))
        self.assertIsNone(cbm.convert("lots", "USD", "EUR", rates))
        self.assertAlmostEqual(cbm.gold_value(10, 1, 0.916, 3110.34768, 1), 916)
        self.assertAlmostEqual(cbm.gold_value(1, cbm.GRAMS_PER_TROY_OUNCE, 1, 3680.47, 0.9), 3312.423)
        self.assertIsNone(cbm.gold_value(-1, 1, 1, 3000, 1))
        self.assertIsNone(cbm.gold_value(1, 1, 1, 3000, None))
        self.assertEqual(list(cbm.UNITS), ["gram", "ounce", "tola", "pavan", "baht", "tael", "kilogram"])
        self.assertEqual(list(cbm.PURITIES), ["k24", "k22", "k21", "k18", "k14"])
        self.assertEqual(cbm.unit_grams("TOLA"), 11.6638038)
        self.assertIsNone(cbm.unit_grams("stone"))
        self.assertEqual(cbm.purity_fineness("22K"), 0.916)
        self.assertEqual(cbm.purity_fineness(18), 0.75)
        self.assertIsNone(cbm.purity_fineness("gold"))

    def test_writing_figures(self):
        self.assertEqual(cbm.money_digits(0.00012345, 2), 6)
        self.assertEqual(cbm.money_digits(12.5, 2), 2)
        self.assertEqual(cbm.money_digits(150.2, 0), 0)
        self.assertEqual(cbm.rate_digits(0.8612), 6)
        self.assertEqual(cbm.rate_digits(1552.01), 2)
        self.assertEqual(cbm.rate_digits(83.1), 4)
        self.assertEqual(cbm.currency_digits("jpy"), 0)
        self.assertEqual(cbm.currency_digits("KWD"), 3)
        self.assertEqual(cbm.format_money(1234.5, "eur"), "1,234.50 EUR")
        self.assertEqual(cbm.format_money(0.1406, "GBP"), "0.141 GBP")
        self.assertEqual(cbm.format_money(43865.2, "JPY"), "43,865 JPY")
        self.assertEqual(cbm.source_text("ecb"), "European Central Bank reference rate")
        self.assertEqual(cbm.source_text("other"), "reference rate")

    def test_typed_amounts(self):
        cases = {"1,234.56": 1234.56, "1.234,56": 1234.56, "1 234,56": 1234.56, "1'234.56": 1234.56, "1,000": 1000, "0,5": 0.5, "2.5": 2.5}
        for text, number in cases.items():
            self.assertEqual(cbm.parse_amount(text), number, text)
        self.assertEqual(cbm.parse_amount("1,000", ","), 1)
        self.assertEqual(cbm.parse_amount("1.000", ","), 1000)
        for text in ("", "abc", "-5", "1e5", None):
            self.assertIsNone(cbm.parse_amount(text), text)

    def run_cli(self, *argv):
        out = io.StringIO()
        status = main(list(argv), client=self.c, out=out)
        return status, out.getvalue()

    def test_command_line(self):
        credit = "Rates by Crystal Ball Markets: https://crystalballmarkets.com/markets\n"
        self.assertEqual(self.run_cli("rate", "eur"), (0, "1 USD = 0.900000 EUR\n" + credit))
        self.assertEqual(self.run_cli("convert", "1,000", "gbp", "jpy"), (0, "1,000 GBP = 187,500 JPY\n" + credit))
        self.assertEqual(self.run_cli("gold", "10", "tola", "22k", "inr"), (0, "10 tola of 22K gold = 961,563.99 INR\n" + credit))
        self.assertEqual(self.run_cli("gold"), (0, "1 gram of 24K gold = 100.00 USD\n" + credit))
        self.assertEqual(self.run_cli("gold-price", "in"), (0, "90,000.00 INR per tenGrams (k24)\n" + credit))
        self.assertEqual(self.run_cli("quote", "eurusd"), (0, "EURUSD: 1.1\n" + credit))
        status, text = self.run_cli("--json", "convert", "100", "GBP", "EUR")
        self.assertEqual(status, 0)
        self.assertEqual(json.loads(text), {"amount": 100.0, "from": "GBP", "to": "EUR", "value": 112.5})
        for argv in (("rate", "xxx"), ("convert", "lots", "USD", "EUR"), ("gold", "1", "stone"), ("gold-price", "zz"), ("quote", "nothing")):
            self.assertEqual(self.run_cli(*argv)[0], 1, argv)
        self.assertEqual(main([], client=self.c, out=io.StringIO()), 2)
        self.assertEqual(main(["rate", "EUR"], out=io.StringIO()), 2, "without a site and a key it asks for them")


if __name__ == "__main__":
    unittest.main()
