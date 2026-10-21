' ============================================================================
' worktree-reap-hidden.vbs
' Launch scripts/reap-worktrees.mjs --auto with SW_HIDE so no console window appears.
'
' WHY A WRAPPER IS REQUIRED
'   The task runs under S4U; directly executing a console subsystem program
'   (node.exe) can still surface a console in some launch paths. wscript.exe is
'   GUI subsystem and objShell.Run(..., 0, False) applies SW_HIDE, the same
'   pattern used by git-guardian-hidden.vbs / kill-git-selector-hidden.vbs.
'
' WHY THIS FILE MUST STAY ASCII-ONLY
'   cscript/wscript decode .vbs in the ANSI codepage, NOT UTF-8. Non-ASCII text
'   gets mis-split into bogus characters and the script dies at COMPILE time
'   under wscript with no visible error.
' ============================================================================

Option Explicit

Dim fso, shell, scriptsDir, repoRoot, target, logPath, nodeBin, cmd, raw

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

' Derive paths from our own location so the repo can be moved without editing.
scriptsDir = fso.GetParentFolderName(WScript.ScriptFullName)
repoRoot = fso.GetParentFolderName(scriptsDir)
target = fso.BuildPath(scriptsDir, "reap-worktrees.mjs")
logPath = fso.BuildPath(repoRoot, ".workbuddy\worktree-reap.log")

If Not fso.FileExists(target) Then
    WScript.Quit 1
End If

' Environment().Item(<missing key>) returns Null and Len(Null) raises
' "Type mismatch"; appending & "" normalizes Null to an empty string.
raw = shell.Environment("Process").Item("IHUI_NODE_BIN") & ""
If Len(Trim(raw)) = 0 Then
    nodeBin = "node.exe"
Else
    nodeBin = Trim(raw)
End If

' A quoted bare program name is resolved as a literal file name and fails;
' quote only when the path really contains a space.
If InStr(nodeBin, " ") = 0 Then
    cmd = nodeBin & " """ & target & """ --auto --log """ & logPath & """"
Else
    cmd = """" & nodeBin & """ """ & target & """ --auto --log """ & logPath & """"
End If

' intWindowStyle = 0 (SW_HIDE), bWaitOnReturn = False
Call shell.Run(cmd, 0, False)

Set shell = Nothing
Set fso = Nothing
