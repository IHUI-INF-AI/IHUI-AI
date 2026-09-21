' ============================================================================
' git-guardian-hidden.vbs
' Launch git-guardian.mjs with SW_HIDE so no console window is shown.
'
' WHY A WRAPPER IS REQUIRED
'   The task runs under InteractiveToken. Executing a console subsystem program
'   (node.exe) directly makes Windows DISPLAY a console window, so the desktop
'   flashed a black window every 2 minutes (regression observed 2026-09-20 right
'   after this task was first registered). "-WindowStyle Hidden" still flashes,
'   which is why every other task in this repo (DevProcessCleanup /
'   KillGitSelector) wraps through wscript.exe: it is GUI subsystem and
'   objShell.Run(..., 0, False) applies SW_HIDE.
'
' WHY THIS FILE MUST STAY ASCII-ONLY (important)
'   cscript/wscript decode .vbs using the ANSI codepage, NOT UTF-8. Non-ASCII
'   comments (e.g. Chinese) get mis-split into bogus quote characters and the
'   script dies at COMPILE time with "Syntax error", silently under wscript.
'   Same class of trap as AGENTS.md section 27 (PowerShell 5.1 / ANSI codepage).
'   Do not add non-ASCII text to this file.
'
' Registration: node scripts/git-guardian.mjs --install  (registers THIS file,
' never node.exe directly).
' ============================================================================

Option Explicit

Dim fso, shell, scriptsDir, nodeBin, target, cmd, raw

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

' Derive paths from our own location so the repo can be moved without editing.
scriptsDir = fso.GetParentFolderName(WScript.ScriptFullName)
target = fso.BuildPath(scriptsDir, "git-guardian.mjs")

If Not fso.FileExists(target) Then
    WScript.Quit 1
End If

' Optional override via environment variable; otherwise rely on PATH.
' Environment().Item(<missing key>) returns Null and Len(Null) returns Null,
' which makes the comparison raise "Type mismatch" and abort silently.
' Appending & "" normalizes Null to an empty string (required VBScript idiom).
raw = shell.Environment("Process").Item("IHUI_NODE_BIN") & ""
If Len(Trim(raw)) = 0 Then
    nodeBin = "node.exe"
Else
    nodeBin = Trim(raw)
End If

' In the string given to WshShell.Run the program name must NOT be quoted:
' a quoted bare name is resolved as a literal file name and fails. Quote it
' only when it really contains a space. Same form as the known-working
' kill-git-selector-hidden.vbs.
If InStr(nodeBin, " ") = 0 Then
    cmd = nodeBin & " """ & target & """"
Else
    cmd = """" & nodeBin & """ """ & target & """"
End If

' intWindowStyle = 0 (SW_HIDE), bWaitOnReturn = False
Call shell.Run(cmd, 0, False)

Set shell = Nothing
Set fso = Nothing
