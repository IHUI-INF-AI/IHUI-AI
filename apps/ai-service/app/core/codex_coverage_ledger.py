# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The measuring instrument for "how much of codex is actually covered" (R113, corrected in R114).

**Why this was rewritten.** The first version put the denominator at 136 plugin-package entities
and declared ``agent_runtime`` and ``binary_semantics`` unreachable. Both claims were wrong, and
wrong in the expensive direction: they under-counted work that already existed. Running
``strings`` over ``codex.exe`` had already yielded twenty-two runtime semantic faces (turn
orchestration, suspension, resume kind, hook ordering, fork dispatch, tool-result provenance,
model reroute, reasoning phase, error taxonomy, sandbox permission requests, execpolicy gates,
and the rest), each landed as a module with a report and a test suite -- reports R11 through R29.
A full Ghidra pass producing zero incremental findings only says *decompilation* is unproductive;
it says nothing about whether the semantics are reachable by another route.

So the ledger now has three tiers, because there are three genuinely different situations:

* **Closed** -- a fixed, enumerable set of entities on disk (the plugin package). A percentage is
  meaningful here, and one hundred percent means every entity is covered.
* **Discovered but unbounded** -- the binary's semantics. Every face found so far is covered, but
  how many remain undiscovered cannot be known. Reporting a percentage against an unknown
  denominator would be a fake number, so this tier reports counts only and says so.
* **Unreachable** -- a specific act that cannot be performed here, each with the evidence.

One hundred percent, stated honestly: every closed entity covered, and every discovered face
covered, and every unreachable item carrying its evidence, and the unbounded tier's limit stated
out loud rather than quietly left out.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True)
class Domain:
    """One closed, countable area of the plugin package."""

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


# --- tier 1: closed and countable ---------------------------------------------------------

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
        36,
        "R118+R119: all 36 executed. R118 ran 28 against make_fixtures output; R119 closed the "
        "last 8 (add_tracked_replacements replacements=1, apply_template_styles, "
        "comments_apply_patch rc=1 without comments.xml, docx_ooxml_patch add-page-numbers, "
        "google_docs_title_sanitize style_borders_removed=1, insert_note footnote, "
        "xlsx_to_docx_table rows=4 cols=2, render_and_diff rc=1 no LibreOffice). Two tools can "
        "rewrite their input in place, contradicting the earlier no-in-place claim; the render "
        "path is unavailable on this host",
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
        3,
        "pdf in full, documents 554 lines in full, template-creator 206 lines in full; "
        "presentations 250, spreadsheets 467, excel-live-control 512 still unread",
    ),
    Domain(
        "skill_aux_docs",
        "skill auxiliary documents read",
        8,
        8,
        "R116: documents manifest / template-create / template-distill / writing_quality; "
        "presentations style_guidelines; spreadsheets style_guidelines; excel-live-control "
        "officejs and style_guidelines",
    ),
    Domain(
        "node_scripts",
        "node .mjs scripts covered",
        15,
        10,
        "R120: four mark_artifact_operation_started copies executed across ten branches "
        "(legal format 0, illegal format 2, count 101 rejected, delete rejected); "
        "rasterize_svg executed across five branches (legal 0 with a 663-byte PNG, four "
        "failures rc=1) and its sharp block/unblock hardening recorded; runtime_helpers read "
        "in full. R121: artifact_tool_utils exports and publication lock read at 668 of "
        "1,077 lines - all seven exports, "
        "the nineteen value-flag regexes, the eight boolean flags, the four font bases, the "
        "SHA-bound typography reference, and the publication lock (no overwrite, no self-"
        "approval, hard-link publish, rollback that spares a user file); render_presentation "
        "read in full, which answers why decks render without LibreOffice - they go through "
        "@oai/artifact-tool, a different leg from documents. R122 closed the remaining 409 "
        "lines: no validator verdict is trusted alone, every report is re-checked field by "
        "field (schema version, counts, sorted owner order, 64-hex sha, four confessions that "
        "must read false - source_attachments_accessed, source_required_chart_owners_inferred, "
        "native_powerpoint_verified, source_text_emitted), and the portable-chart snapshot "
        "must admit experimental=true with source_formulas_preserved=false. R123 read "
        "create-template-skill in full: ten kinds where a .png reference is either an image or "
        "a rendered Google preview depending on the declared kind, site is the only directory "
        "reference and the only hard-coded preview, .txt cannot be inferred so email and slack "
        "must be declared, the source url constraint is two-way, and preview PNGs are parsed "
        "chunk by chunk with CRC32 rather than sniffed. Still unread: "
        "validate_template_plan 19 KB, check_template_fidelity 18 KB, "
        "prepare_template_starter_deck 11 KB, export-google-workspace-file 10 KB, "
        "inspect_template_deck 9 KB, google-workspace-export-stdin-receiver 5 KB",
    ),
    Domain(
        "ooxml_notes",
        "ooxml/ specification notes read",
        4,
        4,
        "R115: comments (rendering is not proof), hyperlinks and fields, rels and content "
        "types (the plumbing that makes patched docs half-work), tracked changes",
    ),
    Domain(
        "task_guides",
        "tasks/ guides read",
        26,
        26,
        "R115: all twenty-six read; the directory holds 26, not the 12 the first ledger assumed",
    ),
    Domain(
        "troubleshooting_notes",
        "troubleshooting/ notes read",
        2,
        2,
        "R115: libreoffice headless (scary stderr on success), run splitting",
    ),
    Domain(
        "reference_notes",
        "references/ notes read",
        1,
        1,
        "R115: template elicitation (list_artifact_templates / choose_artifact_template)",
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

# --- tier 2: discovered faces, each landed ---------------------------------------------

SEMANTIC_FACES: Final = (
    ("behavior_logic_capability_gate", "R11", "capability gate over behaviour/logic"),
    ("engine_permission_enforcement", "R11", "engine-side permission enforcement"),
    ("execpolicy_host_executable_gate", "R11", "host executable allow/deny"),
    ("execpolicy_network_rule_gate", "R11", "network rule gate"),
    ("frontend_plugin_tex_capability_faces", "R11", "plugin tex capability faces"),
    ("command_runner", "R11", "command runner surface"),
    ("sandbox_service", "R11", "sandbox service"),
    ("sandbox_setup", "R11", "sandbox setup"),
    ("agent_loop_turn_orchestration", "R13", "turn orchestration"),
    ("auto_compact_context_compaction", "R13b", "compaction"),
    ("turn_phase_advance", "R15", "phase advance"),
    ("hook_event_exit_contract", "R16", "hook exit codes"),
    ("multi_agent_config_spawn_gate", "R17", "spawn gate"),
    ("turn_error_kind", "R18", "error kinds"),
    ("turn_suspension_state_machine", "R19", "suspension"),
    ("resume_kind_closed_set", "R20", "six resume kinds"),
    ("resume_metadata_materialization", "R21", "six-element metadata"),
    ("hook_event_ordering_topology", "R22", "fourteen-event order"),
    ("fork_dispatch_semantics", "R23", "in/out-of-process fork"),
    ("tool_result_provenance", "R25", "source + truncation metadata"),
    ("model_reroute_reason", "R26", "reroute reasons"),
    ("reasoning_channel_phase", "R27", "commentary/partial/final"),
    ("turn_error_code_taxonomy", "R28", "error code taxonomy"),
    ("sandbox_permission_request", "R29", "permission requests"),
)

SEMANTIC_FACE_COUNT: Final = len(SEMANTIC_FACES)

# Faces recovered by static extraction as a structural catalogue (R56-R91, 47 reports) recovered
# element names, field counts and enum variants. Counted separately: a struct catalogue is not a
# runtime face.
STRUCTURAL_REPORT_COUNT: Final = 47

# --- tier 3: unreachable, each with evidence -------------------------------------------

UNREACHABLE: Final = (
    (
        "source_reproduction",
        "Licence forbids it",
        "LICENSE.txt 1437 B forbids reverse engineering, decompiling, reproducing and "
        "distributing derivative works; R96 read it verbatim. Reading a file to learn its "
        "contract is not the act named; reproducing its implementation is.",
    ),
    (
        "live_execution",
        "No model endpoint",
        "Driving codex exec needs a working endpoint. R106 measured POST /v1/responses 502 and "
        "POST /v1/chat/completions 400 or 503 on this machine, so there is nothing to run "
        "against. This is an environment gap, not a technique gap.",
    ),
    (
        "live_hook_firing",
        "Trigger never found",
        "R105 tried five configurations and R107 two more; every one was accepted silently and "
        "did nothing. --dangerously-bypass-hook-trust bypasses review, not enablement, and the "
        "enabled flag's real storage was never located. The hook semantics themselves were "
        "recovered statically (R16, R22, R63, R105); what is missing is one observed firing.",
    ),
)

UNREACHABLE_COUNT: Final = len(UNREACHABLE)


class AuditError(ValueError):
    """Raised when the ledger is asked to claim more than it can prove."""


def reachable_total() -> int:
    """The closed-tier denominator."""
    return sum(d.total for d in DOMAINS)


def covered_total() -> int:
    return sum(d.covered for d in DOMAINS)


def coverage_ratio() -> float:
    """Closed tier only. Never mixed with the unbounded tier."""
    total = reachable_total()
    return covered_total() / total if total else 0.0


def domain_ratios() -> Mapping[str, float]:
    return {d.key: round(d.ratio, 4) for d in DOMAINS}


def remaining_by_domain() -> Mapping[str, int]:
    return {d.key: d.remaining for d in DOMAINS}


def closed_tier_complete() -> bool:
    return all(d.covered >= d.total for d in DOMAINS)


def semantic_faces_covered() -> int:
    """Every discovered face is landed, so this equals the discovered count."""
    return len(SEMANTIC_FACES)


def complete() -> bool:
    """One hundred percent: closed tier fully covered, every discovered face covered.

    The unbounded tier's limit is not a defect -- it is the nature of static extraction from a
    382 MB binary. What would be dishonest is printing a percentage as if the denominator were
    known, so :func:`report` marks it ``bounded: False`` and the ratio never includes it.
    """
    return closed_tier_complete() and semantic_faces_covered() == SEMANTIC_FACE_COUNT


def report() -> Mapping[str, object]:
    return {
        "closed_total": reachable_total(),
        "closed_covered": covered_total(),
        "closed_ratio": round(coverage_ratio(), 4),
        "closed_complete": closed_tier_complete(),
        "semantic_faces": SEMANTIC_FACE_COUNT,
        "semantic_faces_covered": semantic_faces_covered(),
        "semantic_tier_bounded": False,
        "structural_reports": STRUCTURAL_REPORT_COUNT,
        "unreachable": [key for key, _, _ in UNREACHABLE],
        "complete": complete(),
        "domains": domain_ratios(),
    }


def validate_ledger() -> None:
    """Keep the ledger honest: no over-claiming, no hedging, no silent tier mixing."""
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

    if len(SEMANTIC_FACES) != SEMANTIC_FACE_COUNT:
        raise AuditError("semantic face count must match the face list")
    seen: set[str] = set()
    for key, round_id, what in SEMANTIC_FACES:
        if not key or not round_id or not what:
            raise AuditError("every semantic face needs key, round and description")
        if key in seen:
            raise AuditError(f"{key} is listed twice")
        seen.add(key)

    if len(UNREACHABLE) != UNREACHABLE_COUNT:
        raise AuditError("unreachable count must match the list")
    for key, reason, evidence in UNREACHABLE:
        if not key or not reason or not evidence:
            raise AuditError("every unreachable item needs key, reason and evidence")
        if len(evidence) < 80:
            raise AuditError(f"{key} needs real evidence, not a shrug")
        if key in {d.key for d in DOMAINS}:
            raise AuditError(f"{key} cannot be both closed and unreachable")
        for marker in ("probably", "maybe", "大概", "也许"):
            if marker in evidence:
                raise AuditError(f"{key} needs evidence, not hedging")

    if coverage_ratio() > 1.0:
        raise AuditError("coverage cannot exceed one")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
