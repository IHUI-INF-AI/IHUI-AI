' ============================================================================
' git-backup-refresh-hidden.vbs
' VBScript wrapper: run scripts/git-backup-refresh.mjs WITHOUT a console window.
'
' Why a wrapper at all (AGENTS.md: scheduled tasks + .vbs hard constraints):
'   under InteractiveToken, "/tr node.exe xxx" ALWAYS shows a console window.
'   wscript.exe is a GUI-subsystem host and objShell.Run(cmd, 0, False) = SW_HIDE.
'
' Why this task exists:
'   git-guardian READS the local recovery source (cpSync BACKUP -> .git) but nobody
'   UPDATED it. Measured 2026-09-24 04:40: the backup sat 97 commits behind main, so a
'   host-side .git deletion would have rolled back 97 commits (same failure shape that
'   destroyed 15 unpushed commits on 2026-09-23 15:49). This refreshes it incrementally.
'
' Scheduled task action (do not hardcode a drive letter in this file):
'   wscript.exe "<repo root>\scripts\git-backup-refresh-hidden.vbs"
' This wrapper resolves both node.exe and the target script relative to itself, so the
' repo may live on any drive.
'
' NOTE: keep this file pure ASCII. cscript/wscript decode .vbs with the ANSI code page
' (GBK here); UTF-8 Chinese comments get mis-tokenized and fail at compile time while
' schtasks still reports success.
' ============================================================================

Option Explicit

Dim objShell, fso, scriptsDir, nodeExe, nodeTok, target, cmd, intResult

Set objShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptsDir = fso.GetParentFolderName(WScript.ScriptFullName)
target = scriptsDir & "\git-backup-refresh.mjs"

If Not fso.FileExists(target) Then
  ' Nothing to do when the wrapped script is absent (bail out silently, no popup).
  Set fso = Nothing
  Set objShell = Nothing
  WScript.Quit 0
End If

' Node resolution order: repo-documented absolute path, then PATH fallback.
nodeExe = "C:\Program Files\nodejs\node.exe"
If Not fso.FileExists(nodeExe) Then nodeExe = "node"

' A bare program name must NOT be quoted (WshShell.Run parses "node" literally and
' fails); quote only paths that really contain a space.
If InStr(nodeExe, " ") > 0 Then
  nodeTok = """" & nodeExe & """"
Else
  nodeTok = nodeExe
End If

' --quiet keeps the healthy path log-silent; the script never writes inside the
' worktree and never deletes anything.
cmd = nodeTok & " """ & target & """ --quiet"

' intWindowStyle = 0 (SW_HIDE), bWaitOnReturn = False
intResult = objShell.Run(cmd, 0, False)

Set fso = Nothing
Set objShell = Nothing
