' ============================================================================
' log-prune-hidden.vbs
' Launch log-prune.cmd with SW_HIDE so no console window shows.
'
' WHY A WRAPPER IS REQUIRED
'   The task runs under InteractiveToken. Executing a console subsystem program
'   (cmd.exe / node.exe) directly makes Windows DISPLAY a console window.
'   wscript.exe is GUI subsystem and objShell.Run(..., 0, False) applies
'   SW_HIDE. Same rule as every other *-hidden.vbs in this directory
'   (AGENTS.md section 26). The real command line (with its output
'   redirection, which WshShell.Run cannot express reliably) lives in
'   scripts\log-prune.cmd next to this file.
'
' WHY THIS FILE MUST STAY ASCII-ONLY
'   cscript/wscript decode .vbs using the ANSI codepage, NOT UTF-8. Non-ASCII
'   text gets mis-split into bogus quote characters and the script dies at
'   COMPILE time (AGENTS.md section 26/27). Do not add non-ASCII text here.
'
' AUDIT
'   Output appends to D:\DevEnv\logs\log-prune.log (see the .cmd). That file
'   name does not match the svc-* rotation globs, so it is never a prune
'   candidate and is never collected by promtail.
' ============================================================================

Option Explicit

Dim sh, fso, scriptDir, cmdFile

Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
cmdFile = scriptDir & "\log-prune.cmd"

' intWindowStyle = 0 (SW_HIDE), bWaitOnReturn = False
Call sh.Run("cmd /c " & Chr(34) & cmdFile & Chr(34), 0, False)

Set sh = Nothing
Set fso = Nothing
