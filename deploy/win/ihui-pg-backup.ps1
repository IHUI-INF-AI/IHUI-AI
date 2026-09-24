# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# IHUI-AI PostgreSQL 定时备份脚本(Windows)
# =============================================================================
# 备份:pg_dump 全库 → D:\DevEnv\backups\pg\ihui_dev_YYYYMMDD_HHMMSS.sql.gz
# 清理:仅保留最近 7 天备份
# 用法(手动): powershell -ExecutionPolicy Bypass -File deploy\prod-bundle\pg-backup.ps1
# 计划:建议每天 03:00 由任务计划程序触发(见 README 说明)
# =============================================================================

$ErrorActionPreference = "Stop"
# 本部署包专用于本机 D:\IHUI-AI,使用绝对路径(嵌套调用时 MyInvocation 不可靠)
$ProjectRoot = "D:\IHUI-AI"
$psql = "D:\DevEnv\runtimes\pgsql\bin\psql.exe"
$pgDump = "D:\DevEnv\runtimes\pgsql\bin\pg_dump.exe"
$backupDir = "D:\DevEnv\backups\pg"
$retentionDays = 7
# 云备份同步(2026-08-05 加):复制到百度网盘同步盘 = 异地容灾(同步盘自动云同步)
$cloudDir = "D:\BaiduSyncdisk\IHUI-PG-BACKUP"

# 读取数据库配置
$dbPw = $null
Get-Content "$ProjectRoot\.env" | ForEach-Object {
    if ($_ -match "^DB_PASSWORD=(.+)$") { $dbPw = $matches[1] }
    if ($_ -match "^DB_NAME=(.+)$") { $dbName = $matches[1] }
    if ($_ -match "^DB_PORT=(.+)$") { $dbPort = $matches[1] }
}
if (-not $dbName) { $dbName = "ihui_dev" }
if (-not $dbPort) { $dbPort = "8810" }
# 备份用 postgres 超级用户(BYPASSRLS,绕过 FORCE RLS 表导出限制;pg_hba 本地 trust 免密)
$dbUser = "postgres"
$dbPw = ""

if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Force -Path $backupDir | Out-Null }

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outFile = "$backupDir\ihui_dev_$stamp.dump"
$env:PGPASSWORD = $dbPw

Write-Host "[1/3] 备份中: $dbName@localhost:$dbPort(超管) → $outFile" -ForegroundColor Cyan
# -Fc = 自定义压缩格式(pg_restore 可直接还原,自带压缩);超管绕过 RLS
& $pgDump -Fc -h localhost -p $dbPort -U $dbUser -d $dbName --no-owner --no-privileges -f $outFile

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $outFile)) {
    Write-Host "[ERROR] 备份失败" -ForegroundColor Red
    # 删除本次失败产生的残留(空)文件,避免污染备份目录与云同步
    Remove-Item -Path $outFile -Force -ErrorAction SilentlyContinue
    exit 1
}
$sizeMB = [math]::Round((Get-Item $outFile).Length / 1MB, 2)
Write-Host "[OK] 备份完成: $sizeMB MB" -ForegroundColor Green

Write-Host "[2/3] 校验备份文件..." -ForegroundColor Cyan
$check = & $psql -h localhost -p $dbPort -U postgres -d $dbName -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>$null
Write-Host "  备份前表数量: $($check.Trim())"

Write-Host "[3/3] 清理 $retentionDays 天前旧备份..." -ForegroundColor Cyan
$cutoff = (Get-Date).AddDays(-$retentionDays)
Get-ChildItem $backupDir -Filter "ihui_dev_*.dump" | Where-Object { $_.LastWriteTime -lt $cutoff } | Remove-Item -Force
$remaining = (Get-ChildItem $backupDir -Filter "ihui_dev_*.dump").Count
Write-Host "[OK] 当前保留备份数: $remaining" -ForegroundColor Green

# 云备份同步(异地容灾):复制最新 dump 到百度网盘同步盘(同步盘自动云同步)
if ($cloudDir) {
    try {
        if (-not (Test-Path $cloudDir)) { New-Item -ItemType Directory -Force -Path $cloudDir | Out-Null }
        $latest = Get-ChildItem $backupDir -Filter "ihui_dev_*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($latest) {
            if ($latest.Length -le 0) {
                # 最新 dump 为0字节(上次备份失败残留),跳过,不覆盖云盘有效备份
                Write-Host "[WARN] 最新 dump ($($latest.Name)) 为 0 字节,跳过云同步以免覆盖有效异地备份" -ForegroundColor Yellow
            } else {
                Copy-Item $latest.FullName "$cloudDir\$($latest.Name)" -Force
                Write-Host "[OK] 云备份同步完成: $cloudDir\$($latest.Name)" -ForegroundColor Green
            }
        }
    } catch {
        Write-Host "[WARN] 云备份同步失败(不影响本地备份): $_" -ForegroundColor Yellow
    }
}
Write-Host "`n备份目录: $backupDir" -ForegroundColor Cyan
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
