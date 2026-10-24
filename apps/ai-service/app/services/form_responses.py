# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""对话流业务表单应答的持久层(D77/G-106 第①格,2026-10-20 机主拍板授权落库)。

全仓**唯一**的 `chat_form_responses` 写入点 —— 表结构在 `packages/database/src/schema/
chat-form-responses.ts`(Drizzle 定义)与本模块(Python 裸 SQL CRUD),与仓内既有的
`agent_checkpoints` / `langgraph checkpoints` 同一套协作模式。再开第二个写入点就是把
同一个事实写两遍,而两份必然漂开。

为什么写在这里而不是 apps/api:应答的上行端点就在 ai-service
(`POST /llm/complete/stream/{session_id}/form-response`),归属判定与结算都发生在那一处;
让 apps/api 再写一遍只能靠信任转发过来的字段,而"客户端自报的身份不算身份"是本仓铁律。

幂等由存储层兜:主键 `request_id` + `ON CONFLICT DO NOTHING RETURNING request_id`。
拿到行 = 真写进去了一条;拿不到行 = 这条 request_id 已有裁决,不产生第二行。
失败**绝不静默吞**:调用方拿到 `failed` 与错误摘要,日志按 error 级记 —— 静默降级会让
"用户答过了"这件事重新变回只存在于内存里的一格,那正是本票要消灭的现状。
"""

from __future__ import annotations

import json
import logging
from typing import Any, Literal, NamedTuple

from app.core.db_pool import get_shared_pool

logger = logging.getLogger(__name__)

FORM_PERSIST_ACTIONS = ("approve", "reject")

# values 序列化后的上限:上行 body 没有体积闸门,而这张表的正常体量是"几个字段的答案"。
# 超限不落库并记 error —— 拿一条几十 MB 的 jsonb 去换"证据留存"是不成比例的代价。
_VALUES_MAX_CHARS = 32_000

# 写成**一整条**三引号字面量而不是逐段相加:core/schema_check.py 的表名扫描只在
# "同一份字符串字面量里既有行首 SQL 动词、又有结构性 token"时才认这张表 —— 拆成拼接
# 就把它对启动期字段对账(schema ↔ TS)整张藏掉。
_INSERT_SQL = """
INSERT INTO chat_form_responses
    (request_id, session_id, kind, action, "values", reject_reason)
VALUES ($1, $2, $3, $4, $5::jsonb, $6)
ON CONFLICT (request_id) DO NOTHING
RETURNING request_id
"""


class FormPersistOutcome(NamedTuple):
    """一次落库的终态。`state='failed'` 时 `error` 必非空,反之必为空。"""

    state: Literal["written", "duplicate", "failed"]
    error: str | None = None

    @property
    def persisted(self) -> bool:
        """这一行现在**在库里**(无论是本次写的还是先前已在)。"""
        return self.state in ("written", "duplicate")


def _encode_values(action: str, values: dict[str, Any] | None) -> str | None:
    """把 values 折成 jsonb 字面量字符串。

    reject 恒为 None —— 成对判据在**唯一的写入点**上钉死,任何调用方都写不出
    "拒绝但带了一份内容"的行,也写不出会诱导下游建空记录的空对象。
    """
    if action != "approve" or values is None:
        return None
    return json.dumps(values, ensure_ascii=False)


async def persist_form_response(
    *,
    request_id: str,
    session_id: str,
    kind: str,
    action: str,
    values: dict[str, Any] | None,
    reject_reason: str | None,
) -> FormPersistOutcome:
    """把一次表单应答写成一条持久裁决记录(幂等)。"""
    if not request_id or not session_id:
        logger.error(
            "chat_form_responses 未落库:定位字段缺失(request=%r, session=%r)",
            request_id,
            session_id,
        )
        return FormPersistOutcome("failed", "request_id/session_id must be non-empty")

    # 值域在这里也封一次:表的 CHECK 约束是最终防线,但撞约束拿回来的是 asyncpg 的
    # 面向 SQL 的报错,对排障没有任何帮助 —— 先按入参判掉,报的是"哪个字段不对"。
    if action not in FORM_PERSIST_ACTIONS:
        logger.error(
            "chat_form_responses 未落库:action 取值非法(request=%s, action=%r)",
            request_id,
            action,
        )
        return FormPersistOutcome("failed", f"action must be one of {FORM_PERSIST_ACTIONS}")

    try:
        payload = _encode_values(action, values)
    except (TypeError, ValueError) as e:
        logger.error("chat_form_responses 未落库:values 不可序列化(request=%s): %s", request_id, e)
        return FormPersistOutcome("failed", f"values not serializable: {e}"[:300])

    if payload is not None and len(payload) > _VALUES_MAX_CHARS:
        logger.error(
            "chat_form_responses 未落库:values 超出 %d 字符上限(request=%s, len=%d)",
            _VALUES_MAX_CHARS,
            request_id,
            len(payload),
        )
        return FormPersistOutcome("failed", f"values exceeds {_VALUES_MAX_CHARS} chars")

    try:
        pool = await get_shared_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                _INSERT_SQL, request_id, session_id, kind, action, payload, reject_reason
            )
    except Exception as e:  # 连接失败 / 表未迁移 / 约束被违反,一律点名后交由调用方显影
        logger.error(
            "chat_form_responses 落库失败(request=%s, session=%s, action=%s): %s",
            request_id,
            session_id,
            action,
            e,
        )
        return FormPersistOutcome("failed", f"{type(e).__name__}: {e}"[:300])

    if row is None:
        logger.info(
            "chat_form_responses 幂等命中,未产生第二行(request=%s)", request_id
        )
        return FormPersistOutcome("duplicate")
    return FormPersistOutcome("written")


# =============================================================================
# D77 残余收口(2026-10-23):应答状态的**读面**(GET 端点的数据源)
# =============================================================================
# "唯一写入点"守的是同一个事实不被写两遍;读是同一份事实的另一面投影,与本模块的
# 列名 / jsonb 形状 / 值域放在同一处,而不是把裸 SQL 散进路由层。

# 与 _INSERT_SQL 同一纪律:一整条三引号字面量,让 core/schema_check.py 的表名扫描
# 在同一份字符串里同时看到 SQL 动词与 chat_form_responses。
_READ_COLUMNS = 'request_id, session_id, kind, action, "values", reject_reason, decided_at'

# 单条查询**必须**带 session_id 复合谓词:request_id 是主键,只按主键查会让持有他人
# requestId 的调用方借自己的 session 路径读到那一行 —— 复合谓词把"属于别的 session 的
# request_id"在 SQL 层就落成 not_found(与端点回包的"不存在"同形,不泄露行级信息)。
_SELECT_ONE_SQL = f"""
SELECT {_READ_COLUMNS}
FROM chat_form_responses
WHERE request_id = $1 AND session_id = $2
"""

# 列表封顶:本表的正常体量是"一个会话答过几张表单",100 条以内在所有真实会话里
# 都是全量;封顶防的是把一张被刷爆的表整个搬进响应体。
_LIST_MAX_ROWS = 100

_SELECT_BY_SESSION_SQL = f"""
SELECT {_READ_COLUMNS}
FROM chat_form_responses
WHERE session_id = $1
ORDER BY decided_at DESC
LIMIT {_LIST_MAX_ROWS}
"""


class FormReadOutcome(NamedTuple):
    """一次读的终态。

    `unavailable` 只说"库不可达",不带任何行级信息 —— 端点把它映射成**可分辨**的
    错误回包(前端可据此重试);`not_found` 与"不是你的"同形,是存在性探针防线的
    另一半。列表查询成功但空 ⇒ state="found"、rows 为空元组(空会话不是错误)。
    """

    state: Literal["found", "not_found", "unavailable"]
    rows: tuple[dict[str, Any], ...] = ()

    @property
    def row(self) -> dict[str, Any] | None:
        return self.rows[0] if self.rows else None


def _normalize_record(record: Any) -> dict[str, Any]:
    """asyncpg Record → 普通 dict。

    values 列按 ::jsonb 写入,而共享池**没有注册 jsonb codec**,读回来是 str,
    在这里 json.loads(NULL ⇒ None);解析失败按 None 处置 —— 读面不替脏数据编造形状。
    """
    raw = record["values"]
    values: dict[str, Any] | None = None
    if isinstance(raw, dict):  # 兜住"未来给池注册了 codec"的情形,不因此改判
        values = raw
    elif isinstance(raw, str) and raw:
        try:
            parsed = json.loads(raw)
        except ValueError:
            parsed = None
        if isinstance(parsed, dict):
            values = parsed
    return {
        "request_id": record["request_id"],
        "session_id": record["session_id"],
        "kind": record["kind"],
        "action": record["action"],
        "values": values,
        "reject_reason": record["reject_reason"],
        "decided_at": record["decided_at"],
    }


async def read_form_response(*, request_id: str, session_id: str) -> FormReadOutcome:
    """按 (request_id, session_id) 复合谓词读回一条应答。"""
    try:
        pool = await get_shared_pool()
        async with pool.acquire() as conn:
            record = await conn.fetchrow(_SELECT_ONE_SQL, request_id, session_id)
    except Exception as e:  # 连接失败 / 表未迁移 ⇒ 只点名,不回显任何行级信息
        logger.error(
            "chat_form_responses 读取失败(request=%s, session=%s): %s",
            request_id,
            session_id,
            e,
        )
        return FormReadOutcome("unavailable")
    if record is None:
        return FormReadOutcome("not_found")
    return FormReadOutcome("found", (_normalize_record(record),))


async def list_form_responses(*, session_id: str) -> FormReadOutcome:
    """按会话读回全部应答(按裁决时间倒序,封顶 100 条)。"""
    try:
        pool = await get_shared_pool()
        async with pool.acquire() as conn:
            records = await conn.fetch(_SELECT_BY_SESSION_SQL, session_id)
    except Exception as e:
        logger.error("chat_form_responses 列表读取失败(session=%s): %s", session_id, e)
        return FormReadOutcome("unavailable")
    return FormReadOutcome("found", tuple(_normalize_record(r) for r in records))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
