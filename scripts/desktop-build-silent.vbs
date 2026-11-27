' Hidden launcher for scripts/desktop-build.mjs -- background, zero visible console.
' ASCII-only by design: wscript decodes .vbs via the ANSI codepage.
' Usage: wscript //B scripts\desktop-build-silent.vbs [--debug | --dev | -- --bundles nsis ...]
' Log:   .tmp\desktop-build-silent.log
Option Explicit
Dim sh, fso, repo, logDir, logPath, full, i
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
repo = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
logDir = repo & "\.tmp"
If Not fso.FolderExists(logDir) Then fso.CreateFolder(logDir)
logPath = logDir & "\desktop-build-silent.log"
full = "cmd /d /s /c ""cd /d " & repo & " && node scripts\desktop-build.mjs"
For i = 0 To WScript.Arguments.Count - 1
  full = full & " " & WScript.Arguments(i)
Next
full = full & " >> """ & logPath & """ 2>&1"""
WScript.Quit sh.Run(full, 0, True)
