"""Bug-125: 数据脱敏管道.

设计:
  - 多种脱敏算法: 全掩码 / 部分掩码 / 哈希 / AES 加密 / 自定义
  - 字段级 (field-level) + 行级 (row-level filter)
  - 可配置策略: 每字段绑定一种算法
  - 审计: 记录被脱敏的字段和位置
  - 递归处理: dict / list 嵌套
  - 注入: 自定义算法函数
"""

import base64
import enum
import hashlib
import hmac
import logging
import os
import re
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, ClassVar

logger = logging.getLogger(__name__)


class MaskStrategy(enum.StrEnum):
    FULL = "full"  # 全掩码: [REDACTED]
    PARTIAL = "partial"  # 部分掩码: 保留前 N 后 M
    HASH = "hash"  # SHA256 哈希
    HMAC = "hmac"  # HMAC-SHA256
    AES = "aes"  # AES 加密 (base64)
    EMAIL = "email"  # 邮箱: a***@e.com
    PHONE = "phone"  # 手机: 138****8000
    ID_CARD = "id_card"  # 身份证: 110101********1234
    KEEP_PREFIX = "keep_prefix"  # 仅保留前 N
    CUSTOM = "custom"  # 自定义函数


@dataclass
class FieldMaskRule:
    field: str
    strategy: str = MaskStrategy.FULL.value
    keep_prefix: int = 0
    keep_suffix: int = 0
    custom_fn: Callable[[Any], Any] | None = None
    enabled: bool = True


@dataclass
class MaskAudit:
    ts: float
    field: str
    strategy: str
    original_hash: str = ""  # 原值的 hash, 便于审计追踪
    replaced: str = ""


class DataMaskingPipeline:
    """数据脱敏管道."""

    DEFAULT_SENSITIVE_FIELDS: ClassVar[set] = {
        "password",
        "passwd",
        "pwd",
        "secret",
        "token",
        "api_key",
        "apikey",
        "private_key",
        "access_key",
        "id_card",
        "idcard",
        "身份证",
        "身份证号",
        "手机号",
        "phone_number",
        "mobile",
        "ssn",
        "credit_card",
        "bank_card",
        "cvv",
        "cvc",
        "email",
        "邮箱",
        "address",
        "地址",
    }

    def __init__(self, secret_key: bytes | None = None, default_strategy: str = MaskStrategy.FULL.value):
        self._lock = threading.RLock()
        self._secret_key = secret_key or os.urandom(32)
        self._default_strategy = default_strategy
        # 字段规则
        self._rules: dict[str, FieldMaskRule] = {}
        # 全局敏感字段
        self._sensitive_fields: set[str] = set(self.DEFAULT_SENSITIVE_FIELDS)
        # 自定义算法
        self._custom_algorithms: dict[str, Callable[[Any, bytes], str]] = {}
        # 行级过滤
        self._row_filters: list[Callable[[dict[str, Any]], bool]] = []
        # 审计
        self._audits: deque[MaskAudit] = deque(maxlen=2000)
        # 统计
        self._total_masked = 0
        self._total_skipped = 0
        self._total_filtered = 0

    def add_rule(self, rule: FieldMaskRule) -> None:
        with self._lock:
            self._rules[rule.field] = rule

    def remove_rule(self, field: str) -> bool:
        with self._lock:
            return self._rules.pop(field, None) is not None

    def add_sensitive_field(self, field: str) -> None:
        with self._lock:
            self._sensitive_fields.add(field)

    def register_algorithm(self, name: str, fn: Callable[[Any, bytes], str]) -> None:
        with self._lock:
            self._custom_algorithms[name] = fn

    def add_row_filter(self, fn: Callable[[dict[str, Any]], bool]) -> None:
        with self._lock:
            self._row_filters.append(fn)

    def mask(self, data: Any, field_name: str | None = None) -> Any:
        """递归脱敏. 返回脱敏后数据."""
        if isinstance(data, dict):
            return self._mask_dict(data)
        if isinstance(data, list):
            return [self.mask(item, None) for item in data]
        if (isinstance(data, (str, int, float, bool)) or data is None) and field_name is not None:
            return self._mask_value(field_name, data)
        return data

    def mask_rows(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out = []
        for row in rows:
            if any(f(row) for f in self._row_filters):
                with self._lock:
                    self._total_filtered += 1
                continue
            out.append(self._mask_dict(row))
        return out

    def _mask_dict(self, d: dict[str, Any]) -> dict[str, Any]:
        out = {}
        for k, v in d.items():
            out[k] = self.mask(v, k)
        return out

    def _mask_value(self, field: str, value: Any) -> Any:
        if value is None:
            return value
        # 找到适用规则
        rule = self._rules.get(field)
        if rule is None and self._is_sensitive(field):
            rule = FieldMaskRule(field=field, strategy=self._default_strategy)
        if rule is None or not rule.enabled:
            with self._lock:
                self._total_skipped += 1
            return value
        return self._apply_strategy(rule, value)

    def _is_sensitive(self, field: str) -> bool:
        f = field.lower()
        return any(f == s.lower() or s.lower() in f for s in self._sensitive_fields)

    def _apply_strategy(self, rule: FieldMaskRule, value: Any) -> str:
        s = str(value)
        strategy = rule.strategy
        if strategy == MaskStrategy.FULL.value:
            res = "[REDACTED]"
        elif strategy == MaskStrategy.PARTIAL.value:
            res = self._partial_mask(s, rule.keep_prefix, rule.keep_suffix)
        elif strategy == MaskStrategy.KEEP_PREFIX.value:
            res = s[: rule.keep_prefix] + "***" if len(s) > rule.keep_prefix else "***"
        elif strategy == MaskStrategy.HASH.value:
            res = hashlib.sha256(s.encode("utf-8")).hexdigest()[:16]
        elif strategy == MaskStrategy.HMAC.value:
            res = hmac.new(self._secret_key, s.encode("utf-8"), hashlib.sha256).hexdigest()[:16]
        elif strategy == MaskStrategy.AES.value:
            res = self._aes_like_encrypt(s)
        elif strategy == MaskStrategy.EMAIL.value:
            res = self._email_mask(s)
        elif strategy == MaskStrategy.PHONE.value:
            res = self._phone_mask(s)
        elif strategy == MaskStrategy.ID_CARD.value:
            res = self._id_card_mask(s)
        elif strategy == MaskStrategy.CUSTOM.value and rule.custom_fn is not None:
            try:
                res = str(rule.custom_fn(value))
            except Exception:
                res = "[ERROR]"
        else:
            res = "[REDACTED]"
        with self._lock:
            self._total_masked += 1
            self._audits.append(
                MaskAudit(
                    ts=time.time(),
                    field=rule.field,
                    strategy=strategy,
                    original_hash=hashlib.sha256(s.encode("utf-8")).hexdigest()[:12],
                    replaced=res[:50],
                )
            )
        return res

    def _partial_mask(self, s: str, prefix: int, suffix: int) -> str:
        if len(s) <= prefix + suffix:
            return "***"
        return (
            s[:prefix] + "*" * (len(s) - prefix - suffix) + s[-suffix:]
            if suffix > 0
            else s[:prefix] + "*" * (len(s) - prefix)
        )

    def _email_mask(self, s: str) -> str:
        if "@" not in s:
            return self._partial_mask(s, 1, 0)
        local, domain = s.split("@", 1)
        if not local:
            return "***@" + domain
        return local[0] + "***@" + domain

    def _phone_mask(self, s: str) -> str:
        digits = re.sub(r"\D", "", s)
        if len(digits) >= 7:
            return digits[:3] + "****" + digits[-4:]
        return "***"

    def _id_card_mask(self, s: str) -> str:
        if len(s) >= 8:
            return s[:6] + "*" * (len(s) - 10) + s[-4:]
        return "***"

    def _aes_like_encrypt(self, s: str) -> str:
        # 简化: 用 XOR + base64 (非生产级 AES, 仅作示意)
        key = self._secret_key
        raw = s.encode("utf-8")
        xored = bytes(b ^ key[i % len(key)] for i, b in enumerate(raw))
        return "AES:" + base64.b64encode(xored).decode("ascii")

    def list_audits(self, limit: int = 100) -> list[MaskAudit]:
        with self._lock:
            return list(self._audits)[-limit:]

    def stats(self) -> dict:
        with self._lock:
            return {
                "total_masked": self._total_masked,
                "total_skipped": self._total_skipped,
                "total_filtered": self._total_filtered,
                "rule_count": len(self._rules),
                "sensitive_field_count": len(self._sensitive_fields),
                "custom_algorithm_count": len(self._custom_algorithms),
                "row_filter_count": len(self._row_filters),
            }


# 全局单例
data_masking = DataMaskingPipeline()
