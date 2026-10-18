# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""票85② 边缘优先候选组装的判定级用例(纯函数,零网络零环境)。

唯一要紧的判据:**开关关闭时行为与 2026-08-06 版逐字一致**(云部署零回归),
开关开启时「探针实证可用」的本地模型排候选最前(tier 升序)—— 顺序偏好,
不扩池、不改分桶。
"""

from __future__ import annotations

from app.core.llm_gateway import _assemble_auto_candidates


def _m(mid: str) -> dict:
    return {"id": mid}


DEFAULT_CHAIN = ["stepfun/step-3.7-flash"]

AVAILABLE = [
    _m("stepfun/step-3.7-flash"),      # cheap tier 3
    _m("@cf/zai-org/glm-4.7-flash"),   # free
    _m("ollama/llama-3.3-70b"),        # local tier 3
    _m("ollama/llama-3.1-8b"),         # local tier 1
    _m("deepseek/deepseek-chat"),      # cheap tier 3
    _m("claude-sonnet-x"),             # premium tier 10
    _m("gpt-4o"),                      # _AUTO_ROUTE_EXCLUDED
]


def test_edge_off_is_byte_compatible_with_legacy_order():
    plan = _assemble_auto_candidates(
        AVAILABLE, edge_first_local=False, default_chain=DEFAULT_CHAIN
    )
    # 旧版顺序:default 链 > free > cheap(tier 升序取 5)> premium 兜底;本地不出现
    assert plan.local_pool == []
    assert plan.candidates[0] == "stepfun/step-3.7-flash"
    assert "@cf/zai-org/glm-4.7-flash" in plan.candidates
    assert "gpt-4o" not in plan.candidates  # EXCLUDED 桶前剔除
    assert plan.candidates[-1] == "claude-sonnet-x"  # premium min-tier 兜底
    # 去重保序:default 链成员(stepfun)不再重复出现
    assert plan.candidates.count("stepfun/step-3.7-flash") == 1


def test_edge_on_puts_verified_local_first_sorted_by_tier():
    plan = _assemble_auto_candidates(
        AVAILABLE, edge_first_local=True, default_chain=DEFAULT_CHAIN
    )
    assert plan.local_pool == ["ollama/llama-3.1-8b", "ollama/llama-3.3-70b"]  # tier 1 → 3
    assert plan.candidates[:2] == plan.local_pool
    # 本地之后接默认链,其后既有次序不变
    assert plan.candidates[2] == "stepfun/step-3.7-flash"
    assert plan.candidates[-1] == "claude-sonnet-x"


def test_edge_on_without_local_keeps_legacy_head():
    no_local = [m for m in AVAILABLE if not m["id"].startswith("ollama/")]
    plan = _assemble_auto_candidates(
        no_local, edge_first_local=True, default_chain=DEFAULT_CHAIN
    )
    assert plan.local_pool == []
    assert plan.candidates[0] == "stepfun/step-3.7-flash"  # 默认链顶,无本地可排


def test_premium_top_and_relaxed_pool_shapes():
    plan = _assemble_auto_candidates(
        AVAILABLE, edge_first_local=True, default_chain=DEFAULT_CHAIN
    )
    assert plan.premium_top == "claude-sonnet-x"
    # 放宽池:本地实证 + free + cheap 前 3,去重保序(边缘实例的云池常不可用,本地保留)
    assert plan.relaxed[:2] == plan.local_pool
    assert "@cf/zai-org/glm-4.7-flash" in plan.relaxed
    assert "claude-sonnet-x" not in plan.relaxed  # premium 不进放宽池(旧版同)


def test_empty_available_yields_empty_plan():
    plan = _assemble_auto_candidates([], edge_first_local=True, default_chain=DEFAULT_CHAIN)
    assert plan.candidates == DEFAULT_CHAIN
    assert plan.local_pool == [] and plan.premium_top == "" and plan.relaxed == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
