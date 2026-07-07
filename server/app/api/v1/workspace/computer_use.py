"""
Computer Use 工具 — 屏幕截图 + 鼠标键盘控制。

对标 Claude Computer Use 与 Codex 浏览器控制, 在 Windows 上实现:
- take_screenshot()  截屏 (Pillow ImageGrab, 返回 base64)
- mouse_click()      鼠标点击 (左键/右键/双击)
- mouse_drag()       鼠标拖拽
- mouse_scroll()     滚轮滚动
- keyboard_type()    键盘输入文本 (中文走剪贴板粘贴)
- keyboard_key()     按键 / 组合键 (如 Enter, Ctrl+C)
- get_screen_size()  屏幕分辨率

后端优先级: pyautogui > pywin32 (win32api) > ctypes (纯 Win32 API)。
三者皆不可用时返回错误, 提示安装依赖。在 Windows 上 ctypes 兜底始终可用,
因此无需安装任何额外依赖即可运行鼠标/键盘操作。

安全机制:
- COMPUTER_USE_ENABLED 总开关 (默认 False), 需环境变量 IHUI_COMPUTER_USE_ENABLED=1
  或 ~/.ihui/config.json 中 {"computer_use_enabled": true} 或工作区 AGENTS.md
  中含 `computer_use: enabled` 标记时启用。
- 所有操作写入审计日志 (~/.ihui/logs/computer_use_audit.log)。
- 操作频率限制 (默认最小间隔 200ms, 防止误操作连点)。
- 坐标越界检查 (不点击屏幕外)。
"""

from __future__ import annotations

import base64
import ctypes
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from ctypes import wintypes

# Windows 平台检测
import sys

IS_WINDOWS = sys.platform == "win32"


# ---------------------------------------------------------------------------
# 安全开关 / 频率限制 / 审计日志
# ---------------------------------------------------------------------------

COMPUTER_USE_ENABLED_ENV = "IHUI_COMPUTER_USE_ENABLED"

# 最小操作间隔 (秒), 防止误操作连点
MIN_OP_INTERVAL = 0.2

# 模块级上次操作时间戳 (用于频率限制)
_last_op_time: float = 0.0


def is_computer_use_enabled(workspace: str | None = None) -> bool:
    """判断 Computer Use 是否启用。

    启用条件 (满足任一):
    1. 环境变量 IHUI_COMPUTER_USE_ENABLED 为 1/true/yes/on
    2. ~/.ihui/config.json 中 {"computer_use_enabled": true}
    3. 工作区 AGENTS.md 中含 `computer_use: enabled` 标记
    """
    # 1. 环境变量
    val = os.environ.get(COMPUTER_USE_ENABLED_ENV, "").strip().lower()
    if val in ("1", "true", "yes", "on"):
        return True

    # 2. ~/.ihui/config.json
    try:
        cfg_path = Path.home() / ".ihui" / "config.json"
        if cfg_path.exists():
            data = json.loads(cfg_path.read_text(encoding="utf-8"))
            if data.get("computer_use_enabled") is True:
                return True
    except Exception:
        pass

    # 3. 工作区 AGENTS.md 标记
    if workspace:
        try:
            agents_md = Path(workspace) / "AGENTS.md"
            if agents_md.exists():
                txt = agents_md.read_text(encoding="utf-8", errors="replace")
                if re.search(r"computer[_\-]?use\s*[:=]\s*enabled", txt, re.IGNORECASE):
                    return True
        except Exception:
            pass

    return False


def _rate_limit() -> None:
    """频率限制: 强制两次操作间至少间隔 MIN_OP_INTERVAL 秒 (阻塞等待)。"""
    global _last_op_time
    now = time.time()
    delta = now - _last_op_time
    if delta < MIN_OP_INTERVAL:
        time.sleep(MIN_OP_INTERVAL - delta)
    _last_op_time = time.time()


def _audit(op: str, details: dict[str, Any] | None = None) -> None:
    """记录 Computer Use 操作到审计日志。"""
    try:
        log_dir = Path.home() / ".ihui" / "logs"
        log_dir.mkdir(parents=True, exist_ok=True)
        entry: dict[str, Any] = {"ts": datetime.now().isoformat(timespec="seconds"), "op": op}
        if details:
            entry.update(details)
        with open(log_dir / "computer_use_audit.log", "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        # 审计日志失败不应阻断主流程
        pass


# ---------------------------------------------------------------------------
# 后端检测: pyautogui > pywin32 > ctypes
# ---------------------------------------------------------------------------

_BACKEND: str | None = None


def _detect_backend() -> str:
    """检测可用的控制后端。返回 'pyautogui' | 'pywin32' | 'ctypes' | 'none'。"""
    global _BACKEND
    if _BACKEND is not None:
        return _BACKEND
    # 1. pyautogui
    try:
        import pyautogui  # noqa: F401

        _BACKEND = "pyautogui"
        return _BACKEND
    except ImportError:
        pass
    # 2. pywin32
    try:
        import win32api  # noqa: F401
        import win32con  # noqa: F401

        _BACKEND = "pywin32"
        return _BACKEND
    except ImportError:
        pass
    # 3. ctypes (Windows 纯 Win32 API, 始终可用)
    if IS_WINDOWS:
        try:
            ctypes.windll.user32  # type: ignore[attr-defined]
            _BACKEND = "ctypes"
            return _BACKEND
        except Exception:
            pass
    _BACKEND = "none"
    return _BACKEND


def backend_info() -> dict[str, Any]:
    """返回当前后端信息 (供诊断)。"""
    return {
        "backend": _detect_backend(),
        "is_windows": IS_WINDOWS,
        "enabled": is_computer_use_enabled(),
    }


# ---------------------------------------------------------------------------
# Win32 常量 (ctypes / pywin32 共用)
# ---------------------------------------------------------------------------

# mouse_event flags
MOUSEEVENTF_MOVE = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP = 0x0004
MOUSEEVENTF_RIGHTDOWN = 0x0008
MOUSEEVENTF_RIGHTUP = 0x0010
MOUSEEVENTF_MIDDLEDOWN = 0x0020
MOUSEEVENTF_MIDDLEUP = 0x0040
MOUSEEVENTF_WHEEL = 0x0800
WHEEL_DELTA = 120

# keybd_event flags
KEYEVENTF_KEYUP = 0x0002

# Virtual key codes
VK_MAP: dict[str, int] = {
    "enter": 0x0D, "return": 0x0D,
    "tab": 0x09,
    "escape": 0x1B, "esc": 0x1B,
    "backspace": 0x08, "back": 0x08, "bs": 0x08,
    "delete": 0x2E, "del": 0x2E,
    "insert": 0x2D, "ins": 0x2D,
    "space": 0x20, "spacebar": 0x20,
    "shift": 0x10,
    "ctrl": 0x11, "control": 0x11,
    "alt": 0x12, "menu": 0x12, "option": 0x12,
    "win": 0x5B, "meta": 0x5B, "super": 0x5B, "lwin": 0x5B, "rwin": 0x5C,
    "capslock": 0x14, "capital": 0x14,
    "up": 0x26, "down": 0x28, "left": 0x25, "right": 0x27,
    "home": 0x24, "end": 0x23,
    "pageup": 0x21, "pgup": 0x21,
    "pagedown": 0x22, "pgdn": 0x22,
    "printscreen": 0x2C, "prtsc": 0x2C, "snapshot": 0x2C,
    "scrolllock": 0x91, "numlock": 0x90,
    "f1": 0x70, "f2": 0x71, "f3": 0x72, "f4": 0x73, "f5": 0x74,
    "f6": 0x75, "f7": 0x76, "f8": 0x77, "f9": 0x78, "f10": 0x79,
    "f11": 0x7A, "f12": 0x7B,
}


def _key_to_vk(key: str) -> int | None:
    """将按键名/单字符转换为虚拟键码。未知返回 None。"""
    k = key.strip().lower()
    if not k:
        return None
    if k in VK_MAP:
        return VK_MAP[k]
    # 单字符: 字母/数字/符号 → VkKeyScanW
    if len(k) == 1:
        try:
            user32 = ctypes.windll.user32  # type: ignore[attr-defined]
            res = user32.VkKeyScanW(ord(k))
            if res != -1:
                return res & 0xFF
        except Exception:
            pass
    return None


# ---------------------------------------------------------------------------
# 屏幕分辨率 / 坐标安全检查
# ---------------------------------------------------------------------------

def get_screen_size() -> dict[str, Any]:
    """获取主屏幕分辨率。返回 {success, width, height, error}。"""
    backend = _detect_backend()
    try:
        if backend == "pyautogui":
            import pyautogui

            w, h = pyautogui.size()
        elif backend == "pywin32":
            import win32api

            w = win32api.GetSystemMetrics(0)
            h = win32api.GetSystemMetrics(1)
        elif backend == "ctypes":
            user32 = ctypes.windll.user32  # type: ignore[attr-defined]
            w = user32.GetSystemMetrics(0)
            h = user32.GetSystemMetrics(1)
        else:
            return {"success": False, "error": "无可用的控制后端 (需安装 pyautogui 或 pywin32, 或在 Windows 上运行)", "width": 0, "height": 0}
        return {"success": True, "width": int(w), "height": int(h), "error": None}
    except Exception as e:
        return {"success": False, "error": str(e), "width": 0, "height": 0}


def _check_coords(x: int, y: int) -> str | None:
    """坐标越界检查。越界返回错误信息, 合法返回 None。"""
    size = get_screen_size()
    if not size["success"]:
        return f"无法获取屏幕分辨率: {size['error']}"
    w, h = size["width"], size["height"]
    if x < 0 or y < 0 or x >= w or y >= h:
        return f"坐标越界: ({x}, {y}) 超出屏幕范围 {w}x{h}"
    return None


def _ensure_enabled() -> str | None:
    """检查 Computer Use 是否启用。未启用返回错误信息。"""
    if not is_computer_use_enabled():
        return (
            "Computer Use 未启用。请通过以下任一方式启用:\n"
            "  1. 设置环境变量 IHUI_COMPUTER_USE_ENABLED=1\n"
            "  2. 在 ~/.ihui/config.json 中设置 {\"computer_use_enabled\": true}\n"
            "  3. 在工作区 AGENTS.md 中添加 `computer_use: enabled`"
        )
    return None


# ---------------------------------------------------------------------------
# 截图 (Pillow ImageGrab)
# ---------------------------------------------------------------------------

def take_screenshot(
    highlight_mouse: bool = False,
    workspace: str | None = None,
) -> dict[str, Any]:
    """截取屏幕, 保存到 ~/.ihui/screenshots/, 返回 base64 编码。

    Args:
        highlight_mouse: 是否在截图上高亮鼠标位置 (便于定位点击点)。
        workspace: 工作区路径 (用于权限检查, 可选)。

    Returns:
        {success, path, base64, width, height, error}
    """
    err = _ensure_enabled()
    if err:
        return {"success": False, "error": err, "path": "", "base64": "", "width": 0, "height": 0}

    _rate_limit()
    _audit("screenshot", {"highlight_mouse": highlight_mouse})

    try:
        from PIL import ImageGrab, ImageDraw

        # 截屏 (Windows 兼容)
        img = ImageGrab.grab()
        width, height = img.size

        # 可选: 高亮鼠标位置
        if highlight_mouse:
            cursor = _get_cursor_pos()
            if cursor:
                cx, cy = cursor
                draw = ImageDraw.Draw(img)
                # 画一个醒目的红色圆环
                r = 12
                draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline="red", width=4)
                # 中心十字
                draw.line([cx - 6, cy, cx + 6, cy], fill="red", width=2)
                draw.line([cx, cy - 6, cx, cy + 6], fill="red", width=2)

        # 保存到 ~/.ihui/screenshots/
        shot_dir = Path.home() / ".ihui" / "screenshots"
        shot_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        path = shot_dir / f"screenshot_{ts}.png"
        img.save(path, format="PNG")

        # base64 编码 (供 LLM vision 接收)
        import io

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")

        return {
            "success": True,
            "path": str(path),
            "base64": b64,
            "width": width,
            "height": height,
            "error": None,
        }
    except Exception as e:
        return {"success": False, "error": str(e), "path": "", "base64": "", "width": 0, "height": 0}


def _get_cursor_pos() -> tuple[int, int] | None:
    """获取鼠标当前位置。"""
    backend = _detect_backend()
    try:
        if backend == "pyautogui":
            import pyautogui

            pos = pyautogui.position()
            return (int(pos.x), int(pos.y))
        if backend == "pywin32":
            import win32api

            pt = win32api.GetCursorPos()
            return (int(pt[0]), int(pt[1]))
        if backend == "ctypes":
            user32 = ctypes.windll.user32  # type: ignore[attr-defined]
            pt = wintypes.POINT()
            user32.GetCursorPos(ctypes.byref(pt))
            return (int(pt.x), int(pt.y))
    except Exception:
        pass
    return None


# ---------------------------------------------------------------------------
# 鼠标操作
# ---------------------------------------------------------------------------

_BUTTON_FLAGS: dict[str, dict[str, int]] = {
    "left": {"down": MOUSEEVENTF_LEFTDOWN, "up": MOUSEEVENTF_LEFTUP},
    "right": {"down": MOUSEEVENTF_RIGHTDOWN, "up": MOUSEEVENTF_RIGHTUP},
    "middle": {"down": MOUSEEVENTF_MIDDLEDOWN, "up": MOUSEEVENTF_MIDDLEUP},
}


def _win_set_cursor(x: int, y: int) -> None:
    """设置鼠标位置 (win32api 或 ctypes)。"""
    backend = _detect_backend()
    if backend == "pywin32":
        import win32api

        win32api.SetCursorPos((x, y))
    else:
        user32 = ctypes.windll.user32  # type: ignore[attr-defined]
        user32.SetCursorPos(x, y)


def _win_mouse_event(flags: int, dw_data: int = 0) -> None:
    """发送鼠标事件 (win32api 或 ctypes)。"""
    backend = _detect_backend()
    if backend == "pywin32":
        import win32api

        win32api.mouse_event(flags, 0, 0, dw_data, 0)
    else:
        user32 = ctypes.windll.user32  # type: ignore[attr-defined]
        user32.mouse_event(flags, 0, 0, dw_data, 0)


def mouse_click(
    x: int,
    y: int,
    button: str = "left",
    clicks: int = 1,
    workspace: str | None = None,
) -> dict[str, Any]:
    """鼠标点击。

    Args:
        x, y: 目标坐标。
        button: left / right / middle。
        clicks: 点击次数 (2 表示双击)。

    Returns:
        {success, error, output}
    """
    err = _ensure_enabled()
    if err:
        return {"success": False, "error": err, "output": ""}

    button = (button or "left").lower()
    if button not in _BUTTON_FLAGS:
        return {"success": False, "error": f"不支持鼠标按键: {button} (可选 left/right/middle)", "output": ""}
    clicks = max(1, int(clicks))

    # 坐标越界检查
    coord_err = _check_coords(int(x), int(y))
    if coord_err:
        return {"success": False, "error": coord_err, "output": ""}

    _rate_limit()
    _audit("mouse_click", {"x": x, "y": y, "button": button, "clicks": clicks})

    backend = _detect_backend()
    try:
        if backend == "pyautogui":
            import pyautogui

            pyautogui.click(x=int(x), y=int(y), button=button, clicks=clicks)
        elif backend in ("pywin32", "ctypes"):
            _win_set_cursor(int(x), int(y))
            time.sleep(0.03)
            flags = _BUTTON_FLAGS[button]
            for _ in range(clicks):
                _win_mouse_event(flags["down"])
                _win_mouse_event(flags["up"])
                if clicks > 1:
                    time.sleep(0.05)
        else:
            return {"success": False, "error": "无可用的控制后端 (需安装 pyautogui 或 pywin32)", "output": ""}

        return {"success": True, "error": None, "output": f"已点击 ({x}, {y}) [{button}键 x{clicks}]"}
    except Exception as e:
        return {"success": False, "error": str(e), "output": ""}


def mouse_drag(
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    button: str = "left",
    duration: float = 0.5,
    workspace: str | None = None,
) -> dict[str, Any]:
    """鼠标拖拽: 从 (x1,y1) 按住拖到 (x2,y2)。

    Args:
        duration: 拖拽耗时 (秒), 越平滑越不易被目标程序忽略。

    Returns:
        {success, error, output}
    """
    err = _ensure_enabled()
    if err:
        return {"success": False, "error": err, "output": ""}

    button = (button or "left").lower()
    if button not in _BUTTON_FLAGS:
        return {"success": False, "error": f"不支持鼠标按键: {button}", "output": ""}

    for px, py in ((x1, y1), (x2, y2)):
        coord_err = _check_coords(int(px), int(py))
        if coord_err:
            return {"success": False, "error": coord_err, "output": ""}

    _rate_limit()
    _audit("mouse_drag", {"x1": x1, "y1": y1, "x2": x2, "y2": y2, "button": button})

    backend = _detect_backend()
    try:
        if backend == "pyautogui":
            import pyautogui

            pyautogui.moveTo(int(x1), int(y1), duration=0.1)
            pyautogui.mouseDown(button=button)
            pyautogui.moveTo(int(x2), int(y2), duration=duration)
            pyautogui.mouseUp(button=button)
        elif backend in ("pywin32", "ctypes"):
            flags = _BUTTON_FLAGS[button]
            _win_set_cursor(int(x1), int(y1))
            time.sleep(0.05)
            _win_mouse_event(flags["down"])
            # 平滑移动
            steps = max(1, int(duration / 0.02))
            for i in range(1, steps + 1):
                cx = int(x1 + (x2 - x1) * i / steps)
                cy = int(y1 + (y2 - y1) * i / steps)
                _win_set_cursor(cx, cy)
                time.sleep(0.02)
            _win_mouse_event(flags["up"])
        else:
            return {"success": False, "error": "无可用的控制后端 (需安装 pyautogui 或 pywin32)", "output": ""}

        return {"success": True, "error": None, "output": f"已拖拽 ({x1},{y1}) -> ({x2},{y2}) [{button}键]"}
    except Exception as e:
        return {"success": False, "error": str(e), "output": ""}


def mouse_scroll(
    x: int,
    y: int,
    clicks: int = 1,
    workspace: str | None = None,
) -> dict[str, Any]:
    """滚轮滚动。

    Args:
        clicks: 滚动量。正值向上滚, 负值向下滚 (与 pyautogui 一致)。

    Returns:
        {success, error, output}
    """
    err = _ensure_enabled()
    if err:
        return {"success": False, "error": err, "output": ""}

    coord_err = _check_coords(int(x), int(y))
    if coord_err:
        return {"success": False, "error": coord_err, "output": ""}

    clicks = int(clicks)
    _rate_limit()
    _audit("mouse_scroll", {"x": x, "y": y, "clicks": clicks})

    backend = _detect_backend()
    try:
        if backend == "pyautogui":
            import pyautogui

            pyautogui.moveTo(int(x), int(y))
            pyautogui.scroll(clicks)
        elif backend in ("pywin32", "ctypes"):
            _win_set_cursor(int(x), int(y))
            time.sleep(0.03)
            # mouse_event 的 dwData: 正值向上, 负值向下
            _win_mouse_event(MOUSEEVENTF_WHEEL, dw_data=clicks * WHEEL_DELTA)
        else:
            return {"success": False, "error": "无可用的控制后端 (需安装 pyautogui 或 pywin32)", "output": ""}

        direction = "向上" if clicks >= 0 else "向下"
        return {"success": True, "error": None, "output": f"已滚动 ({x},{y}) {direction} {abs(clicks)} 格"}
    except Exception as e:
        return {"success": False, "error": str(e), "output": ""}


# ---------------------------------------------------------------------------
# 剪贴板 (中文输入走剪贴板粘贴)
# ---------------------------------------------------------------------------

def _set_clipboard_text(text: str) -> None:
    """将文本写入系统剪贴板 (CF_UNICODETEXT, 支持中文)。使用 ctypes Win32 API。"""
    CF_UNICODETEXT = 13
    GMEM_MOVEABLE = 0x0002

    user32 = ctypes.windll.user32  # type: ignore[attr-defined]
    kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]

    user32.OpenClipboard.argtypes = [wintypes.HWND]
    user32.OpenClipboard.restype = wintypes.BOOL
    user32.EmptyClipboard.restype = wintypes.HANDLE
    user32.SetClipboardData.argtypes = [wintypes.UINT, wintypes.HANDLE]
    user32.SetClipboardData.restype = wintypes.HANDLE
    kernel32.GlobalAlloc.argtypes = [wintypes.UINT, ctypes.c_size_t]
    kernel32.GlobalAlloc.restype = wintypes.HGLOBAL
    kernel32.GlobalLock.argtypes = [wintypes.HGLOBAL]
    kernel32.GlobalLock.restype = ctypes.c_void_p
    kernel32.GlobalUnlock.argtypes = [wintypes.HGLOBAL]

    buf = (text + "\0").encode("utf-16-le")
    if not user32.OpenClipboard(0):
        raise OSError("无法打开剪贴板")
    try:
        user32.EmptyClipboard()
        h_global = kernel32.GlobalAlloc(GMEM_MOVEABLE, len(buf))
        if not h_global:
            raise OSError("GlobalAlloc 失败")
        ptr = kernel32.GlobalLock(h_global)
        if not ptr:
            raise OSError("GlobalLock 失败")
        ctypes.memmove(ptr, buf, len(buf))
        kernel32.GlobalUnlock(h_global)
        # SetClipboardData 后, 系统接管句柄, 不应再 GlobalFree
        user32.SetClipboardData(CF_UNICODETEXT, h_global)
    finally:
        user32.CloseClipboard()


# ---------------------------------------------------------------------------
# 键盘操作
# ---------------------------------------------------------------------------

def _win_keybd_event(vk: int, flags: int = 0) -> None:
    """发送键盘事件 (win32api 或 ctypes)。"""
    backend = _detect_backend()
    if backend == "pywin32":
        import win32api

        win32api.keybd_event(vk, 0, flags, 0)
    else:
        user32 = ctypes.windll.user32  # type: ignore[attr-defined]
        user32.keybd_event(vk, 0, flags, 0)


def _win_press_combo(vks: list[int]) -> None:
    """按下组合键: 依次按下所有键, 再逆序释放。"""
    for vk in vks:
        _win_keybd_event(vk, 0)
        time.sleep(0.02)
    for vk in reversed(vks):
        _win_keybd_event(vk, KEYEVENTF_KEYUP)
        time.sleep(0.02)


def _parse_key_combo(key: str) -> list[int]:
    """解析组合键字符串为虚拟键码列表。如 'ctrl+c' -> [VK_CONTROL, vk('c')]。"""
    parts = [p.strip() for p in key.replace(" ", "").split("+") if p.strip()]
    if not parts:
        raise ValueError("按键不能为空")
    vks: list[int] = []
    for p in parts:
        vk = _key_to_vk(p)
        if vk is None:
            raise ValueError(f"未知按键: {p}")
        vks.append(vk)
    return vks


def keyboard_type(
    text: str,
    workspace: str | None = None,
    paste: bool | None = None,
) -> dict[str, Any]:
    """键盘输入文本。支持中文 (通过剪贴板粘贴)。

    Args:
        text: 要输入的文本。
        paste: 是否强制使用剪贴板粘贴。None=自动 (含非 ASCII 时用粘贴)。

    Returns:
        {success, error, output}
    """
    err = _ensure_enabled()
    if err:
        return {"success": False, "error": err, "output": ""}

    if text is None:
        text = ""
    # 自动判断: 含非 ASCII 字符 (如中文) 时用剪贴板粘贴
    if paste is None:
        paste = not text.isascii()

    _rate_limit()
    _audit("keyboard_type", {"text_len": len(text), "paste": paste, "text_preview": text[:50]})

    backend = _detect_backend()
    try:
        if paste:
            # 剪贴板粘贴 (最可靠, 支持中文) — 所有后端通用
            _set_clipboard_text(text)
            time.sleep(0.05)
            # 模拟 Ctrl+V
            if backend == "pyautogui":
                import pyautogui

                pyautogui.hotkey("ctrl", "v")
            else:
                ctrl_c = _parse_key_combo("ctrl+v")
                _win_press_combo(ctrl_c)
        else:
            # 纯 ASCII: 逐字符输入
            if backend == "pyautogui":
                import pyautogui

                pyautogui.write(text, interval=0.01)
            else:
                for ch in text:
                    vk = _key_to_vk(ch)
                    if vk is None:
                        # 回退到剪贴板
                        _set_clipboard_text(text)
                        _win_press_combo(_parse_key_combo("ctrl+v"))
                        break
                    # 判断是否需要 Shift (大写/符号)
                    needs_shift = ch.isupper() or (not ch.isalnum() and ch not in "0123456789")
                    if needs_shift:
                        _win_press_combo([0x10, vk])  # Shift + key
                    else:
                        _win_keybd_event(vk, 0)
                        time.sleep(0.01)
                        _win_keybd_event(vk, KEYEVENTF_KEYUP)
                        time.sleep(0.01)

        preview = text[:80].replace("\n", "\\n")
        return {"success": True, "error": None, "output": f"已输入文本 ({len(text)} 字符): {preview}"}
    except Exception as e:
        return {"success": False, "error": str(e), "output": ""}


def keyboard_key(
    key: str,
    workspace: str | None = None,
) -> dict[str, Any]:
    """按键 / 组合键。如 'Enter', 'Tab', 'Escape', 'Ctrl+C', 'alt+f4'。

    Args:
        key: 按键名, 组合键用 '+' 连接 (如 'ctrl+shift+esc')。

    Returns:
        {success, error, output}
    """
    err = _ensure_enabled()
    if err:
        return {"success": False, "error": err, "output": ""}

    if not key or not key.strip():
        return {"success": False, "error": "按键不能为空", "output": ""}

    _rate_limit()
    _audit("keyboard_key", {"key": key})

    backend = _detect_backend()
    try:
        vks = _parse_key_combo(key)
        if backend == "pyautogui":
            import pyautogui

            # pyautogui.hotkey 接受按键名列表
            parts = [p.strip().lower() for p in key.replace(" ", "").split("+") if p.strip()]
            pyautogui.hotkey(*parts)
        else:
            _win_press_combo(vks)

        return {"success": True, "error": None, "output": f"已按键: {key}"}
    except ValueError as e:
        return {"success": False, "error": str(e), "output": ""}
    except Exception as e:
        return {"success": False, "error": str(e), "output": ""}
