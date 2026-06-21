"""Bug-133: 金额精度 (Decimal 替代 float).
设计:
  - 所有金额以 Decimal + 元(quantize=0.01) 表达
  - 支持 加/减/乘/除/分转元/元转分
  - 强类型 Money 包装, 防止与 float 混算
  - 校验金额: 范围 / 精度 / 非负
"""

from __future__ import annotations

import threading
from collections.abc import Iterable
from dataclasses import dataclass
from decimal import ROUND_DOWN, ROUND_HALF_UP, Decimal, InvalidOperation, getcontext
from decimal import ROUND_HALF_EVEN as _RHE
from enum import StrEnum
from typing import Any

# 金融计算: 全局精度 28 位
getcontext().prec = 28

CENT = Decimal("0.01")
FEN = Decimal("0.01")  # 分 = 0.01 元
YUAN_QUANT = Decimal("0.01")


class MoneyError(Exception):
    pass


class RoundingMode(StrEnum):
    HALF_UP = "HALF_UP"  # 银行家舍入 (四舍五入)
    DOWN = "DOWN"  # 向下截断
    UP = "UP"  # 向上
    HALF_EVEN = "HALF_EVEN"  # 银行家舍入 (四舍六入五成双)


_ROUND_MAP = {
    RoundingMode.HALF_UP: ROUND_HALF_UP,
    RoundingMode.DOWN: ROUND_DOWN,
    RoundingMode.HALF_EVEN: _RHE,
}


def to_decimal(v: int | float | str | Decimal) -> Decimal:
    if isinstance(v, Decimal):
        return v
    if isinstance(v, int):
        return Decimal(v)
    if isinstance(v, float):
        # 防止 float 精度串入, 用 str 中转
        return Decimal(str(v))
    if isinstance(v, str):
        try:
            return Decimal(v.strip())
        except InvalidOperation as e:
            raise MoneyError(f"无法解析为 Decimal: {v!r}") from e
    raise MoneyError(f"不支持的类型: {type(v).__name__}")


@dataclass(frozen=True)
class Money:
    """金额强类型包装 (元)."""

    amount: Decimal
    currency: str = "CNY"

    def __post_init__(self) -> None:
        if not isinstance(self.amount, Decimal):
            object.__setattr__(self, "amount", to_decimal(self.amount))

    @classmethod
    def zero(cls, currency: str = "CNY") -> Money:
        return cls(Decimal("0"), currency)

    @classmethod
    def from_yuan(cls, yuan: int | float | str | Decimal, currency: str = "CNY") -> Money:
        return cls(to_decimal(yuan), currency)

    @classmethod
    def from_fen(cls, fen: int | str | Decimal, currency: str = "CNY") -> Money:
        # 1 元 = 100 分, 入参 fen 视为"分"
        return cls(to_decimal(fen) * FEN, currency)

    def to_fen(self) -> int:
        return int((self.amount * 100).quantize(Decimal("1"), rounding=ROUND_DOWN))

    def quantize(self, mode: RoundingMode = RoundingMode.HALF_UP) -> Money:
        rm = _ROUND_MAP[mode]
        return Money(self.amount.quantize(YUAN_QUANT, rounding=rm), self.currency)

    def is_zero(self) -> bool:
        return self.amount == 0

    def is_positive(self) -> bool:
        return self.amount > 0

    def is_negative(self) -> bool:
        return self.amount < 0

    def _check_currency(self, other: Money) -> None:
        if self.currency != other.currency:
            raise MoneyError(f"币种不一致: {self.currency} vs {other.currency}")

    def __add__(self, other: Money) -> Money:
        if not isinstance(other, Money):
            return NotImplemented
        self._check_currency(other)
        return Money(self.amount + other.amount, self.currency)

    def __sub__(self, other: Money) -> Money:
        if not isinstance(other, Money):
            return NotImplemented
        self._check_currency(other)
        return Money(self.amount - other.amount, self.currency)

    def __mul__(self, factor: int | float | Decimal) -> Money:
        return Money(self.amount * to_decimal(factor), self.currency)

    __rmul__ = __mul__

    def __truediv__(self, divisor: int | float | Decimal) -> Money:
        return Money(self.amount / to_decimal(divisor), self.currency)

    def __neg__(self) -> Money:
        return Money(-self.amount, self.currency)

    def __abs__(self) -> Money:
        return Money(abs(self.amount), self.currency)

    def __lt__(self, other: Money) -> bool:
        self._check_currency(other)
        return self.amount < other.amount

    def __le__(self, other: Money) -> bool:
        self._check_currency(other)
        return self.amount <= other.amount

    def __gt__(self, other: Money) -> bool:
        self._check_currency(other)
        return self.amount > other.amount

    def __ge__(self, other: Money) -> bool:
        self._check_currency(other)
        return self.amount >= other.amount

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, Money):
            return NotImplemented
        return self.currency == other.currency and self.amount == other.amount

    def __hash__(self) -> int:
        return hash((str(self.amount.quantize(YUAN_QUANT)), self.currency))

    def __str__(self) -> str:
        return f"{self.currency} {self.amount.quantize(YUAN_QUANT)}"

    def __repr__(self) -> str:
        return f"Money({self.amount.quantize(YUAN_QUANT)!s}, {self.currency!r})"


@dataclass(frozen=True)
class MoneyRange:
    """金额合法范围."""

    min_amount: Money
    max_amount: Money

    def contains(self, m: Money) -> bool:
        return self.min_amount <= m <= self.max_amount


def sum_money(items: Iterable[Money], currency: str = "CNY") -> Money:
    """金额累加 (同币种)."""
    total = Money.zero(currency)
    for it in items:
        total = total + it
    return total


def split_money(total: Money, ratios: list[Decimal]) -> list[Money]:
    """按比例分账, 余数补到第一项, 保证 sum = total.
    ratios 可以不归一化, 内部按 sum 归一化."""
    if not ratios:
        raise MoneyError("ratios 不能为空")
    rsum = sum((to_decimal(r) for r in ratios), Decimal("0"))
    if rsum <= 0:
        raise MoneyError("ratios 之和必须 > 0")
    norm = [to_decimal(r) / rsum for r in ratios]
    parts: list[Money] = []
    allocated = Money.zero(total.currency)
    for _i, r in enumerate(norm[:-1]):
        amt = total.amount * r
        m = Money(amt.quantize(YUAN_QUANT, rounding=ROUND_DOWN), total.currency)
        parts.append(m)
        allocated = allocated + m
    # 末项拿剩余
    last = total - allocated
    parts.append(last)
    return parts


class MoneyValidator:
    """金额校验器."""

    def __init__(
        self,
        min_amount: Money | None = None,
        max_amount: Money | None = None,
        allow_zero: bool = False,
        allow_negative: bool = False,
    ) -> None:
        self.min_amount = min_amount
        self.max_amount = max_amount
        self.allow_zero = allow_zero
        self.allow_negative = allow_negative
        self._lock = threading.RLock()
        self._stats = {"checked": 0, "rejected": 0}

    def validate(self, m: Money) -> bool:
        with self._lock:
            self._stats["checked"] += 1
            if not self.allow_zero and m.is_zero():
                self._stats["rejected"] += 1
                return False
            if not self.allow_negative and m.is_negative():
                self._stats["rejected"] += 1
                return False
            if self.min_amount is not None and m < self.min_amount:
                self._stats["rejected"] += 1
                return False
            if self.max_amount is not None and m > self.max_amount:
                self._stats["rejected"] += 1
                return False
            return True

    def stats(self) -> dict:
        with self._lock:
            return dict(self._stats)
