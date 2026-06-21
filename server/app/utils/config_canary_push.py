"""Bug-122: 配置灰度推送.

设计:
  - 多机房同步: 按 region 标记已推送
  - SHA 校验: 内容指纹
  - 客户端版本兼容: 最低版本要求
  - 灰度: 按租户 / 机房 / 比例
  - 审计: 每次推送记录
  - 回滚: 任何时候可回滚到上一版
"""

import enum
import hashlib
import json
import logging
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


class PushPhase(enum.StrEnum):
    DRAFT = "draft"
    CANARY = "canary"
    ROLLOUT = "rollout"
    STABLE = "stable"
    ROLLED_BACK = "rolled_back"


@dataclass
class ConfigVersion:
    version: int
    content: dict[str, Any]
    sha: str
    created_at: float
    min_client_version: str = "0.0.0"
    description: str = ""


@dataclass
class PushTask:
    id: str
    namespace: str
    version: int
    phase: str
    regions: list[str]
    canary_ratio: float
    advance_ratio: float
    tenant_filter: set[str] | None
    region_filter: set[str] | None
    created_at: float
    updated_at: float
    last_pushed_at: float
    last_verified_at: float
    audit: list[dict[str, Any]] = field(default_factory=list)
    status: str = "pending"
    failure_count: int = 0


class ConfigCanaryPush:
    """配置灰度推送控制器."""

    def __init__(self, max_audits: int = 1000):
        self._lock = threading.RLock()
        self._versions: dict[str, list[ConfigVersion]] = {}  # namespace -> [versions]
        self._current: dict[str, ConfigVersion] = {}  # namespace -> current
        self._previous: dict[str, ConfigVersion] = {}
        self._pushes: dict[str, PushTask] = {}  # id -> task
        self._audit: deque[dict[str, Any]] = deque(maxlen=max_audits)
        # 推送回调: push_fn(namespace, version, region, content) -> bool
        self._push_fn: Callable[[str, int, str, dict], bool] | None = None
        self._verify_fn: Callable[[str, int, str], bool] | None = None

    def register_push(self, fn: Callable[[str, int, str, dict], bool]) -> None:
        with self._lock:
            self._push_fn = fn

    def register_verify(self, fn: Callable[[str, int, str], bool]) -> None:
        with self._lock:
            self._verify_fn = fn

    def publish(
        self, namespace: str, content: dict[str, Any], description: str = "", min_client_version: str = "0.0.0"
    ) -> ConfigVersion:
        with self._lock:
            sha = self._hash_content(content)
            arr = self._versions.setdefault(namespace, [])
            v = len(arr) + 1
            cv = ConfigVersion(
                version=v,
                content=content,
                sha=sha,
                created_at=time.time(),
                min_client_version=min_client_version,
                description=description,
            )
            arr.append(cv)
            # publish 后自动将 v1 设为 current; v1 之后需要 advance 才能 current
            if v == 1:
                self._current[namespace] = cv
            self._audit.append({"event": "publish", "ns": namespace, "ver": v, "sha": sha, "ts": time.time()})
            return cv

    def _hash_content(self, content: dict) -> str:
        body = json.dumps(content, sort_keys=True, ensure_ascii=False, default=str)
        return hashlib.sha256(body.encode("utf-8")).hexdigest()[:16]

    def start_canary(
        self,
        namespace: str,
        version: int,
        regions: list[str],
        canary_ratio: float = 0.1,
        tenant_filter: list[str] | None = None,
        region_filter: list[str] | None = None,
    ) -> PushTask:
        with self._lock:
            t = PushTask(
                id=f"pt-{int(time.time()*1000000)}",
                namespace=namespace,
                version=version,
                phase=PushPhase.CANARY.value,
                regions=regions,
                canary_ratio=canary_ratio,
                advance_ratio=canary_ratio,
                tenant_filter=set(tenant_filter) if tenant_filter else None,
                region_filter=set(region_filter) if region_filter else None,
                created_at=time.time(),
                updated_at=time.time(),
                last_pushed_at=0.0,
                last_verified_at=0.0,
            )
            self._pushes[t.id] = t
            self._audit.append(
                {"event": "start_canary", "ns": namespace, "ver": version, "id": t.id, "ts": time.time()}
            )
            return t

    def advance(self, task_id: str, ratio: float | None = None) -> float:
        with self._lock:
            t = self._pushes.get(task_id)
            if not t:
                return 0.0
            if ratio is None:
                ratio = min(1.0, t.advance_ratio + 0.2)
            ratio = max(0.0, min(1.0, ratio))
            t.advance_ratio = ratio
            if ratio >= 1.0:
                t.phase = PushPhase.STABLE.value
                # 切换为 current
                arr = self._versions.get(t.namespace, [])
                cv = next((v for v in arr if v.version == t.version), None)
                if cv is not None:
                    self._previous[t.namespace] = self._current.get(t.namespace)
                    self._current[t.namespace] = cv
            t.updated_at = time.time()
            self._audit.append({"event": "advance", "id": task_id, "ratio": ratio, "ts": time.time()})
            return ratio

    def push_to_region(self, task_id: str, region: str) -> bool:
        with self._lock:
            t = self._pushes.get(task_id)
            if not t:
                return False
            arr = self._versions.get(t.namespace, [])
            cv = next((v for v in arr if v.version == t.version), None)
            if cv is None:
                return False
            fn = self._push_fn
        if fn is None:
            return True
        try:
            ok = fn(t.namespace, t.version, region, cv.content)
            with self._lock:
                t.last_pushed_at = time.time()
                if not ok:
                    t.failure_count += 1
                    t.audit.append({"event": "push_fail", "region": region, "ts": time.time()})
                else:
                    t.audit.append({"event": "push_ok", "region": region, "ts": time.time()})
            return ok
        except Exception as e:
            with self._lock:
                t.failure_count += 1
                t.audit.append({"event": "push_error", "region": region, "ts": time.time(), "error": str(e)})
            return False

    def verify_region(self, task_id: str, region: str) -> bool:
        with self._lock:
            t = self._pushes.get(task_id)
            if not t:
                return False
            fn = self._verify_fn
        if fn is None:
            return True
        try:
            ok = fn(t.namespace, t.version, region)
            with self._lock:
                t.last_verified_at = time.time()
                t.audit.append({"event": "verify", "region": region, "ok": ok, "ts": time.time()})
            return ok
        except Exception:
            return False

    def push_all(self, task_id: str) -> dict:
        with self._lock:
            t = self._pushes.get(task_id)
            if not t:
                return {"ok": 0, "fail": 0}
            regions = list(t.regions)
        ok = 0
        fail = 0
        for r in regions:
            if self.push_to_region(task_id, r):
                ok += 1
            else:
                fail += 1
        return {"ok": ok, "fail": fail}

    def rollback(self, namespace: str) -> ConfigVersion | None:
        with self._lock:
            prev = self._previous.get(namespace)
            if prev is None:
                return None
            self._current[namespace] = prev
            self._previous.pop(namespace, None)
            # 找所有 canary/rollout 任务标记为 rolled_back
            for t in self._pushes.values():
                if t.namespace == namespace and t.phase in (PushPhase.CANARY.value, PushPhase.ROLLOUT.value):
                    t.phase = PushPhase.ROLLED_BACK.value
                    t.audit.append({"event": "rollback", "ts": time.time()})
            self._audit.append({"event": "rollback", "ns": namespace, "to": prev.version, "ts": time.time()})
            return prev

    def should_apply(
        self,
        namespace: str,
        tenant: str | None = None,
        region: str | None = None,
        client_version: str = "0.0.0",
    ) -> bool:
        """客户端请求时调用, 决定是否应用新版本."""
        with self._lock:
            cv = self._current.get(namespace)
            prev = self._previous.get(namespace)
        if cv is None:
            return False
        # 版本兼容
        if not self._version_ge(client_version, cv.min_client_version):
            return False
        # 找 canary 任务
        with self._lock:
            for t in self._pushes.values():
                if t.namespace != namespace:
                    continue
                if t.phase in (PushPhase.ROLLED_BACK.value, PushPhase.STABLE.value):
                    continue
                if t.region_filter and region and region not in t.region_filter:
                    return cv is not None
                if t.tenant_filter and tenant and tenant not in t.tenant_filter:
                    return cv is not None
                # 按 ratio
                seed = f"{tenant or ''}:{region or ''}"
                h = int(hashlib.sha1(seed.encode("utf-8")).hexdigest(), 16) % 10000
                if h < t.advance_ratio * 10000:
                    return True
                return prev is not None
        return True

    def _version_ge(self, a: str, b: str) -> bool:
        def parse(v: str) -> list[int]:
            try:
                return [int(x) for x in v.split(".")]
            except ValueError:
                return [0]

        pa = parse(a)
        pb = parse(b)
        n = max(len(pa), len(pb))
        pa += [0] * (n - len(pa))
        pb += [0] * (n - len(pb))
        return pa >= pb

    def get(self, namespace: str) -> ConfigVersion | None:
        with self._lock:
            return self._current.get(namespace)

    def get_version(self, namespace: str, version: int) -> ConfigVersion | None:
        with self._lock:
            for v in self._versions.get(namespace, []):
                if v.version == version:
                    return v
        return None

    def list_versions(self, namespace: str) -> list[ConfigVersion]:
        with self._lock:
            return list(self._versions.get(namespace, []))

    def list_pushes(self, namespace: str | None = None) -> list[PushTask]:
        with self._lock:
            arr = list(self._pushes.values())
        if namespace:
            arr = [t for t in arr if t.namespace == namespace]
        arr.sort(key=lambda t: t.created_at, reverse=True)
        return arr

    def get_push(self, task_id: str) -> PushTask | None:
        with self._lock:
            return self._pushes.get(task_id)

    def stats(self) -> dict:
        with self._lock:
            return {
                "namespace_count": len(self._versions),
                "version_count": sum(len(v) for v in self._versions.values()),
                "push_count": len(self._pushes),
                "audit_count": len(self._audit),
                "phases": {
                    p: sum(1 for t in self._pushes.values() if t.phase == p) for p in [e.value for e in PushPhase]
                },
            }


# 全局单例
config_canary = ConfigCanaryPush()
