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
"""

from __future__ import annotations

import os
import re
import uuid
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

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


class Ledger:
    """进程内工单账。不连库。"""

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
        self._tickets[rec.ticket_id] = rec
        self._by_trigger[rec.trigger_id] = rec.ticket_id
        self._order.append(rec.ticket_id)
        return True

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


_ledger = Ledger()
_assessor: Assessor = default_assessor


def get_ledger() -> Ledger:
    return _ledger


def reset_for_test() -> None:
    global _ledger, _assessor
    _ledger = Ledger()
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
    return _public(_decide(view, _ledger, _assessor))


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
    book = ledger if ledger is not None else _ledger
    rec = book.get(ticket_id)
    if rec is None or not rec.open or rec.stopped_by_person:
        return "refused"
    if actor_id not in rec.allowed_actors:
        return "refused"
    rec.open = False
    rec.stopped_by_person = True
    rec.assignment = "ended"
    return "stopped"


def propose_scope(ticket_id: str, new_scope: str, *, ledger: Ledger | None = None) -> bool:
    """更宽的范围不会改已发出的授权。"""
    book = ledger if ledger is not None else _ledger
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
    book = ledger if ledger is not None else _ledger
    rec = book.get(ticket_id)
    if rec is None or rec.assignment != "running":
        return "refused"
    rec.last_report = kind
    if kind in ("ready", "dropped"):
        rec.assignment = "ended"
        rec.open = False
    elif kind in ("failed", "blocked"):
        rec.assignment = "ended"
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
    book = ledger if ledger is not None else _ledger
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
    book = ledger if ledger is not None else _ledger
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
    return "resumed"


def note_worker_finished(ticket_id: str, *, ok: bool) -> None:
    report_assignment(ticket_id, "ready" if ok else "failed", by="worker")


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
