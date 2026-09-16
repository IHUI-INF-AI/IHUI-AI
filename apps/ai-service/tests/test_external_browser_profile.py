# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""外部浏览器"用你自己电脑上的浏览器"单测(2026-09-16 立)。

覆盖 browser_hub 新增能力(不启动真实浏览器、不访问注册表真值):
- _resolve_browser_profile_name:Local State 的 profile.last_used 解析 + 兜底 Default
- _find_external_browser:按系统默认浏览器 ProgId 优先 Chromium 系候选
- _copy_browser_profile:登录态最小文件集复制 / Local State 改写 last_used /
  Preferences 退出态修正 / cookie 库缺失时降级(profile_used=False)且不抛异常
- launch_external_chrome:以"用户自己的浏览器 + 复制后的 profile"启动普通窗口
  (mock subprocess + playwright 附着),返回 meta.browser / profile_used

背景:用户反馈"外部浏览器打开的不是我自己电脑上的浏览器"——旧实现用全新空 profile,
窗口里没有登录态。新实现复制用户真实 profile 的登录态文件,窗口即用户日常浏览器。
"""

from __future__ import annotations

import asyncio
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from app.services import browser_hub
from app.services.browser_hub import (
    BrowserHub,
    SystemBrowser,
    _copy_browser_profile,
    _find_external_browser,
    _resolve_browser_profile_name,
)


def _make_user_data(root: Path, profile_name: str = "Default", *, with_cookies: bool = True) -> Path:
    """构造一个假的浏览器 User Data 目录。"""
    profile = root / profile_name
    (profile / "Network").mkdir(parents=True, exist_ok=True)
    (root / "Local State").write_text(
        json.dumps({"profile": {"last_used": profile_name}}), encoding="utf-8"
    )
    (profile / "Preferences").write_text(
        json.dumps({"profile": {"exit_type": "Crashed", "exited_cleanly": False}}),
        encoding="utf-8",
    )
    if with_cookies:
        (profile / "Network" / "Cookies").write_bytes(b"SQLite format 3-fake-cookies")
    return root


# --- _resolve_browser_profile_name ---


def test_resolve_profile_name_uses_last_used(tmp_path: Path):
    """Local State 的 profile.last_used 存在对应目录 → 采用该 profile 名。"""
    user_data = _make_user_data(tmp_path / "ud", "Profile 1")
    assert _resolve_browser_profile_name(user_data) == "Profile 1"


def test_resolve_profile_name_fallback_default(tmp_path: Path):
    """Local State 缺失/损坏 → 兜底 Default。"""
    root = tmp_path / "ud"
    (root / "Default").mkdir(parents=True)
    assert _resolve_browser_profile_name(root) == "Default"


# --- _find_external_browser ---


def _fake_specs(tmp_path: Path, *, chrome: bool, edge: bool):
    chrome_exe = tmp_path / "chrome.exe"
    edge_exe = tmp_path / "msedge.exe"
    if chrome:
        chrome_exe.write_text("x", encoding="utf-8")
    if edge:
        edge_exe.write_text("x", encoding="utf-8")
    chrome_data = tmp_path / "Chrome User Data"
    edge_data = tmp_path / "Edge User Data"
    chrome_data.mkdir(exist_ok=True)
    edge_data.mkdir(exist_ok=True)
    return [
        ("Google Chrome", ("chrome",), [chrome_exe], chrome_data),
        ("Microsoft Edge", ("msedge", "edge"), [edge_exe], edge_data),
    ]


@pytest.mark.parametrize(
    ("progid", "expected"),
    [("ChromeHTML.ABCDEF", "Google Chrome"), ("MSEdgeHTM", "Microsoft Edge")],
)
def test_find_external_browser_prefers_system_default(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, progid: str, expected: str
):
    """系统默认浏览器是 Chrome/Edge 时,优先用该浏览器(两者都装了也按默认选)。"""
    monkeypatch.setattr(browser_hub, "_browser_specs", lambda: _fake_specs(tmp_path, chrome=True, edge=True))
    monkeypatch.setattr(browser_hub, "_default_browser_progid", lambda: progid)
    browser = _find_external_browser()
    assert browser is not None and browser.name == expected


def test_find_external_browser_falls_back_when_default_missing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """默认浏览器为 Edge 但 Edge 未安装 → 回退已安装的 Chrome(不返回 None)。"""
    monkeypatch.setattr(browser_hub, "_browser_specs", lambda: _fake_specs(tmp_path, chrome=True, edge=False))
    monkeypatch.setattr(browser_hub, "_default_browser_progid", lambda: "MSEdgeHTM")
    browser = _find_external_browser()
    assert browser is not None and browser.name == "Google Chrome"


def test_find_external_browser_none_when_no_browser(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """未安装任何 Chromium 系浏览器 → None(上层给出明确报错)。"""
    monkeypatch.setattr(browser_hub, "_browser_specs", lambda: _fake_specs(tmp_path, chrome=False, edge=False))
    monkeypatch.setattr(browser_hub, "_default_browser_progid", lambda: "ChromeHTML")
    assert _find_external_browser() is None


# --- _copy_browser_profile ---


def test_copy_browser_profile_copies_signin_state(tmp_path: Path):
    """复制 Local State / Preferences / Network/Cookies,并返回 profile_used=True。"""
    user_data = _make_user_data(tmp_path / "ud", "Profile 1")
    dest = tmp_path / "temp-profile"

    info = _copy_browser_profile(user_data, dest)

    assert info["profile_used"] is True
    assert info["profile_name"] == "Profile 1"
    assert "Network/Cookies" in info["copied"]
    assert (dest / "Default" / "Network" / "Cookies").read_bytes().startswith(b"SQLite")
    # Local State 改写 last_used=Default,保证临时 profile 名不一致也能被直接采用
    state = json.loads((dest / "Local State").read_text(encoding="utf-8"))
    assert state["profile"]["last_used"] == "Default"
    # 用户原 profile 不被改动
    src_state = json.loads((user_data / "Local State").read_text(encoding="utf-8"))
    assert src_state["profile"]["last_used"] == "Profile 1"


def test_copy_browser_profile_normalizes_exit_state(tmp_path: Path):
    """Preferences 退出态修正为正常,避免新窗口弹"是否恢复页面"。"""
    user_data = _make_user_data(tmp_path / "ud")
    dest = tmp_path / "temp-profile"

    _copy_browser_profile(user_data, dest)

    prefs = json.loads((dest / "Default" / "Preferences").read_text(encoding="utf-8"))
    assert prefs["profile"]["exit_type"] == "Normal"
    assert prefs["profile"]["exited_cleanly"] is True


def test_copy_browser_profile_degrades_without_cookies(tmp_path: Path):
    """cookie 库缺失 → profile_used=False + 记录 error,不抛异常(仍可打开登录页让用户登录)。"""
    user_data = _make_user_data(tmp_path / "ud", with_cookies=False)
    dest = tmp_path / "temp-profile"

    info = _copy_browser_profile(user_data, dest)

    assert info["profile_used"] is False
    assert info["error"]


# --- launch_external_chrome ---


class _FakeChromium:
    def __init__(self) -> None:
        self.cdp_url = ""

    def connect_over_cdp(self, url: str, timeout: int | None = None):  # noqa: ARG002
        self.cdp_url = url
        return _FakeBrowser()


class _FakeBrowser:
    def __init__(self) -> None:
        self.contexts = [_FakeContext()]

    def close(self) -> None:  # pragma: no cover - 仅清理路径调用
        pass


class _FakeContext:
    def __init__(self) -> None:
        self.pages = [_FakePage()]

    def new_page(self):  # pragma: no cover - 已有页面时不会走
        return _FakePage()


class _FakePage:
    def __init__(self) -> None:
        self.url = "about:blank"


class _FakePlaywright:
    def __init__(self) -> None:
        self.chromium = _FakeChromium()


class _FakeProc:
    def __init__(self) -> None:
        self.terminated = False

    def terminate(self) -> None:
        self.terminated = True


def test_launch_external_chrome_uses_user_browser_and_profile(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    """启动参数 = 用户浏览器 exe + 普通窗口(非 --app)+ 复制后的 profile(含用户登录态)。"""
    user_data = _make_user_data(tmp_path / "ud")
    exe = tmp_path / "chrome.exe"
    exe.write_text("x", encoding="utf-8")
    fake_browser = SystemBrowser(name="Google Chrome", exe=exe, user_data=user_data)
    monkeypatch.setattr(browser_hub, "_find_external_browser", lambda: fake_browser)

    spawned: list[list[str]] = []

    def _fake_popen(args: list[str], *a: object, **kw: object) -> _FakeProc:
        spawned.append([str(x) for x in args])
        return _FakeProc()

    monkeypatch.setattr(subprocess, "Popen", _fake_popen)

    hub = BrowserHub()
    hub._started = True
    hub._playwright = _FakePlaywright()

    try:
        _session, meta = asyncio.run(hub.launch_external_chrome("https://www.zhihu.com/signin"))
    finally:
        for sid in list(hub._sessions):
            hub._sessions.pop(sid, None)
        hub._executor.shutdown(wait=False)

    assert meta["browser"] == "Google Chrome"
    assert meta["profile_used"] is True
    assert len(spawned) == 1
    args = spawned[0]
    assert args[0] == str(exe)
    assert "--new-window" in args
    assert "https://www.zhihu.com/signin" in args
    assert not any(a.startswith("--app=") for a in args)
    # 启动用的 profile 目录里已经带上了用户浏览器的 cookie 库
    profile_arg = next(a for a in args if a.startswith("--user-data-dir="))
    profile_dir = Path(profile_arg.split("=", 1)[1])
    try:
        assert (profile_dir / "Default" / "Network" / "Cookies").exists()
        assert profile_dir != user_data
    finally:
        shutil.rmtree(profile_dir, ignore_errors=True)
