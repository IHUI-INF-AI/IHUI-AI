' ============================================================================
' mihomo-revive-hidden.vbs
' Launch the Clash Verge mihomo core with SW_HIDE instead of running the
' revive.bat batch file, which always allocates a console window.
'
' WHY: .bat is executed by cmd.exe (console subsystem). Started directly by
' Task Scheduler under InteractiveToken, that shows a black window.
' wscript.exe is GUI subsystem, so objShell.Run(..., 0, False) applies SW_HIDE.
'
' KEEP THIS FILE ASCII-ONLY: wscript decodes .vbs with the ANSI codepage.
' ============================================================================

Option Explicit

Dim shell, cmd

Set shell = CreateObject("WScript.Shell")

cmd = """C:\Program Files\Clash Verge\verge-mihomo.exe"" -d ""C:\Users\Administrator\AppData\Roaming\io.github.clash-verge-rev.clash-verge-rev"""

' intWindowStyle = 0 (SW_HIDE), bWaitOnReturn = False
Call shell.Run(cmd, 0, False)

Set shell = Nothing
