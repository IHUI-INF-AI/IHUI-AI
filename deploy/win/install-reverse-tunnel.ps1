# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# ============================================================
#  IHUI 反向隧道常驻安装脚本（在目标机 Windows 上运行，一次即可）
#  作用：让 ssh -N -R 127.0.0.1:2222:127.0.0.1:22 Administrator@ssh.aizhs.top
#        开机/登录后自动挂起，进程掉了自动拉起
#  用法：管理员 PowerShell
#        powershell -NoProfile -ExecutionPolicy Bypass -File .\install-reverse-tunnel.ps1
#  幂等：重复运行只会更新脚本与任务，不会产生多条任务
#  只做本机计划任务与本机文件，不改 sshd、不改防火墙、不做公网端口映射
# ============================================================

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$TaskName   = 'IHUI-ReverseTunnel'
$RootDir    = 'C:\ProgramData\ihui'
$KeepScript = Join-Path $RootDir 'keep-reverse-tunnel.ps1'
$LogFile    = Join-Path $RootDir 'reverse-tunnel.log'
$TargetHost = 'ssh.aizhs.top'
$Forward    = '127.0.0.1:2222:127.0.0.1:22'
$TaskUser   = "$env:COMPUTERNAME\Administrator"

function Write-Step($t) { Write-Host "[*] $t" -ForegroundColor Cyan }
function Write-Ok($t)   { Write-Host "[+] $t" -ForegroundColor Green }
function Write-Err2($t) { Write-Host "[x] $t" -ForegroundColor Red }

# ---------- 0. 管理员检查 ----------
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Err2 '需要管理员权限。请以管理员身份打开 PowerShell 后重试。'
    exit 1
}

# ---------- 1. 基本事实校验 ----------
Write-Step '校验前提（ssh 客户端 / ssh 配置 / 私钥）'
$sshExe = (Get-Command ssh.exe -ErrorAction SilentlyContinue).Source
if (-not $sshExe) { $sshExe = Join-Path $env:SystemRoot 'System32\OpenSSH\ssh.exe' }
if (-not (Test-Path -LiteralPath $sshExe)) {
    Write-Err2 "找不到 ssh 客户端：$sshExe"
    exit 1
}
Write-Ok "ssh: $sshExe"

$cfgCheck = & $sshExe @('-G', $TargetHost) 2>&1 | Select-String 'proxycommand|identityfile'
if (-not ($cfgCheck | Select-String 'proxycommand')) {
    Write-Err2 'ssh -G ssh.aizhs.top 未解析出 proxycommand，先修好 ~/.ssh/config 再跑本脚本。'
    exit 1
}
Write-Ok 'ssh 配置已能解析 proxycommand'

# ---------- 2. 落地守护脚本 ----------
Write-Step "生成守护脚本 $KeepScript"
if (-not (Test-Path -LiteralPath $RootDir)) { New-Item -ItemType Directory -Path $RootDir -Force | Out-Null }

$keepBody = @'
# IHUI 反向隧道守护（由计划任务每 2 分钟调用一次）
$ErrorActionPreference = 'SilentlyContinue'
$RootDir    = 'C:\ProgramData\ihui'
$LogFile    = Join-Path $RootDir 'reverse-tunnel.log'
$TargetHost = 'ssh.aizhs.top'
$Forward    = '127.0.0.1:2222:127.0.0.1:22'

if (-not (Test-Path -LiteralPath $RootDir)) { New-Item -ItemType Directory -Path $RootDir -Force | Out-Null }

function Log($msg) {
    try {
        if ((Test-Path -LiteralPath $LogFile) -and ((Get-Item -LiteralPath $LogFile).Length -gt 2MB)) {
            $kept = Get-Content -LiteralPath $LogFile -Tail 200
            [IO.File]::WriteAllText($LogFile, (($kept -join "`n") + "`n"), (New-Object Text.UTF8Encoding($false)))
        }
        Add-Content -LiteralPath $LogFile -Value ("{0} {1}" -f (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss'), $msg)
    } catch { }
}

$sshExe = (Get-Command ssh.exe -ErrorAction SilentlyContinue).Source
if (-not $sshExe) { $sshExe = Join-Path $env:SystemRoot 'System32\OpenSSH\ssh.exe' }
if (-not (Test-Path -LiteralPath $sshExe)) { Log 'FATAL ssh.exe not found'; exit 1 }

$alive = Get-CimInstance Win32_Process -Filter "Name='ssh.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -match '127\.0\.0\.1:2222:127\.0\.0\.1:22' }
if ($alive) {
    Log ("alive pid=" + (($alive | Select-Object -ExpandProperty ProcessId) -join ','))
    exit 0
}

Log 'tunnel down, starting'
$out = Join-Path $RootDir 'ssh-forward.out.log'
$err = Join-Path $RootDir 'ssh-forward.err.log'
Start-Process -FilePath $sshExe -ArgumentList @(
    '-N',
    '-R', $Forward,
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'BatchMode=yes',
    ('Administrator@' + $TargetHost)
) -RedirectStandardOutput $out -RedirectStandardError $err -WindowStyle Hidden

Start-Sleep -Seconds 6
$now = Get-CimInstance Win32_Process -Filter "Name='ssh.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -match '127\.0\.0\.1:2222:127\.0\.0\.1:22' }
if ($now) { Log ("started pid=" + (($now | Select-Object -ExpandProperty ProcessId) -join ',')) } else { Log 'start failed, see ssh-forward.err.log' }
'@

[IO.File]::WriteAllText($KeepScript, $keepBody, (New-Object Text.UTF8Encoding($true)))
Write-Ok "守护脚本已写入（UTF-8 带 BOM）"

# ---------- 3. 注册计划任务 ----------
Write-Step "注册计划任务 $TaskName"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ("-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$KeepScript`"")
$t1 = New-ScheduledTaskTrigger -AtStartup
$t2 = New-ScheduledTaskTrigger -AtLogOn -User $TaskUser
$t3 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 2)
$prin = New-ScheduledTaskPrincipal -UserId $TaskUser -LogonType Interactive -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($t1, $t2, $t3) -Principal $prin -Settings $settings -Force | Out-Null
Write-Ok "任务已注册（开机 / 登录 / 每 2 分钟）"

# ---------- 4. 立即跑一次 ----------
Write-Step '立即执行一次守护脚本'
& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $KeepScript
Start-Sleep -Seconds 3

# ---------- 5. 自检 ----------
Write-Step '自检'
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
$proc = Get-CimInstance Win32_Process -Filter "Name='ssh.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine -match '127\.0\.0\.1:2222:127\.0\.0\.1:22' }

Write-Host ''
Write-Host '================ 自检结果 ================' -ForegroundColor Cyan
Write-Host ("计划任务        : " + $(if ($task) { $task.State } else { '未注册' }))
Write-Host ("隧道进程        : " + $(if ($proc) { 'RUNNING pid=' + (($proc | Select-Object -ExpandProperty ProcessId) -join ',') } else { '未运行' }))
Write-Host ("转发目标        : " + $Forward)
Write-Host ("日志            : " + $LogFile)
Write-Host '=========================================' -ForegroundColor Cyan
Write-Host ''
Write-Host '--- 回报给主控机的摘要（直接复制这一行）---'
[ordered]@{
    task      = $(if ($task) { $task.State } else { 'missing' })
    tunnel    = $(if ($proc) { 'up' } else { 'down' })
    pid       = $(if ($proc) { ($proc | Select-Object -ExpandProperty ProcessId) -join ',' } else { '' })
    forward   = $Forward
    logFile   = $LogFile
} | ConvertTo-Json -Compress

if ($proc) { exit 0 } else { exit 2 }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
