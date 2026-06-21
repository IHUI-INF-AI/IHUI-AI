"""Phase 19 建议 2: 配置中心灰度 - 租户级灰度 + 实时回滚.

目的:
  - 中心化配置存储
  - 版本管理 (每次发布产生新版本)
  - 灰度策略: 全量 / 百分比 / 租户白名单 / 环境白名单
  - 实时回滚
  - 审计日志

设计:
  ConfigItem:
    key, schema, current_version

  ConfigVersion:
    version, value, ts, author, description

  RolloutStrategy:
    type (full/percentage/tenant_allowlist/env_allowlist)
    percentage, allowlist

  RolloutRecord:
    key, from_version, to_version, strategy, status, ts

  ConfigCenter:
    publish(key, value, author, desc) -> version
    get(key, tenant=None, env=None) -> value
    rollout(key, version, strategy)
    rollback(key)
    audit_log / report
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

# ---------------------------------------------------------------------------
# 1. 枚举 / 数据类
# ---------------------------------------------------------------------------


class RolloutType(str, Enum):
    FULL = "full"
    PERCENTAGE = "percentage"
    TENANT_ALLOWLIST = "tenant_allowlist"
    ENV_ALLOWLIST = "env_allowlist"


class RolloutStatus(str, Enum):
    PENDING = "pending"
    ROLLOUT = "rollout"
    PROMOTED = "promoted"
    ROLLED_BACK = "rolled_back"


@dataclass
class ConfigVersion:
    version: int
    value: Any
    ts: float = field(default_factory=time.time)
    author: str = "system"
    description: str = ""

    def to_dict(self) -> dict:
        return {
            "version": self.version,
            "value": self.value,
            "ts": self.ts,
            "ts_iso": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(self.ts)),
            "author": self.author,
            "description": self.description,
        }


@dataclass
class ConfigItem:
    key: str
    schema: str = "string"  # string / int / bool / json
    versions: list[ConfigVersion] = field(default_factory=list)
    current_version: int = 0
    rollout: RolloutRecord | None = None


@dataclass
class RolloutStrategy:
    type: RolloutType = RolloutType.FULL
    percentage: int = 100
    allowlist: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "type": self.type.value,
            "percentage": self.percentage,
            "allowlist": list(self.allowlist),
        }


@dataclass
class RolloutRecord:
    key: str
    from_version: int
    to_version: int
    strategy: RolloutStrategy
    status: RolloutStatus = RolloutStatus.PENDING
    created_ts: float = field(default_factory=time.time)
    updated_ts: float = field(default_factory=time.time)
    promoted_ts: float | None = None
    rolled_back_ts: float | None = None

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "from_version": self.from_version,
            "to_version": self.to_version,
            "strategy": self.strategy.to_dict(),
            "status": self.status.value,
            "created_ts": self.created_ts,
            "updated_ts": self.updated_ts,
            "promoted_ts": self.promoted_ts,
            "rolled_back_ts": self.rolled_back_ts,
        }


@dataclass
class AuditEntry:
    ts: float
    action: str
    key: str
    details: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "ts": self.ts,
            "ts_iso": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(self.ts)),
            "action": self.action,
            "key": self.key,
            **self.details,
        }


# ---------------------------------------------------------------------------
# 2. ConfigCenter
# ---------------------------------------------------------------------------


class ConfigCenter:
    """配置中心 + 灰度发布."""

    def __init__(self):
        self._items: dict[str, ConfigItem] = {}
        self._audit: list[AuditEntry] = []
        # 上下文 (请求时传入)
        # self._ctx_tenant: str | None = None
        # self._ctx_env: str | None = None

    # ---- 配置项 ----
    def register(
        self, key: str, schema: str = "string", initial_value: Any = None, author: str = "system", description: str = ""
    ) -> ConfigItem:
        if key in self._items:
            return self._items[key]
        item = ConfigItem(key=key, schema=schema)
        if initial_value is not None:
            v = ConfigVersion(version=1, value=initial_value, author=author, description=description)
            item.versions.append(v)
            item.current_version = 1
        self._items[key] = item
        self._audit.append(AuditEntry(ts=time.time(), action="register", key=key, details={"schema": schema}))
        return item

    def get_item(self, key: str) -> ConfigItem | None:
        return self._items.get(key)

    def list_keys(self) -> list[str]:
        return list(self._items.keys())

    # ---- 版本发布 ----
    def publish(self, key: str, value: Any, author: str = "system", description: str = "") -> int:
        """发布新版本 (不自动切换 current_version, 由 rollout 决定)."""
        item = self._items.get(key)
        if item is None:
            raise KeyError(f"config key {key} not registered")
        new_ver = (item.versions[-1].version + 1) if item.versions else 1
        v = ConfigVersion(version=new_ver, value=value, author=author, description=description)
        item.versions.append(v)
        self._audit.append(
            AuditEntry(
                ts=time.time(),
                action="publish",
                key=key,
                details={"version": new_ver, "value": value, "author": author},
            )
        )
        return new_ver

    # ---- 灰度发布 ----
    def rollout(self, key: str, to_version: int, strategy: RolloutStrategy | None = None) -> RolloutRecord:
        item = self._items.get(key)
        if item is None:
            raise KeyError(f"config key {key} not registered")
        if not any(v.version == to_version for v in item.versions):
            raise ValueError(f"version {to_version} not found")
        strat = strategy or RolloutStrategy()
        rec = RolloutRecord(
            key=key,
            from_version=item.current_version,
            to_version=to_version,
            strategy=strat,
            status=RolloutStatus.ROLLOUT,
        )
        item.rollout = rec
        if strat.type == RolloutType.FULL:
            item.current_version = to_version
            rec.status = RolloutStatus.PROMOTED
            rec.promoted_ts = time.time()
        self._audit.append(
            AuditEntry(
                ts=time.time(),
                action="rollout",
                key=key,
                details={"to_version": to_version, "strategy": strat.to_dict()},
            )
        )
        return rec

    def promote(self, key: str) -> RolloutRecord:
        """灰度完成, 全量切到新版本."""
        item = self._items.get(key)
        if item is None or item.rollout is None:
            raise ValueError(f"no rollout for {key}")
        rec = item.rollout
        item.current_version = rec.to_version
        rec.status = RolloutStatus.PROMOTED
        rec.promoted_ts = time.time()
        rec.updated_ts = time.time()
        self._audit.append(
            AuditEntry(ts=time.time(), action="promote", key=key, details={"to_version": rec.to_version})
        )
        return rec

    def rollback(self, key: str) -> RolloutRecord:
        item = self._items.get(key)
        if item is None or item.rollout is None:
            raise ValueError(f"no rollout for {key}")
        rec = item.rollout
        item.current_version = rec.from_version
        rec.status = RolloutStatus.ROLLED_BACK
        rec.rolled_back_ts = time.time()
        rec.updated_ts = time.time()
        self._audit.append(
            AuditEntry(ts=time.time(), action="rollback", key=key, details={"to_version": rec.from_version})
        )
        return rec

    def is_in_rollout(self, key: str, tenant: str | None = None, env: str | None = None) -> bool:
        """判断给定上下文是否使用 canary 版本."""
        item = self._items.get(key)
        if item is None or item.rollout is None:
            return False
        rec = item.rollout
        if rec.status != RolloutStatus.ROLLOUT:
            return False
        s = rec.strategy
        if s.type == RolloutType.FULL:
            return True
        if s.type == RolloutType.PERCENTAGE:
            if s.percentage <= 0:
                return False
            if s.percentage >= 100:
                return True
            seed = f"{key}:{tenant or env or 'default'}"
            return (hash(seed) % 100) < s.percentage
        if s.type == RolloutType.TENANT_ALLOWLIST:
            return tenant in s.allowlist if tenant else False
        if s.type == RolloutType.ENV_ALLOWLIST:
            return env in s.allowlist if env else False
        return False

    def get(self, key: str, tenant: str | None = None, env: str | None = None) -> Any:
        item = self._items.get(key)
        if item is None:
            return None
        # 灰度中, 命中白名单才用新版本
        if self.is_in_rollout(key, tenant, env):
            target = item.rollout.to_version
        else:
            target = item.current_version
        ver = next((v for v in item.versions if v.version == target), None)
        return ver.value if ver else None

    # ---- 审计 ----
    def audit_log(self, limit: int = 100) -> list[dict]:
        return [a.to_dict() for a in self._audit[-limit:]]

    def snapshot(self) -> dict:
        return {
            key: {
                "schema": item.schema,
                "current_version": item.current_version,
                "versions_count": len(item.versions),
                "rollout": item.rollout.to_dict() if item.rollout else None,
            }
            for key, item in self._items.items()
        }

    def report(self) -> str:
        snap = self.snapshot()
        lines = ["# 配置中心灰度报表", ""]
        lines.append(f"- 配置项总数: **{len(snap)}**")
        in_rollout = sum(1 for v in snap.values() if v["rollout"] and v["rollout"]["status"] == "rollout")
        lines.append(f"- 灰度中: **{in_rollout}**")
        lines.append("")
        if snap:
            lines.append("## 配置项")
            lines.append("")
            lines.append("| Key | Schema | 当前版本 | 版本数 | 灰度状态 |")
            lines.append("| --- | --- | --- | --- | --- |")
            for k, v in snap.items():
                rs = v["rollout"]["status"] if v["rollout"] else "-"
                lines.append(f"| {k} | {v['schema']} | v{v['current_version']} | {v['versions_count']} | {rs} |")
        lines.append("")
        if self._audit:
            lines.append("## 最近审计")
            lines.append("")
            lines.append("| 时间 | 动作 | Key | 详情 |")
            lines.append("| --- | --- | --- | --- |")
            for a in self._audit[-20:]:
                details = {k: v for k, v in a.to_dict().items() if k not in ("ts", "ts_iso", "action", "key")}
                lines.append(f"| {a.to_dict()['ts_iso']} | {a.action} | {a.key} | {details} |")
        return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# 3. CLI
# ---------------------------------------------------------------------------


def _demo() -> dict:
    cc = ConfigCenter()
    cc.register("feature.x_enabled", "bool", initial_value=False, description="X 功能开关")
    cc.register("rate_limit.api", "int", initial_value=100, description="API 限流 QPS")
    # 发布新版本
    v2 = cc.publish("feature.x_enabled", True, author="alice", description="启用 X")
    v2_rate = cc.publish("rate_limit.api", 200, author="bob", description="提升限流")
    # 灰度发布 rate_limit.api
    cc.rollout(
        "rate_limit.api", v2_rate, RolloutStrategy(type=RolloutType.TENANT_ALLOWLIST, allowlist=["acme", "beta"])
    )
    out = {
        "snapshot": cc.snapshot(),
        "tenant_acme_rate": cc.get("rate_limit.api", tenant="acme"),
        "tenant_other_rate": cc.get("rate_limit.api", tenant="other"),
        "feature_default": cc.get("feature.x_enabled"),
        "audit_log_count": len(cc.audit_log()),
    }
    return out


def main(argv: list[str] | None = None, cc: ConfigCenter | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="配置中心灰度")
    sub = p.add_subparsers(dest="cmd", required=True)

    p_demo = sub.add_parser("demo")
    p_register = sub.add_parser("register")
    p_register.add_argument("--key", required=True)
    p_register.add_argument("--schema", default="string")
    p_register.add_argument("--value")
    p_publish = sub.add_parser("publish")
    p_publish.add_argument("--key", required=True)
    p_publish.add_argument("--value", required=True)
    p_publish.add_argument("--author", default="system")
    p_get = sub.add_parser("get")
    p_get.add_argument("--key", required=True)
    p_get.add_argument("--tenant")
    p_get.add_argument("--env")
    p_rollout = sub.add_parser("rollout")
    p_rollout.add_argument("--key", required=True)
    p_rollout.add_argument("--version", type=int, required=True)
    p_rollout.add_argument("--strategy", default="full", choices=["full", "percentage", "tenant", "env"])
    p_rollout.add_argument("--percentage", type=int, default=100)
    p_rollout.add_argument("--allowlist", default="")
    p_promote = sub.add_parser("promote")
    p_promote.add_argument("--key", required=True)
    p_rollback = sub.add_parser("rollback")
    p_rollback.add_argument("--key", required=True)
    p_report = sub.add_parser("report")

    args = p.parse_args(argv)
    center = cc or ConfigCenter()
    if args.cmd == "demo":
        out = _demo()
        print(json.dumps(out, ensure_ascii=False, indent=2, default=str))
        return 0
    if args.cmd == "register":
        value = json.loads(args.value) if args.value and args.schema == "json" else args.value
        center.register(args.key, args.schema, initial_value=value)
        print(json.dumps({"registered": args.key}, ensure_ascii=False))
        return 0
    if args.cmd == "publish":
        v = center.publish(args.key, args.value, args.author)
        print(json.dumps({"key": args.key, "version": v}, ensure_ascii=False))
        return 0
    if args.cmd == "get":
        v = center.get(args.key, tenant=args.tenant, env=args.env)
        print(json.dumps({"key": args.key, "value": v, "tenant": args.tenant, "env": args.env}, ensure_ascii=False))
        return 0
    if args.cmd == "rollout":
        st_map = {
            "full": RolloutType.FULL,
            "percentage": RolloutType.PERCENTAGE,
            "tenant": RolloutType.TENANT_ALLOWLIST,
            "env": RolloutType.ENV_ALLOWLIST,
        }
        allowlist = [x for x in args.allowlist.split(",") if x]
        strat = RolloutStrategy(type=st_map[args.strategy], percentage=args.percentage, allowlist=allowlist)
        rec = center.rollout(args.key, args.version, strat)
        print(json.dumps(rec.to_dict(), ensure_ascii=False, indent=2))
        return 0
    if args.cmd == "promote":
        rec = center.promote(args.key)
        print(json.dumps(rec.to_dict(), ensure_ascii=False, indent=2))
        return 0
    if args.cmd == "rollback":
        rec = center.rollback(args.key)
        print(json.dumps(rec.to_dict(), ensure_ascii=False, indent=2))
        return 0
    if args.cmd == "report":
        print(center.report())
        return 0
    return 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
