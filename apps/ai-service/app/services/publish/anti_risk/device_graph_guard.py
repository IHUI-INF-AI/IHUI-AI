"""设备关联图谱防护 — 检测跨账号共享设备/IP/指纹/UA 的关联风险。

诚实边界:"零风险"技术上不可达,本模块目标是工业级低风险。平台通过设备指纹、
IP 地址、UA 字符串、Canvas 哈希等维度关联多个账号,一旦判定"同一设备操作多账号"
即触发集体封号。本模块维护账号-设备-IP-指纹四维图谱,在批量发布前检测关联。

4 种关联检测:
1. 同指纹哈希 — 多账号共享浏览器指纹(高危)
2. 同代理 IP  — 多账号共享出口 IP(高危)
3. 同 UA 哈希 — 多账号共享 User-Agent(中危)
4. 同 Canvas 哈希 — 多账号 Canvas 指纹相同(高危)

设计:
- 单例模式(get_device_graph_guard)
- asyncio.Lock 保证并发安全(适配器 async 调用)
- 数据持久化到 .trae-cn/tmp/device_graph.json(AGENTS.md §15 项目内路径)
- 同账号重复绑定只更新时间戳,不新增记录
"""
from __future__ import annotations

import asyncio
import json
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)


# 持久化路径(AGENTS.md §15:临时文件放 .trae-cn/tmp/)
_GRAPH_FILE = Path(os.environ.get(
    "ANTI_RISK_DEVICE_GRAPH_FILE",
    ".trae-cn/tmp/device_graph.json",
)).resolve()


@dataclass
class AccountBinding:
    """账号绑定记录(账号→设备指纹/IP/UA 的映射)。"""

    account_id: str
    fingerprint_hash: str
    proxy_ip: str
    ua_hash: str
    canvas_hash: str
    bound_at: float  # 首次绑定时间戳
    updated_at: float  # 最近更新时间戳

    def to_dict(self) -> dict[str, Any]:
        return {
            "account_id": self.account_id,
            "fingerprint_hash": self.fingerprint_hash,
            "proxy_ip": self.proxy_ip,
            "ua_hash": self.ua_hash,
            "canvas_hash": self.canvas_hash,
            "bound_at": self.bound_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AccountBinding":
        return cls(
            account_id=str(data["account_id"]),
            fingerprint_hash=str(data["fingerprint_hash"]),
            proxy_ip=str(data["proxy_ip"]),
            ua_hash=str(data["ua_hash"]),
            canvas_hash=str(data.get("canvas_hash", "")),
            bound_at=float(data["bound_at"]),
            updated_at=float(data["updated_at"]),
        )


@dataclass
class LinkageReport:
    """账号关联检测报告。

    Attributes:
        account_id: 被检测的账号 ID
        is_linked: 是否与其他账号存在关联(True=高危)
        linked_accounts: 关联账号列表(含关联维度)
        risk_score: 风险评分 0-100(100=最高风险)
        linkage_types: 命中的关联类型列表
    """

    account_id: str
    is_linked: bool
    linked_accounts: list[dict[str, str]] = field(default_factory=list)
    risk_score: int = 0
    linkage_types: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "account_id": self.account_id,
            "is_linked": self.is_linked,
            "linked_accounts": list(self.linked_accounts),
            "risk_score": self.risk_score,
            "linkage_types": list(self.linkage_types),
        }


class DeviceGraphGuard:
    """设备关联图谱守护器(单例)。

    维护账号-设备-IP-指纹四维图谱,检测跨账号关联。
    线程安全(asyncio.Lock),数据持久化到 JSON 文件。
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._bindings: dict[str, AccountBinding] = {}
        self._loaded = False

    async def _ensure_loaded(self) -> None:
        """惰性加载持久化数据(首次调用时加载)。"""
        if self._loaded:
            return
        async with self._lock:
            if self._loaded:
                return
            try:
                if _GRAPH_FILE.exists():
                    raw = json.loads(_GRAPH_FILE.read_text(encoding="utf-8"))
                    for item in raw.get("bindings", []):
                        binding = AccountBinding.from_dict(item)
                        self._bindings[binding.account_id] = binding
                    logger.debug(
                        "[device_graph] 已加载 %d 条绑定记录", len(self._bindings),
                    )
            except (json.JSONDecodeError, OSError, KeyError) as e:
                logger.warning("[device_graph] 加载持久化数据失败: %s", e)
            self._loaded = True

    async def _persist(self) -> None:
        """持久化绑定数据到 JSON 文件。"""
        try:
            _GRAPH_FILE.parent.mkdir(parents=True, exist_ok=True)
            data = {
                "bindings": [b.to_dict() for b in self._bindings.values()],
                "updated_at": time.time(),
            }
            _GRAPH_FILE.write_text(
                json.dumps(data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except OSError as e:
            logger.warning("[device_graph] 持久化失败: %s", e)

    async def record_binding(
        self,
        account_id: str,
        fingerprint_hash: str,
        proxy_ip: str,
        ua_hash: str,
        canvas_hash: str = "",
    ) -> None:
        """记录账号绑定关系(同账号重复调用只更新时间戳)。

        Args:
            account_id: 账号唯一标识
            fingerprint_hash: 浏览器指纹哈希
            proxy_ip: 代理出口 IP
            ua_hash: User-Agent 哈希
            canvas_hash: Canvas 指纹哈希(可选)
        """
        await self._ensure_loaded()
        now = time.time()
        async with self._lock:
            existing = self._bindings.get(account_id)
            if existing:
                existing.fingerprint_hash = fingerprint_hash
                existing.proxy_ip = proxy_ip
                existing.ua_hash = ua_hash
                existing.canvas_hash = canvas_hash
                existing.updated_at = now
            else:
                self._bindings[account_id] = AccountBinding(
                    account_id=account_id,
                    fingerprint_hash=fingerprint_hash,
                    proxy_ip=proxy_ip,
                    ua_hash=ua_hash,
                    canvas_hash=canvas_hash,
                    bound_at=now,
                    updated_at=now,
                )
            await self._persist()
        logger.debug(
            "[device_graph] 记录绑定 account=%s fp=%s ip=%s",
            account_id, fingerprint_hash[:12], proxy_ip,
        )

    async def detect_linkage(self, account_id: str) -> LinkageReport:
        """检测账号是否与其他账号共享设备/IP/指纹/UA。

        Args:
            account_id: 被检测的账号 ID

        Returns:
            LinkageReport(含关联账号列表 + 风险评分)
        """
        await self._ensure_loaded()
        async with self._lock:
            target = self._bindings.get(account_id)
            if target is None:
                return LinkageReport(account_id=account_id, is_linked=False)

            linked: list[dict[str, str]] = []
            linkage_types: list[str] = []
            risk = 0

            for other_id, other in self._bindings.items():
                if other_id == account_id:
                    continue

                reasons: list[str] = []

                # 检测 1:同指纹哈希(高危,+40)
                if (target.fingerprint_hash
                        and target.fingerprint_hash == other.fingerprint_hash):
                    reasons.append("fingerprint_hash")
                    if "fingerprint" not in linkage_types:
                        linkage_types.append("fingerprint")

                # 检测 2:同代理 IP(高危,+35)
                if (target.proxy_ip
                        and target.proxy_ip == other.proxy_ip
                        and target.proxy_ip != "direct"):
                    reasons.append("proxy_ip")
                    if "ip" not in linkage_types:
                        linkage_types.append("ip")

                # 检测 3:同 UA 哈希(中危,+20)
                if (target.ua_hash
                        and target.ua_hash == other.ua_hash):
                    reasons.append("ua_hash")
                    if "ua" not in linkage_types:
                        linkage_types.append("ua")

                # 检测 4:同 Canvas 哈希(高危,+30)
                if (target.canvas_hash
                        and target.canvas_hash == other.canvas_hash):
                    reasons.append("canvas_hash")
                    if "canvas" not in linkage_types:
                        linkage_types.append("canvas")

                if reasons:
                    linked.append({
                        "account_id": other_id,
                        "reasons": ",".join(reasons),
                    })
                    # 累加风险(每个关联账号)
                    if "fingerprint_hash" in reasons:
                        risk += 40
                    if "proxy_ip" in reasons:
                        risk += 35
                    if "ua_hash" in reasons:
                        risk += 20
                    if "canvas_hash" in reasons:
                        risk += 30

            risk = min(100, risk)
            is_linked = len(linked) > 0

            return LinkageReport(
                account_id=account_id,
                is_linked=is_linked,
                linked_accounts=linked,
                risk_score=risk,
                linkage_types=linkage_types,
            )

    async def clear_binding(self, account_id: str) -> None:
        """清除账号绑定记录(账号删除/重置时调用)。"""
        await self._ensure_loaded()
        async with self._lock:
            self._bindings.pop(account_id, None)
            await self._persist()

    async def get_all_bindings(self) -> list[AccountBinding]:
        """获取所有绑定记录(用于审计/调试)。"""
        await self._ensure_loaded()
        async with self._lock:
            return list(self._bindings.values())


# ---------------------------------------------------------------------------
# 全局单例
# ---------------------------------------------------------------------------

_global_guard: DeviceGraphGuard | None = None


def get_device_graph_guard() -> DeviceGraphGuard:
    """获取全局 DeviceGraphGuard 单例。"""
    global _global_guard
    if _global_guard is None:
        _global_guard = DeviceGraphGuard()
    return _global_guard


__all__ = [
    "AccountBinding",
    "LinkageReport",
    "DeviceGraphGuard",
    "get_device_graph_guard",
]
