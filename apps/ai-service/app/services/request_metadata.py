# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""B3-07 模型请求四层元数据 + PG 追踪。

四层（对照 Qoder `chat.proto` 的 `ChatMetadata`）：
  1. workspace：文件数 / 语言 / 代码库状态 / 数据策略；
  2. business：业务 id / 产品 / 版本 / 阶段 / 子任务；
  3. context：request_id / session_id / task_id / request_set_id / machine_id /
     client_type / source_session_id；
  4. user：user_id。

本仓纪律：
- 每层 `extra='forbid'`，越层字段直接 ValidationError，不静默收下；
- `context.request_id` 与 `user.user_id` 是必填锚点，缺任一即拒；
- 追踪表只做可观测：写不进去不阻断主请求，回 `{recorded: False, reason}`；
- 表名/列名单一出处在本文件，不在路由里手写第二份 SQL。
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from ..core.db_pool import get_shared_pool

TRACKING_TABLE = "llm_request_metadata_tracking"

CREATE_TRACKING_TABLE_SQL = f"""
CREATE TABLE IF NOT EXISTS {TRACKING_TABLE} (
    request_id TEXT PRIMARY KEY,
    session_id TEXT,
    task_id TEXT,
    request_set_id TEXT,
    source_session_id TEXT,
    user_id TEXT NOT NULL,
    machine_id TEXT,
    client_type TEXT,
    workspace_file_count INTEGER,
    workspace_languages TEXT[],
    codebase_status TEXT,
    codebase_soft_status TEXT,
    codebase_external_id TEXT,
    data_policy TEXT,
    business_id TEXT,
    business_name TEXT,
    business_product TEXT,
    business_version TEXT,
    business_type TEXT,
    business_stage TEXT,
    business_sub_task TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
"""

INSERT_TRACKING_SQL = f"""
INSERT INTO {TRACKING_TABLE} (
    request_id, session_id, task_id, request_set_id, source_session_id,
    user_id, machine_id, client_type, workspace_file_count, workspace_languages,
    codebase_status, codebase_soft_status, codebase_external_id, data_policy,
    business_id, business_name, business_product, business_version, business_type,
    business_stage, business_sub_task
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
    $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
)
ON CONFLICT (request_id) DO NOTHING
"""


class _Layer(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class WorkspaceMetadata(_Layer):
    file_count: int | None = Field(None, ge=0)
    languages: list[str] | None = None
    codebase_status: str | None = None
    codebase_soft_status: str | None = None
    codebase_external_id: str | None = None
    data_policy: str | None = None


class BusinessMetadata(_Layer):
    id: str | None = None
    name: str | None = None
    begin_at: str | None = None
    product: str | None = None
    version: str | None = None
    type: str | None = None
    stage: str | None = None
    sub_task: str | None = None


class ContextMetadata(_Layer):
    request_id: str = Field(min_length=1)
    session_id: str | None = None
    task_id: str | None = None
    request_set_id: str | None = None
    machine_id: str | None = None
    client_type: str | None = None
    source_session_id: str | None = None


class UserMetadata(_Layer):
    user_id: str = Field(min_length=1)


class ChatMetadata(_Layer):
    workspace: WorkspaceMetadata
    business: BusinessMetadata
    context: ContextMetadata
    user: UserMetadata
    # 兼容旧网关顶层别名（只做输入兼容，不参与四层语义）
    legacy_user_id: str | None = Field(None, alias="userId")
    byok_mode: bool | None = Field(None, alias="byokMode")


def validate_chat_metadata(raw: Any) -> tuple[ChatMetadata | None, str | None]:
    """返回 `(metadata, reason)`；reason 非空表示未判定，不冒充通过。"""
    if raw is None:
        return None, "metadata-absent"
    try:
        return ChatMetadata.model_validate(raw), None
    except ValidationError as exc:
        first = exc.errors()[0] if exc.errors() else {}
        loc = ".".join(str(p) for p in first.get("loc", ()))
        return None, f"metadata-invalid:{loc or 'unknown'}"


def metadata_row(meta: ChatMetadata) -> tuple[Any, ...]:
    return (
        meta.context.request_id,
        meta.context.session_id,
        meta.context.task_id,
        meta.context.request_set_id,
        meta.context.source_session_id,
        meta.user.user_id,
        meta.context.machine_id,
        meta.context.client_type,
        meta.workspace.file_count,
        meta.workspace.languages,
        meta.workspace.codebase_status,
        meta.workspace.codebase_soft_status,
        meta.workspace.codebase_external_id,
        meta.workspace.data_policy,
        meta.business.id,
        meta.business.name,
        meta.business.product,
        meta.business.version,
        meta.business.type,
        meta.business.stage,
        meta.business.sub_task,
    )


async def record_chat_metadata(
    meta: ChatMetadata,
) -> dict[str, Any]:
    """写追踪表；失败只回具名原因，不抛穿主请求。"""
    try:
        pool = await get_shared_pool()
        async with pool.acquire() as conn:
            await conn.execute(CREATE_TRACKING_TABLE_SQL)
            await conn.execute(INSERT_TRACKING_SQL, *metadata_row(meta))
        return {"recorded": True, "request_id": meta.context.request_id}
    except Exception as exc:  # noqa: BLE001 - 观测失败不得阻断主链路
        return {
            "recorded": False,
            "reason": "tracking-db-unavailable",
            "exceptionType": type(exc).__name__,
        }


async def record_raw_metadata(raw: Any) -> dict[str, Any]:
    """路由入口用：先校验再写；未判定时返回原因而不是写半行。"""
    meta, reason = validate_chat_metadata(raw)
    if meta is None:
        return {"recorded": False, "reason": reason}
    return await record_chat_metadata(meta)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
