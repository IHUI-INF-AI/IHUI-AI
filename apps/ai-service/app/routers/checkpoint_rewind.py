# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Checkpoint / Rewind 用户可感知的撤销路由。

对标 Claude Code `checkpoint /rewind`:
- GET  /api/checkpoints?session_id=...             → 该会话可回滚的 checkpoint 列表
- POST /api/checkpoints/{checkpoint_id}/restore    → 恢复到该 checkpoint(对话历史 +
                                                    迭代数 + tool state,+ 可选文件回滚)

数据面:
- 消息/迭代/tool_state 恢复:AgentCheckpointManager(agent_checkpoint.py)
- 恢复后同步会话运行时存储:agent_runtime 模块的内存 SessionState(_sessions),使
  GET /api/agent-runtime/sessions/{id} 等读到的历史即为恢复后的历史。
- 文件回滚(可选):file_editor.snapshot_file / rollback_file,按 checkpoint 内记录的
  文件版本引用(file_versions)执行。若 body.rollbackFiles=false 或无可回滚版本则跳过。

安全:
- JWT 鉴权:沿用 get_current_user_id(request.state.user_id)
- 会话归属校验:若该 session 已存在于 agent_runtime 且属他人,拒绝(管理员除外)
- checkpoint 归属校验:restore 时校验 checkpoint.session_id == 目标 session_id
"""

from __future__ import annotations

import difflib
import logging
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from ..core.jwt_auth import get_current_user_id_sync
from ..routers import agent_runtime
from ..services import file_editor
from ..services.agent_checkpoint import (
    CheckpointNotFoundError,
    CheckpointSessionMismatchError,
    get_agent_checkpoint_manager,
)
from ..services.branch_generation import bump_branch_generation

router = APIRouter(prefix="/checkpoints", tags=["checkpoints"])
logger = logging.getLogger(__name__)


def _current_user(request: Request) -> tuple[str, bool]:
    """从 JWT 派生当前用户 (user_id, is_admin),兼容 agent_runtime 的处理方式。"""
    user_id = get_current_user_id_sync(request)
    role_id = getattr(request.state, "role_id", 0) or 0
    return user_id, int(role_id) >= 1


def _authorize_session(request: Request, session_id: str) -> None:
    """校验会话归属:session 存在且属他人时拒绝(管理员除外)。"""
    user_id, is_admin = _current_user(request)
    session = agent_runtime._find_session(session_id)
    if session is not None:
        owner = getattr(session, "user_id", "") or ""
        if owner and owner != user_id and not is_admin:
            raise HTTPException(status_code=403, detail="无权访问他人会话")


class RestoreRequest(BaseModel):
    """restore 请求体(对外用 camelCase JSON 字段名,内部用 snake_case)。"""

    model_config = ConfigDict(populate_by_name=True)

    session_id: str = Field(
        ...,
        min_length=1,
        validation_alias="sessionId",
        description="目标会话 id",
    )
    rollback_files: bool = Field(
        False,
        validation_alias="rollbackFiles",
        description="是否同时回滚该 checkpoint 记录的文件版本(向后兼容,等价 scope=both/none)",
    )
    scope: str = Field(
        "both",
        pattern="^(conversation|code|both)$",
        description="回退范围: conversation=仅对话 | code=仅文件 | both=对话+文件",
    )

    def effective_scope(self) -> str:
        """把旧 rollbackFiles 布尔与新 scope 枚举归一为单一语义。

        - 显式传了 scope → 以 scope 为准
        - 只传 rollbackFiles=true → both;false → conversation
        """
        if "scope" in self.model_fields_set:
            return self.scope
        return "both" if self.rollback_files else "conversation"


class RestoreResponse(BaseModel):
    """restore 响应(含还原后的消息数与文件变更数)。

    G-815936:missed_paths 逐条点名回滚失败的文件(服务端确认的未命中),
    不再让调用方拿"请求侧清单 - 成功数"自己猜;全部成功时为空列表。
    """

    checkpoint_id: str
    session_id: str
    iteration: int
    status: str
    restored_message_count: int
    file_changes: int = 0
    missed_paths: list[dict[str, str]] = []
    file_versions: list[dict[str, Any]] = []
    message: str = ""


def _sync_session_messages(
    request: Request, session_id: str, messages: list[dict[str, Any]]
) -> None:
    """把恢复后的消息历史同步回 agent_runtime 会话(尽力而为,失败仅 warning)。"""
    try:
        session = agent_runtime._find_session(session_id)
        if session is None:
            return
        session.messages = [
            agent_runtime.SessionMessage(
                role=str(m.get("role", "user")),
                content=str(m.get("content", "")),
                timestamp=m.get("timestamp", time.time()),
            )
            for m in messages
        ]
        agent_runtime._save_session_redis(session)
    except Exception as e:  # pragma: no cover - 防御性异常
        logger.warning("checkpoint_rewind 会话消息同步失败: %s", e, exc_info=True)


def _rollback_files(
    session_id: str, file_versions: list[dict[str, Any]]
) -> dict[str, Any]:
    """按 checkpoint 记录的文件版本引用批量回滚。

    返回 batch-outcome 形状(与 apps/api/src/utils/batch-outcome.ts 的字段语义对齐:
    requested 先按 path 去重保序,affected = 库侧确认改动数,missed 逐条点名):
        {"requested_paths": [...], "affected": int, "missed_paths": [{"path", "reason"}]}
    affected 必须由逐文件 rollback 的真实结果推出;失败逐条进 missed_paths 并留
    warning,不再只喊一个没人听的日志行。
    """
    requested_paths: list[str] = []
    seen: set[str] = set()
    affected = 0
    missed_paths: list[dict[str, str]] = []
    for fv in file_versions or []:
        path = fv.get("path")
        version_id = fv.get("version_id")
        if not path or not version_id:
            continue
        if path in seen:
            continue
        seen.add(path)
        requested_paths.append(path)
        try:
            result = file_editor.rollback_file(
                session_id=session_id,
                file_path=path,
                version_id=version_id,
            )
            if result.get("ok"):
                affected += 1
            else:
                missed_paths.append(
                    {"path": path, "reason": str(result.get("error") or "rollback_not_ok")}
                )
        except Exception as e:  # pragma: no cover - 防御性异常
            missed_paths.append({"path": path, "reason": str(e)})
            logger.warning("checkpoint_rewind 文件回滚失败 %s: %s", path, e)
    return {
        "requested_paths": requested_paths,
        "affected": affected,
        "missed_paths": missed_paths,
    }


def _record_restore_unavailable(
    session_id: str, checkpoint_id: str, reason: str
) -> None:
    """"尝试过但没做成"也要留一份可查事实(G-815936;对齐上游 RewindTriggered
    {strategy: Unavailable, reason} 的意图):恢复不可用走 HTTP 404/400 之前,
    先以稳定事件键落一条结构化记录,审计面可按 `checkpoint_rewind.unavailable` 检索。
    持久 journal 形态需会话事件存储,归该面持有人;此处不新造第二份存储。
    """
    logger.warning(
        "checkpoint_rewind.unavailable session_id=%s checkpoint_id=%s reason=%s",
        session_id,
        checkpoint_id,
        reason,
    )


@router.get("", response_model=dict[str, Any])
async def list_checkpoints(
    request: Request,
    session_id: str = Query(..., min_length=1, description="会话 id"),
) -> dict[str, Any]:
    """列出指定会话可回滚的 checkpoint 元数据。"""
    # 触发鉴权 + 归属校验(无归属会话时也执行 JWT 校验,复用 get_current_user_id)
    _authorize_session(request, session_id)
    manager = get_agent_checkpoint_manager()
    metas = await manager.list_for_session(session_id)
    return {
        "session_id": session_id,
        "total": len(metas),
        "checkpoints": [m.to_dict() for m in metas],
    }


@router.post("/{checkpoint_id}/restore", response_model=RestoreResponse)
async def restore_checkpoint(
    checkpoint_id: str,
    body: RestoreRequest,
    request: Request,
) -> RestoreResponse:
    """把会话恢复到指定 checkpoint(对话历史 + 迭代数 + tool state,可选文件回滚)。"""
    session_id = body.session_id
    _authorize_session(request, session_id)
    manager = get_agent_checkpoint_manager()

    try:
        restored = await manager.restore(session_id=session_id, checkpoint_id=checkpoint_id)
    except CheckpointNotFoundError as e:
        # G-815936:不可用也落记录 —— 先留"尝试过且为何没做成"的事件,再回 HTTP
        _record_restore_unavailable(session_id, checkpoint_id, str(e))
        raise HTTPException(status_code=404, detail=str(e)) from None
    except CheckpointSessionMismatchError as e:
        _record_restore_unavailable(session_id, checkpoint_id, str(e))
        raise HTTPException(status_code=400, detail=str(e)) from None

    # G-815974:恢复成功即分支装配出口 —— 该会话分支代数 +1。挂在同一会话上的
    # 在飞后台任务完成时,经 background_tasks 的复校点发现旧令牌过期:
    # 不寄通知、不写历史,只留一条可诊断日志(注:impact 预览端点同调 manager.restore
    # 但属只读预览,不 bump)。
    bump_branch_generation(session_id, "checkpoint-restore")

    # 按 scope 决定回退范围:
    # - conversation / both:同步恢复后的消息历史到会话运行时存储(用户可感知的核心闭环)
    # - code / both:按 checkpoint 记录的文件版本回滚文件
    scope = body.effective_scope()
    if scope in ("conversation", "both"):
        _sync_session_messages(request, session_id, restored["messages"])

    file_versions = restored.get("file_versions", [])
    file_changes = 0
    missed_paths: list[dict[str, str]] = []
    if scope in ("code", "both") and file_versions:
        outcome = _rollback_files(session_id, file_versions)
        file_changes = outcome["affected"]
        missed_paths = outcome["missed_paths"]

    return RestoreResponse(
        checkpoint_id=restored["checkpoint_id"],
        session_id=restored["session_id"],
        iteration=restored["iteration"],
        status=restored["status"],
        restored_message_count=restored["restored_message_count"],
        file_changes=file_changes,
        missed_paths=missed_paths,
        file_versions=file_versions,
        message=f"已恢复到迭代 {restored['iteration']} 的 checkpoint"
        f"(消息 {restored['restored_message_count']} 条,文件变更 {file_changes} 项)",
    )


# 影响预览单文件内容嵌入上限(防止巨型文件撑爆响应;行数统计仍按全文计算)
_IMPACT_CONTENT_CAP = 4000
# 影响文件清单默认截断上限(对标 Trae:列前 N 个 + "等 M 个文件")
_IMPACT_FILE_LIMIT = 50


def _count_diff_lines(old_content: str, new_content: str) -> tuple[int, int]:
    """用 LCS 统计变更行数(增/删)。返回 (added, deleted)。"""
    old_lines = old_content.splitlines()
    new_lines = new_content.splitlines()
    sm = difflib.SequenceMatcher(None, old_lines, new_lines)
    added = deleted = 0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "replace":
            deleted += i2 - i1
            added += j2 - j1
        elif tag == "delete":
            deleted += i2 - i1
        elif tag == "insert":
            added += j2 - j1
    return added, deleted


def _cap_content(content: str) -> tuple[str, bool]:
    """截断嵌入内容并返回(截断后文本, 是否截断)。"""
    if len(content) <= _IMPACT_CONTENT_CAP:
        return content, False
    return content[:_IMPACT_CONTENT_CAP], True


class CheckpointImpactResponse(BaseModel):
    """回退影响预览:影响文件清单 + 逐文件变更行数 + old/new 内容(供前端 diff 展示)。"""

    checkpoint_id: str
    session_id: str
    scope: str
    restored_message_count: int = 0
    files: list[dict[str, Any]] = []
    total: int = 0
    truncated: bool = False


@router.get("/{checkpoint_id}/impact", response_model=CheckpointImpactResponse)
async def checkpoint_impact(
    checkpoint_id: str,
    request: Request,
    session_id: str = Query(..., min_length=1, description="会话 id"),
    scope: str = Query(
        "both", pattern="^(conversation|code|both)$", description="回退范围"
    ),
) -> dict[str, Any]:
    """回退前的影响预览(对标 Trae:恢复前展示影响文件 + 逐文件 diff 确认)。

    - scope=conversation:仅恢复对话历史,无文件变更(files 为空)
    - scope=code / both:按 checkpoint 记录的文件版本引用,逐个比对当前磁盘内容,
      返回 old(当前)/new(快照)内容 + 增删行数;清单超过 50 个时截断并标记 truncated。
    """
    _authorize_session(request, session_id)
    manager = get_agent_checkpoint_manager()
    try:
        restored = await manager.restore(session_id=session_id, checkpoint_id=checkpoint_id)
    except CheckpointNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from None
    except CheckpointSessionMismatchError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None

    file_versions = restored.get("file_versions", []) or []
    # conversation 范围不回滚文件,影响清单为空
    if scope == "conversation":
        return {
            "checkpoint_id": restored["checkpoint_id"],
            "session_id": restored["session_id"],
            "scope": scope,
            "restored_message_count": restored["restored_message_count"],
            "files": [],
            "total": 0,
            "truncated": False,
        }

    all_files: list[dict[str, Any]] = []
    for fv in file_versions:
        path = fv.get("path")
        version_id = fv.get("version_id")
        if not path or not version_id:
            continue
        owner_session = fv.get("session_id", session_id)
        # 当前磁盘内容(恢复前)。G-814423:"读不到"≠"空文件" —— 磁盘侧读失败时不再
        # 折叠成空串(旧行为会把恢复预览渲染成整文件新增),改带 readError 标记,
        # 且增删行数置 0(与空文件伪比对得出的整文件行数是伪造的统计)。
        try:
            disk = Path(path).read_text(encoding="utf-8", errors="replace")
            disk_error = False
        except Exception:  # noqa: BLE001 - 读失败必须显式标记,不得猜合法空文件
            disk = ""
            disk_error = True
        # 快照内容(恢复后)。版本内容取不到同样折叠过空串(会被渲染成整文件删除),
        # 同票改为显式 snapshotError 标记 + 统计置 0。
        snapshot = file_editor.get_file_version_content(owner_session, path, version_id)
        snapshot_error = snapshot is None
        snapshot = snapshot or ""
        if disk_error or snapshot_error:
            added, deleted = 0, 0
        else:
            added, deleted = _count_diff_lines(disk, snapshot)
        old_capped, old_trunc = _cap_content(disk)
        new_capped, new_trunc = _cap_content(snapshot)
        all_files.append(
            {
                "path": path,
                "oldContent": old_capped,
                "newContent": new_capped,
                "added": added,
                "deleted": deleted,
                "contentTruncated": old_trunc or new_trunc,
                **({"readError": True} if disk_error else {}),
                **({"snapshotError": True} if snapshot_error else {}),
            }
        )

    total = len(all_files)
    truncated = total > _IMPACT_FILE_LIMIT
    display = all_files[:_IMPACT_FILE_LIMIT] if truncated else all_files
    return {
        "checkpoint_id": restored["checkpoint_id"],
        "session_id": restored["session_id"],
        "scope": scope,
        "restored_message_count": restored["restored_message_count"],
        "files": display,
        "total": total,
        "truncated": truncated,
    }


__all__ = ["router"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
