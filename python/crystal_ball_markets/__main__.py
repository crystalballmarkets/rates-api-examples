"""Exchange rates and the gold price from the command line.

    cbm-rates rate EUR                  euros for one US dollar
    cbm-rates convert 100 GBP NGN       100 pounds in naira
    cbm-rates gold 10 tola 22k INR      what ten tolas of 22 karat gold are worth in rupees
    cbm-rates gold-price IN             the gold price in India, in its own money and unit
    cbm-rates quote XAUUSD              one market's quote

The same as ``python -m crystal_ball_markets``. The API asks every caller to name the page
of their own site that shows the figures and to send a secret of their own: give them with
``--site`` and ``--key``, or in the environment as CBM_SITE and CBM_SITE_KEY.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, List, Optional, TextIO

from . import ATTRIBUTION_TEXT, ATTRIBUTION_URL, Client, RatesApiError, __version__
from .sums import format_money, parse_amount, rate_digits


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="cbm-rates",
        description="Exchange rates and the gold price from the free Crystal Ball Markets Rates API.",
        epilog="Terms: https://crystalballmarkets.com/markets/rates-api",
    )
    parser.add_argument("--site", default=os.environ.get("CBM_SITE"), help="the page of your own site that shows the figures (or set CBM_SITE)")
    parser.add_argument("--key", default=os.environ.get("CBM_SITE_KEY"), help="a secret of your own, 16 characters or more (or set CBM_SITE_KEY)")
    parser.add_argument("--json", action="store_true", help="print JSON")
    parser.add_argument("--version", action="version", version=f"crystal-ball-markets {__version__}")
    commands = parser.add_subparsers(dest="command", metavar="command")

    rate = commands.add_parser("rate", help="units of a currency for one US dollar")
    rate.add_argument("currency")

    convert = commands.add_parser("convert", help="an amount of one currency in another")
    convert.add_argument("amount")
    convert.add_argument("from_code", metavar="from")
    convert.add_argument("to_code", metavar="to")

    gold = commands.add_parser("gold", help="what a weight of gold is worth")
    gold.add_argument("weight", nargs="?", default="1")
    gold.add_argument("unit", nargs="?", default="gram", help="gram, ounce, tola, pavan, baht, tael or kilogram")
    gold.add_argument("purity", nargs="?", default="24k", help="24k, 22k, 21k, 18k or 14k")
    gold.add_argument("currency", nargs="?", default="USD")

    price = commands.add_parser("gold-price", help="the gold price in a country, in its own money and unit")
    price.add_argument("country", help="a two-letter country code, such as IN")

    quote = commands.add_parser("quote", help="one market's quote")
    quote.add_argument("ticker", help="such as EURUSD or XAUUSD")
    return parser


def main(argv: Optional[List[str]] = None, client: Optional[Client] = None, out: Optional[TextIO] = None) -> int:
    """Run the command line. Returns the exit status: 0 when it printed an answer."""
    out = out or sys.stdout
    parser = _parser()
    args = parser.parse_args(argv)
    if not args.command:
        parser.print_help(out)
        return 2

    def answer(text: str, data: Any) -> int:
        if args.json:
            print(json.dumps(data, ensure_ascii=False), file=out)
        else:
            print(text, file=out)
            print(f"{ATTRIBUTION_TEXT}: {ATTRIBUTION_URL}", file=out)
        return 0

    try:
        if client is None:
            if not args.site or not args.key:
                print("Name your page and your key: --site and --key, or CBM_SITE and CBM_SITE_KEY.", file=sys.stderr)
                return 2
            client = Client(args.site, args.key)

        if args.command == "rate":
            code = args.currency.upper()
            rate = client.rate(code)
            if rate is None:
                raise KeyError(f"No rate for {code}")
            return answer(f"1 USD = {rate:,.{rate_digits(rate)}f} {code}", {"base": "USD", "currency": code, "rate": rate})

        if args.command == "convert":
            amount = parse_amount(args.amount)
            if amount is None:
                raise ValueError(f"{args.amount} is not an amount")
            a, b = args.from_code.upper(), args.to_code.upper()
            value = client.convert(amount, a, b)
            return answer(f"{amount:,.10g} {a} = {format_money(value, b)}", {"amount": amount, "from": a, "to": b, "value": value})

        if args.command == "gold":
            weight = parse_amount(args.weight)
            if weight is None:
                raise ValueError(f"{args.weight} is not a weight")
            code = args.currency.upper()
            value = client.gold_value(weight, args.unit, args.purity, code)
            purity = "".join(ch for ch in str(args.purity) if ch.isdigit()) + "K"
            return answer(
                f"{weight:,.10g} {args.unit.lower()} of {purity} gold = {format_money(value, code)}",
                {"weight": weight, "unit": args.unit.lower(), "purity": purity, "currency": code, "value": value},
            )

        if args.command == "gold-price":
            entry = client.gold_price(args.country)
            if entry is None:
                raise KeyError(f"No gold price for {args.country.upper()}")
            return answer(f"{format_money(entry['price'], entry['currency'])} per {entry['unit']} ({entry['purity']})", entry)

        entry = client.quote(args.ticker)
        if entry is None:
            raise KeyError(f"No market called {args.ticker.upper()}")
        return answer(f"{entry['ticker']}: {entry['bid']}", entry)
    except RatesApiError as err:
        print(str(err), file=sys.stderr)
        return 1
    except (KeyError, ValueError) as err:
        print(str(err).strip("'\""), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
