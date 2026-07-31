"""LLM 模型自动同步服务(2026-07-31 立,深度优化 v2)。

从已配置 key 的 provider 的 /v1/models 端点自动拉取最新模型清单,
注册到 DB(ai_model_config_models 表),实现"模型名自动更新,无需手动改 default_models.json"。

与 ModelAvailabilityService 协同:
- ModelAvailabilityService:5 分钟后台 ping 健康状态(过滤 DOWN 的 provider)
- ModelSyncService:6 小时后台拉取模型清单(注册新增 / 下架移除)

深度优化 v2(2026-07-31,15 项):
- F1.1 DB 事务包裹 upsert(防止中途失败留脏数据)
- F1.2 失败重试(网络/超时错误指数退避 3 次,4xx 不重试)
- F1.3 同步历史持久化(ai_model_sync_log 表,重启不丢失)
- F1.4 Cloudflare 适配改用 provider_code 判断(不再字符串匹配 base_url)
- F2.1 单 provider 同步(sync_single_provider + POST ?provider=xxx)
- F2.2 dry-run 预览模式(只比对不写入,返回 new/removed model_id 列表)
- F2.3 调度间隔可调(settings.model_sync_interval_s)
- F2.4 并发限流可配(settings.model_sync_concurrency)
- F3.1 display_name 智能派生(gpt-4o-mini → GPT-4o Mini)
- F3.2 多 provider pricing schema 适配(OpenRouter/Cloudflare/NVIDIA NIM)
- F3.3 context_length 多层级 fallback(6 级)
- F3.4 模型分类标签(vision/tool/reasoning/fast/embedding/chat)
- F3.5 价格上限过滤(>$1/1k tokens 跳过)
- F3.6 模型别名映射(openai/gpt-4o → gpt-4o)

设计参考:
- scripts/scan-upstream-models.mjs(Node CLI 一次性扫描脚本,本服务是 Python 服务化版本)
- model_availability.py(缓存 + 并发 + 生命周期模式)
"""

from __future__ import annotations

import asyncio
import logging
import re
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

# 单 provider /v1/models 拉取超时(秒)
SYNC_TIMEOUT_S = 30.0

# 启动后延迟首次同步(秒,避免与 FastAPI 启动竞争)
INITIAL_DELAY_S = 60

# 同步间隔(秒)— 默认 6 小时,可由 settings.model_sync_interval_s 覆盖
_DEFAULT_SYNC_INTERVAL_S = 6 * 3600

# 并发拉取数(同时拉取的 provider 数量)— 默认 5,可由 settings.model_sync_concurrency 覆盖
_DEFAULT_SYNC_CONCURRENCY = 5

# F1.2 失败重试配置(指数退避:1s, 2s, 4s)
_RETRY_BASE_DELAYS: tuple[float, ...] = (1.0, 2.0, 4.0)

# F3.5 价格上限过滤(cents per 1k tokens,即 $1/1k tokens = $1000/1M tokens)
# 超过此阈值的模型视为极端高价,跳过 INSERT 并 log warning
MAX_PRICE_PER_1K_TOKENS = 100

# 占位符 key(用户未填 key 时的默认值,不应触发同步)
_PLACEHOLDER_KEYS: frozenset[str] = frozenset({
    "<your-xxx-api-key>",
    "<your-cf-api-token>",
    "nvapi-<your-key>",
    "",
})

# provider_code → LLM_PROVIDERS JSON name 映射
# (与 model_availability._PROVIDER_CODE_TO_LLM_PROVIDERS_NAME 对齐,需保持同步)
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
    # F2.2 dry-run 预览:将要新增/下架的 model_id 列表
    preview_new_model_ids: list[str] = field(default_factory=list)
    preview_removed_model_ids: list[str] = field(default_factory=list)
    # F3.4 模型分类标签(provider 维度汇总,供前端展示)
    tags: list[str] = field(default_factory=list)


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
    # F2.2 dry-run 预览(全局汇总)
    preview: dict[str, Any] = field(default_factory=dict)


# ============================================================================
# 服务单例
# ============================================================================


class ModelSyncService:
    """模型自动同步服务(单例)。

    生命周期:
    - main.py lifespan 启动时调用 initialize():启动后台定时同步任务(每 N 小时)
    - admin 端点 POST /llm/models/sync 手动触发 sync_all_providers()
    - admin 端点 POST /llm/models/sync?provider=xxx 触发 sync_single_provider()
    - admin 端点 GET /llm/models/sync/status 查询 get_status()
    - admin 端点 GET /llm/models/sync/history 查询 get_history()
    - main.py lifespan 关闭时调用 shutdown():取消定时任务

    线程安全:用 asyncio.Lock 保护 is_syncing 标志(防止并发同步)。
    """

    def __init__(self) -> None:
        self._status = SyncStatus()
        self._lock = asyncio.Lock()
        self._refresh_task: Optional[asyncio.Task[None]] = None
        self._initialized = False
        # F3.4 缓存 ai_model_config_models 表是否有 tags 字段(None=未查询)
        self._tags_column_cache: Optional[bool] = None

    # ------------------------------------------------------------------
    # 生命周期
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        """启动时调用:启动后台定时同步任务(每 N 小时全量同步)。

        幂等:多次调用只初始化一次。
        不阻塞:后台异步执行,FastAPI 启动立即返回。
        """
        if self._initialized:
            return
        self._initialized = True
        self._refresh_task = asyncio.create_task(self._sync_loop())
        interval = self._sync_interval_s()
        logger.info(
            "[ModelSyncService] 后台定时同步任务已启动(每 %ds,首次延迟 %ds)",
            interval, INITIAL_DELAY_S,
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

    def _sync_interval_s(self) -> int:
        """F2.3 读取同步间隔(秒),优先 settings.model_sync_interval_s,缺失用默认 21600。"""
        val = getattr(settings, "model_sync_interval_s", _DEFAULT_SYNC_INTERVAL_S)
        try:
            n = int(val)
            return n if n > 0 else _DEFAULT_SYNC_INTERVAL_S
        except (TypeError, ValueError):
            return _DEFAULT_SYNC_INTERVAL_S

    def _sync_concurrency(self) -> int:
        """F2.4 读取并发限流,优先 settings.model_sync_concurrency,缺失用默认 5。"""
        val = getattr(settings, "model_sync_concurrency", _DEFAULT_SYNC_CONCURRENCY)
        try:
            n = int(val)
            return n if n > 0 else _DEFAULT_SYNC_CONCURRENCY
        except (TypeError, ValueError):
            return _DEFAULT_SYNC_CONCURRENCY

    async def _sync_loop(self) -> None:
        """定时同步循环(启动后延迟 60s 首次同步,之后每 N 小时一次)。"""
        await asyncio.sleep(INITIAL_DELAY_S)
        while True:
            try:
                await self.sync_all_providers()
            except asyncio.CancelledError:
                logger.info("[ModelSyncService] sync loop cancelled")
                raise
            except Exception as e:
                logger.warning("[ModelSyncService] 定时同步失败: %s", e)
            await asyncio.sleep(self._sync_interval_s())

    # ------------------------------------------------------------------
    # 同步入口(全量 / 单 provider / dry-run)
    # ------------------------------------------------------------------

    async def sync_all_providers(self, dry_run: bool = False) -> dict[str, Any]:
        """全量同步所有已配置 key 的 provider(并发拉取)。

        Args:
            dry_run: True=只预览不写入 DB,返回将新增/下架的 model_id 列表。

        Returns:
            同步状态字典(含每个 provider 的结果 + preview 字段),供 admin 端点直接返回。

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
        sem = asyncio.Semaphore(self._sync_concurrency())
        tasks = [
            self._sync_single_provider(sem, code, base_url, api_key, dry_run=dry_run)
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

        # F2.2 dry-run 预览汇总
        if dry_run:
            self._status.preview = {
                "new_model_ids": [mid for r in results for mid in r.preview_new_model_ids],
                "removed_model_ids": [mid for r in results for mid in r.preview_removed_model_ids],
            }
        else:
            self._status.preview = {}

        # F1.3 同步历史持久化(非 dry_run 才写)
        if not dry_run:
            finished = datetime.now(timezone.utc)
            for r in results:
                await self._write_sync_log(r, start_time, finished)

        # 同步后触发 ModelAvailabilityService 刷新(避免等 5 分钟)
        if not dry_run:
            try:
                from .model_availability import model_availability
                asyncio.create_task(model_availability._refresh_all_providers())
            except Exception:
                pass

        logger.info(
            "[ModelSyncService] 全量同步完成(dry_run=%s): %d providers, +%d new, -%d removed, %dms",
            dry_run, self._status.total_providers, self._status.total_new_models,
            self._status.total_removed_models, self._status.last_sync_duration_ms,
        )
        return self.get_status()

    async def sync_single_provider(
        self, provider_code: str, dry_run: bool = False
    ) -> dict[str, Any]:
        """F2.1 同步单个 provider。

        Args:
            provider_code: provider 唯一标识(如 stepfun / openai / cloudflare_workers_ai)。
            dry_run: True=只预览不写入 DB。

        Returns:
            同步状态字典(只含该 provider 的结果)。

        Raises:
            ValueError: provider_code 未配置 key 或不在 registry 中。
        """
        async with self._lock:
            if self._status.is_syncing:
                logger.warning("[ModelSyncService] 同步进行中,跳过本次触发")
                return self.get_status()
            self._status.is_syncing = True

        start_time = datetime.now(timezone.utc)

        # 在 registry 中找该 provider
        provider = free_provider_registry.get_by_code(provider_code)
        if provider is None:
            self._status.is_syncing = False
            raise ValueError(f"unknown provider_code: {provider_code}")

        # 从 settings 获取 api_key / api_base
        cfg_name = _to_cfg_name(provider_code)
        cfg = settings.get_provider_config(cfg_name)
        api_key = cfg.api_key
        api_base = cfg.api_base or provider.default_base_url

        if not api_key or api_key in _PLACEHOLDER_KEYS or not api_base:
            self._status.is_syncing = False
            raise ValueError(
                f"provider {provider_code} 未配置有效 api_key/api_base,无法同步"
            )

        sem = asyncio.Semaphore(1)
        result = await self._sync_single_provider(
            sem, provider_code, api_base, api_key, dry_run=dry_run
        )

        self._status.results = [result]
        self._status.total_providers = 1
        self._status.total_new_models = result.new_models if result.success else 0
        self._status.total_removed_models = result.removed_models if result.success else 0
        self._status.last_sync_at = start_time.isoformat()
        self._status.last_sync_duration_ms = result.latency_ms
        self._status.is_syncing = False

        if dry_run:
            self._status.preview = {
                "new_model_ids": list(result.preview_new_model_ids),
                "removed_model_ids": list(result.preview_removed_model_ids),
            }
        else:
            self._status.preview = {}
            # F1.3 同步历史持久化
            finished = datetime.now(timezone.utc)
            await self._write_sync_log(result, start_time, finished)
            # 触发 ModelAvailabilityService 刷新
            try:
                from .model_availability import model_availability
                asyncio.create_task(model_availability._refresh_all_providers())
            except Exception:
                pass

        logger.info(
            "[ModelSyncService] 单 provider 同步完成(%s, dry_run=%s): +%d new, -%d removed, %dms",
            provider_code, dry_run, result.new_models, result.removed_models, result.latency_ms,
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
        dry_run: bool = False,
    ) -> SyncResult:
        """同步单个 provider:拉取 /v1/models → 比对 DB → 注册新增/下架移除。

        F1.2 失败重试:网络/超时错误指数退避 3 次(1s/2s/4s),4xx 不重试。
        """
        async with sem:
            start = datetime.now(timezone.utc)
            upstream_models: list[dict[str, Any]] = []
            last_exc: Optional[BaseException] = None

            # F1.2 重试循环(只重试网络/超时错误,4xx 不重试)
            for attempt, delay in enumerate(_RETRY_BASE_DELAYS, start=1):
                try:
                    upstream_models = await self._fetch_upstream_models(
                        provider_code, base_url, api_key
                    )
                    last_exc = None
                    break
                except (httpx.TimeoutException, httpx.NetworkError) as e:
                    last_exc = e
                    logger.warning(
                        "[ModelSyncService] %s 拉取失败(第 %d 次, %s),%0.1fs 后重试",
                        provider_code, attempt, type(e).__name__, delay,
                    )
                    if attempt < len(_RETRY_BASE_DELAYS):
                        await asyncio.sleep(delay)
                except Exception as e:
                    # 4xx / 其他错误不重试,直接返回失败
                    return SyncResult(
                        provider_code=provider_code, success=False, error=str(e)[:200],
                        latency_ms=int((datetime.now(timezone.utc) - start).total_seconds() * 1000),
                    )

            if last_exc is not None:
                return SyncResult(
                    provider_code=provider_code, success=False,
                    error=f"{type(last_exc).__name__}: {str(last_exc)[:200]}",
                    latency_ms=int((datetime.now(timezone.utc) - start).total_seconds() * 1000),
                )

            if not upstream_models:
                return SyncResult(
                    provider_code=provider_code, success=True, total_models=0,
                    latency_ms=int((datetime.now(timezone.utc) - start).total_seconds() * 1000),
                )

            try:
                new_count, removed_count, preview_new, preview_removed, tags = (
                    await self._upsert_models_to_db(
                        provider_code, upstream_models, dry_run=dry_run
                    )
                )
            except Exception as e:
                logger.warning("[ModelSyncService] %s upsert 失败: %s", provider_code, e)
                return SyncResult(
                    provider_code=provider_code, success=False, error=str(e)[:200],
                    latency_ms=int((datetime.now(timezone.utc) - start).total_seconds() * 1000),
                )

            return SyncResult(
                provider_code=provider_code, success=True,
                total_models=len(upstream_models),
                new_models=new_count, removed_models=removed_count,
                latency_ms=int((datetime.now(timezone.utc) - start).total_seconds() * 1000),
                preview_new_model_ids=preview_new,
                preview_removed_model_ids=preview_removed,
                tags=tags,
            )

    async def _fetch_upstream_models(
        self, provider_code: str, base_url: str, api_key: str
    ) -> list[dict[str, Any]]:
        """从上游拉取模型清单(OpenAI 兼容 /v1/models 或 Cloudflare 适配)。

        F1.4:Cloudflare 适配改用 provider_code == "cloudflare_workers_ai" 判断,
        不再用字符串匹配 base_url。

        Returns:
            [{"id": "...", "context_length": ..., "pricing": {...}}, ...]
            只返回含 id 字段的模型对象。
        """
        url = base_url.rstrip("/")
        headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}

        # F1.4 Cloudflare Workers AI 适配:用 provider_code 判断(替代字符串匹配)
        is_cloudflare = provider_code == "cloudflare_workers_ai"
        if is_cloudflare:
            # 端点:https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/models/search
            # base_url 可能以 /ai 或 /ai/v1 结尾(用户习惯加 /v1),统一去掉 /v1 后缀再追加 /models/search
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
        dry_run: bool = False,
    ) -> tuple[int, int, list[str], list[str], list[str]]:
        """比对 DB,注册新增模型 / 下架移除模型。

        F1.1:用事务包裹整个 upsert 流程,中途失败回滚不留脏数据。
        F2.2:dry_run=True 时只比对返回 preview 列表,不写 DB。
        F3.5:价格超过 MAX_PRICE_PER_1K_TOKENS 的模型跳过 INSERT 并 log warning。
        F3.4:若 ai_model_config_models 表有 tags 字段,则写入 tags;否则只在内存返回。

        Returns:
            (new_count, removed_count, preview_new_ids, preview_removed_ids, tags)
        """
        pool = await get_shared_pool()
        preview_new: list[str] = []
        preview_removed: list[str] = []
        all_tags: set[str] = set()
        new_count = 0
        removed_count = 0

        async with pool.acquire() as conn:
            # F1.1 事务包裹整个 upsert(查 config + 查 existing + INSERT + UPDATE + 下架)
            async with conn.transaction():
                # 1. 查 provider 的 config_id(第一个启用的配置行)
                config_row = await conn.fetchrow(
                    """SELECT id FROM ai_model_config
                       WHERE provider_code = $1 AND enabled = true
                       ORDER BY sort_order NULLS LAST, id LIMIT 1""",
                    provider_code,
                )
                if not config_row:
                    logger.info("[ModelSyncService] %s 未在 DB 注册 config,跳过同步", provider_code)
                    return 0, 0, [], [], []
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

                # F3.4 查 tags 字段是否存在(带缓存)
                tags_column_exists = await self._check_tags_column_exists(conn)

                # F3.6 别名映射后的 upstream_ids(用于下架比对)
                upstream_ids: set[str] = set()

                # 3. 注册新增模型 + 更新已存在模型的 context_length/pricing
                for m in upstream_models:
                    raw_id = m["id"]
                    aliased_id, is_aliased = self._apply_alias(raw_id, provider_code)
                    upstream_ids.add(aliased_id)

                    # F3.3 context_length 多层级 fallback
                    ctx_len = self._extract_context_length(m)
                    # F3.2 多 provider pricing schema 适配
                    input_price, output_price = self._extract_pricing(provider_code, m)
                    # F3.1 display_name 智能派生
                    display_name = self._extract_display_name(aliased_id, m.get("name"))
                    if is_aliased:
                        display_name = f"{display_name} (原: {raw_id})"
                    # F3.4 模型分类标签
                    model_tags = self._classify_model(aliased_id, m)
                    all_tags.update(model_tags)

                    # F3.5 价格上限过滤(极端高价跳过)
                    if input_price > MAX_PRICE_PER_1K_TOKENS:
                        logger.warning(
                            "[ModelSyncService] %s/%s 价格超限(input=%d cents/1k > %d),跳过",
                            provider_code, aliased_id, input_price, MAX_PRICE_PER_1K_TOKENS,
                        )
                        continue

                    if aliased_id not in existing_map:
                        if dry_run:
                            preview_new.append(aliased_id)
                        else:
                            # 新模型:INSERT(is_relay_public=true 自动上架)
                            if tags_column_exists:
                                await conn.execute(
                                    """INSERT INTO ai_model_config_models
                                         (config_id, model_id, display_name, context_length,
                                          input_price_per_1k, output_price_per_1k,
                                          enabled, is_relay_public, relay_price_multiplier, tags)
                                       VALUES ($1, $2, $3, $4, $5, $6, true, true, '1.0000', $7)
                                       ON CONFLICT (config_id, model_id) DO UPDATE
                                         SET is_relay_public = true, enabled = true,
                                             context_length = $4, tags = $7, updated_at = now()""",
                                    config_id, aliased_id, display_name, ctx_len,
                                    input_price, output_price, model_tags,
                                )
                            else:
                                await conn.execute(
                                    """INSERT INTO ai_model_config_models
                                         (config_id, model_id, display_name, context_length,
                                          input_price_per_1k, output_price_per_1k,
                                          enabled, is_relay_public, relay_price_multiplier)
                                       VALUES ($1, $2, $3, $4, $5, $6, true, true, '1.0000')
                                       ON CONFLICT (config_id, model_id) DO UPDATE
                                         SET is_relay_public = true, enabled = true,
                                             context_length = $4, updated_at = now()""",
                                    config_id, aliased_id, display_name, ctx_len,
                                    input_price, output_price,
                                )
                        new_count += 1
                    else:
                        # 已存在:更新 context_length + pricing(不改变 is_relay_public,尊重 admin 手动下架)
                        if not dry_run:
                            if tags_column_exists:
                                await conn.execute(
                                    """UPDATE ai_model_config_models
                                       SET context_length = $3,
                                           input_price_per_1k = $4,
                                           output_price_per_1k = $5,
                                           tags = $6,
                                           updated_at = now()
                                       WHERE config_id = $1 AND model_id = $2""",
                                    config_id, aliased_id, ctx_len,
                                    input_price, output_price, model_tags,
                                )
                            else:
                                await conn.execute(
                                    """UPDATE ai_model_config_models
                                       SET context_length = $3,
                                           input_price_per_1k = $4,
                                           output_price_per_1k = $5,
                                           updated_at = now()
                                       WHERE config_id = $1 AND model_id = $2""",
                                    config_id, aliased_id, ctx_len,
                                    input_price, output_price,
                                )

                # 4. 下架移除的模型(DB 已上架但上游不再返回)
                for mid, is_public in existing_map.items():
                    if mid not in upstream_ids and is_public:
                        if dry_run:
                            preview_removed.append(mid)
                        else:
                            await conn.execute(
                                """UPDATE ai_model_config_models
                                   SET is_relay_public = false, updated_at = now()
                                   WHERE config_id = $1 AND model_id = $2""",
                                config_id, mid,
                            )
                        removed_count += 1

        return new_count, removed_count, preview_new, preview_removed, sorted(all_tags)

    async def _check_tags_column_exists(self, conn: Any) -> bool:
        """F3.4 查询 ai_model_config_models 表是否有 tags 字段(带缓存)。

        查询结果缓存到 self._tags_column_cache,避免每次 upsert 都查 information_schema。
        """
        if self._tags_column_cache is not None:
            return self._tags_column_cache
        try:
            row = await conn.fetchrow(
                """SELECT column_name FROM information_schema.columns
                   WHERE table_name = 'ai_model_config_models' AND column_name = 'tags'
                   LIMIT 1"""
            )
            exists = row is not None
        except Exception as e:
            logger.warning("[ModelSyncService] 查询 tags 字段失败,降级为不写 tags: %s", e)
            exists = False
        self._tags_column_cache = exists
        return exists

    # ------------------------------------------------------------------
    # F1.3 同步历史持久化
    # ------------------------------------------------------------------

    async def _write_sync_log(
        self, result: SyncResult, started_at: datetime, finished_at: datetime
    ) -> None:
        """F1.3 写入同步历史到 ai_model_sync_log 表(表不存在时静默跳过)。"""
        try:
            pool = await get_shared_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO ai_model_sync_log
                         (provider_code, sync_started_at, sync_finished_at,
                          success, total_models, new_models, removed_models,
                          error, latency_ms)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
                    result.provider_code,
                    started_at,
                    finished_at,
                    result.success,
                    result.total_models,
                    result.new_models,
                    result.removed_models,
                    result.error,
                    result.latency_ms,
                )
        except Exception as e:
            # 表不存在或其他 DB 错误 → 静默降级(不影响主同步流程)
            logger.debug("[ModelSyncService] 写 sync_log 失败(表可能不存在): %s", e)

    async def get_history(self, limit: int = 20) -> list[dict[str, Any]]:
        """F1.3 查询最近 N 次同步记录(表不存在时返回空列表)。"""
        try:
            pool = await get_shared_pool()
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """SELECT provider_code, sync_started_at, sync_finished_at,
                              success, total_models, new_models, removed_models,
                              error, latency_ms
                       FROM ai_model_sync_log
                       ORDER BY sync_finished_at DESC
                       LIMIT $1""",
                    limit,
                )
                return [
                    {
                        "provider_code": r["provider_code"],
                        "sync_started_at": r["sync_started_at"].isoformat() if r["sync_started_at"] else "",
                        "sync_finished_at": r["sync_finished_at"].isoformat() if r["sync_finished_at"] else "",
                        "success": bool(r["success"]),
                        "total_models": r["total_models"] or 0,
                        "new_models": r["new_models"] or 0,
                        "removed_models": r["removed_models"] or 0,
                        "error": r["error"] or "",
                        "latency_ms": r["latency_ms"] or 0,
                    }
                    for r in rows
                ]
        except Exception as e:
            logger.debug("[ModelSyncService] 读 sync_log 失败(表可能不存在): %s", e)
            return []

    # ------------------------------------------------------------------
    # F3 模型元数据增强
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_display_name(model_id: str, raw_name: Any) -> str:
        """F3.1 display_name 智能派生。

        优先用上游返回的 raw_name;否则从 model_id 派生:
        - gpt-4o-mini → GPT-4o Mini
        - claude-3-5-sonnet → Claude 3.5 Sonnet
        - llama-3.3-70b-instruct → Llama 3.3 70B Instruct
        - qwen2.5-7b-instruct → Qwen2.5 7B Instruct
        """
        if raw_name and isinstance(raw_name, str) and raw_name.strip():
            return raw_name.strip()

        # split by - / _ /
        parts: list[str] = []
        cur = ""
        for ch in model_id:
            if ch in "-_/":
                if cur:
                    parts.append(cur)
                cur = ""
            else:
                cur += ch
        if cur:
            parts.append(cur)

        brand_map = {
            "gpt": "GPT", "llama": "Llama", "claude": "Claude",
            "mistral": "Mistral", "qwen": "Qwen", "gemini": "Gemini",
        }
        capitalize_words = {
            "instruct", "chat", "vision", "reasoning", "turbo", "preview",
            "mini", "flash", "small", "tiny", "nano",
            "sonnet", "haiku", "opus",
        }
        upper_words = {"qwq", "r1", "o1", "o3", "o4"}

        out: list[str] = []
        for p in parts:
            pl = p.lower()
            # 数字+b (70b → 70B)
            if re.match(r"^\d+b$", pl):
                out.append(p.upper())
                continue
            if pl == "b":
                out.append("B")
                continue
            if pl in capitalize_words:
                out.append(p.capitalize())
                continue
            if pl in upper_words:
                out.append(p.upper())
                continue
            if p.isdigit():
                # 数字拼接成版本号(3 → 3, 5 → 3.5)
                if out and out[-1].replace(".", "").isdigit():
                    out[-1] = out[-1] + "." + p
                else:
                    out.append(p)
                continue
            if pl in brand_map:
                out.append(brand_map[pl])
                continue
            # 默认:首字母大写,其余小写
            out.append(p[:1].upper() + p[1:].lower())

        return " ".join(out) if out else model_id

    @staticmethod
    def _extract_pricing(provider_code: str, model: dict[str, Any]) -> tuple[int, int]:
        """F3.2 多 provider pricing schema 适配。

        返回 (input_price, output_price),单位 cents/1k tokens(整数)。
        - OpenRouter: model.pricing.prompt / model.pricing.completion($/token 字符串)
        - Cloudflare: model.pricing.input / model.pricing.output($/token 浮点数)
        - NVIDIA NIM: model.metadata.input_cost_per_token / model.metadata.output_cost_per_token
        - 其他: 无 pricing 字段 → (0, 0)
        """
        # OpenRouter
        if provider_code == "openrouter":
            pricing = model.get("pricing") or {}
            if isinstance(pricing, dict):
                input_price = ModelSyncService._parse_price(pricing.get("prompt"))
                output_price = ModelSyncService._parse_price(pricing.get("completion"))
                return (input_price, output_price)
        # Cloudflare Workers AI
        if provider_code == "cloudflare_workers_ai":
            pricing = model.get("pricing") or {}
            if isinstance(pricing, dict):
                input_price = ModelSyncService._parse_price(pricing.get("input"))
                output_price = ModelSyncService._parse_price(pricing.get("output"))
                return (input_price, output_price)
        # NVIDIA NIM
        if provider_code == "nvidia_nim":
            metadata = model.get("metadata") or {}
            if isinstance(metadata, dict):
                input_price = ModelSyncService._parse_price(metadata.get("input_cost_per_token"))
                output_price = ModelSyncService._parse_price(metadata.get("output_cost_per_token"))
                return (input_price, output_price)
        return (0, 0)

    @staticmethod
    def _extract_context_length(model: dict[str, Any]) -> int:
        """F3.3 context_length 多层级 fallback。

        顺序:
        1. model.context_length
        2. model.context_window
        3. model.top_provider.context_length(OpenRouter)
        4. model.max_input_tokens
        5. model.metadata.max_input_tokens(NVIDIA)
        6. 默认 32000
        """
        # 1
        v = model.get("context_length")
        if isinstance(v, int) and v > 0:
            return v
        # 2
        v = model.get("context_window")
        if isinstance(v, int) and v > 0:
            return v
        # 3
        top = model.get("top_provider")
        if isinstance(top, dict):
            v = top.get("context_length")
            if isinstance(v, int) and v > 0:
                return v
        # 4
        v = model.get("max_input_tokens")
        if isinstance(v, int) and v > 0:
            return v
        # 5
        meta = model.get("metadata")
        if isinstance(meta, dict):
            v = meta.get("max_input_tokens")
            if isinstance(v, int) and v > 0:
                return v
        # 6
        return 32000

    @staticmethod
    def _classify_model(model_id: str, raw_model: dict[str, Any]) -> list[str]:
        """F3.4 模型分类标签。

        返回 list[str] 标签(可能多个):
        - vision: id 含 vision/vl/image/multimodal 或 raw_model 含 vision
        - tool: id 含 tool/function/react 或 raw_model 含 tool_call
        - reasoning: id 含 o1/o3/o4/reasoning/think/r1/qwq 或 raw_model 含 reasoning
        - fast: id 含 mini/flash/small/tiny/nano/8b/7b/3b/1b
        - embedding: id 含 embed/embedding/e5/bge
        - chat: 默认标签(所有非 embedding 模型)
        """
        mid = model_id.lower()
        raw_str = str(raw_model).lower()
        tags: list[str] = []

        # vision
        if any(k in mid for k in ("vision", "vl", "image", "multimodal")) or "vision" in raw_str:
            tags.append("vision")
        # tool
        if any(k in mid for k in ("tool", "function", "react")) or "tool_call" in raw_str:
            tags.append("tool")
        # reasoning
        if any(k in mid for k in ("o1", "o3", "o4", "reasoning", "think", "r1", "qwq")) or "reasoning" in raw_str:
            tags.append("reasoning")
        # fast
        if any(k in mid for k in ("mini", "flash", "small", "tiny", "nano", "8b", "7b", "3b", "1b")):
            tags.append("fast")
        # embedding(如果是 embedding 模型,不再加 chat 标签)
        is_embedding = any(k in mid for k in ("embed", "embedding", "e5", "bge"))
        if is_embedding:
            tags.append("embedding")
        else:
            tags.append("chat")  # 默认标签

        return tags

    @staticmethod
    def _apply_alias(model_id: str, provider_code: str) -> tuple[str, bool]:
        """F3.6 模型别名映射。

        OpenRouter 的 openai/gpt-4o → gpt-4o(剥离 openai/anthropic/google/meta 等前缀)。
        其他 provider 不处理。

        Returns:
            (aliased_id, is_aliased)
        """
        if provider_code == "openrouter":
            # 已知前缀(小写匹配,剥离时保持原大小写)
            known_prefixes = (
                "openai/", "anthropic/", "google/", "meta/", "mistral/",
                "microsoft/", "nvidia/", "amazon/", "ai21/", "cohere/",
                "deepseek/", "qwen/", "x-ai/", "perplexity/",
            )
            mid_lower = model_id.lower()
            for prefix in known_prefixes:
                if mid_lower.startswith(prefix):
                    return (model_id[len(prefix):], True)
        return (model_id, False)

    @staticmethod
    def _parse_price(raw: Any) -> int:
        """将上游 pricing 字段($/token 字符串或浮点数)转为 cents/1k tokens 整数。

        OpenRouter 返回 $/token 字符串(如 "0.00000025"),Cloudflare/NVIDIA 返回浮点数。
        DB 存储 cents per 1k tokens(整数),
        转换:$/token × 1000 tokens × 100 cents/$ = cents/1k tokens。
        小于 1 cent 的价格截断为 0(整数存储限制)。
        """
        try:
            return int(float(raw) * 1000 * 100)
        except (TypeError, ValueError):
            return 0

    # ------------------------------------------------------------------
    # 状态查询
    # ------------------------------------------------------------------

    def get_status(self) -> dict[str, Any]:
        """返回同步状态(供 GET /llm/models/sync/status 端点用)。"""
        return {
            "last_sync_at": self._status.last_sync_at,
            "last_sync_duration_ms": self._status.last_sync_duration_ms,
            "total_providers": self._status.total_providers,
            "total_new_models": self._status.total_new_models,
            "total_removed_models": self._status.total_removed_models,
            "is_syncing": self._status.is_syncing,
            "preview": self._status.preview,
            "results": [
                {
                    "provider_code": r.provider_code,
                    "success": r.success,
                    "total_models": r.total_models,
                    "new_models": r.new_models,
                    "removed_models": r.removed_models,
                    "error": r.error,
                    "latency_ms": r.latency_ms,
                    "tags": r.tags,
                    "preview_new_model_ids": r.preview_new_model_ids,
                    "preview_removed_model_ids": r.preview_removed_model_ids,
                }
                for r in self._status.results
            ],
        }


# 模块级单例
model_sync_service = ModelSyncService()
