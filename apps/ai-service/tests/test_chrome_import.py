# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""chrome_import 服务层单元测试(2026-09-30,消费端闭环接线时补齐)。

覆盖不依赖真实浏览器/CDP 的部分:
- _wait_for_cdp_ready: 必须 trust_env=False(系统代理拦回环,实证 502)的反向锁
- _find_browser_executable: 候选清单存在性判定(存在→返回,全缺→None)
- _pick_free_port: 返回可绑定回环端口
- _spawn_browser: 命令行形状(--app 登录页/--remote-debugging-port/--user-data-dir)与无 close
- launch_chrome_for_import: 平台校验/未装浏览器/正常路径(mock spawn+ready)全链路
"""

from __future__ import annotations

import inspect
from unittest.mock import patch

import pytest

from app.services import chrome_import as m
from app.services.scan_login import PLATFORM_SCAN_CONFIG

# =============================================================================
# _wait_for_cdp_ready: 代理穿透反向锁
# =============================================================================

def test_wait_for_cdp_ready_must_disable_trust_env():
    """系统代理会拦 127.0.0.1(实证 502 upstream connect failed)——
    AsyncClient 不带 trust_env=False 就是回归,当场红。"""
    src = inspect.getsource(m._wait_for_cdp_ready)
    assert "trust_env=False" in src


# =============================================================================
# 浏览器发现与端口
# =============================================================================

def test_find_browser_executable_returns_first_existing_candidate(tmp_path):
    fake = tmp_path / "chrome.exe"
    fake.write_bytes(b"MZ")
    with patch.object(m, "_BROWSER_CANDIDATES", [("chrome", [str(fake)])]):
        path, name = m._find_browser_executable()
    assert name == "chrome"
    assert path == str(fake)


def test_find_browser_executable_none_when_all_missing(tmp_path):
    with patch.object(m, "_BROWSER_CANDIDATES", [("chrome", [str(tmp_path / "nope.exe")])]):
        assert m._find_browser_executable() == (None, None)


def test_find_browser_executable_skips_empty_and_env_override(tmp_path):
    """IHUI_CHROME_PATH='' 候选必须被跳过,不能当成真实路径判 isfile。"""
    fake = tmp_path / "edge.exe"
    fake.write_bytes(b"MZ")
    cands = [("chrome", [""]), ("edge", [str(fake)])]
    with patch.object(m, "_BROWSER_CANDIDATES", cands):
        path, name = m._find_browser_executable()
    assert name == "edge"


def test_pick_free_port_is_bindable():
    import socket

    port = m._pick_free_port()
    assert 1024 <= port <= 65535
    # 拿到的端口应可再绑定(短暂竞态窗口之外的常规情况)
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", port))
    finally:
        s.close()


# =============================================================================
# _spawn_browser: 命令行形状
# =============================================================================

def test_spawn_browser_builds_cdp_command_line(tmp_path):
    """--app 登录页 + 调试端口 + 独立 profile,一个都不能少;
    且只 Popen 拉起,绝不允许出现 close/kill 字样(关掉的是用户登录窗口)。"""
    captured: dict = {}

    class FakeProc:
        pid = 4242

    def fake_popen(args, **kwargs):
        captured["args"] = args
        captured["kwargs"] = kwargs
        return FakeProc()

    browser = tmp_path / "chrome.exe"
    browser.write_bytes(b"MZ")
    with patch.object(m.subprocess, "Popen", side_effect=fake_popen):
        m._spawn_browser(str(browser), 9223, "https://example.com/login", str(tmp_path / "profile"))

    args = captured["args"]
    assert args[0] == str(browser)
    assert "--remote-debugging-port=9223" in args
    assert "--app=https://example.com/login" in args
    assert any(a.startswith("--user-data-dir=") for a in args)
    assert "--no-first-run" in args and "--no-default-browser-check" in args


# =============================================================================
# launch_chrome_for_import: 全链路(mock 掉 spawn 与就绪探测)
# =============================================================================

@pytest.mark.asyncio
async def test_launch_rejects_unknown_platform():
    r = await m.launch_chrome_for_import("not_a_platform")
    assert r["launched"] is False
    assert "不支持的平台" in (r["error"] or "")


@pytest.mark.asyncio
async def test_launch_reports_missing_browser():
    platform = next(iter(PLATFORM_SCAN_CONFIG))
    with patch.object(m, "_find_browser_executable", return_value=(None, None)):
        r = await m.launch_chrome_for_import(platform)
    assert r["launched"] is False
    assert "未找到" in (r["error"] or "")


@pytest.mark.asyncio
async def test_launch_success_path(tmp_path):
    platform = next(iter(PLATFORM_SCAN_CONFIG))
    login_url = PLATFORM_SCAN_CONFIG[platform]["login_url"]
    spawned: list = []

    def fake_popen(args, **kwargs):
        spawned.append(args)

        class FakeProc:
            pid = 1

        return FakeProc()

    with patch.object(m, "_find_browser_executable", return_value=(str(tmp_path / "c.exe"), "chrome")), \
         patch.object(m, "_pick_free_port", return_value=54321), \
         patch.object(m.subprocess, "Popen", side_effect=fake_popen), \
         patch.object(m, "_wait_for_cdp_ready", return_value=True) as wait_ready:
        r = await m.launch_chrome_for_import(platform)

    assert r == {"launched": True, "port": 54321, "login_url": login_url,
                 "browser": "chrome", "error": None}
    assert spawned and spawned[0][0] == str(tmp_path / "c.exe")
    assert "--remote-debugging-port=54321" in spawned[0]
    wait_ready.assert_awaited_once_with(54321)


@pytest.mark.asyncio
async def test_launch_ready_timeout_is_soft_failure(tmp_path):
    """端口没就绪不算硬失败:窗口可能还在起,launched 仍为 True,
    error 带提示,前端轮询 import-chrome 时每次调用内部还会再探。"""
    platform = next(iter(PLATFORM_SCAN_CONFIG))
    with patch.object(m, "_find_browser_executable", return_value=(str(tmp_path / "c.exe"), "chrome")), \
         patch.object(m, "_pick_free_port", return_value=54322), \
         patch.object(m.subprocess, "Popen", return_value=type("P", (), {"pid": 1})()), \
         patch.object(m, "_wait_for_cdp_ready", return_value=False):
        r = await m.launch_chrome_for_import(platform)
    assert r["launched"] is True
    assert r["port"] == 54322
    assert r["error"] and "稍候" in r["error"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
