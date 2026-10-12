# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# IHUI-AI 一键部署脚本(Windows PowerShell)
# =============================================================================
# 用法:在项目根目录执行
#   powershell -ExecutionPolicy Bypass -File deploy\prod-bundle\deploy.ps1
#
# 完整流程:
#   1. 检查前置依赖(Git / Docker / Docker Compose)
#   2. 生成 .env.production(自动生成所有强随机密钥)
#   3. 合并用户从开发机拷贝的 .env.secrets.from-dev(如果有)
#   4. docker compose build(构建镜像)
#   5. docker compose up -d(启动 5 核心服务 + migrate)
#   6. 等待服务健康
#   7. 启动 cloudflared 容器(内网穿透)
#   8. 公网验证 https://aizhs.top
#   9. 输出部署报告
# =============================================================================
param(
    [switch]$SkipBuild,           # 跳过 docker build(用已有镜像)
    [switch]$SkipCloudflared,     # 跳过 cloudflared 启动(仅本地部署)
    [switch]$ForceRegenSecrets    # 强制重新生成密钥(会覆盖 .env.production 中已生成的占位符字段)
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ProjectRoot

function Write-Step { param([string]$msg) Write-Host "`n========== $msg ==========" -ForegroundColor Cyan }
function Write-OK { param([string]$msg) Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err { param([string]$msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

# ==================== 1. 前置依赖检查 ====================
Write-Step "步骤 1/9:前置依赖检查"

# Git
try {
    $gitVersion = git --version 2>$null
    Write-OK "Git: $gitVersion"
} catch {
    Write-Err "Git 未安装。请安装:https://git-scm.com/download/win"
    exit 1
}

# Docker
try {
    $dockerVersion = docker version --format '{{.Server.Version}}' 2>$null
    if (-not $dockerVersion) { throw "Docker daemon 未运行" }
    Write-OK "Docker: $dockerVersion"
} catch {
    Write-Err "Docker 未安装或未启动。请安装 Docker Desktop:https://docs.docker.com/desktop/install/windows-install/"
    Write-Err "安装后启动 Docker Desktop,等待其完全启动后再跑此脚本"
    exit 1
}

# Docker Compose
try {
    $composeVersion = docker compose version 2>$null
    Write-OK "Docker Compose: $composeVersion"
} catch {
    Write-Err "Docker Compose 未安装。Docker Desktop 自带,如缺失请重装 Docker Desktop"
    exit 1
}

# cloudflared(可选,容器化方案不需要本机装)
$cloudflaredInstalled = $false
try {
    $cfVersion = cloudflared --version 2>$null
    if ($cfVersion) {
        Write-OK "cloudflared: $cfVersion"
        $cloudflaredInstalled = $true
    }
} catch {
    Write-Warn "cloudflared 未本机安装(无影响,会用 Docker 容器跑)"
}

# ==================== 2. 生成 .env.production ====================
Write-Step "步骤 2/9:生成 .env.production"

$envFile = "$ProjectRoot\.env.production"
$templateFile = "$ProjectRoot\deploy\prod-bundle\.env.production.template"
$secretsFromFile = "$ProjectRoot\.env.secrets.from-dev"

if (-not (Test-Path $envFile) -or $ForceRegenSecrets) {
    if (Test-Path $envFile) {
        Write-Warn ".env.production 已存在,ForceRegenSecrets=$ForceRegenSecrets,重新生成..."
        Remove-Item $envFile -Force
    }
    if (-not (Test-Path $templateFile)) {
        Write-Err "模板文件不存在: $templateFile"
        exit 1
    }
    & "$ProjectRoot\deploy\prod-bundle\gen-secrets.ps1"
    if ($LASTEXITCODE -ne 0) {
        Write-Err "密钥生成失败"
        exit 1
    }
    Write-OK ".env.production 已生成"
} else {
    Write-OK ".env.production 已存在,跳过生成(用 -ForceRegenSecrets 强制重生成)"
}

# 自动从 TUNNEL_TOKEN.local.txt 填充 token(如果 .env.production 里是占位符)
$tokenFile = "$ProjectRoot\deploy\prod-bundle\cloudflared\TUNNEL_TOKEN.local.txt"
if (Test-Path $tokenFile) {
    $envContent = Get-Content $envFile -Raw -Encoding UTF8
    if ($envContent -match "TUNNEL_TOKEN=<PASTE-YOUR-TUNNEL-TOKEN-HERE>") {
        $realToken = (Get-Content $tokenFile -Raw -Encoding UTF8).Trim()
        if ($realToken -and $realToken.StartsWith("eyJ")) {
            $envContent = $envContent -replace "TUNNEL_TOKEN=<PASTE-YOUR-TUNNEL-TOKEN-HERE>", "TUNNEL_TOKEN=$realToken"
            [System.IO.File]::WriteAllText($envFile, $envContent, [System.Text.UTF8Encoding]::new($false))
            Write-OK "已从 TUNNEL_TOKEN.local.txt 自动填充 token"
        }
    }
}

# 校验 .env.production 必填字段非占位符
$envContent = Get-Content $envFile -Raw -Encoding UTF8
$requiredFields = @(
    "DB_PASSWORD", "REDIS_PASSWORD", "JWT_SECRET", "CREDENTIALS_ENCRYPTION_KEY",
    "AI_CALLBACK_SECRET", "TUNNEL_TOKEN"
)
foreach ($field in $requiredFields) {
    if ($envContent -match "${field}=<(AUTOGEN|COPY|PASTE)-[^>]+>") {
        Write-Err "$field 仍是占位符,请填入真实值或重新跑 gen-secrets.ps1"
        exit 1
    }
}

# ==================== 3. 合并用户从开发机拷贝的密钥 ====================
Write-Step "步骤 3/9:合并开发机密钥(如有)"

if (Test-Path $secretsFromFile) {
    Write-Host "检测到 .env.secrets.from-dev,合并到 .env.production..."
    $secretsLines = Get-Content $secretsFromFile -Encoding UTF8
    $envLines = Get-Content $envFile -Encoding UTF8
    $secretsHash = @{}
    foreach ($line in $secretsLines) {
        if ($line -match "^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$") {
            $secretsHash[$matches[1]] = $matches[2]
        }
    }
    $newEnvLines = @()
    foreach ($line in $envLines) {
        if ($line -match "^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+)$") {
            $key = $matches[1]
            if ($secretsHash.ContainsKey($key)) {
                $newEnvLines += "$key=$($secretsHash[$key])"
                Write-Host "  覆盖 $key (从 .env.secrets.from-dev)"
            } else {
                $newEnvLines += $line
            }
        } else {
            $newEnvLines += $line
        }
    }
    [System.IO.File]::WriteAllLines($envFile, $newEnvLines, [System.Text.UTF8Encoding]::new($false))
    Write-OK "开发机密钥已合并"
    # 合并后删除临时文件,避免泄露
    Remove-Item $secretsFromFile -Force
    Write-Warn ".env.secrets.from-dev 已删除(避免泄露)"
} else {
    Write-Host "未检测到 .env.secrets.from-dev,跳过合并"
    Write-Host "如需启用 AI 对话,请手动编辑 .env.production 填入 STEPFUN_API_KEY 等"
}

# ==================== 4. 构建 Docker 镜像 ====================
Write-Step "步骤 4/9:构建 Docker 镜像(首次较慢,约 5-15 分钟)"

if ($SkipBuild) {
    Write-Warn "跳过 docker build(-SkipBuild)"
} else {
    Write-Host "构建中...(Next.js build 需要 ~4GB 内存,请耐心等待)"
    docker compose build
    if ($LASTEXITCODE -ne 0) {
        Write-Err "docker compose build 失败"
        Write-Err "常见原因:1) 内存不足(改 deploy/docker/Dockerfile.web NODE_OPTIONS=--max-old-space-size=4096)"
        Write-Err "         2) 网络问题(pnpm install 超时,设 HTTP_PROXY/HTTPS_PROXY)"
        Write-Err "         3) 磁盘空间不足(docker system prune -a 清理)"
        exit 1
    }
    Write-OK "Docker 镜像构建完成"
}

# ==================== 5. 启动核心服务 ====================
Write-Step "步骤 5/9:启动核心服务(db / redis / migrate / api / web / ai-service)"

docker compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Err "docker compose up 失败"
    Write-Err "查看日志:docker compose logs"
    exit 1
}
Write-OK "docker compose up 命令已发出"

# ==================== 6. 等待服务健康 ====================
Write-Step "步骤 6/9:等待服务健康(最多 180 秒)"

$maxWait = 180
$waited = 0
$healthy = $false
while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 5
    $waited += 5
    $statuses = docker compose ps --format json 2>$null | ConvertFrom-Json
    if (-not $statuses) { continue }

    $allHealthy = $true
    foreach ($svc in $statuses) {
        $svcName = $svc.Service
        $svcHealth = $svc.Health
        $svcState = $svc.State
        if ($svcName -in @("db", "redis", "api", "ai-service", "web")) {
            if ($svcState -ne "running") {
                $allHealthy = $false
                Write-Host "  $svcName 状态: $svcState (等待中...)"
            } elseif ($svcHealth -and $svcHealth -ne "healthy") {
                $allHealthy = $false
                Write-Host "  $svcName 健康: $svcHealth (等待中...)"
            }
        }
    }
    if ($allHealthy) {
        $healthy = $true
        break
    }
    Write-Host "  已等待 ${waited}s / ${maxWait}s..."
}

if (-not $healthy) {
    Write-Warn "部分服务未在 ${maxWait}s 内健康,继续部署(可能需要更多时间)"
    Write-Host "查看状态:docker compose ps"
    Write-Host "查看日志:docker compose logs <service>"
} else {
    Write-OK "所有核心服务已健康"
}

# ==================== 7. 启动 Cloudflare Tunnel ====================
Write-Step "步骤 7/9:启动 Cloudflare Tunnel(内网穿透)"

if ($SkipCloudflared) {
    Write-Warn "跳过 cloudflared 启动(-SkipCloudflared)"
} else {
    $cfCompose = "$ProjectRoot\deploy\prod-bundle\cloudflared\docker-compose.cloudflared.yml"
    if (Test-Path $cfCompose) {
        # 从 .env.production 读取 TUNNEL_TOKEN
        $tunnelToken = ""
        foreach ($line in (Get-Content $envFile -Encoding UTF8)) {
            if ($line -match "^TUNNEL_TOKEN=(.+)$") {
                $tunnelToken = $matches[1]
                break
            }
        }
        if (-not $tunnelToken) {
            Write-Err ".env.production 缺 TUNNEL_TOKEN,无法启动 cloudflared"
        } else {
            $env:TUNNEL_TOKEN = $tunnelToken
            docker compose -f $cfCompose up -d
            if ($LASTEXITCODE -ne 0) {
                Write-Err "cloudflared 启动失败"
                Write-Err "查看日志:docker compose -f $cfCompose logs cloudflared"
            } else {
                Write-OK "cloudflared 已启动"
                Write-Host "等待 10 秒让 tunnel 建立..."
                Start-Sleep -Seconds 10
            }
        }
    } else {
        Write-Warn "$cfCompose 不存在,跳过容器化 cloudflared"
        Write-Host "备选:本机直接跑 scripts\start-cloudflared-tunnel.ps1"
    }
}

# ==================== 8. 公网验证 ====================
Write-Step "步骤 8/9:公网验证 https://aizhs.top"

# 本地验证
Write-Host "[本地验证] curl http://localhost:8801/api/health ..."
try {
    $apiHealth = Invoke-RestMethod -Uri "http://localhost:8801/api/health" -TimeoutSec 10 -ErrorAction Stop
    Write-OK "API 健康: $($apiHealth | ConvertTo-Json -Compress)"
} catch {
    Write-Warn "API 健康检查失败(可能还在启动): $_"
}

Write-Host "[本地验证] curl http://localhost:8801/ai-service/health ..."
try {
    $aiHealth = Invoke-RestMethod -Uri "http://localhost:8801/ai-service/health" -TimeoutSec 10 -ErrorAction Stop
    Write-OK "AI Service 健康: $($aiHealth | ConvertTo-Json -Compress)"
} catch {
    Write-Warn "AI Service 健康检查失败(可能还在启动): $_"
}

# 公网验证(只在不跳过 cloudflared 时)
if (-not $SkipCloudflared) {
    Write-Host "[公网验证] curl -I https://aizhs.top/ ..."
    try {
        $resp = Invoke-WebRequest -Uri "https://aizhs.top/" -Method Head -TimeoutSec 30 -ErrorAction Stop
        Write-OK "公网访问 aizhs.top: HTTP $($resp.StatusCode)"
    } catch {
        Write-Warn "公网访问失败(可能 cloudflared 还在建立 tunnel,等 30 秒后重试): $_"
        Start-Sleep -Seconds 30
        try {
            $resp = Invoke-WebRequest -Uri "https://aizhs.top/" -Method Head -TimeoutSec 30 -ErrorAction Stop
            Write-OK "公网访问 aizhs.top(重试后): HTTP $($resp.StatusCode)"
        } catch {
            Write-Warn "公网访问仍失败,检查 cloudflared 日志: docker compose -f deploy\prod-bundle\cloudflared\docker-compose.cloudflared.yml logs"
        }
    }
}

# ==================== 9. 部署报告 ====================
Write-Step "步骤 9/9:部署报告"

Write-Host ""
Write-Host "=========================================="
Write-Host "  IHUI-AI 部署完成"
Write-Host "=========================================="
Write-Host ""
Write-Host "本地访问:"
Write-Host "  Web:      http://localhost:8801"
Write-Host "  API:      http://localhost:8801/api/health"
Write-Host "  AI Service: http://localhost:8801/ai-service/health"
Write-Host ""
Write-Host "公网访问(通过 Cloudflare Tunnel):"
Write-Host "  主站:    https://aizhs.top"
Write-Host "  登录:    https://bsm.aizhs.top/login"
Write-Host ""
Write-Host "默认管理员账号(请立即改密码):"
Write-Host "  用户名:  admin"
Write-Host "  密码:    admin123"
Write-Host ""
Write-Host "常用运维命令:"
Write-Host "  查看状态:  docker compose ps"
Write-Host "  查看日志:  docker compose logs -f <service>"
Write-Host "  重启服务:  docker compose restart <service>"
Write-Host "  停止栈:    docker compose down"
Write-Host "  启动栈:    docker compose up -d"
Write-Host ""
Write-Host "下一步:"
Write-Host "  1. 跑健康检查: powershell -File deploy\prod-bundle\health-check.ps1"
Write-Host "  2. 跑部署后清单: type deploy\prod-bundle\POST-DEPLOY-CHECKLIST.md"
Write-Host "  3. 用 admin/admin123 登录后立即改密码"
Write-Host "  4. (推荐)rotate Cloudflare Tunnel token"
Write-Host ""
Write-OK "部署脚本执行完毕"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
