# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""按轮变更集(before/after sha256 + unified diff)的采集与回滚(2026-11-06 立,批次 4)。

设计要点:
- 以「轮」为账本单位(conversation_id + turn_id 唯一),轮内多次改同一文件折叠成一行,
  保留**最早**的 before 与**最晚**的 after —— 用户要撤的是"这一轮整体",不是某次写盘。
- 采集走 ContextVar:llm 主对话流在 gen() 里 begin_turn,工具(同 task 内的 await 链)
  调 record_file_change;流收尾 end_turn 落库。没有 turn 上下文时 record 是**纯 no-op**,
  因此直连工具调用(不经过聊天流)行为逐字节不变。
- 落库失败只记日志、绝不抛进聊天流:变更集是观测/回滚面,不是回答能否产出的前置条件。
- 回滚前的硬判据是 sha256:文件必须仍停在**这一轮结束时**的样子,否则一律 conflict
  (否则会把用户之后的编辑一并覆盖)。执行是全有全无:任一文件冲突 ⇒ 一个字节都不写。
"""

from __future__ import annotations

import difflib
import hashlib
import logging
import os
import uuid
from contextvars import ContextVar
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..core.db_pool import get_shared_pool

logger = logging.getLogger(__name__)

#: 超过该字节数的 before 正文不落库(与 file_editor.MAX_FILE_SIZE 同量级 1MB)。
#: 落不下的正文意味着"回滚时没有可写回的材料",因此该行显式不可回滚,而不是假装能回。
_MAX_BEFORE_CONTENT_BYTES = 1 * 1024 * 1024

#: unified diff 的上下文行数
_DIFF_CONTEXT_LINES = 3

#: 变更集状态闭集(与 schema check 一致)
_STATUSES = frozenset({"open", "committed", "partial"})


@dataclass(frozen=True)
class ChangeTurnContext:
    """一轮变更集的上下文(llm 在流被准入后构造)。"""

    conversation_id: str
    user_id: str
    turn_id: str
    session_id: str | None = None
    workspace_root: str | None = None


@dataclass
class _TurnState:
    """轮内内存态:路径 → 聚合后的文件变更。"""

    ctx: ChangeTurnContext
    files: dict[str, dict[str, Any]] = field(default_factory=dict)


_CURRENT: ContextVar[_TurnState | None] = ContextVar("chat_change_turn", default=None)


# ---------------------------------------------------------------------------
# sha256 / diff 基础件
# ---------------------------------------------------------------------------


def _sha256(content: str | None) -> str | None:
    if content is None:
        return None
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _build_unified_diff(rel_path: str, before: str | None, after: str | None) -> str:
    """difflib unified diff(a/<path> → b/<path>,3 行上下文,lineterm="")。

    缺失一侧按空内容处理:新增=全增、删除=全删,行数统计因此与 operation 自洽。
    """
    old_lines = (before or "").splitlines()
    new_lines = (after or "").splitlines()
    diff = difflib.unified_diff(
        old_lines,
        new_lines,
        fromfile=f"a/{rel_path}",
        tofile=f"b/{rel_path}",
        n=_DIFF_CONTEXT_LINES,
        lineterm="",
    )
    return "\n".join(diff)


def _diff_counts(unified: str) -> tuple[int, int]:
    """统计 unified diff 的增/删行数("+++"/"---" 头行不算)。"""
    additions = deletions = 0
    for line in unified.split("\n"):
        if line.startswith("+") and not line.startswith("+++"):
            additions += 1
        elif line.startswith("-") and not line.startswith("---"):
            deletions += 1
    return additions, deletions


def _normalize_rel_path(file_path: str, workspace_root: str | None) -> str | None:
    """把绝对/相对路径归一成 workspace_root 下的相对 posix 路径。

    工作区外(含 `..` 穿越)一律返回 None:变更集只登记本轮真正写进工作区的文件,
    越界路径既不进库、也不可能在回滚时被解析成工作区外的写目标。
    """
    if not file_path:
        return None
    root = workspace_root or _default_workspace_root()
    if not root:
        return None
    try:
        root_resolved = Path(root).resolve(strict=False)
        candidate = Path(file_path)
        if not candidate.is_absolute():
            candidate = root_resolved / candidate
        resolved = candidate.resolve(strict=False)
        rel = resolved.relative_to(root_resolved)
    except (ValueError, OSError):
        return None
    rel_posix = rel.as_posix()
    if rel_posix in ("", "."):
        return None
    return rel_posix


def _default_workspace_root() -> str | None:
    """上下文没带根时,复用文件工具同源的根解析(mcp_server._get_workspace_roots)。

    刻意走同一个出口而不是自读环境变量:工具按哪份白名单判可写,账本就按哪份根归一路径,
    否则"写进去了却记不上"会成为第二个真相。
    """
    try:
        from .mcp_server import _get_workspace_roots

        roots = _get_workspace_roots()
        return roots[0] if roots else None
    except Exception as e:  # noqa: BLE001 - 根解析失败不应影响采集主流程
        logger.debug("change_set_store 取工作区根失败(忽略): %s", e)
        return None


# ---------------------------------------------------------------------------
# 采集(ContextVar 生命周期)
# ---------------------------------------------------------------------------


def begin_turn(ctx: ChangeTurnContext) -> None:
    """在流被准入后登记本轮上下文(同 task 内的工具调用随之可见)。"""
    _CURRENT.set(_TurnState(ctx=ctx))


def current_turn_context() -> ChangeTurnContext | None:
    """读当前轮上下文(供诊断/测试;不改状态)。"""
    state = _CURRENT.get()
    return None if state is None else state.ctx


def record_file_change(
    path: str, before_content: str | None, after_content: str | None
) -> None:
    """登记一次文件改动(同步、尽力而为;无 turn 上下文时 no-op)。

    before_content/after_content 为 None 表示该侧文件不存在(新增 / 删除)。
    同一路径多次改动只保留最早 before + 最晚 after(这一轮的整体前后态)。
    """
    state = _CURRENT.get()
    if state is None:
        return
    try:
        rel = _normalize_rel_path(path, state.ctx.workspace_root)
        if rel is None:
            logger.warning(
                "change_set_store 跳过工作区外路径(不记账): path=%s root=%s",
                path,
                state.ctx.workspace_root,
            )
            return
        entry = state.files.get(rel)
        if before_content is None and after_content is None:
            # 首次观测就两侧皆无(文件本来不存在且没有写入)⇒ 没有任何可回滚事实。
            return
        before = entry["before"] if entry is not None else before_content
        # 两侧一致 ⇒ 本次没有实际改动(如 write_file 原样重写),不产生一行台账。
        if before is not None and after_content is not None and before == after_content:
            return
        state.files[rel] = _build_entry(rel, before, after_content)
    except Exception as e:  # noqa: BLE001 - 采集故障绝不影响编辑/写盘主流程
        logger.warning("change_set_store.record_file_change 失败(已忽略): %s", e)


def _build_entry(rel: str, before: str | None, after: str | None) -> dict[str, Any]:
    """由(最早 before, 最晚 after)构造一行变更明细。"""
    if before is None and after is None:
        operation = "modify"
    elif before is None:
        operation = "add"
    elif after is None:
        operation = "delete"
    else:
        operation = "modify"

    unified = _build_unified_diff(rel, before, after)
    additions, deletions = _diff_counts(unified)
    # 只判 before:回滚要写回的就是它。超过上限 ⇒ 正文不落库且显式标记"不可回滚"。
    truncated = (
        before is not None
        and len(before.encode("utf-8")) > _MAX_BEFORE_CONTENT_BYTES
    )
    return {
        "path": rel,
        "operation": operation,
        "before": None if truncated else before,
        "after": after,
        "before_sha256": _sha256(before),
        "after_sha256": _sha256(after),
        "additions": additions,
        "deletions": deletions,
        "unified_diff": unified,
        "content_truncated": truncated,
        "rewind_tracked": not truncated,
    }


async def end_turn(status: str = "committed") -> None:
    """流收尾:把本轮变更集落库(失败只记日志,不向聊天流抛异常)。

    status 只接受 committed/partial;其它值(异常输入)按 committed 处理。
    """
    state = _CURRENT.get()
    _CURRENT.set(None)
    if state is None:
        return
    if status not in _STATUSES:
        status = "committed"
    try:
        await _flush(state, status)
    except Exception as e:  # noqa: BLE001 - 落库失败不拖垮对话流
        logger.warning(
            "change_set_store.end_turn 落库失败(本轮变更集缺失): turn=%s err=%s",
            state.ctx.turn_id,
            e,
            exc_info=True,
        )


# ---------------------------------------------------------------------------
# 持久化(共享 asyncpg 池;不另建池)
# ---------------------------------------------------------------------------

_INSERT_SET_SQL = """
INSERT INTO chat_turn_change_sets
    (conversation_id, user_id, turn_id, session_id, workspace_root, status,
     file_count, additions, deletions, rewind_status)
VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 0, 'available')
ON CONFLICT (conversation_id, turn_id) DO UPDATE SET
    status = EXCLUDED.status,
    session_id = COALESCE(EXCLUDED.session_id, chat_turn_change_sets.session_id),
    workspace_root = COALESCE(EXCLUDED.workspace_root, chat_turn_change_sets.workspace_root),
    updated_at = now()
RETURNING id
"""

_UPSERT_FILE_SQL = """
INSERT INTO chat_turn_change_files
    (change_set_id, path, operation, before_sha256, after_sha256, additions, deletions,
     unified_diff, before_content, content_truncated, rewind_tracked)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
ON CONFLICT (change_set_id, path) DO UPDATE SET
    operation = EXCLUDED.operation,
    before_sha256 = EXCLUDED.before_sha256,
    after_sha256 = EXCLUDED.after_sha256,
    additions = EXCLUDED.additions,
    deletions = EXCLUDED.deletions,
    unified_diff = EXCLUDED.unified_diff,
    before_content = EXCLUDED.before_content,
    content_truncated = EXCLUDED.content_truncated,
    rewind_tracked = EXCLUDED.rewind_tracked,
    rewind_applied_at = NULL
"""

_PRUNE_FILES_SQL = (
    "DELETE FROM chat_turn_change_files "
    "WHERE change_set_id = $1 AND path <> ALL($2::text[])"
)

_RECOMPUTE_SET_SQL = """
UPDATE chat_turn_change_sets s SET
    file_count = (
        SELECT count(*) FROM chat_turn_change_files f WHERE f.change_set_id = s.id
    ),
    additions = COALESCE((
        SELECT sum(f.additions) FROM chat_turn_change_files f WHERE f.change_set_id = s.id
    ), 0),
    deletions = COALESCE((
        SELECT sum(f.deletions) FROM chat_turn_change_files f WHERE f.change_set_id = s.id
    ), 0),
    updated_at = now()
WHERE s.id = $1
"""

_SET_COLUMNS = (
    "id, conversation_id, user_id, turn_id, session_id, workspace_root, status, "
    "file_count, additions, deletions, rewind_status, created_at, updated_at"
)

_FILE_META_COLUMNS = (
    "id, change_set_id, path, operation, before_sha256, after_sha256, additions, "
    "deletions, unified_diff, content_truncated, rewind_tracked, rewind_applied_at, "
    "created_at"
)

_FILE_COLUMNS = _FILE_META_COLUMNS.replace(
    "unified_diff", "unified_diff, before_content"
)


def _uuid_or_none(value: Any) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        return None


def _row_dict(row: Any) -> dict[str, Any]:
    if row is None:
        return {}
    return dict(row)


async def _flush(state: _TurnState, status: str) -> None:
    """一轮一次落库:upsert 变更集 → upsert 明细 → 由明细重算计数。"""
    ctx = state.ctx
    conversation_uuid = _uuid_or_none(ctx.conversation_id)
    user_uuid = _uuid_or_none(ctx.user_id)
    if conversation_uuid is None or user_uuid is None:
        # 列是 uuid 且带 FK:主体/会话不是合法 uuid 时无法建台账(dev-anonymous 等),
        # 静默跳过即可,不能在聊天流里报错。
        logger.info(
            "change_set_store 跳过落库(conversation/user 非 uuid): conv=%r user=%r",
            ctx.conversation_id,
            ctx.user_id,
        )
        return

    # varchar 上限(schema: turn_id 64 / session_id 128):超长时截断而不是让整条 INSERT 失败
    turn_id = (ctx.turn_id or "")[:64]
    session_id = (ctx.session_id or "")[:128] or None
    if not turn_id:
        return

    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                _INSERT_SET_SQL,
                conversation_uuid,
                user_uuid,
                turn_id,
                session_id,
                ctx.workspace_root,
                status,
            )
            set_id = _row_dict(row).get("id")
            if set_id is None:
                logger.warning("change_set_store 变更集 upsert 未返回 id(turn=%s)", turn_id)
                return
            if state.files:
                await conn.executemany(
                    _UPSERT_FILE_SQL,
                    [
                        (
                            set_id,
                            entry["path"],
                            entry["operation"],
                            entry["before_sha256"],
                            entry["after_sha256"],
                            entry["additions"],
                            entry["deletions"],
                            entry["unified_diff"],
                            entry["before"],
                            entry["content_truncated"],
                            entry["rewind_tracked"],
                        )
                        for entry in state.files.values()
                    ],
                )
            # 清理上一轮 flush 的残留行:ContextVar 里的 state.files 是本轮**完整**集合
            # (record 只增不删,同路径多次改也折叠成一行),所以库里不属于该集合的路径
            # 只可能来自同一 turn_id 的上一次 flush(流重试 / 续流重入)。
            # 先 upsert 后 prune(而不是先删后插):中途失败时旧明细仍在,整轮不会变空账。
            # state.files 为空也要执行:空数组 ⇒ 删掉该 set 的全部旧行(本轮无可记账改动)。
            await conn.execute(_PRUNE_FILES_SQL, set_id, sorted(state.files.keys()))
            # 计数以库内明细为唯一口径(重试/续流覆盖写时才不会与内存态分叉)
            await conn.execute(_RECOMPUTE_SET_SQL, set_id)


# ---------------------------------------------------------------------------
# 读取口(router 复用)
# ---------------------------------------------------------------------------


async def list_change_sets(
    conversation_id: str, turn_id: str | None = None, limit: int = 20
) -> list[dict[str, Any]]:
    """按会话(可选轮次)倒序列出变更集;非法会话 id 直接返回空列表。"""
    conversation_uuid = _uuid_or_none(conversation_id)
    if conversation_uuid is None:
        return []
    limit = max(1, min(int(limit), 100))
    sql = f"SELECT {_SET_COLUMNS} FROM chat_turn_change_sets WHERE conversation_id = $1"
    args: list[Any] = [conversation_uuid]
    if turn_id:
        sql += " AND turn_id = $2"
        args.append(turn_id)
    sql += " ORDER BY created_at DESC, id DESC LIMIT $%d" % (len(args) + 1)
    args.append(limit)
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(sql, *args)
    return [_row_dict(r) for r in rows or []]


async def get_change_set(change_set_id: str) -> dict[str, Any] | None:
    """读一条变更集及其明细(明细**不含** before_content:列表/详情不传整份源码副本)。"""
    set_uuid = _uuid_or_none(change_set_id)
    if set_uuid is None:
        return None
    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        set_row = await conn.fetchrow(
            f"SELECT {_SET_COLUMNS} FROM chat_turn_change_sets WHERE id = $1", set_uuid
        )
        if set_row is None:
            return None
        files = await conn.fetch(
            f"SELECT {_FILE_META_COLUMNS} FROM chat_turn_change_files "
            "WHERE change_set_id = $1 ORDER BY created_at, path",
            set_uuid,
        )
    return {"changeSet": _row_dict(set_row), "files": [_row_dict(f) for f in files or []]}


# ---------------------------------------------------------------------------
# 回滚(预览 + 执行)
# ---------------------------------------------------------------------------


class ChangeSetNotFoundError(LookupError):
    """变更集不存在(router 转 404)。"""


def _resolve_under_root(root: str, rel_path: str) -> str | None:
    """把库内相对路径解析到 root 下的绝对路径;越界/绝对路径一律拒绝。

    resolve(strict=False) 会跟进符号链接:判定对象是链接目标,故 symlink 指到工作区外
    同样被拒 —— 回滚写盘不能成为绕过白名单的第二个写出口。
    """
    try:
        rel = Path(rel_path)
        if rel.is_absolute() or rel.drive:
            return None
        root_resolved = Path(root).resolve(strict=False)
        resolved = (root_resolved / rel).resolve(strict=False)
        resolved.relative_to(root_resolved)
        return str(resolved)
    except (ValueError, OSError):
        return None


def _current_sha256(abs_path: str) -> tuple[str | None, str | None]:
    """读当前文件 sha256;返回 (sha, 错误原因)。文件不存在 ⇒ (None, None)。"""
    try:
        text = Path(abs_path).read_text(encoding="utf-8")
    except FileNotFoundError:
        return None, None
    except (OSError, UnicodeDecodeError) as e:  # noqa: BLE001 - 读不了必须显式冲突
        return None, f"read_error:{type(e).__name__}"
    return _sha256(text), None


def _atomic_write(abs_path: str, content: str) -> None:
    """同目录临时文件 + os.replace(与 file_editor._apply_rollback 同写法)。"""
    tmp_path = f"{abs_path}.cs_tmp_{uuid.uuid4().hex}"
    try:
        os.makedirs(os.path.dirname(abs_path) or ".", exist_ok=True)
        with open(tmp_path, "w", encoding="utf-8") as f:
            f.write(content)
        os.replace(tmp_path, abs_path)
    except Exception:  # noqa: BLE001 - 失败时清掉临时文件再上抛
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except OSError:
            pass
        raise


async def rewind_change_set(change_set_id: str, dry_run: bool) -> dict[str, Any]:
    """回滚一整轮变更集(dry_run=只算不动)。

    返回 {status, actions[], conflicts[], applied}:
      status=ok            全部可回滚且(非 dry_run 时)已执行
      status=conflict      任一文件与 after 态不一致 ⇒ 全有全无,一个字节都不写
      status=already_rewound  幂等重入(已回滚过,直接返回)
      status=unavailable   可回滚材料缺失(正文超限/无 workspace_root)
    """
    set_uuid = _uuid_or_none(change_set_id)
    if set_uuid is None:
        raise ChangeSetNotFoundError(f"变更集不存在: {change_set_id}")

    pool = await get_shared_pool()
    async with pool.acquire() as conn:
        set_row = await conn.fetchrow(
            f"SELECT {_SET_COLUMNS} FROM chat_turn_change_sets WHERE id = $1", set_uuid
        )
        if set_row is None:
            raise ChangeSetNotFoundError(f"变更集不存在: {change_set_id}")
        change_set = _row_dict(set_row)
        files = [
            _row_dict(r)
            for r in await conn.fetch(
                f"SELECT {_FILE_COLUMNS} FROM chat_turn_change_files "
                "WHERE change_set_id = $1 ORDER BY created_at, path",
                set_uuid,
            )
        ]

        rewind_status = change_set.get("rewind_status")
        if rewind_status == "rewound":
            return {
                "status": "already_rewound",
                "actions": [],
                "conflicts": [],
                "applied": 0,
            }

        root = change_set.get("workspace_root")
        if not root or any(not f.get("rewind_tracked") for f in files):
            # 没有根就无法把相对路径解析成写目标;正文超限的行没有可写回的材料。
            # 两种情况都如实回答"不可回滚",不拿部分可写的行去动磁盘。
            return {
                "status": "unavailable",
                "actions": [],
                "conflicts": [],
                "applied": 0,
            }

        actions: list[dict[str, Any]] = []
        conflicts: list[dict[str, str]] = []
        plans: list[tuple[dict[str, Any], str]] = []
        for f in files:
            rel = str(f.get("path") or "")
            op = str(f.get("operation") or "modify")
            abs_path = _resolve_under_root(str(root), rel)
            if abs_path is None:
                conflicts.append({"path": rel, "reason": "path_outside_workspace"})
                actions.append(
                    {
                        "path": rel,
                        "operation": op,
                        "action": "skip",
                        "conflict": True,
                        "reason": "path_outside_workspace",
                    }
                )
                continue

            current_sha, read_error = _current_sha256(abs_path)
            expected_sha = f.get("after_sha256")
            mismatch_reason: str | None = None
            if read_error is not None:
                mismatch_reason = read_error
            elif current_sha != expected_sha:
                mismatch_reason = (
                    "current_file_missing"
                    if current_sha is None
                    else "current_content_mismatch"
                )
            if mismatch_reason is not None:
                conflicts.append({"path": rel, "reason": mismatch_reason})
                actions.append(
                    {
                        "path": rel,
                        "operation": op,
                        "action": "skip",
                        "conflict": True,
                        "reason": mismatch_reason,
                    }
                )
                continue

            before_content = f.get("before_content")
            # before 侧不存在 ⇒ 这一轮是"凭空新增",回滚动作 = 删掉它;
            # 其余(modify/delete)都能靠 before_content 写回原样。
            action = "restore" if before_content is not None else "delete"
            actions.append(
                {
                    "path": rel,
                    "operation": op,
                    "action": action,
                    "conflict": False,
                    "reason": None,
                }
            )
            plans.append((f, abs_path))

        if dry_run:
            return {
                "status": "conflict" if conflicts else "ok",
                "actions": actions,
                "conflicts": conflicts,
                "applied": 0,
            }

        if conflicts:
            # 全有全无:哪怕只有一个文件停不在 after 态,也不动任何文件 ——
            # 半截回滚会让工作区处在一个两份快照都不对应的第三种状态。
            await conn.execute(
                "UPDATE chat_turn_change_sets SET rewind_status = $2, updated_at = now() "
                "WHERE id = $1",
                set_uuid,
                "conflict",
            )
            return {
                "status": "conflict",
                "actions": actions,
                "conflicts": conflicts,
                "applied": 0,
            }

        # 执行:先标 rewinding(长写盘期间可观测),再逐文件落盘,最后一次收口。
        await conn.execute(
            "UPDATE chat_turn_change_sets SET rewind_status = $2, updated_at = now() "
            "WHERE id = $1",
            set_uuid,
            "rewinding",
        )
        applied = 0
        try:
            for f, abs_path in plans:
                before_content = f.get("before_content")
                if before_content is None:
                    Path(abs_path).unlink(missing_ok=True)
                else:
                    _atomic_write(abs_path, str(before_content))
                applied += 1
        except Exception as e:  # noqa: BLE001 - 写盘失败必须显式标 conflict
            logger.warning(
                "change_set_store 回滚写盘失败(已写 %d/%d): %s", applied, len(plans), e
            )
            await conn.execute(
                "UPDATE chat_turn_change_sets SET rewind_status = $2, updated_at = now() "
                "WHERE id = $1",
                set_uuid,
                "conflict",
            )
            return {
                "status": "conflict",
                "actions": actions,
                "conflicts": [{"path": "_write", "reason": f"write_error:{type(e).__name__}"}],
                "applied": applied,
            }

        await conn.execute(
            "UPDATE chat_turn_change_files SET rewind_applied_at = now() "
            "WHERE change_set_id = $1",
            set_uuid,
        )
        await conn.execute(
            "UPDATE chat_turn_change_sets SET rewind_status = $2, updated_at = now() "
            "WHERE id = $1",
            set_uuid,
            "rewound",
        )
        return {"status": "ok", "actions": actions, "conflicts": [], "applied": applied}


__all__ = [
    "ChangeSetNotFoundError",
    "ChangeTurnContext",
    "begin_turn",
    "current_turn_context",
    "end_turn",
    "get_change_set",
    "list_change_sets",
    "record_file_change",
    "rewind_change_set",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
