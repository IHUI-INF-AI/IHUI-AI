' ============================================================================
' kill-git-selector-hidden.vbs
' VBScript wrapper to launch PowerShell script WITHOUT console window popup
'
' Purpose: Fix the Windows Task Scheduler bug where "-WindowStyle Hidden"
' still flashes a console window. Wrapping via wscript.exe (GUI subsystem)
' with SW_HIDE (0) guarantees zero popup.
'
' Usage (scheduled task):
'   Action: wscript.exe
'   Arguments: "G:\IHUI-AI\scripts\kill-git-selector-hidden.vbs"
' ============================================================================

Option Explicit

Dim objShell, strScript, intResult

Set objShell = CreateObject("WScript.Shell")

strScript = "D:\caches\ihui-scripts\kill-git-selector.ps1"

' intWindowStyle=0 (SW_HIDE), bWaitOnReturn=False
intResult = objShell.Run( _
    "pwsh.exe -ExecutionPolicy Bypass -NoProfile -NoLogo -File """ & strScript & """", _
    0, _
    False _
)

Set objShell = Nothing