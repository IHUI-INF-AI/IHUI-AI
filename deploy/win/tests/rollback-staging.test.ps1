# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
# DBG-78 / DBG-79 行为锁。
# 跑法: pwsh -NoProfile -File deploy/win/tests/rollback-staging.test.ps1
# 不点源 ihui-deploy.ps1(点源会走进部署/回滚),只抽出三个纯函数在临时目录上跑。
# 也不调用 Stop-Web / Start-Web / Do-Rollback,不对本机服务发 sc stop。
param([string]$DeployPath = (Join-Path $PSScriptRoot '..\ihui-deploy.ps1'))
$ErrorActionPreference = 'Stop'
$pass = 0; $fail = 0
function T([string]$name, [bool]$cond, [string]$got = '') {
    if ($cond) { $script:pass++; Write-Output "  ok   $name" }
    else { $script:fail++; Write-Output "  FAIL $name  —— 实得:$got" }
}
function Get-DeployFunctionText([string]$Path, [string]$Name) {
    $tokens = $null; $errors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile($Path, [ref]$tokens, [ref]$errors)
    if ($errors -and @($errors).Count -gt 0) { throw "ihui-deploy.ps1 解析失败: $($errors[0])" }
    $fns = @($ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $Name }, $true))
    if ($fns.Count -ne 1) { throw "function $Name 期望 1 份,实得 $($fns.Count)" }
    return $fns[0].Extent.Text
}
function Invoke-Caught([scriptblock]$Body) {
    try { & $Body; return @{ Threw = $false; Message = '' } }
    catch { return @{ Threw = $true; Message = $_.Exception.Message } }
}
function New-FakeBuild([string]$Dir, [string]$Id) {
    New-Item -ItemType Directory -Path $Dir -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $Dir 'BUILD_ID') -Value $Id -Encoding ascii
    Set-Content -LiteralPath (Join-Path $Dir 'PAGE.txt') -Value "page-$Id" -Encoding ascii
}
function Read-Trim([string]$Path) { return ((Get-Content -LiteralPath $Path -Raw).Trim()) }

foreach ($fn in @('Install-DirByStaging', 'Remove-RollbackPointIfHealthy', 'Wait-IhuiServiceStopped')) {
    Invoke-Expression (Get-DeployFunctionText -Path $DeployPath -Name $fn)
}
$deploySrc = Get-Content -LiteralPath $DeployPath -Raw

$root = Join-Path ([System.IO.Path]::GetTempPath()) ('ihui-rollback-staging-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $root | Out-Null
try {
    Write-Output '[1] Copy-Item 套进已存在目录(本机对照,不是部署)'
    $naiveSrc = Join-Path $root 'naive-src\.next-blue'
    $naiveDst = Join-Path $root 'naive-web\.rollback'
    New-FakeBuild $naiveSrc 'SRC'
    New-Item -ItemType Directory -Path $naiveDst -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $naiveDst 'OLD.txt') -Value 'OLD' -Encoding ascii
    Copy-Item -LiteralPath $naiveSrc -Destination $naiveDst -Recurse -Force
    T '1a 目标已存在时根上没有 BUILD_ID' (-not (Test-Path -LiteralPath (Join-Path $naiveDst 'BUILD_ID')))
    T '1b 源目录名被套进目标' (Test-Path -LiteralPath (Join-Path $naiveDst '.next-blue\BUILD_ID'))
    T '1c 旧文件还在(半新半旧)' ((Read-Trim (Join-Path $naiveDst 'OLD.txt')) -eq 'OLD')

    Write-Output '[2] Install-DirByStaging:目标已在且非空,换成根上的新树'
    $src = Join-Path $root 'src\.next-blue'
    $dst = Join-Path $root 'web\.rollback'
    New-FakeBuild $src 'NEW'
    New-Item -ItemType Directory -Path $dst -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $dst 'OLD.txt') -Value 'OLD' -Encoding ascii
    $nest = Join-Path $dst '.next-blue'
    New-Item -ItemType Directory -Path $nest -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $nest 'BUILD_ID') -Value 'NESTED' -Encoding ascii
    $sw = Install-DirByStaging -Source $src -Destination $dst
    T '2a 返回成功且无残留' ($sw.Ok -eq $true -and -not $sw.Leftover) "ok=$($sw.Ok) leftover=$($sw.Leftover)"
    T '2b BUILD_ID 在根上且是新包' ((Read-Trim (Join-Path $dst 'BUILD_ID')) -eq 'NEW') (Read-Trim (Join-Path $dst 'BUILD_ID'))
    T '2c 同层文件跟着到根上' ((Read-Trim (Join-Path $dst 'PAGE.txt')) -eq 'page-NEW')
    T '2d 不再套一层源目录名' (-not (Test-Path -LiteralPath (Join-Path $dst '.next-blue')))
    T '2e 旧文件不残留' (-not (Test-Path -LiteralPath (Join-Path $dst 'OLD.txt')))
    T '2f 源目录还在(拷贝不是挪走源)' ((Read-Trim (Join-Path $src 'BUILD_ID')) -eq 'NEW')
    $debris = @(Get-ChildItem -LiteralPath (Split-Path $dst -Parent) -Force | Where-Object { $_.Name -match '\.stage-|\.retired-' })
    T '2g 临时目录已清' ($debris.Count -eq 0) ($debris.Name -join ',')

    Write-Output '[3] 目标不存在时直接落成该目录,不套娃'
    $dstAbsent = Join-Path $root 'web2\.next'
    New-Item -ItemType Directory -Path (Split-Path $dstAbsent -Parent) -Force | Out-Null
    $sw3 = Install-DirByStaging -Source $src -Destination $dstAbsent
    T '3a 成功' ($sw3.Ok -eq $true -and -not $sw3.Leftover) "leftover=$($sw3.Leftover)"
    T '3b 根上是源标记' ((Read-Trim (Join-Path $dstAbsent 'BUILD_ID')) -eq 'NEW')

    Write-Output '[4] 旧目录换不走:失败,原目录不动,不套拷贝'
    $dst4 = Join-Path $root 'web4\.next'
    New-Item -ItemType Directory -Path $dst4 -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $dst4 'OLD.txt') -Value 'KEEP' -Encoding ascii
    $hit = Invoke-Caught { Install-DirByStaging -Source $src -Destination $dst4 -MoveItem { param($LiteralPath, $Destination) throw 'sharing violation' } }
    T '4a 明确失败且标明目录未改' ($hit.Threw -and $hit.Message -like 'staging-copy: unchanged:*sharing violation*') $hit.Message
    T '4b 旧文件还在' ((Read-Trim (Join-Path $dst4 'OLD.txt')) -eq 'KEEP')
    T '4c 根上没有新 BUILD_ID' (-not (Test-Path -LiteralPath (Join-Path $dst4 'BUILD_ID')))
    $debris4 = @(Get-ChildItem -LiteralPath (Split-Path $dst4 -Parent) -Force | Where-Object { $_.Name -match '\.stage-|\.retired-' })
    T '4d 失败后临时目录不留' ($debris4.Count -eq 0) ($debris4.Name -join ',')

    Write-Output '[5] 第二次改名失败但旧目录能改回:原树回来'
    $dst5 = Join-Path $root 'web5\.next'
    New-Item -ItemType Directory -Path $dst5 -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $dst5 'OLD.txt') -Value 'BACK' -Encoding ascii
    $script:moves5 = 0
    $hit5 = Invoke-Caught {
        Install-DirByStaging -Source $src -Destination $dst5 -MoveItem {
            param($LiteralPath, $Destination)
            $script:moves5++
            if ($script:moves5 -eq 2) { throw 'stage rename failed' }
            Move-Item -LiteralPath $LiteralPath -Destination $Destination -ErrorAction Stop
        }
    }
    T '5a 失败且标明已还原' ($hit5.Threw -and $hit5.Message -like 'staging-copy: unchanged:*previous directory restored*') $hit5.Message
    T '5b 旧文件回到原路径' ((Test-Path -LiteralPath (Join-Path $dst5 'OLD.txt')) -and (Read-Trim (Join-Path $dst5 'OLD.txt')) -eq 'BACK')
    T '5c 根上没有新 BUILD_ID' (-not (Test-Path -LiteralPath (Join-Path $dst5 'BUILD_ID')))
    $debris5 = @(Get-ChildItem -LiteralPath (Split-Path $dst5 -Parent) -Force | Where-Object { $_.Name -match '\.stage-|\.retired-' })
    T '5d 临时目录不留' ($debris5.Count -eq 0) ($debris5.Name -join ',')

    Write-Output '[6] 旧目录也改不回来:明确失败,并点名旧树落点'
    $dst6 = Join-Path $root 'web6\.next'
    New-Item -ItemType Directory -Path $dst6 -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $dst6 'OLD.txt') -Value 'PARKED' -Encoding ascii
    $script:moves6 = 0
    $hit6 = Invoke-Caught {
        Install-DirByStaging -Source $src -Destination $dst6 -MoveItem {
            param($LiteralPath, $Destination)
            $script:moves6++
            if ($script:moves6 -eq 1) { Move-Item -LiteralPath $LiteralPath -Destination $Destination -ErrorAction Stop; return }
            throw 'rename blocked'
        }
    }
    T '6a dest-missing' ($hit6.Threw -and $hit6.Message -like 'staging-copy: dest-missing:*previous tree left at *') $hit6.Message
    T '6b 原路径上已经没有目录' (-not (Test-Path -LiteralPath $dst6))
    $parked = @(Get-ChildItem -LiteralPath (Split-Path $dst6 -Parent) -Force -Directory | Where-Object { $_.Name -like '.next.retired-*' -and (Test-Path -LiteralPath (Join-Path $_.FullName 'OLD.txt')) })
    T '6c 旧树还在 retired 目录里' ($parked.Count -eq 1 -and (Read-Trim (Join-Path $parked[0].FullName 'OLD.txt')) -eq 'PARKED') "count=$($parked.Count)"

    Write-Output '[7] 源和目标相同 / 拷贝结果是套娃:不动目标'
    $hit7 = Invoke-Caught { Install-DirByStaging -Source $src -Destination $src }
    T '7a 同源拒绝' ($hit7.Threw -and $hit7.Message -like 'staging-copy: unchanged:*same*') $hit7.Message
    T '7b 源标记还在' ((Read-Trim (Join-Path $src 'BUILD_ID')) -eq 'NEW')
    $dst7 = Join-Path $root 'web7\.rollback'
    New-Item -ItemType Directory -Path $dst7 -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $dst7 'OLD.txt') -Value 'KEEP7' -Encoding ascii
    $hit7b = Invoke-Caught {
        Install-DirByStaging -Source $src -Destination $dst7 -CopyTree {
            param($LiteralPath, $Destination)
            $leaf = Split-Path -Leaf $LiteralPath
            $nestDir = Join-Path $Destination $leaf
            New-Item -ItemType Directory -Path $nestDir -Force | Out-Null
            Copy-Item -LiteralPath (Join-Path $LiteralPath 'BUILD_ID') -Destination (Join-Path $nestDir 'BUILD_ID') -Force
        }
    }
    T '7c 套娃拷贝被拒绝' ($hit7b.Threw -and $hit7b.Message -like 'staging-copy: unchanged:*marker not at stage root*') $hit7b.Message
    T '7d 目标仍是旧文件' ((Read-Trim (Join-Path $dst7 'OLD.txt')) -eq 'KEEP7' -and -not (Test-Path -LiteralPath (Join-Path $dst7 'BUILD_ID')))

    Write-Output '[8] 健康复验通过之前不删唯一 .rollback'
    $rb = Join-Path $root 'retain\.rollback'
    New-FakeBuild $rb 'RB'
    T '8a 未传 HealthPassed 默认保留' ((Remove-RollbackPointIfHealthy -RollbackDir $rb) -eq $false -and (Test-Path -LiteralPath (Join-Path $rb 'BUILD_ID')))
    T '8b HealthPassed false 保留' ((Remove-RollbackPointIfHealthy -RollbackDir $rb -HealthPassed $false) -eq $false -and (Read-Trim (Join-Path $rb 'BUILD_ID')) -eq 'RB')
    T '8c HealthPassed true 才删' ((Remove-RollbackPointIfHealthy -RollbackDir $rb -HealthPassed $true) -eq $true -and -not (Test-Path -LiteralPath $rb))
    $rbGone = Join-Path $root 'retain-missing\.rollback'
    T '8d 已经不在且复验通过:算摘除完成' ((Remove-RollbackPointIfHealthy -RollbackDir $rbGone -HealthPassed $true) -eq $true)

    Write-Output '[9] 停服务:Stopped 才成功;StopPending/超时/缺失/发停失败都是明确失败'
    $script:slept9 = 0
    $w9 = Wait-IhuiServiceStopped -TimeoutSec 2 -PollMilliseconds 1 -RequestStop { } -QueryStatus { 'Stopped' } -Sleep { param($Milliseconds) $script:slept9++ }
    T '9a 已经是 Stopped:成功且不再睡' ($w9.Ok -eq $true -and $w9.Status -eq 'Stopped' -and $w9.Reason -eq 'stopped' -and $script:slept9 -eq 0) "ok=$($w9.Ok) status=$($w9.Status) slept=$script:slept9"
    $script:seen9 = 0
    $script:polls9 = 0
    $w9b = Wait-IhuiServiceStopped -TimeoutSec 5 -PollMilliseconds 1 -RequestStop { } -QueryStatus {
        $script:seen9++
        if ($script:seen9 -ge 3) { 'Stopped' } else { 'StopPending' }
    } -OnPoll { $script:polls9++ } -Sleep { param($Milliseconds) }
    T '9b StopPending 不算停,等到 Stopped 才成功' ($w9b.Ok -eq $true -and $script:seen9 -ge 3 -and $script:polls9 -ge 1) "seen=$script:seen9 polls=$script:polls9"
    $w9c = Wait-IhuiServiceStopped -TimeoutSec 1 -PollMilliseconds 1 -RequestStop { } -QueryStatus { 'Running' } -Sleep { param($Milliseconds) }
    T '9c 一直 Running:超时失败,状态原样带回' ($w9c.Ok -eq $false -and $w9c.Reason -eq 'timeout' -and $w9c.Status -eq 'Running') "reason=$($w9c.Reason) status=$($w9c.Status)"
    $script:sleptMiss = 0
    $w9d = Wait-IhuiServiceStopped -TimeoutSec 5 -PollMilliseconds 1 -RequestStop { } -QueryStatus { 'Missing' } -Sleep { param($Milliseconds) $script:sleptMiss++ }
    T '9d 服务不存在:立即 missing,不等到超时' ($w9d.Ok -eq $false -and $w9d.Reason -eq 'missing' -and $script:sleptMiss -eq 0) "reason=$($w9d.Reason) slept=$script:sleptMiss"
    $script:queried = $false
    $w9e = Wait-IhuiServiceStopped -TimeoutSec 2 -RequestStop { throw 'sc failed' } -QueryStatus { $script:queried = $true; 'Stopped' } -Sleep { param($Milliseconds) }
    T '9e 发停失败:不再查状态' ($w9e.Ok -eq $false -and $w9e.Reason -eq 'stop-request-failed' -and -not $script:queried -and $w9e.Detail -match 'sc failed') "reason=$($w9e.Reason) q=$script:queried detail=$($w9e.Detail)"
    $w9f = Wait-IhuiServiceStopped -TimeoutSec 2 -RequestStop { } -QueryStatus { throw 'query down' } -Sleep { param($Milliseconds) }
    T '9f 查询失败:query-failed' ($w9f.Ok -eq $false -and $w9f.Reason -eq 'query-failed' -and $w9f.Detail -match 'query down') "reason=$($w9f.Reason) detail=$($w9f.Detail)"

    Write-Output '[10] 三个函数真的接在整盘回滚和生成回滚点上'
    $doBody = Get-DeployFunctionText -Path $DeployPath -Name 'Do-Rollback'
    $stopBody = Get-DeployFunctionText -Path $DeployPath -Name 'Stop-Web'
    T '10a Stop-Web 会等,没停就 Fail' ($stopBody -match 'Wait-IhuiServiceStopped' -and $stopBody -match 'if \(-not \$wait\.Ok\)' -and $stopBody -match 'Fail "停止 IHUI-WEB 失败"' -and $stopBody -match '1062')
    T '10b 先停再替换,替换在健康复验之前' (($doBody.IndexOf("Stop-Web`r") -ge 0 -or $doBody.IndexOf("Stop-Web`n") -ge 0) -and $doBody.IndexOf('Install-DirByStaging') -gt $doBody.IndexOf('Stop-Web') -and $doBody.IndexOf('Test-HealthGate') -gt $doBody.IndexOf('Install-DirByStaging'))
    $rmCalls = [regex]::Matches($doBody, 'Remove-RollbackPointIfHealthy[^\r\n]*')
    T '10c 只在复验之后摘一次,且 HealthPassed 为 true' ($rmCalls.Count -eq 1 -and $rmCalls[0].Value -match '-HealthPassed \$true' -and $doBody.IndexOf('Remove-RollbackPointIfHealthy') -gt $doBody.IndexOf('Test-HealthGate')) $rmCalls[0].Value
    T '10d 整盘路径不再先删再 Copy-Item' ($doBody -notmatch 'Copy-Item \$rb' -and $doBody -notmatch 'Remove-Item \$rb' -and $doBody -notmatch 'Remove-Item "\$WebDir\\\.next"')
    $elseAt = $doBody.IndexOf('回滚后健康未过, .rollback 保留')
    $elseTail = if ($elseAt -ge 0) { $doBody.Substring($elseAt) } else { '' }
    T '10e 复验失败分支不删除' ($elseAt -gt $doBody.IndexOf('Remove-RollbackPointIfHealthy') -and $elseTail -notmatch 'Remove-') $elseTail
    $bakAt = $deploySrc.IndexOf('Log "备份当前 web 构建 → .rollback"')
    $bakEnd = $deploySrc.IndexOf('跳过备份(冷启动)', $bakAt)
    $bak = if ($bakAt -ge 0 -and $bakEnd -gt $bakAt) { $deploySrc.Substring($bakAt, $bakEnd - $bakAt) } else { '' }
    T '10f 生成回滚点走 staging,不再先删再拷' ($bak -match 'Install-DirByStaging' -and $bak -match 'rollback-point-staging-failed' -and $bak -notmatch 'Copy-Item \$curNext' -and $bak -notmatch 'Remove-Item \$rb') $bak
} finally {
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Output ("---- {0} passed, {1} failed ----" -f $pass, $fail)
if ($fail -gt 0) { exit 1 }
exit 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
