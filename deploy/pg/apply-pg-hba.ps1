# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
<#
.SYNOPSIS
    IHUI-AI 生产 PostgreSQL 认证配置(pg_hba.conf)收紧的**人工执行入口**(O20c)。

.DESCRIPTION
    这个脚本给人跑,不给任何自动环节跑:它不注册计划任务、不装服务、不进钩子链,
    仓库里一旦出现引用它的自动化调用点,apps/api/tests/o20c-pg-hba-policy.test.ts
    的判据 A6 会直接红(理由见下)。

    为什么收紧这件事必须留人工:pg_hba 是唯一"改错一次就可能把管理员自己锁在门外"
    的配置,而它的失败形态不是报错而是**静默**。2026-09-25 的真实事故就是"改成口令
    认证之后才发现这台机从没人给 postgres 设过口令"⇒ 收紧之后管理员对谁都不通,
    包括改配置的人。所以本脚本把"先确认管理员口令可用"做成一条必须显式给出的开关,
    而不是注释里的一句提醒。

    为什么只提示 reload、绝不调用重启:换认证配置不需要重启数据库(reload 即生效、
    不断已有连接),而重启会打断全部在跑的连接、把上层服务的重连窗口暴露给人。把
    "能重启"这件事从脚本里彻底拿掉,比"提醒不要重启"更可靠 —— 少一条代码路径,就少
    一次有人在半夜顺手加上它的可能。

.PARAMETER DataDir
    数据库**数据目录**(现行 pg_hba.conf 所在处)。必须显式给:取法是从数据库服务的
    命令行里读 `runservice -D` 之后那一段,不要照抄任何文档里的路径(本仓已多次因把
    另一台机的盘符当本机事实而误诊)。

.PARAMETER TargetFile
    目标态配置。默认取与本脚本同级的 pg_hba.prod.conf(即本仓入库的那份真相源)。

.PARAMETER Apply
    不给 = 只做预检与差异报告,一个字节都不写(默认安全)。
    给 = 先备份现网文件,校验目标文件自洽,再原位落地。

.PARAMETER ConfirmAdminLogin
    声明"我已经用**当前**(尚未改动)的配置逐条实测过各角色能口令登录"。
    -Apply 必须与它同时给,否则拒绝执行。要测哪几条见预检输出。

.PARAMETER Rollback
    用最近一份 pg_hba.conf.pre-o20c-*.bak 还原现网文件(还原同样走临时文件 + 改名,
    不就地截断)。给出时不再做落地动作。

.EXAMPLE
    # 第 1 步:只预检、只看差异,不写盘
    pwsh -File apply-pg-hba.ps1 -DataDir <你的数据目录>

.EXAMPLE
    # 第 2 步:逐条确认口令可用后落地(仍需人工再跑一次 reload)
    pwsh -File apply-pg-hba.ps1 -DataDir <你的数据目录> -Apply -ConfirmAdminLogin

.EXAMPLE
    # 出问题:还原现网文件(还原后同样要人跑 reload 才生效)
    pwsh -File apply-pg-hba.ps1 -DataDir <你的数据目录> -Rollback
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string] $DataDir,
    [string] $TargetFile = '',
    [switch] $Apply,
    [switch] $ConfirmAdminLogin,
    [switch] $Rollback
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($TargetFile)) {
    $TargetFile = Join-Path $PSScriptRoot 'pg_hba.prod.conf'
}

# 被保护的目录名:凭据/备份一类的整目录**绝不**是本脚本的写入对象。
# 与 AGENTS.md §26「整目录不扫不删」同源 —— 这里防的是"人把 -DataDir 传歪了":
# 传歪之后脚本会往凭据目录里写一个 pg_hba.conf,那是不可逆的污染。
$ProtectedDirNames = @('密钥', 'secrets', 'secret', 'credentials', 'credential', 'backups', 'BaiduSyncdisk')

# 认证方法白名单:判据与 apps/api/tests/o20c-pg-hba-policy.test.ts 同源。
# 两边任一漂移都会在测试侧红 —— 脚本这一份只用于"落地前别写坏文件",测试那一份才是长期看守。
$AllowedMethods = @('scram-sha-256', 'md5', 'reject')
$NoPasswordMethods = @('trust', 'password', 'cert', 'peer', 'ident', 'sspi', 'gss', 'gssenc', 'ldap', 'pam', 'radius', 'ssh')
$AllowedRoles = @('all', 'postgres', 'ihui', 'beifen')
$SuperuserCarryingRoles = @('all', 'postgres')
$TargetDb = 'ihui_dev'

function Test-ProtectedDir {
    param([string] $Path)
    $full = [System.IO.Path]::GetFullPath($Path)
    foreach ($seg in ($full -split '[\\/]')) {
        if ($ProtectedDirNames -contains $seg) { return $seg }
    }
    return $null
}

function Split-HbaLine {
    <# 剥掉行内注释(整行 # 与行尾 #;本档不使用带 # 的引号值),返回字段数组。 #>
    param([string] $Line)
    $code = $Line
    $hashAt = $code.IndexOf('#')
    if ($hashAt -ge 0) { $code = $code.Substring(0, $hashAt) }
    return , @($code -split '\s+' | Where-Object { $_ -ne '' })
}

function Read-HbaRecords {
    param([string[]] $RawLines)
    $out = [System.Collections.Generic.List[object]]::new()
    $lineNo = 0
    foreach ($line in $RawLines) {
        $lineNo++
        $tokens = Split-HbaLine -Line $line
        if ($tokens.Count -eq 0) { continue }
        $out.Add([pscustomobject]@{
                Line   = $lineNo
                Type   = [string] $tokens[0]
                Tokens = $tokens
                Text   = ($tokens -join ' ')
            })
    }
    return , $out.ToArray()
}

function Get-HbaMethod {
    <# 取认证方法字段:local 记录在第 4 位,host 系记录在第 5 位(带选项时仍取该位之后的末位)。 #>
    param($Record)
    $tok = $Record.Tokens
    if ($Record.Type -eq 'local') {
        if ($tok.Count -lt 4) { return '' }
        return [string] $tok[($tok.Count - 1)]
    }
    if ($tok.Count -lt 5) { return '' }
    return [string] $tok[($tok.Count - 1)]
}

function Get-HbaIssues {
    <# 结构化自洽校验:字段数、地址形态、方法白名单、顺序、角色范围、口令内联。 #>
    param([string] $Path)
    $issues = [System.Collections.Generic.List[string]]::new()
    $raw = @(Get-Content -LiteralPath $Path)
    $records = @(Read-HbaRecords -RawLines $raw)

    if ($records.Count -eq 0) {
        $issues.Add('一个记录都没解析到:要么是空文件,要么解析方式不对 —— 空扫不得当成通过')
        return , $issues.ToArray()
    }

    $seenCatchAll = $false
    foreach ($r in $records) {
        $tok = $r.Tokens
        $where = "第 $($r.Line) 行"
        $isLocal = ($r.Type -eq 'local')
        $isHost = ($r.Type -in @('host', 'hostssl', 'hostnossl', 'hostgssenc', 'hostgssnotenc'))

        if ($r.Type -in @('include', 'include_dir')) {
            $issues.Add("$where : 本档不使用 $($r.Type) 机制(目标态要求全部规则在同一份文件里可审)")
            continue
        }
        if (-not ($isLocal -or $isHost)) {
            $issues.Add("$where : 未知记录类型 → $($r.Type)")
            continue
        }
        $wantCount = if ($isLocal) { 4 } else { 5 }
        if ($tok.Count -notin @($wantCount, ($wantCount + 1))) {
            $issues.Add("$where : $($r.Type) 记录应为 $wantCount 或 $($wantCount + 1) 字段(实际 $($tok.Count)) → $($r.Text)")
            continue
        }

        $db = [string] $tok[1]
        $user = [string] $tok[2]
        $method = Get-HbaMethod -Record $r
        if ($isHost) {
            $addr = [string] $tok[3]
            if ($addr -notin @('all', 'samehost', 'samenet') -and $addr -notmatch '^[0-9a-fA-F:.]+(/\d+)?$') {
                $issues.Add("$where : 地址字段形态不合法 → $addr")
            }
        }

        if ($method -notin $AllowedMethods) {
            $tag = if ($NoPasswordMethods -contains $method) { '免口令/弱口令方法' } else { '白名单外的方法' }
            $issues.Add("$where : 认证方法 $method 属$tag,允许集合 = $($AllowedMethods -join '/')")
        }
        if ($method -eq 'md5') {
            $same = [string] $raw[$r.Line - 1]
            $prev = if ($r.Line -ge 2) { [string] $raw[$r.Line - 2] } else { '' }
            if (("$same $prev") -notmatch 'md5-legacy-reason:') {
                $issues.Add("$where : 用 md5 必须在同行或紧邻上行写 md5-legacy-reason: <原因>")
            }
        }
        if (($NoPasswordMethods -contains $method) -and ($SuperuserCarryingRoles -contains $user)) {
            $issues.Add("$where : 免密方法与可携带 superuser 的 USER 字段($user)同时出现 —— 这正是本票要消掉的那一格")
        }
        if ($user -notin $AllowedRoles) {
            $issues.Add("$where : USER 字段 $user 不在角色白名单($($AllowedRoles -join '/'))内;新增角色须同步改判据并写明理由")
        }
        if (($user -eq 'beifen') -and ($method -ne 'reject') -and ($db -ne $TargetDb)) {
            $issues.Add("$where : 备份角色 beifen 只能访问 $TargetDb(实际 $db)")
        }

        $isCatchAll = ($db -eq 'all' -and $user -eq 'all' -and $method -ne 'reject')
        if ($isCatchAll) { $seenCatchAll = $true }
        elseif ($seenCatchAll) { $issues.Add("$where : 兜底放行行(all × all)之后仍有规则行,它永远不会被匹配到 → $($r.Text)") }
    }

    $allows = @($records | Where-Object { ($_.Tokens -contains 'beifen') -and ((Get-HbaMethod -Record $_) -ne 'reject') })
    if ($allows.Count -eq 0) { $issues.Add("缺少 beifen 的允许条目:备份链会连不上(判据要求它存在且只指向 $TargetDb)") }

    $rawText = [System.IO.File]::ReadAllText($Path)
    if ($rawText -match '(?i)\b(pass(?:word|wd)|pwd|secret|token|api[_-]?key|access[_-]?key)\b\s*[=:]\s*[!-~]{8,}') {
        $issues.Add('疑似把真实口令/密钥内联进了配置文件:pg_hba 不承载口令,凭据一律走 §5d 的权威目录')
    }
    return , $issues.ToArray()
}

function Write-AtomicInPlace {
    <#
      临时文件 + 改名替换,而不是就地截断写。
      理由:reload 与在途会话可能读到"写了一半"的 pg_hba;同卷改名是原子的,读侧要么拿到
      旧的一整份、要么拿到新的一整份,不存在中间态。落盘后必须回读比对,不得把"没抛错"当成功。
    #>
    param([string] $Content, [string] $Destination)
    $tmp = "$Destination.o20c-tmp"
    [System.IO.File]::WriteAllText($tmp, $Content, [System.Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $tmp -Destination $Destination -Force
    $back = [System.IO.File]::ReadAllText($Destination)
    if ($back -ne $Content) {
        throw "落地后回读内容与预期不一致:$Destination"
    }
}

function Show-ReloadHint {
    param([string] $Dir)
    Write-Host ''
    Write-Host '── 下一步必须人工执行 reload(**不是重启服务**)──────────────────────────' -ForegroundColor Cyan
    Write-Host '   两种等价写法,任选其一:' -ForegroundColor White
    Write-Host '     A) 在管理会话里:SELECT pg_reload_conf();' -ForegroundColor White
    Write-Host "     B) <pg_ctl 路径> -D `"$Dir`" reload" -ForegroundColor White
    Write-Host '   reload 只让服务端重读配置,不中断已有连接;重启会打断全部在跑的连接。' -ForegroundColor Yellow
    Write-Host '   本脚本刻意不调用任何进程控制命令:少一条代码路径,就少一次半夜顺手重启的可能。' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '   生效核验(逐条跑,把实测结果登记回 PROJECT_PLAN 的 O20c 条目):' -ForegroundColor White
    Write-Host '     1) 管理角色可口令登录            —— psql -h localhost -p <端口> -U postgres -d postgres -c "select current_user"' -ForegroundColor White
    Write-Host '     2) 备份角色连业务库必须成功      —— psql -h localhost -p <端口> -U beifen -d <业务库> -c "select 1"' -ForegroundColor White
    Write-Host '     3) 备份角色连其它库必须被拒      —— psql -h localhost -p <端口> -U beifen -d postgres -c "select 1"' -ForegroundColor White
    Write-Host '     4) 备份角色走共享内存必须被拒    —— psql -p <端口> -U beifen -d <业务库> -c "select 1"' -ForegroundColor White
    Write-Host '     5) 免密路径确实没了:下面这条查询里不得出现任何 auth_method = trust 的行' -ForegroundColor White
    Write-Host '        SELECT line_number, type, database, user_name, address, auth_method, error FROM pg_hba_file_rules ORDER BY line_number;' -ForegroundColor White
    Write-Host '   服务端逐行判读走 pg_hba_file_rules(error 列非空即该行有语法/取值问题);' -ForegroundColor Yellow
    Write-Host '   pg_file_settings 只覆盖 postgresql.conf 一侧,看不到 pg_hba 的条目 —— 别看错表。' -ForegroundColor Yellow
}

# ── 0. 路径与保护目录检查(在任何写盘动作之前)──────────────────────────────
if (-not (Test-Path -LiteralPath $DataDir -PathType Container)) {
    Write-Host "[STOP] 数据目录不存在:$DataDir" -ForegroundColor Red
    Write-Host '       取法:从数据库服务的命令行里读 runservice -D 之后那一段,不要照抄文档。' -ForegroundColor Yellow
    exit 1
}
$guard = Test-ProtectedDir -Path $DataDir
if ($guard) {
    Write-Host "[STOP] -DataDir 落在受保护目录名 `$guard 之内:$DataDir" -ForegroundColor Red
    Write-Host '       凭据/备份一类的整目录不是本脚本的写入对象(AGENTS.md §26)。' -ForegroundColor Yellow
    exit 1
}
$current = Join-Path $DataDir 'pg_hba.conf'
if (-not (Test-Path -LiteralPath $current -PathType Leaf)) {
    Write-Host "[STOP] 现网文件不存在:$current" -ForegroundColor Red
    Write-Host '       本脚本不凭空创建 pg_hba.conf —— 找不到数据目录就是传歪了。' -ForegroundColor Yellow
    exit 1
}
if (-not (Test-Path -LiteralPath $TargetFile -PathType Leaf)) {
    Write-Host "[STOP] 目标态文件不存在:$TargetFile" -ForegroundColor Red
    exit 1
}

Write-Host '══ IHUI-AI · O20c pg_hba 收紧(人工执行入口)════════════════════════════' -ForegroundColor Cyan
Write-Host "  现网文件 : $current"
Write-Host "  目标文件 : $TargetFile"
Write-Host "  模式     : $(if ($Rollback) { '回滚' } elseif ($Apply) { '落地(-Apply)' } else { '预检(不写盘)' })"

# ── 1. 回滚分支 ──────────────────────────────────────────────────────────────
if ($Rollback) {
    $baks = @(Get-ChildItem -LiteralPath $DataDir -Filter 'pg_hba.conf.pre-o20c-*.bak' | Sort-Object LastWriteTime -Descending)
    if ($baks.Count -eq 0) {
        Write-Host '[STOP] 找不到任何 pg_hba.conf.pre-o20c-*.bak,无法回滚。' -ForegroundColor Red
        Write-Host '       此时唯一的出路是按现网原样人工核对恢复,不要从模板造一份。' -ForegroundColor Yellow
        exit 1
    }
    $pick = $baks[0]
    Write-Host "  还原源   : $($pick.FullName)($($pick.LastWriteTime))"
    $content = [System.IO.File]::ReadAllText($pick.FullName)
    Write-AtomicInPlace -Content $content -Destination $current
    Write-Host '[OK] 已还原现网文件(尚未生效 —— 还要人跑一次 reload)' -ForegroundColor Green
    Show-ReloadHint -Dir $DataDir
    exit 0
}

# ── 2. 目标文件自洽校验 ─────────────────────────────────────────────────────
$issues = @(Get-HbaIssues -Path $TargetFile)
Write-Host ''
Write-Host '── 预检 1/3 目标文件结构自洽 ─────────────────────────────────────────────' -ForegroundColor Cyan
if ($issues.Count -gt 0) {
    foreach ($i in $issues) { Write-Host "  [X] $i" -ForegroundColor Red }
    Write-Host '[STOP] 目标文件未通过结构校验 ⇒ 不备份、不写盘(避免留下一份"改过但没生效"的现场)' -ForegroundColor Yellow
    exit 1
}
Write-Host "  [OK] 结构与白名单通过(记录 $(@(Read-HbaRecords -RawLines @(Get-Content -LiteralPath $TargetFile)).Count) 条)"

# ── 3. 与现网的差异 ─────────────────────────────────────────────────────────
Write-Host ''
Write-Host '── 预检 2/3 与现网差异 / 服务端逐行判读 ──────────────────────────────────' -ForegroundColor Cyan
$curText = [System.IO.File]::ReadAllText($current)
$tgtText = [System.IO.File]::ReadAllText($TargetFile)
$curRecords = @(Read-HbaRecords -RawLines @(Get-Content -LiteralPath $current))
$tgtRecords = @(Read-HbaRecords -RawLines @(Get-Content -LiteralPath $TargetFile))
$curFree = @($curRecords | Where-Object { (Get-HbaMethod -Record $_) -eq 'trust' })
Write-Host "  现网:$($curRecords.Count) 条记录,其中免密方法 $($curFree.Count) 条"
Write-Host "  目标:$($tgtRecords.Count) 条记录,其中免密方法 0 条(判据 A1 看守)"
if ($curText -eq $tgtText) {
    Write-Host '  现网与目标态逐字节相同 ⇒ 无需落地(收紧在这台机上已经成立,仍要跑一次连接矩阵才算闭环)。' -ForegroundColor Green
    if (-not $Apply) { exit 0 }
}
Write-Host '  落地前先让服务端自己判读一遍它**当前**读到的那份(语法错误的行会标在 error 列):' -ForegroundColor White
Write-Host '    SELECT line_number, type, database, user_name, address, auth_method, error FROM pg_hba_file_rules WHERE error IS NOT NULL;' -ForegroundColor White
Write-Host '  postgresql.conf 一侧的键值预检(与本票不同面,顺手一起看):' -ForegroundColor White
Write-Host '    SELECT sourcefile, line_number, name, setting, applied, error FROM pg_file_settings WHERE error IS NOT NULL;' -ForegroundColor White
Write-Host '  为什么要先看:配置有语法错时服务端**不会**拒绝启动,只会沿用最后一次成功读到的版本' -ForegroundColor Yellow
Write-Host '  并留一行日志 ⇒ 只看"连接能不能通"会把"根本没改成功"读成"改了没效果"。' -ForegroundColor Yellow

# ── 4. 口令可用性确认(必须显式给开关)─────────────────────────────────────
Write-Host ''
Write-Host '── 预检 3/3 各角色"用口令连得上"已逐条实测 ───────────────────────────────' -ForegroundColor Cyan
Write-Host '  收紧前必须实测,不是"我以为设过口令":' -ForegroundColor White
Write-Host '    · postgres(管理角色)—— 2026-09-25 的教训正是这台机从没设过它;' -ForegroundColor White
Write-Host '    · 应用角色 —— .env 里那份凭据要现读,应用在跑不等于口令可用;' -ForegroundColor White
Write-Host '    · beifen(备份只读角色)—— 口令文件路径唯一出口:' -ForegroundColor White
Write-Host '        node scripts/secret-path.mjs db-backup ihui-backup.txt   # 只打印路径,绝不打印内容' -ForegroundColor White
if ($Apply -and -not $ConfirmAdminLogin) {
    Write-Host '[STOP] -Apply 必须与 -ConfirmAdminLogin 同时给:上面三条没实测完就别落地。' -ForegroundColor Red
    Write-Host '       本脚本不给"我知道风险"之类的兜底措辞留位置 —— 它就是为了挡住这一次。' -ForegroundColor Yellow
    exit 1
}
if (-not $Apply) {
    Write-Host '[OK] 预检模式结束:未备份、未写盘。三条实测完成后加 -Apply -ConfirmAdminLogin 再跑。' -ForegroundColor Green
    exit 0
}

# ── 5. 备份 + 落地 ──────────────────────────────────────────────────────────
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = Join-Path $DataDir "pg_hba.conf.pre-o20c-$stamp.bak"
Copy-Item -LiteralPath $current -Destination $backupPath
$srcLen = (Get-Item -LiteralPath $current).Length
$dstLen = (Get-Item -LiteralPath $backupPath).Length
if ($srcLen -ne $dstLen) {
    Write-Host "[STOP] 备份字节数不一致(现网 $srcLen / 备份 $dstLen)⇒ 停止,不写盘" -ForegroundColor Red
    exit 1
}
Write-Host ''
Write-Host '── 落地 ─────────────────────────────────────────────────────────────────' -ForegroundColor Cyan
Write-Host "  [OK] 现网文件已备份:$backupPath" -ForegroundColor Green
Write-AtomicInPlace -Content $tgtText -Destination $current
Write-Host '  [OK] 目标态已原位落地(临时文件 + 改名,不存在半截状态;回读逐字一致)' -ForegroundColor Green
Write-Host "  现有备份 $(@(Get-ChildItem -LiteralPath $DataDir -Filter 'pg_hba.conf.pre-o20c-*.bak').Count) 份;本脚本只增不删,清理请人工裁。" -ForegroundColor White
Show-ReloadHint -Dir $DataDir
Write-Host ''
Write-Host '── reload 之后必须做的两件收尾 ───────────────────────────────────────────' -ForegroundColor Cyan
Write-Host '  1) 跑一遍上面的连接矩阵(1–5),把实测结果登记回 PROJECT_PLAN 的 O20c 条目;' -ForegroundColor White
Write-Host '  2) 确认备份链仍走只读角色:pg_dump 不得改回超级用户(见 deploy/win/ihui-pg-backup.ps1)。' -ForegroundColor White
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
