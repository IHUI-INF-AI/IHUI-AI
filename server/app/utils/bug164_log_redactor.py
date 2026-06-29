"""Bug-164: 日志脱敏.

正则 + key 列表 + hash 替换 + 字段白名单.
"""

import hashlib
import re
import threading
from dataclasses import dataclass


@dataclass
class RedactionRule:
    name: str
    pattern: re.Pattern
    replace: str = "[REDACTED]"
    hash_salt: bool = False


DEFAULT_RULES: list[RedactionRule] = [
    RedactionRule(
        "phone_cn",
        re.compile(r"\b1[3-9]\d{9}\b"),
    ),
    RedactionRule(
        "id_card_cn",
        re.compile(r"\b\d{17}[\dXx]\b"),
    ),
    RedactionRule(
        "email",
        re.compile(r"\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b"),
    ),
    RedactionRule(
        "card_no",
        re.compile(r"\b(?:\d[ -]?){13,19}\b"),
    ),
    RedactionRule(
        "bearer_token",
        re.compile(r"(?i)bearer\s+[A-Za-z0-9._\-]{8,}"),
    ),
    RedactionRule(
        "jwt",
        re.compile(r"eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+"),
    ),
]


class LogRedactor:
    """日志脱敏: 规则匹配 + 字段 key 列表 + 可选 hash 替换."""

    def __init__(
        self,
        rules: list[RedactionRule] | None = None,
        extra_keys: list[str] | None = None,
        hash_salt: str = "zhs",
    ):
        self._rules = rules or DEFAULT_RULES
        self._keys = set(extra_keys or ["password", "token", "secret", "api_key", "authorization", "cookie"])
        self._salt = hash_salt
        self._lock = threading.Lock()
        self._hits: dict[str, int] = {}
        self._compiled: dict[str, re.Pattern] = {r.name: r.pattern for r in self._rules}

    def add_rule(self, name: str, pattern: str, replace: str = "[REDACTED]", hash_salt: bool = False) -> None:
        with self._lock:
            self._rules.append(RedactionRule(name, re.compile(pattern), replace, hash_salt))
            self._compiled[name] = re.compile(pattern)
            self._hits[name] = 0

    def add_key(self, key: str) -> None:
        self._keys.add(key.lower())

    def _hash_val(self, v: str) -> str:
        h = hashlib.sha256((self._salt + v).encode("utf-8")).hexdigest()[:10]
        return f"[HASH:{h}]"

    def redact_value(self, key: str, value: object) -> object:
        if not isinstance(value, str):
            return value
        lk = key.lower()
        if lk in self._keys:
            return "[REDACTED]"
        return self.redact_text(value)

    def redact_text(self, text: str) -> str:
        if not text:
            return text
        out = text
        with self._lock:
            rules = list(self._rules)
        for r in rules:

            def _sub(m, _r=r):
                self._hits[_r.name] = self._hits.get(_r.name, 0) + 1
                if _r.hash_salt:
                    return self._hash_val(m.group(0))
                return _r.replace

            out = r.pattern.sub(_sub, out)
        return out

    def redact_dict(self, data: dict[str, object]) -> dict[str, object]:
        out: dict[str, object] = {}
        for k, v in data.items():
            if isinstance(v, dict):
                out[k] = self.redact_dict(v)
            elif isinstance(v, str):
                out[k] = self.redact_value(k, v)
            else:
                out[k] = v
        return out

    def stats(self) -> dict[str, int]:
        with self._lock:
            return dict(self._hits)
