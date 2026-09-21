# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具入参危险模式扫描(tool_input_scanner.py)单元测试(2026-09-03 立)。

覆盖:
- command_injection:命令分隔符 / 命令替换命中
- path_traversal:.. 路径分段(含 Windows ..\\)
- ssrf_loopback:URL 指向回环 / 本地 / 云元数据地址
- arg_too_long:超长入参命中
- 正常放行:合法入参不误报(零回归)
- flags 子集:关闭某类别后不再命中对应模式
- 嵌套 dict/list 递归扫描(含字段路径标注)
- first_finding_kind 辅助
"""

from __future__ import annotations

from app.services.tool_input_scanner import (
    DEFAULT_MAX_ARG_LEN,
    first_finding_kind,
    scan_tool_args,
)


def _kinds(result):
    return {f.kind for f in result.findings}


# =============================================================================
# command_injection
# =============================================================================


def test_command_injection_semicolon():
    res = scan_tool_args({"command": "cat /etc/passwd; whoami"}, tool_name="run_command")
    assert res.dangerous is True
    assert "command_injection" in _kinds(res)
    f = res.findings[0]
    assert f.field == "command"


def test_command_injection_command_substitution():
    """命令替换 $() 与反引号命中。"""
    for evil in ("ls $(rm -rf /)", "echo `cat /etc/shadow`", "a && b", "a || b"):
        res = scan_tool_args({"cmd": evil})
        assert "command_injection" in _kinds(res), evil


# =============================================================================
# path_traversal
# =============================================================================


def test_path_traversal_posix():
    res = scan_tool_args({"path": "../../etc/passwd"})
    assert "path_traversal" in _kinds(res)


def test_path_traversal_windows():
    """Windows 分隔符 ..\\ 同样命中。"""
    res = scan_tool_args({"path": "..\\..\\windows\\.bashrc"})
    assert "path_traversal" in _kinds(res)


# =============================================================================
# ssrf_loopback
# =============================================================================


def test_ssrf_loopback_localhost():
    res = scan_tool_args({"url": "http://127.0.0.1:6379/"})
    assert "ssrf_loopback" in _kinds(res)


def test_ssrf_loopback_localhost_hostname():
    res = scan_tool_args({"url": "https://localhost:8080/admin"})
    assert "ssrf_loopback" in _kinds(res)


def test_ssrf_loopback_cloud_metadata():
    """云元数据链路本地地址命中(169.254.169.254 SSRF 经典靶点)。"""
    res = scan_tool_args({"url": "http://169.254.169.254/latest/meta-data/iam/"})
    assert "ssrf_loopback" in _kinds(res)
    assert "169.254.169.254" in res.findings[0].detail


# =============================================================================
# arg_too_long
# =============================================================================


def test_arg_too_long():
    res = scan_tool_args({"query": "x" * (DEFAULT_MAX_ARG_LEN + 1)})
    assert "arg_too_long" in _kinds(res)


def test_arg_not_too_long_boundary():
    """恰好等于上限 → 不命中。"""
    res = scan_tool_args({"query": "x" * DEFAULT_MAX_ARG_LEN})
    assert "arg_too_long" not in _kinds(res)


# =============================================================================
# 正常放行(零回归)
# =============================================================================


def test_benign_args_allowed():
    """合法入参不误报。"""
    res = scan_tool_args(
        {
            "query": "refactor login page",
            "path": "/home/user/src/app.py",
            "code": "def hello():\n    return 'world'",
            "max_results": 5,
        }
    )
    assert res.dangerous is False
    assert res.findings == []


# =============================================================================
# flags 子集
# =============================================================================


def test_flags_subset_disable_category():
    """只开 path_traversal:命令注入不再命中(其余类别关)。"""
    res = scan_tool_args({"cmd": "cat /etc/passwd; whoami"}, flags=["path_traversal"])
    assert res.dangerous is False


def test_flags_multi_category():
    """同时开command+path:两者命中。"""
    args = {"path": "../../etc/passwd", "cmd": "ls; pwd"}
    res = scan_tool_args(args, flags=["command_injection", "path_traversal"])
    assert _kinds(res) == {"command_injection", "path_traversal"}


# =============================================================================
# 嵌套递归 + 字段路径
# =============================================================================


def test_nested_dict_and_list_scanned_with_field_path():
    args = {"outer": {"inner": {"cmd": "ls; pwd"}}, "arr": ["safe", {"url": "http://0.0.0.0/admin"}]}
    res = scan_tool_args(args)
    field_kinds = {f.field: f.kind for f in res.findings}
    assert field_kinds.get("outer.inner.cmd") == "command_injection"
    assert field_kinds.get("arr[1].url") == "ssrf_loopback"


# =============================================================================
# first_finding_kind
# =============================================================================


def test_first_finding_kind_helper():
    res = scan_tool_args({"path": "../../etc/passwd"})
    assert first_finding_kind(res) == "path_traversal"
    assert first_finding_kind(scan_tool_args({"q": "hello"})) is None


# =============================================================================
# 非 URL 字符串不触发 ssrf
# =============================================================================


def test_plain_string_not_ssrf():
    """未带协议头的裸地址不作为 SSRF(避免误报路径/文本)。"""
    res = scan_tool_args({"host": "127.0.0.1"})
    assert "ssrf_loopback" not in _kinds(res)
