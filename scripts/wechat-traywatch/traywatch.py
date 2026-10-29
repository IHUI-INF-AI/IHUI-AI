#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""
WeChat 4.x 托盘辅助窗口看门狗 (watchdog)
--------------------------------------------------
微信 4.x 在 Windows 11 上偶尔会把类名
    Qt51514WxTrayIconMessageWindowClass
的托盘辅助窗口错误置为可见 (WS_VISIBLE)，且窗口尺寸撑满屏幕、
未绘制，表现为黑/白块遮挡桌面。

本脚本仅针对这一个类名的窗口：当它是顶层窗口、类名匹配且处于可见
状态时，调用 ShowWindow(hwnd, SW_HIDE) 隐藏它。绝不动其它任何
窗口或进程。

实现约束（来自环境事实）：
- 绝不使用 PowerShell 的 Add-Type（本机被安全策略拦截）；所有窗口
  枚举/操作一律用 Python ctypes。
- 只处理这一个类名的窗口，绝不触碰 explorer、Weixin 主窗口等。
"""

import os
import sys
import time
import ctypes
from ctypes import wintypes

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------
TARGET_CLASS = "Qt51514WxTrayIconMessageWindowClass"  # 大小写敏感，精确匹配
OWNER_PROCESS = "Weixin.exe"                          # 窗口属主进程名
SW_HIDE = 0
LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "watchdog.log")
LOG_MAX_BYTES = 200 * 1024  # 200KB 轮转

# ---------------------------------------------------------------------------
# Windows API 绑定 (ctypes)
# ---------------------------------------------------------------------------
user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
psapi = ctypes.windll.psapi

EnumWindowsProc = ctypes.WINFUNCTYPE(
    wintypes.BOOL, wintypes.HWND, wintypes.LPARAM
)

user32.EnumWindows.argtypes = [EnumWindowsProc, wintypes.LPARAM]
user32.EnumWindows.restype = wintypes.BOOL

user32.GetClassNameW.argtypes = [
    wintypes.HWND, wintypes.LPWSTR, ctypes.c_int
]
user32.GetClassNameW.restype = ctypes.c_int

user32.IsWindowVisible.argtypes = [wintypes.HWND]
user32.IsWindowVisible.restype = wintypes.BOOL

user32.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
user32.ShowWindow.restype = wintypes.BOOL

user32.GetWindowThreadProcessId.argtypes = [
    wintypes.HWND, ctypes.POINTER(wintypes.DWORD)
]
user32.GetWindowThreadProcessId.restype = wintypes.DWORD

user32.IsWindow.argtypes = [wintypes.HWND]
user32.IsWindow.restype = wintypes.BOOL

kernel32.OpenProcess.argtypes = [
    wintypes.DWORD, wintypes.BOOL, wintypes.DWORD
]
kernel32.OpenProcess.restype = wintypes.HANDLE

kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
kernel32.CloseHandle.restype = wintypes.BOOL

psapi.GetModuleBaseNameW.argtypes = [
    wintypes.HANDLE, wintypes.HANDLE, wintypes.LPWSTR, ctypes.c_uint32
]
psapi.GetModuleBaseNameW.restype = ctypes.c_uint32

PROCESS_QUERY_INFORMATION = 0x0400
PROCESS_VM_READ = 0x0010


# ---------------------------------------------------------------------------
# 日志
# ---------------------------------------------------------------------------
def log(msg):
    """追加写入日志文件，带本地时间戳；超过 200KB 时轮转。"""
    try:
        if os.path.exists(LOG_PATH) and os.path.getsize(LOG_PATH) > LOG_MAX_BYTES:
            old = LOG_PATH + ".old"
            if os.path.exists(old):
                try:
                    os.remove(old)
                except OSError:
                    pass
            try:
                os.rename(LOG_PATH, old)
            except OSError:
                pass
        ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
        line = "[%s] %s\n" % (ts, msg)
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(line)
    except Exception as e:
        # 日志失败绝不应中断看门狗
        try:
            sys.stderr.write("log error: %s\n" % e)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# 进程名查询
# ---------------------------------------------------------------------------
def get_process_name(pid):
    """根据 PID 取得进程映像名（如 Weixin.exe）。失败返回空字符串。"""
    if pid <= 0:
        return ""
    try:
        hproc = kernel32.OpenProcess(
            PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, False, pid
        )
        if not hproc:
            return ""
        try:
            buf = ctypes.create_unicode_buffer(1024)
            n = psapi.GetModuleBaseNameW(hproc, None, buf, 1024)
            if n > 0:
                return buf.value
            return ""
        finally:
            kernel32.CloseHandle(hproc)
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# 核心扫描
# ---------------------------------------------------------------------------
def scan_once():
    """枚举一次顶层窗口，隐藏所有匹配的可见目标窗口。"""
    found = []

    def enum_cb(hwnd, lparam):
        try:
            if not user32.IsWindow(hwnd):
                return True
            # 取类名
            buf = ctypes.create_unicode_buffer(256)
            n = user32.GetClassNameW(hwnd, buf, 256)
            if n <= 0:
                return True
            class_name = buf.value
            if class_name != TARGET_CLASS:  # 精确、大小写敏感匹配
                return True
            # 取属主进程名，确认是 Weixin.exe
            pid = wintypes.DWORD(0)
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
            owner = get_process_name(pid.value)
            if owner.lower() != OWNER_PROCESS.lower():
                return True
            # 仅当可见时才隐藏
            if user32.IsWindowVisible(hwnd):
                user32.ShowWindow(hwnd, SW_HIDE)
                found.append((hwnd, pid.value))
                log("发现可见目标并隐藏 hwnd=0x%08X pid=%d" % (hwnd, pid.value))
        except Exception as e:
            # 单个窗口出错不影响整体
            try:
                log("处理窗口时异常 hwnd=0x%08X: %s" % (hwnd, e))
            except Exception:
                pass
        return True

    callback = EnumWindowsProc(enum_cb)
    try:
        user32.EnumWindows(callback, 0)
    except Exception as e:
        log("EnumWindows 异常: %s" % e)
    finally:
        # 保持回调引用，防止被 GC
        del callback

    return found


def main():
    print("WeChat tray watchdog started.")
    log("启动 watchdog (pid=%d)" % os.getpid())
    heartbeat = 0
    try:
        while True:
            found = scan_once()
            if not found:
                heartbeat += 1
                # 每 300 秒（约 5 分钟）打一次心跳，避免日志刷屏
                if heartbeat >= 300:
                    log("心跳：未发现目标，watchdog 正常运行中")
                    heartbeat = 0
            else:
                heartbeat = 0  # 有动作则立即重置心跳
            time.sleep(1.0)  # 避免 CPU 空转；不使用 Sleep(0)
    except KeyboardInterrupt:
        log("收到 KeyboardInterrupt，优雅退出。")
        print("watchdog stopped.")
    except Exception as e:
        log("主循环异常退出: %s" % e)
        print("watchdog crashed: %s" % e)


if __name__ == "__main__":
    main()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
