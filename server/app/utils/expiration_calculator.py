"""
Expiration date calculator.
Calculates agent subscription expiration based on pricing plans.
"""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)

FREE_DURATION_MAP = {
    "1": 1,  # 1 month
    "2": 3,  # 3 months
    "3": 6,  # 6 months
    "4": 12,  # 1 year
}


def calculate_free_duration_months(limit_free: str) -> int:
    """Return free trial months from limit_free code."""
    return FREE_DURATION_MAP.get(str(limit_free), 0)


def calculate_expiration_date(
    type_val: str,
    type_child: str,
    limit_free: str | None = None,
    count: int = 1,
    current_time: datetime | None = None,
) -> datetime:
    """
    Calculate expiration date based on pricing plan.

    Args:
        type_val: "1"=free, "2"=limited-free, "3"=paid
        type_child: "1"=monthly, "2"=yearly, "3"=permanent
        limit_free: limited-free duration code
        count: purchase count (months or years depending on type_child)
        current_time: reference time (default: now)

    Returns:
        datetime: expiration date
    """
    from dateutil.relativedelta import relativedelta

    if current_time is None:
        current_time = datetime.now()

    limit_free = limit_free or "0"
    free_months = calculate_free_duration_months(limit_free)

    if type_val == "1":
        # Free: always 5 years
        return current_time + relativedelta(years=5)

    elif type_val == "2":
        # Limited-free
        if type_child == "1":  # monthly
            return current_time + relativedelta(months=count) + relativedelta(months=free_months)
        elif type_child == "2":  # yearly
            return current_time + relativedelta(years=count) + relativedelta(months=free_months)
        elif type_child == "3":  # permanent
            return current_time + relativedelta(years=5)
        else:
            return current_time + relativedelta(months=count) + relativedelta(months=free_months)

    elif type_val == "3":
        # Paid
        if type_child == "1":  # monthly
            return current_time + relativedelta(months=count)
        elif type_child == "2":  # yearly
            return current_time + relativedelta(years=count)
        elif type_child == "3":  # permanent
            return current_time + relativedelta(years=5)
        else:
            return current_time + relativedelta(months=count)

    return current_time + relativedelta(months=count)
