#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 将指定目录下所有顶层条目预约为「下次开机时由系统内核删除」。
# 用途：当某安全软件(如火绒)实时扫描导致删除极慢/挂死时，绕过用户态扫描，
#       借助 Windows PendingFileRenameOperations 在 boot 阶段(火绒未起)直接抹除。
# 不修改任何文件内容，仅向 HKLM\SYSTEM\...\Session Manager\PendingFileRenameOperations 追加预约。
import ctypes
import os
import sys

MOVEFILE_DELAY_UNTIL_REBOOT = 0x4
SE_RESTORE_NAME = "SeRestorePrivilege"
TOKEN_ADJUST_PRIVILEGES = 0x20
TOKEN_QUERY = 0x8


def enable_restore_privilege():
    # 启用 SE_RESTORE_NAME，MoveFileEx(MOVEFILE_DELAY_UNTIL_REBOOT) 需要它
    adv = ctypes.windll.advapi32
    k32 = ctypes.windll.kernel32
    tok = ctypes.c_void_p()
    if not adv.OpenProcessToken(k32.GetCurrentProcess(), TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, ctypes.byref(tok)):
        return False
    luid = ctypes.c_ulonglong()
    if not adv.LookupPrivilegeValueW(None, SE_RESTORE_NAME, ctypes.byref(luid)):
        return False

    class LUID_AND_ATTRS(ctypes.Structure):
        _fields_ = [("Luid", ctypes.c_ulonglong), ("Attributes", ctypes.c_ulong)]

    class TOKEN_PRIVILEGES(ctypes.Structure):
        _fields_ = [("PrivilegeCount", ctypes.c_ulong), ("Privileges", LUID_AND_ATTRS * 1)]

    tp = TOKEN_PRIVILEGES()
    tp.PrivilegeCount = 1
    tp.Privileges[0].Luid = luid.value
    tp.Privileges[0].Attributes = 0x2  # SE_PRIVILEGE_ENABLED
    adv.AdjustTokenPrivileges(tok, False, ctypes.byref(tp), 0, None, None)
    return True


def main():
    target = sys.argv[1] if len(sys.argv) > 1 else r"D:\_wt_trash"
    if not os.path.isdir(target):
        print(f"目标不存在或不是目录: {target}")
        sys.exit(2)

    k32 = ctypes.windll.kernel32
    k32.MoveFileExW.argtypes = [ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_uint32]
    k32.MoveFileExW.restype = ctypes.c_int

    enable_restore_privilege()

    ok = fail = 0
    for name in os.listdir(target):
        full = os.path.join(target, name)
        res = k32.MoveFileExW(full, None, MOVEFILE_DELAY_UNTIL_REBOOT)
        if res:
            ok += 1
        else:
            err = k32.GetLastError()
            fail += 1
            print(f"  FAIL err={err}: {full}")
    print(f"已预约重启删除: {ok} 成功 / {fail} 失败 (共 {ok + fail}) -> {target}")


if __name__ == "__main__":
    main()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
