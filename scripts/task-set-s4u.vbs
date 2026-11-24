' ============================================================================
' task-set-s4u.vbs -- switch a scheduled task to S4U logon (runs whether or not
' the user is logged on), without needing PowerShell cmdlets.
'
' WHY THIS EXISTS (both other routes are dead ends on this machine, 2026-09-23)
'   1) schtasks /Create /RU <user> /NP  -> it PROMPTS for the account password,
'      so it cannot be run non-interactively. Verified: it just asks.
'   2) Register-ScheduledTask/Get-ScheduledTask -> this box's pwsh has no
'      ScheduledTasks module ("The term 'Get-ScheduledTask' is not recognized"),
'      which is exactly why the guardian's own S4U check could never succeed and
'      re-registered itself every 2 minutes.
'   Schedule.Service COM needs neither, so we patch the task definition in place.
'   LogonType numbers: 0 NONE, 1 PASSWORD, 2 S4U, 3 INTERACTIVE_TOKEN,
'   4 GROUP, 5 SERVICE_ACCOUNT, 6 UNLOCK.
'
' WHY ASCII ONLY -- cscript/wscript decode .vbs with the ANSI codepage, not
'   UTF-8; non-ASCII text is mis-split into bogus quotes and kills the file at
'   COMPILE time, silently under wscript (AGENTS.md section 27 same trap).
'
' Usage: cscript //nologo task-set-s4u.vbs "TaskName" [/show]
' Exit:  0 = ok (or already S4U), 1 = refused/failed.
' ============================================================================
Option Explicit

Const SI_LOGON_S4U = 2
Const TASK_CREATE_OR_UPDATE = 6

Dim args, name, showOnly, i
name = ""
showOnly = False
For i = 0 To WScript.Arguments.Count - 1
    If LCase(WScript.Arguments(i)) = "/show" Then
        showOnly = True
    ElseIf name = "" Then
        name = WScript.Arguments(i)
    End If
Next
If name = "" Then
    WScript.Echo "usage: cscript //nologo task-set-s4u.vbs ""TaskName"" [/show]"
    WScript.Quit 1
End If

Dim svc, folder, task, xml, logonNow
Set svc = CreateObject("Schedule.Service")
svc.Connect ""
Set folder = svc.GetFolder("\")
Set task = folder.GetTask(name)
xml = task.Xml
logonNow = GetTag(xml, "LogonType")
WScript.Echo name & " LogonType=" & logonNow & "  RunAs=" & GetTag(xml, "UserId")
If showOnly Then WScript.Quit 0
If logonNow = "S4U" Then
    WScript.Echo "already S4U, nothing to do"
    WScript.Quit 0
End If
If logonNow <> "InteractiveToken" Then
    WScript.Echo "unexpected logon form, refusing to guess (extend this script by hand after checking)"
    WScript.Quit 1
End If

' Keep the XML's own <UserId> (it is an SID for a local account). Passing a
' name + empty password to RegisterTaskDefinition makes the API validate the
' credentials and fail with "user name or password is incorrect" (verified),
' while omitting them keeps the definition's principal and lets the patched
' LogonType take effect.
Dim patched
patched = Replace(xml, "<LogonType>InteractiveToken</LogonType>", "<LogonType>S4U</LogonType>")
If patched = xml Then
    WScript.Echo "replace did not change anything, aborting"
    WScript.Quit 1
End If

' ITaskDefinition from an existing task exposes a READ-ONLY XmlText, and
' RegisterTaskDefinition with (name, def, flags) or (name, def, flags, user, "", 2)
' both reject on this box ("not a valid value" / empty description). The shape
' that works here (verified 2026-09-23 on a throwaway task) is:
'     def = service.NewTask(0)      ' fresh definition; its XmlText IS writable
'     def.XmlText = <patched xml>
'     folder.RegisterTaskDefinition name, def, 6, <SID>, Null, 2
' i.e. carry the account as the SID already present in the XML, pass Null (not "")
' for the password, and S4U = 2.
Dim def, sidUser
sidUser = GetTag(patched, "UserId")
If sidUser = "" Then
    WScript.Echo "no <UserId> in definition, refusing"
    WScript.Quit 1
End If
Set def = svc.NewTask(0)
def.XmlText = patched
On Error Resume Next
' no `Call` here on purpose: with Call, arguments are evaluated as expressions and
' the Null password raises VBScript "object required". The bare statement form is
' what was verified to work.
folder.RegisterTaskDefinition name, def, TASK_CREATE_OR_UPDATE, sidUser, Null, SI_LOGON_S4U
If Err.Number <> 0 Then
    WScript.Echo "register failed: " & Err.Description
    WScript.Quit 1
End If
On Error GoTo 0

' verify from the store, not from memory.
' (no `Is Nothing` test: Xml is a BSTR property, and comparing a string to
'  Nothing raises VBScript "object required" -- which earlier made this script
'  report a failure even though the registration had already succeeded.)
Dim again
Set again = folder.GetTask(name)
If GetTag(again.Xml, "LogonType") <> "S4U" Then
    WScript.Echo "VERIFY FAILED, actual=" & GetTag(again.Xml, "LogonType")
    WScript.Quit 1
End If
WScript.Echo "OK switched to S4U, RunAs=" & GetTag(again.Xml, "UserId")

Function GetTag(s, elem)
    Dim a, b
    a = InStr(s, "<" & elem & ">")
    If a = 0 Then
        GetTag = ""
        Exit Function
    End If
    a = a + Len(elem) + 2
    b = InStr(a, s, "</" & elem & ">")
    GetTag = Mid(s, a, b - a)
End Function


