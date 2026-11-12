' Hidden launcher for IHUI-Pool-Sync (SW_HIDE, zero visible console window).
' ASCII-only by design: wscript decodes .vbs via the ANSI codepage.
Option Explicit
Dim sh
Set sh = CreateObject("WScript.Shell")
sh.Run """C:\Program Files\nodejs\node.exe"" ""G:\IHUI-AI\scripts\relay-account-pool-sync.mjs"" --if-dirty --apply --all-owners --quiet --log ""G:\IHUI-AI\.tmp\pool-sync.log""", 0, False
