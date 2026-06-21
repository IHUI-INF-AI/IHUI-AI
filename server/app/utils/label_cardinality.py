"""Bug-89: Prometheus exporter label 基数保护.

设计:
  - 白名单 + 黑名单 label 模式
  - 高基数 label (tenant_id, user_id, request_id) 自动收敛到桶
  - 数值超阈值时降级: 替换为 "<bucket-N>" 形式
  - 提供 wrap_metric(name, labels) -> sanitized_labels
  - 记录被降级的 label 名 + 次数
  - thread-safe

使用:
    from app.utils.label_cardinality import label_guard

    label_guard.allow("tenant_id", pattern=r"^t_[a-z0-9]{1,16}$")
    safe = label_guard.wrap("http_requests", {"tenant_id": "t_12345", "path": "/api/v1/chat"})
    # 若 tenant_id 不在白名单, 会被替换为 "tenant_id=other"
"""

import logging
import re
import threading
from collections import defaultdict

logger = logging.getLogger(__name__)

DEFAULT_MAX_LABEL_VALUES = 200
DEFAULT_BUCKET_PREFIX = "other"


class LabelCardinalityGuard:
    """Prometheus label 基数保护器."""

    def __init__(self, max_label_values: int = DEFAULT_MAX_LABEL_VALUES):
        self._lock = threading.Lock()
        self._max = max_label_values
        # label_name -> {value_set, regex_pattern}
        self._allow: dict[str, set[str]] = {}
        self._allow_re: dict[str, re.Pattern] = {}
        self._deny: dict[str, set[str]] = {}
        self._deny_re: dict[str, re.Pattern] = {}
        self._seen: dict[str, set[str]] = defaultdict(set)
        self._replaced: dict[tuple[str, str], int] = defaultdict(int)
        self._total_calls = 0

    def allow(self, name: str, pattern: str | None = None, values: list[str] | None = None) -> None:
        """白名单: 显式 value 列表 或 regex pattern."""
        with self._lock:
            if values:
                self._allow[name] = set(values)
            if pattern:
                self._allow_re[name] = re.compile(pattern)

    def deny(self, name: str, pattern: str | None = None, values: list[str] | None = None) -> None:
        """黑名单: 显式 value 列表 或 regex pattern."""
        with self._lock:
            if values:
                self._deny[name] = set(values)
            if pattern:
                self._deny_re[name] = re.compile(pattern)

    def reset_seen(self) -> None:
        with self._lock:
            self._seen.clear()
            self._replaced.clear()

    def _match(self, name: str, value: str) -> bool:
        """True 表示 value 通过校验 (应保留). False 表示应被收敛."""
        # 黑名单优先
        deny_set = self._deny.get(name)
        if deny_set and value in deny_set:
            return False
        deny_re = self._deny_re.get(name)
        if deny_re and deny_re.search(value):
            return False
        # 白名单
        allow_set = self._allow.get(name)
        if allow_set and value in allow_set:
            return True
        allow_re = self._allow_re.get(name)
        if allow_re and allow_re.search(value):
            return True
        # 都没设: 默认放行
        return bool(name not in self._allow and name not in self._allow_re and name not in self._deny and name not in self._deny_re)

    def wrap(self, metric_name: str, labels: dict[str, str]) -> dict[str, str]:
        """检查并收敛 labels. 总是返回新 dict."""
        with self._lock:
            self._total_calls += 1
            out: dict[str, str] = {}
            for k, v in labels.items():
                vs = str(v)
                ok = self._match(k, vs)
                if not ok:
                    # 收敛
                    out[k] = DEFAULT_BUCKET_PREFIX
                    self._replaced[(k, vs)] += 1
                    continue
                # 基数检查
                seen = self._seen[k]
                if vs not in seen:
                    if len(seen) >= self._max:
                        out[k] = f"{DEFAULT_BUCKET_PREFIX}_overflow"
                        self._replaced[(k, vs)] += 1
                        continue
                    seen.add(vs)
                out[k] = vs
            return out

    def stats(self) -> dict:
        with self._lock:
            seen_count = {k: len(v) for k, v in self._seen.items()}
            replaced_count = {f"{k}|{v[:20]}": c for (k, v), c in self._replaced.items()}
            return {
                "max_label_values": self._max,
                "allow_count": len(self._allow) + len(self._allow_re),
                "deny_count": len(self._deny) + len(self._deny_re),
                "tracked_labels": len(self._seen),
                "tracked_label_values": seen_count,
                "total_replaced": sum(self._replaced.values()),
                "top_replaced": dict(sorted(replaced_count.items(), key=lambda x: -x[1])[:10]),
                "total_calls": self._total_calls,
            }


# 全局单例
label_guard = LabelCardinalityGuard()
