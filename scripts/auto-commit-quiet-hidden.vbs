' Hidden launcher for IHUI-AutoCommitQuiet (SW_HIDE, zero visible console window).
' Dynamic: target derived from own location; repo can move to any drive.
' ASCII-only by design: wscript decodes .vbs via the ANSI codepage.
Option Explicit
Dim fso, sh, scriptsDir, target, bin, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
scriptsDir = fso.GetParentFolderName(WScript.ScriptFullName)
target = fso.BuildPath(scriptsDir, "auto-commit-quiet.mjs")
If Not fso.FileExists(target) Then
    Set sh = Nothing : Set fso = Nothing
    WScript.Quit 1
End If
bin = "C:\Program Files\nodejs\node.exe"
If Len(Trim(sh.Environment("Process").Item("IHUI_NODE_BIN") & "")) > 0 Then
    bin = Trim(sh.Environment("Process").Item("IHUI_NODE_BIN") & "")
End If
If InStr(bin, " ") = 0 Then
    cmd = bin & " """ & target & """"
Else
    cmd = """" & bin & """ """ & target & """"
End If
Call sh.Run(cmd, 0, False)
Set sh = Nothing : Set fso = Nothing