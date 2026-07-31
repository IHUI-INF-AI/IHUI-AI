"""LLM 模型自动同步服务(2026-07-31 立)。

从已配置 key 的 provider 的 /v1/models 端点自动拉取最新模型清单,
注册到 DB(ai_model_config_models 表),实现"模型名自动更新,无需手动改 default_models.json"。

与 ModelAvailabilityService 协同:
- ModelAvailabilityService:5 分钟后台 ping 健康状态(过滤 DOWN 的 provider)
- ModelSyncService:6 小时后台拉取模型清单(注册新增 / 下架移除)

设计参考:
- scripts/scan-upstream-models.mjs(Node CLI 一次性扫描脚本,本服务是 Python 服务化版本)
- model_availability.py(缓存 + 并发 + 生命周期模式)
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from ..core.config import settings
from ..core.db_pool import get_shared_pool
from .free_provider_registry import ProviderCategory, free_provider_registry

logger = logging.getLogger(__name__)


# ============================================================================
# 常量配置
# ============================================================================

# 同步间隔(秒)— 6 小时全量同步一次
SYNC_INTERVAL_S = 6 * 3600

# 单 provider /v1/models 拉取超时(秒)
SYNC_TIMEOUT_S = 30.0

# 并发拉取数(同时拉取的 provider 数量)
SYNC_CONCURRENCY = 5

# 启动后延迟首次同步(秒,避免与 FastAPI 启动竞争)
INITIAL_DELAY_S = 60

# 占位符 key(用户未填 key 时的默认值,不应触发同步)
_PLACEHOLDER_KEYS: frozenset[str] = frozenset({
    "<your-xxx-api-key>",
    "<your-cf-api-token>",
    "nvapi-<your-key>",
    "",
})

# provider_code → LLM_PROVIDERS JSON name 映射
# (与 model_availability._PROVIDER_CODE_TO_LLM_PROVIDERS_NAME 对齐,需保持同步)
# 大多数 provider_code 与 LLM_PROVIDERS name 一致(如 stepfun/agnes/openai),
# 少数需要映射(如 cloudflare_workers_ai → cloudflare)
_PROVIDER_CODE_TO_CFG_NAME: dict[str, str] = {
    "cloudflare_workers_ai": "cloudflare",
    "nvidia_nim": "nvidia",
    "github_models": "github",
    "vercel_ai_gateway": "vercel",
    "opencode_zen": "opencode",
}


def _to_cfg_name(provider_code: str) -> str:
    """provider_code → LLM_PROVIDERS JSON name(用于读 settings.get_provider_config)。"""
    return _PROVIDER_CODE_TO_CFG_NAME.get(provider_code, provider_code)


# ============================================================================
# 数据类
# ============================================================================


@dataclass
class SyncResult:
    """单个 provider 的同步结果。"""

    provider_code: str
    success: bool
    total_models: int = 0
    new_models: int = 0
    removed_models: int = 0
    error: str = ""
    latency_ms: int = 0


@dataclass
class SyncStatus:
    """全局同步状态(缓存,供 GET /llm/models/sync/status 查询)。"""

    last_sync_at: str = ""  # ISO 8601 时间戳
    last_sync_duration_ms: int = 0
    total_providers: int = 0
    total_new_models: int = 0
    total_removed_models: int = 0
    results: list[SyncResult] = field(default_factory=list)
    is_syncing: bool = False  # 防止并发同步


# ============================================================================
# 服务单例
# ============================================================================


class ModelSyncService:
    """模型自动同步服务(单例)。

    生命周期:
    - main.py lifespan 启动时调用 initialize():启动后台定时同步任务(每 6 小时)
    - admin 端点 POST /llm/models/sync 手动触发 sync_all_providers()
    - admin 端点 GET /llm/models/sync/status 查询 get_status()
    - main.py lifespan 关闭时调用 shutdown():取消定时任务

    线程安全:用 asyncio.Lock 保护 is_syncing 标志(防止并发同步)。
    """

    def __init__(self) -> None:
        self._status = SyncStatus()
        self._lock = asyncio.Lock()
        self._refresh_task: Optional[asyncio.Task[None]] = None
        self._initialized = False

    async def initialize(self) -> None:
        """启动时调用:启动后台定时同步任务(每 6 小时全量同步)。

        幂等:多次调用只初始化一次。
        不阻塞:后台异步执行,FastAPI 启动立即返回。
        """
        if self._initialized:
            return
        self._initialized = True
        self._refresh_task = asyncio.create_task(self._sync_loop())
        logger.info(
            "[ModelSyncService] 后台定时同步任务已启动(每 %ds,首次延迟 %ds)",
            SYNC_INTERVAL_S, INITIAL_DELAY_S,
        )

    async def shutdown(self) -> None:
        """关闭时调用:取消定时同步任务。"""
        if self._refresh_task is not None and not self._refresh_task.done():
            self._refresh_task.cancel()
            try:
                await self._refresh_task
            except asyncio.CancelledError:
                pass
            self._refresh_task = None
        self._initialized = False

    async def _sync_loop(self) -> None:
        """定时同步循环(启动后延迟 60s 首次同步,之后每 6 小时一次)。"""
        await asyncio.sleep(INITIAL_DELAY_S)
        while True:
            try:
                await self.sync_all_providers()
            except asyncio.CancelledError:
                logger.info("[ModelSyncService] sync loop cancelled")
                raise
            except Exception as e:
                logger.warning("[ModelSyncService] 定时同步失败: %s", e)
            await asyncio.sleep(SYNC_INTERVAL_S)

    async def sync_all_providers(self) -> dict[str, Any]:
        """全量同步所有已配置 key 的 provider(并发拉取)。

        步骤:
        1. 从 free_provider_registry + settings 获取已配置 key 的 provider 列表
        2. 并发拉取每个 provider 的 /v1/models(信号量限流 SYNC_CONCURRENCY)
        3. 比对 DB,注册新增模型(自动上架)+ 下架移除模型(自动下架)
        4. 同步后触发 ModelAvailabilityService 刷新健康状态

        Returns:
            同步状态字典(含每个 provider 的结果),供 admin 端点直接返回。

        防止并发:如果 is_syncing=True,直接返回当前状态。
        """
        async with self._lock:
            if self._status.is_syncing:
                logger.warning("[ModelSyncService] 同步进行中,跳过本次触发")
                return self.get_status()
            self._status.is_syncing = True

        start_time = datetime.now(timezone.utc)
        providers_to_sync = self._get_configured_providers()

        if not providers_to_sync:
            logger.info("[ModelSyncService] 无已配置 key 的 provider,跳过同步")
            self._status.is_syncing = False
            self._status.last_sync_at = start_time.isoformat()
            self._status.last_sync_duration_ms = 0
            return self.get_status()

        # 并发拉取(信号量限流)
        sem = asyncio.Semaphore(SYNC_CONCURRENCY)
        tasks = [
            self._sync_single_provider(sem, code, base_url, api_key)
            for code, base_url, api_key in providers_to_sync
        ]
        raw_results = await asyncio.gather(*tasks, return_exceptions=True)

        # 汇总结果(过滤异常)
        results: list[SyncResult] = []
        for i, r in enumerate(raw_results):
            if isinstance(r, BaseException):
                code = providers_to_sync[i][0]
                results.append(SyncResult(
                    provider_code=code, success=False,
                    error=f"{type(r).__name__}: {str(r)[:200]}",
                ))
            else:
                results.append(r)

        self._status.results = results
        self._status.total_providers = len(results)
        self._status.total_new_models = sum(r.new_models for r in results if r.success)
        self._status.total_removed_models = sum(r.removed_models for r in results if r.success)
        self._status.last_sync_at = start_time.isoformat()
        self._status.last_sync_duration_ms = int(
            (datetime.now(timezone.utc) - start_time).total_seconds() * 1000
        )
        self._status.is_syncing = False

        # 同步后触发 ModelAvailabilityService 刷新(避免等 5 分钟)
        try:
            from .model_availability import model_availability
            asyncio.create_task(model_availability._refresh_all_providers())
        except Exception:
            pass

        logger.info(
            "[ModelSyncService] 全量同步完成: %d providers, +%d new, -%d removed, %dms",
            self._status.total_providers, self._status.total_new_models,
            self._status.total_removed_models, self._status.last_sync_duration_ms,
        )
        return self.get_status()

    def _get_configured_providers(self) -> list[tuple[str, str, str]]:
        """获取已配置 key 的 provider 列表(从 settings + free_provider_registry)。

        过滤规则:
        - zero_cost provider(pollinations/llm7/aihorde/opencode_zen):无需同步,模型清单固定
        - LOCAL provider(ollama/lmstudio/llamacpp/vllm):本地模型,无需同步
        - 未配置 key 的 provider:无法调 /v1/models,跳过
        - 占位符 key(如 <your-xxx-api-key>):跳过

        Returns:
            [(provider_code, base_url, api_key), ...]
        """
        result: list[tuple[str, str, str]] = []
        for provider in free_provider_registry.list_all():
            # zero_cost / LOCAL provider 不需要同步模型清单
            if provider.zero_cost or provider.category == ProviderCategory.LOCAL:
                continue
            # 从 settings 获取 api_key 和 api_base(与 model_availability.py 同源)
            cfg_name = _to_cfg_name(provider.provider_code)
            cfg = settings.get_provider_config(cfg_name)
            api_key = cfg.api_key
            api_base = cfg.api_base or provider.default_base_url
            if api_key and api_base and api_key not in _PLACEHOLDER_KEYS:
                result.append((provider.provider_code, api_base, api_key))
        return result

    async def _sync_single_provider(
        self,
        sem: asyncio.Semaphore,
        provider_code: str,
        base_url: str,
        api_key: str,
    ) -> SyncResult:
        """同步单个 provider:拉取 /v1/models → 比对 DB → 注册新增/下架移除。"""
        async with sem:
            start = datetime.now(timezone.utc)
            try:
                upstream_models = await self._fetch_upstream_models(base_url, api_key)
                if not upstream_models:
                    return SyncResult(
                        provider_code=provider_code, success=True, total_models=0,
                        latency_ms=int((datetime.now(timezone.utc) - start).total_seconds() * 1000),
                    )
                new_count, removed_count = await self._upsert_models_to_db(
                    provider_code, upstream_models
                )
                return SyncResult(
                    provider_code=provider_code, success=True,
                    total_models=len(upstream_models),
                    new_models=new_count, removed_models=removed_count,
                    latency_ms=int((datetime.now(timezone.utc) - start).total_seconds() * 1000),
                )
            except Exception as e:
                logger.warning("[ModelSyncService] 同步 %s 失败: %s", provider_code, e)
                return SyncResult(
                    provider_code=provider_code, success=False, error=str(e)[:200],
                    latency_ms=int((datetime.now(timezone.utc) - start).total_seconds() * 1000),
                )

    async def _fetch_upstream_models(self, base_url: str, api_key: str) -> list[dict[str, Any]]:
        """从上游拉取模型清单(OpenAI 兼容 /v1/models 或 Cloudflare 适配)。

        适配分支:
        - Cloudflare Workers AI:base_url 含 api.cloudflare.com → GET {base_url}/models/search,
          解析 result 数组(Cloudflare 返回 {"result": [...], "success": true},非 OpenAI 的 data 字段)。
        - 其他 provider:OpenAI 兼容 /v1/models,解析 data 数组。

        Returns:
            [{"id": "...", "context_length": ..., "pricing": {...}}, ...]
            只返回含 id 字段的模型对象。
        """
        url = base_url.rstrip("/")
        headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}

        # Cloudflare Workers AI 适配:API 路径 /models/search(非 /v1/models),响应字段 result(非 data)
        # 正确端点:https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/models/search
        # base_url 可能以 /ai 或 /ai/v1 结尾(用户习惯加 /v1),统一去掉 /v1 后缀再追加 /models/search
        is_cloudflare = "api.cloudflare.com" in base_url
        if is_cloudflare:
            if url.endswith("/v1"):
                url = url[:-3]
            url = f"{url}/models/search"
        elif url.endswith("/v1"):
            url = f"{url}/models"
        else:
            url = f"{url}/v1/models"

        async with httpx.AsyncClient(timeout=SYNC_TIMEOUT_S) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        # 解析响应:Cloudflare 用 result 字段,OpenAI 兼容用 data 字段,也可能是顶层数组
        models: list[Any]
        if isinstance(data, dict):
            models = data.get("result", []) if is_cloudflare else data.get("data", [])
        elif isinstance(data, list):
            models = data
        else:
            models = []
        return [m for m in models if isinstance(m, dict) and m.get("id")]

    async def _upsert_models_to_db(
        self,
        provider_code: str,
        upstream_models: list[dict[str, Any]],
    ) -> tuple[int, int]:
        """比对 DB,注册新增模型 / 下架移除模型。

        Returns:
            (new_count, removed_count)

        - 新增:DB 不存在 → INSERT(is_relay_public=true 自动上架)
        - 已存在:UPDATE context_length + pricing(不改变 is_relay_public,尊重 admin 手动下架)
        - 移除:DB 已上架但上游不再返回 → is_relay_public=false(自动下架,不删行)
        """
        pool = await get_shared_pool()
        async with pool.acquire() as conn:
            # 1. 查 provider 的 config_id(第一个启用的配置行)
            config_row = await conn.fetchrow(
                """SELECT id FROM ai_model_config
                   WHERE provider_code = $1 AND enabled = true
                   ORDER BY sort_order NULLS LAST, id LIMIT 1""",
                provider_code,
            )
            if not config_row:
                logger.info("[ModelSyncService] %s 未在 DB 注册 config,跳过同步", provider_code)
                return 0, 0
            config_id = config_row["id"]

            # 2. 查 DB 现有模型
            existing_rows = await conn.fetch(
                """SELECT model_id, is_relay_public FROM ai_model_config_models
                   WHERE config_id = $1""",
                config_id,
            )
            existing_map: dict[str, bool] = {
                r["model_id"]: bool(r["is_relay_public"]) for r in existing_rows
            }
            upstream_ids = {m["id"] for m in upstream_models}

            # 3. 注册新增模型 + 更新已存在模型的 context_length/pricing
            new_count = 0
            for m in upstream_models:
                mid = m["id"]
                # 从上游 metadata 提取 context_length(替代硬编码 32000)
                ctx_len = m.get("context_length") or m.get("context_window") or 32000
                # 从 pricing 字段提取(OpenRouter: {"prompt": "$/token", "completion": "$/token"})
                pricing = m.get("pricing") or {}
                input_price = self._parse_price(pricing.get("prompt"))
                output_price = self._parse_price(pricing.get("completion"))
                display_name = m.get("name") or mid

                if mid not in existing_map:
                    # 新模型:INSERT(is_relay_public=true 自动上架)
                    await conn.execute(
                        """INSERT INTO ai_model_config_models
                             (config_id, model_id, display_name, context_length,
                              input_price_per_1k, output_price_per_1k,
                              enabled, is_relay_public, relay_price_multiplier)
                           VALUES ($1, $2, $3, $4, $5, $6, true, true, '1.0000')
                           ON CONFLICT (config_id, model_id) DO UPDATE
                             SET is_relay_public = true, enabled = true,
                                 context_length = $4, updated_at = now()""",
                        config_id, mid, display_name, ctx_len, input_price, output_price,
                    )
                    new_count += 1
                else:
                    # 已存在:更新 context_length + pricing(不改变 is_relay_public,尊重 admin 手动下架)
                    await conn.execute(
                        """UPDATE ai_model_config_models
                           SET context_length = $3,
                               input_price_per_1k = $4,
                               output_price_per_1k = $5,
                               updated_at = now()
                           WHERE config_id = $1 AND model_id = $2""",
                        config_id, mid, ctx_len, input_price, output_price,
                    )

            # 4. 下架移除的模型(DB 已上架但上游不再返回)
            removed_count = 0
            for mid, is_public in existing_map.items():
                if mid not in upstream_ids and is_public:
                    await conn.execute(
                        """UPDATE ai_model_config_models
                           SET is_relay_public = false, updated_at = now()
                           WHERE config_id = $1 AND model_id = $2""",
                        config_id, mid,
                    )
                    removed_count += 1

            return new_count, removed_count

    @staticmethod
    def _parse_price(raw: Any) -> int:
        """将上游 pricing 字段($/token 字符串)转为 cents/1k tokens 整数。

        OpenRouter 返回 $/token(如 "0.00000025"),
        DB 存储 cents per 1k tokens(整数),
        转换:$/token × 1000 tokens × 100 cents/$ = cents/1k tokens。
        小于 1 cent 的价格截断为 0(整数存储限制)。
        """
        try:
            return int(float(raw) * 1000 * 100)
        except (TypeError, ValueError):
            return 0

    def get_status(self) -> dict[str, Any]:
        """返回同步状态(供 GET /llm/models/sync/status 端点用)。"""
        return {
            "last_sync_at": self._status.last_sync_at,
            "last_sync_duration_ms": self._status.last_sync_duration_ms,
            "total_providers": self._status.total_providers,
            "total_new_models": self._status.total_new_models,
            "total_removed_models": self._status.total_removed_models,
            "is_syncing": self._status.is_syncing,
            "results": [
                {
                    "provider_code": r.provider_code,
                    "success": r.success,
                    "total_models": r.total_models,
                    "new_models": r.new_models,
                    "removed_models": r.removed_models,
                    "error": r.error,
                    "latency_ms": r.latency_ms,
                }
                for r in self._status.results
            ],
        }


# 模块级单例
model_sync_service = ModelSyncService()
