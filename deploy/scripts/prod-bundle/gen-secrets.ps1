# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# IHUI-AI 密钥批量生成脚本(Windows PowerShell)
# =============================================================================
# 用法:在 deploy/prod-bundle/ 目录下执行
#   powershell -ExecutionPolicy Bypass -File gen-secrets.ps1
#
# 行为:
#   1. 读取 .env.production.template
#   2. 把所有 <AUTOGEN-*> 占位符替换为强随机值
#   3. 如果 .env.production 已存在,只更新占位符字段,保留其他字段(包括用户已填的真实 key)
#   4. 输出到 .env.production
# =============================================================================
param(
    [string]$Template = ".\.env.production.template",
    [string]$Output = "..\..\.env.production"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $Template)) {
    Write-Error "模板文件不存在: $Template"
    Write-Host "提示:在 deploy/prod-bundle/ 目录下运行此脚本"
    exit 1
}

# 生成密码学安全的随机字符串
function New-RandomHex {
    param([int]$Bytes = 32)
    $buf = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return -join ($buf | ForEach-Object { $_.ToString("x2") })
}

function New-RandomPassword {
    param([int]$Length = 24)
    # 仅用 URL-safe 字符,避免特殊字符在 docker-compose / DATABASE_URL 里出问题
    $chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
    $buf = New-Object byte[] $Length
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    return -join (1..$Length | ForEach-Object { $chars[$buf[$_-1] % $chars.Length] })
}

# 准备替换映射
$replacements = @{
    "<AUTOGEN-DB-PASSWORD>"         = (New-RandomPassword 24)
    "<AUTOGEN-REDIS-PASSWORD>"      = (New-RandomPassword 24)
    "<AUTOGEN-JWT-SECRET>"          = (New-RandomHex 48)
    "<AUTOGEN-CREDENTIALS-KEY>"     = (New-RandomHex 32)
    "<AUTOGEN-AI-CALLBACK-SECRET>"  = (New-RandomHex 32)
    "<AUTOGEN-SERVICE-MESH-JWT>"    = (New-RandomHex 32)
    "<AUTOGEN-AUDIT-HMAC>"          = (New-RandomHex 32)
    "<AUTOGEN-SWAGGER-KEY>"         = (New-RandomHex 32)
    "<AUTOGEN-GRAFANA-PASSWORD>"    = (New-RandomPassword 20)
}

# 读取模板
$templateContent = Get-Content $Template -Raw -Encoding UTF8

# 应用替换
foreach ($placeholder in $replacements.Keys) {
    $value = $replacements[$placeholder]
    $templateContent = $templateContent -replace [regex]::Escape($placeholder), $value
}

# 如果 .env.production 已存在,合并:保留用户已填的字段,只补全/更新自动生成的字段
if (Test-Path $Output) {
    Write-Host "[INFO] .env.production 已存在,执行合并更新(保留用户已填字段)..." -ForegroundColor Yellow
    $existingLines = Get-Content $Output -Encoding UTF8
    $existingKeys = @{}
    foreach ($line in $existingLines) {
        if ($line -match "^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$") {
            $existingKeys[$matches[1]] = $matches[2]
        }
    }
    # 对于已存在的 key,保留原值;对于新 key 或占位符,用新值
    $newLines = $templateContent -split "`n"
    $resultLines = @()
    foreach ($line in $newLines) {
        if ($line -match "^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$") {
            $key = $matches[1]
            $newVal = $matches[2]
            if ($existingKeys.ContainsKey($key)) {
                # 保留已存在值(除非已存在值仍是 <AUTOGEN-*> / <COPY-FROM-DEV-MACHINE> 占位符)
                $existingVal = $existingKeys[$key]
                if ($existingVal -match "^<AUTOGEN-" -or $existingVal -match "^<COPY-FROM-DEV-MACHINE>") {
                    # 占位符,用新值
                    $resultLines += "$key=$newVal"
                } else {
                    # 用户已填的真实值,保留
                    $resultLines += "$key=$existingVal"
                }
            } else {
                $resultLines += "$key=$newVal"
            }
        } else {
            $resultLines += $line
        }
    }
    $templateContent = $resultLines -join "`n"
}

# 写入(UTF-8 无 BOM,避免 Linux 工具解析问题)
[System.IO.File]::WriteAllText((Resolve-Path (Split-Path $Output -Parent)).Path + "\" + (Split-Path $Output -Leaf), $templateContent, [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "[OK] .env.production 已生成: $Output" -ForegroundColor Green
Write-Host ""
Write-Host "已自动生成的密钥(请妥善保管,不要泄露):" -ForegroundColor Cyan
foreach ($placeholder in $replacements.Keys) {
    $field = switch ($placeholder) {
        "<AUTOGEN-DB-PASSWORD>"         { "DB_PASSWORD" }
        "<AUTOGEN-REDIS-PASSWORD>"      { "REDIS_PASSWORD" }
        "<AUTOGEN-JWT-SECRET>"          { "JWT_SECRET" }
        "<AUTOGEN-CREDENTIALS-KEY>"     { "CREDENTIALS_ENCRYPTION_KEY" }
        "<AUTOGEN-AI-CALLBACK-SECRET>"  { "AI_CALLBACK_SECRET" }
        "<AUTOGEN-SERVICE-MESH-JWT>"    { "SERVICE_MESH_JWT_SECRET" }
        "<AUTOGEN-AUDIT-HMAC>"          { "AUDIT_LOG_HMAC_SECRET" }
        "<AUTOGEN-SWAGGER-KEY>"         { "SWAGGER_API_KEY" }
        "<AUTOGEN-GRAFANA-PASSWORD>"    { "GRAFANA_ADMIN_PASSWORD" }
    }
    Write-Host "  $field = $($replacements[$placeholder])"
}
Write-Host ""
Write-Host "下一步:从开发机 .env 拷贝真实 LLM key 等到 .env.production,然后运行 deploy.ps1" -ForegroundColor Yellow
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
