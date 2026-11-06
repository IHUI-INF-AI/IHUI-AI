# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 夹具:ihui-firewall-hardening.ps1 的 RDP 迁移/重启段。
# 不 dot-source 整脚本:真跑会改注册表、删建防火墙规则并重启 TermService(会踢断 RDP)。
# 沿用 build-cooldown-head-harness.ps1 的 AST 抽取法 —— 用例跑的是**真脚本原文**,
# 再在受控桩里注入注册表/服务/netsh 的返回值。
#
# -Mode normal:当前实现,重启失败必须报 Ok=$false。
# -Mode mutant:把 Restart-Service 的 -ErrorAction Stop 退回 -ErrorAction SilentlyContinue,
#              用于证明夹具能抓到旧行为(否则夹具是瞎的)。

param(
  [ValidateSet('normal', 'mutant')]
  [string]$Mode = 'normal'
)

$ErrorActionPreference = 'Stop'
# 输出固定 UTF-8:否则 pwsh 在中文 Windows 上按 GBK 写出,Node 侧按 UTF-8 读会乱码,
# 让"点名 TermService"这类中文断言假红。
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$scriptPath = Join-Path $PSScriptRoot '..\win\ihui-firewall-hardening.ps1'
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $scriptPath), [ref]$null, [ref]$null)
$fn = $ast.Find({
    param($n)
    $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Invoke-RdpPortMigration'
  }, $true)
if (-not $fn) { throw '夹具失效:ihui-firewall-hardening.ps1 里找不到 Invoke-RdpPortMigration' }

$core = $fn.Extent.Text
if ($Mode -eq 'mutant') {
  $mutated = $core -replace '(Restart-Service -Name TermService -Force )-ErrorAction Stop', '$1-ErrorAction SilentlyContinue'
  if ($mutated -eq $core) { throw '变异未生效:没找到 Restart-Service ... -ErrorAction Stop' }
  $core = $mutated
}

# ---- 受控桩 ------------------------------------------------------------------
$script:Port = 3389
$script:RuleApplied = $false
$script:RestartFails = $false
$script:RestartCalls = 0
$script:SetPortCalls = 0
$script:NetshCalls = 0

function Get-ItemProperty {
  [CmdletBinding()]
  param([string]$Path, [string]$Name)
  [pscustomobject]@{ PortNumber = $script:Port }
}
function Set-ItemProperty {
  [CmdletBinding()]
  param([string]$Path, [string]$Name, $Value, [string]$Type, [switch]$Force)
  $script:SetPortCalls++
  $script:Port = [int]$Value
}
function Test-FwRuleApplied {
  [CmdletBinding()]
  param([string]$Name, [string]$Action, [string]$LocalPorts, [string]$RemoteCidrs)
  return $script:RuleApplied
}
function Restart-Service {
  [CmdletBinding()]
  param([string]$Name, [switch]$Force)
  $script:RestartCalls++
  if ($script:RestartFails) {
    Write-Error 'stub: TermService restart failed (Access denied)'
  }
}
function Get-Service {
  [CmdletBinding()]
  param([string]$Name)
  [pscustomobject]@{ Status = 'Running' }
}
function netsh {
  [CmdletBinding()]
  param([Parameter(ValueFromRemainingArguments = $true)] $Rest)
  $script:NetshCalls++
}

. ([scriptblock]::Create($core))

function Invoke-Case {
  param(
    [string]$Name,
    [int]$Port,
    [bool]$RuleApplied,
    [bool]$RestartFails
  )
  $script:Port = $Port
  $script:RuleApplied = $RuleApplied
  $script:RestartFails = $RestartFails
  $script:RestartCalls = 0
  $script:SetPortCalls = 0

  $r = Invoke-RdpPortMigration
  [pscustomobject]@{
    mode            = $Mode
    case            = $Name
    ok              = [bool]$r.Ok
    changed         = [bool]$r.Changed
    restart         = [string]$r.Restart
    error           = [string]$r.Error
    restartCalls    = $script:RestartCalls
    setPortCalls    = $script:SetPortCalls
  }
}

@(
  (Invoke-Case -Name 'restart-fails' -Port 3389 -RuleApplied $false -RestartFails $true)
  (Invoke-Case -Name 'restart-ok' -Port 3389 -RuleApplied $false -RestartFails $false)
  (Invoke-Case -Name 'already-migrated' -Port 53389 -RuleApplied $true -RestartFails $true)
) | ForEach-Object { $_ | ConvertTo-Json -Compress }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
