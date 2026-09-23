Option Explicit
Dim sh, dir, node, script
Set sh = CreateObject("WScript.Shell")
dir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\") - 1)
node = sh.Environment("Process")("IHUI_NODE_BIN")
If Len(node) = 0 Then node = "node.exe"
script = dir & "\check-credential-health.mjs"
sh.Run """" & node & """ """ & script & """ --json", 0, False