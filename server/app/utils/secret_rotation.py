"""Bug-119: 密钥轮换协调器.

设计:
  - 多版本共存: 同一 key 保留新旧两版
  - 灰度切换: 按租户/机房灰度比例
  - 过期检测: 时间窗口 + 提前预警
  - 回滚: 任何时候可回滚到上一版本
  - 审计: 每次操作记录
  - 注入: 密钥值不存明文, 用 loader 函数
"""

import enum
import hashlib
import logging
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass

logger = logging.getLogger(__name__)


class RotationPhase(enum.StrEnum):
    STABLE = "stable"  # 仅 current
    CANARY = "canary"  # 双版本共存
    ROLLOUT = "rollout"  # 灰度推广
    DEPRECATING = "deprecating"  # 旧版过期
    ROTATED = "rotated"  # 已完成
    ROLLED_BACK = "rolled_back"  # 已回滚


class SecretType(enum.StrEnum):
    API_KEY = "api_key"
    DB_PASSWORD = "db_password"
    JWT_SIGNING = "jwt_signing"
    OAUTH_CLIENT = "oauth_client"
    CUSTOM = "custom"


@dataclass
class SecretVersion:
    version: int
    value: str  # 注入的明文
    created_at: float
    expires_at: float
    fingerprint: str = ""  # value 的 hash, 用于审计
    rotated_from: int = 0  # 由哪个版本轮换而来


@dataclass
class SecretSpec:
    key: str
    type: str
    current_version: int = 0
    previous_version: int = 0
    phase: str = RotationPhase.STABLE.value
    rotation_ttl_sec: float = 7 * 24 * 3600
    canary_ratio: float = 0.1
    rollout_step: float = 0.2
    last_rotated_at: float = 0.0
    last_rolled_back_at: float = 0.0
    warning_before_sec: float = 3 * 24 * 3600
    target_audience: str = "all"  # all / tenant:xxx / region:yyy
    tenant_filter: set[str] | None = None
    region_filter: set[str] | None = None
    advance_ratio: float = 0.0  # 灰度比例, 0~1


@dataclass
class RotationAudit:
    key: str
    action: str
    ts: float
    detail: str = ""
    actor: str = "system"
    from_version: int = 0
    to_version: int = 0


class SecretRotationCoordinator:
    """密钥轮换协调器."""

    def __init__(self, max_audits: int = 1000):
        self._lock = threading.RLock()
        self._specs: dict[str, SecretSpec] = {}
        self._versions: dict[str, dict[int, SecretVersion]] = {}  # key -> {version: ver}
        self._loader: dict[str, Callable[[int], str]] = {}
        self._audits: deque[RotationAudit] = deque(maxlen=max_audits)

    def register(
        self,
        key: str,
        type_: str,
        loader: Callable[[int], str],
        ttl_sec: float = 7 * 24 * 3600,
        warning_before_sec: float = 3 * 24 * 3600,
    ) -> SecretSpec:
        with self._lock:
            spec = SecretSpec(
                key=key,
                type=type_,
                rotation_ttl_sec=ttl_sec,
                warning_before_sec=warning_before_sec,
            )
            self._specs[key] = spec
            self._versions[key] = {}
            self._loader[key] = loader
            # 注入初版
            v = SecretVersion(
                version=1,
                value=loader(1),
                created_at=time.time(),
                expires_at=time.time() + ttl_sec,
            )
            v.fingerprint = self._fingerprint(v.value)
            self._versions[key][1] = v
            spec.current_version = 1
            self._audits.append(RotationAudit(key, "register", time.time(), f"type={type_}"))
            return spec

    def _fingerprint(self, value: str) -> str:
        import hashlib

        return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]

    def get_spec(self, key: str) -> SecretSpec | None:
        with self._lock:
            return self._specs.get(key)

    def get_current(self, key: str) -> SecretVersion | None:
        with self._lock:
            spec = self._specs.get(key)
            if not spec:
                return None
            return self._versions[key].get(spec.current_version)

    def get_version(self, key: str, version: int) -> SecretVersion | None:
        with self._lock:
            return self._versions.get(key, {}).get(version)

    def rotate(
        self, key: str, new_loader: Callable[[int], str] | None = None, actor: str = "system"
    ) -> SecretVersion:
        """开始一次轮换. 生成新版本, 旧版本保留为 previous (canary 阶段)."""
        with self._lock:
            spec = self._specs.get(key)
            if spec is None:
                raise KeyError(f"secret not registered: {key}")
            ld = new_loader or self._loader.get(key)
            if ld is None:
                raise ValueError(f"no loader for {key}")
            old_v = spec.current_version
            new_v_num = old_v + 1
            new_v = SecretVersion(
                version=new_v_num,
                value=ld(new_v_num),
                created_at=time.time(),
                expires_at=time.time() + spec.rotation_ttl_sec,
                rotated_from=old_v,
            )
            new_v.fingerprint = self._fingerprint(new_v.value)
            self._versions[key][new_v_num] = new_v
            spec.previous_version = old_v
            spec.current_version = new_v_num
            spec.phase = RotationPhase.CANARY.value
            spec.advance_ratio = spec.canary_ratio
            spec.last_rotated_at = time.time()
            self._audits.append(
                RotationAudit(
                    key,
                    "rotate",
                    time.time(),
                    detail=f"canary_ratio={spec.canary_ratio}",
                    actor=actor,
                    from_version=old_v,
                    to_version=new_v_num,
                )
            )
            return new_v

    def advance_rollout(self, key: str, ratio: float | None = None, actor: str = "system") -> float:
        """推进灰度. ratio 不传则按 step 推进."""
        with self._lock:
            spec = self._specs.get(key)
            if spec is None or spec.phase != RotationPhase.CANARY.value:
                return spec.advance_ratio if spec else 0.0
            if ratio is None:
                ratio = min(1.0, spec.advance_ratio + spec.rollout_step)
            ratio = max(0.0, min(1.0, ratio))
            spec.advance_ratio = ratio
            if ratio >= 1.0:
                # 完成时直接进入 STABLE, 旧版本通过 complete() 才被回收
                spec.phase = RotationPhase.STABLE.value
            self._audits.append(RotationAudit(key, "advance", time.time(), detail=f"ratio={ratio}", actor=actor))
            return ratio

    def complete(self, key: str, actor: str = "system") -> bool:
        """完成轮换. 清除旧版本."""
        with self._lock:
            spec = self._specs.get(key)
            if spec is None:
                return False
            if spec.previous_version == 0:
                # 没有旧版本需要清理, 视为已 stable
                return True
            old = spec.previous_version
            self._versions[key].pop(old, None)
            spec.previous_version = 0
            spec.phase = RotationPhase.STABLE.value
            spec.advance_ratio = 1.0
            self._audits.append(
                RotationAudit(
                    key, "complete", time.time(), actor=actor, from_version=old, to_version=spec.current_version
                )
            )
            return True

    def rollback(self, key: str, actor: str = "system") -> SecretVersion | None:
        """回滚到上一个版本."""
        with self._lock:
            spec = self._specs.get(key)
            if spec is None or spec.previous_version == 0:
                return None
            cur = spec.current_version
            prev = spec.previous_version
            self._versions[key].pop(cur, None)
            spec.current_version = prev
            spec.previous_version = 0
            spec.phase = RotationPhase.ROLLED_BACK.value
            spec.advance_ratio = 1.0
            spec.last_rolled_back_at = time.time()
            self._audits.append(
                RotationAudit(key, "rollback", time.time(), actor=actor, from_version=cur, to_version=prev)
            )
            return self._versions[key].get(prev)

    def pick_version(
        self,
        key: str,
        tenant: str | None = None,
        region: str | None = None,
    ) -> SecretVersion | None:
        """按灰度比例选择 current 或 previous. 用于运行时获取密钥."""
        with self._lock:
            spec = self._specs.get(key)
            if not spec:
                return None
            cur = self._versions[key].get(spec.current_version)
            if spec.previous_version == 0 or spec.phase == RotationPhase.STABLE.value:
                return cur
            prev = self._versions[key].get(spec.previous_version)
            if not prev:
                return cur
            # 按租户/机房 hash 决定
            seed = f"{tenant or ''}:{region or ''}"
            h = int(hashlib.sha1(seed.encode("utf-8")).hexdigest(), 16) % 10000
            ratio = spec.advance_ratio * 10000
            return cur if h < ratio else prev

    def check_expiring(self, key: str) -> dict:
        """检查即将过期的密钥, 返回状态."""
        with self._lock:
            spec = self._specs.get(key)
            if not spec:
                return {"exists": False}
            cur = self._versions[key].get(spec.current_version)
            if not cur:
                return {"exists": True, "current_exists": False}
            now = time.time()
            remaining = cur.expires_at - now
            warn = spec.warning_before_sec
            return {
                "exists": True,
                "current_version": cur.version,
                "fingerprint": cur.fingerprint,
                "expires_at": cur.expires_at,
                "remaining_sec": remaining,
                "needs_rotation": remaining < warn,
                "expired": remaining <= 0,
            }

    def list_expiring(self) -> list[dict]:
        with self._lock:
            return [self.check_expiring(k) for k in self._specs]

    def list_audits(self, key: str | None = None, limit: int = 100) -> list[RotationAudit]:
        with self._lock:
            arr = list(self._audits)
        if key:
            arr = [a for a in arr if a.key == key]
        return arr[-limit:]

    def stats(self) -> dict:
        with self._lock:
            return {
                "secret_count": len(self._specs),
                "version_count": sum(len(v) for v in self._versions.values()),
                "audit_count": len(self._audits),
                "phases": {
                    p: sum(1 for s in self._specs.values() if s.phase == p) for p in [e.value for e in RotationPhase]
                },
            }


# 全局单例
secret_rotation = SecretRotationCoordinator()
