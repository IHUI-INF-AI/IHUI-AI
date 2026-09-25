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

# 读取数据库配置(只取库名与端口;口令一律不走 .env,见下方凭据段)
Get-Content "$ProjectRoot\.env" | ForEach-Object {
    if ($_ -match "^DB_NAME=(.+)$") { $dbName = $matches[1] }
    if ($_ -match "^DB_PORT=(.+)$") { $dbPort = $matches[1] }
}
if (-not $dbName) { $dbName = "ihui_dev" }
if (-not $dbPort) { $dbPort = "8810" }
# ── 凭据:备份专用角色,不再用 postgres 登录(2026-09-25 改)────────────────
# 背景实测:pg_hba.conf 在 09-24 04:47 收紧为 local/host 一律 scram-sha-256,而本脚本原先
# 用 `postgres` + 显式空口令(旧注释写着"pg_hba 本地 trust 免密",该前提已不存在)⇒ 备份链
# 自 04:39 那份之后就再没成功过,还因调用方的 `&` 结构缺陷一直被打成"备份完成"。
# 口径:口令**不入仓、不入聊天记录**,落点走 §5d 的权威目录(一行裸口令);解析盘符的唯一实现
# 是 `scripts/lib/key-dir.mjs`,这里经 `scripts/secret-path.mjs` 取路径,脚本内**不抄第二份候选**。
# 子目录名选 ASCII(`db-backup`):**不是**因为本机中文会坏 —— 实测该 .ps1 保持无 BOM UTF-8 时,
# 中文常量经本服务实际使用的解释器(`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`,
# 在这个 Windows 11 26200 上产品版本已是 7.6.2)传给 node 后**逐字节无损**(hex 比对一致)。
# 选 ASCII 只是让"解释器版本 / 控制台代码页"这类未证的差异**不可能**影响一条功能参数;
# 中文留在 Write-Host 与注释里无妨 —— 输出面确实会因 GBK 控制台代码页而花屏(实测),但那不影响判据。
# 完整性依据(不是猜的):应用角色 ihui 带 BYPASSRLS,其 dump 与超管 dump 的 TOC 同为
# TABLE DATA 716 条(对象 5226 vs 5221)⇒ 非超管不会少行;新角色照此只授 BYPASSRLS + 读权限。
$dbUser = if ($env:IHUI_DB_BACKUP_USER) { $env:IHUI_DB_BACKUP_USER } else { 'ihui_backup' }
$dbPw = $env:IHUI_DB_BACKUP_PASSWORD
if (-not $dbPw) {
    $probe = & node (Join-Path $ProjectRoot 'scripts\secret-path.mjs') 'db-backup' 'ihui-backup.txt' 2>&1
    $probeRc = $LASTEXITCODE
    if ($probeRc -eq 0) {
        $credFile = ($probe | Select-Object -First 1).Trim()
        $dbPw = (Get-Content -LiteralPath $credFile -TotalCount 1).Trim()
        if (-not $dbPw) {
            Write-Host "[ERROR] 凭据文件为空: $credFile" -ForegroundColor Red
            exit 1
        }
    } else {
        # exit 1 = 凭据目录或文件不存在;exit 2 = 连凭据根都不可达 ⇒ 这两种都不是"口令错误",必须说清
        Write-Host "[ERROR] 取不到备份凭据(node scripts/secret-path.mjs exit=$probeRc):" -ForegroundColor Red
        foreach ($l in $probe) { Write-Host "        $l" -ForegroundColor Yellow }
        Write-Host "        角色建制 SQL: deploy\win\ihui-pg-backup-role.sql(需一次超管会话)" -ForegroundColor Yellow
        Write-Host "        临时顶一次(不必建角色):设 IHUI_DB_BACKUP_USER / IHUI_DB_BACKUP_PASSWORD" -ForegroundColor Yellow
        Write-Host "        注:应用角色 ihui 亦可(实测其 dump 与超管同 TOC),但它是 createdb+bypassrls 的高权角色,只作过渡" -ForegroundColor Yellow
        exit 1
    }
}
$env:PGPASSWORD = $dbPw

if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Force -Path $backupDir | Out-Null }

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outFile = "$backupDir\ihui_dev_$stamp.dump"

Write-Host "[1/3] 备份中: $dbName@localhost:$dbPort(角色 $dbUser) → $outFile" -ForegroundColor Cyan
# -Fc = 自定义压缩格式(pg_restore 可直接还原,自带压缩);$dbUser 带 BYPASSRLS,不会漏被 RLS 遮蔽的行
# -w = 禁止回落交互式口令提示(见文件头:scram 下无口令会挂在控制台上,而非快速失败)
& $pgDump -w -Fc -h localhost -p $dbPort -U $dbUser -d $dbName --no-owner --no-privileges -f $outFile

if ($LASTEXITCODE -ne 0 -or -not (Test-Path $outFile)) {
    Write-Host "[ERROR] 备份失败" -ForegroundColor Red
    # 删除本次失败产生的残留(空)文件,避免污染备份目录与云同步
    Remove-Item -Path $outFile -Force -ErrorAction SilentlyContinue
    exit 1
}
$sizeMB = [math]::Round((Get-Item $outFile).Length / 1MB, 2)
Write-Host "[OK] 备份完成: $sizeMB MB" -ForegroundColor Green

Write-Host "[2/3] 复核数据库可连通 + 表数量..." -ForegroundColor Cyan
# 原先这里是 `2>$null` 且不看退出码:psql 失败时 $check 为 $null,而 $null.Trim() 在
# $ErrorActionPreference=Stop 下抛一句与原因无关的 RuntimeException,把"连不上/口令错"
# 伪装成"脚本自身出错"。本票要根治的就是这类静默,故此处改为如实报原因。
$check = & $psql -w -h localhost -p $dbPort -U $dbUser -d $dbName -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($check)) {
    Write-Host "[ERROR] 复核查询失败(exit=$LASTEXITCODE):角色 $dbUser 可能缺少 CONNECT / SELECT 权限,见 deploy\win\ihui-pg-backup-role.sql" -ForegroundColor Red
    exit 1
}
Write-Host "  public 表数量: $($check.Trim())"

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
