# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R63 pytest: hook_event_kind closed set. Watermark by build.py."""
from __future__ import annotations

import pytest

from app.core.hook_event_kind import (
    HOOK_EVENT_SHAPES,
    HookEventKind,
    HookEventKindError,
    ensure_hook_event,
    hook_event_names,
    hook_event_shapes,
    hook_events_with_output,
    is_hook_event,
    validate_hook_event,
)

ONLY_IN = 'session-end'
DUAL = 'post-tool-use'
class TestVerbatimFamilies:
    def test_shapes_exact(self) -> None:
        assert HOOK_EVENT_SHAPES == {
    "interrupt": {"input": True, "output": True},
    "permission-request": {"input": True, "output": True},
    "post-compact": {"input": True, "output": True},
    "post-tool-use": {"input": True, "output": True},
    "pre-compact": {"input": True, "output": True},
    "pre-tool-use": {"input": True, "output": True},
    "session-end": {"input": True, "output": False},
    "session-start": {"input": True, "output": True},
    "stop": {"input": True, "output": True},
    "subagent-start": {"input": True, "output": True},
    "subagent-stop": {"input": True, "output": True},
    "user-prompt-submit": {"input": True, "output": True},
}
    def test_enum_matches(self) -> None:
        assert {m.value for m in HookEventKind} == set(HOOK_EVENT_SHAPES)
        assert len(HookEventKind) == 12
    def test_names_copy(self) -> None:
        a = hook_event_names(); a.append("bogus"); assert "bogus" not in HOOK_EVENT_SHAPES
class TestShapeAccess:
    def test_shapes(self) -> None:
        assert hook_event_shapes(DUAL) == (True, True)
        assert hook_event_shapes(ONLY_IN) == (True, False)
    def test_with_output(self) -> None:
        wo = hook_events_with_output()
        assert isinstance(wo, tuple) and ONLY_IN not in wo and DUAL in wo
        assert len(wo) == 11
    def test_rejects_unregistered(self) -> None:
        for fn in (hook_event_shapes, ensure_hook_event):
            with pytest.raises(HookEventKindError): fn("bogus")
    def test_membership(self) -> None:
        assert is_hook_event(DUAL) and not is_hook_event("bogus")
class TestConsistencyGate:
    @pytest.mark.parametrize("name", sorted(HOOK_EVENT_SHAPES))
    def test_validate_ok(self, name: str) -> None:
        d = HOOK_EVENT_SHAPES[name]
        assert validate_hook_event(name, d["input"], d["output"]) == name
    def test_validate_rejects_wrong_shape(self) -> None:
        with pytest.raises(HookEventKindError, match="形态应为"):
            validate_hook_event(DUAL, False, False)
