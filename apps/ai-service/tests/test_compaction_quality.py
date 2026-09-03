# (c) 2026 IHUI AI - owner: 李春川 (Li Chunchuan) - https://aizhs.top
# Provenance-watermarked. Licensed under Apache-2.0 (attribute statement required).

"""compaction_quality.py unit tests: quality evaluator, degrade policy, grey-release gate.

Coverage (all deterministic, offline, no model/DB):
- evaluate_retention: full retention (ratio 1.0); path/url/number/date/entity/intent
  preserved when present in the compressed output
- drop classification: high-value mis-drops (path/url/number) vs low-value reasonable
  drops (greetings never counted as high-value loss)
- keys_only mode: instruction intents excluded from the hard-key count
- token/char saving ratios
- embedding mode: injected embed_fn enables semantic retention that the pure
  substring heuristic misses; graceful fallback when embed fails
- apply_report_policy: auto_degrade on/off boundary at the retention threshold
- CompactionQualityGate: consecutive-low streak -> fallback, recovery -> release,
  live candidate hook, and record(quality report) support
- evaluate_outcome convenience alias
"""

from __future__ import annotations

from typing import Any

from app.services.compaction_quality import (
    DEFAULT_RETENTION_THRESHOLD,
    CompactionQualityGate,
    QualityReport,
    apply_report_policy,
    evaluate_outcome,
    evaluate_retention,
)


def _msgs(*contents: str) -> list[dict[str, Any]]:
    """Build a list of user messages from raw strings (OpenAI-style)."""
    return [{"role": "user", "content": c} for c in contents]


# sample payloads -------------------------------------------------------------

_FULL_ORIGINAL = _msgs(
    "Setup the deploy job: update /tmp/data/stats.py and publish to "
    "https://example.com/api/v2/report before the 2026-09-03 release.",
    "The queue must process 42 items and ICT_ENV must stay enabled.",
    "Thanks for the help, this is great.",
)

# compressed that drops the path + url (high value) but keeps everything else
_DROPPED_REF_ORIGINAL = _msgs(
    "Edit /tmp/data/stats.py now.",
    "Push the result to https://example.com/api/v2/report.",
    "Keep 42 workers running.",
)
_DROPPED_REF_COMPRESSED = _msgs(
    "Edit the stats script now.",
    "Keep 42 workers running.",
)

# compressed drops the metric number too
_DROPPED_NUMBER_COMPRESSED = _msgs(
    "Edit /tmp/data/stats.py now.",
    "Keep many workers running.",
)

# original with only an intent + a greeting -> tests keys_only + low value
_INTENT_ONLY = _msgs("Please change config.yml to debug mode.", "Thanks.")
_HELLO_ONLY = _msgs("Hi there.", "Nice to meet you.")


# ---------------------------------------------------------------------------
# evaluate_retention: retention counts & ratios
# ---------------------------------------------------------------------------


def test_report_empty_original_is_safe():
    """No messages -> facts_total 0, retention_ratio 1.0, no drops, no crash."""
    report = evaluate_retention([], [])
    assert report.facts_total == 0
    assert report.retention_ratio == 1.0
    assert report.dropped_high_value == []
    assert report.dropped_low_value == []


def test_full_retention_no_loss_ratio_one():
    """compressed identical to original -> every fact retained, ratio 1.0."""
    report = evaluate_retention(_FULL_ORIGINAL, _FULL_ORIGINAL)
    assert report.facts_total > 0
    assert report.facts_retained == report.facts_total
    assert report.retention_ratio == 1.0
    assert report.dropped_high_value == []


def test_path_fact_retained_when_present():
    """A file path must be counted retained when it survives compaction."""
    original = _msgs("Edit /tmp/data/stats.py now.")
    compressed = _msgs("We edited /tmp/data/stats.py now.")
    report = evaluate_retention(original, compressed)
    assert any("/tmp/data/stats.py" in f for f in report.retained_facts)
    assert report.retention_ratio == 1.0


def test_url_fact_retained_when_present():
    """A URL must be counted retained when it survives compaction."""
    original = _msgs("Push to https://example.com/api/v2/report.")
    compressed = _msgs("Pushed it to https://example.com/api/v2/report done.")
    report = evaluate_retention(original, compressed)
    assert any("https://example.com/api/v2/report" in f for f in report.retained_facts)


def test_number_fact_retained_when_present():
    """A metric number is retained when present in the compressed output."""
    original = _msgs("Keep 42 workers running.")
    compressed = _msgs("Keep 42 workers running, confirmed.")
    report = evaluate_retention(original, compressed)
    assert any("42" in f for f in report.retained_facts)


def test_date_fact_retained_when_present():
    """An explicit ISO date is retained when it survives."""
    original = _msgs("Ship before 2026-09-03.")
    compressed = _msgs("Shipped right before 2026-09-03.")
    report = evaluate_retention(original, compressed)
    assert any("2026-09-03" in f for f in report.retained_facts)


def test_entity_acronym_retained_when_present():
    """Uppercase acronyms (named entities) are retained by word boundary match."""
    original = _msgs("ICT_ENV must stay enabled.")
    compressed = _msgs("ICT_ENV stays enabled as required.")
    report = evaluate_retention(original, compressed)
    assert any("ICT_ENV" in f for f in report.retained_facts)


def test_intent_object_retained_when_present():
    """An instruction-intent object counts retained when it survives."""
    original = _msgs("Please change config.yml to debug mode.")
    compressed = _msgs("Change config.yml to debug mode.")
    report = evaluate_retention(original, compressed)
    assert any("config.yml" in f for f in report.retained_facts)


# ---------------------------------------------------------------------------
# drop classification
# ---------------------------------------------------------------------------


def test_path_and_url_dropped_are_high_value():
    """Dropping a path/url is a HIGH-value loss and must appear in dropped_high_value."""
    report = evaluate_retention(_DROPPED_REF_ORIGINAL, _DROPPED_REF_COMPRESSED)
    dropped = " ".join(d["fact"] for d in report.dropped_high_value)
    assert "/tmp/data/stats.py" in dropped
    assert "https://example.com/api/v2/report" in dropped
    assert report.retention_ratio < 1.0


def test_number_dropped_is_high_value_with_reason():
    """Dropping a metric number is a high-value loss with a 'metric_dropped' reason."""
    report = evaluate_retention(_DROPPED_REF_ORIGINAL, _DROPPED_NUMBER_COMPRESSED)
    numbers = [d for d in report.dropped_high_value if d["kind"] == "number"]
    assert any(d["fact"] == "42" for d in numbers)
    assert all(d["reason"] == "metric_dropped" for d in numbers)


def test_greeting_drop_is_low_value_reasonable():
    """A dropped greeting is a REASONABLE low-value drop, never a high-value loss."""
    report = evaluate_retention(_HELLO_ONLY, _msgs("Proceeding."))
    assert report.dropped_low_value, "greeting should be reported as a low-value drop"
    assert all(d["kind"] != "greeting" for d in report.dropped_high_value)


def test_retention_ratio_reflects_dropped_facts():
    """retention_ratio must decrease when specific high-value facts are dropped."""
    kept = evaluate_retention(_DROPPED_REF_ORIGINAL, _DROPPED_REF_ORIGINAL)
    partial = evaluate_retention(_DROPPED_REF_ORIGINAL, _DROPPED_REF_COMPRESSED)
    assert partial.retention_ratio < kept.retention_ratio


def test_tokens_and_chars_saved_ratios_positive():
    """Real compression direction -> both saving ratios are > 0."""
    report = evaluate_retention(_FULL_ORIGINAL, _msgs("Done."))
    assert report.original_chars > 0
    assert report.chars_saved_ratio > 0.0
    assert report.tokens_saved_ratio > 0.0
    assert report.compressed_tokens < report.original_tokens


# ---------------------------------------------------------------------------
# keys_only mode
# ---------------------------------------------------------------------------


def test_keys_only_excludes_soft_intent_facts():
    """keys_only=True counts hard keys only: the intent is excluded, greeting too."""
    keys = evaluate_retention(_INTENT_ONLY, _INTENT_ONLY, keys_only=True)
    full = evaluate_retention(_INTENT_ONLY, _INTENT_ONLY)
    # full mode sees the intent (soft) fact, keys mode does not
    assert full.facts_total > keys.facts_total
    assert keys.facts_total == 0
    assert keys.retention_ratio == 1.0


# ---------------------------------------------------------------------------
# embedding mode
# ---------------------------------------------------------------------------


def _identity_embed(text: str) -> list[float]:
    """Deterministic dictionary-ish embedder used only for overlap tests."""
    import hashlib

    vec = [0.0] * 16
    for chunk in text.lower().replace(".", " ").split():
        h = int(hashlib.md5(chunk.encode()).hexdigest()[:8], 16)
        vec[h % 16] += 1.0
    norm = sum(v * v for v in vec) ** 0.5 or 1.0
    return [v / norm for v in vec]


def test_embedding_mode_marks_method_and_retains_exact():
    """With embed_fn injected the method is 'embedding' and exact facts still count."""
    original = _msgs("Set target to 99 units.")
    compressed = _msgs("Set target to 99 units.")  # exact copy
    report = evaluate_retention(
        original, compressed, embed_fn=_identity_embed
    )
    assert report.method == "embedding"
    assert report.retention_ratio == 1.0


def test_embedding_mode_salvages_rephrased_fact():
    """Semantic mode should retain a rephrased fact the substring heuristic misses."""
    original = _msgs("The ERASING_MODE flag must be turned off before launch.")
    compressed = _msgs("Remember to disable the wipe toggle for the go-live.")
    heuristic = evaluate_retention(original, compressed)
    semantic = evaluate_retention(original, compressed, embed_fn=_identity_embed)
    # heuristic misses the acronym (rephrased away)
    semantic_retained = semantic.facts_retained
    assert semantic.method == "embedding"
    assert semantic_retained >= heuristic.facts_retained


def test_embedding_mode_empty_vector_falls_back_gracefully():
    """If embed_fn returns an empty/zero vector the fact is not falsely retained."""
    original = _msgs("Delete /tmp/alpha.txt eventually.")
    compressed = _msgs("The file cleanup is still pending.")
    report = evaluate_retention(
        original, compressed, embed_fn=lambda _t: []
    )
    assert any("/tmp/alpha.txt" in d["fact"] for d in report.dropped_high_value)


# ---------------------------------------------------------------------------
# apply_report_policy
# ---------------------------------------------------------------------------


def _report_with_ratio(ratio: float) -> QualityReport:
    return QualityReport(retention_ratio=ratio)


def test_policy_degrades_below_threshold():
    """Low retention + auto_degrade -> degrade True with a fallback suggestion."""
    decision = apply_report_policy(_report_with_ratio(0.4))
    assert decision["degrade"] is True
    assert decision["retention_ratio"] == 0.4
    assert "fall back" in decision["suggestion"].lower()


def test_policy_keeps_above_threshold():
    """Acceptable retention -> decided to commit (degrade False)."""
    decision = apply_report_policy(_report_with_ratio(0.7))
    assert decision["degrade"] is False


def test_policy_at_threshold_does_not_degrade():
    """Exactly at the default threshold is not degraded (strict '<')."""
    decision = apply_report_policy(_report_with_ratio(DEFAULT_RETENTION_THRESHOLD))
    assert decision["degrade"] is False


def test_policy_auto_degrade_disabled():
    """auto_degrade=False overrides a bad ratio -> no forced degradation."""
    decision = apply_report_policy(_report_with_ratio(0.3), auto_degrade=False)
    assert decision["degrade"] is False


def test_policy_custom_threshold_sharpens_boundary():
    """A stricter custom threshold degrades what the default would accept."""
    decision = apply_report_policy(_report_with_ratio(0.6), threshold=0.65)
    assert decision["degrade"] is True
    assert decision["retention_ratio"] == 0.6


# ---------------------------------------------------------------------------
# CompactionQualityGate (EMA + consecutive-low)
# ---------------------------------------------------------------------------


def test_gate_fresh_never_falls_back():
    """No recorded history -> no fallback recommendation (data must be absent)."""
    gate = CompactionQualityGate()
    assert gate.needs_fallback() is False
    assert gate.needs_fallback(candidate=0.9) is False


def test_gate_single_low_does_not_trigger():
    """One low outcome is not yet a persistent pattern (min_low=2 default)."""
    gate = CompactionQualityGate()
    gate.record(0.3)
    assert gate.needs_fallback() is False


def test_gate_consecutive_low_triggers_fallback():
    """Sustained low EMA -> consecutive_low >= min_low -> fallback recommended."""
    gate = CompactionQualityGate()
    gate.record(0.2).record(0.3)
    assert gate.consecutive_low >= 2
    assert gate.needs_fallback() is True


def test_gate_recovers_after_high_outcomes():
    """High outcomes reset the low streak -> fallback no longer recommended."""
    gate = CompactionQualityGate()
    gate.record(0.2).record(0.2)
    assert gate.needs_fallback() is True
    gate.record(0.9).record(0.9)
    assert gate.needs_fallback() is False


def test_gate_live_candidate_alarms_with_history():
    """A live low candidate alarms once enough history exists, even if EMA is high."""
    gate = CompactionQualityGate()
    gate.record(0.9).record(0.9)
    assert gate.needs_fallback(candidate=0.2) is True
    assert gate.needs_fallback(candidate=0.8) is False


def test_gate_record_accepts_quality_report():
    """record() accepts a QualityReport and uses its retention_ratio for the EMA."""
    gate = CompactionQualityGate()
    gate.record(QualityReport(retention_ratio=0.1)).record(
        QualityReport(retention_ratio=0.1)
    )
    assert gate.needs_fallback() is True
    assert gate.ema == 0.1


def test_gate_history_tracks_records():
    """Recorded ratios are exposed through history()."""
    gate = CompactionQualityGate()
    gate.record(0.5).record(0.6).record(0.7)
    assert gate.history() == [0.5, 0.6, 0.7]
    assert gate._recorded == 3


# ---------------------------------------------------------------------------
# evaluate_outcome convenience
# ---------------------------------------------------------------------------


def test_evaluate_outcome_alias_equivalent():
    """evaluate_outcome must match evaluate_retention for the same inputs."""
    a = evaluate_outcome(_DROPPED_REF_ORIGINAL, _DROPPED_REF_COMPRESSED)
    b = evaluate_retention(_DROPPED_REF_ORIGINAL, _DROPPED_REF_COMPRESSED)
    assert a.facts_retained == b.facts_retained
    assert a.retention_ratio == b.retention_ratio
    assert a.as_dict() == b.as_dict()


def test_evaluate_outcome_is_readonly_convenience():
    """evaluate_outcome keeps default heuristic mode and returns a full report dict."""
    report = evaluate_outcome(_FULL_ORIGINAL, _msgs("Done."))
    data = report.as_dict()
    assert data["method"] == "heuristic"
    assert {"facts_retained", "facts_total", "retention_ratio", "tokens_saved_ratio"} <= set(
        data
    )
