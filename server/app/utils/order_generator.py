"""
Order number generator.
Generates unique order numbers for purchases.
"""

import logging
import threading
from datetime import datetime

logger = logging.getLogger(__name__)

# 全局序列号计数器 (线程安全)
_sequence_lock = threading.Lock()
_sequence_counter: int = 0


class OrderNumberGenerator:
    """Generate unique order numbers with date-based sequential suffix."""

    def __init__(self, prefix: str = "WXAT"):
        self.prefix = prefix

    def generate(self, date: datetime | None = None, sequence: int | None = None) -> str:
        """
        Format: PREFIX + YYYYMMDD + 7-digit sequence
        Example: WXAT202606120000001
        """
        global _sequence_counter
        if sequence is None:
            with _sequence_lock:
                _sequence_counter += 1
                sequence = _sequence_counter
        if date is None:
            date = datetime.now()
        date_str = date.strftime("%Y%m%d")
        return f"{self.prefix}{date_str}{sequence:07d}"

    def validate(self, order_no: str) -> bool:
        if len(order_no) != len(self.prefix) + 15:
            return False
        if not order_no.startswith(self.prefix):
            return False
        date_part = order_no[len(self.prefix) : len(self.prefix) + 8]
        if not date_part.isdigit():
            return False
        try:
            datetime.strptime(date_part, "%Y%m%d")
        except ValueError:
            return False
        return True

    def parse(self, order_no: str) -> dict | None:
        if not self.validate(order_no):
            return None
        return {
            "prefix": self.prefix,
            "date_str": order_no[len(self.prefix) : len(self.prefix) + 8],
            "sequence": int(order_no[-7:]),
        }


# Pre-built instances
order_generator = OrderNumberGenerator(prefix="WXAT")
developer_order_generator = OrderNumberGenerator(prefix="WXK")
