"""model_router 单元测试。

覆盖:
- 任务复杂度评估(5 等级 + token 数判定)
- 路由决策(指定模型 / 本地优先 / 付费升级 / 无候选降级)
- 能力过滤(tools / vision)
- 成本估算
- 模型注册与查询
"""

from __future__ import annotations

import pytest

from app.services.model_router import (
    ModelCapability,
    ModelRouter,
    RoutingDecision,
    TaskComplexity,
    model_router,
)


class TestAssessComplexity:
    """assess_complexity 复杂度评估测试。"""

    def test_assess_complexity_trivial(self):
        """简单问答 → TRIVIAL。"""
        router = ModelRouter()
        assert router.assess_complexity("你好") == TaskComplexity.TRIVIAL
        assert router.assess_complexity("hello world") == TaskComplexity.TRIVIAL

    def test_assess_complexity_simple(self):
        """查询/翻译关键词 → SIMPLE。"""
        router = ModelRouter()
        assert router.assess_complexity("查询今天的天气") == TaskComplexity.SIMPLE
        assert router.assess_complexity("translate this sentence") == TaskComplexity.SIMPLE

    def test_assess_complexity_moderate(self):
        """修改/实现关键词或 has_code → MODERATE。"""
        router = ModelRouter()
        assert router.assess_complexity("修改这个函数") == TaskComplexity.MODERATE
        assert router.assess_complexity("implement the feature") == TaskComplexity.MODERATE
        # has_code 单独触发 MODERATE
        assert router.assess_complexity("hello", has_code=True) == TaskComplexity.MODERATE

    def test_assess_complexity_complex(self):
        """调试/设计关键词或 tools+code → COMPLEX。"""
        router = ModelRouter()
        assert router.assess_complexity("调试这个 bug") == TaskComplexity.COMPLEX
        assert router.assess_complexity("design the system") == TaskComplexity.COMPLEX
        # has_tools + has_code 联合触发 COMPLEX
        assert router.assess_complexity("x", has_tools=True, has_code=True) == TaskComplexity.COMPLEX

    def test_assess_complexity_expert(self):
        """重构/架构关键词 → EXPERT。"""
        router = ModelRouter()
        assert router.assess_complexity("重构这个模块的架构") == TaskComplexity.EXPERT
        assert router.assess_complexity("refactor the architecture") == TaskComplexity.EXPERT

    def test_assess_complexity_token_count(self):
        """按 token 数判定复杂度梯度。"""
        router = ModelRouter()
        assert router.assess_complexity("x", token_count=100) == TaskComplexity.TRIVIAL
        assert router.assess_complexity("x", token_count=800) == TaskComplexity.SIMPLE
        assert router.assess_complexity("x", token_count=5000) == TaskComplexity.MODERATE
        assert router.assess_complexity("x", token_count=20000) == TaskComplexity.COMPLEX
        assert router.assess_complexity("x", token_count=60000) == TaskComplexity.EXPERT


class TestRoute:
    """route 路由决策测试。"""

    def test_route_preferred_model(self):
        """指定模型优先,直接返回该模型。"""
        router = ModelRouter()
        decision = router.route("任意 prompt", preferred_model="claude-3.5-sonnet")
        assert isinstance(decision, RoutingDecision)
        assert decision.selected_model == "claude-3.5-sonnet"
        assert decision.alternatives == []
        assert decision.estimated_cost == 0.0

    def test_route_local_preferred(self):
        """简单任务优先本地(免费)模型。"""
        router = ModelRouter()
        decision = router.route("你好")  # TRIVIAL
        # 本地模型优先(免费);llama3.2 速度 50tps > qwen2.5 40tps(prefer_speed 时更快胜出)
        assert decision.selected_model == "ollama/llama3.2"
        assert decision.complexity == TaskComplexity.TRIVIAL
        assert decision.estimated_cost == 0.0  # 本地免费

    def test_route_paid_upgrade(self):
        """复杂任务升级到付费强模型。"""
        router = ModelRouter()
        decision = router.route("调试这个复杂的系统问题", token_count=15000, has_code=True)
        assert decision.complexity == TaskComplexity.COMPLEX
        # COMPLEX 要求 reasoning>=7,仅 gpt-4o / claude-3.5-sonnet 满足
        # gpt-4o 价格 2.5 < claude 3.0 → 选中 gpt-4o
        assert decision.selected_model == "gpt-4o"
        assert "claude-3.5-sonnet" in decision.alternatives

    def test_route_no_candidates(self):
        """无候选(token 超所有 context)→ 降级到最强模型。"""
        router = ModelRouter()
        decision = router.route("超长上下文", token_count=300000)  # 超 200000 max context
        # 无候选 → 最强模型(gpt-4o,reasoning=9)
        assert decision.selected_model == "gpt-4o"
        assert "降级" in decision.reason
        assert decision.alternatives == []

    def test_route_with_vision(self):
        """vision 需求过滤掉不支持 vision 的本地模型。"""
        router = ModelRouter()
        # TRIVIAL + has_vision:本地模型不支持 vision 被淘汰,
        # gpt-4o(2.5>0.5 价格上限)、claude(3.0>0.5)被淘汰,
        # 仅 gpt-4o-mini(0.15≤0.5,reasoning=6≥1,supports_vision=True)满足
        decision = router.route("识别图片", has_vision=True)
        assert decision.selected_model == "gpt-4o-mini"

    def test_route_with_tools(self):
        """tools 需求过滤掉不支持 tools 的模型。"""
        # 自定义 router:注册一个不支持 tools 的便宜快模型 + 一个支持 tools 的模型
        custom = ModelCapability(
            model_id="cheap-notools",
            name="Cheap NoTools",
            context_length=128000,
            reasoning_power=5,
            speed_tps=300,
            input_price=0.01,
            output_price=0.01,
            supports_tools=False,
            supports_vision=False,
        )
        capable = ModelCapability(
            model_id="capable-tools",
            name="Capable Tools",
            context_length=128000,
            reasoning_power=5,
            speed_tps=100,
            input_price=0.5,
            output_price=0.5,
            supports_tools=True,
            supports_vision=False,
        )
        router = ModelRouter(models=[custom, capable])
        # has_tools=True → cheap-notools 被淘汰,仅 capable-tools 候选
        decision = router.route("执行工具调用", has_tools=True)
        assert decision.selected_model == "capable-tools"

    def test_estimated_cost(self):
        """成本估算 = (token*input + token*0.5*output)/1e6。"""
        router = ModelRouter()
        # token=60000 → EXPERT,min_reasoning=9 → gpt-4o(input 2.5, output 10.0)
        decision = router.route("重构系统架构", token_count=60000)
        assert decision.selected_model == "gpt-4o"
        expected = (60000 * 2.5 + 60000 * 0.5 * 10.0) / 1_000_000
        assert decision.estimated_cost == pytest.approx(expected)
        assert decision.estimated_cost > 0


class TestModelRegistry:
    """模型注册与查询测试。"""

    def test_register_and_get_model(self):
        """注册新模型并可查询。"""
        router = ModelRouter(models=[])  # 空注册表
        new_model = ModelCapability(
            model_id="custom-1",
            name="Custom Model",
            context_length=64000,
            reasoning_power=7,
            speed_tps=100,
            input_price=1.0,
            output_price=2.0,
        )
        router.register_model(new_model)
        info = router.get_model_info("custom-1")
        assert info is not None
        assert info.name == "Custom Model"
        assert info.reasoning_power == 7
        # 不存在的模型返回 None
        assert router.get_model_info("nonexistent") is None

    def test_list_models(self):
        """列出所有已注册模型(默认 6 个)。"""
        router = ModelRouter()
        models = router.list_models()
        assert len(models) == 6
        model_ids = {m.model_id for m in models}
        assert "gpt-4o" in model_ids
        assert "ollama/llama3.2" in model_ids

    def test_module_singleton(self):
        """模块级单例可用且预加载默认模型。"""
        assert model_router is not None
        decision = model_router.route("重构架构")
        assert decision.complexity == TaskComplexity.EXPERT
        assert decision.selected_model == "gpt-4o"
