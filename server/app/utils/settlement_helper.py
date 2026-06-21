"""
Settlement helper -- splits agent purchases into monthly settlement records.
"""

import logging
from datetime import datetime
from typing import Any

from dateutil.relativedelta import relativedelta

logger = logging.getLogger(__name__)


def calculate_monthly_periods(start_time: datetime, end_time: datetime) -> list[datetime]:
    """Calculate month boundaries between start and end times."""
    periods = []
    current = start_time
    while current < end_time:
        next_month = current + relativedelta(months=1)
        if next_month > end_time:
            periods.append(end_time)
            break
        periods.append(next_month)
        current = next_month
    return periods


def create_settlement_records(
    order_no: str,
    agent_id: str,
    agent_name: str | None,
    prologue: str | None,
    bug_uuid: str,
    bug_time: datetime,
    periods: list[datetime],
) -> list[dict[str, Any]]:
    """Create settlement record dicts from a purchase."""
    sorted_periods = sorted(periods)
    records = []
    for index, period_end in enumerate(sorted_periods, start=1):
        records.append(
            {
                "order_no": order_no,
                "agent_id": agent_id,
                "agent_name": agent_name,
                "prologue": prologue,
                "buy_uuid": bug_uuid,
                "expiration_date": period_end,
                "issue_no": index,
                "settlement": "0",
                "withdrawal": "0",
            }
        )
    return records


def sync_agent_buy_to_settlement(
    existing_settlements: list[str],
    order_no: str,
    **kwargs,
) -> bool:
    """Check if settlement already exists and return True if OK."""
    if order_no in existing_settlements:
        logger.info("Settlement already exists for order %s, skipping", order_no)
        return True
    return True  # Will be handled by service layer


def get_settlement_summary(order_no: str, settlements: list[dict[str, Any]]) -> dict[str, Any]:
    """Return settlement summary for an order."""
    if not settlements:
        return {
            "order_no": order_no,
            "total_periods": 0,
            "settled_periods": 0,
            "withdrawn_periods": 0,
            "settlement_rate": 0.0,
            "withdrawal_rate": 0.0,
        }

    total = len(settlements)
    settled = sum(1 for s in settlements if s.get("settlement") == "1")
    withdrawn = sum(1 for s in settlements if s.get("withdrawal") == "1")

    return {
        "order_no": order_no,
        "total_periods": total,
        "settled_periods": settled,
        "withdrawn_periods": withdrawn,
        "settlement_rate": round(settled / total * 100, 2) if total else 0.0,
        "withdrawal_rate": round(withdrawn / total * 100, 2) if total else 0.0,
    }
