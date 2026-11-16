# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""子代理共享任务板。

设计依据
--------
按行为规格:

    TeamTaskBoard.create: 建 unowned pending 任务, revision=1, subject≤200 /
      description≤16384, 依赖图校验, 超 max_tasks 报 TEAM_TASK_LIMIT。
    TeamTaskBoard.update: Compare-and-set —— revision 不匹配报
      TEAM_TASK_STALE_REVISION; 已删除报 TEAM_TASK_DELETED; 授权:
      非 Lead 且非 owner 报 TEAM_TASK_UNAUTHORIZED; reassign 仅 Lead 报
      TEAM_LEAD_REQUIRED。8 个 action: claim/release/edit/set_dependencies/
      complete/reopen/reassign/delete, 各有前置状态校验。
    validation.requiredText: trim 后非空 + ≤maxLength。
    validation.writeScope: 反斜杠→斜杠、剥 ./ 前缀、剥尾斜杠; 绝对路径 /
      盘符 / 空 / . / .. 段报 TEAM_INVALID_WRITE_SCOPE（advisory, 非锁）。
    task-view.projectTaskView: ready = pending ∧ 所有 blocker completed;
      writeScopeWarnings = 与其它 in_progress 任务按路径前缀重叠
      （scopesOverlap: 相等 / 一方以 "other/" 开头）。

对照 IHUI 缺口
--------------
``subagent_jobs`` 有作业台（start/list/wait/send + lineage 续跑）, 但无
**共享任务板**: 无 owner 授权、无 revision CAS、无依赖图、无 writeScope 警告。
本模块补齐任务板纯状态机（零 IO, 调用方持有 journal/持久化）。

设计要点（纯函数, 零 IO）
------------------------
1. ``TeamTaskBoard``: create/get/list/update, 全部纯内存, 不持久化（调用方落账）;
2. revision CAS + Lead/owner 授权 + 8 action 前置校验 + 依赖图校验;
3. ``project_task_view``: ready + writeScopeWarnings 推导;
4. ``required_text`` / ``write_scope``: 输入归一 + 校验;
5. 稳定错误码（TeamError）对齐 外部实现: TEAM_TASK_STALE_REVISION 等。

与既有层关系
--------------
- ``subagent_jobs``: 单 agent 作业台（后台执行）; 本模块管**跨 agent 共享任务板**;
- 调用方负责把 ``append`` 出的任务快照持久化（journal/DB）, 本模块不 IO。
"""

from __future__ import annotations

import builtins  # 类内定义了 list() 方法会遮蔽内置 list 类型, 内部辅助注解用 builtins.list
import re
from dataclasses import dataclass, field, replace
from enum import StrEnum

# ── 错误码（对齐 外部实现 稳定枚举） ──────────────────────────────────────────────


class TeamErrorCode(StrEnum):
    """共享任务板稳定错误码。"""

    TEAM_DISABLED = "TEAM_DISABLED"
    TEAM_TASK_LIMIT = "TEAM_TASK_LIMIT"
    TEAM_TASK_NOT_FOUND = "TEAM_TASK_NOT_FOUND"
    TEAM_TASK_STALE_REVISION = "TEAM_TASK_STALE_REVISION"
    TEAM_TASK_DELETED = "TEAM_TASK_DELETED"
    TEAM_TASK_UNAUTHORIZED = "TEAM_TASK_UNAUTHORIZED"
    TEAM_LEAD_REQUIRED = "TEAM_LEAD_REQUIRED"
    TEAM_TASK_ALREADY_CLAIMED = "TEAM_TASK_ALREADY_CLAIMED"
    TEAM_TASK_BLOCKED = "TEAM_TASK_BLOCKED"
    TEAM_TASK_INVALID_TRANSITION = "TEAM_TASK_INVALID_TRANSITION"
    TEAM_TASK_DEPENDENCY_CYCLE = "TEAM_TASK_DEPENDENCY_CYCLE"
    TEAM_TASK_HAS_DEPENDENTS = "TEAM_TASK_HAS_DEPENDENTS"
    TEAM_TASK_ID_EXHAUSTED = "TEAM_TASK_ID_EXHAUSTED"
    TEAM_INVALID_ARGUMENT = "TEAM_INVALID_ARGUMENT"
    TEAM_INVALID_WRITE_SCOPE = "TEAM_INVALID_WRITE_SCOPE"
    TEAM_MEMBER_NOT_FOUND = "TEAM_MEMBER_NOT_FOUND"


class TeamError(Exception):
    """共享任务板错误（带稳定 code）。"""

    def __init__(self, message: str, code: TeamErrorCode) -> None:
        super().__init__(message)
        self.code = code


# ── 领域类型 ────────────────────────────────────────────────────────────────


class TaskStatus(StrEnum):
    """任务状态。"""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELETED = "deleted"


class TaskAction(StrEnum):
    """任务转换动作。"""

    CLAIM = "claim"
    RELEASE = "release"
    EDIT = "edit"
    SET_DEPENDENCIES = "set_dependencies"
    COMPLETE = "complete"
    REOPEN = "reopen"
    REASSIGN = "reassign"
    DELETE = "delete"


_TASK_ID_RE = re.compile(r"^task-(\d+)$")
_MAX_SAFE_INT = (1 << 53) - 1


@dataclass(frozen=True)
class TeamTaskSnapshot:
    """一个共享任务的持久快照。"""

    id: str
    revision: int
    subject: str
    description: str
    status: str  # ``TaskStatus`` 之一
    blocked_by: tuple[str, ...] = ()
    write_scopes: tuple[str, ...] = ()
    owner_id: str | None = None
    owner_name: str | None = None


@dataclass(frozen=True)
class TeamTaskView:
    """一个共享任务的模型视图（含 ready / writeScope 警告）。"""

    id: str
    revision: int
    subject: str
    description: str
    status: str
    blocked_by: tuple[str, ...]
    write_scopes: tuple[str, ...]
    ready: bool
    write_scope_warnings: tuple[str, ...]
    owner_id: str | None = None
    owner_name: str | None = None


@dataclass
class TeamState:
    """一个 Team（root）的任务板状态。"""

    id: str
    tasks: list[TeamTaskSnapshot] = field(default_factory=list)
    next_task_number: int = 1
    enabled: bool = False


# ── 输入归一 + 校验 ─────────────────────────────────────────────────────────


def required_text(value: str, field_name: str, max_length: int) -> str:
    """归一必填文本: trim 后非空 + ≤max_length（纯函数）。"""
    text = (value or "").strip()
    if len(text) == 0:
        raise TeamError(f"{field_name} must be non-empty", TeamErrorCode.TEAM_INVALID_ARGUMENT)
    if len(text) > max_length:
        raise TeamError(
            f"{field_name} exceeds {max_length} characters", TeamErrorCode.TEAM_INVALID_ARGUMENT
        )
    return text


_SCOPE_ABS_RE = re.compile(r"^[a-z]:", re.IGNORECASE)


def write_scope(value: str) -> str:
    """归一 workspace-relative 路径前缀（advisory, 非锁, 纯函数）。

    反斜杠→斜杠、剥 ``./`` 前缀、剥尾斜杠; 绝对路径 / 盘符 / 空 / ``.`` / ``..``
    段报 TEAM_INVALID_WRITE_SCOPE。
    """
    normalized = (value or "").replace("\\", "/").removeprefix("./").rstrip("/")
    segments = normalized.split("/")
    invalid = (
        len(normalized) == 0
        or normalized.startswith("/")
        or _SCOPE_ABS_RE.match(normalized) is not None
        or any(seg == "" or seg == "." or seg == ".." for seg in segments)
    )
    if invalid:
        raise TeamError(
            f"invalid workspace-relative write scope {value!r}",
            TeamErrorCode.TEAM_INVALID_WRITE_SCOPE,
        )
    return normalized


def _task_id(value: str) -> str:
    """校验 task id 形态（task-<safe int> 或非数字自定义 id）。"""
    text = (value or "").strip()
    if not text:
        raise TeamError("task id must be non-empty", TeamErrorCode.TEAM_INVALID_ARGUMENT)
    m = _TASK_ID_RE.match(text)
    if m is not None and not (0 <= int(m.group(1)) <= _MAX_SAFE_INT):
        raise TeamError("numeric task id suffix must be a safe integer", TeamErrorCode.TEAM_INVALID_ARGUMENT)
    return text


# ── 依赖图校验 ──────────────────────────────────────────────────────────────


def assert_task_graph_candidate(
    tasks: list[TeamTaskSnapshot], candidate: TeamTaskSnapshot
) -> None:
    """校验候选任务快照的依赖图无环、无自依赖、blocker 存在且未删（纯函数）。"""
    # 构建全量边集（用候选覆盖同 id 的旧版）
    edges: dict[str, set[str]] = {}
    for t in tasks:
        if t.id == candidate.id:
            continue
        if t.status != "deleted":
            edges[t.id] = set(t.blocked_by)
    edges[candidate.id] = set(candidate.blocked_by)
    # 校验每个 blocker 存在且未删
    by_id = {t.id: t for t in tasks}
    for blocker in candidate.blocked_by:
        target = by_id.get(blocker)
        if target is None or target.status == "deleted":
            raise TeamError(f"blocker task {blocker!r} not found", TeamErrorCode.TEAM_TASK_NOT_FOUND)
    # DFS 检测环
    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[str, int] = dict.fromkeys(edges, WHITE)

    def visit(node: str) -> None:
        color[node] = GRAY
        for nxt in edges.get(node, ()):
            c = color.get(nxt, WHITE)
            if c == GRAY:
                raise TeamError(
                    "task dependency cycle detected", TeamErrorCode.TEAM_TASK_DEPENDENCY_CYCLE
                )
            if c == WHITE:
                visit(nxt)
        color[node] = BLACK

    for nid in list(edges):
        if color[nid] == WHITE:
            visit(nid)


# ── 任务视图推导 ────────────────────────────────────────────────────────────


def _scopes_overlap(left: str, right: str) -> bool:
    """两个归一化 writeScope 是否按路径前缀重叠（相等 / 一方以 "other/" 开头）。"""
    return left == right or left.startswith(f"{right}/") or right.startswith(f"{left}/")


def task_ready(state: TeamState, task: TeamTaskSnapshot) -> bool:
    """所有 blocker 都 completed 才 ready（纯函数）。"""
    by_id = {t.id: t for t in state.tasks}
    return all(
        (by_id.get(b) is not None and by_id[b].status == TaskStatus.COMPLETED.value)
        for b in task.blocked_by
    )


def project_task_view(state: TeamState, task: TeamTaskSnapshot) -> TeamTaskView:
    """推导任务视图: ready + 与其它 in_progress 任务的 writeScope 警告（纯函数）。"""
    warnings: set[str] = set()
    for other in state.tasks:
        if other.id == task.id or other.status != TaskStatus.IN_PROGRESS.value:
            continue
        if any(
            _scopes_overlap(left, right)
            for left in task.write_scopes
            for right in other.write_scopes
        ):
            warnings.add(f"write scopes overlap with {other.id}")
    return TeamTaskView(
        id=task.id,
        revision=task.revision,
        subject=task.subject,
        description=task.description,
        status=task.status,
        blocked_by=tuple(task.blocked_by),
        write_scopes=tuple(task.write_scopes),
        owner_id=task.owner_id,
        owner_name=task.owner_name,
        ready=task.status == TaskStatus.PENDING.value and task_ready(state, task),
        write_scope_warnings=tuple(warnings),
    )


# ── 更新请求 ────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class UpdateRequest:
    """一次 CAS 任务更新请求。"""

    task_id: str
    expected_revision: int
    action: str  # ``TaskAction`` 之一
    subject: str | None = None
    description: str | None = None
    blocked_by: tuple[str, ...] | None = None
    write_scopes: tuple[str, ...] | None = None
    owner: str | None = None  # 仅 Lead reassign


# ── 共享任务板 ──────────────────────────────────────────────────────────────


class TeamTaskBoard:
    """共享任务板纯状态机（零 IO; 调用方持有 state 并负责持久化）。"""

    def __init__(self, state: TeamState, *, max_tasks: int = 200) -> None:
        self._state = state
        self._max_tasks = max_tasks

    @property
    def state(self) -> TeamState:
        return self._state

    def _require_enabled(self) -> None:
        if self._state.enabled is not True:
            raise TeamError(
                "enable Agent Teams for this Session before using the task board",
                TeamErrorCode.TEAM_DISABLED,
            )

    # -- create ------------------------------------------------------------

    def create(
        self,
        *,
        subject: str,
        description: str,
        blocked_by: tuple[str, ...] = (),
        write_scopes: tuple[str, ...] = (),
    ) -> TeamTaskView:
        """建 unowned pending 任务, revision=1（纯函数）。

        校验: subject≤200 / description≤16384 / 依赖图 / max_tasks 上限。
        """
        self._require_enabled()
        active = sum(1 for t in self._state.tasks if t.status != TaskStatus.DELETED.value)
        if active >= self._max_tasks:
            raise TeamError(
                f"Team task limit {self._max_tasks} reached", TeamErrorCode.TEAM_TASK_LIMIT
            )
        task_id = f"task-{self._state.next_task_number}"
        if any(t.id == task_id for t in self._state.tasks):
            raise TeamError("Team task id space exhausted", TeamErrorCode.TEAM_TASK_ID_EXHAUSTED)
        deps = self._validate_dependencies(blocked_by, self_id=task_id)
        scopes = self._normalize_scopes(write_scopes)
        task = TeamTaskSnapshot(
            id=task_id,
            revision=1,
            subject=required_text(subject, "subject", 200),
            description=required_text(description, "description", 16_384),
            status=TaskStatus.PENDING.value,
            blocked_by=tuple(deps),
            write_scopes=tuple(scopes),
        )
        assert_task_graph_candidate(self._state.tasks, task)
        self._commit(task)
        return project_task_view(self._state, task)

    # -- get / list --------------------------------------------------------

    def get(self, task_id: str) -> TeamTaskView:
        """取一个任务（含 deleted tombstone）（纯函数）。"""
        self._require_enabled()
        tid = _task_id(task_id)
        task = next((t for t in self._state.tasks if t.id == tid), None)
        if task is None:
            raise TeamError(f'team task "{tid}" not found', TeamErrorCode.TEAM_TASK_NOT_FOUND)
        return project_task_view(self._state, task)

    def list(self) -> list[TeamTaskView]:
        """列当前非 deleted 任务（创建序）（纯函数）。"""
        self._require_enabled()
        return [
            project_task_view(self._state, t)
            for t in self._state.tasks
            if t.status != TaskStatus.DELETED.value
        ]

    # -- update ------------------------------------------------------------

    def update(self, *, caller_id: str, is_lead: bool, request: UpdateRequest) -> TeamTaskView:
        """Compare-and-set 一个授权的任务转换（纯函数）。

        revision CAS + Lead/owner 授权 + action 前置状态校验 + 依赖图校验。
        """
        self._require_enabled()
        tid = _task_id(request.task_id)
        current = next((t for t in self._state.tasks if t.id == tid), None)
        if current is None:
            raise TeamError(f'team task "{tid}" not found', TeamErrorCode.TEAM_TASK_NOT_FOUND)
        if current.revision != request.expected_revision:
            raise TeamError(
                f'stale team task "{current.id}" revision {request.expected_revision}; '
                f"current revision is {current.revision}",
                TeamErrorCode.TEAM_TASK_STALE_REVISION,
            )
        if current.status == TaskStatus.DELETED.value:
            raise TeamError(f'team task "{current.id}" is deleted', TeamErrorCode.TEAM_TASK_DELETED)
        owner = current.owner_id == caller_id
        action = (request.action or "").strip().lower()
        next_task = self._apply_action(
            current, caller_id=caller_id, is_lead=is_lead, owner=owner, action=action, request=request
        )
        committed = replace(next_task, revision=current.revision + 1)
        assert_task_graph_candidate(self._state.tasks, committed)
        self._commit(committed)
        return project_task_view(self._state, committed)

    # -- action 应用 -------------------------------------------------------

    def _apply_action(
        self,
        current: TeamTaskSnapshot,
        *,
        caller_id: str,
        is_lead: bool,
        owner: bool,
        action: str,
        request: UpdateRequest,
    ) -> TeamTaskSnapshot:
        def authorize_owner() -> None:
            if not is_lead and not owner:
                raise TeamError(
                    "task mutation requires its owner or Team Lead",
                    TeamErrorCode.TEAM_TASK_UNAUTHORIZED,
                )

        if action == TaskAction.CLAIM.value:
            if current.owner_id is not None and current.owner_id != caller_id:
                raise TeamError(
                    f'team task "{current.id}" is owned by another member',
                    TeamErrorCode.TEAM_TASK_ALREADY_CLAIMED,
                )
            if current.status != TaskStatus.PENDING.value or not task_ready(self._state, current):
                raise TeamError(
                    f'team task "{current.id}" is not ready to claim', TeamErrorCode.TEAM_TASK_BLOCKED
                )
            return replace(
                self._without_owner(current),
                status=TaskStatus.IN_PROGRESS.value,
                owner_id=caller_id,
            )
        if action == TaskAction.RELEASE.value:
            authorize_owner()
            if current.status != TaskStatus.IN_PROGRESS.value:
                raise TeamError(
                    "only an in-progress task can be released",
                    TeamErrorCode.TEAM_TASK_INVALID_TRANSITION,
                )
            return self._without_owner(replace(current, status=TaskStatus.PENDING.value))
        if action == TaskAction.EDIT.value:
            authorize_owner()
            if (
                request.subject is None
                and request.description is None
                and request.write_scopes is None
            ):
                raise TeamError(
                    "task edit requires subject, description, or write_scopes",
                    TeamErrorCode.TEAM_INVALID_ARGUMENT,
                )
            next_subject = (
                current.subject
                if request.subject is None
                else required_text(request.subject, "subject", 200)
            )
            next_description = (
                current.description
                if request.description is None
                else required_text(request.description, "description", 16_384)
            )
            next_scopes = (
                current.write_scopes
                if request.write_scopes is None
                else tuple(self._normalize_scopes(request.write_scopes))
            )
            return replace(
                current,
                subject=next_subject,
                description=next_description,
                write_scopes=next_scopes,
            )
        if action == TaskAction.SET_DEPENDENCIES.value:
            authorize_owner()
            if request.blocked_by is None:
                raise TeamError(
                    "set_dependencies requires blocked_by", TeamErrorCode.TEAM_INVALID_ARGUMENT
                )
            return replace(
                current,
                blocked_by=tuple(
                    self._validate_dependencies(request.blocked_by, self_id=current.id)
                ),
            )
        if action == TaskAction.COMPLETE.value:
            authorize_owner()
            if current.status != TaskStatus.IN_PROGRESS.value:
                raise TeamError(
                    "only an in-progress task can complete",
                    TeamErrorCode.TEAM_TASK_INVALID_TRANSITION,
                )
            return replace(current, status=TaskStatus.COMPLETED.value)
        if action == TaskAction.REOPEN.value:
            authorize_owner()
            if current.status != TaskStatus.COMPLETED.value:
                raise TeamError(
                    "only a completed task can reopen",
                    TeamErrorCode.TEAM_TASK_INVALID_TRANSITION,
                )
            return self._without_owner(replace(current, status=TaskStatus.PENDING.value))
        if action == TaskAction.REASSIGN.value:
            if not is_lead:
                raise TeamError(
                    "only the Team Lead can reassign tasks", TeamErrorCode.TEAM_LEAD_REQUIRED
                )
            if current.status not in (
                TaskStatus.PENDING.value,
                TaskStatus.IN_PROGRESS.value,
            ):
                raise TeamError(
                    "only a pending or in-progress task can be reassigned",
                    TeamErrorCode.TEAM_TASK_INVALID_TRANSITION,
                )
            if request.owner is None:
                return self._without_owner(replace(current, status=TaskStatus.PENDING.value))
            if not task_ready(self._state, current):
                raise TeamError(
                    f'team task "{current.id}" is blocked', TeamErrorCode.TEAM_TASK_BLOCKED
                )
            return replace(
                self._without_owner(current),
                status=TaskStatus.IN_PROGRESS.value,
                owner_id=request.owner,
                owner_name=request.owner,
            )
        if action == TaskAction.DELETE.value:
            authorize_owner()
            dependent = next(
                (
                    t
                    for t in self._state.tasks
                    if t.status != TaskStatus.DELETED.value
                    and t.id != current.id
                    and current.id in t.blocked_by
                ),
                None,
            )
            if dependent is not None:
                raise TeamError(
                    f'team task "{current.id}" still blocks "{dependent.id}"',
                    TeamErrorCode.TEAM_TASK_HAS_DEPENDENTS,
                )
            return replace(current, status=TaskStatus.DELETED.value)
        raise TeamError(
            f"unsupported task action {action!r}", TeamErrorCode.TEAM_INVALID_ARGUMENT
        )

    # -- 辅助 --------------------------------------------------------------

    def _without_owner(self, task: TeamTaskSnapshot) -> TeamTaskSnapshot:
        return replace(task, owner_id=None, owner_name=None)

    def _validate_dependencies(
        self, values: tuple[str, ...], *, self_id: str
    ) -> builtins.list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for raw in values:
            dep = _task_id(raw)
            if dep == self_id:
                raise TeamError(
                    "a team task cannot block itself", TeamErrorCode.TEAM_TASK_DEPENDENCY_CYCLE
                )
            if dep in seen:
                raise TeamError(
                    f'duplicate blocker "{dep}"', TeamErrorCode.TEAM_INVALID_ARGUMENT
                )
            target = next((t for t in self._state.tasks if t.id == dep), None)
            if target is None or target.status == TaskStatus.DELETED.value:
                raise TeamError(
                    f'blocker task "{dep}" not found', TeamErrorCode.TEAM_TASK_NOT_FOUND
                )
            seen.add(dep)
            result.append(dep)
        return result

    def _normalize_scopes(self, values: tuple[str, ...]) -> builtins.list[str]:
        return list(dict.fromkeys(write_scope(v) for v in values))

    def _commit(self, task: TeamTaskSnapshot) -> None:
        idx = next((i for i, t in enumerate(self._state.tasks) if t.id == task.id), -1)
        if idx >= 0:
            self._state.tasks[idx] = task
        else:
            self._state.tasks.append(task)
        m = _TASK_ID_RE.match(task.id)
        if m is not None:
            n = int(m.group(1))
            nxt = n if n == _MAX_SAFE_INT else n + 1
            self._state.next_task_number = max(self._state.next_task_number, nxt)


__all__ = [
    "TeamErrorCode",
    "TeamError",
    "TaskStatus",
    "TaskAction",
    "TeamTaskSnapshot",
    "TeamTaskView",
    "TeamState",
    "UpdateRequest",
    "required_text",
    "write_scope",
    "assert_task_graph_candidate",
    "task_ready",
    "project_task_view",
    "TeamTaskBoard",
]
