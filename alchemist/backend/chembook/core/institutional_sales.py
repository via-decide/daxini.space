from __future__ import annotations

from typing import Dict, List


def build_bulk_sales_offers(series_size: int = 10) -> List[Dict[str, object]]:
    return [
        {
            "tier": "Department Starter",
            "min_copies": 50,
            "discount_pct": 15,
            "includes": ["Instructor guide", "Assessment bank"],
        },
        {
            "tier": "Campus Program",
            "min_copies": 200,
            "discount_pct": 28,
            "includes": ["Instructor guide", "Assessment bank", "LMS-ready question packs"],
        },
        {
            "tier": "Consortium License",
            "min_copies": 1000,
            "discount_pct": 40,
            "includes": ["Multi-campus rights", f"All {series_size} books", "Annual update addendum"],
        },
    ]


def forecast_bulk_revenue(avg_unit_price: float = 39.99) -> Dict[str, float]:
    offers = build_bulk_sales_offers()
    forecast = {}
    for offer in offers:
        copies = offer["min_copies"]
        price = avg_unit_price * (1 - offer["discount_pct"] / 100)
        forecast[offer["tier"]] = round(copies * price, 2)
    return forecast
