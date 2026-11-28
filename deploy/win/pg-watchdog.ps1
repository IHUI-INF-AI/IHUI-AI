# IHUI PostgreSQL 看门狗：只在「服务在跑但持续拒绝连接(恢复/启动卡住)」时自动重启，避免生产库长时间假死。
# 判定依据：pg_isready 返回 rejecting connections 且持续 >= 5 分钟；进程完全无响应（no response）只告警不动手。
# 日志：D:\DevEnv\logs\pg-watchdog.log；状态：D:\DevEnv\ihui-prod\deploy\run\pg-watchdog-state.json

$ErrorActionPreference = 'Continue'
$PgBin = 'D:\DevEnv\runtimes\pgsql\bin'
$Port = 8810
$LogFile = 'D:\DevEnv\logs\pg-watchdog.log'
$StateFile = 'D:\DevEnv\ihui-prod\deploy\run\pg-watchdog-state.json'
$ThresholdMinutes = 5

function Write-Log([string]$msg) {
  $line = ('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg)
  Add-Content -LiteralPath $LogFile -Value $line -Encoding utf8
}

$state = @{ failCount = 0; firstFail = $null; lastStatus = '' }
if (Test-Path -LiteralPath $StateFile) {
  try { $state = Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json } catch { }
}

$ready = & "$PgBin\pg_isready.exe" -h 127.0.0.1 -p $Port -t 3 2>&1
$exit = $LASTEXITCODE
$msg = ($ready | Out-String).Trim()

if ($exit -eq 0) {
  if ($state.failCount -ne 0) { Write-Log "恢复接受连接，清零失败计数（此前 $($state.failCount) 次）" }
  @{ failCount = 0; firstFail = $null; lastStatus = 'ready' } | ConvertTo-Json | Set-Content -LiteralPath $StateFile -Encoding utf8
  exit 0
}

# 只有 rejecting connections 才是「卡住」信号；no response 说明进程没了，交给人工/服务恢复策略
$isRejecting = $msg -match 'rejecting'
$failCount = [int]$state.failCount + 1
$firstFail = if ($state.firstFail) { [datetime]$state.firstFail } else { Get-Date }
$elapsedMin = [math]::Round(((Get-Date) - $firstFail).TotalMinutes, 1)

if (-not $isRejecting) {
  Write-Log "非 rejecting 状态（$msg），仅记录，不自动重启（failCount=$failCount）"
  @{ failCount = $failCount; firstFail = $firstFail.ToString('o'); lastStatus = $msg } | ConvertTo-Json | Set-Content -LiteralPath $StateFile -Encoding utf8
  exit 0
}

Write-Log "拒绝连接持续 ${elapsedMin} 分钟（第 $failCount 次）：$msg"
if ($elapsedMin -lt $ThresholdMinutes) {
  @{ failCount = $failCount; firstFail = $firstFail.ToString('o'); lastStatus = $msg } | ConvertTo-Json | Set-Content -LiteralPath $StateFile -Encoding utf8
  exit 0
}

Write-Log "超过 ${ThresholdMinutes} 分钟仍未就绪，执行自动恢复：清进程 → 清 postmaster.pid → 启动服务"
Get-Process postgres -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3
$pidFile = 'D:\DevEnv\data\pgdata\postmaster.pid'
if (Test-Path -LiteralPath $pidFile) { Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue }
Start-Service IHUI-PG -ErrorAction SilentlyContinue
Start-Sleep -Seconds 12
$after = & "$PgBin\pg_isready.exe" -h 127.0.0.1 -p $Port -t 5 2>&1
Write-Log "自动恢复后状态：$((($after | Out-String).Trim())) (exit=$LASTEXITCODE)"
@{ failCount = 0; firstFail = $null; lastStatus = 'restarted' } | ConvertTo-Json | Set-Content -LiteralPath $StateFile -Encoding utf8
exit 0
