"""Display formatting helpers."""

from __future__ import annotations


def format_currency(value: float) -> str:
    """Render a dollar amount with thousands separators and no cents."""
    return f"${value:,.0f}"


def format_compact(value: float) -> str:
    """Abbreviate large dollar amounts, e.g. 1_250_000 -> '$1.3M'."""
    absolute = abs(value)
    if absolute >= 1_000_000_000:
        return f"${value / 1_000_000_000:.1f}B"
    if absolute >= 1_000_000:
        return f"${value / 1_000_000:.1f}M"
    if absolute >= 1_000:
        return f"${value / 1_000:.0f}k"
    return f"${value:.0f}"
