' IHUI local scheduler keeper (hidden, auto restart) - 2026-11-18
Option Explicit
Dim sh, rc
Set sh = CreateObject("WScript.Shell")
Do
  rc = sh.Run("""C:\Program Files\nodejs\node.exe"" ""G:\IHUI-AI\scripts\local-scheduler.mjs"" --run", 0, True)
  WScript.Sleep 30000
Loop