"""Bug-90: API 响应脱敏 (基于 JSONPath 字段级 mask).

设计:
  - 规则格式: jsonpath=mask_type  (e.g. $.user.password=hash, $.user.email=email)
  - mask_type: full / email / phone / idcard / last4 / hash / token
  - 支持 audit 模式: 哪些字段被脱敏 + 命中次数
  - 支持 dry_run: 仅统计, 不真改
  - 区分内部 / 外部 audience
  - thread-safe

使用:
    from app.utils.api_mask import response_masker

    response_masker.add_rule("$.user.password", mask="full")
    response_masker.add_rule("$.user.email", mask="email")
    response_masker.set_audience("external")
    out = response_masker.mask(payload)
"""

import hashlib
import logging
import re
import threading
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

# mask 类型
MASK_FULL = "full"
MASK_EMAIL = "email"
MASK_PHONE = "phone"
MASK_IDCARD = "idcard"
MASK_LAST4 = "last4"
MASK_HASH = "hash"
MASK_TOKEN = "token"  # 中间省略, 保留首尾

_AUDIENCE_INTERNAL = "internal"
_AUDIENCE_EXTERNAL = "external"

# JSONPath (简化: 仅支持 $.a.b.c 与 $..recursive)
_RECURSIVE_RE = re.compile(r"^\$\.\.(.+)$")
_PATH_RE = re.compile(r"^\$\.(?!\.)(.+)$")


@dataclass
class MaskRule:
    path: str
    mask: str
    audience: str = _AUDIENCE_EXTERNAL  # 默认外部脱敏
    enabled: bool = True


class ResponseMasker:
    """API 响应脱敏器."""

    def __init__(self):
        self._lock = threading.RLock()
        self._rules: list[MaskRule] = []
        self._audience = _AUDIENCE_EXTERNAL
        self._dry_run = False
        self._total_masked = 0
        self._total_calls = 0
        self._per_rule_hits: dict[str, int] = {}

    def set_audience(self, audience: str) -> None:
        with self._lock:
            self._audience = audience

    def set_dry_run(self, dry: bool) -> None:
        with self._lock:
            self._dry_run = dry

    def add_rule(self, path: str, mask: str = MASK_FULL, audience: str = _AUDIENCE_EXTERNAL) -> None:
        with self._lock:
            self._rules.append(MaskRule(path=path, mask=mask, audience=audience))

    def remove_rules(self, path: str | None = None) -> int:
        with self._lock:
            if path is None:
                n = len(self._rules)
                self._rules.clear()
                return n
            n = 0
            kept: list[MaskRule] = []
            for r in self._rules:
                if r.path == path:
                    n += 1
                else:
                    kept.append(r)
            self._rules = kept
            return n

    def list_rules(self) -> list[dict[str, Any]]:
        with self._lock:
            return [{"path": r.path, "mask": r.mask, "audience": r.audience, "enabled": r.enabled} for r in self._rules]

    def _mask_value(self, value: Any, mask: str) -> Any:
        if value is None:
            return None
        s = str(value)
        if mask == MASK_FULL:
            return "***"
        if mask == MASK_EMAIL:
            if "@" not in s:
                return "***"
            local, _, domain = s.partition("@")
            if not local:
                return f"*@{domain}"
            return f"{local[0]}**@{domain}"
        if mask == MASK_PHONE:
            digits = re.sub(r"\D", "", s)
            if len(digits) < 7:
                return "***"
            return f"{digits[:3]}****{digits[-4:]}"
        if mask == MASK_IDCARD:
            if len(s) < 8:
                return "***"
            return f"{s[:4]}**********{s[-4:]}"
        if mask == MASK_LAST4:
            if len(s) <= 4:
                return "***"
            return "*" * (len(s) - 4) + s[-4:]
        if mask == MASK_HASH:
            h = hashlib.sha256(s.encode("utf-8")).hexdigest()[:16]
            return f"sha256:{h}"
        if mask == MASK_TOKEN:
            if len(s) <= 8:
                return "***"
            return f"{s[:4]}***{s[-4:]}"
        return "***"

    def _apply_path(self, data: Any, segments: list[str], rule: MaskRule) -> tuple[Any, int]:
        """按 segments 路径深入 data 并脱敏. 返回 (新 data, 命中次数)."""
        if not segments:
            # 已抵达目标
            if self._dry_run:
                return data, 1
            return self._mask_value(data, rule.mask), 1
        head = segments[0]
        rest = segments[1:]
        if isinstance(data, dict):
            if head not in data:
                return data, 0
            new_v, n = self._apply_path(data[head], rest, rule)
            if n:
                # 浅拷贝
                if not self._dry_run:
                    new_data = dict(data)
                    new_data[head] = new_v
                    return new_data, n
            return data, n
        if isinstance(data, list):
            new_data = data
            total = 0
            for i, item in enumerate(data):
                if isinstance(item, dict) and head in item:
                    nv, n = self._apply_path(item[head], rest, rule)
                    total += n
                    if n and not self._dry_run:
                        if new_data is data:
                            new_data = list(data)
                        nd = dict(item)
                        nd[head] = nv
                        new_data[i] = nd
            return new_data, total
        return data, 0

    def _apply_recursive(self, data: Any, key: str, rule: MaskRule) -> tuple[Any, int]:
        """递归扫描所有 key 匹配的字段."""
        total = 0
        if isinstance(data, dict):
            new_data = {}
            for k, v in data.items():
                if k == key:
                    new_data[k] = self._mask_value(v, rule.mask) if not self._dry_run else v
                    total += 1
                else:
                    nv, n = self._apply_recursive(v, key, rule)
                    new_data[k] = nv
                    total += n
            return new_data, total
        if isinstance(data, list):
            return [self._apply_recursive(v, key, rule)[0] for v in data], total
        return data, 0

    def mask(self, data: Any) -> Any:
        """对 data 应用所有匹配 audience 的规则."""
        with self._lock:
            self._total_calls += 1
            cur = data
            for r in self._rules:
                if not r.enabled:
                    continue
                if r.audience != self._audience:
                    continue
                m = _PATH_RE.match(r.path)
                rec = _RECURSIVE_RE.match(r.path)
                if m:
                    segs = [s for s in m.group(1).split(".") if s]
                    new_v, n = self._apply_path(cur, segs, r)
                    if n:
                        cur = new_v
                        self._total_masked += n
                        self._per_rule_hits[r.path] = self._per_rule_hits.get(r.path, 0) + n
                elif rec:
                    key = rec.group(1)
                    cur, n = self._apply_recursive(cur, key, r)
                    if n:
                        self._total_masked += n
                        self._per_rule_hits[r.path] = self._per_rule_hits.get(r.path, 0) + n
        return cur

    def stats(self) -> dict:
        with self._lock:
            return {
                "audience": self._audience,
                "dry_run": self._dry_run,
                "rule_count": len(self._rules),
                "total_masked": self._total_masked,
                "total_calls": self._total_calls,
                "per_rule_hits": dict(self._per_rule_hits),
            }


# 全局单例
response_masker = ResponseMasker()
