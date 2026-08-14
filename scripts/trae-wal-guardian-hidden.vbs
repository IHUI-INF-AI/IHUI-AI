' ============================================================================
' trae-wal-guardian-hidden.vbs
' VBScript wrapper to launch wal_cleaner.ps1 WITHOUT console window popup
'
' Purpose: Fix the Windows Task Scheduler bug where "-WindowStyle Hidden"
' still flashes a console window.
' ============================================================================

Option Explicit

Dim objShell, strScript, intResult

Set objShell = CreateObject("WScript.Shell")

strScript = "F:\TraeCN_Data\wal_cleaner.ps1"

' intWindowStyle=0 (SW_HIDE), bWaitOnReturn=False
intResult = objShell.Run( _
    "pwsh.exe -ExecutionPolicy Bypass -NoProfile -NoLogo -File """ & strScript & """", _
    0, _
    False _
)

Set objShell = Nothing