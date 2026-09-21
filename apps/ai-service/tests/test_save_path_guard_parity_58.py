# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""save_path 落盘后缀白名单的权威源一致性守卫(2026-09-21 立)。

## 为什么要有这个测试

本仓存在多处 save_path / 路径白名单校验实现:

1. `app/services/file_editor.py::validate_path`
2. `app/services/image_saver.py::validate_save_path`
3. `app/services/mcp_server.py::_validate_path_in_workspace`
4. `app/services/mcp_server.py::_validate_image_save_path`(2 层的图片特化)

排查中发现:实现 2 原先**只做白名单根 + 禁止目录两重校验,缺少后缀防线**,
而线上在用的实现 4 额外要求 save_path 必须落在图片后缀白名单内。
若日后有人按"消除重复实现"的动机把实现 2 换进线上路径,会**静默削掉这道防线**。

本测试把"两处后缀白名单必须一致"变成可执行断言,使该类漂移在 CI 即被拦下,
而不是等到某次重构之后才由安全审计发现。
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import image_saver as isv  # noqa: E402
from app.services import mcp_server as ms  # noqa: E402


def test_save_path_extension_sets_are_identical():
    """核心守卫:两处 save_path 后缀白名单必须逐元素相同(含顺序无关)。"""
    assert set(isv._SAVE_PATH_EXTENSIONS) == set(ms._IMAGE_EXTENSIONS), (
        "image_saver._SAVE_PATH_EXTENSIONS 与 mcp_server._IMAGE_EXTENSIONS 已漂移;"
        "以 mcp_server 为唯一权威源对齐,勿只改一处"
    )


def test_all_extensions_lowercase_and_dotted():
    """常量形式约束:必须是小写、带点的后缀,否则 startswith/suffix 比对会失效。"""
    for ext in isv._SAVE_PATH_EXTENSIONS:
        assert ext.startswith("."), f"{ext} 缺少前导点"
        assert ext == ext.lower(), f"{ext} 必须小写"


def test_input_format_set_is_a_different_axis():
    """输入格式集合与落盘后缀集合是两条轴,不得混用(前者含 gif/bmp/svg)。"""
    assert not set(isv._ALLOWED_FORMATS) == set(isv._SAVE_PATH_EXTENSIONS)
    # 输入允许 gif/bmp/svg,但落盘后缀不接受这三者
    assert {"gif", "bmp", "svg"} <= set(isv._ALLOWED_FORMATS)
    assert not ({"gif", "bmp", "svg"} & {e.lstrip(".") for e in isv._SAVE_PATH_EXTENSIONS})


class TestModuleValidatorIsAtLeastAsStrictAsLive:
    """模块版校验器不得比线上版宽松(防"去重"时降级安全强度)。"""

    @pytest.mark.parametrize("bad", ["a.txt", "payload.exe", "noext", "x.png.exe"])
    def test_rejects_non_image_suffix(self, tmp_path, monkeypatch, bad):
        monkeypatch.setattr(isv, "_ALLOWED_ROOTS", [tmp_path])
        ok, reason = isv.validate_save_path(str(tmp_path / bad))
        assert not ok
        assert "后缀" in reason

    @pytest.mark.parametrize("good", ["a.png", "b.jpg", "c.jpeg", "d.webp"])
    def test_accepts_image_suffix(self, tmp_path, monkeypatch, good):
        monkeypatch.setattr(isv, "_ALLOWED_ROOTS", [tmp_path])
        ok, resolved = isv.validate_save_path(str(tmp_path / good))
        assert ok
        assert resolved.endswith(good)

    def test_forbidden_dir_reason_takes_priority(self, tmp_path, monkeypatch):
        """禁止目录的判定必须早于后缀判定,否则既有 reason 语义被改坏。"""
        monkeypatch.setattr(isv, "_ALLOWED_ROOTS", [tmp_path])
        (tmp_path / "node_modules").mkdir()
        ok, reason = isv.validate_save_path(str(tmp_path / "node_modules" / "x"))
        assert not ok
        assert "禁止" in reason

    def test_live_validator_rejects_same_bad_suffix(self):
        """线上校验器对同一批坏后缀同样拒绝(行为面抽样对齐)。"""
        for bad in ("a.txt", "payload.exe"):
            ok, _info, code = ms._validate_image_save_path(bad)
            assert not ok
            assert code == "INVALID_EXTENSION"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
