# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Workspace Trust —— 权限沙箱三层模型的**第一层**(2026-11-15 立,对标 Trae)。

来源(四程序逆向 T3§C / T4§C)
------------------------------
Trae 权限沙箱三层:Workspace Trust(首次确认)→ Permission Engine → Permission Layer
(``checkPermission()`` 统一入口)。本仓现读有三件权限件,但**分散**:
- ``shared/permission/rules.ts``:审批规则引擎(allow/ask/deny),TS 侧;
- ``exec_policy.py``:命令级策略(PrefixRule/Decision),Python 侧;
- ``permission_grant_two_phase.py``:审批回执两阶段提交。

**缺的是第一层**:工作区首次访问的信任确认。一个从未见过的工作区,在用户**显式信任**
之前,所有写/exec 都应先弹一次信任确认——这是"新工作区第一次操作弹一次确认"的落点。

职责
----
- ``trust_key``:工作区路径 → 规范化信任键(纯函数)。
- ``TrustStore``:信任状态存取(进程内 + 可选 Redis 持久化)。
- ``decide_trust``:纯函数判定——已信任 / 未信任 / 需首次确认。**未信任 ⇒ 阻断**,
  绝不静默放行(§0.3 没判不写成判过;首访工作区"放行"等于跳过信任层)。
- ``trust_workspace`` / ``distrust_workspace``:显式信任/撤销。

纪律
----
- **不重复造审批引擎**:allow/ask/deny 的工具级判定仍在 ``rules.ts``(单一真相源)。
  本模块只回答"这个工作区被信任了吗"这一层,**不判定具体工具**。
- **fail-closed**:未信任 / 存取失败 ⇒ 阻断,要求首次确认。绝不"取不到状态就放行"。
- 纯函数 ``decide_trust`` 可单测;I/O 走 ``TrustStore``。
- 无 console;结构化返回 + logging。
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

logger = logging.getLogger(__name__)


class TrustVerdict(StrEnum):
    """工作区信任三态。

    - ``TRUSTED``:用户已显式信任该工作区 ⇒ 放行进入下一层(Permission Engine)。
    - ``NEEDS_FIRST_TRUST``:从未见过该工作区 ⇒ **需首次信任确认**(阻断,弹一次确认)。
    - ``DISTRUSTED``:用户曾显式撤销信任 ⇒ 阻断(比 NEEDS_FIRST_TRUST 更严,需重新信任)。
    """

    TRUSTED = "trusted"
    NEEDS_FIRST_TRUST = "needs_first_trust"
    DISTRUSTED = "distrusted"


def trust_key(workspace: str) -> str:
    """工作区路径 → 规范化信任键(纯函数)。

    Windows 大小写不敏感 + 分隔符归一(与 ``file_write_gate._lock_key`` 同一条
    normcase(normpath) 纪律),同一工作区无论传法如何同键。绝对路径不在此解析——
    调用方应传入已 canonicalize 的路径;本函数只做键规范化,不做路径存在性判断。
    """
    return os.path.normcase(os.path.normpath(workspace))


@dataclass
class TrustDecision:
    """一次工作区信任判定(纯数据,可审计)。"""

    workspace: str
    verdict: TrustVerdict
    allow: bool
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "workspace": self.workspace,
            "verdict": self.verdict.value,
            "allow": self.allow,
            "reason": self.reason,
        }


def decide_trust(state: str | None) -> TrustDecision:
    """按存储状态判三态(纯函数,可单测)。

    ``state`` 取值:``"trusted"`` / ``"distrusted"`` / ``None``(从未见过)。
    未知取值 ⇒ 视为未信任(阻断,不冒充已信任)——§0.3 纪律。
    """
    if state == "trusted":
        return TrustDecision(
            workspace="",
            verdict=TrustVerdict.TRUSTED,
            allow=True,
            reason="工作区已被用户显式信任",
        )
    if state == "distrusted":
        return TrustDecision(
            workspace="",
            verdict=TrustVerdict.DISTRUSTED,
            allow=False,
            reason="工作区信任已被用户撤销,需重新信任",
        )
    if state is None:
        return TrustDecision(
            workspace="",
            verdict=TrustVerdict.NEEDS_FIRST_TRUST,
            allow=False,
            reason="工作区首次访问,需用户显式信任确认",
        )
    # 未知状态:阻断(不冒充已信任)。
    return TrustDecision(
        workspace="",
        verdict=TrustVerdict.NEEDS_FIRST_TRUST,
        allow=False,
        reason=f"工作区信任状态未知({state!r}),按未信任阻断",
    )


class TrustStore:
    """工作区信任状态存取。

    进程内 dict 为主;可选 Redis 持久化(降级为纯内存,与
    ``agent_checkpoint`` / ``workspace_lock`` 的降级纪律一致)。
    """

    _REDIS_PREFIX = "ihui:workspace_trust:"

    def __init__(self) -> None:
        self._states: dict[str, str] = {}
        self._redis: Any = None
        self._redis_checked = False

    # -- Redis(软依赖,降级) --------------------------------------------

    def _redis_client(self) -> Any:
        if not self._redis_checked:
            self._redis_checked = True
            try:
                import redis.asyncio as aioredis  # noqa: F401
                from app.core.config import settings

                url = getattr(settings, "redis_url", None) or os.environ.get("REDIS_URL")
                if url:
                    import redis.asyncio as aio

                    self._redis = aio.from_url(url)
            except Exception as e:  # noqa: BLE001 - 缺依赖/连不上 → 纯内存降级
                logger.debug("workspace_trust Redis 不可用,降级纯内存: %s", e)
                self._redis = None
        return self._redis

    def _redis_key(self, key: str) -> str:
        return f"{self._REDIS_PREFIX}{key}"

    # -- 存取 ------------------------------------------------------------

    async def get_state(self, workspace: str) -> str | None:
        """取工作区信任状态(None = 从未见过)。Redis 优先,失败回落内存。"""
        key = trust_key(workspace)
        r = self._redis_client()
        if r is not None:
            try:
                raw = await r.get(self._redis_key(key))
                if raw is not None:
                    return raw.decode() if isinstance(raw, bytes) else raw
            except Exception as e:  # noqa: BLE001
                logger.debug("workspace_trust Redis get 失败,回落内存: %s", e)
        return self._states.get(key)

    async def set_state(self, workspace: str, state: str) -> None:
        """写工作区信任状态(内存 + 尽力 Redis)。"""
        key = trust_key(workspace)
        self._states[key] = state
        r = self._redis_client()
        if r is not None:
            try:
                await r.set(self._redis_key(key), state)
            except Exception as e:  # noqa: BLE001 - Redis 写失败不影响内存主流程
                logger.debug("workspace_trust Redis set 失败(内存已写): %s", e)

    async def trust(self, workspace: str) -> None:
        """显式信任工作区(用户首次确认/重新信任)。"""
        await self.set_state(workspace, "trusted")

    async def distrust(self, workspace: str) -> None:
        """显式撤销工作区信任。"""
        await self.set_state(workspace, "distrusted")

    async def decide(self, workspace: str) -> TrustDecision:
        """判定一个工作区的信任态(取状态 + 纯函数判定)。"""
        state = await self.get_state(workspace)
        decision = decide_trust(state)
        decision.workspace = workspace
        return decision


# 进程内默认信任库(单一实例,避免多处各建导致信任状态分裂)。
_default_store = TrustStore()


def default_trust_store() -> TrustStore:
    """返回进程内默认信任库。"""
    return _default_store


# ---------------------------------------------------------------------------
# 单元测试(纯函数 decide_trust;不碰 I/O)
# ---------------------------------------------------------------------------


def _run_sync(coro: Any) -> Any:
    """同步跑一个协程(测试用,避免每个测试 async)。"""
    import asyncio

    return asyncio.get_event_loop().run_until_complete(coro)


def test_trust_key_normalizes_windows_case() -> None:
    assert trust_key(r"C:\Work\A") == trust_key(r"c:\work\a")
    assert trust_key(r"C:\Work\A") == trust_key("C:/Work/A")


def test_decide_trust_trusted_allows() -> None:
    out = decide_trust("trusted")
    assert out.verdict == TrustVerdict.TRUSTED
    assert out.allow is True


def test_decide_trust_none_needs_first_trust() -> None:
    out = decide_trust(None)
    assert out.verdict == TrustVerdict.NEEDS_FIRST_TRUST
    assert out.allow is False  # 首访工作区必须先确认,不静默放行


def test_decide_trust_distrusted_blocks() -> None:
    out = decide_trust("distrusted")
    assert out.verdict == TrustVerdict.DISTRUSTED
    assert out.allow is False


def test_decide_trust_unknown_state_blocks() -> None:
    """未知状态 ⇒ 阻断(不冒充已信任)。"""
    out = decide_trust("garbage")
    assert out.verdict == TrustVerdict.NEEDS_FIRST_TRUST
    assert out.allow is False


def test_store_trust_then_decide_allows() -> None:
    store = TrustStore()
    _run_sync(store.trust("/w/a"))
    d = _run_sync(store.decide("/w/a"))
    assert d.verdict == TrustVerdict.TRUSTED
    assert d.allow is True


def test_store_never_seen_needs_first_trust() -> None:
    store = TrustStore()
    d = _run_sync(store.decide("/w/never-seen"))
    assert d.verdict == TrustVerdict.NEEDS_FIRST_TRUST
    assert d.allow is False


def test_store_distrust_overrides_trust() -> None:
    store = TrustStore()
    _run_sync(store.trust("/w/b"))
    _run_sync(store.distrust("/w/b"))
    d = _run_sync(store.decide("/w/b"))
    assert d.verdict == TrustVerdict.DISTRUSTED
    assert d.allow is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
