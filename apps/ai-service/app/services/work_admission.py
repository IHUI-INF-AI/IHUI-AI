# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""聊天执行前的宿主工作准入。

设计来自 DeepSeek 公开原型 dsh-superagent-prototype(MIT,
提交 8c32a9dc5d72c033816c6a8110b37f40cf94fba4)的分层:
先由确定性 gate 给出强度,研判不能把推断升级成明确;
观察模式只记录「本会接单」,不派工。
本文件按本仓 LangGraph 另写,不包含上游源码。
范围由宿主固定。研判函数看不到消息正文,也不能改强度或范围。

工单账挂在已有会话库(同一个 sessions.db)的 work_admission_tickets 表上,
不另开账本文件。重启后按 trigger_id 读回已派工 / 已丢弃 / 模拟未完成,
同一 trigger 不再派一次。测试默认仍用内存账,不连生产库。
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import threading
import uuid
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal, Protocol

AcceptMode = Literal["off", "observe", "auto"]
Strength = Literal["explicit", "inferred"]
DecisionKind = Literal["accept", "stop", "ignore", "unavailable"]
ActorKind = Literal["person", "bot"]
Intent = Literal["work", "stop"]
AssignmentState = Literal["pending", "running", "ended"]
ReportKind = Literal["progress", "waiting", "ready", "blocked", "failed", "dropped"]

REPORT_KINDS: frozenset[str] = frozenset(
    {"progress", "waiting", "ready", "blocked", "failed", "dropped"}
)
_VIEW_KEYS = frozenset(
    {
        "trigger_id",
        "actor_id",
        "actor_kind",
        "addressed",
        "intent",
        "follow_up_ticket_id",
        "source",
        "policy_version",
        "accept_mode",
        "allowed_actors",
        "bot_actors",
        "rules",
    }
)
_RULE_KEYS = frozenset({"id", "enabled"})
_TRIGGER_TOKEN = re.compile(r"^[A-Za-z0-9_-]{1,80}$")
_LEDGER_LIMIT = 500

SPEAK_OBSERVE = "观察模式记下了这条可接的工作,还没有派工。"
SPEAK_UNAVAILABLE = "这次没有判完,需要人看一下。"
SPEAK_STOP = "已停止这张工单。"
SPEAK_LEDGER = "工单账本已满,这次没有派工。"


@dataclass(frozen=True)
class Rule:
    id: str
    enabled: bool


@dataclass(frozen=True)
class HostView:
    """宿主断言。没有消息正文字段。"""

    trigger_id: str
    actor_id: str
    actor_kind: ActorKind
    addressed: bool
    intent: Intent
    follow_up_ticket_id: str | None
    source: str
    policy_version: str
    accept_mode: AcceptMode
    allowed_actors: frozenset[str]
    bot_actors: frozenset[str]
    rules: tuple[Rule, ...]


@dataclass(frozen=True)
class Assessment:
    """研判结果。没有强度、范围或决定字段。"""

    matched_rule_ids: tuple[str, ...]
    failed: bool = False


@dataclass(frozen=True)
class Mandate:
    policy_version: str
    scope: str
    strength: Strength
    matched_rule_ids: tuple[str, ...]
    actor_id: str
    source: str


@dataclass
class TicketRec:
    ticket_id: str
    trigger_id: str
    mandate: Mandate
    open: bool
    stopped_by_person: bool
    assignment: AssignmentState
    allowed_actors: frozenset[str]
    last_report: str | None = None
    #: stub 收尾。不把工单标成完成,重启后读作「模拟未完成」。
    simulation: bool = False


TerminalState = Literal["dispatched", "dropped", "simulation_incomplete"]


def trigger_disposition(rec: TicketRec) -> TerminalState:
    """同一 trigger 重启后读回的终态。

    dispatched = 已派工(仍在跑、已完成、真实失败都算已经派过);
    dropped = 已丢弃;simulation_incomplete = 模拟未完成。
    """
    if rec.last_report == "dropped":
        return "dropped"
    if rec.simulation:
        return "simulation_incomplete"
    return "dispatched"


@dataclass(frozen=True)
class Outcome:
    kind: DecisionKind
    reason: str
    runs_worker: bool
    would_accept: bool
    speak: str
    strength: Strength | None
    ticket_id: str | None
    scope: str
    mandate: Mandate | None


Assessor = Callable[[HostView], Assessment]


def default_assessor(_view: HostView) -> Assessment:
    """不读正文。推断候选默认不命中规则,失败关闭。"""
    return Assessment(matched_rule_ids=())


def server_accept_mode() -> AcceptMode:
    """操作者策略。非法值落回观察模式,不会落到自动派工。"""
    raw = os.environ.get("IHUI_WORK_ACCEPT_MODE", "observe").strip().lower()
    if raw == "off":
        return "off"
    if raw == "auto":
        return "auto"
    return "observe"


def namespaced_trigger_id(user_id: str, client_id: str | None) -> str:
    """幂等键带上认证主体,调用方不能拿别人的键撞车。"""
    if client_id and _TRIGGER_TOKEN.fullmatch(client_id):
        return f"{user_id}:{client_id}"
    return f"{user_id}:{uuid.uuid4()}"


def build_chat_trigger(
    *,
    user_id: str,
    session_id: str,
    trigger_id: str,
    addressed: bool,
) -> dict[str, object]:
    """只放白名单键。消息正文和客户端自报的权限都不进这张视图。"""
    return {
        "trigger_id": trigger_id,
        "actor_id": user_id,
        "actor_kind": "person",
        "addressed": addressed,
        "intent": "work",
        "source": f"chat:{session_id}",
        "policy_version": "ihui-chat-1",
        "accept_mode": server_accept_mode(),
        "allowed_actors": [user_id],
        "bot_actors": [],
        "rules": [{"id": "user-asked", "enabled": True}],
    }


def parse_host_view(raw: Mapping[str, object]) -> HostView | None:
    """多一个键就整张拒绝。合并进消息正文或自报权限时失败关闭。"""
    if set(raw) - _VIEW_KEYS:
        return None
    trigger_id = _text(raw.get("trigger_id"))
    actor_id = _text(raw.get("actor_id"))
    source = _text(raw.get("source"))
    policy_version = _text(raw.get("policy_version"))
    actor_kind = raw.get("actor_kind")
    intent = raw.get("intent")
    accept_mode = raw.get("accept_mode")
    addressed = raw.get("addressed")
    if (
        trigger_id is None
        or actor_id is None
        or source is None
        or policy_version is None
        or actor_kind not in ("person", "bot")
        or intent not in ("work", "stop")
        or accept_mode not in ("off", "observe", "auto")
        or not isinstance(addressed, bool)
    ):
        return None
    follow = raw.get("follow_up_ticket_id", None)
    if follow is not None and not isinstance(follow, str):
        return None
    allowed = _ids(raw.get("allowed_actors"))
    bots = _ids(raw.get("bot_actors"))
    rules = _rules(raw.get("rules"))
    if allowed is None or bots is None or rules is None:
        return None
    return HostView(
        trigger_id=trigger_id,
        actor_id=actor_id,
        actor_kind=actor_kind,
        addressed=addressed,
        intent=intent,
        follow_up_ticket_id=follow if isinstance(follow, str) else None,
        source=source,
        policy_version=policy_version,
        accept_mode=accept_mode,
        allowed_actors=allowed,
        bot_actors=bots,
        rules=rules,
    )


class TicketStore(Protocol):
    """工单账的存储口。内存与会话库各一份实现,判据不复制。"""

    def find_trigger(self, trigger_id: str) -> TicketRec | None: ...

    def get(self, ticket_id: str) -> TicketRec | None: ...

    def __len__(self) -> int: ...

    def add(self, rec: TicketRec) -> bool: ...

    def save(self, rec: TicketRec) -> None: ...

    def close(self) -> None: ...


class MemoryTicketStore:
    """进程内账。测试缺省用它,不碰会话库。"""

    def __init__(self, *, limit: int = _LEDGER_LIMIT) -> None:
        self._by_trigger: dict[str, str] = {}
        self._tickets: dict[str, TicketRec] = {}
        self._order: list[str] = []
        self._limit = limit

    def find_trigger(self, trigger_id: str) -> TicketRec | None:
        ticket_id = self._by_trigger.get(trigger_id)
        if ticket_id is None:
            return None
        return self._tickets.get(ticket_id)

    def get(self, ticket_id: str) -> TicketRec | None:
        return self._tickets.get(ticket_id)

    def __len__(self) -> int:
        return len(self._tickets)

    def add(self, rec: TicketRec) -> bool:
        if rec.ticket_id in self._tickets:
            return True
        if len(self._tickets) >= self._limit and not self._evict_ended():
            return False
        self._remember(rec)
        return True

    def save(self, rec: TicketRec) -> None:
        self._remember(rec)

    def close(self) -> None:
        return None

    def _remember(self, rec: TicketRec) -> None:
        self._tickets[rec.ticket_id] = rec
        self._by_trigger[rec.trigger_id] = rec.ticket_id
        if rec.ticket_id not in self._order:
            self._order.append(rec.ticket_id)

    def _evict_ended(self) -> bool:
        for ticket_id in list(self._order):
            rec = self._tickets.get(ticket_id)
            if rec is not None and not rec.open:
                self._tickets.pop(ticket_id, None)
                self._order.remove(ticket_id)
                if self._by_trigger.get(rec.trigger_id) == ticket_id:
                    self._by_trigger.pop(rec.trigger_id, None)
                return True
        return False


_CREATE_TICKETS = (
    "CREATE TABLE IF NOT EXISTS work_admission_tickets ("
    "ticket_id TEXT PRIMARY KEY, "
    "trigger_id TEXT NOT NULL UNIQUE, "
    "policy_version TEXT NOT NULL, "
    "scope TEXT NOT NULL, "
    "strength TEXT NOT NULL, "
    "matched_rule_ids TEXT NOT NULL, "
    "actor_id TEXT NOT NULL, "
    "source TEXT NOT NULL, "
    "is_open INTEGER NOT NULL, "
    "stopped_by_person INTEGER NOT NULL, "
    "assignment TEXT NOT NULL, "
    "allowed_actors TEXT NOT NULL, "
    "last_report TEXT, "
    "simulation INTEGER NOT NULL DEFAULT 0)"
)
_CREATE_TICKET_INDEX = (
    "CREATE INDEX IF NOT EXISTS idx_work_admission_tickets_open "
    "ON work_admission_tickets(is_open)"
)

_INSERT_TICKET = (
    "INSERT INTO work_admission_tickets ("
    "ticket_id, trigger_id, policy_version, scope, strength, matched_rule_ids, "
    "actor_id, source, is_open, stopped_by_person, assignment, allowed_actors, "
    "last_report, simulation) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
)

_UPDATE_TICKET = (
    "UPDATE work_admission_tickets SET trigger_id = ?, policy_version = ?, "
    "scope = ?, strength = ?, matched_rule_ids = ?, actor_id = ?, source = ?, "
    "is_open = ?, stopped_by_person = ?, assignment = ?, allowed_actors = ?, "
    "last_report = ?, simulation = ? WHERE ticket_id = ?"
)


def session_db_path() -> Path:
    """工单表落在会话库文件里。路径口径与 SessionStore 同一函数,不另选文件。"""
    from app.routers.sessions import resolve_session_db_path

    return Path(resolve_session_db_path())


def _ticket_values(rec: TicketRec) -> tuple[str | int | None, ...]:
    rules = json.dumps(list(rec.mandate.matched_rule_ids), ensure_ascii=False)
    actors = json.dumps(sorted(rec.allowed_actors), ensure_ascii=False)
    return (
        rec.ticket_id,
        rec.trigger_id,
        rec.mandate.policy_version,
        rec.mandate.scope,
        rec.mandate.strength,
        rules,
        rec.mandate.actor_id,
        rec.mandate.source,
        1 if rec.open else 0,
        1 if rec.stopped_by_person else 0,
        rec.assignment,
        actors,
        rec.last_report,
        1 if rec.simulation else 0,
    )


def _text_cell(row: sqlite3.Row, key: str, *, allow_empty: bool) -> str | None:
    value = row[key]
    if not isinstance(value, str):
        return None
    if value or allow_empty:
        return value
    return None


def _bit_cell(row: sqlite3.Row, key: str) -> bool | None:
    value = row[key]
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in (0, 1):
        return value == 1
    return None


def _text_tuple_cell(row: sqlite3.Row, key: str) -> tuple[str, ...] | None:
    raw = row[key]
    if not isinstance(raw, str):
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(parsed, list):
        return None
    found: list[str] = []
    for item in parsed:
        if not isinstance(item, str):
            return None
        found.append(item)
    return tuple(found)


def _unreadable_ticket(trigger_id: str, ticket_id: str) -> TicketRec:
    """行在,但读不成。当作已结束,避免重启后把同一 trigger 再派一次。"""
    return TicketRec(
        ticket_id=ticket_id or "tk_unreadable",
        trigger_id=trigger_id or "unreadable",
        mandate=Mandate(
            policy_version="unreadable",
            scope="",
            strength="explicit",
            matched_rule_ids=(),
            actor_id="",
            source="",
        ),
        open=False,
        stopped_by_person=True,
        assignment="ended",
        allowed_actors=frozenset(),
        last_report="failed",
        simulation=False,
    )


def _ticket_from_row(row: sqlite3.Row) -> TicketRec:
    trigger_id = _text_cell(row, "trigger_id", allow_empty=False) or ""
    ticket_id = _text_cell(row, "ticket_id", allow_empty=False) or ""
    blocked = _unreadable_ticket(trigger_id, ticket_id)
    policy = _text_cell(row, "policy_version", allow_empty=False)
    actor_id = _text_cell(row, "actor_id", allow_empty=False)
    scope = _text_cell(row, "scope", allow_empty=True)
    source = _text_cell(row, "source", allow_empty=True)
    rules = _text_tuple_cell(row, "matched_rule_ids")
    actors = _text_tuple_cell(row, "allowed_actors")
    is_open = _bit_cell(row, "is_open")
    stopped = _bit_cell(row, "stopped_by_person")
    simulation = _bit_cell(row, "simulation")
    strength_raw = _text_cell(row, "strength", allow_empty=False)
    assignment_raw = _text_cell(row, "assignment", allow_empty=False)
    last_raw = row["last_report"]
    if (
        not trigger_id
        or not ticket_id
        or policy is None
        or actor_id is None
        or scope is None
        or source is None
        or rules is None
        or actors is None
        or is_open is None
        or stopped is None
        or simulation is None
    ):
        return blocked
    strength: Strength
    if strength_raw == "explicit":
        strength = "explicit"
    elif strength_raw == "inferred":
        strength = "inferred"
    else:
        return blocked
    assignment: AssignmentState
    if assignment_raw == "pending":
        assignment = "pending"
    elif assignment_raw == "running":
        assignment = "running"
    elif assignment_raw == "ended":
        assignment = "ended"
    else:
        return blocked
    last_report: str | None
    if last_raw is None:
        last_report = None
    elif isinstance(last_raw, str) and last_raw in REPORT_KINDS:
        last_report = last_raw
    else:
        return blocked
    return TicketRec(
        ticket_id=ticket_id,
        trigger_id=trigger_id,
        mandate=Mandate(
            policy_version=policy,
            scope=scope,
            strength=strength,
            matched_rule_ids=rules,
            actor_id=actor_id,
            source=source,
        ),
        open=is_open,
        stopped_by_person=stopped,
        assignment=assignment,
        allowed_actors=frozenset(actors),
        last_report=last_report,
        simulation=simulation,
    )


class SqliteTicketStore:
    """会话库里的工单表。换一个实例、甚至换一个进程,同一 trigger 仍能读回。"""

    def __init__(self, path: str | Path, *, limit: int = _LEDGER_LIMIT) -> None:
        self._path = Path(path)
        self._limit = limit
        self._lock = threading.Lock()
        self._conn: sqlite3.Connection | None = None

    def find_trigger(self, trigger_id: str) -> TicketRec | None:
        with self._lock:
            row = (
                self._connect()
                .execute(
                    "SELECT * FROM work_admission_tickets WHERE trigger_id = ?",
                    (trigger_id,),
                )
                .fetchone()
            )
        if row is None:
            return None
        return _ticket_from_row(row)

    def get(self, ticket_id: str) -> TicketRec | None:
        with self._lock:
            row = (
                self._connect()
                .execute(
                    "SELECT * FROM work_admission_tickets WHERE ticket_id = ?",
                    (ticket_id,),
                )
                .fetchone()
            )
        if row is None:
            return None
        return _ticket_from_row(row)

    def __len__(self) -> int:
        with self._lock:
            row = (
                self._connect()
                .execute("SELECT COUNT(*) AS n FROM work_admission_tickets")
                .fetchone()
            )
        if row is None:
            return 0
        return int(row["n"])

    def add(self, rec: TicketRec) -> bool:
        with self._lock:
            conn = self._connect()
            held = conn.execute(
                "SELECT ticket_id FROM work_admission_tickets WHERE ticket_id = ?",
                (rec.ticket_id,),
            ).fetchone()
            if held is not None:
                return True
            count = conn.execute("SELECT COUNT(*) AS n FROM work_admission_tickets").fetchone()
            size = int(count["n"]) if count is not None else 0
            if size >= self._limit:
                evicted = conn.execute(
                    "DELETE FROM work_admission_tickets WHERE ticket_id = ("
                    "SELECT ticket_id FROM work_admission_tickets "
                    "WHERE is_open = 0 ORDER BY rowid LIMIT 1)"
                )
                if evicted.rowcount == 0:
                    return False
            try:
                conn.execute(_INSERT_TICKET, _ticket_values(rec))
            except sqlite3.IntegrityError:
                return False
            return True

    def save(self, rec: TicketRec) -> None:
        vals = _ticket_values(rec)
        with self._lock:
            conn = self._connect()
            cur = conn.execute(_UPDATE_TICKET, vals[1:] + (rec.ticket_id,))
            if cur.rowcount != 0:
                return
            try:
                conn.execute(_INSERT_TICKET, vals)
            except sqlite3.IntegrityError:
                conn.execute(
                    "UPDATE work_admission_tickets SET ticket_id = ?, "
                    "policy_version = ?, scope = ?, strength = ?, "
                    "matched_rule_ids = ?, actor_id = ?, source = ?, "
                    "is_open = ?, stopped_by_person = ?, assignment = ?, "
                    "allowed_actors = ?, last_report = ?, simulation = ? "
                    "WHERE trigger_id = ?",
                    (
                        rec.ticket_id,
                        rec.mandate.policy_version,
                        rec.mandate.scope,
                        rec.mandate.strength,
                        vals[5],
                        rec.mandate.actor_id,
                        rec.mandate.source,
                        vals[8],
                        vals[9],
                        rec.assignment,
                        vals[11],
                        rec.last_report,
                        vals[13],
                        rec.trigger_id,
                    ),
                )

    def close(self) -> None:
        with self._lock:
            if self._conn is not None:
                self._conn.close()
                self._conn = None

    def _connect(self) -> sqlite3.Connection:
        if self._conn is None:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            conn = sqlite3.connect(
                str(self._path),
                check_same_thread=False,
                isolation_level=None,
            )
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA busy_timeout=5000")
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=FULL")
            conn.execute(_CREATE_TICKETS)
            conn.execute(_CREATE_TICKET_INDEX)
            self._conn = conn
        return self._conn


class Ledger:
    """工单账。生产挂会话库;测试可注入内存或临时库。"""

    def __init__(self, store: TicketStore | None = None) -> None:
        self._store: TicketStore = store if store is not None else MemoryTicketStore()

    def find_trigger(self, trigger_id: str) -> TicketRec | None:
        return self._store.find_trigger(trigger_id)

    def get(self, ticket_id: str) -> TicketRec | None:
        return self._store.get(ticket_id)

    def __len__(self) -> int:
        return len(self._store)

    def add(self, rec: TicketRec) -> bool:
        return self._store.add(rec)

    def save(self, rec: TicketRec) -> None:
        self._store.save(rec)

    def close(self) -> None:
        self._store.close()


_ledger: Ledger | None = None
_assessor: Assessor = default_assessor


def _default_store() -> TicketStore:
    """pytest 进程不打开会话库。服务进程才挂到 sessions.db。"""
    if os.environ.get("PYTEST_CURRENT_TEST"):
        return MemoryTicketStore()
    return SqliteTicketStore(session_db_path())


def get_ledger() -> Ledger:
    global _ledger
    if _ledger is None:
        _ledger = Ledger(_default_store())
    return _ledger


def reset_for_test(store: TicketStore | None = None) -> None:
    global _ledger, _assessor
    if _ledger is not None:
        _ledger.close()
    _ledger = Ledger(store if store is not None else MemoryTicketStore())
    _assessor = default_assessor


def set_assessor_for_test(fn: Assessor) -> None:
    global _assessor
    _assessor = fn


def evaluate_host_view(raw: Mapping[str, object]) -> dict[str, object]:
    """图节点入口。研判抛错记为未完成,不派工。"""
    view = parse_host_view(raw)
    if view is None:
        outcome = Outcome(
            kind="ignore",
            reason="host_view_rejected",
            runs_worker=False,
            would_accept=False,
            speak="",
            strength=None,
            ticket_id=None,
            scope="",
            mandate=None,
        )
        return _public(outcome)
    return _public(_decide(view, get_ledger(), _assessor))


def gate(view: HostView) -> tuple[bool, Strength | None, str]:
    """确定性第一层。不读消息正文。"""
    if view.actor_kind == "bot":
        if view.intent == "stop":
            return False, None, "bot_cannot_stop"
        if view.actor_id not in view.bot_actors:
            return False, None, "bot_not_listed"
        if not view.addressed:
            return False, None, "not_admitted"
        if view.accept_mode == "off":
            return False, None, "mode_off"
        return True, "inferred", "bot_candidate"
    on_list = view.actor_id in view.allowed_actors
    if view.intent == "stop":
        if not on_list:
            return False, None, "stop_refused"
        return True, "explicit", "person_stop"
    if on_list and view.addressed:
        return True, "explicit", "addressed_member"
    if on_list and not view.addressed:
        if view.accept_mode == "off":
            return False, None, "mode_off"
        return True, "inferred", "unaddressed_member"
    if view.follow_up_ticket_id and view.accept_mode != "off":
        return True, "inferred", "unlisted_follow_up"
    return False, None, "not_admitted"


def request_stop(ticket_id: str, *, by: str, actor_id: str, ledger: Ledger | None = None) -> str:
    """执行器不能宣布人要求停止。只有允许名单上的人能撤回授权。"""
    if by != "person":
        return "refused"
    book = ledger if ledger is not None else get_ledger()
    rec = book.get(ticket_id)
    if rec is None or not rec.open or rec.stopped_by_person:
        return "refused"
    if actor_id not in rec.allowed_actors:
        return "refused"
    rec.open = False
    rec.stopped_by_person = True
    rec.assignment = "ended"
    book.save(rec)
    return "stopped"


def propose_scope(ticket_id: str, new_scope: str, *, ledger: Ledger | None = None) -> bool:
    """更宽的范围不会改已发出的授权。"""
    book = ledger if ledger is not None else get_ledger()
    rec = book.get(ticket_id)
    if rec is None:
        return False
    return new_scope == rec.mandate.scope


def report_assignment(
    ticket_id: str,
    kind: str,
    *,
    by: str,
    ledger: Ledger | None = None,
) -> str:
    """报告必须是枚举。自由文本不能被当成「在等人」。"""
    if by != "worker" or kind not in REPORT_KINDS:
        return "refused"
    book = ledger if ledger is not None else get_ledger()
    rec = book.get(ticket_id)
    if rec is None or rec.assignment != "running":
        return "refused"
    rec.last_report = kind
    if kind in ("ready", "dropped"):
        rec.assignment = "ended"
        rec.open = False
    elif kind in ("failed", "blocked"):
        rec.assignment = "ended"
    book.save(rec)
    return "recorded"


def revalidate(
    ticket_id: str,
    *,
    accept_mode: AcceptMode,
    enabled_rule_ids: frozenset[str],
    allowed_actors: frozenset[str],
    ledger: Ledger | None = None,
) -> bool:
    """恢复前重校验。明确授权看人还在不在名单;推断授权还要自动模式和规则仍启用。"""
    book = ledger if ledger is not None else get_ledger()
    rec = book.get(ticket_id)
    if rec is None or rec.stopped_by_person:
        return False
    if rec.mandate.strength == "explicit":
        return rec.mandate.actor_id in allowed_actors
    if accept_mode != "auto" or not rec.mandate.matched_rule_ids:
        return False
    return all(rule_id in enabled_rule_ids for rule_id in rec.mandate.matched_rule_ids)


def resume(
    ticket_id: str,
    *,
    accept_mode: AcceptMode,
    enabled_rule_ids: frozenset[str],
    allowed_actors: frozenset[str],
    ledger: Ledger | None = None,
) -> str:
    book = ledger if ledger is not None else get_ledger()
    rec = book.get(ticket_id)
    if rec is None or rec.stopped_by_person:
        return "refused"
    if rec.open and rec.assignment == "running":
        return "open"
    if not revalidate(
        ticket_id,
        accept_mode=accept_mode,
        enabled_rule_ids=enabled_rule_ids,
        allowed_actors=allowed_actors,
        ledger=book,
    ):
        return "revoked"
    rec.open = True
    rec.assignment = "pending"
    book.save(rec)
    return "resumed"


def note_worker_finished(
    ticket_id: str,
    *,
    ok: bool,
    simulation: bool = False,
    ledger: Ledger | None = None,
) -> None:
    """工人收尾。simulation 只标记模拟未完成,不把步骤收成 ready。"""
    book = ledger if ledger is not None else get_ledger()
    kind = "ready" if ok else "failed"
    if report_assignment(ticket_id, kind, by="worker", ledger=book) != "recorded":
        return
    if not simulation or ok:
        return
    rec = book.get(ticket_id)
    if rec is None:
        return
    rec.simulation = True
    book.save(rec)


def _decide(view: HostView, book: Ledger, assessor: Assessor) -> Outcome:
    existing = book.find_trigger(view.trigger_id)
    if existing is not None:
        return Outcome(
            kind="accept" if existing.open else "ignore",
            reason="duplicate_trigger",
            runs_worker=False,
            would_accept=False,
            speak="",
            strength=existing.mandate.strength,
            ticket_id=existing.ticket_id,
            scope=existing.mandate.scope,
            mandate=existing.mandate,
        )
    admitted, strength, reason = gate(view)
    if not admitted or strength is None:
        return _silent("ignore", reason)
    if view.intent == "stop":
        return _stop(view, book)
    if strength == "explicit":
        return _accept(view, book, strength, ())
    try:
        assessment = assessor(view)
    except Exception:
        assessment = Assessment(matched_rule_ids=(), failed=True)
    if assessment.failed:
        return _silent("unavailable", "assessment_failed", speak=SPEAK_UNAVAILABLE)
    enabled = {rule.id for rule in view.rules if rule.enabled}
    matched = tuple(rule_id for rule_id in assessment.matched_rule_ids if rule_id in enabled)
    if view.accept_mode == "observe":
        if matched:
            return _silent("ignore", "would_accept", would_accept=True, speak=SPEAK_OBSERVE)
        return _silent("ignore", "no_rule_matched")
    if view.accept_mode == "auto" and matched:
        return _accept(view, book, "inferred", matched)
    return _silent("ignore", "no_rule_matched")


def _stop(view: HostView, book: Ledger) -> Outcome:
    ticket_id = view.follow_up_ticket_id
    if not ticket_id:
        return _silent("ignore", "stop_without_ticket")
    rec = book.get(ticket_id)
    if rec is None:
        return _silent("ignore", "stop_without_ticket")
    if rec.stopped_by_person or not rec.open:
        return _silent("ignore", "already_stopped")
    stopped = request_stop(ticket_id, by="person", actor_id=view.actor_id, ledger=book)
    if stopped != "stopped":
        return _silent("ignore", "stop_refused")
    return Outcome(
        kind="stop",
        reason="stopped",
        runs_worker=False,
        would_accept=False,
        speak=SPEAK_STOP,
        strength="explicit",
        ticket_id=ticket_id,
        scope=rec.mandate.scope,
        mandate=rec.mandate,
    )


def _accept(
    view: HostView,
    book: Ledger,
    strength: Strength,
    matched: tuple[str, ...],
) -> Outcome:
    mandate = Mandate(
        policy_version=view.policy_version,
        scope=view.source,
        strength=strength,
        matched_rule_ids=matched,
        actor_id=view.actor_id,
        source=view.source,
    )
    rec = TicketRec(
        ticket_id=f"tk_{uuid.uuid4().hex[:16]}",
        trigger_id=view.trigger_id,
        mandate=mandate,
        open=True,
        stopped_by_person=False,
        assignment="running",
        allowed_actors=view.allowed_actors,
    )
    if not book.add(rec):
        raced = book.find_trigger(view.trigger_id)
        if raced is not None:
            return Outcome(
                kind="accept" if raced.open else "ignore",
                reason="duplicate_trigger",
                runs_worker=False,
                would_accept=False,
                speak="",
                strength=raced.mandate.strength,
                ticket_id=raced.ticket_id,
                scope=raced.mandate.scope,
                mandate=raced.mandate,
            )
        return _silent("unavailable", "ledger_full", speak=SPEAK_LEDGER)
    return Outcome(
        kind="accept",
        reason="addressed_member" if strength == "explicit" else "rule_matched",
        runs_worker=True,
        would_accept=False,
        speak="",
        strength=strength,
        ticket_id=rec.ticket_id,
        scope=mandate.scope,
        mandate=mandate,
    )


def _silent(
    kind: DecisionKind,
    reason: str,
    *,
    would_accept: bool = False,
    speak: str = "",
) -> Outcome:
    return Outcome(
        kind=kind,
        reason=reason,
        runs_worker=False,
        would_accept=would_accept,
        speak=speak,
        strength=None,
        ticket_id=None,
        scope="",
        mandate=None,
    )


def _public(outcome: Outcome) -> dict[str, object]:
    now = datetime.now(UTC).isoformat()
    return {
        "kind": outcome.kind,
        "reason": outcome.reason,
        "runs_worker": outcome.runs_worker,
        "would_accept": outcome.would_accept,
        "speak": outcome.speak,
        "strength": outcome.strength,
        "ticket_id": outcome.ticket_id,
        "scope": outcome.scope,
        "frames": _frames(outcome, now=now),
    }


def _frames(outcome: Outcome, *, now: str) -> list[dict[str, object]]:
    if outcome.kind == "accept":
        status = "in_progress"
    elif outcome.kind == "stop":
        status = "completed"
    elif outcome.kind == "unavailable":
        status = "failed"
    elif outcome.would_accept:
        status = "pending"
    else:
        status = "skipped"
    frames: list[dict[str, object]] = [
        {
            "type": "plan_updated",
            "plan": [{"step": "工作准入", "status": status}],
            "explanation": outcome.reason,
            "timestamp": now,
        }
    ]
    if outcome.kind == "accept" and outcome.runs_worker and outcome.ticket_id:
        frames.append(
            {
                "type": "subagent_spawn",
                "id": outcome.ticket_id,
                "role": "worker",
                "task": outcome.scope,
                "timestamp": now,
            }
        )
    if outcome.would_accept or outcome.kind == "unavailable":
        frames.append(
            {
                "type": "question",
                "question": {
                    "kind": "would_accept" if outcome.would_accept else "attention",
                    "reason": outcome.reason,
                },
            }
        )
    return frames


def _text(value: object) -> str | None:
    if isinstance(value, str) and value.strip():
        return value
    return None


def _ids(value: object) -> frozenset[str] | None:
    if not isinstance(value, list):
        return None
    found: list[str] = []
    for item in value:
        if not isinstance(item, str) or not item:
            return None
        found.append(item)
    return frozenset(found)


def _rules(value: object) -> tuple[Rule, ...] | None:
    if not isinstance(value, list):
        return None
    found: list[Rule] = []
    for item in value:
        if not isinstance(item, dict) or set(item) - _RULE_KEYS:
            return None
        rule_id = item.get("id")
        enabled = item.get("enabled")
        if not isinstance(rule_id, str) or not rule_id or not isinstance(enabled, bool):
            return None
        found.append(Rule(rule_id, enabled))
    return tuple(found)


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
