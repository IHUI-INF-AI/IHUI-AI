' ============================================================================
' IHUI-AI Guardian Leg-Health Sentinel - Hidden VBS Launcher (Y-72, 2026-11-19)
' ============================================================================
' Launches check-guardian-leg-health-runner.ps1 with SW_HIDE (windowStyle=0)
' so no console window is ever shown when triggered by Task Scheduler.
' wscript.exe is a GUI-subsystem binary (no console at all), unlike
' powershell.exe -WindowStyle Hidden which still flashes a console window.
'
' Path is auto-derived from script location - never hardcode absolute paths.
' Same wrapper pattern as zombie-guardian-hidden.vbs / git-guardian-hidden.vbs.
' ============================================================================

Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
ps1Path = scriptDir & "\check-guardian-leg-health-runner.ps1"

If Not fso.FileExists(ps1Path) Then
    ' Silent fail - cannot show UI from non-interactive task
    WScript.Quit 1
End If

Set WshShell = CreateObject("WScript.Shell")
' 0 = hidden window, False = do not wait for completion
WshShell.Run "pwsh.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File """ & ps1Path & """ -Quiet", 0, False
