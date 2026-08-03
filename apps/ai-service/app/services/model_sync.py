"""LLM 模型自动同步服务(2026-07-31 立,深度优化 v3)。

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

深度优化 v3(2026-07-31,8 项新增):
- F4.3 错误分类精细化(401/403/404/429/5xx 分类 + 永久禁用机制)
- F4.4 多 provider 适配扩展(Anthropic /v1/models + Google Gemini /v1beta/models)
- F4.5 元数据深度提取(description/vendor/max_output_tokens/supports_tool_call/
      supports_vision/rate_limit/release_date/deprecation_date)
- F4.6 Prometheus metrics 暴露同步指标(6 指标:ops/latency/new/removed/health/total)
- F4.7 连续失败自动禁用(N>=3 失败 → 标记 unhealthy + admin 告警日志)
- F4.8 增量同步(ETag / Last-Modified 缓存,304 跳过 upsert)
- Provider 级别并发锁(单 provider 同时只允许一个同步,避免冲突)

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
from enum import Enum
from typing import Any, Optional

import httpx
from prometheus_client import Counter, Gauge, Histogram

from ..core.config import settings
from ..core.db_pool import get_shared_pool
from ..core.provider_caps import get_provider_cap
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

# F4.7 连续失败自动禁用阈值(N 次失败后标记 unhealthy,跳过后续同步)
FAILURE_THRESHOLD = 3

# F4.8 增量同步:429 长退避时间(秒)
_RATE_LIMIT_BACKOFF_S = 60.0

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
# F4.3 错误分类枚举
# ============================================================================


class SyncErrorType(str, Enum):
    """同步错误分类(F4.3)。

    用于精细化错误处理:不同错误类型对应不同重试策略与禁用策略。
    """

    INVALID_KEY = "invalid_key"        # 401 - key 失效,应禁用 provider 同步
    FORBIDDEN = "forbidden"            # 403 - 无权限
    NOT_FOUND = "not_found"            # 404 - 端点不存在,应永久跳过此 provider
    RATE_LIMIT = "rate_limit"          # 429 - 速率限制,长退避(60s)
    SERVER_ERROR = "server_error"      # 5xx - 服务端错误,短退避重试
    NETWORK = "network"               # timeout/connect 错误,短退避重试
    UNKNOWN = "unknown"                # 其他


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
    # F4.3 错误分类(SyncErrorType 值,成功时为空)
    error_type: str = ""
    # F4.8 304 Not Modified 跳过 upsert(增量同步命中缓存)
    skipped: bool = False


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
# F4.6 Prometheus 指标
# ============================================================================

SYNC_OPERATIONS_TOTAL = Counter(
    "model_sync_operations_total",
    "Total model sync operations by provider and status",
    ["provider_code", "status"],  # status: success / failure / skipped
)

SYNC_LATENCY_SECONDS = Histogram(
    "model_sync_latency_seconds",
    "Model sync latency per provider",
    ["provider_code"],
    buckets=(0.5, 1, 2.5, 5, 10, 30, 60, 120),
)

SYNC_NEW_MODELS = Gauge(
    "model_sync_new_models",
    "Number of new models added in last sync per provider",
    ["provider_code"],
)

SYNC_REMOVED_MODELS = Gauge(
    "model_sync_removed_models",
    "Number of models removed in last sync per provider",
    ["provider_code"],
)

PROVIDER_HEALTH = Gauge(
    "model_sync_provider_health",
    "Provider health: 1=healthy, 0=unhealthy(>=3 consecutive failures)",
    ["provider_code"],
)

TOTAL_MODELS_IN_DB = Gauge(
    "model_sync_total_models_in_db",
    "Total models in DB per provider",
    ["provider_code"],
)


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
    - admin 端点 GET /llm/models/sync/health 查询 get_health()(F4.7)
    - main.py lifespan 关闭时调用 shutdown():取消定时任务

    线程安全:用 asyncio.Lock 保护 is_syncing 标志(防止并发同步)。
    F4.7 provider 级别并发锁:单 provider 同时只允许一个同步(避免冲突)。
    """

    def __init__(self) -> None:
        self._status = SyncStatus()
        self._lock = asyncio.Lock()
        self._refresh_task: Optional[asyncio.Task[None]] = None
        self._initialized = False
        # F3.4 缓存 ai_model_config_models 表是否有 tags 字段(None=未查询)
        self._tags_column_cache: Optional[bool] = None
        # F4.5 新字段列存在性缓存(column_name → exists)
        self._columns_cache: dict[str, bool] = {}
        # F4.7 连续失败计数 + 永久禁用集合
        self._provider_failure_counter: dict[str, int] = {}
        self._permanently_disabled_providers: set[str] = set()
        # F4.8 增量同步:ETag / Last-Modified 缓存
        self._provider_etag: dict[str, str] = {}
        self._provider_last_modified: dict[str, str] = {}
        # v4 运行时配置(优先于 settings,由 PUT /llm/models/sync/config 更新)
        self._runtime_interval_s: int | None = None
        self._runtime_concurrency: int | None = None
        # Provider 级别并发锁(单 provider 同时只允许一个同步)
        self._provider_locks: dict[str, asyncio.Lock] = {}

    # ------------------------------------------------------------------
    # F4.7 Provider 级别并发锁
    # ------------------------------------------------------------------

    def _get_provider_lock(self, provider_code: str) -> asyncio.Lock:
        """获取 provider 级别的并发锁(每个 provider 一把锁,懒初始化)。

        确保:同一个 provider 同时只允许一个同步任务执行,避免并发冲突。
        不同 provider 之间不互斥(可并行)。
        """
        if provider_code not in self._provider_locks:
            self._provider_locks[provider_code] = asyncio.Lock()
        return self._provider_locks[provider_code]

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
        # v4 启动自愈:提示上次运行中被永久禁用的 provider(不自动重置,让 admin 显式调用 reset)
        if self._permanently_disabled_providers:
            logger.warning(
                "[ModelSyncService] 上次运行中以下 provider 被永久禁用,"
                "如需重新同步请调用 POST /llm/models/sync/reset?provider=xxx: %s",
                sorted(self._permanently_disabled_providers),
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
        """F2.3 读取同步间隔(秒),优先 _runtime_interval_s,其次 settings,最后默认 21600。"""
        if self._runtime_interval_s is not None:
            return self._runtime_interval_s
        val = getattr(settings, "model_sync_interval_s", _DEFAULT_SYNC_INTERVAL_S)
        try:
            n = int(val)
            return n if n > 0 else _DEFAULT_SYNC_INTERVAL_S
        except (TypeError, ValueError):
            return _DEFAULT_SYNC_INTERVAL_S

    def _sync_concurrency(self) -> int:
        """F2.4 读取并发限流,优先 _runtime_concurrency,其次 settings,最后默认 5。"""
        if self._runtime_concurrency is not None:
            return self._runtime_concurrency
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
            # v4 日志自动清理(每次全量同步完成后,失败不影响主流程)
            try:
                cleanup_result = await self.cleanup_old_logs(before_days=30)
                logger.info(
                    "[ModelSyncService] 自动清理 %d 天前同步日志完成:删除 %d 条",
                    30, cleanup_result.get("deleted_count", 0),
                )
            except Exception as e:
                logger.warning("[ModelSyncService] 自动清理同步日志失败: %s", e)
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
        F4.7:已永久禁用或连续失败 >= FAILURE_THRESHOLD 的 provider 自动跳过。
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
                    error_type=SyncErrorType.UNKNOWN.value,
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

        F4.7 provider 级别并发锁:确保同一 provider 同时只允许一个同步。
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
        # F4.7 provider 级别并发锁
        async with self._get_provider_lock(provider_code):
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
        - F4.7 永久禁用 provider(404 端点不存在 / 401-403 连续 3 次):跳过并 log warning
        - F4.7 连续失败 >= FAILURE_THRESHOLD:跳过并 log warning

        Returns:
            [(provider_code, base_url, api_key), ...]
        """
        result: list[tuple[str, str, str]] = []
        for provider in free_provider_registry.list_all():
            code = provider.provider_code
            # zero_cost / LOCAL provider 不需要同步模型清单
            if provider.zero_cost or provider.category == ProviderCategory.LOCAL:
                continue
            # F4.7 永久禁用 provider 跳过
            if code in self._permanently_disabled_providers:
                logger.warning(
                    "[ModelSyncService] %s 已永久禁用(404/连续认证失败),跳过同步",
                    code,
                )
                continue
            # F4.7 连续失败 >= 阈值跳过(unhealthy)
            failures = self._provider_failure_counter.get(code, 0)
            if failures >= FAILURE_THRESHOLD:
                logger.warning(
                    "[ModelSyncService] %s 连续失败 %d 次(>= %d),标记 unhealthy 跳过同步",
                    code, failures, FAILURE_THRESHOLD,
                )
                continue
            # 从 settings 获取 api_key 和 api_base(与 model_availability.py 同源)
            cfg_name = _to_cfg_name(code)
            cfg = settings.get_provider_config(cfg_name)
            api_key = cfg.api_key
            api_base = cfg.api_base or provider.default_base_url
            if api_key and api_base and api_key not in _PLACEHOLDER_KEYS:
                result.append((code, api_base, api_key))
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
        F4.3 错误分类:401/403/404/429/5xx 分别处理,404 永久禁用,429 长退避。
        F4.6 Prometheus metrics:成功/失败/latency/health 埋点。
        F4.7 连续失败计数:成功清零,失败累加,>= 阈值标记 unhealthy。
        F4.8 增量同步:304 Not Modified 跳过 upsert。
        """
        # F4.7 provider 级别并发锁(确保同一 provider 同时只允许一个同步)
        async with self._get_provider_lock(provider_code):
            async with sem:
                start = datetime.now(timezone.utc)
                upstream_models: list[dict[str, Any]] = []
                last_exc: Optional[BaseException] = None
                last_error_type: str = ""
                skip_upsert = False

                # F1.2 重试循环(只重试网络/超时/5xx 错误,4xx 不重试)
                for attempt, delay in enumerate(_RETRY_BASE_DELAYS, start=1):
                    try:
                        upstream_models, skip_upsert = await self._fetch_upstream_models(
                            provider_code, base_url, api_key
                        )
                        last_exc = None
                        last_error_type = ""
                        break
                    except (httpx.TimeoutException, httpx.NetworkError) as e:
                        # F4.3 NETWORK 错误:短退避重试
                        last_exc = e
                        last_error_type = SyncErrorType.NETWORK.value
                        logger.warning(
                            "[ModelSyncService] %s 拉取失败(第 %d 次, %s),%0.1fs 后重试",
                            provider_code, attempt, type(e).__name__, delay,
                        )
                        if attempt < len(_RETRY_BASE_DELAYS):
                            await asyncio.sleep(delay)
                    except httpx.HTTPStatusError as e:
                        # F4.3 HTTP 状态码错误分类
                        status_code = e.response.status_code if e.response is not None else 0
                        last_error_type = self._classify_http_error(status_code)
                        last_exc = e

                        if last_error_type == SyncErrorType.NOT_FOUND.value:
                            # 404:端点不存在,永久禁用此 provider
                            self._permanently_disabled_providers.add(provider_code)
                            logger.warning(
                                "[ModelSyncService] %s 返回 404(端点不存在),已永久禁用",
                                provider_code,
                            )
                            break
                        elif last_error_type == SyncErrorType.INVALID_KEY.value:
                            # 401:key 失效,累加失败计数(连续 3 次后永久禁用)
                            self._bump_failure(provider_code)
                            logger.warning(
                                "[ModelSyncService] %s 返回 401(key 失效),失败计数 %d/%d",
                                provider_code,
                                self._provider_failure_counter.get(provider_code, 0),
                                FAILURE_THRESHOLD,
                            )
                            if self._provider_failure_counter.get(provider_code, 0) >= FAILURE_THRESHOLD:
                                self._permanently_disabled_providers.add(provider_code)
                                logger.warning(
                                    "[ModelSyncService] %s 连续 401 失败 >= %d 次,已永久禁用",
                                    provider_code, FAILURE_THRESHOLD,
                                )
                            break
                        elif last_error_type == SyncErrorType.FORBIDDEN.value:
                            # 403:无权限,累加失败计数
                            self._bump_failure(provider_code)
                            logger.warning(
                                "[ModelSyncService] %s 返回 403(无权限),失败计数 %d/%d",
                                provider_code,
                                self._provider_failure_counter.get(provider_code, 0),
                                FAILURE_THRESHOLD,
                            )
                            if self._provider_failure_counter.get(provider_code, 0) >= FAILURE_THRESHOLD:
                                self._permanently_disabled_providers.add(provider_code)
                                logger.warning(
                                    "[ModelSyncService] %s 连续 403 失败 >= %d 次,已永久禁用",
                                    provider_code, FAILURE_THRESHOLD,
                                )
                            break
                        elif last_error_type == SyncErrorType.RATE_LIMIT.value:
                            # 429:速率限制,长退避(60s)后重试 1 次
                            if attempt < len(_RETRY_BASE_DELAYS):
                                logger.warning(
                                    "[ModelSyncService] %s 返回 429(速率限制),%0.1fs 后重试",
                                    provider_code, _RATE_LIMIT_BACKOFF_S,
                                )
                                await asyncio.sleep(_RATE_LIMIT_BACKOFF_S)
                                continue
                            else:
                                self._bump_failure(provider_code)
                                break
                        elif last_error_type == SyncErrorType.SERVER_ERROR.value:
                            # 5xx:服务端错误,沿用指数退避重试
                            logger.warning(
                                "[ModelSyncService] %s 返回 5xx(%d),第 %d 次重试,%0.1fs 后",
                                provider_code, status_code, attempt, delay,
                            )
                            if attempt < len(_RETRY_BASE_DELAYS):
                                await asyncio.sleep(delay)
                                continue
                            else:
                                self._bump_failure(provider_code)
                                break
                        else:
                            # UNKNOWN:不重试
                            self._bump_failure(provider_code)
                            break
                    except Exception as e:
                        # 其他未知错误不重试
                        last_exc = e
                        last_error_type = SyncErrorType.UNKNOWN.value
                        self._bump_failure(provider_code)
                        break

                latency_ms = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)
                latency_s = latency_ms / 1000.0

                if last_exc is not None:
                    # F4.6 Prometheus metrics 失败埋点
                    SYNC_OPERATIONS_TOTAL.labels(provider_code, "failure").inc()
                    SYNC_LATENCY_SECONDS.labels(provider_code).observe(latency_s)
                    failures = self._provider_failure_counter.get(provider_code, 0)
                    PROVIDER_HEALTH.labels(provider_code).set(
                        1 if failures < FAILURE_THRESHOLD else 0
                    )
                    return SyncResult(
                        provider_code=provider_code, success=False,
                        error=f"{type(last_exc).__name__}: {str(last_exc)[:200]}",
                        latency_ms=latency_ms,
                        error_type=last_error_type,
                    )

                # F4.8 增量同步:304 Not Modified 跳过 upsert
                if skip_upsert:
                    # F4.7 成功清零失败计数
                    self._provider_failure_counter[provider_code] = 0
                    # F4.6 Prometheus metrics 成功埋点(skipped)
                    SYNC_OPERATIONS_TOTAL.labels(provider_code, "skipped").inc()
                    SYNC_LATENCY_SECONDS.labels(provider_code).observe(latency_s)
                    PROVIDER_HEALTH.labels(provider_code).set(1)
                    logger.info(
                        "[ModelSyncService] %s 增量同步命中缓存(304),跳过 upsert,%dms",
                        provider_code, latency_ms,
                    )
                    return SyncResult(
                        provider_code=provider_code, success=True,
                        total_models=0, skipped=True,
                        latency_ms=latency_ms,
                    )

                if not upstream_models:
                    # F4.7 成功清零失败计数
                    self._provider_failure_counter[provider_code] = 0
                    # F4.6 Prometheus metrics 成功埋点
                    SYNC_OPERATIONS_TOTAL.labels(provider_code, "success").inc()
                    SYNC_LATENCY_SECONDS.labels(provider_code).observe(latency_s)
                    SYNC_NEW_MODELS.labels(provider_code).set(0)
                    SYNC_REMOVED_MODELS.labels(provider_code).set(0)
                    PROVIDER_HEALTH.labels(provider_code).set(1)
                    return SyncResult(
                        provider_code=provider_code, success=True, total_models=0,
                        latency_ms=latency_ms,
                    )

                try:
                    new_count, removed_count, preview_new, preview_removed, tags = (
                        await self._upsert_models_to_db(
                            provider_code, upstream_models, dry_run=dry_run
                        )
                    )
                except Exception as e:
                    logger.warning("[ModelSyncService] %s upsert 失败: %s", provider_code, e)
                    # F4.6 Prometheus metrics 失败埋点
                    SYNC_OPERATIONS_TOTAL.labels(provider_code, "failure").inc()
                    SYNC_LATENCY_SECONDS.labels(provider_code).observe(latency_s)
                    self._bump_failure(provider_code)
                    failures = self._provider_failure_counter.get(provider_code, 0)
                    PROVIDER_HEALTH.labels(provider_code).set(
                        1 if failures < FAILURE_THRESHOLD else 0
                    )
                    return SyncResult(
                        provider_code=provider_code, success=False, error=str(e)[:200],
                        latency_ms=latency_ms,
                        error_type=SyncErrorType.UNKNOWN.value,
                    )

                # F4.7 成功清零失败计数
                self._provider_failure_counter[provider_code] = 0

                # F4.6 Prometheus metrics 成功埋点
                SYNC_OPERATIONS_TOTAL.labels(provider_code, "success").inc()
                SYNC_LATENCY_SECONDS.labels(provider_code).observe(latency_s)
                SYNC_NEW_MODELS.labels(provider_code).set(new_count)
                SYNC_REMOVED_MODELS.labels(provider_code).set(removed_count)
                PROVIDER_HEALTH.labels(provider_code).set(1)
                TOTAL_MODELS_IN_DB.labels(provider_code).set(len(upstream_models))

                return SyncResult(
                    provider_code=provider_code, success=True,
                    total_models=len(upstream_models),
                    new_models=new_count, removed_models=removed_count,
                    latency_ms=latency_ms,
                    preview_new_model_ids=preview_new,
                    preview_removed_model_ids=preview_removed,
                    tags=tags,
                )

    # ------------------------------------------------------------------
    # F4.3 错误分类辅助
    # ------------------------------------------------------------------

    @staticmethod
    def _classify_http_error(status_code: int) -> str:
        """F4.3 根据 HTTP 状态码分类错误类型。

        Args:
            status_code: HTTP 响应状态码。

        Returns:
            SyncErrorType 枚举值(str)。
        """
        if status_code == 401:
            return SyncErrorType.INVALID_KEY.value
        if status_code == 403:
            return SyncErrorType.FORBIDDEN.value
        if status_code == 404:
            return SyncErrorType.NOT_FOUND.value
        if status_code == 429:
            return SyncErrorType.RATE_LIMIT.value
        if 500 <= status_code < 600:
            return SyncErrorType.SERVER_ERROR.value
        return SyncErrorType.UNKNOWN.value

    def _bump_failure(self, provider_code: str) -> None:
        """F4.7 递增 provider 的连续失败计数。"""
        self._provider_failure_counter[provider_code] = (
            self._provider_failure_counter.get(provider_code, 0) + 1
        )

    # ------------------------------------------------------------------
    # F4.7 健康状态查询
    # ------------------------------------------------------------------

    def get_health(self) -> dict[str, Any]:
        """F4.7 查询每个 provider 的健康状态。

        Returns:
            {
                "failure_counters": {provider_code: 连续失败次数, ...},
                "permanently_disabled": [provider_code, ...],
                "failure_threshold": 3,
            }
        """
        return {
            "failure_counters": dict(self._provider_failure_counter),
            "permanently_disabled": sorted(self._permanently_disabled_providers),
            "failure_threshold": FAILURE_THRESHOLD,
        }

    # ------------------------------------------------------------------
    # v4 运维端点配套方法(reset / config / stats / cleanup)
    # ------------------------------------------------------------------

    def reset_provider(self, provider_code: str) -> dict[str, Any]:
        """v4 重置 provider 的失败计数 + 从永久禁用列表移除,允许重新同步。

        操作:
        - 清零 _provider_failure_counter 中该 provider 的计数(记录 previous_failures)
        - 从 _permanently_disabled_providers 移除(was_disabled=True/False)
        - 清除 ETag/Last-Modified 缓存(强制下次全量同步)

        Args:
            provider_code: provider 唯一标识(如 stepfun / openai / cloudflare_workers_ai)。

        Returns:
            含 provider_code / reset=True / previous_failures / was_disabled 的字典。
        """
        previous_failures = self._provider_failure_counter.pop(provider_code, 0)
        was_disabled = provider_code in self._permanently_disabled_providers
        self._permanently_disabled_providers.discard(provider_code)
        # 清除 ETag/Last-Modified 缓存(强制下次全量同步,不走 304)
        self._provider_etag.pop(provider_code, None)
        self._provider_last_modified.pop(provider_code, None)
        logger.info(
            "[ModelSyncService] provider %s 已重置(previous_failures=%d, was_disabled=%s)",
            provider_code, previous_failures, was_disabled,
        )
        return {
            "provider_code": provider_code,
            "reset": True,
            "previous_failures": previous_failures,
            "was_disabled": was_disabled,
        }

    def update_config(
        self,
        interval_s: int | None = None,
        concurrency: int | None = None,
    ) -> dict[str, Any]:
        """v4 运行时更新同步间隔 + 并发限流(无需重启 ai-service)。

        优先级:_runtime_* > settings.model_sync_* > 默认值。
        调用后 _sync_interval_s() / _sync_concurrency() 会返回新值。

        Args:
            interval_s: 同步间隔(秒),必须 > 0 且 <= 86400(最大 24 小时)。None 表示不更新。
            concurrency: 并发限流,必须 > 0 且 <= 20。None 表示不更新。

        Returns:
            含当前生效的 interval_s / concurrency / applied=True 的字典。

        Raises:
            ValueError: 参数校验失败(interval_s 或 concurrency 超出范围,或两者都为 None)。
        """
        if interval_s is None and concurrency is None:
            raise ValueError("至少传一个参数(interval_s 或 concurrency)")
        if interval_s is not None:
            if not isinstance(interval_s, int) or interval_s <= 0 or interval_s > 86400:
                raise ValueError(
                    f"interval_s 必须 > 0 且 <= 86400(最大 24 小时),得到 {interval_s}"
                )
            self._runtime_interval_s = interval_s
        if concurrency is not None:
            if not isinstance(concurrency, int) or concurrency <= 0 or concurrency > 20:
                raise ValueError(
                    f"concurrency 必须 > 0 且 <= 20,得到 {concurrency}"
                )
            self._runtime_concurrency = concurrency
        logger.info(
            "[ModelSyncService] 配置已更新(interval_s=%s, concurrency=%s)",
            self._runtime_interval_s, self._runtime_concurrency,
        )
        return {
            "interval_s": self._sync_interval_s(),
            "concurrency": self._sync_concurrency(),
            "applied": True,
        }

    async def get_aggregated_stats(self, days: int = 7) -> dict[str, Any]:
        """v4 查询最近 N 天的聚合统计(成功率、平均延迟、新增/下架模型数)。

        查询 ai_model_sync_log 表 WHERE sync_started_at >= now() - interval 'N days',
        聚合计算 total_syncs / success_count / failure_count / success_rate /
        avg/max/min latency / total_new_models / total_removed_models,
        并按 provider_code GROUP BY 输出 by_provider 列表。

        Args:
            days: 查询天数,默认 7,最大 90。

        Returns:
            聚合统计字典。表不存在或查询失败时返回零值 dict(不抛异常)。
        """
        # 参数 clamp
        days = max(1, min(days, 90))
        zero_result: dict[str, Any] = {
            "days": days,
            "total_syncs": 0,
            "success_count": 0,
            "failure_count": 0,
            "success_rate": 0.0,
            "avg_latency_ms": 0,
            "max_latency_ms": 0,
            "min_latency_ms": 0,
            "total_new_models": 0,
            "total_removed_models": 0,
            "by_provider": [],
        }
        try:
            pool = await get_shared_pool()
            async with pool.acquire() as conn:
                # 总体聚合
                row = await conn.fetchrow(
                    """SELECT
                        COUNT(*) AS total_syncs,
                        COUNT(*) FILTER (WHERE success = true) AS success_count,
                        COUNT(*) FILTER (WHERE success = false) AS failure_count,
                        COALESCE(AVG(latency_ms), 0)::int AS avg_latency_ms,
                        COALESCE(MAX(latency_ms), 0) AS max_latency_ms,
                        COALESCE(MIN(latency_ms), 0) AS min_latency_ms,
                        COALESCE(SUM(new_models), 0) AS total_new_models,
                        COALESCE(SUM(removed_models), 0) AS total_removed_models
                       FROM ai_model_sync_log
                       WHERE sync_started_at >= now() - make_interval(days => $1)""",
                    days,
                )
                if row is None:
                    return zero_result
                total = row["total_syncs"] or 0
                success = row["success_count"] or 0
                failure = row["failure_count"] or 0
                success_rate = (success / total) if total > 0 else 0.0
                # by_provider 按 provider_code GROUP BY 聚合
                provider_rows = await conn.fetch(
                    """SELECT provider_code,
                              COUNT(*) AS total,
                              COUNT(*) FILTER (WHERE success = true) AS success,
                              COUNT(*) FILTER (WHERE success = false) AS failure,
                              COALESCE(AVG(latency_ms), 0)::int AS avg_latency_ms,
                              MAX(sync_finished_at) AS last_sync_at
                       FROM ai_model_sync_log
                       WHERE sync_started_at >= now() - make_interval(days => $1)
                       GROUP BY provider_code
                       ORDER BY provider_code""",
                    days,
                )
                by_provider: list[dict[str, Any]] = []
                for r in provider_rows:
                    p_total = r["total"] or 0
                    p_success = r["success"] or 0
                    p_rate = (p_success / p_total) if p_total > 0 else 0.0
                    last_sync = r["last_sync_at"]
                    by_provider.append({
                        "provider_code": r["provider_code"],
                        "total": p_total,
                        "success": p_success,
                        "failure": r["failure"] or 0,
                        "success_rate": p_rate,
                        "avg_latency_ms": r["avg_latency_ms"] or 0,
                        "last_sync_at": last_sync.isoformat() if last_sync else "",
                    })
                return {
                    "days": days,
                    "total_syncs": total,
                    "success_count": success,
                    "failure_count": failure,
                    "success_rate": success_rate,
                    "avg_latency_ms": row["avg_latency_ms"] or 0,
                    "max_latency_ms": row["max_latency_ms"] or 0,
                    "min_latency_ms": row["min_latency_ms"] or 0,
                    "total_new_models": row["total_new_models"] or 0,
                    "total_removed_models": row["total_removed_models"] or 0,
                    "by_provider": by_provider,
                }
        except Exception as e:
            logger.warning(
                "[ModelSyncService] 查询聚合统计失败(表可能不存在): %s", e
            )
            return zero_result

    async def cleanup_old_logs(self, before_days: int = 30) -> dict[str, Any]:
        """v4 清理 N 天前的同步日志(防止表无限增长)。

        执行 DELETE FROM ai_model_sync_log WHERE sync_started_at < now() - interval 'N days'。
        表不存在时返回 deleted_count=0(不抛异常)。

        Args:
            before_days: 清理多少天前的日志,默认 30,最小 1。

        Returns:
            含 deleted_count / before_days 的字典。
        """
        before_days = max(1, before_days)
        try:
            pool = await get_shared_pool()
            async with pool.acquire() as conn:
                result = await conn.execute(
                    """DELETE FROM ai_model_sync_log
                       WHERE sync_started_at < now() - make_interval(days => $1)""",
                    before_days,
                )
                # asyncpg execute 返回 "DELETE N" 格式,解析 N
                deleted = 0
                if isinstance(result, str):
                    parts = result.split()
                    if len(parts) >= 2 and parts[0] == "DELETE":
                        try:
                            deleted = int(parts[1])
                        except (ValueError, IndexError):
                            deleted = 0
                return {"deleted_count": deleted, "before_days": before_days}
        except Exception as e:
            logger.warning(
                "[ModelSyncService] 清理旧日志失败(表可能不存在): %s", e
            )
            return {"deleted_count": 0, "before_days": before_days}

    async def _fetch_upstream_models(
        self, provider_code: str, base_url: str, api_key: str
    ) -> tuple[list[dict[str, Any]], bool]:
        """从上游拉取模型清单(多 provider 适配)。

        F1.4:Cloudflare 适配改用 provider_code == "cloudflare_workers_ai" 判断。
        F4.4:新增 Anthropic /v1/models + Google Gemini /v1beta/models 适配。
        F4.8:增量同步,带 If-None-Match / If-Modified-Since header,304 返回 (空 list, True)。

        Returns:
            (models, skip_upsert) 元组:
            - models: [{"id": "...", "context_length": ..., "pricing": {...}}, ...]
            - skip_upsert: True 表示 304 Not Modified 命中缓存,应跳过 upsert。
        """
        url = base_url.rstrip("/")
        is_cloudflare = provider_code == "cloudflare_workers_ai"
        is_anthropic = provider_code == "anthropic"
        is_gemini = provider_code in ("google_gemini", "gemini", "google")

        # 构造请求 URL + headers
        headers: dict[str, str] = {"Accept": "application/json"}

        if is_cloudflare:
            # Cloudflare Workers AI: /models/search
            if url.endswith("/v1"):
                url = url[:-3]
            url = f"{url}/models/search"
            headers["Authorization"] = f"Bearer {api_key}"
        elif is_anthropic:
            # F4.4 Anthropic: /v1/models,header 用 x-api-key + anthropic-version
            if url.endswith("/v1"):
                url = f"{url}/models"
            else:
                url = f"{url}/v1/models"
            headers["x-api-key"] = api_key
            headers["anthropic-version"] = "2023-06-01"
        elif is_gemini:
            # F4.4 Google Gemini: /v1beta/models?key={api_key}
            # 2026-08-02 立:api_base 为 OpenAI 兼容端点(以 /openai 结尾,如
            # https://generativelanguage.googleapis.com/v1beta/openai)时,
            # 直接拼 /models 且 key 走 Bearer header(原生 Gemini API 才用 query param)
            if url.endswith("/v1beta"):
                url = f"{url}/models"
                # key 通过 query param 传递
                url = f"{url}?key={api_key}"
            elif url.endswith("/openai") or url.endswith("/v1"):
                url = f"{url}/models"
                headers["Authorization"] = f"Bearer {api_key}"
            else:
                url = f"{url}/v1beta/models"
                # key 通过 query param 传递
                url = f"{url}?key={api_key}"
        else:
            # 默认 OpenAI 兼容: /v1/models
            headers["Authorization"] = f"Bearer {api_key}"
            if url.endswith("/v1"):
                url = f"{url}/models"
            else:
                url = f"{url}/v1/models"

        # F4.8 增量同步:带 If-None-Match / If-Modified-Since header
        etag = self._provider_etag.get(provider_code)
        last_modified = self._provider_last_modified.get(provider_code)
        if etag:
            headers["If-None-Match"] = etag
        if last_modified:
            headers["If-Modified-Since"] = last_modified

        async with httpx.AsyncClient(timeout=SYNC_TIMEOUT_S) as client:
            resp = await client.get(url, headers=headers)

            # F4.8 304 Not Modified:命中缓存,跳过 upsert
            if resp.status_code == 304:
                return ([], True)

            resp.raise_for_status()

            # F4.8 提取 ETag / Last-Modified 缓存
            new_etag = resp.headers.get("ETag")
            new_last_modified = resp.headers.get("Last-Modified")
            if new_etag:
                self._provider_etag[provider_code] = new_etag
            if new_last_modified:
                self._provider_last_modified[provider_code] = new_last_modified

            data = resp.json()

        # 解析响应:Cloudflare 用 result 字段,OpenAI 兼容用 data 字段,
        # Anthropic 用 data 字段(同 OpenAI),Gemini 用 models 字段
        models: list[Any]
        if is_cloudflare:
            # 2026-08-02 修复:Cloudflare /models/search 的 result[].id 是 UUID(内部 id),
            # 调用时用的模型名在 result[].name(如 "@cf/meta/llama-3.3-70b-instruct-fp8-fast")。
            # 必须用 name 作为模型 id,否则同步进来的 UUID 无法匹配调用前缀被过滤。
            raw_models = data.get("result", []) if isinstance(data, dict) else []
            models = []
            for m in raw_models:
                if not isinstance(m, dict):
                    continue
                # name 字段是真正可调用的模型名(@cf/ 或 @hf/ 前缀);
                # 兼容旧响应:无 name 时回退 id(且 id 已是 @cf/ 格式则直接用)
                raw_name = m.get("name") or m.get("id", "")
                if not raw_name:
                    continue
                normalized: dict[str, Any] = {"id": raw_name}
                # description → 显示名候选
                if m.get("description"):
                    normalized["description"] = m["description"]
                # task.name 补充显示信息(Text Generation 等)
                task = m.get("task") or {}
                if isinstance(task, dict) and task.get("name"):
                    normalized["vendor"] = task["name"]
                models.append(normalized)
        elif is_gemini:
            # F4.4 Gemini 响应:{"models": [{"name": "models/gemini-1.5-flash", ...}]}
            # 2026-08-02 立:api_base 为 OpenAI 兼容端点时返回
            # {"data": [{"id": "gemini-2.5-flash", ...}]} 格式,两种格式都要兼容
            if isinstance(data, dict) and "data" in data:
                raw_models = data["data"]
            else:
                raw_models = data.get("models", []) if isinstance(data, dict) else []
            models = []
            for m in raw_models:
                if not isinstance(m, dict):
                    continue
                # Gemini 原生格式 name 字段为 "models/gemini-1.5-flash",
                # OpenAI 兼容格式 id 无 "models/" 前缀,统一去掉 "models/" 前缀
                raw_name = m.get("id", "") or m.get("name", "")
                model_id = raw_name.split("models/", 1)[-1] if raw_name.startswith("models/") else raw_name
                if not model_id:
                    continue
                # 构造兼容的 model dict(id 字段是必须的)
                normalized: dict[str, Any] = {"id": model_id}
                # Gemini:displayName → name 字段(供 _extract_display_name 用)
                if m.get("displayName"):
                    normalized["name"] = m["displayName"]
                # Gemini:inputTokenLimit + outputTokenLimit
                input_limit = m.get("inputTokenLimit")
                output_limit = m.get("outputTokenLimit")
                if isinstance(input_limit, int) and input_limit > 0:
                    normalized["context_length"] = input_limit
                    normalized["max_input_tokens"] = input_limit
                if isinstance(output_limit, int) and output_limit > 0:
                    normalized["max_output_tokens"] = output_limit
                # Gemini:supportedGenerationMethods 含 "generateContent" 视为 chat 模型
                methods = m.get("supportedGenerationMethods", [])
                if isinstance(methods, list) and "generateContent" in methods:
                    normalized["metadata"] = {"is_chat": True}
                models.append(normalized)
        elif isinstance(data, dict):
            models = data.get("data", [])
        elif isinstance(data, list):
            models = data
        else:
            models = []

        # F4.4 Anthropic 的 display_name 写入 name 字段(优先于 _extract_display_name 派生)
        if is_anthropic:
            for m in models:
                if isinstance(m, dict) and m.get("display_name") and not m.get("name"):
                    m["name"] = m["display_name"]

        return ([m for m in models if isinstance(m, dict) and m.get("id")], False)

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
        F4.5:深度元数据提取(description/vendor/max_output_tokens/supports_tool_call/
             supports_vision/rate_limit/release_date/deprecation_date),新字段缺失时降级。

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

                # F4.5 查新字段是否存在(带缓存)
                columns = await self._check_columns_exists(conn, [
                    "vendor", "max_output_tokens", "supports_tool_call", "supports_vision",
                    "description", "rate_limit_rpm", "rate_limit_tpd",
                    "release_date", "deprecation_date",
                ])

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

                    # F4.5 深度元数据提取
                    vendor = self._extract_vendor(aliased_id, m)
                    max_output_tokens = self._extract_max_output_tokens(m)
                    supports_tool_call = self._extract_supports_tool_call(
                        provider_code, aliased_id, m
                    )
                    supports_vision = self._extract_supports_vision(
                        provider_code, aliased_id, m
                    )
                    description = self._extract_description(m)
                    rpm, tpd = self._extract_rate_limit(m)
                    release_date = self._extract_release_date(m)
                    deprecation_date = self._extract_deprecation_date(m)

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
                            await self._insert_model(
                                conn, config_id, aliased_id, display_name, ctx_len,
                                input_price, output_price, model_tags,
                                tags_column_exists, columns,
                                vendor=vendor,
                                max_output_tokens=max_output_tokens,
                                supports_tool_call=supports_tool_call,
                                supports_vision=supports_vision,
                                description=description,
                                rate_limit_rpm=rpm,
                                rate_limit_tpd=tpd,
                                release_date=release_date,
                                deprecation_date=deprecation_date,
                            )
                        new_count += 1
                    else:
                        # 已存在:更新 context_length + pricing + F4.5 新字段
                        # (不改变 is_relay_public,尊重 admin 手动下架)
                        if not dry_run:
                            await self._update_model(
                                conn, config_id, aliased_id, ctx_len,
                                input_price, output_price, model_tags,
                                tags_column_exists, columns,
                                vendor=vendor,
                                max_output_tokens=max_output_tokens,
                                supports_tool_call=supports_tool_call,
                                supports_vision=supports_vision,
                                description=description,
                                rate_limit_rpm=rpm,
                                rate_limit_tpd=tpd,
                                release_date=release_date,
                                deprecation_date=deprecation_date,
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

    # ------------------------------------------------------------------
    # F4.5 INSERT / UPDATE 辅助(根据列存在性动态构造 SQL)
    # ------------------------------------------------------------------

    async def _insert_model(
        self,
        conn: Any,
        config_id: int,
        model_id: str,
        display_name: str,
        ctx_len: int,
        input_price: int,
        output_price: int,
        model_tags: list[str],
        tags_column_exists: bool,
        columns: dict[str, bool],
        vendor: str | None,
        max_output_tokens: int,
        supports_tool_call: bool,
        supports_vision: bool,
        description: str,
        rate_limit_rpm: int,
        rate_limit_tpd: int,
        release_date: str,
        deprecation_date: str,
    ) -> None:
        """F4.5 动态构造 INSERT SQL(根据列存在性决定写哪些字段)。

        新字段不存在时降级为只写存在的字段(类似 tags 的降级模式)。
        """
        # 基础字段(一定存在)
        fields = [
            "config_id", "model_id", "display_name", "context_length",
            "input_price_per_1k", "output_price_per_1k",
            "enabled", "is_relay_public", "relay_price_multiplier",
        ]
        placeholders = ["$1", "$2", "$3", "$4", "$5", "$6", "true", "true", "'1.0000'"]
        params: list[Any] = [config_id, model_id, display_name, ctx_len, input_price, output_price]
        idx = 7  # 下一个 placeholder 编号

        # tags 字段(v2 已有)
        if tags_column_exists:
            fields.append("tags")
            placeholders.append(f"${idx}")
            params.append(model_tags)
            idx += 1

        # F4.5 新字段
        f4_5_fields = [
            ("vendor", vendor),
            ("max_output_tokens", max_output_tokens),
            ("supports_tool_call", supports_tool_call),
            ("supports_vision", supports_vision),
            ("description", description),
            ("rate_limit_rpm", rate_limit_rpm),
            ("rate_limit_tpd", rate_limit_tpd),
            ("release_date", release_date),
            ("deprecation_date", deprecation_date),
        ]
        for col_name, param_value in f4_5_fields:
            if columns.get(col_name, False):
                fields.append(col_name)
                placeholders.append(f"${idx}")
                params.append(param_value)
                idx += 1
        # last_synced_at(INSERT 时也写入 now(),新模型也有同步时间)
        if columns.get("last_synced_at", False):
            fields.append("last_synced_at")
            placeholders.append("now()")  # SQL 函数,不需要 placeholder

        # ON CONFLICT DO UPDATE:更新存在的字段
        update_parts = ["is_relay_public = true", "enabled = true", "context_length = $4", "updated_at = now()"]
        if tags_column_exists:
            update_parts.append("tags = $7")
        # F4.5 新字段的 ON CONFLICT UPDATE
        update_idx = 7
        if tags_column_exists:
            update_idx = 8
        for col_name, _param_value in f4_5_fields:
            if columns.get(col_name, False):
                update_parts.append(f"{col_name} = ${update_idx}")
                update_idx += 1
        # last_synced_at(每次同步刷新,用 SQL now() 函数,不需要 placeholder)
        if columns.get("last_synced_at", False):
            update_parts.append("last_synced_at = now()")

        fields_str = ", ".join(fields)
        placeholders_str = ", ".join(placeholders)
        update_str = ", ".join(update_parts)

        sql = (
            f"INSERT INTO ai_model_config_models ({fields_str}) "
            f"VALUES ({placeholders_str}) "
            f"ON CONFLICT (config_id, model_id) DO UPDATE SET {update_str}"
        )
        await conn.execute(sql, *params)

    async def _update_model(
        self,
        conn: Any,
        config_id: int,
        model_id: str,
        ctx_len: int,
        input_price: int,
        output_price: int,
        model_tags: list[str],
        tags_column_exists: bool,
        columns: dict[str, bool],
        vendor: str | None,
        max_output_tokens: int,
        supports_tool_call: bool,
        supports_vision: bool,
        description: str,
        rate_limit_rpm: int,
        rate_limit_tpd: int,
        release_date: str,
        deprecation_date: str,
    ) -> None:
        """F4.5 动态构造 UPDATE SQL(根据列存在性决定更新哪些字段)。"""
        set_parts = [
            "context_length = $3",
            "input_price_per_1k = $4",
            "output_price_per_1k = $5",
            "updated_at = now()",
        ]
        params: list[Any] = [config_id, model_id, ctx_len, input_price, output_price]
        idx = 6

        if tags_column_exists:
            set_parts.append(f"tags = ${idx}")
            params.append(model_tags)
            idx += 1

        # F4.5 新字段
        f4_5_fields = [
            ("vendor", vendor),
            ("max_output_tokens", max_output_tokens),
            ("supports_tool_call", supports_tool_call),
            ("supports_vision", supports_vision),
            ("description", description),
            ("rate_limit_rpm", rate_limit_rpm),
            ("rate_limit_tpd", rate_limit_tpd),
            ("release_date", release_date),
            ("deprecation_date", deprecation_date),
        ]
        for col_name, param_value in f4_5_fields:
            if columns.get(col_name, False):
                set_parts.append(f"{col_name} = ${idx}")
                params.append(param_value)
                idx += 1
        # last_synced_at(每次同步刷新,用 SQL now() 函数,不需要 placeholder)
        if columns.get("last_synced_at", False):
            set_parts.append("last_synced_at = now()")

        set_str = ", ".join(set_parts)
        sql = (
            f"UPDATE ai_model_config_models SET {set_str} "
            f"WHERE config_id = $1 AND model_id = $2"
        )
        await conn.execute(sql, *params)

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

    async def _check_columns_exists(
        self, conn: Any, column_names: list[str]
    ) -> dict[str, bool]:
        """F4.5 通用列存在性查询(带缓存)。

        一次性查所有指定列是否存在,结果缓存到 self._columns_cache。
        新字段缺失时降级为只写存在的字段(类似 tags 的降级模式)。

        Args:
            conn: DB 连接。
            column_names: 要查询的列名列表。

        Returns:
            {column_name: True/False, ...} 字典。
        """
        result: dict[str, bool] = {}
        # 只查未缓存的列
        uncached = [c for c in column_names if c not in self._columns_cache]
        if uncached:
            try:
                rows = await conn.fetch(
                    """SELECT column_name FROM information_schema.columns
                       WHERE table_name = 'ai_model_config_models'
                         AND column_name = ANY($1)""",
                    uncached,
                )
                existing_set = {r["column_name"] for r in rows}
                for c in uncached:
                    self._columns_cache[c] = c in existing_set
            except Exception as e:
                logger.warning(
                    "[ModelSyncService] 查询列存在性失败,降级为不写新字段: %s", e
                )
                for c in uncached:
                    self._columns_cache[c] = False
        for c in column_names:
            result[c] = self._columns_cache.get(c, False)
        return result

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
    # F4.5 深度元数据提取
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_description(model: dict[str, Any]) -> str:
        """F4.5 提取模型描述。

        优先级:
        1. model.description(OpenRouter / OpenAI 兼容)
        2. model.metadata.description(NVIDIA / 自定义)
        """
        v = model.get("description")
        if isinstance(v, str) and v.strip():
            return v.strip()[:1000]  # 限制长度防止 DB 溢出
        meta = model.get("metadata")
        if isinstance(meta, dict):
            v = meta.get("description")
            if isinstance(v, str) and v.strip():
                return v.strip()[:1000]
        return ""

    @staticmethod
    def _extract_vendor(model_id: str, model: dict[str, Any]) -> Optional[str]:
        """F4.5 提取模型厂商。

        优先级:
        1. model.metadata.vendor(上游显式声明,lower())
        2. model_id 含 "/" → 取前缀(openai/gpt-4o → openai,anthropic/claude-... → anthropic)
        3. model_id 关键词前缀匹配(gpt → openai,claude → anthropic,llama → meta 等)
        4. 无法推断 → None(让 DB 存 NULL)
        """
        # 1. 上游 metadata.vendor
        meta = model.get("metadata")
        if isinstance(meta, dict):
            v = meta.get("vendor")
            if isinstance(v, str) and v.strip():
                return v.strip().lower()
        # 2. model_id 含 "/" → 取前缀作为 vendor
        if "/" in model_id:
            prefix = model_id.split("/", 1)[0].strip().lower()
            if prefix:
                return prefix
        # 3. model_id 关键词前缀匹配
        mid = model_id.lower()
        vendor_prefixes = {
            "gpt": "openai", "openai": "openai", "o1": "openai", "o3": "openai", "o4": "openai",
            "claude": "anthropic",
            "gemini": "google", "google": "google",
            "llama": "meta",
            "mistral": "mistral", "mixtral": "mistral",
            "qwen": "alibaba", "qwq": "alibaba",
            "deepseek": "deepseek",
            "nvidia": "nvidia", "nemotron": "nvidia",
            "cf": "cloudflare", "@cf": "cloudflare",
            "phi": "microsoft",
            "command": "cohere",
            "grok": "x-ai",
        }
        for prefix, vendor in vendor_prefixes.items():
            if mid.startswith(prefix):
                return vendor
        return None  # 无法推断 → None(让 DB 存 NULL,COUNT 统计正确)

    @staticmethod
    def _extract_max_output_tokens(model: dict[str, Any]) -> int:
        """F4.5 提取最大输出 token 数。

        优先级:
        1. model.max_output_tokens(OpenAI 兼容,int > 0)
        2. model.top_provider.max_completion_tokens(OpenRouter,int > 0)
        3. model.metadata.max_output_tokens(NVIDIA / 自定义,int > 0)
        4. 默认 0(未知)

        无效值(0 / 负数 / 非整数 / 缺失)→ 0(保守:不假设默认值)。
        """
        v = model.get("max_output_tokens")
        if isinstance(v, int) and not isinstance(v, bool) and v > 0:
            return v
        top = model.get("top_provider")
        if isinstance(top, dict):
            v = top.get("max_completion_tokens")
            if isinstance(v, int) and not isinstance(v, bool) and v > 0:
                return v
        meta = model.get("metadata")
        if isinstance(meta, dict):
            v = meta.get("max_output_tokens")
            if isinstance(v, int) and not isinstance(v, bool) and v > 0:
                return v
        return 0

    @staticmethod
    def _extract_supports_tool_call(
        provider_code: str, model_id: str, model: dict[str, Any]
    ) -> bool:
        """F4.5 综合判断模型是否支持 tool calling。

        优先级:
        1. provider_caps.get_provider_cap(provider_code).supports_tools(provider 级别)
        2. model.metadata.supports_tool_calling(OpenRouter 显式声明)
        3. model_id 含 tool/function 关键字
        """
        # 1. provider 级别 cap
        try:
            cap = get_provider_cap(provider_code)
            if not cap.supports_tools:
                return False
        except Exception:
            pass
        # 2. 上游 metadata.supports_tool_calling(OpenRouter)
        meta = model.get("metadata")
        if isinstance(meta, dict):
            v = meta.get("supports_tool_calling")
            if isinstance(v, bool):
                return v
        # 3. model_id 关键字
        mid = model_id.lower()
        if any(k in mid for k in ("tool", "function", "react")):
            return True
        # 默认:provider 支持 tools 则模型也支持(除非显式声明不支持)
        return True

    @staticmethod
    def _extract_supports_vision(
        provider_code: str, model_id: str, model: dict[str, Any]
    ) -> bool:
        """F4.5 综合判断模型是否支持视觉输入。

        优先级:
        1. provider_caps.get_provider_cap(provider_code).supports_vision(provider 级别)
        2. model.metadata.supports_vision(上游显式声明)
        3. model_id 含 vision/vl/image 关键字
        """
        # 1. provider 级别 cap
        try:
            cap = get_provider_cap(provider_code)
            if cap.supports_vision:
                return True
        except Exception:
            pass
        # 2. 上游 metadata.supports_vision
        meta = model.get("metadata")
        if isinstance(meta, dict):
            v = meta.get("supports_vision")
            if isinstance(v, bool):
                return v
        # 3. model_id 关键字
        mid = model_id.lower()
        if any(k in mid for k in ("vision", "vl", "image", "multimodal")):
            return True
        return False

    @staticmethod
    def _extract_rate_limit(model: dict[str, Any]) -> tuple[int, int]:
        """F4.5 提取速率限制。

        从 model.top_provider.rate_limit 提取 requests_per_minute / tokens_per_day。

        Returns:
            (rpm, tpd) 元组,无数据时返回 (0, 0)。
        """
        top = model.get("top_provider")
        if isinstance(top, dict):
            rl = top.get("rate_limit")
            if isinstance(rl, dict):
                rpm = rl.get("requests_per_minute", 0)
                tpd = rl.get("tokens_per_day", 0)
                return (
                    int(rpm) if isinstance(rpm, (int, float)) else 0,
                    int(tpd) if isinstance(tpd, (int, float)) else 0,
                )
        return (0, 0)

    @staticmethod
    def _extract_release_date(model: dict[str, Any]) -> str:
        """F4.5 提取模型发布日期(ISO 8601)。

        优先级:
        1. model.created(Unix 时间戳或 ISO 字符串,OpenAI / OpenRouter)
        2. model.metadata.release_date(自定义)
        """
        v = model.get("created")
        if v is not None:
            # Unix 时间戳(int)
            if isinstance(v, (int, float)) and v > 0:
                try:
                    return datetime.fromtimestamp(int(v), tz=timezone.utc).isoformat()
                except (OSError, ValueError):
                    pass
            # ISO 字符串
            if isinstance(v, str) and v.strip():
                return v.strip()
        meta = model.get("metadata")
        if isinstance(meta, dict):
            v = meta.get("release_date")
            if isinstance(v, str) and v.strip():
                return v.strip()
        return ""

    @staticmethod
    def _extract_deprecation_date(model: dict[str, Any]) -> str:
        """F4.5 提取模型弃用日期(ISO 8601)。

        优先级:
        1. model.deprecation_date(OpenAI 兼容)
        2. model.metadata.deprecation_date(自定义)
        """
        v = model.get("deprecation_date")
        if isinstance(v, str) and v.strip():
            return v.strip()
        meta = model.get("metadata")
        if isinstance(meta, dict):
            v = meta.get("deprecation_date")
            if isinstance(v, str) and v.strip():
                return v.strip()
        return ""

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
                    "error_type": r.error_type,
                    "skipped": r.skipped,
                }
                for r in self._status.results
            ],
        }


# 模块级单例
model_sync_service = ModelSyncService()
