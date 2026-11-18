# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the executable writing doctrine (R117).

Every positive case is a sentence the doctrine itself marks as bad writing; every negative case is
one it explicitly tells the reader not to flag. That is the point of this suite: the restraint is
as much under test as the detection.
"""

from __future__ import annotations

import pytest

from app.core.writing_slop_audit import (
    AI_VOCABULARY,
    Report,
    analyze,
    find_canned_framing,
    find_negative_parallelism,
    find_punctuation_rhythm,
    find_stock_triad,
    find_vague_authority,
    find_vocabulary,
    live_buckets,
)

# --- the doctrine's own bad examples ---------------------------------------------------------

BAD = {
    "inflated_contrast": "This isn't just a calendar - it's a gateway to a more intentional life.",
    "not_only": "The tool not only saves time, but also transforms how teams collaborate.",
    "stock_formula": "It is faster, smarter, and more intuitive.",
    "scene_setting": "In today's fast-paced digital landscape, effective communication matters.",
    "redundant_conclusion": "In conclusion, these strategies can help organizations reach goals.",
    "canned_empathy": "I completely understand how frustrating this situation must feel.",
    "empty_abstraction": "This unlocks value and fosters alignment across the org.",
    "vague_authority": "Research consistently shows that this approach improves outcomes.",
    "bureaucratic": "At this point in time, it would be advisable for the team to begin the process of reviewing.",
}


def test_every_bad_example_is_caught() -> None:
    for name, sentence in BAD.items():
        report = analyze(sentence)
        assert not report.clean, f"{name} slipped through: {sentence!r}"


def test_bad_examples_score_under_sixty() -> None:
    for sentence in BAD.values():
        assert analyze(sentence).score < 60


# --- the doctrine's own "do not flag" examples -------------------------------------------------

GOOD = (
    "The bug is in the parser, not the tokenizer.",
    "The red light means stop, and the green light means go.",
    "The change removes one approval step.",
    "The 12 June accessibility audit found 14 missing labels.",
    "Legal and Security must approve the exception before release.",
    "The API returns 429 when the client exceeds the rate limit.",
    "The estimate is preliminary because two regions have not reported.",
    "The vendor may terminate only after giving 30 days' written notice.",
    "This memo covers the two launch decisions due Friday.",
)


def test_every_good_example_passes() -> None:
    for sentence in GOOD:
        report = analyze(sentence)
        assert report.clean, f"{sentence!r} was wrongly flagged: {[(f.bucket, f.reason) for f in report.live]}"


def test_good_examples_score_one_hundred() -> None:
    for sentence in GOOD:
        assert analyze(sentence).score == 100


# --- the exemptions, one by one ---------------------------------------------------------

def test_negative_parallelism_between_concrete_things_is_not_a_match() -> None:
    """"X, not Y" with two concrete objects is not the "not just X, it's Y" pattern at all."""
    findings = find_negative_parallelism("The bug is in the parser, not the tokenizer.")
    assert findings == []


def test_negative_parallelism_between_abstractions_is_live() -> None:
    findings = find_negative_parallelism(
        "This isn't just a calendar, it's a gateway to a more intentional life."
    )
    assert findings and not findings[0].waived
    assert "gateway" in findings[0].reason


def test_vocabulary_without_a_measurement_is_live() -> None:
    findings = find_vocabulary("We should delve into the pivotal landscape.")
    assert findings and not findings[0].waived
    assert "delve" in findings[0].reason


def test_vocabulary_with_a_measurement_is_waived() -> None:
    """A named marker doing real work is not slop."""
    findings = find_vocabulary("The audit underscores 14 unlabelled controls.")
    assert findings and findings[0].waived
    assert findings[0].waiver == "carries a measurement"


def test_vocabulary_inside_a_quote_is_waived() -> None:
    findings = find_vocabulary('The report called the site "a vibrant hub" but gave no numbers.')
    assert findings and findings[0].waived
    assert "quotes" in findings[0].waiver


def test_vague_authority_with_a_named_source_is_waived() -> None:
    findings = find_vague_authority(
        "Studies show a 12 percent drop, according to the May 2026 audit."
    )
    assert findings and findings[0].waived


def test_vague_authority_without_a_source_is_live() -> None:
    findings = find_vague_authority("Experts argue the change is overdue.")
    assert findings and not findings[0].waived


def test_triad_needs_three_stock_words() -> None:
    assert not find_stock_triad("The list has three items: red, green, and blue.")
    assert find_stock_triad("It is seamless, scalable, and powerful.")


def test_triad_with_a_measurement_is_exempt() -> None:
    assert not find_stock_triad("Seamless, scalable, and powerful, at 99.9 percent uptime.")


# --- framing positions ----------------------------------------------------------------

def test_opener_only_counts_at_the_start() -> None:
    early = find_canned_framing("In today's fast-paced world, teams ship weekly.")
    assert any(f.bucket == "canned_opener" for f in early)
    later = find_canned_framing(
        "Teams ship weekly. The review found 14 gaps. In today's fast-paced world, that is late."
    )
    assert not any(f.bucket == "canned_opener" for f in later)


def test_closer_only_counts_at_the_end() -> None:
    assert any(f.bucket == "canned_closer" for f in analyze("Teams shipped. In conclusion, it worked.").findings)
    assert not any(
        f.bucket == "canned_closer"
        for f in analyze("In conclusion, it worked. Teams shipped on time.").findings
    )


# --- punctuation rhythm -------------------------------------------------------------

def test_two_dashes_in_one_sentence_is_flagged() -> None:
    findings = find_punctuation_rhythm("The change \u2014 unplanned \u2014 landed late.")
    assert findings and findings[0].bucket == "dash_rhythm"


def test_a_single_dash_is_left_alone() -> None:
    assert not find_punctuation_rhythm("The change \u2014 unplanned \u2014 landed late.".replace("\u2014", "", 2))


def test_clock_time_is_not_colon_cadence() -> None:
    assert not find_punctuation_rhythm("The window runs 10:30:00 to 11:00:00.")


def test_label_colon_before_examples_is_not_cadence() -> None:
    """A colon introducing examples is structural; this caught a real false positive."""
    assert not find_punctuation_rhythm('Examples: "The change removes one approval step."')


def test_two_mid_sentence_colons_are_flagged() -> None:
    sentence = (
        "The framing is simple: agents do the work the surface cannot: the surface only orients."
    )
    findings = find_punctuation_rhythm(sentence)
    assert findings and findings[0].bucket == "colon_cadence"


# --- report mechanics -------------------------------------------------------------

def test_report_score_bands() -> None:
    clean = analyze("The API returns 429 above the limit.")
    assert clean.clean and clean.score == 100
    slop = analyze("This unlocks value and fosters alignment.")
    assert not slop.clean and slop.score < 60


def test_score_decreases_with_more_findings() -> None:
    one = analyze("Experts argue it matters.")
    many = analyze(
        "Experts argue it matters. In conclusion, it unlocks value. It is faster, smarter, and "
        "intuitive."
    )
    assert many.score <= one.score


def test_report_counts_words_and_sentences() -> None:
    report = analyze("One two three. Four five.")
    assert report.sentences == 2
    assert report.words == 5


def test_empty_text_is_clean() -> None:
    assert analyze("").clean


def test_live_buckets_lists_only_live() -> None:
    buckets = live_buckets("The bug is in the parser, not the tokenizer. Experts argue otherwise.")
    assert "vague_authority" in buckets
    assert "negative_parallelism" not in buckets


def test_vocabulary_table_is_eleven() -> None:
    assert len(AI_VOCABULARY) == 11


def test_report_is_immutable() -> None:
    report = analyze("Short text.")
    assert isinstance(report, Report)
    with pytest.raises(AttributeError):
        report.score = 50  # type: ignore[misc]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
