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

# ── 失败必须到人:邮件是唯一通道(AGENTS.md §5e)─────────────────────────────
# 立因(2026-09-29 实测,不是假想):本文件的失败出口此前只有 `Write-Host` + `exit 1` ——
# grep `mail|smtp|resend|notify|webhook|Invoke-WebRequest` 对本文件 **0 命中**。也就是说
# 备份一整轮失败只有"别的看护恰好去翻日志"时才到人;而 2026-09-24/25 那两次备份断链
# (pg_hba 改 scram、凭据文件缺失)正是靠人肉现读才发现的。现把它接到运维邮件的唯一出口上。
# 调用形态与 deploy/win/ihui-deploy.ps1、scripts/check-credential-health.mjs 同源:
#   · 经 apps/api 的 tsx 入口派生 apps/api/scripts/notify-deploy-failure.ts —— 版式由
#     email-templates.ts 单点决定,**不在本文件自拼 SMTP/Resend**(守门 81 硬拦那一型);
#   · 多行中文正文走 --message-file(**无 BOM** UTF-8):命令行参数还要过一层控制台码页;
#   · **绝不传 --env-file**(tsx v4 会劫持它转发给 node,路径不存在时 node 直接 exit 9);
#   · 收件人不写死在本文件:派发器自己按 apps/api/.env 的 ALERT_EMAIL_TO 解析(§5e);
#   · 去重按**身份**(--alert-id 固定串,不含计数/时间戳/被挡文件名),**没有总量封顶**;
#   · 寄不出去必须留痕:.workbuddy/pg-backup-alert-UNDELIVERED.json + 一行 ERROR,
#     下一次投递成功自动清除。通知自身失败**绝不改备份的退出码**(那是另一件事)。
# 参数只影响上面这段发信,备份/清理/退出码一字未动。
param(
    # 只把"发信"换成派发器的 --dry-run(渲染 + 通道判定,不发网络请求),其余照旧真跑。
    # 刻意不叫 -DryRun:本脚本没有单一写出口(dump 写盘 / 本地轮转删除 / 云侧复制 / 云侧轮转
    # 四处各自写盘),§26 记过"预演只写在一段、别段照样被删"的那一型 —— 一个笼统的开关
    # 会给出"什么都没写"的假承诺。名字把射程写进语义,才不会被误当成本脚本的干跑。
    [switch]$AlertDryRun
)

# param() 必须是脚本首条语句(注释除外),故这行从原位置移到这里,语义与取值一字未改。
$ErrorActionPreference = "Stop"

# 脚本自身崩溃(备份工具缺失 / .env 读不到 / 未预料的终止错误)原先只留一行异常与退出码,
# 同样到人不了。trap 只做"补寄一次告警再按原样失败":不改退出码(仍 1)、不吞原因、不动日志。
trap {
    $why = if ($_) { "$_" } else { '未知异常' }
    # 异常原文可能带出命令行片段 ⇒ 与派发器输出同一把尺子(按行脱敏 + 截断)后再进正文/日志。
    # Get-Command 这一层不是洁癖:告警路径自身成为失败原因,就等于把"看不见"换成"看得很乱"。
    $redact = Get-Command Protect-AlertOutput -ErrorAction SilentlyContinue
    $safe = if ($redact) { Protect-AlertOutput $why } else { $why }
    try {
        Send-FailureAlert -Reason '备份脚本自身异常终止(未跑完本轮)' -Details @($safe)
    } catch {
        Write-Host "[ERROR] 异常告警通道也失败: $($_.Exception.Message)" -ForegroundColor Red
    }
    Write-Host "[ERROR] 备份脚本异常终止: $safe" -ForegroundColor Red
    exit 1
}

$script:AlertSent = $false
# 本部署包专用于本机 D:\IHUI-AI,使用绝对路径(嵌套调用时 MyInvocation 不可靠)
$ProjectRoot = "D:\IHUI-AI"
# G-298(2026-09-28)落点解析:DevEnv 族不再把盘符字面当唯一真相 —— 环境变量
# IHUI_DEVENV_ROOT 优先,否则按 $ProjectRoot 所在盘符派生(<drive>:\DevEnv),
# 与 scripts/seal-c-root-stray.mjs 的 devEnvRoot() 同一条纪律(覆盖 + 派生,两档)。
# 本机两档算出的结果与收口前的字面值逐字符相同(D:\DevEnv),行为零漂移;
# 换卷/挪盘时改一处机器级 env 即可,不必再动本脚本与影子副本两处。
$DevEnvRoot = if ($env:IHUI_DEVENV_ROOT) { $env:IHUI_DEVENV_ROOT } else { (Split-Path -Qualifier $ProjectRoot) + '\DevEnv' }
$psql = Join-Path $DevEnvRoot 'runtimes\pgsql\bin\psql.exe'
$pgDump = Join-Path $DevEnvRoot 'runtimes\pgsql\bin\pg_dump.exe'
$backupDir = Join-Path $DevEnvRoot 'backups\pg'
$retentionDays = 7
# 云备份同步(2026-08-05 加):复制到百度网盘同步盘 = 异地容灾(同步盘自动云同步)
# 字面默认值保持"首行直赋"形态:pg-backup-cadence-audit.mjs 的 parseCloudDir 对本 runner
# 文本做正则首匹配取该赋值(§5b:配置读被执行的那份)—— 改形态要先改解析器,注释里也
# 不得复刻该形态(首匹配会先命中说明文字,把配置读成假值)。
$cloudDir = "D:\BaiduSyncdisk\IHUI-PG-BACKUP"
# G-298:网盘挂载点换址时的覆盖口(与 DevEnv 同一取向:不设 env 则逐字节维持现状)
if ($env:IHUI_BACKUP_CLOUD_DIR) { $cloudDir = $env:IHUI_BACKUP_CLOUD_DIR }

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

# ── 运维邮件的唯一出口(不在本文件自拼传输层)───────────────────────────────
$BrandTsxEntry     = Join-Path $ProjectRoot 'apps\api\node_modules\tsx\dist\cli.mjs'
$BrandNotifyScript = Join-Path $ProjectRoot 'apps\api\scripts\notify-deploy-failure.ts'
# §15:临时物一律项目内(.ihui-agent/tmp/ 已被 .gitignore 忽略),不落 C 盘、不落盘根
$BrandNotifyMsgDir = Join-Path $ProjectRoot '.ihui-agent\tmp\pg-backup-notify'
# 未送达留痕(.workbuddy/ 已忽略)。§5e:"失败必须响" —— 寄不出去得留下可诊断痕迹,
# 而不是像第三方推送时代那样把"邮件只是兜底、失败可以忍"的旧前提带进新通道。
$AlertUndeliveredFile = Join-Path $ProjectRoot '.workbuddy\pg-backup-alert-UNDELIVERED.json'
# 告警身份:固定串,与"这件事是不是同一件"同义。派发器按它在窗口内去重(默认 4h),
# **不得**把库名数量/时间戳/文件名拼进来 —— 那等于每轮换一次身份、去重结构上永不命中。
$AlertIdentity = 'pg-backup-failure'
$AlertTitle    = '数据库备份失败(ihui-pg-backup)'

function Protect-AlertOutput {
    # 转日志前先脱敏 + 截断。派发器自身不回显密钥,但 node 崩溃时会把 require 到的 .env 片段、
    # 整条命令行甚至堆栈倒进 stderr;含凭据字样的行一律不落运维日志(与 ihui-deploy.ps1 同一条纪律)。
    param($Raw)
    if (-not $Raw) { return '(无输出)' }
    $lines = (($Raw | ForEach-Object { "$_" }) -split "`r?`n") | ForEach-Object {
        if ($_ -match '(?i)(api[_-]?key|token|secret|passw|authorization|bearer)') { '[已脱敏]' } else { $_ }
    }
    $s = ($lines -join ' / ').Trim()
    if ($s.Length -gt 240) { $s = $s.Substring(0, 240) + '…(截断)' }
    return $s
}

function Write-AlertUndeliveredMark {
    # 寄不出去 = 故障从未被人看见。留一份标记(不含正文,只留原因与时刻),供巡检与人查。
    param([string]$Why)
    try {
        $dir = Split-Path -Parent $AlertUndeliveredFile
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
        $payload = [ordered]@{
            producer = 'deploy/win/ihui-pg-backup.ps1'
            alertId  = $AlertIdentity
            title    = $AlertTitle
            reason   = (Protect-AlertOutput $Why)
            at       = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz')
        }
        $payload | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $AlertUndeliveredFile -Encoding utf8
        Write-Host "[ERROR] 告警未送达,已留痕: $AlertUndeliveredFile" -ForegroundColor Red
    } catch {
        # 连标记都写不了也不能静默 —— 至少在日志里喊出来
        Write-Host "[ERROR] 告警未送达且留痕失败: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Clear-AlertUndeliveredMark {
    # 下一次投递成功自动清除(与 check-credential-health 的 UNDELIVERED 机制同一套语义)
    if (Test-Path -LiteralPath $AlertUndeliveredFile) {
        Remove-Item -LiteralPath $AlertUndeliveredFile -Force -ErrorAction SilentlyContinue
        Write-Host "[OK] 告警已送达,清除未送达标记 $AlertUndeliveredFile" -ForegroundColor Green
    }
}

function Invoke-BrandAlertMail {
    # 一次派发。返回 $true = 已送达(--strict 下 exit 0)。-Plain = 同一通道不套品牌模板。
    param([string]$Subject, [string]$BodyText, [switch]$Plain)
    $channel = if ($Plain) { '降级纯文本' } else { '品牌模板' }
    $node = Resolve-NodeExe
    # 兜底全落空必须**喊出来**,严禁 `if (Get-Command …) { … }` 无 else 静默降级(§5e / §26 同条禁令)
    if (-not $node) { Write-Host "[ERROR] $channel 通道不可用:node.exe 未找到(PATH 与绝对路径兜底均落空)" -ForegroundColor Red; return $false }
    foreach ($need in @($BrandTsxEntry, $BrandNotifyScript)) {
        if (-not (Test-Path -LiteralPath $need)) { Write-Host "[ERROR] $channel 通道不可用:出口文件不在 $need" -ForegroundColor Red; return $false }
    }
    $msgFile = $null
    try {
        if (-not (Test-Path -LiteralPath $BrandNotifyMsgDir)) { New-Item -ItemType Directory -Force -Path $BrandNotifyMsgDir | Out-Null }
        $text = if ($Plain) { "[降级纯文本]`n$BodyText" } else { $BodyText }
        $msgFile = Join-Path $BrandNotifyMsgDir "$((Get-Date).ToString('yyyyMMdd-HHmmss-fff')).txt"
        # 必须显式无 BOM:写入方不得依赖读取方擦屁股(BOM 会排在正文第一个字符前)
        [System.IO.File]::WriteAllText($msgFile, $text, [System.Text.UTF8Encoding]::new($false))
        $argv = @($BrandTsxEntry, $BrandNotifyScript,
            '--title', $Subject, '--severity', 'critical',
            '--source', 'ihui-pg-backup', '--alert-id', $AlertIdentity,
            '--message-file', $msgFile, '--strict')
        if ($Plain) { $argv += '--plain' }
        if ($AlertDryRun) { $argv += '--dry-run' }
        # 刻意不带 --to:收件人由派发器按 apps/api/.env 的 ALERT_EMAIL_TO 解析(§5e 单一控制点)。
        # 临时把 EAP 降为 Continue:本文件由服务与人工两种上下文跑,5.1 形态的解释器下
        # "Stop + 原生命令写 stderr"会把按退出码判定变成按异常判定(与 ihui-deploy.ps1 同一处理)。
        $prevEap = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            $out = & $node @argv 2>&1
            $code = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $prevEap
        }
        if ($code -eq 0) { return $true }
        Write-Host "[ERROR] $channel 通道未送达(exit=$code): $(Protect-AlertOutput $out)" -ForegroundColor Red
        return $false
    } catch {
        Write-Host "[ERROR] $channel 通道调用异常: $(Protect-AlertOutput $_.Exception.Message)" -ForegroundColor Red
        return $false
    } finally {
        if ($msgFile) { Remove-Item -LiteralPath $msgFile -Force -ErrorAction SilentlyContinue }
    }
}

function Send-FailureAlert {
    # 失败到人的唯一入口:一次备份失败只寄一条(把逐库失败清单并进正文),两条通道都失败才留痕。
    # 本入口**从不改退出码、从不抛**,通知失败绝不让备份链的失败原因被盖掉。
    param([string]$Reason, [string[]]$Details = @())
    if ($script:AlertSent) { Write-Host "[ALERT] 本轮已就一次失败寄过告警,跳过重复发送"; return }
    $script:AlertSent = $true
    $lines = @()
    # 报"实际被执行的那一份":生产跑的是 deploy/prod-bundle/pg-backup.ps1(被 gitignore 的影子副本),
    # 写死入库源路径会让人去改一份根本不执行的文件。
    $lines += "来源: $PSCommandPath(服务 IHUI-PG-BACKUP)"
    $lines += "时刻: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'))"
    $lines += "结论: $Reason"
    if ($Details -and $Details.Count -gt 0) {
        $lines += '明细:'
        foreach ($d in $Details) { $lines += "  - $d" }
    }
    $lines += '下一步: 看日志 D:\DevEnv\logs\pg-backup-scheduler.log;审计节拍跑 node scripts/pg-backup-cadence-audit.mjs'
    $body = $lines -join "`n"
    if (Invoke-BrandAlertMail -Subject $AlertTitle -BodyText $body) {
        if ($AlertDryRun) {
            Write-Host "[ALERT] 预演:品牌模板通道判定通过,**未发信**(dry-run 不写清、不查去重状态)" -ForegroundColor Yellow
        } else {
            Write-Host "[ALERT] 备份失败告警已寄出(品牌模板)" -ForegroundColor Yellow
        }
        if (-not $AlertDryRun) { Clear-AlertUndeliveredMark }
        return
    }
    Write-Host "[ALERT] 品牌模板通道失败,转 --plain 降级重试" -ForegroundColor Yellow
    if (Invoke-BrandAlertMail -Subject $AlertTitle -BodyText $body -Plain) {
        if ($AlertDryRun) {
            Write-Host "[ALERT] 预演:降级纯文本通道判定通过,**未发信**" -ForegroundColor Yellow
        } else {
            Write-Host "[ALERT] 备份失败告警已寄出(降级纯文本)" -ForegroundColor Yellow
        }
        if (-not $AlertDryRun) { Clear-AlertUndeliveredMark }
        return
    }
    Write-Host "[ERROR] 备份失败告警未送达:品牌与降级两条通道均未成功 —— 本轮既有备份失败、又没人会被动知晓" -ForegroundColor Red
    Write-AlertUndeliveredMark -Why "品牌与降级两条通道均未送达(见上方两行 [ERROR])"
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
            Send-FailureAlert -Reason '凭据文件为空,本轮未跑任何导出' -Details @(
                "落点: $credFile",
                '处置: 按 deploy/win/ihui-pg-backup-role.sql 重建只读备份角色并写回口令文件'
            )
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
        Send-FailureAlert -Reason '取不到任何备份凭据,本轮未跑任何导出' -Details @(
            '环境变量 IHUI_DB_BACKUP_USER / IHUI_DB_BACKUP_PASSWORD 未设',
            '§5d 权威目录下的专用角色口令文件不存在(或被码页读成乱码而判为不存在)',
            ".env 里也没有 DB_PASSWORD —— 三条出路见日志本行上方"
        )
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

# ── PG 就绪门(2026-10-01 实测开机竞态,不是假想)────────────────────────────
# 时间线(当日现读):OS 09:08:22 启动 → postmaster 09:08:26 可用(pg_postmaster_start_time())
# → 调度器 09:08:27 就派生 pg_dump ⇒ ihui_dev 与 keycloak 双双 exit=1,错误形态是
# `FATAL: the database system is starting up`;09-30 13:40 那一轮同型,只是更早一步(8810 拒连)。
# 同一窗口里"备份失败"的告警也寄不出去(DNS 首服务器是 link-local fe80::1、路由尚未就绪),
# 于是一台机器重启 = 当晚 03:00 的档没了 + 唯一的补偿档必败 + 补偿失败的通报必哑。
# 口令链**不是**这一型的原因:当日 13:52 用同一套 beifen 凭据手跑 pg_dump rc=0 / 132,843,313 B。
# 调度器 14:16 起的 30 分钟重试只治"等到下一轮",不治"本轮必败且必发一条假故障告警"。
# 本门的价值在两处:① 不拿"库还没起来"去冒充"口令/权限坏了";② 未就绪时**不跑任何导出**,
# 因此日志里出现的失败原因与 pg_dump 的退出码不再同形(旧形态只有一句 exit=1)。
$pgIsReady = Join-Path $DevEnvRoot 'runtimes\pgsql\bin\pg_isready.exe'
# 预算默认 120s,可用 IHUI_PG_READY_TIMEOUT_SEC 覆写。解析不出正整数一律回落 120 **并喊出来** ——
# 绝不回落成"当作已就绪",那等于把门换成一条注释(与本文件头注那条"静默是这类事故唯一的传播方式"同一条禁令)。
$readyBudgetSec = 120
if ($env:IHUI_PG_READY_TIMEOUT_SEC) {
    $parsedReadyBudget = 0
    if ([int]::TryParse([string]$env:IHUI_PG_READY_TIMEOUT_SEC, [ref]$parsedReadyBudget) -and $parsedReadyBudget -gt 0) {
        $readyBudgetSec = $parsedReadyBudget
    } else {
        Write-Host "[WARN] IHUI_PG_READY_TIMEOUT_SEC='$env:IHUI_PG_READY_TIMEOUT_SEC' 不是正整数,按默认 ${readyBudgetSec}s 等就绪" -ForegroundColor Yellow
    }
}
if (-not (Test-Path -LiteralPath $pgIsReady)) {
    # 尺子缺件 ≠ 库没起来。这里刻意 fail-open 继续导出(不比今天差),但必须大声说出跳过了什么 ——
    # 静默跳过会让下一个人以为门一直在生效。
    Write-Host "[WARN] 就绪门跳过:$pgIsReady 不在位(本轮未做 pg_isready 探测,直接尝试导出)" -ForegroundColor Yellow
} else {
    $readyStart = Get-Date
    $readyDeadline = $readyStart.AddSeconds($readyBudgetSec)
    $readyOk = $false
    $readyPolls = 0
    $readyLastCode = $null
    $readyLastOut = ''
    while ((Get-Date) -lt $readyDeadline) {
        $readyPolls++
        # 原生程序的 stderr 在 EAP=Stop 下会被升成终止错误(本文件 176-182 行已有同一处置惯例),
        # 那会把"库还在恢复"伪装成"脚本自身出错"——正是本门要消灭的同形。
        $prevReadyEap = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            $readyLastOut = (& $pgIsReady -h localhost -p $dbPort 2>&1 | Out-String).Trim()
            $readyLastCode = $LASTEXITCODE
        } catch {
            $readyLastOut = "pg_isready 派生异常: $($_.Exception.Message)"
            $readyLastCode = -1
        } finally {
            $ErrorActionPreference = $prevReadyEap
        }
        if ($readyLastCode -eq 0) { $readyOk = $true; break }
        Start-Sleep -Seconds 5
    }
    $readyElapsed = [int]((Get-Date) - $readyStart).TotalSeconds
    if ($readyOk) {
        Write-Host "[OK] 就绪门:数据库可用(第 ${readyPolls} 次探测,耗时 ${readyElapsed}s,port $dbPort)" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] 就绪门:${readyBudgetSec}s 内数据库未就绪(探测 ${readyPolls} 次,最后一次 exit=$readyLastCode)⇒ 本轮不跑任何导出" -ForegroundColor Red
        Send-FailureAlert -Reason "数据库在 ${readyBudgetSec} 秒内未就绪,本轮未跑任何导出" -Details @(
            "pg_isready 最后一次输出: $readyLastOut",
            "pg_isready 退出码: $readyLastCode | 探测次数: $readyPolls | 目标: localhost:$dbPort",
            '定性:这一型不是口令/权限问题 —— 真凭据问题由 pg_dump 与随后的逐库复核点名,两者在日志里形态不同',
            '出路一:调度器会按 30 分钟重试(最多 4 次),库恢复后自动补上本轮',
            '出路二:IHUI_PG_READY_TIMEOUT_SEC=<正整数秒> 调大预算(注意 nssm 服务环境块是整块覆盖语义,按 §5e 事务式做法改)',
            '出路三:查服务 IHUI-PG 是否在跑、其 postmaster 是否卡在恢复(本门用的端口来自 .env 的 DB_PORT)'
        )
        exit 1
    }
}

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
    # 到人邮件:整轮失败只寄一条,逐库失败点并进正文明细(收件人与去重窗口见文件头那段)。
    # 清单里"哪个库失败"逐条点名 —— 与 apps/api 侧按库分开的备份监控告警是同一批事实的两个出口。
    Send-FailureAlert -Reason "本轮备份有 $($failures.Count) 项失败(整轮判失败)" -Details (
        @($failures) + @("备份目录: $backupDir", "在册库: $($backupDatabases -join ', ')")
    )
    exit 1
}
# 刻意**不在"本轮成功"时清未送达标记**:那条标记的含义是"有一次告警没送到人",
# 只有下一次**投递成功**才配清它(Send-FailureAlert 送达分支里做)。备份恢复不等于人已看到那条告警。
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
