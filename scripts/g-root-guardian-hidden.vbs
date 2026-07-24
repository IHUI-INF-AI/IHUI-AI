' ============================================================================
' G:\ root guardian hidden launcher (VBScript wrapper)
' ============================================================================
' Purpose:
'   Launch g-root-guardian.ps1 with ZERO window popup. Replaces the unreliable
'   "-WindowStyle Hidden" approach which still flashes a console window when
'   launched by Windows Task Scheduler.
'
' Mechanism:
'   wscript.exe is a GUI subsystem binary (no console window at all).
'   WScript.Shell.Run with intWindowStyle=0 (SW_HIDE) launches PowerShell
'   without ever showing its console window.
'
' Usage (manual):
'   wscript.exe "g:\IHUI-AI\scripts\g-root-guardian-hidden.vbs"
'
' Usage (scheduled task):
'   Action: wscript.exe  Argument: "<path-to-this-vbs>"
' ============================================================================

Option Explicit

Dim objShell, strScript, intResult

Set objShell = CreateObject("WScript.Shell")

strScript = "g:\IHUI-AI\scripts\g-root-guardian.ps1"

' intWindowStyle=0 (SW_HIDE), bWaitOnReturn=False (async, do not block wscript)
' PowerShell flags:
'   -ExecutionPolicy Bypass : allow script to run
'   -NoProfile              : skip loading user profile (faster, no side effects)
'   -NoLogo                 : suppress startup banner
'   -File                   : run the script file
intResult = objShell.Run( _
    "powershell.exe -ExecutionPolicy Bypass -NoProfile -NoLogo -File """ & strScript & """", _
    0, _
    False _
)

Set objShell = Nothing
