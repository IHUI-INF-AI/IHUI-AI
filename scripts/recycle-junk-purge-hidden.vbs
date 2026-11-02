' ============================================================================
' recycle-junk-purge-hidden.vbs
' Launch recycle-junk-purge.mjs --apply with SW_HIDE so no console window
' is shown when the scheduled task fires under InteractiveToken.
'
' WHY: a console subsystem program (node.exe) started directly by Task
' Scheduler under InteractiveToken makes Windows allocate a console window.
' wscript.exe is GUI subsystem, so objShell.Run(..., 0, False) applies SW_HIDE.
' Same pattern as git-guardian-hidden.vbs (see that file for the long form).
'
' KEEP THIS FILE ASCII-ONLY: wscript decodes .vbs with the ANSI codepage.
' ============================================================================

Option Explicit

Dim fso, shell, scriptsDir, nodeBin, target, cmd, raw

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptsDir = fso.GetParentFolderName(WScript.ScriptFullName)
target = fso.BuildPath(scriptsDir, "recycle-junk-purge.mjs")

If Not fso.FileExists(target) Then
    WScript.Quit 1
End If

raw = shell.Environment("Process").Item("IHUI_NODE_BIN") & ""
If Len(Trim(raw)) = 0 Then
    nodeBin = "node.exe"
Else
    nodeBin = Trim(raw)
End If

If InStr(nodeBin, " ") = 0 Then
    cmd = nodeBin & " """ & target & """ --apply"
Else
    cmd = """" & nodeBin & """ """ & target & """ --apply"
End If

' intWindowStyle = 0 (SW_HIDE), bWaitOnReturn = False
Call shell.Run(cmd, 0, False)

Set shell = Nothing
Set fso = Nothing
