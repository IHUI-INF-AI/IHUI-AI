# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# IHUI-AI 裸机健康检查脚本(Windows PowerShell)
# =============================================================================
# 适用:本机裸机部署(无 Docker)场景。
# 与 health-check.ps1(Docker 版)的区别:检查本机进程/端口而非容器。
#
# 用法(项目根目录):
#   powershell -ExecutionPolicy Bypass -File deploy\prod-bundle\health-check-bare.ps1
# =============================================================================

$ErrorActionPreference = "Continue"
# 脚本在 deploy\prod-bundle\ 下,项目根需要向上 3 层:health-check-bare.ps1 → prod-bundle → deploy → D:\IHUI-AI
$ProjectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
Set-Location $ProjectRoot

function Check { param([string]$name, [bool]$ok, [string]$detail) }
$results = @()

# 端口存活三态(票 G-37③,2026-10-26):ok / breach / unjudged。
# 旧形 `return [bool](netstat -ano | ...)` 在 netstat 取不到输入(命令不在 / 抛错 / 空输出)时
# 返回 $false ⇒ 把"没探测到"写成"服务已死",§0.3 明令禁止。三态判据:
#   · netstat 有输出且该端口 LISTENING ⇒ ok
#   · netstat 有输出但该端口无 LISTENING ⇒ breach
#   · netstat 取不到任何输出 ⇒ unjudged(既不记绿也不判红,汇总里单列并 exit 2)
function Get-PortState($port) {
  $table = @()
  try { $table = @(netstat -ano 2>$null | Where-Object { $_ -and "$_".Trim() }) } catch { return 'unjudged' }
  if ($table.Count -eq 0) { return 'unjudged' }
  $hit = @($table | Select-String ":$port\s" | Select-String "LISTENING")
  if ($hit.Count -gt 0) { return 'ok' }
  return 'breach'
}

# 1. 基础服务端口 + 图片 CDN 源站
$ports = @(
  @{n="PostgreSQL"; p=8810; tip="pg_ctl -D D:\DevEnv\data\pgdata start"},
  @{n="Redis";      p=8811; tip="redis-server --port 8811"},
  @{n="web";        p=8801; tip="cd apps\web; pnpm dev"},
  @{n="api";        p=8802; tip="cd apps\api; pnpm dev"},
  @{n="ai-service"; p=8803; tip="cd apps\ai-service; .venv\Scripts\python -m uvicorn app.main:app --port 8803"},
  # :80 = 图片 CDN 源站(cdn-server.js),与 88xx 应用端口语义不同:**不归任何 nssm 服务**,
  # 所以只问"这个端口有没有人应答",不拿服务名去查宿主。这条链用户可见:apps/web/next.config.ts
  # 把 /remote-images/* 反代到 http://localhost:80,源站一挂公网页面图片全断,而本清单此前
  # 只查 8801/8802/8803/8810/8811 ⇒ 正是 G-37③ 记的"80 不在任何一班的眼里"。
  # 载体 = 看门狗任务 IHUI-ImageCDN-Watch(开机 + 每分钟守活,见 deploy/win/cdn-watchdog.ps1)。
  @{n="cdn";        p=80;   tip="计划任务 IHUI-ImageCDN-Watch(deploy\win\cdn-watchdog.ps1)守活;手工:node deploy\cdn-server.js"}
)
foreach ($c in $ports) {
  $st = Get-PortState $c.p
  if ($st -eq 'ok') {
    Write-Host "[PASS] $($c.n) ($($c.p))" -ForegroundColor Green
    $results += ,@($c.n, $true)
  } elseif ($st -eq 'breach') {
    Write-Host "[FAIL] $($c.n) ($($c.p)) 未监听 — $($c.tip)" -ForegroundColor Red
    $results += ,@($c.n, $false)
  } else {
    Write-Host "[SKIP] $($c.n) ($($c.p)) 未判定 — netstat 取不到输入,既不记绿也不判红" -ForegroundColor Yellow
    $results += ,@($c.n, $null)
  }
}

# 2. cloudflared Windows 服务
$cfSvc = Get-Service -Name "Cloudflared" -ErrorAction SilentlyContinue
if ($cfSvc -and $cfSvc.Status -eq "Running") {
  Write-Host "[PASS] cloudflared 服务 (Cloudflared) Running" -ForegroundColor Green
  $results += ,@("cloudflared", $true)
} else {
  Write-Host "[FAIL] cloudflared 服务未运行 — 管理员执行: cloudflared service install <token>; Start-Service Cloudflared" -ForegroundColor Red
  $results += ,@("cloudflared", $false)
}

# 3. API 健康(本地直连)
try {
  $r = Invoke-RestMethod -Uri "http://localhost:8802/api/health" -TimeoutSec 10 -ErrorAction Stop
  Write-Host "[PASS] API 健康: $($r.status) (uptime $([math]::Round($r.uptime))s)" -ForegroundColor Green
  $results += ,@("api-health", $true)
} catch {
  Write-Host "[FAIL] API 健康检查失败: $_" -ForegroundColor Red
  $results += ,@("api-health", $false)
}

# 4. AI Service 健康(本地直连)
try {
  $r = Invoke-RestMethod -Uri "http://localhost:8803/health" -TimeoutSec 10 -ErrorAction Stop
  Write-Host "[PASS] AI Service 健康: $($r.status)" -ForegroundColor Green
  $results += ,@("ai-health", $true)
} catch {
  Write-Host "[FAIL] AI Service 健康检查失败: $_" -ForegroundColor Red
  $results += ,@("ai-health", $false)
}

# 5. 公网验证
$public = @(
  @{n="https://aizhs.top";           u="https://aizhs.top/"},
  @{n="https://aizhs.top/api/health"; u="https://aizhs.top/api/health"},
  @{n="https://bsm.aizhs.top";       u="https://bsm.aizhs.top/"},
  @{n="https://api.aizhs.top";       u="https://api.aizhs.top/api/health"},
  @{n="https://ai.aizhs.top";        u="https://ai.aizhs.top/health"}
)
foreach ($c in $public) {
  $method = if ($c.u -like "*ai.aizhs.top*") { "Get" } else { "Head" }
  try {
    $resp = Invoke-WebRequest -Uri $c.u -Method $method -TimeoutSec 20 -ErrorAction Stop
    Write-Host "[PASS] 公网 $($c.n) → HTTP $($resp.StatusCode)" -ForegroundColor Green
    $results += ,@("public-$($c.n)", $true)
  } catch {
    $code = "ERR"
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    Write-Host "[WARN] 公网 $($c.n) → $code ($_)" -ForegroundColor Yellow
    $results += ,@("public-$($c.n)", $false)
  }
}

# 6. 磁盘空间
try {
  $drive = (Get-Location).Drive
  $freeGB = [math]::Round($drive.Free / 1GB, 1)
  if ($freeGB -ge 10) {
    Write-Host "[PASS] 磁盘剩余 $freeGB GB" -ForegroundColor Green
    $results += ,@("disk", $true)
  } else {
    Write-Host "[FAIL] 磁盘剩余仅 $freeGB GB(<10GB 危险)" -ForegroundColor Red
    $results += ,@("disk", $false)
  }
} catch {
  Write-Host "[WARN] 磁盘检查失败: $_" -ForegroundColor Yellow
  $results += ,@("disk", $false)
}

# 7. 数据库表数量(迁移完整性)
try {
  $pw = $null
  Get-Content "$ProjectRoot\.env" | ForEach-Object { if ($_ -match "^DB_PASSWORD=(.+)$") { $pw = $matches[1] } }
  $env:PGPASSWORD = $pw
  $psql = "D:\DevEnv\runtimes\pgsql\bin\psql.exe"
  $tableCount = (& $psql -h localhost -p 8810 -U ihui -d ihui_dev -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>$null).Trim()
  if ($tableCount -match "^\d+$" -and [int]$tableCount -gt 50) {
    Write-Host "[PASS] 数据库表数量: $tableCount(迁移完整)" -ForegroundColor Green
    $results += ,@("db-tables", $true)
  } else {
    Write-Host "[WARN] 数据库表数量异常: '$tableCount'(迁移可能不完整)" -ForegroundColor Yellow
    $results += ,@("db-tables", $false)
  }
} catch {
  Write-Host "[WARN] 数据库检查失败: $_" -ForegroundColor Yellow
  $results += ,@("db-tables", $false)
}

# 8. .next-bak-* 污染检查(2026-08-05 生产排障:Tailwind 4 扫描 .next-bak-* 导致构建内存爆炸 137GB)
$bakCount = (Get-ChildItem "$ProjectRoot\apps\web" -Directory -Filter ".next-bak-*" -ErrorAction SilentlyContinue).Count
if ($bakCount -eq 0) {
  Write-Host "[PASS] 无 .next-bak-* 污染目录(Tailwind 扫描安全)" -ForegroundColor Green
  $results += ,@("next-bak", $true)
} else {
  Write-Host "[FAIL] 发现 $bakCount 个 .next-bak-* 目录!下次构建会内存爆炸,立即清理:" -ForegroundColor Red
  Write-Host "  Get-ChildItem '$ProjectRoot\apps\web' -Directory -Filter '.next-bak-*' | Remove-Item -Recurse -Force" -ForegroundColor Red
  $results += ,@("next-bak", $false)
}

# 9. Windows 提交量(commit charge)检查(2026-08-05:SWC 30GB 分配失败的根因是提交量耗尽)
try {
  $ci = Get-CimInstance Win32_OperatingSystem
  $freeCommitGB = [math]::Round($ci.FreeVirtualMemory / 1MB, 1)
  if ($freeCommitGB -ge 20) {
    Write-Host "[PASS] 可用提交 $freeCommitGB GB(构建安全)" -ForegroundColor Green
    $results += ,@("commit", $true)
  } else {
    Write-Host "[WARN] 可用提交仅 $freeCommitGB GB(<20GB 构建有风险,检查 pagefile)" -ForegroundColor Yellow
    $results += ,@("commit", $false)
  }
} catch {
  Write-Host "[WARN] 提交量检查失败: $_" -ForegroundColor Yellow
  $results += ,@("commit", $false)
}

# 10. Cloudflared 协议检查(2026-08-05:http2 比 quic 公网 TTFB 快约 2 倍)
$cfPath = (Get-CimInstance Win32_Service -Filter "Name='Cloudflared'").PathName
if ($cfPath -match "--protocol http2") {
  Write-Host "[PASS] Cloudflared 使用 http2 协议" -ForegroundColor Green
  $results += ,@("cf-protocol", $true)
} else {
  Write-Host "[WARN] Cloudflared 未使用 http2 协议(当前: $cfPath)" -ForegroundColor Yellow
  Write-Host "  修复:注册表 HKLM\SYSTEM\CurrentControlSet\Services\Cloudflared 的 ImagePath 加 --protocol http2" -ForegroundColor Yellow
  $results += ,@("cf-protocol", $false)
}

# 汇总(三态:未判定不得折算成通过或失败,§0.3)
$passCount = @($results | Where-Object { $_[1] -eq $true }).Count
$failCount = @($results | Where-Object { $_[1] -eq $false }).Count
$unjudgedCount = @($results | Where-Object { $null -eq $_[1] }).Count
$total = $results.Count
Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "  裸机健康检查汇总: PASS $passCount / FAIL $failCount / 未判定 $unjudgedCount / 共 $total" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
if ($failCount -eq 0 -and $unjudgedCount -eq 0) {
  Write-Host " 全部通过 ✅" -ForegroundColor Green
  exit 0
} elseif ($failCount -eq 0) {
  # 只取不到输入、没有任何一条判红 ⇒ 显式"未判定",不记绿也不冒红
  Write-Host " 全部已探测项通过,但有 $unjudgedCount 项未判定(取不到输入),按未判定返回" -ForegroundColor Yellow
  exit 2
} else {
  Write-Host " 存在未通过项,按上方 FAIL/WARN 排查" -ForegroundColor Yellow
  exit 1
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
