@echo off
rem deploy\win\install-auto-deploy-task.cmd — 注册/更新 push→自动部署轮询任务(每 6 分钟)
rem 仓库根不写死盘符(旧版硬编码到生产机盘符):本文件在 deploy\win\ 下,根 = %~dp0..\..,
rem 由 %~dp0 推导并规范化为绝对路径,否则错根会被烤进计划任务注册数据,改脚本也不生效。
for %%I in ("%~dp0..\..") do set "IHUI_ROOT=%%~fI"
rem 护栏:根下必须有 package.json,解析不对就当场退出,绝不带着错根继续注册任务。
if not exist "%IHUI_ROOT%\package.json" (
  echo ROOT_RESOLVE_FAILED: %IHUI_ROOT%
  exit /b 1
)
rem 2026-11-07 DBG-80 收口:/tr 值改用 `""`(双引号)转义内嵌引号,而非 `\"`。
rem 旧写法 "...\ihui-deploy-loop.ps1\"" 末尾 `\"` 在 cmd 里被解析为「字面反斜杠 + 闭合引号」,
rem 注册出的 Task To Run 脚本路径带尾反斜杠 ⇒ pwsh 找不到文件,每 6 分钟静默失败。
rem `""` 是 cmd 文档明确的内嵌引号转义(`""`→`"`),尾段 `...ps1"" ` 解析后只留一个 `"`、无反斜杠。
rem 正确标杆见同目录 install-auto-deploy-task.ps1:47($runCmd 用 pwsh 数组展开各自带引号)。
schtasks /create /tn "IHUI-AutoDeploy" /tr ""C:\Program Files\PowerShell\7\pwsh.exe"" -NoProfile -ExecutionPolicy Bypass -File ""%IHUI_ROOT%\deploy\win\ihui-deploy-loop.ps1"" /sc MINUTE /mo 6 /ru SYSTEM /rl HIGHEST /f
if errorlevel 1 (
  echo CREATE_FAILED
  exit /b 1
)
echo TASK_OK