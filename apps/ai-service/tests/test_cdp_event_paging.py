# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""cdp_event_paging 单测 — 钉住 Codex CDP 事件游标分页纯逻辑行为。"""

from __future__ import annotations

import pytest

from app.services.cdp_event_paging import (
    CDP_EVENTS_LIMIT_MAX,
    CDP_EVENTS_LIMIT_MIN,
    CdpEventsRequest,
    CdpTarget,
    EventsPage,
    is_origin_scoped_url,
    is_permitted_cdp_command,
    next_page_request,
    same_target,
    target_key,
    validate_events_request,
)


class TestTarget:
    def test_session_target_key(self) -> None:
        assert target_key(CdpTarget(session_id="s1")) == "session:s1"

    def test_target_id_key(self) -> None:
        assert target_key(CdpTarget(target_id="t1")) == "target:t1"

    def test_default_key(self) -> None:
        assert target_key(CdpTarget()) == "default"

    def test_same_target(self) -> None:
        assert same_target(CdpTarget(session_id="s"), CdpTarget(session_id="s")) is True
        assert same_target(CdpTarget(session_id="s"), CdpTarget(target_id="s")) is False


class TestValidateEventsRequest:
    def test_valid_default(self) -> None:
        assert validate_events_request(CdpEventsRequest()) == []

    def test_limit_too_low(self) -> None:
        errs = validate_events_request(CdpEventsRequest(limit=0))
        assert any("limit" in e for e in errs)

    def test_limit_too_high(self) -> None:
        errs = validate_events_request(CdpEventsRequest(limit=CDP_EVENTS_LIMIT_MAX + 1))
        assert any("limit" in e for e in errs)

    def test_limit_bounds_ok(self) -> None:
        assert validate_events_request(CdpEventsRequest(limit=CDP_EVENTS_LIMIT_MIN)) == []
        assert validate_events_request(CdpEventsRequest(limit=CDP_EVENTS_LIMIT_MAX)) == []

    def test_negative_after_sequence(self) -> None:
        errs = validate_events_request(CdpEventsRequest(after_sequence=-1))
        assert any("afterSequence" in e for e in errs)


class TestNextPage:
    def test_has_more_advances(self) -> None:
        prev = CdpEventsRequest(limit=100, methods=("Network.*",))
        page = EventsPage(cursor=1, has_more=True, last_sequence=42)
        nxt = next_page_request(prev, page)
        assert nxt is not None
        assert nxt.after_sequence == 42
        # 翻页复用同一 filters
        assert nxt.limit == 100
        assert nxt.methods == ("Network.*",)

    def test_no_more_returns_none(self) -> None:
        prev = CdpEventsRequest()
        page = EventsPage(cursor=1, has_more=False, last_sequence=9)
        assert next_page_request(prev, page) is None

    def test_truncated_does_not_block_forward(self) -> None:
        # truncated 表示更老事件被驱逐, 不影响向前翻页
        prev = CdpEventsRequest()
        page = EventsPage(cursor=1, has_more=True, truncated=True, last_sequence=7)
        nxt = next_page_request(prev, page)
        assert nxt is not None
        assert nxt.after_sequence == 7

    def test_target_reused(self) -> None:
        tgt = CdpTarget(target_id="abc")
        prev = CdpEventsRequest(target=tgt)
        page = EventsPage(cursor=1, has_more=True, last_sequence=3)
        nxt = next_page_request(prev, page)
        assert nxt is not None
        assert same_target(nxt.target, tgt)


class TestOriginScope:
    def test_http_same_origin(self) -> None:
        assert is_origin_scoped_url("https://example.com/page", "https://example.com") is True

    def test_subpath_same_origin(self) -> None:
        assert is_origin_scoped_url("https://example.com/a/b", "https://example.com") is True

    def test_different_host(self) -> None:
        assert is_origin_scoped_url("https://evil.com/x", "https://example.com") is False

    def test_scheme_mismatch(self) -> None:
        assert is_origin_scoped_url("http://example.com", "https://example.com") is False

    def test_non_http_rejected(self) -> None:
        assert is_origin_scoped_url("file:///etc/passwd", "file://") is False
        assert is_origin_scoped_url("chrome-extension://abc/x", "chrome-extension://abc") is False

    def test_empty(self) -> None:
        assert is_origin_scoped_url("", "https://example.com") is False
        assert is_origin_scoped_url("https://example.com", "") is False


class TestPermittedCommands:
    @pytest.mark.parametrize(
        "cmd",
        ["Runtime.evaluate", "Page.navigate", "DOM.getDocument", "Network.enable"],
    )
    def test_permitted(self, cmd: str) -> None:
        assert is_permitted_cdp_command(cmd) is True

    def test_unknown_denied(self) -> None:
        # 默认拒绝: 未登记命令不放行
        assert is_permitted_cdp_command("Debugger.pause") is False
        assert is_permitted_cdp_command("") is False

    def test_case_sensitive(self) -> None:
        # CDP 命令大小写敏感
        assert is_permitted_cdp_command("runtime.evaluate") is False
