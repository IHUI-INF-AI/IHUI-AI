' Hidden launcher for IHUI-dep-npm-g-install (SW_HIDE, zero visible console window).
' ASCII-only by design: wscript decodes .vbs via the ANSI codepage.
Option Explicit
Dim sh
Set sh = CreateObject("WScript.Shell")
sh.Run "cmd.exe /c ""D:\IHUI-worktrees\run-dep-install-g.cmd""", 0, False
