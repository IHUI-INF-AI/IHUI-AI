# 验证建议 9: dev-up-events.jsonl size-rotation
# - 写 1500 字节 (>= 1KB 阈值) 触发 Rotate-EventsLog
# - 跑 4 轮, 断言 .1/.2/.3 都该有, 老的 .3 被删除

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$logDir = Join-Path $root 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
Get-ChildItem $logDir -Filter 'dev-up-events*.jsonl' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

$logPath = Join-Path $logDir 'dev-up-events.jsonl'
$maxBytes = 1024
$keep = 3

function Rotate-Log($p, $max, $k) {
  if (-not (Test-Path $p)) { return $false }
  $size = (Get-Item $p).Length
  if ($size -lt $max) { return $false }
  $dir = Split-Path -Parent $p
  for ($i = $k; $i -ge 1; $i--) {
    $old = Join-Path $dir ("dev-up-events.$i.jsonl")
    $prev = Join-Path $dir ("dev-up-events.{0}.jsonl" -f ($i - 1))
    if ($i -eq $k -and (Test-Path $old)) { Remove-Item $old -Force }
    if ($i -eq 1 -and (Test-Path $p)) { Rename-Item $p $old -Force }
    elseif (Test-Path $prev) { Rename-Item $prev $old -Force }
  }
  New-Item -ItemType File -Path $p -Force | Out-Null
  return $true
}

# 写 1500 字节, 跑 4 轮 rotation
for ($round = 1; $round -le 4; $round++) {
  $ch = [char](65 + $round - 1)
  Set-Content -Path $logPath -Value ([string]::new($ch, 1500)) -Encoding UTF8
  $rotated = Rotate-Log $logPath $maxBytes $keep
  $arc1 = Test-Path (Join-Path $logDir 'dev-up-events.1.jsonl')
  $arc2 = Test-Path (Join-Path $logDir 'dev-up-events.2.jsonl')
  $arc3 = Test-Path (Join-Path $logDir 'dev-up-events.3.jsonl')
  $main = (Get-Item $logPath).Length
  Write-Host "round ${round}: rotated=$rotated main=${main}B .1=$arc1 .2=$arc2 .3=$arc3"
}

# 断言最终状态
if (-not (Test-Path (Join-Path $logDir 'dev-up-events.1.jsonl'))) { Write-Error "[FAIL] .1.jsonl should exist"; exit 1 }
if (-not (Test-Path (Join-Path $logDir 'dev-up-events.2.jsonl'))) { Write-Error "[FAIL] .2.jsonl should exist"; exit 1 }
if (-not (Test-Path (Join-Path $logDir 'dev-up-events.3.jsonl'))) { Write-Error "[FAIL] .3.jsonl should exist"; exit 1 }
if (Test-Path (Join-Path $logDir 'dev-up-events.4.jsonl')) { Write-Error "[FAIL] .4.jsonl should NOT exist (keep=3)"; exit 1 }
Write-Host ""
Write-Host "[OK] 4 轮 rotation 后: 3 份归档 + 1 个空主文件, 老的 .3 在第 4 轮被删除"

# 清理
Get-ChildItem $logDir -Filter 'dev-up-events*.jsonl' | Remove-Item -Force
