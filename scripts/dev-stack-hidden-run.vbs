' ============================================================================
' dev-stack-hidden-run.vbs
' Hidden-console launcher for dev-stack services (root fix for the recurring
' "node.exe console window" pathology, phase 4, 2026-10-12).
'
' WHY THIS EXISTS
'   The old chain (dev-stack.mjs -> dev-stack-launch.mjs -> service) spawns
'   every hop detached + windowsHide (CREATE_NO_WINDOW), so NO process in the
'   chain owns a console. Supervisor entries (tsx watch / next dev / expo)
'   then spawn their workers WITHOUT windowsHide (that spawn site lives in
'   node_modules and cannot be patched), and Windows allocates a NEW VISIBLE
'   console for each such worker. Measured on this box: the dev api's tsx
'   tree respawned its node.exe window with a fresh pid on every 30s
'   watchdog retry. Adding more windowsHide flags cannot fix this -- the
'   offending spawn is inside tsx/next/expo, not in our code.
'
' THE FIX (structurally windowless, not flag-by-flag)
'   wscript.exe is a GUI-subsystem host with no console of its own.
'   shell.Run(cmd, 0, True) creates the cmd child with SW_HIDE, so cmd owns
'   a HIDDEN console. Every descendant of that cmd -- the service AND the
'   workers the service spawns internally -- inherits the hidden console,
'   so no process in the tree can ever allocate a visible one. Same proven
'   technique as hook-run-hidden.vbs (git hooks) and the guardian tasks.
'   Logging: cmd redirects (>> and 2>>) into the same dev-stack log files,
'   so .tmp-sync/dev-stack-<name>.log keeps working unchanged.
'
' WHY ASCII ONLY
'   cscript/wscript decode .vbs with the ANSI codepage, NOT UTF-8. Non-ASCII
'   text dies at COMPILE time, silently under wscript (same trap as
'   hook-run-hidden.vbs / git-guardian-hidden.vbs).
'
' USAGE (spawned by scripts/dev-stack-launch.mjs; do not run by hand)
'   wscript //nologo dev-stack-hidden-run.vbs "<exe>" "<cwd>" "<outLog>" "<errLog>" [args...]
'   The wrapper stays alive (Run ..., True) as the tree root; its pid is what
'   dev-stack-launch records in the .pid file, so killStale's
'   taskkill /T /F takes out the whole tree.
' ============================================================================

Option Explicit

Dim shell, exe, cwd, outLog, errLog, i, cmd, rc
Set shell = CreateObject("WScript.Shell")

If WScript.Arguments.Count < 4 Then
  WScript.Quit 2
End If

exe = WScript.Arguments(0)
cwd = WScript.Arguments(1)
outLog = WScript.Arguments(2)
errLog = WScript.Arguments(3)

' cmd /s /c strips ONLY the outermost quote pair (/S), so the inner quoting
' of exe/args survives intact -- same shape as hook-run-hidden.vbs.
cmd = "cmd.exe /s /c "" cd /d """ & cwd & """ && """ & exe & """"
For i = 4 To WScript.Arguments.Count - 1
  cmd = cmd & " """ & WScript.Arguments(i) & """"
Next
cmd = cmd & " >> """ & outLog & """ 2>> """ & errLog & """ """

rc = shell.Run(cmd, 0, True)
WScript.Quit rc
