' IHUI local scheduler keeper (hidden, auto restart) - 2026-11-18
' Dynamic: target derived from own location; repo can move to any drive.
' ASCII-only by design.
Option Explicit
Dim fso, sh, scriptsDir, target, bin, cmd, rc
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
scriptsDir = fso.GetParentFolderName(WScript.ScriptFullName)
target = fso.BuildPath(scriptsDir, "local-scheduler.mjs")
If Not fso.FileExists(target) Then
    Set sh = Nothing : Set fso = Nothing
    WScript.Quit 1
End If
bin = "C:\Program Files\nodejs\node.exe"
If Len(Trim(sh.Environment("Process").Item("IHUI_NODE_BIN") & "")) > 0 Then
    bin = Trim(sh.Environment("Process").Item("IHUI_NODE_BIN") & "")
End If
If InStr(bin, " ") = 0 Then
    cmd = bin & " """ & target & """ --run"
Else
    cmd = """" & bin & """ """ & target & """ --run"
End If
Do
  rc = sh.Run(cmd, 0, True)
  WScript.Sleep 30000
Loop