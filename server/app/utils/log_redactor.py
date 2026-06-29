"""Bug-115: 结构化日志脱敏引擎.

设计:
  - 字段级正则脱敏: 手机号/身份证/银行卡/邮箱/token/JWT/密码字段
  - 白名单: 指定 key/value 对不过脱敏
  - 黑名单: 指定 key 全部脱敏
  - 覆盖率统计: 各规则命中次数
  - 递归处理: 嵌套 dict/list 均脱敏
  - 可注入: 支持自定义脱敏函数
"""

import logging
import re
import threading
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


# 内置正则
_MOBILE_RE = re.compile(r"\b1[3-9]\d{9}\b")
_ID_CARD_RE = re.compile(r"\b\d{17}[\dXx]\b")
_BANK_CARD_RE = re.compile(r"\b\d{13,19}\b")
_EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
_TOKEN_RE = re.compile(r"(?i)(?:token|bearer|apikey|api.?key)\s*[=:]\s*['\"]*([\w.-]+)")
_JWT_RE = re.compile(r"\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b")


@dataclass
class RedactRule:
    name: str
    pattern: re.Pattern
    replacement: str = "[REDACTED]"
    is_regex: bool = True
    min_len: int = 0  # 匹配前检查原始字符串长度
    max_len: int = 999999


@dataclass
class RedactStats:
    hits: int = 0
    fields_matched: int = 0
    bytes_saved: int = 0

    def record(self, field_count: int, byte_saved: int) -> None:
        self.hits += 1
        self.fields_matched += field_count
        self.bytes_saved += byte_saved


@dataclass
class RedactResult:
    data: Any
    stats: RedactStats
    masked_keys: list[str] = field(default_factory=list)


class LogRedactor:
    """结构化日志脱敏引擎."""

    # 默认密码/密钥相关 key 模式
    SENSITIVE_KEYS = re.compile(
        r"(?i)^(password|passwd|pwd|secret|token|api_key|apikey|"
        r"private.?key|access.?key|access.?token|refresh.?token|"
        r"bearer|authorization|auth.?token|jwt|session.?id|"
        r"cvv|cvc|pin|otp|secure.?string|credential)$"
    )

    def __init__(self):
        self._lock = threading.Lock()
        self._rules: list[RedactRule] = []
        self._whitelist_keys: set[str] = set()
        self._whitelist_values: set[str] = set()
        self._blacklist_keys: set[str] = set()  # 完全黑名单 key
        self._blacklist_key_patterns: list[re.Pattern] = []
        self._custom_funcs: dict[str, Callable[[str], str]] = {}
        self._stats = RedactStats()
        self._by_rule: dict[str, RedactStats] = {}
        self._enable_default_rules = True
        self._enable_sensitive_key_blacklist = True
        # 默认规则
        self._add_default_rules()

    def _add_default_rules(self) -> None:
        """添加内置脱敏规则."""
        self.add_rule(RedactRule("mobile", _MOBILE_RE, "[PHONE]"))
        self.add_rule(RedactRule("id_card", _ID_CARD_RE, "[ID_CARD]"))
        self.add_rule(RedactRule("bank_card", _BANK_CARD_RE, "[BANK_CARD]"))
        self.add_rule(RedactRule("email", _EMAIL_RE, "[EMAIL]"))
        self.add_rule(RedactRule("jwt", _JWT_RE, "[JWT]"))
        self.add_rule(RedactRule("token_kv", _TOKEN_RE, lambda m: m.group(0).replace(m.group(1), "[TOKEN]")))  # type: ignore[arg-type]

    def add_rule(
        self,
        rule: RedactRule,
        replacement_fn: Callable[[Any], str] | None = None,
    ) -> None:
        """注册一条脱敏规则."""
        with self._lock:
            self._rules.append(rule)
            self._by_rule[rule.name] = RedactStats()

    def remove_rule(self, name: str) -> bool:
        """移除指定名称的规则."""
        with self._lock:
            for i, r in enumerate(self._rules):
                if r.name == name:
                    self._rules.pop(i)
                    return True
        return False

    def add_whitelist_key(self, key: str) -> None:
        """白名单 key: 整条跳过脱敏."""
        with self._lock:
            self._whitelist_keys.add(key)

    def add_whitelist_value(self, value: str) -> None:
        """白名单 value: 匹配时不脱敏."""
        with self._lock:
            self._whitelist_values.add(value)

    def add_blacklist_key(self, pattern: str) -> None:
        """黑名单 key pattern: 该 key 全部脱敏为 [REDACTED]."""
        with self._lock:
            try:
                p = re.compile(pattern, re.IGNORECASE)
                self._blacklist_key_patterns.append(p)
            except re.error:
                self._blacklist_keys.add(pattern.lower())

    def register_custom(self, name: str, fn: Callable[[str], str]) -> None:
        """注册自定义脱敏函数 (按 name 调用)."""
        with self._lock:
            self._custom_funcs[name] = fn

    def redact(self, data: Any, context_key: str | None = None) -> RedactResult:
        """对任意结构化数据执行脱敏. 返回脱敏后数据和统计."""
        masked_keys: list[str] = []

        def process_value(key: str | None, value: Any) -> Any:
            if value is None or isinstance(value, (bool, int, float)):
                return value
            if isinstance(value, str):
                return self._redact_string(key, value, masked_keys)
            if isinstance(value, dict):
                return {k: process_value(k, v) for k, v in value.items()}
            if isinstance(value, (list, tuple)):
                return type(value)(process_value(None, item) for item in value)
            return value

        result = process_value(context_key, data)
        return RedactResult(data=result, stats=self._stats, masked_keys=masked_keys)

    def _redact_string(self, key: str | None, value: str, masked_keys: list[str]) -> str:
        if key and key in self._whitelist_keys:
            return value
        if value in self._whitelist_values:
            return value
        # 黑名单 key
        if key and self._is_blacklisted_key(key):
            self._record_hit(0, len(value) - 9, masked_keys, key)
            return "[REDACTED]"
        original_len = len(value)
        result = value
        for rule in self._rules:
            if rule.is_regex and rule.pattern:
                try:
                    if callable(rule.replacement):
                        result = rule.pattern.sub(rule.replacement, result)
                    else:
                        result = rule.pattern.sub(rule.replacement, result)
                except re.error:
                    logger.warning("Caught unexpected exception")
            else:
                result = result.replace(str(rule.pattern), str(rule.replacement))
        if result != value:
            self._record_hit(1, original_len - len(result), masked_keys, key)
        return result

    def _is_blacklisted_key(self, key: str) -> bool:
        if self._enable_sensitive_key_blacklist and self.SENSITIVE_KEYS.search(key):
            return True
        if key.lower() in self._blacklist_keys:
            return True
        return any(p.search(key) for p in self._blacklist_key_patterns)

    def _record_hit(self, fields: int, bytes_saved: int, masked_keys: list[str], key: str | None) -> None:
        with self._lock:
            self._stats.record(fields, bytes_saved)
            if key:
                masked_keys.append(key)

    def stats(self) -> dict:
        """返回脱敏统计 (不含敏感信息)."""
        with self._lock:
            return {
                "total_hits": self._stats.hits,
                "fields_matched": self._stats.fields_matched,
                "bytes_saved": self._stats.bytes_saved,
                "rule_count": len(self._rules),
                "whitelist_keys": len(self._whitelist_keys),
                "blacklist_keys": len(self._blacklist_keys),
                "blacklist_patterns": len(self._blacklist_key_patterns),
                "sensitive_key_blacklist": self._enable_sensitive_key_blacklist,
            }

    def clear_stats(self) -> None:
        """清零统计计数."""
        with self._lock:
            self._stats = RedactStats()
            for s in self._by_rule.values():
                s.hits = 0
                s.fields_matched = 0
                s.bytes_saved = 0

    def enable_default_rules(self, enabled: bool) -> None:
        """开关内置默认规则."""
        with self._lock:
            self._enable_default_rules = enabled

    def enable_sensitive_key_blacklist(self, enabled: bool) -> None:
        """开关敏感 key 自动黑名单."""
        with self._lock:
            self._enable_sensitive_key_blacklist = enabled


# 全局单例
log_redactor = LogRedactor()
