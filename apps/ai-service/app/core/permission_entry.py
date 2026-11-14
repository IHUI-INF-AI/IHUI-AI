# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""统一权限入口 ``check_permission`` —— 三层模型的**收口**(2026-11-15 立,对标 Trae)。

来源(四程序逆向 T3§C / T4§C)
------------------------------
Trae 权限沙箱三层:Workspace Trust → Permission Engine → Permission Layer
(``checkPermission()`` 统一入口,失败阻塞 + 确认)。Trae 文档原文:"All tool calls
must pass permission-layer validation. Calls that fail checks are blocked and
surface a confirmation"。

本仓缺口(本轮现读确认)
------------------------
权限判定件分散,没有统一入口:
- ``shared/permission/rules.ts``:审批规则引擎(TS 侧,前端/SDK 用);
- ``exec_policy.py``:命令级策略(Python,``evaluate(command)`` → Decision);
- ``permission_grant_two_phase.py``:审批回执两阶段;
- ``workspace_trust.py``:第一层 Workspace Trust(本轮新增);
- ``guarded_tool_pipeline.py``:工具执行**管道**(prompt_guard → input_scan →
  budget → fn → record 多阶段),但**不含 workspace_trust 这一关**。

=> 缺一个**统一入口**把 Workspace Trust 作为第一关串起来。本模块提供
``check_permission(workspace, ...)``:先过信任层,信任不过 ⇒ 直接阻断(**不到
具体工具判定**);信任通过 ⇒ 放行调用方继续走既有判定链。

职责边界(单一真相源,不重复造)
--------------------------------
- 本模块**不重造**命令策略(``exec_policy.evaluate``)、**不重造**审批引擎
  (``rules.ts``)、**不重造**管道(``guarded_tool_pipeline``)。它只做两件事:
  ① 强制 Workspace Trust 作为第一关;② 给调用方一个稳定入口形状。
- 调用方把"具体工具怎么判"交给既有件;本模块只挡"工作区根本不可信"这一类。

fail-closed
-----------
信任未确认 / 撤销 / 判定异常 ⇒ 一律 ``allow=False`` 阻断,绝不在不确定时放行
(§0.3 没判不写成判过;§0.10 失败是"多要一次定向说明",不是"多放一次跳门")。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from app.core.workspace_trust import (
    TrustVerdict,
    default_trust_store,
)

logger = logging.getLogger(__name__)


@dataclass
class PermissionDecision:
    """一次权限入口判定(纯数据,可审计)。

    ``layer`` 记录在哪一层被拦(或放行),便于定位与审计:
    - ``workspace_trust``:在第一层(信任)被拦/放行;
    - ``delegated``:信任已过,交给上层判定链(本入口不越权下结论)。
    """

    allow: bool
    layer: str
    reason: str
    workspace: str
    trust_verdict: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "allow": self.allow,
            "layer": self.layer,
            "reason": self.reason,
            "workspace": self.workspace,
            "trust_verdict": self.trust_verdict,
        }


async def check_permission(
    workspace: str,
    *,
    store: Any | None = None,
) -> PermissionDecision:
    """统一权限入口:强制 Workspace Trust 为第一关。

    Args:
        workspace: 工作区路径(调用方应传已 canonicalize 的路径;
            ``workspace_trust.trust_key`` 会做键规范化)。
        store: 可注入信任库(测试用);None 用进程内默认。

    Returns:
        ``PermissionDecision``。信任未过 ⇒ ``allow=False, layer="workspace_trust"``,
        **调用方必须就此停止**,不得进入具体工具判定/执行;信任通过 ⇒
        ``allow=True, layer="delegated"``,继续走既有判定链。

    纪律:本入口**只挡第一层**,不对具体工具下 allow 结论——那是 Permission
    Engine(``rules.ts`` / ``exec_policy``)的事。返回 ``allow=True`` 语义是
    "信任层放行,可继续",不是"整体放行",调用方须继续后续判定。
    """
    trust = store or default_trust_store()
    try:
        decision = await trust.decide(workspace)
    except Exception as e:  # noqa: BLE001 - 判定异常 ⇒ 阻断(fail-closed,不冒绿)
        logger.warning(
            "check_permission 信任判定异常,阻断 workspace=%s: %s", workspace, e
        )
        return PermissionDecision(
            allow=False,
            layer="workspace_trust",
            reason=f"信任判定异常,阻断: {type(e).__name__}: {e}",
            workspace=workspace,
            trust_verdict="error",
        )

    if decision.verdict == TrustVerdict.TRUSTED:
        return PermissionDecision(
            allow=True,
            layer="delegated",
            reason="工作区已信任,放行进入后续判定链(具体工具判定交 Permission Engine)",
            workspace=workspace,
            trust_verdict=decision.verdict.value,
        )

    # 未信任 / 需首次信任 / 撤销 ⇒ 阻断,不到具体工具判定。
    return PermissionDecision(
        allow=False,
        layer="workspace_trust",
        reason=decision.reason,
        workspace=workspace,
        trust_verdict=decision.verdict.value,
    )


# ---------------------------------------------------------------------------
# 单元测试(纯编排逻辑;trust store 用内存实现,不碰真 Redis)
# ---------------------------------------------------------------------------


def _run_sync(coro: Any) -> Any:
    import asyncio

    return asyncio.get_event_loop().run_until_complete(coro)


class _FakeStore:
    """内存假信任库(测试用,避免真 Redis)。"""

    def __init__(self, verdict: TrustVerdict) -> None:
        self._verdict = verdict
        from app.core.workspace_trust import TrustDecision

        self._decision = TrustDecision(
            workspace="/w", verdict=verdict, allow=verdict == TrustVerdict.TRUSTED,
            reason=f"fake:{verdict.value}",
        )

    async def decide(self, workspace: str) -> Any:
        from dataclasses import replace

        return replace(self._decision, workspace=workspace)


def test_untrusted_blocks_at_trust_layer() -> None:
    out = _run_sync(
        check_permission("/w/x", store=_FakeStore(TrustVerdict.NEEDS_FIRST_TRUST))
    )
    assert out.allow is False
    assert out.layer == "workspace_trust"
    assert out.trust_verdict == "needs_first_trust"
    # 未过信任层 ⇒ 不到 delegated
    assert out.layer != "delegated"


def test_distrusted_blocks() -> None:
    out = _run_sync(check_permission("/w/y", store=_FakeStore(TrustVerdict.DISTRUSTED)))
    assert out.allow is False
    assert out.layer == "workspace_trust"


def test_trusted_delegates_not_final_allow() -> None:
    """信任通过 ⇒ 放行但 layer=delegated(语义是"可继续",不是"整体放行")。"""
    out = _run_sync(check_permission("/w/z", store=_FakeStore(TrustVerdict.TRUSTED)))
    assert out.allow is True
    assert out.layer == "delegated"
    assert out.trust_verdict == "trusted"


def test_decision_to_dict_shape() -> None:
    out = _run_sync(check_permission("/w/a", store=_FakeStore(TrustVerdict.TRUSTED)))
    d = out.to_dict()
    assert set(d) == {"allow", "layer", "reason", "workspace", "trust_verdict"}
    assert d["layer"] == "delegated"


class _BoomStore:
    async def decide(self, workspace: str) -> Any:
        raise RuntimeError("boom")


def test_store_exception_fails_closed() -> None:
    """信任库异常 ⇒ 阻断(fail-closed,不冒绿)。"""
    out = _run_sync(check_permission("/w/e", store=_BoomStore()))
    assert out.allow is False
    assert out.layer == "workspace_trust"
    assert out.trust_verdict == "error"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
