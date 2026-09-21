@echo off
rem deploy\win\install-auto-deploy-task.cmd — 注册/更新 push→自动部署轮询任务(每 6 分钟)
schtasks /create /tn "IHUI-AutoDeploy" /tr "\"C:\Program Files\PowerShell\7\pwsh.exe\" -NoProfile -ExecutionPolicy Bypass -File \"D:\IHUI-AI\deploy\win\ihui-deploy-loop.ps1\"" /sc MINUTE /mo 6 /ru SYSTEM /rl HIGHEST /f
if errorlevel 1 (
  echo CREATE_FAILED
  exit /b 1
)
echo TASK_OK