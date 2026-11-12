' Hidden launcher for IHUI WorkBuddy Growth Sweep (SW_HIDE, zero visible console window).
' ASCII-only by design: wscript decodes .vbs via the ANSI codepage.
Option Explicit
Dim sh
Set sh = CreateObject("WScript.Shell")
sh.Run "cmd.exe /c ""G:\IHUI-AI\deploy\win\workbuddy-growth-sweep.cmd""", 0, False
