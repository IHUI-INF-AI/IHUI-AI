' Hidden launcher for IHUI-CleanBuildGarbage (SW_HIDE, zero visible console window).
' ASCII-only by design: wscript decodes .vbs via the ANSI codepage.
Option Explicit
Dim sh
Set sh = CreateObject("WScript.Shell")
sh.Run """C:\Program Files\PowerShell\7\pwsh.exe"" -NoProfile -ExecutionPolicy Bypass -File ""G:\IHUI-AI\scripts\clean-build-garbage.ps1""", 0, False
