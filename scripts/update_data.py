#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import os
import traceback
from datetime import date, datetime, timezone
UTC = timezone.utc
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

DEBUG = True

def dbg(*args: object) -> None:
    if DEBUG:
        print("[DEBUG]", *args, flush=True)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = PROJECT_ROOT / "data" / "indicator.json"

ENTITY_ID = "strategy"
ENTITY_DISPLAY_NAME = "Strategy (MSTR)"
COIN_ID = "bitcoin"
DAYS = 365

SHARE_SNAPSHOTS = [
    {"date": "2024-12-31", "assumedDilutedShares": 281_735_000},
    {"date": "2025-03-31", "assumedDilutedShares": 299_653_000},
    {"date": "2025-06-30", "assumedDilutedShares": 314_216_000},
    {"date": "2025-09-30", "assumedDilutedShares": 320_040_000},
    {"date": "2025-12-31", "assumedDilutedShares": 344_897_000},
    {"date": "2026-03-22", "assumedDilutedShares": 377_847_000},
]

HOLDINGS_URL = (
    f"https://api.coingecko.com/api/v3/public_treasury/{ENTITY_ID}/{COIN_ID}/holding_chart?"
    + urlencode({"days": DAYS, "include_empty_intervals": "true"})
)
BTC_PRICE_URL = (
    f"https://api.coingecko.com/api/v3/coins/{COIN_ID}/market_chart?"
    + urlencode({"vs_currency": "usd", "days": DAYS, "interval": "daily"})
)

SOURCE_METADATA = [
    {
        "name": "CoinGecko public treasury holding chart",
        "purpose": "Daily Strategy BTC holdings (forward-filled by CoinGecko when empty intervals are included)",
        "url": HOLDINGS_URL,
    },
    {
        "name": "CoinGecko Bitcoin market chart",
        "purpose": "Daily BTC/USD prices",
        "url": BTC_PRICE_URL,
    },
    {
        "name": "Strategy shares page",
        "purpose": "Official assumed diluted share snapshots used as the per-share denominator",
        "url": "https://www.strategy.com/shares",
    },
]

def fetch_json(url: str) -> dict[str, Any]:
    dbg("fetch_json() start", url)

    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) DATCoDashboard/1.0",
        "Accept": "application/json",
    }
    api_key = os.getenv("COINGECKO_API_KEY", "").strip()
    dbg("COINGECKO_API_KEY exists =", bool(api_key))
    if api_key:
        headers["x-cg-demo-api-key"] = api_key
        headers["x-cg-pro-api-key"] = api_key

    request = Request(url, headers=headers)

    try:
        with urlopen(request, timeout=60) as response:
            dbg("HTTP status =", getattr(response, "status", "unknown"))
            payload = response.read().decode("utf-8")
            dbg("payload length =", len(payload))
            dbg("payload preview =", payload[:300].replace("\n", " "))
            data = json.loads(payload)
            dbg("json keys =", list(data.keys())[:20] if isinstance(data, dict) else type(data))
            return data
    except Exception as e:
        dbg("fetch_json() failed:", repr(e))
        raise

def iso_date_from_ms(timestamp_ms: float | int) -> str:
    return datetime.fromtimestamp(float(timestamp_ms) / 1000, tz=UTC).date().isoformat()

def normalize_pairs(pairs: list[list[float]]) -> dict[str, float]:
    dbg("normalize_pairs() start, raw length =", len(pairs))
    normalized: dict[str, float] = {}
    for i, (timestamp_ms, value) in enumerate(pairs):
        iso_day = iso_date_from_ms(timestamp_ms)
        normalized[iso_day] = float(value)
        if i < 3:
            dbg("normalize sample", i, "=>", iso_day, value)
    dbg("normalize_pairs() done, normalized length =", len(normalized))
    return normalized

def share_count_for_date(target_date: date) -> int:
    selected = SHARE_SNAPSHOTS[0]["assumedDilutedShares"]
    for snapshot in SHARE_SNAPSHOTS:
        snapshot_date = date.fromisoformat(snapshot["date"])
        if snapshot_date <= target_date:
            selected = snapshot["assumedDilutedShares"]
        else:
            break
    return int(selected)

def safe_round(value: float | None, digits: int = 6) -> float | None:
    if value is None or math.isnan(value) or math.isinf(value):
        return None
    return round(value, digits)

def percent_change(current: float, previous: float | None) -> float | None:
    if previous is None or previous == 0:
        return None
    return ((current - previous) / previous) * 100

def find_previous_value(series: list[dict[str, Any]], key: str, sessions_back: int) -> float | None:
    if len(series) <= sessions_back:
        return None
    return float(series[-sessions_back - 1][key])

def signed_number(value: float | int, digits: int = 2) -> str:
    if isinstance(value, int):
        return f"{value:+,d}"
    return f"{value:+.{digits}f}"

def build_auto_summary(series: list[dict[str, Any]]) -> str:
    dbg("build_auto_summary() series length =", len(series))
    latest = series[-1]
    nav_30d = percent_change(
        float(latest["btcNavPerDilutedShareUsd"]),
        find_previous_value(series, "btcNavPerDilutedShareUsd", 30),
    )
    btc_30d = percent_change(float(latest["btcPriceUsd"]), find_previous_value(series, "btcPriceUsd", 30))
    holdings_past = find_previous_value(series, "btcHoldings", 30)
    holdings_delta = None if holdings_past is None else float(latest["btcHoldings"]) - holdings_past
    diluted_shares_past = find_previous_value(series, "assumedDilutedShares", 30)
    diluted_shares_delta = (
        None if diluted_shares_past is None else int(float(latest["assumedDilutedShares"]) - diluted_shares_past)
    )

    def describe_pct(label: str, value: float | None) -> str:
        if value is None:
            return f"{label} change is unavailable"
        direction = "rose" if value > 0 else "fell" if value < 0 else "was flat"
        magnitude = abs(value)
        if direction == "was flat":
            return f"{label} was roughly flat"
        return f"{label} {direction} {magnitude:.2f}%"

    holdings_text = (
        "holdings change is unavailable"
        if holdings_delta is None
        else f"holdings changed by {signed_number(int(round(holdings_delta)), 0)} BTC"
    )
    dilution_text = (
        "diluted shares were unchanged"
        if diluted_shares_delta in (None, 0)
        else f"diluted shares changed by {signed_number(diluted_shares_delta, 0)}"
    )

    return (
        f"Over the last 30 days, {describe_pct('estimated BTC NAV per diluted share', nav_30d)}. "
        f"During the same period, {describe_pct('BTC price', btc_30d)}, {holdings_text}, and {dilution_text}. "
        "This means the indicator is driven upward by higher BTC prices and new treasury accumulation, "
        "but can be diluted when the share count rises faster than BTC-per-share growth."
    )

def build_dataset() -> dict[str, Any]:
    dbg("build_dataset() start")
    dbg("HOLDINGS_URL =", HOLDINGS_URL)
    dbg("BTC_PRICE_URL =", BTC_PRICE_URL)

    holdings_payload = fetch_json(HOLDINGS_URL)
    dbg("holdings_payload type =", type(holdings_payload).__name__)

    price_payload = fetch_json(BTC_PRICE_URL)
    dbg("price_payload type =", type(price_payload).__name__)

    if "holdings" not in holdings_payload:
        dbg("holdings_payload keys =", list(holdings_payload.keys()))
        raise KeyError("CoinGecko treasury response did not include 'holdings'.")

    if "prices" not in price_payload:
        dbg("price_payload keys =", list(price_payload.keys()))
        raise KeyError("CoinGecko BTC response did not include 'prices'.")

    dbg("holdings rows =", len(holdings_payload["holdings"]))
    dbg("price rows =", len(price_payload["prices"]))

    holdings_by_date = normalize_pairs(holdings_payload["holdings"])
    btc_price_by_date = normalize_pairs(price_payload["prices"])

    dbg("holdings_by_date length =", len(holdings_by_date))
    dbg("btc_price_by_date length =", len(btc_price_by_date))

    common_dates = sorted(set(holdings_by_date) & set(btc_price_by_date))
    dbg("common_dates length =", len(common_dates))

    if common_dates:
        dbg("first common date =", common_dates[0])
        dbg("last common date =", common_dates[-1])
    else:
        raise ValueError("No overlapping daily dates were found between holdings and BTC prices.")

    series: list[dict[str, Any]] = []
    previous_holdings: float | None = None

    for idx, day in enumerate(common_dates):
        day_date = date.fromisoformat(day)
        assumed_diluted_shares = share_count_for_date(day_date)
        btc_holdings = float(holdings_by_date[day])
        btc_price_usd = float(btc_price_by_date[day])

        if assumed_diluted_shares == 0:
            raise ZeroDivisionError(f"assumed_diluted_shares is 0 on {day}")

        btc_per_diluted_share = btc_holdings / assumed_diluted_shares
        btc_nav_per_diluted_share_usd = btc_per_diluted_share * btc_price_usd
        daily_holding_change = None if previous_holdings is None else btc_holdings - previous_holdings

        if idx < 3 or idx == len(common_dates) - 1:
            dbg(
                "series sample",
                idx,
                {
                    "date": day,
                    "btc_holdings": btc_holdings,
                    "btc_price_usd": btc_price_usd,
                    "assumed_diluted_shares": assumed_diluted_shares,
                    "btc_nav_per_diluted_share_usd": btc_nav_per_diluted_share_usd,
                },
            )

        series.append(
            {
                "date": day,
                "btcHoldings": safe_round(btc_holdings, 6),
                "btcPriceUsd": safe_round(btc_price_usd, 2),
                "assumedDilutedShares": assumed_diluted_shares,
                "btcPerDilutedShare": safe_round(btc_per_diluted_share, 8),
                "btcNavPerDilutedShareUsd": safe_round(btc_nav_per_diluted_share_usd, 6),
                "dailyHoldingChangeBtc": safe_round(daily_holding_change, 6),
            }
        )
        previous_holdings = btc_holdings

    dbg("series built, length =", len(series))

    latest = series[-1]
    dbg("latest row =", latest)

    nav_change_30d = percent_change(
        float(latest["btcNavPerDilutedShareUsd"]),
        find_previous_value(series, "btcNavPerDilutedShareUsd", 30),
    )
    nav_change_90d = percent_change(
        float(latest["btcNavPerDilutedShareUsd"]),
        find_previous_value(series, "btcNavPerDilutedShareUsd", 90),
    )
    btc_price_change_30d = percent_change(
        float(latest["btcPriceUsd"]),
        find_previous_value(series, "btcPriceUsd", 30),
    )
    holdings_30d_past = find_previous_value(series, "btcHoldings", 30)
    holdings_change_30d = None if holdings_30d_past is None else float(latest["btcHoldings"]) - holdings_30d_past

    generated_at = datetime.now(tz=UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    dbg("generated_at =", generated_at)

    dataset = {
        "metadata": {
            "status": "Ready",
            "generatedAtUtc": generated_at,
            "entityId": ENTITY_ID,
            "entityDisplayName": ENTITY_DISPLAY_NAME,
            "coinId": COIN_ID,
            "selectedIndicator": "BTC NAV per Diluted Share (USD)",
            "formula": "(BTC Holdings / Diluted Shares) × BTC Price",
            "assumption": (
                "Official diluted-share snapshots are forward-filled until the next official Strategy snapshot date."
            ),
            "shareSnapshots": SHARE_SNAPSHOTS,
            "sources": SOURCE_METADATA,
        },
        "summary": {
            "latestDate": latest["date"],
            "latestBtcNavPerDilutedShareUsd": latest["btcNavPerDilutedShareUsd"],
            "latestBtcPerDilutedShare": latest["btcPerDilutedShare"],
            "latestBtcHoldings": latest["btcHoldings"],
            "latestBtcPriceUsd": latest["btcPriceUsd"],
            "latestAssumedDilutedShares": latest["assumedDilutedShares"],
            "navChange30dPct": safe_round(nav_change_30d, 4),
            "navChange90dPct": safe_round(nav_change_90d, 4),
            "btcPriceChange30dPct": safe_round(btc_price_change_30d, 4),
            "holdingsChange30dBtc": safe_round(holdings_change_30d, 6),
            "rowCount": len(series),
            "autoSummary": build_auto_summary(series),
        },
        "series": series,
    }

    dbg("dataset summary =", dataset["summary"])
    return dataset

def write_placeholder() -> None:
    dbg("write_placeholder() start")
    placeholder = {
        "metadata": {
            "status": "Placeholder",
            "generatedAtUtc": "Not generated yet",
            "entityId": ENTITY_ID,
            "entityDisplayName": ENTITY_DISPLAY_NAME,
            "coinId": COIN_ID,
            "selectedIndicator": "BTC NAV per Diluted Share (USD)",
            "formula": "(BTC Holdings / Diluted Shares) × BTC Price",
            "assumption": "Run the sync script to generate live data.",
            "shareSnapshots": SHARE_SNAPSHOTS,
            "sources": SOURCE_METADATA,
        },
        "summary": {},
        "series": [],
    }
    dbg("placeholder output path =", OUTPUT_PATH)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(placeholder, indent=2), encoding="utf-8")
    dbg("write_placeholder() done")

def main() -> int:
    dbg("main() start")
    dbg("__file__ =", __file__)
    dbg("PROJECT_ROOT =", PROJECT_ROOT)
    dbg("OUTPUT_PATH =", OUTPUT_PATH)

    try:
        dataset = build_dataset()
        dbg("build_dataset() success")
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        dbg("writing dataset to", OUTPUT_PATH)
        OUTPUT_PATH.write_text(json.dumps(dataset, indent=2), encoding="utf-8")
        dbg("write dataset done")

        print(f"Saved {len(dataset['series'])} daily rows to {OUTPUT_PATH}")
        print(f"Latest date: {dataset['summary']['latestDate']}")
        print(
            "Latest BTC NAV/share (USD): "
            f"{dataset['summary']['latestBtcNavPerDilutedShareUsd']:.4f}"
        )
        return 0

    except Exception as exc:
        dbg("EXCEPTION TYPE =", type(exc).__name__)
        dbg("EXCEPTION =", repr(exc))
        traceback.print_exc()

        try:
            write_placeholder()
        except Exception as write_exc:
            dbg("write_placeholder failed:", repr(write_exc))
            traceback.print_exc()

        print("Failed to build live dataset.")
        print(f"Reason: {exc}")
        print(
            "A placeholder file was written to data/indicator.json so the website can still load. "
            "Check your internet connection and rerun this script."
        )
        return 1

if __name__ == "__main__":
    dbg("__main__ reached")
    raise SystemExit(main())