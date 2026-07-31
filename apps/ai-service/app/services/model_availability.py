"""模型可用性服务(2026-07-31 立,用户规则:只显示可完美接通调用的模型)。

职责:
1. 启动时 + 每 5 分钟后台 ping 所有已配置 key 的 provider(调 /v1/models 端点)
2. 缓存 provider 健康状态:HEALTHY / DEGRADED / DOWN / NOT_CONFIGURED / LOCAL / ZERO_COST
3. 提供 is_model_available() + get_available_models() 过滤不可用模型

判定模型可显示的规则(任一满足即显示):
- provider 是 zero_cost(pollinations/llm7/aihorde/opencode_zen):无需 key
- provider 是 LOCAL(ollama/lmstudio/llamacpp/vllm):本地 LLM
- provider 已配置 key(.env / LLM_PROVIDERS JSON)+ 健康检查非 DOWN
- DB 来源模型(ai_model_config_models 表):用户主动配置,直接显示(由调用方决定)

过滤掉的模型:
- 未配置 key 的 provider 模型(如 openai/anthropic/groq 等 .env 未配 key)
- 健康检查 DOWN 的 provider 模型(401/403/超时/网络错误)
- 延迟过高(> 30s)的 provider 模型

设计要点:
- ping 是 provider 维度(每个 provider 取一个代表 endpoint 测试),不是模型维度
- ping 不消耗 token(调 /v1/models 列表端点,不是 chat/completions)
- 缓存 5 分钟,避免 /llm/models 端点每次请求都触发 ping
- 启动时后台跑首次 ping(不阻塞 FastAPI 启动),首次请求可能命中 PENDING 状态
  → PENDING 视为可用(给 provider 一个宽松期,等首次 ping 完成再过滤)
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional

import httpx

from ..core.config import settings
from .free_provider_registry import ProviderCategory, ProviderStatus, free_provider_registry

logger = logging.getLogger(__name__)


# ============================================================================
# 常量配置
# ============================================================================

# 延迟阈值(ms)
LATENCY_DEGRADED_MS = 10_000  # 10s 以上标记 DEGRADED(仍显示)
LATENCY_DOWN_MS = 30_000      # 30s 以上标记 DOWN(不显示)

# ping 超时(秒)
PING_TIMEOUT_S = 8.0

# 缓存刷新间隔(秒)— 5 分钟刷新一次全量 provider 健康状态
REFRESH_INTERVAL_S = 300

# 并发 ping 限流(避免一次启动几十个并发请求)
PING_CONCURRENCY = 10

# zero_cost provider 集合(无需 key 即可调用,与 free_provider_registry._ZERO_COST_CODES 对齐)
_ZERO_COST_CODES: set[str] = {"pollinations", "llm7", "aihorde", "opencode_zen"}


# ============================================================================
# 模型 ID 前缀 → provider_code 映射
# ============================================================================
# 顺序敏感:长前缀优先匹配(避免 "s" 误匹配 "stepfun/")
# 与 llm_gateway._PREFIX_TO_PROVIDER_CODE 字典对齐,但本表用于"显示过滤"维度
_MODEL_PREFIX_TO_PROVIDER: list[tuple[str, str]] = [
    # === 项目主力(LLM_PROVIDERS JSON 已配置)===
    ("stepfun/", "stepfun"),
    ("agnes/", "agnes"),
    # === Cloudflare Workers AI(@cf/ 前缀)===
    ("@cf/", "cloudflare_workers_ai"),
    ("cloudflare/", "cloudflare_workers_ai"),
    # === NVIDIA NIM ===
    ("nvidia/", "nvidia_nim"),
    # === GitHub Models ===
    ("github/", "github_models"),
    # === OpenCode Zen(无需 key)===
    ("opencode/", "opencode_zen"),
    # === Scaleway ===
    ("scaleway/", "scaleway"),
    # === Alibaba Intl ===
    ("alibaba-intl/", "alibaba_intl"),
    # === 免费 zero_cost provider(无需 key)===
    ("pollinations/", "pollinations"),
    ("llm7/", "llm7"),
    ("aihorde/", "aihorde"),
    # === Vercel AI Gateway ===
    ("vercel/", "vercel_ai_gateway"),
    # === Qoder(需要 key)===
    ("if/", "qoder"),
    # === OVH / Requesty / Navy ===
    ("ovhcloud/", "ovhcloud"),
    ("requesty/", "requesty"),
    ("navy/", "navy"),
    # === OpenRouter / Groq / Gemini 前缀 ===
    ("openrouter/", "openrouter"),
    ("groq/", "groq"),
    ("gemini/", "google"),
    # === Anthropic ===
    ("anthropic/", "anthropic"),
    # === 本地 LLM(无需 key)===
    ("ollama/", "ollama"),
    ("lmstudio/", "lmstudio"),
    ("llamacpp/", "llamacpp"),
    ("vllm/", "vllm"),
    ("qwen-local/", "qwen_local"),
    # === 云平台 ===
    ("azure/", "azure"),
    ("bedrock/", "bedrock"),
    ("vertex/", "vertexai"),
    # === HuggingFace / Replicate ===
    ("huggingface/", "huggingface"),
    ("replicate/", "replicate"),
    # === Cerebras / SambaNova ===
    ("cerebras/", "cerebras"),
    ("sambanova/", "sambanova"),
    # === 国内聚合平台 ===
    ("siliconcloud/", "siliconcloud"),
    ("modelscope/", "modelscope"),
    ("ppio/", "ppio"),
    ("volcengine/", "volcengine"),
    ("bailian/", "bailian"),
    # === 国内厂商(无前缀,按模型名前缀匹配)===
    ("qwen", "qwen"),
    ("qwen-", "qwen"),
    ("doubao-", "doubao"),
    ("hunyuan-", "hunyuan"),
    ("glm-", "zhipu"),
    ("ernie-", "wenxin"),
    ("abab", "minimax"),
    ("minimax-", "minimax"),
    ("baichuan-", "baichuan"),
    ("spark-", "spark"),
    ("yi-", "yi"),
    ("internlm", "internlm"),
    ("sensenova-", "sensenova"),
    ("skywork-", "skywork"),
    # === 推理平台扩展 ===
    ("novita/", "novita"),
    ("lambda/", "lambda"),
    ("baseten/", "baseten"),
    ("crusoe/", "crusoe"),
    ("targon/", "targon"),
    ("centml/", "centml"),
    ("nebius/", "nebius"),
    ("upstage/", "upstage"),
    ("leptonai/", "leptonai"),
    ("hyperbolic/", "hyperbolic"),
    ("featherless/", "featherless"),
    ("parasail/", "parasail"),
    ("openwebui/", "openwebui"),
    ("friendli/", "friendli"),
    ("anyscale/", "anyscale"),
    ("infermatic/", "infermatic"),
    ("replit/", "replit"),
    ("deepinfra/", "deepinfra"),
    # === 国际原厂(无前缀,按模型名前缀匹配)===
    ("gpt-", "openai"),
    ("o1-", "openai"),
    ("o3", "openai"),
    ("o4-", "openai"),
    ("claude-", "anthropic"),
    ("gemini-", "google"),
    ("gemma-", "gemma"),
    ("llama-", "meta"),
    ("grok-", "xai"),
    ("deepseek-", "deepseek"),
    ("mistral-", "mistral"),
    ("codestral-", "mistral"),
    ("pixtral-", "mistral"),
    ("command-", "cohere"),
    ("nemotron-", "nvidia"),
    ("phi-", "microsoft"),
    ("phi3", "microsoft"),
    ("sonar-", "perplexity"),
    ("amazon-nova-", "aws"),
    ("jamba-", "ai21"),
    ("stablelm-", "stability"),
    ("inflection-", "inflection"),
    ("watsonx/", "ibm"),
    ("nous-", "nous"),
    ("luminous-", "alephalpha"),
    ("snowflake-", "snowflake"),
    ("baai/", "baai"),
    ("tii/", "tii"),
    ("liquid/", "liquid"),
    ("ai2/", "ai2"),
    # === 2026-07 新模型(无前缀)===
    ("ornith-", "ornith"),
    ("codebrain-", "codebrain"),
    ("mai-", "mai"),
    ("kimi-", "moonshot"),
    ("moonshot-", "moonshot"),
]


def _infer_provider_code(model_id: str) -> str:
    """从模型 ID 推断 provider_code(用前缀字典匹配)。

    匹配规则:长前缀优先(列表顺序即优先级),返回首个匹配项。
    未知 provider 返回空字符串(视为不可显示)。
    """
    m = model_id.lower()
    for prefix, code in _MODEL_PREFIX_TO_PROVIDER:
        if m.startswith(prefix):
            return code
    return ""


# ============================================================================
# 健康状态枚举与数据类
# ============================================================================


class ProviderHealthStatus(str, Enum):
    """provider 健康状态。"""

    HEALTHY = "healthy"                    # ping 通过 + 延迟可接受
    DEGRADED = "degraded"                  # ping 通过但延迟高,或 429 限流(仍显示)
    DOWN = "down"                          # ping 失败(401/403/超时/网络错误)— 不显示
    NOT_CONFIGURED = "not_configured"      # 未配置 key — 不显示
    LOCAL = "local"                        # 本地 LLM(无需 ping)— 显示
    ZERO_COST = "zero_cost"                # 无需 key 的免费 provider — 显示
    PENDING = "pending"                    # 尚未检测(启动初期)— 宽松显示


@dataclass
class ProviderHealth:
    """单个 provider 的健康状态。"""

    status: ProviderHealthStatus = ProviderHealthStatus.PENDING
    latency_ms: int = 0
    last_check: float = 0.0  # unix timestamp
    error: str = ""


# ============================================================================
# provider_code → LLM_PROVIDERS JSON name 映射
# ============================================================================

_PROVIDER_CODE_TO_LLM_PROVIDERS_NAME: dict[str, str] = {
    "cloudflare_workers_ai": "cloudflare",
    "nvidia_nim": "nvidia",
    "github_models": "github",
    "vercel_ai_gateway": "vercel",
    "opencode_zen": "opencode",
}


def _to_llm_providers_name(provider_code: str) -> str:
    """provider_code → LLM_PROVIDERS JSON 里的 name(用于读 cfg.api_key)。

    大多数 provider_code 与 LLM_PROVIDERS name 一致(如 stepfun/agnes/openai)。
    少数需要映射(如 cloudflare_workers_ai → cloudflare)。
    """
    return _PROVIDER_CODE_TO_LLM_PROVIDERS_NAME.get(provider_code, provider_code)


# ============================================================================
# 服务单例
# ============================================================================


class ModelAvailabilityService:
    """模型可用性服务单例。

    生命周期:
    - main.py lifespan 启动时调用 initialize():后台跑首次 ping + 启动定时刷新
    - /llm/models 端点调用 get_available_models() 过滤
    - main.py lifespan 关闭时调用 shutdown():取消定时任务

    线程安全:用 asyncio.Lock 保护 _health 字典写操作。
    """

    def __init__(self) -> None:
        self._health: dict[str, ProviderHealth] = {}
        self._lock = asyncio.Lock()
        self._refresh_task: Optional[asyncio.Task[None]] = None
        self._initialized = False

    async def initialize(self) -> None:
        """启动时调用:后台跑首次 ping + 启动定时刷新任务。

        幂等:多次调用只初始化一次。
        不阻塞:首次 ping 用 asyncio.create_task 异步执行,FastAPI 启动立即返回。
        """
        if self._initialized:
            return
        self._initialized = True
        # 后台跑首次 ping(不阻塞启动,首次 /llm/models 请求可能命中 PENDING 状态)
        asyncio.create_task(self._refresh_all_providers())
        # 启动定时刷新(每 5 分钟)
        self._refresh_task = asyncio.create_task(self._refresh_loop())
        logger.info("ModelAvailabilityService initialized (refresh interval: %ds)", REFRESH_INTERVAL_S)

    async def shutdown(self) -> None:
        """关闭时调用:取消定时刷新任务。"""
        if self._refresh_task is not None and not self._refresh_task.done():
            self._refresh_task.cancel()
            try:
                await self._refresh_task
            except asyncio.CancelledError:
                pass
            self._refresh_task = None
        self._initialized = False

    async def _refresh_loop(self) -> None:
        """定时刷新循环(每 REFRESH_INTERVAL_S 秒一次)。"""
        while True:
            try:
                await asyncio.sleep(REFRESH_INTERVAL_S)
                await self._refresh_all_providers()
            except asyncio.CancelledError:
                logger.info("ModelAvailabilityService refresh loop cancelled")
                raise
            except Exception as e:
                logger.warning("ModelAvailabilityService refresh loop error: %s", e)
                # 出错后等 60s 再试,避免高频失败循环
                await asyncio.sleep(60)

    async def _refresh_all_providers(self) -> None:
        """对所有已配置 key 的 provider 跑一次 ping。

        步骤:
        1. 遍历 free_provider_registry,找出 CONFIGURED 状态的 provider
        2. 并发 ping(限制并发 PING_CONCURRENCY)
        3. 更新 _health 字典
        """
        # 收集需要 ping 的 provider 列表
        providers_to_ping: list[tuple[str, str, str]] = []  # [(code, api_key, api_base)]
        for p in free_provider_registry.list_all():
            # 本地 LLM 不 ping,直接标记 LOCAL
            if p.category == ProviderCategory.LOCAL:
                async with self._lock:
                    self._health[p.provider_code] = ProviderHealth(
                        status=ProviderHealthStatus.LOCAL,
                        last_check=time.time(),
                    )
                continue
            # zero_cost provider 不 ping,直接标记 ZERO_COST
            if p.provider_code in _ZERO_COST_CODES:
                async with self._lock:
                    self._health[p.provider_code] = ProviderHealth(
                        status=ProviderHealthStatus.ZERO_COST,
                        last_check=time.time(),
                    )
                continue
            # 已配置 key 的 provider:加入 ping 列表
            # has_key 判断必须与 is_model_available() 保持一致:
            # 优先 LLM_PROVIDERS JSON(settings.get_provider_config),降级 free_provider_registry(查 os.environ)
            # 否则会出现"JSON 配了 key 但 os.environ 没 → is_model_available 判可用但没被 ping → health=None → 跳过 DOWN 检查 → 错误显示"
            cfg_name = _to_llm_providers_name(p.provider_code)
            cfg = settings.get_provider_config(cfg_name)
            api_key = cfg.api_key
            has_key = bool(api_key) or free_provider_registry.is_key_configured(p.provider_code) == ProviderStatus.CONFIGURED
            if has_key:
                api_base = cfg.api_base or p.default_base_url
                if api_key and api_base:
                    providers_to_ping.append((p.provider_code, api_key, api_base))
                elif api_key and not api_base:
                    # 有 key 但无 base_url,标记 DOWN(无法 ping)
                    async with self._lock:
                        self._health[p.provider_code] = ProviderHealth(
                            status=ProviderHealthStatus.DOWN,
                            last_check=time.time(),
                            error="no api_base configured",
                        )
                else:
                    # has_key=True 但 api_key 为空(仅 free_provider_registry 判定 CONFIGURED 但 JSON 无 key)
                    # 标记 NOT_CONFIGURED,避免后续 is_model_available 因 health=None 错误显示
                    async with self._lock:
                        self._health[p.provider_code] = ProviderHealth(
                            status=ProviderHealthStatus.NOT_CONFIGURED,
                            last_check=time.time(),
                            error="key configured in env but not in LLM_PROVIDERS JSON",
                        )

        # 并发 ping
        semaphore = asyncio.Semaphore(PING_CONCURRENCY)

        async def _ping_one(code: str, key: str, base: str) -> None:
            async with semaphore:
                health = await self._ping_provider(code, key, base)
                async with self._lock:
                    self._health[code] = health

        if providers_to_ping:
            await asyncio.gather(
                *[_ping_one(c, k, b) for c, k, b in providers_to_ping],
                return_exceptions=True,
            )

        # 统计日志
        healthy = sum(1 for h in self._health.values() if h.status == ProviderHealthStatus.HEALTHY)
        degraded = sum(1 for h in self._health.values() if h.status == ProviderHealthStatus.DEGRADED)
        down = sum(1 for h in self._health.values() if h.status == ProviderHealthStatus.DOWN)
        local = sum(1 for h in self._health.values() if h.status == ProviderHealthStatus.LOCAL)
        zero_cost = sum(1 for h in self._health.values() if h.status == ProviderHealthStatus.ZERO_COST)
        logger.info(
            "ModelAvailabilityService refreshed: %d providers pinged, "
            "healthy=%d degraded=%d down=%d local=%d zero_cost=%d",
            len(providers_to_ping), healthy, degraded, down, local, zero_cost,
        )

    async def _ping_provider(self, code: str, api_key: str, api_base: str) -> ProviderHealth:
        """ping 单个 provider:调 /v1/models 或 /models 端点。

        判定规则:
        - 200 + 延迟 ≤ 10s  → HEALTHY
        - 200 + 延迟 10-30s  → DEGRADED(仍显示)
        - 200 + 延迟 > 30s  → DOWN(不显示)
        - 401/403            → DOWN(key 失效,不显示)
        - 429                → DEGRADED(限流,仍显示)
        - 超时/网络错误       → DOWN(不显示)

        Args:
            code: provider_code(用于日志)
            api_key: provider 的 API key
            api_base: provider 的 base URL(如 https://api.stepfun.com/step_plan/v1)

        Returns:
            ProviderHealth 健康状态对象
        """
        # 构造 /models URL(根据 base_url 是否已含 /v1 自动适配)
        url = api_base.rstrip("/")
        if url.endswith("/v1"):
            url = f"{url}/models"
        else:
            url = f"{url}/v1/models"

        start = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=PING_TIMEOUT_S) as client:
                resp = await client.get(url, headers={"Authorization": f"Bearer {api_key}"})
            latency = int((time.monotonic() - start) * 1000)

            if resp.status_code == 200:
                if latency > LATENCY_DOWN_MS:
                    return ProviderHealth(
                        status=ProviderHealthStatus.DOWN,
                        latency_ms=latency,
                        last_check=time.time(),
                        error=f"latency {latency}ms > {LATENCY_DOWN_MS}ms threshold",
                    )
                if latency > LATENCY_DEGRADED_MS:
                    return ProviderHealth(
                        status=ProviderHealthStatus.DEGRADED,
                        latency_ms=latency,
                        last_check=time.time(),
                    )
                return ProviderHealth(
                    status=ProviderHealthStatus.HEALTHY,
                    latency_ms=latency,
                    last_check=time.time(),
                )

            if resp.status_code in (401, 403):
                return ProviderHealth(
                    status=ProviderHealthStatus.DOWN,
                    latency_ms=latency,
                    last_check=time.time(),
                    error=f"HTTP {resp.status_code}: key 失效或无权访问",
                )
            if resp.status_code == 429:
                return ProviderHealth(
                    status=ProviderHealthStatus.DEGRADED,
                    latency_ms=latency,
                    last_check=time.time(),
                    error="HTTP 429: 限流",
                )
            return ProviderHealth(
                status=ProviderHealthStatus.DEGRADED,
                latency_ms=latency,
                last_check=time.time(),
                error=f"HTTP {resp.status_code}",
            )
        except httpx.TimeoutException:
            return ProviderHealth(
                status=ProviderHealthStatus.DOWN,
                latency_ms=int((time.monotonic() - start) * 1000),
                last_check=time.time(),
                error=f"timeout after {PING_TIMEOUT_S}s",
            )
        except Exception as e:
            return ProviderHealth(
                status=ProviderHealthStatus.DOWN,
                last_check=time.time(),
                error=f"{type(e).__name__}: {str(e)[:200]}",
            )

    def get_provider_health(self, provider_code: str) -> ProviderHealth:
        """获取 provider 健康状态(从缓存读,不触发 ping)。

        未命中缓存返回 PENDING 状态(首次启动时可能出现)。
        """
        return self._health.get(provider_code, ProviderHealth(status=ProviderHealthStatus.PENDING))

    def is_model_available(self, model_id: str) -> bool:
        """判断单个模型是否可显示(用于 /llm/models 过滤)。

        判定规则(按顺序):
        1. 推断 provider_code,未知 → 不显示
        2. zero_cost provider(pollinations/llm7/aihorde/opencode_zen)→ 显示
        3. LOCAL provider(ollama/lmstudio/llamacpp/vllm)→ 显示
        4. 已配置 key + 健康检查非 DOWN → 显示
        5. 其他情况(未配置 key / DOWN)→ 不显示

        特殊处理:
        - PENDING(尚未检测):视为可用(给 provider 一个宽松期,等首次 ping 完成)
        - DEGRADED(延迟高/限流):仍显示(用户可选用,只是慢)
        - DOWN(401/403/超时):不显示(确实接不通)
        - NOT_CONFIGURED:不显示(没配 key 用不了)

        Args:
            model_id: 模型 ID(如 "stepfun/step-router-v1" / "gpt-4o" / "@cf/zai-org/glm-4.7-flash")

        Returns:
            True 显示该模型;False 过滤掉
        """
        code = _infer_provider_code(model_id)
        if not code:
            return False  # 未知 provider,不显示

        # zero_cost provider(无需 key)
        if code in _ZERO_COST_CODES:
            return True

        # LOCAL provider(本地 LLM,无需 key)
        provider = free_provider_registry.get_by_code(code)
        if provider and provider.category == ProviderCategory.LOCAL:
            return True

        # 已配置 key 检查:优先 LLM_PROVIDERS JSON,降级 free_provider_registry(查 os.environ)
        cfg_name = _to_llm_providers_name(code)
        cfg = settings.get_provider_config(cfg_name)
        has_key = bool(cfg.api_key) or free_provider_registry.is_key_configured(code) == ProviderStatus.CONFIGURED
        if not has_key:
            return False  # 未配置 key,不显示

        # 健康检查:DOWN / NOT_CONFIGURED 不显示,其他(HEALTHY/DEGRADED/PENDING/None)显示
        # - DOWN:ping 失败(401/403/超时/网络错误),确实接不通
        # - NOT_CONFIGURED:has_key=True 但 key 实际为空(env 配了但 JSON 无),用不了
        # - PENDING / None:尚未检测(启动初期),宽松显示(等首次 ping 完成)
        # - DEGRADED:延迟高/限流,仍可用(用户可选用,只是慢)
        health = self._health.get(code)
        if health and health.status in (ProviderHealthStatus.DOWN, ProviderHealthStatus.NOT_CONFIGURED):
            return False
        return True

    def get_available_models(self, default_models: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """过滤默认模型清单,只返回可用模型。

        Args:
            default_models: 来自 default_models.json + DB 的完整模型清单

        Returns:
            过滤后的模型清单(只含可用模型,顺序与输入一致)
        """
        return [m for m in default_models if self.is_model_available(m.get("id", ""))]

    def get_health_summary(self) -> dict[str, Any]:
        """获取所有 provider 健康状态摘要(供 Dashboard 调试)。"""
        return {
            "providers": [
                {
                    "provider_code": code,
                    "status": h.status.value,
                    "latency_ms": h.latency_ms,
                    "last_check": h.last_check,
                    "error": h.error,
                }
                for code, h in self._health.items()
            ],
            "summary": {
                "total": len(self._health),
                "healthy": sum(1 for h in self._health.values() if h.status == ProviderHealthStatus.HEALTHY),
                "degraded": sum(1 for h in self._health.values() if h.status == ProviderHealthStatus.DEGRADED),
                "down": sum(1 for h in self._health.values() if h.status == ProviderHealthStatus.DOWN),
                "local": sum(1 for h in self._health.values() if h.status == ProviderHealthStatus.LOCAL),
                "zero_cost": sum(1 for h in self._health.values() if h.status == ProviderHealthStatus.ZERO_COST),
            },
        }


# 模块级单例
model_availability = ModelAvailabilityService()
