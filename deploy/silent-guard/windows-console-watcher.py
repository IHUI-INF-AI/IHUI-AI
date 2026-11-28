# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 部署位置: C:\Users\<user>\.ihui-silent-guard\windows-console-watcher.py
# 由计划任务 IHUI-Console-Watcher 以 pythonw 常驻启动（单实例靠 Global\IHUI_ConsoleWatcher 互斥体）。
# 本文件是仓库内的权威副本；现场运行时改了规则，必须同步回这里，否则换机/重装会丢。
## 实时控制台窗口压制器（常驻，无界面）。
#
# 为什么需要它：有些启动路径（别的会话临时 Start-Process python / node、老脚本）
# 仍会在我们的控制之外新建一个真实的控制台窗口。计划任务每分钟扫一次只能"事后擦掉"，
# 会闪一下；这里改成事件驱动：SetWinEventHook 监听窗口 CREATE/SHOW，
# 窗口刚被创建/显示就在毫秒级 SW_HIDE，配合 15ms 轮询兜底，做到肉眼不可见。
#
# 只压制命中下列特征的控制台窗口，绝不碰用户手开的交互终端：
#   - 进程是 python.exe / node.exe（一律压制，用户口径：这两类的黑框不许出现）
#   - 进程是 pwsh.exe / powershell.exe / cmd.exe，且命令行确实指向本项目的批处理调用
#     （含 IHUI-AI，并且带 -File / -Command 或落在 deploy / scripts 目录）。
#     用户手开的终端命令行里不会有这些特征，所以不会被误吞。
#
# 命中即隐藏（不杀进程），并记一行 C:\IHUI-AI\logs\window-hide-watcher.log。

import ctypes
import ctypes.wintypes as wt
import os
import sys
import time
import threading

try:
    sys.setswitchinterval(0.0005)
except Exception:
    pass

LOG = r'C:\IHUI-AI\logs\window-hide-watcher.log'
MUTEX_NAME = 'Global\\IHUI_ConsoleWatcher'

user32 = ctypes.WinDLL('user32', use_last_error=True)
kernel32 = ctypes.WinDLL('kernel32', use_last_error=True)
ntdll = ctypes.WinDLL('ntdll', use_last_error=True)

# 64 位下不声明签名会把 HANDLE/HWND 截成 32 位，必须显式声明。
kernel32.OpenProcess.argtypes = [wt.DWORD, wt.BOOL, wt.DWORD]
kernel32.OpenProcess.restype = wt.HANDLE
kernel32.CloseHandle.argtypes = [wt.HANDLE]
kernel32.CloseHandle.restype = wt.BOOL
kernel32.QueryFullProcessImageNameW.argtypes = [wt.HANDLE, wt.DWORD, wt.LPWSTR, ctypes.POINTER(wt.DWORD)]
kernel32.QueryFullProcessImageNameW.restype = wt.BOOL
kernel32.ReadProcessMemory.argtypes = [wt.HANDLE, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_size_t, ctypes.POINTER(ctypes.c_size_t)]
kernel32.ReadProcessMemory.restype = wt.BOOL
kernel32.CreateMutexW.argtypes = [ctypes.c_void_p, wt.BOOL, wt.LPCWSTR]
kernel32.CreateMutexW.restype = wt.HANDLE
user32.GetWindowThreadProcessId.argtypes = [wt.HWND, ctypes.POINTER(wt.DWORD)]
user32.GetWindowThreadProcessId.restype = wt.DWORD
user32.GetClassNameW.argtypes = [wt.HWND, wt.LPWSTR, ctypes.c_int]
user32.GetClassNameW.restype = ctypes.c_int
user32.GetWindowTextW.argtypes = [wt.HWND, wt.LPWSTR, ctypes.c_int]
user32.GetWindowTextW.restype = ctypes.c_int
user32.IsWindowVisible.argtypes = [wt.HWND]
user32.IsWindowVisible.restype = wt.BOOL
user32.ShowWindow.argtypes = [wt.HWND, ctypes.c_int]
user32.ShowWindow.restype = wt.BOOL
user32.GetMessageW.argtypes = [ctypes.POINTER(wt.MSG), wt.HWND, wt.UINT, wt.UINT]
user32.GetMessageW.restype = ctypes.c_int
user32.TranslateMessage.argtypes = [ctypes.POINTER(wt.MSG)]
user32.DispatchMessageW.argtypes = [ctypes.POINTER(wt.MSG)]

EVENT_OBJECT_CREATE = 0x8000
EVENT_OBJECT_SHOW = 0x8002
WINEVENT_OUTOFCONTEXT = 0x0000
OBJID_WINDOW = 0
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
ERROR_ALREADY_EXISTS = 183


def log(line):
    try:
        p = LOG
        if os.path.exists(p) and os.path.getsize(p) > 2 * 1024 * 1024:
            try:
                os.replace(p, p + '.old')
            except OSError:
                pass
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'a', encoding='utf-8') as f:
            f.write('%s %s\n' % (time.strftime('%Y-%m-%dT%H:%M:%S'), line))
    except Exception:
        pass


def get_pid(hwnd):
    pid = wt.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    return pid.value


def get_class(hwnd):
    buf = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, buf, 256)
    return buf.value


def get_title(hwnd):
    buf = ctypes.create_unicode_buffer(512)
    user32.GetWindowTextW(hwnd, buf, 512)
    return buf.value


def get_exe(pid):
    h = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not h:
        return ''
    try:
        buf = ctypes.create_unicode_buffer(1024)
        size = wt.DWORD(1024)
        if kernel32.QueryFullProcessImageNameW(h, 0, buf, ctypes.byref(size)):
            return buf.value
        return ''
    finally:
        kernel32.CloseHandle(h)


class PBI64(ctypes.Structure):
    _fields_ = [
        ('ExitStatus', ctypes.c_long),
        ('Pad0', ctypes.c_long),
        ('PebBaseAddress', ctypes.c_void_p),
        ('AffinityMask', ctypes.c_void_p),
        ('BasePriority', ctypes.c_long),
        ('Pad1', ctypes.c_long),
        ('UniqueProcessId', ctypes.c_void_p),
        ('InheritedFromUniqueProcessId', ctypes.c_void_p),
    ]


def get_cmdline(pid):
    """通过 PEB 读命令行：只读，失败就返回空串。"""
    h = kernel32.OpenProcess(
        PROCESS_QUERY_LIMITED_INFORMATION | 0x0010, False, pid)  # 0x0010 = PROCESS_VM_READ
    if not h:
        return ''
    try:
        pbi = PBI64()
        ret = wt.ULONG()
        if ntdll.NtQueryInformationProcess(h, 0, ctypes.byref(pbi), ctypes.sizeof(pbi), ctypes.byref(ret)) != 0:
            return ''
        if not pbi.PebBaseAddress:
            return ''
        params_ptr = ctypes.c_void_p()
        if not kernel32.ReadProcessMemory(h, ctypes.c_void_p(pbi.PebBaseAddress + 0x20),
                                          ctypes.byref(params_ptr), 8, None):
            return ''
        if not params_ptr.value:
            return ''
        # UNICODE_STRING: Length(2) Max(2) pad(4) Buffer(8)
        buf = ctypes.create_string_buffer(16)
        if not kernel32.ReadProcessMemory(h, ctypes.c_void_p(params_ptr.value + 0x70),
                                          buf, 16, None):
            return ''
        length = int.from_bytes(buf.raw[0:2], 'little')
        if length == 0 or length > 4096:
            return ''
        bufptr = int.from_bytes(buf.raw[8:16], 'little')
        if not bufptr:
            return ''
        text = ctypes.create_unicode_buffer(length // 2 + 1)
        if not kernel32.ReadProcessMemory(h, ctypes.c_void_p(bufptr), text, length, None):
            return ''
        return text.value
    except Exception:
        return ''
    finally:
        kernel32.CloseHandle(h)


_cache = {}
_cache_lock = threading.Lock()
MARKERS = ('ihui-ai', 'uvicorn', 'tsx', 'next start', 'app.main')


def why_target(pid):
    now = time.time()
    with _cache_lock:
        hit = _cache.get(pid)
        if hit and now - hit[0] < 30:
            return hit[1]
    exe = get_exe(pid).lower()
    base = os.path.basename(exe)
    why = ''
    if base in ('python.exe', 'node.exe'):
        # 用户口径：Python / Node 的控制台窗口一律不许出现，不再按命令行挑。
        why = 'proc=%s' % base
    elif base in ('pwsh.exe', 'powershell.exe', 'cmd.exe'):
        # 交互终端绝不能被吞。只有命令行确实指向本项目的批处理式 shell 才压制：
        # 用户手开的 pwsh / Windows Terminal，命令行里不会有 -File / -Command 指向 IHUI-AI。
        cmd = get_cmdline(pid).lower()
        if cmd and 'ihui-ai' in cmd and (
            '-file' in cmd or '-command' in cmd or
            '\\deploy\\' in cmd or '/deploy/' in cmd or
            '\\scripts\\' in cmd or '/scripts/' in cmd
        ):
            why = 'shell=ihui-batch'
    elif exe and 'ihui-ai' in exe:
        why = 'exe=%s' % exe
    with _cache_lock:
        _cache[pid] = (now, why)
    return why


_hidden_log = {}


def hide_if_target(hwnd, source):
    try:
        if not hwnd:
            return
        if get_class(hwnd) != 'ConsoleWindowClass':
            return
        if not user32.IsWindowVisible(hwnd):
            return
        pid = get_pid(hwnd)
        why = why_target(pid)
        if not why:
            return
        user32.ShowWindow(hwnd, 0)  # SW_HIDE
        now = time.time()
        with _cache_lock:
            last = _hidden_log.get(hwnd, 0)
            if now - last > 5:
                _hidden_log[hwnd] = now
                log('hidden pid=%d title=%r %s [%s]' % (pid, get_title(hwnd), why, source))
    except Exception:
        pass


WNDENUMPROC = ctypes.WINFUNCTYPE(wt.BOOL, wt.HWND, wt.LPARAM)
WinEventProc = ctypes.WINFUNCTYPE(None, wt.HANDLE, wt.DWORD, wt.HWND, wt.LONG, wt.LONG, wt.DWORD, wt.DWORD)
user32.EnumWindows.argtypes = [WNDENUMPROC, wt.LPARAM]
user32.EnumWindows.restype = wt.BOOL
user32.SetWinEventHook.argtypes = [wt.DWORD, wt.DWORD, ctypes.c_void_p, WinEventProc, wt.DWORD, wt.DWORD, wt.DWORD]
user32.SetWinEventHook.restype = wt.HANDLE


def sweep():
    def cb(hwnd, _):
        hide_if_target(hwnd, 'sweep')
        return True
    user32.EnumWindows(WNDENUMPROC(cb), 0)


def poll_forever():
    while True:
        time.sleep(0.010)
        sweep()


def on_event(_hook, event, hwnd, _id_object, _id_child, _thread, _ms):
    # 不按 idObject 过滤：控制台窗口的 SHOW 事件并不总是带 OBJID_WINDOW，
    # 用类名判断更可靠（hide_if_target 内部第一道就是 ConsoleWindowClass 检查）。
    if event in (EVENT_OBJECT_CREATE, EVENT_OBJECT_SHOW):
        hide_if_target(hwnd, 'hook')


def main():
    mutex = kernel32.CreateMutexW(None, False, MUTEX_NAME)
    if not mutex:
        return 2
    if kernel32.GetLastError() == ERROR_ALREADY_EXISTS:
        return 0

    try:
        kernel32.SetPriorityClass(kernel32.GetCurrentProcess(), 0x00000080)  # HIGH_PRIORITY_CLASS
    except Exception:
        pass
    log('watcher started pid=%d' % os.getpid())
    sweep()
    threading.Thread(target=poll_forever, daemon=True).start()

    proc = WinEventProc(on_event)
    hooks = []
    for ev in (EVENT_OBJECT_CREATE, EVENT_OBJECT_SHOW):
        h = user32.SetWinEventHook(ev, ev, None, proc, 0, 0, WINEVENT_OUTOFCONTEXT)
        if h:
            hooks.append(h)
    log('hooks=%d' % len(hooks))

    msg = wt.MSG()
    while user32.GetMessageW(ctypes.byref(msg), None, 0, 0) > 0:
        user32.TranslateMessage(ctypes.byref(msg))
        user32.DispatchMessageW(ctypes.byref(msg))
    return 0


if __name__ == '__main__':
    sys.exit(main())


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
