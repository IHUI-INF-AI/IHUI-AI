# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""G-998139(票4,拍板:要)—— POSIX bootstrap PATH 兜底 + 显式候选解析的执行环境事实。

验收(票面验收草案,两条成对):
① 给定 ``PATH=""``(或仅 ``/usr/bin``)时,出口函数(create_env_from_vars)返回的
   PATH **必含** bootstrap 目录集合;
② 同一条件下解析 npx 必须返回「未找到 + 试过哪些候选」(resolved=None + 非空 tried),
   **不得**返回空字符串冒充已解析(对齐 §5d/守门 103:候选序解析器必须同时提供出处出口)。
   找不到时 mcp_client 侧必须大声喊(报错文案带候选列表),不得静默回落裸名 spawn。

拍板边界:**不做** login shell 快照采集 —— 本文件不出现任何 login shell 探测面。
全程不派生任何真实子进程;npx 解析用临时目录自造可执行文件,不依赖真机 PATH;
平台分支用 monkeypatch 钉住(POSIX 兜底与真机平台解耦,Windows 机上同样可验)。
"""

from __future__ import annotations

import logging
import os
import stat
import sys
from pathlib import Path

import pytest

from app.core import exec_env
from app.services import mcp_directory
from app.services.mcp_client import MCPClient, MCPClientConfig

# ---------------------------------------------------------------------------
# 验收 ①:出口 PATH 必含 bootstrap 目录集合
# ---------------------------------------------------------------------------


def test_exit_path_must_contain_bootstrap_dirs_when_path_empty(monkeypatch):
    """PATH 为空串 ⇒ 出口 PATH 必含全部 bootstrap 目录(整体兜底)。"""
    monkeypatch.setattr(sys, "platform", "linux")
    policy = exec_env.ShellEnvironmentPolicy()
    out = exec_env.create_env_from_vars([("PATH", ""), ("HOME", "/root")], policy)
    entries = out["PATH"].split(":")
    bootstrap = exec_env.bootstrap_path_dirs()
    assert bootstrap, "bootstrap 集合不得为空(POSIX 兜底是拍板交付)"
    for d in bootstrap:
        assert d in entries, f"出口 PATH 缺 bootstrap 目录 {d}: {out['PATH']!r}"


def test_exit_path_must_contain_bootstrap_dirs_when_path_partial(monkeypatch):
    """PATH 仅 /usr/bin ⇒ 出口 PATH 既保用户条目在前,又必含 bootstrap 全集(去重不重复)。"""
    monkeypatch.setattr(sys, "platform", "linux")
    out = exec_env.create_env_from_vars(
        [("PATH", "/usr/bin"), ("HOME", "/root")], exec_env.ShellEnvironmentPolicy()
    )
    entries = out["PATH"].split(":")
    for d in exec_env.bootstrap_path_dirs():
        assert d in entries, f"出口 PATH 缺 bootstrap 目录 {d}: {out['PATH']!r}"
    assert entries[0] == "/usr/bin", "继承条目必须保持在前(兜底追加语义,不得反超)"
    assert entries.count("/usr/bin") == 1, "共用一份去重:同一目录不得出现两次"


def test_exit_path_bootstrap_when_key_missing(monkeypatch):
    """PATH 键整体缺失 ⇒ 出口补 PATH = bootstrap 集合本身。"""
    monkeypatch.setattr(sys, "platform", "linux")
    out = exec_env.create_env_from_vars([("HOME", "/root")], exec_env.ShellEnvironmentPolicy())
    assert out["PATH"] == ":".join(exec_env.bootstrap_path_dirs())


def test_exit_path_darwin_extra_dir(monkeypatch):
    """darwin 档:bootstrap 集合另含 /opt/homebrew/bin。"""
    monkeypatch.setattr(sys, "platform", "darwin")
    out = exec_env.create_env_from_vars([("PATH", "")], exec_env.ShellEnvironmentPolicy())
    assert "/opt/homebrew/bin" in out["PATH"].split(":")
    monkeypatch.setattr(sys, "platform", "linux")
    out_linux = exec_env.create_env_from_vars([("PATH", "")], exec_env.ShellEnvironmentPolicy())
    assert "/opt/homebrew/bin" not in out_linux["PATH"].split(":")


def test_windows_exit_branch_untouched(monkeypatch):
    """回归:Windows 出口分支只补 PATHEXT,不动 PATH(POSIX 兜底不越平台)。"""
    monkeypatch.setattr(sys, "platform", "win32")
    out = exec_env.create_env_from_vars(
        [("PATH", r"C:\Windows\system32")], exec_env.ShellEnvironmentPolicy()
    )
    assert out["PATH"] == r"C:\Windows\system32"
    assert out["PATHEXT"] == exec_env._WINDOWS_PATHEXT_DEFAULT


# ---------------------------------------------------------------------------
# 验收 ②:解析 npx 必须"未找到 + 试过候选",不得空串冒充已解析
# ---------------------------------------------------------------------------


def _mk_executable(dir_path: Path, name: str) -> Path:
    p = dir_path / name
    p.write_text("", encoding="utf-8")
    p.chmod(p.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return p


def test_resolve_npx_not_found_returns_none_with_tried_candidates(tmp_path):
    """PATH 指向空目录 ⇒ resolved=None(绝不为空串)+ tried 非空且候选可溯源。"""
    out = exec_env.resolve_stdio_command("g998139-no-such-bin", {"PATH": str(tmp_path)})
    assert out.ok is False
    assert out.resolved is None
    assert out.resolved != ""  # 不得返回空字符串冒充已解析
    assert out.tried, "未找到必须同时给出试过哪些候选(出处出口)"
    # 传入 env 的 PATH 目录必须先试(win32 下还会按 PATHEXT 枚举扩展候选)
    assert os.path.join(str(tmp_path), "g998139-no-such-bin") in out.tried
    assert all(str(tmp_path) in c for c in out.tried if c.startswith(str(tmp_path)))


def test_resolve_npx_found_gives_provenance(tmp_path):
    """PATH 目录里有真入口 ⇒ 解析到它,且 tried 记录候选序(结果+出处成对)。"""
    if sys.platform == "win32":
        _mk_executable(tmp_path, "npx.cmd")
        env = {"PATH": str(tmp_path), "PATHEXT": ".COM;.EXE;.BAT;.CMD"}
    else:
        _mk_executable(tmp_path, "npx")
        env = {"PATH": str(tmp_path)}
    out = exec_env.resolve_stdio_command("npx", env)
    assert out.ok is True and out.resolved is not None
    assert os.path.dirname(out.resolved) == str(tmp_path)
    assert out.tried, "命中也必须带候选序(出处出口)"


def test_resolve_non_executable_file_is_not_resolved(tmp_path):
    """X_OK 判据的另一半:存在但**不可执行**的文件不得算解析到(POSIX x 位语义)。

    Windows 没有 POSIX x 位(常规文件 X_OK 恒真,与 accessSync 在 Windows 的
    语义一致),不可执行档只在 POSIX 分支可验 ⇒ win32 显式跳过,不装作已验证。
    """
    if sys.platform == "win32":
        pytest.skip("Windows 无 POSIX x 位语义:常规文件 X_OK 恒真(对齐 accessSync)")
    plain = tmp_path / "plain-bin"
    plain.write_text("", encoding="utf-8")
    plain.chmod(0o644)
    assert exec_env._is_executable_file(str(plain)) is False
    out = exec_env.resolve_stdio_command("plain-bin", {"PATH": str(tmp_path)})
    assert out.resolved is None and out.resolved != ""
    assert str(plain) in out.tried, "不可执行候选也要进 tried(出处出口完整)"


def test_resolve_explicit_path_branch(tmp_path):
    """显式路径:存在且可执行 ⇒ 解析为自身;不存在 ⇒ None + 候选=自身(不猜相对基准)。"""
    real = _mk_executable(tmp_path, "real-bin")
    out = exec_env.resolve_stdio_command(str(real), {"PATH": ""})
    assert out.resolved == str(real)
    missing = str(tmp_path / "no-such")
    out2 = exec_env.resolve_stdio_command(missing, {"PATH": ""})
    assert out2.resolved is None and out2.resolved != ""
    assert out2.tried == (missing,)


def test_resolve_empty_command_never_masquerades():
    """空命令名 ⇒ 未解析(None),绝不返回空串。"""
    out = exec_env.resolve_stdio_command("", {"PATH": ""})
    assert out.resolved is None and out.resolved != ""


# ---------------------------------------------------------------------------
# 大声喊:mcp_client 侧解析不到必须带候选列表报错,不得静默回落裸名 spawn
# ---------------------------------------------------------------------------


async def test_stdio_connect_shouts_loudly_with_tried_candidates(tmp_path, caplog):
    """解析不到 ⇒ 返回 False + error 日志里出现"试过候选"完整列表(大声喊)。"""
    caplog.set_level(logging.ERROR, logger="app.services.mcp_client")
    config = MCPClientConfig(
        name="loud-fail",
        transport="stdio",
        command="g998139-no-such-bin",
        args=["-y", "@modelcontextprotocol/server-nothing"],
        env={"PATH": str(tmp_path)},
    )
    client = MCPClient(config)
    assert await client._stdio_connect() is False
    assert client._connected is False
    joined = "\n".join(r.getMessage() for r in caplog.records)
    assert "g998139-no-such-bin" in joined
    assert "试过候选" in joined
    assert str(tmp_path) in joined, "报错必须列出试过的候选路径(可定位 PATH 配错)"


# ---------------------------------------------------------------------------
# 目录注册面(G-998139 交付 2):to_client_config 对裸 npx 走显式候选序解析
# ---------------------------------------------------------------------------


def test_directory_register_resolves_npx_to_absolute_path(tmp_path):
    """目录一键注册:找到 npx ⇒ command 为绝对路径(带出处),不得仍是裸名。"""
    if sys.platform == "win32":
        _mk_executable(tmp_path, "npx.cmd")
        env = {"PATH": str(tmp_path), "PATHEXT": ".COM;.EXE;.BAT;.CMD"}
    else:
        _mk_executable(tmp_path, "npx")
        env = {"PATH": str(tmp_path)}
    cfg = mcp_directory.to_client_config("filesystem", workspace_path="/ws", env=env)
    assert cfg is not None
    assert cfg["command"] != "npx", "裸名不得冒充已解析"
    assert os.path.isabs(cfg["command"])
    assert os.path.dirname(cfg["command"]) == str(tmp_path)


def test_directory_register_shouts_loudly_when_npx_missing(tmp_path, monkeypatch):
    """目录一键注册:全找不到 ⇒ 抛错并列出试过候选,不回落裸名。

    bootstrap 集钉空 + PATH 指向空目录 ⇒ 候选只剩受控 tmp_path(POSIX 真机上
    /usr/bin/npx 真实存在也不会干扰判定的确定性)。
    """
    monkeypatch.setattr(exec_env, "bootstrap_path_dirs", lambda *a, **k: ())
    with pytest.raises(mcp_directory.McpDirectoryCommandError) as ei:
        mcp_directory.to_client_config("filesystem", env={"PATH": str(tmp_path)})
    msg = str(ei.value)
    assert "npx" in msg
    assert "试过候选" in msg
    assert str(tmp_path) in msg, "报错必须列出试过的候选路径(可定位 PATH 配错)"


def test_directory_register_missing_env_skips_resolution(tmp_path, monkeypatch):
    """缺必需 env ⇒ 原样早退(_missing_env 非空),不触发命令解析(400 契约稳定)。"""
    calls: list[str] = []

    def _spy_resolve(command, env=None):
        calls.append(command)
        return exec_env.ExecutableResolution(command, None, ("should-not-be-tried",))

    # mcp_directory 是 from-import 绑定式导入,补丁必须落在它的命名空间
    monkeypatch.setattr(mcp_directory, "resolve_stdio_command", _spy_resolve)
    cfg = mcp_directory.to_client_config("postgres", env={"PATH": str(tmp_path)})
    assert cfg is not None
    assert cfg["_missing_env"] == ["DATABASE_URL"]
    assert cfg["command"] == "npx", "未解析路径原样交还,由调用方 400 裁决"
    assert calls == [], "缺 env 早退不得触发命令解析"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
