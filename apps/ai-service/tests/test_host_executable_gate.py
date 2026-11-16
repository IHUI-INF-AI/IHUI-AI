# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core host_executable 声明校验 gate — 本轮（对标 Codex 26.1111 execpolicy）
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

from app.core.host_executable_gate import (
    CODEX_ERR_NAME_EMPTY,
    CODEX_ERR_NAME_NOT_BARE,
    CODEX_ERR_PATHS_NOT_ABSOLUTE,
    CODEX_ERR_PATHS_NOT_STRINGS,
    HostExecutableVerdict,
    validate_host_executable,
)

# ---------------------------------------------------------------------------
# name 四类判据（空 / bare / 类型）
# ---------------------------------------------------------------------------


def test_name_empty():
    o = validate_host_executable("   ", ["/usr/bin/python"])
    assert o.state is HostExecutableVerdict.REJECTED
    assert o.codex_error == CODEX_ERR_NAME_EMPTY


@pytest.mark.parametrize("bad", ["dir/python", "C:/x/python", "/usr/bin/python", "a\\b"])
def test_name_not_bare(bad):
    o = validate_host_executable(bad, ["/usr/bin/python"])
    assert o.state is HostExecutableVerdict.REJECTED
    assert o.codex_error == f"{CODEX_ERR_NAME_NOT_BARE} (got {bad!r})"


def test_name_non_string_undetermined():
    o = validate_host_executable(123, ["/usr/bin/python"])
    assert o.state is HostExecutableVerdict.UNDETERMINED
    assert o.codex_error is None


# ---------------------------------------------------------------------------
# paths 四类判据（类型 / 元素类型 / 绝对）
# ---------------------------------------------------------------------------


def test_paths_not_list_rejected():
    o = validate_host_executable("python", "/usr/bin/python")
    assert o.state is HostExecutableVerdict.REJECTED
    assert o.codex_error == f"{CODEX_ERR_PATHS_NOT_STRINGS} (got str)"


def test_paths_element_not_string_rejected():
    o = validate_host_executable("python", ["/usr/bin/python", 42])
    assert o.state is HostExecutableVerdict.REJECTED
    assert o.codex_error == f"{CODEX_ERR_PATHS_NOT_STRINGS} (got int at index 1)"


def test_paths_empty_list_accepted():
    """空 paths 列表：无相对路径即无判据触发 ⇒ ACCEPTED（声明无候选但形状合法）。"""
    o = validate_host_executable("python", [])
    assert o.state is HostExecutableVerdict.ACCEPTED


@pytest.mark.parametrize(
    "rel", ["relative/python", "python", "./python", "../python", "C:relative"]
)
def test_paths_relative_rejected(rel):
    o = validate_host_executable("python", ["/usr/bin/python", rel])
    assert o.state is HostExecutableVerdict.REJECTED
    assert o.codex_error == f"{CODEX_ERR_PATHS_NOT_ABSOLUTE} (got {rel!r})"


# ---------------------------------------------------------------------------
# 合法声明（跨平台绝对路径）
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "path",
    [
        "/usr/bin/python",
        "C:/Python/python.exe",
        "C:\\Python\\python.exe",
        "\\\\server\\share\\python.exe",  # UNC
    ],
)
def test_valid_absolute_paths(path):
    o = validate_host_executable("python", [path])
    assert o.state is HostExecutableVerdict.ACCEPTED, f"{path!r} 被误拒: {o.codex_error!r}"


def test_valid_declaration_full():
    o = validate_host_executable("python", ["/usr/bin/python3", "/usr/local/bin/python"])
    assert o.state is HostExecutableVerdict.ACCEPTED
    assert "python" in (o.detail or "")


# ---------------------------------------------------------------------------
# 判据顺序（name 先于 paths，空 name 优先报空而非 paths 错）
# ---------------------------------------------------------------------------


def test_name_empty_takes_precedence_over_paths():
    o = validate_host_executable("  ", "not-a-list")
    assert o.codex_error == CODEX_ERR_NAME_EMPTY


def test_name_not_bare_takes_precedence_over_paths():
    o = validate_host_executable("a/b", "not-a-list")
    assert o.codex_error == f"{CODEX_ERR_NAME_NOT_BARE} (got 'a/b')"
