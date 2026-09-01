# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""智能模型路由器(2026-07-22 立,按任务复杂度自动选择最优模型)。

路由策略:
1. 任务复杂度评估(token 数 / 代码量 / 工具调用数 / 推理深度)
2. 模型能力矩阵(各模型 context_length / 推理能力 / 速度 / 成本)
3. 路由决策(复杂度高→强模型,复杂度低→快模型)
4. 成本优化(简单任务用便宜模型,复杂任务才用贵模型)
5. 降级策略(首选模型不可用时降级到备选)

生产数据源接入(P0 补实,2026-09-01):
- `ModelRouter.from_catalog()` 从实时模型目录构建路由实例:
  * 模型目录: data/default_models.json(可外部传入覆盖)
  * 分类标注: model_catalog.annotate_models()(打 category / model_tier / family)
  * 可用性过滤: model_availability.get_available_models()(只保留可用状态的 provider 模型)
  * 只保留对话类(chat / vision)+ model_tier=latest 的模型,避免路由到 legacy
- 降级策略: catalog 加载 / 分类 / 可用性过滤任一步失败,或过滤后为空,
  一律 logger.warning 并回退到 DEFAULT_MODELS 兜底,保证调用方永远拿到可用实例、绝不抛异常。
- `route_live()` 是基于当前注册模型(由 from_catalog 构建时即实时)的便捷路由入口。
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
        logger.info("model_router_selected", model=decision.selected_model)  # gpt-4o(复杂任务)
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
    
    def __init__(self, models: Optional[list[ModelCapability]] = None) -> None:
        self.models: dict[str, ModelCapability] = {}
        for m in (models or self.DEFAULT_MODELS):
            self.register_model(m)

    def register_model(self, model: ModelCapability) -> None:
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
        def sort_key(m: ModelCapability) -> tuple[int, int, float]:
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
    
    # ------------------------------------------------------------------ #
    # 生产数据源接入(from_catalog + 内部辅助)
    # ------------------------------------------------------------------ #

    @classmethod
    def from_catalog(
        cls,
        models: Optional[list[dict[str, Any]]] = None,
        *,
        now: Any = None,
    ) -> "ModelRouter":
        """从生产数据源构建路由器(实时模型目录 + 可用性过滤)。

        数据流:
            模型目录(default_models.json,可外部传入 dict 列表覆盖)
            → annotate_models() 打 category / model_tier / family 标注
            → model_availability.get_available_models() 过滤不可用模型
            → 只保留对话类(chat/vision)+ latest 代次
            → 映射为 ModelCapability 实例

        降级策略(绝不抛异常):
        - catalog 加载 / 分类 / 可用性过滤任一步失败 → logger.warning,跳过对应环节
        - 过滤后无可路由模型,或能力映射后为空 → 降级回 DEFAULT_MODELS
        - 兜底:整体 try/except 捕获未知异常 → 返回 cls()(DEFAULT_MODELS 兜底)

        Args:
            models: 可选,外部传入的模型 dict 列表(替代从 default_models.json 加载)。
                    dict 结构参考 data/default_models.json: id/name/provider/
                    context_length/input_price/caps{...},annotate_models() 会补 category/tier。
            now: 可选,分类时间基准(透传给 annotate_models(),测试注入用)。

        Returns:
            ModelRouter 实例,注册的模型为过滤后的实时可用对话模型。
        """
        try:
            if models is None:
                models = cls._load_catalog_file()
            if not models:
                logger.warning("[ModelRouter.from_catalog] 模型目录为空,降级到 DEFAULT_MODELS")
                return cls()

            # 1. 分类标注:给每个模型 dict 原地附加 category / model_tier / family
            try:
                from .model_catalog import annotate_models

                annotate_models(models, now=now)
            except Exception as e:
                # 分类失败不阻塞:依赖 JSON 预置的 model_tier(存在时)继续走过滤
                logger.warning("[ModelRouter.from_catalog] 模型分类失败,跳过分类过滤: %s", e)

            # 2. 可用性过滤:只保留 HEALTHY / DEGRADED / LOCAL / ZERO_COST / PENDING 等可用状态
            try:
                from .model_availability import model_availability

                models = model_availability.get_available_models(models)
            except Exception as e:
                logger.warning("[ModelRouter.from_catalog] 可用性过滤失败,跳过过滤: %s", e)

            # 3. 只保留对话类(chat/vision)+ latest 代次
            routable = [m for m in models if cls._is_routable(m)]
            if not routable:
                logger.warning("[ModelRouter.from_catalog] 无可路由模型(过滤后为空),降级到 DEFAULT_MODELS")
                return cls()

            # 4. 映射为 ModelCapability 实例(cost 等无数据字段用默认值)
            capabilities = [c for m in routable if (c := cls._to_capability(m)) is not None]
            if not capabilities:
                logger.warning("[ModelRouter.from_catalog] 能力映射后为空,降级到 DEFAULT_MODELS")
                return cls()

            logger.info("[ModelRouter.from_catalog] 实时模型路由构建成功: %d 个对话模型", len(capabilities))
            return cls(models=capabilities)
        except Exception as e:
            # 兜底:任何未知异常都降级回 DEFAULT_MODELS,保证调用方永远拿到可用实例
            logger.warning("[ModelRouter.from_catalog] 生产数据源接入失败,降级到 DEFAULT_MODELS: %s", e)
            return cls()

    @staticmethod
    def _load_catalog_file() -> list[dict[str, Any]]:
        """从 data/default_models.json 加载模型目录(与 /llm/models 同源)。

        文件不存在 / 解析失败 / 无有效条目时返回空列表(由 from_catalog 降级处理)。
        """
        import json
        from pathlib import Path

        catalog_path = Path(__file__).resolve().parent.parent / "data" / "default_models.json"
        try:
            if not catalog_path.exists():
                logger.warning("[ModelRouter.from_catalog] 模型目录不存在: %s", catalog_path)
                return []
            data = json.loads(catalog_path.read_text(encoding="utf-8"))
            raw_models = data.get("models", []) if isinstance(data, dict) else data
            if not isinstance(raw_models, list):
                return []
            return [m for m in raw_models if isinstance(m, dict) and m.get("id")]
        except Exception as e:
            logger.warning("[ModelRouter.from_catalog] 读取模型目录失败: %s", e)
            return []

    @staticmethod
    def _is_routable(m: dict[str, Any]) -> bool:
        """是否可路由:对话类用途(chat/vision)且 latest 代次。

        分类标注缺失时,类别默认 chat;代次取 dict 中的 model_tier(JSON 预置值),
        未标注的按 standard 处理(不进路由,避免把过时模型引入生产路由)。
        """
        category = str(m.get("category") or "chat")
        tier = str(m.get("model_tier") or "standard")
        return category in ("chat", "vision") and tier == "latest"

    @staticmethod
    def _to_capability(m: dict[str, Any]) -> Optional[ModelCapability]:
        """模型 dict → ModelCapability 实例。

        字段映射:
        - model_id/name: 直接取自 dict(id/name)
        - context_length: 优先 dict.context_length,降级 caps.max_context,兜底 4096
        - supports_tools / supports_vision: 取自 caps 声明,缺失时给宽松默认
          (tools 默认 True 允许工具任务,vision 默认 False,由 category=vision 兜底判定)
        - reasoning_power / speed_tps / output_price: 目录无此数据,用保守默认值,
          避免在路由打分中失真(cost 无数据置 0,本地优先排序不受影响)
        """
        try:
            mid = str(m.get("id") or "")
            if not mid:
                return None
            caps = m.get("caps") or {}
            context_length = int(m.get("context_length") or caps.get("max_context") or 4096)
            supports_vision = bool(caps.get("supports_vision", False)) or str(m.get("category")) == "vision"
            return ModelCapability(
                model_id=mid,
                name=str(m.get("name") or mid),
                context_length=context_length,
                reasoning_power=5,  # 目录无推理力数据,取中等默认
                speed_tps=60,       # 目录无速度数据,取保守默认
                input_price=float(m.get("input_price") or 0.0),
                output_price=0.0,   # 目录无输出价格数据
                supports_tools=bool(caps.get("supports_tools", True)),
                supports_vision=supports_vision,
            )
        except (TypeError, ValueError) as e:
            # 脏数据(字段类型异常)跳过该模型,不影响其余模型
            logger.warning("[ModelRouter.from_catalog] 模型能力映射失败(%s),跳过: %s", m.get("id"), e)
            return None

    def route_live(
        self,
        prompt: str,
        token_count: int = 0,
        has_tools: bool = False,
        has_code: bool = False,
        has_vision: bool = False,
        preferred_model: Optional[str] = None,
    ) -> RoutingDecision:
        """便捷路由入口:基于当前注册模型列表做路由决策。

        与 `route()` 行为完全一致 —— 路由本就基于 self.models 工作,
        由 `from_catalog()` 构建的实例注册的就是实时过滤后的模型,
        故 route_live 仅为语义化命名,便于调用方表达"走实时模型路由"的意图。
        """
        return self.route(
            prompt=prompt,
            token_count=token_count,
            has_tools=has_tools,
            has_code=has_code,
            has_vision=has_vision,
            preferred_model=preferred_model,
        )

# 模块级单例
model_router = ModelRouter()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
