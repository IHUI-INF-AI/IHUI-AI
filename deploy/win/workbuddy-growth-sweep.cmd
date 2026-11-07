@echo off
REM WorkBuddy account-pool zero-touch sweep:
REM   daily check-in -> claim items the server already judged "completed"
REM   -> report subscribe-task relation and growth profile, as one JSON object.
REM Idempotent. Log: .ihui-agent\state\workbuddy-sweep.log
REM Carrier: scheduled task "IHUI WorkBuddy Growth Sweep" (every 6 hours).
REM NOTE: keep this file ASCII-only. cmd.exe parses .cmd with the OEM codepage
REM (936 on this box), so UTF-8 Chinese comments get mis-read as commands.
REM This file lives in deploy\win\ -> repo root is TWO levels up, not three.
cd /d "%~dp0..\.."
if not exist ".ihui-agent\state" mkdir ".ihui-agent\state"
node scripts\workbuddy-growth-sweep.mjs --json >> ".ihui-agent\state\workbuddy-sweep.log" 2>&1
