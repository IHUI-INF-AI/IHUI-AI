Option Explicit
Dim sh, dir, pwsh, script
Set sh = CreateObject("WScript.Shell")
dir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\") - 1)
pwsh = sh.Environment("Process")("IHUI_PWSH_BIN")
If Len(pwsh) = 0 Then pwsh = "C:\Program Files\PowerShell\7\pwsh.exe"
script = dir & "\c-drive-auto-maintain.ps1"
sh.Run """" & pwsh & """ -NoProfile -ExecutionPolicy Bypass -File """ & script & """", 0, False
