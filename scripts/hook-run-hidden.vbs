' ============================================================================
' hook-run-hidden.vbs
' Hidden wrapper for node invocations inside git hooks (root fix for the
' "Node console windows keep popping up" pathology).
'
' WHY (2026-09-22, user: "why does my computer keep popping Node windows")
'   Git hooks are executed by git.exe, which inherits the console context of
'   whoever launched git. When git runs inside a console-less context (IDE
'   hidden persistent shell, GUI git panel, WMI-spawned watchdog, spawn with
'   windowsHide), every console-subsystem node.exe in the hook chain gets a
'   NEW visible console window allocated by Windows. A full commit+push can
'   flash 10+ windows (pre-commit's own node even stays alive for minutes).
'   Wrapping through wscript.exe (GUI subsystem, no console at all) +
'   shell.Run(..., 0, True) applies SW_HIDE to the cmd.exe child so nothing
'   ever shows. Same proven technique as git-guardian-hidden.vbs.
'
' USAGE (from .husky/* sh hooks)
'   wscript //nologo scripts/hook-run-hidden.vbs <logname> <script.mjs> [args...]
'   - logname: stdout/stderr are appended to .workbuddy/hook-logs/<logname>.log
'              with a timestamp marker line per invocation.
'   - script:  path relative to repo root (repo root = parent folder of scripts/).
'   The exit code of the wrapped node process is propagated via WScript.Quit
'   (including the special exit 75 "interrupted, retryable" push-gate code).
'
' WHY THIS FILE MUST STAY ASCII-ONLY (important)
'   cscript/wscript decode .vbs using the ANSI codepage, NOT UTF-8. Non-ASCII
'   text (e.g. Chinese comments) gets mis-split into bogus quote characters
'   and the script dies at COMPILE time with "Syntax error", silently under
'   wscript. Same trap as git-guardian-hidden.vbs / AGENTS.md section 27.
'
' QUOTING NOTE
'   cmd.exe /s /c "<whole command>" - with /S, cmd strips ONLY the outermost
'   quote pair, so the inner quoting of node/script/args survives intact.
' ============================================================================

Option Explicit

Dim fso, shell, vbsDir, repoRoot, logName, targetRel, targetAbs
Dim logDir, logPath, argsPart, i, a, nodeBin, raw, cmdLine, runRc
Dim ts, fh, wbDir

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

' Derive repo root from our own location so the repo can be moved without edits.
vbsDir = fso.GetParentFolderName(WScript.ScriptFullName)
repoRoot = fso.GetParentFolderName(vbsDir)

If WScript.Arguments.Count < 2 Then
  WScript.Quit 2
End If

logName = WScript.Arguments(0)
targetRel = WScript.Arguments(1)
targetAbs = fso.BuildPath(repoRoot, targetRel)

If Not fso.FileExists(targetAbs) Then
  WScript.Quit 2
End If

' Node resolution: IHUI_NODE_BIN override, else PATH (same policy as
' git-guardian-hidden.vbs). Appending & "" normalizes Null to "" (VBScript idiom).
raw = shell.Environment("Process").Item("IHUI_NODE_BIN") & ""
If Len(Trim(raw)) = 0 Then
  nodeBin = "node.exe"
Else
  nodeBin = Trim(raw)
End If

' Rebuild args (index 2..n); quote only args that contain a space.
argsPart = ""
For i = 2 To WScript.Arguments.Count - 1
  a = WScript.Arguments(i)
  If InStr(a, " ") > 0 Then
    argsPart = argsPart & " """ & a & """"
  Else
    argsPart = argsPart & " " & a
  End If
Next

' Log dir bootstrap (.workbuddy may be missing on fresh clones).
' Concurrent hooks (parallel agent commits) can race on FolderExists, so
' CreateFolder is wrapped idempotently: an "already exists" error must never
' crash this script, because wscript would then pop up a GUI error dialog.
wbDir = fso.BuildPath(repoRoot, ".workbuddy")
logDir = fso.BuildPath(wbDir, "hook-logs")
logPath = fso.BuildPath(logDir, logName & ".log")

On Error Resume Next
If Not fso.FolderExists(wbDir) Then
  fso.CreateFolder wbDir
End If
If Not fso.FolderExists(logDir) Then
  fso.CreateFolder logDir
End If

' Prepend a timestamp marker line so the append-only log stays readable.
ts = "==== " & Now & " :: " & targetRel & argsPart & " ===="
Set fh = fso.OpenTextFile(logPath, 8, True)
If Not fh Is Nothing Then
  fh.WriteLine ts
  fh.Close
End If
On Error Goto 0

' cmd /s /c "<node> <script> <args> >> <log> 2>&1" - window style 0 (SW_HIDE),
' wait for exit, propagate the exit code.
cmdLine = "cmd.exe /s /c "" """ & nodeBin & """ """ & targetAbs & """" & argsPart & _
          " >> """ & logPath & """ 2>&1 """

runRc = shell.Run(cmdLine, 0, True)

Set shell = Nothing
Set fso = Nothing
WScript.Quit runRc
