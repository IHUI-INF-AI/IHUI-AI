# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# D16 接线回归测试:成本感知智能路由是否真的被生产 auto 路由消费。
#
# 与 tests/test_model_router.py 的分工:那里测的是 ModelRouter 的纯函数判据;
# 本文件测的是 **接线本身** —— 网关收到请求时确实调了路由层、路由层的决策确实
# 能改变所选模型、以及路由失败/越池/开关关闭三态下逐字维持接线前的既有结果。
#
# 测试隔离(AGENTS.md §5 铁律):全程 monkeypatch,不连生产 PostgreSQL(8810)/
# Redis(8811);`_resolve_from_db` / `_get_pool` / `get_shared_pool` 已由
# tests/conftest.py 的 autouse fixture 换成 no-op,本文件不新增任何 DB 路径。

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.core.llm_gateway import (
    LLMGateway,
    _apply_cost_aware_routing,
    _auto_route_budget_usd_from_env,
    _resolve_auto_model,
)
from app.services.model_router import ModelRouter

# 真实 default_models.json 里稳定存在的三个条目(前缀决定 tier:flash→1 / glm-5→10)
_POOL_IDS = [
    "stepfun/step-3.7-flash",
    "agnes/agnes-2.5-flash",
    "ihui/glm-5.3",
]


@pytest.fixture
def fixed_catalog(monkeypatch):
    """把 auto 路由的可用性判定钉成固定白名单(不依赖 .env 凭据与 provider 健康缓存)。"""
    from app.core.config import settings
    from app.services.model_availability import model_availability

    monkeypatch.setattr(
        model_availability,
        "is_model_available",
        lambda model_id: str(model_id) in set(_POOL_IDS),
    )
    monkeypatch.setattr(settings, "litellm_model", "stepfun/step-3.7-flash")
    return settings


# =============================================================================
# 1. 接线本身:网关的模型选择路径确实调用了路由层
# =============================================================================


async def test_auto_route_consults_router(fixed_catalog, monkeypatch):  # noqa: ARG001
    """`_resolve_auto_model` 必须把收口后的候选池交给成本感知路由层。"""
    calls: list[dict[str, object]] = []

    def _spy(candidates, models_by_id, prompt_text, *, has_tools, budget_usd):
        calls.append(
            {
                "candidates": list(candidates),
                "models_by_id": dict(models_by_id),
                "prompt": prompt_text,
                "has_tools": has_tools,
                "budget_usd": budget_usd,
            }
        )
        return list(candidates)

    monkeypatch.setattr("app.core.llm_gateway._apply_cost_aware_routing", _spy)
    monkeypatch.setenv("LLM_AUTO_ROUTE_BUDGET_USD", "0.5")

    chosen = await _resolve_auto_model(
        has_tools=False,
        messages=[{"role": "user", "content": "帮我把这段代码改一下"}],
    )

    assert len(calls) == 1, "auto 路由没有消费 model_router 接线(造好没装车)"
    assert chosen in calls[0]["candidates"]
    # 池非空、且传进去的是**完整目录条目**(有价格/上下文字段),不是只有 id
    assert calls[0]["candidates"]
    sample = next(iter(calls[0]["models_by_id"].values()))
    assert "context_length" in sample or "input_price" in sample
    # 预算开关从 env 读到并透传给路由层
    assert calls[0]["budget_usd"] == pytest.approx(0.5)
    assert calls[0]["has_tools"] is False


async def test_gateway_request_triggers_routing(monkeypatch):  # noqa: ARG001
    """请求级证据:`complete()` 走 auto 模型时必须经过路由层(不是只在单测里被调)。"""
    from app.core.config import settings

    calls: list[list[str]] = []

    def _spy(candidates, models_by_id, prompt_text, *, has_tools, budget_usd):  # noqa: ARG001
        calls.append(list(candidates))
        return list(candidates)

    # 无凭据 ⇒ stub 模式短路,不碰 litellm;但 auto 路由(含接线)在 stub 判定之前已执行
    monkeypatch.setattr(settings, "llm_providers", json.dumps({"openai": {"api_key": ""}}))
    monkeypatch.delenv("LLM_AUTO_ROUTE_BUDGET_USD", raising=False)
    monkeypatch.setattr("app.core.llm_gateway._apply_cost_aware_routing", _spy)

    result = await LLMGateway().complete([{"role": "user", "content": "你好"}], model="auto")

    assert result["stub"] is True
    assert len(calls) == 1
    assert calls[0], "传给路由层的候选池为空 ⇒ 接线形同虚设"


def test_budget_env_parsing() -> None:
    """预算 env:未设/非数/非正一律 None(不施预算 = 与接线前逐字一致)。"""
    import os

    os.environ.pop("LLM_AUTO_ROUTE_BUDGET_USD", None)
    assert _auto_route_budget_usd_from_env() is None
    os.environ["LLM_AUTO_ROUTE_BUDGET_USD"] = "not-a-number"
    assert _auto_route_budget_usd_from_env() is None
    os.environ["LLM_AUTO_ROUTE_BUDGET_USD"] = "0"
    assert _auto_route_budget_usd_from_env() is None
    os.environ["LLM_AUTO_ROUTE_BUDGET_USD"] = "0.25"
    assert _auto_route_budget_usd_from_env() == pytest.approx(0.25)
    os.environ.pop("LLM_AUTO_ROUTE_BUDGET_USD", None)


# =============================================================================
# 2. 预算降级真的改变所选模型
# =============================================================================


def _pool_dicts(ids: list[str]) -> dict[str, dict[str, object]]:
    return {i: {"id": i, "context_length": 128000, "input_price": 0.25} for i in ids}


def test_budget_degradation_selects_cheaper_tier(monkeypatch) -> None:
    """超预算时选到更便宜的档 —— 且**没超预算时不会**去动这一档(对照)。

    为什么要替换 `from_catalog` 的能力映射:今天 `default_models.json` 经
    `ModelRouter._to_capability` 派生后所有模型 speed_tps 一律 60、output_price 一律 0,
    路由器排完序后首位天然就是"最付得起的那一档" ⇒ 预算维度在这份目录上是惰性的
    (实测探针:None / 1e-3 / 1e-7 三档预算都选到同一模型)。要证明"网关会把预算降级
    结果真的落到 chosen 上",就得喂一份**能力异构**的矩阵 —— 这里用 model_router 自带的
    DEFAULT_MODELS(haiku 更快但更贵、mini 更慢但更便宜),并按传入候选池裁剪,
    它是库内既有事实源,不是为过门编造的数据。
    """
    def _heterogeneous(cls, models=None, now=None):  # noqa: ARG001
        wanted = {str(d.get("id")) for d in (models or [])}
        subset = [m for m in ModelRouter.DEFAULT_MODELS if m.model_id in wanted]
        return cls(models=subset)

    monkeypatch.setattr(ModelRouter, "from_catalog", classmethod(_heterogeneous))
    cands = ["gpt-4o", "gpt-4o-mini", "claude-3.5-haiku"]
    pool = _pool_dicts(cands)
    # SIMPLE 档(prefer_speed=True)+ token_count≈752:
    # est_cost(haiku)=1.88e-4 > 1.128e-4=est_cost(mini)
    prompt = "查询一下明天的天气" + ("啊" * 3000)

    no_budget = _apply_cost_aware_routing(
        cands, pool, prompt, has_tools=False, budget_usd=None
    )
    tight = _apply_cost_aware_routing(cands, pool, prompt, has_tools=False, budget_usd=0.00015)
    impossible = _apply_cost_aware_routing(
        cands, pool, prompt, has_tools=False, budget_usd=0.00001
    )

    # 不设预算:路由器按"快优先"排 ⇒ 选了更贵的 haiku
    assert no_budget[0] == "claude-3.5-haiku"
    # 预算卡在两者之间 ⇒ 真的降到更便宜的 mini
    assert tight[0] == "gpt-4o-mini"
    # 全部超预算 ⇒ 同样落最便宜档(budget_exceeded 由路由层 warn,不改选择正确性)
    assert impossible[0] == "gpt-4o-mini"
    assert no_budget[0] != tight[0], "预算没有改变所选模型 ⇒ 降级链路是假的"
    # 只重排、不扩池也不删项
    assert sorted(tight) == sorted(cands)


async def test_real_catalog_path_consumed_and_safe(monkeypatch) -> None:
    """不 patch 路由器:真实 `from_catalog()` 吃到真实目录条目,决策必须落在池内。

    这条同时是"默认启用不构成行为回退"的取证:今天目录派生出的能力同质
    (speed 全 60 / 多数 input_price 为 0),路由器排序退化为稳定保序 ⇒
    首选与接线前 `candidates[0]` 相同;任何一档预算都不改变选择(惰性)。
    若将来目录补上速度/真实价格数据使本断言变红,那是**功能开始起作用**的信号,
    届时应改这条测试为期望重排,而不是关掉接线。
    """
    from app.services.model_availability import model_availability

    monkeypatch.setattr(model_availability, "is_model_available", lambda _mid: True)
    real = json.loads(
        (
            Path(__file__).resolve().parent.parent / "app" / "data" / "default_models.json"
        ).read_text(encoding="utf-8")
    )
    dicts = [m for m in real.get("models", []) if isinstance(m, dict) and m.get("id")]
    pool = {str(m["id"]): m for m in dicts}

    router = ModelRouter.from_catalog(models=dicts)
    registered = [m.model_id for m in router.list_models()]
    assert len(registered) >= 2, "真实目录没能在路由器里注册出可路由模型"
    # 候选池 = 真实目录里"可路由"的那批(等价于网关在真实部署里能交给路由器的池)
    cands = registered

    baseline = list(cands)
    outs = [
        _apply_cost_aware_routing(cands, pool, "查询一下价格", has_tools=False, budget_usd=b)
        for b in (None, 0.001, 1e-7)
    ]
    for out in outs:
        assert out[0] in baseline, "决策指向了池外模型"
        assert sorted(out) == sorted(baseline)
        assert out[0] == baseline[0], "同质数据下重排不该改变首选(改变了即行为回退)"


# =============================================================================
# 3. 三态回落:越池决策 / 路由层抛错 / 开关关闭 ⇒ 逐字维持接线前结果
# =============================================================================


def test_decision_outside_pool_is_ignored(monkeypatch) -> None:
    """from_catalog 兜底会带回 DEFAULT_MODELS(本部署不可用),必须挡住。"""
    spy = {"called": False}

    def _fake_from_catalog(cls, models=None, now=None):  # noqa: ARG001
        spy["called"] = True
        return ModelRouter()  # gpt-4o 等池外模型

    monkeypatch.setattr(ModelRouter, "from_catalog", classmethod(_fake_from_catalog))
    cands = ["stepfun/step-3.7-flash", "agnes/agnes-2.5-flash"]
    out = _apply_cost_aware_routing(
        cands, _pool_dicts(cands), "hello", has_tools=False, budget_usd=None
    )
    assert spy["called"] is True
    assert out == cands


def test_router_exception_keeps_previous_choice(monkeypatch) -> None:
    """路由层抛任何异常 ⇒ 维持既有顺序,绝不向上冒泡成请求失败。"""
    def _boom(cls, models=None, now=None):  # noqa: ARG001
        raise RuntimeError("catalog exploded")

    monkeypatch.setattr(ModelRouter, "from_catalog", classmethod(_boom))
    cands = ["stepfun/step-3.7-flash", "agnes/agnes-2.5-flash"]
    out = _apply_cost_aware_routing(
        cands, _pool_dicts(cands), "hello", has_tools=False, budget_usd=None
    )
    assert out == cands


def test_switch_off_short_circuits_router(monkeypatch) -> None:
    """LLM_MODEL_ROUTER_WIRING_ENABLED=false ⇒ 路由层一次都不被调用。"""
    called = {"n": 0}

    def _boom(cls, models=None, now=None):  # noqa: ARG001
        called["n"] += 1
        raise AssertionError("开关关闭时不应构造路由器")

    monkeypatch.setattr(ModelRouter, "from_catalog", classmethod(_boom))
    monkeypatch.setenv("LLM_MODEL_ROUTER_WIRING_ENABLED", "false")
    cands = ["stepfun/step-3.7-flash", "agnes/agnes-2.5-flash"]
    assert _apply_cost_aware_routing(
        cands, _pool_dicts(cands), "hello", has_tools=False, budget_usd=None
    ) == cands
    assert called["n"] == 0


def test_single_candidate_pool_skips_routing(monkeypatch) -> None:
    """候选只剩 1 个(如复杂度升级到高级模型后被收成单点)⇒ 无重排余地,原样返回。"""
    monkeypatch.setenv("LLM_MODEL_ROUTER_WIRING_ENABLED", "true")
    single = ["stepfun/step-3.7-flash"]
    assert _apply_cost_aware_routing(
        single, _pool_dicts(single), "hello", has_tools=False, budget_usd=None
    ) == single


async def test_auto_route_still_falls_back_when_nothing_available(fixed_catalog, monkeypatch):  # noqa: ARG001
    """目录全不可用时仍回落到 settings.litellm_model(接线不得吃掉既有兜底)。"""
    from app.services.model_availability import model_availability

    monkeypatch.setattr(model_availability, "is_model_available", lambda _mid: False)
    chosen = await _resolve_auto_model(has_tools=False, messages=[{"role": "user", "content": "hi"}])
    assert chosen == "stepfun/step-3.7-flash"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
