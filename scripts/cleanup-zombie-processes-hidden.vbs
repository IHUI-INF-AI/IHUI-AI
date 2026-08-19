' ============================================================================
' cleanup-zombie-processes-hidden.vbs
' VBScript wrapper to launch cleanup-zombie-processes.ps1 WITHOUT window
'
' Purpose: Fix the Windows Task Scheduler bug where "-WindowStyle Hidden"
' still flashes a console window. Wrapping via wscript.exe (GUI subsystem)
' with SW_HIDE (0) guarantees zero popup.
'
' Usage (scheduled task):
'   Action: wscript.exe
'   Arguments: "G:\IHUI-AI\scripts\cleanup-zombie-processes-hidden.vbs"
' ============================================================================

Option Explicit

Dim objShell, strScript, intResult

Set objShell = CreateObject("WScript.Shell")

strScript = "G:\IHUI-AI\scripts\cleanup-zombie-processes.ps1"

' intWindowStyle=0 (SW_HIDE), bWaitOnReturn=False
' -AutoClean -Quiet for scheduled task mode
intResult = objShell.Run( _
    "pwsh.exe -ExecutionPolicy Bypass -NoProfile -NoLogo -File """ & strScript & """ -AutoClean -Quiet", _
    0, _
    False _
)

Set objShell = Nothing