' Hidden launcher for IHUI-SilentGuard (SW_HIDE, zero visible console window).
' Runs the whole-machine "no popup window" audit + self-heal every 10 minutes.
' ASCII-only by design: wscript decodes .vbs via the ANSI codepage.
Option Explicit
Dim sh, rc
Set sh = CreateObject("WScript.Shell")
rc = sh.Run("""C:\Program Files\nodejs\node.exe"" ""G:\IHUI-AI\scripts\ensure-silent-tasks.mjs""", 0, True)
WScript.Quit rc
