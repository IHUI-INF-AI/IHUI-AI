# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
# =============================================================================
# deploy\win\switch-deploy-root.ps1 — 注册表面去硬编码盘符:nssm 服务 + 计划任务的根切换器
#
# 立因:仓库脚本侧的硬编码根已由 ihui-root-common.ps1 统一解析,但那只改了"仓库里的那一份"。
#   真正让路径生效的是**注册表面**——烤进 nssm 服务参数(HKLM:\SYSTEM\CurrentControlSet\
#   Services\<svc>\Parameters)与计划任务命令行(Tasks 树)里的值。不改这一面,换根后服务与
#   任务仍按旧盘符去找仓,于是"仓库改了不生效":生效的那一份在注册表里,不在仓库里。
#
# 设计红线(逐条对应需求):
#   1) 发现而非硬编码:清单运行时枚举——服务看 "ImagePath 含 nssm 或存在
#      Parameters\Application",计划任务看 schtasks /query /fo csv /v 的命令行含旧根;
#      不写死服务/任务名单,新增项也能兜住。
#   2) 边界感知替换:旧根只按词边界匹配(前一个字符不属 [A-Za-z0-9_.-],
#      后一个字符不属 [\w.-]),所以 D:\IHUI-AI-git-repo 这类独立 gitdir、D:\IHUI-AIxxx
#      这类同前缀目录**绝不会**被误替换。注意:这里出现的 D:\IHUI-AI 只能是"待被替换的
#      旧值/被发现目标",任何情况下都不能当作本机根来用——本机根一律由 -NewRoot /
#      Resolve-IhuiProjectRoot 解析。
#   3) 默认只读:不带 -Apply 一律只读预演(逐项打印 服务·参数名·旧值·新值),零写入;
#      -Apply 之前先落带时间戳的 JSON 备份到本目录,可用 -Rollback 恢复;
#      每步写回失败不中断整体,最后汇总成功/失败数,有失败 exit 1。
#   4) 斜杠方向与大小写原样保留:IHUI-GIT-GUARD 刻意使用 D:/IHUI-AI(正斜杠)形态,
#      替换时按"命中处原有的斜杠风格"重建新根,不做强制归一。
#
# 生效面提醒(写回完成/预演结束都会大声打印):改完注册表面还要重启受影响的 nssm 服务
#   (IHUI-DEPLOYLOOP 是常驻轮询,内存里的 $Root 不会自己刷新)、计划任务要等下次触发、
#   8802 的 api 运行态进程命令行仍是启动时的旧根,都要另行重启才会切到新根。
#
# 本面(deploy/**)不写 `#requires -Version 7`(AGENTS §27 规则 2 的 deploy/** 适用面例外,
# 与 ihui-root-common.ps1 同一口径):版本判据落在调用侧,调用本脚本一律显式指名 pwsh,
# 不让文件自己拒绝加载。正文只用 PS5.1 / PS7 两版通用语法。
#
# 用法(写回与回滚统一由 -Apply 把关,不带它就是只读):
#   pwsh -NoProfile -File deploy\win\switch-deploy-root.ps1 -WhatIf        # 只读预演(缺省)
#   pwsh -NoProfile -File deploy\win\switch-deploy-root.ps1 -Apply         # 备份 + 写回
#   pwsh -NoProfile -File deploy\win\switch-deploy-root.ps1 -Apply -Rollback -BackupFile deploy\win\switch-deploy-root-backup-20261012-210000.json
#   pwsh -NoProfile -File deploy\win\switch-deploy-root.ps1 -Rollback -BackupFile ...   # 仅预演回滚
# =============================================================================

param(
    # 目标新根。缺省时走唯一解析实现:Resolve-IhuiProjectRoot -StartDir $PSScriptRoot。
    # 显式给出时必须已存在且含 package.json,否则 throw(防把任意目录当根写进注册表面)。
    [string]$NewRoot,

    # 旧根(即"待被替换的旧值"),不是本机根的默认值——本机根永远是 -NewRoot 那一侧。
    # 缺省时从发现到的注册值里归纳(形如 X:\...\IHUI-AI 且边界完整者)。
    [string]$OldRoot,

    # 只读预演,与 -Plan 同义:打印将改动的每一项,不产生任何写入。
    [switch]$WhatIf,
    [switch]$Plan,

    # 唯一的写闸门。不带它,任何模式(含 -Rollback)都只读预演。
    [switch]$Apply,

    # 从 -BackupFile 指定的备份恢复;真正执行恢复仍需 -Apply。
    [switch]$Rollback,
    [string]$BackupFile
)

$ErrorActionPreference = 'Stop'

# pwsh 7.3+ 的原生参数拼接默认 Standard(宿主自行转义引号),与 PS5.1 的拼接规则不同;
# 置 Legacy 让两代行为一致,再统一由 ConvertTo-NativeArg 把值里的 " 预转义为 \" ——
# 否则 AppParameters / 计划任务 /tr 中成对的引号会被宿主拆散,两端写出不同的值。
$PSNativeCommandArgumentPassing = 'Legacy'

# 旧根自动探测用的正则(末段恰为 IHUI-AI 且两侧边界完整;段内不许出现空白/引号/冒号/
# 分号/逗号,防止 'C:\a;D:\IHUI-AI' 这类形态从别的盘符一路吞过来)。
$script:IhuiDetectPattern = "(?<![A-Za-z0-9_.\-])(?<root>[A-Za-z]:[\\/](?:[^\\/\s:`"',;]+[\\/])*IHUI-AI)(?![\w.-])"

# ---------------------------------------------------------------------------
# 小工具
# ---------------------------------------------------------------------------

function ConvertTo-NativeArg {
    # 把含引号的值预转义,交宿主(Legacy 拼接)还原成一个完整的 argv 元素。
    # nssm 的 AppParameters / schtasks 的 /tr 都是"一条值里嵌多对引号"的形态,不转义必碎。
    param([string]$Text)
    if ($null -eq $Text) { return '' }
    return ($Text -replace '"', '\"')
}

function Get-IhuiRootNorm {
    # 归一到"反斜杠 + 无尾分隔符"形态,仅用于比较与去重;写回时绝不使用归一形态
    # (斜杠风格必须按命中处原样保留)。
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return '' }
    return ($Path.TrimEnd([char[]]'\/') -replace '/', '\')
}

function Test-IhuiSameRoot {
    param([string]$A, [string]$B)
    $na = Get-IhuiRootNorm $A
    $nb = Get-IhuiRootNorm $B
    # PS 的 -eq 天生大小写不敏感,盘符大小写(d: 与 D:)不应算两个根。
    return ($na -eq $nb)
}

function Assert-IhuiRootDir {
    # 新根的边界校验:目录必须存在且含 package.json。只验目录存在会把 deploy\ 这类
    # 子目录当根烤进注册表面——判据必须与 ihui-root-common.ps1 同口径(package.json)。
    param([string]$Path, [string]$Label)
    if ([string]::IsNullOrWhiteSpace($Path)) { throw "${Label}: 路径为空" }
    if (-not (Test-Path -LiteralPath $Path -PathType Container)) { throw "${Label}: 目录不存在: $Path" }
    if (-not (Test-Path -LiteralPath (Join-Path $Path 'package.json') -PathType Leaf)) {
        throw "${Label}: 目录下没有 package.json,拒绝把非仓库目录当作根: $Path"
    }
    return (Resolve-Path -LiteralPath $Path).Path
}

function New-IhuiRootPattern {
    # 把旧根编译成边界感知正则:段间用 [\\/] 同时接受两种斜杠(生产多为 \,IHUI-GIT-GUARD
    # 刻意为 /),段本身 [regex]::Escape 且不允许跨界到空白/引号/冒号/分号/逗号,
    # 防止 'C:\a;D:\IHUI-AI' 这类形态从 C: 一路吞到旧根。
    param([Parameter(Mandatory = $true)][string]$Root)
    $r = $Root.TrimEnd([char[]]'\/')
    $segments = @($r -split '[\\/]' | Where-Object { $_ -ne '' })
    if ($segments.Count -lt 2) { throw "旧根不像绝对路径(缺盘符段): $Root" }
    $body = ($segments | ForEach-Object { [regex]::Escape($_) }) -join '[\\/]'
    # 词边界:前不能紧跟 [A-Za-z0-9_.-],后不能紧跟 [\w.-] —— 保住 *-git-repo、*AIXxx 等独立目录。
    return ('(?<![A-Za-z0-9_.\-])' + $body + '(?![\w.-])')
}

function Convert-IhuiRootInValue {
    # 对单个注册值做边界感知替换,返回新值与命中次数。
    param([string]$Value, [string]$Pattern, [string]$TargetRoot)
    $ms = [regex]::Matches($Value, $Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($ms.Count -eq 0) { return [pscustomobject]@{ Value = $Value; Count = 0 } }
    $sb = New-Object System.Text.StringBuilder
    $last = 0
    foreach ($m in $ms) {
        [void]$sb.Append($Value.Substring($last, $m.Index - $last))
        # 斜杠方向按命中处风格重建:命中全是正斜杠(如 D:/IHUI-AI)则新根也用正斜杠,
        # 否则用反斜杠——大小写与斜杠方向必须原样保留,这是 IHUI-GIT-GUARD 的硬要求。
        $seg = $m.Value.Substring(2)  # 去掉盘符,只看路径分隔符
        $newVal = $TargetRoot
        if (($seg.IndexOf('/') -ge 0) -and ($seg.IndexOf('\') -lt 0)) {
            $newVal = $TargetRoot -replace '\', '/'
        } else {
            $newVal = $TargetRoot -replace '/', '\'
        }
        [void]$sb.Append($newVal)
        $last = $m.Index + $m.Length
    }
    [void]$sb.Append($Value.Substring($last))
    return [pscustomobject]@{ Value = $sb.ToString(); Count = $ms.Count }
}

# ---------------------------------------------------------------------------
# 发现(运行时枚举,不写死清单)
# ---------------------------------------------------------------------------

function Get-IhuiNssmService {
    # nssm 服务判定:ImagePath 含 nssm,或存在 Parameters\Application 值。
    # 直接读注册表而不是跑 nssm list —— 预演阶段要求零外部写入、且开发机可能没装 nssm。
    $result = @()
    $base = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\CurrentControlSet\Services')
    if (-not $base) { return $result }
    try {
        foreach ($name in $base.GetSubKeyNames()) {
            $svc = $base.OpenSubKey($name)
            if (-not $svc) { continue }
            try {
                $img = $svc.GetValue('ImagePath')
                $pk = $svc.OpenSubKey('Parameters')
                $app = $null; $ap = $null; $ad = $null; $envExtra = $null
                $hasApp = $false
                if ($pk) {
                    $hasApp = ($null -ne $pk.GetValue('Application'))
                    $app = $pk.GetValue('Application')
                    $ap = $pk.GetValue('AppParameters')
                    $ad = $pk.GetValue('AppDirectory')
                    $envExtra = $pk.GetValue('AppEnvironmentExtra')
                }
                $isNssm = ($null -ne $img -and $img -match 'nssm')
                if (-not ($isNssm -or $hasApp)) { continue }
                $vals = [ordered]@{}
                if (-not [string]::IsNullOrEmpty([string]$app)) { $vals['Application'] = [string]$app }
                if (-not [string]::IsNullOrEmpty([string]$ap))  { $vals['AppParameters'] = [string]$ap }
                if (-not [string]::IsNullOrEmpty([string]$ad))  { $vals['AppDirectory'] = [string]$ad }
                $envList = @()
                if ($envExtra) { $envList = @($envExtra) }
                $result += [pscustomobject]@{ Name = $name; Values = $vals; EnvExtra = $envList }
            } finally { $svc.Close() }
        }
    } finally { $base.Close() }
    return $result
}

function Split-SchtasksCsvLine {
    # schtasks 的 CSV **不转义字段内的引号**(计划任务命令行普遍带 "x" 形态),
    # ConvertFrom-Csv 会把它切错(实测 'wscript.exe "..." 会丢引号),只能按 schtasks
    # 实际的字段分隔形态 "," 手工切,保住命令行里的引号原样。
    param([string]$Line)
    if ($null -eq $Line) { return , @() }
    $s = $Line
    if ($s.StartsWith('"')) { $s = $s.Substring(1) }
    if ($s.EndsWith('"')) { $s = $s.Substring(0, $s.Length - 1) }
    return , ($s -split '","')
}

function Get-IhuiScheduledTask {
    # 计划任务发现:schtasks /query /fo csv /v,取全部任务行(旧根未知时也要用它们归纳
    # 探测;"含旧根与否"在构建清单阶段再判)。同一任务多触发器会在 CSV 里出现多行,
    # 按任务名去重,避免重复写回。
    # schtasks 查询失败(策略黑名单/权限)不致命:降级为"任务面不可见"并把警告带上。
    $tasks = @()
    $warnings = @()
    $lines = $null
    try {
        $lines = @(& schtasks.exe /query /fo csv /v)
        if ($LASTEXITCODE -ne 0) { throw "schtasks /query 退出码 $LASTEXITCODE" }
    } catch {
        return [pscustomobject]@{ Tasks = @(); Warnings = @("计划任务查询失败,任务面未纳入本次发现: $($_.Exception.Message)") }
    }
    if ($lines.Count -lt 2) { return [pscustomobject]@{ Tasks = @(); Warnings = @() } }

    $header = Split-SchtasksCsvLine $lines[0]
    $nameIdx = -1; $cmdIdx = -1; $startIdx = -1
    for ($i = 0; $i -lt $header.Count; $i++) {
        if ($header[$i] -ieq 'TaskName') { $nameIdx = $i }
        if ($header[$i] -ieq 'Task To Run') { $cmdIdx = $i }
        if ($header[$i] -ieq 'Start In') { $startIdx = $i }
    }
    if ($nameIdx -lt 0) { $nameIdx = 1 }  # /v 列序固定:HostName,TaskName,...,兜底取第2列
    if ($cmdIdx -lt 0) {
        for ($i = 0; $i -lt $header.Count; $i++) {
            if ($header[$i] -match '(?i)task.*to.*run|要运行的任务') { $cmdIdx = $i; break }
        }
    }
    if ($cmdIdx -lt 0) {
        $cmdIdx = 8  # /v 列序固定:Task To Run 恒为第9列(表头本地化时兜底)
        $warnings += '计划任务表头未能识别 "Task To Run",按固定列序(第9列)取命令行,请人工复核预演输出'
    }

    $seen = @{}
    for ($i = 1; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        $f = Split-SchtasksCsvLine $line
        if ($f.Count -le [Math]::Max($cmdIdx, $nameIdx)) { continue }
        $name = $f[$nameIdx]
        if ([string]::IsNullOrWhiteSpace($name)) { continue }
        if ($seen.ContainsKey($name)) { continue }  # 多触发器重复行
        $seen[$name] = $true
        $cmd = $f[$cmdIdx]
        $start = ''
        if ($startIdx -ge 0 -and $f.Count -gt $startIdx) { $start = $f[$startIdx] }
        $tasks += [pscustomobject]@{ Name = $name; Command = [string]$cmd; StartIn = [string]$start }
    }
    return [pscustomobject]@{ Tasks = $tasks; Warnings = $warnings }
}

function Get-IhuiRootCandidate {
    # 旧根自动探测:只认"末段恰为 IHUI-AI 且两侧边界完整"的绝对路径,
    # 归一去重后按命中数取最多者;D:\IHUI-AI-git-repo 这类带尾巴的目录不会入选。
    param([string[]]$Texts)
    $found = @{}
    foreach ($t in $Texts) {
        if ([string]::IsNullOrEmpty($t)) { continue }
        foreach ($m in [regex]::Matches($t, $script:IhuiDetectPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
            $raw = $m.Groups['root'].Value
            $key = Get-IhuiRootNorm $raw
            if ($found.ContainsKey($key)) { $found[$key].Count++ }
            else { $found[$key] = [pscustomobject]@{ Sample = $raw; Count = 1 } }
        }
    }
    return $found
}

function Get-IhuiNssmExe {
    # nssm 定位:优先 PATH,回退 install-* 里用的 System32 固定落点。
    $cmd = Get-Command nssm.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $fallback = Join-Path $env:SystemRoot 'System32\nssm.exe'
    if (Test-Path -LiteralPath $fallback) { return $fallback }
    return $null
}

# ---------------------------------------------------------------------------
# 输出
# ---------------------------------------------------------------------------

function Write-IhuiChangePlan {
    param([object[]]$Changes, [object[]]$Notes, [string]$Mode)
    Write-Host ''
    Write-Host ('========== {0} ==========' -f $Mode)
    foreach ($c in $Changes) {
        Write-Host ('[{0}] {1} :: {2}   (命中 {3} 处)' -f $c.Kind, $c.Name, $c.Param, $c.Count)
        Write-Host ('    旧: ' + $c.OldValue)
        Write-Host ('    新: ' + $c.NewValue)
    }
    if ($Notes.Count -gt 0) {
        Write-Host '---------- 提示(仅点名,不在本次写回范围) ----------'
        foreach ($n in $Notes) { Write-Host ('  ! ' + $n) }
    }
}

function Write-IhuiEffectNotice {
    # 生效面提醒:注册表面写回 ≠ 立即生效,这一段必须大声打印。
    param([object[]]$ServiceNames, [object[]]$TaskNames, [string]$Prefix)
    Write-Host ''
    Write-Host ('!!!!!!!!!! {0} —— 以下不做,改动不会生效 !!!!!!!!!!' -f $Prefix) -ForegroundColor Yellow
    if ($ServiceNames.Count -gt 0) {
        Write-Host '1) 必须重启受影响的 nssm 服务(配置在进程启动时读入,不重启仍按旧根跑):' -ForegroundColor Yellow
        foreach ($s in $ServiceNames) { Write-Host ('     - ' + $s) -ForegroundColor Yellow }
        Write-Host '     其中 IHUI-DEPLOYLOOP 是常驻轮询进程,内存里的 $Root 不会自动刷新,不重启就继续按旧根部署。' -ForegroundColor Yellow
    } else {
        Write-Host '1) 本次没有服务改动;若后续有,重启服务才生效(IHUI-DEPLOYLOOP 内存中的 $Root 亦然)。' -ForegroundColor Yellow
    }
    if ($TaskNames.Count -gt 0) {
        Write-Host '2) 计划任务命令行已写回,但要等下次触发才生效(需要立即生效可 schtasks /run 手动触发):' -ForegroundColor Yellow
        foreach ($t in $TaskNames) { Write-Host ('     - ' + $t) -ForegroundColor Yellow }
    }
    Write-Host '3) 8802 端口的 api 运行态进程是启动时把旧根烤进命令行的,配置改完后必须重启该服务/进程才切到新根。' -ForegroundColor Yellow
    Write-Host ''
}

# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

# ---- 0. 参数互斥与回滚入参校验 ----
if ($Apply -and ($WhatIf -or $Plan)) { throw '-Apply 与 -WhatIf/-Plan 互斥:预演就不要写,写回就不要预演' }
if ($Rollback -and -not $BackupFile) { throw '-Rollback 必须指定 -BackupFile <备份JSON路径>' }
if ($BackupFile -and -not $Rollback) { throw '-BackupFile 只能与 -Rollback 连用' }

# ---- 回滚分支(与根切换无关,不需要解析根) ----
if ($Rollback) {
    if (-not (Test-Path -LiteralPath $BackupFile -PathType Leaf)) { throw "备份文件不存在: $BackupFile" }
    $raw = Get-Content -LiteralPath $BackupFile -Raw -Encoding UTF8
    try { $data = $raw | ConvertFrom-Json } catch { throw "备份文件不是合法 JSON: $BackupFile — $($_.Exception.Message)" }
    if (-not ($data.PSObject.Properties['services'] -or $data.PSObject.Properties['tasks'])) {
        throw "备份文件缺少 services/tasks 字段,格式不符: $BackupFile"
    }
    $restore = @()
    foreach ($svc in @($data.services)) {
        if ($null -eq $svc) { continue }
        $pobj = $svc.parameters
        if ($null -eq $pobj) { continue }
        foreach ($p in $pobj.PSObject.Properties) {
            $restore += [pscustomobject]@{ Kind = '服务'; Name = [string]$svc.name; Param = $p.Name; OldValue = [string]$p.Value }
        }
    }
    foreach ($t in @($data.tasks)) {
        if ($null -eq $t) { continue }
        $restore += [pscustomobject]@{ Kind = '任务'; Name = [string]$t.name; Param = '任务命令行(/tr)'; OldValue = [string]$t.command }
    }
    $mode = '回滚预演(只读,未做任何写入)'
    if ($Apply) { $mode = '回滚写入(-Apply)' }
    Write-IhuiChangePlan -Changes ($restore | ForEach-Object {
            [pscustomobject]@{ Kind = $_.Kind; Name = $_.Name; Param = $_.Param; Count = 1; OldValue = '(当前注册值)'; NewValue = $_.OldValue }
        }) -Notes @() -Mode $mode
    if (-not $Apply) {
        Write-Host '只读预演:未做任何写入。真正恢复请加 -Apply。' -ForegroundColor Cyan
        exit 0
    }
    $ok = 0; $fail = 0
    $nssm = Get-IhuiNssmExe
    $svcNames = @(); $taskNames = @()
    foreach ($r in $restore) {
        try {
            if ($r.Kind -eq '服务') {
                if (-not $nssm) { throw 'nssm.exe 未找到(PATH 与 System32 均无)' }
                & $nssm set $r.Name $r.Param (ConvertTo-NativeArg $r.OldValue) | Out-Null
                $code = $LASTEXITCODE
            } else {
                & schtasks.exe /change /tn $r.Name /tr (ConvertTo-NativeArg $r.OldValue) | Out-Null
                $code = $LASTEXITCODE
            }
            if ($code -ne 0) { throw "命令退出码 $code" }
            $ok++
            Write-Host ('[恢复成功] {0} :: {1}' -f $r.Kind, $r.Name)
            if ($r.Kind -eq '服务') { $svcNames += $r.Name } else { $taskNames += $r.Name }
        } catch {
            $fail++
            Write-Host ('[恢复失败] {0} :: {1} -> {2}' -f $r.Kind, $r.Name, $_.Exception.Message) -ForegroundColor Red
        }
    }
    $svcNames = @($svcNames | Sort-Object -Unique)
    $taskNames = @($taskNames | Sort-Object -Unique)
    Write-Host ('---------- 回滚汇总: 成功 {0} / 失败 {1} ----------' -f $ok, $fail)
    Write-IhuiEffectNotice -ServiceNames $svcNames -TaskNames $taskNames -Prefix '回滚后'
    if ($fail -gt 0) { exit 1 }
    exit 0
}

# ---- 1. 解析并校验 NewRoot ----
$rootWasGiven = -not [string]::IsNullOrWhiteSpace($NewRoot)
if (-not $rootWasGiven) {
    # 缺省:走唯一解析实现,直接 dot-source。helper 已按 AGENTS §27 规则 2 的 deploy/**
    # 适用面例外**不写** #requires -Version 7,5.1 也能加载;运行宿主仍一律显式指名 pwsh。
    $helperPath = Join-Path $PSScriptRoot 'ihui-root-common.ps1'
    if (-not (Test-Path -LiteralPath $helperPath)) { throw "缺少根解析实现: $helperPath" }
    . $helperPath
    $NewRoot = Resolve-IhuiProjectRoot -StartDir $PSScriptRoot
}
$NewRoot = Assert-IhuiRootDir -Path $NewRoot -Label '新根(-NewRoot)'

# 两侧都显式给出且相同 ⇒ 无事可做(连发现都不必跑)。
if ($rootWasGiven -and -not [string]::IsNullOrWhiteSpace($OldRoot)) {
    if (Test-IhuiSameRoot $NewRoot $OldRoot) {
        Write-Host ('已是目标根,无需改动 (旧根 = 新根 = {0})' -f $NewRoot)
        exit 0
    }
}

# ---- 2. 发现:nssm 服务 + 计划任务 ----
$services = Get-IhuiNssmService
$taskScan = Get-IhuiScheduledTask -RootPattern ''
$tasks = $taskScan.Tasks
$discoverWarnings = @($taskScan.Warnings)

# ---- 3. 旧根确定 ----
$oldRootInferred = $false
if ([string]::IsNullOrWhiteSpace($OldRoot)) {
    $texts = @()
    foreach ($svc in $services) { foreach ($v in $svc.Values.Values) { $texts += $v } }
    foreach ($t in $tasks) { $texts += $t.Command }
    $cands = Get-IhuiRootCandidate -Texts $texts
    if ($cands.Count -eq 0) {
        Write-Host '未在任何注册表面项中发现形如 X:\...\IHUI-AI 的旧根(无事可做)。'
        foreach ($w in $discoverWarnings) { Write-Host ('  ! ' + $w) -ForegroundColor Yellow }
        exit 0
    }
    $picked = $null
    foreach ($k in $cands.Keys) {
        if ($null -eq $picked -or $cands[$k].Count -gt $picked.Count) { $picked = $cands[$k] }
    }
    $OldRoot = $picked.Sample
    $oldRootInferred = $true
    $oldRootHits = $picked.Count
    if ($cands.Count -gt 1) {
        $names = @($cands.Keys) -join ' / '
        $discoverWarnings += "自动探测到多个候选旧根($names),取命中最多者;如不对请显式传 -OldRoot"
    }
} else {
    $OldRoot = $OldRoot.TrimEnd([char[]]'\/')
}
$oldPattern = New-IhuiRootPattern -Root $OldRoot

if (Test-IhuiSameRoot $NewRoot $OldRoot) {
    Write-Host ('已是目标根,无需改动 (旧根 = 新根 = {0})' -f $NewRoot)
    exit 0
}

# ---- 4. 构建改动清单(预演与写回共用同一份) ----
$changes = @()
$notes = @()
$svcHit = 0; $taskHit = 0

foreach ($svc in $services) {
    $hit = $false
    foreach ($k in $svc.Values.Keys) {
        $r = Convert-IhuiRootInValue -Value $svc.Values[$k] -Pattern $oldPattern -TargetRoot $NewRoot
        if ($r.Count -gt 0) {
            $hit = $true
            $changes += [pscustomobject]@{ Kind = '服务'; Name = $svc.Name; Param = $k; OldValue = $svc.Values[$k]; NewValue = $r.Value; Count = $r.Count }
        }
    }
    if ($hit) { $svcHit++ }
    # AppEnvironmentExtra 只点名不改:它不在 nssm set 的本次写回清单里,且部分条目
    # 指向仓外目录(如 D:\DevEnv\ihui-deploy-build),与根切换无关,改了反而越界。
    foreach ($e in $svc.EnvExtra) {
        $oldCnt = (Convert-IhuiRootInValue -Value $e -Pattern $oldPattern -TargetRoot $NewRoot).Count
        if ($oldCnt -gt 0) {
            $notes += ('服务 {0} 的 AppEnvironmentExtra 含旧根(未自动改,需人工确认): {1}' -f $svc.Name, $e)
        } elseif ($e -match '(?i)ihui-deploy-build|CLEAN_WT') {
            $notes += ('服务 {0} 的 AppEnvironmentExtra 指向仓外构建目录,与根切换无关(仅提示): {1}' -f $svc.Name, $e)
        }
    }
}

foreach ($t in $tasks) {
    $r = Convert-IhuiRootInValue -Value $t.Command -Pattern $oldPattern -TargetRoot $NewRoot
    if ($r.Count -gt 0) {
        $taskHit++
        $changes += [pscustomobject]@{ Kind = '任务'; Name = $t.Name; Param = '任务命令行(/tr)'; OldValue = $t.Command; NewValue = $r.Value; Count = $r.Count }
    }
    if (-not [string]::IsNullOrWhiteSpace($t.StartIn) -and $t.StartIn -ne 'N/A') {
        $rs = Convert-IhuiRootInValue -Value $t.StartIn -Pattern $oldPattern -TargetRoot $NewRoot
        if ($rs.Count -gt 0) {
            $notes += ('计划任务 {0} 的 Start In 也含旧根,但 schtasks /change 无法改工作目录,需另行处理: {1}' -f $t.Name, $t.StartIn)
        }
    }
}

$inferNote = ''
if ($oldRootInferred) { $inferNote = (' (旧根自动探测自全部扫描注册值,共 {0} 处匹配)' -f $oldRootHits) }
Write-Host ('扫描: nssm 服务 {0} 个(含旧根 {1} 个) / 计划任务 {2} 个(含旧根 {3} 个)' -f $services.Count, $svcHit, $tasks.Count, $taskHit)
Write-Host ('旧根: {0}{1}' -f $OldRoot, $inferNote)
Write-Host ('新根: {0}' -f $NewRoot)
Write-Host '边界保护: 旧根仅按词边界匹配,末段拼了 -git-repo 之类尾巴、或后面直接粘字母数字的同前缀目录一律不动(设计红线:完整边界命中才替换)。'
foreach ($w in $discoverWarnings) { Write-Host ('  ! ' + $w) -ForegroundColor Yellow }

if ($changes.Count -eq 0) {
    Write-Host '没有发现任何含旧根的注册表面项,无事可做。'
    exit 0
}

# ---- 5. 只读预演(缺省路径;一切写入必须过 -Apply) ----
if (-not $Apply) {
    Write-IhuiChangePlan -Changes $changes -Notes $notes -Mode '预演(只读,未做任何写入)'
    Write-Host ('共 {0} 项改动(服务 {1} / 计划任务 {2});实际写回请加 -Apply(写回前会自动落备份 JSON)。' -f $changes.Count, $svcHit, $taskHit) -ForegroundColor Cyan
    $hitSvcNames = @($changes | Where-Object { $_.Kind -eq '服务' } | ForEach-Object { $_.Name } | Sort-Object -Unique)
    $hitTaskNames = @($changes | Where-Object { $_.Kind -eq '任务' } | ForEach-Object { $_.Name } | Sort-Object -Unique)
    Write-IhuiEffectNotice -ServiceNames $hitSvcNames -TaskNames $hitTaskNames -Prefix '若执行 -Apply'
    exit 0
}

# ---- 6. 写回:备份先行 ----
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = Join-Path $PSScriptRoot ('switch-deploy-root-backup-{0}.json' -f $stamp)

$svcBackup = @()
foreach ($g in @($changes | Where-Object { $_.Kind -eq '服务' } | Group-Object Name)) {
    $params = @{}
    foreach ($c in $g.Group) { $params[$c.Param] = $c.OldValue }
    $svcBackup += [pscustomobject]@{ name = $g.Name; parameters = [pscustomobject]$params }
}
$taskBackup = @($changes | Where-Object { $_.Kind -eq '任务' } | ForEach-Object {
        [pscustomobject]@{ name = $_.Name; command = $_.OldValue }
    })
$payload = [pscustomobject]@{
    script    = 'switch-deploy-root.ps1'
    createdAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    oldRoot   = $OldRoot
    newRoot   = $NewRoot
    services  = $svcBackup
    tasks     = $taskBackup
}
$json = $payload | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText($backupPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host ('备份已写入: {0}  (回滚用 -Apply -Rollback -BackupFile "<此路径>")' -f $backupPath) -ForegroundColor Green

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Host '! 当前不是管理员,nssm set / schtasks /change 很可能失败。' -ForegroundColor Red }

Write-IhuiChangePlan -Changes $changes -Notes $notes -Mode '写回(-Apply)'

# ---- 7. 逐项写回:失败不中断,最后汇总 ----
$nssm = Get-IhuiNssmExe
$ok = 0; $fail = 0
$svcNames = @(); $taskNames = @()
foreach ($c in $changes) {
    try {
        if ($c.Kind -eq '服务') {
            if (-not $nssm) { throw 'nssm.exe 未找到(PATH 与 System32 均无)' }
            & $nssm set $c.Name $c.Param (ConvertTo-NativeArg $c.NewValue) | Out-Null
            $code = $LASTEXITCODE
        } else {
            & schtasks.exe /change /tn $c.Name /tr (ConvertTo-NativeArg $c.NewValue) | Out-Null
            $code = $LASTEXITCODE
        }
        if ($code -ne 0) { throw "命令退出码 $code" }
        $ok++
        Write-Host ('[写回成功] {0} :: {1}' -f $c.Kind, $c.Name)
        if ($c.Kind -eq '服务') { $svcNames += $c.Name } else { $taskNames += $c.Name }
    } catch {
        $fail++
        Write-Host ('[写回失败] {0} :: {1} ({2}) -> {3}' -f $c.Kind, $c.Name, $c.Param, $_.Exception.Message) -ForegroundColor Red
    }
}
$svcNames = @($svcNames | Sort-Object -Unique)
$taskNames = @($taskNames | Sort-Object -Unique)
Write-Host ('---------- 写回汇总: 成功 {0} / 失败 {1} (共 {2} 项) ----------' -f $ok, $fail, $changes.Count)
Write-Host ('备份文件: {0}' -f $backupPath) -ForegroundColor Green
Write-IhuiEffectNotice -ServiceNames $svcNames -TaskNames $taskNames -Prefix '写回后'
if ($fail -gt 0) { exit 1 }
exit 0
