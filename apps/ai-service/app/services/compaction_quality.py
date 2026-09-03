# (c) 2026 IHUI AI - owner: 李春川 (Li Chunchuan) - https://aizhs.top
# Provenance-watermarked. Licensed under Apache-2.0 (attribute statement required).

"""Context-compaction quality evaluator: makes "how good was the lossy compaction"
measurable, self-verifiable and grey-releaseable.

Why this exists: the current compaction pipeline (`context_compaction.py` /
`compact_with_llm.py`) drops the middle of the conversation and returns a summary,
but nothing answers "did we actually keep what mattered?". Competitors either treat
compaction as a black box or blindly drop. This module provides an offline,
deterministic guard that can warn *before* a compaction is committed and recommend
falling back to a lower-loss mode when quality is persistently poor.

Scope / design principles
-------------------------
- Deterministic + offline by default. No model call, no DB, no network. Method (a)
  below always works. An optional `embed_fn` can be injected to enable semantic
  matching (method b), otherwise we fall back to (a) with no failure path.
- Injectable so it can be wired independently. It does NOT touch
  `agent_loop_v2.py`; callers may call these functions directly or via a gate.
- Facts are small atomic units extracted from the original messages: file paths,
  URLs, numbers/dates, entity acronyms, and instruction intents. Each is matched
  against the compressed output to decide retained vs dropped.

Public API
----------
- `evaluate_retention(original, compressed)` -> QualityReport
- `evaluate_outcome(original, compressed)`  -> QualityReport (read-only convenience)
- `apply_report_policy(report, *, auto_degrade=True)` -> dict
- `CompactionQualityGate` (EMA + consecutive-low threshold -> recommends fallback)
"""

from __future__ import annotations

import logging
import re
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from ..core.context_compaction import (
    estimate_messages_tokens,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tunables (documented defaults; all injectable per call / per gate instance)
# ---------------------------------------------------------------------------

# retention_ratio below this triggers auto-degrade when the compaction is pending.
DEFAULT_RETENTION_THRESHOLD = 0.5

# trailing punctuation stripped from extracted reference keys so "page. -> page"
_REF_TRAIL_PUNCT = ".,;:!?)\"]'"

# regexes used to extract atomic key facts from message text
# matches absolute (/x/y), windows-drive (C:x/y) and relative (x/y) paths
_FILE_PATH_RE = re.compile(
    r"(?<![A-Za-z0-9_/\\])(?:[A-Za-z]:[\\/]|[\\/]|[A-Za-z0-9_.-]+[\\/])"
    r"[A-Za-z0-9_./\\~-]{2,60}"
)
_URL_RE = re.compile(r"https?://[^\s\"']+")


def _strip_trailing(tok: str) -> str:
    return tok.rstrip(_REF_TRAIL_PUNCT)
_NUMBER_RE = re.compile(r"\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b|\b\d{1,18}\b")
_DATE_RE = re.compile(
    r"\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b|\b\d{1,2}:\d{2}\b"
    r"|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b"
)
# uppercase acronyms / camel-ish identifiers treated as named entities
_ENTITY_RE = re.compile(r"\b[A-Z][A-Z0-9]{2,}(?:[_-][A-Z0-9]+)*\b")

# instruction intent patterns: verb -> object. Object must survive compaction for
# the intent fact to count as retained. (English-oriented; conservative on purpose,
# so false positives are rare and the tests stay deterministic.)
_INTENT_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "change",
        re.compile(r"\b(?:change|modify|edit|rename|set|update)\s+([A-Za-z0-9_./\\:]{2,40})"),
    ),
    ("delete", re.compile(r"\b(?:delete|remove|drop)\s+([A-Za-z0-9_./\\:]{2,40})")),
    ("create", re.compile(r"\b(?:create|add|make)\s+([A-Za-z0-9_./\\:]{2,40})")),
    ("call", re.compile(r"\b(?:call|invoke|run|execute)\s+([A-Za-z0-9_./\\:]{2,40})")),
    (
        "constraint",
        re.compile(r"\b(?:ensure|make sure|verify|check|must not|never)\s+([\w./\\:]{2,40})"),
    ),
]

# low-value tokens: greetings / hedges / acknowledgements. Dropping these is the
# *expected*, reasonable behaviour of a compaction -- never flagged as a high-value loss.
_LOW_VALUE_TOKENS: tuple[str, ...] = (
    "hello",
    "hi",
    "thanks",
    "thank you",
    "sure",
    "ok",
    "okay",
    "got it",
    "understood",
    "bye",
    "great",
    "yes",
    "no problem",
    "please",
)

# fact kinds that count as "hard keys"; intent is a soft fact and is skipped in
# keys_only mode.
_HARD_KINDS: frozenset[str] = frozenset({"path", "url", "number", "date", "entity"})


@dataclass(frozen=True)
class Fact:
    """A single atomic key fact extracted from the original messages."""

    key: str  # canonical matching text
    kind: str  # path | url | number | date | entity | intent
    display: str  # human-readable form for reports
    low_value: bool = False  # greeting/hedge - dropping is expected


@dataclass
class QualityReport:
    """Result of a retention evaluation for one compaction attempt."""

    facts_retained: int = 0
    facts_total: int = 0
    retention_ratio: float = 0.0
    original_chars: int = 0
    compressed_chars: int = 0
    chars_saved_ratio: float = 0.0
    original_tokens: int = 0
    compressed_tokens: int = 0
    tokens_saved_ratio: float = 0.0
    retained_facts: list[str] = field(default_factory=list)
    dropped_high_value: list[dict[str, str]] = field(default_factory=list)
    dropped_low_value: list[str] = field(default_factory=list)
    method: str = "heuristic"
    keys_only: bool = False

    def as_dict(self) -> dict[str, Any]:
        return {
            "facts_retained": self.facts_retained,
            "facts_total": self.facts_total,
            "retention_ratio": round(self.retention_ratio, 4),
            "original_chars": self.original_chars,
            "compressed_chars": self.compressed_chars,
            "chars_saved_ratio": round(self.chars_saved_ratio, 4),
            "original_tokens": self.original_tokens,
            "compressed_tokens": self.compressed_tokens,
            "tokens_saved_ratio": round(self.tokens_saved_ratio, 4),
            "dropped_high_value": self.dropped_high_value,
            "dropped_low_value": self.dropped_low_value,
            "method": self.method,
            "keys_only": self.keys_only,
        }


# ---------------------------------------------------------------------------
# text helpers
# ---------------------------------------------------------------------------


def _messages_text(messages: list[dict[str, Any]]) -> str:
    """Join the string content of all messages into one blob for fact matching."""
    parts: list[str] = []
    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, str):
            parts.append(content)
        elif isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and isinstance(part.get("text"), str):
                    parts.append(part["text"])
        tc = msg.get("tool_calls")
        if isinstance(tc, list):
            for call in tc:
                if isinstance(call, dict):
                    fn = call.get("function")
                    if isinstance(fn, dict) and isinstance(fn.get("name"), str):
                        parts.append(fn["name"])
    return "\n".join(parts)


def _chars(text: str) -> int:
    return len(text)


def _drop_reason(fact: Fact) -> str:
    reason = "high_value_dropped"
    if fact.kind == "intent":
        reason = "intent_object_dropped"
    elif fact.kind in ("path", "url"):
        reason = "reference_dropped"
    elif fact.kind in ("number", "date"):
        reason = "metric_dropped"
    elif fact.kind == "entity":
        reason = "entity_dropped"
    return reason


# ---------------------------------------------------------------------------
# fact extraction
# ---------------------------------------------------------------------------


def _extract_facts(text: str, *, keys_only: bool) -> tuple[list[Fact], list[Fact]]:
    """Extract atomic facts from a blob.

    Returns (high_value_facts, low_value_facts). Low-value items are greetings /
    hedges whose loss is expected and not counted against retention.
    """
    high: list[Fact] = []
    low: list[Fact] = []
    seen: set[str] = set()
    low_seen: set[str] = set()

    def add(fact: Fact) -> None:
        canon = fact.key.strip().lower()
        if not canon:
            return
        if fact.low_value:
            if canon in low_seen:
                return
            low_seen.add(canon)
            low.append(fact)
        else:
            if canon in seen:
                return
            seen.add(canon)
            high.append(fact)

    if not keys_only:
        for pat in _INTENT_PATTERNS:
            for m in pat[1].finditer(text):
                obj = m.group(1)
                if obj:
                    add(
                        Fact(
                            key=obj,
                            kind="intent",
                            display=f"{pat[0]} -> {obj}",
                        )
                    )

    for m in _URL_RE.finditer(text):
        tok = _strip_trailing(m.group(0))
        add(Fact(key=tok, kind="url", display=tok))
    # paths (skip those already claimed by urls)
    for m in _FILE_PATH_RE.finditer(text):
        tok = _strip_trailing(m.group(0))
        if "://" not in tok:
            add(Fact(key=tok, kind="path", display=tok))
    for m in _DATE_RE.finditer(text):
        add(Fact(key=m.group(0), kind="date", display=m.group(0)))
    for m in _NUMBER_RE.finditer(text):
        add(Fact(key=m.group(0), kind="number", display=m.group(0)))
    for m in _ENTITY_RE.finditer(text):
        add(Fact(key=m.group(0), kind="entity", display=m.group(0)))

    # low-value greetings/hedges present in the original blob
    lower = text.lower()
    for tok in _LOW_VALUE_TOKENS:
        if tok in lower:
            add(Fact(key=tok, kind="greeting", display=tok, low_value=True))
    return high, low


def _fact_retained(fact: Fact, compressed: str) -> bool:
    """Deterministic member-check of a fact against the compressed text."""
    if fact.kind in ("path", "url", "number", "date", "intent"):
        return fact.key in compressed
    if fact.kind == "entity":
        return bool(re.search(rf"\b{re.escape(fact.key)}\b", compressed))
    return fact.key.lower() in compressed.lower()


# ---------------------------------------------------------------------------
# embedding mode (optional) - semantic overlap between facts and compressed
# ---------------------------------------------------------------------------

_EmbedFn = Callable[[str], list[float]]


def _fallback_embed(_: str) -> list[float]:
    return [0.0]


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    na = sum(x * x for x in a) ** 0.5 or 1.0
    nb = sum(x * x for x in b) ** 0.5 or 1.0
    return dot / (na * nb)


def _fact_retained_semantic(
    fact: Fact,
    compressed: str,
    embed_fn: _EmbedFn,
    threshold: float,
) -> bool:
    """Semantic membership: cosine(fact, compressed chunk) >= threshold."""
    # cheap exact check first
    if _fact_retained(fact, compressed):
        return True
    fv = embed_fn(fact.key)
    if not fv or all(v == 0.0 for v in fv):
        return False
    windows: list[str] = [compressed]
    # build a few sliding windows so short-blob semantic overlap still works
    words = compressed.split()
    if len(words) > 6:
        step = max(1, len(words) // 4)
        for i in range(0, len(words), step):
            windows.append(" ".join(words[i : i + 6]))
    for w in windows:
        if not w.strip():
            continue
        wv = embed_fn(w)
        if wv and _cosine(fv, wv) >= threshold:
            return True
    return False


# ---------------------------------------------------------------------------
# evaluators
# ---------------------------------------------------------------------------


def evaluate_outcome(
    original_messages: list[dict[str, Any]],
    compressed_messages: list[dict[str, Any]],
    *,
    keys_only: bool = False,
    embed_fn: _EmbedFn | None = None,
    semantic_threshold: float = 0.75,
) -> QualityReport:
    """Read-only convenience alias of `evaluate_retention`.

    Same behaviour, kept separate so callers can choose the name most expressive
    at the call site (e.g. an evaluation-only endpoint that never persists).
    """
    return evaluate_retention(
        original_messages,
        compressed_messages,
        keys_only=keys_only,
        embed_fn=embed_fn,
        semantic_threshold=semantic_threshold,
    )


def evaluate_retention(
    original_messages: list[dict[str, Any]],
    compressed_messages: list[dict[str, Any]],
    *,
    keys_only: bool = False,
    embed_fn: _EmbedFn | None = None,
    semantic_threshold: float = 0.75,
) -> QualityReport:
    """Evaluate how many key facts survive a compaction.

    Args:
        original_messages: pre-compaction OpenAI-style messages (may be modified or
            mutated by the compaction; we only read string content).
        compressed_messages: post-compaction messages.
        keys_only: if True, only count hard keys (path/url/number/date/entity);
            instruction intents (soft facts) are excluded.
        embed_fn: optional sync text->vector embedder for semantic matching. When
            None (default) a fully deterministic substring/word-boundary heuristic is
            used and the report `method` is "heuristic". When provided and no exact
            match is found, cosine overlap >= semantic_threshold marks the fact
            retained and `method` is "embedding".
        semantic_threshold: cosine lower bound for embedding mode.

    Returns:
        QualityReport with facts_retained/facts_total/retention_ratio and the
        dropped classification (high-value mis-drops vs low-value reasonable drops).
    """
    original_blob = _messages_text(original_messages)
    compressed_blob = _messages_text(compressed_messages)

    high, low = _extract_facts(original_blob, keys_only=keys_only)

    method = "heuristic"
    retained_fn: Callable[[Fact], bool]
    if embed_fn is not None:
        method = "embedding"
        retained_fn = lambda f: _fact_retained_semantic(  # noqa: E731
            f, compressed_blob, embed_fn, semantic_threshold
        )
    else:
        retained_fn = lambda f: _fact_retained(f, compressed_blob)  # noqa: E731

    retained: list[str] = []
    dropped_high: list[dict[str, str]] = []
    for fact in high:
        if retained_fn(fact):
            retained.append(fact.display)
        else:
            dropped_high.append(
                {"fact": fact.display, "kind": fact.kind, "reason": _drop_reason(fact)}
            )

    dropped_low = [f.display for f in low if not _fact_retained(f, compressed_blob)]

    facts_total = len(high)
    facts_retained = len(retained)
    retention_ratio = facts_retained / facts_total if facts_total else 1.0

    original_tokens = estimate_messages_tokens(original_messages)
    compressed_tokens = estimate_messages_tokens(compressed_messages)

    return QualityReport(
        facts_retained=facts_retained,
        facts_total=facts_total,
        retention_ratio=retention_ratio,
        original_chars=_chars(original_blob),
        compressed_chars=_chars(compressed_blob),
        chars_saved_ratio=(
            1.0 - _chars(compressed_blob) / _chars(original_blob)
            if _chars(original_blob)
            else 0.0
        ),
        original_tokens=original_tokens,
        compressed_tokens=compressed_tokens,
        tokens_saved_ratio=(
            1.0 - compressed_tokens / original_tokens if original_tokens else 0.0
        ),
        retained_facts=retained,
        dropped_high_value=dropped_high,
        dropped_low_value=dropped_low,
        method=method,
        keys_only=keys_only,
    )


# ---------------------------------------------------------------------------
# pre-commit gate / policy
# ---------------------------------------------------------------------------


def apply_report_policy(
    report: QualityReport,
    *,
    auto_degrade: bool = True,
    threshold: float = DEFAULT_RETENTION_THRESHOLD,
) -> dict[str, Any]:
    """Decide whether a pending compaction should be adopted or degraded.

    If retention_ratio < threshold and auto_degrade is True, the compaction should
    NOT be committed blindly: recommend falling back to a lower-loss strategy so the
    caller can keep "summary + original reference" instead of a total middle-drop.

    Returns a dict:
        {"degrade": bool, "retention_ratio": float, "suggestion": str}
    """
    ratio = report.retention_ratio
    degraded = auto_degrade and ratio < threshold
    if degraded:
        suggestion = (
            "Retention below threshold; fall back to a lower-loss strategy "
            "instead of committing this compaction (keep the semantic summary plus "
            "the original reference, or truncate-tail without dropping the head)."
        )
    else:
        suggestion = "Retention acceptable; the compaction may be committed."
    return {
        "degrade": degraded,
        "retention_ratio": round(ratio, 4),
        "suggestion": suggestion,
    }


class CompactionQualityGate:
    """Cumulative guard that recommends fallback after persistent low retention.

    Record per-compaction outcomes with `record(...)`; the gate keeps an EMA of the
    retention ratios plus a counter of how many consecutive outcomes sit below the
    threshold. `needs_fallback(...)` combines that history with a live candidate so
    the caller can proactively switch to low-loss mode before committing a bad run.
    In-memory only: no persistence, deterministic given the same recorded sequence.
    """

    def __init__(
        self,
        *,
        ema_alpha: float = 0.5,
        low_threshold: float = DEFAULT_RETENTION_THRESHOLD,
        min_low: int = 2,
        history_capacity: int = 20,
    ) -> None:
        if not 0.0 < ema_alpha <= 1.0:
            raise ValueError("ema_alpha must be in (0, 1]")
        if low_threshold < 0.0 or low_threshold > 1.0:
            raise ValueError("low_threshold must be in [0, 1]")
        if min_low < 1:
            raise ValueError("min_low must be >= 1")
        self.ema_alpha = ema_alpha
        self.low_threshold = low_threshold
        self.min_low = min_low
        self._history: deque[float] = deque(maxlen=history_capacity)
        self.ema: float | None = None
        self.consecutive_low = 0
        self._recorded = 0

    def record(self, outcome: QualityReport | float) -> CompactionQualityGate:
        """Accumulate a compaction outcome (quality report or raw ratio)."""
        ratio = (
            outcome.retention_ratio
            if isinstance(outcome, QualityReport)
            else float(outcome)
        )
        self._history.append(ratio)
        if self.ema is None:
            self.ema = ratio
        else:
            self.ema = self.ema_alpha * ratio + (1.0 - self.ema_alpha) * self.ema
        self._recorded += 1
        # consecutive-low is based on the *sustained* EMA, which naturally resets
        # once retention recovers for long enough.
        if self.ema is not None and self.ema < self.low_threshold:
            self.consecutive_low += 1
        else:
            self.consecutive_low = 0
        return self

    def history(self) -> list[float]:
        return list(self._history)

    def needs_fallback(
        self,
        candidate: float | None = None,
        history_ratio: float | None = None,
    ) -> bool:
        """Return True if a fallback to low-loss mode is recommended.

        Combines the persisted EMA + consecutive-low streak with an optional live
        `candidate` retention ratio and an optional externally-supplied `history_ratio`
        (overrides the recorded EMA if given).
        """
        ema_val: float | None = (
            history_ratio if history_ratio is not None else self.ema
        )
        # sustained EMA below the threshold, sustained for at least min_low outcomes
        stored_low = (
            ema_val is not None
            and ema_val < self.low_threshold
            and self.consecutive_low >= self.min_low
        )
        # a live candidate below threshold is only alarming once we already have
        # enough recorded history; a single anomalous datapoint must not fire.
        live_low = (
            candidate is not None
            and candidate < self.low_threshold
            and self._recorded >= self.min_low
        )
        return stored_low or live_low


__all__ = [
    "DEFAULT_RETENTION_THRESHOLD",
    "CompactionQualityGate",
    "Fact",
    "QualityReport",
    "apply_report_policy",
    "evaluate_outcome",
    "evaluate_retention",
]
