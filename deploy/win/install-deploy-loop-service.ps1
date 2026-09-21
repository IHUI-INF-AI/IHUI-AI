# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# deploy\win\install-deploy-loop-service.ps1 — 注册/更新 IHUI-DEPLOYLOOP(nssm 服务)
#
# 用 nssm 服务承载 push→自动部署轮询,替代计划任务 IHUI-AutoDeploy。
#
# 为什么不用 Task Scheduler(2026-09-13 实测,三重不可用):
#   1) schtasks.exe 被安全策略列入程序黑名单,不可绕过;
#   2) ScheduledTasks 模块随 C:\Windows\System32\WindowsPowerShell\v1.0\Modules
#      一并消失(该目录已被 PS7 Core 文件覆盖,WinSxS 亦无副本),
#      Get-ScheduledTask / Register-ScheduledTask 均不可用;
#   3) Schedule 服务受保护,Stop/Restart 均 Access Denied,任务定义无法热重载。
# 本机其余周期性任务(IHUI-MONITOR / IHUI-GIT-GUARD / IHUI-PG-BACKUP / ihui-alert-bridge)
# 本就全部是 nssm 服务 → 部署循环归入同一模型,不再依赖任何 Task Scheduler 能力。
#
# 幂等策略:服务**已存在则就地更新配置**(nssm set),不存在才 nssm install。
#   刻意不做"先删后建":运行中的服务删除会因权限/句柄而失败(实测 CreateService 拒绝访问),
#   且会短暂断掉部署守护。就地 set 不影响正在运行的进程,重启服务即可生效。
#
# 用法: pwsh -NoProfile -ExecutionPolicy Bypass -File deploy\win\install-deploy-loop-service.ps1
# =============================================================================
$ErrorActionPreference = 'Stop'
$svc      = 'IHUI-DEPLOYLOOP'
$nssm     = 'C:\windows\system32\nssm.exe'
$pwshPath = 'C:\Program Files\PowerShell\7\pwsh.exe'
$loopPath = 'D:\IHUI-AI\deploy\win\ihui-deploy-loop.ps1'
$logDir   = 'D:\DevEnv\logs'
$appDir   = 'D:\IHUI-AI'

foreach ($p in @($nssm, $pwshPath, $loopPath)) {
    if (-not (Test-Path $p)) { throw "缺失依赖: $p" }
}
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

$params = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -Daemon' -f $loopPath

# ---- 存在性探测(nssm get 的退出码为准) ----
& $nssm get $svc Application *> $null
$exists = ($LASTEXITCODE -eq 0)

if (-not $exists) {
    Write-Host "新建服务 $svc"
    & $nssm install $svc $pwshPath $params
    if ($LASTEXITCODE -ne 0) { throw "nssm install 失败(exit $LASTEXITCODE)" }
} else {
    Write-Host "已存在 $svc,就地更新配置"
    & $nssm set $svc Application $pwshPath
    if ($LASTEXITCODE -ne 0) { throw "nssm set Application 失败(exit $LASTEXITCODE)" }
    & $nssm set $svc AppParameters $params
    if ($LASTEXITCODE -ne 0) { throw "nssm set AppParameters 失败(exit $LASTEXITCODE)" }
}

$settings = @(
    @('AppDirectory',    $appDir),
    @('AppStdout',       (Join-Path $logDir 'svc-deployloop-nssm.log')),
    @('AppStderr',       (Join-Path $logDir 'svc-deployloop-nssm-err.log')),
    @('AppRestartDelay', '15000'),
    @('Start',           'SERVICE_AUTO_START'),
    @('DisplayName',     'IHUI Auto Deploy Loop'),
    @('Description',     'IHUI-AI push->auto deploy poll. Replaces Task Scheduler task IHUI-AutoDeploy (never ran once; see ihui-deploy-loop.ps1 header).'),
    @('ObjectName',      'LocalSystem')
)
foreach ($s in $settings) {
    & $nssm set $svc $s[0] $s[1] | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "nssm set $($s[0]) 失败(exit $LASTEXITCODE)" }
}

# ---- 确保处于运行态 ----
# nssm 的 stdout 实测含 NUL 字节,必须先剥掉再判等,否则 -match 恒失败、
# 会对已在运行的服务重复 nssm start 并报 "服务已经启动" 而抛错。
$st = ((& $nssm status $svc 2>&1 | Out-String) -replace "`0", '').Trim()
if ($st -notmatch '^SERVICE_RUNNING') {
    & $nssm start $svc
    if ($LASTEXITCODE -ne 0) { throw "nssm start 失败(exit $LASTEXITCODE)" }
    Start-Sleep -Seconds 5
}

# ---- 验证 ----
Write-Host '--- 验证 ---'
foreach ($k in @('Application','AppParameters','AppDirectory','AppStdout','AppStderr','Start','ObjectName','AppRestartDelay')) {
    Write-Host ("{0} = {1}" -f $k, (((& $nssm get $svc $k 2>&1 | Out-String) -replace "`0", '').Trim()))
}
Write-Host ('status = ' + (Get-Service -Name $svc).Status)
Write-Host 'DEPLOY_LOOP_SERVICE_OK'
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
