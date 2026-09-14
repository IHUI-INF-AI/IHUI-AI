@echo off
rem deploy\win\install-deploy-loop-service.cmd — 注册/更新 IHUI-DEPLOYLOOP(nssm 服务)
rem 承载 push→自动部署轮询,替代不可用的计划任务 IHUI-AutoDeploy。
pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-deploy-loop-service.ps1"
if errorlevel 1 (
  echo INSTALL_FAILED
  exit /b 1
)
echo DEPLOY_LOOP_SERVICE_CMD_OK
