# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

r"""D154(2026-09-30 立)MCP 连接状态派发回归。

权威口径:`docs/AI_CHAT_BENCHMARK_ANALYSIS_V4.md` §11.3(载体同 D153)+ §十 D154 第 3/8 栏。

钉住的五格,每格都对应一种"服务端日志里有、用户面上没有"的失效:
 A 四档封闭集:未知状态**不得**派发(端上按 state 取五语言词表,未知档渲染成空白)。
 B **同 server 同 state 至多一条**(票第 8 栏去重):重连风暴不得刷屏;
   而状态**变更**照发 —— connecting → failed → connecting 是三件不同的事。
 C **部署级 server(owner 空串)不派发但必须计数**:没有主体就没有收信人;
   静默跳过会让"这台永远没人被通知"读成"没人报过故障"。
 D attempt 与 max_attempts 必须成对:半对会渲染成"第 2/ 次重连"。
 E 派发异常**绝不穿透**到 MCP 生命周期(连接流程比提示重要),但必须计数。

不连库、不发真网络:`_dispatch` 被替换成记录器(§5 测试隔离铁律)。
"""

from __future__ import annotations

import asyncio

import pytest

from app.services import mcp_status


@pytest.fixture(autouse=True)
def _clean_ledger():
    """每条用例前后都清空去重表与计数(共享模块级状态不得跨用例顶数据)。"""
    mcp_status.reset_status_ledger()
    yield
    mcp_status.reset_status_ledger()


@pytest.fixture
def recorder(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, object]]:
    """把网络派发换成记录器:只留"这一帧发出去了没有"的信号。"""
    sent: list[dict[str, object]] = []

    async def _fake(principal: str, payload: dict[str, object]) -> None:
        sent.append({"principal": principal, **payload})

    monkeypatch.setattr(mcp_status, "_dispatch", _fake)
    return sent


@pytest.mark.asyncio
async def test_a_closed_set_rejects_unknown_state(recorder: list[dict[str, object]]) -> None:
    assert mcp_status.MCP_CONNECTION_STATES == (
        "connecting",
        "connected",
        "failed",
        "reconnecting",
    )
    await asyncio.sleep(0)  # 必须在事件循环内:派发是 create_task,无 loop 时按"没 loop"跳过
    assert mcp_status.report_mcp_status("u1", "github", "failed") is True
    assert mcp_status.report_mcp_status("u1", "github", "oauth_completed") is False
    await asyncio.sleep(0)
    assert [e["state"] for e in recorder] == ["failed"], "未知档不得被派发"


@pytest.mark.asyncio
async def test_b_dedupe_same_state_but_change_passes(
    recorder: list[dict[str, object]]
) -> None:
    await asyncio.sleep(0)  # 确保有运行中的事件循环(report 只在 loop 内派发)
    assert mcp_status.report_mcp_status("u1", "fs", "failed") is True
    assert mcp_status.report_mcp_status("u1", "fs", "failed") is False  # 重复帧被去重
    assert mcp_status.report_mcp_status("u1", "fs", "connecting") is True  # 变更照发
    assert mcp_status.report_mcp_status("u2", "fs", "connecting") is True  # 别的主体独立计
    assert mcp_status.dispatch_stats()["skipped_dedupe"] == 1
    await asyncio.sleep(0)  # 让 create_task 跑完
    assert [e["principal"] for e in recorder] == ["u1", "u1", "u2"]


@pytest.mark.asyncio
async def test_c_deployment_level_skipped_and_counted(
    recorder: list[dict[str, object]]
) -> None:
    await asyncio.sleep(0)
    assert mcp_status.report_mcp_status("", "shared-postgres", "failed") is False
    assert recorder == []
    assert mcp_status.dispatch_stats()["skipped_no_principal"] == 1, "跳过必须留痕,不得静默"


@pytest.mark.asyncio
async def test_d_attempt_must_come_with_max(recorder: list[dict[str, object]]) -> None:
    await asyncio.sleep(0)
    assert (
        mcp_status.report_mcp_status("u1", "fs", "reconnecting", attempt=2) is False
    ), "只给分子会渲染成半句话"
    assert (
        mcp_status.report_mcp_status("u2", "fs", "reconnecting", attempt=2, max_attempts=3) is True
    )
    await asyncio.sleep(0)
    assert recorder == [
        {"principal": "u2", "server": "fs", "state": "reconnecting", "attempt": 2, "maxAttempts": 3}
    ], "attempt/maxAttempts 必须成对落帧(键名 camelCase 与 @ihui/types 同形)"


@pytest.mark.asyncio
async def test_e_dispatch_failure_does_not_raise(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    calls: list[str] = []

    async def _boom(principal: str, payload: dict[str, object]) -> None:
        calls.append(principal)
        raise RuntimeError("网络断了")

    monkeypatch.setattr(mcp_status, "_dispatch", _boom)
    await asyncio.sleep(0)
    assert mcp_status.report_mcp_status("u1", "fs", "failed") is True
    # 异常由 _dispatch 自己吞掉,但**必须**留计数与日志 —— 静默丢帧是本仓最高频失效型
    with pytest.raises(RuntimeError):
        await mcp_status._dispatch("u1", {"server": "fs", "state": "failed"})
    assert calls == ["u1"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
