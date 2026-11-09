# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""模型级连通探测(2026-11-07 立,用户规则:测不通的模型不进选择器列表)。

与 model_availability 的分工:
- model_availability 是 **provider 级**健康检查(看整家厂商 /v1/models 或推理 ping,
  一家厂商里任一模型通就判整家 HEALTHY ⇒ 单个模型坏死仍会继续显示,用户实测踩到)。
- 本模块是 **模型级**探测:对目录里每个候选模型发一次 max_tokens=1 的最小请求,
  明确模型级错误(404/模型不存在/余额耗尽)一次即隐藏,其余失败连续两次才隐藏,
  由 /llm/models 过滤掉。

设计要点:
- 只探测「已通过 provider 级可用性过滤」的候选(未配 key 的厂商不浪费请求)。
- 探测候选由 /llm/models 通过 observe_catalog() 注册(即用户实际可见目录),
  页面没访问过时不探测;首个目录注册后最多 60s 内自动开跑。
- 每 30 分钟自动全量复测;GET /llm/models/refresh/status 供前端手动刷新轮询。
- 429/401/402/403 属账户级错误,不据此隐藏单个模型(那是 provider 级判定的职责,
  否则一次限流就能把整家模型全抹掉)。
- 状态是进程内缓存,超过 STATUS_TTL_S 未复测的状态自动失效(避免一次偶发失败永久隐藏)。
- stub 模式不探测也不过滤(本地开发无 key)。

上游清单联动(2026-11-09 立,机主要求「刷新模型列表 / 定时自动刷新是否好使时,
同时也要获取上游模型、更新模型」):
- 单靠本模块的连通探测只能"隐藏"坏模型,既拉不到上游新上架的模型,也不会把上游
  已下架的行从 DB 清掉 ⇒ 用户点刷新看到的是旧目录。故一次完整刷新编排为
  「上游清单同步 → 重建候选目录 → 模型级探测」三步,由 _start_refresh 单一出口启动。
- 上游同步复用 ModelSyncService.sync_all_providers():其 _upsert_models_to_db 已完成
  新增 INSERT 与下架物理 DELETE(2026-11-08 起),本模块不复制第二份同步判据(§0.6)。
- 手动刷新(POST /llm/models/refresh)强制触发同步,但带 60s 防抖,避免连点把上游
  /v1/models 打成限流;自动轮次每 30 分钟一轮,只在距上次同步 >= 5 小时的那一轮
  顺带同步(即机主口中的「每五小时自动刷新」档),同步失败则短退避 5 分钟再试。
- 上游同步失败/进行中绝不阻断健康探测;状态经 get_status().upstream_sync 暴露,
  且 running 覆盖整个编排(含同步阶段),前端轮询结束才重拉 /llm/models 就能看到
  新上架模型、下架模型也已从库里清走。
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx

from .free_provider_registry import ProviderCategory, free_provider_registry
from .model_availability import (
    _ZERO_COST_CODES,
    _infer_provider_code,
    _to_llm_providers_name,
)

logger = logging.getLogger(__name__)

# 自动复测间隔(秒)— 用户要求每半小时跑一遍
PROBE_INTERVAL_S = 1800
# 自动轮次里「顺带同步上游清单」的节流窗(秒)= 机主口中的每五小时档。
# 探测每 30 分钟一轮,但全量同步要打所有 provider 的 /v1/models,不必每轮都跑。
UPSTREAM_SYNC_INTERVAL_S = 5 * 3600
# 手动刷新的同步防抖窗(秒):连点刷新时不重复打上游,但不影响健康探测照常跑。
UPSTREAM_SYNC_MANUAL_DEBOUNCE_S = 60.0
# 上游同步失败后的退避窗(秒):失败不按 5 小时记,下一轮自动探测时即可重试。
UPSTREAM_SYNC_RETRY_S = 5 * 60.0
# 复用「已在跑的上游同步」时等待其落库的上限(秒):超时则沿用现有目录继续探测,
# 不让手动刷新被一个卡死的同步无限拖住。
UPSTREAM_SYNC_WAIT_S = 180.0
# 单模型探测超时(秒)— 与 provider 级 ping 对齐,避免把 9-16s 的慢模型误杀
PROBE_TIMEOUT_S = 20.0
# 并发上限(控制对同一厂商的请求密度,避免把探测自己打成 429)
PROBE_CONCURRENCY = 8
# 状态有效期(秒)— 超过两轮未复测则不再据此隐藏模型
STATUS_TTL_S = PROBE_INTERVAL_S * 2
# 同一模型连续失败次数达到此值才隐藏(仅 404 属模型级明确错误,可一次隐藏)
MAX_CONSECUTIVE_FAILURES = 2
# 目录扫描轮询步长(秒)/ 没有任何候选时不空转
_IDLE_POLL_S = 60
# 进程启动自举目录前等待 provider 级首轮刷新的上限(秒)
_BOOTSTRAP_WAIT_S = 90.0
# 自举失败/目录为空时的重试间隔(秒),避免空转打 DB
_BOOTSTRAP_RETRY_S = 60.0
# 账户级错误码:不据此隐藏单个模型
_ACCOUNT_LEVEL_STATUS = frozenset({401, 402, 403, 429})
# 上游 id 需要剥离的网关前缀(与实际调用路由对齐)
_STRIP_PREFIXES = (
    "gemini/",
    "agnes/",
    "nvidia/",
    "openrouter/",
    "stepfun/",
    "t6688/",
    "workbuddy/",
    "groq/",
    "scaleway/",
    "vercel/",
)
# 不是 OpenAI 兼容协议(或需要特殊账号参数)的 provider:不做直连探测,避免误判
_PROBE_SKIP_CODES = frozenset({"aihorde", "anthropic"})
# 错误文案里的账户级关键词:余额不足/配额/限流/鉴权失败(即使 HTTP 400 也不能据此隐藏模型)
_ACCOUNT_LEVEL_KEYWORDS = (
    "credit balance",
    "insufficient",
    "quota",
    "billing",
    "balance",
    "rate limit",
    "invalid api key",
    "api key not valid",
    "incorrect api key",
    "invalid key",
    "unauthorized",
    "authentication",
    "permission denied",
    "access denied",
    "not authorized",
    # 国内厂商中文文案(HTTP 400 也常见):避免把账户级错误当模型死亡
    "余额不足",
    "账户余额",
    "欠费",
    "配额",
    "限流",
    "频率限制",
    "鉴权失败",
    "认证失败",
    "未授权",
    "无权访问",
    "无效的api",
    "无效的密钥",
)
# 余额耗尽类文案:虽属账户级,但模型确实调不通 ⇒ 一次即隐藏
_BALANCE_EXHAUSTED_KEYWORDS = (
    "insufficient account balance",
    "insufficient_balance",
    "insufficient_quota",
    "no credits remaining",
    "credit balance",
    "insufficient balance",
    "not enough balance",
    "need positive balance",
    "run out of credits",
    "out of credits",
    "spending-limit",
    "personal-team-blocked",
    "add credits",
    "余额不足",
    "额度不足",
    "剩余额度",
    "欠费",
    "账户余额",
)
# 400/403/422/200 文案里的"模型不存在/不可用"语义:命中允许一次隐藏
_MODEL_NOT_FOUND_KEYWORDS = (
    "model not found",
    "model_not_found",
    "model not exist",
    "model does not exist",
    "invalid model",
    "unknown model",
    "no such model",
    "not a valid model",
    "unsupported model",
    "model is unavailable",
    "model unavailable",
    "no longer available",
    "decommissioned",
    "is not available on the",
    "model agreement",
    "use /v1/responses instead",
    "not allowed to access",
    "access-denied",
    "模型不存在",
    "模型无效",
    "模型不可用",
    "未找到模型",
    "不支持的模型",
    "模型已下线",
)
# 落盘/返回前脱敏:上游错误文案可能回显 key 片段
_SECRET_RE = re.compile(
    r"(?:sk[-_][A-Za-z0-9_-]{6,}|Bearer\s+[A-Za-z0-9._-]{6,}"
    r"|(?:api[_-]?key|token)[\"'=:\s]+[A-Za-z0-9._-]{6,})",
    re.IGNORECASE,
)


def _redact_secrets(text: str) -> str:
    """把错误文案里的密钥片段替换掉(状态文件与日志不落明文 key)。"""
    return _SECRET_RE.sub("[REDACTED]", text or "")


def _classify_error(text: str, status_code: int) -> tuple[bool, bool]:
    """把上游错误分类为 (account_level, model_level)。

    - account_level: 限流/鉴权等账户级问题,不据此隐藏单个模型
    - model_level: 上游明确不认识/已下线该模型,一次即隐藏
    - 余额耗尽单独归类:虽属账户级,但模型确实调不通 ⇒ 一次即隐藏
    """
    lowered = (text or "").lower()
    balance_exhausted = any(k in lowered for k in _BALANCE_EXHAUSTED_KEYWORDS)
    model_keyword = any(k in lowered for k in _MODEL_NOT_FOUND_KEYWORDS)
    # 模型级明确不可用的文案优先于状态码:403 也可能是"该模型不在当前套餐内"
    model_level = status_code == 404 or balance_exhausted or model_keyword
    account_level = (
        any(k in lowered for k in _ACCOUNT_LEVEL_KEYWORDS) or status_code in _ACCOUNT_LEVEL_STATUS
    ) and not model_level
    return account_level, model_level


# base 不含 /v1 的 OpenAI 兼容厂商(直接拼 /chat/completions)
_NO_V1_BASE_CODES = frozenset({"perplexity"})
# 健康状态落盘文件:重启后立即沿用上一轮结论,避免死模型在首轮探测完成前重新出现
_STATE_FILE = Path(__file__).resolve().parents[2] / "data" / "model_health_state.json"


@dataclass
class ModelProbeState:
    """单个模型的最近一次探测结果。"""

    status: str = "pending"  # pending / healthy / down
    checked_at: float = 0.0
    error: str = ""
    latency_ms: int = 0
    consecutive_failures: int = 0


def _strip_upstream_prefix(model_id: str, provider_code: str) -> str:
    """把网关暴露的模型 id 还原成上游 API 认识的模型名。

    Cloudflare 的 "@cf/..." 前缀是上游名字本身的一部分,不能剥。
    """
    if provider_code == "cloudflare_workers_ai" or model_id.startswith("@cf/"):
        return model_id
    prefixes = (f"{provider_code}/", *_STRIP_PREFIXES)
    for prefix in prefixes:
        if prefix and model_id.startswith(prefix):
            return model_id[len(prefix):]
    return model_id


def _resolve_credentials(provider_code: str) -> tuple[str, str]:
    """返回 (api_key, api_base);与 model_availability 的 provider 级 ping 同源。"""
    from ..core.config import settings

    cfg = settings.get_provider_config(_to_llm_providers_name(provider_code))
    api_key = (cfg.api_key or "").strip()
    api_base = (cfg.api_base or "").strip()
    provider = free_provider_registry.get_by_code(provider_code)
    if provider and not api_base:
        api_base = (provider.default_base_url or "").strip()
    if not api_key and provider:
        for env_var in provider.key_env_vars:
            val = os.environ.get(env_var, "").strip()
            if val and not val.startswith(("http://", "https://")):
                api_key = val
                break
    return api_key, api_base


def _chat_url(api_base: str, provider_code: str = "") -> str:
    base = api_base.rstrip("/")
    # 配置里已经写全了 chat 路径(常见误配):直接用,避免拼出 /chat/completions/chat/completions
    if base.endswith("/chat/completions"):
        return base
    if provider_code in _NO_V1_BASE_CODES:
        return f"{base}/chat/completions"
    if base.endswith(("/v1", "/openai", "/v4")):
        return f"{base}/chat/completions"
    return f"{base}/v1/chat/completions"


def _needs_completion_tokens(body: str) -> bool:
    """判断 400 是否因为推理模型不接受 max_tokens(OpenAI o1/o3/o4 等)。"""
    lowered = body.lower()
    if "max_completion_tokens" in lowered:
        return True
    return "max_tokens" in lowered and (
        "unsupported" in lowered or "not supported" in lowered
    )


def _needs_stream(body: str) -> bool:
    """判断 400 是否因为该模型只接受流式调用(非流式会被直接拒绝)。"""
    lowered = body.lower()
    return "stream" in lowered and any(
        k in lowered
        for k in (
            "must be true",
            "only support",
            "not supported",
            "requires stream",
            "stream=true",
            "stream mode",
            "streaming is required",
        )
    )


class ModelHealthService:
    """模型级健康状态单例。"""

    def __init__(self) -> None:
        # model_id -> 上游 provider 提示(来自 /llm/models 条目,推断失败时兜底)
        self._catalog: dict[str, str] = {}
        self._states: dict[str, ModelProbeState] = {}
        self._lock = asyncio.Lock()
        self._loop_task: asyncio.Task[None] | None = None
        self._refresh_task: asyncio.Task[None] | None = None
        self._bootstrap_task: asyncio.Task[None] | None = None
        self._last_bootstrap_at = 0.0
        self._running = False
        self._last_checked_at = 0.0
        self._last_total = 0
        self._last_done = 0
        self._initialized = False
        # 上游清单同步(2026-11-09):一次完整刷新 = 同步 → 重建目录 → 探测。
        # _refresh_task 现在承载整个编排(不再只承载 _refresh_all),
        # running 因此自动覆盖同步阶段,前端不会在同步未完成时过早重拉列表。
        self._last_upstream_sync_at = 0.0
        self._upstream_sync_running = False
        self._upstream_sync_state: dict[str, Any] = {
            "last_reason": "",
            "last_ok": None,
            "error": "",
            "new_models": 0,
            "removed_models": 0,
            "total_providers": 0,
            "failed_providers": 0,
            "skipped": False,
            "reused_running_sync": False,
        }

    async def initialize(self) -> None:
        """启动后台自动复测循环(不阻塞 FastAPI 启动)。"""
        if self._initialized:
            return
        self._initialized = True
        # 先恢复落盘结论(重启后首轮探测完成前也按上一轮结果过滤死模型)
        self._load_states()
        # 启动自举:不等页面访问就把目录登记好并立即探测一轮(避免重启后死模型重现)
        self._bootstrap_task = asyncio.create_task(self._bootstrap())
        self._loop_task = asyncio.create_task(self._refresh_loop())
        logger.info("ModelHealthService initialized (interval: %ds)", PROBE_INTERVAL_S)

    async def shutdown(self) -> None:
        for task in (self._refresh_task, self._bootstrap_task, self._loop_task):
            if task is not None and not task.done():
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task
        self._refresh_task = None
        self._bootstrap_task = None
        self._loop_task = None
        self._initialized = False

    def observe_catalog(self, models: list[dict[str, Any]]) -> None:
        """登记用户可见的候选目录(幂等,覆盖式更新)。

        只登记已通过 provider 级过滤的模型,未配 key 的厂商不浪费探测请求。
        """
        catalog: dict[str, str] = {}
        for m in models:
            mid = str(m.get("id") or "")
            if not mid:
                continue
            catalog[mid] = str(m.get("provider") or "")
        # 只清理 TTL 超期的状态;不能因为厂商级临时 DOWN 导致目录里暂时没有该厂商,
        # 就删掉模型级结论 —— 否则厂商恢复后死模型会重新显示,最长要等下一轮 30 分钟复测。
        now = time.time()
        stale = [
            mid
            for mid, state in self._states.items()
            if (now - state.checked_at) >= STATUS_TTL_S
        ]
        self._catalog = catalog
        for mid in stale:
            self._states.pop(mid, None)

    def trigger_refresh(self, *, force_upstream: bool = True) -> dict[str, Any]:
        """手动触发一轮完整刷新:上游清单同步 → 重建目录 → 模型级复测。

        POST /llm/models/refresh 走这里,force_upstream=True 表示用户主动点刷新
        就要真的去上游拉一次清单(仍受 60s 防抖),而不是等 5 小时节流窗。
        异步执行,立即返回状态;前端轮询 get_status() 直到 running=false 再重拉列表。
        """
        self._start_refresh(reason="manual_refresh", force_upstream=force_upstream)
        return self.get_status()

    def _start_refresh(self, *, reason: str, force_upstream: bool) -> None:
        """启动一轮完整刷新的唯一出口(手动 / 自动轮次 / 启动自举共用)。

        已有一轮在跑时不叠加:既避免并发打上游,也让 get_status().running 在
        同步阶段就为 true,前端不会在清单还没落库时过早重拉 /llm/models。
        """
        if self._refresh_task is None or self._refresh_task.done():
            self._refresh_task = asyncio.create_task(
                self._run_full_refresh(reason=reason, force_upstream=force_upstream)
            )

    async def _run_full_refresh(self, *, reason: str, force_upstream: bool) -> None:
        """完整刷新编排。上游同步失败绝不阻断健康探测(探测是可用性底线)。"""
        try:
            await self._sync_upstream_if_due(reason=reason, force=force_upstream)
        except asyncio.CancelledError:
            raise
        except Exception as e:  # pragma: no cover - 兜底,不因同步异常丢掉探测
            logger.warning("[model-health] 上游同步阶段异常,继续健康探测: %s", e)
        await self._refresh_all()

    async def _sync_upstream_if_due(self, *, reason: str, force: bool) -> None:
        """按节流拉一次上游模型清单,并据最新 DB 重建探测候选目录。

        同步逻辑全部复用 ModelSyncService.sync_all_providers():它已负责
        「上游上新 → INSERT」「上游下架 → 物理 DELETE + 引用点交接」以及
        异常清单安全阀,本模块不复制第二份判据(§0.6 单一真相源)。
        """
        # 延迟导入避免循环依赖(model_sync → model_availability ← 本模块)
        from ..core.llm_gateway import llm_gateway
        from .model_sync import model_sync_service

        # stub 模式(本地开发无 key)与探测侧同口径:不探测、也不打上游
        if llm_gateway._is_stub_mode():
            self._upstream_sync_state["skipped"] = True
            self._upstream_sync_state["last_reason"] = reason
            return

        now = time.time()
        last_ok = self._upstream_sync_state.get("last_ok")
        if force:
            window = UPSTREAM_SYNC_MANUAL_DEBOUNCE_S
        elif last_ok is False:
            # 上轮失败:短退避,下一轮自动探测即可重试,不按 5 小时记
            window = UPSTREAM_SYNC_RETRY_S
        else:
            window = float(UPSTREAM_SYNC_INTERVAL_S)
        elapsed = now - self._last_upstream_sync_at
        # 已有同步在跑(model_sync 自身 6h 循环 / admin 端点):不重复打上游,
        # 但要等它落库完再重建目录 —— 否则手动刷新会在清单尚未写入 DB 时
        # 就结束,前端重拉 /llm/models 拿到的仍是旧目录(用户看不到本次上新)。
        if model_sync_service.get_status().get("is_syncing"):
            logger.info(
                "[model-health] %s 复用正在执行的上游同步,等待其落库完成", reason
            )
            finished = False
            deadline = time.monotonic() + UPSTREAM_SYNC_WAIT_S
            while time.monotonic() < deadline:
                if not model_sync_service.get_status().get("is_syncing"):
                    finished = True
                    break
                await asyncio.sleep(1.0)
            self._upstream_sync_state.update({
                "last_reason": reason,
                "skipped": True,
                "reused_running_sync": finished,
            })
            if finished:
                try:
                    await self._ensure_catalog()
                except Exception as e:  # pragma: no cover
                    logger.warning("[model-health] 复用同步后重建目录失败: %s", e)
            else:
                logger.warning(
                    "[model-health] 等待在跑的上游同步 %.0fs 未完成,沿用现有目录",
                    UPSTREAM_SYNC_WAIT_S,
                )
            return
        if self._last_upstream_sync_at and elapsed < window:
            self._upstream_sync_state["skipped"] = True
            self._upstream_sync_state["last_reason"] = reason
            logger.info(
                "[model-health] 跳过上游同步(%s): 距上次 %.0fs < %.0fs",
                reason, elapsed, window,
            )
            return

        self._upstream_sync_running = True
        self._upstream_sync_state.update({
            "last_reason": reason,
            "skipped": False,
            "reused_running_sync": False,
            "error": "",
        })
        try:
            status = await model_sync_service.sync_all_providers()
            results = status.get("results") or []
            failed = [r for r in results if not r.get("success")]
            total_providers = int(status.get("total_providers") or 0)
            # sync_all_providers 把单 provider 失败收敛进 results,不抛异常也不设
            # 顶层 error。故按 results 真实成败判定,否则失败退避永远不会生效。
            # 无已配置 provider 属预期空跑,不算失败。
            ok = not failed or len(failed) < len(results)
            error_summary = "; ".join(
                f"{r.get('provider_code')}: {r.get('error') or r.get('error_type') or 'failed'}"
                for r in failed[:3]
            )
            self._upstream_sync_state.update({
                "last_ok": ok,
                "new_models": int(status.get("total_new_models") or 0),
                "removed_models": int(status.get("total_removed_models") or 0),
                "total_providers": total_providers,
                "failed_providers": len(failed),
                "error": error_summary[:200],
            })
            logger.info(
                "[model-health] 上游清单同步完成(%s): providers=%s, 上新=%s, 下架清理=%s",
                reason,
                self._upstream_sync_state["total_providers"],
                self._upstream_sync_state["new_models"],
                self._upstream_sync_state["removed_models"],
            )
            # 上游清单已落库:重建候选目录,新上的模型立刻进入本轮探测,
            # 已下架的模型不再被探测(它们已从 DB 物理删除)。
            try:
                await self._ensure_catalog()
            except Exception as e:  # pragma: no cover - 目录重建失败不阻断探测
                logger.warning("[model-health] 同步后重建目录失败: %s", e)
        except Exception as e:
            self._upstream_sync_state.update({
                "last_ok": False,
                "error": f"{type(e).__name__}: {e}"[:200],
            })
            logger.warning("[model-health] 上游清单同步失败(%s): %s", reason, e)
        finally:
            self._last_upstream_sync_at = time.time()
            self._upstream_sync_running = False

    def get_status(self) -> dict[str, Any]:
        """供前端手动刷新轮询。

        running 覆盖整个完整刷新编排(含上游同步阶段),否则前端会在清单尚未
        落库时就重拉 /llm/models,用户看不到本次上新/下架的结果。
        """
        task_running = self._refresh_task is not None and not self._refresh_task.done()
        return {
            "running": bool(self._running or self._upstream_sync_running or task_running),
            "total": len(self._catalog),
            "done": self._last_done,
            "checked_at": self._last_checked_at,
            "healthy": sum(1 for s in self._states.values() if s.status == "healthy"),
            "down": sum(1 for s in self._states.values() if s.status == "down"),
            "upstream_sync": {
                **self._upstream_sync_state,
                "running": self._upstream_sync_running,
                "last_sync_at": self._last_upstream_sync_at,
            },
        }

    def filter_available(self, models: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """过滤掉最近探测明确不可用的模型。"""
        now = time.time()
        out: list[dict[str, Any]] = []
        for m in models:
            mid = str(m.get("id") or "")
            state = self._states.get(mid)
            if (
                state is not None
                and state.status == "down"
                and (now - state.checked_at) < STATUS_TTL_S
            ):
                continue
            out.append(m)
        return out

    def get_state(self, model_id: str) -> ModelProbeState | None:
        return self._states.get(model_id)

    def _resolve_catalog_model(self, model_id: str) -> str | None:
        """把测试接口传来的模型 id 对齐到目录 id。

        测试接口格式是 `{providerCode}/{modelId}`,目录 id 可能是 `t6688/...`、
        `gemini/...` 等网关前缀形式,因此按"剥离前缀后的上游名"做二次匹配。
        """
        if not model_id:
            return None
        if model_id in self._catalog:
            return model_id
        tail = model_id.split("/", 1)[1] if "/" in model_id else model_id
        # 测试接口第一段是 providerCode(如 token6688/xxx),同名裸模型可能属于多个厂商:
        # 优先匹配同厂商条目,避免把 A 厂商的测试结果写到 B 厂商的同名模型上。
        test_code = model_id.split("/", 1)[0] if "/" in model_id else ""
        fallback: list[str] = []
        for cid, hint in self._catalog.items():
            code = _infer_provider_code(cid) or hint
            if _strip_upstream_prefix(cid, code) != tail:
                continue
            if test_code and _to_llm_providers_name(code) == _to_llm_providers_name(test_code):
                return cid
            fallback.append(cid)
        return fallback[0] if fallback else None

    def record_test_result(self, model_id: str, ok: bool, error: str = "") -> None:
        """单模型"测试连通"结果即时写入健康状态(2026-11-07 立)。

        用户规则:测试不通的模型必须立刻从选择器消失,不等下一轮 30 分钟复测。
        账户级错误(余额/配额/限流)不隐藏模型,避免误伤。
        """
        cid = self._resolve_catalog_model(model_id)
        if cid is None:
            return
        if ok:
            self._states[cid] = ModelProbeState(status="healthy", checked_at=time.time())
            self._save_states()
            return
        lowered = (error or "").lower()
        if any(k in lowered for k in _ACCOUNT_LEVEL_KEYWORDS) and not any(
            k in lowered for k in _BALANCE_EXHAUSTED_KEYWORDS
        ):
            return
        prev = self._states.get(cid) or ModelProbeState()
        self._states[cid] = ModelProbeState(
            status="down",
            checked_at=time.time(),
            error=_redact_secrets(error or "connectivity test failed")[:200],
            consecutive_failures=prev.consecutive_failures + 1,
        )
        self._save_states()

    def _load_states(self) -> None:
        """从落盘文件恢复上一轮健康状态(只保留 TTL 内的条目)。"""
        try:
            if not _STATE_FILE.exists():
                return
            raw = json.loads(_STATE_FILE.read_text(encoding="utf-8"))
            now = time.time()
            restored = 0
            for mid, item in (raw.get("models") or {}).items():
                if not isinstance(item, dict):
                    continue
                checked_at = float(item.get("checked_at") or 0)
                status = str(item.get("status") or "")
                if status not in ("healthy", "down"):
                    continue
                if (now - checked_at) >= STATUS_TTL_S:
                    continue
                self._states[str(mid)] = ModelProbeState(
                    status=status,
                    checked_at=checked_at,
                    error=str(item.get("error") or "")[:200],
                    latency_ms=int(item.get("latency_ms") or 0),
                    consecutive_failures=int(item.get("consecutive_failures") or 0),
                )
                restored += 1
            if restored:
                logger.info("[model-health] restored %d states from disk", restored)
        except Exception as e:  # pragma: no cover - 状态文件损坏不应影响服务启动
            logger.warning("[model-health] restore state failed: %s", e)

    def _save_states(self) -> None:
        """把健康状态原子落盘(重启后首轮探测完成前也按旧结论过滤)。"""
        try:
            now = time.time()
            payload = {
                "updated_at": now,
                "models": {
                    mid: {
                        "status": s.status,
                        "checked_at": s.checked_at,
                        "error": _redact_secrets(s.error),
                        "latency_ms": s.latency_ms,
                        "consecutive_failures": s.consecutive_failures,
                    }
                    for mid, s in self._states.items()
                    if (now - s.checked_at) < STATUS_TTL_S
                },
            }
            _STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
            tmp = _STATE_FILE.with_suffix(".json.tmp")
            tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            os.replace(tmp, _STATE_FILE)
        except Exception as e:  # pragma: no cover - 落盘失败最多退化为内存态
            logger.debug("[model-health] persist state failed: %s", e)

    async def _bootstrap(self) -> None:
        """进程启动时自举候选目录并立即跑首轮探测(2026-11-07 立)。

        历史缺陷:目录只由 /llm/models 请求登记 ⇒ 服务重启后若无人打开页面,
        健康状态为空,死模型会重新出现在选择器里,直到下一轮探测才被剔除。
        """
        from .model_availability import model_availability

        try:
            ready = await model_availability.wait_initial_refresh(_BOOTSTRAP_WAIT_S)
            if not ready:
                logger.warning(
                    "[model-health] provider 首轮刷新 %.0fs 未完成,按宽松口径先自举",
                    _BOOTSTRAP_WAIT_S,
                )
            if await self._ensure_catalog():
                logger.info(
                    "[model-health] startup catalog bootstrapped: %d models, "
                    "syncing upstream + probing now",
                    len(self._catalog),
                )
                # 启动自举同样走完整刷新:冷启动也把上游清单对齐一次,
                # 避免进程重启后长时间展示旧目录(上游已下架的行继续占库)。
                self._start_refresh(reason="startup_bootstrap", force_upstream=False)
        except asyncio.CancelledError:
            raise
        except Exception as e:  # pragma: no cover - 自举失败不应影响服务启动
            logger.warning("[model-health] bootstrap error: %s", e)

    async def _ensure_catalog(self) -> bool:
        """自举候选目录(与 /llm/models 同源:default_models.json + DB 合并)。"""
        self._last_bootstrap_at = time.time()
        try:
            from ..core.llm_gateway import llm_gateway
            from ..routers.llm import build_model_catalog
            from .model_availability import model_availability

            if llm_gateway._is_stub_mode():
                return False
            models = await build_model_catalog()
            models = model_availability.get_available_models(models)
            self.observe_catalog(models)
            return bool(self._catalog)
        except Exception as e:
            logger.warning("[model-health] catalog bootstrap failed: %s", e)
            return False

    async def _refresh_loop(self) -> None:
        while True:
            try:
                await asyncio.sleep(_IDLE_POLL_S)
                # stub 模式(本地开发无 key)不探测,也不要每 60s 去查一次 DB 目录
                from ..core.llm_gateway import llm_gateway

                if llm_gateway._is_stub_mode():
                    continue
                if not self._catalog:
                    # 目录尚未登记(重启后没人访问页面):自举一次,失败按重试间隔节流
                    if (time.time() - self._last_bootstrap_at) < _BOOTSTRAP_RETRY_S:
                        continue
                    if not await self._ensure_catalog():
                        continue
                if (
                    self._last_checked_at
                    and (time.time() - self._last_checked_at) < PROBE_INTERVAL_S
                ):
                    continue
                # 每 30 分钟一轮完整刷新;上游同步由 _sync_upstream_if_due
                # 自行按 5 小时节流(即「定时自动刷新模型是否好使时顺带拉上游」)。
                self._start_refresh(reason="auto_probe", force_upstream=False)
            except asyncio.CancelledError:
                raise
            except Exception as e:  # pragma: no cover - 守护循环不应因异常退出
                logger.warning("ModelHealthService loop error: %s", e)

    async def _refresh_all(self) -> None:
        candidates = list(self._catalog.items())
        if not candidates:
            self._last_checked_at = time.time()
            return
        self._running = True
        self._last_total = len(candidates)
        self._last_done = 0
        semaphore = asyncio.Semaphore(PROBE_CONCURRENCY)

        async def _probe_one(mid: str, provider_hint: str) -> None:
            async with semaphore:
                (
                    ok,
                    _status_code,
                    latency_ms,
                    error,
                    account_level,
                    model_level,
                ) = await self._probe_model(mid, provider_hint)
            async with self._lock:
                prev = self._states.get(mid) or ModelProbeState()
                if ok:
                    self._states[mid] = ModelProbeState(
                        status="healthy",
                        checked_at=time.time(),
                        latency_ms=latency_ms,
                        consecutive_failures=0,
                    )
                elif account_level:
                    # 账户级错误(限流/鉴权)不隐藏模型,保留上次结论;但必须刷新 checked_at,
                    # 否则每 30 分钟复测也救不回 TTL,状态会过期导致隐藏过的模型复活。
                    prev.error = error
                    prev.checked_at = time.time()
                    prev.latency_ms = latency_ms
                    self._states[mid] = prev
                else:
                    failures = prev.consecutive_failures + 1
                    hide = model_level or failures >= MAX_CONSECUTIVE_FAILURES
                    self._states[mid] = ModelProbeState(
                        status="down" if hide else prev.status,
                        checked_at=time.time(),
                        error=error,
                        latency_ms=latency_ms,
                        consecutive_failures=failures,
                    )
                self._last_done += 1

        try:
            await asyncio.gather(
                *[_probe_one(mid, hint) for mid, hint in candidates],
                return_exceptions=True,
            )
        finally:
            self._last_checked_at = time.time()
            self._running = False
            self._save_states()
            down = sum(1 for s in self._states.values() if s.status == "down")
            logger.info(
                "[model-health] refreshed %d models, down=%d",
                self._last_total, down,
            )

    async def _probe_model(
        self,
        model_id: str,
        provider_hint: str,
    ) -> tuple[bool, int, int, str, bool, bool]:
        """返回 (ok, http_status, latency_ms, error, account_level, model_level)。

        account_level=True 表示余额/配额/限流等账户级错误:不据此隐藏单个模型。
        model_level=True 表示上游明确不认识/已下线该模型(404、模型不存在文案):
        一次探测即可隐藏,不必等连续两次失败。
        """
        from ..core.config import settings

        hint_code = provider_hint.strip()
        code = _infer_provider_code(model_id) or hint_code
        if not code:
            return True, 0, 0, "", False, False  # 判不出厂商:不据此隐藏
        if code in _PROBE_SKIP_CODES:
            return True, 0, 0, "", False, False  # 非 OpenAI 兼容协议,交给 provider 级判定
        provider = free_provider_registry.get_by_code(code)
        if provider and provider.category == ProviderCategory.LOCAL:
            return True, 0, 0, "", False, False  # 本地服务由 local_provider_health 负责
        if not provider and not hint_code:
            return True, 0, 0, "", False, False

        api_key, api_base = _resolve_credentials(code)
        # 推断厂商没有凭据、但目录条目登记了另一个厂商:改用条目登记的厂商,
        # 避免用错误厂商的 key/base 探测(裸模型名跨厂商重名时会被误判成 down)。
        if (
            (not api_base or (not api_key and code not in _ZERO_COST_CODES))
            and hint_code
            and hint_code != code
        ):
            h_key, h_base = _resolve_credentials(hint_code)
            if h_base and (h_key or hint_code in _ZERO_COST_CODES):
                code, api_key, api_base = hint_code, h_key, h_base
        if not api_base:
            return True, 0, 0, "", False, False  # 没有 base 无法探测,交给 provider 级判定
        if not api_key and code not in _ZERO_COST_CODES:
            return True, 0, 0, "", False, False  # 无凭据:provider 级过滤已负责

        upstream_model = _strip_upstream_prefix(model_id, code)
        headers: dict[str, str] = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        try:
            from ..core.provider_caps import resolve_provider_headers

            headers.update(resolve_provider_headers(code))
        except Exception:
            pass

        proxy = (
            (settings.sync_proxy_url_by_provider.get(code) or settings.sync_proxy_url or "").strip()
        ) or None
        payload: dict[str, Any] = {
            "model": upstream_model,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 1,
            "stream": False,
        }
        chat_url = _chat_url(api_base, code)

        start = time.monotonic()
        try:
            async with httpx.AsyncClient(
                timeout=PROBE_TIMEOUT_S, proxy=proxy, follow_redirects=True
            ) as client:
                resp = await client.post(chat_url, headers=headers, json=payload)
                if resp.status_code in (400, 422) and _needs_completion_tokens(
                    resp.text or ""
                ):
                    # OpenAI o1/o3/o4 等推理模型拒绝 max_tokens:换 max_completion_tokens 再试
                    payload.pop("max_tokens", None)
                    payload["max_completion_tokens"] = 1
                    resp = await client.post(chat_url, headers=headers, json=payload)
                if resp.status_code in (400, 422) and _needs_stream(resp.text or ""):
                    # 少数厂商只允许流式调用:换 stream=True 再试,避免把可用模型误判为死亡
                    payload["stream"] = True
                    resp = await client.post(chat_url, headers=headers, json=payload)
            latency_ms = int((time.monotonic() - start) * 1000)
            # 分类必须基于完整响应文本:关键词可能出现在前 180 字符之后,
            # 只按截断文本分类会漏判余额耗尽/模型不存在等语义。
            raw_text = resp.text or ""
            body = raw_text[:180].replace("\n", " ")
            if resp.status_code == 200:
                # 200 也可能带错误体(部分代理/厂商把错误包在 HTTP 200 里),必须校验
                content_type = (resp.headers.get("content-type") or "").lower()
                if "html" in content_type or raw_text.lstrip().lower().startswith("<"):
                    return (
                        False, 200, latency_ms,
                        "HTTP 200 但返回 HTML 页面(疑似网关/代理劫持)",
                        True, False,
                    )
                try:
                    data = resp.json()
                except Exception:
                    data = None
                err_payload: Any = None
                if isinstance(data, dict):
                    if data.get("error") or data.get("errors") or data.get("success") is False:
                        err_payload = data
                    else:
                        code_val = data.get("code")
                        if (
                            isinstance(code_val, int)
                            and code_val != 0
                            and not data.get("choices")
                        ):
                            err_payload = data
                elif (
                    isinstance(data, list)
                    and data
                    and isinstance(data[0], dict)
                    and data[0].get("error")
                ):
                    err_payload = data[0]
                if err_payload is not None:
                    full_detail = _redact_secrets(
                        json.dumps(err_payload, ensure_ascii=False)
                    )
                    account_level, model_level = _classify_error(full_detail, 200)
                    detail = full_detail[:150]
                    return (
                        False, 200, latency_ms,
                        f"HTTP 200 但响应体报错: {detail}",
                        account_level, model_level,
                    )
                if isinstance(data, dict):
                    choices = data.get("choices")
                    if isinstance(choices, list) and not choices:
                        # 200 却没有任何候选输出:该模型当前不可用
                        return (
                            False, 200, latency_ms,
                            "HTTP 200 但 choices 为空",
                            False, False,
                        )
                return True, 200, latency_ms, "", False, False
            account_level, model_level = _classify_error(raw_text, resp.status_code)
            return (
                False, resp.status_code, latency_ms,
                _redact_secrets(f"HTTP {resp.status_code}: {body}"),
                account_level,
                model_level,
            )
        except httpx.TimeoutException as e:
            # 连接/连接池超时属网络基础设施问题,不据此隐藏模型(provider 级会判整家);
            # 读超时视为该模型过慢/挂死,计失败次数。
            infra = isinstance(e, (httpx.ConnectTimeout, httpx.PoolTimeout))
            return (
                False, 0, int((time.monotonic() - start) * 1000),
                type(e).__name__,
                infra,
                False,
            )
        except (
            httpx.ConnectError,
            httpx.ProxyError,
            httpx.UnsupportedProtocol,
            # 传输层异常(重定向过多/连接被重置/协议被中间设备截断)属基础设施问题,
            # 不应据此把单个模型判死;provider 级健康检查会覆盖整家厂商。
            httpx.RemoteProtocolError,
            httpx.ReadError,
            httpx.WriteError,
            httpx.TooManyRedirects,
        ) as e:
            return (
                False, 0, int((time.monotonic() - start) * 1000),
                _redact_secrets(f"{type(e).__name__}: {str(e)[:120]}"),
                True,
                False,
            )
        except Exception as e:
            return (
                False, 0, int((time.monotonic() - start) * 1000),
                _redact_secrets(f"{type(e).__name__}: {str(e)[:120]}"),
                False,
                False,
            )


# 模块级单例
model_health = ModelHealthService()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
