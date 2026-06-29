<#
.SYNOPSIS
    Trae CN WAL 防御体系一键安装脚本
.DESCRIPTION
    完成以下配置：
    1. 在 F:\TraeCN_Data\ 部署 wal_cleaner.ps1
    2. 注册 Windows 计划任务 "TraeCN_WAL_Guardian"（每天 3:00 + 开机时运行）
    3. （可选 -MoveToF）将 ai-agent 目录转移到 F 盘 + 符号链接
.PARAMETER MoveToF
    同时执行 ai-agent 目录转移到 F 盘（需要先关闭 Trae CN）
.PARAMETER Uninstall
    卸载：删除计划任务和部署文件（不删除已转移的数据）
.EXAMPLE
    .\setup_trae_wal_guardian.ps1                  # 仅安装定时任务
    .\setup_trae_wal_guardian.ps1 -MoveToF         # 安装定时任务 + 转移到F盘
    .\setup_trae_wal_guardian.ps1 -Uninstall       # 卸载
#>

param(
    [switch]$MoveToF,
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

$TaskName    = 'TraeCN_WAL_Guardian'
$DataDir     = 'F:\TraeCN_Data'
$CleanerPath = "$DataDir\wal_cleaner.ps1"
$SourceScript = $MyInvocation.MyCommand.Path | Split-Path -Parent
$SourceCleaner = Join-Path $SourceScript 'wal_cleaner.ps1'

$AiAgentOriginal = 'C:\Users\Administrator\AppData\Roaming\Trae CN\ModularData\ai-agent'
$AiAgentFDrive   = 'F:\TraeCN_Data\ai-agent'

function Write-Step { param([string]$Msg) Write-Host "`n[*] $Msg" -ForegroundColor Cyan }
function Write-OK   { param([string]$Msg) Write-Host "    [OK] $Msg" -ForegroundColor Green }
function Write-Warn { param([string]$Msg) Write-Host "    [!] $Msg" -ForegroundColor Yellow }
function Write-Err  { param([string]$Msg) Write-Host "    [X] $Msg" -ForegroundColor Red }

# ── 卸载模式 ───────────────────────────────────────────
if ($Uninstall) {
    Write-Step '卸载 Trae CN WAL 防御体系'
    try {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
        Write-OK "已删除计划任务: $TaskName"
    } catch {
        Write-Warn "计划任务不存在或删除失败: $_"
    }
    if (Test-Path $CleanerPath) {
        Remove-Item $CleanerPath -Force
        Write-OK "已删除: $CleanerPath"
    }
    Write-Host ''
    Write-Host '卸载完成。已转移到 F 盘的数据不受影响。' -ForegroundColor Green
    exit 0
}

# ── 检查管理员权限 ─────────────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal] `
    [Security.Principal.WindowsIdentity]::GetCurrent()
).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)

if (-not $isAdmin) {
    Write-Err '需要管理员权限运行。请右键 PowerShell -> 以管理员身份运行。'
    exit 1
}

# ── Step 1: 部署 wal_cleaner.ps1 ──────────────────────
Write-Step '部署 wal_cleaner.ps1 到 F:\TraeCN_Data\'

if (-not (Test-Path $DataDir)) {
    New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
    Write-OK "已创建目录: $DataDir"
} else {
    Write-OK "目录已存在: $DataDir"
}

if (Test-Path $SourceCleaner) {
    Copy-Item $SourceCleaner $CleanerPath -Force
    Write-OK "已复制 wal_cleaner.ps1 -> $CleanerPath"
} else {
    Write-Err "未找到源文件: $SourceCleaner"
    Write-Err '请确保 wal_cleaner.ps1 与本脚本在同一目录'
    exit 1
}

# ── Step 2: 注册计划任务 ───────────────────────────────
Write-Step '注册 Windows 计划任务'

# 删除旧任务（如果存在）
try { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop } catch {}

$action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "F:\TraeCN_Data\wal_cleaner.ps1"'

# 触发器 1: 每天 3:00
$triggerDaily = New-ScheduledTaskTrigger -Daily -At 3:00AM

# 触发器 2: 用户登录时
$triggerLogon = New-ScheduledTaskTrigger -AtLogOn

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger @($triggerDaily, $triggerLogon) `
    -Settings $settings `
    -Principal $principal `
    -Description 'Trae CN ai-agent WAL 自动监控与清理' `
    -Force | Out-Null

Write-OK "计划任务已注册: $TaskName"
Write-OK '触发条件: 每天 03:00 + 用户登录时'

# ── Step 3: 可选 - 转移 ai-agent 到 F 盘 ──────────────
if ($MoveToF) {
    Write-Step '转移 ai-agent 目录到 F 盘'

    # 检查 Trae CN 是否运行
    $procs = Get-Process -Name 'Trae CN' -ErrorAction SilentlyContinue
    if ($procs.Count -gt 0) {
        Write-Err 'Trae CN 正在运行，无法转移！'
        Write-Err '请先完全关闭 Trae CN（任务管理器确认无 Trae CN.exe 进程），再重新运行:'
        Write-Err "    .\setup_trae_wal_guardian.ps1 -MoveToF"
        exit 1
    }

    # 检查是否已经是符号链接
    $item = Get-Item $AiAgentOriginal -ErrorAction SilentlyContinue
    if ($item -and $item.LinkType -eq 'SymbolicLink') {
        Write-Warn "$AiAgentOriginal 已经是符号链接，跳过转移"
    } elseif (-not $item) {
        Write-Err "未找到 ai-agent 目录: $AiAgentOriginal"
        exit 1
    } else {
        # 先删除 WAL 和 SHM（避免移动超大 WAL）
        $walFile = Join-Path $AiAgentOriginal 'database.db-wal'
        $shmFile = Join-Path $AiAgentOriginal 'database.db-shm'
        if (Test-Path $walFile) {
            $walSize = [math]::Round((Get-Item $walFile).Length / 1GB, 2)
            Remove-Item $walFile -Force
            Write-OK "已删除 WAL ($walSize GB)"
        }
        if (Test-Path $shmFile) {
            Remove-Item $shmFile -Force
            Write-OK '已删除 SHM'
        }

        # robocopy /MOVE 移动目录
        if (Test-Path $AiAgentFDrive) {
            Remove-Item $AiAgentFDrive -Recurse -Force
        }
        Write-Host '    正在移动文件（可能需要 1-2 分钟）...'
        $rc = & robocopy $AiAgentOriginal $AiAgentFDrive /MOVE /E /R:1 /W:1 /NFL /NDL /NJH /NJS 2>&1
        $exitCode = $LASTEXITCODE
        if ($exitCode -lt 8) {
            Write-OK "文件已移动到: $AiAgentFDrive"
        } else {
            Write-Err "robocopy 失败 (exit=$exitCode)"
            exit 1
        }

        # 创建符号链接
        New-Item -ItemType SymbolicLink -Path $AiAgentOriginal -Target $AiAgentFDrive | Out-Null
        Write-OK "已创建符号链接: $AiAgentOriginal -> $AiAgentFDrive"
    }
}

# ── 完成 ───────────────────────────────────────────────
Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host ' Trae CN WAL 防御体系安装完成!' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Write-Host ''
Write-Host '已部署的防御层:' -ForegroundColor White
Write-Host "  1. 定时清理: 每天 03:00 + 开机时自动检查 WAL"
Write-Host "  2. 日志文件: $DataDir\wal_cleaner.log"
Write-Host "  3. 清理脚本: $CleanerPath"
if ($MoveToF) {
    Write-Host "  4. 数据转移: ai-agent -> F:\TraeCN_Data\ai-agent (符号链接)"
}
Write-Host ''
Write-Host '手动操作命令:' -ForegroundColor White
Write-Host '  查看状态:  powershell -File wal_cleaner.ps1 -StatusOnly'
Write-Host '  立即清理:  powershell -File wal_cleaner.ps1 -ForceClean'
Write-Host '  卸载防御:  powershell -File setup_trae_wal_guardian.ps1 -Uninstall'
Write-Host ''
if (-not $MoveToF) {
    Write-Host '提示: 如需将 ai-agent 转移到 F 盘（释放 C 盘空间）,' -ForegroundColor Yellow
    Write-Host '      请先关闭 Trae CN，然后运行:' -ForegroundColor Yellow
    Write-Host '      .\setup_trae_wal_guardian.ps1 -MoveToF' -ForegroundColor Yellow
    Write-Host ''
}
