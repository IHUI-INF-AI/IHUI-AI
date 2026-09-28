# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

#requires -Version 7
# =============================================================================
# deploy\tests\svc-pg-readiness-harness.ps1 — run-api.ps1 PG readiness 前置的取证夹具
#
# 由 svc-pg-readiness.test.mjs 派生(`node --test` 跑),**不**独立使用。
#
# 为什么判据要在 PowerShell 里跑而不是搬到 JS 里断言:被测实现的语法是 PowerShell,
# 在 JS 里重写一份"它应该会怎样"就是 §22c 说的"镜像测试只复读实现"——测的是自己的副本。
# 所以本夹具做的是另一件事:**把 run-api.ps1 里那三个函数的原文抽出来在本会话里真定义、
# 真调用**,造出现场(临时 .env、假 pg_isready、真 pg_isready 打一个必然被拒的 loopback
# 端口),把结论原样吐成 JSON 交 JS 侧断言。
#
# 抽取用 AST 而不是正则:函数体改了排版(换行、缩进、加注释)不该让夹具失效,
# 而"函数被人改名/删掉"必须让夹具当场报错 —— 那才是它要防的那一型。
#
# 安全边界:全程只在 -Scratch 下写文件;探测只打 127.0.0.1:1(loopback 上一个必然被拒
# 的端口,不是任何数据库端口),绝不连生产库、绝不启停任何 Windows 服务。
#
# 输出:stdout 上 `@@JSON{...}@@` 之间的一段 ASCII JSON(不带中文,免得被 GBK 码页吃掉,
# 见 AGENTS §26 的"中文出参/出参会被控制台码页吃"两条)。
# =============================================================================
param(
    [Parameter(Mandatory = $true)][string]$Scratch,
    [Parameter(Mandatory = $true)][string]$Script
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Script)) { throw "找不到被测脚本:$Script" }
New-Item -ItemType Directory -Path $Scratch -Force | Out-Null
$scratchRoot = (Resolve-Path -LiteralPath $Scratch).Path

# ── 抽函数:按名字取 FunctionDefinitionAst 的 Extent.Text,原文喂进本会话 ──────
$parseErrors = $null
$tokens = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
    $Script, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors -and $parseErrors.Count -gt 0) {
    throw "被测脚本有 $($parseErrors.Count) 处语法错:$($parseErrors[0].Message)"
}
$fnAsts = $ast.FindAll({
        param($a)
        $a -is [System.Management.Automation.Language.FunctionDefinitionAst]
    }, $true)
$foundNames = @($fnAsts | ForEach-Object { $_.Name })
$want = @('Resolve-IhuiPgIsReady', 'Get-IhuiApiDbEndpoint', 'Wait-IhuiPostgresReady')
foreach ($n in $want) {
    $fd = $fnAsts | Where-Object { $_.Name -eq $n } | Select-Object -First 1
    if (-not $fd) { throw "被测脚本里没有 function $n —— 前置被摘线或改名了(现见函数:$($foundNames -join ', '))" }
    Invoke-Expression $fd.Extent.Text
}

$out = [ordered]@{}
$out['definedFunctions'] = $foundNames

# ── 1) DSN 解析:六种输入 ────────────────────────────────────────────────────
function Write-EnvFile([string]$name, [string[]]$lines) {
    $p = Join-Path $scratchRoot $name
    Set-Content -LiteralPath $p -Value $lines -Encoding utf8NoBOM
    return $p
}
$pwMark = 'S3cr3tPW-MUST-NOT-LEAK'
$cases = [ordered]@{}

$f1 = Write-EnvFile 'env-normal.txt' @(
    '# comment', "DATABASE_URL=postgres://ihui:$pwMark@10.9.8.7:6543/ihui_dev", 'DB_PORT=9999')
$e1 = Get-IhuiApiDbEndpoint -EnvFile $f1
$cases['normal'] = @{ host = "$($e1.Host)"; port = "$($e1.Port)" }
# 口令不得出现在返回值的任何一处(它会被 Write-Host 打进 nssm 日志的只有 host:port)
$cases['normalLeaksPassword'] = (@("$e1.Host", "$e1.Port") -join '|').Contains($pwMark)

$f2 = Write-EnvFile 'env-quoted.txt' @('DATABASE_URL="postgresql://u:p@db.internal"')
$e2 = Get-IhuiApiDbEndpoint -EnvFile $f2
$cases['quotedNoPort'] = @{ host = "$($e2.Host)"; port = "$($e2.Port)" }

$f3 = Write-EnvFile 'env-empty.txt' @('OTHER=1')
$cases['noKeyIsNull'] = ($null -eq (Get-IhuiApiDbEndpoint -EnvFile $f3))
$cases['missingFileIsNull'] = ($null -eq (Get-IhuiApiDbEndpoint -EnvFile (Join-Path $scratchRoot 'nope.env')))
$f4 = Write-EnvFile 'env-garbage.txt' @('DATABASE_URL=not-a-url')
$cases['garbageIsNull'] = ($null -eq (Get-IhuiApiDbEndpoint -EnvFile $f4))
# socket 形态(host 段为空)必须判"读不出端点"而不是拿用户名当主机去探测
$f5 = Write-EnvFile 'env-socket.txt' @('DATABASE_URL=postgresql://ihui:pw@/ihui_dev')
$cases['socketIsNull'] = ($null -eq (Get-IhuiApiDbEndpoint -EnvFile $f5))
# 无 userinfo 的常见形态:整段 authority 就是 host:port
$f6 = Write-EnvFile 'env-nouser.txt' @('DATABASE_URL=postgres://localhost:5432/ihui_dev')
$e6 = Get-IhuiApiDbEndpoint -EnvFile $f6
$cases['noUserinfo'] = @{ host = "$($e6.Host)"; port = "$($e6.Port)" }
# 口令里带 @ 时按最后一个 @ 切,不能把口令的后半当主机
# (带 # 的口令在 URI 里必须百分号编码 —— libpq 自己也把 # 当片段分隔,所以本例只用 @)
$f7 = Write-EnvFile 'env-atpw.txt' @("DATABASE_URL=postgres://ihui:a@b@$pwMark@192.0.2.9:6000/ihui")
$e7 = Get-IhuiApiDbEndpoint -EnvFile $f7
$cases['atInPassword'] = @{ host = "$($e7.Host)"; port = "$($e7.Port)" }
$cases['atInPasswordLeaks'] = (@("$e7.Host", "$e7.Port") -join '|').Contains($pwMark)
# IPv6 字面量
$f8 = Write-EnvFile 'env-v6.txt' @('DATABASE_URL=postgres://[::1]:5433/ihui')
$e8 = Get-IhuiApiDbEndpoint -EnvFile $f8
$cases['ipv6'] = @{ host = "$($e8.Host)"; port = "$($e8.Port)" }

$out['endpoint'] = $cases

# ── 2) pg_isready 解析器 ─────────────────────────────────────────────────────
$resolved = Resolve-IhuiPgIsReady
$fromPath = [bool](Get-Command pg_isready.exe -ErrorAction SilentlyContinue)
# 独立算一遍"这台机上版本最高的那份" —— 不复用被测函数里的排序,否则就是拿实现验实现。
$highest = $null
$bestVer = $null
foreach ($root in @('C:\Program Files\PostgreSQL', 'D:\Program Files\PostgreSQL')) {
    if (-not (Test-Path -LiteralPath $root)) { continue }
    foreach ($d in (Get-ChildItem -LiteralPath $root -Directory)) {
        $p = Join-Path $d.FullName 'bin\pg_isready.exe'
        if (-not (Test-Path -LiteralPath $p)) { continue }
        $vm = [regex]::Match($d.Name, '^(\d+)(?:\.(\d+))?')
        if (-not $vm.Success) { continue }
        $minor = if ($vm.Groups[2].Success) { $vm.Groups[2].Value } else { '0' }
        $v = [version]"$($vm.Groups[1].Value).$minor"
        if ($null -eq $bestVer -or $v -gt $bestVer) { $bestVer = $v; $highest = $p }
    }
}
$out['resolver'] = @{
    found      = [bool]$resolved
    path       = "$resolved"
    exists     = [bool]($resolved -and (Test-Path -LiteralPath $resolved))
    fromPath   = $fromPath
    # 版本号不得写死:命中的路径里带的是这台机实际装的那个大版本
    fromVerDir = [bool]($resolved -and $resolved -match 'PostgreSQL[\\/]\d')
    highest    = "$highest"
    # 两版并存时(本机实测 17 + 18 并存)必须挑高的那份;PATH 命中时另说(那是运维显式装的)
    picksHighest = [bool]($highest -and -not $fromPath -and
        ($resolved -replace '\\', '/') -eq ($highest -replace '\\', '/'))
}

# ── 3) 轮询:三条出口(就绪 / 一直拒 / 超时)都真跑 ────────────────────────────
function New-FakeProbe([string]$name, [string]$body) {
    $p = Join-Path $scratchRoot $name
    Set-Content -LiteralPath $p -Value @('@echo off', $body) -Encoding ascii
    return $p
}
$okCmd = New-FakeProbe 'probe-ok.cmd' 'exit /b 0'
$badCmd = New-FakeProbe 'probe-reject.cmd' 'exit /b 1'

$t0 = Get-Date
$rOk = Wait-IhuiPostgresReady -Exe $okCmd -H '127.0.0.1' -P '1' -LimitSeconds 30
$out['immediateReady'] = @{
    result  = [bool]$rOk
    elapsed = [math]::Round(((Get-Date) - $t0).TotalSeconds, 1)
}

# 恢复窗口:第一轮就"接受",证明循环不会把退出码 1 当成致命错误提前 bail
$flip = Join-Path $scratchRoot 'flip.mark'
$flipCmd = Join-Path $scratchRoot 'probe-flip.cmd'
Set-Content -LiteralPath $flipCmd -Value @(
    '@echo off',
    "if not exist `"$flip`" ( echo x> `"$flip`" & exit /b 1 )",
    'exit /b 0') -Encoding ascii
$t1 = Get-Date
$rFlip = Wait-IhuiPostgresReady -Exe $flipCmd -H '127.0.0.1' -P '1' -LimitSeconds 30
$out['rejectThenReady'] = @{
    result  = [bool]$rFlip
    elapsed = [math]::Round(((Get-Date) - $t1).TotalSeconds, 1)
}

# 超时:**有界**是本票唯一真正的判据。打 127.0.0.1:1(loopback 上必然被拒,不是任何
# 数据库端口),4 秒上界必须返回 false;给 15s 的容差是因为机器负载,不是判据的一部分。
$t2 = Get-Date
$rTimeout = Wait-IhuiPostgresReady -Exe $badCmd -H '127.0.0.1' -P '1' -LimitSeconds 4
$out['boundedTimeout'] = @{
    result  = [bool]$rTimeout
    elapsed = [math]::Round(((Get-Date) - $t2).TotalSeconds, 1)
}

# 真 pg_isready 也必须走同一条有界路径(证明不是"只有假夹具才会停")
if ($resolved) {
    $t3 = Get-Date
    $rReal = Wait-IhuiPostgresReady -Exe $resolved -H '127.0.0.1' -P '1' -LimitSeconds 6
    $out['realBinaryBounded'] = @{
        result  = [bool]$rReal
        elapsed = [math]::Round(((Get-Date) - $t3).TotalSeconds, 1)
    }
}

Write-Output ('@@JSON' + (ConvertTo-Json $out -Depth 6 -Compress) + '@@')
