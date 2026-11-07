# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
# =============================================================================
# 行为验证(2026-11-07):ihui-deploy-loop.ps1 的回滚退避必须
#   ① 状态落盘(进程重启后不归零) ② 有界(连续 N 次后 halted 亮红,不再部署)
#   ③ 按原因指纹点名(同一病因同槽、新病因新槽,告警不被旧窗压住)
#
# 夹具形态:不 dot-source 整脚本(会真跑部署/真起子进程),用 AST 抽取七个函数原文,
# 在受控 $Root/$env 与临时状态文件里真执行。生产状态文件一律不碰。
#
# 跑法(由 node --test 驱动):
#   pwsh -File deploy-rollback-backoff-harness.ps1 -Phase first  -Scratch <dir> [-Mode normal|mutant-gate|mutant-persist]
#   pwsh -File deploy-rollback-backoff-harness.ps1 -Phase read   -Scratch <同 dir>
#   pwsh -File deploy-rollback-backoff-harness.ps1 -Phase reset  -Scratch <同 dir>
# 每行输出 {"case":"x","result":...},消费方只认 JSON 行。
# =============================================================================
param(
    [string]$LoopPath = (Join-Path $PSScriptRoot '..\win\ihui-deploy-loop.ps1'),
    [Parameter(Mandatory = $true)][string]$Scratch,
    [Parameter(Mandatory = $true)][ValidateSet('first', 'read', 'reset')][string]$Phase,
    [ValidateSet('normal', 'mutant-gate', 'mutant-persist')][string]$Mode = 'normal'
)
$ErrorActionPreference = 'Stop'
# 本机 PS7 默认 stdout 是 GBK:不钉住输出编码,中文断言在 Node 侧会读到乱码
# (与 deploy\win\ihui-deploy-loop.ps1 顶部同一条理由)。
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Get-FunctionText([string]$Path, [string[]]$Names) {
    $abs = (Resolve-Path -LiteralPath $Path).Path
    $toks = $null; $errs = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseFile($abs, [ref]$toks, [ref]$errs)
    if ($errs.Count) { throw "解析 $abs 失败:$($errs[0].Message)" }
    $parts = foreach ($n in $Names) {
        $fd = @($ast.FindAll({ param($x) $x -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $x.Name -eq $n }, $true))
        if ($fd.Count -lt 1) { throw "未在 $abs 找到函数 $n —— 改名/删除会让本夹具失明(取不到即失败,不静默跳过)" }
        $fd[0].Extent.Text
    }
    ($parts -join "`n")
}

function Emit([string]$Case, $Result) {
    Write-Output (ConvertTo-Json -Compress -Depth 5 -InputObject ([ordered]@{ case = $Case; result = $Result }))
}

$names = @('Get-RollbackStatePath', 'Get-RollbackState', 'Save-RollbackState', 'Get-RollbackFingerprint', 'Register-RollbackEvent', 'Reset-RollbackState', 'Test-RollbackGate')
$core = Get-FunctionText $LoopPath $names
switch ($Mode) {
    'mutant-gate' { $core = $core.Replace('if ([bool]$s.halted) {', 'if ($false) {') }
    'mutant-persist' { $core = $core.Replace('Move-Item -LiteralPath $tmp -Destination $p -Force', '$null = $tmp') }
}

$Root = (Resolve-Path -LiteralPath $Scratch).Path
$script:LogLines = [System.Collections.Generic.List[string]]::new()
function Log { param([string]$m) $script:LogLines.Add([string]$m) }
$env:IHUI_DEPLOY_ROLLBACK_MAX = '3'
$env:IHUI_DEPLOY_ROLLBACK_BASE_MIN = '30'
$env:IHUI_DEPLOY_ROLLBACK_CAP_MIN = '120'
Invoke-Expression $core

function Get-LogSince([int]$From) {
    if ($script:LogLines.Count -eq 0) { return '' }
    $script:LogLines[$From..($script:LogLines.Count - 1)] -join ' | '
}
function Get-StateRow {
    param($State)
    [ordered]@{ consecutive = [int]$State.consecutive; halted = [bool]$State.halted; fingerprint = [string]$State.lastFingerprint; nextEligibleAt = [string]$State.nextEligibleAt }
}

switch ($Phase) {
    'first' {
        Emit 'initial-gate' (Test-RollbackGate)
        $n0 = $script:LogLines.Count
        Register-RollbackEvent -Reason '错误率 5.2% 超阈值(候选 730 次采样)'
        $n1 = $script:LogLines.Count
        Emit 'after-1' (Get-StateRow (Get-RollbackState))
        Emit 'log-1' (Get-LogSince $n0)
        Register-RollbackEvent -Reason '延迟 p95 2.1s 超阈值(候选 730 次采样)'
        $n2 = $script:LogLines.Count
        Emit 'after-2' (Get-StateRow (Get-RollbackState))
        Emit 'log-2' (Get-LogSince $n1)
        Emit 'gate-after-2' (Test-RollbackGate)
        Register-RollbackEvent -Reason '5xx 0.9% 超阈值(候选 731 次采样)'
        Emit 'after-3' (Get-StateRow (Get-RollbackState))
        Emit 'log-3' (Get-LogSince $n2)
        Emit 'gate-after-3' (Test-RollbackGate)
    }
    'read' {
        $s = Get-RollbackState
        Emit 'restart-state' (Get-StateRow $s)
        Emit 'restart-gate' (Test-RollbackGate)
    }
    'reset' {
        Reset-RollbackState 'harness 人工恢复'
        Emit 'reset-state' (Get-StateRow (Get-RollbackState))
        Emit 'reset-gate' (Test-RollbackGate)
    }
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
