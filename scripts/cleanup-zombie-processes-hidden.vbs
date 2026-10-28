' ============================================================================
' cleanup-zombie-processes-hidden.vbs
' VBScript wrapper to launch cleanup-zombie-processes.ps1 WITHOUT window
'
' Purpose: Fix the Windows Task Scheduler bug where "-WindowStyle Hidden"
' still flashes a console window. Wrapping via wscript.exe (GUI subsystem)
' with SW_HIDE (0) guarantees zero popup.
'
' G-266 (2026-09-27): the target path used to be hardcoded to G:\IHUI-AI,
' a drive letter that does not exist on this machine, so every scheduled run
' silently launched pwsh against a missing file. The path is now derived
' from WScript.ScriptFullName (same pattern as git-guardian-hidden.vbs and
' zombie-guardian-hidden.vbs) so the repo can move without editing this file.
'
' Keep this file ASCII-ONLY: cscript/wscript decode .vbs with the ANSI
' codepage, not UTF-8 (see the header of git-guardian-hidden.vbs).
'
' Usage (scheduled task):
'   Action:    wscript.exe
'   Arguments: "<repo-root>\scripts\cleanup-zombie-processes-hidden.vbs"
' ============================================================================

Option Explicit

Dim fso, objShell, scriptDir, strScript, cmd

Set fso = CreateObject("Scripting.FileSystemObject")
Set objShell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
strScript = fso.BuildPath(scriptDir, "cleanup-zombie-processes.ps1")

If Not fso.FileExists(strScript) Then
    ' Silent fail - cannot show UI from a non-interactive task.
    Set objShell = Nothing
    Set fso = Nothing
    WScript.Quit 1
End If

' -AutoClean -Quiet = scheduled task mode. intWindowStyle=0 (SW_HIDE),
' bWaitOnReturn=False.
cmd = "pwsh.exe -ExecutionPolicy Bypass -NoProfile -NoLogo -File """ & strScript & """ -AutoClean -Quiet"
Call objShell.Run(cmd, 0, False)

Set objShell = Nothing
Set fso = Nothing
