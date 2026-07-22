"""智能模型路由器(2026-07-22 立,按任务复杂度自动选择最优模型)。

路由策略:
1. 任务复杂度评估(token 数 / 代码量 / 工具调用数 / 推理深度)
2. 模型能力矩阵(各模型 context_length / 推理能力 / 速度 / 成本)
3. 路由决策(复杂度高→强模型,复杂度低→快模型)
4. 成本优化(简单任务用便宜模型,复杂任务才用贵模型)
5. 降级策略(首选模型不可用时降级到备选)
"""

import logging
from typing import Any, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)

class TaskComplexity(Enum):
    """任务复杂度等级。"""
    TRIVIAL = "trivial"      # 简单问答 / 翻译 / 格式转换
    SIMPLE = "simple"        # 单文件修改 / 简单查询
    MODERATE = "moderate"    # 多文件修改 / 中等推理
    COMPLEX = "complex"      # 架构设计 / 复杂调试
    EXPERT = "expert"        # 跨系统重构 / 算法优化

@dataclass
class ModelCapability:
    """模型能力描述。"""
    model_id: str
    name: str
    context_length: int
    reasoning_power: int  # 1-10,推理能力(10 最强)
    speed_tps: int        # tokens/second(越高越快)
    input_price: float    # 美元/1M tokens
    output_price: float   # 美元/1M tokens
    supports_tools: bool = True
    supports_vision: bool = False
    
@dataclass
class RoutingDecision:
    """路由决策结果。"""
    selected_model: str
    complexity: TaskComplexity
    reason: str
    alternatives: list[str] = field(default_factory=list)
    estimated_cost: float = 0.0  # 美元

class ModelRouter:
    """智能模型路由器。
    
    用法:
        router = ModelRouter()
        router.register_model(ModelCapability(model_id="gpt-4o", ...))
        router.register_model(ModelCapability(model_id="gpt-4o-mini", ...))
        
        decision = router.route(
            prompt="重构这个模块",
            token_count=5000,
            has_tools=True,
            has_code=True,
        )
        print(decision.selected_model)  # gpt-4o(复杂任务)
    """
    
    # 默认模型库(可扩展)
    DEFAULT_MODELS: list[ModelCapability] = [
        ModelCapability("gpt-4o", "GPT-4o", 128000, 9, 80, 2.5, 10.0, True, True),
        ModelCapability("gpt-4o-mini", "GPT-4o mini", 128000, 6, 150, 0.15, 0.6, True, True),
        ModelCapability("claude-3.5-sonnet", "Claude 3.5 Sonnet", 200000, 9, 80, 3.0, 15.0, True, True),
        ModelCapability("claude-3.5-haiku", "Claude 3.5 Haiku", 200000, 5, 200, 0.25, 1.25, True, False),
        # 本地模型(免费)
        ModelCapability("ollama/llama3.2", "Llama 3.2 (Ollama 本地)", 128000, 5, 50, 0.0, 0.0, True, False),
        ModelCapability("ollama/qwen2.5:32b", "Qwen 2.5 32B (Ollama 本地)", 32768, 6, 40, 0.0, 0.0, True, False),
    ]
    
    # 复杂度 → 推理能力要求 + 速度偏好
    COMPLEXITY_REQUIREMENTS = {
        TaskComplexity.TRIVIAL: {"min_reasoning": 1, "prefer_speed": True, "max_price": 0.5},
        TaskComplexity.SIMPLE: {"min_reasoning": 3, "prefer_speed": True, "max_price": 1.0},
        TaskComplexity.MODERATE: {"min_reasoning": 5, "prefer_speed": False, "max_price": 5.0},
        TaskComplexity.COMPLEX: {"min_reasoning": 7, "prefer_speed": False, "max_price": 20.0},
        TaskComplexity.EXPERT: {"min_reasoning": 9, "prefer_speed": False, "max_price": 50.0},
    }
    
    def __init__(self, models: Optional[list[ModelCapability]] = None):
        self.models: dict[str, ModelCapability] = {}
        for m in (models or self.DEFAULT_MODELS):
            self.register_model(m)
    
    def register_model(self, model: ModelCapability):
        """注册模型。"""
        self.models[model.model_id] = model
    
    def assess_complexity(
        self,
        prompt: str,
        token_count: int = 0,
        has_tools: bool = False,
        has_code: bool = False,
        has_vision: bool = False,
    ) -> TaskComplexity:
        """评估任务复杂度。
        
        判定规则(从高到低,命中即返回):
        - EXPERT:token > 50000 或 含"重构/架构/优化算法"关键词
        - COMPLEX:token > 10000 或 含"调试/设计/分析"关键词 或 has_tools + has_code
        - MODERATE:token > 3000 或 含"修改/实现/开发"关键词 或 has_code
        - SIMPLE:token > 500 或 含"查询/翻译/转换"关键词
        - TRIVIAL:其他
        """
        prompt_lower = prompt.lower() if isinstance(prompt, str) else ""
        
        # 关键词检测
        expert_keywords = ["重构", "架构", "优化算法", "refactor", "architecture", "optimize algorithm"]
        complex_keywords = ["调试", "设计", "分析", "debug", "design", "analyze"]
        moderate_keywords = ["修改", "实现", "开发", "modify", "implement", "develop"]
        simple_keywords = ["查询", "翻译", "转换", "query", "translate", "convert"]
        
        if token_count > 50000 or any(kw in prompt_lower for kw in expert_keywords):
            return TaskComplexity.EXPERT
        if token_count > 10000 or any(kw in prompt_lower for kw in complex_keywords) or (has_tools and has_code):
            return TaskComplexity.COMPLEX
        if token_count > 3000 or any(kw in prompt_lower for kw in moderate_keywords) or has_code:
            return TaskComplexity.MODERATE
        if token_count > 500 or any(kw in prompt_lower for kw in simple_keywords):
            return TaskComplexity.SIMPLE
        return TaskComplexity.TRIVIAL
    
    def route(
        self,
        prompt: str,
        token_count: int = 0,
        has_tools: bool = False,
        has_code: bool = False,
        has_vision: bool = False,
        preferred_model: Optional[str] = None,
    ) -> RoutingDecision:
        """路由到最优模型。
        
        - 如果指定 preferred_model 且可用,直接返回
        - 否则按复杂度评估 + 模型能力矩阵选择
        - 优先本地模型(免费),不满足要求时升级到付费模型
        """
        # 指定模型优先
        if preferred_model and preferred_model in self.models:
            return RoutingDecision(
                selected_model=preferred_model,
                complexity=TaskComplexity.TRIVIAL,
                reason=f"用户指定模型 {preferred_model}",
                alternatives=[],
            )
        
        complexity = self.assess_complexity(prompt, token_count, has_tools, has_code, has_vision)
        req = self.COMPLEXITY_REQUIREMENTS[complexity]
        
        # 筛选满足要求的模型
        candidates = []
        for m in self.models.values():
            # 推理能力达标
            if m.reasoning_power < req["min_reasoning"]:
                continue
            # 支持 tools(如果需要)
            if has_tools and not m.supports_tools:
                continue
            # 支持 vision(如果需要)
            if has_vision and not m.supports_vision:
                continue
            # 价格上限
            if m.input_price > req["max_price"]:
                continue
            # context_length 足够
            if token_count > 0 and m.context_length < token_count:
                continue
            candidates.append(m)
        
        if not candidates:
            # 无候选,用最强模型
            best = max(self.models.values(), key=lambda m: m.reasoning_power)
            return RoutingDecision(
                selected_model=best.model_id,
                complexity=complexity,
                reason=f"无满足要求的模型,降级到最强模型 {best.model_id}",
                alternatives=[],
            )
        
        # 排序:优先本地(免费)→ 速度(如果 prefer_speed)→ 价格 → 推理能力
        def sort_key(m: ModelCapability):
            cost_score = 0 if m.input_price == 0 else 1  # 本地优先
            speed_score = -m.speed_tps if req["prefer_speed"] else 0  # 速度优先时取负(越大越前)
            price_score = m.input_price
            return (cost_score, speed_score, price_score)
        
        candidates.sort(key=sort_key)
        
        selected = candidates[0]
        alternatives = [m.model_id for m in candidates[1:4]]  # 最多 3 个备选
        
        # 估算成本
        est_cost = (token_count * selected.input_price + token_count * 0.5 * selected.output_price) / 1_000_000
        
        return RoutingDecision(
            selected_model=selected.model_id,
            complexity=complexity,
            reason=f"复杂度={complexity.value},选择 {selected.name}(推理={selected.reasoning_power},速度={selected.speed_tps}tps,价格=${selected.input_price}/1M)",
            alternatives=alternatives,
            estimated_cost=round(est_cost, 6),
        )
    
    def get_model_info(self, model_id: str) -> Optional[ModelCapability]:
        """获取模型信息。"""
        return self.models.get(model_id)
    
    def list_models(self) -> list[ModelCapability]:
        """列出所有已注册模型。"""
        return list(self.models.values())

# 模块级单例
model_router = ModelRouter()
