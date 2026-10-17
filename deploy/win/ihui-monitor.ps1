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
#   "部署重启中-预期现象"这一类抑制另有**时长上限**($ExpectedWindowGraceMinutes,默认 20 分钟):
#   没有上限的抑制等于永久豁免,而永久豁免的症状就是安静 —— 09-29 那场 2 小时 39 分的 API 崩溃循环
#   正是被无条件抑制掩掉的,判据在 alert-dedup.ps1 的 Test-AlertSuppressionGrace。
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
#             IHUI_MONITOR_BUILD_LOG_DIR / IHUI_MONITOR_REPEAT_HOURS /
#             IHUI_MONITOR_EXPECTED_WINDOW_GRACE_MIN / IHUI_MONITOR_MAIL_DRY_RUN /
#             IHUI_MONITOR_DISK_LETTER
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
# 一次(AGENTS.md 顶部说明)。推导收敛到唯一实现 ihui-root-common.ps1(与 install-*-service.ps1
# 同一份判据,禁止各写一遍 Split-Path 向上爬):$env:IHUI_ROOT 覆盖 → 自本文件目录逐级向上找
# package.json → git toplevel → 回落旧根。旧版是"向上爬两层 + 手工 Test-Path 回落字面量"
# 的半吊子版本:盘符回萔回 D:\IHUI-AI,换机后解析出另一个根。
. (Join-Path $PSScriptRoot 'ihui-root-common.ps1')
$Root = Resolve-IhuiProjectRoot -StartDir $PSScriptRoot

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
# "按预期现象抑制"的时长上限(分钟)。09-28 我加抑制时只写了"这一轮不寄",没写"最多不寄多久",
# 于是 22:17:49→00:57:11 那场 API 崩溃循环被每轮 [INFO] 掩了 2 小时 39 分(成因与判据见 alert-dedup.ps1 的
# Test-AlertSuppressionGrace)。默认 20 分钟 = 4 轮巡检:一次正常换流窗口实测 6-9 秒拒连,
# 最慢的整包重建也远短于此,所以连续 20 分钟仍报"部署重启中"只可能是别的东西坏了。
$ExpectedWindowGraceMinutes = [int](EnvOr 'IHUI_MONITOR_EXPECTED_WINDOW_GRACE_MIN' '20')

# 被检盘卷按配置定(2026-10-17 立,替换旧 `(Get-Location).Drive.Name`)。
# 取证(2026-10-17 本机现读 `nssm get IHUI-MONITOR`,只读未改):
#   Application   = C:\windows\System32\WindowsPowerShell\v1.0\powershell.exe
#   AppParameters = -NoProfile -ExecutionPolicy Bypass -File D:\DevEnv\ihui-prod\deploy\prod-bundle\monitor.ps1
#   AppDirectory  = D:\DevEnv\ihui-prod\deploy\prod-bundle   (NSSM 把服务 cwd 设到这里)
# 旧实现的"检哪个卷"由进程当前目录决定:服务在跑时恰好等于 AppDirectory 所在盘(本机 D),
# 而人工 -Once 验一轮取的是终端 cwd —— 启动形态不同 ⇒ 身份里的 `卷=` 字段不同 ⇒ 同一次满盘
# 占多个身份槽、4h 去重结构上失效(与 Get-DiskFreeTier 头注那族"实时抖动量进身份"同型缺陷,
# 这一格的抖动量是"盘符随 cwd 漂")。AppDirectory=D 是部署现状,不是配置语义,不能当判据。
# 配置语义 = 告警落点所在卷:alertLog / 去重档案 / 备份归档所在卷满了,监控自己先哑。
# 默认取 $alertLog 的盘符,可用 IHUI_MONITOR_DISK_LETTER 显式覆盖;两者都取不到 ⇒ 磁盘维
# 在巡检段显式落"未判定"(§0.3,不回落进程 cwd,也不折成"磁盘正常")。
$MonitoredDrive = EnvOr 'IHUI_MONITOR_DISK_LETTER' ''
if (-not $MonitoredDrive) {
  $q = Split-Path $alertLog -Qualifier   # 形如 'D:'
  if ($q) { $MonitoredDrive = ($q -replace '[:\\]', '') }
}

function Log($m) { "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $m" | Add-Content $alertLog -Encoding utf8 }

# ── 去重实现只有一份(alert-dedup.ps1,与本文件同目录)────────────────────────────
# 2026-09-28 起本文件的 Test-AlertDue 退化成**适配器**:去重逻辑住在共享模块里。
# 立因:部署环与监控两侧各写过一遍"按签名去重",而两份共用同一条致命结构缺陷 ——
# 状态文件只有一个槽,于是同一故障的两条措辞交替出现时互相抹掉对方的时间戳,
# 4h 窗口结构上永不命中(实测 48h 寄出 47 封)。两处各写一遍必然漂开,故收成一份。
. (Join-Path $PSScriptRoot 'alert-dedup.ps1')

# ── 并发锁判据:与 ihui-deploy-loop.ps1 / ihui-deploy.ps1 **共用同一份实现**
#    (deploy-lock-common.ps1)。2026-10-04 接入,理由见 Get-Diagnosis 第 1 分支的注释:
#    此前本脚本裸 Test-Path,把"锁文件在盘上"当成"真有部署在跑",而部署崩在收尾之前
#    留下的锁永不过期 ⇒ 每轮巡检都自称"部署重启中"并据此抑制真告警。
#    找不到就大声死,不得退回裸 Test-Path 继续跑(同 ihui-deploy-loop.ps1:98-104 的处置):
#    静默退回旧判据 = 把本条修复变成一个永远不生效的选项。
$LockCommon = Join-Path $PSScriptRoot 'deploy-lock-common.ps1'
if (-not (Test-Path -LiteralPath $LockCommon)) {
    Write-Host "FAIL  缺少并发锁判据:$LockCommon(监控拒绝启动,不退回裸 Test-Path 判据)"
    exit 1
}
. $LockCommon

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
  # 适配器:判定住在共享模块 alert-dedup.ps1 的 Test-AlertDueByIdentity(**按签名分槽**持久)。
  # 保留这个函数名与 { Due; Note } 返回形态,是为了不改上面 Send-Alert 那一处调用点;
  # 真正的缺陷修复在模块里 —— 旧实现在此处自持"单槽"状态,是 47 封/48h 的成因。
  param([string]$Sig)
  return Test-AlertDueByIdentity -Sig $Sig -StateFile $MonitorStateFile -RepeatHours $AlertRepeatHours
}

# ── 告警身份的档位判据(2026-10-17 立,纯函数:不打日志、不取盘、无副作用)────────────
# 为什么必须有这一层:本脚本每 300 秒一轮(见扫描段 Start-Sleep),而磁盘剩余读数**每轮都在变**;
# 把实时读数写进身份串 = 每轮一个新身份 = $AlertRepeatHours(4h)结构上永不命中 —— 与
# alert-dedup.ps1 头注记的"48h 寄出 47 封"、ihui-deploy.ps1 的 Note-MigrateFailure
# (旧 `$sig = "$reason|$pendingTxt"`)是同一条缺陷(第三型:去重身份里放实时抖动的量)。
# 正解只有档位化:身份只留"落到哪一档",实时读数进正文
# (见 Send-Alert 的 $detail)。跨档 ⇒ 新身份当场重报;同档持续 ⇒ 由 4h 窗压住。
function Get-DiskFreeTier {
  # 磁盘剩余(GB)→ 阈值档位标签。边界**不新造数**,两处都是现读既有阈值:
  #   · 10GB = 本文件巡检阈值(扫描段 "<10GB";文件头 :11「磁盘剩余(阈值 10GB)」;
  #     同值另见 deploy/scripts/prod-bundle/health-check.ps1:156「磁盘剩余 < 10GB(危险…)」)
  #     —— 10GB 这一档留在调用点当**闸门**(与改动前逐字同判),不在这函数里重复。
  #   · 1GB  = scripts/git-push-guard.mjs:414 `DISK_MIN_FREE_BYTES = 1 * 1024 * 1024 * 1024`
  #     (:427 现读文案「磁盘剩余空间仅 XGB(<1GB),拒绝推送:满盘环境会让 worker 无声崩死」)
  #     —— 同一条生产链上"磁盘剩余"这一维已有的第二档,即"满盘级"。
  # ⇒ 告警面档 = 'lt1GB' / '1-10GB';任务书举例的 20GB/50GB 在本仓没有出处,故不采。
  param([double]$FreeGB)
  if ($FreeGB -lt 1) { return 'lt1GB' }
  return '1-10GB'
}

function Get-BackupMissedShifts {
  # 备份超龄小时数 → "已错过几班每日备份"(整数档号)。边界同样只用现读数:
  #   · 26h = 本文件既有阈值(文件头 :12「数据库备份新鲜度(< 26h 视为正常)」)
  #   · 24h = 备份节奏「启动即备份一次 → 每天 03:00 执行一次备份」
  #           (deploy/win/ihui-pg-backup-scheduler.ps1:8 现读;失败轮 30 分钟重试最多 4 次
  #            ≈2 小时后"仍失败则等下一班 03:00",同文件 :9 ⇒ 一轮缺失的判定粒度是一班,不是一小时)
  # ⇒ 档 = 1 + floor((ageH - 26) / 24);26+24=50h 这一"最坏空窗"本就是仓内既有表述
  #   (PROJECT_PLAN.md:4355「阈值本身(最坏 ~50h 无备份的空窗)属生产 RPO 取向,归用户定,本票不动」)。
  # 用"缺几班"而不是小时数当身份:班号在小范围内是整数常量,同一次断链的连续几轮读数不再产生新身份。
  param([double]$AgeHours)
  return [int](1 + [math]::Floor(($AgeHours - 26) / 24))
}

# ── 身份串拼装唯一出口(2026-10-17 立;与上面两枚档位函数同一条纯函数纪律:不取盘、不打
#    日志、无副作用)。镜像测试按 §22c 从本文件源码抽出这些函数体离线喂输入,测试内不得手抄判据。
#    共同规矩:实时抖动的量只进 Send-Alert 的 $detail(正文),身份里只留固定类别/档位。──────
function Get-DiskAlertSig {
  # 磁盘告警身份:只含 档位+卷标(两者都不随轮次抖)。实时剩余量进 $alertDetail。
  param([string]$Tier, [string]$Volume)
  return "磁盘剩余 档=$Tier 卷=$Volume"
}

function Get-UrlAlertSig {
  # 公网 URL 告警身份:同一 URL 恒为一个身份"访问异常"。旧形 "$u → $code2" 把状态码进身份,
  # 实测同一条 URL 因 ERR 与 502 两种读数同时占着两个身份槽(去重档案现读),每轮换读数措辞
  # 就换身份 ⇒ 4h 窗结构上永不命中。4xx/5xx/ERR 对收信人是同一个事实"这条 URL 的公网访问
  # 坏了",成因差异归正文($alertDetail 带首次/重测原始码),不归身份。
  param([string]$Url)
  return "$Url → 档=访问异常(连续2次确认)"
}

function Get-CloudflaredAlertSig {
  # 隧道服务告警身份:固定类别"非Running"。旧形把状态词进身份(实时 $($cf.Status):Stopped /
  # Paused / StartPending 随取样时机漂,一次宕动可占多槽)。实时状态词只进 $alertDetail。
  return "Cloudflared 服务 档=非Running(公网入口将不可达)"
}

function Get-BackupAlertSig {
  # 备份超龄告警身份:只含 类别+缺几班(都不随轮次抖)。备份文件名与实测小时数进 $alertDetail。
  param([string]$Kind, [int]$Shifts)
  return "备份超龄 类别=$Kind 档=缺$Shifts 班(>26h)"
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
    #
    # 2026-10-04 修(根因,不是收紧):此前是裸 `Test-Path $deployLockDir`,而"锁文件在盘上"
    # 与"真有部署在跑"是两件事 —— 部署进程崩在收尾之前就会留下一个永不过期的锁。
    # 实测本机 `.deploy.lock/meta.json` 停在 09-30 19:46,里面记的 pid 6616 / ownerPid 23228
    # **两个进程都不存在**,锁却仍在;而这个判据是 Get-Diagnosis 的**第 1 分支**,
    # 于是它恒真 ⇒ 每一轮巡检都自称"[部署重启中-预期现象]"
    # ⇒ Send-Alert 的抑制分支每轮都命中(实测 10-03 23:42 / 10-04 00:44 / 01:01 三轮全是
    # "[INFO] 预期窗口(部署重启中)告警已抑制"),真故障被这条**假**理由压住,
    # 邮件正文里的[原因诊断]也整段答错。
    #
    # 仓库里早有陈旧锁的四条判据(deploy-lock-common.ps1 的 Resolve-IhuiDeployLockState,
    # 其文件头记着上一轮同类事故:pid 会被复用,所以"进程还在"不等于"锁还有主"),
    # 部署环与守护都走它 —— 只有本监控脚本漏了。改为走同一份实现,不再各写一遍 Test-Path。
    $deployLockExists = $false
    $deployLockNote = ''
    try {
        if (Test-Path $deployLockDir) {
            $lockPath = Join-Path $deployLockDir 'meta.json'
            $lockFile = if (Test-Path $lockPath) { $lockPath } else { $deployLockDir }
            $st = Resolve-IhuiDeployLockState -Path $lockFile
            $deployLockNote = Format-IhuiDeployLockState $st
            # 只有"判定为仍被持有"才算真有部署在跑;stale(陈旧)与 absent 一律按没锁处理。
            $deployLockExists = ($st.LockExists -and $st.ShouldHold)
        }
    } catch {
        # 判不出时**不**当成有部署(那会静默压住真告警),也不当成没部署(那会把
        # 换流窗口的短暂拒连当正式告警寄出去)。判不出就走"无锁"并把判据失败写进诊断,
        # 让人看得见这一格没测到 —— 沉默地选一边正是本条要治的病。
        $deployLockNote = "部署锁状态判不出($($_.Exception.Message)),本轮按无锁处理"
        $deployLockExists = $false
    }
    if ($deployLockExists) {
        $lines += "[部署重启中-预期现象] 检测到部署锁(.deploy.lock),有构建/部署正在进行,服务重启导致的短暂不可用属正常,数分钟内自动恢复 | $deployLockNote"
        return ($lines -join "`n")
    }
    if ($deployLockNote) {
        $lines += "[部署锁已判陈旧/无锁] $deployLockNote(不按'部署重启中'抑制,真故障照报)"
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

function Send-Alert($msg, $detail = '') {
  # [2026-10-17 身份档位化] 新增可选第二参数 $detail:**实时读数只进正文,绝不进身份**
  # (与 ihui-deploy.ps1:422 那条"$Detail 只能进正文、绝不进签名"同一条规矩;身份里放抖动量
  #  = 每轮换身份 = 下面 Test-AlertDue 的 4h 窗结构上永不命中)。逐项身份仍取 $msg 拆出来的条目。
  # [2026-10-16 根治] 去重身份从"全清单组合签名"改为**逐项独立身份**(机主明令:重复告警
  # 本身就是缺陷)。旧形:身份 = 所有异常项 join 后的单一签名,组合一变(一项恢复/一项新增)
  # 就生成新身份绕过 4h 去重 → 持续故障期间每个新组合都寄一封(10-15 一天 20+ 封的机制根源)。
  # 新形:把异常清单按 " | " 拆成逐项,每项独立走"部署窗口抑制 + 身份去重":
  #   - 全部项都命中抑制/去重 ⇒ 一条 [INFO] 汇总,不寄信
  #   - 任一项 due ⇒ 寄**一封**(正文仍是完整异常清单+诊断,收信人视角不变),
  #     仅 due 项被登记(Test-AlertDueByIdentity 判'该寄'时自带登记,未 due 项不触碰)。
  # 项内不含 " | " 分隔串(项形如 'web(8801) 未监听' / '<URL> → ERR'),拆分可靠。
  $items = @($msg -split '\s*\|\s*' | Where-Object { $_ })
  $diag = Get-Diagnosis
  # 诊断已判"部署重启中-预期现象"(部署锁在 / 15 分钟内有构建)⇒ 换流窗口的短暂拒连是
  # 预期内现象,只记日志不寄信。2026-09-28 实测:两天 30+ 封告警邮件全是这一种 —— 每轮部署
  # 窗口里 web/api/ai 与各公网域名各算一个不同告警身份,按身份去重拦不住。
  #
  # 抑制**必须有终态**(2026-09-29 补):连续抑制超过 $ExpectedWindowGraceMinutes 分钟就不再当
  # 预期现象,落回正常发信路径。2026-10-16 起抑制锚也逐项化 —— "三项里两项恢复一项还在"时,
  # 第三项的 grace 计数不再被整体签名变化打断。
  $graceNotes = @()
  $itemNotes  = @()
  $dueItems   = @()
  foreach ($item in $items) {
    $isig = ($item -replace '\s+', ' ').Trim()
    if ($diag.Contains('[部署重启中-预期现象]')) {
      $g = Test-AlertSuppressionGrace -Sig $isig -StateFile $MonitorStateFile -GraceMinutes $ExpectedWindowGraceMinutes
      if ($g.Suppressed) {
        $itemNotes += "[$isig] 预期窗口抑制: $($g.Note)"
        continue
      }
      $graceNotes += "[$isig] $($g.Note)"
    }
    $due = Test-AlertDue -Sig $isig
    if ($due.Due) {
      $dueItems += $isig
      $itemNotes += "[$isig] 放行: $($due.Note)"
    } else {
      $itemNotes += "[$isig] 身份去重跳过: $($due.Note)"
    }
  }
  if ($dueItems.Count -eq 0) {
    # 全项被压时也要把实时读数留在日志里(身份里没有它,压信的理由才经得起复查)。
    $detailTail = if ($detail) { " | 实时读数(不进身份): $detail" } else { '' }
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [INFO] 逐项身份判定,全部命中抑制/去重,不推送: $msg | $($itemNotes -join ' | ')$detailTail" | Add-Content $alertLog -Encoding utf8
    return
  }
  $subject = $dueItems -join ' | '
  if ($subject.Length -gt 140) { $subject = $subject.Substring(0, 140) + '…' }
  $full = "$msg`n--------------------------------`n[本次放行身份] $subject`n[逐项判定] $(($itemNotes -join "`n"))`n[原因诊断] $diag"
  if ($graceNotes.Count) { $full = "$full`n[抑制到期] $($graceNotes -join "`n")" }
  # 实时读数进正文(收信人照旧看得到账,只是它不参与身份判定)
  if ($detail) { $full = "$full`n[实时读数(不进身份)] $detail" }
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [ALERT] 放行($($dueItems.Count)/$($items.Count)项): $subject | 诊断: $($diag -replace "`r?`n", ' | ')" | Add-Content $alertLog -Encoding utf8
  Send-MailAlert -Subject "[IHUI-AI 监控告警] $subject" -BodyText $full | Out-Null
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
  # 实时读数(每轮都在变的那些量)只进正文与日志,不进身份 —— 见 Send-Alert 的 $detail 参数。
  $alertDetail = @()

  # 1. 本地端口
  #    cdn(80) 曾于 2026-09-27 被摘出本清单,理由是"本机公网入口是 token 模式的 Cloudflared
  #    服务,它从不在本机 80 上监听 ⇒ 'cdn(80) 未监听' 是恒真误报"。**那个前提是错的**:
  #    本机 80 上监听的一直是图片源站 cdn-server.js(由当时的开机计划任务 IHUI-ImageCDN 在
  #    每次开机拉起),与 Cloudflared 无关;摘掉它是拿"隧道组件不绑 80"去否定"源站不绑 80"。
  #    而这条链是**用户可见的**:apps/web/next.config.ts:315-321 把 /remote-images/* 反代到
  #    http://localhost:80,源站一挂,公网页面图片全断,而本清单不会喊。
  #    2026-09-29 实测复现该失明:把 cdn-server.js 的进程杀掉,本清单 6 个端口**一个都不红**。
  #    自本行起它归位;载体同日已从开机计划任务换成 nssm 服务 IHUI-IMAGE-CDN(见
  #    deploy/win/install-image-cdn-service.ps1)⇒ 挂了先由服务拉回,拉不回来由这里喊人。
  foreach ($p in @(@{n="web(8801)";p=8801}, @{n="api(8802)";p=8802}, @{n="ai(8803)";p=8803},
                  @{n="cdn(80)";p=80},
                  # ↓ 2026-09-27 补:监控链自身的三个端口。加它们的唯一理由是**自指**——
                  #   prometheus 一死,alerts.yml 里那条 `PrometheusDown` 就没有评估者了
                  #   (由将死的进程判自己活着,结构上自相矛盾),alertmanager/bridge 同型。
                  #   实测此前这三处在整个仓库里**没有任何自动探活**:本清单原本只有 8801/8802/8803,
                  #   而 observability-drills.yml 把"6 个端口的活性"口头交给了"机上值守班次",
                  #   其中三个当时无人看守。本服务是 5 分钟一轮、不经 prometheus 的独立路径,
                  #   所以它是唯一能兜住"监控整体沉默"的挂点。
                  @{n="prometheus(8815)";p=8815}, @{n="alertmanager(9093)";p=9093}, @{n="alertbridge(9096)";p=9096})) {
    if (-not (Test-PortL $p.p)) { $alerts += "$($p.n) 未监听" }
  }

  # 1b. 公网入口的**进程侧**判据:隧道服务在不在,而不是本机有没有监听 80。
  #     可达性由第 2 组 URL 探测负责,两段互补,不再用端口冒充链路状态。
  try {
    $cf = Get-Service -Name 'Cloudflared' -ErrorAction Stop
    if ($cf.Status -ne 'Running') {
      $alerts += Get-CloudflaredAlertSig
      $alertDetail += "Cloudflared 服务实测状态=$($cf.Status)(状态词只进正文,不进身份)"
    }
  } catch { $alerts += 'Cloudflared 服务不存在(本机未装或已改名,公网入口无进程)' }

  # 2. 公网(2026-08-09 加"连续 2 次确认":单次瞬时失败不报警,重测一次仍失败才记录,
  #    过滤 Cloudflared 隧道重连/瞬时抖动导致的误报)
  #    图片那一条 2026-09-29 换了 URL。旧的 `aizhs.top/tabbar/tabbar/home.png` **不经过图片源站**:
  #    next.config.ts 只把 `/remote-images/*` 反代到 localhost:80,`/tabbar/*` 由 web(8801)
  #    自己应答 ⇒ 实测本机 :80 对同一路径回 137 B 占位图,而公网回 174 B 且来自 web,
  #    两侧字节数都不一样。也就是说那一条探测从来没有验过 CDN。
  #    换成 `/remote-images/default/home/setting_icon.png` 后,链路是
  #    Cloudflare → web → 反代 → :80 源站,源站挂了会拿到 5xx(实测真图 3376 B 可取)。
  #    如实登记它判不出的那一格:cdn-server 对**不存在**的路径也回 200 + 占位图
  #    (实测 `/nope/nope/nope.jpg` => 200),所以这一条只验"链路通不通",
  #    "源站在不在"由上面 cdn(80) 那条端口判据负责,两格各判一件事,不互相顶。
  foreach ($u in @("https://aizhs.top/", "https://aizhs.top/api/health", "https://bsm.aizhs.top/", "https://api.aizhs.top/api/health", "https://aizhs.top/remote-images/default/home/setting_icon.png")) {
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
      $alerts += (Get-UrlAlertSig -Url $u)
      $alertDetail += "URL $u 实测状态码=$code2 (首次=$code1 重测=$code2;原始状态码只进正文,不进身份)"
    }
  }

  # 3. 磁盘
  # [2026-10-17 身份档位化] 旧身份 = "磁盘剩余 ${freeGB}GB(<10GB)",把每轮都在变的实时读数写进
  # 签名 ⇒ 每轮新身份 ⇒ 4h 重发窗(Get-AlertDedupKey 的分槽档案)结构上永不命中。
  # 现在身份只带**档位 + 卷标**(两者都不抖),实时读数交给 Send-Alert 的 $detail 进正文。
  # 档位边界出处见 Get-DiskFreeTier 的头注(10GB = 本行原有阈值;<1GB = git-push-guard.mjs:414)。
  try {
    if (-not $MonitoredDrive) { throw "被检卷取不到盘符(IHUI_MONITOR_DISK_LETTER 未设且 $alertLog 解析不出盘符)" }
    $d = Get-PSDrive $MonitoredDrive
    $freeGB = [math]::Round($d.Free / 1GB, 1)
    if ($freeGB -lt 10) {
      $alerts += (Get-DiskAlertSig -Tier (Get-DiskFreeTier $freeGB) -Volume $d.Name)
      $alertDetail += "磁盘卷$($d.Name) 实测剩余 ${freeGB}GB(告警阈值<10GB)"
    }
  } catch {
    # 读数取不出来 ⇒ 显式在日志里产出"未判定"并点名原因(§0.10:不得折成 ok,也不得折成 breach)。
    # 旧写法是 `catch {}`,把"这一维压根没量到"静默读成"磁盘正常"。本轮不把它升级成告警身份
    # (那会在邮件面新增一型信,属新能力,需另行授权 —— 见交付物"未做项")。
    Log "磁盘剩余维 未判定(读数取不出):$($_.Exception.Message)"
  }

  # 4. 备份新鲜度
  # [2026-10-17 身份档位化] 旧身份含最新备份**文件名**(每成功备份一轮就换名,机器重启/手工补跑
  # 也换名)⇒ 同一条断链每轮都是新身份,与第 3 维同型。现在身份只带**类别 + 缺几班**(边界出处见
  # Get-BackupMissedShifts 头注:26h 既有阈值 + 每日 03:00 一班的备份节奏),文件名与实测小时数
  # 进正文。类别取本行既有 glob 的前缀(常量,不是文件名);逐类各出一条身份,不并成一条。
  # 现读 D:\DevEnv\backups\pg\ 里另有 keycloak_*.dump 从未进本维射程 —— 本轮不扩面(新能力),
  # 登记在交付物"未做项"。
  try {
    $bakTargets = @(@{ kind = 'ihui_dev'; glob = 'D:\DevEnv\backups\pg\ihui_dev_*.dump' })
    foreach ($t in $bakTargets) {
      $latest = Get-ChildItem $t.glob -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if (-not $latest) { $alerts += "无数据库备份文件"; continue }
      $ageH = ((Get-Date) - $latest.LastWriteTime).TotalHours
      if ($ageH -gt 26) {
        $shifts = Get-BackupMissedShifts -AgeHours $ageH
        $alerts += (Get-BackupAlertSig -Kind $t.kind -Shifts $shifts)
        $alertDetail += "备份类别=$($t.kind) 最新 $($latest.Name) 距今 $([math]::Round($ageH, 1))h(=缺 $shifts 班)"
      }
    }
  } catch {
    Log "备份新鲜度维 未判定(读数取不出):$($_.Exception.Message)"
  }

  # 汇总
  if ($alerts.Count -gt 0) {
    $detailTxt = ($alertDetail -join ' | ')
    Send-Alert ($alerts -join " | ") $detailTxt
    Write-Host "$(Get-Date -Format 'HH:mm:ss') 异常: $($alerts -join '; ')" -ForegroundColor Red
  } else {
    Write-Host "$(Get-Date -Format 'HH:mm:ss') 全部正常" -ForegroundColor Green
  }

  # ── 身份终态/恢复清偿档(2026-10-17 立;判据在 alert-dedup.ps1 的 Clear-AlertRecoveredIdentities,
  #    本处只接线并落日志)──每轮都跑,**包括零异常轮**。
  # 立因:监控侧所有告警身份都是 stall=false(Test-AlertDue 适配器从不传 -Stall),而部署侧的
  # Clear-AlertStallIdentities 只认 stall=true 一族、且只管部署自己的档案 ⇒ 监控台账结构上没有
  # 出口:故障恢复后条目永久滞留(repeatNo=40 那型事故的监控宿主版)。
  # 本档**不发"已恢复"信**,出处与理由:
  #   ① 部署侧同类终态先例 ihui-deploy.ps1:2224(ALERT-CLEARED)= 清偿只写日志、不发信;
  #   ② 仓内发"已恢复"信的先例 check-credential-health.mjs:1412(「凭据巡检已恢复」)前提是
  #      **同一轮复验拿到鉴权通过**(主动验证),而本档"恢复"判据只是"身份缺席本轮异常清单"
  #      —— 一次 5 分钟采样,撑不起一封结论性正面信(§0.3:弱证据不得折成强判据的另一半);
  #   ③ 间歇故障会"清一轮、报一轮"交替 ⇒ 恢复信+新故障信交替轰炸,消噪变成造噪
  #      (alert-dedup.ps1 头注同一禁令)。信面沉默、账目有出口:缺席未超窗只打 recoveredTs
  #      标记(抑制间歇重寄),超窗才删条目(真终态)。
  $activeSigs = @($alerts | ForEach-Object { ($_ -replace '\s+', ' ').Trim() } | Where-Object { $_ })
  $rc = Clear-AlertRecoveredIdentities -StateFile $MonitorStateFile -ActiveSig $activeSigs -RepeatHours $AlertRepeatHours
  if (-not $rc.Ok) {
    Log "身份恢复清偿 未判定:$($rc.Error)(本轮台账未动——不等于已清,下一轮继续判)"
  } else {
    if (@($rc.ClearedLabels).Count -gt 0) {
      Log "身份恢复清偿 删除$($rc.Cleared)条:身份缺席本轮异常清单且距最后登记已≥${AlertRepeatHours}小时(判恢复)|明细: $(@($rc.ClearedLabels | Select-Object -First 5) -join ' ;; ')"
    }
    if (@($rc.PendingLabels).Count -gt 0) {
      Log "身份恢复清偿 新标已恢复$($rc.NewlyMarked)条:身份缺席本轮但重发窗未走完,保留条目以抑制间歇性重寄|明细: $(@($rc.PendingLabels | Select-Object -First 5) -join ' ;; ')"
    }
    if ($rc.Undetermined -gt 0) {
      Log "身份恢复清偿 未判定$($rc.Undetermined)条:台账里的时刻解析不出,原样保留(既不折成恢复也不折成告警)"
    }
  }

  if ($Once) { break }

  if ($Once) { break }

  Start-Sleep -Seconds 300   # 5 分钟
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
