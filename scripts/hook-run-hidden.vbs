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
'   - logname: stdout/stderr are appended to .ihui-agent/state/hook-logs/<logname>.log
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
'
' ----------------------------------------------------------------------------
' 2026-11-04 ROOT FIX: CONCURRENT LOG CONTENTION (DO NOT REGRESS)
'   Pathology (measured, not inferred): several hook invocations of the SAME
'   stage (multi-session parallel commits) all ran
'       cmd /s /c "... >> <log> 2>&1"
'   on the same fixed file. cmd.exe opens a redirect target without sharing
'   writes, so everyone after the first got "The process cannot access the
'   file because it is being used by another process": node never started,
'   rc=1, and the log stayed empty. Reproduced 15/16 failures on this host
'   (see scripts/tests/hook-log-concurrency.test.mjs, N>=8).
'
'   Fix shape: each invocation writes to its OWN file
'       <hook-logs>/<logname>/wsh-<stamp>-<attempt>-<rand>.log
'   (created with overwrite=False, so creation itself is the uniqueness test;
'   WSH exposes no process id, hence stamp+attempt+rand instead of pid), then
'   appends that file to the canonical <logname>.log through a serialized
'   section guarded by an atomic mkdir lock. Why keep the canonical file at
'   all instead of asking every reader to merge directories: six hooks,
'   the rotation job and the log analyzer already tail/rotate <logname>.log.
'   The lock removes the unsynchronized shared-handle race; 'type' copies
'   bytes verbatim (no code-page re-encoding of UTF-8 node output); and the
'   per-run file is the durable primary, so even a failed merge never loses
'   the round (it is kept and recorded in hook-log-layer.log).
'
'   Two failure classes are kept distinguishable in the logs:
'     - hook itself failed   -> rc is propagated untouched (2 = undetermined,
'                               75 = interrupted/retryable) and the appended
'                               trailer records [hook-run-hidden] rc=<n>.
'     - log layer failed     -> rc is still propagated untouched, but the
'                               round is marked log=deferred in
'                               hook-log-layer.log and the run file is kept.
'   Log-layer failure must never turn a green hook red, and must never
'   swallow the hook's own rc.
' ============================================================================

Option Explicit

Dim fso, shell, vbsDir, repoRoot, logName, targetRel, targetAbs
Dim logDir, logPath, runDir, runPath, argsPart, i, a, nodeBin, raw
Dim logCmd, runRc, ts, fh, wbDir, mergeCmd, mergeRc, merged
Dim lockDir, attempt, trailerPath, layerLog, layerLine
Dim mergeTries, statusText

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
Randomize

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
' Environment is passed through untouched (never env -i / never cleared).
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

' Log dir bootstrap (.ihui-agent/state may be missing on fresh clones).
' Concurrent hooks (parallel agent commits) can race on FolderExists, so
' CreateFolder is wrapped idempotently: an "already exists" error must never
' crash this script, because wscript would then pop up a GUI error dialog.
wbDir = fso.BuildPath(fso.BuildPath(repoRoot, ".ihui-agent"), "state")
logDir = fso.BuildPath(wbDir, "hook-logs")
logPath = fso.BuildPath(logDir, logName & ".log")
runDir = fso.BuildPath(logDir, logName)
layerLog = fso.BuildPath(logDir, "hook-log-layer.log")

On Error Resume Next
If Not fso.FolderExists(fso.GetParentFolderName(wbDir)) Then fso.CreateFolder fso.GetParentFolderName(wbDir)
If Not fso.FolderExists(wbDir) Then fso.CreateFolder wbDir
If Not fso.FolderExists(logDir) Then fso.CreateFolder logDir
If Not fso.FolderExists(runDir) Then fso.CreateFolder runDir
Err.Clear
On Error Goto 0

' Per-invocation log file. CreateTextFile(..., False) fails when the name
' already exists, so the create itself is the atomic uniqueness test (no
' check-then-create race between parallel wscript processes).
runPath = UniqueRunPath()

If runPath = "" Then
  ' Cannot even create a private log file (disk/permission fault): still run
  ' the hook and still propagate its rc. Output cannot be captured here.
  logCmd = "cmd.exe /s /c "" """ & nodeBin & """ """ & targetAbs & """" & argsPart & " """
  runRc = shell.Run(logCmd, 0, True)
  LayerNote runRc, "no-capture"
  Set shell = Nothing
  Set fso = Nothing
  WScript.Quit runRc
End If

' Prepend a timestamp marker line so the append-only log stays readable.
ts = "==== " & Now & " :: " & targetRel & argsPart & " ===="
On Error Resume Next
Set fh = fso.OpenTextFile(runPath, 8, True)
If Err.Number = 0 Then
  fh.WriteLine ts
  fh.Close
Else
  Err.Clear
End If
On Error Goto 0

' Run node into the PRIVATE file only. No other process ever redirects into
' this name, so the open cannot collide (the original pathology).
logCmd = "cmd.exe /s /c "" """ & nodeBin & """ """ & targetAbs & """" & argsPart & _
         " >> """ & runPath & """ 2>&1 """
runRc = shell.Run(logCmd, 0, True)

' Trailer: makes hook failure vs log-layer failure readable in the log.
statusText = "[hook-run-hidden] rc=" & CStr(runRc) & " log=append"
trailerPath = runPath & ".end"
On Error Resume Next
Set fh = fso.CreateTextFile(trailerPath, True, False)
If Err.Number = 0 Then
  fh.WriteLine statusText
  fh.Close
Else
  Err.Clear
  trailerPath = ""
End If
On Error Goto 0

' Serialized canonical append: atomic mkdir lock, then 'type run [trailer] >> log'.
' 'type' copies raw bytes, so UTF-8 output is not re-encoded by a text code page.
merged = False
lockDir = fso.BuildPath(logDir, "." & logName & ".merge-lock")
For attempt = 1 To 1200
  On Error Resume Next
  fso.CreateFolder lockDir
  If Err.Number = 0 Then
    Err.Clear
    On Error Goto 0
    If trailerPath = "" Then
      mergeCmd = "cmd.exe /s /c ""type """ & runPath & """ >> """ & logPath & """"
    Else
      mergeCmd = "cmd.exe /s /c ""type """ & runPath & """ """ & trailerPath & """ >> """ & logPath & """"
    End If
    mergeRc = shell.Run(mergeCmd, 0, True)
    If mergeRc = 0 Then
      merged = True
      On Error Resume Next
      fso.DeleteFile runPath, True
      If trailerPath <> "" Then fso.DeleteFile trailerPath, True
      Err.Clear
      On Error Goto 0
    End If
    On Error Resume Next
    fso.DeleteFolder lockDir, True
    Err.Clear
    On Error Goto 0
    Exit For
  Else
    Err.Clear
    ' Stale lock recovery: a killed wscript must not block all future merges.
    On Error Resume Next
    If fso.FolderExists(lockDir) Then
      If DateDiff("s", fso.GetFolder(lockDir).DateLastModified, Now) > 90 Then
        fso.DeleteFolder lockDir, True
      End If
    End If
    Err.Clear
    On Error Goto 0
    WScript.Sleep 10
  End If
Next

If Not merged Then
  ' Log layer failed, hook did NOT: keep the run file as the durable copy and
  ' record the layer fault in a separate (ASCII-only) ledger. rc is untouched.
  LayerNote runRc, "deferred"
End If

Set shell = Nothing
Set fso = Nothing
WScript.Quit runRc

' ----------------------------------------------------------------------------
' Helpers (ASCII only, same codepage trap as the header).
' ----------------------------------------------------------------------------

Function Pad2(n)
  Pad2 = Right("0" & CStr(n), 2)
End Function

Function Stamp()
  Stamp = CStr(Year(Now)) & Pad2(Month(Now)) & Pad2(Day(Now)) & Pad2(Hour(Now)) & _
          Pad2(Minute(Now)) & Pad2(Second(Now)) & "-" & CStr(CLng(Timer() * 1000))
End Function

' Returns "" when no unique name could be created in 60 attempts.
Function UniqueRunPath()
  Dim k, name, fh2
  UniqueRunPath = ""
  For k = 1 To 60
    name = "wsh-" & Stamp() & "-" & CStr(k) & "-" & CStr(Int(Rnd() * 100000000)) & ".log"
    On Error Resume Next
    Set fh2 = fso.CreateTextFile(fso.BuildPath(runDir, name), False, False)
    If Err.Number = 0 Then
      fh2.Close
      Err.Clear
      On Error Goto 0
      UniqueRunPath = fso.BuildPath(runDir, name)
      Exit Function
    End If
    Err.Clear
    On Error Goto 0
  Next
End Function

' Best-effort ASCII ledger for log-layer faults. Never raises, never affects rc.
Sub LayerNote(rc, kind)
  Dim line, tries, baseName
  baseName = ""
  On Error Resume Next
  If Len(runPath) > 0 Then baseName = fso.GetFileName(runPath)
  Err.Clear
  On Error Goto 0
  line = "[hook-run-hidden] " & Stamp() & " log=" & kind & " rc=" & CStr(rc) & _
         " stage=" & logName & " run=" & baseName
  For tries = 1 To 30
    On Error Resume Next
    Set fh = fso.OpenTextFile(layerLog, 8, True)
    If Err.Number = 0 Then
      fh.WriteLine line
      fh.Close
      Err.Clear
      On Error Goto 0
      Exit Sub
    End If
    Err.Clear
    On Error Goto 0
    WScript.Sleep 10
  Next
End Sub
