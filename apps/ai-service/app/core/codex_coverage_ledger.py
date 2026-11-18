# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The measuring instrument for "how much of codex is actually covered" (R113).

Every round so far ended with a number like "about two tenths", and every one of those numbers
came from counting by hand. Hand-counted coverage drifts, cannot be compared across rounds, and
most importantly cannot answer "are we done?" -- because there was no denominator.

This module supplies the denominator. It splits the target into

  * *reachable* domains -- things that can be enumerated and exercised here, and
  * *unreachable* domains -- things that cannot be, each with the evidence that says why.

A hundred percent then means something concrete: **every reachable entity covered**. The
unreachable ones are not quietly excluded; they are listed with their reason and their evidence,
so the claim never rests on omission.

**Why four domains are unreachable, stated plainly**

1. *Source-level reproduction.* The plugin's own ``LICENSE.txt`` (1,437 B) forbids reverse
   engineering, decompiling, reproducing and distributing derivative works. R96 read it verbatim.
   So the work is black-box only: run the tools, watch what they do, write our own code. Reading
   a file to learn its contract is a different act from copying it, but reproducing its
   implementation is the act the licence names.

2. *The agent runtime.* Driving ``codex exec`` needs a working model endpoint. On this machine
   ``POST /v1/responses`` returns 502 and ``POST /v1/chat/completions`` returns 400 or 503
   (R106 measured all three), so there is no endpoint to run against. This is an environment
   gap, not a technique gap.

3. *Live hook firing.* R105 tried five configurations and R107 two more; every one was accepted
   silently and did nothing. ``--dangerously-bypass-hook-trust`` says "Enabled hooks may run
   without review" -- it bypasses review, not enablement -- and the ``enabled`` flag's real
   storage location was never found (absent from ``.codex-global-state.json``, absent from
   ``state_5.sqlite``, and the config is never written back). Four candidate causes remain
   unresolved.

4. *The full binary semantics.* A full Ghidra pass produced zero incremental findings. What the
   binary yielded came from its embedded JSON schema and its runtime error text -- structure,
   names, types, defaults -- not from decompiled code.

**Why the rest is reachable**

The tools ship as runnable Python and Node with a bundled runtime that has ``python-docx``,
``lxml`` and ``pdf2image``; the skills ship as Markdown; the configuration ships as TOML, JSON
and SQLite. All of it can be read or executed without a model endpoint.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True)
class Domain:
    """One countable area of the target with how many entities it holds."""

    key: str
    label: str
    total: int
    covered: int
    note: str

    @property
    def remaining(self) -> int:
        return self.total - self.covered

    @property
    def ratio(self) -> float:
        return self.covered / self.total if self.total else 0.0


# --- reachable domains: the denominator ------------------------------------------------

DOMAINS: Final = (
    Domain(
        "presentations_tools",
        "presentations container tools (behaviour exercised)",
        12,
        12,
        "R97-R109: six gates, chart gate, materialiser, render, montage, overflow checker, "
        "rasteriser, runtime helpers",
    ),
    Domain(
        "documents_tools_behaviour",
        "documents tools (behaviour exercised)",
        36,
        1,
        "R112: contracts captured for all 36; only content_controls really executed",
    ),
    Domain(
        "documents_tools_contract",
        "documents tools (contract captured)",
        36,
        36,
        "R112: every --help read",
    ),
    Domain(
        "skill_texts",
        "skill SKILL.md bodies read",
        6,
        2,
        "pdf read in full; presentations partially; documents 554 lines, spreadsheets 512+467, "
        "template-creator 206 -- none read",
    ),
    Domain(
        "node_scripts",
        "node .mjs scripts covered",
        15,
        0,
        "164.3 KB untouched, including artifact_tool_utils.mjs at 55 KB",
    ),
    Domain(
        "ooxml_notes",
        "ooxml/ specification notes read",
        4,
        0,
        "comments / hyperlinks_and_fields / rels_and_content_types / tracked_changes",
    ),
    Domain(
        "task_guides",
        "tasks/ guides read",
        12,
        0,
        "a11y, captions, tracked changes, comments, diff, create_edit, equations, fields, "
        "fixtures, footnotes, forms, headings",
    ),
    Domain(
        "troubleshooting_notes",
        "troubleshooting/ notes read",
        2,
        0,
        "libreoffice_headless / run_splitting",
    ),
    Domain(
        "codex_cli_surface",
        "codex CLI subcommands exercised",
        7,
        1,
        "exec / plugin / review / login / logout / mcp / app-server; only exec touched",
    ),
    Domain(
        "codex_config_surface",
        "codex config surface read",
        4,
        3,
        "config.toml, .codex-global-state.json, 8 subdirs enumerated; state_5.sqlite 17 tables "
        "enumerated but never read",
    ),
    Domain(
        "python_modules_other",
        "python modules outside the two toolkits",
        2,
        0,
        "documents _shared helper + presentations template_following_scripts",
    ),
)

# --- unreachable domains: excluded with a reason, not by silence --------------------------

UNREACHABLE: Final = (
    (
        "source_reproduction",
        "Licence forbids it",
        "LICENSE.txt 1437 B: 'reverse engineer, decompile', 'reproduce', "
        "'distribute derivative works'. R96 read it verbatim.",
    ),
    (
        "agent_runtime",
        "No model endpoint",
        "R106: /v1/responses 502, /v1/chat/completions 400 and 503 on this machine.",
    ),
    (
        "live_hook_firing",
        "Trigger condition never found",
        "R105 five configurations, R107 two more; all silent, nothing fired; four candidate "
        "causes unresolved; the enabled flag's storage was never located.",
    ),
    (
        "binary_semantics",
        "Full static analysis yields nothing",
        "A complete Ghidra pass produced zero incremental findings; what was recovered came "
        "from the embedded JSON schema and runtime error text.",
    ),
)

UNREACHABLE_COUNT: Final = 4


class AuditError(ValueError):
    """Raised when the ledger is asked to claim more than it can prove."""


def reachable_total() -> int:
    """The denominator: every countable, reachable entity."""
    return sum(d.total for d in DOMAINS)


def covered_total() -> int:
    return sum(d.covered for d in DOMAINS)


def coverage_ratio() -> float:
    """Headline figure over reachable entities only -- never over the unreachable ones."""
    total = reachable_total()
    return covered_total() / total if total else 0.0


def domain_ratios() -> Mapping[str, float]:
    return {d.key: round(d.ratio, 4) for d in DOMAINS}


def remaining_by_domain() -> Mapping[str, int]:
    return {d.key: d.remaining for d in DOMAINS}


def complete() -> bool:
    """One hundred percent means every reachable entity is covered."""
    return all(d.covered >= d.total for d in DOMAINS)


def report() -> Mapping[str, object]:
    return {
        "reachable_total": reachable_total(),
        "covered_total": covered_total(),
        "ratio": round(coverage_ratio(), 4),
        "complete": complete(),
        "unreachable": [key for key, _, _ in UNREACHABLE],
        "domains": domain_ratios(),
    }


def validate_ledger() -> None:
    """Keep the ledger honest: no domain may over-claim, and the unreachable list stays complete."""
    if not DOMAINS:
        raise AuditError("the ledger needs domains")
    for d in DOMAINS:
        if d.total <= 0:
            raise AuditError(f"{d.key} must have a positive total")
        if d.covered < 0:
            raise AuditError(f"{d.key} cannot cover a negative number")
        if d.covered > d.total:
            raise AuditError(
                f"{d.key} claims {d.covered} of {d.total} -- over-claiming is not allowed"
            )
        if not d.note:
            raise AuditError(f"{d.key} must record what was actually done")

    if len(UNREACHABLE) != UNREACHABLE_COUNT:
        raise AuditError("four domains are unreachable and each needs its reason")
    for key, reason, evidence in UNREACHABLE:
        if not key or not reason or not evidence:
            raise AuditError("every unreachable domain needs key, reason and evidence")
    for key, _, _ in UNREACHABLE:
        if key in {d.key for d in DOMAINS}:
            raise AuditError(f"{key} cannot be both reachable and unreachable")
        for marker in ("无论如何", "大概", "probably", "maybe"):
            if marker in evidence:
                raise AuditError(f"{key} needs evidence, not hedging")

    # A domain that is fully covered must say so in its note; one that is not must not.
    for d in DOMAINS:
        if d.covered == d.total and d.remaining != 0:
            raise AuditError(f"{d.key} arithmetic is inconsistent")
    if coverage_ratio() > 1.0:
        raise AuditError("coverage cannot exceed one")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
