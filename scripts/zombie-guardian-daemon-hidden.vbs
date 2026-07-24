' ============================================================================
' IHUI-AI Zombie Guardian Daemon - Hidden VBS Launcher (v2.0)
' ============================================================================
' Launches zombie-guardian-daemon.ps1 (long-running real-time monitor) with
' SW_HIDE so no console window is shown. wscript.exe is GUI-subsystem (no
' console at all), unlike powershell.exe -WindowStyle Hidden which flashes.
'
' Path auto-derived from script location - never hardcode absolute paths.
' ============================================================================

Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
ps1Path = scriptDir & "\zombie-guardian-daemon.ps1"

If Not fso.FileExists(ps1Path) Then
    WScript.Quit 1
End If

Set WshShell = CreateObject("WScript.Shell")
' 0 = hidden window, False = do not wait (daemon runs forever)
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File """ & ps1Path & """", 0, False
