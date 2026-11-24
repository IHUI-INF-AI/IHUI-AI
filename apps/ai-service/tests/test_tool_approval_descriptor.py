# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

r"""批次 2(2026-11-06 立)结构化审批描述器回归。

钉住五件事(每格对应一种"弹窗字段看似丰富、实际不可决策"的失效):
 A 封闭集镜像:REASON_CODES/OPERATION_SCOPES/RISK_LEVELS 与 TS 权威逐值同集;
 B 作用域归类:执行/读写/删除/网络/库/其它各自落到唯一 scope,不并桶;
 C 事实只从入参取:cwd 缺席就是 None(不反推),argv 只在命令类工具上从字符串拆;
 D 有界:argv ≤64、路径 ≤20 条且每条 ≤260 字符、摘要 ≤120 字符;
 E 风险档单一出口:调用方传入的合法档优先;非法档回落到工具类推导。

纯函数纪律:本文件不发网络、不读盘,只断言返回值。
"""

from __future__ import annotations

import pytest

from app.services import tool_approval_descriptor as desc


def test_a_closed_sets_mirror_ts() -> None:
    """A 三个封闭集逐值固定(TS 侧 packages/shared/src/sse/contract.ts 为权威镜像)。"""
    assert desc.REASON_CODES == (
        "dangerous_command",
        "destructive_operation",
        "writes_files",
        "deletes_files",
        "executes_command",
        "network_access",
        "database_write",
        "high_risk_tool",
        "requires_confirmation",
    )
    assert desc.OPERATION_SCOPES == (
        "fs_read",
        "fs_write",
        "fs_delete",
        "exec",
        "network",
        "db",
        "other",
    )
    assert desc.RISK_LEVELS == ("low", "medium", "high")


def test_b_exec_command_scope_reason_and_argv() -> None:
    """B 执行类:scope=exec、reason=executes_command、argv 规范化、风险 high。"""
    info = desc.describe_tool_request(
        "run_command", {"command": "git status", "cwd": "/repo"}
    )
    assert info["scope"] == "exec"
    assert info["reason_code"] == "executes_command"
    assert info["argv"] == ["git", "status"]
    assert info["cwd"] == "/repo"
    assert info["risk_level"] == "high"
    assert "执行命令:git status" in info["summary"]


def test_b2_destructive_command_wins_reason() -> None:
    """B2 破坏性命令:reason=destructive_operation(高于一般执行档)。"""
    info = desc.describe_tool_request("run_command", {"command": "rm -rf /tmp/x"})
    assert info["reason_code"] == "destructive_operation"
    assert info["risk_level"] == "high"


@pytest.mark.parametrize(
    ("tool", "args", "scope", "reason", "risk"),
    [
        ("write_file", {"path": "src/a.ts"}, "fs_write", "writes_files", "medium"),
        ("delete_file", {"path": "src/a.ts"}, "fs_delete", "deletes_files", "high"),
        ("read_file", {"path": "src/a.ts"}, "fs_read", "requires_confirmation", "medium"),
        ("fetch_url", {"url": "https://x.test/a"}, "network", "network_access", "medium"),
        ("db_query", {"sql": "update t set v=1"}, "db", "database_write", "high"),
        ("computer_click", {"x": 10}, "other", "high_risk_tool", "high"),
        ("mystery_tool", {"q": "hi"}, "other", "requires_confirmation", "medium"),
    ],
)
def test_b3_scope_mapping(
    tool: str, args: dict[str, object], scope: str, reason: str, risk: str
) -> None:
    """B3 七类工具的作用域/原因/风险逐档对齐,不把文件面并进执行面。"""
    info = desc.describe_tool_request(tool, args)
    assert info["scope"] == scope
    assert info["reason_code"] == reason
    assert info["risk_level"] == risk


def test_c_missing_cwd_is_none_not_invented() -> None:
    """C cwd 只认入参声明/结果回报之外的参数;没有就是 None(前端显示未上报)。"""
    info = desc.describe_tool_request("run_command", {"command": "ls"})
    assert info["cwd"] is None


def test_c2_string_command_only_for_exec_tools() -> None:
    """C2 非执行类工具里的 command 字符串不误标为 argv(避免把正文当命令)。"""
    info = desc.describe_tool_request("write_file", {"path": "a.txt", "command": "hello"})
    assert info["argv"] is None


def test_c3_paths_collected_dedup_and_typed() -> None:
    """C3 受影响路径:多键合并、去重、非字符串丢弃。"""
    info = desc.describe_tool_request(
        "write_file",
        {"path": "a.txt", "files": ["b.txt", 1, "a.txt"], "paths": ["c.txt"]},
    )
    assert info["affected_paths"] == ["a.txt", "b.txt", "c.txt"]


def test_d_bounds_are_enforced() -> None:
    """D 有界:argv 64 项、路径 20 条×260 字符、摘要 120 字符。"""
    argv = desc.describe_tool_request(
        "run_command", {"argv": [f"a{i}" for i in range(100)]}
    )["argv"]
    assert argv is not None and len(argv) == 64

    paths = desc.describe_tool_request(
        "write_file", {"files": [f"p{i}.txt" for i in range(40)]}
    )["affected_paths"]
    assert len(paths) == 20

    long_path = "p/" + "x" * 400
    one = desc.describe_tool_request("write_file", {"path": long_path})["affected_paths"]
    assert len(one[0]) == 260, "截断到 260(含省略号),不整串透传"

    long_command = desc.describe_tool_request(
        "run_command", {"command": "echo " + "y" * 300}
    )["summary"]
    assert len(long_command) == 120
    assert long_command.endswith("…")


def test_e_caller_risk_level_wins_and_invalid_falls_back() -> None:
    """E 风险档单一出口:调用方合法档优先,非法档不让整块退化成 unknown。"""
    assert desc.describe_tool_request("write_file", {}, risk_level="low")["risk_level"] == "low"
    assert desc.describe_tool_request("write_file", {}, risk_level="low")["scope"] == "fs_write"
    assert desc.describe_tool_request("write_file", {}, risk_level="bogus")["risk_level"] == "medium"
    assert desc.describe_tool_request("run_command", {}, risk_level="bogus")["risk_level"] == "high"


def test_f_description_is_pure_and_stable() -> None:
    """F 纯函数:同输入两次调用逐字段同值(不依赖时钟/进程/随机)。"""
    args = {"command": "git status", "cwd": "/repo"}
    first = desc.describe_tool_request("run_command", args)
    second = desc.describe_tool_request("run_command", args)
    assert first == second


def test_g_non_dict_args_do_not_crash() -> None:
    """G 入参不是 dict(老调用面/异常帧)⇒ 全字段可渲染,不抛异常。"""
    info = desc.describe_tool_request("run_command", None)
    assert info["scope"] == "exec"
    assert info["argv"] is None
    assert info["cwd"] is None
    assert info["affected_paths"] == []
    assert info["summary"].startswith("执行命令")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
