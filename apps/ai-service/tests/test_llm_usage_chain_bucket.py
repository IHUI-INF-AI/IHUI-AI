# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-941 残余(2026-10-26 第二读面):llm_usage_service 用量读数的链别分桶。

覆盖(用例成对 + 零副作用,COMMON.md 交付纪律):
- 正向:同 session 同 provider/model,主链与子代理各产生用量 ⇒ 两条链
  各自持增量基线、各自计数(修复前共用一条基线 ⇒ 少计)。
- 反向对照:不带链标签(空串)与表外值的记录落"未判定"桶,
  绝不静默并入主链;workflow 档同枚举可见。
- 零副作用:读数路径只动内存 _records,测试期间任何 socket 连接尝试
  直接判失败(不得连 PG 8810 / Redis 8811,也不得连任何外部端口)。

链别常量与归一判据单源 app.core.token_baseline(chain_bucket),
本测试不复制第二份判据。
"""

from __future__ import annotations

import socket

import pytest

from app.core.token_baseline import (
    CHAIN_MAIN,
    CHAIN_SUBAGENT,
    CHAIN_UNKNOWN_LABEL,
    CHAIN_WORKFLOW,
)
from app.services.llm_usage_service import LLMUsageService


@pytest.fixture(autouse=True)
def _no_network(monkeypatch):
    """测试隔离铁律:用量读数结构性不碰网络,连一下即炸。"""

    def _blocked(*_args, **_kwargs):
        raise AssertionError(
            "llm_usage_service 读数路径不得建立任何网络连接"
            "(禁连 PG 8810 / Redis 8811 / 任意外部端口)"
        )

    monkeypatch.setattr(socket, "create_connection", _blocked)
    monkeypatch.setattr(socket.socket, "connect", _blocked)
    monkeypatch.setattr(socket.socket, "connect_ex", _blocked)


@pytest.fixture
def service():
    return LLMUsageService()


def _record(svc, prompt, output, chain, session="sess-g941"):
    return svc.record_usage(
        "openai",
        "gpt-4o",
        "u1",
        prompt,
        output,
        session_id=session,
        chain=chain,
    )


# =============================================================================
# 正向:主链与子代理各自计数(链维进增量基线)
# =============================================================================


def test_main_and_subagent_same_session_same_model_counted_per_chain(service):
    """同 session 同 provider/model:主链 5000→6000、子代理 3000→3500。

    按链分桶后:main 增量 5000+1000=6000,subagent 增量 3000+500=3500,
    合计 9500。修复前(读面键无链维)四条共用一条基线,按写入序
    5000,3000,6000,3500 只算出 5000+0+3000+0=8000 ⇒ 少计 1500。
    """
    _record(service, 5000, 10, CHAIN_MAIN)
    _record(service, 3000, 20, CHAIN_SUBAGENT)
    _record(service, 6000, 30, CHAIN_MAIN)
    _record(service, 3500, 40, CHAIN_SUBAGENT)

    stats = service.get_user_stats("u1", days=7)
    assert stats["total_input_tokens"] == 9500
    assert stats["total_calls"] == 4

    by_chain = stats["chain_breakdown"]
    assert by_chain[CHAIN_MAIN]["input_tokens"] == 6000
    assert by_chain[CHAIN_MAIN]["calls"] == 2
    assert by_chain[CHAIN_SUBAGENT]["input_tokens"] == 3500
    assert by_chain[CHAIN_SUBAGENT]["calls"] == 2
    assert CHAIN_UNKNOWN_LABEL not in by_chain


def test_workflow_chain_is_its_own_bucket(service):
    """workflow 档与 main/subagent 同枚举,独立持基线、独立可见。"""
    _record(service, 4000, 10, CHAIN_WORKFLOW)
    _record(service, 4500, 20, CHAIN_WORKFLOW)
    _record(service, 1000, 5, CHAIN_MAIN)

    by_chain = service.get_user_stats("u1", days=7)["chain_breakdown"]
    assert by_chain[CHAIN_WORKFLOW]["input_tokens"] == 4500
    assert by_chain[CHAIN_WORKFLOW]["calls"] == 2
    assert by_chain[CHAIN_MAIN]["input_tokens"] == 1000


# =============================================================================
# 反向对照:缺链/表外值 → "未判定"桶,不并入主链
# =============================================================================


def test_records_without_chain_land_in_unknown_bucket_not_main(service):
    """不带链标签的记录:桶键 = "未判定",且"main"桶结构性不存在。"""
    _record(service, 1000, 10, "")
    _record(service, 1200, 20, "")

    by_chain = service.get_user_stats("u1", days=7)["chain_breakdown"]
    assert list(by_chain) == [CHAIN_UNKNOWN_LABEL]
    assert by_chain[CHAIN_UNKNOWN_LABEL]["calls"] == 2
    # 同桶仍共用一条基线(旧行为仅在同一"未判定"桶内保留,不扩散到主链)
    assert by_chain[CHAIN_UNKNOWN_LABEL]["input_tokens"] == 1200
    assert CHAIN_MAIN not in by_chain


def test_unknown_chain_never_merged_into_main(service):
    """主链与无链记录共存:两桶各自独立,互不借基线、互不并桶。

    修复前两条链在 provider/model+session 上同键 ⇒ 无链记录会借走
    主链基线;现在链别先进来源键,"未判定"的 900 不被 main 的 5000 压掉。
    """
    _record(service, 5000, 10, CHAIN_MAIN)
    _record(service, 900, 5, "")

    stats = service.get_user_stats("u1", days=7)
    by_chain = stats["chain_breakdown"]
    assert by_chain[CHAIN_MAIN]["input_tokens"] == 5000
    assert by_chain[CHAIN_UNKNOWN_LABEL]["input_tokens"] == 900
    assert stats["total_input_tokens"] == 5900


def test_out_of_enum_chain_value_lands_in_unknown_bucket(service):
    """表外链别值(如 "sub_agent" 拼错)同样归"未判定",绝不另开私桶。"""
    _record(service, 800, 10, "sub_agent")

    by_chain = service.get_user_stats("u1", days=7)["chain_breakdown"]
    assert list(by_chain) == [CHAIN_UNKNOWN_LABEL]
    assert by_chain[CHAIN_UNKNOWN_LABEL]["input_tokens"] == 800


# =============================================================================
# 写面:记录必须带链标签(读面分桶的输入前提)
# =============================================================================


def test_record_usage_stores_chain_label(service):
    """record_usage 把 chain 落进 UsageRecord;缺省为空串(旧调用方零破坏)。"""
    tagged = _record(service, 100, 1, CHAIN_SUBAGENT)
    legacy = service.record_usage("openai", "gpt-4o", "u1", 100, 1)
    assert tagged.chain == CHAIN_SUBAGENT
    assert legacy.chain == ""
    assert legacy.session_id == ""


# =============================================================================
# 零副作用:内存态之外不留任何痕迹
# =============================================================================


def test_zero_side_effects_stats_reads_in_memory_only(service):
    """写四条 + 读三轮后:仅 _records 增长,无任何网络连接尝试/socket 炸点。

    本用例跑在 _no_network 夹具内 ⇒ 若读数路径曾连 PG 8810 / Redis 8811
    (或任何端口),socket.connect 会直接 AssertionError。
    """
    before = len(service._records)
    _record(service, 1000, 10, CHAIN_MAIN)
    _record(service, 1100, 20, CHAIN_SUBAGENT)
    _record(service, 1200, 30, "")
    _record(service, 1300, 40, CHAIN_WORKFLOW)
    for _ in range(3):
        service.get_user_stats("u1", days=7)
        service.get_global_stats(days=7)
        service.get_quota_info("u1")
    assert len(service._records) == before + 4
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
