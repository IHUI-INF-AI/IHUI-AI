# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
# =============================================================================
# 行为验证(G-37 格② 执行席 @2026-10-27):ihui-deploy.ps1 的 Test-BuildCooldown
# 必须**同时比对它自己记录的 `head`**,且判定是三态:
#   · 窗内 + HEAD 未推进(等于记录)      ⇒ $true  冷却照旧生效(同一枚失败面);
#   · 窗内 + HEAD 已推进且源码子树真变   ⇒ $false 放行(旧冷却不得压住新构建);
#   · 窗外                               ⇒ $false 放行(原时间窗口径不变);
#   · 记录在位但 ts/head 读不出、或当前 HEAD/子树指纹算不出 ⇒ $null 未判定
#     —— 调用方既不默认放行也不默认压住(旧口径:无 head 记录 ⇒ 默认压住、坏记录 ⇒ 默认放行,两型都在此钉死)。
# 夹具形态:不 dot-source 整脚本(真跑 ihui-deploy.ps1 会重启线上服务,与镜像
# mjs「装车证明」同一动机),改用 AST 抽取 Get-BuildSrcFingerprint + Test-BuildCooldown
# 两个函数原文,在假 git 桩与**临时状态文件**的受控 Scope 里真执行(绝不碰生产状态文件)。
# 两向取证:M1 摘掉「对记录 head 取指纹」⇒ c3 翻红;M2 摘掉「未判定出口」⇒ c6 翻红。
# =============================================================================
param([string]$DeployPath = (Join-Path $PSScriptRoot '..\win\ihui-deploy.ps1'))
$ErrorActionPreference = 'Stop'

function Get-FunctionText([string]$Path, [string[]]$Names) {
    $abs = (Resolve-Path -LiteralPath $Path).Path
    $toks = $null; $errs = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile($abs, [ref]$toks, [ref]$errs)
    if ($errs.Count) { throw "解析 $abs 失败:$($errs[0].Message)" }
    $parts = foreach ($n in $Names) {
        $fd = @($ast.FindAll({ param($x) $x -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $x.Name -eq $n }, $true))
        if ($fd.Count -lt 1) { throw "未在 $abs 找到函数 $n —— 改名/删除会让本夹具失明(§0.3 取不到即失败,不静默跳过)" }
        $fd[0].Extent.Text
    }
    ($parts -join "`n")
}

$core = Get-FunctionText $DeployPath @('Get-BuildSrcFingerprint', 'Test-BuildCooldown')

# 受控 Scope 模板:__CORE__ 注入生产函数原文(可先做变异),假 git 桩由 __HEAD__/__TREES__ 驱动。
$scopeTemplate = @'
$Root = '__ROOT__'
$BuildCooldownFile = '__STATE__'
$CurHeadOut = '__HEAD__'
$Trees = @{}
__TREES__
function git {
    param([string]$C, [Parameter(ValueFromRemainingArguments = $true)]$Rest)
    if ($Rest.Count -ge 2 -and $Rest[0] -eq 'rev-parse' -and $Rest[1] -eq 'HEAD') { Write-Output $CurHeadOut; return }
    if ($Rest.Count -ge 2 -and $Rest[0] -eq 'rev-parse') {
        foreach ($spec in $Rest[1..($Rest.Count - 1)]) {
            if ($spec -match '^(.+):(apps|packages)$') {
                $v = $Trees["$($Matches[1])|$($Matches[2])"]
                if ($v) { Write-Output $v } else { Write-Output 'fatal: unknown revision harness' }
            } else { Write-Output 'fatal: bad revision harness' }
        }
        return
    }
    Write-Output 'fatal: unexpected git call in harness'
}
__CORE__
$v = Test-BuildCooldown
if ($null -eq $v) { 'VERDICT_NULL' } elseif ($v) { 'VERDICT_TRUE' } else { 'VERDICT_FALSE' }
'@

$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ('ihui-build-cooldown-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null
$tmp = Join-Path $tmpDir 'build-fail-state.json'

function Run-Verdict {
    param([string]$Core, [AllowNull()][AllowEmptyString()][string]$StateRaw, [string]$Head, [hashtable]$Trees)
    # 约定:$StateRaw 为空 = 本轮"无冷却记录"(删档后跑);[string] 参数会把 $null 折成 '',所以两型同判。
    if ([string]::IsNullOrEmpty($StateRaw)) { if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force } }
    else { Set-Content -LiteralPath $tmp -Value $StateRaw -NoNewline -Encoding utf8NoBOM }
    $treeLines = ($Trees.GetEnumerator() | ForEach-Object { "`$Trees['$($_.Key)'] = '$($_.Value)'" }) -join "`n"
    $text = $scopeTemplate.Replace('__ROOT__', 'X:\ihui-harness-fake').Replace('__STATE__', $tmp).Replace('__HEAD__', $Head).Replace('__TREES__', $treeLines).Replace('__CORE__', $Core)
    (& ([scriptblock]::Create($text)) | Out-String).Trim()
}

$pass = 0; $fail = 0
function T([string]$name, [bool]$cond, [string]$got = '') {
    if ($cond) { $script:pass++; Write-Output "  ok   $name" }
    else { $script:fail++; Write-Output "  FAIL $name  —— 实得:$got" }
}
function TE([string]$name, [string]$got, [string]$want) {
    if ($got -eq $want) { $script:pass++; Write-Output "  ok   $name" }
    else { $script:fail++; Write-Output "  FAIL $name  —— 实得:$got(期望:$want)" }
}

$H1 = 'a' * 40; $H2 = 'b' * 40
$T1A = '1' * 40; $T1B = '2' * 40; $T2A = '3' * 40; $T2B = '4' * 40
$now = (Get-Date).ToString('o')
$old = (Get-Date).AddMinutes(-45).ToString('o')
$trees = @{ "$H1|apps" = $T1A; "$H1|packages" = $T1B; "$H2|apps" = $T2A; "$H2|packages" = $T2B }
$treesDocOnly = @{ "$H1|apps" = $T1A; "$H1|packages" = $T1B; "$H2|apps" = $T1A; "$H2|packages" = $T1B }
function St([string]$ts, [string]$head) {
    if ($head) { @"
{"ts":"$ts","head":"$head"}
"@ } else { @"
{"ts":"$ts"}
"@ }
}

Write-Output '[1] 无冷却记录 ⇒ 判过的放行(不是未判定)'
TE '1a 无记录 = VERDICT_FALSE' (Run-Verdict $core $null $H1 $trees) 'VERDICT_FALSE'

Write-Output '[2] 窗内 + HEAD 未推进 ⇒ 冷却照旧生效($true,方向:同一枚提交不被反复放行)'
TE '2a HEAD 相等仍压住' (Run-Verdict $core (St $now $H1) $H1 $trees) 'VERDICT_TRUE'

Write-Output '[3] 窗内 + HEAD 已推进且源码子树真变 ⇒ 放行(方向:新提交不被旧冷却压住)'
$g3 = Run-Verdict $core (St $now $H1) $H2 $trees
TE '3a 推进+源码变 = VERDICT_FALSE' $g3 'VERDICT_FALSE'

Write-Output '[4] 窗内 + HEAD 已推进但源码未变(台账/文档提交) ⇒ 节流仍成立(防 CPU 风暴)'
TE '4a 推进+源码同 = VERDICT_TRUE' (Run-Verdict $core (St $now $H1) $H2 $treesDocOnly) 'VERDICT_TRUE'

Write-Output '[5] 窗外(45 分钟) ⇒ 放行,即便 HEAD 未推进(原时间窗口径不变)'
TE '5a 窗外 = VERDICT_FALSE' (Run-Verdict $core (St $old $H1) $H1 $trees) 'VERDICT_FALSE'

Write-Output '[6] 记录在位但没有 head(旧版记录) ⇒ 未判定(旧口径在此默认压住)'
$g6 = Run-Verdict $core (St $now '') $H1 $trees
TE '6a 缺 head = VERDICT_NULL' $g6 'VERDICT_NULL'

Write-Output '[7] 记录的 head 非 sha 形态 ⇒ 未判定'
TE '7a head 乱码 = VERDICT_NULL' (Run-Verdict $core (St $now 'not-a-sha') $H1 $trees) 'VERDICT_NULL'

Write-Output '[8] 记录没有 ts ⇒ 未判定(时间窗同样判不了,不冒充"窗外")'
TE '8a 缺 ts = VERDICT_NULL' (Run-Verdict $core ('{"head":"' + $H1 + '"}') $H1 $trees) 'VERDICT_NULL'

Write-Output '[9] ts 读不成日期 ⇒ 未判定'
TE '9a ts 坏 = VERDICT_NULL' (Run-Verdict $core (St 'not-a-date' $H1) $H1 $trees) 'VERDICT_NULL'

Write-Output '[10] 记录整体损坏(非 JSON) ⇒ 未判定(旧口径 catch 在此默认放行)'
TE '10a 非 JSON = VERDICT_NULL' (Run-Verdict $core 'this-is-not-json{{' $H1 $trees) 'VERDICT_NULL'

Write-Output '[11] 窗外 + 缺 head ⇒ 仍判放行(窗外不需要 head 参与)'
TE '11a 窗外缺 head = VERDICT_FALSE' (Run-Verdict $core (St $old '') $H1 $trees) 'VERDICT_FALSE'

Write-Output '[12] 当前 HEAD 读不出(git 返回 fatal 文本) ⇒ 未判定(旧口径在此默认压住)'
TE '12a HEAD 不可读 = VERDICT_NULL' (Run-Verdict $core (St $now $H1) 'fatal: not a git repository' $trees) 'VERDICT_NULL'

Write-Output '[13] 变异 M1:摘掉"对记录 head 取指纹"的比对 ⇒ 用例[3]必须翻红(夹具真钉住了 head 比对)'
$m1 = $core.Replace('$oldFp = Get-BuildSrcFingerprint $recHead', '$oldFp = Get-BuildSrcFingerprint $curHead')
T '13a 变异必须真的改变原文' ($m1 -ne $core) 'Replace 未命中 ⇒ 生产实现形态漂移,本夹具失明'
$g13 = Run-Verdict $m1 (St $now $H1) $H2 $trees
TE '13b 摘掉 head 比对后 [3] 翻成 VERDICT_TRUE(被压住)' $g13 'VERDICT_TRUE'
TE '13c 原实现同场景确实放行(对照)' (Run-Verdict $core (St $now $H1) $H2 $trees) 'VERDICT_FALSE'

Write-Output '[14] 变异 M2:把未判定出口换成默认压住 ⇒ 用例[6]必须翻红(夹具真钉住了三态)'
$m2 = $core.Replace('return $null', 'return $true')
T '14a 变异必须真的改变原文' ($m2 -ne $core) 'Replace 未命中 ⇒ 生产实现形态漂移,本夹具失明'
TE '14b 摘掉未判定后 [6] 翻成 VERDICT_TRUE' (Run-Verdict $m2 (St $now '') $H1 $trees) 'VERDICT_TRUE'

if (Test-Path -LiteralPath $tmpDir) { Remove-Item -LiteralPath $tmpDir -Recurse -Force }
Write-Output ''
Write-Output ("RESULT pass={0} fail={1}" -f $pass, $fail)
if ($fail -gt 0) { exit 1 }
exit 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
