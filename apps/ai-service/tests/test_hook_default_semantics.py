# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R91: A9 — hook default semantics."""

from __future__ import annotations

import pytest

from app.core.hook_contract_schema import HOOK_SCHEMA_FIELDS
from app.core.hook_default_semantics import (
    BOOL_DEFAULTS,
    DEFAULT_COUNT,
    DEFAULT_TITLES,
    DEFAULTS,
    NULL_DEFAULTS,
    NULL_ON_TYPED,
    UNTYPED_NULLS,
    DefaultSemanticsError,
    apply_defaults,
    default_summary,
    defaults_for,
    missing_defaults,
    validate_defaults,
)


def test_counts_are_narrow() -> None:
    assert DEFAULT_COUNT == 57
    assert BOOL_DEFAULTS == 20
    assert NULL_DEFAULTS == 37
    assert BOOL_DEFAULTS + NULL_DEFAULTS == DEFAULT_COUNT
    assert NULL_ON_TYPED + UNTYPED_NULLS == NULL_DEFAULTS
    validate_defaults()


def test_null_defaults_on_a_declared_type_are_counted_not_raised() -> None:
    # 26 schemas say `type: string` and `default: null` — legal JSON Schema, inconsistent intent
    assert NULL_ON_TYPED == 26
    assert UNTYPED_NULLS == 11


def test_no_complex_defaults_exist() -> None:
    for fields in DEFAULTS.values():
        for _f, (value, _t) in fields.items():
            assert value is None or isinstance(value, bool), "a complex default appeared"


def test_every_default_targets_a_declared_field() -> None:
    for title, fields in DEFAULTS.items():
        declared = HOOK_SCHEMA_FIELDS[title]
        for field in fields:
            assert field in declared, (title, field)


def test_apply_defaults_only_fills_absent_fields() -> None:
    title = "post-tool-use.command.output"
    payload = {"continue": False, "reason": "kept"}
    filled = apply_defaults(title, payload)
    assert filled["continue"] is False
    assert filled["reason"] == "kept"
    assert filled["suppressOutput"] is False
    assert filled["decision"] is None


def test_missing_defaults_names_what_would_be_filled() -> None:
    title = "post-tool-use.command.output"
    assert missing_defaults(title, {}) == tuple(sorted(DEFAULTS[title]))
    assert "continue" not in missing_defaults(title, {"continue": True})


def test_a_schema_without_defaults_is_untouched() -> None:
    title = "stop.command.input"
    assert defaults_for(title) == {} or len(defaults_for(title)) == 0
    assert apply_defaults(title, {"cwd": "/x"})["cwd"] == "/x"


def test_unknown_title_raises() -> None:
    with pytest.raises(DefaultSemanticsError, match="not a recovered schema"):
        defaults_for("bogus.command.output")


def test_summary_matches() -> None:
    s = default_summary()
    assert s["total"] == 57
    assert s["schemas"] == len(DEFAULT_TITLES)
    assert s["bool"] + s["null"] == s["total"]


def test_validator_rejects_a_type_mismatch(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import hook_default_semantics as mod
    bad = dict(DEFAULTS)
    bad["post-tool-use.command.output"] = {"continue": (True, '"string"')}
    monkeypatch.setattr(mod, "DEFAULTS", bad)
    with pytest.raises(DefaultSemanticsError, match="bool default, non-bool type"):
        mod.validate_defaults()


def test_validator_rejects_count_drift(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import hook_default_semantics as mod
    monkeypatch.setattr(mod, "BOOL_DEFAULTS", 19)
    with pytest.raises(DefaultSemanticsError, match="must equal the total"):
        mod.validate_defaults()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
