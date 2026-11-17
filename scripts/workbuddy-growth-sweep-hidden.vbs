' Hidden launcher for IHUI WorkBuddy Growth Sweep (SW_HIDE, zero visible console window).
' ASCII-only by design: wscript decodes .vbs via the ANSI codepage.
' Path is DERIVED from this file's own location (scripts\ -> repo root), never hardcoded:
' a hardcoded drive letter is exactly what kept this leg dead on a non-G: machine.
Option Explicit
Dim fso, sh, selfName, rootDir, cmdPath
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
selfName = WScript.ScriptFullName
rootDir = fso.GetParentFolderName(fso.GetParentFolderName(selfName))
cmdPath = rootDir & "\deploy\win\workbuddy-growth-sweep.cmd"
sh.Run "cmd.exe /c """ & cmdPath & """", 0, False
