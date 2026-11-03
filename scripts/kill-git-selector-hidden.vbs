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
'   Arguments: "<repo root>\scripts\kill-git-selector-hidden.vbs"
'   (the wrapper locates kill-git-selector.ps1 beside itself, so the repo may live
'    on any drive; do not hardcode a drive letter here)
' ============================================================================

Option Explicit

Dim objShell, strScript, intResult, fso, scriptsDir

Set objShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Resolve the target next to this wrapper instead of a hardcoded absolute path.
' The old value "D:\caches\ihui-scripts\kill-git-selector.ps1" pointed at a directory
' that does not exist on this machine, so the task silently launched a missing script.
scriptsDir = fso.GetParentFolderName(WScript.ScriptFullName)
strScript = scriptsDir & "\kill-git-selector.ps1"

' Nothing to do when the wrapped script is absent (bail out silently, no console popup).
If Not fso.FileExists(strScript) Then
  Set fso = Nothing
  Set objShell = Nothing
  WScript.Quit 0
End If
Set fso = Nothing

' intWindowStyle=0 (SW_HIDE), bWaitOnReturn=False
intResult = objShell.Run( _
    "pwsh.exe -ExecutionPolicy Bypass -NoProfile -NoLogo -File """ & strScript & """", _
    0, _
    False _
)

Set objShell = Nothing