# scripts/kill-dev-servers.ps1
#
# 一键清理 dev server 残留进程(端口 3000/3001/8000/8081 + 关联 next-server 进程树)。
#
# 用法:
#   pwsh scripts/kill-dev-servers.ps1               # 清理 IHUI-AI 标准端口
#   pwsh scripts/kill-dev-servers.ps1 -DryRun       # 只显示不杀
#   pwsh scripts/kill-dev-servers.ps1 -Ports 3000   # 自定义端口
#
# 为什么不用 taskkill /F /IM node.exe:会误杀 Trae IDE / aihot / 其他 agent 的 node 进程。
# 只杀监听特定端口的进程树,精准。

param(
    [int[]]$Ports = @(8801, 8802, 8803, 8830, 9229, 9230),
    [switch]$DryRun
)

$ErrorActionPreference = 'Continue'

function Kill-Port-Tree {
    param([int]$Port, [bool]$IsDry)
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
             Where-Object { $_.OwningProcess -gt 0 }
    if (-not $conns) {
        Write-Host "[port $Port] free" -ForegroundColor DarkGray
        return
    }
    $uniquePids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $uniquePids) {
        if ($IsDry) {
            Write-Host "[port $Port] DRY: would kill PID $procId" -ForegroundColor Yellow
        } else {
            $output = & taskkill /F /T /PID $procId 2>&1
            Write-Host "[port $Port] killed PID $procId -> $output" -ForegroundColor Green
        }
    }
}

Write-Host "=== kill-dev-servers ===" -ForegroundColor Cyan
Write-Host "Ports: $($Ports -join ', ')"
Write-Host "DryRun: $DryRun"
Write-Host ""

$isDry = [bool]$DryRun

foreach ($port in $Ports) {
    Kill-Port-Tree -Port $port -IsDry $isDry
}

# 清理 IHUI-AI 项目的 next-server worker(<2 小时,基于 parent 命令行)
$nextWorkers = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $_.StartTime -gt (Get-Date).AddHours(-2)
}
$zombies = @()
foreach ($p in $nextWorkers) {
    try {
        $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)" -ErrorAction SilentlyContinue).CommandLine
        if ($cmd -match 'apps[\\/]web[\\/]|\.next|next-server|@ihui[\\/]web|@ihui[\\/]api|@ihui[\\/]ai-service') {
            $zombies += $p
        }
    } catch {}
}

if ($zombies.Count -gt 0) {
    Write-Host ""
    Write-Host "=== IHUI next-server workers (start <2h) ===" -ForegroundColor Cyan
    foreach ($p in $zombies) {
        if ($isDry) {
            Write-Host "DRY: would kill PID $($p.Id) (started $($p.StartTime))" -ForegroundColor Yellow
        } else {
            & taskkill /F /T /PID $p.Id 2>&1 | Out-Null
            Write-Host "killed PID $($p.Id)" -ForegroundColor Green
        }
    }
}

$remaining = (Get-Process -Name node -ErrorAction SilentlyContinue).Count
Write-Host ""
Write-Host "node procs remaining (after cleanup): $remaining" -ForegroundColor Magenta
