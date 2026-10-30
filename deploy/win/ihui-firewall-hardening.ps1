# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#Requires -RunAsAdministrator
# =============================================================================
# IHUI-AI 源站深度防护脚本 (Windows host hardening)
# 版权: 2026 IHUI AI (智汇AI) - 李春川 - https://aizhs.top
#
# 设计原则:
#   1. 幂等 —— 可反复执行、可挂计划任务每 6 小时重放(软件安装/Windows Update
#      会重新写入宽松的入站放行规则,只有常态化重放才压得住)。
#   2. 不破坏可用性 —— EdgeOne 回源走「家宽公网 IP:8801」直连(生产登录链路),
#      8801 必须显式放行且不限 RemoteIP;其余业务/中间件端口仅本机与 LAN 可达。
#      历史教训(2026-10-28):首版曾以"实测零外部流量"为由封掉 8801,直接把
#      www.aizhs.top 打成 522、App 无法登录 —— 零流量是 EO 未预热时的假象。
#   3. 默认保守 —— 不触碰 22 / 3389,不删软件规则;需要更严 policy 请显式给开关。
#
# 用法:
#   .\ihui-firewall-hardening.ps1                      # 基线加固(推荐日常/定时)
#   .\ihui-firewall-hardening.ps1 -BlockRemoteAdmin    # 追加:公网封锁 SSH/RDP
#   .\ihui-firewall-hardening.ps1 -PruneAppRules       # 追加:清理"全端口 ANY"软件规则
#   .\ihui-firewall-hardening.ps1 -Verify              # 只体检不出东西
# =============================================================================
[CmdletBinding()]
param(
  # 公网封锁 SSH(22) / RDP(3389)。确认不需要从外网远程管理后才启用。
  [switch]$BlockRemoteAdmin,
  # 清理"本地端口=任何 且 远程IP=任何"的入站放行规则(adb / 向日葵 / 网易UU /
  # node.exe / python.exe ...)。这些规则让任意新监听端口自动对公网开放。
  [switch]$PruneAppRules,
  # 只体检,不改任何东西
  [switch]$Verify
)

$ErrorActionPreference = 'Stop'

# --- 允许保留不被 Block 的网段(LAN + loopback) --------------------------------
$LAN_ALLOW = @('192.168.1.0/24', '127.0.0.0/8')

# IPv4 全集减去上面的网段。Windows 防火墙 remoteip 不支持"排除",只能用 CIDR 补集
# 表达。下面这份清单已用 Python ipaddress.address_exclude 生成并逐项校验:
#   条数 30,覆盖除 192.168.1.0/24、127.0.0.0/8 外的全部 IPv4 单播/组播/保留空间
# 若 LAN 网段变更,用以下命令重生成后替换(再跑一次 -Verify 对比条数):
#   python -c "import ipaddress;r=[ipaddress.ip_network('0.0.0.0/0')];
#   [r:=None]"  # 见报告附录 A.1 的生成脚本
$WAN_CIDRS = @(
  '0.0.0.0/2','64.0.0.0/3','96.0.0.0/4','112.0.0.0/5','120.0.0.0/6','124.0.0.0/7',
  '126.0.0.0/8','128.0.0.0/2','192.0.0.0/9','192.128.0.0/11','192.160.0.0/13',
  '192.168.0.0/24','192.168.2.0/23','192.168.4.0/22','192.168.8.0/21',
  '192.168.16.0/20','192.168.32.0/19','192.168.64.0/18','192.168.128.0/17',
  '192.169.0.0/16','192.170.0.0/15','192.172.0.0/14','192.176.0.0/12',
  '192.192.0.0/10','193.0.0.0/8','194.0.0.0/7','196.0.0.0/6','200.0.0.0/5',
  '208.0.0.0/4','224.0.0.0/3'
)

function Get-WanCidrExcludingLan {
  # 合法性自检:WAN 封锁集与 LAN 白名单(内网 192.168.1.0/24 + 回环 127.0.0.0/8)
  # 若有任何重叠即抛错中止 —— 宁可整轮不跑,也不能误封本机反代/CF 隧道所依赖的回环。
  $overlap = @($WAN_CIDRS | Where-Object { $_ -in $LAN_ALLOW })
  if ($overlap.Count -gt 0) {
    throw ("WAN block set overlaps LAN allow list ({0}); refusing to apply." -f ($overlap -join ','))
  }
  ($WAN_CIDRS -join ',')
}

$WAN = Get-WanCidrExcludingLan

# -----------------------------------------------------------------------------
# 0. verify-first:规则「已达标即跳过」
#
# 立因(2026-10-30 实测):本脚本原先对每条规则无条件 `delete rule` + `add rule`,
# **不是**「已达标就跳过」。本机 netsh 单调用 10~60s,一次完整重放(防火墙腿)实测
# 11~13 分钟 —— 期间每条 DENY 都有一段「拆了还没建」的空窗,单条规则在该窗口内不存在。
# 于是「缩短重放间隔 = 缩小篡改暴露窗」这个直觉是反的:间隔越短,空窗越多
# (2026-10-30 已因此把看门狗间隔从 1h 收回 6h)。根修就是本段:先读,达标即跳过。
#
# 为什么读注册表而不是 Get-NetFirewallRule:本机 NetSecurity 模块被安全策略禁用,
# `Get-NetFirewallRule` 直接报 "not recognized";netsh 输出是本地化文本(中文宿主 vs
# 英文宿主字段名不同),按文本匹配必然漂移。注册表
#   HKLM\...\FirewallPolicy\FirewallRules
# 是语言中立的单一真相源,且 §5 的 -PruneAppRules 已经在用它。
#
# 真实编码(2026-10-30 实测,不是推测):
#   v2.33|Action=Block|Active=TRUE|Dir=In|Protocol=6|LPort=8802|LPort=8803|...|RA4=0.0.0.0/192.0.0.0|...
#   —— 端口每枚一个 LPort 字段;远端每枚一个 RA4 字段,且**写成「网络地址/点分掩码」**
#      (`0.0.0.0/2` 存成 `0.0.0.0/192.0.0.0`),不是 CIDR 前缀长度 ⇒ 必须换算后比。
#
# 失效方向:任何一项读不到 / 对不上 / 同名多条 ⇒ $false(**重建**)。宁可多拆一次,
# 不可少建一次 —— verify-first 只能在"确实已达标"时省,不能在"拿不准"时省。
# -----------------------------------------------------------------------------
$FW_RULES_REG = 'HKLM:\SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\FirewallRules'
$MASK_OCTET = @{ 0 = 0; 1 = 128; 2 = 192; 3 = 224; 4 = 240; 5 = 248; 6 = 252; 7 = 254; 8 = 255 }

function ConvertTo-MaskDotted {
  # 前缀长度 → 点分掩码。查表实现,不用 -shl(Windows PowerShell 5.1 无位移运算符,
  # 而本脚本可能被 powershell.exe 或 pwsh 点源)。
  param([int]$Bits)
  $octs = New-Object System.Collections.ArrayList
  for ($i = 0; $i -lt 4; $i++) {
    $take = $Bits - $i * 8
    if ($take -lt 0) { $take = 0 }
    if ($take -gt 8) { $take = 8 }
    [void]$octs.Add($MASK_OCTET[$take])
  }
  return ($octs -join '.')
}

function ConvertTo-FwAddrToken {
  # CIDR(`a.b.c.d/N`) → 注册表写法(`网络地址/点分掩码`)。入参已是规范网络地址。
  param([string]$Cidr)
  $parts = $Cidr.Split('/')
  if ($parts.Count -ne 2) { return $Cidr }
  $bits = 0
  if (-not [int]::TryParse($parts[1], [ref]$bits)) { return $Cidr }
  return ('{0}/{1}' -f $parts[0], (ConvertTo-MaskDotted -Bits $bits))
}

function Get-FwRuleValuesByName {
  # 一次读完 936 条规则再内存分拣;每条规则各调一次 netsh 才是重放慢的全部原因。
  param([Parameter(Mandatory)][string]$Name)
  $out = New-Object System.Collections.ArrayList
  $k = Get-ItemProperty -Path $FW_RULES_REG -ErrorAction SilentlyContinue
  if ($null -eq $k) { return $out }
  foreach ($p in $k.PSObject.Properties) {
    if ($p.Name -match '^PS') { continue }
    $v = [string]$p.Value
    $m = [regex]::Match($v, '(?:\||^)Name=([^|]*)')
    if ($m.Success -and $m.Groups[1].Value -eq $Name) { [void]$out.Add($v) }
  }
  return $out
}

function Test-FwRuleApplied {
  # 已达标 ⇒ $true。任一维度不匹配 ⇒ $false(调用方随即重建)。
  param(
    [Parameter(Mandatory)][string]$Name,
    [Parameter(Mandatory)][string]$Action,      # 'Allow' / 'Block'
    [string]$LocalPorts = '',                   # '8801' / '135,137,...' (逗号分隔,集合比较)
    [string]$RemoteCidrs = '',                  # '0.0.0.0/2,...'  (CIDR,集合比较)
    [switch]$RequireAnyRemote                   # 要求规则不限远端(无 RA4 或 RA4=*)
  )
  $vals = @(Get-FwRuleValuesByName -Name $Name)
  # 同名多条 = 历史残留(旧版脚本反复建过);交给重建去收敛,这里绝不算达标
  if ($vals.Count -ne 1) { return $false }
  $map = @{}
  foreach ($f in ([string]$vals[0]).Split('|')) {
    $eq = $f.IndexOf('=')
    if ($eq -lt 1) { continue }
    $kn = $f.Substring(0, $eq)
    if ($kn -notin @('Action', 'Active', 'Dir', 'Protocol', 'LPort', 'RA4')) { continue }
    if (-not $map.ContainsKey($kn)) { $map[$kn] = New-Object System.Collections.ArrayList }
    [void]$map[$kn].Add($f.Substring($eq + 1))
  }
  $joined = { param($key) if ($map.ContainsKey($key)) { (@($map[$key]) -join ',') } else { '' } }
  if ((& $joined 'Action')   -ne $Action) { return $false }
  if ((& $joined 'Active')   -ne 'TRUE')  { return $false }
  if ((& $joined 'Dir')      -ne 'In')    { return $false }
  if ((& $joined 'Protocol') -ne '6')     { return $false }
  if ($LocalPorts) {
    $want = @($LocalPorts.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Sort-Object)
    $cur = @($map['LPort'] | ForEach-Object { "$_".Trim() } | Sort-Object)
    if (($cur -join ',') -ne ($want -join ',')) { return $false }
  }
  if ($RequireAnyRemote) {
    $ra = @($map['RA4'] | ForEach-Object { "$_".Trim() } | Where-Object { $_ -and $_ -ne '*' })
    if ($ra.Count -gt 0) { return $false }
  }
  if ($RemoteCidrs) {
    $want = @($RemoteCidrs.Split(',') | ForEach-Object { ConvertTo-FwAddrToken $_.Trim() } |
      Where-Object { $_ } | Sort-Object)
    $cur = @($map['RA4'] | ForEach-Object { "$_".Trim() } | Sort-Object)
    if (($cur -join ',') -ne ($want -join ',')) { return $false }
  }
  return $true
}

Write-Host "== IHUI-AI host hardening ==" -ForegroundColor Cyan
Write-Host ("LAN preserved : " + ($LAN_ALLOW -join ', '))
Write-Host ("WAN block set : {0} CIDR ranges" -f (($WAN -split ',').Count))

# -----------------------------------------------------------------------------
# 1. 防火墙三个 profile 全部启用 + 丢弃包日志(默认存量 pkt enough 取证)
# -----------------------------------------------------------------------------
foreach ($prof in 'domainprofile', 'privateprofile', 'publicprofile') {
  if (-not $Verify) {
    netsh advfirewall set $prof state on | Out-Null
    netsh advfirewall set $prof logging droppedconnections enable | Out-Null
    netsh advfirewall set $prof logging maxfilesize 32767 | Out-Null
  }
}
Write-Host "[1/5] firewall profiles enabled + drop logging on" -ForegroundColor Green

# -----------------------------------------------------------------------------
# 2. 源站公网入口(EdgeOne 直连回源)显式放行
#    www.aizhs.top 的 EO 源站 = 「家宽公网 IP + 8801」;回源来源是 EdgeOne 边缘
#    节点(公网 IP 且不断变化),所以这条放行**不能**限定 RemoteIP。
#    注意:prune(-PruneAppRules)会禁用"全端口 ANY"的软件规则,所以这条按端口
#    精确放行的规则必须由本脚本自己幂等重建。
# -----------------------------------------------------------------------------
if (-not $Verify) {
  if (Test-FwRuleApplied -Name 'IHUI-ALLOW-WWW-8801' -Action Allow -LocalPorts '8801' -RequireAnyRemote) {
    Write-Host "[2/5] EdgeOne origin ingress 8801 already applied, skipped" -ForegroundColor DarkGray
  } else {
    netsh advfirewall firewall delete rule name='IHUI-ALLOW-WWW-8801' 2>$null | Out-Null
    netsh advfirewall firewall add rule name='IHUI-ALLOW-WWW-8801' dir=in action=allow `
      protocol=TCP localport=8801 profile=any | Out-Null
    Write-Host "[2/5] EdgeOne origin ingress 8801 allowed (any remote)" -ForegroundColor Green
  }
}

# -----------------------------------------------------------------------------
# 3. 公网 -> 系统服务端口 + IHUI 业务/中间件端口:显式 Block
#    (LAN 与 loopback 不在范围内,CF Tunnel 与本机反代不受影响)
# -----------------------------------------------------------------------------
$rules = @(
  @{ Name = 'IHUI-DENY-WAN-WINRPC';    Ports = '135,137,138,139,445' },
  @{ Name = 'IHUI-DENY-WAN-SERVICES';  Ports = '8802,8803,8804,8805,8810,8811,8815,8842,8843,9093,9096,9097,9121,9182,9187,9464,12000' },
  # 上一版只禁了"全端口 ANY"软件规则,漏掉"特定端口 ANY 来源"的放行
  # (打印机 5130 / SSH 调试口 2223 / Nginx 80,8080 / AI 后端 8000 / ChatGPT 1455,1457 /
  #  端口 7000 等)。光猫 DMZ 开着时这些端口被转发到公网 = 裸奔。Block 优先级高于 Allow,
  #  这里用更高优先级的 Block 规则压制它们(WAN = 全集减 LAN/loopback)。
  @{ Name = 'IHUI-DENY-EXTRA-APPS';    Ports = '5130,2223,80,8080,8000,1455,1457,7000' }
)
if ($BlockRemoteAdmin) {
  # SSH:公网直接封死
  $rules += @{ Name = 'IHUI-DENY-WAN-SSH22'; Ports = '22' }
  # RDP:端口从 3389 迁到 53389(躲开全网段扫描器),再把新旧端口都对公网封死,
  #     只留一条内网放行 —— 即"改非标端口 + 仅内网可达"。
  $rdpKey = 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp'
  if (-not $Verify) {
    # 仅在端口尚未迁移时才改注册表 + 重启 TermService,避免计划任务每轮都把活动 RDP 会话踢断。
    $curPort = $null
    try { $curPort = (Get-ItemProperty -Path $rdpKey -Name 'PortNumber' -ErrorAction Stop).PortNumber } catch { }
    if ($curPort -ne 53389) {
      Set-ItemProperty -Path $rdpKey -Name 'PortNumber' -Value 53389 -Type DWord -Force
      netsh advfirewall firewall delete rule name='IHUI-ALLOW-LAN-RDP-53389' 2>$null | Out-Null
      netsh advfirewall firewall add rule name='IHUI-ALLOW-LAN-RDP-53389' dir=in action=allow `
        protocol=TCP localport=53389 remoteip='192.168.1.0/24' | Out-Null
      Restart-Service -Name TermService -Force -ErrorAction SilentlyContinue
    }
    else {
      # 端口已迁移:只确保内网放行规则存在(幂等),不动 TermService。
      # verify-first:同一条规则连着被「拆了再建」是重放空窗的典型来源,达标即跳过。
      if (-not (Test-FwRuleApplied -Name 'IHUI-ALLOW-LAN-RDP-53389' -Action Allow -LocalPorts '53389' -RemoteCidrs '192.168.1.0/24')) {
        netsh advfirewall firewall delete rule name='IHUI-ALLOW-LAN-RDP-53389' 2>$null | Out-Null
        netsh advfirewall firewall add rule name='IHUI-ALLOW-LAN-RDP-53389' dir=in action=allow `
          protocol=TCP localport=53389 remoteip='192.168.1.0/24' | Out-Null
      }
    }
  }
  $rules += @{ Name = 'IHUI-DENY-WAN-RDP'; Ports = '3389,53389' }
  $rules += @{ Name = 'IHUI-DENY-WAN-WINRM'; Ports = '5985,5986' }
}
foreach ($r in $rules) {
  if (-not $Verify) {
    # verify-first:达标就一行打点跳过,不进 delete→add 的拆建窗口(见 §0 头注)
    if (Test-FwRuleApplied -Name $r.Name -Action Block -LocalPorts $r.Ports -RemoteCidrs $WAN) {
      Write-Host ("[3/5] rule {0} -> {1} (already applied)" -f $r.Name, $r.Ports) -ForegroundColor DarkGray
      continue
    }
    netsh advfirewall firewall delete rule name="$($r.Name)" 2>$null | Out-Null
    netsh advfirewall firewall add rule name="$($r.Name)" dir=in action=block protocol=TCP `
      localport="$($r.Ports)" remoteip="$WAN" | Out-Null
  }
  Write-Host ("[3/5] rule {0} -> {1}" -f $r.Name, $r.Ports) -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# 3.5 危险"特定端口 ANY 来源"允许规则:显式禁用(幂等)
#     8801 是 EO 回源入口(公网 IP:8801),必须对外开放,封锁会令 www.aizhs.top 经 EO
#     返回 522(历史教训),因此 8801 不在此列、也不另建 8801 阻止规则。
#     但下列"特定端口 + 任意来源"的放行绝非业务所需,在 DMZ 下等于把对应服务裸奔到
#     公网,逐一禁用(与上面的 EXTRA-APPS Block 形成双保险):
#       Seagull/Epson 打印机驱动(5130/2968) · SSH 调试口 2223 · Nginx 80/8080 ·
#       AI 后端 8000 · ChatGPT 1455/1457 · 端口 7000 · 旧 RDP 3389 · sshd 任意端口 ·
#       Windows PowerShell / PBCCRCPassGuardXInput 的"任意端口 ANY"放行。
#     说明:SSH 22 的 unspec 允许(OpenSSH Server (sshd) TCP 22)刻意保留 —— 它让内网
#     可 SSH 管理,且已被 IHUI-DENY-WAN-SSH22 Block 规则在公网侧压制(阻止优先)。
# -----------------------------------------------------------------------------
$extraAllowsToDisable = @(
  'Seagull Driver Networking XPML', 'Epson ScanSmart',
  'Nginx_HTTP_80', 'Nginx_HTTP_8080', 'AI_ZHS_Backend_8000',
  'ChatGPT', 'OpenSSH-Debug-2223', 'sshd',
  'Windows PowerShell', 'PBCCRCPassGuardXInput', 'IHUI-RDP-In'
)
if (-not $Verify) {
  foreach ($nm in $extraAllowsToDisable) {
    # 按名称批量禁用(含同名多条);已禁用也无妨,幂等
    netsh advfirewall firewall set rule name="$nm" new enable=no 2>$null | Out-Null
  }
  # 上一版遗留的 8801 LAN 阻止规则(若仍残留在存量机)清掉,避免与 EO 回源冲突
  netsh advfirewall firewall delete rule name='IHUI-DENY-LAN-8801' 2>$null | Out-Null
}
Write-Host "[3.5/5] dangerous specific-port any-source allow rules disabled (SSH-debug/printer/nginx/AI/chatgpt/7000...)" -ForegroundColor Green

# -----------------------------------------------------------------------------
# 4. TCP/IP 内核:SYN flood 保护 + 抗链路劫持 + 死连接回收
#    注意:重启后才完全生效
# -----------------------------------------------------------------------------
$tcpParams = @{
  SynAttackProtect                     = 1       # SYN flood
  TcpMaxHalfOpen                       = 2048
  TcpMaxHalfOpenRetried                = 1024
  TcpMaxPortsExhausted                 = 5
  TcpMaxConnectResponseRetransmissions = 2
  TCPMaxConnectRetransmissions         = 3
  EnableICMPRedirect                   = 0       # 防 ICMP 重定向劫持
  DisableIPSourceRouting               = 2       # 禁源路由
  EnableDeadGWDetect                   = 0       # 防死网关劫持
  PerformRouterDiscovery               = 0       # 防 ICMP 路由发现欺骗
  KeepAliveTime                        = 300000  # 5 分钟回收空闲连接
  EnablePMTUDiscovery                  = 1
}
if (-not $Verify) {
  foreach ($k in $tcpParams.Keys) {
    New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters' `
      -Name $k -Value $tcpParams[$k] -PropertyType DWord -Force | Out-Null
  }
  New-Item -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient' -Force | Out-Null
  New-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient' `
    -Name 'EnableMulticast' -Value 0 -PropertyType DWord -Force | Out-Null   # 关 LLMNR
}
Write-Host "[4/5] TCP/IP hardening + LLMNR disabled" -ForegroundColor Green

# -----------------------------------------------------------------------------
# 5. 可选:清理"本地端口=任何 且 远程IP=任何"的软件放行规则
# -----------------------------------------------------------------------------
if ($PruneAppRules -and -not $Verify) {
  # 直接改防火墙规则注册表,而不是 netsh set rule name= —— 因为本机规则名含中文与
  # 历史乱码(netsh 命令行按当前代码页输出,名字对不上就静默漏改)。
  # 规则值形如: v2.33|Action=Allow|Active=TRUE|Dir=In|Protocol=6|LPort=...|RA4=...|App=...|Name=...
  $reg = 'HKLM:\SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy\FirewallRules'
  $k = Get-ItemProperty -Path $reg
  $logPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'fw-rules-disabled.jsonl'
  $changed = 0; $skipped = 0; $log = @()

  foreach ($p in $k.PSObject.Properties) {
    if ($p.Name -match '^PS') { continue }
    $v = [string]$p.Value
    if ($v -notmatch '\|Dir=In(\||$)') { continue }
    if ($v -notmatch '\|Action=Allow(\||$)') { continue }
    if ($v -notmatch '\|Active=TRUE(\||$)') { continue }

    $hasLP = $false; $lpv = ''; $ra4 = ''; $app = ''
    foreach ($f in $v.Split('|')) {
      if ($f -like 'LPort=*') { $hasLP = $true; $lpv = $f.Substring(6) }
      if ($f -like 'RA4=*') { $ra4 = $f.Substring(4) }
      if ($f -like 'App=*') { $app = $f.Substring(4) }
    }
    if ($hasLP -and $lpv -ne '*' -and $lpv -ne '1-65535') { continue }
    if ($ra4 -and $ra4 -ne '*') { continue }

    # 保留:Windows 系统进程(svchost / spoolsv / dasHost / mdeserver / System ...)
    if ($app -match '(?i)(^System$|^%?[Ss]ystem[Rr]oot%?\\|\\system32\\|\\syswow64\\)') { $skipped++; continue }
    # 保留:sshd —— 公网 22 已由 Block 规则封锁,内网管理通道要留着
    if ($app -match '(?i)sshd\.exe') { $skipped++; continue }

    $new = $v -replace '\|Active=TRUE(\||$)', '|Active=FALSE$1'
    if ($new -ne $v) {
      Set-ItemProperty -Path $reg -Name $p.Name -Value $new
      $changed++
      $log += [pscustomobject]@{ key = $p.Name; app = $app; before = $v; after = $new }
    }
  }
  $log | ConvertTo-Json -Compress | Set-Content -Path $logPath -Encoding UTF8
  Write-Host ("[5/5] pruned {0} any-port/any-source inbound rules (kept {1}: system/sshd)" -f $changed, $skipped) -ForegroundColor Green
  Write-Host ("      audit trail: {0}" -f $logPath) -ForegroundColor DarkGray
}
elseif ($PruneAppRules -and $Verify) {
  Write-Host "[5/5] app-rule pruning would run (not executed in -Verify mode)" -ForegroundColor DarkGray
}
else {
  Write-Host "[5/5] app-rule pruning skipped (use -PruneAppRules)" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Done. Suggested verification:"
Write-Host "  curl http://127.0.0.1:8801/ ; curl http://127.0.0.1:8802/api/health"
Write-Host "  curl http://192.168.1.37:8802/api/health     # LAN 应仍通"
Write-Host "  https://aizhs.top  https://api.aizhs.top/api/health   # 公网经 CF 应正常"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
