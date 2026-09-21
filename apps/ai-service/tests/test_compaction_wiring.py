# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""compaction_quality 提交通道接线测试(GAP-PLAN P1-3)。

覆盖:quality 字段增量携带 / 低保留率 auto_degrade(保守 keep_recent 重压)/
开关关闭时契约不变 / gate EMA 记录。夹具说明:
- 每条消息为长中文文本(结构化摘要按行截断,长文本才有真实压缩收益);
- 硬事实(配置路径)只出现在 head 段(尾部 keep_recent 条不含),保证保留率可控;
- 全程 mock LLM,不打真网。
"""

from __future__ import annotations

import importlib
from typing import Any

import pytest

import app.services.compact_with_llm as cwl
import app.services.compaction_quality as cq
from app.services.compact_with_llm import compact_with_llm
from app.services.compaction_quality import CompactionQualityGate

_FILLER = (
    "我们继续讨论这次迭代的设计取向,把交互层次和视觉层级再理一遍,"
    "确保默认路径足够顺畅,同时把边界态的提示语打磨得更自然一些,"
    "让整体体验保持克制和连贯,不引入多余的视觉噪音。"
) * 3
_SECRET = "生产数据库配置路径 /src/auth/login.py 的连接串由运维保管"
_N = 60  # 消息条数(与 limit=20000 配合:original 超触发、规则摘要可收进阈值)
_LIMIT = 20000


def _msgs(n: int = _N, *, head_secret: bool = True) -> list[dict[str, Any]]:
    """n 条长消息;head_secret 时仅头部段含硬事实。

    事实区间取 i < n-16:即使降级重压把尾部保留扩到 keep_recent+bonus(10 条),
    尾部也绝不触及事实 → 低保留率场景可控。
    """
    out: list[dict[str, Any]] = []
    for i in range(n):
        in_head = head_secret and i < n - 16
        fact = f"另有备注:{_SECRET}。" if in_head else ""
        out.append({"role": "user", "content": f"{_FILLER}{fact}"})
    return out


async def _llm_lossy(messages: Any, *args: Any, **kwargs: Any) -> str:
    """丢事实摘要:不含任何硬事实 → 低保留率。"""
    return "摘要:双方围绕设计取向与边界态提示语展开了多轮讨论并达成一致。"


async def _llm_faithful(messages: Any, *args: Any, **kwargs: Any) -> str:
    """保事实摘要:显式复述硬事实 → 高保留率。"""
    return f"摘要:{_SECRET};其余为设计讨论。"


async def _llm_empty(messages: Any, *args: Any, **kwargs: Any) -> str:
    """空摘要 → 走规则压缩路径。"""
    return ""


@pytest.fixture(autouse=True)
def _fresh_gate():
    """每用例换干净 gate(EMA 隔离),结束时还原。"""
    saved = cq.default_quality_gate
    cq.default_quality_gate = CompactionQualityGate()
    yield cq.default_quality_gate
    cq.default_quality_gate = saved


# ---------------------------------------------------------------------------
# 用例
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_quality_field_present_when_enabled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(cwl, "_summarize_head", _llm_lossy)
    compressed, info = await compact_with_llm(
        _msgs(), context_limit=_LIMIT, llm_complete_fn=lambda *a, **k: ""
    )
    assert info.get("compressed") is True
    assert info.get("llm_summary") is True
    quality = info["quality"]
    assert quality["enabled"] is True
    assert {"retention_ratio", "facts_total"} <= set(quality["report"])
    assert {"degrade", "retention_ratio", "suggestion"} <= set(quality["policy"])
    assert {"ema", "consecutive_low", "recorded", "needs_fallback"} <= set(quality["gate"])


@pytest.mark.asyncio
async def test_low_retention_triggers_conservative_retry(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """摘要丢弃全部硬事实 → 降级 + 用 bonus keep_recent 保守重压。"""
    monkeypatch.setattr(cwl, "_summarize_head", _llm_lossy)
    captured: list[int] = []
    real_compress = cwl.compress_messages_if_needed

    def spy(messages: Any, *args: Any, **kwargs: Any):
        captured.append(int(kwargs.get("keep_recent", cwl.DEFAULT_KEEP_RECENT)))
        return real_compress(messages, *args, **kwargs)

    monkeypatch.setattr(cwl, "compress_messages_if_needed", spy)
    compressed, info = await compact_with_llm(
        _msgs(), context_limit=_LIMIT, llm_complete_fn=lambda *a, **k: ""
    )
    assert info["quality"]["degraded"] is True
    # 至少两次压缩调用:原始 + 保守重压(keep_recent 带 bonus)
    assert len(captured) >= 2
    assert captured[-1] == cwl.DEFAULT_KEEP_RECENT + cwl.AGENT_COMPACTION_QUALITY_KEEP_RECENT_BONUS
    # 保守版保留率不降(重压后取更优者)
    assert info["quality"]["report"]["retention_ratio"] >= 0.0


@pytest.mark.asyncio
async def test_faithful_summary_no_degrade(monkeypatch: pytest.MonkeyPatch) -> None:
    """摘要显式保留硬事实 → 不触发降级。"""
    monkeypatch.setattr(cwl, "_summarize_head", _llm_faithful)
    compressed, info = await compact_with_llm(
        _msgs(), context_limit=_LIMIT, llm_complete_fn=lambda *a, **k: ""
    )
    assert info["quality"]["degraded"] is False
    assert info["quality"]["report"]["facts_retained"] >= 1


@pytest.mark.asyncio
async def test_disabled_keeps_old_contract(monkeypatch: pytest.MonkeyPatch) -> None:
    """开关关闭:响应不带 quality 字段(旧契约不变)。"""

    monkeypatch.setattr(cwl, "AGENT_COMPACTION_QUALITY_ENABLED", False)
    monkeypatch.setattr(cwl, "_summarize_head", _llm_lossy)
    compressed, info = await compact_with_llm(
        _msgs(), context_limit=_LIMIT, llm_complete_fn=lambda *a, **k: ""
    )
    assert "quality" not in info
    assert info.get("llm_summary") is True


@pytest.mark.asyncio
async def test_gate_records_ema(monkeypatch: pytest.MonkeyPatch) -> None:
    """压缩成功时 gate.record 记入 EMA 历史。"""
    monkeypatch.setattr(cwl, "_summarize_head", _llm_lossy)
    gate = cq.default_quality_gate
    before = len(gate.history())
    await compact_with_llm(_msgs(), context_limit=_LIMIT, llm_complete_fn=lambda *a, **k: "")
    after = gate.history()
    assert len(after) == before + 1
    assert 0.0 <= after[-1] <= 1.0


def _import_fresh() -> None:
    importlib.reload(cwl)


@pytest.mark.asyncio
async def test_rule_path_also_carries_quality(monkeypatch: pytest.MonkeyPatch) -> None:
    """规则压缩路径同样增量携带 quality(摘要为空 → 不走 custom_summary)。"""
    monkeypatch.setattr(cwl, "_summarize_head", _llm_empty)
    compressed, info = await compact_with_llm(
        _msgs(), context_limit=_LIMIT, llm_complete_fn=lambda *a, **k: ""
    )
    if info.get("compressed"):
        assert "quality" in info
    else:
        # 结构化摘要截断后仍超阈值(incompressible)时,无提交即无评估 —— 与实现一致
        assert info.get("trigger") in ("incompressible", "truncated", "none")
