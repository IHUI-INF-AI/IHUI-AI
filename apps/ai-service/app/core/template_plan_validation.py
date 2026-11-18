# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""The template-following plan contract (R124).

``validate_template_plan.mjs`` is what decides whether a plan actually follows a template or
merely paints over it. The script exists because "use this deck as a template" has an obvious
failure mode: copy the slides, cover them with new shapes, and call the result a template. The
validator names that failure and refuses it.

**Every output slide must be a duplicate.** ``reuseMode`` must read ``duplicate-slide``; an edit
in place is rejected outright. Copying first is what forces the planner to reconcile with what
the template already contains.

**Output slides must be consecutive from one.** ``outputSlide`` is compared against ``index + 1``
after sorting, so a gap, a duplicate or an off-by-one is a failure rather than a cosmetic
reordering.

**Being empty is a claim, and it is checked against the narrative role.** ``editTargets: []``
means "preserve this slide as-is". That is legal for eight roles — brand, logo, bumper, divider,
separator, section, chrome, blank — and illegal for twenty-four content roles including synthesis,
timeline, proof, summary, map, analysis, evidence, chart, table and thesis. A content slide
declared preserve-only is a slide nobody wrote content for, wearing a label that says it was
intentional.

**Adding shapes is refused twice, from both ends.** ``action: "add"`` is rejected by default
unless the target also carries ``newPrimitiveAllowed``, ``zone``, ``reason`` and
``mustNotOverlapInherited``. On top of that, two role-specific bans apply: a content slide that
uses only ``add`` and maps nothing to inherited elements is ``add-only-content-slide``, and a
brand, bumper, divider or blank slide that uses ``add`` is ``add-on-preserve-only-slide``. The
first says "do not build over a copied slide", the second says "do not turn a logo into a canvas".
Together they close both directions.

**Placeholders must be handled, and keeping them does not count.** Every placeholder the inspect
pass found must be assigned at least one of rewrite, rewrite-and-reposition, replace, delete or
fill-placeholder. ``keep`` and ``add`` explicitly do not satisfy this. A copied slide still
carrying "Click to add title" is not a template use, it is an unfinished deck that happens to
inherit the template's background.

**The six legal actions, and the five that discharge a placeholder.** ``keep`` is the sixth
action and is the only one that does not discharge — which is exactly why the placeholder rule
has to name the discharging set rather than say "not keep".

**Identifiers must resolve, twice.** An edit target needs ``shapeId``/``shapeIds`` or
``sourceElementId``/``sourceElementIds`` (otherwise ``unresolved-edit-target``), and every
resolved id must appear on the referenced source slide (otherwise ``unknown-shape-id``). A plan
that names a shape the template does not have is not a plan about that template.

**The inspect file is a precondition, not an input.** ``template-inspect/template-inspect.ndjson``
must exist and parse; when it does not, the report says to run ``inspect_template_deck.mjs`` first.
This is the ordering the skill enforces: inspect, then plan, then prepare.
"""

from __future__ import annotations

from typing import Final

SCRIPT_BYTES: Final = 19_353
SCRIPT_LINES: Final = 549

ACTIONS: Final = (
    "rewrite",
    "rewrite-and-reposition",
    "replace",
    "delete",
    "keep",
    "fill-placeholder",
)
ACTION_COUNT: Final = 6

PLACEHOLDER_HANDLING_ACTIONS: Final = (
    "rewrite",
    "rewrite-and-reposition",
    "replace",
    "delete",
    "fill-placeholder",
)
PLACEHOLDER_HANDLING_COUNT: Final = 5
KEEP_DOES_NOT_DISCHARGE: Final = True
ADD_DOES_NOT_DISCHARGE: Final = True

CONTENT_ROLES: Final = (
    "synthesis",
    "timeline",
    "proof",
    "summary",
    "map",
    "analysis",
    "evidence",
    "body",
    "content",
    "callout",
    "comparison",
    "metric",
    "chart",
    "table",
    "arc",
    "engine",
    "expansion",
    "technology",
    "standards",
    "portfolio",
    "purpose",
    "thesis",
)
CONTENT_ROLE_COUNT: Final = 22

PRESERVE_ONLY_ROLES: Final = (
    "brand",
    "logo",
    "bumper",
    "divider",
    "separator",
    "section",
    "chrome",
    "blank",
)
PRESERVE_ONLY_COUNT: Final = 8

PLACEHOLDER_PATTERNS: Final = (
    "slide number",
    "date",
    "footer",
    "click to add title|subtitle|text",
    "title|subtitle|name|text|body goes here",
    "lorem ipsum",
    "template instruction",
)
PLACEHOLDER_PATTERN_COUNT: Final = 7

ISSUE_CODES: Final = (
    "missing-template-inspect",
    "invalid-template-inspect",
    "missing-output-slides",
    "nonsequential-output-slide",
    "invalid-source-slide",
    "invalid-reuse-mode",
    "missing-narrative-role",
    "missing-edit-targets",
    "preserve-only-content-role",
    "unresolved-add-target",
    "unsupported-edit-action",
    "unresolved-edit-target",
    "unknown-shape-id",
    "add-only-content-slide",
    "add-on-preserve-only-slide",
    "unresolved-template-placeholder",
    "unhandled-placeholder",
)
ISSUE_COUNT: Final = 17

REQUIRED_REUSE_MODE: Final = "duplicate-slide"
IN_PLACE_REUSE_REJECTED: Final = True
OUTPUT_SLIDES_MUST_START_AT_ONE: Final = True
OUTPUT_SLIDES_MUST_BE_CONSECUTIVE: Final = True

ADD_REQUIRES_FIELDS: Final = (
    "newPrimitiveAllowed",
    "zone",
    "reason",
    "mustNotOverlapInherited",
)
ADD_REQUIRED_FIELD_COUNT: Final = 4
ADD_IS_REJECTED_BY_DEFAULT: Final = True

SHAPE_ID_KEYS: Final = ("shapeId", "shapeIds")
SOURCE_ELEMENT_KEYS: Final = ("sourceElementId", "sourceElementIds")

INSPECT_RELATIVE: Final = "template-inspect/template-inspect.ndjson"
INSPECT_IS_A_PRECONDITION: Final = True
REPORT_JSON: Final = "qa/template-plan-check.json"
REPORT_TEXT: Final = "qa/template-plan-check.txt"

STATUSES: Final = ("fail", "warning", "pass")
FAIL_DOMINATES: Final = True


def is_content_role(role: str) -> bool:
    return role.lower() in CONTENT_ROLES


def is_preserve_only_role(role: str) -> bool:
    return role.lower() in PRESERVE_ONLY_ROLES


def discharges_placeholder(action: str) -> bool:
    return action in PLACEHOLDER_HANDLING_ACTIONS


def add_target_is_complete(target: dict[str, object]) -> bool:
    return all(target.get(key) is not None for key in ADD_REQUIRES_FIELDS)


def reveal_preserve_only_content(role: str, edit_targets: int) -> str | None:
    """An empty target list on a content role is a slide nobody wrote."""
    if edit_targets != 0:
        return None
    if is_content_role(role) and not is_preserve_only_role(role):
        return "preserve-only-content-role"
    return None


def reveal_add_direction(role: str, add_targets: int, inherited_targets: int) -> str | None:
    """The two-sided ban: content slides may not only add, brand slides may not add at all."""
    if add_targets == 0 or inherited_targets != 0:
        return None
    if is_preserve_only_role(role):
        return "add-on-preserve-only-slide"
    if is_content_role(role):
        return "add-only-content-slide"
    return None


def coverage() -> dict[str, int]:
    return {
        "actions": ACTION_COUNT,
        "placeholder_handling_actions": PLACEHOLDER_HANDLING_COUNT,
        "content_roles": CONTENT_ROLE_COUNT,
        "preserve_only_roles": PRESERVE_ONLY_COUNT,
        "placeholder_patterns": PLACEHOLDER_PATTERN_COUNT,
        "issue_codes": ISSUE_COUNT,
    }


def validate_contract() -> None:
    if len(ACTIONS) != ACTION_COUNT or ACTION_COUNT != 6:
        raise ValueError("six legal actions")
    if len(PLACEHOLDER_HANDLING_ACTIONS) != PLACEHOLDER_HANDLING_COUNT:
        raise ValueError("five actions discharge a placeholder")
    if "keep" in PLACEHOLDER_HANDLING_ACTIONS:
        raise ValueError("keep must not discharge a placeholder")
    if set(ACTIONS) - set(PLACEHOLDER_HANDLING_ACTIONS) != {"keep"}:
        raise ValueError("keep is the single non-discharging action")
    if len(CONTENT_ROLES) != CONTENT_ROLE_COUNT or CONTENT_ROLE_COUNT != 22:
        raise ValueError("twenty-two content roles")
    if len(PRESERVE_ONLY_ROLES) != PRESERVE_ONLY_COUNT or PRESERVE_ONLY_COUNT != 8:
        raise ValueError("eight preserve-only roles")
    if set(CONTENT_ROLES) & set(PRESERVE_ONLY_ROLES):
        raise ValueError("the two role tables must not overlap")
    if "blank" not in PRESERVE_ONLY_ROLES:
        raise ValueError("blank is preserve-only")
    if "chart" not in CONTENT_ROLES or "table" not in CONTENT_ROLES:
        raise ValueError("charts and tables are content, not chrome")
    if len(PLACEHOLDER_PATTERNS) != PLACEHOLDER_PATTERN_COUNT or PLACEHOLDER_PATTERN_COUNT != 7:
        raise ValueError("seven placeholder patterns")
    if len(ISSUE_CODES) != ISSUE_COUNT or ISSUE_COUNT != 17:
        raise ValueError("seventeen issue codes")
    if len(set(ISSUE_CODES)) != ISSUE_COUNT:
        raise ValueError("issue codes must be unique")
    if REQUIRED_REUSE_MODE != "duplicate-slide":
        raise ValueError("the only reuse mode is duplicate-slide")
    if not IN_PLACE_REUSE_REJECTED:
        raise ValueError("in-place edits are rejected")
    if not OUTPUT_SLIDES_MUST_BE_CONSECUTIVE:
        raise ValueError("output slides must be consecutive")
    if len(ADD_REQUIRES_FIELDS) != ADD_REQUIRED_FIELD_COUNT or ADD_REQUIRED_FIELD_COUNT != 4:
        raise ValueError("add requires four supporting fields")
    if not ADD_IS_REJECTED_BY_DEFAULT:
        raise ValueError("add is rejected by default")
    if INSPECT_RELATIVE != "template-inspect/template-inspect.ndjson":
        raise ValueError("the inspect path drifted")
    if not INSPECT_IS_A_PRECONDITION:
        raise ValueError("inspect is a precondition")
    if STATUSES != ("fail", "warning", "pass") or not FAIL_DOMINATES:
        raise ValueError("fail dominates")
    # Sample the two reveal helpers so a drifted table cannot pass silently.
    if reveal_preserve_only_content("synthesis", 0) != "preserve-only-content-role":
        raise ValueError("a content role with no targets is rejected")
    if reveal_preserve_only_content("brand", 0) is not None:
        raise ValueError("a preserve-only role with no targets is legal")
    if reveal_add_direction("brand", 1, 0) != "add-on-preserve-only-slide":
        raise ValueError("a brand slide may not add")
    if reveal_add_direction("synthesis", 1, 0) != "add-only-content-slide":
        raise ValueError("a content slide may not only add")
    if reveal_add_direction("synthesis", 1, 1) is not None:
        raise ValueError("mapping to inherited elements is legal")
    if discharges_placeholder("keep"):
        raise ValueError("keep does not discharge")
    if not discharges_placeholder("fill-placeholder"):
        raise ValueError("fill-placeholder discharges")
    if not add_target_is_complete(dict.fromkeys(ADD_REQUIRES_FIELDS, True)):
        raise ValueError("a complete add target must pass")
    if add_target_is_complete({"zone": "x"}):
        raise ValueError("an incomplete add target must fail")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
