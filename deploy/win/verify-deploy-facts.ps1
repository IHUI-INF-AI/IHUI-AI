# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# verify-deploy-facts.ps1 —— 部署后功能验收(fail-closed,2026-11-04 立)
#
# 由 deploy/win/ihui-deploy.ps1 在「api/ai 重启之后、部署完成之前」调用。三条断言:
#   a) checkin_midnight   ai-service 启动日志在重启之后出现 checkin_daily_midnight=5 0 * * * (0:05 窗口注册)
#   b) writeback_403      重启之后不再新增「凭证回写失败」的 403 行;尚未覆盖一个回写周期 ⇒ undetermined
#   c) entry_layer_hash   仓库 deploy\win\lib\edge-admission.mjs 与 prod 副本 sha256 一致(证明入口层变更已随部署落地)
#
# 契约:
#   stdout 逐行 VERIFY|id=<id>|state=<ok|fail|undetermined>|detail=<ascii-key=value; ...>
#   末行   VERIFY|summary|ok=<n>|fail=<n>|undetermined=<n>
#   退出码:任一 fail ⇒ 1;否则 0(undetermined 不是通过,但按既有语义只 warn,由调用方摘要单列)。
#
# 只读证据面:ai-service 日志(NSSM 落点)与两个文件的哈希。不读 .env、不连库、不 psql、不写 D:\DevEnv。

[CmdletBinding()]
param(
    [string]$ProdRoot = '',
    [string]$SourceRoot = '',
    [string]$SinceIso = '',
    [int]$WritebackCycleMinutes = 15,
    [int]$WritebackWindowMinutes = 20,
    [string]$AiServiceName = '',
    [string]$AiLogOut = '',
    [string]$AiLogErr = ''
)

$ErrorActionPreference = 'Continue'

function Resolve-NssmExe {
    foreach ($c in @('D:\DevEnv\tools\nssm\nssm.exe', (Join-Path $env:SystemRoot 'System32\nssm.exe'))) {
        if ($c -and (Test-Path -LiteralPath $c)) { return $c }
    }
    $g = Get-Command nssm.exe -ErrorAction SilentlyContinue
    if ($g -and $g.Source) { return $g.Source }
    return $null
}

function Get-ServiceLogPaths {
    param([string]$Name)
    $paths = @()
    $nssm = Resolve-NssmExe
    if ($nssm -and $Name) {
        foreach ($k in 'AppStdout', 'AppStderr') {
            try {
                $p = (& $nssm get $Name $k 2>$null | Out-String).Trim()
                if ($p) { $paths += $p }
            } catch {}
        }
    }
    return $paths
}

function Find-AiServiceName {
    $cands = @('IHUI-AI-SERVICE', 'ihui-ai-service', 'svc-ai', 'IHUI-AI-SVC')
    foreach ($n in $cands) {
        if ($null -ne (Get-Service -Name $n -ErrorAction SilentlyContinue)) { return $n }
    }
    return ''
}

function Parse-LogTime {
    # 生产日志形如 2026-11-04T12:30:39.065137[+08:00];解析不了返回 $null(绝不拿"没时间戳"硬比较)。
    param([string]$Line)
    if ($Line -match '^\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)') {
        try {
            return [datetime]::Parse($Matches[1], [System.Globalization.CultureInfo]::InvariantCulture,
                [System.Globalization.DateTimeStyles]::RoundtripKind)
        } catch {}
    }
    return $null
}

function Read-AiLogFacts {
    # 一次扫描拿齐两条断言的证据行;用 StreamReader + FileShare.ReadWrite,NSSM 正写也不挡读。
    param([string[]]$Paths)
    $facts = @{ Readable = $false; Checkin = @(); Writeback403 = @(); SawTimestamp = $false }
    foreach ($p in $Paths) {
        if (-not $p -or -not (Test-Path -LiteralPath $p)) { continue }
        try {
            $fs = [System.IO.File]::Open($p, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
            try {
                $sr = New-Object System.IO.StreamReader($fs, [System.Text.Encoding]::UTF8, $true)
                try {
                    $facts.Readable = $true
                    while ($null -ne ($ln = $sr.ReadLine())) {
                        if ($ln.Contains('checkin_daily_midnight=5 0 * * *')) {
                            $ts = Parse-LogTime -Line $ln
                            if ($ts) { $facts.SawTimestamp = $true }
                            $facts.Checkin += @{ Ts = $ts; Line = $ln }
                            continue
                        }
                        # 「凭证回写失败」的典型行:[checkin_pool_writeback] 凭证回写失败,留待重试: ... err=...403...
                        # 中文在 LocalSystem 管道里可能烂成 U+FFFD,故同时认 ASCII 签名(pool_writeback + 403)。
                        $is403 = ($ln.Contains('凭证回写失败') -or ($ln.Contains('checkin_pool_writeback') -and $ln -match '(?<!\d)403(?!\d)'))
                        if ($is403) {
                            $ts = Parse-LogTime -Line $ln
                            if ($ts) { $facts.SawTimestamp = $true }
                            $facts.Writeback403 += @{ Ts = $ts; Line = $ln }
                        }
                    }
                } finally { $sr.Dispose() }
            } finally { $fs.Dispose() }
        } catch {}
    }
    return $facts
}

function Shorten {
    param([string]$Text, [int]$Max = 220)
    if (-not $Text) { return '' }
    $t = ($Text -replace '\s+', ' ').Trim()
    if ($t.Length -gt $Max) { return $t.Substring(0, $Max) + ' ...' }
    return $t
}

function Emit-Pass {
    param([string]$Id, [string]$State, [string]$Detail)
    Write-Output "VERIFY|id=$Id|state=$State|detail=$Detail"
}

# ── 参数落点 ────────────────────────────────────────────────────────────────────
$repoRootFromScript = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $ProdRoot) {
    if ($env:IHUI_PROD_ROOT) { $ProdRoot = $env:IHUI_PROD_ROOT }
    elseif (Test-Path -LiteralPath 'D:\DevEnv\ihui-prod') { $ProdRoot = 'D:\DevEnv\ihui-prod' }
    else { $ProdRoot = $repoRootFromScript }
}
if (-not $SourceRoot) {
    if ($env:IHUI_SOURCE_ROOT) { $SourceRoot = $env:IHUI_SOURCE_ROOT }
    elseif (Test-Path -LiteralPath 'D:\IHUI-AI') { $SourceRoot = 'D:\IHUI-AI' }
    else { $SourceRoot = $ProdRoot }
}

$since = $null
if ($SinceIso) {
    try {
        $since = [datetime]::Parse($SinceIso, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::RoundtripKind)
    } catch { $since = $null }
}
if (-not $since) { $since = (Get-Date).AddMinutes(-1 * [Math]::Max(1, $WritebackWindowMinutes)) }
$now = Get-Date
$windowStart = $now.AddMinutes(-1 * [Math]::Max(1, $WritebackWindowMinutes))
$effectiveSince = if ($windowStart -gt $since) { $windowStart } else { $since }

# ── AI 日志落点 ─────────────────────────────────────────────────────────────────
$svc = if ($AiServiceName) { $AiServiceName } else { Find-AiServiceName }
$logPaths = @()
if ($AiLogOut) { $logPaths += $AiLogOut }
if ($AiLogErr) { $logPaths += $AiLogErr }
if (-not $logPaths) { $logPaths = @(Get-ServiceLogPaths -Name $svc) }
if (-not $logPaths) {
    $logPaths = @('D:\DevEnv\logs\svc-ai-nssm.log', 'D:\DevEnv\logs\svc-ai-nssm-err.log')
}
$facts = Read-AiLogFacts -Paths @($logPaths | Select-Object -Unique)

$okCount = 0
$failCount = 0
$undetCount = 0
$failLines = @()
$undetLines = @()

# ── a) checkin_midnight ──────────────────────────────────────────────────────────
$idA = 'checkin_midnight'
if (-not $facts.Readable) {
    Emit-Pass $idA 'undetermined' "logs_unreadable; paths=$(@($logPaths) -join ',')"
    $undetCount++; $undetLines += $idA
} elseif (@($facts.Checkin).Count -eq 0) {
    Emit-Pass $idA 'fail' "absent_in_logs; since=$($since.ToString('o')); paths=$(@($logPaths) -join ',')"
    $failCount++; $failLines += $idA
} else {
    $hits = @($facts.Checkin | Where-Object { $_.Ts -and $_.Ts -ge $since })
    $oldHits = @($facts.Checkin | Where-Object { $_.Ts -and $_.Ts -lt $since })
    $hasTs = @($facts.Checkin | Where-Object { $_.Ts }).Count -gt 0
    if ($hits.Count -gt 0) {
        $latest = ($hits | Sort-Object { $_.Ts } | Select-Object -Last 1)
        Emit-Pass $idA 'ok' "hits=$($hits.Count); latest=$($latest.Ts.ToString('o')); pattern=checkin_daily_midnight=5 0 * * *"
        $okCount++
    } elseif (-not $hasTs) {
        Emit-Pass $idA 'undetermined' "found_but_no_timestamp; total=$(@($facts.Checkin).Count)"
        $undetCount++; $undetLines += $idA
    } else {
        Emit-Pass $idA 'fail' "only_before_restart; since=$($since.ToString('o')); oldhits=$($oldHits.Count); sample=$(Shorten $oldHits[0].Line)"
        $failCount++; $failLines += $idA
    }
}

# ── b) writeback_403 ────────────────────────────────────────────────────────────
$idB = 'writeback_403'
$elapsedMin = ($now - $since).TotalMinutes
if (-not $facts.Readable) {
    Emit-Pass $idB 'undetermined' "logs_unreadable; paths=$(@($logPaths) -join ',')"
    $undetCount++; $undetLines += $idB
} else {
    $newHits = @($facts.Writeback403 | Where-Object { $_.Ts -and $_.Ts -ge $effectiveSince })
    $noTs = @($facts.Writeback403 | Where-Object { -not $_.Ts })
    if ($newHits.Count -gt 0) {
        $latest = ($newHits | Sort-Object { $_.Ts } | Select-Object -Last 1)
        Emit-Pass $idB 'fail' "new_403=$($newHits.Count); latest=$($latest.Ts.ToString('o')); sample=$(Shorten $latest.Line)"
        $failCount++; $failLines += $idB
    } elseif ($noTs.Count -gt 0) {
        Emit-Pass $idB 'undetermined' "403_without_timestamp=$($noTs.Count); cannot_anchor_to_restart"
        $undetCount++; $undetLines += $idB
    } elseif ($elapsedMin -ge $WritebackCycleMinutes) {
        Emit-Pass $idB 'ok' "no_new_403; since=$($since.ToString('o')); elapsed_min=$([Math]::Round($elapsedMin, 1)); cycle_min=$WritebackCycleMinutes"
        $okCount++
    } else {
        Emit-Pass $idB 'undetermined' "no_new_403_yet; elapsed_min=$([Math]::Round($elapsedMin, 1)); cycle_min=$WritebackCycleMinutes; note=waiting_first_writeback_cycle"
        $undetCount++; $undetLines += $idB
    }
}

# ── c) entry_layer_hash ─────────────────────────────────────────────────────────
$idC = 'entry_layer_hash'
$relEdge = 'deploy\win\lib\edge-admission.mjs'
$srcEdge = Join-Path $SourceRoot $relEdge
$prodEdge = Join-Path $ProdRoot $relEdge
$srcFull = [System.IO.Path]::GetFullPath($SourceRoot).TrimEnd([char[]]@('\', '/'))
$prodFull = [System.IO.Path]::GetFullPath($ProdRoot).TrimEnd([char[]]@('\', '/'))
if ($srcFull -eq $prodFull) {
    Emit-Pass $idC 'undetermined' "source_equals_prod; root=$ProdRoot; cannot_distinguish"
    $undetCount++; $undetLines += $idC
} elseif (-not (Test-Path -LiteralPath $srcEdge)) {
    Emit-Pass $idC 'undetermined' "source_missing; path=$srcEdge"
    $undetCount++; $undetLines += $idC
} elseif (-not (Test-Path -LiteralPath $prodEdge)) {
    Emit-Pass $idC 'fail' "prod_missing; path=$prodEdge"
    $failCount++; $failLines += $idC
} else {
    try {
        $hs = (Get-FileHash -LiteralPath $srcEdge -Algorithm SHA256).Hash.ToLowerInvariant()
        $hp = (Get-FileHash -LiteralPath $prodEdge -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($hs -eq $hp) {
            Emit-Pass $idC 'ok' "sha256=$hs; source=$srcEdge; prod=$prodEdge"
            $okCount++
        } else {
            Emit-Pass $idC 'fail' "sha256_mismatch; source=$hs; prod=$hp; source_path=$srcEdge; prod_path=$prodEdge"
            $failCount++; $failLines += $idC
        }
    } catch {
        Emit-Pass $idC 'undetermined' "hash_error=$($_.Exception.Message)"
        $undetCount++; $undetLines += $idC
    }
}

Write-Output "VERIFY|summary|ok=$okCount|fail=$failCount|undetermined=$undetCount|failed_ids=$($failLines -join ',')|undetermined_ids=$($undetLines -join ',')"
if ($failCount -gt 0) { exit 1 }
exit 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
