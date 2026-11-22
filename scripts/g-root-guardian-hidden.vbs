' ============================================================================
' Legacy drive-root guardian hidden launcher (watches the retired dedicated G: drive; no longer scheduled)
' ============================================================================
' Purpose:
'   Launch g-root-guardian.ps1 with ZERO window popup.
'   Dynamic: target derived from own location; repo can move to any drive.
'   ASCII-ONLY (wscript decodes .vbs via ANSI codepage).
' ============================================================================
Option Explicit
Dim objShell, fso, scriptsDir, strScript, intResult
Set fso = CreateObject("Scripting.FileSystemObject")
scriptsDir = fso.GetParentFolderName(WScript.ScriptFullName)
strScript = fso.BuildPath(scriptsDir, "g-root-guardian.ps1")
If Not fso.FileExists(strScript) Then
    Set fso = Nothing
    WScript.Quit 1
End If
Set objShell = CreateObject("WScript.Shell")
intResult = objShell.Run( _
    "pwsh.exe -ExecutionPolicy Bypass -NoProfile -NoLogo -File """ & strScript & """", _
    0, _
    False _
)
Set objShell = Nothing
Set fso = Nothing