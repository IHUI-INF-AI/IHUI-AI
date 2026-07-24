' ============================================================================
' IHUI-AI Zombie Process Guardian - Hidden VBS Launcher
' ============================================================================
' Launches cleanup-zombie-processes.ps1 with SW_HIDE (windowStyle=0) so no
' console window is ever shown when triggered by Task Scheduler.
' wscript.exe is a GUI-subsystem binary (no console at all), unlike
' powershell.exe -WindowStyle Hidden which still flashes a console window.
'
' Path is auto-derived from script location - never hardcode absolute paths.
' ============================================================================

Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
ps1Path = scriptDir & "\cleanup-zombie-processes.ps1"

If Not fso.FileExists(ps1Path) Then
    ' Silent fail - cannot show UI from non-interactive task
    WScript.Quit 1
End If

Set WshShell = CreateObject("WScript.Shell")
' 0 = hidden window, False = do not wait for completion
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File """ & ps1Path & """ -AutoClean -Quiet", 0, False
