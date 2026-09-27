# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# IHUI-AI PostgreSQL 定时备份脚本(Windows)
# =============================================================================
# 备份:pg_dump -Fc 逐库导出 → D:\DevEnv\backups\pg\<库名>_YYYYMMDD_HHMMSS.dump(并补齐网盘同步目录的缺口)
#       清单 = ihui_dev + keycloak(2026-09-28 起;为何是这两个、为何不含测试库,见下方 $backupDatabases 注释)
# 清理:本地与云侧同窗轮转(最近 7 天);识别式只认 ihui*/keycloak* 的 .dump/.sql.gz,
#       所以同目录里的 pg_hba 现场存档与 backup.log 不会被顺手带走
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

# ── 备份清单:这一行承载"哪些库必须被备份"的决定 ────────────────────────────
# 2026-09-28 加入 keycloak,依据是当日现读量化(只读 SELECT/目录表,零写入):
#   它是本机唯一**非再生、且此前完全没有备份**的库 —— 全仓 *.yml/yaml/json 对 keycloak 零命中
#   (没有 realm-export、没有 kc.sh、没有 compose 服务),realm `ihui` 只活在这个库里,
#   而 OIDC discovery 现回 200、库里有 live JDBC_PING 连接 ⇒ SSO 身份提供方的状态在跑,丢了就是登录入口。
#   代价实测:整库 13.6MB / 87 张表,日增导出量 57KB 级(对比 ihui_dev 每日 ~4.5MB)。
#   ihui_ci_test / ihui_e2e **不**进清单:与生产零 user-UUID 重叠、可分别从 drizzle 迁移与 e2e 重放重建
#   (scripts/check-migration-from-zero.mjs 就是这个动作),备份它们只是把过期测试流量抄两份。
# 角色前提:**不需要**任何新的授权。实测(2026-09-28,只读)
#   has_database_privilege('beifen','keycloak','CONNECT') = t 且该库 87 张表读得到 ——
#   keycloak 的 pg_database.datacl 为 NULL(PUBLIC 默认 CONNECT/TEMP),而 ihui_dev 虽已收紧成
#   `{=Tc/ihui, ihui=CTc/ihui, beifen=c/ihui}`(字面上没有 CONNECT 位),beifen 照样连得上:
#   PostgreSQL 里库级 CREATE 隐含 CONNECT。所以"给 beifen 补一条 GRANT CONNECT"是多余动作,
#   别照着某个代理的报告去做它——它把"没有显式授权"读成了"没有权限"。
#   真缺权限时不会静默少一份档:下面的逐库 [复核] 会点名报错。
$backupDatabases = @($dbName, 'keycloak') | Select-Object -Unique

# 备份文件的统一识别式:本地与云盘两侧共用一份,防止"清理逻辑匹配不到自己产出的文件"
# (2026-09-28 实测后果:旧写法写死 -Filter "ihui_dev_*.dump",而目录里躺着 dash 命名的
#  `ihui-dev-20260924-073532.dump` 与两份 `.sql.gz` ⇒ 161,263,150 B 永久清不掉,
#  云盘目录更是**零清理代码**,以 36.7 GiB/年 累积)。
# 刻意只认 ihui/keycloak 前缀 + 这两种扩展名:同目录里的 pg_hba.conf.pre-admin-* 与 backup.log
# 是改配置前的现场存档,不属于备份轮转对象,不得被清理顺手带走。
function Get-BackupArtifacts([string]$dir) {
    if (-not (Test-Path -LiteralPath $dir)) { return @() }
    @(Get-ChildItem -LiteralPath $dir -File | Where-Object { $_.Name -match '^(ihui|keycloak)[-_].*\.(dump|sql\.gz)$' })
}

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$failures = @()

foreach ($db in $backupDatabases) {
    $outFile = Join-Path $backupDir "$($db)_$stamp.dump"
    Write-Host "[备份] $db @ localhost:$dbPort(角色 $dbUser)→ $outFile" -ForegroundColor Cyan
    # -Fc = 自定义压缩格式(pg_restore 可直接还原,自带压缩);$dbUser 带 BYPASSRLS,不会漏被 RLS 遮蔽的行
    # --no-owner 只重映射属主;ACL **必须**保留(2026-09-27 实测教训:同批多带一个 --no-privileges
    # 会把 5 条表级授权从每一份档里抹掉,恢复后应用角色 ihui_app 的读写路径静默失效)
    # -w = 禁止回落交互式口令提示(见文件头:scram 下无口令会挂在控制台上,而非快速失败)
    & $pgDump -w -Fc -h localhost -p $dbPort -U $dbUser -d $db --no-owner -f $outFile
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $outFile)) {
        Write-Host "[ERROR] 备份失败: $db(exit=$LASTEXITCODE)" -ForegroundColor Red
        Remove-Item -LiteralPath $outFile -Force -ErrorAction SilentlyContinue
        $failures += "pg_dump $db"
        continue
    }
    $sizeMB = [math]::Round((Get-Item -LiteralPath $outFile).Length / 1MB, 2)
    Write-Host "[OK] $db 备份完成: $sizeMB MB" -ForegroundColor Green

    # 逐库复核可连通 + 读得到表:这一步是"备份角色对**这个**库到底有没有权限"的现读判据。
    # 新增一个库而没有先授 CONNECT 时,pg_dump 会直接失败,而这里再量一次 psql 是为了把原因说准:
    # 上一份档存在 ≠ 这个角色读得到这个库。
    # 原先这里是 `2>$null` 且不看退出码:psql 失败时 $check 为 $null,而 $null.Trim() 在
    # $ErrorActionPreference=Stop 下抛一句与原因无关的 RuntimeException,把"连不上/口令错"
    # 伪装成"脚本自身出错"。本票要根治的就是这类静默,故此处改为如实报原因。
    $check = & $psql -w -h localhost -p $dbPort -U $dbUser -d $db -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($check)) {
        Write-Host "[ERROR] 复核查询失败: $db(exit=$LASTEXITCODE)—— 角色 $dbUser 可能缺少该库的 CONNECT,见 deploy\win\ihui-pg-backup-role.sql" -ForegroundColor Red
        $failures += "复核 $db"
        continue
    }
    Write-Host "  $db public 表数量: $($check.Trim())"
}

$cutoff = (Get-Date).AddDays(-$retentionDays)

Write-Host "[清理] 本地保留 $retentionDays 天..." -ForegroundColor Cyan
$expired = @(Get-BackupArtifacts $backupDir | Where-Object { $_.LastWriteTime -lt $cutoff })
$reclaimed = 0
foreach ($f in $expired) {
    $reclaimed += $f.Length
    Remove-Item -LiteralPath $f.FullName -Force -ErrorAction SilentlyContinue
    Write-Host "  删除过期档:$($f.Name)"
}
$kept = @(Get-BackupArtifacts $backupDir)
Write-Host "[OK] 本地保留 $($kept.Count) 份,回收 $([math]::Round($reclaimed/1MB,1)) MB" -ForegroundColor Green

# 云备份同步(异地容灾):把保留窗口内**每一份**还没进同步盘的 dump 补过去(同步盘自动云同步)
#
# 旧写法只复制"最新一份"。2026-09-27 的备份节拍审计(scripts/pg-backup-cadence-audit.mjs)量到
# 后果:本地 09-21/22/23 三份 dump 都在,云盘目录里却一天都没有 —— 某天复制成功了,第二天又被
# "只取最新"跳过,那一天**永远补不回来**。异地腿的意义正是"本机整盘没了还有",而它缺哪天不由
# 我们决定,所以改成按缺口补:这一轮漏了下轮自动带上,不靠人记得。稳态字节数不变(每日新增一份、
# 复制一份),差别只出现在"曾经漏掉"的日子里。
if ($cloudDir) {
    try {
        if (-not (Test-Path $cloudDir)) { New-Item -ItemType Directory -Force -Path $cloudDir | Out-Null }
        $pending = @(Get-BackupArtifacts $backupDir |
            Where-Object { $_.LastWriteTime -ge $cutoff -and -not (Test-Path -LiteralPath "$cloudDir\$($_.Name)") })
        if ($pending.Count -eq 0) { Write-Host "[OK] 云备份同步:窗口内无缺口" -ForegroundColor Green }
        foreach ($f in $pending) {
            if ($f.Length -le 0) {
                # 0 字节 = 上次备份失败的残留,跳过它,而不是把一份空档当成"有效异地备份"同步出去
                Write-Host "[WARN] 跳过 0 字节 dump(上次失败残留): $($f.Name)" -ForegroundColor Yellow
                continue
            }
            Copy-Item $f.FullName "$cloudDir\$($f.Name)" -Force
            if (-not (Test-Path -LiteralPath "$cloudDir\$($f.Name)")) {
                # 复制"没报错却没落盘"(网盘占位/磁盘满/句柄被同步客户端拿走)必须响 —— 否则这条腿的
                # 失败形态就是"日志写着同步完成,盘上没有",而账面一切正常。
                throw "复制后回读失败:$cloudDir\$($f.Name)"
            }
            Write-Host "[OK] 云备份同步完成: $cloudDir\$($f.Name)" -ForegroundColor Green
        }
        # 云侧也要轮转:此前这条腿**完全没有清理代码**,15 份档 1.44GB 且在以 36.7 GiB/年 累积 ——
        # 网盘配额是别人给的额度,撞顶的后果不是报错而是同步客户端静默停止上传,
        # 那时异地腿的失败形态与"从没配过"一模一样。窗口与本地一致(7 天),只认同一识别式。
        $cloudExpired = @(Get-BackupArtifacts $cloudDir | Where-Object { $_.LastWriteTime -lt $cutoff })
        $cloudReclaimed = 0
        foreach ($f in $cloudExpired) {
            # 只删**本地已不再有**的那份:本地仍在窗口内而云侧过期,说明这是同一轮的时钟差,
            # 宁可多留一天也不能把异地腿删得比本地还少。
            if (Test-Path -LiteralPath (Join-Path $backupDir $f.Name)) { continue }
            $cloudReclaimed += $f.Length
            Remove-Item -LiteralPath $f.FullName -Force -ErrorAction SilentlyContinue
            Write-Host "  删除云侧过期档:$($f.Name)"
        }
        Write-Host "[OK] 云侧保留 $(@(Get-BackupArtifacts $cloudDir).Count) 份,回收 $([math]::Round($cloudReclaimed/1MB,1)) MB" -ForegroundColor Green
    } catch {
        Write-Host "[WARN] 云备份同步失败(不影响本地备份): $_" -ForegroundColor Yellow
    }
}

Write-Host "`n备份目录: $backupDir" -ForegroundColor Cyan
if ($failures.Count -gt 0) {
    # 一个库失败不能让另一个库的成功被读成"整轮成功";调度器就是按本脚本退出码打"备份完成/失败"的。
    Write-Host "[ERROR] 本轮有 $($failures.Count) 项失败:$($failures -join '; ')" -ForegroundColor Red
    exit 1
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
