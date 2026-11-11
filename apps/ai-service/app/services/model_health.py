# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""模型级连通探测(2026-11-07 立,用户规则:测不通的模型不进选择器列表)。

与 model_availability 的分工:
- model_availability 是 **provider 级**健康检查(看整家厂商 /v1/models 或推理 ping,
  一家厂商里任一模型通就判整家 HEALTHY ⇒ 单个模型坏死仍会继续显示,用户实测踩到)。
- 本模块是 **模型级**探测:对目录里每个候选模型发一次 max_tokens=8 的流式请求
  (SSE 首块解析成功即流式达标;失败再退回非流式 max_tokens=1),
  明确模型级错误(404/模型不存在/余额耗尽)一次即隐藏,其余失败连续两次才隐藏,
  由 /llm/models 过滤掉。
- 2026-11-11 起额外实测工具调用(每可用模型 +1 请求)与长上下文(每轮预算 1 个、
  7 天轮转);三项能力只标注、不参与隐藏判定。

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
from dataclasses import dataclass, replace
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
# 2026-11-11:8 → 4。每轮每模型已从 1 个请求变成 2 个(可用性+工具),8 并发时
# 平台中转账号池成片 ReadTimeout / 429,能力只能记"未知",探测本身成了噪声源。
PROBE_CONCURRENCY = 4
# 工具探测单独的超时:中转账号池慢,20s 会把"慢但支持"误记成未知
_TOOL_PROBE_TIMEOUT_S = 45.0
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
    "overdue-payment",
    "overdue payment",
    "account is in good standing",
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
    "accessdenied.unpurchased",
    "only available on agentic harnesses",
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


def _opt_bool(value: Any) -> bool | None:
    """状态文件里的三态布尔:只认真正的 JSON bool,其余一律视为未知。"""
    return value if isinstance(value, bool) else None


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
    """单个模型的最近一次探测结果(可用性 + 已实测能力)。"""

    status: str = "pending"  # pending / healthy / down
    checked_at: float = 0.0
    error: str = ""
    latency_ms: int = 0
    consecutive_failures: int = 0
    # 2026-11-11 立:用户要求把验收标准从"端口活着"提升到实测能力。
    # 三项能力只做标注,不参与 filter_available 的 down 判定(不支持 ≠ 隐藏)。
    stream_ok: bool | None = None
    stream_ttft_ms: int = 0
    tools_ok: bool | None = None
    tools_error: str = ""
    context_tokens: int = 0
    context_ok: bool | None = None
    context_error: str = ""
    context_checked_at: float = 0.0


@dataclass
class ProbeOutcome:
    """一次模型级探测的完整结论(可用性 + 流式/工具能力)。"""

    ok: bool
    http_status: int = 0
    latency_ms: int = 0
    error: str = ""
    account_level: bool = False
    model_level: bool = False
    stream_ok: bool | None = None
    stream_ttft_ms: int = 0
    tools_ok: bool | None = None
    tools_error: str = ""


@dataclass
class _ProbeTarget:
    """探测所需的连接信息(可用性 / 工具 / 长上下文共用)。"""

    code: str
    chat_url: str
    headers: dict[str, str]
    proxy: str | None
    upstream_model: str


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


def _relay_keeps_full_id(provider_code: str) -> bool:
    """relay 网关按目录里的完整 id 路由,直连厂商才需要剥掉网关前缀。

    自家账号池 relay(workbuddy_relay 等)的白名单按带厂商前缀的 id 登记
    (如 workbuddy/*),剥成 kimi-k3-1 会被 403「模型不在白名单」拒绝 ——
    可用性探测曾用完整 id 复测兜底,但工具/长上下文探测没有兜底,于是整家
    平台模型的能力结论都被这个 403 污染。统一在这里决定,三处探测共用。
    """
    return provider_code.endswith("_relay")


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


# 流式探测被拒后仍值得用非流式复测的状态码:多为"不支持流式参数/工具参数"类拒绝,
# 不代表模型不可用;404/401/402/429 等明确不可用或账户级问题不复测,省一次请求。
_STREAM_FALLBACK_STATUS = frozenset({400, 405, 422, 501})
# 工具调用探测用量:极简 function tool + 256 tokens,成本可忽略。
# 不能压到 64:推理模型会先把预算花在思考上,截断后根本没机会发 tool_calls,
# 实测会把 kimi-k3/k2.7 这类明确支持工具的模型误判成"未实际触发"。
_TOOL_PROBE_MAX_TOKENS = 256
# 长上下文针测的超时:16k token 预填充比 ping 慢,给 3 倍预算(60s)。
CONTEXT_PROBE_TIMEOUT_S = PROBE_TIMEOUT_S * 3
# 判定"请求内容与工具/function 有关"的关键词(400/422 时区分能力缺失与协议错误)。
_TOOL_KEYWORDS = ("tool", "function", "tools", "functions")


def _env_int(name: str, default: int, minimum: int = 1) -> int:
    """读取正整数环境变量;非法值回退默认值(不因误配让探测逻辑崩溃)。"""
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return max(minimum, int(str(raw).strip()))
    except ValueError:
        return default


def _env_float(name: str, default: float, minimum: float = 0.0) -> float:
    raw = os.environ.get(name)
    if raw is None or not str(raw).strip():
        return default
    try:
        return max(minimum, float(str(raw).strip()))
    except ValueError:
        return default


def _context_probe_tokens() -> int:
    return _env_int("MODEL_HEALTH_CONTEXT_PROBE_TOKENS", 16000, minimum=256)


def _context_probe_days() -> float:
    return _env_float("MODEL_HEALTH_CONTEXT_PROBE_DAYS", 7.0, minimum=0.0)


def _context_probes_per_cycle() -> int:
    # 0 = 暂停长上下文针测(省钱开关)。
    # 默认 3:16k 预填充单次成本仍可忽略,而 40 多个可用模型的首次覆盖若按 1 个/轮
    # 要跑将近一天,用户在前端只能看到零星几个模型有长上下文结论。
    return _env_int("MODEL_HEALTH_CONTEXT_PROBES_PER_CYCLE", 3, minimum=0)


def _build_probe_target(model_id: str, provider_hint: str) -> _ProbeTarget | None:
    """解析探测目标;返回 None 表示该模型不由本模块直连探测。

    跳过条件与原 _probe_model 完全一致(非 OpenAI 兼容 / 本地 provider /
    无 base / 无凭据),避免把无法探测的模型误判为 down。
    """
    from ..core.config import settings

    hint_code = provider_hint.strip()
    code = _infer_provider_code(model_id) or hint_code
    if not code:
        return None
    if code in _PROBE_SKIP_CODES:
        return None
    provider = free_provider_registry.get_by_code(code)
    if provider and provider.category == ProviderCategory.LOCAL:
        return None
    if not provider and not hint_code:
        return None

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
        return None
    if not api_key and code not in _ZERO_COST_CODES:
        return None

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
    return _ProbeTarget(
        code=code,
        chat_url=_chat_url(api_base, code),
        headers=headers,
        proxy=proxy,
        upstream_model=(
            model_id if _relay_keeps_full_id(code) else _strip_upstream_prefix(model_id, code)
        ),
    )


def _sse_chunk_has_content(line: str) -> bool:
    """判断一行 SSE 是否是"可解析出 choices/delta"的有效内容块。

    只看 `data:` 行;`[DONE]`、心跳、注释行不算。收到任意一条即证明流式链路可用。
    """
    stripped = (line or "").strip()
    if not stripped.startswith("data:"):
        return False
    data_str = stripped[5:].strip()
    if not data_str or data_str == "[DONE]":
        return False
    try:
        data = json.loads(data_str)
    except Exception:
        return False
    if not isinstance(data, dict) or data.get("error"):
        return False
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
        return False
    first = choices[0]
    return isinstance(first.get("delta"), dict) or isinstance(first.get("message"), dict)


def _evaluate_200_body(raw_text: str) -> tuple[bool, str, bool, bool]:
    """校验 HTTP 200 的响应体,返回 (ok, error, account_level, model_level)。

    部分代理/厂商把错误包在 HTTP 200 里(HTML 网关页 / error 字段 / 空 choices),
    必须逐项校验,不能只看状态码。
    """
    text = raw_text or ""
    if text.lstrip().lower().startswith("<"):
        return False, "HTTP 200 但返回 HTML 页面(疑似网关/代理劫持)", True, False
    try:
        data = json.loads(text)
    except Exception:
        data = None
    err_payload: Any = None
    if isinstance(data, dict):
        if data.get("error") or data.get("errors") or data.get("success") is False:
            err_payload = data
        else:
            code_val = data.get("code")
            if isinstance(code_val, int) and code_val != 0 and not data.get("choices"):
                err_payload = data
    elif (
        isinstance(data, list)
        and data
        and isinstance(data[0], dict)
        and data[0].get("error")
    ):
        err_payload = data[0]
    if err_payload is not None:
        full_detail = _redact_secrets(json.dumps(err_payload, ensure_ascii=False))
        account_level, model_level = _classify_error(full_detail, 200)
        return False, f"HTTP 200 但响应体报错: {full_detail[:150]}", account_level, model_level
    if isinstance(data, dict):
        choices = data.get("choices")
        if isinstance(choices, list) and not choices:
            return False, "HTTP 200 但 choices 为空", False, False
    return True, "", False, False


def _judge_tools_response(status_code: int, raw_text: str) -> tuple[bool | None, str]:
    """把工具调用探测结果判为 True / False / None(未知)。

    - 200 且有 tool_calls ⇒ True
    - 200 但没调用 / 400·422 明确报错含 tool/function ⇒ False
    - 5xx / 鉴权 / 限流 ⇒ None(未知,不能误判为不支持)
    """
    text = raw_text or ""
    lowered = text.lower()
    body = _redact_secrets(text[:200].replace("\n", " "))
    if status_code == 200:
        try:
            data = json.loads(text)
        except Exception:
            return False, "HTTP 200 但工具探测响应无法解析"
        if not isinstance(data, dict):
            return False, "HTTP 200 但工具探测响应格式异常"
        if data.get("error"):
            if any(k in lowered for k in _TOOL_KEYWORDS):
                return False, f"HTTP 200 但响应体报错: {body[:150]}"
            return None, f"HTTP 200 但响应体报错: {body[:150]}"
        choices = data.get("choices")
        if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
            return False, "HTTP 200 但工具探测 choices 为空"
        message = choices[0].get("message")
        calls = message.get("tool_calls") if isinstance(message, dict) else None
        if isinstance(calls, list) and calls:
            return True, ""
        if choices[0].get("finish_reason") == "length":
            # 输出被 max_tokens 截断 ⇒ 无法判定(推理模型可能还在思考阶段),
            # 记"未知"而不是"不支持",避免在界面上给可用模型打错标签。
            return None, "输出被 max_tokens 截断,工具调用未判定"
        return False, "声明支持工具调用但未实际触发"
    if status_code in (400, 422) and any(k in lowered for k in _TOOL_KEYWORDS):
        return False, f"HTTP {status_code}: {body[:150]}"
    return None, (f"HTTP {status_code}: {body[:150]}" if body else "")


def _build_context_probe_text(tokens: int) -> tuple[str, str]:
    """构造确定性的长上下文针测文本,返回 (文本, 末尾验证码)。

    约 4 字符/token 的重复文本即可撑满上下文,不需要随机大文件;
    验证码由 tokens 派生,固定在末尾,模型只输出它才算长上下文可用。
    """
    tokens = max(256, int(tokens))
    code = f"IHUI-{tokens:06d}-OK"
    target_chars = max(1024, tokens * 4)
    filler = "The quick brown fox jumps over the lazy dog. "
    body = (filler * ((target_chars // len(filler)) + 1))[:target_chars]
    text = (
        "Read the following reference text, then answer the question at the end.\n\n"
        f"{body}\n\n"
        "Question: reply with ONLY the verification code that appears at the very end, "
        "no other words.\n"
        f"Verification code: {code}"
    )
    return text, code


def _check_context_probe_reply(reply: str, code: str) -> bool:
    """回复里出现验证码即视为长上下文针测通过(允许模型附加少量说明)。"""
    return bool(code) and code.lower() in (reply or "").lower()


async def _stream_chat(
    client: httpx.AsyncClient,
    url: str,
    headers: dict[str, str],
    payload: dict[str, Any],
) -> tuple[int, str, int | None]:
    """发一次流式 chat 请求,返回 (status, 聚合文本, 首块耗时 ms)。

    首块 = 第一条能解析出 choices/delta 的 SSE `data:` 块;None 表示没等到有效
    流式内容(上游直接返回非流式 JSON / HTML / 错误),交由调用方决定是否复测。
    """
    start = time.monotonic()
    async with client.stream("POST", url, headers=headers, json=payload) as resp:
        status = resp.status_code
        if status != 200:
            body = (await resp.aread()).decode("utf-8", "replace")
            return status, body, None
        lines: list[str] = []
        ttft_ms: int | None = None
        async for line in resp.aiter_lines():
            lines.append(line)
            if ttft_ms is None and _sse_chunk_has_content(line):
                ttft_ms = int((time.monotonic() - start) * 1000)
            if len(lines) >= 400:  # 只需判定首块,防止异常上游无限输出
                break
        return status, "\n".join(lines), ttft_ms


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

    def get_caps_verified(self, model_id: str) -> dict[str, Any]:
        """实测能力摘要(供 /llm/models 透出);null 表示未测/未知。

        tokens 未测时回填本轮配置的针测规模,前端可据此展示"将按 16k 验证"。
        """
        state = self._states.get(model_id)
        if state is None:
            return {
                "stream": None,
                "tools": None,
                "context": {"ok": None, "tokens": _context_probe_tokens()},
            }
        return {
            "stream": state.stream_ok,
            "tools": state.tools_ok,
            "context": {
                "ok": state.context_ok,
                "tokens": state.context_tokens or _context_probe_tokens(),
            },
        }

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
        prev = self._states.get(cid) or ModelProbeState()
        if ok:
            self._states[cid] = replace(
                prev,
                status="healthy",
                checked_at=time.time(),
                error="",
                consecutive_failures=0,
            )
            self._save_states()
            return
        lowered = (error or "").lower()
        if any(k in lowered for k in _ACCOUNT_LEVEL_KEYWORDS) and not any(
            k in lowered for k in _BALANCE_EXHAUSTED_KEYWORDS
        ):
            return
        self._states[cid] = replace(
            prev,
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
                    stream_ok=_opt_bool(item.get("stream_ok")),
                    stream_ttft_ms=int(item.get("stream_ttft_ms") or 0),
                    tools_ok=_opt_bool(item.get("tools_ok")),
                    tools_error=str(item.get("tools_error") or "")[:200],
                    context_tokens=int(item.get("context_tokens") or 0),
                    context_ok=_opt_bool(item.get("context_ok")),
                    context_error=str(item.get("context_error") or "")[:200],
                    context_checked_at=float(item.get("context_checked_at") or 0),
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
                        "stream_ok": s.stream_ok,
                        "stream_ttft_ms": s.stream_ttft_ms,
                        "tools_ok": s.tools_ok,
                        "tools_error": _redact_secrets(s.tools_error),
                        "context_tokens": s.context_tokens,
                        "context_ok": s.context_ok,
                        "context_error": _redact_secrets(s.context_error),
                        "context_checked_at": s.context_checked_at,
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
                outcome = await self._probe_model(mid, provider_hint)
            async with self._lock:
                prev = self._states.get(mid) or ModelProbeState()
                if outcome.ok:
                    self._states[mid] = replace(
                        prev,
                        status="healthy",
                        checked_at=time.time(),
                        error="",
                        latency_ms=outcome.latency_ms,
                        consecutive_failures=0,
                        stream_ok=outcome.stream_ok,
                        stream_ttft_ms=outcome.stream_ttft_ms,
                        tools_ok=outcome.tools_ok,
                        tools_error=outcome.tools_error,
                    )
                elif outcome.account_level:
                    # 账户级错误(限流/鉴权)不隐藏模型,保留上次结论;但必须刷新 checked_at,
                    # 否则每 30 分钟复测也救不回 TTL,状态会过期导致隐藏过的模型复活。
                    prev.error = outcome.error
                    prev.checked_at = time.time()
                    prev.latency_ms = outcome.latency_ms
                    self._states[mid] = prev
                else:
                    failures = prev.consecutive_failures + 1
                    hide = outcome.model_level or failures >= MAX_CONSECUTIVE_FAILURES
                    self._states[mid] = replace(
                        prev,
                        status="down" if hide else prev.status,
                        checked_at=time.time(),
                        error=outcome.error,
                        latency_ms=outcome.latency_ms,
                        consecutive_failures=failures,
                    )
                self._last_done += 1

        try:
            await asyncio.gather(
                *[_probe_one(mid, hint) for mid, hint in candidates],
                return_exceptions=True,
            )
            # 长上下文针测按轮转预算单独跑(默认每轮最多 1 个、7 天复测一次),
            # 避免 16k token 请求铺满整轮把成本打高。
            await self._run_context_probes()
        finally:
            self._last_checked_at = time.time()
            self._running = False
            self._save_states()
            down = sum(1 for s in self._states.values() if s.status == "down")
            logger.info(
                "[model-health] refreshed %d models, down=%d",
                self._last_total, down,
            )

    async def _run_context_probes(self) -> None:
        """按「从未测优先 + 超过 N 天」轮转,每轮最多测 budget 个可用模型。"""
        budget = _context_probes_per_cycle()
        if budget <= 0:
            return
        tokens = _context_probe_tokens()
        max_age = _context_probe_days() * 86400
        now = time.time()
        due: list[tuple[float, str]] = []
        for mid, state in list(self._states.items()):
            if state.status != "healthy" or mid not in self._catalog:
                continue
            if state.context_checked_at and (now - state.context_checked_at) < max_age:
                continue
            due.append((state.context_checked_at, mid))
        # 从未测过(checked_at=0)排最前,其余按上次测试时间从旧到新
        due.sort(key=lambda item: (item[0] != 0.0, item[0]))
        tested = 0
        for _checked, mid in due:
            if tested >= budget:
                break
            target = _build_probe_target(mid, self._catalog.get(mid, ""))
            if target is None:  # 本地 provider / 无凭据:跳过,不占用本轮预算
                continue
            tested += 1
            try:
                ok, error = await self._probe_context(target, tokens)
            except Exception as e:  # pragma: no cover - 针测失败不阻断整轮
                ok, error = None, _redact_secrets(f"{type(e).__name__}: {e}")[:200]
            async with self._lock:
                state = self._states.get(mid)
                if state is None:
                    continue
                state.context_tokens = tokens
                state.context_ok = ok
                state.context_error = error[:200]
                state.context_checked_at = time.time()
            logger.info(
                "[model-health] context probe %s tokens=%d ok=%s",
                mid, tokens, ok,
            )

    async def _probe_model(
        self,
        model_id: str,
        provider_hint: str,
    ) -> ProbeOutcome:
        """可用性探测:流式优先,失败再退回非流式(不因流式问题判死模型)。

        stream_ok=True 表示 SSE 首块已解析成功;False 表示可用但流式不达标;
        None 表示模型不可用 / 未探测。工具调用能力在同一连接上顺带测一次。
        """
        target = _build_probe_target(model_id, provider_hint)
        if target is None:
            # 判不出厂商 / 非 OpenAI 兼容 / 本地 provider / 无凭据:不据此隐藏
            return ProbeOutcome(ok=True)
        chat_url = target.chat_url
        headers = target.headers
        proxy = target.proxy
        upstream_model = target.upstream_model

        start = time.monotonic()
        try:
            async with httpx.AsyncClient(
                timeout=PROBE_TIMEOUT_S, proxy=proxy, follow_redirects=True
            ) as client:
                payload: dict[str, Any] = {
                    "model": upstream_model,
                    "messages": [{"role": "user", "content": "ping"}],
                    "max_tokens": 8,
                    "stream": True,
                }
                status, stream_text, ttft_ms = await _stream_chat(
                    client, chat_url, headers, payload
                )
                if status in (400, 422) and _needs_completion_tokens(stream_text):
                    # OpenAI o1/o3/o4 等推理模型拒绝 max_tokens:换 max_completion_tokens 再试
                    payload.pop("max_tokens", None)
                    payload["max_completion_tokens"] = 8
                    status, stream_text, ttft_ms = await _stream_chat(
                        client, chat_url, headers, payload
                    )
                if (
                    status == 403
                    and "白名单" in stream_text
                    and payload["model"] != model_id
                ):
                    # 自家 relay 网关(workbuddy_relay 等)的白名单按带厂商前缀的 id 登记
                    # (如 workbuddy/*),剥前缀探测会被 403「模型不在白名单」误杀;
                    # 换回完整 id 复测一次,避免把真实可用的平台模型判成未验证。
                    payload["model"] = model_id
                    status, stream_text, ttft_ms = await _stream_chat(
                        client, chat_url, headers, payload
                    )
                latency_ms = int((time.monotonic() - start) * 1000)
                probe_model_name = str(payload["model"])

                if status == 200 and ttft_ms is not None:
                    # 流式成功:可用 + 流式达标。工具调用复用同一连接再测一次(+1 请求)。
                    tools_ok, tools_error = await self._probe_tools(
                        client, chat_url, headers, probe_model_name
                    )
                    return ProbeOutcome(
                        ok=True,
                        http_status=200,
                        latency_ms=latency_ms,
                        stream_ok=True,
                        stream_ttft_ms=ttft_ms,
                        tools_ok=tools_ok,
                        tools_error=tools_error,
                    )

                if status == 200:
                    # 200 但没有可解析 SSE(非流式 JSON / 网关 HTML):先校验响应体
                    ok, error, account_level, model_level = _evaluate_200_body(stream_text)
                    if not ok:
                        return ProbeOutcome(
                            ok=False,
                            http_status=200,
                            latency_ms=latency_ms,
                            error=error,
                            account_level=account_level,
                            model_level=model_level,
                        )
                if status == 200 or status in _STREAM_FALLBACK_STATUS:
                    # 流式不可用/不达标:用原非流式 max_tokens=1 复测。
                    # 可用但流式不达标只记 stream_ok=False,绝不判死模型。
                    fallback, used_model = await self._non_stream_probe(
                        client,
                        chat_url,
                        headers,
                        probe_model_name,
                        model_id,
                    )
                    if not fallback.ok:
                        return fallback
                    tools_ok, tools_error = await self._probe_tools(
                        client, chat_url, headers, used_model
                    )
                    fallback.stream_ok = False
                    fallback.tools_ok = tools_ok
                    fallback.tools_error = tools_error
                    return fallback

                # 分类必须基于完整响应文本:关键词可能出现在前 180 字符之后,
                # 只按截断文本分类会漏判余额耗尽/模型不存在等语义。
                raw_text = stream_text or ""
                body = raw_text[:180].replace("\n", " ")
                account_level, model_level = _classify_error(raw_text, status)
                return ProbeOutcome(
                    ok=False,
                    http_status=status,
                    latency_ms=latency_ms,
                    error=_redact_secrets(f"HTTP {status}: {body}"),
                    account_level=account_level,
                    model_level=model_level,
                )
        except httpx.TimeoutException as e:
            # 连接/连接池超时属网络基础设施问题,不据此隐藏模型(provider 级会判整家);
            # 读超时视为该模型过慢/挂死,计失败次数。
            infra = isinstance(e, (httpx.ConnectTimeout, httpx.PoolTimeout))
            return ProbeOutcome(
                ok=False,
                http_status=0,
                latency_ms=int((time.monotonic() - start) * 1000),
                error=type(e).__name__,
                account_level=infra,
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
            return ProbeOutcome(
                ok=False,
                http_status=0,
                latency_ms=int((time.monotonic() - start) * 1000),
                error=_redact_secrets(f"{type(e).__name__}: {str(e)[:120]}"),
                account_level=True,
            )
        except Exception as e:
            return ProbeOutcome(
                ok=False,
                http_status=0,
                latency_ms=int((time.monotonic() - start) * 1000),
                error=_redact_secrets(f"{type(e).__name__}: {str(e)[:120]}"),
            )

    async def _non_stream_probe(
        self,
        client: httpx.AsyncClient,
        chat_url: str,
        headers: dict[str, str],
        model_name: str,
        full_model_id: str,
    ) -> tuple[ProbeOutcome, str]:
        """原非流式探测(max_tokens=1),用于流式不达标/不支持时的可用性兜底。"""
        start = time.monotonic()
        payload: dict[str, Any] = {
            "model": model_name,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 1,
            "stream": False,
        }
        resp = await client.post(chat_url, headers=headers, json=payload)
        if resp.status_code in (400, 422) and _needs_completion_tokens(resp.text or ""):
            payload.pop("max_tokens", None)
            payload["max_completion_tokens"] = 1
            resp = await client.post(chat_url, headers=headers, json=payload)
        if resp.status_code in (400, 422) and _needs_stream(resp.text or ""):
            # 上游只允许流式,但流式解析未达标:判可用,能力标注为缺失
            return (
                ProbeOutcome(
                    ok=True,
                    http_status=resp.status_code,
                    latency_ms=int((time.monotonic() - start) * 1000),
                    stream_ok=False,
                ),
                str(payload["model"]),
            )
        if (
            resp.status_code == 403
            and "白名单" in (resp.text or "")
            and payload["model"] != full_model_id
        ):
            payload["model"] = full_model_id
            resp = await client.post(chat_url, headers=headers, json=payload)
        latency_ms = int((time.monotonic() - start) * 1000)
        raw_text = resp.text or ""
        if resp.status_code == 200:
            ok, error, account_level, model_level = _evaluate_200_body(raw_text)
            return (
                ProbeOutcome(
                    ok=ok,
                    http_status=200,
                    latency_ms=latency_ms,
                    error=error,
                    account_level=account_level,
                    model_level=model_level,
                ),
                str(payload["model"]),
            )
        body = raw_text[:180].replace("\n", " ")
        account_level, model_level = _classify_error(raw_text, resp.status_code)
        return (
            ProbeOutcome(
                ok=False,
                http_status=resp.status_code,
                latency_ms=latency_ms,
                error=_redact_secrets(f"HTTP {resp.status_code}: {body}"),
                account_level=account_level,
                model_level=model_level,
            ),
            str(payload["model"]),
        )

    async def _probe_tools(
        self,
        client: httpx.AsyncClient,
        chat_url: str,
        headers: dict[str, str],
        model_name: str,
    ) -> tuple[bool | None, str]:
        """极简工具调用探测(+1 请求/可用模型/轮)。"""
        payload: dict[str, Any] = {
            "model": model_name,
            "messages": [
                {
                    "role": "user",
                    "content": "What is the weather in Beijing? Use the get_weather tool.",
                }
            ],
            "tools": [
                {
                    "type": "function",
                    "function": {
                        "name": "get_weather",
                        "description": "Get the current weather for a city.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "city": {"type": "string", "description": "City name"},
                            },
                            "required": ["city"],
                        },
                    },
                }
            ],
            # 用 required 强制模型必须调工具:上游若把 tools 静默丢掉,只会返回纯文本,
            # 这样"渠道不支持工具"与"模型这次碰巧没调"才分得开(否则全是模糊的未触发)。
            # 字符串形态是安全的(部分网关只认字符串,对象形态会 400 code=11101)。
            "tool_choice": "required",
            "max_tokens": _TOOL_PROBE_MAX_TOKENS,
            "stream": False,
        }
        try:
            # 工具探测单独放宽到 45s:平台中转账号池在探测并发下经常 20s 才回,
            # 用可用性那档 20s 会把"慢但支持"记成未知。
            resp = await client.post(
                chat_url, headers=headers, json=payload, timeout=_TOOL_PROBE_TIMEOUT_S
            )
            if resp.status_code in (400, 422) and _needs_completion_tokens(
                resp.text or ""
            ):
                payload.pop("max_tokens", None)
                payload["max_completion_tokens"] = _TOOL_PROBE_MAX_TOKENS
                resp = await client.post(
                    chat_url, headers=headers, json=payload, timeout=_TOOL_PROBE_TIMEOUT_S
                )
            # 只支持 auto/none 的上游会拒绝 required:退回 auto 再判一次
            if resp.status_code in (400, 422) and "tool_choice" in (resp.text or ""):
                payload["tool_choice"] = "auto"
                resp = await client.post(
                    chat_url, headers=headers, json=payload, timeout=_TOOL_PROBE_TIMEOUT_S
                )
            return _judge_tools_response(resp.status_code, resp.text or "")
        except Exception as e:
            # 超时 / 网络异常不能误判为"不支持工具调用"(记未知)
            return None, _redact_secrets(f"{type(e).__name__}: {str(e)[:120]}")[:200]

    async def _probe_context(
        self, target: _ProbeTarget, tokens: int
    ) -> tuple[bool | None, str]:
        """长上下文针测:填充文本 + 末尾验证码,只让模型输出验证码。"""
        text, code = _build_context_probe_text(tokens)
        payload: dict[str, Any] = {
            "model": target.upstream_model,
            "messages": [{"role": "user", "content": text}],
            "max_tokens": 24,
            "stream": False,
        }
        try:
            async with httpx.AsyncClient(
                timeout=CONTEXT_PROBE_TIMEOUT_S,
                proxy=target.proxy,
                follow_redirects=True,
            ) as client:
                resp = await client.post(
                    target.chat_url, headers=target.headers, json=payload
                )
                if resp.status_code in (400, 422) and _needs_completion_tokens(
                    resp.text or ""
                ):
                    payload.pop("max_tokens", None)
                    payload["max_completion_tokens"] = 24
                    resp = await client.post(
                        target.chat_url, headers=target.headers, json=payload
                    )
                raw = resp.text or ""
                if resp.status_code != 200:
                    summary = _redact_secrets(
                        f"HTTP {resp.status_code}: {raw[:150].replace(chr(10), ' ')}"
                    )
                    # 5xx 属上游临时故障;429/401/402/403 属账户级(限流/欠费/鉴权),
                    # 都只能记"未知",误记成 false 会让前端给模型打上"不支持长上下文"。
                    account_level, _model_level = _classify_error(
                        raw, resp.status_code
                    )
                    unknown = resp.status_code >= 500 or account_level
                    return (None if unknown else False), summary[:200]
                ok, error, _account, _model = _evaluate_200_body(raw)
                if not ok:
                    return False, error[:200]
                try:
                    data = json.loads(raw)
                except Exception:
                    return False, "针测响应无法解析"
                choices = data.get("choices") if isinstance(data, dict) else None
                if not isinstance(choices, list) or not choices:
                    return False, "针测响应 choices 为空"
                message = (
                    choices[0].get("message") if isinstance(choices[0], dict) else None
                )
                reply = ""
                if isinstance(message, dict):
                    content = message.get("content")
                    if isinstance(content, str):
                        reply = content
                    elif isinstance(content, list):
                        reply = "".join(
                            str(part.get("text") or "")
                            for part in content
                            if isinstance(part, dict)
                        )
                if _check_context_probe_reply(reply, code):
                    return True, ""
                return False, _redact_secrets(f"回复未包含验证码: {reply[:120]}")[:200]
        except httpx.TimeoutException as e:
            return None, type(e).__name__
        except Exception as e:
            return None, _redact_secrets(f"{type(e).__name__}: {str(e)[:120]}")[:200]


# 模块级单例
model_health = ModelHealthService()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
