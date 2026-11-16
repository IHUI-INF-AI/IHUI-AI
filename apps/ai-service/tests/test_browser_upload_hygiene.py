# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""browser_upload_hygiene 单测 — 钉住 file chooser 流的 5 个卫生判据。"""

from __future__ import annotations

import pytest

from app.services.browser_upload_hygiene import (
    choose_upload_api,
    plan_upload_fallback,
    prearm_file_chooser,
    select_upload_control,
    validate_upload_files,
)

# ── prearm_file_chooser ────────────────────────────────────────────────────


class TestPrearmChooser:
    def test_armed(self):
        d = prearm_file_chooser(event_armed_before_click=True)
        assert d.state == "prearmed"
        assert d.allowed_to_click is True

    def test_not_armed(self):
        d = prearm_file_chooser(event_armed_before_click=False)
        assert d.state == "not_prearmed"
        assert d.allowed_to_click is False
        assert "先挂事件" in d.detail


# ── select_upload_control ──────────────────────────────────────────────────


class TestUploadControl:
    def test_input_file_preferred(self):
        d = select_upload_control(
            has_input_file=True, visible_control_opens_chooser=True
        )
        assert d.control == "input_file"
        assert d.should_click is True

    def test_visible_opens_chooser(self):
        d = select_upload_control(
            has_input_file=False, visible_control_opens_chooser=True
        )
        assert d.control == "visible_opens_chooser"
        assert d.should_click is True

    def test_not_trigger_blocked(self):
        d = select_upload_control(
            has_input_file=False, visible_control_opens_chooser=False
        )
        assert d.control == "not_upload_trigger"
        assert d.should_click is False


# ── validate_upload_files ──────────────────────────────────────────────────


class TestValidateUploadFiles:
    def test_single_absolute_ok(self):
        d = validate_upload_files(["/workspace/scratch/a.txt"], is_multiple=False)
        assert d.status == "ok"
        assert d.valid_paths == ("/workspace/scratch/a.txt",)

    def test_windows_absolute_ok(self):
        d = validate_upload_files(["G:/IHUI-AI/a.txt"], is_multiple=False)
        assert d.status == "ok"

    def test_relative_rejected(self):
        d = validate_upload_files(["relative/path/a.txt"], is_multiple=False)
        assert d.status == "not_absolute"
        assert d.valid_paths == ()

    def test_empty_rejected(self):
        d = validate_upload_files([], is_multiple=True)
        assert d.status == "empty"
        assert "为空" in d.error_detail

    def test_multi_without_ismultiple_rejected(self):
        d = validate_upload_files(
            ["/a.txt", "/b.txt"], is_multiple=False
        )
        assert d.status == "too_many_without_multi"

    def test_multi_with_ismultiple_ok(self):
        d = validate_upload_files(["/a.txt", "/b.txt"], is_multiple=True)
        assert d.status == "ok"
        assert len(d.valid_paths) == 2


# ── choose_upload_api ──────────────────────────────────────────────────────


class TestUploadApi:
    def test_chooser_ok(self):
        d = choose_upload_api(use_locator_set_input_files=False)
        assert d.api == "chooser_set_files"
        assert d.allowed is True

    def test_locator_forbidden(self):
        d = choose_upload_api(use_locator_set_input_files=True)
        assert d.api == "locator_set_input_files"
        assert d.allowed is False
        assert "经 chooser 对象暴露" in d.detail


# ── plan_upload_fallback ───────────────────────────────────────────────────


class TestUploadFallback:
    def test_chooser_first(self):
        d = plan_upload_fallback(chooser_failed=False)
        assert d.path == "file_chooser"

    def test_native_after_failure(self):
        d = plan_upload_fallback(chooser_failed=True)
        assert d.path == "native_picker"
        assert "回退" in d.detail


if __name__ == "__main__":
    pytest.main([__file__, "-q"])
