# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# IHUI-AI 部署后健康检查脚本(Windows PowerShell)
# =============================================================================
# 用法:
#   powershell -ExecutionPolicy Bypass -File deploy\prod-bundle\health-check.ps1
# =============================================================================
$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ProjectRoot

$pass = 0
$fail = 0
$warn = 0

function Check {
    param([string]$name, [scriptblock]$test, [string]$okMsg, [string]$failMsg, [string]$warnMsg = "")
    Write-Host -NoNewline "[$name] "
    try {
        $result = & $test
        if ($result) {
            Write-Host "PASS" -ForegroundColor Green -NoNewline
            Write-Host " $okMsg"
            $script:pass++
        } else {
            throw "test returned false"
        }
    } catch {
        if ($warnMsg) {
            Write-Host "WARN" -ForegroundColor Yellow -NoNewline
            Write-Host " $warnMsg ($_)"
            $script:warn++
        } else {
            Write-Host "FAIL" -ForegroundColor Red -NoNewline
            Write-Host " $failMsg ($_)"
            $script:fail++
        }
    }
}

Write-Host "========== IHUI-AI 健康检查 ==========" -ForegroundColor Cyan

# 1. Docker 容器状态
Check "docker" {
    $statuses = docker compose ps --format json 2>$null | ConvertFrom-Json
    $statuses.Count -gt 0
} "Docker 容器在运行" "Docker 容器未运行,跑 docker compose up -d"

# 2. 各容器健康
$services = @("db", "redis", "api", "ai-service", "web")
foreach ($svc in $services) {
    Check "container-$svc" {
        $statuses = docker compose ps --format json 2>$null | ConvertFrom-Json
        $target = $statuses | Where-Object { $_.Service -eq $svc }
        $target -and $target.State -eq "running"
    } "$svc 容器运行中" "$svc 容器未运行" "$svc 容器状态异常"
}

# 3. API 健康(本地)
Check "api-health-local" {
    $r = Invoke-RestMethod -Uri "http://localhost:8801/api/health" -TimeoutSec 10
    $r.status -eq "ok" -or $r.status -eq "healthy"
} "API 本地健康" "API 本地健康检查失败"

# 4. AI Service 健康(本地)
Check "ai-service-health-local" {
    $r = Invoke-RestMethod -Uri "http://localhost:8801/ai-service/health" -TimeoutSec 10
    $r.status -eq "ok" -or $r.status -eq "healthy"
} "AI Service 本地健康" "AI Service 本地健康检查失败"

# 5. Web 首页(本地)
Check "web-home-local" {
    $r = Invoke-WebRequest -Uri "http://localhost:8801/" -Method Head -TimeoutSec 10
    $r.StatusCode -eq 200
} "Web 本地首页 200" "Web 本地首页异常"

# 6. LLM 模型列表(验证 AI key 配置)
Check "llm-models" {
    $r = Invoke-RestMethod -Uri "http://localhost:8801/ai-service/llm/models" -TimeoutSec 10
    $models = if ($r.models) { $r.models } elseif ($r.data) { $r.data } else { @() }
    $models.Count -gt 0
} "LLM 模型列表非空(AI key 已配置)" "LLM 模型列表为空(检查 STEPFUN_API_KEY 等)" "LLM 模型列表端点异常"

# 7. 公网访问(主域)
Check "public-main" {
    $r = Invoke-WebRequest -Uri "https://aizhs.top/" -Method Head -TimeoutSec 30
    $r.StatusCode -eq 200 -and $r.Headers.ContainsKey("cf-ray")
} "公网 https://aizhs.top 通(经 Cloudflare)" "公网 https://aizhs.top 不通" "公网访问超时(可能 cloudflared 还在建立 tunnel)"

# 8. 公网访问(认证子域)
Check "public-bsm" {
    $r = Invoke-WebRequest -Uri "https://bsm.aizhs.top/" -Method Head -TimeoutSec 30
    $r.StatusCode -eq 200 -or $r.StatusCode -eq 307 -or $r.StatusCode -eq 302
} "公网 https://bsm.aizhs.top 通" "公网 https://bsm.aizhs.top 不通"

# 9. Cloudflared 容器
Check "cloudflared" {
    $cfCompose = "$ProjectRoot\deploy\prod-bundle\cloudflared\docker-compose.cloudflared.yml"
    if (-not (Test-Path $cfCompose)) { return $false }
    $statuses = docker compose -f $cfCompose ps --format json 2>$null | ConvertFrom-Json
    $target = $statuses | Where-Object { $_.Service -eq "cloudflared" }
    $target -and $target.State -eq "running"
} "cloudflared 容器运行中" "cloudflared 容器未运行"

# 10. 磁盘空间(>10GB)
Check "disk-space" {
    $drive = Get-PSDrive -Name (Split-Path -Qualifier $ProjectRoot)
    $freeGB = [math]::Round($drive.Free / 1GB, 2)
    $freeGB -gt 10
} "磁盘剩余 > 10GB" "磁盘剩余 < 10GB(危险,可能引起数据库/Redis崩溃)"

# 11. 数据库表数量
Check "db-tables" {
    $envContent = Get-Content "$ProjectRoot\.env.production" -Raw -Encoding UTF8
    $dbUser = if ($envContent -match "DB_USER=(.+)") { $matches[1].Trim() } else { "ihui" }
    $dbName = if ($envContent -match "DB_NAME=(.+)") { $matches[1].Trim() } else { "ihui" }
    $tables = docker compose exec -T db psql -U $dbUser -d $dbName -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>$null
    [int]$tables -gt 50
} "数据库表数量 > 50(迁移成功)" "数据库表数量异常(迁移可能失败)"

# 输出汇总
Write-Host ""
Write-Host "=========================================="
Write-Host "  健康检查汇总"
Write-Host "=========================================="
Write-Host "  PASS: $pass" -ForegroundColor Green
Write-Host "  WARN: $warn" -ForegroundColor Yellow
Write-Host "  FAIL: $fail" -ForegroundColor Red
Write-Host ""

if ($fail -gt 0) {
    Write-Host "存在 FAIL 项,部署未完全成功。请按上述 FAIL 信息排查。" -ForegroundColor Red
    exit 1
} elseif ($warn -gt 0) {
    Write-Host "存在 WARN 项,部署基本完成但需关注。建议处理 WARN 后再声明部署成功。" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "所有检查通过,部署成功!" -ForegroundColor Green
    exit 0
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
