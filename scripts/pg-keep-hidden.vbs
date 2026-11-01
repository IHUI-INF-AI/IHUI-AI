' ============================================================================
' pg-keep-hidden.vbs
' Launch pg_ctl.exe start with SW_HIDE so the 5-minute keep-alive task does
' not flash a console window on the interactive desktop.
'
' WHY: pg_ctl.exe is a console subsystem program. Started directly by Task
' Scheduler under InteractiveToken, Windows allocates a visible console.
' wscript.exe is GUI subsystem, so objShell.Run(..., 0, False) applies SW_HIDE.
'
' KEEP THIS FILE ASCII-ONLY: wscript decodes .vbs with the ANSI codepage.
' ============================================================================

Option Explicit

Dim shell, cmd

Set shell = CreateObject("WScript.Shell")

cmd = """D:/DevEnv/runtimes/pgsql/bin/pg_ctl.exe"" start -D D:/DevEnv/data/pgdata -l D:/DevEnv/logs/pg-boot.log -w -t 60"

' intWindowStyle = 0 (SW_HIDE), bWaitOnReturn = False
Call shell.Run(cmd, 0, False)

Set shell = Nothing
