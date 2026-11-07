# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 夹具:ihui-deploy.ps1 的 Set-BuildMarker / Set-BuildCooldown 写失败方向。
# 不 dot-source 整脚本:ihui-deploy.ps1 一加载就抢部署锁、跑构建/切流/起服务。
# 沿用 build-cooldown-head-harness.ps1 的 AST 抽取法,只取三个函数原文 + 受控桩。
# -Mode mutant:把两处 -ErrorAction Stop 退回 SilentlyContinue,复现"写失败被吞"的旧行为。

param(
  [ValidateSet('normal', 'mutant')]
  [string]$Mode = 'normal'
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$scriptPath = Join-Path $PSScriptRoot '..\win\ihui-deploy.ps1'
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $scriptPath), [ref]$null, [ref]$null)

$names = @('Get-WebActiveBuildDir', 'Set-BuildMarker', 'Set-BuildCooldown')
$parts = foreach ($n in $names) {
  $fn = $ast.Find({
      param($node)
      $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $n
    }, $true)
  if (-not $fn) { throw "夹具失效:ihui-deploy.ps1 里找不到 $n" }
  $fn.Extent.Text
}
$core = $parts -join "`r`n"

if ($Mode -eq 'mutant') {
  $mutated = $core -replace '-ErrorAction Stop', '-ErrorAction SilentlyContinue'
  if ($mutated -eq $core) { throw '变异未生效:没找到 -ErrorAction Stop' }
  $core = $mutated
}

# ---- 受控桩 ------------------------------------------------------------------
$script:Root = Join-Path ([System.IO.Path]::GetTempPath()) ("ihui-build-marker-" + [guid]::NewGuid())
$script:WebDir = Join-Path $script:Root 'apps\web'
$script:BuildCooldownFile = Join-Path $script:Root 'deploy\win\.build-fail-state.json'
$script:FailWrites = $false
$sha = '0123456789abcdef0123456789abcdef01234567'

New-Item -ItemType Directory -Path (Join-Path $script:WebDir '.next') -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path $script:BuildCooldownFile) -Force | Out-Null

function git {
  [CmdletBinding()]
  param([string]$C, [Parameter(ValueFromRemainingArguments = $true)] $Rest)
  return $sha
}
function Set-Content {
  [CmdletBinding()]
  param([string]$Path, $Value, [switch]$NoNewline)
  if ($script:FailWrites) {
    Write-Error 'stub: 目标盘只读/无权限'
    return
  }
  Microsoft.PowerShell.Management\Set-Content -Path $Path -Value $Value -NoNewline:$NoNewline
}

. ([scriptblock]::Create($core))

function Invoke-Case {
  param([string]$Name, [bool]$FailWrites)
  $script:FailWrites = $FailWrites
  $threw = $false
  $err = ''
  $marker = Join-Path $script:WebDir '.next\IHUI_BUILD_SHA'
  Remove-Item -LiteralPath $marker -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $script:BuildCooldownFile -Force -ErrorAction SilentlyContinue

  try {
    if ($Name -like 'marker-*') { Set-BuildMarker } else { Set-BuildCooldown }
  } catch {
    $threw = $true
    $err = $_.Exception.Message
  }

  $payload = ''
  if ($Name -like 'marker-*') {
    if (Test-Path -LiteralPath $marker) { $payload = (Get-Content -LiteralPath $marker -Raw) }
  } else {
    if (Test-Path -LiteralPath $script:BuildCooldownFile) { $payload = (Get-Content -LiteralPath $script:BuildCooldownFile -Raw) }
  }

  [pscustomobject]@{
    mode        = $Mode
    case        = $Name
    threw       = $threw
    error       = $err
    wroteTarget = ($payload -ne '')
    payload     = $payload
    sha         = $sha
  }
}

try {
  @(
    (Invoke-Case -Name 'marker-ok' -FailWrites $false)
    (Invoke-Case -Name 'marker-write-fails' -FailWrites $true)
    (Invoke-Case -Name 'cooldown-ok' -FailWrites $false)
    (Invoke-Case -Name 'cooldown-write-fails' -FailWrites $true)
  ) | ForEach-Object { $_ | ConvertTo-Json -Compress }
} finally {
  Remove-Item -LiteralPath $script:Root -Recurse -Force -ErrorAction SilentlyContinue
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
