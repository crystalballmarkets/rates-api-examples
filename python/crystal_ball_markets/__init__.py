"""The free Crystal Ball Markets exchange rate and gold price API: a client, and the sums to use its figures.

Terms: https://crystalballmarkets.com/markets/rates-api
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable, Dict, Optional

from .sums import (
    GRAMS_PER_TROY_OUNCE,
    PURITIES,
    UNITS,
    convert,
    currency_digits,
    format_money,
    gold_value,
    money_digits,
    parse_amount,
    per_usd,
    purity_fineness,
    rate_digits,
    source_text,
    unit_grams,
)

__version__ = "2.0.0"
__all__ = [
    "Client",
    "RatesApiError",
    "BASE_URL",
    "ATTRIBUTION_TEXT",
    "ATTRIBUTION_URL",
    "ATTRIBUTION_HTML",
    "GRAMS_PER_TROY_OUNCE",
    "UNITS",
    "PURITIES",
    "convert",
    "gold_value",
    "per_usd",
    "parse_amount",
    "money_digits",
    "rate_digits",
    "currency_digits",
    "format_money",
    "unit_grams",
    "purity_fineness",
    "source_text",
]

BASE_URL = "https://crystalballmarkets.com/markets/api/v1/"
ATTRIBUTION_TEXT = "Rates by Crystal Ball Markets"
ATTRIBUTION_URL = "https://crystalballmarkets.com/markets"
ATTRIBUTION_HTML = f'<a href="{ATTRIBUTION_URL}">{ATTRIBUTION_TEXT}</a>'
MIN_CACHE_SECONDS = 60

Opener = Callable[[urllib.request.Request, float], Any]


class RatesApiError(Exception):
    """Raised when the API answers with an error status."""

    def __init__(self, message: str, status: int, body: Any = None) -> None:
        super().__init__(message)
        self.status = status
        self.body = body


def _default_open(req: urllib.request.Request, timeout: float):
    return urllib.request.urlopen(req, timeout=timeout)


class Client:
    """Fetch and cache the three JSON files.

    ``site`` is the page of your own site that shows the figures (or your
    domain) and ``key`` is a secret of your own choosing, 16+ characters.
    Both are required for calls from a server, an app or a script.
    """

    def __init__(
        self,
        site: str,
        key: str,
        cache_seconds: int = MIN_CACHE_SECONDS,
        timeout: float = 15.0,
        opener: Optional[Opener] = None,
    ) -> None:
        if not site:
            raise ValueError("site is required: the page of your site that shows the figures")
        if not key or len(key) < 16:
            raise ValueError("key must be a secret of 16 characters or more")
        self.site = site
        self.key = key
        self.ttl = max(MIN_CACHE_SECONDS, cache_seconds)
        self.timeout = timeout
        self._open = opener or _default_open
        self._cache: Dict[str, tuple] = {}

    def _get(self, name: str) -> Dict[str, Any]:
        hit = self._cache.get(name)
        if hit and time.monotonic() - hit[0] < self.ttl:
            return hit[1]
        url = BASE_URL + name + "?" + urllib.parse.urlencode({"site": self.site})
        req = urllib.request.Request(
            url,
            headers={
                "X-Site-Key": self.key,
                "User-Agent": f"crystal-ball-markets-python/{__version__}",
            },
        )
        try:
            with self._open(req, self.timeout) as res:
                body = json.loads(res.read().decode("utf-8"))
        except urllib.error.HTTPError as err:
            raw = err.read().decode("utf-8", "replace")
            hints = {
                403: " Name your page with site, send your key, and show the attribution link on that page.",
                429: " Over 60 requests a minute: keep each response for at least 60 seconds.",
                503: " Temporarily unavailable: retry after the Retry-After header.",
            }
            raise RatesApiError(
                f"Rates API returned {err.code}.{hints.get(err.code, '')}", err.code, raw
            ) from None
        if body.get("warning"):
            import warnings

            warnings.warn(f"crystal-ball-markets: {body['warning']}")
        self._cache[name] = (time.monotonic(), body)
        return body

    # Full files
    def rates(self) -> Dict[str, Any]:
        """rates.json: data.base is USD, data.rates[CODE] = {rate, source, time}."""
        return self._get("rates.json")

    def gold(self) -> Dict[str, Any]:
        """gold.json: data.usdPerOunce and data.countries."""
        return self._get("gold.json")

    def quotes(self) -> Dict[str, Any]:
        """quotes.json: one entry per market."""
        return self._get("quotes.json")

    # Helpers
    def rate(self, code: str) -> Optional[float]:
        """Units of ``code`` per 1 US dollar, or None if not covered."""
        return per_usd(code, self.rates()["data"]["rates"])

    def convert(self, amount: float, from_code: str, to_code: str) -> float:
        """Convert an amount between two currencies through the US dollar."""
        rates = self.rates()["data"]["rates"]
        for code in (from_code, to_code):
            if per_usd(code, rates) is None:
                raise KeyError(f"No rate for {str(code).upper()}")
        value = convert(float(amount), from_code, to_code, rates)
        if value is None:
            raise ValueError("The amount must be a number.")
        return value

    def gold_value(
        self, weight: float = 1, unit: str = "gram", purity: Any = "24k", currency: str = "USD"
    ) -> float:
        """What a weight of gold is worth in a currency.

        ``client.gold_value(10, "tola", "22k", "INR")`` is ten tolas of 22 karat gold in
        rupees: the value of the gold itself at the international price. Shop prices add
        local duty, tax and making charges.
        """
        grams = unit_grams(unit)
        fine = purity_fineness(purity)
        if grams is None:
            raise KeyError(f"No unit called {unit}: use one of {', '.join(UNITS)}")
        if fine is None:
            raise KeyError(f"No purity called {purity}: use one of 24k, 22k, 21k, 18k, 14k")
        per = per_usd(currency, self.rates()["data"]["rates"])
        if per is None:
            raise KeyError(f"No rate for {str(currency).upper()}")
        value = gold_value(float(weight), grams, fine, float(self.gold()["data"]["usdPerOunce"]), per)
        if value is None:
            raise ValueError("The weight must be a number, zero or more.")
        return value

    def gold_price(self, country: str) -> Optional[Dict[str, Any]]:
        """Gold entry for an ISO 3166 alpha-2 country code, e.g. 'IN'."""
        for c in self.gold()["data"]["countries"]:
            if c["country"] == country.upper():
                return c
        return None

    def quote(self, ticker: str) -> Optional[Dict[str, Any]]:
        """One market's quote, e.g. 'EURUSD' or 'XAUUSD'."""
        for q in self.quotes()["data"]:
            if q["ticker"] == ticker.upper():
                return q
        return None
