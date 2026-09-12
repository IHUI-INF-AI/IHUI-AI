# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""FIM(Fill-in-the-Middle)代码补全端点(2026-09-07 立)。

对标 Cursor Tab(Supermaven) 的后端能力缺口:
为浏览器 IDE(Monaco inline completions)与 CLI ghost-text 提供
低延迟单轮补全推断。

设计约束(补全场景 ≠ 对话场景):
- 无会话/无记忆/无流式:单次 POST,返回首补全,延迟优先
- 前缀截尾(6000 字符)+ 后缀截头(2000 字符),控制 token 上限
- max_tokens 默认 128(补全只需数行),temperature=0
- 模型选型(2026-09-13 P1-9 立):env `FIM_PREFERRED_MODEL` > 用户显式 model >
  模型目录「补全专用档位」(`fim is True`)首个命中 > `'auto'`;
  候选清单带 TTL 惰性缓存、只读文件不查库,任何异常静默回退 `'auto'`,
  绝不阻塞补全主链路。`'auto'` 最终由网关 _resolve_auto_model 优先 zero_cost/LOCAL → cheap
- 鉴权沿用 llm 路由族约定(网关/代理层统一处理,路由内不做 JWT)

用法:
    POST /api/llm/fim
    {"prefix": "def add(a, b):\\n    ", "suffix": "\\n\\nprint(add(1,2))",
     "language": "python"}
    → {"code": 0, "message": "ok", "data": {"completion": "return a + b", ...}}

    POST /api/llm/fim/metrics          # 前端防抖上报指标增量快照
    GET  /api/llm/fim/metrics/summary  # 按模型汇总接受率/延迟分位/告警(管理看板)
"""

from __future__ import annotations

import logging
import math
import os
import threading
import time
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..core.llm_gateway import llm_gateway
from ..services.model_catalog import annotate_models, pick_fim_model

logger = logging.getLogger(__name__)

router = APIRouter()

# 上下文窗口约束:补全不需要(也不应该)看到全部文件
_PREFIX_TAIL_CHARS = 6_000
_SUFFIX_HEAD_CHARS = 2_000
_MAX_TOKENS_CAP = 512

# ---------------------------------------------------------------------------
# 补全专用档位选型(2026-09-13 P1-9)
#
# 方案落定:模块级 TTL 惰性缓存 + 同源基线清单,不查库、不做可用性过滤、
# 不引入任何远端调用,保证补全低延迟路径不被拖慢。
#   - 候选来源复用 /llm/models 同源基线 `llm._load_default_models()`
#     (data/default_models.json),再经 model_catalog.annotate_models 打上 fim 标记。
#   - DB 同步的补全模型(如 openrouter/...-coder)可用 env `FIM_PREFERRED_MODEL` 显式指定。
#   - 任何异常一律吞掉 → 回退 'auto',绝不影响补全。
# ---------------------------------------------------------------------------
_FIM_CANDIDATE_TTL_S = 300.0  # 候选清单缓存 5 分钟
_fim_candidates_cache: list[dict[str, Any]] = []
_fim_candidates_cached_at = 0.0
_fim_candidates_lock = threading.Lock()


def _load_fim_candidates() -> list[dict[str, Any]]:
    """加载「补全专用档位」候选模型(TTL 300s 缓存,失败返回空列表)。

    只加载 /llm/models 的同源基线清单(文件解析一次 + 分类标注),不做 DB 查询、
    不做 provider 可用性过滤,单次成本极低且带缓存。异常一律吞掉并返回空列表。
    """
    global _fim_candidates_cache, _fim_candidates_cached_at
    now = time.monotonic()
    if _fim_candidates_cached_at > 0 and now - _fim_candidates_cached_at < _FIM_CANDIDATE_TTL_S:
        return _fim_candidates_cache
    with _fim_candidates_lock:
        # 双检:并发请求只让第一个真正加载
        now = time.monotonic()
        if _fim_candidates_cached_at > 0 and now - _fim_candidates_cached_at < _FIM_CANDIDATE_TTL_S:
            return _fim_candidates_cache
        candidates: list[dict[str, Any]] = []
        try:
            from .llm import _load_default_models  # 与 /llm/models 同源基线

            loaded = _load_default_models()
            if isinstance(loaded, list):
                candidates = [m for m in loaded if isinstance(m, dict)]
                annotate_models(candidates)
        except Exception as e:  # noqa: BLE001 — 候选加载失败必须静默降级,不能影响补全
            logger.debug("fim 候选模型加载失败(降级 auto): %s", e)
            candidates = []
        _fim_candidates_cache = candidates
        _fim_candidates_cached_at = time.monotonic()
        return _fim_candidates_cache


def _resolve_fim_model(requested: str | None) -> str:
    """解析本次补全使用的模型,绝不抛异常、绝不阻塞。

    优先级:env `FIM_PREFERRED_MODEL` > 用户显式 model > 候选清单首个 fim 模型 > 'auto'。
    """
    try:
        preferred = (os.environ.get("FIM_PREFERRED_MODEL") or "").strip()
        if preferred:
            return preferred
        picked = pick_fim_model(_load_fim_candidates(), requested)
        if picked:
            return picked
    except Exception as e:  # noqa: BLE001 — 选型失败静默回退,补全不能被选型拖垮
        logger.debug("fim 模型选型降级(auto): %s", e)
    return requested or "auto"

_SYSTEM_PROMPT = (
    "You are a code completion engine (fill-in-the-middle). "
    "You are given the code BEFORE the cursor and AFTER the cursor. "
    "Output ONLY the code that belongs exactly at the <CURSOR> position. "
    "Rules:\n"
    "1. No explanations, no comments about what you did, no markdown fences.\n"
    "2. Continue the code naturally — complete the current line/statement/block.\n"
    "3. Usually 1-8 lines. Stop at a natural boundary.\n"
    "4. Do not repeat code that already exists before or after the cursor.\n"
    "5. Match the file's indentation and style."
)


class FIMRequest(BaseModel):
    """FIM 补全请求。"""

    prefix: str = Field(..., description="光标前代码")
    suffix: str = Field("", description="光标后代码(可为空=文件末尾)")
    language: str = Field("text", description="语言标识(ts/python/go/...)")
    model: str | None = Field(None, description="模型,默认 auto(本地/零成本优先)")
    max_tokens: int = Field(128, ge=1, le=_MAX_TOKENS_CAP, description="补全上限 token")
    owner_uuid: str | None = Field(None, description="用户 UUID(模型私有配置匹配)")


# ---------------------------------------------------------------------------
# 补全接受率闭环(2026-09-13 P1-9 立,对标 Trae CUE Tab 的接受率反馈)
#
# 前端 CodeEditor 防抖 5s 上报**增量快照**(累计值之差,非全量累计),
# 后端进程内按 model 聚合,供管理看板「FIM 补全接受率」区块消费。
# 单进程内存态:不持久化、重启清零,与 llm 路由族其他运行指标口径一致。
# ---------------------------------------------------------------------------

_LATENCY_SAMPLES_CAP = 500  # 每模型延迟样本上限,防止无界增长
_ALERT_ACCEPTANCE_RATE = 0.3  # 接受率告警阈值(严格小于才告警)
_ALERT_MIN_SUGGESTIONS = 20  # 触发告警的最少建议数(样本不足不告警)


class FIMMetricsReport(BaseModel):
    """前端上报的补全指标增量快照(本次相对上次上报的增量)。"""

    model: str = Field("auto", description="实际使用的模型 id(auto=后端自选)")
    requestCount: int = Field(0, ge=0, description="补全请求数增量")
    suggestionCount: int = Field(0, ge=0, description="返回非空建议数增量")
    acceptedCount: int = Field(0, ge=0, description="用户接受建议数增量")
    dismissedCount: int = Field(0, ge=0, description="建议展示后被忽略数增量")
    failureCount: int = Field(0, ge=0, description="失败数增量")
    cancellationCount: int = Field(0, ge=0, description="取消数增量")
    cacheHitCount: int = Field(0, ge=0, description="缓存命中数增量")
    latencyMs: list[float] = Field(default_factory=list, description="本次新增延迟样本(ms)")


#: 进程内聚合:model → 计数 + 延迟滑窗。threading.Lock 保护读写(端点极短,同步锁足够)。
_METRICS_BY_MODEL: dict[str, dict[str, Any]] = {}
_METRICS_LOCK = threading.Lock()


def _percentile(sorted_values: list[float], pct: float) -> int | None:
    """线性插值分位数(输入必须已升序)。空列表 → None,单样本 → 其本身。"""
    if not sorted_values:
        return None
    if len(sorted_values) == 1:
        return int(round(sorted_values[0]))
    k = (len(sorted_values) - 1) * (pct / 100.0)
    lo = math.floor(k)
    hi = math.ceil(k)
    if lo == hi:
        return int(round(sorted_values[lo]))
    value = sorted_values[lo] + (sorted_values[hi] - sorted_values[lo]) * (k - lo)
    return int(round(value))


def _strip_fences(text: str) -> str:
    """剥离模型偶尔输出的 markdown 代码围栏(补全场景禁止围栏)。"""
    stripped = text.strip()
    if stripped.startswith("```"):
        first_nl = stripped.find("\n")
        if first_nl != -1:
            stripped = stripped[first_nl + 1 :]
        if stripped.rstrip().endswith("```"):
            stripped = stripped.rstrip()[:-3]
    return stripped.strip("\n")


def _build_user_prompt(prefix: str, suffix: str, language: str) -> str:
    prefix_tail = prefix[-_PREFIX_TAIL_CHARS:]
    suffix_head = suffix[:_SUFFIX_HEAD_CHARS]
    return (
        f"Language: {language}\n"
        "----- code before cursor -----\n"
        f"{prefix_tail}\n"
        "----- <CURSOR> -----\n"
        "----- code after cursor -----\n"
        f"{suffix_head}\n"
        "----- end -----\n"
        "Output the code for <CURSOR> only."
    )


@router.post("/llm/fim", response_model=None)
async def fim_complete(req: FIMRequest) -> dict[str, Any]:
    """单轮 FIM 代码补全(低延迟、无状态)。

    Returns:
        {code, message, data: {completion, model, latency_ms, stub}}
        空 prefix 返回空 completion(200,便于客户端短路)。
    """
    if not req.prefix:
        return {"code": 0, "message": "ok", "data": {"completion": "", "model": "", "latency_ms": 0, "stub": False}}

    started = time.perf_counter()
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": _build_user_prompt(req.prefix, req.suffix, req.language)},
    ]
    # 补全专用档位选型(内部已吞异常,不会抛出、不阻塞)
    model = _resolve_fim_model(req.model)
    try:
        result = await llm_gateway.complete(
            messages,
            model,
            owner_uuid=req.owner_uuid,
            max_tokens=req.max_tokens,
            temperature=0.0,
            stop=["\n\n\n", "----- code before cursor -----"],
        )
        raw = str(result.get("content") or "")
        completion = _strip_fences(raw)
        latency_ms = int((time.perf_counter() - started) * 1000)
        return {
            "code": 0,
            "message": "ok",
            "data": {
                "completion": completion,
                "model": result.get("model", ""),
                "latency_ms": latency_ms,
                "stub": bool(result.get("stub", False)),
            },
        }
    except Exception as e:  # noqa: BLE001 — 补全失败必须静默降级,绝不能打断打字流
        logger.warning("fim_complete failed: %s: %s", type(e).__name__, str(e)[:200])
        return {
            "code": 0,
            "message": "fim degraded",
            "data": {"completion": "", "model": "", "latency_ms": int((time.perf_counter() - started) * 1000), "stub": False},
        }


@router.post("/llm/fim/metrics", response_model=None)
async def report_fim_metrics(req: FIMMetricsReport) -> dict[str, Any]:
    """接收前端补全指标增量快照并按 model 聚合(上报永远不阻塞编辑器)。

    Returns:
        {code, message, data: {model}} —— 仅回执,不做重计算。
    """
    model = (req.model or "auto").strip() or "auto"
    with _METRICS_LOCK:
        slot = _METRICS_BY_MODEL.setdefault(
            model,
            {
                "requests": 0,
                "suggestions": 0,
                "accepted": 0,
                "dismissed": 0,
                "failures": 0,
                "cancellations": 0,
                "cacheHits": 0,
                "latencies": [],
            },
        )
        slot["requests"] += req.requestCount
        slot["suggestions"] += req.suggestionCount
        slot["accepted"] += req.acceptedCount
        slot["dismissed"] += req.dismissedCount
        slot["failures"] += req.failureCount
        slot["cancellations"] += req.cancellationCount
        slot["cacheHits"] += req.cacheHitCount
        if req.latencyMs:
            # 单次上报也截断,防止异常客户端塞入超大数组
            slot["latencies"].extend(float(x) for x in req.latencyMs[-_LATENCY_SAMPLES_CAP:])
            if len(slot["latencies"]) > _LATENCY_SAMPLES_CAP:
                slot["latencies"] = slot["latencies"][-_LATENCY_SAMPLES_CAP:]
    return {"code": 0, "message": "ok", "data": {"model": model}}


@router.get("/llm/fim/metrics/summary", response_model=None)
async def fim_metrics_summary() -> dict[str, Any]:
    """按模型汇总补全接受率与延迟分位,附低接受率告警。

    Returns:
        {code, message, data: {models: [{model, requests, suggestions, accepted,
         acceptanceRate, failures, p50LatencyMs, p95LatencyMs, alert, alertReason}]}}
        无数据时 models=[](空列表,不报错)。
    """
    with _METRICS_LOCK:
        snapshot = {
            model: {**slot, "latencies": list(slot["latencies"])}
            for model, slot in _METRICS_BY_MODEL.items()
        }

    rows: list[dict[str, Any]] = []
    for model in sorted(snapshot):
        slot = snapshot[model]
        suggestions = slot["suggestions"]
        accepted = slot["accepted"]
        # 无建议样本时接受率不可计算 → None(前端显示为 "—")
        rate = (accepted / suggestions) if suggestions > 0 else None
        latencies = sorted(slot["latencies"])
        alert = (
            rate is not None
            and rate < _ALERT_ACCEPTANCE_RATE
            and suggestions >= _ALERT_MIN_SUGGESTIONS
        )
        rows.append(
            {
                "model": model,
                "requests": slot["requests"],
                "suggestions": suggestions,
                "accepted": accepted,
                "dismissed": slot["dismissed"],
                "acceptanceRate": rate,
                "failures": slot["failures"],
                "cancellations": slot["cancellations"],
                "cacheHits": slot["cacheHits"],
                "p50LatencyMs": _percentile(latencies, 50),
                "p95LatencyMs": _percentile(latencies, 95),
                "alert": alert,
                "alertReason": (
                    f"acceptance {rate:.1%} < {_ALERT_ACCEPTANCE_RATE:.0%} "
                    f"(suggestions={suggestions})"
                    if alert
                    else None
                ),
            }
        )
    return {"code": 0, "message": "ok", "data": {"models": rows}}
