"""The sums: currency conversion, the value of a weight of gold, and how figures are written.

No network and nothing but the standard library. Rates are units of a currency for one
US dollar, as ``rates.json`` gives them: ``{"EUR": {"rate": 0.91, ...}, ...}``.
"""

from __future__ import annotations

import math
import re
from typing import Any, Dict, Mapping, Optional

GRAMS_PER_TROY_OUNCE = 31.1034768

#: Weights gold is quoted in, in grams.
UNITS: Dict[str, float] = {
    "gram": 1.0,
    "ounce": GRAMS_PER_TROY_OUNCE,
    "tola": 11.6638038,
    "pavan": 8.0,
    "baht": 15.244,
    "tael": 37.429,
    "kilogram": 1000.0,
}

#: Gold purities: the share of the weight that is gold.
PURITIES: Dict[str, float] = {
    "k24": 1.0,
    "k22": 0.916,
    "k21": 0.875,
    "k18": 0.75,
    "k14": 0.585,
}

_SOURCES = {
    "crystalballmarkets": "Crystal Ball Markets quote",
    "ecb": "European Central Bank reference rate",
    "peg": "official fixed rate",
    "central-bank": "central bank reference rate",
    "sample": "sample figure",
}


def _number(value: Any) -> Optional[float]:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def unit_grams(unit: str) -> Optional[float]:
    """Grams in a unit ("gram", "ounce", "tola", "pavan", "baht", "tael", "kilogram"), or None."""
    return UNITS.get(str(unit).strip().lower())


def purity_fineness(purity: Any) -> Optional[float]:
    """The share of gold in a purity written "k22", "22k", "22K" or 22, or None."""
    digits = re.sub(r"\D", "", str(purity))
    return PURITIES.get("k" + digits) if digits else None


def per_usd(code: str, rates: Mapping[str, Any]) -> Optional[float]:
    """Units of ``code`` for one US dollar, or None when there is no rate for it."""
    code = str(code).strip().upper()
    if code == "USD":
        return 1.0
    row = rates.get(code) if isinstance(rates, Mapping) else None
    rate = _number(row.get("rate")) if isinstance(row, Mapping) else None
    return rate if rate is not None and rate > 0 else None


def convert(amount: float, from_code: str, to_code: str, rates: Mapping[str, Any]) -> Optional[float]:
    """``amount`` of one currency in another, or None when either rate is missing."""
    a = per_usd(from_code, rates)
    b = per_usd(to_code, rates)
    number = _number(amount)
    if a is None or b is None or number is None:
        return None
    return number / a * b


def gold_value(
    weight: float, unit_grams: float, fine: float, usd_per_ounce: float, currency_per_usd: float
) -> Optional[float]:
    """What ``weight`` units of gold of a purity are worth, from the dollar price of a troy ounce."""
    parts = [_number(v) for v in (weight, unit_grams, fine, usd_per_ounce, currency_per_usd)]
    if any(v is None or v < 0 for v in parts):
        return None
    w, grams, share, spot, per = parts  # type: ignore[misc]
    return w * grams / GRAMS_PER_TROY_OUNCE * share * spot * per


_NO_DECIMALS = {"BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"}
_THREE_DECIMALS = {"BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"}


def currency_digits(code: str) -> int:
    """The decimals a currency is written with: none for yen, three for dinars, two for most."""
    code = str(code).upper()
    if code in _NO_DECIMALS:
        return 0
    return 3 if code in _THREE_DECIMALS else 2


def money_digits(value: float, currency_digits: int = 2) -> int:
    """Decimals to show an amount of money with: the currency's own, and more for a very small amount."""
    v = abs(float(value))
    if not v > 0 or v >= 1:
        return int(currency_digits)
    needed = 3 - math.floor(math.log10(v)) - 1
    return int(min(8, max(int(currency_digits), needed)))


def rate_digits(value: float) -> int:
    """Decimals that show a rate to about six significant figures."""
    v = abs(float(value))
    if not v > 0:
        return 2
    return int(min(10, max(2, 5 - math.floor(math.log10(v)))))


def format_money(value: float, code: str) -> str:
    """An amount of money in words: ``1,234.50 EUR``."""
    return f"{value:,.{money_digits(value, currency_digits(code))}f} {str(code).upper()}"


def parse_amount(text: Any, decimal: str = ".") -> Optional[float]:
    """A typed amount as a number, or None.

    Reads "1,234.56", "1.234,56", "1 234,56" and "1'234.56". Where a single mark could
    be either, ``decimal`` decides: "1,000" is a thousand with "." and one with ",".
    """
    s = re.sub(r"[\s  '’_]", "", str("" if text is None else text).strip())
    if not s:
        return None
    own = "," if decimal == "," else "."
    last_dot, last_comma = s.rfind("."), s.rfind(",")
    dec = own
    if last_dot >= 0 and last_comma >= 0:
        dec = "." if last_dot > last_comma else ","
    elif last_dot >= 0 or last_comma >= 0:
        mark = "." if last_dot >= 0 else ","
        count = s.count(mark)
        tail = len(s) - 1 - s.rfind(mark)
        if count > 1:
            dec = "," if mark == "." else "."
        elif mark != own and tail == 3:
            dec = own
        else:
            dec = mark
    group = "," if dec == "." else "."
    s = s.replace(group, "").replace(dec, ".", 1)
    if not re.fullmatch(r"\d*\.?\d*", s) or not re.search(r"\d", s):
        return None
    number = float(s)
    return number if math.isfinite(number) else None


def source_text(source: str) -> str:
    """Where a rate comes from, in words."""
    return _SOURCES.get(str(source), "reference rate")
