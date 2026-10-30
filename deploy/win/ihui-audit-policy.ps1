# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# IHUI 主机审计基线 —— 4688 进程创建 + 命令行 + PowerShell 脚本块日志
#
# 为什么需要它(2026-10-30 实测):
#   auditpol 现读:登录/账户锁定/系统完整性都已是「成功和失败」,唯独**详细追踪 →
#   进程创建 = 无审核**。这一格是主机侧唯一能回答"谁在什么时候跑了什么命令"的取证面:
#   没有它,一次入侵之后能查的只剩"服务起没起",连攻击者落过哪个可执行文件都复原不出来
#   (4688 + ProcessCreationIncludeCmdLine 才带命令行参数;只开 4688 不带参数等于只有文件名)。
#   同理 PowerShell 脚本块日志(ScriptBlockLogging)是把"内存里跑过的脚本正文"落盘的唯一
#   系统级手段 —— 本机大量自动化走脚本,不开这一格,脚本层面的痕迹一律为零。
#
# 设计口径:
#   · 幂等:每一项先读现值,已达标就不动(可反复重放,与防火墙加固脚本同风格);
#   · 可回滚:每一项的关闭命令写在收尾注释里,一条条可逆;
#   · 默认只读校验;加 -Apply 才落盘 —— 与其它部署脚本一致,不让人"跑一下看看"就改了机器;
#   · Security 日志上限同时抬到 512MB:4688 是高频事件源,20MB(系统默认)在开发机上几小时
#     就能滚掉,取证窗口反而比不开更糟(以为有日志,其实只剩最近半小时)。
#
# 用法:
#   .\ihui-audit-policy.ps1            # 只校验,打印每项现状与差距
#   .\ihui-audit-policy.ps1 -Apply     # 落盘
#
# 回滚(逐项独立):
#   auditpol /set /subcategory:"进程创建" /success:disable /failure:disable
#   Remove-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System\Audit' -Name ProcessCreationIncludeCmdLine_Enabled
#   Remove-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ScriptBlockLogging' -Name EnableScriptBlockLogging
#   wevtutil sl Security /ms:20971520

[CmdletBinding()]
param(
  [switch]$Apply,
  [int]$SecurityLogMaxMB = 512
)

$ErrorActionPreference = 'Stop'

$AUDIT_KEY       = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System\Audit'
$SBL_KEY         = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\PowerShell\ScriptBlockLogging'
$PROCESS_SUBCAT  = '进程创建'

function Get-ProcessAuditSetting {
  # 输出形如「成功和失败 / 成功 / 无审核」;取不到返回 $null(不猜)
  $raw = & auditpol /get /subcategory:"$PROCESS_SUBCAT" 2>&1 | Out-String
  $line = ($raw -split "`r?`n" | Where-Object { $_ -match '进程创建' }) | Select-Object -Last 1
  if (-not $line) { return $null }
  $v = ($line -replace '^.*进程创建\s*', '').Trim()
  if ([string]::IsNullOrWhiteSpace($v)) { return $null }
  return $v
}

function Set-RegDword([string]$Path, [string]$Name, [int]$Value) {
  if (-not (Test-Path $Path)) { New-Item -Path $Path -Force | Out-Null }
  New-ItemProperty -Path $Path -Name $Name -PropertyType DWord -Value $Value -Force | Out-Null
}

function Get-RegDword([string]$Path, [string]$Name) {
  if (-not (Test-Path $Path)) { return $null }
  $p = Get-ItemProperty -Path $Path -Name $Name -ErrorAction SilentlyContinue
  if ($null -eq $p) { return $null }
  return [int]$p.$Name
}

function Get-SecurityLogMaxMB {
  $s = & wevtutil gl Security 2>&1 | Out-String
  $m = [regex]::Match($s, 'maxSize:\s*(\d+)')
  if (-not $m.Success) { return $null }
  return [math]::Round([int64]$m.Groups[1].Value / 1MB)
}

$before = [ordered]@{
  '进程创建审核'                 = Get-ProcessAuditSetting
  'ProcessCreationIncludeCmdLine' = Get-RegDword $AUDIT_KEY 'ProcessCreationIncludeCmdLine_Enabled'
  'ScriptBlockLogging'           = Get-RegDword $SBL_KEY 'EnableScriptBlockLogging'
  'Security日志上限MB'            = Get-SecurityLogMaxMB
}

Write-Output '== IHUI-AI host audit baseline =='
foreach ($k in $before.Keys) { Write-Output ("  现状 {0,-32} = {1}" -f $k, $before[$k]) }

if (-not $Apply) {
  Write-Output '  (只校验模式;加 -Apply 落盘)'
  return
}

# 1) 进程创建审核:成功 + 失败(失败那侧能看见"被拒绝的执行",是横向移动的强信号)
if ($before['进程创建审核'] -ne '成功和失败') {
  & auditpol /set /subcategory:"$PROCESS_SUBCAT" /success:enable /failure:enable | Out-Null
  Write-Output '  [改] 进程创建审核 → 成功和失败'
}

# 2) 4688 带命令行参数 —— 不带它只有 exe 名,没有参数(等于拿不到攻击者真正执行的命令)
if ($before['ProcessCreationIncludeCmdLine'] -ne 1) {
  Set-RegDword $AUDIT_KEY 'ProcessCreationIncludeCmdLine_Enabled' 1
  Write-Output '  [改] ProcessCreationIncludeCmdLine → 1'
}

# 3) PowerShell 脚本块日志
if ($before['ScriptBlockLogging'] -ne 1) {
  Set-RegDword $SBL_KEY 'EnableScriptBlockLogging' 1
  Write-Output '  [改] ScriptBlockLogging → 1'
}

# 4) Security 日志上限(4688 高频,20MB 会被滚掉)
$curMax = Get-SecurityLogMaxMB
if ($null -eq $curMax -or $curMax -lt $SecurityLogMaxMB) {
  # 参数必须先算成标量再拼成单个字符串:直接写 /ms:($SecurityLogMaxMB * 1MB) 会被
  # 拆成两个实参,wevtutil 报「指定的参数太多」而静默不改(2026-10-30 实踩)。
  $maxBytes = [string]([int64]$SecurityLogMaxMB * 1MB)
  & wevtutil sl Security "/ms:$maxBytes" | Out-Null
  Write-Output "  [改] Security 日志上限 → ${SecurityLogMaxMB}MB"
}

# 回读自证:改完必须读回一致,不然"改了"只是打印
$after = [ordered]@{
  '进程创建审核'                 = Get-ProcessAuditSetting
  'ProcessCreationIncludeCmdLine' = Get-RegDword $AUDIT_KEY 'ProcessCreationIncludeCmdLine_Enabled'
  'ScriptBlockLogging'           = Get-RegDword $SBL_KEY 'EnableScriptBlockLogging'
  'Security日志上限MB'            = Get-SecurityLogMaxMB
}
Write-Output '  -- 回读 --'
foreach ($k in $after.Keys) { Write-Output ("  现值 {0,-32} = {1}" -f $k, $after[$k]) }

$bad = @()
if ($after['进程创建审核'] -ne '成功和失败') { $bad += '进程创建审核' }
if ($after['ProcessCreationIncludeCmdLine'] -ne 1) { $bad += 'ProcessCreationIncludeCmdLine' }
if ($after['ScriptBlockLogging'] -ne 1) { $bad += 'ScriptBlockLogging' }
if ($null -eq $after['Security日志上限MB'] -or $after['Security日志上限MB'] -lt $SecurityLogMaxMB) { $bad += 'Security日志上限' }

if ($bad.Count -gt 0) {
  # 不写 exit:本脚本要被看门狗**点源**复用(见 deploy/win/ihui-firewall-watchdog.ps1),
  # 点源里的 exit 会直接终止宿主进程 —— 那是"加固脚本把看门狗杀掉"的自伤形态。
  # throw 在独立运行时同样是退出码 1,在被点源时只是让调用方的 try/catch 接住。
  throw "回读不一致:$($bad -join ', ')"
}
Write-Output '  ✅ 四项均已达标(回读自证)'
return
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
