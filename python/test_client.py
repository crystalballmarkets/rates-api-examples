"""Offline tests with a fake opener: python -m unittest test_client"""
import io
import json
import unittest
import urllib.error

from crystal_ball_markets import ATTRIBUTION_HTML, Client, RatesApiError

FILES = {
    "rates.json": {"data": {"base": "USD", "rates": {"EUR": {"rate": 0.9}, "GBP": {"rate": 0.8}}}},
    "gold.json": {"data": {"usdPerOunce": 3800, "countries": [{"country": "IN", "currency": "INR"}]}},
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
        self.assertAlmostEqual(self.c.convert(100, "GBP", "EUR"), 112.5)
        self.assertEqual(self.c.convert(5, "USD", "USD"), 5)
        self.assertEqual(self.c.gold_price("in")["currency"], "INR")
        self.assertEqual(self.c.quote("eurusd")["bid"], 1.1)

    def test_cache_and_headers(self):
        self.c.rate("EUR")
        self.c.rate("GBP")
        self.assertEqual(len(self.calls), 1)
        req = self.calls[0]
        self.assertIn("site=https%3A%2F%2Fexample.com%2Frates", req.full_url)
        self.assertEqual(req.get_header("X-site-key"), "a-secret-of-16-chars")

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


if __name__ == "__main__":
    unittest.main()
