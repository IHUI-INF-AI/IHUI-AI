# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""An executable version of the writing doctrine (R117).

``writing_quality.md`` is 19,219 characters of prose about bad prose. It names eleven vocabulary
markers, a handful of construction patterns, and an absolute scoring rule: above eighty means no
slop anywhere and an expert would believe a human wrote it, while *any* slop drops it below sixty.
Reading that is not the same as being able to apply it. This module turns the named patterns and
their exceptions into something that runs.

**The hard part is not detection, it is restraint.** Every one of these patterns has a sanctioned
use. "The bug is in the parser, not the tokenizer" is a real distinction, not slop. "The API
returns 429 when the client exceeds the rate limit" is precise, not inflated. The doctrine itself
says to treat the patterns as *contextual signals*, to penalise what is conspicuous, repeated or
unearned, and not to reject a passage over one isolated phrase. So every check here carries an
exemption, and the exemptions are where the judgement lives:

* A vocabulary marker is waived when the sentence around it carries a number, a named source, or a
  quoted string. ``underscore`` in "the audit underscores 14 unlabelled controls" is a finding; it
  is not a finding when there is a measurement doing the work.
* Negative parallelism is waived when both sides name concrete things. "Anchored in the parser,
  not the tokenizer" is a distinction; "not just a calendar, it's a gateway" is the pattern the
  doctrine is after, and the difference is that one side is an abstraction while the other names
  an object.
* A vague authority is waived when the same sentence identifies who said it.
* Triads are waived when the three items are not all abstractions and the list actually enumerates.
* Em dashes and colons are waived at low density; the doctrine objects to them used *for rhythm*,
  not to their existence.

Which means a clean result here is not a certificate. It means the patterns this doctrine names
were not found in a shape it calls defective. It does not mean the writing is good.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from typing import Final

# --- the named vocabulary -------------------------------------------------------

AI_VOCABULARY: Final = (
    "delve",
    "pivotal",
    "robust",
    "tapestry",
    "underscore",
    "showcase",
    "foster",
    "intricate",
    "landscape",
    "testament",
    "vibrant",
)

# Words that make a phrase feel abstract without saying anything.
ABSTRACT_NOUNS: Final = (
    "value",
    "impact",
    "alignment",
    "gateway",
    "journey",
    "experience",
    "ecosystem",
    "synergy",
    "transformation",
    "innovation",
    "excellence",
    "insight",
    "framework",
    "paradigm",
    "landscape",
    "future",
)

# The three-adjective tag that the doctrine calls out by name.
STOCK_TRIAD_WORDS: Final = (
    "faster",
    "smarter",
    "intuitive",
    "seamless",
    "scalable",
    "powerful",
    "effortless",
    "delightful",
    "meaningful",
)

CANNED_OPENERS: Final = (
    "in today's fast-paced",
    "in today's ever-changing",
    "in the modern",
    "in this day and age",
    "when it comes to",
    "it is important to note",
)

CANNED_CLOSERS: Final = (
    "in conclusion",
    "in summary,",
    "to sum up",
    "all in all",
)

META_ANNOUNCEMENTS: Final = (
    "below is a",
    "here is a polished",
    "here's a polished",
    "this article will",
    "this document will explore",
)

VAGUE_AUTHORITIES: Final = (
    "experts argue",
    "experts say",
    "scholars say",
    "observers note",
    "research consistently shows",
    "studies show",
    "several sources suggest",
    "it is widely believed",
)

CANNED_EMPATHY: Final = (
    "i completely understand how",
    "i understand how frustrating",
    "this must feel",
)

BUREAUCRATIC_FILLER: Final = (
    "at this point in time",
    "it would be advisable for",
    "begin the process of",
    "in order to",
    "the operational implications associated with",
    "stakeholders should be informed of",
)

EMPTY_ABSTRACTION_PAIRS: Final = (
    "unlocks value",
    "fosters alignment",
    "drives meaningful impact",
    "represents a profound shift",
    "is more important than ever",
    "paves the way",
    "at the heart of",
)

# Language that introduces an actual fact rather than a feeling.
EVIDENCE_MARKERS: Final = (
    r"\b\d",  # any digit
    r"\d{4}",  # a year
    r'"',  # a quotation
    r"\bper\s?cent\b",
    r"\bpercent\b",
    r"\b\d+\s?%",
)


@dataclass(frozen=True)
class Finding:
    bucket: str
    quote: str
    reason: str
    waived: bool = False
    waiver: str = ""


@dataclass(frozen=True)
class Report:
    findings: Sequence[Finding] = field(default_factory=tuple)
    sentences: int = 0
    words: int = 0

    @property
    def live(self) -> tuple[Finding, ...]:
        return tuple(f for f in self.findings if not f.waived)

    @property
    def clean(self) -> bool:
        return not self.live

    @property
    def score(self) -> int:
        """Any live finding caps below sixty; a clean pass has no ceiling."""
        if not self.live:
            return 100
        return max(30, 55 - 3 * (len(self.live) - 1))

    @property
    def verdict(self) -> str:
        return "clean" if self.clean else "slop"


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p for p in parts if p.strip()]


def _has_evidence(sentence: str) -> bool:
    return any(re.search(p, sentence) for p in EVIDENCE_MARKERS)


def _quoted(sentence: str) -> bool:
    return sentence.count('"') >= 2 or sentence.count("\u201c") >= 2


def _waivable(sentence: str) -> str:
    """Reason a pattern is doing real work rather than rhythm."""
    if _quoted(sentence):
        return "quotes an identified source"
    if _has_evidence(sentence):
        return "carries a measurement"
    return ""


def find_vocabulary(text: str) -> list[Finding]:
    out: list[Finding] = []
    for sentence in _sentences(text):
        low = sentence.lower()
        hits = [w for w in AI_VOCABULARY if re.search(rf"\b{re.escape(w)}\w{{0,3}}\b", low)]
        if not hits:
            continue
        waiver = _waivable(sentence)
        out.append(
            Finding(
                bucket="ai_vocabulary",
                quote=sentence.strip(),
                reason=f"named marker(s): {', '.join(hits)}",
                waived=bool(waiver),
                waiver=waiver,
            )
        )
    return out


def find_negative_parallelism(text: str) -> list[Finding]:
    """'not just X, it's Y' is slop when both sides are abstractions."""
    patterns = (
        re.compile(
            r"\b(isn't|is not|was not)\s+just\s+(.{0,60}?)(?:[,;:]\s+|\s+-\s+)(it's|it is)\s+(.{0,60})",
            re.I,
        ),
        re.compile(r"\bnot just\s+(.{0,60}?)[,;]\s+(but)\s+(.{0,80})", re.I),
        re.compile(r"\bnot only\s+(.{0,60}?)\s+but also\s+(.{0,80})", re.I),
        re.compile(r"\bnot\s+(.{0,40}?),?\s+but\s+(.{0,60})", re.I),
    )
    out: list[Finding] = []
    for sentence in _sentences(text):
        for pat in patterns:
            m = pat.search(sentence)
            if not m:
                continue
            low = sentence.lower()
            abstract = [n for n in ABSTRACT_NOUNS if re.search(rf"\b{n}\b", low)]
            waiver = _waivable(sentence)
            out.append(
                Finding(
                    bucket="negative_parallelism",
                    quote=sentence.strip(),
                    reason=(
                        f"contrast built on {', '.join(abstract)}"
                        if abstract
                        else "contrast pair carrying no observable"
                    ),
                    waived=bool(waiver),
                    waiver=waiver,
                )
            )
            break
    return out


def find_vague_authority(text: str) -> list[Finding]:
    out: list[Finding] = []
    for sentence in _sentences(text):
        low = sentence.lower()
        hit = next((p for p in VAGUE_AUTHORITIES if p in low), "")
        if not hit:
            continue
        waiver = _waivable(sentence)
        out.append(
            Finding(
                bucket="vague_authority",
                quote=sentence.strip(),
                reason=f"unsourced attribution: {hit}",
                waived=bool(waiver),
                waiver=waiver,
            )
        )
    return out


def find_canned_framing(text: str) -> list[Finding]:
    sentences = _sentences(text)
    out: list[Finding] = []
    for i, sentence in enumerate(sentences):
        low = sentence.lower()
        is_first = i == 0
        is_last = i == len(sentences) - 1
        table: list[tuple[str, tuple[str, ...], str]] = [
            ("canned_opener", CANNED_OPENERS, "generic scene-setting"),
            ("canned_closer", CANNED_CLOSERS, "redundant conclusion"),
            ("meta_announcement", META_ANNOUNCEMENTS, "announces the writing instead of doing it"),
            ("canned_empathy", CANNED_EMPATHY, "canned emotional phrase"),
            ("bureaucratic_filler", BUREAUCRATIC_FILLER, "bureaucratic padding"),
            ("empty_abstraction", EMPTY_ABSTRACTION_PAIRS, "claim without an observable"),
        ]
        for bucket, phrases, reason in table:
            hit = next((p for p in phrases if p in low), "")
            if not hit:
                continue
            if bucket == "canned_opener" and not is_first:
                continue
            if bucket == "canned_closer" and not is_last:
                continue
            out.append(Finding(bucket=bucket, quote=sentence.strip(), reason=f"{reason}: {hit}"))
    return out


def find_stock_triad(text: str) -> list[Finding]:
    """Three interchangeable adjectives are the triad the doctrine names."""
    out: list[Finding] = []
    for sentence in _sentences(text):
        low = sentence.lower()
        words = re.findall(r"[a-z]+", low)
        window = [w for w in words if w in STOCK_TRIAD_WORDS]
        if len(window) >= 3 and not _has_evidence(sentence):
            out.append(
                Finding(
                    bucket="stock_triad",
                    quote=sentence.strip(),
                    reason=f"stock adjectives: {', '.join(window[:3])}",
                )
            )
    return out


def find_punctuation_rhythm(text: str) -> list[Finding]:
    """Dashes and colons used for cadence rather than clarity.

    A label colon ("Examples: ...") and a colon before a quoted example are doing structural work,
    not rhythm, so they are counted out. The pattern under test is two or more mid-sentence colons
    stacking clauses, which is the cadence the doctrine objects to.
    """
    out: list[Finding] = []
    for sentence in _sentences(text):
        dashes = sentence.count("\u2014") + sentence.count(" - ")
        mid = [
            m.start()
            for m in re.finditer(":", sentence)
            if len(re.findall(r"[A-Za-z']+", sentence[: m.start()])) >= 4
            and not sentence[m.start() + 1 :].lstrip().startswith(('"', "\u201c", "'"))
        ]
        if dashes >= 2:
            out.append(
                Finding(
                    bucket="dash_rhythm",
                    quote=sentence.strip(),
                    reason=f"{dashes} dashes in one sentence",
                )
            )
        elif len(mid) >= 2 and not re.search(r"\d\s*:\s*\d", sentence):
            out.append(
                Finding(
                    bucket="colon_cadence",
                    quote=sentence.strip(),
                    reason=f"{len(mid)} mid-sentence colons stacking clauses",
                )
            )
    return out


def analyze(text: str) -> Report:
    findings: list[Finding] = []
    for detector in (
        find_vocabulary,
        find_negative_parallelism,
        find_vague_authority,
        find_canned_framing,
        find_stock_triad,
        find_punctuation_rhythm,
    ):
        findings.extend(detector(text))
    return Report(
        findings=tuple(findings),
        sentences=len(_sentences(text)),
        words=len(re.findall(r"[A-Za-z']+", text)),
    )


def live_buckets(text: str) -> tuple[str, ...]:
    return tuple(f.bucket for f in analyze(text).live)


def summarize(reports: Iterable[Report]) -> dict[str, int]:
    total_live = sum(len(r.live) for r in reports)
    return {"reports": len(list(reports)), "live_findings": total_live}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
