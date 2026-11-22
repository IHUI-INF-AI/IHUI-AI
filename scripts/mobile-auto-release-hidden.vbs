' Hidden launcher for IHUI-Mobile-AutoRelease (SW_HIDE, zero visible console window).
' Dynamic: target derived from own location; repo can move to any drive.
' ASCII-only by design: wscript decodes .vbs via the ANSI codepage.
Option Explicit
Dim fso, sh, scriptsDir, target, bin, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
scriptsDir = fso.GetParentFolderName(WScript.ScriptFullName)
target = fso.BuildPath(scriptsDir, "mobile-auto-release.ps1")
If Not fso.FileExists(target) Then
    Set sh = Nothing : Set fso = Nothing
    WScript.Quit 1
End If
bin = "C:\Program Files\PowerShell\7\pwsh.exe"
If Len(Trim(sh.Environment("Process").Item("IHUI_PWSH_BIN") & "")) > 0 Then
    bin = Trim(sh.Environment("Process").Item("IHUI_PWSH_BIN") & "")
End If
cmd = """" & bin & """ -NoProfile -ExecutionPolicy Bypass -File """ & target & """"
Call sh.Run(cmd, 0, False)
Set sh = Nothing : Set fso = Nothing