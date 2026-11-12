' Hidden launcher for IHUI-AutoCommitQuiet (SW_HIDE, zero visible console window).
' ASCII-only by design: wscript decodes .vbs via the ANSI codepage.
Option Explicit
Dim sh
Set sh = CreateObject("WScript.Shell")
sh.Run """C:\Program Files\nodejs\node.exe"" G:\IHUI-AI\scripts\auto-commit-quiet.mjs", 0, False
