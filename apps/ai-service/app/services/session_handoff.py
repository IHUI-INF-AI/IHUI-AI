# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌​​‌‌​​‍​​‌‍​​‌‍​​​‌‍​​‌‍​‌​‍​​‌‍​​​‌‍​​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Cross-session handoff (session relay) service.

Purpose: turn "team conclusion / long-term memory / cost ledger" into a single
HandoffPacket that the next session can inject and "keep working", forming a
long-termism loop instead of starting from zero each session.

This is a pure service layer. It does NOT register routers and does NOT wire into
agent_loop_v2 (zero coupling, zero regression by default). It only REUSES the
existing services as injectable dependencies:

    - agent_longterm_memory.extract_candidates_from_session / recall_for_context
    - agent_teams.TeamOrchestrator ".summary_context"
    - cost_ledger.CostLedger.aggregate / top_tools
    - agent_step_recorder.AgentStepRecorder.get_run_metrics
    - plan_mode: pending plan tasks come from the caller (or a teams provider)

Public API:
    - SessionHandoff.build_handoff(...) -> HandoffPacket
          Aggregate pending tasks / learnings / context residue / recommendations
          into one relay packet for the next session.
    - SessionHandoff.apply_handoff(handoff, *, memory_service) -> dict
          Import learnings into long-term memory, surface pending tasks as new
          todos, and assemble context_blocks into an injectable context block.
    - SessionHandoff.recommend_with_cost(handoff, ledger) -> list
          Attach cost / budget tradeoffs onto recommendations for decision-making.

All processing is deterministic (no LLM, no network). Empty inputs and missing
services degrade gracefully without raising.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from .agent_longterm_memory import extract_candidates_from_session

# Allowed context-block kinds
CONTEXT_KINDS = ("team", "memory", "cost", "run_metrics")
# Human-readable labels for each context block kind (asserted by tests).
CONTEXT_KIND_LABELS = {
    "team": "team-aggregation",
    "memory": "long-term-memory",
    "cost": "cost-and-execution",
    "run_metrics": "run-metrics",
}

_PRIORITY_RANK = {"high": 0, "medium": 1, "low": 2}

_UNDONE_STATUSES = ("pending", "executing", "approved", "pending_approval")


def _now_iso() -> str:
    """Current UTC time ISO8601 (second precision)."""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


@dataclass
class HandoffRecommendation:
    """A single next-step recommendation (sorted by priority)."""

    action: str
    reason: str
    priority: str = "medium"  # high | medium | low
    cost_usd: float | None = None
    budget_hint: str | None = None
    budget_note: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "action": self.action,
            "reason": self.reason,
            "priority": self.priority,
        }
        if self.cost_usd is not None:
            d["cost_usd"] = float(self.cost_usd)
        if self.budget_hint is not None:
            d["budget_hint"] = self.budget_hint
        if self.budget_note is not None:
            d["budget_note"] = self.budget_note
        return d


@dataclass
class HandoffPacket:
    """Relay packet handed from one session to the next.

    Fields:
        packet_id:      unique id (uuid hex)
        created_at:     creation timestamp (UTC ISO8601)
        session_id:     source session id
        user_id:        owning user (for memory import isolation)
        pending_tasks:  list of unfinished / pending plan tasks to resume
        learnings:      candidates extracted this round (feed bulk_import)
        context_blocks: [{kind, text}, ...] summary blocks to carry forward
        recommendations: [{action, reason, priority}, ...] next-step suggestions
    """

    packet_id: str
    created_at: str
    session_id: str
    user_id: str = ""
    pending_tasks: list[dict[str, Any]] = field(default_factory=list)
    learnings: list[dict[str, Any]] = field(default_factory=list)
    context_blocks: list[dict[str, Any]] = field(default_factory=list)
    recommendations: list[HandoffRecommendation] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a JSON-safe dict."""
        return {
            "packet_id": self.packet_id,
            "created_at": self.created_at,
            "session_id": self.session_id,
            "user_id": self.user_id,
            "pending_tasks": [dict(t) for t in self.pending_tasks],
            "learnings": [dict(l) for l in self.learnings],
            "context_blocks": [dict(b) for b in self.context_blocks],
            "recommendations": [r.to_dict() for r in self.recommendations],
        }


class SessionHandoff:
    """Build / apply / cost-aware refinements of cross-session handoff packets."""

    # ------------------------------------------------------------------ build

    def build_handoff(
        self,
        session_ctx: dict[str, Any],
        *,
        memory_service: Any = None,
        teams: Any = None,
        ledger: Any = None,
        recorder: Any = None,
        pending: list[dict[str, Any]] | None = None,
    ) -> HandoffPacket:
        """Aggregate four input families into one HandoffPacket.

        Args:
            session_ctx: dict with optional keys
                session_id / user_id / messages / learnings / query / objective /
                recall_top_k / run_id / extract_learnings.
            memory_service: long-term memory provider exposing
                recall_for_context(user_id, query, top_k=...). Used for learnings
                extraction (same module) and context residue recall.
            teams:          optional team provider exposing summary_context /
                            final_summary_context / get_pending() / .pending.
            ledger:         optional CostLedger (aggregate / top_tools for context
                            residue and cost summary).
            recorder:       optional AgentStepRecorder (get_run_metrics for run
                            metrics context residue).
            pending:        caller-supplied pending tasks (deduped against teams).

        Returns:
            A fully populated HandoffPacket (deterministic aside from ids/clock).
        """
        session_id = str(session_ctx.get("session_id") or "")
        user_id = str(session_ctx.get("user_id") or "")
        packet_id = uuid.uuid4().hex
        created_at = _now_iso()

        learnings = self._collect_learnings(session_ctx)
        pending_tasks = self._dedup_pending(
            self._collect_pending(pending, teams)
        )
        context_blocks = self._collect_context_blocks(
            session_ctx, memory_service=memory_service, teams=teams,
            ledger=ledger, recorder=recorder,
        )
        recommendations = self._collect_recommendations(
            pending_tasks, teams, context_blocks
        )
        recommendations = self._order_recommendations(recommendations)

        return HandoffPacket(
            packet_id=packet_id,
            created_at=created_at,
            session_id=session_id,
            user_id=user_id,
            pending_tasks=pending_tasks,
            learnings=learnings,
            context_blocks=context_blocks,
            recommendations=recommendations,
        )

    # ------------------------------------------------------------ apply

    def apply_handoff(
        self,
        handoff: HandoffPacket,
        *,
        memory_service: Any = None,
    ) -> dict[str, Any]:
        """Apply a relay packet for the next session.

        - Import learnings into long-term memory (via bulk_import_from_extract).
        - Surface pending_tasks as new todos (deduped, ready to append).
        - Optionally assemble context_blocks into an injectable context block.

        Returns:
            {"imported": {...}, "appended": [task, ...], "injected_context": str}
        """
        imported = {"added": 0, "merged": 0, "skipped": 0, "total": 0}
        if memory_service is not None and handoff.learnings:
            imported = memory_service.bulk_import_from_extract(
                handoff.learnings,
                user_id=handoff.user_id,
                session_id=handoff.session_id,
            )
        appended = self._dedup_pending(handoff.pending_tasks)
        injected_context = self._build_injected_context(handoff.context_blocks)
        return {
            "imported": imported,
            "appended": appended,
            "injected_context": injected_context,
        }

    def recommend_with_cost(
        self,
        handoff: HandoffPacket,
        ledger: Any = None,
    ) -> list[dict[str, Any]]:
        """Attach cost / budget tradeoffs onto recommendations.

        Uses ledger.aggregate for the session cost and ledger.top_tools to detect
        expensive tools; recommendations mentioning an expensive tool get
        budget_hint="high_cost", else a medium/low hint is derived from the total
        session cost. Returns a new recommendation list (deterministic ordering by
        priority), leaving the handoff packet unchanged.
        """
        total_cost = 0.0
        expensive: set[str] = set()
        if ledger is not None:
            try:
                agg = ledger.aggregate(
                    {
                        "session_id": handoff.session_id,
                        "user_id": handoff.user_id,
                    }
                )
                total_cost = float(agg.get("total_cost") or 0.0)
                threshold = max(0.05, total_cost * 0.3) if total_cost > 0 else 0.0
                for t in ledger.top_tools(20):
                    if float(t.get("cost") or 0.0) >= threshold:
                        expensive.add(str(t.get("tool_name") or "").lower())
            except Exception:
                total_cost = 0.0
                expensive = set()

        out: list[dict[str, Any]] = []
        for r in handoff.recommendations:
            d = r.to_dict() if hasattr(r, "to_dict") else dict(r)
            action = str(d.get("action") or "").lower()
            high = any(token in action for token in expensive)
            if high:
                hint = "high_cost"
                note = "Direction involves a high-cost tool this session; limit frequency or break into smaller steps."
            elif total_cost >= 0.05:
                hint = "medium"
                note = "Session cost is non-trivial; consider setting a budget cap."
            else:
                hint = "low_cost"
                note = "Session cost is under control; safe to continue."
            d["cost_usd"] = round(total_cost, 6)
            d["budget_hint"] = hint
            d["budget_note"] = note
            out.append(d)
        out.sort(
            key=lambda x: _PRIORITY_RANK.get(str(x.get("priority", "medium")), 1)
        )
        return out

    # ------------------------------------------------------------ internals

    def _collect_learnings(
        self, session_ctx: dict[str, Any]
    ) -> list[dict[str, Any]]:
        """Learnings: explicit list first, else deterministic extraction."""
        explicit = session_ctx.get("learnings")
        if explicit:
            returned: list[dict[str, Any]] = []
            for item in explicit:
                if isinstance(item, dict):
                    returned.append(dict(item))
            return returned
        messages = session_ctx.get("messages")
        if messages and session_ctx.get("extract_learnings", True):
            return extract_candidates_from_session(
                messages,
                session_id=str(session_ctx.get("session_id") or ""),
                user_id=str(session_ctx.get("user_id") or ""),
            )
        return []

    def _collect_pending(
        self,
        pending: list[dict[str, Any]] | None,
        teams: Any,
    ) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = [dict(t) for t in (pending or [])]
        out.extend(self._pending_from_teams(teams))
        return out

    def _pending_from_teams(self, teams: Any) -> list[dict[str, Any]]:
        if teams is None:
            return []
        if isinstance(teams, list):
            return [dict(t) for t in teams if isinstance(t, dict)]
        direct = getattr(teams, "pending", None)
        if isinstance(direct, list):
            return [dict(t) for t in direct if isinstance(t, dict)]
        getter = getattr(teams, "get_pending", None)
        if callable(getter):
            try:
                val = getter()
                if isinstance(val, list):
                    return [dict(t) for t in val if isinstance(t, dict)]
            except Exception:
                pass
        summary = self._team_summary(teams)
        derived: list[dict[str, Any]] = []
        if "conflict" in summary.lower():
            derived.append(
                {
                    "title": "Resolve team conclusion conflict to finalize",
                    "status": "pending",
                    "source": "team_conflict",
                }
            )
        return derived

    def _collect_context_blocks(
        self,
        session_ctx: dict[str, Any],
        *,
        memory_service: Any,
        teams: Any,
        ledger: Any,
        recorder: Any,
    ) -> list[dict[str, Any]]:
        blocks: list[dict[str, Any]] = []
        team_text = self._team_summary(teams)
        if team_text:
            blocks.append({"kind": "team", "text": team_text})
        if memory_service is not None:
            query = str(
                session_ctx.get("query") or session_ctx.get("objective") or ""
            )
            top_k = int(session_ctx.get("recall_top_k", 5))
            uid = str(session_ctx.get("user_id") or "")
            if uid:
                try:
                    mem_text = memory_service.recall_for_context(
                        uid, query, top_k=top_k
                    )
                    if mem_text:
                        blocks.append({"kind": "memory", "text": str(mem_text)})
                except Exception:
                    pass
        cost_text = self._cost_summary(session_ctx, ledger, recorder)
        if cost_text:
            blocks.append({"kind": "cost", "text": cost_text})
        return blocks

    def _team_summary(self, teams: Any) -> str:
        """Extract the team's aggregate summary context (residue for next session)."""
        if teams is None:
            return ""
        if isinstance(teams, str):
            return teams.strip()
        for attr in ("final_summary_context", "summary_context", "last_summary_context"):
            v = getattr(teams, attr, None)
            if v:
                return str(v).strip()
        rounds = getattr(teams, "rounds", None) or getattr(teams, "round_history", None)
        if isinstance(rounds, list) and rounds:
            last = rounds[-1]
            if isinstance(last, dict):
                return str(last.get("summary_context") or "").strip()
            sc = getattr(last, "summary_context", "")
            if sc:
                return str(sc).strip()
        return ""

    def _cost_summary(
        self, session_ctx: dict[str, Any], ledger: Any, recorder: Any
    ) -> str:
        """Compose run-metrics + ledger cost summary from recorder/ledger."""
        parts: list[str] = []
        run_id = str(session_ctx.get("run_id") or "")
        if recorder is not None and run_id:
            try:
                m = recorder.get_run_metrics(run_id)
                if m and int(m.get("step_count") or 0) > 0:
                    parts.append(
                        f"run {str(m.get('run_id') or run_id)}: "
                        f"{int(m.get('step_count') or 0)} steps "
                        f"({int(m.get('ok_count') or 0)} ok/"
                        f"{int(m.get('error_count') or 0)} err), "
                        f"{int(m.get('total_tokens') or 0)} tokens, "
                        f"{float(m.get('total_duration_ms') or 0.0):.0f}ms, "
                        f"${float(m.get('total_cost') or 0.0):.6f}"
                    )
            except Exception:
                pass
        if ledger is not None:
            try:
                agg = ledger.aggregate(self._ledger_filter(session_ctx))
                if int(agg.get("count") or 0) > 0:
                    parts.append(
                        f"ledger: {int(agg.get('count') or 0)} steps, "
                        f"{int(agg.get('total_tokens') or 0)} tokens, "
                        f"${float(agg.get('total_cost') or 0.0):.6f}"
                    )
            except Exception:
                pass
        return "\n".join(parts)

    @staticmethod
    def _ledger_filter(session_ctx: dict[str, Any]) -> dict[str, Any]:
        f: dict[str, Any] = {}
        if session_ctx.get("session_id"):
            f["session_id"] = str(session_ctx["session_id"])
        if session_ctx.get("user_id"):
            f["user_id"] = str(session_ctx["user_id"])
        return f

    def _collect_recommendations(
        self,
        pending_tasks: list[dict[str, Any]],
        teams: Any,
        context_blocks: list[dict[str, Any]],
    ) -> list[HandoffRecommendation]:
        recs: list[HandoffRecommendation] = []
        for t in pending_tasks:
            title = str(
                t.get("title") or t.get("action") or t.get("task_id") or "Unfinished task"
            )
            status = str(t.get("status") or "")
            if status == "done":
                recs.append(
                    HandoffRecommendation(
                        action=f"Close out: {title}",
                        reason="Last-round task already finished; verify and close it.",
                        priority="low",
                    )
                )
            else:
                reason = (
                    "Last-round plan task never finished (pending/executing/approval); resume it."
                    if status in _UNDONE_STATUSES
                    else "Last-round pending task; carry it forward."
                )
                recs.append(
                    HandoffRecommendation(
                        action=f"Complete: {title}",
                        reason=reason,
                        priority="high",
                    )
                )
        conflicts = self._team_conflicts(teams)
        if conflicts:
            recs.append(
                HandoffRecommendation(
                    action="Adjudicate team conclusion conflict to converge",
                    reason=conflicts,
                    priority="high",
                )
            )
        elif self._has_block(context_blocks, "team"):
            recs.append(
                HandoffRecommendation(
                    action="Review team aggregation and advance based on it",
                    reason="A team round was aggregated last session; main agent should converge next steps.",
                    priority="medium",
                )
            )
        if self._has_block(context_blocks, "memory"):
            recs.append(
                HandoffRecommendation(
                    action="Honor long-term lessons and preferences carried over",
                    reason="Long-term memory carries prior lessons; prefer following them.",
                    priority="medium",
                )
            )
        return recs

    def _team_conflicts(self, teams: Any) -> str:
        if teams is None:
            return ""
        summary = self._team_summary(teams)
        low = summary.lower()
        if "conflict" in low or "no consensus" in low:
            return "Last-round team had conclusion conflict / no consensus."
        return ""

    @staticmethod
    def _has_block(blocks: list[dict[str, Any]], kind: str) -> bool:
        return any(b.get("kind") == kind for b in blocks if isinstance(b, dict))

    @staticmethod
    def _order_recommendations(
        recs: list[HandoffRecommendation],
    ) -> list[HandoffRecommendation]:
        return sorted(
            recs, key=lambda r: _PRIORITY_RANK.get(r.priority, _PRIORITY_RANK["medium"])
        )

    @staticmethod
    def _dedup_pending(
        items: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Deduplicate tasks by title/action, preserving first-seen order."""
        seen: set[str] = set()
        out: list[dict[str, Any]] = []
        for t in items:
            if not isinstance(t, dict):
                continue
            key = (
                str(t.get("title") or t.get("task_id") or t.get("action") or "")
                .strip()
            )
            if not key:
                continue
            if key in seen:
                continue
            seen.add(key)
            out.append(dict(t))
        return out

    @staticmethod
    def _build_injected_context(
        context_blocks: list[dict[str, Any]],
    ) -> str:
        """Assemble context_blocks into a build_memory_context_block-style block."""
        if not context_blocks:
            return ""
        lines = ["## Session handoff (carried from previous session)"]
        for b in context_blocks:
            if not isinstance(b, dict):
                continue
            text = str(b.get("text") or "").strip()
            if not text:
                continue
            kind = str(b.get("kind") or "context")
            header = CONTEXT_KIND_LABELS.get(kind, kind)
            lines.append(f"### {header}")
            for raw_line in text.splitlines():
                if raw_line.strip():
                    lines.append(f"+ {raw_line}")
                else:
                    lines.append("")
        return "\n".join(lines)


# Module-level singleton (consistent with peer services).
session_handoff = SessionHandoff()


# Public convenience aliases (thin wrappers over the singleton, no state).
def build_handoff(session_ctx, **kwargs) -> HandoffPacket:
    """Convenience wrapper over SessionHandoff.build_handoff (see class docs)."""
    return session_handoff.build_handoff(session_ctx, **kwargs)


def apply_handoff(handoff, **kwargs) -> dict[str, Any]:
    """Convenience wrapper over SessionHandoff.apply_handoff (see class docs)."""
    return session_handoff.apply_handoff(handoff, **kwargs)


def recommend_with_cost(handoff, ledger=None) -> list[dict[str, Any]]:
    """Convenience wrapper over SessionHandoff.recommend_with_cost."""
    return session_handoff.recommend_with_cost(handoff, ledger)