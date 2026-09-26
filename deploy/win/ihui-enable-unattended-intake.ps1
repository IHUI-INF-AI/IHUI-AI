# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
<#
.SYNOPSIS
  生产机一次性开通「CI 失败 -> 无人值守修复」信源投递:把服务端 HMAC 密钥以**事务式**方式
  写进 IHUI-API 的 nssm 环境块,并按需重启该服务。

.DESCRIPTION
  核实到的服务端事实(2026-09-26 读码,本脚本不改动任何 apps/api 源码):
    * 路由      POST /api/webhooks/github
                挂载 apps/api/src/routes/index.ts:1322(prefix /api/webhooks)
                处理 apps/api/src/routes/github-webhook.ts:143
    * 读的 env   GITHUB_WEBHOOK_SECRET   apps/api/src/routes/github-webhook.ts:145
                声明   apps/api/src/config/index.ts:117(z.string().default(''))
    * 未配置时   **503** 结构化拒绝(github-webhook.ts:146-149),路由仍然存在、不是 404/500
    * 签名算法   HMAC-SHA256 over 原始 body 字节,头 x-hub-signature-256: sha256=<hex>
                比较用 timingSafeEqual(agent-event-trigger.ts:51-64),**是** timing-safe
    * 生效前提   config 在进程启动时一次性 safeParse(process.env)
                (config/index.ts:270 + :279)⇒ 改完环境块**必须重启 IHUI-API** 才生效

  为什么走 nssm 环境块而不是 apps/api/.env:两条都可行 —— index.ts:5 有 `import 'dotenv/config'`,
  而 dotenv **不覆盖**已存在的 process.env,所以 nssm 块优先于 .env。本脚本按任务口径写 nssm 块
  (它是服务身份的权威来源、且不受工作树回写影响)。若只想零风险试通,把同一把密钥写进
  apps/api/.env 也可以(§5d 规矩:只填值为空的键、绝不覆盖已有值),那条路不需要整块覆盖。

  nssm set AppEnvironmentExtra 是**整块覆盖**语义,同块常挂着别的键(实测 IHUI-DEPLOYLOOP 块内
  就有 IHUI_ADMIN_PASSWORD,§5e 原话),所以写回必须事务式:
    读整块 -> 备份 -> 只动目标键 -> **逐条逐字节比对其余项全等**才写 -> 写回后再读再比 ->
    不等即从备份整块还原。任何一步不成立都不落地。

  凭据卫生(§5d/§5e):密钥唯一落点是 §5d 权威根下的用途子目录(与既有 db-backup/ 同族),
  本脚本**绝不把密钥内容打进 stdout / 日志 / 命令行参数**;要判"是不是同一把"只打印
  长度 + SHA-256 摘要前 12 位(沿用 scripts/check-credential-health.mjs 的 fingerprint 口径)。
  凭据根的盘符一律经 `node scripts/secret-path.mjs` 取,脚本内**不抄第二份候选表** —— 那正是
  §5d 记过的「读不到文件被下游报成凭据失效」的成因。
  备份根按工作树所在盘推导(等价 scripts/lib/gitdir.mjs 的 gitArchiveDir() 规则),不写死盘符。

.PARAMETER Apply
  默认**不带**= 只出计划(dry-run),一个字节都不写。必须显式 -Apply 才动服务环境块。
  之所以默认保守:在开发机上误跑一次,就会往凭据目录(可能是网盘同步目录)落一把新密钥。

.PARAMETER Rotate
  环境块里已有 GITHUB_WEBHOOK_SECRET 而值与密钥文件不同时,默认**拒绝覆盖**(那会打断
  已经在用的 GitHub webhook)。确认要换才加 -Rotate。

.PARAMETER Restart
  写成功后顺带 `nssm restart <服务>`。不加则只打印重启命令(config 是启动快照,不重启不生效)。

.PARAMETER SelfTest
  只跑纯函数自检(密钥生成格式/整块判等/幂等/路径形状),不碰 nssm、不碰凭据目录、不写任何生产文件。

.PARAMETER ProbePath
  只问"这把密钥该落在哪个文件、现在是什么状态"并打印结论后退出。**只读**,不需要 nssm、
  不写任何文件。加它是因为凭据落点解析与 nssm 事务是两件独立的事,开发机上也能先把前一件
  验明 —— 本脚本第一版正是在这一步把 node 的 stderr 诊断句当成了路径(见 Invoke-NodeStreams)。

.EXAMPLE
  pwsh -NoProfile -File deploy/win/ihui-enable-unattended-intake.ps1 -SelfTest
.EXAMPLE
  # 生产机:先看计划
  pwsh -NoProfile -File deploy/win/ihui-enable-unattended-intake.ps1
  # 确认后落地(写环境块,不重启)
  pwsh -NoProfile -File deploy/win/ihui-enable-unattended-intake.ps1 -Apply
  # 落地并重启
  pwsh -NoProfile -File deploy/win/ihui-enable-unattended-intake.ps1 -Apply -Restart
#>
[CmdletBinding()]
param(
  [string] $ServiceName = 'IHUI-API',
  [string] $EnvKey = 'GITHUB_WEBHOOK_SECRET',
  [string] $KeySubDir = 'intake',
  [string] $KeyFileName = 'ihui-intake-webhook.txt',
  [string] $NssmPath = '',
  [switch] $Apply,
  [switch] $Rotate,
  [switch] $Restart,
  [switch] $SelfTest,
  [switch] $ProbePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# 仓库根按脚本自身位置推导(§15 禁止硬编码盘符):本文件位于 <root>\deploy\win
$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$script:Nssm = $null   # 由 Invoke-Enable 解析后写入;Invoke-Nssm 只认这个

# =============================================================================
# 纯函数(可本机自检,不触 nssm / 网络 / 凭据目录)
# =============================================================================

function Clear-NssmNul {
  param([string] $Text)
  # nssm 的输出实测含 NUL(UTF-16LE 残留),不剥掉会让 -match / 逐条比对恒不等。
  # 这条坑 deploy/win/install-deploy-loop-service.ps1:72 已经记过一次。
  if ($null -eq $Text) { return '' }
  return ($Text -replace "`0", '')
}

function Split-EnvBlock {
  param([string] $Raw)
  # 环境块 = 一串 `KEY=VALUE` 行。空行/纯空白行丢弃(它们不是条目,保留会让"逐条全等"
  # 在写回后被 nssm 自己的规范化打破)。
  $clean = Clear-NssmNul $Raw
  $out = @()
  foreach ($line in ($clean -split "`r?`n")) {
    if ($line.Trim().Length -gt 0) { $out += $line }
  }
  return ,$out
}

function Get-EnvLineKey {
  param([string] $Line)
  $i = $Line.IndexOf('=')
  if ($i -le 0) { return $null }
  return $Line.Substring(0, $i).Trim()
}

function Get-EnvLineValue {
  param([string] $Line)
  $i = $Line.IndexOf('=')
  if ($i -lt 0) { return $null }
  return $Line.Substring($i + 1).Trim()
}

function Find-EnvLineIndex {
  param([string[]] $Block, [string] $Key)
  for ($i = 0; $i -lt $Block.Count; $i++) {
    if ((Get-EnvLineKey $Block[$i]) -ceq $Key) { return $i }
  }
  return -1
}

function Merge-EnvBlock {
  <#
    .SYNOPSIS
      把 KEY=VALUE 并进环境块:已有则**原位替换**(保持顺序),没有则追加。
    .NOTES
      刻意返回新数组、不改入参 —— 判等要用"改之前那份"作对照。
  #>
  param([string[]] $Block, [string] $Key, [string] $Value)
  $line = "$Key=$Value"
  $idx = Find-EnvLineIndex -Block $Block -Key $Key
  if ($idx -lt 0) { return @($Block + @($line)) }
  $new = @()
  for ($i = 0; $i -lt $Block.Count; $i++) {
    $new += $(if ($i -eq $idx) { $line } else { $Block[$i] })
  }
  return ,$new
}

function Test-AdditivePreservation {
  <#
    .SYNOPSIS
      §5e 的"逐条逐字节比对剩余项全等":从 new 里剥掉目标键后,必须与 old 剥掉目标键后
      **逐条、同序、全等**。这是写回前唯一的放行条件。
    .NOTES
      用 -ceq(大小写敏感)+ 不做 Trim:值里的空格/引号是有意义的,任何"顺手规范化"
      都会在还原时产出一份和原始不等的环境块 —— 那等于把备份写成第二个真相。
  #>
  param([string[]] $Old, [string[]] $New, [string] $Key)
  $strip = {
    param([string[]] $b, [string] $k)
    @(foreach ($l in $b) { if ((Get-EnvLineKey $l) -cne $k) { $l } })
  }
  # 外层必须再套 @():块里只剩目标键一条时,strip 返回**空**,PowerShell 会把它塌成
  # $null —— 而 Set-StrictMode Latest 下 $null.Count 直接抛"The property 'Count'
  # cannot be found",自检跑到这一条就断(实测),更糟的是生产路径上它会把一次
  # 合法的"只剩目标键"环境块判成脚本报错而不是判等结果。
  $a = @(& $strip $Old $Key)
  $c = @(& $strip $New $Key)
  if ($a.Count -ne $c.Count) { return $false }
  for ($i = 0; $i -lt $a.Count; $i++) {
    if ($a[$i] -cne $c[$i]) { return $false }
  }
  return $true
}

function New-RandomHexSecret {
  param([int] $Bytes = 32)
  # 32 字节 -> 64 位小写十六进制。长度依据:GitHub 对 webhook secret 无格式要求,
  # 但 40-hex 是它的历史惯例;取 64 hex(=256bit 熵)同时满足更严的档位。
  if ($Bytes -lt 16) { throw "Bytes 不得小于 16(熵不足):$Bytes" }
  $buf = [byte[]]::new($Bytes)
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($buf)
  return (-join ($buf | ForEach-Object { $_.ToString('x2') }))
}

function Get-SecretFingerprint {
  param([string] $Value)
  # 只打印长度 + 摘要前 12 位,与 scripts/check-credential-health.mjs 的 fingerprint 同形:
  # 足以判"是不是同一把",不泄露任何可用于重放的字节。
  if ([string]::IsNullOrEmpty($Value)) { return '缺失' }
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $hash = ($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Value)) |
    ForEach-Object { $_.ToString('x2') }) -join ''
  return "len=$($Value.Trim().Length) sha=$($hash.Substring(0, 12))"
}

function Get-EnvBackupRoot {
  param([string] $RepoRootPath)
  # 与工作树所在盘推导:<盘根>\DevEnv\backups\env(§15b 唯一备份目录)。
  # 等价于 scripts/lib/gitdir.mjs 的 gitArchiveDir() 那条 join(wt,'..','..') 规则,
  # 只是这里没有 node 的 import 通道 —— 关键约束是同一条:**不得写死盘符**。
  $root = [System.IO.Path]::GetPathRoot($RepoRootPath)
  if ([string]::IsNullOrEmpty($root)) {
    throw "无法从工作树路径推导盘根:$RepoRootPath"
  }
  return [System.IO.Path]::Combine($root, 'DevEnv', 'backups', 'env')
}

function Get-NssmCandidates {
  param([string] $SystemRoot)
  # 至少两处都真在本仓的机器上出现过:C:\Windows\System32\nssm.exe
  # (scripts/check-credential-health.mjs:66 用的就是它)与 C:\Program Files\nssm.exe
  # (AGENTS §5b 在另一份 checkout 上实测"在位,331264 字节")。只认一处,就会在一台
  # **服务真在跑、而 nssm 装在别处**的部署机上把开通动作误判成"本机不是部署机"。
  # 用 [IO.Path]::Combine 而不是 Join-Path:后者会去校验 PSDrive 提供器,对没挂载的
  # 盘符直接抛 "Cannot find drive" —— 本函数的自检必须能喂一个假盘根构造现场
  # (Get-EnvBackupRoot 同因,那边一直用的是 Combine)。
  @(
    [System.IO.Path]::Combine($SystemRoot, 'System32', 'nssm.exe'),
    [System.IO.Path]::Combine($SystemRoot, 'nssm.exe'),
    'C:\Program Files\nssm.exe'
  )
}

function Resolve-NssmPath {
  param(
    [string[]] $Candidates,
    [string] $Override,
    [scriptblock] $Exists = { param($p) Test-Path -LiteralPath $p }
  )
  # 判活交给注入的 $Exists ⇒ 纯函数,自检能构造"装了但不在第一候选"的现场,
  # 不必真在测试机上装 nssm(§22c:镜像测试不得只复读实现)。
  if ($Override) {
    # 显式指了却指不到 ⇒ 如实 null。不许"降级去试候选":那会把人指错的路径
    # 悄悄换成另一台机器上恰好存在的二进制,现象是"命令跑通了但管的是别的服务"。
    if (& $Exists $Override) { return $Override }
    return $null
  }
  foreach ($c in $Candidates) { if (& $Exists $c) { return $c } }
  return $null
}

# =============================================================================
# 副作用封装
# =============================================================================

function Invoke-Nssm {
  param([string[]] $Arguments)
  if (-not $script:Nssm) {
    return [pscustomobject]@{ Ok = $false; ExitCode = -1; Text = ''; Error = 'nssm 路径未解析(调用顺序错误)' }
  }
  try {
    $out = & $script:Nssm @Arguments 2>&1 | Out-String
    return [pscustomobject]@{
      Ok = ($LASTEXITCODE -eq 0); ExitCode = $LASTEXITCODE
      Text = (Clear-NssmNul $out); Error = ''
    }
  } catch {
    return [pscustomobject]@{ Ok = $false; ExitCode = -1; Text = ''; Error = $_.Exception.Message }
  }
}

function Read-ServiceEnvBlock {
  param([string] $Service)
  $probe = Invoke-Nssm @('get', $Service, 'AppEnvironmentExtra')
  if (-not $probe.Ok) {
    # nssm get 失败要分"服务不存在"与"问不到"。这里统一交调用方按无法判定处置 ——
    # 把"问不到"读成"块是空的"就意味着写回时只剩我们那一行,别人的键全没。
    return [pscustomobject]@{ Ok = $false; Block = @(); Error = $probe.Error; Text = $probe.Text }
  }
  # 退出码 0 但输出里带错误字样也算失败:nssm 对未知键会打印用法并回非零,
  # 但对"服务不存在"在部分版本回 0 + 错误文本(实测口径未知 ⇒ 从严)。
  if ($probe.Text -match 'ERROR_SERVICE_DOES_NOT_EXIST|Could not open service') {
    return [pscustomobject]@{ Ok = $false; Block = @(); Error = '服务不存在或打不开'; Text = $probe.Text }
  }
  return [pscustomobject]@{ Ok = $true; Block = (Split-EnvBlock $probe.Text); Error = ''; Text = $probe.Text }
}

function Set-ServiceEnvBlock {
  param([string] $Service, [string[]] $Block)
  if ($Block.Count -eq 0) {
    # 空块写回 = 把整块抹掉。事务式的前提就是绝不走到这里;真到了就是判据错了,宁可失败。
    throw '拒绝写回空环境块(那等于清掉服务的全部自定义键)'
  }
  return Invoke-Nssm (@('set', $Service, 'AppEnvironmentExtra') + $Block)
}

function Test-AbsoluteWinPath {
  param([string] $Value)
  # 只认「盘符 + 分隔符」开头。这道判据是被一次真实误判逼出来的:见
  # Invoke-NodeStreams 里 2>&1 那段注释 —— 诊断句也会落到同一个流里。
  if ([string]::IsNullOrWhiteSpace($Value)) { return $false }
  return ($Value -match '^[A-Za-z]:[\\/]')
}

function Get-IntendedSecretPath {
  <#
    .SYNOPSIS
      从 key-dir.mjs 的三态出处里算出"该往哪写"。纯函数,可在自检里喂构造输入。
    .NOTES
      winnerIndex === -1 ⇒ 一个候选根都没命中(盘没挂上 / 根缺失)= 无法判定,返回 $null。
      winnerIndex >= 0  ⇒ tried[winnerIndex] 就是 <根>/<子目录>,无论它此刻存不存在。
      越界一律 $null —— 宁可判"无法判定",不许拿一个猜出来的路径去建目录写密钥。
  #>
  param([int] $WinnerIndex, [string[]] $Tried, [string] $Name)
  if ($WinnerIndex -lt 0) { return $null }
  if ($null -eq $Tried) { return $null }
  if ($WinnerIndex -ge $Tried.Count) { return $null }
  if ([string]::IsNullOrWhiteSpace($Name)) { return $null }
  $dir = $Tried[$WinnerIndex]
  if (-not (Test-AbsoluteWinPath $dir)) { return $null }
  return ($dir.TrimEnd('/', '\') + '/' + $Name)
}

function Resolve-NodeExePath {
  # 与 deploy/win/ihui-deploy.ps1 的 Resolve-NodeExe 同一条理由:服务身份(LocalSystem)读的是
  # **机器级 PATH**,那串 node 路径在本机实测是死路径,`Get-Command` 在人手里命中、在服务
  # 手里落空 ⇒ "取凭据要先找 node"的分支会静默跳过并回落兜底档(§26 / PLAN 续十)。
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($cmd -and (Test-Path -LiteralPath $cmd.Source)) { return $cmd.Source }
  foreach ($c in @('D:\DevEnv\runtimes\node\node.exe', 'C:\Program Files\nodejs\node.exe')) {
    if (Test-Path -LiteralPath $c) { return $c }
  }
  return $null
}

function Invoke-NodeStreams {
  <#
    .SYNOPSIS
      派生 node 并把 stdout / stderr **分开**返回。
    .NOTES
      为什么单列一个函数:本脚本第一次真跑就是把两股流并成一条(`2>&1`),而
      secret-path.mjs 在"文件不存在"那一档 **stdout 是空的、整句中文诊断走 stderr**
      ⇒ 合并后首行变成了「凭据目录不存在: D:/… —— 先建该目录,再在其中写入…」,
      这句话会被当成路径收下、再被拿去 Split-Path / New-Item / 写文件。
      契约是"stdout 恒为路径、诊断一律走 stderr"(见该脚本头注),所以调用方必须
      按流分开取,并再判一次形状(Test-AbsoluteWinPath)才许用。
  #>
  param([string] $NodeExe, [string[]] $Arguments)
  # §5d/§26:node 的 stdout 是 UTF-8,而控制台默认按 GBK 码页解码 ⇒ 含「密钥」的中文路径
  # 会变乱码字符串,Test-Path 判"不存在",表现成"口令文件没建"。入参方向无损,
  # 出参方向必须显式设码页才算数。
  $prevEnc = $null
  try {
    $prevEnc = [Console]::OutputEncoding
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  } catch { $prevEnc = $null }
  try {
    $rows = @(& $NodeExe @Arguments 2>&1)
    $code = $LASTEXITCODE
    $so = @($rows | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] } |
      ForEach-Object { [string]$_ }) -join "`n"
    $se = @($rows | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] } |
      ForEach-Object { $_.Exception.Message }) -join "`n"
    return [pscustomobject]@{
      Code = $code
      Stdout = (Clear-NssmNul $so).Trim()
      Stderr = (Clear-NssmNul $se).Trim()
    }
  } finally {
    if ($null -ne $prevEnc) {
      # 还原失败不影响判据:编码只关系到"路径读回来是不是乱码",不还原最坏是后续中文
      # 输出继续走 UTF8,不会把凭据内容打出来。
      try { [Console]::OutputEncoding = $prevEnc } catch { }
    }
  }
}

function Resolve-SecretTarget {
  <#
    .SYNOPSIS
      取"这把密钥该放/已放在哪个文件",三态如实:Existing / ToCreate / Undetermined。
    .NOTES
      盘符候选一律由 scripts/lib/key-dir.mjs 决定(经 secret-path.mjs 与
      resolveKeyDirDetailed 两个出口),本脚本**不抄第二份 F→D→E→G→C 表** ——
      那正是 §5d 记过的「读不到文件被下游报成凭据失效」的成因。
  #>
  param([string] $RepoRootPath, [string] $Sub, [string] $Name)
  $node = Resolve-NodeExePath
  if (-not $node) {
    return [pscustomobject]@{ State = 'Undetermined'; Path = ''; Note = '取不到 node 可执行文件' }
  }
  $tool = Join-Path $RepoRootPath 'scripts\secret-path.mjs'
  $lib = Join-Path $RepoRootPath 'scripts\lib\key-dir.mjs'
  foreach ($p in @($tool, $lib)) {
    if (-not (Test-Path -LiteralPath $p)) {
      return [pscustomobject]@{ State = 'Undetermined'; Path = ''; Note = "工具不在位:$p" }
    }
  }

  $probe = Invoke-NodeStreams -NodeExe $node -Arguments @($tool, $Sub, $Name)
  if ($probe.Code -eq 0) {
    if (-not (Test-AbsoluteWinPath $probe.Stdout)) {
      return [pscustomobject]@{
        State = 'Undetermined'; Path = ''
        Note = "secret-path.mjs 回 0 但 stdout 不是绝对路径(契约被破坏,不猜):'$($probe.Stdout)'"
      }
    }
    return [pscustomobject]@{ State = 'Existing'; Path = $probe.Stdout; Note = '' }
  }
  if ($probe.Code -eq 2) {
    return [pscustomobject]@{ State = 'Undetermined'; Path = ''; Note = '凭据根不可达(该工具定义的 exit 2)' }
  }
  if ($probe.Code -ne 1) {
    return [pscustomobject]@{
      State = 'Undetermined'; Path = ''; Note = "secret-path.mjs 退出码非常规三态:$($probe.Code)"
    }
  }

  # exit 1 = 文件不存在(其下再分"子目录不存在"与"仅文件不存在",处置动作不同)。
  # 路径不在这次的 stdout 里,所以另问一次候选序的唯一出口 resolveKeyDirDetailed。
  $js = @'
import { pathToFileURL } from 'node:url'
const m = await import(pathToFileURL(process.argv[1]).href)
const d = m.resolveKeyDirDetailed(process.argv[2])
process.stdout.write(JSON.stringify({ winnerIndex: d.winnerIndex, tried: d.triedCandidates }))
'@
  $detailed = Invoke-NodeStreams -NodeExe $node `
    -Arguments @('--input-type=module', '-e', $js, $lib, $Sub)
  if ($detailed.Code -ne 0) {
    return [pscustomobject]@{
      State = 'Undetermined'; Path = ''; Note = "出处解析失败(exit $($detailed.Code)):$($detailed.Stderr)"
    }
  }
  $parsed = $null
  try { $parsed = $detailed.Stdout | ConvertFrom-Json } catch {
    return [pscustomobject]@{
      State = 'Undetermined'; Path = ''; Note = "出处输出解不出 JSON(不猜路径):'$($detailed.Stdout)'"
    }
  }
  $tried = @($parsed.tried)
  $intended = Get-IntendedSecretPath -WinnerIndex ([int] $parsed.winnerIndex) -Tried $tried -Name $Name
  if (-not $intended) {
    return [pscustomobject]@{
      State = 'Undetermined'; Path = ''
      Note = "一个凭据根都没命中(winnerIndex=$($parsed.winnerIndex))⇒ 无法判定,不等于凭据失效"
    }
  }
  $dir = Split-Path -Parent $intended
  $note = if (Test-Path -LiteralPath $dir) { '仅文件不存在(直接写文件)' } else { '子目录也不存在(先建目录)' }
  return [pscustomobject]@{ State = 'ToCreate'; Path = $intended; Note = $note }
}

# =============================================================================
# 纯函数自检:密钥生成格式 / 整块判等 / 幂等。不碰 nssm、不碰凭据目录。
# =============================================================================

function Invoke-SelfTest {
  $script:Pass = 0
  $script:Fail = 0
  function Assert-That {
    param([string] $Name, [bool] $Cond)
    if ($Cond) { $script:Pass++; Write-Host "  ok   $Name" }
    else { $script:Fail++; Write-Host "  FAIL $Name" -ForegroundColor Red }
  }

  Write-Host '[selftest] 纯函数自检(不触 nssm / 凭据目录)'

  # --- 1. NUL 剥离与块切分 -------------------------------------------------
  $rawWithNul = "A=1`0`r`nB=2`0`r`n`r`n"
  $blk = Split-EnvBlock $rawWithNul
  Assert-That 'Split-EnvBlock 剥 NUL 并丢空行' ($blk.Count -eq 2 -and $blk[0] -ceq 'A=1' -and $blk[1] -ceq 'B=2')
  Assert-That 'Get-EnvLineKey 取第一个 = 之前' ((Get-EnvLineKey 'A=1=2') -ceq 'A')
  Assert-That 'Get-EnvLineValue 保留值里的 = 与空格' ((Get-EnvLineValue 'A=x = y ') -ceq 'x = y')
  Assert-That '无 = 的行不算键值对' ($null -eq (Get-EnvLineKey 'garbage'))

  # --- 2. 合并:追加 / 原位替换 -------------------------------------------
  $base = @('IHUI_ADMIN_PASSWORD=secret-admin', 'PORT=8802')
  $added = Merge-EnvBlock -Block $base -Key 'GITHUB_WEBHOOK_SECRET' -Value 'deadbeef'
  Assert-That 'Merge 缺失键时追加一条' ($added.Count -eq 3 -and $added[2] -ceq 'GITHUB_WEBHOOK_SECRET=deadbeef')
  Assert-That 'Merge 不改入参(纯函数)' ($base.Count -eq 2)
  $replaced = Merge-EnvBlock -Block $added -Key 'GITHUB_WEBHOOK_SECRET' -Value 'cafe'
  Assert-That 'Merge 已有键时原位替换、不追加第二条' (
    $replaced.Count -eq 3 -and $replaced[2] -ceq 'GITHUB_WEBHOOK_SECRET=cafe'
  )
  Assert-That '键名大小写敏感(不把 github_x 当 GITHUB_X)' (
    (Find-EnvLineIndex -Block $base -Key 'ihui_admin_password') -eq -1
  )

  # --- 3. 整块判等:事务式放行的唯一条件 ---------------------------------
  Assert-That '追加后其余项逐条全等' (Test-AdditivePreservation -Old $base -New $added -Key 'GITHUB_WEBHOOK_SECRET')
  Assert-That '替换后其余项逐条全等' (Test-AdditivePreservation -Old $added -New $replaced -Key 'GITHUB_WEBHOOK_SECRET')
  $clobbered = @('GITHUB_WEBHOOK_SECRET=x')
  Assert-That '**整块覆盖掉别人的键必须判不等**' (-not (
    Test-AdditivePreservation -Old $base -New $clobbered -Key 'GITHUB_WEBHOOK_SECRET'))
  $reordered = @($added[1], $added[0], $added[2])
  Assert-That '顺序变了也算不等(nssm 块按序比对)' (-not (
    Test-AdditivePreservation -Old $base -New $reordered -Key 'GITHUB_WEBHOOK_SECRET'))
  $caseChanged = @('IHUI_ADMIN_PASSWORD=SECRET-ADMIN', 'PORT=8802', 'GITHUB_WEBHOOK_SECRET=deadbeef')
  Assert-That '值大小写变了判不等(-cne,不做规范化)' (-not (
    Test-AdditivePreservation -Old $added -New $caseChanged -Key 'GITHUB_WEBHOOK_SECRET'))
  $extra = $added + @('NEW_KEY=1')
  Assert-That '顺手多塞别的键判不等' (-not (
    Test-AdditivePreservation -Old $base -New $extra -Key 'GITHUB_WEBHOOK_SECRET'))

  # --- 4. 密钥生成:格式 / 熵 / 唯一性 -----------------------------------
  $k1 = New-RandomHexSecret
  $k2 = New-RandomHexSecret
  Assert-That '默认 64 位小写十六进制' ($k1 -cmatch '^[0-9a-f]{64}$')
  Assert-That '两次生成不同' ($k1 -cne $k2)
  Assert-That '可指定长度' ((New-RandomHexSecret -Bytes 20) -cmatch '^[0-9a-f]{40}$')
  $threw = $false
  try { New-RandomHexSecret -Bytes 4 | Out-Null } catch { $threw = $true }
  Assert-That '熵过小时拒绝生成' $threw

  # --- 5. 指纹不泄露内容 -------------------------------------------------
  $fp = Get-SecretFingerprint $k1
  Assert-That '指纹含长度与摘要' ($fp -match '^len=64 sha=[0-9a-f]{12}$')
  Assert-That '**指纹里不含密钥本体**' (-not $fp.Contains($k1.Substring(0, 12)))
  Assert-That '空值指纹读作缺失' ((Get-SecretFingerprint '') -ceq '缺失')

  # --- 6. 幂等:已存在同值不产生变更 ------------------------------------
  $again = Merge-EnvBlock -Block $added -Key 'GITHUB_WEBHOOK_SECRET' -Value 'deadbeef'
  $same = ($again.Count -eq $added.Count)
  for ($i = 0; $i -lt $added.Count; $i++) { if ($again[$i] -cne $added[$i]) { $same = $false } }
  Assert-That '重复执行产出逐字节相同的块(幂等)' $same

  # --- 7. 备份根按盘推导,不写死 ----------------------------------------
  $bak = Get-EnvBackupRoot -RepoRootPath 'Q:\Some\IHUI-AI'
  Assert-That '备份根跟随工作树所在盘(而非固定 D:\)' ($bak -ceq (
    [System.IO.Path]::Combine('Q:', 'DevEnv', 'backups', 'env')))
  $threw2 = $false
  try { Get-EnvBackupRoot -RepoRootPath 'not-a-path' | Out-Null } catch { $threw2 = $true }
  Assert-That '推不出盘根时抛错而不是猜' $threw2

  # --- 8. 判据不得对"自己产出的形态"失明 --------------------------------
  # Split-EnvBlock 产出的行喂回 Find/Merge 必须闭环,否则真跑时"已在位"会被读成"缺失"
  # 而反复追加第二条同名键(nssm 后写覆盖前写 = 看起来成功、实际换了值)。
  $roundTrip = Split-EnvBlock ($added -join "`r`n")
  Assert-That '块文本与数组往返同形(不会重复追加同名键)' (
    (Find-EnvLineIndex -Block $roundTrip -Key 'GITHUB_WEBHOOK_SECRET') -eq 2)

  # --- 9. 路径形状判据:必须拒掉"看着像路径、其实是诊断句"的那种串 -------
  # 这不是审美。本脚本第一版把 node 的两股流并成一条(2>&1),而 secret-path.mjs 在
  # "文件不存在"那一档 **stdout 是空的、整句中文诊断走 stderr** ⇒ 合并后首行变成了
  # 下面这句原文,它会被当成路径拿去 Split-Path / New-Item / WriteAllText。
  # 判据必须认得自己曾经产出的那一种错(§4 圆角门同一条教训)。
  $bogus = '凭据目录不存在: D:/BaiduSyncdisk/密钥/intake —— 先建该目录,' +
    '再在其中写入一行裸口令的文件 ihui-intake-webhook.txt'
  Assert-That '**诊断句不得被当成绝对路径**(旧版就是栽在这句上)' (-not (Test-AbsoluteWinPath $bogus))
  Assert-That '正斜杠真路径放行' (Test-AbsoluteWinPath 'D:/BaiduSyncdisk/密钥/intake/ihui-intake-webhook.txt')
  Assert-That '反斜杠真路径放行' (Test-AbsoluteWinPath 'D:\BaiduSyncdisk\密钥\intake\x.txt')
  Assert-That '盘符后缺分隔符不算路径' (-not (Test-AbsoluteWinPath 'D:x\y'))
  Assert-That '空值与空白不算路径' ((-not (Test-AbsoluteWinPath '')) -and (-not (Test-AbsoluteWinPath '   ')))

  # --- 10. 出处三态:根没命中时一律不猜路径 -----------------------------
  $tried2 = @('F:/BaiduSyncdisk/密钥/intake', 'D:/BaiduSyncdisk/密钥/intake')
  Assert-That 'winnerIndex 命中则给出该候选下的落点' (
    (Get-IntendedSecretPath -WinnerIndex 1 -Tried $tried2 -Name 'ihui-intake-webhook.txt') -ceq
    'D:/BaiduSyncdisk/密钥/intake/ihui-intake-webhook.txt')
  Assert-That '一个根都没命中 ⇒ null(无法判定,不等于凭据失效)' (
    $null -eq (Get-IntendedSecretPath -WinnerIndex -1 -Tried $tried2 -Name 'x.txt'))
  Assert-That '下标越界 ⇒ null,不许拿别的候选凑' (
    $null -eq (Get-IntendedSecretPath -WinnerIndex 7 -Tried $tried2 -Name 'x.txt'))
  Assert-That '候选项本身不是绝对路径 ⇒ null' (
    $null -eq (Get-IntendedSecretPath -WinnerIndex 0 -Tried @('relative/dir') -Name 'x.txt'))
  Assert-That '文件名为空 ⇒ null' (
    $null -eq (Get-IntendedSecretPath -WinnerIndex 0 -Tried $tried2 -Name ''))
  Assert-That '目录串带尾斜杠也不产出双斜杠' (
    (Get-IntendedSecretPath -WinnerIndex 0 -Tried @('D:/BaiduSyncdisk/密钥/intake/') -Name 'x.txt') -ceq
    'D:/BaiduSyncdisk/密钥/intake/x.txt')

  # --- 11. nssm 路径解析:候选顺序 + 指错不降级 -------------------------
  $c1 = Get-NssmCandidates -SystemRoot 'R:\win'
  Assert-That '候选首位是 System32 那份(与 check-credential-health.mjs 同源)' (
    $c1[0] -ceq [System.IO.Path]::Combine('R:\win', 'System32', 'nssm.exe'))
  Assert-That '候选含 Program Files 那份(§5b 在另一台机实测在位)' (
    $c1 -contains 'C:\Program Files\nssm.exe')
  # 注入假的 Exists:只承认第三候选存在 ⇒ 必须走到它,而不是因为第一候选没有就判"非部署机"
  $only3 = { param($p) $p -ceq 'C:\Program Files\nssm.exe' }
  Assert-That '**第一候选缺失时仍探到别的装机位置**' (
    (Resolve-NssmPath -Candidates $c1 -Override '' -Exists $only3) -ceq 'C:\Program Files\nssm.exe')
  $none = { param($p) $false }
  Assert-That '全落空 ⇒ null(交调用方判无法判定)' (
    $null -eq (Resolve-NssmPath -Candidates $c1 -Override '' -Exists $none))
  # 显式 -NssmPath 指错时必须判死,不许回头去探候选:那会把人指错的路径悄悄换成
  # 另一台机器上恰好存在的二进制,现象是"命令跑通了、管的是别的服务"。
  $firstOnly = { param($p) $p -ceq $c1[0] }
  Assert-That '**-NssmPath 指错 ⇒ null,绝不降级去探候选(候选面里有货也不许用)**' (
    $null -eq (Resolve-NssmPath -Candidates $c1 -Override 'Z:\nowhere\nssm.exe' -Exists $firstOnly))
  # 反向对照:只承认 override 那一个路径存在(候选全落空)⇒ 必须用 override。
  # 两条合起来才证明"override 优先且不外逃",只留一条就是断言了自己没写的那个方向。
  $ovOnly = { param($p) $p -ceq 'Z:\ok\nssm.exe' }
  Assert-That '**-NssmPath 指对 ⇒ 用它,即便所有候选都不在位**' (
    (Resolve-NssmPath -Candidates $c1 -Override 'Z:\ok\nssm.exe' -Exists $ovOnly) -ceq 'Z:\ok\nssm.exe')

  Write-Host ''
  Write-Host ("[selftest] 通过 {0} / 失败 {1}" -f $script:Pass, $script:Fail)
  return $script:Fail
}

# =============================================================================
# 主流程
# =============================================================================

function Invoke-Enable {
  $mode = if ($Apply) { 'APPLY' } else { 'DRY-RUN' }
  Write-Host "[enable] 模式 = $mode(不带 -Apply 一律零写入)"
  Write-Host "[enable] 服务 = $ServiceName   目标键 = $EnvKey   仓库根 = $RepoRoot"

  # ---- 1) 先确认"这台机是不是部署机" ----------------------------------
  # 问凭据根之前先问这个:凭据根可能就是网盘同步目录,在一台没有服务的机器上
  # 一路往下走,到 -Apply 时会往网盘里落一把新密钥。判据先到,顺序本身就是防线。
  $cands = Get-NssmCandidates -SystemRoot $env:SystemRoot
  $script:Nssm = Resolve-NssmPath -Candidates $cands -Override $NssmPath
  if (-not $script:Nssm) {
    $shown = if ($NssmPath) { "-NssmPath 指定的路径不存在:$NssmPath" } else { "已探候选:$($cands -join ' | ')" }
      Write-Host '[enable] 取不到 nssm ⇒ 本机按「不是部署机」处置:不解析凭据落点、不生成任何文件。' -ForegroundColor Red
    Write-Host "[enable]   $shown"
    Write-Host '         退出码 2 = **无法判定**(不是"配置坏了")。请在跑 IHUI-API 的那台机上执行;'
    Write-Host '         那台机上 nssm 装在这些候选之外时,用 -NssmPath <绝对路径> 指一次(指错会直接判死,不降级猜)。'
    return 2
  }
  Write-Host "[enable] nssm = $($script:Nssm)"

  # ---- 2) 取密钥落点路径(只取路径,永不把内容打到输出)----------------
  $resolved = Resolve-SecretTarget -RepoRootPath $RepoRoot -Sub $KeySubDir -Name $KeyFileName
  if ($resolved.State -eq 'Undetermined') {
    Write-Host "[enable] 无法判定:$($resolved.Note)" -ForegroundColor Yellow
    Write-Host '         这不等于"凭据失效"。出路:node scripts/secret-path.mjs --explain ' +
      "$KeySubDir $KeyFileName"
    return 2
  }
  $secretPath = $resolved.Path
  if (-not (Test-AbsoluteWinPath $secretPath)) {
    # 判据形状这一层是第二把尺子:上面已经查过 State,这里再查一次,因为一旦这个值
    # 被拿去 Split-Path / New-Item / WriteAllText,错的就不是一条日志而是一个落盘位置。
    Write-Host "[enable] 无法判定:拿到的不是绝对路径 ⇒ 拒绝继续(不猜落点):'$secretPath'" -ForegroundColor Red
    return 2
  }
  $needCreate = ($resolved.State -eq 'ToCreate')
  Write-Host "[enable] 密钥落点(仅路径,不含内容)= $secretPath"
  Write-Host "[enable] 落点现状 = $(if ($needCreate) { "待生成($($resolved.Note))" } else { '已存在,直接取用' })"

  # ---- 3) 读服务环境块整块 --------------------------------------------
  $read = Read-ServiceEnvBlock -Service $ServiceName
  if (-not $read.Ok) {
    Write-Host "[enable] 读环境块失败:$($read.Error) —— **无法判定,不写**。" -ForegroundColor Red
    Write-Host '         把"读不到"当成"块是空的"再写回,等于清掉服务的全部自定义键(§5e)。'
    return 1
  }
  $oldBlock = @($read.Block)
  Write-Host "[enable] 现环境块条目数 = $($oldBlock.Count)(只报数,内容一律不打印)"
  $idx = Find-EnvLineIndex -Block $oldBlock -Key $EnvKey
  Write-Host "[enable] $EnvKey 在块中 = $(if ($idx -ge 0) { "是(第 $($idx + 1) 条)" } else { '否' })"

  # ---- 4) 取/生成密钥 --------------------------------------------------
  $secret = $null
  if ($needCreate) {
    $secret = New-RandomHexSecret
    Write-Host "[enable] 生成新密钥,指纹 = $(Get-SecretFingerprint $secret)(不落明文、不进日志)"
    if ($Apply) {
      $dir = Split-Path -Parent $secretPath
      if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "[enable] 已创建用途子目录(与 db-backup/ 同族):$dir"
      }
      # 无 BOM、裸内容(与既有 <密钥根>/db-backup/ihui-backup.txt 同形态)
      [System.IO.File]::WriteAllText($secretPath, $secret, [System.Text.UTF8Encoding]::new($false))
      Write-Host "[enable] 密钥已写入:$secretPath"
    } else {
      Write-Host '[enable] DRY-RUN:不生成、不落盘。'
    }
  } else {
    $secret = (Get-Content -LiteralPath $secretPath -Raw).Trim()
    if ([string]::IsNullOrWhiteSpace($secret)) {
      Write-Host "[enable] 密钥文件存在但内容为空 ⇒ 不写服务块(空值会让服务端直接回 503)。" -ForegroundColor Red
      return 1
    }
    Write-Host "[enable] 取用既有密钥,指纹 = $(Get-SecretFingerprint $secret)"
  }

  # ---- 5) 幂等判定 + 事务式写回 ---------------------------------------
  $newBlock = Merge-EnvBlock -Block $oldBlock -Key $EnvKey -Value $secret
  if ($idx -ge 0) {
    $existingValue = Get-EnvLineValue $oldBlock[$idx]
    if ($existingValue -ceq $secret) {
      Write-Host "[enable] 环境块里的 $EnvKey 与密钥逐字节相同 ⇒ 无需改动(幂等直接收口)。"
      $blockChanged = $false
    } else {
      if (-not $Rotate) {
        Write-Host "[enable] 环境块里已有 $EnvKey 且**值不同**(旧指纹 $(Get-SecretFingerprint $existingValue))。" -ForegroundColor Red
        Write-Host "         覆盖会打断已经在用的 GitHub webhook(线上 webhook 配的是旧值)。"
        Write-Host '         确认要换密钥:先去 GitHub 侧同步,再带 -Rotate 重跑。'
        return 1
      }
      Write-Host "[enable] -Rotate 已给 ⇒ 原位替换(旧指纹 $(Get-SecretFingerprint $existingValue) -> 新指纹 $(Get-SecretFingerprint $secret))"
      $blockChanged = $true
    }
  } else {
    $blockChanged = $true
  }

  if (-not $blockChanged) {
    Write-Host '[enable] 服务环境块无需写入。'
  } elseif (-not $Apply) {
    Write-Host "[enable] DRY-RUN:本应把条目数从 $($oldBlock.Count) 变为 $($newBlock.Count)(只多这一条,其余逐条不动)。"
  } else {
    # 写回前自证:剥掉目标键后必须与旧块逐条、同序、全等。不成立就不写。
    if (-not (Test-AdditivePreservation -Old $oldBlock -New $newBlock -Key $EnvKey)) {
      Write-Host '[enable] 判等不通过:拟写入的块会动到别人的键 ⇒ **拒绝写回**。' -ForegroundColor Red
      Write-Host '         这是 §5e 的事务式底线(nssm set 是整块覆盖语义)。'
      return 1
    }
    $backupRoot = Get-EnvBackupRoot -RepoRootPath $RepoRoot
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backupFile = Join-Path $backupRoot "$ServiceName-AppEnvironmentExtra.$stamp.txt"
    # 备份的是**整块原文**(含别人的键),所以它在仓库外、且永不进 stdout。
    [System.IO.File]::WriteAllLines($backupFile, $oldBlock, [System.Text.UTF8Encoding]::new($false))
    Write-Host "[enable] 整块已备份(内容不打印):$backupFile"

    $setRes = Set-ServiceEnvBlock -Service $ServiceName -Block $newBlock
    if (-not $setRes.Ok) {
      Write-Host "[enable] nssm set 失败(exit $($setRes.ExitCode))⇒ 从备份整块还原" -ForegroundColor Red
      $rb = Set-ServiceEnvBlock -Service $ServiceName -Block $oldBlock
      if ($rb.Ok) {
        Write-Host '[enable] 已按备份整块还原。' -ForegroundColor Yellow
      } else {
        Write-Host '[enable] **还原也失败 —— 立即人工按备份文件核对服务环境块!**' -ForegroundColor Red
      }
      return 1
    }

    # 写回后再读再比:不等即整块还原(§5e 原文要求的第二把尺子)。
    $verify = Read-ServiceEnvBlock -Service $ServiceName
    $mismatch = (-not $verify.Ok) -or ($verify.Block.Count -ne $newBlock.Count)
    if (-not $mismatch) {
      for ($i = 0; $i -lt $newBlock.Count; $i++) {
        if ($verify.Block[$i] -cne $newBlock[$i]) { $mismatch = $true; break }
      }
    }
    if ($mismatch) {
      Write-Host "[enable] 写回后回读与期望**不等** ⇒ 从 $backupFile 整块还原。" -ForegroundColor Red
      $null = Set-ServiceEnvBlock -Service $ServiceName -Block $oldBlock
      $after = Read-ServiceEnvBlock -Service $ServiceName
      Write-Host "[enable] 还原后回读条目数 = $(if ($after.Ok) { $after.Block.Count } else { '无法判定' })"
      return 1
    }
    Write-Host "[enable] 写回并回读一致:$($newBlock.Count) 条,其余项逐条同序全等。"
  }

  # ---- 6) 重启提示 / 执行 ---------------------------------------------
  if ($Restart -and $Apply -and $blockChanged) {
    $rs = Invoke-Nssm @('restart', $ServiceName)
    Write-Host "[enable] nssm restart $ServiceName => $(if ($rs.Ok) { 'ok' } else { "失败 exit $($rs.ExitCode)" })"
    if (-not $rs.Ok) { Write-Host '         config 是启动快照,不重启则新键不进进程 ⇒ 请人工重启。' -ForegroundColor Yellow }
  } elseif ($blockChanged) {
    Write-Host "[enable] 未重启。生效必须重启(config 启动时一次性解析 process.env):" -ForegroundColor Yellow
    Write-Host "         nssm restart $ServiceName"
  }

  # ---- 7) 下一步(只打印,绝不代表用户执行)------------------------------
  Write-Host ''
  Write-Host '[enable] 下一步:在 GitHub 仓库设置该 secret 与 vars.IHUI_UNATTENDED_INTAKE_API_URL'
  Write-Host '         (本脚本**不碰 GitHub API** —— 半途改配置会让 CI 从"缺配置"变成"投不出去",更难归因。)'
  Write-Host '         可复制(在能跑 gh 且已登录的机器上执行;< 重定向避免密钥进命令行参数与 shell 历史):'
  Write-Host "           gh secret set IHUI_UNATTENDED_INTAKE_WEBHOOK_SECRET --repo IHUI-INF-AI/IHUI-AI < `"$secretPath`""
  Write-Host '           gh variable set IHUI_UNATTENDED_INTAKE_API_URL --repo IHUI-INF-AI/IHUI-AI --body "https://aizhs.top"'
  Write-Host '         再核查:服务端已配置但库里没有 ci_failed / gate_failed 的触发规则时,'
  Write-Host '               路由回 200 + accepted:false(no_matching_trigger)⇒ CI 会绿而实际没入队。'
  Write-Host '               见 apps/api/src/routes/github-webhook.ts:107-111。'
  return 0
}

function Invoke-ProbePath {
  # 只读:解析凭据落点并打印三态结论。不碰 nssm、不建目录、不写文件。
  $r = Resolve-SecretTarget -RepoRootPath $RepoRoot -Sub $KeySubDir -Name $KeyFileName
  Write-Host "[probe] 子目录 = $KeySubDir   文件名 = $KeyFileName"
  Write-Host "[probe] 状态 = $($r.State)"
  Write-Host "[probe] 落点 = $(if ([string]::IsNullOrEmpty($r.Path)) { '(不给路径)' } else { $r.Path })"
  if ($r.Note) { Write-Host "[probe] 说明 = $($r.Note)" }
  if ($r.State -eq 'Existing') {
    $exists = Test-Path -LiteralPath $r.Path
    Write-Host "[probe] 复核 Test-Path = $exists"
    # 刻意不问文件内容:存在性够用来判断"落点对不对",内容一问候就可能进日志。
    if ($exists) { Write-Host '[probe] 该文件存在,直接 -Apply 即可复用同一把密钥。' }
  } elseif ($r.State -eq 'ToCreate') {
    Write-Host '[probe] 该落点尚不存在 ⇒ -Apply 时会先建用途子目录再写一行裸口令。'
    Write-Host '[probe] 注意:凭据根常在网盘同步目录里,未 -Apply 前本脚本对它零写入。'
  } else {
    Write-Host '[probe] 无法判定 ⇒ 这不是"凭据失效"。' -ForegroundColor Yellow
    Write-Host "         诊断:node scripts/secret-path.mjs --explain $KeySubDir $KeyFileName"
  }
  return @{ Existing = 0; ToCreate = 0; Undetermined = 2 }[$r.State]
}

if ($SelfTest) { exit (Invoke-SelfTest) }
if ($ProbePath) { exit (Invoke-ProbePath) }
exit (Invoke-Enable)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
