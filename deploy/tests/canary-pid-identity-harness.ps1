# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 夹具:ihui-canary-gray.ps1 的 Get-GrayPid 身份判据。
# 不 dot-source 整脚本:文件末尾会按 -Action 真起停 next 进程。改用 AST 抽取真函数原文。
# -Mode mutant:删掉启动时刻比对行,复现"只看 pid 存在"的旧行为,证明夹具抓得到。

param(
  [ValidateSet('normal', 'mutant')]
  [string]$Mode = 'normal'
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$scriptPath = Join-Path $PSScriptRoot '..\win\ihui-canary-gray.ps1'
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $scriptPath), [ref]$null, [ref]$null)
$fn = $ast.Find({
    param($n)
    $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Get-GrayPid'
  }, $true)
if (-not $fn) { throw '夹具失效:ihui-canary-gray.ps1 里找不到 Get-GrayPid' }

$core = $fn.Extent.Text
if ($Mode -eq 'mutant') {
  $mutated = $core -replace 'if \(\$startedAt -gt \$writtenAt\.AddSeconds\(2\)\) \{ return 0 \}[\s\S]*?return \$pidValue', 'return $pidValue'
  if ($mutated -eq $core) { throw '变异未生效:没找到启动时刻比对行' }
  $core = $mutated
}

# ---- 受控桩 ------------------------------------------------------------------
$script:ProcMode = 'legit'
$script:PidFile = $null

function Get-Process {
  [CmdletBinding()]
  param([int]$Id)
  if ($script:ProcMode -eq 'absent') { return $null }
  $start = if ($script:ProcMode -eq 'reuse') {
    (Get-Item -LiteralPath $script:PidFile).LastWriteTime.AddSeconds(10)
  } else {
    (Get-Item -LiteralPath $script:PidFile).LastWriteTime.AddSeconds(-5)
  }
  [pscustomobject]@{ Id = $Id; StartTime = $start }
}

. ([scriptblock]::Create($core))

function Invoke-Case {
  param([string]$Name, [string]$ProcMode, [string]$Content = '4242')

  $tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("ihui-canary-pid-" + [guid]::NewGuid() + '.pid')
  try {
    if ($Content -ne $null) { Set-Content -LiteralPath $tmp -Value $Content -NoNewline -Encoding ASCII }
    $script:PidFile = $tmp
    $script:ProcMode = $ProcMode
    [pscustomobject]@{
      mode   = $Mode
      case   = $Name
      result = [int](Get-GrayPid -Path $tmp)
    }
  } finally {
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
  }
}

@(
  (Invoke-Case -Name 'pid-reused' -ProcMode 'reuse')
  (Invoke-Case -Name 'our-process' -ProcMode 'legit')
  (Invoke-Case -Name 'process-absent' -ProcMode 'absent')
  (Invoke-Case -Name 'pid-file-missing' -ProcMode 'legit' -Content $null)
  (Invoke-Case -Name 'pid-file-malformed' -ProcMode 'legit' -Content 'not-a-pid')
) | ForEach-Object { $_ | ConvertTo-Json -Compress }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
