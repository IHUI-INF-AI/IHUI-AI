' Hidden launcher for IHUI-PG-Backup scheduled task.
' Runs backup-pg-local.ps1 with SW_HIDE so no console window flashes.
' ASCII only: cscript/wscript decodes .vbs as ANSI, UTF-8 bytes break compile.
' See AGENTS.md section 5b plan-task hard constraints.
Option Explicit
Dim shell, scriptDir, fso, thisFile
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
thisFile = WScript.ScriptFullName
scriptDir = fso.GetParentFolderName(thisFile)
Dim cmd
cmd = "pwsh.exe -NoProfile -ExecutionPolicy Bypass -File " & Chr(34) & scriptDir & "\backup-pg-local.ps1" & Chr(34)
shell.Run cmd, 0, False
