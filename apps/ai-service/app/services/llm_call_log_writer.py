# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""llm_call_logs 逐条落库写入器(2026-10-22 立,AI 网关逐条落库票)。

背景:此前 `llm_call_logs` 只有 Node 侧三处写入(relay-billing-service.ts:1194 /
admin/relay-channels.ts:790 / other/llm-stream-routes.ts:136),ai-service 网关自己
不写 ⇒ "这次请求命中哪个 provider、走了哪条腿、用了号池哪把 key、花了多少 token/成本"
在计费流水表里不可回溯。本模块是 Python 侧唯一写入口,范式照抄
`app/services/audit_service.py:193-223`(asyncio.create_task + pool.acquire + INSERT,
异常只 warn 降级,绝不带崩对话链路)。

三条铁律(与本仓 AGENTS.md 对齐):
1. **认证不等于授权(§5)**:`llm_call_logs.user_id` 是 NOT NULL + FK 的归属主体列,
   只接受**承载层(router)显式下传**的令牌主体(`resolve_request_user_id`,JWT 派生),
   不从 owner_uuid(模型配置归属者)反推、不信客户端自报。缺主体 ⇒ 不写入,
   且一条 INSERT 都不发出(用例锁定"副作用没发生")。
2. **不做数据库迁移(票面硬约束)**:号池 key(`key_pool_id`,顶层 uuid 列)、
   重试轮次(`attempt`)、命中腿(`call_route`/`leg_primary`/`combo_name`)等新维度
   落既有 `metadata` jsonb 列。**唯一例外**是 `config_id` —— 它是**既有列**
   (bigint,关联 `ai_model_config.id`,2026-09-13 那枚迁移建的),Python 侧此前
   一直没取;取到新值只准写它自己的列,不得再往 metadata 里塞同名键
   (用例 `test_config_id_is_written_as_bigint_column` 钉这一格归属)。
   metadata 键清单(ascii、稳定、可 grep,全仓唯一一份):
   - `writer`            : 常量 "ai-service.llm_gateway"(与 Node 侧写入行区分)
   - `attempt`           : 号池换 key 重试轮次(0 = 首次尝试)
   - `call_route`        : "direct"|"fallback"|"combo"|"native"|"key_pool_retry"|"openrouter_failover"
   - `leg_primary`       : 本腿是由哪个 primary 模型失败后改道而来(fallback/combo 腿才有)
   - `combo_name`        : combo 链名(route=combo 时)
   - `error_kind`        : 既有 llm_error_status 分类("4xx"/"timeout"...,失败行才有,复用不另立判据)
   - `config_source`     : "key_pool"|"byok_or_env"(key 取自号池还是 BYOK/env,取不到不猜)
   - `cost_source`       : "litellm"|"price_table"(成本是上游报价还是价目表估算)
   - `usage_estimated`   : true(provider 未回 usage、token_counter 估算;仅成立时写)
   - `model_requested`   : auto/改道前请求的模型名(与 model 列不同时才写)
   - `native_adapter`    : true(走厂商原生适配器而非 LiteLLM;仅成立时写)
   - `noChargeReason`    : "status=..."(失败行成本置 0 的留痕,与 Node 侧 relay-billing 同键)
3. **原文留存口径对齐 Node 侧 `buildRawTextColumns()`(apps/api/src/services/
   audit-log-service.ts:631),不另发明一套**:命中"用户显式选择不留存"
   (user_preferences group='privacy' key='llmRawRetentionOptOut' value='true')或
   env `LLM_CALL_LOG_RAW_RETENTION_DISABLED_KEY_IDS='*'`/含本行 key id 时,
   **写入即不留**(prompt=''、response=NULL、raw_retained=false,清除窗口为零);
   否则落原文(prompt 列 NOT NULL)。opt-out 查询失败/未预热 ⇒ 默认留存,
   fail-safe 方向与 Node 侧 raw-retention-optout.ts 文件头留档一致(刻意相反的
   fail-closed 方向不适用于此,原因同文:行为跳变会让对账出现无法解释的空洞)。

失败方向统一:任何一步(取池、opt-out 查询、INSERT)异常都只 `logger.warning` 降级,
本模块没有任何一条路径能把异常抛回推理主链路。
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

__all__ = [
    "LlmCallLogFields",
    "RawRetentionPolicy",
    "RawTextColumns",
    "build_raw_text_columns",
    "persist_llm_call_log",
    "prompt_from_messages",
    "resolve_raw_retention_policy",
    "schedule_llm_call_log",
]

# 与 Node 侧 relay-billing-service.ts:1139-1145 同一口径:原文列截断 5000 字符。
_MAX_RAW_CHARS = 5000
_TRUNCATE_SUFFIX = "...[truncated]"

# uuid 形状锁:llm_call_logs.user_id / key_pool_id 都是 uuid 列,形状不对的
# 主体(如 "system-worker"、dev 匿名串)不发 INSERT —— FK 报错刷日志没有意义,
# 而"缺主体就不写"正是本票的越权断言面。
_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)

# llm_call_logs 写侧列规格(packages/database/src/schema/llm-call-logs.ts:39-134)。
# retryable / refunded / api_key_id / client_ip / raw_retention_days
# 刻意**不写**:走各自 DEFAULT(§schema 注释"默认档 = 0 保守档,尚不知此列的写入口
# 走 DEFAULT"是明示的兼容路径;无迁移授权,不加列)。
# config_id(bigint,关联 ai_model_config.id;列自迁移 20260913000000 起在库)
# 自 2026-10-23 起写:值只来自 `_resolve_from_db` 命中的那一行 ai_model_config,
# 号池腿与环境变量兜底腿拿不到配置行 ⇒ 落 NULL(宁缺毋假,不拿 provider 猜 id)。
_INSERT_SQL = """
INSERT INTO llm_call_logs
    (user_id, model, prompt, response, raw_retained,
     prompt_tokens, completion_tokens, total_tokens,
     cache_read_tokens, cache_creation_tokens,
     latency_ms, status, error_message, conversation_id, metadata,
     provider_code, key_pool_id, cost_cents, http_status, ttft_ms,
     call_type, trace_id, config_id)
VALUES
    ($1::uuid, $2, $3, $4, $5::boolean,
     $6, $7, $8, $9, $10,
     $11, $12, $13, $14, $15::jsonb,
     $16, $17::uuid, $18::numeric, $19, $20,
     $21, $22, $23::bigint)
"""

# 用户级"不落原文"选择(Node 侧 raw-retention-optout.ts 的同一份存储事实,
# 只是读的是库而不是它的进程内缓存 —— 两个进程,不可能共享内存)。
_RAW_OPTOUT_SQL = (
    "SELECT value FROM user_preferences "
    "WHERE user_id = $1::uuid AND \"group\" = 'privacy' "
    "AND key = 'llmRawRetentionOptOut' LIMIT 1"
)
_RAW_OPTOUT_TTL_SECONDS = 60.0

# 与 Node 侧 audit-log-service.ts:552 同一全局默认(30 天)。
_DEFAULT_RAW_RETENTION_DAYS = 30


@dataclass(frozen=True)
class RawRetentionPolicy:
    """原文留存策略(env 解析结果)。与 Node RawRetentionPolicy 逐字段等价。"""

    default_days: int
    disabled_api_key_ids: tuple[str, ...]
    all: bool


@dataclass(frozen=True)
class RawTextColumns:
    """写入口的原文列取值(与 Node RawTextColumns 逐字段等价)。"""

    prompt: str
    response: str | None
    raw_retained: bool


def resolve_raw_retention_policy(
    env: Mapping[str, str] | None = None,
) -> RawRetentionPolicy:
    """从环境变量解析原文留存策略(纯函数;口径逐行对齐 Node resolveRawRetentionPolicy)。

    - LLM_CALL_LOG_RAW_RETENTION_DAYS: 全局默认天数,缺省/非法回落 30(非负取整)
    - LLM_CALL_LOG_RAW_RETENTION_DISABLED_KEY_IDS: 逗号分隔 key id;'*' = 全量关闭
    """
    source = env if env is not None else os.environ
    disabled = tuple(
        s.strip()
        for s in (source.get("LLM_CALL_LOG_RAW_RETENTION_DISABLED_KEY_IDS") or "").split(",")
        if s.strip()
    )
    all_disabled = "*" in disabled
    raw_days = (source.get("LLM_CALL_LOG_RAW_RETENTION_DAYS") or "").strip()
    default_days = _DEFAULT_RAW_RETENTION_DAYS
    if raw_days:
        try:
            parsed = int(float(raw_days))
        except ValueError:
            logger.warning(
                "[llm_call_log_writer] 非法留存天数 %r,已回落默认 %d",
                raw_days, _DEFAULT_RAW_RETENTION_DAYS,
            )
            parsed = -1
        if parsed >= 0:
            default_days = parsed
        elif raw_days:
            logger.warning(
                "[llm_call_log_writer] 非法留存天数 %r,已回落默认 %d",
                raw_days, _DEFAULT_RAW_RETENTION_DAYS,
            )
    return RawRetentionPolicy(
        default_days=0 if all_disabled else default_days,
        disabled_api_key_ids=() if all_disabled else disabled,
        all=all_disabled,
    )


def build_raw_text_columns(
    *,
    prompt: str,
    response: str | None,
    api_key_id: str | None = None,
    user_opted_out: bool = False,
    policy: RawRetentionPolicy | None = None,
) -> RawTextColumns:
    """判定一次写入应落到原文列的内容(**对齐** Node buildRawTextColumns)。

    关闭留存:prompt 落空串(列 NOT NULL,不写 NULL 破坏旧读端)、response 落 NULL
    (与清除器口径一致)、raw_retained=false(清除器因此跳过本行);
    归因/计费列(token 数、成本、key_pool_id、user_id)与留存法无关,调用方照常写。
    """
    resolved = policy if policy is not None else resolve_raw_retention_policy()
    disabled = (
        user_opted_out
        or resolved.all
        or (api_key_id is not None and api_key_id in resolved.disabled_api_key_ids)
    )
    if disabled:
        return RawTextColumns(prompt="", response=None, raw_retained=False)
    return RawTextColumns(
        prompt=_truncate_raw(prompt), response=_truncate_optional_raw(response), raw_retained=True
    )


def _truncate_raw(text: str) -> str:
    if len(text) > _MAX_RAW_CHARS:
        return text[:_MAX_RAW_CHARS] + _TRUNCATE_SUFFIX
    return text


def _truncate_optional_raw(text: str | None) -> str | None:
    if text is None:
        return None
    return _truncate_raw(text)


def prompt_from_messages(messages: list[dict[str, Any]]) -> str:
    """messages → prompt 列原文(与 Node llm-stream-routes.ts:132 同一形状 role:content)。"""
    parts: list[str] = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        content = msg.get("content", "")
        if content is None:
            content = ""
        parts.append(f"{msg.get('role', 'user')}:{content}")
    return "\n".join(parts)


@dataclass
class LlmCallLogFields:
    """一次上游调用尝试的落库入参(网关收口处逐条构造)。

    构造失败/缺主体时不发 INSERT;字段形状错在 `_as_*` 归一层被吸收成保守值。
    """

    user_id: str
    model: str
    status: str  # 'success' | 'error'(与表内 Node 写入口径同一词汇)
    prompt: str = ""
    response: str | None = None
    usage: dict[str, Any] = field(default_factory=dict)
    provider_code: str | None = None
    latency_ms: int = 0
    error_message: str | None = None
    error_kind: str | None = None
    http_status: int | None = None
    ttft_ms: int | None = None
    cost_usd: float | None = None
    cost_source: str | None = None
    key_pool_id: str | None = None
    config_id: int | None = None
    config_source: str | None = None
    attempt: int = 0
    call_route: str = "direct"
    leg_primary: str | None = None
    combo_name: str | None = None
    native_adapter: bool = False
    model_requested: str | None = None
    usage_estimated: bool = False
    conversation_id: str | None = None
    api_key_id: str | None = None
    call_type: str = "chat"
    trace_id: str | None = None


def _normalize_user_id(raw: Any) -> str | None:
    """归属主体形状锁:非空且为 uuid 形态才认(否则整行不写 —— 宁缺毋假)。"""
    if not isinstance(raw, str):
        return None
    candidate = raw.strip()
    if not candidate or not _UUID_RE.match(candidate):
        return None
    return candidate


def _as_non_negative_int(value: Any) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return 0
    return number if number > 0 else 0


def _optional_int(value: Any, maximum: int | None = None) -> int | None:
    if value is None:
        return None
    try:
        number = int(value)
    except (TypeError, ValueError):
        return None
    if number < 0:
        return None
    if maximum is not None:
        number = min(number, maximum)
    return number


def _optional_uuid(value: Any) -> str | None:
    if isinstance(value, str) and _UUID_RE.match(value.strip()):
        return value.strip()
    return None


# ai_model_config.id 是 bigserial(正整数);bool 在 Python 里是 int 的子类,
# 必须显式排除,否则 True 会被写成 config_id=1 冒充"命中了 1 号配置行"。
_BIGINT_MAX = 9_223_372_036_854_775_807


def _optional_config_id(value: Any) -> int | None:
    """config_id 列形状锁:只接受正整形态的 ai_model_config.id,其余一律 NULL。"""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value if 0 < value <= _BIGINT_MAX else None
    if isinstance(value, str) and value.strip().isdigit():
        number = int(value.strip())
        return number if 0 < number <= _BIGINT_MAX else None
    return None


def build_metadata(fields: LlmCallLogFields) -> dict[str, Any]:
    """按模块头注的键清单组装 metadata(只写成立/存在的键,不造占位值)。"""
    metadata: dict[str, Any] = {
        "writer": "ai-service.llm_gateway",
        "attempt": fields.attempt,
        "call_route": fields.call_route,
    }
    if fields.leg_primary:
        metadata["leg_primary"] = fields.leg_primary
    if fields.combo_name:
        metadata["combo_name"] = fields.combo_name
    if fields.error_kind:
        metadata["error_kind"] = fields.error_kind
    if fields.config_source:
        metadata["config_source"] = fields.config_source
    if fields.cost_source:
        metadata["cost_source"] = fields.cost_source
    if fields.usage_estimated:
        metadata["usage_estimated"] = True
    if fields.native_adapter:
        metadata["native_adapter"] = True
    if fields.model_requested and fields.model_requested != fields.model:
        metadata["model_requested"] = fields.model_requested
    # 失败调用不计费(与 Node relay-billing-service.ts:1185-1188 同一决策+同一留痕键;
    # 成本列本身由 _cost_cents 在失败行统一置 0,这里只留"为什么是 0")。
    if fields.status != "success" and (fields.cost_usd or 0.0) > 0:
        metadata["noChargeReason"] = f"status={fields.status}"
    return metadata


def _cost_cents(fields: LlmCallLogFields) -> float | None:
    if fields.status != "success":
        return 0.0
    if fields.cost_usd is None:
        return None
    return round(float(fields.cost_usd) * 100.0, 6)


def _build_trace_id(explicit: str | None) -> str | None:
    """trace id:显式传入优先,否则读本轮 contextvar(唯一出口 trace_context)。

    取不到就是 None(D172 口径:不得用占位串冒充);超长(>32)直接丢弃而非截断,
    让脏值留在可诊断的缺席态,不洗成"看起来合法"。
    """
    candidate = explicit
    if candidate is None:
        try:
            from app.middleware.trace_context import current_trace_id

            candidate = current_trace_id()
        except Exception:  # noqa: BLE001 - trace 面缺席只是少一个关联键,不判定失败
            candidate = None
    if not isinstance(candidate, str):
        return None
    trimmed = candidate.strip().lower()
    if len(trimmed) != 32 or not all(c in "0123456789abcdef" for c in trimmed):
        return None
    return trimmed


async def _default_pool_getter() -> Any:
    from app.core.db import get_db_pool

    return await get_db_pool()


# 模块级注入点(仅测试替换;生产路径恒为 _default_pool_getter,不落第二份判据)。
_pool_getter: Callable[[], Awaitable[Any]] = _default_pool_getter

# 用户级 opt-out 的进程内 TTL 缓存(读的是共享库,缓存只存在于本进程)。
_optout_cache: dict[str, tuple[float, bool]] = {}


async def _lookup_raw_retention_optout(pool: Any, user_id: str) -> bool:
    """该用户是否选择"不落原文"。查询失败 ⇒ False(默认留存,fail-safe 方向见头注)。"""
    cached = _optout_cache.get(user_id)
    now = time.monotonic()
    if cached is not None and now - cached[0] < _RAW_OPTOUT_TTL_SECONDS:
        return cached[1]
    try:
        async with pool.acquire() as conn:
            value = await conn.fetchval(_RAW_OPTOUT_SQL, user_id)
        opted_out: bool = value == "true"
    except Exception as e:
        logger.warning(
            "[llm_call_log_writer] 用户原文留存 opt-out 查询失败(按默认留存): %s", e
        )
        return False
    _optout_cache[user_id] = (now, opted_out)
    return opted_out


async def persist_llm_call_log(
    fields: LlmCallLogFields,
    *,
    pool: Any | None = None,
    raw_optout_lookup: Callable[[str], Awaitable[bool]] | None = None,
    policy: RawRetentionPolicy | None = None,
) -> bool:
    """把一次调用尝试写入 llm_call_logs(本模块唯一 INSERT 出口)。

    Returns:
        True  = INSERT 已执行;False = 未写入(缺主体/主体形状非法/任何异常)。
        永不抛异常 —— 落库失败只 warn 降级(audit_service._persist_entry 同款契约)。
    """
    user_id = _normalize_user_id(fields.user_id)
    if user_id is None:
        # 越权/归属用例的断言面:缺主体 ⇒ 一条 INSERT 都不发出。
        logger.debug(
            "[llm_call_log_writer] user_id 缺失或非 uuid 形态,跳过写入(model=%s)", fields.model
        )
        return False
    try:
        resolved_policy = policy if policy is not None else resolve_raw_retention_policy()
        # 留存判定顺序(与 Node buildRawTextColumns 的 disabled 三条件等价):
        # 1) 显式注入的 opt-out 查询(测试/调用方控制面) 2) env 全量关闭 3) 默认库查。
        user_opted_out = False
        if raw_optout_lookup is not None:
            user_opted_out = await raw_optout_lookup(user_id)
        active_pool = pool
        if active_pool is None:
            active_pool = await _pool_getter()
        if raw_optout_lookup is None and not resolved_policy.all:
            # 默认 opt-out 查询与 INSERT 共用同一个池,不另开连接面
            user_opted_out = await _lookup_raw_retention_optout(active_pool, user_id)
        raw_cols = build_raw_text_columns(
            prompt=fields.prompt,
            response=fields.response,
            api_key_id=fields.api_key_id,
            user_opted_out=user_opted_out,
            policy=resolved_policy,
        )
        usage = fields.usage if isinstance(fields.usage, dict) else {}
        cost_cents = _cost_cents(fields)
        metadata = build_metadata(fields)
        async with active_pool.acquire() as conn:
            await conn.execute(
                _INSERT_SQL,
                user_id,
                fields.model[:100],
                raw_cols.prompt,
                raw_cols.response,
                raw_cols.raw_retained,
                _as_non_negative_int(usage.get("prompt_tokens")),
                _as_non_negative_int(usage.get("completion_tokens")),
                _as_non_negative_int(usage.get("total_tokens")),
                _as_non_negative_int(usage.get("cached_tokens")),
                _as_non_negative_int(usage.get("cache_creation_tokens")),
                _as_non_negative_int(fields.latency_ms),
                "success" if fields.status == "success" else "error",
                fields.error_message[:2000] if fields.error_message else None,
                fields.conversation_id[:100] if fields.conversation_id else None,
                json.dumps(metadata, ensure_ascii=False),
                fields.provider_code[:32] if fields.provider_code else None,
                _optional_uuid(fields.key_pool_id),
                None if cost_cents is None else str(cost_cents),
                _optional_int(fields.http_status),
                _optional_int(fields.ttft_ms),
                fields.call_type[:16] or "chat",
                _build_trace_id(fields.trace_id),
                _optional_config_id(fields.config_id),
            )
        return True
    except Exception as e:
        logger.warning(
            "[llm_call_log_writer] llm_call_logs 写入失败(降级,不阻塞业务): %s", e
        )
        return False


# create_task 强引用集合(防 GC;与 audit_service._pending_persist_tasks 同款)。
_pending_tasks: set[asyncio.Task[bool]] = set()


def schedule_llm_call_log(
    fields: LlmCallLogFields,
    *,
    pool: Any | None = None,
    raw_optout_lookup: Callable[[str], Awaitable[bool]] | None = None,
    policy: RawRetentionPolicy | None = None,
) -> None:
    """异步安全入口:有运行中 loop 就 fire-and-forget,没有就如实丢弃(只 warn)。

    任何异常都不上抛。缺 user_id 时连任务都不创建(与 persist 同一形状锁,
    测试据此断言"副作用没发生")。
    """
    if _normalize_user_id(fields.user_id) is None:
        return
    try:
        coro = persist_llm_call_log(
            fields, pool=pool, raw_optout_lookup=raw_optout_lookup, policy=policy
        )
    except Exception as e:  # noqa: BLE001 - 连协程构造都失败时也只 warn
        logger.warning("[llm_call_log_writer] 落库任务构造失败(忽略): %s", e)
        return
    try:
        task = asyncio.create_task(coro)
    except RuntimeError:
        # 无运行中的 event loop(同步上下文/单元测试),如实降级,不冒充已排期。
        coro.close()
        logger.warning(
            "[llm_call_log_writer] 无运行中 event loop,本次调用流水未落库(model=%s)",
            fields.model,
        )
        return
    _pending_tasks.add(task)
    task.add_done_callback(_pending_tasks.discard)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
