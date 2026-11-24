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
rem 2026-11-11 RP-22 收口:幂等口径对齐同目录 install-auto-deploy-task.ps1(:22-26 头注、:52-63、:77-78)。
rem 旧版直接「强制覆盖创建」是先拆后建、非原子:拆掉旧注册后若写入失败,机器上就不再有 IHUI-AutoDeploy。
rem 现口径:先 /query 判在否 —— 在则 /change 就地更新(先改命令行,再改运行身份/提权级别并启用),
rem 不在才 /create(不带强制覆盖开关;同名已存在会被拒绝而非覆盖)。全文件不出现删除任务与强制覆盖写法。
rem /change 改不了 /sc 与 /mo,每 6 分钟的日程只在首次创建时写入。
schtasks /query /tn "IHUI-AutoDeploy" /fo LIST >nul 2>&1
if errorlevel 1 goto :create
rem 已存在:就地更新,任一步失败当场退出;旧注册未被拆掉,任务仍在。
schtasks /change /tn "IHUI-AutoDeploy" /tr ""C:\Program Files\PowerShell\7\pwsh.exe"" -NoProfile -ExecutionPolicy Bypass -File ""%IHUI_ROOT%\deploy\win\ihui-deploy-loop.ps1""
if errorlevel 1 (
  echo CHANGE_FAILED
  exit /b 1
)
schtasks /change /tn "IHUI-AutoDeploy" /ru SYSTEM /rl HIGHEST /ENABLE
if errorlevel 1 (
  echo CHANGE_FAILED
  exit /b 1
)
echo TASK_OK
exit /b 0

:create
schtasks /create /tn "IHUI-AutoDeploy" /tr ""C:\Program Files\PowerShell\7\pwsh.exe"" -NoProfile -ExecutionPolicy Bypass -File ""%IHUI_ROOT%\deploy\win\ihui-deploy-loop.ps1"" /sc MINUTE /mo 6 /ru SYSTEM /rl HIGHEST
if errorlevel 1 (
  echo CREATE_FAILED
  exit /b 1
)
echo TASK_OK
