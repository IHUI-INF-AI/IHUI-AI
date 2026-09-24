# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# IHUI-AI 轻量运维监控服务 — 由 Windows 服务 "IHUI-MONITOR" 托管(NSSM)
# =============================================================================
# 每 5 分钟巡检:
#   1. 本地端口 8801/8802/8803 是否监听
#   2. 公网 aizhs.top / api.aizhs.top 是否可达
#   3. 磁盘剩余(阈值 10GB)
#   4. 数据库备份新鲜度(< 26h 视为正常)
# 异常写入 D:\DevEnv\logs\monitor-alerts.log(带时间戳)
#
# 2026-08-09 增强:报警消息自动附带【原因诊断】——
#   检测到异常时,自动收集 部署锁/最近构建时间/服务进程启动时间/隧道连通性,
#   在推送内容中给出最可能的原因标签,让你在告警邮件里一眼看懂:
#     [部署重启中-预期现象]   → 构建/部署正在进行,服务重启导致的短暂不可用
#     [服务进程异常]         → 进程不在/已退出,需人工介入
#     [公网隧道异常]         → 本地服务正常但公网连不上(Cloudflare 隧道问题)
#     [网络波动]             → 单次超时,本地服务正常
#
# 通知通道(2026-09-24 收口:唯一出口是「智汇通报」品牌邮件)
#   旧版在此文件内联了 Server酱 SendKey + PushPlus token + 企微机器人 webhook 三条第三方通道,
#   全部已删。删除依据(不是清理偏好,是实测失灵):
#     ① 三条通道都只发**纯文本**,用户投诉的"收到的邮件没有样式"正源于此类旁路;
#     ② Server酱 免费额度 5 条/天,monitor-alerts.log 里 "Server酱推送失败" 累计 5.5 万行,
#        今日实测返回 code=471「超过当天的发送次数限制[5]」——即巡检发现的 cdn(80)/api(8802)
#        异常**根本没有送达任何人**,通道看着在、实际是哑的;
#     ③ 密钥内联在脚本里(AGENTS.md §5d:密钥不入仓、不入脚本)。
#   邮件侧不设"每日 N 封"封顶:那是第三方免费配额时代的自保措施,自建 SMTP 没有该约束;
#   限制只按**告警身份**去重(见 $AlertRepeatHours),持续故障按周期重发并标注持续时长。
# 日志: D:\DevEnv\logs\monitor.log(NSSM AppStdout)
#
# 落点说明:本文件是**入库源**(deploy/win/),NSSM 服务 IHUI-MONITOR 的 AppParameters 指向
#   deploy/prod-bundle/monitor.ps1 —— 那是一份 gitignore 的转发壳(与 alert-webhook-bridge.cjs
#   同源做法)。此前 monitor.ps1 只存在于 gitignore 目录里,仓库无源、守门不可见、改一次需手工
#   拷一次,现已收口;换机/重装需重新写那份转发壳(三行,见 README)。
#
# 用法:
#   常驻     :由 IHUI-MONITOR 服务经转发壳拉起,不带参数
#   验一轮   :pwsh -File deploy/win/ihui-monitor.ps1 -Once -DryRun
#             (跑完整巡检 + 完整调用链,不真发信、不动服务的去重档案)
#   验到人   :pwsh -File deploy/win/ihui-monitor.ps1 -ProbeMail
#             (发一封【核验信】标题的品牌邮件;通知路径的唯一真凭据是"信到了且带版式")
#   环境变量 :IHUI_MONITOR_ALERT_LOG / IHUI_MONITOR_STATE_FILE / IHUI_MONITOR_UNDEL_FILE /
#             IHUI_MONITOR_BUILD_LOG_DIR / IHUI_MONITOR_REPEAT_HOURS / IHUI_MONITOR_MAIL_DRY_RUN
#             —— 存在意义是让 -Once 自检与常驻服务**各写各的状态**;共用一份会互相吞告警
#             (自检把 sig 记进档案,服务随后巡检即判"已寄过",于是真故障静默)。
# =============================================================================
param(
    # -Once 跑完一轮巡检即退出:供人工/CI 验证通知链路用,不需要停服务。
    [switch]$Once,
    # -ProbeMail 不巡检,只发一封自检邮件并退出(0=已送达)。与 bridge 的 --mail-dry-run 同族:
    # 通知路径的唯一真凭据是"信到了且带版式",而这条只能实测,不能靠读代码断定。
    [switch]$ProbeMail,
    # -DryRun 配合 -Once / -ProbeMail:跑完整调用链(含派发器),但不真发信。用于"改了参数
    # 组装就想验"的场景,不消耗邮箱。
    [switch]$DryRun
)
$ErrorActionPreference = "Continue"

# 仓库根按 $PSScriptRoot 推导,不写死盘符:本仓从 G: 迁到 D: 时,写死绝对路径的脚本集体失效过
# 一次(AGENTS.md 顶部说明)。取不到再回落到本机实际路径。
$Root = if ($PSScriptRoot) { Split-Path $PSScriptRoot -Parent | Split-Path -Parent } else { 'D:\IHUI-AI' }
if (-not (Test-Path (Join-Path $Root 'package.json'))) { $Root = 'D:\IHUI-AI' }

# 运行态路径一律可被环境变量覆盖:否则 -Once 自检会写进服务的去重档案与告警日志,
# 自检与服务互相吞告警(互相以为"对方已发过")。
function EnvOr([string]$name, [string]$default) {
  $v = if (Test-Path "env:$name") { (Get-Item "env:$name").Value } else { $null }
  if ($v) { return $v }
  return $default
}

$alertLog = EnvOr 'IHUI_MONITOR_ALERT_LOG' 'D:\DevEnv\logs\monitor-alerts.log'

# 诊断用路径
$deployLockDir = Join-Path $Root '.deploy.lock'                    # 部署并发锁(存在=有部署/构建在跑)
# 构建日志目录:与 scripts/build-next-prod.ps1 的 $LogDir 同址。旧值写的是
# "D:\IHUI-AI\.trae-cn\tmp\next-build-node22\logs" —— 该目录在本机从不存在,于是
# Get-LastBuildTime 恒返回 $null,"最近构建于…"这条诊断分支**一直是死的**(不是偶尔不准)。
$buildLogDir = EnvOr 'IHUI_MONITOR_BUILD_LOG_DIR' (Join-Path $Root '.ihui-agent/tmp/next-build-node22/logs')
# 部署环自身的流水(build-next-prod 由部署环调用时才会写上面那个目录,而本机部署环写的是这份日志,
# 所以取两者中更新的一个,否则该诊断分支在本机仍然恒死)。
$deployLoopLog = Join-Path $Root 'deploy/win/deploy-loop.log'
$webSvcName     = "IHUI-WEB"; $apiSvcName = "IHUI-API"; $aiSvcName = "IHUI-AI-SERVICE"

# ── 邮件出口配置(与 ihui-deploy.ps1 / alert-webhook-bridge.cjs 同源)──────────────
$NotifyEmailTo       = EnvOr 'ALERT_EMAIL_TO' '502319984@qq.com'
$BrandNotifyScript   = Join-Path $Root 'apps\api\scripts\notify-deploy-failure.ts'
$BrandTsxEntry       = Join-Path $Root 'apps\api\node_modules\tsx\dist\cli.mjs'
$BrandNotifyMsgDir   = Join-Path $Root '.ihui-agent\tmp\monitor-notify'
# 去重状态与"未送达"标记放仓库外(与 bridge 同目录):本脚本由 NSSM 以 LocalSystem 跑,
# 且这些是运行态,不是产物。
$MonitorStateFile    = EnvOr 'IHUI_MONITOR_STATE_FILE' 'D:\DevEnv\state\ihui-monitor-state.json'
$UndelFile           = EnvOr 'IHUI_MONITOR_UNDEL_FILE' 'D:\DevEnv\state\ihui-monitor-UNDELIVERED.json'
$MailDryRun          = (EnvOr 'IHUI_MONITOR_MAIL_DRY_RUN' '') -eq '1'
if ($DryRun) { $MailDryRun = $true }
# 同一告警身份的重发周期(小时)。这是**按身份去重**,不是总量封顶 —— 没有任何"每日 N 封"
# 计数闸(成因见文件头)。5 分钟一轮巡检若按轮次发,一条持续故障一天就是 288 封。
$AlertRepeatHours    = [double](EnvOr 'IHUI_MONITOR_REPEAT_HOURS' '4')

function Log($m) { "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $m" | Add-Content $alertLog -Encoding utf8 }

function Resolve-NodeExe {
  # NSSM(LocalSystem)服务上下文的 PATH 常常没有 node,Get-Command 落空后必须按绝对路径兜底。
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($cmd -and (Test-Path $cmd.Source)) { return $cmd.Source }
  foreach ($p in @('D:\DevEnv\runtimes\node\node.exe', 'C:\Program Files\nodejs\node.exe')) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

function Protect-NotifyOutput {
  # 转日志前截断 + 脱敏:契约脚本自身不打印密钥,但 node 崩溃时会把 .env 片段/整条命令行倒进
  # stderr,含 key/token/secret/pass 字样的行一律不落运维日志。
  param($Raw)
  if (-not $Raw) { return '(无输出)' }
  $lines = (($Raw | ForEach-Object { "$_" }) -split "`r?`n") | ForEach-Object {
    if ($_ -match '(?i)(api[_-]?key|token|secret|passw|pass\b|authorization|bearer)') { '[已脱敏]' } else { $_ }
  }
  $s = ($lines -join ' / ').Trim()
  if ($s.Length -gt 300) { $s = $s.Substring(0, 300) + '…(截断)' }
  return $s
}

function Invoke-BrandMail {
  # 邮件的唯一出口。返回 $true = 已送达(派发器 --strict 下 exit 0 即成功)。
  # -Plain = 同一传输层但不套品牌模板,只由 Send-Alert 在品牌通道失败后作降级用。
  param([string]$Subject, [string]$BodyText, [switch]$Plain)
  $node = Resolve-NodeExe
  if (-not $node) { Log "MAIL 未送达:node.exe 未找到(PATH 与绝对路径兜底均落空)"; return $false }
  if (-not (Test-Path $BrandTsxEntry)) { Log "MAIL 未送达:tsx 入口不存在 $BrandTsxEntry"; return $false }
  if (-not (Test-Path $BrandNotifyScript)) { Log "MAIL 未送达:通知脚本不存在 $BrandNotifyScript"; return $false }
  $msgFile = $null
  try {
    if (-not (Test-Path $BrandNotifyMsgDir)) { New-Item -ItemType Directory -Path $BrandNotifyMsgDir -Force | Out-Null }
    # 多行中文正文必须走 --message-file(命令行参数还要过一层 GBK 控制台代码页);写入必须无
    # BOM —— 5.1 的 Set-Content -Encoding utf8 带 BOM,BOM 会排在正文第一个字符前。
    $text = if ($Plain) { "[降级纯文本]`n$BodyText" } else { $BodyText }
    $msgFile = Join-Path $BrandNotifyMsgDir "$((Get-Date).ToString('yyyyMMdd-HHmmss-fff')).txt"
    [System.IO.File]::WriteAllText($msgFile, $text, [System.Text.UTF8Encoding]::new($false))
    $argv = @($BrandTsxEntry, $BrandNotifyScript,
      '--to', $NotifyEmailTo, '--title', $Subject, '--severity', 'critical',
      '--source', 'ihui-monitor', '--message-file', $msgFile, '--strict')
    if ($Plain) { $argv += '--plain' }
    if ($MailDryRun) { $argv += '--dry-run' }
    # 5.1 下原生命令写 stderr + EAP=Stop 会抛 NativeCommandError,把"按退出码判定"变成"按异常
    # 判定",成功发送也可能被误判成失败并触发一次重复的 --plain 降级。PS7 下这句无害。
    $prevEap = $ErrorActionPreference
    try {
      $ErrorActionPreference = 'Continue'
      $out = & $node @argv 2>&1
      $code = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $prevEap
    }
    if ($code -eq 0) { return $true }
    Log "MAIL 通道未送达(exit=$code): $(Protect-NotifyOutput $out)"
    return $false
  } catch {
    Log "MAIL 通道调用异常: $(Protect-NotifyOutput $_.Exception.Message)"
    return $false
  } finally {
    if ($msgFile) { Remove-Item -LiteralPath $msgFile -Force -ErrorAction SilentlyContinue }
  }
}

function Test-AlertDue {
  # 按**告警身份**去重,状态跨进程重启持久(NSSM 硬杀不走 SIGINT,内存态会随进程丢)。
  # 返回 @{ Due=$true|$false; Note='持续时长/重发序号' }
  param([string]$Sig)
  $state = $null
  try { $state = Get-Content $MonitorStateFile -Raw -ErrorAction Stop | ConvertFrom-Json } catch { $state = $null }
  $now = Get-Date
  $sigFirstTs = $null
  $repeatNo = 0
  if ($state -and [string]$state.sig -eq $Sig -and $state.sigTs) {
    $prevTs = $null
    try { $prevTs = [datetime]$state.sigTs } catch { $prevTs = $null }
    if ($prevTs) {
      $ageH = ($now - $prevTs).TotalHours
      if ($ageH -ge 0 -and $ageH -lt $AlertRepeatHours) {
        return @{ Due = $false; Note = "同身份告警 $([Math]::Round($ageH,1))h 前已寄过(未到 ${AlertRepeatHours}h 重发周期)" }
      }
      try { if ($state.sigFirstTs) { $sigFirstTs = [datetime]$state.sigFirstTs } } catch { $sigFirstTs = $null }
      if (-not $sigFirstTs) { $sigFirstTs = $prevTs }
      $repeatNo = [int]$state.repeatNo + 1
    }
  }
  if (-not $sigFirstTs) { $sigFirstTs = $now }
  $durH = [Math]::Round(($now - $sigFirstTs).TotalHours, 1)
  $note = if ($repeatNo -gt 0) { "`n- 备注: 同一故障已持续 ${durH} 小时,本条为第 $($repeatNo + 1) 次重发(每 $AlertRepeatHours 小时一次,身份变化则立即另发)" } else { '' }
  $props = [ordered]@{ sig = $Sig; sigTs = $now.ToString('o'); sigFirstTs = $sigFirstTs.ToString('o'); repeatNo = $repeatNo; lastSend = $now.ToString('o') }
  try {
    $dir = Split-Path $MonitorStateFile -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $json = ConvertTo-Json $props -Depth 4
    [System.IO.File]::WriteAllText($MonitorStateFile, $json, [System.Text.UTF8Encoding]::new($false))
  } catch { Log "STATE 去重状态写入失败(不阻塞告警,但重启后可能重发一次): $($_.Exception.Message)" }
  return @{ Due = $true; Note = $note }
}

function Write-Undelivered {
  # 两条通道都失败时必须**留下响声**:过去 Server酱静默失败 5.5 万行,期间没有任何人收到告警。
  param([string]$Subject, [string]$BodyText, [string]$Why)
  $rec = @{ at = (Get-Date).ToString('o'); to = $NotifyEmailTo; subject = $Subject; reason = $Why; body = $BodyText }
  try {
    $dir = Split-Path $UndelFile -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $json = ConvertTo-Json $rec -Depth 4
    [System.IO.File]::WriteAllText($UndelFile, $json, [System.Text.UTF8Encoding]::new($false))
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 邮件两条通道均未送达,已写 $UndelFile" -ForegroundColor Red
  } catch {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 邮件未送达且 UNDELIVERED 标记也写失败: $($_.Exception.Message)" -ForegroundColor Red
  }
}

function Send-MailAlert {
  # 供巡检与自检共用:先品牌模板,失败再 --plain 降级,两条都失败写 UNDELIVERED。
  param([string]$Subject, [string]$BodyText)
  # $MailDryRun 时**照样走完 Invoke-BrandMail**(只是 argv 多带 --dry-run,派发器组装完不发信),
  # 早退会让"未发信"变成"未调用" —— 那正是本开关要验的那一段链路,不能跳。
  # 但结论措辞必须分开:dry-run 下 exit 0 只代表组装通过,写成"已送达"就是假结论。
  $verdict = if ($MailDryRun) { '[dry-run] 组装与调用链通过(未发信)' } else { '已送达' }
  if (Invoke-BrandMail -Subject $Subject -BodyText $BodyText) {
    if (-not $MailDryRun) { Remove-Item -LiteralPath $UndelFile -Force -ErrorAction SilentlyContinue }
    Log "MAIL $verdict $NotifyEmailTo (品牌模板)"
    return $true
  }
  Log "MAIL 品牌模板通道失败,转 --plain 降级重试"
  if (Invoke-BrandMail -Subject $Subject -BodyText $BodyText -Plain) {
    if (-not $MailDryRun) { Remove-Item -LiteralPath $UndelFile -Force -ErrorAction SilentlyContinue }
    Log "MAIL $verdict $NotifyEmailTo (降级纯文本)"
    return $true
  }
  if ($MailDryRun) {
    Log "MAIL [dry-run] 两条通道均未通过(未发信,故不写 UNDELIVERED 标记): $Subject"
    return $false
  }
  Write-Undelivered -Subject $Subject -BodyText $BodyText -Why '品牌模板与降级纯文本两条通道均未送达'
  Log "MAIL 发送失败:两条通道均未送达 $NotifyEmailTo"
  return $false
}

function Test-PortL($port) {
  return [bool](netstat -ano | Select-String ":$port\s" | Select-String "LISTENING")
}

# 取某端口监听进程的 PID(无则返回空)
function Get-PortPid($port) {
  $line = netstat -ano | Select-String ":$port\s" | Select-String "LISTENING" | Select-Object -First 1
  if ($line) {
    $parts = $line.Line.Trim() -split '\s+'
    return $parts[-1]
  }
  return $null
}

# 最近构建时间(返回 "MM-dd HH:mm" 或空)
function Get-LastBuildTime {
  $log = Get-ChildItem "$buildLogDir\next-build-node22-*.log" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($log) { return $log.LastWriteTime.ToString("HH:mm") }
  # 上面那个目录只有**直接**跑 scripts/build-next-prod.ps1 时才会写;本机部署环(IHUI-DEPLOYLOOP)
  # 写的是自己的 deploy-loop.log。取两者中更新的一个,否则这条诊断分支在本机恒为 $null。
  if (Test-Path $deployLoopLog) {
    return (Get-Item $deployLoopLog).LastWriteTime.ToString("HH:mm")
  }
  return $null
}

# 生成【原因诊断】段:根据当前状态推断最可能原因
function Get-Diagnosis {
  $lines = @()
  $now = Get-Date
  $deployLockExists = Test-Path $deployLockDir
  $lastBuild = Get-LastBuildTime
  $buildAgeMin = $null
  if ($lastBuild) {
    $bt = [datetime]::ParseExact((Get-Date -Format 'yyyy-MM-dd') + " $lastBuild", "yyyy-MM-dd HH:mm", $null)
    # Get-LastBuildTime 只给 "HH:mm"。跨零点时(昨晚 23:50 构建、现在 00:20)按今天拼会拼出
    # 一个未来时间 → 时长为负 → 下面 -le 15 命中并打出"约 -1430 分钟前"这种自相矛盾的结论。
    if ($bt -gt $now) { $bt = $bt.AddDays(-1) }
    $buildAgeMin = [math]::Round(($now - $bt).TotalMinutes, 0)
  }

  # 1) 部署锁存在 → 正在构建/部署(最可能原因)
  if ($deployLockExists) {
    $lines += "[部署重启中-预期现象] 检测到部署锁(.deploy.lock),有构建/部署正在进行,服务重启导致的短暂不可用属正常,数分钟内自动恢复"
    return ($lines -join "`n")
  }

  # 2) 最近 15 分钟内有构建完成 → 刚部署完,服务重启中
  if ($lastBuild -and $buildAgeMin -le 15) {
    $lines += "[部署重启中-预期现象] 最近构建于 $lastBuild(约 ${buildAgeMin} 分钟前)完成,服务重启中,预计很快恢复"
    return ($lines -join "`n")
  }

  # 3) 服务进程诊断:哪个没监听
  $portMap = @(
    @{ n = "web(8801)";  p = 8801; svc = $webSvcName },
    @{ n = "api(8802)";  p = 8802; svc = $apiSvcName },
    @{ n = "ai(8803)";   p = 8803; svc = $aiSvcName }
  )
  $downPorts = @()
  foreach ($m in $portMap) {
    if (-not (Test-PortL $m.p)) {
      $pid2 = Get-PortPid $m.p
      if ($pid2) { $downPorts += "$($m.n) 端口无监听但进程存在(pid=$pid2)" }
      else       { $downPorts += "$($m.n) 端口无监听,进程也不在" }
    }
  }
  if ($downPorts.Count -gt 0) {
    $svcStates = @()
    foreach ($m in $portMap) {
      $st = (Get-Service -Name $m.svc -ErrorAction SilentlyContinue).Status
      if ($st) { $svcStates += "$($m.svc)=$st" }
    }
    $lines += "[服务进程异常] " + ($downPorts -join "; ") + " | 服务状态: " + ($svcStates -join ", ")
    return ($lines -join "`n")
  }

  # 4) 本地端口正常但公网异常 → 隧道问题
  $localOk = (Test-PortL 8801) -and (Test-PortL 8802) -and (Test-PortL 8803)
  if ($localOk) {
    $lines += "[公网隧道异常] 本地 8801/8802/8803 全部正常,但公网访问失败 → Cloudflare 隧道或网络链路问题,可检查 Cloudflared 服务"
    return ($lines -join "`n")
  }

  # 5) 兜底
  $lines += "[网络波动或瞬态] 本地服务状态不明,建议稍后人工确认"
  return ($lines -join "`n")
}

function Send-Alert($msg) {
  $diag = Get-Diagnosis
  # 去重身份只取**异常清单**,不含诊断段:诊断里的构建时间/pid/持续分钟每轮都变,
  # 拿它当身份等于没去重(5 分钟一轮 → 一条持续故障一天 288 封)。
  $sig = ($msg -replace '\s+', ' ').Trim()
  $due = Test-AlertDue -Sig $sig
  if (-not $due.Due) {
    Write-Host "$(Get-Date -Format 'HH:mm:ss') 告警按身份去重跳过: $($due.Note)" -ForegroundColor DarkYellow
    return
  }
  $full = "$msg`n--------------------------------`n[原因诊断] $diag$($due.Note)"
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [ALERT] $msg | 诊断: $($diag -replace '`n', ' | ')" | Add-Content $alertLog -Encoding utf8
  Send-MailAlert -Subject "[IHUI-AI 监控告警] $sig" -BodyText $full | Out-Null
}

Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 监控服务启动 — 通知唯一出口:品牌邮件 $NotifyEmailTo(按告警身份去重,每 $AlertRepeatHours 小时重发一次,无每日总量封顶)"

if ($ProbeMail) {
  $diag = Get-Diagnosis
  $body = "本信由 IHUI-MONITOR 的 -ProbeMail 发出,用于核验监控告警的邮件通道与版式(不是故障)。**发送方**:deploy/win/ihui-monitor.ps1 → apps/api/scripts/notify-deploy-failure.ts。**当前巡检快照**:`n$diag"
  if (Send-MailAlert -Subject '【核验信】IHUI-MONITOR 告警邮件通道自检' -BodyText $body) {
    Write-Host "PROBE 已送达 $NotifyEmailTo" -ForegroundColor Green
    exit 0
  }
  Write-Host "PROBE 未送达,详见 $alertLog 与 $UndelFile" -ForegroundColor Red
  exit 1
}

# -Once:跑满一轮即退出(巡检 + 必要的告警发送),供人工/CI 验证通知链路,不停服务。
while ($true) {
  $alerts = @()

  # 1. 本地端口
  #    旧清单里还有一项 @{n="cdn(80)";p=80},已删。本机 aizhs.top 的公网入口是 **token 模式的
  #    Cloudflared 服务**(outbound 长连接,deploy/prod-bundle/cloudflared/config.yml 自述"当前
  #    部署默认用 token 模式,本文件仅作备选"),它**从不在本机 80 上监听** ⇒ "cdn(80) 未监听"
  #    不是故障,是该拓扑下的恒真误报。此前它无人可见,只因微信腿已被配额打死;邮件腿一通,
  #    它就会每 $AlertRepeatHours 小时寄一封真信报警一个不存在的故障 —— 所以摘通道的同一次
  #    改动里必须一起修,否则修好的是"送不到",弄坏的是"报得准"。
  foreach ($p in @(@{n="web(8801)";p=8801}, @{n="api(8802)";p=8802}, @{n="ai(8803)";p=8803})) {
    if (-not (Test-PortL $p.p)) { $alerts += "$($p.n) 未监听" }
  }

  # 1b. 公网入口的**进程侧**判据:隧道服务在不在,而不是本机有没有监听 80。
  #     可达性由第 2 组 URL 探测负责,两段互补,不再用端口冒充链路状态。
  try {
    $cf = Get-Service -Name 'Cloudflared' -ErrorAction Stop
    if ($cf.Status -ne 'Running') { $alerts += "Cloudflared 服务状态 $($cf.Status)(公网入口将不可达)" }
  } catch { $alerts += 'Cloudflared 服务不存在(本机未装或已改名,公网入口无进程)' }

  # 2. 公网(2026-08-09 加"连续 2 次确认":单次瞬时失败不报警,重测一次仍失败才记录,
  #    过滤 Cloudflared 隧道重连/瞬时抖动导致的误报)
  foreach ($u in @("https://aizhs.top/", "https://aizhs.top/api/health", "https://bsm.aizhs.top/", "https://api.aizhs.top/api/health", "https://aizhs.top/tabbar/tabbar/home.png")) {
    $code1 = $null
    try {
      $r = Invoke-WebRequest -Uri $u -Method Head -TimeoutSec 15 -ErrorAction Stop
      if ($r.StatusCode -ge 400) { $code1 = "HTTP $($r.StatusCode)" }
    } catch {
      $code1 = "ERR"; if ($_.Exception.Response) { $code1 = [int]$_.Exception.Response.StatusCode }
    }
    if ($null -eq $code1) { continue }   # 第一轮正常

    # 第一轮异常 → 立即重测一次确认
    Start-Sleep -Seconds 3
    $code2 = $null
    try {
      $r2 = Invoke-WebRequest -Uri $u -Method Head -TimeoutSec 15 -ErrorAction Stop
      if ($r2.StatusCode -ge 400) { $code2 = "HTTP $($r2.StatusCode)" }
    } catch {
      $code2 = "ERR"; if ($_.Exception.Response) { $code2 = [int]$_.Exception.Response.StatusCode }
    }
    if ($null -eq $code2) {
      Write-Host "$(Get-Date -Format 'HH:mm:ss') 瞬时抖动已恢复(仅记录): $u 首次$code1 → 重测正常" -ForegroundColor DarkYellow
      Add-Content $alertLog "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [INFO] 瞬时抖动已恢复(不推送): $u 首次$code1 → 重测正常" -Encoding utf8
    } else {
      $alerts += "$u → $code2 (连续2次确认)"
    }
  }

  # 3. 磁盘
  try {
    $d = Get-PSDrive (Get-Location).Drive.Name
    $freeGB = [math]::Round($d.Free / 1GB, 1)
    if ($freeGB -lt 10) { $alerts += "磁盘剩余 ${freeGB}GB(<10GB)" }
  } catch {}

  # 4. 备份新鲜度
  try {
    $latest = Get-ChildItem "D:\DevEnv\backups\pg\ihui_dev_*.dump" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $latest) { $alerts += "无数据库备份文件" }
    elseif (((Get-Date) - $latest.LastWriteTime).TotalHours -gt 26) { $alerts += "备份已超过 26h 未更新(最新:$($latest.Name))" }
  } catch {}

  # 汇总
  if ($alerts.Count -gt 0) {
    Send-Alert ($alerts -join " | ")
    Write-Host "$(Get-Date -Format 'HH:mm:ss') 异常: $($alerts -join '; ')" -ForegroundColor Red
  } else {
    Write-Host "$(Get-Date -Format 'HH:mm:ss') 全部正常" -ForegroundColor Green
  }

  if ($Once) { break }

  if ($Once) { break }

  Start-Sleep -Seconds 300   # 5 分钟
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
