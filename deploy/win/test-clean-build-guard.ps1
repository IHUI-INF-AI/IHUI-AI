# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# test-clean-build-guard.ps1 — 净面构建的 env 内联判据自检(不跑部署主流程)
#
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File deploy\win\test-clean-build-guard.ps1
# 退出码: 0 = 全部用例符合预期;1 = 有用例不符
#
# 为什么要单独立这个文件:`Test-CleanBuildEnvInlined` 住在 ihui-deploy.ps1 里,而那个文件
# 顶层就是部署主流程 —— **dot-source 它 = 当场开始部署**。所以这里按 AST 只取那一个
# FunctionDefinition 来定义函数,再用构造面喂它(§22c:判据的对象是别的文件的形态时,
# 输入要逐字取自那个文件的真实产出形态,而不是复刻实现)。
# 六条用例的共同点是把"未判定 ≠ 通过"钉住:挑不出探针、扫不到 js、派生失败,都必须落
# 'undetermined' 而不是 'ok';而"主目录有 env、净面没有"必须是 'absent' —— 那正是本判据
# 立项要拦的那一型(净面来自 git worktree,而 .env.production 被 gitignore,覆盖没做到位
# 就会产出一个"构建成功、NEXT_PUBLIC_* 全 undefined"的包,症状要到屏幕上看才看得见)。
# =============================================================================
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $here 'ihui-deploy.ps1'

# ── 只取被测函数,绝不执行脚本主体 ────────────────────────────────────────────
$tokens = $null; $parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($src, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors -and $parseErrors.Count -gt 0) {
    "FAIL  被测脚本解析不过:$($parseErrors[0].Message)"
    exit 1
}
$fn = $ast.FindAll(
    { param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Test-CleanBuildEnvInlined' },
    $true
) | Select-Object -First 1
if (-not $fn) {
    'FAIL  ihui-deploy.ps1 里找不到 Test-CleanBuildEnvInlined(判据被摘线?)'
    exit 1
}

$scratchRoot = Join-Path $env:TEMP ('ihui-clean-guard-test-' + $PID)
New-Item -ItemType Directory -Path $scratchRoot -Force | Out-Null
# 用 `&` 调 scriptblock 会在**新作用域**里定义函数 ⇒ 用例处报"不是 cmdlet"(第一版就栽在
# 这里,而报错误导成像函数名写错)。点源一个临时文件才是"定义在当前作用域"的可靠写法。
$fnFile = Join-Path $scratchRoot 'extracted-fn.ps1'
Set-Content -LiteralPath $fnFile -Value $fn.Extent.Text -Encoding ASCII
. $fnFile
if (-not (Get-Command Test-CleanBuildEnvInlined -ErrorAction SilentlyContinue)) {
    'FAIL  函数提取后没定义成功(判据形态变了?提取式需随之改)'
    exit 1
}

function Fresh([string]$name) {
    $d = Join-Path $scratchRoot $name
    if (Test-Path -LiteralPath $d) { Remove-Item -LiteralPath $d -Recurse -Force }
    New-Item -ItemType Directory -Path $d -Force | Out-Null
    return $d
}
# 产物形态按 next build 的真实布局造:.next-staging/{BUILD_ID, static/chunks/*.js}
# BUILD_ID 刻意用**无扩展名**文件,并且其中一条用例把探针值只写在它里面 —— 判据的扫描面
# 只认 *.js,若它把非 js 文件也算命中,那条用例就会假绿。
function MakeArtifact([string]$dir, [string]$jsBody, [string]$buildIdBody = 'probe-build-id') {
    $static = Join-Path $dir 'static\chunks'
    New-Item -ItemType Directory -Path $static -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $dir 'BUILD_ID') -Value $buildIdBody -Encoding ASCII
    Set-Content -LiteralPath (Join-Path $static 'main.js') -Value $jsBody -Encoding ASCII
}

$fail = 0
function Check([string]$name, [string]$got, [string]$want, [string]$detail) {
    $ok = ($got -eq $want)
    if (-not $ok) { $script:fail++ }
    ('{0}  {1,-46} got={2,-12} want={3,-12} :: {4}' -f $(if ($ok) { 'PASS' } else { 'FAIL' }), $name, $got, $want, $detail)
}

try {
    # 1) 值真的烘进了 client bundle ⇒ ok
    $a1 = Fresh 'c1'
    $env1 = Join-Path $a1 'env.production'
    Set-Content -LiteralPath $env1 -Value @(
        'NEXT_PUBLIC_GITHUB_CLIENT_ID=Iv1.abcdef0123456789',
        'JWT_SECRET=should-not-be-picked-0123456789'
    ) -Encoding ASCII
    MakeArtifact $a1 'window.x="Iv1.abcdef0123456789";'
    $r1 = Test-CleanBuildEnvInlined -ArtifactDir $a1 -EnvFile $env1
    Check '值命中 ⇒ ok' $r1[0] 'ok' $r1[1]

    # 2) env 在位而产物一个候选都没有 ⇒ absent(拒绝交换)
    $a2 = Fresh 'c2'
    $env2 = Join-Path $a2 'env.production'
    Set-Content -LiteralPath $env2 -Value 'NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAAAAAAAAAAAAAA' -Encoding ASCII
    MakeArtifact $a2 'window.x="";'
    $r2 = Test-CleanBuildEnvInlined -ArtifactDir $a2 -EnvFile $env2
    Check '候选全不命中 ⇒ absent' $r2[0] 'absent' $r2[1]

    # 3) 主目录有 env、净面没有 ⇒ absent(覆盖步骤没生效,本判据的立项理由)
    $a3 = Fresh 'c3'
    MakeArtifact $a3 'anything 0123456789abcdef'
    $r3 = Test-CleanBuildEnvInlined -ArtifactDir $a3 -EnvFile (Join-Path $a3 'missing.env') -SourceEnvExists $true
    Check '主目录有而净面缺 ⇒ absent' $r3[0] 'absent' $r3[1]

    # 4) 两侧都缺 ⇒ undetermined(既有机器状态,判红等于把部署永久冻住)
    $r4 = Test-CleanBuildEnvInlined -ArtifactDir $a3 -EnvFile (Join-Path $a3 'missing.env') -SourceEnvExists $false
    Check '两侧都缺 ⇒ undetermined' $r4[0] 'undetermined' $r4[1]

    # 5) env 里只有短值/占位值/空值,挑不出探针 ⇒ undetermined
    $a5 = Fresh 'c5'
    $env5 = Join-Path $a5 'env.production'
    Set-Content -LiteralPath $env5 -Value @('NEXT_PUBLIC_A=short', 'NEXT_PUBLIC_B=${UNCertainty}', 'NEXT_PUBLIC_C=') -Encoding ASCII
    MakeArtifact $a5 'x'
    $r5 = Test-CleanBuildEnvInlined -ArtifactDir $a5 -EnvFile $env5
    Check '无可用候选 ⇒ undetermined' $r5[0] 'undetermined' $r5[1]

    # 6) 探针值只在 BUILD_ID(非 js)里 ⇒ absent:扫描面只认 *.js,不得被非 bundle 文件糊过去
    $a6 = Fresh 'c6'
    $env6 = Join-Path $a6 'env.production'
    Set-Content -LiteralPath $env6 -Value 'NEXT_PUBLIC_FEISHU_APP_ID=cli_a9d0b1c2e3f45678' -Encoding ASCII
    MakeArtifact $a6 'window.x="";' 'cli_a9d0b1c2e3f45678'
    $r6 = Test-CleanBuildEnvInlined -ArtifactDir $a6 -EnvFile $env6
    Check '只在非 js 文件里 ⇒ absent' $r6[0] 'absent' $r6[1]

    # 7) 产物目录整个没有 js(扫不动)⇒ undetermined,不是 absent 也不是 ok
    $a7 = Fresh 'c7'
    $env7 = Join-Path $a7 'env.production'
    Set-Content -LiteralPath $env7 -Value 'NEXT_PUBLIC_WECHAT_APP_ID=wx0123456789abcdef' -Encoding ASCII
    $r7 = Test-CleanBuildEnvInlined -ArtifactDir $a7 -EnvFile $env7
    Check '扫不到 js ⇒ undetermined' $r7[0] 'undetermined' $r7[1]
} finally {
    try {
        if (Test-Path -LiteralPath $scratchRoot) { Remove-Item -LiteralPath $scratchRoot -Recurse -Force -ErrorAction Stop }
    } catch {
        "NOTE  临时目录没删干净(被占用):$scratchRoot"
    }
}

if ($fail -gt 0) { "RESULT PARTIAL_FAIL($fail 条不符)"; exit 1 }
'RESULT ALL_PASS'
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
