"""
Order number generator.
Generates unique order numbers for purchases.
"""

import logging
import threading
import uuid
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


class HexOrderGenerator:
    """Generate order numbers with random hex suffix.

    Used by agent-buy orders (legacy BUY + 10hex format).
    Format: PREFIX + N-digit uppercase hex (default 10).
    Example: BUY1A2B3C4D5E
    """

    _HEX_CHARS = frozenset("0123456789ABCDEFabcdef")

    def __init__(self, prefix: str = "BUY", hex_length: int = 10):
        self.prefix = prefix
        self.hex_length = hex_length

    def generate(self) -> str:
        return f"{self.prefix}{uuid.uuid4().hex[:self.hex_length].upper()}"

    def validate(self, order_no: str) -> bool:
        if not isinstance(order_no, str):
            return False
        if not order_no.startswith(self.prefix):
            return False
        hex_part = order_no[len(self.prefix):]
        if len(hex_part) != self.hex_length:
            return False
        return all(c in self._HEX_CHARS for c in hex_part)

    def parse(self, order_no: str) -> dict | None:
        if not self.validate(order_no):
            return None
        return {
            "prefix": self.prefix,
            "hex_part": order_no[len(self.prefix):],
        }


# Pre-built instances
order_generator = OrderNumberGenerator(prefix="WXAT")
developer_order_generator = OrderNumberGenerator(prefix="WXK")
agent_buy_order_generator = HexOrderGenerator(prefix="BUY", hex_length=10)
