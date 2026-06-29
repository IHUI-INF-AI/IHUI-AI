"""Bug-139: 负数透支 (账户扣减防护).
设计:
  - 账户对象: 余额 + 冻结 + 信用额度
  - 扣减时严格校验: available = balance - frozen
  - 防止负数: 余额不足直接拒单
  - 冻结/解冻/扣减/退还 四种操作
  - 操作幂等 (idempotency_key)
  - 审计日志
"""

from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
from decimal import Decimal
from enum import StrEnum


class TxType(StrEnum):
    FREEZE = "FREEZE"
    UNFREEZE = "UNFREEZE"
    DEBIT = "DEBIT"
    REFUND = "REFUND"


class TxResult(StrEnum):
    SUCCESS = "SUCCESS"
    INSUFFICIENT = "INSUFFICIENT"
    DUPLICATE = "DUPLICATE"
    ACCOUNT_LOCKED = "ACCOUNT_LOCKED"
    NOT_FOUND = "NOT_FOUND"
    INVALID_AMOUNT = "INVALID_AMOUNT"


@dataclass
class Account:
    account_id: str
    balance: Decimal
    frozen: Decimal = Decimal("0")
    credit_limit: Decimal = Decimal("0")
    locked: bool = False
    version: int = 0

    def available(self) -> Decimal:
        """可用余额 = 余额 + 信用额度 - 冻结."""
        return self.balance + self.credit_limit - self.frozen


@dataclass
class Transaction:
    tx_id: str
    idempotency_key: str
    account_id: str
    type: TxType
    amount: Decimal
    result: TxResult
    balance_after: Decimal
    frozen_after: Decimal
    ts: float = field(default_factory=time.time)
    memo: str = ""


class OverdraftGuard:
    """负数透支防护器."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._accounts: dict[str, Account] = {}
        self._txns: list[Transaction] = []
        self._idempotency: dict[str, str] = {}  # key -> tx_id
        self._stats = {r.value: 0 for r in TxResult}

    def _now(self) -> float:
        return time.time()

    def create_account(self, account_id: str, balance: Decimal, credit_limit: Decimal = Decimal("0")) -> Account:
        with self._lock:
            if account_id in self._accounts:
                raise ValueError(f"账户 {account_id} 已存在")
            if balance < 0:
                raise ValueError("初始余额不能为负")
            if credit_limit < 0:
                raise ValueError("信用额度不能为负")
            acc = Account(account_id=account_id, balance=balance, credit_limit=credit_limit)
            self._accounts[account_id] = acc
            return acc

    def get_account(self, account_id: str) -> Account | None:
        with self._lock:
            return self._accounts.get(account_id)

    def set_credit(self, account_id: str, credit_limit: Decimal) -> bool:
        with self._lock:
            acc = self._accounts.get(account_id)
            if acc is None:
                return False
            if credit_limit < 0:
                return False
            acc.credit_limit = credit_limit
            acc.version += 1
            return True

    def set_lock(self, account_id: str, locked: bool) -> bool:
        with self._lock:
            acc = self._accounts.get(account_id)
            if acc is None:
                return False
            acc.locked = locked
            acc.version += 1
            return True

    def _record(
        self,
        tx_id: str,
        idem: str,
        account_id: str,
        t: TxType,
        amount: Decimal,
        result: TxResult,
        balance: Decimal,
        frozen: Decimal,
        memo: str = "",
    ) -> Transaction:
        txn = Transaction(
            tx_id=tx_id,
            idempotency_key=idem,
            account_id=account_id,
            type=t,
            amount=amount,
            result=result,
            balance_after=balance,
            frozen_after=frozen,
            memo=memo,
        )
        with self._lock:
            self._txns.append(txn)
            self._stats[result.value] += 1
            if result == TxResult.SUCCESS and idem:
                self._idempotency[idem] = tx_id
            if len(self._txns) > 10000:
                self._txns = self._txns[-10000:]
        return txn

    def _check_idempotency(self, key: str) -> Transaction | None:
        with self._lock:
            tx_id = self._idempotency.get(key)
            if tx_id is None:
                return None
            for t in reversed(self._txns):
                if t.tx_id == tx_id:
                    return t
            return None

    def freeze(self, account_id: str, amount: Decimal, idempotency_key: str = "", memo: str = "") -> Transaction:
        return self._do(TxType.FREEZE, account_id, amount, idempotency_key, memo)

    def unfreeze(self, account_id: str, amount: Decimal, idempotency_key: str = "", memo: str = "") -> Transaction:
        return self._do(TxType.UNFREEZE, account_id, amount, idempotency_key, memo)

    def debit(self, account_id: str, amount: Decimal, idempotency_key: str = "", memo: str = "") -> Transaction:
        return self._do(TxType.DEBIT, account_id, amount, idempotency_key, memo)

    def refund(self, account_id: str, amount: Decimal, idempotency_key: str = "", memo: str = "") -> Transaction:
        return self._do(TxType.REFUND, account_id, amount, idempotency_key, memo)

    def _do(self, t: TxType, account_id: str, amount: Decimal, idem: str, memo: str) -> Transaction:
        if amount <= 0:
            return self._record(
                uuid.uuid4().hex, idem, account_id, t, amount, TxResult.INVALID_AMOUNT, Decimal("0"), Decimal("0"), memo
            )
        existing = self._check_idempotency(idem) if idem else None
        if existing is not None:
            return existing
        with self._lock:
            acc = self._accounts.get(account_id)
            if acc is None:
                return self._record(
                    uuid.uuid4().hex, idem, account_id, t, amount, TxResult.NOT_FOUND, Decimal("0"), Decimal("0"), memo
                )
            if acc.locked:
                return self._record(
                    uuid.uuid4().hex,
                    idem,
                    account_id,
                    t,
                    amount,
                    TxResult.ACCOUNT_LOCKED,
                    acc.balance,
                    acc.frozen,
                    memo,
                )
            if t == TxType.FREEZE:
                if acc.available() < amount:
                    return self._record(
                        uuid.uuid4().hex,
                        idem,
                        account_id,
                        t,
                        amount,
                        TxResult.INSUFFICIENT,
                        acc.balance,
                        acc.frozen,
                        memo,
                    )
                acc.frozen += amount
            elif t == TxType.UNFREEZE:
                if acc.frozen < amount:
                    return self._record(
                        uuid.uuid4().hex,
                        idem,
                        account_id,
                        t,
                        amount,
                        TxResult.INSUFFICIENT,
                        acc.balance,
                        acc.frozen,
                        memo,
                    )
                acc.frozen -= amount
            elif t == TxType.DEBIT:
                # 优先扣 balance, 再扣 frozen
                if acc.available() < amount:
                    return self._record(
                        uuid.uuid4().hex,
                        idem,
                        account_id,
                        t,
                        amount,
                        TxResult.INSUFFICIENT,
                        acc.balance,
                        acc.frozen,
                        memo,
                    )
                if acc.balance >= amount:
                    acc.balance -= amount
                else:
                    remaining = amount - acc.balance
                    acc.balance = Decimal("0")
                    if acc.frozen >= remaining:
                        acc.frozen -= remaining
                    else:
                        acc.frozen = Decimal("0")
            elif t == TxType.REFUND:
                acc.balance += amount
            acc.version += 1
            return self._record(
                uuid.uuid4().hex, idem, account_id, t, amount, TxResult.SUCCESS, acc.balance, acc.frozen, memo
            )

    def transactions(self, account_id: str | None = None, limit: int = 100) -> list[Transaction]:
        with self._lock:
            txns = [t for t in self._txns if account_id is None or t.account_id == account_id]
        return txns[-limit:]

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {**self._stats, "accounts": len(self._accounts)}
