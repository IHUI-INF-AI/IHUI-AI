<#
.SYNOPSIS
    Trae CN WAL 监控与自动清理脚本
.DESCRIPTION
    检查 ai-agent 的 database.db-wal 文件大小：
    - WAL < 5GB：正常，记录日志后退出
    - WAL >= 5GB 且 Trae CN 未运行：删除 WAL + SHM
    - WAL >= 5GB 且 Trae CN 运行中：跳过，等待下次检查
    - WAL >= 30GB（临界）：强制关闭 Trae CN → 清理 → 重启
    此脚本可手动运行，也可由 Windows 计划任务定时调用。
.PARAMETER StatusOnly
    仅显示当前状态，不执行任何清理
.PARAMETER ForceClean
    立即清理 WAL（如果 Trae CN 在运行则先关闭）
.EXAMPLE
    .\wal_cleaner.ps1 -StatusOnly
    .\wal_cleaner.ps1 -ForceClean
#>

param(
    [string]$AiAgentPath = 'C:\Users\Administrator\AppData\Roaming\Trae CN\ModularData\ai-agent',
    [double]$WarnGB      = 5.0,
    [double]$CriticalGB  = 30.0,
    [string]$LogPath     = 'F:\TraeCN_Data\wal_cleaner.log',
    [string]$TraeCNExe   = 'G:\Trae CN\Trae CN.exe',
    [switch]$StatusOnly,
    [switch]$ForceClean
)

# ── 日志函数 ──────────────────────────────────────────
function Write-Log {
    param([string]$Msg, [string]$Level = 'INFO')
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "[$ts] [$Level] $Msg"
    Write-Host $line
    $dir = Split-Path $LogPath -Parent
    if ($dir -and !(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    Add-Content -Path $LogPath -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
}

# ── 获取 WAL 大小 (GB) ─────────────────────────────────
function Get-WalSizeGB {
    $wal = Join-Path $AiAgentPath 'database.db-wal'
    if (Test-Path $wal) {
        return [math]::Round((Get-Item $wal).Length / 1GB, 2)
    }
    return 0
}

# ── 检查 Trae CN 是否运行 ───────────────────────────────
function Test-TraeRunning {
    $p = Get-Process -Name 'Trae CN' -ErrorAction SilentlyContinue
    return ($p.Count -gt 0)
}

# ── 关闭 Trae CN ───────────────────────────────────────
function Stop-TraeCN {
    Write-Log '正在关闭 Trae CN（先尝试优雅关闭）...' 'WARN'
    # taskkill 不带 /F = 发送 WM_CLOSE，允许 SQLite checkpoint
    & taskkill /IM 'Trae CN.exe' 2>$null | Out-Null
    $waited = 0
    while ((Test-TraeRunning) -and $waited -lt 30) {
        Start-Sleep -Seconds 2
        $waited += 2
    }
    # 仍未退出则强制
    if (Test-TraeRunning) {
        Write-Log '优雅关闭超时，强制终止...' 'WARN'
        Stop-Process -Name 'Trae CN' -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 5
    }
    if (Test-TraeRunning) {
        Write-Log 'Trae CN 关闭失败' 'ERROR'
        return $false
    }
    Write-Log 'Trae CN 已关闭，等待文件锁释放...' 'INFO'
    Start-Sleep -Seconds 3
    return $true
}

# ── 启动 Trae CN ───────────────────────────────────────
function Start-TraeCN {
    if (Test-Path $TraeCNExe) {
        Write-Log '正在启动 Trae CN...' 'INFO'
        Start-Process $TraeCNExe
        Write-Log 'Trae CN 已启动' 'INFO'
    } else {
        Write-Log "未找到 Trae CN: $TraeCNExe" 'ERROR'
    }
}

# ── 清理 WAL + SHM ─────────────────────────────────────
function Invoke-CleanWal {
    $wal = Join-Path $AiAgentPath 'database.db-wal'
    $shm = Join-Path $AiAgentPath 'database.db-shm'
    $freed = 0
    if (Test-Path $wal) {
        $freed = [math]::Round((Get-Item $wal).Length / 1GB, 2)
        Remove-Item $wal -Force -ErrorAction SilentlyContinue
        if (!(Test-Path $wal)) {
            Write-Log "已删除 database.db-wal，释放 $freed GB" 'INFO'
        } else {
            Write-Log '删除 database.db-wal 失败（文件可能被锁定）' 'ERROR'
            return $false
        }
    }
    if (Test-Path $shm) {
        Remove-Item $shm -Force -ErrorAction SilentlyContinue
        Write-Log '已删除 database.db-shm' 'INFO'
    }
    return $true
}

# ── 主逻辑 ─────────────────────────────────────────────
$walSize    = Get-WalSizeGB
$traeRunning = Test-TraeRunning
$dbFile     = Join-Path $AiAgentPath 'database.db'
$dbSize     = if (Test-Path $dbFile) { [math]::Round((Get-Item $dbFile).Length / 1GB, 2) } else { 0 }

Write-Log "WAL=${walSize}GB | DB=${dbSize}GB | Trae CN 运行=$traeRunning" 'INFO'

if ($StatusOnly) { exit 0 }

if ($ForceClean) {
    Write-Log '强制清理模式' 'WARN'
    if ($traeRunning) {
        if (-not (Stop-TraeCN)) { exit 1 }
        $cleaned = Invoke-CleanWal
        Start-TraeCN
    } else {
        $cleaned = Invoke-CleanWal
    }
    exit 0
}

# 临界：WAL >= 30GB
if ($walSize -ge $CriticalGB) {
    Write-Log "WAL 超过临界值 (${walSize}GB >= ${CriticalGB}GB)，执行紧急清理" 'WARN'
    if ($traeRunning) {
        if (-not (Stop-TraeCN)) {
            Write-Log '无法关闭 Trae CN，放弃清理' 'ERROR'
            exit 1
        }
        $ok = Invoke-CleanWal
        if ($ok) { Start-TraeCN }
    } else {
        Invoke-CleanWal | Out-Null
    }
}
# 警告：WAL >= 5GB
elseif ($walSize -ge $WarnGB) {
    Write-Log "WAL 超过警告值 (${walSize}GB >= ${WarnGB}GB)" 'WARN'
    if ($traeRunning) {
        Write-Log 'Trae CN 运行中，跳过清理（下次 Trae CN 关闭后自动清理）' 'INFO'
    } else {
        Invoke-CleanWal | Out-Null
    }
}
# 正常
else {
    Write-Log 'WAL 大小正常' 'INFO'
}
