# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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


class TestCatalogCapabilityMapping:
    """D23(2026-09-19):_to_capability 消费 capabilities 事实源(auto 路由按能力匹配)。

    事实源 = annotate_models 派生 + 显式预设覆盖,与 /llm/models 前端选择器同源。
    """

    @staticmethod
    def _cap(m: dict) -> ModelCapability:
        cap = ModelRouter._to_capability(m)
        assert cap is not None
        return cap

    def test_capabilities_fact_source_wins_over_caps_heuristics(self):
        """capabilities 显式布尔优先于 caps.supports_* 启发式。"""
        cap = self._cap({
            "id": "m1",
            "category": "vision",
            "caps": {"supports_vision": True, "supports_tools": True},
            "capabilities": {"vision": False, "tools": False},
        })
        assert cap.supports_vision is False
        assert cap.supports_tools is False

    def test_capabilities_partial_only_overrides_present_keys(self):
        """capabilities 只覆盖给出的键,未给出的键回退 caps/category 启发式。"""
        cap = self._cap({
            "id": "m2",
            "category": "chat",
            "caps": {"supports_vision": True},
            "capabilities": {"tools": False},
        })
        assert cap.supports_vision is True  # 未覆盖 → caps 启发式
        assert cap.supports_tools is False  # 覆盖生效

    def test_no_capabilities_falls_back_to_caps_heuristics(self):
        """无 capabilities(annotate 未跑/旧缓存)时行为与旧逻辑一致。"""
        cap = self._cap({
            "id": "m3",
            "category": "vision",
            "caps": {"supports_vision": False},
        })
        assert cap.supports_vision is True  # category=vision 兜底
        assert cap.supports_tools is True  # 默认 True

    def test_non_bool_capabilities_ignored(self):
        """capabilities 脏值(非布尔)不采纳,回退启发式,不抛异常。"""
        cap = self._cap({
            "id": "m4",
            "category": "chat",
            "caps": {"supports_tools": False},
            "capabilities": {"tools": "yes", "vision": 1},
        })
        assert cap.supports_tools is False
        assert cap.supports_vision is False

    def test_from_catalog_end_to_end_consumes_derived_capabilities(self, monkeypatch):
        """端到端:annotate_models 派生/预设 capabilities → from_catalog 注册即生效。

        可用性过滤依赖 provider 健康注册表(外部 I/O 态),单测以恒等替换隔离,
        只验证 标注→可路由→能力映射 链路。
        """
        from app.services.model_availability import model_availability
        from app.services.model_catalog import annotate_models

        monkeypatch.setattr(
            model_availability,
            "get_available_models",
            lambda models: list(models),
        )

        models = [
            {"id": "gpt-5.6", "name": "GPT-5.6", "provider": "openai", "context_length": 128000},
            {
                "id": "gpt-4-vision-preset",
                "name": "GPT-4V",
                "provider": "openai",
                "model_tier": "latest",  # 预设档位,保证可路由
                "caps": {"supports_vision": True},
                "capabilities": {"vision": False},  # 显式预设压过 caps 声明
            },
        ]
        annotate_models(models)
        router = ModelRouter.from_catalog(models)
        cap = router.get_model_info("gpt-4-vision-preset")
        assert cap is not None
        assert cap.supports_vision is False
        assert router.get_model_info("gpt-5.6") is not None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


class TestBudgetDegradation:
    """D16 ③ 预算降级:超支必须换档且**如实标记**,绝不静默当正常结果。

    两个坑都在这份夹具里,写清楚免得后人重踩:
    1) 模型集显式注入,不用 DEFAULT_MODELS —— 定价表一改,断言不该跟着变运气。
    2) 必须落在**多候选**档位上:`COMPLEXITY_REQUIREMENTS` 里 trivial/simple/moderate/complex
       的 `max_price` 是 0.5/1.0/5.0/20.0,价格不同的模型会在**预算之前**就被价格上限筛掉,
       于是"备选裁剪"根本测不到。`expert` 是 min_reasoning=9 / max_price=50,
       配上 10M 的 context_length 才留得下 1M token 的三个候选。
       (第一版用 1M token + 128k context,整批落进"无候选"分支:看着全绿,测的不是预算。)
    """

    TOK = 1_000_000  # est = input + 0.5*output ⇒ cheap=2.0, mid=6.0, rich=18.0

    @staticmethod
    def _router() -> ModelRouter:
        # 推理/速度/能力全同 ⇒ 候选排序只由价格决定(cheap < mid < rich)
        return ModelRouter([
            ModelCapability("m_cheap", "Cheap", 10_000_000, 9, 50, 1.0, 2.0, True, True),
            ModelCapability("m_mid", "Mid", 10_000_000, 9, 50, 3.0, 6.0, True, True),
            ModelCapability("m_rich", "Rich", 10_000_000, 9, 50, 9.0, 18.0, True, True),
        ])

    def test_candidate_path_actually_taken(self):
        """前置自检:后面每条断言的意义都取决于"真走在有候选的分支上"。"""
        router = self._router()
        d = router.route("你好", token_count=self.TOK)
        assert "无满足要求的模型" not in d.reason
        assert d.selected_model == "m_cheap"
        assert d.estimated_cost == 2.0
        assert d.alternatives == ["m_mid", "m_rich"]

    def test_budget_none_equals_legacy_call(self):
        """回归守卫:显式传 None 与不传该参数必须逐字段等值(新维度不得改旧行为)。"""
        router = self._router()
        old = router.route("你好", token_count=self.TOK)
        new = router.route("你好", token_count=self.TOK, budget_usd=None)
        assert old == new
        assert new.budget_exceeded is False and new.budget_usd is None

    def test_big_budget_keeps_ranking(self):
        """预算宽裕 ⇒ 选择与备选必须与无预算一致:预算只往下截,不重排。"""
        router = self._router()
        plain = router.route("你好", token_count=self.TOK)
        funded = router.route("你好", token_count=self.TOK, budget_usd=999.0)
        assert (funded.selected_model, funded.alternatives) == (
            plain.selected_model,
            plain.alternatives,
        )
        assert funded.budget_exceeded is False

    def test_budget_boundary_inclusive(self):
        """预算恰好等于成本 → 算付得起(取 <=),不标超支。"""
        router = self._router()
        d = router.route("你好", token_count=self.TOK, budget_usd=2.0)
        assert d.selected_model == "m_cheap" and d.budget_exceeded is False

    def test_unaffordable_model_excluded_from_alternatives(self):
        """备选也必须受预算约束 —— 递一个"点了就超支"的备选等于没降级。"""
        router = self._router()
        d = router.route("你好", token_count=self.TOK, budget_usd=7.0)
        assert d.selected_model == "m_cheap"
        assert d.budget_exceeded is False
        assert d.alternatives == ["m_mid"]  # rich(18.0) 超预算,不得出现

    def test_all_exceed_lands_cheapest_and_flags(self):
        """全超预算 → 落最便宜一档,置 exceeded,且 reason 里必须看得见预算。"""
        router = self._router()
        d = router.route("你好", token_count=self.TOK, budget_usd=0.5)
        assert d.selected_model == "m_cheap"
        assert d.budget_exceeded is True and d.budget_usd == 0.5
        assert "已超" in d.reason

    def test_no_candidate_branch_reports_budget_too(self):
        """无候选分支(上下文不够)同样不许静默:标志位与 reason 必须同形。"""
        small = ModelRouter([
            ModelCapability("m_only", "Only", 1000, 9, 50, 1.0, 2.0, True, True),
        ])
        d = small.route("你好", token_count=self.TOK, budget_usd=0.0001)
        assert "无满足要求的模型" in d.reason
        assert d.budget_exceeded is True
        assert "预算" in d.reason and "已超" in d.reason

    def test_pinned_model_not_swapped_but_flagged(self):
        """用户点名模型 = 显式意图:超预算也不换模型,只如实标超支。"""
        router = self._router()
        d = router.route(
            "你好", token_count=self.TOK, preferred_model="m_rich", budget_usd=1.0
        )
        assert d.selected_model == "m_rich"
        assert d.estimated_cost == 18.0
        assert d.budget_exceeded is True

    def test_pinned_model_within_budget_not_flagged(self):
        router = self._router()
        d = router.route(
            "你好", token_count=self.TOK, preferred_model="m_cheap", budget_usd=5.0
        )
        assert d.selected_model == "m_cheap" and d.budget_exceeded is False
