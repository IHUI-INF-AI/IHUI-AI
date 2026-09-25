# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# IHUI-AI PostgreSQL 定时备份脚本(Windows)
# =============================================================================
# 备份:pg_dump -Fc 全库 → D:\DevEnv\backups\pg\ihui_dev_YYYYMMDD_HHMMSS.dump(并复制到网盘同步目录)
# 清理:仅保留最近 7 天备份
# 用法(手动): powershell -ExecutionPolicy Bypass -File deploy\prod-bundle\pg-backup.ps1
# 调度:由 nssm 服务 IHUI-PG-BACKUP 常驻跑同级 pg-backup-scheduler.ps1 —— **不是** Windows 任务计划程序
#       (实测 schtasks 全量列表里没有备份任务);调度器启动即备份一次,之后每天 03:00 一轮。
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

function Resolve-NodeExe {
    # 本脚本由 nssm 服务 IHUI-PG-BACKUP 以 LocalSystem 身份跑,而**机器级 PATH 里那串 node 目录是死的**
    # (实测 HKLM\...\Environment\Path 含 `D:\nodejs\`,而该目录不存在;node 真身在用户级 PATH 的
    # `D:\DevEnv\runtimes\node\node.exe`,服务身份读不到 ⇒ 只靠 Get-Command 会在自动轮次里静默落空,
    # 表现为"手动跑用专用角色、服务跑退回应用账号")。候选与 ihui-deploy.ps1:120 / ihui-monitor.ps1:108
    # 同源 —— 那两处也是为同一个坑写了绝对路径兜底。全落空返回 $null,由调用方如实喊出来。
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($cmd -and (Test-Path -LiteralPath $cmd.Source)) { return $cmd.Source }
    foreach ($p in @('D:\DevEnv\runtimes\node\node.exe', 'C:\Program Files\nodejs\node.exe')) {
        if (Test-Path -LiteralPath $p) { return $p }
    }
    return $null
}

# 读取数据库配置。`.env` 由 .gitignore 忽略、不入仓也不进聊天记录;本脚本本来就为拿库名/端口读它,
# 现在顺带取应用账号(仅作为下方"过渡档"凭据来源,不复制口令到任何新文件)。
$dbUserFromDotEnv = $null
$dbPwFromDotEnv = $null
Get-Content "$ProjectRoot\.env" | ForEach-Object {
    if ($_ -match "^DB_NAME=(.+)$") { $dbName = $matches[1] }
    if ($_ -match "^DB_PORT=(.+)$") { $dbPort = $matches[1] }
    if ($_ -match "^DB_USER=(.+)$") { $dbUserFromDotEnv = $matches[1].Trim() }
    if ($_ -match "^DB_PASSWORD=(.+)$") { $dbPwFromDotEnv = $matches[1].Trim() }
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
# 凭据优先级(高→低):
#   ① 服务环境块 IHUI_DB_BACKUP_USER / IHUI_DB_BACKUP_PASSWORD
#   ② §5d 权威目录里的专用角色口令文件(<密钥根>/db-backup/ihui-backup.txt)
#   ③ 兜底:.env 里的应用账号(过渡档 —— 见下面注释为什么允许它)
# ③ 的存在是因为 ② 需要一次超管会话才能建角色,而**备份不能因为这一步没人做就一直断**。
# 实测依据:应用角色 ihui 带 BYPASSRLS,它的 dump 与超管 dump 的 TOC 同为 TABLE DATA 716 条
# ⇒ 用它导出不缺行;它同时也是 API 服务在用的账号,所以 ③ **不新增任何凭据副本**,
# 只是复用磁盘上已有的一份。代价是备份权限偏大(该角色可写),故每轮都在日志里显式警告。
# 想升到终态:跑 deploy\win\ihui-pg-backup-role.sql 建 beifen(只读+BYPASSRLS),
# 把口令写成一行裸文本放进 ② 的路径 —— 这一步由持有超管口令的人自己做,不要把口令交给会话/日志。
$dbUser = $env:IHUI_DB_BACKUP_USER
$dbPw = $env:IHUI_DB_BACKUP_PASSWORD
if (-not $dbPw) {
    $credFile = $null
    # ⚠ 实测坑(2026-09-25,修完角色后仍然退回应用账号才发现的):node 的 stdout 是 UTF-8,
    # 而控制台默认按 GBK 码页解码 ⇒ 带中文的路径(密钥/db-backup/…)会变成乱码字符串,
    # Test-Path 判"不存在" ⇒ 静默退回兜底账号,表面上看像"口令文件没建"。
    # 早上量过"中文当 argv 传出去逐字节无损",那是**入参方向**;出参方向要显式设码页才算数。
    $prevOutEnc = [Console]::OutputEncoding
    try {
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        $nodeExe = Resolve-NodeExe
        if ($nodeExe) {
            try {
                $probe = & $nodeExe (Join-Path $ProjectRoot 'scripts\secret-path.mjs') 'db-backup' 'ihui-backup.txt' 2>&1
                if ($LASTEXITCODE -eq 0 -and $probe) { $credFile = ($probe | Select-Object -First 1).Trim() }
            } catch {
                Write-Host "[WARN] 凭据路径探测异常(跳过专用角色档): $($_.Exception.Message)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "[WARN] 找不到 node.exe(PATH 与绝对路径兜底均落空),无法取专用角色凭据" -ForegroundColor Yellow
        }
    } finally {
        [Console]::OutputEncoding = $prevOutEnc
    }
    if ($credFile -and -not (Test-Path -LiteralPath $credFile)) {
        # 拿到了路径却读不到,和"没有口令文件"是两回事 —— 不分开会让人以为文件没建
        Write-Host "[WARN] 探测到凭据路径但读不到文件(路径解码或权限问题): $credFile" -ForegroundColor Yellow
        $credFile = $null
    }
    if ($credFile -and (Test-Path -LiteralPath $credFile)) {
        $dbPw = (Get-Content -LiteralPath $credFile -TotalCount 1).Trim()
        if (-not $dbUser) { $dbUser = 'beifen' }
        if (-not $dbPw) {
            Write-Host "[ERROR] 凭据文件为空: $credFile" -ForegroundColor Red
            exit 1
        }
    } elseif ($dbPwFromDotEnv) {
        if (-not $dbUser) { $dbUser = $dbUserFromDotEnv }
        $dbPw = $dbPwFromDotEnv
        Write-Host "[WARN] 用 .env 的应用账号『$dbUser』跑备份(过渡档,非终态):未找到 $credFile 之类的专用角色凭据" -ForegroundColor Yellow
        Write-Host "       升终态:deploy\win\ihui-pg-backup-role.sql(需一次超管会话,由口令持有人本机执行)" -ForegroundColor Yellow
    } else {
        Write-Host "[ERROR] 取不到任何备份凭据:环境变量未设、专用角色口令文件不存在、.env 里也没有 DB_PASSWORD" -ForegroundColor Red
        Write-Host "        三条出路:①设 IHUI_DB_BACKUP_USER / IHUI_DB_BACKUP_PASSWORD;②跑角色 SQL 后写口令文件;" -ForegroundColor Yellow
        Write-Host "        ③确认 $ProjectRoot\.env 里 DB_PASSWORD 有值" -ForegroundColor Yellow
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
