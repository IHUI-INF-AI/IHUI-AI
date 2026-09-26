# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
# =============================================================================
# IHUI 原生 Windows 部署 + 健康门禁 + 回滚脚本
# 适用: aizhs.top 生产机(原生 Windows, NSSM 服务, Cloudflare Tunnel)
# 由本机定时任务轮询 origin/main 触发;也可手动执行。
#
# 行为(每个阶段失败即中止,不切流):
#   1. git fetch origin main + 以 FETCH_HEAD 计算本地落后提交数(不用被宿主吞掉的 origin/main ref)
#   2. 落后>0 才继续;先做幻影漂移现场对齐(heal-worktree-tracked --align-drift,真编辑不碰),
#      再 git merge --ff-only FETCH_HEAD(禁 force,不动他人未提交改动;对齐后仍脏 → BLOCKED-WIP)
#   3. 备份当前 web 构建产物(.next → .rollback)
#   4. 重建 web(next build);api/ai-service 跑源码(tsx/uvicorn)无需独立构建
#   5. 重启 NSSM 服务(走非活跃逻辑,健康全过才保留)
#   6. 健康门禁:web 200 + /api/health ok + LLM 网关可达;未过则回滚
#   7. 回滚:恢复 .rollback 构建 + 重启服务
#
# 用例:
#   powershell -ExecutionPolicy Bypass -File deploy\win\ihui-deploy.ps1 -dryrun
#   powershell -ExecutionPolicy Bypass -File deploy\win\ihui-deploy.ps1 -diagnose
#   powershell -ExecutionPolicy Bypass -File deploy\win\ihui-deploy.ps1 -deployLatest
# =============================================================================
param(
    [switch]$dryrun,          # 只 fetch + 报告差距,不部署
    [switch]$diagnose,        # 只读诊断:仓库状态/网络/服务/锁/日志/线上一致性,不做任何构建或迁移
    [switch]$deployLatest,    # 忽略是否落后,强制部署到当前 origin/main
    [switch]$rollbackOnly,    # 仅用上次 .rollback 恢复
    [switch]$force            # 跳过健康门禁直接切流(谨慎)
)

# 全局路径与约束
$ErrorActionPreference = 'Stop'
$Root       = 'D:\IHUI-AI'
$WebDir     = "$Root\apps\web"
$ApiDir     = "$Root\apps\api"
$AiDir      = "$Root\apps\ai-service"
$BackupDir  = 'D:\DevEnv\backups\deploy'
# 健康门禁凭据的生产机本地兜底文件(仓库外;IHUI_ADMIN_PASSWORD 优先)
$AdminPwdFile = if ($env:IHUI_ADMIN_PASSWORD_FILE) { $env:IHUI_ADMIN_PASSWORD_FILE } else { 'D:\DevEnv\secrets\admin-password.txt' }
$ActiveFile = "$Root\deploy\win\active-env"   # active-env 标记,当前恒 'win'
$PublicWeb  = 'https://aizhs.top'
$ApiHealth  = "$PublicWeb/api/health"
# ai-service 健康端点(2026-09-14 ai-service 重启步骤引入;直连本机端口,无 JWT)
$AiServiceHealth = "http://127.0.0.1:8803/health"

# ── 工具链 PATH(2026-09-13 加,实测):服务/SYSTEM 上下文的 PATH 不含 node/pnpm,
#    否则 `pnpm run db:migrate`(以及 pnpm build)会报 '"node"' 不是内部或外部命令
#    (09:23 由 IHUI-DEPLOYLOOP 服务实测复现)。与 deploy\prod-bundle\svc\run-api.ps1
#    的 PATH 前置保持一致;额外补 WindowsPowerShell\v1.0(web prebuild 的 sync-downloads
#    链会调 powershell.exe)以及 pnpm 自带的 node_modules\.bin。
foreach ($p in @('D:\DevEnv\runtimes\node','D:\DevEnv\tools\npm-global','C:\windows\System32\WindowsPowerShell\v1.0')) {
    if ((Test-Path $p) -and ($env:PATH -notlike "*$p*")) { $env:PATH = "$p;$env:PATH" }
}

# ── 并发锁(2026-09-07 加;2026-09-26 判据重写):手动 -deployLatest 与计划任务 loop 可能
#    同时进入,两者会互相 Remove-Item/.next 与 .next-staging,导致构建期 ENOENT(实测
#    _buildManifest.js.tmp.* 被对端删除)。
#    旧判据是"锁里那个 pid 还在 ⇒ 有人在部署",而 pid 会被复用:2026-09-26 早上部署环
#    锁里写的 pid 8052 在重启后成了 postgres.exe,于是每轮都"有人在部署"、连续 46 分钟
#    零次部署(同一型缺陷另见 scripts/deploy-lock.mjs G-193、scripts/git-lock.mjs)。
#    现判据四条同时成立才算持有,实现**只有一份**:`deploy-lock-common.ps1`。
#    本文件与 ihui-deploy-loop.ps1 都点源同一份,不得在这里再抄一遍 Get-Process。
$DeployLock = "$Root\deploy\win\.deploy.lock"
$IhuiLockCommon = Join-Path $PSScriptRoot 'deploy-lock-common.ps1'
if (-not (Test-Path -LiteralPath $IhuiLockCommon)) {
    throw "缺少并发锁判据:$IhuiLockCommon(拒绝在无判据的情况下继续 —— 退回旧的 pid 存活判断就是退回那次 46 分钟冻结)"
}
. $IhuiLockCommon
function Get-DeployLock {
    $st = Resolve-IhuiDeployLockState -Path $DeployLock -OwnerKind 'deploy'
    if ($st.LockExists) {
        if ($st.ShouldHold) {
            # held / undetermined 一律终止本次部署:宁可人工看一眼,不可两个构建同时写 .next
            Write-Host "FAIL  检测到进行中的部署,终止本次部署避免并发冲突 —— $(Format-IhuiDeployLockState -State $st)"
            exit 2
        }
        Clear-IhuiDeployLockStale -Path $DeployLock -State $st -Logger { param($m) Log $m }
    }
    if (-not (Write-IhuiDeployLock -Path $DeployLock -OwnerKind 'deploy')) {
        throw "并发锁写下失败:$DeployLock"
    }
}
function Update-DeployLockHeartbeat {
    # 长任务里必须真的一直续(判据 C4);函数内部 15s 节流,可安全放在每轮循环里
    Update-IhuiDeployLockHeartbeat -Path $DeployLock -OwnerKind 'deploy' | Out-Null
}
function Release-DeployLock {
    Remove-IhuiDeployLock -Path $DeployLock -OwnerKind 'deploy' | Out-Null
}

# ── 日志时间戳带时区(2026-09-21 根治,实测):生产机时钟为 UTC,旧格式 'HH:mm:ss'
#    裸时间曾导致人工排查时误判「日志停更 7.5 小时」(实为 UTC 02:33=本地 10:33)。
#    所有日志时间一律带 +偏移,人眼即可分辨时区,杜绝同类误判。
function Log   { param([string]$m) Write-Host "[$(Get-Date -Format 'HH:mm:ss zzz')] $m" }
function Ok    { param([string]$m) Log "OK    $m" }

# ── 运维告警邮件(AGENTS.md §5e;2026-09-24 起为唯一到人通道)──────────────────────
#    部署失败自动寄品牌运维邮件。此前并行的第三方推送腿(免费额度 5 条/天的推送网关)已
#    整体摘除。"当日计数"配额自保的成因是那份额度是**第三方配额**(撞顶即静默丢);SMTP 是
#    我们自己的,自设总量上限等于把"告警静默"再复制一遍 —— 现只按失败签名去重/重发,无总量封顶。
#    邮件是唯一到人通道(2026-09-23 收口为品牌通道;2026-09-24 摘除第三方推送腿)。发信不由 PowerShell
#    自拼传输层(旧 Send-MailMessage 缺 -BodyAsHtml、Resend payload 缺 html 字段,只能发纯文本),统一调
#    apps/api\scripts\notify-deploy-failure.ts --strict:版式由 email-templates.ts 单点决定,
#    SMTP_*/RESEND_API_KEY 由该脚本自行回读 apps\api\.env;品牌通道失败再用同一条通道的
#    --plain 降级发纯文本(正文首行标 [降级纯文本]),两条都失败才算未送达 —— 没有第二条通道
#    可依,未送达必须留痕(.alert-undelivered.json + ALERT 日志行)。通知任何失败只记日志与标记,
#    绝不影响部署/回滚流程本身。
#    状态唯一写入点:Invoke-FailNotify(签名重发字段 sig/sigTs/sigFirstTs/repeatNo 落盘)。
$AlertNotifyStateFile = "$Root\deploy\win\.alert-notify-state.json"
$AlertUndelFile = "$Root\deploy\win\.alert-undelivered.json"
# 迁移失败告警去重状态(2026-09-21 加):同一签名 12h 内只推一次。
# 理由已换(2026-09-24 Server酱摘除):原先是"别刷爆第三方 3 条/天配额",现在配额不存在了,
# 保留窗口只为压"同一条故障重复刷屏" —— 它**不是总量封顶**,新签名一律立即另发。
$MigAlertStateFile = "$Root\deploy\win\.migrate-alert-state.json"
# 失败告警重发周期(小时,2026-09-23 改)。旧策略是同签名固定静音窗口,而轮询外壳每 ~68s 重放
# 同一失败 ⇒ 首发之后整天彻底静默(实测一次持续两天的故障只被通知过 1 次)。告警的判据应当是
# 「故障还在发生」而不是「上次发过了」,故改为到点周期性重发;失败签名变化一律立即发。
$FailAlertRepeatHours = 4
$NotifyEmailTo = '502319984@qq.com'
# ── 品牌邮件通道(2026-09-23 收口)─────────────────────────────────────────────
# 为什么 PowerShell 侧一行发信代码都不留:旧实现自己拼传输层 —— SMTP 分支 Send-MailMessage
# 没有 -BodyAsHtml、Resend 分支 payload 只有 text 没有 html,结果无论哪条路用户收到的永远是
# 纯文本,仓库里那套「智汇通报」品牌版式(email-templates.ts)在本地零调用。版式必须单点,
# 否则改了模板部署告警还是旧样子。发信配置(SMTP_*/RESEND_API_KEY)也一并交给 TS 侧回读 .env,
# 故旧的 Get-SmtpConfig / Get-ResendApiKey 两个函数随之删除(全仓已无其它调用方)。
# 路径从脚本自身位置推导(仓库 §15 禁止硬编码盘符):本脚本位于 <root>\deploy\win。
$BrandMailRoot     = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BrandNotifyScript = Join-Path $BrandMailRoot 'apps\api\scripts\notify-deploy-failure.ts'
$BrandTsxEntry     = Join-Path $BrandMailRoot 'apps\api\node_modules\tsx\dist\cli.mjs'
$BrandNotifyMsgDir = Join-Path $BrandMailRoot '.ihui-agent\tmp\deploy-notify'
function Resolve-NodeExe {
    # NSSM 服务上下文(LocalSystem)的 PATH 常常没有 node —— 上面的 PATH 前置只在 pwsh 真的
    # 执行到那段时生效,服务配置漂移/换机即落空。故 Get-Command 之后仍要按绝对路径兜底
    # (候选与文件开头那段 PATH 前置同源),全落空返回 $null 由调用方如实记日志。
    # 不用 pnpm/npx:它们是 shell 包装脚本,服务上下文下 PATH 更不可靠。
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($cmd -and (Test-Path $cmd.Source)) { return $cmd.Source }
    foreach ($p in @('D:\DevEnv\runtimes\node\node.exe', 'C:\Program Files\nodejs\node.exe')) {
        if (Test-Path $p) { return $p }
    }
    return $null
}
function Protect-NotifyOutput {
    # 转日志前截断 + 脱敏。契约脚本自身不打印密钥,但 node 崩溃时会把 require 到的 .env 片段、
    # 整条命令行甚至堆栈倒进 stderr;含 key/token/secret/pass 字样的行一律不落运维日志。
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
    # 邮件的唯一出口。返回 $true = 已送达(契约:--strict 下 exit 0 即成功,失败/未配置 exit 1)。
    # -Plain = 同一传输层但不套品牌模板(正文原样),只由 Send-EmailNotify 在品牌通道失败后使用。
    param([string]$Subject, [string]$BodyText, [switch]$Plain)
    $channel = if ($Plain) { '降级纯文本' } else { '品牌模板' }
    $node = Resolve-NodeExe
    if (-not $node) { Log "MAIL  $channel 通道不可用:node.exe 未找到(PATH 与绝对路径兜底均落空)"; return $false }
    if (-not (Test-Path $BrandTsxEntry)) { Log "MAIL  $channel 通道不可用:tsx 入口不存在 $BrandTsxEntry"; return $false }
    if (-not (Test-Path $BrandNotifyScript)) { Log "MAIL  $channel 通道不可用:通知脚本不存在 $BrandNotifyScript"; return $false }
    # 多行中文正文必须走 --message-file 而不是命令行参数:参数还要过一层控制台代码页(GBK),
    # 换行、引号、反引号都可能被吃掉,实测正文里就带 4 段 `n 换行;文件是唯一能原样送达的通道。
    $msgFile = $null
    try {
        if (-not (Test-Path $BrandNotifyMsgDir)) { New-Item -ItemType Directory -Path $BrandNotifyMsgDir -Force | Out-Null }
        # 必须显式无 BOM:Set-Content -Encoding utf8 在 PowerShell 5.1 下写出的是**带 BOM** 的
        # UTF-8,BOM 会排在正文第一个字符前。TS 侧如今也补了一道 stripBom,但那是第二层兜底 ——
        # 写入方不得依赖读取方擦屁股(任何不经该兜底的读取者都会带上 BOM),故仍用无 BOM 编码。
        $text = if ($Plain) { "[降级纯文本]`n$BodyText" } else { $BodyText }
        $msgFile = Join-Path $BrandNotifyMsgDir "$((Get-Date).ToString('yyyyMMdd-HHmmss-fff')).txt"
        [System.IO.File]::WriteAllText($msgFile, $text, [System.Text.UTF8Encoding]::new($false))
        $argv = @($BrandTsxEntry, $BrandNotifyScript,
            '--to', $NotifyEmailTo, '--title', $Subject, '--severity', 'critical',
            '--source', 'ihui-deployloop', '--message-file', $msgFile, '--strict')
        if ($Plain) { $argv += '--plain' }
        # 临时把 EAP 降为 Continue:本文件用法注释允许运维用 powershell.exe(5.1)直接跑,而 5.1 下
        # 原生命令写 stderr + ErrorActionPreference=Stop 会抛 NativeCommandError —— 契约脚本的失败
        # 信息恰恰走 stderr,那会把"按退出码判定"变成"按异常判定",成功发送也可能被误判成失败并
        # 触发一次重复的 --plain 降级。PS7 下这句同样无害(实测 7.6.2 不抛)。
        $prevEap = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            $out = & $node @argv 2>&1
            $code = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $prevEap
        }
        if ($code -eq 0) { return $true }
        Log "MAIL  $channel 通道未送达(exit=$code): $(Protect-NotifyOutput $out)"
        return $false
    } catch {
        Log "MAIL  $channel 通道调用异常: $(Protect-NotifyOutput $_.Exception.Message)"
        return $false
    } finally {
        if ($msgFile) { Remove-Item -LiteralPath $msgFile -Force -ErrorAction SilentlyContinue }
    }
}
function Send-EmailNotify {
    # 纯发送,不碰计数。返回 $true=已发送。签名与语义与旧版一致(Fail 钩子与运维日志解读依赖它),
    # 内部改为两条通道同源于品牌脚本:先套「智汇通报」模板,失败再用 --plain 降级发纯文本。
    param([string]$subject,[string]$text)
    if (Invoke-BrandMail -Subject $subject -BodyText $text) {
        Log "MAIL  邮件告警已发送至 $NotifyEmailTo (品牌模板)"
        return $true
    }
    Log "MAIL  品牌模板通道失败,转 --plain 降级重试"
    if (Invoke-BrandMail -Subject $subject -BodyText $text -Plain) {
        Log "MAIL  邮件告警已发送至 $NotifyEmailTo (降级纯文本)"
        return $true
    }
    Log "MAIL  邮件告警发送失败:品牌与降级两条通道均未送达 $NotifyEmailTo"
    return $false
}
function Invoke-FailNotify {
    param([string]$m)
    $state = $null
    try {
        $state = Get-Content $AlertNotifyStateFile -Raw -ErrorAction Stop | ConvertFrom-Json
    } catch { $state = $null }
    # 同签名到点重发、换签名立即发(周期见 $FailAlertRepeatHours)。旧实现把"上次发过了"当成
    # "不用再发",持续故障第二次起彻底无人知晓;这里只未到重发周期才静音,并把持续时长与
    # 重发序号写进正文,让运维一眼看出"这个故障还没修好"而不是以为已处置。
    # 这是**按身份去重**,不是总量封顶 —— 无"每日 N 封"计数闸(成因见文件头 §5e 注释块)。
    $sig = ($m -replace '\s+', ' ').Trim()
    $repeatNote = ''
    $sigFirstTs = $null
    $repeatNo = 0
    if ($state -and [string]$state.sig -eq $sig -and $state.sigTs) {
        $prevTs = $null
        try { $prevTs = [datetime]$state.sigTs } catch { $prevTs = $null }
        if ($prevTs) {
            $ageH = ((Get-Date) - $prevTs).TotalHours
            if ($ageH -ge 0 -and $ageH -lt $FailAlertRepeatHours) {
                Log "ALERT 同签名失败告警 $([Math]::Round($ageH,1))h 前已寄过(未到 ${FailAlertRepeatHours}h 重发周期),本轮跳过"
                return
            }
            try { if ($state.sigFirstTs) { $sigFirstTs = [datetime]$state.sigFirstTs } } catch { $sigFirstTs = $null }
            if (-not $sigFirstTs) { $sigFirstTs = $prevTs }
            $repeatNo = [int]$state.repeatNo + 1
            $durH = [Math]::Round(((Get-Date) - $sigFirstTs).TotalHours, 1)
            $repeatNote = "`n- 备注: 同一故障已持续 ${durH} 小时,本条为第 $repeatNo 次重发(每 $FailAlertRepeatHours 小时一次,签名变化则立即另发)"
        }
    }
    if (-not $sigFirstTs) { $sigFirstTs = Get-Date }
    $nowTxt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'
    # 唯一到人通道:到点即寄,失败=告警从未被人看见,必须留下 UNDELIVERED 标记(参照
    # scripts/check-credential-health.mjs 的 UNDEL 机制),下一次成功投递自动清除。
    $mailOk = $false
    try {
        $mailOk = Send-EmailNotify -subject "【生产环境】部署失败" `
            -text "IHUI-AI 生产部署失败(运维邮件告警)`n`n原因: $m$repeatNote`n时间: $nowTxt`n处置: 已自动回滚或保持当前在线版本`n排查: 服务 IHUI-DEPLOYLOOP / NSSM 日志,或 ssh 后执行 deploy\win\ihui-deploy.ps1 -diagnose"
    } catch { $mailOk = $false }
    if ($mailOk) {
        try { Remove-Item -LiteralPath $AlertUndelFile -Force -ErrorAction SilentlyContinue } catch {}
    } else {
        try {
            @{ ts = (Get-Date).ToString('o'); sig = $sig; why = '品牌模板与 --plain 降级两条邮件通道均未送达(细节见部署日志 MAIL 行)' } | ConvertTo-Json |
                Set-Content -Path $AlertUndelFile -NoNewline
            Log "ALERT 邮件未送达,已写标记 $AlertUndelFile(下一次成功投递自动清除)"
        } catch {
            Log "ALERT CRITICAL 邮件未送达且标记也写不出去 —— 告警面双盲,须人工核查本条失败: $m"
        }
    }
    try {
        Set-Content -Path $AlertNotifyStateFile -Value (@{
            sig = $sig; sigTs = (Get-Date).ToString('o')
            sigFirstTs = $sigFirstTs.ToString('o'); repeatNo = $repeatNo
        } | ConvertTo-Json) -NoNewline
    } catch {}
}
function Fail {
    param([string]$m)
    Log "FAIL  $m"
    try { Invoke-FailNotify -m $m } catch {}
    try { Release-DeployLock } catch {}
    exit 1
}

function Invoke-Step { param([string]$name,[scriptblock]$body)
    Log "── $name ──"
    & $body | ForEach-Object { Write-Host "   $_" }
    return $LASTEXITCODE
}

function Test-Http {
    param([string]$url,[string]$contains='')
    try {
        $r = Invoke-WebRequest -Uri $url -TimeoutSec 15 -ErrorAction Stop -UseBasicParsing
        if ($contains -and $r.Content -notmatch [regex]::Escape($contains)) { return $false }
        return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
    } catch { return $false }
}

function BackendLogin-Token {
    # 探测 LLM 网关需带 Bearer;用 admin 获取 token(仅作健康探测,不改数据)
    # 凭据不入仓库:密码经环境变量 IHUI_ADMIN_PASSWORD 注入;
    # 服务上下文(NSSM/计划任务)拿不到该变量时,回落到生产机本机密钥文件 ——
    # 否则 p3 恒 False → 门禁 8 轮必失败 → 每次构建成功后又被回滚,api/ai-service 永不重启。
    $adminPwd = $env:IHUI_ADMIN_PASSWORD
    if (-not $adminPwd -and (Test-Path $AdminPwdFile)) {
        try { $adminPwd = (Get-Content $AdminPwdFile -Raw).Trim() } catch { $adminPwd = $null }
    }
    if (-not $adminPwd) { return $null }
    try {
        $b = @{ username='admin'; password=$adminPwd } | ConvertTo-Json
        $login = Invoke-RestMethod -Uri "$PublicWeb/api/auth/login/username" -Method Post `
                        -Body $b -ContentType 'application/json' -TimeoutSec 20 -ErrorAction Stop
        if ($login.data.accessToken) { return $login.data.accessToken }
        if ($login.token.accessToken) { return $login.token.accessToken }
        if ($login.accessToken) { return $login.accessToken }
    } catch {
        # 旧实现把所有异常一律吞成 $null,限流与口令错误无从区分,运维只能干猜(状态码现在可见)
        $sc = 0
        try { $sc = [int]$_.Exception.Response.StatusCode } catch { $sc = 0 }
        if ($sc -eq 429) { Log "HEALTH 登录取探测令牌被限流(HTTP 429,/auth/login/username 上限 10 次/分钟)→ 该项按未知处理,不据此回滚" }
        else { Log "HEALTH 登录取探测令牌失败$(if ($sc) { "(HTTP $sc)" })" }
    }
    return $null
}

# ── 探测令牌的"本轮部署内"缓存(2026-09-23 加,降频) ─────────────────────────────
# 旧行为:健康门禁每轮都重新登录 admin(8 轮 = 8 次登录),持续失败时等于反复用管理员口令去撞
# 服务端 10 次/分钟限流,并在账号侧消耗"剩余 N 次重试即锁定"的预算。一把令牌在同一轮部署里复用,
# 只有探测回 401/403(令牌确实失效)才重登,且整轮最多 2 次(登录失败也记数,防逐轮重试)。
$script:HcToken = $null
$script:HcLoginTries = 0
function Get-HcToken {
    param([switch]$Force)   # $Force:仅在探测返回 401/403 时使用,其余场景一律复用缓存
    if ($script:HcToken -and -not $Force) { return $script:HcToken }
    if ($script:HcLoginTries -ge 2) { if ($Force) { $script:HcToken = $null }; return $script:HcToken }
    $script:HcLoginTries++
    $t = BackendLogin-Token
    if ($t) { $script:HcToken = $t; Log "HEALTH 已取得探测令牌(本轮多次门禁共用这一把)" }
    elseif ($Force) { $script:HcToken = $null }   # 旧令牌已被判失效,绝不能再复用
    return $script:HcToken
}

function Invoke-Probe {
    param([string]$Url, [string]$Contains = '', [string]$Token = '')
    # 三态探测:pass = 服务确实在正常应答;fail = 应答了但不健康(4xx/5xx 或内容不符);
    # unknown = 被限流(429)或传输层不可达 —— 后者不足以判定部署失败,由调用方按"未知"放行,
    # 因为把限流当失败会造成无谓回滚(2026-09-23 实测:探针自身打爆登录限流后误判过一次)。
    $resp = $null
    try {
        $hdr = @{}
        if ($Token) { $hdr['Authorization'] = "Bearer $Token" }
        $resp = Invoke-WebRequest -Uri $Url -TimeoutSec 15 -Headers $hdr -ErrorAction Stop -UseBasicParsing -SkipHttpErrorCheck
    } catch {
        return @{ Verdict = 'unknown'; Status = 0; Reason = "传输不可达($($_.Exception.Message))" }
    }
    $code = [int]$resp.StatusCode
    if ($code -eq 429) { return @{ Verdict = 'unknown'; Status = $code; Reason = '上游限流(HTTP 429)' } }
    if ($code -ge 200 -and $code -lt 400) {
        if ($Contains -and $resp.Content -notmatch [regex]::Escape($Contains)) {
            return @{ Verdict = 'fail'; Status = $code; Reason = "应答不含 '$Contains'(疑为旧构建或异常页)" }
        }
        return @{ Verdict = 'pass'; Status = $code; Reason = '' }
    }
    return @{ Verdict = 'fail'; Status = $code; Reason = "HTTP $code" }
}

function Test-LlmGateway {
    # 返回值由旧布尔改为 pass/fail/unknown 三态(唯一调用方是 Test-HealthGate)
    $tok = Get-HcToken
    if (-not $tok) { Log "HEALTH 未取得探测令牌(登录被限流或凭据缺失)→ llm 项按未知处理"; return 'unknown' }
    $r = Invoke-Probe -Url "$PublicWeb/api/llm/providers/health" -Token $tok
    if ($r.Status -eq 401 -or $r.Status -eq 403) {
        $tok = Get-HcToken -Force          # 只有令牌确实失效才重登,正常轮次零登录
        if (-not $tok) { return 'unknown' }
        $r = Invoke-Probe -Url "$PublicWeb/api/llm/providers/health" -Token $tok
    }
    if ($r.Verdict -eq 'unknown') { Log "HEALTH llm 网关未取得结论:$($r.Reason) → 按未知处理,不据此回滚" }
    return $r.Verdict
}

# 健康门禁: web + api健康 + LLM网关
# 2026-09-07 加固:Next 冷启动需数秒，重启后立即探全部走 :8801 的端点会集体误判失败
# (api/llm 都经 web 反代/tunnel → web 未就绪即整链 FAIL)。改为带退避的多次探测,
# 前 Ups个周期内(N 次 × 间隔)任一轮全过即成功;全部耗尽才算未过 → 进回滚。
function Test-HealthGate {
    [int]$Tries  = 8
    [int]$GapSec = 12
    $lastFails = @(); $lastUnknown = @()
    for ($i = 1; $i -le $Tries; $i++) {
        Update-DeployLockHeartbeat   # 门禁每轮续心跳(8 轮 × 12s + 探测超时,最长约 9.6 分钟)
        Start-Sleep -Seconds $GapSec
        $w = Invoke-Probe -Url $PublicWeb -Contains '<!DOCTYPE html'
        $a = Invoke-Probe -Url $ApiHealth -Contains '"status":"ok"'
        $l = Test-LlmGateway
        $fails = @(); $unknown = @()
        if ($w.Verdict -eq 'fail') { $fails += "web(HTTP $($w.Status) $($w.Reason))" } elseif ($w.Verdict -ne 'pass') { $unknown += 'web' }
        if ($a.Verdict -eq 'fail') { $fails += "api(HTTP $($a.Status) $($a.Reason))" } elseif ($a.Verdict -ne 'pass') { $unknown += 'api' }
        if ($l -eq 'fail') { $fails += 'llm(网关接口未就绪)' } elseif ($l -ne 'pass') { $unknown += 'llm' }
        $lastFails = $fails; $lastUnknown = $unknown
        $tail = ''
        if ($fails.Count)   { $tail += " 失败=[$($fails -join ' ')]" }
        if ($unknown.Count) { $tail += " 未知=[$($unknown -join ' ')]" }
        Log "健康门禁 第 $i/$Tries 轮: web=$($w.Verdict) api=$($a.Verdict) llm=$l$tail"
        # 成功条件不放宽:三项全部真绿才算通过("未知"也不算绿,继续下一轮重试)
        if ($fails.Count -eq 0 -and $unknown.Count -eq 0) { return $true }
    }
    if ($lastFails.Count -gt 0) {
        Log "健康门禁 ${Tries} 轮未全绿,最后一轮存在明确失败项:[$($lastFails -join ' ')] → 判定失败"
        return $false
    }
    # 耗尽仍拿不出明确失败项 ⇒ 全程只被限流/网络不可达挡住。按约定记 warn 并以"未知"放行该子项,
    # 不据此回滚;但 warn 必须留在日志里 —— 此时线上是否真的好,只有人工核查能定。
    Log "WARN  健康门禁 ${Tries} 轮未取得全绿,但无明确失败项,仅[$($lastUnknown -join ' ')]无法判定(限流或网络不可达)"
    Log "WARN  按'未知'放行本轮门禁、不回滚;请人工核查上述项:deploy\win\ihui-deploy.ps1 -diagnose"
    return $true
}

# ── ff-only 前的"可自愈现场对齐"(2026-09-23 加,当日三次部署环冻结的直接放大因子) ────
# 本机既是生产机又是共享工作树:git-sync-converge 用 merge-tree + commit-tree + update-ref 推进
# HEAD 却从不 checkout,工作树因此停在旧基线。`git status` 看着像"有人在写",实际提交出去就是
# 静默回滚别人 —— 这叫幻影漂移。ff-only 只要被跟踪文件有未提交改动就 abort → 整轮 FAIL、线上
# 滞留旧版本。对策:ff-only 之前先跑一次保守自愈(--align-drift 只在「索引==HEAD 且内容==该路径
# 某祖先版本」时对齐,真在写的文件一律不碰)。对齐后仍脏 = 真有人在写 ⇒ 保持 FAIL,但日志必须把
# 两种成因分开,否则运维分不清"机器坏了"还是"别人在写"。
# 铁律:本节及其调用点绝不允许出现任何销毁未提交内容的 git 写法(强制重置、强制清理、全树检出),
# 具体字面量被 o6 静态判据测试钉死为"整份源码不得出现"—— 因为共享工作树里被销毁的那份工作没法恢复。
function Get-TrackedDirtyEntry {
    # 只列「被跟踪文件」的未提交改动(索引脏 + 工作区脏);未跟踪产物不该被算成 ff-only 的阻塞项
    try {
        $o = & git -C $Root -c core.quotepath=false status --porcelain --untracked-files=no 2>&1 | Out-String
        return @($o -split "`r?`n" | Where-Object { $_.Trim() })
    } catch {
        Log "WARN  git status 取脏文件失败: $($_.Exception.Message)"
        return @()
    }
}
function Invoke-WorktreeAlign {
    # 返回 $true = 自愈脚本成功跑完(不代表对齐了文件);$false = 不可用/异常(只 warn,不改本轮结论)
    $healer = Join-Path $Root 'scripts\heal-worktree-tracked.mjs'
    if (-not (Test-Path $healer)) { Log "WARN  自愈脚本缺失:$healer —— 跳过现场对齐(不因此判失败)"; return $false }
    $nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $nodeExe) { Log "WARN  PATH 中无 node —— 跳过现场对齐"; return $false }
    $outFile = Join-Path $env:TEMP "ihui-align-$PID.log"
    try {
        # 派生 node 用 Start-Process -NoNewWindow + 文件重定向:nssm 服务上下文常无控制台,裸 `&`
        # 派生控制台程序会新分配可见窗口(AGENTS.md §5b 同类);文件重定向亦免疫管道挂死。
        $p = Start-Process -FilePath $nodeExe -ArgumentList @("`"$healer`"", '--align-drift') `
                -WorkingDirectory $Root -NoNewWindow -Wait -PassThru `
                -RedirectStandardOutput $outFile -RedirectStandardError "$outFile.err" -ErrorAction Stop
        foreach ($f in @($outFile, "$outFile.err")) {
            foreach ($l in (Get-Content $f -ErrorAction SilentlyContinue)) { if ($l.Trim()) { Log "  [align] $($l.Trim())" } }
        }
        if ($p.ExitCode -ne 0) { Log "WARN  现场对齐退出码 $($p.ExitCode)(不阻断本轮,仍会照常尝试 ff-only)" }
        return ($p.ExitCode -eq 0)
    } catch {
        Log "WARN  现场对齐调用异常: $($_.Exception.Message)"
        return $false
    } finally {
        Remove-Item $outFile, "$outFile.err" -Force -ErrorAction SilentlyContinue
    }
}
function Report-BlockedWip {
    param([string[]]$Entries)
    # 一句话把成因钉在日志里(轮询外壳会把本输出实时落进 deploy-loop.log,可 grep BLOCKED-WIP)
    $paths = @($Entries | ForEach-Object { $_.Substring([Math]::Min(3, $_.Length)).Trim() })
    Log "BLOCKED-WIP 有 $($Entries.Count) 个被跟踪文件存在真实未提交改动(非幻影漂移),不代提交不删除"
    Log "BLOCKED-WIP 清单(最多 10 个): $(($paths | Select-Object -First 10) -join ' | ')"
    if ($Entries.Count -gt 10) { Log "BLOCKED-WIP 其余 $($Entries.Count - 10) 个未列出,完整清单看 git status --porcelain --untracked-files=no" }
}

function New-BackupDir { if (-not (Test-Path $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null } }

# ── 构建新鲜度判据(2026-09-14 加;2026-09-21 根治) ─────────────────────────────
# 背景:本脚本原先只在 behind>0 时才重建 web,他方抢跑 ff 后 behind 恒 0 → 循环永不部署。
# 2026-09-21 根治(实测教训):旧判据「marker..HEAD 在 webPaths 路径上的差异提交数>0」
#       存在两处致命盲区,叠加造成本次部署停滞:
#       ① 失败轮也写 marker(尝试标记语义) → 构建连败后 marker=HEAD,每轮误判「新鲜」
#         → 永久跳过,根因消失后也无法自愈,必须人工删标记;
#       ② webPaths 过滤漏掉 deploy/docs 等路径 → 本次修复提交(deploy/win/*)被 merge 后
#         差异数恒 0,即使 marker 落后也不触发重建。
# 新判据:marker 只记录「最后一次成功部署」的 HEAD,marker != HEAD 即陈旧 → 重建。
#       任何新提交(含仅改 deploy 脚本的提交)都触发一次重建;next build 仅 ~2.5 分钟,
#       用确定性换精细度,不再做文件级 diff。失败轮一律不写 marker(见 Set-BuildCooldown)。
function Get-BuildStale {
    $marker = "$WebDir\.next\IHUI_BUILD_SHA"
    if (-not (Test-Path $marker)) { return $true }                     # 无标记 → 无法证明新鲜 → 重建
    $built = (Get-Content $marker -Raw -ErrorAction SilentlyContinue).Trim()
    if ($built -notmatch '^[0-9a-f]{7,40}$') { return $true }
    & git -C $Root cat-file -e "$built^{commit}" 2>$null
    if ($LASTEXITCODE -ne 0) { return $true }                          # 标记提交不可达(强推/rebase)→ 重建
    $head = (& git -C $Root rev-parse HEAD 2>&1 | Out-String).Trim()
    if ($head -notmatch '^[0-9a-f]{7,40}$') { return $true }           # HEAD 不可得 → 保守重建
    return ($built -ne $head)
}
function Set-BuildMarker {
    $dirNext = "$WebDir\.next"
    if (-not (Test-Path $dirNext)) { return }
    $sha = (& git -C $Root rev-parse HEAD 2>&1 | Out-String).Trim()
    if ($sha -match '^[0-9a-f]{7,40}$') { Set-Content -Path "$dirNext\IHUI_BUILD_SHA" -Value $sha -NoNewline -ErrorAction SilentlyContinue }
}

# ── 构建失败冷却(2026-09-21 加):marker 改为成功标记后,失败轮不再写标记。若不冷却,
#    持续失败会每轮(60s)重走 重建dist+next build(~10-20 分钟) → 每天数百轮无效构建,
#    刷爆日志与告警配额。冷却 30 分钟 ≈ 每小时 2 次自动重试:根因修复后最多 30 分钟
#    自动恢复,无需人工删标记(本次事故正是靠手动删标记才恢复的)。
#    冷却只拦「behind=0、仅因构建新鲜度触发」的重试;有新提交(behind>0)不拦,保住
#    push→部署的及时性。成功部署即清除冷却。
$BuildCooldownFile = "$Root\deploy\win\.build-fail-state.json"
function Set-BuildCooldown {
    $sha = (& git -C $Root rev-parse HEAD 2>&1 | Out-String).Trim()
    try { Set-Content -Path $BuildCooldownFile -Value (@{ ts = (Get-Date).ToString('o'); head = $sha } | ConvertTo-Json -Compress) -NoNewline -ErrorAction SilentlyContinue } catch {}
}
function Test-BuildCooldown {
    # 返回 $true 表示仍在 30 分钟冷却期内(上轮构建/门禁失败后跳过本轮重建)
    try {
        $st = Get-Content $BuildCooldownFile -Raw -ErrorAction Stop | ConvertFrom-Json
        $ageMin = ((Get-Date) - [datetime]$st.ts).TotalMinutes
        return ($ageMin -ge 0 -and $ageMin -lt 30)
    } catch { return $false }
}
function Clear-BuildCooldown {
    if (Test-Path $BuildCooldownFile) { Remove-Item $BuildCooldownFile -Force -ErrorAction SilentlyContinue }
}

function Build-Web {
    param([string]$DistDir = 'staging', [int]$MaxTries = 4)
    # 心跳(判据 C4 的持有侧):本函数是最长的一段(依赖安装 + 6 个 workspace 包 dist +
    # 最多 4 次 next build try),不续心跳就会被下一轮轮询或手工部署按"陈旧"抢占 ⇒
    # 两个构建同时写 .next —— 那正是这把锁存在的理由。上限 45 分钟的推导见
    # deploy-lock-common.ps1 头注;函数内部 15s 节流,放在循环里代价只有一次时间判断。
    Update-DeployLockHeartbeat
    Set-Location $WebDir
    if (-not (Test-Path "node_modules\.bin\next.cmd")) {
        Log "web 依赖缺失,先 pnpm install"
        & "D:\DevEnv\tools\npm-global\pnpm.cmd" install
        # throw 而非 Fail(2026-09-21 根治):Fail 直接 exit 1 会绕过外层 catch 的失败冷却,
        # 下一轮无冷却反复重试;throw 统一走主流程 catch → Set-BuildCooldown → 告警去重。
        if ($LASTEXITCODE -ne 0) { throw "pnpm install 失败(exit $LASTEXITCODE)" }
    }
    # ── workspace 包 dist 重建(2026-09-21 加,实测):packages/*/dist 不入库(gitignored),
    #    生产机 dist 永远停留在某次手工构建。api-client 新增 patrol 端点、ui-react 新增
    #    icon-2xs 档位后,next build 仍解析 09-14 的旧 dist → "Export updatePatrolTask
    #    doesn't exist in target module" 连续 4 轮构建失败 → 部署停滞(web 滞留旧版本)。
    #    web 经 dist 消费的 6 个 workspace 包在此逐个重建(拓扑序:shared→api-client/
    #    design-tokens/types,ui-react→design-tokens,api-client→types,实测 2026-09-21:
    #    shared 排在 api-client 前会对其旧 dist 报 TS2305 CitationsEvent),单包失败即
    #    中止并定位到包;未来新增 dist 型 workspace 依赖时须同步调整清单与顺序。
    foreach ($pkg in @('@ihui/types','@ihui/api-client','@ihui/design-tokens','@ihui/shared','@ihui/auth','@ihui/ui-react')) {
        Log "重建 $pkg dist ..."
        & "D:\DevEnv\tools\npm-global\pnpm.cmd" --filter $pkg run build
        if ($LASTEXITCODE -ne 0) { throw "workspace 包 $pkg dist 重建失败(exit $LASTEXITCODE)" }
    }
    # 2026-09-07 可靠性加固(实测):Tailwind v4 展开成 ~271KB 单行 CSS,Next 前端 CSS
    # 管线(lightningcss,与 Turbopack/webpack 无关)偶发在此巨行上报假性
    # "Parsing CSS failed / Unexpected token Delim('\u{1a}')" 中断构建;成功可达但概率失败。
    # 对策:冷构建(每次清空 staging 缓存)+ 多轮重试,落在成功态为止。
    # 2026-09-14 堆内存加固(实测):next build(Turbopack/webpack 皆然)Node 侧堆
    # 需求 >4GB(本机 4GB 默认堆实测 OOM "Ineffective mark-compacts",12GB 堆通过);
    # 生产机若默认堆不足会连续 4 轮构建失败 → 部署 exit 1 → web 永久滞留旧构建。
    # 对策:显式放宽 Node 堆到 8GB(按需分配,不预占),构建结束在 finally 还原。
    $env:NEXT_TELEMETRY_DISABLED = '1'
    $prevNodeOptions = $env:NODE_OPTIONS
    $env:NODE_OPTIONS = "--max-old-space-size=8192$(if ($prevNodeOptions -and $prevNodeOptions -notmatch 'max-old-space-size') { ' ' + $prevNodeOptions })"
    try {
        for ($try = 1; $try -le $MaxTries; $try++) {
            Log "构建尝试 $try/$MaxTries -> .next-$DistDir"
            Update-DeployLockHeartbeat      # 每次 try 开头续心跳(单次 try 墙钟 30 分钟 < 45 分钟上限)
            Remove-Item "$WebDir\.next-$DistDir" -Recurse -Force -ErrorAction SilentlyContinue
            $env:IHUI_BUILD_DIST = ".next-$DistDir"
            # 2026-09-21 加固(实测):`& pnpm build` 直调出现过「构建进程 2 分钟内静默死亡,
            # pwsh 却因孤儿孙进程持有 stdout 管道而永久挂起」——守护进程等子进程退出才落日志,
            # 表现为 deploy-loop.log 停更 7.5h(02:56→10:2x)且 .deploy.lock 被活锁占用。
            # 对策:Start-Process + stdout/stderr 重定向到临时文件(文件不依赖存活写者,天然
            # 免疫管道挂死)+ WaitForExit 30 分钟墙钟;超时 taskkill /T 整树按失败 try 处理。
            $bldOk = $false; $exitCode = 1
            $bldOut = Join-Path $env:TEMP "ihui-next-build-$PID-try$try-out.log"
            $bldErr = Join-Path $env:TEMP "ihui-next-build-$PID-try$try-err.log"
            try {
                $bldProc = Start-Process -FilePath 'D:\DevEnv\tools\npm-global\pnpm.cmd' -ArgumentList 'build' `
                    -WorkingDirectory $WebDir -NoNewWindow -PassThru `
                    -RedirectStandardOutput $bldOut -RedirectStandardError $bldErr
                if (-not $bldProc.WaitForExit(30 * 60 * 1000)) {
                    Log "构建 try$try 超 30 分钟墙钟(pid=$($bldProc.Id))判挂死,taskkill /T 整树"
                    & taskkill /PID $bldProc.Id /T /F 2>&1 | Out-Null
                    $exitCode = 124
                } else {
                    $exitCode = $bldProc.ExitCode
                }
            } catch {
                Log "Start-Process 构建异常($($_.Exception.Message)),回退直调"
                & 'D:\DevEnv\tools\npm-global\pnpm.cmd' build
                $exitCode = $LASTEXITCODE
            }
            foreach ($l in (Get-Content $bldErr -Tail 8 -ErrorAction SilentlyContinue)) { Log "[build-err] $l" }
            foreach ($l in (Get-Content $bldOut -Tail 12 -ErrorAction SilentlyContinue)) { Log "[build-out] $l" }
            # 用完即删。这两个文件是 Start-Process 的重定向落点,服务身份(IHUI-DEPLOYLOOP 跑在
            # LocalSystem 下)的 `$env:TEMP` = `C:\Windows\Temp` —— HKCU 把 TEMP 迁到 D 盘对它无效,
            # 所以每次构建 try 都在 **C 盘系统临时目录**留 2 个文件且此前无人清:2026-09-24 实测
            # 攒到 528 项 / 6.9MB,且当天还在 +5(部署环每 30 分钟一轮)。内容已 Tail 进
            # deploy-loop.log,留着没有取证价值。删除失败不得影响构建判定 ⇒ 整段吞异常。
            try {
                Remove-Item -LiteralPath $bldOut, $bldErr -Force -ErrorAction SilentlyContinue
            } catch {}
            $ok = ($exitCode -eq 0) -and (Test-Path "$WebDir\.next-$DistDir\BUILD_ID")
            Update-DeployLockHeartbeat      # try 结束再续一次:上一行之后还要跑 Tail 读日志与判定
            if ($ok) { Ok "next build 完成 -> .next-$DistDir"; return }
            Log "第 $try 次失败(exit=$exitCode),清缓存重试"
        }
        throw "next build 连续 $MaxTries 次失败,保持当前在线版本"
    } finally {
        Remove-Item Env:\IHUI_BUILD_DIST -ErrorAction SilentlyContinue
        Remove-Item Env:\NEXT_TELEMETRY_DISABLED -ErrorAction SilentlyContinue
        if ($prevNodeOptions) { $env:NODE_OPTIONS = $prevNodeOptions } else { Remove-Item Env:\NODE_OPTIONS -ErrorAction SilentlyContinue }
    }
}

# ── 回滚:恢复上次构建产物 + 重启 ──
function Start-Web {
    try { sc.exe start IHUI-WEB | Out-Null } catch { throw "启动 IHUI-WEB 失败: $_" }
}
function Stop-Web {
    try { sc.exe stop IHUI-WEB | Out-Null } catch { Fail "停止 IHUI-WEB 失败: $_" }
}
function Restart-Web {
    try { sc.exe stop IHUI-WEB | Out-Null } catch {}
    Start-Sleep -Seconds 2
    try { sc.exe start IHUI-WEB | Out-Null } catch { Fail "启动 IHUI-WEB 失败: $_" }
    Start-Sleep -Seconds 8
}

# ── 回滚:仅 web(恢复 .rollback 构建 + 重启 web;api/ai 不受部署影响不重启)──
function Do-Rollback {
    Log "开始回滚:恢复上次 web 构建产物"
    Update-DeployLockHeartbeat        # 整盘 Copy-Item .rollback → .next 要几分钟,回滚期间同样在持有锁
    $rb = "$WebDir\.rollback"
    if (-not (Test-Path "$rb\BUILD_ID")) { Fail "无可用 .rollback 构建,无法回滚" }
    Stop-Web
    Remove-Item "$WebDir\.next" -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item $rb "$WebDir\.next" -Recurse -Force
    Remove-Item $rb -Recurse -Force -ErrorAction SilentlyContinue
    Start-Web
    Start-Sleep -Seconds 8
    if (Test-HealthGate) { Ok "回滚完成,健康检查通过" } else { Fail "回滚后健康仍异常,需人工介入" }
}

# =============================================================================
# -diagnose —— 只读诊断(2026-09-13 加)
#
# 背景:生产出现「服务在重启但代码不更新」时,旧脚本只报一句 FAIL,无法定位。
# 本模式一次性打印定位所需的全部事实:仓库 HEAD / dirty / 分叉、fetch 三源可达性、
# NSSM 服务与进程启动时间、deploy\prod-bundle 是否被用作 API 载体、线上与主干的
# 一致性探针、部署日志尾部、并发锁状态、判读提示。
# **不做**:不加锁、不建备份目录、不迁移、不 seed、不构建、不合并、不切流。
# 唯一副作用:`git fetch`(只更新 .git/FETCH_HEAD,不动工作树)——这是判定 behind/ahead 的必要输入。
# 需 PowerShell 7(pwsh)。
# =============================================================================
function Invoke-Diagnose {
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $script:diagDirty = 0
    $script:diagAhead = -1
    $script:diagFetched = $false
    $script:diagDivergent = $false

    function GitText { param([string[]]$a)
        $o = & git @a 2>&1 | Out-String
        return $o.Trim()
    }
    function DiagLog { param([string]$m) Write-Host $m }

    DiagLog "================ -diagnose 只读诊断 ================"
    DiagLog ("主机:$env:COMPUTERNAME  用户:$env:USERNAME  PID=$PID  时间:{0}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'))
    DiagLog ("仓库根:{0}  存在:{1}" -f $Root, (Test-Path $Root))

    if (Test-Path $Root) {
        Push-Location $Root
        try {
            # ── [1] 仓库状态:定位「为何合并失败 / 为何不部署」──
            DiagLog "── [1] git 状态 ──"
            DiagLog ("HEAD   : {0} | {1} | {2}" -f (GitText @('log','-1','--format=%h')), (GitText @('log','-1','--format=%cI')), (GitText @('log','-1','--format=%s')))
            DiagLog ("分支   : {0}" -f (GitText @('rev-parse','--abbrev-ref','HEAD')))
            DiagLog ("origin : {0}" -f (GitText @('remote','get-url','origin')))
            $porcelain = GitText @('status','--porcelain')
            if ($porcelain) { $script:diagDirty = ($porcelain -split "`n").Count } else { $script:diagDirty = 0 }
            DiagLog ("未提交改动条目数: {0}" -f $script:diagDirty)
            if ($script:diagDirty -gt 0) {
                DiagLog "  ↓ 前 15 条(这些会让 git merge --ff-only 直接失败)"
                ($porcelain -split "`n" | Select-Object -First 15) | ForEach-Object { DiagLog ("    {0}" -f $_) }
            }
            # 官方名归一后字段的旁证:本目录源码是否等于 origin/main
            $apiRouteFile = Join-Path $Root 'apps\api\src\routes\ai-pricing.ts'
            if (Test-Path $apiRouteFile) {
                $script:diagDivergent = [bool](Select-String -Path $apiRouteFile -Pattern 'billingMode|perUnitPrice|tieredCallPrices|videoUnit' -Quiet)
                DiagLog ("apps\api\src\routes\ai-pricing.ts 含「主干从未有过」的字段: {0}(期望 False)" -f $script:diagDivergent)
            }
        } finally { Pop-Location }
    }

    # ── [2] 网络:代理与三源 fetch 可达性 ──
    DiagLog "── [2] git 网络 ──"
    $proxyOk = $false
    try {
        $cli = New-Object System.Net.Sockets.TcpClient
        $iar = $cli.BeginConnect('127.0.0.1', 7897, $null, $null)
        $proxyOk = ($iar.AsyncWaitHandle.WaitOne(600) -and $cli.Connected)
        $cli.Close()
    } catch {}
    DiagLog ("Clash 代理 127.0.0.1:7897 可用: {0}" -f $proxyOk)
    $gitNet = @()
    if ($proxyOk) { $gitNet = @('-c','http.proxy=http://127.0.0.1:7897','-c','https.proxy=http://127.0.0.1:7897') }
    if (Test-Path $Root) {
        Push-Location $Root
        try {
            $srcs = @('origin', 'https://gitcode.com/IHUI-AI/IHUI-AI.git', 'https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI.git')
            foreach ($s in $srcs) {
                $o = & git @gitNet fetch $s main 2>&1 | Out-String
                if ($LASTEXITCODE -eq 0) {
                    DiagLog ("fetch {0} → OK" -f $s)
                    $script:diagFetched = $true
                } else {
                    DiagLog ("fetch {0} → FAIL:{1}" -f $s, (($o.Trim() -split "`n" | Select-Object -First 2) -join ' / '))
                }
            }
            if ($script:diagFetched) {
                $bN = GitText @('rev-list','--count','HEAD..FETCH_HEAD')
                $aN = GitText @('rev-list','--count','FETCH_HEAD..HEAD')
                if ($bN -match '^\d+$') { DiagLog ("相对 FETCH_HEAD: behind={0} ahead={1}" -f $bN, $aN) }
                if ($aN -match '^\d+$') { $script:diagAhead = [int]$aN }
            }
        } finally { Pop-Location }
    }

    # ── [3] 服务与进程启动时间(判断"重启过但代码没换") ──
    DiagLog "── [3] NSSM 服务 ──"
    foreach ($svc in @('IHUI-WEB','IHUI-API','IHUI-AI-SERVICE','IHUI-DEPLOYLOOP')) {
        $s = Get-Service -Name $svc -ErrorAction SilentlyContinue
        if ($s) { DiagLog ("  {0} : {1}" -f $svc, $s.Status) } else { DiagLog ("  {0} : 不存在" -f $svc) }
    }
    DiagLog "── [3b] node/pwsh 进程(命令行为 API 真实载体) ──"
    try {
        Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='pwsh.exe'" -ErrorAction Stop |
            Select-Object -First 12 | ForEach-Object {
                $cmd = $_.CommandLine
                if ($cmd -and $cmd.Length -gt 180) { $cmd = $cmd.Substring(0, 180) + '…' }
                DiagLog ("  pid={0} {1} start={2}" -f $_.ProcessId, $_.Name, $_.CreationDate)
                DiagLog ("      cmd: {0}" -f $cmd)
            }
    } catch { DiagLog ("  (取进程命令失败:{0})" -f $_.Exception.Message) }

    # ── [4] API 载体:A 套壳产物目录是否被使用 ──
    DiagLog "── [4] API 载体 ──"
    $bundle = Join-Path $Root 'deploy\prod-bundle'
    DiagLog ("deploy\prod-bundle 存在: {0}" -f (Test-Path $bundle))
    $runApi = Join-Path $bundle 'svc\run-api.ps1'
    if (Test-Path $runApi) {
        DiagLog "  run-api.ps1 启动相关行:"
        (Select-String -Path $runApi -Pattern 'Start-Process|tsx|dist|node |Set-Location|WorkingDirectory|-File|-c ' -ErrorAction SilentlyContinue |
            Select-Object -First 12) | ForEach-Object { DiagLog ("    {0}" -f $_.Line.Trim()) }
    }

    # ── [5] 线上与主干一致性探针 ──
    DiagLog "── [5] 线上一致性探针 ──"
    $probes = @(
        @{ u = "$ApiHealth"; n = '' },
        @{ u = "$PublicWeb/api/ai-pricing/gemini-3-pro"; n = '' },
        @{ u = "$PublicWeb/developer/keys"; n = 'developerKeys' }
    )
    foreach ($p in $probes) {
        try {
            $r = Invoke-WebRequest -Uri $p.u -TimeoutSec 15 -ErrorAction Stop -UseBasicParsing -SkipHttpErrorCheck
            $hit = ''
            if ($p.n) {
                if ($r.Content -match [regex]::Escape($p.n)) { $hit = "  命中 '$($p.n)'(=旧构建仍在)" } else { $hit = "  未命中 '$($p.n)'" }
            }
            $body = ''
            if ($r.Content) { $body = $r.Content.Substring(0, [Math]::Min(160, $r.Content.Length)) }
            DiagLog ("  {0} → HTTP {1}{2}" -f $p.u, $r.StatusCode, $hit)
            DiagLog ("      body: {0}" -f ($body -replace "`r?`n", ' '))
        } catch {
            DiagLog ("  {0} → 探测失败:{1}" -f $p.u, $_.Exception.Message)
        }
    }

    # ── [6] 部署日志尾部 ──
    DiagLog "── [6] deploy-loop.log 尾部 25 行 ──"
    $loopLog = Join-Path $Root 'deploy\win\deploy-loop.log'
    if (Test-Path $loopLog) {
        Get-Content $loopLog -Tail 25 -ErrorAction SilentlyContinue | ForEach-Object { DiagLog ("  {0}" -f $_) }
    } else { DiagLog "  (日志不存在:$loopLog)" }

    # ── [7] 并发锁 ──
    # 这里此前是**第三份** `Get-Process -Id` 判活(与两个读者各写一遍)。三份同一判据
    # 必然漂移,而漂移的表现是"构建在跑、诊断说没人在跑"。现统一走同一份实现:
    # diagnose 只读,所以不删锁、只把四条判据的结论与依据打印出来。
    DiagLog "── [7] 并发锁 ──"
    foreach ($lf in @((Join-Path $Root 'deploy\win\.deploy.lock'), (Join-Path $Root 'deploy\win\.deploy-loop.lock'))) {
        try {
            $lst = Resolve-IhuiDeployLockState -Path $lf -OwnerKind 'diagnose'
            DiagLog ("  {0}" -f (Format-IhuiDeployLockState -State $lst))
        } catch {
            DiagLog ("  {0}: 判定异常:{1}(这是「未判定」,不是「没有锁」)" -f (Split-Path $lf -Leaf), $_.Exception.Message)
        }
    }

    # ── [7b] DB 迁移是否落后(2026-09-21 加:迁移静默失败两天的直接后果就是这个没人看) ──
    DiagLog "── [7b] DB 迁移落后 ──"
    try {
        $apiEnvP = Join-Path $Root 'apps\api\.env'
        if ((Test-Path $apiEnvP) -and -not $env:DATABASE_URL) {
            Get-Content $apiEnvP | ForEach-Object {
                if ($_ -match '^\s*DATABASE_URL\s*=\s*(.+)\s*$') { $env:DATABASE_URL = $Matches[1].Trim('"', "'") }
            }
        }
        $pd = Get-PendingMigrationCount
        if ($null -eq $pd) { DiagLog "  · 无法判定(journal 或 psql/DATABASE_URL 不可用) —— 不代表没问题,请手查 drizzle.__drizzle_migrations 行数 vs _journal.json entries" }
        elseif ($pd -gt 0) { DiagLog ("  · ❌ 生产库落后 {0} 个迁移:代码已合并但表/列不存在,依赖它的接口会 500/503。逐文件零写复现:BEGIN;<迁移文件>;ROLLBACK" -f $pd) }
        else { DiagLog "  · ✓ 迁移已全部落地(journal 与库内记录一致)" }
    } catch { DiagLog ("  · 判定异常:" + $_.Exception.Message) }

    # ── [7c] web 构建标记与失败冷却(2026-09-21 加:本次「永久跳过」事故在旧诊断里
    #    完全不可见,只能人工猜 marker 状态;现在一眼可判) ──
    DiagLog "── [7c] web 构建标记与失败冷却 ──"
    $mkFile = Join-Path $WebDir '.next\IHUI_BUILD_SHA'
    $headSha = GitText @('rev-parse','HEAD')
    if (Test-Path $mkFile) {
        $builtSha = (Get-Content $mkFile -Raw -ErrorAction SilentlyContinue).Trim()
        $same = if ($builtSha -eq $headSha) { 'True' } else { 'False' }
        DiagLog ("  IHUI_BUILD_SHA={0}" -f ($(if ($builtSha) { $builtSha } else { '(空)' })))
        DiagLog ("  HEAD          ={0}  一致={1} —— 不一致/不存在 ⇒ 下轮轮询强制重建(2026-09-21 新判据:marker≠HEAD 即陈旧)" -f $headSha, $same)
    } else { DiagLog ("  IHUI_BUILD_SHA 不存在 ⇒ 下轮轮询强制重建(marker 只在部署成功后写入)") }
    $cdFile = Join-Path $Root 'deploy\win\.build-fail-state.json'
    if (Test-Path $cdFile) {
        try {
            $cdSt = Get-Content $cdFile -Raw -ErrorAction Stop | ConvertFrom-Json
            $cdAge = ((Get-Date) - [datetime]$cdSt.ts).TotalMinutes
            $cdIn = if ($cdAge -ge 0 -and $cdAge -lt 30) { '是(behind=0 时跳过重试)' } else { '否(已过 30 分钟,下轮自动重试)' }
            DiagLog ("  构建失败冷却: 上次失败 {0:N0} 分钟前(head={1}) ⇒ 冷却中:{2}" -f $cdAge, $cdSt.head, $cdIn)
        } catch { DiagLog ("  构建失败冷却: 状态文件存在但不可读({0})" -f $_.Exception.Message) }
    } else { DiagLog "  构建失败冷却: 无(上次部署成功或从未失败)" }

    # ── [8] 判读提示 ──
    DiagLog "── [8] 判读提示 ──"
    if ($script:diagDirty -gt 0) { DiagLog ("  · 工作树有 {0} 条未提交改动 → git merge --ff-only 会被拒,现象是「每轮 behind>0 却永不部署」。先跑 node scripts/heal-worktree-tracked.mjs --align-drift --dry-run 分清是幻影漂移(部署轮询会自愈)还是真在写的活儿(须等对方收尾,勿代提交勿删除)。" -f $script:diagDirty) }
    if ($script:diagAhead -gt 0) { DiagLog "  · 本地领先 FETCH_HEAD(分叉)→ ff-only 必失败,需人工决定处理策略(勿盲目 reset)。" }
    if (-not $script:diagFetched) { DiagLog "  · 三源 fetch 全失败 → 部署循环必然停摆;先恢复网络/代理(Clash 127.0.0.1:7897),或用镜像手动 fetch。" }
    if ($script:diagDivergent) { DiagLog "  · apps/api 源码含主干从未有过的字段 → 本目录源码并非 origin/main,须核对来源后再部署。" }
    if ($script:diagDirty -eq 0 -and $script:diagAhead -le 0 -and $script:diagFetched) { DiagLog "  · 仓库侧未见异常;若线上仍是旧代码,重点看 [3]/[4]:服务是否真的重启、API 是否跑在非 git 载体上。" }
    DiagLog "================ 诊断结束(未做任何变更) ================"
    $ErrorActionPreference = $prevEAP
}

if ($diagnose) { Invoke-Diagnose; exit 0 }

# ── 零停机蓝绿式部署主流程 ──
New-BackupDir
Set-Location $Root

if (-not $dryrun) { Get-DeployLock }     # 仅实际构建占用;dryrun 只读裸查不占锁

if ($rollbackOnly) { try { Do-Rollback; exit 0 } finally { Release-DeployLock } }

# ── DB 迁移(2026-09-13 加):幂等,每轮执行;drizzle journal 保证仅 pending 迁移实际跑 ──
# 失败只告警不中止部署(数据库连接失败不应阻断 web 发布;计费修复依赖本步,失败会有监控/验证兜底)
#
# 2026-09-21 加固(实测教训):上面那句"失败会有监控兜底"是假的 —— 迁移自 09-19 起连续 exit 1,
# 循环每轮只留一行 WARN 就继续发布,两天无人发现,8 个迁移全被 drizzle 的单事务一起回滚。
# 现在:① 每轮把"journal 条数 vs 库里已记录条数"的差额打进日志(可 grep MIG);
#      ② 失败时按签名去重推送(12h 内同一签名只推一次;压重复不压新故障,无每日总量封顶);
#      ③ 本轮标 degraded,收尾再显式提示一次。仍**不改退出码**(NSSM/包装器语义未知,不冒险)。
function Get-PsqlExe {
    foreach ($c in @('D:\DevEnv\runtimes\pgsql\bin\psql.exe')) { if (Test-Path $c) { return $c } }
    $g = Get-Command psql.exe -ErrorAction SilentlyContinue
    if ($g) { return $g.Source }
    return $null
}

function Get-PendingMigrationCount {
    # 返回 $null 表示"判不了"(取不到 journal 或连不上库)—— 宁可不说,也不误报 0
    $total = 0
    try {
        $jp = Join-Path $Root 'packages\database\drizzle\meta\_journal.json'
        if (-not (Test-Path $jp)) { return $null }
        $total = (@((Get-Content $jp -Raw | ConvertFrom-Json).entries)).Count
        if ($total -lt 1) { return $null }
    } catch { return $null }
    try {
        $psql = Get-PsqlExe
        if (-not $psql -or -not $env:DATABASE_URL) { return $null }
        $raw = ((& $psql $env:DATABASE_URL -At -c "select count(*) from drizzle.__drizzle_migrations;" 2>$null) | Out-String).Trim()
        if ($raw -notmatch '^\d+$') { return $null }
        $d = $total - ([int]$raw)
        if ($d -lt 0) { $d = 0 }
        return $d
    } catch { return $null }
}

function Test-MigrateOrphans {
    # 孤儿迁移记录检测(2026-09-21 加,实测教训):DB 里出现 created_at > journal 最大 when 的
    # 记录(如孤儿行 created_at=1790006400000 未来时间戳)时,drizzle 按「created_at desc limit 1」
    # 与 folderMillis 比较会判定全部迁移已应用 → 假成功、pending 永久清不掉。
    # 返回 $true=有孤儿(已打日志,由调用方决定是否告警);$false=无;$null=判不了。
    try {
        $jp = Join-Path $Root 'packages\database\drizzle\meta\_journal.json'
        if (-not (Test-Path $jp)) { return $null }
        $jMax = [long](@((Get-Content $jp -Raw | ConvertFrom-Json).entries) | Select-Object -Last 1 | ForEach-Object { $_.when })
    } catch { return $null }
    try {
        $psql = Get-PsqlExe
        if (-not $psql -or -not $env:DATABASE_URL) { return $null }
        $raw = ((& $psql $env:DATABASE_URL -At -c "select coalesce(max(created_at),0) from drizzle.__drizzle_migrations;" 2>$null) | Out-String).Trim()
        if ($raw -notmatch '^\d+$') { return $null }
        $dbMax = [long]$raw
        if ($dbMax -gt $jMax) {
            Log "WARN  孤儿迁移记录:DB max created_at=$dbMax > journal 最大 when=$jMax —— drizzle 会判定全部已应用(假成功),需人工删孤儿行"
            return $true
        }
        return $false
    } catch { return $null }
}

function Note-MigrateFailure {
    param([string]$reason, [string]$pendingTxt)
    $script:DbMigrateDegraded = $true
    $sig = "$reason|$pendingTxt"
    $prevSig = ''; $prevTs = [datetime]::MinValue
    try {
        if (Test-Path $MigAlertStateFile) {
            $st = Get-Content $MigAlertStateFile -Raw | ConvertFrom-Json
            $prevSig = [string]$st.sig
            try { $prevTs = [datetime]$st.ts } catch { $prevTs = [datetime]::MinValue }
        }
    } catch {}
    $ageH = ((Get-Date) - $prevTs).TotalHours
    if ($prevSig -eq $sig -and $ageH -lt 12) {
        Log ("MIG   同一签名告警 {0:N1}h 内已推过,跳过(签名={1})" -f $ageH, $sig)
        return
    }
    try {
        Set-Content -Path $MigAlertStateFile -Value (@{ sig = $sig; ts = (Get-Date).ToString('o') } | ConvertTo-Json -Compress) -NoNewline
    } catch {}
    try {
        Invoke-FailNotify -m "DB 迁移未落地(原因:$reason;仍待应用 $pendingTxt)。部署循环按设计继续发布,但生产库结构已落后代码 —— 逐文件复现办法:BEGIN;<迁移文件>;ROLLBACK(零写生产)。详见 deploy\win\deploy-loop.log 的 MIG 行"
    } catch { Log "MIG   告警推送异常: $_" }
}

function Invoke-DbMigrate {
    Log "DB 迁移检查(packages/database db:migrate)"
    $apiEnv = "$Root\apps\api\.env"
    if (Test-Path $apiEnv) {
        Get-Content $apiEnv | ForEach-Object {
            if ($_ -match '^\s*DATABASE_URL\s*=\s*(.+)\s*$') { $env:DATABASE_URL = $Matches[1].Trim('"',"'") }
        }
    }
    Push-Location "$Root\packages\database"
    try {
        $migOut = & "D:\DevEnv\tools\npm-global\pnpm.cmd" run db:migrate 2>&1 | Out-String
        $migOut | Write-Host
        $pend = Get-PendingMigrationCount
        $pendTxt = if ($null -eq $pend) { '未知' } else { "$pend 个" }
        Log "MIG   待应用迁移=$pendTxt(journal vs drizzle.__drizzle_migrations)"
        # 孤儿记录检测(2026-09-21 加):有孤儿时 pending 永远清不掉且 migrate 假成功,必须显式告警
        if (Test-MigrateOrphans) {
            Note-MigrateFailure -reason "孤儿迁移记录(DB max created_at 超过 journal 最大 when)" -pendingTxt $pendTxt
        }
        if ($LASTEXITCODE -eq 0) {
            if ($pend -gt 0) {
                Log "WARN  db:migrate exit 0 但仍落后 $pend 个迁移 —— 属于「跑过但没应用完」,需人工核查"
                Note-MigrateFailure -reason "exit 0 但仍有待应用" -pendingTxt $pendTxt
            } else {
                Ok "db:migrate 完成(exit 0)"
            }
        }
        else {
            # 2026-09-13 加固:失败必须能定位到具体迁移,而不是只报退出码
            $bad = ($migOut -split "`n" | Where-Object { $_ -match "\.sql|ERROR|error:" } | Select-Object -First 6) -join " | "
            Log "WARN  db:migrate 失败(exit $LASTEXITCODE),本轮继续但需人工核查;线索: $bad"
            Note-MigrateFailure -reason "exit $LASTEXITCODE" -pendingTxt $pendTxt
        }
    } finally { Pop-Location }
}
Update-DeployLockHeartbeat   # 心跳(阶段边界):锁的 writtenAt 之后到第一次构建之间还可能
# 走过 迁移/seed/fetch/merge 这一段,每段都是网络或数据库等待;逐阶段续心跳,
# 才不会出现"合法持有者静默 45 分钟 ⇒ 被判陈旧 ⇒ 手工部署抢锁并发构建"。
if (-not $dryrun) { Invoke-DbMigrate }

# ── DB seed(2026-09-13 加):仅跑 13 号中转站定价步骤,幂等可重复 ──
# 与 Invoke-DbMigrate 共用 apps/api/.env 的 DATABASE_URL(进程级 env 已设置,这里再兜底一次)
function Invoke-DbSeedRelayPricing {
    Log "DB seed(packages/database 中转站定价,--only=13)"
    $apiEnv = "$Root\apps\api\.env"
    if (Test-Path $apiEnv) {
        Get-Content $apiEnv | ForEach-Object {
            if ($_ -match '^\s*DATABASE_URL\s*=\s*(.+)\s*$') { $env:DATABASE_URL = $Matches[1].Trim('"',"'") }
        }
    }
    Push-Location "$Root\packages\database"
    try {
        $seedOut = & "D:\DevEnv\tools\npm-global\pnpm.cmd" exec tsx seed/index.ts --only=13 2>&1 | Out-String
        $seedOut | Write-Host
        if ($LASTEXITCODE -eq 0) { Ok "seed 完成(exit 0)" }
        else { Log "WARN  seed 失败(exit $LASTEXITCODE),本轮继续但需人工核查" }
    } finally { Pop-Location }
}
if (-not $dryrun) { Invoke-DbSeedRelayPricing }

# ── 代理解析(2026-09-13 修复,实测):GitHub 直连在本机被墙,系统/SYSTEM 上下文
#    没有 http_proxy 环境变量 → `git fetch` 报 "Failed to connect to github.com:443"
#    (实测 09-13 09:13),且失败时 stdout 为空 → 旧代码 `[int](...)` 得 0 →
#    误判"已是最新"静默 exit 0。此为「部署循环永不部署」的第二重根因(静默失效),
#    比 origin/main ref 被吞更隐蔽。对策:① 探测本机 Clash 代理显式传给 git;
#    ② fetch 与 behind 全程 fail-closed —— 任何一步失败即非 0 退出,绝不伪装成"已最新"。
$ProxyCandidates = @('http://127.0.0.1:7897')
$Proxy = $null
foreach ($p in $ProxyCandidates) {
    try {
        $u = [Uri]$p
        $cli = New-Object System.Net.Sockets.TcpClient
        $iar = $cli.BeginConnect($u.Host, $u.Port, $null, $null)
        if ($iar.AsyncWaitHandle.WaitOne(600) -and $cli.Connected) { $Proxy = $p; $cli.Close(); break }
        $cli.Close()
    } catch {}
}
$gitNet = @()
if ($Proxy) { $gitNet = @('-c', "http.proxy=$Proxy", '-c', "https.proxy=$Proxy"); Log "git 网络走代理 $Proxy" }
else { Log "WARN  未探测到可用代理(候选:$($ProxyCandidates -join ',')),将尝试直连" }

Update-DeployLockHeartbeat   # fetch 走代理时可能很慢(镜像回退链),阶段边界续心跳
Log "fetch origin main ..."
$fetchOut = & git @gitNet fetch origin main 2>&1 | Out-String
$fetchOut.Trim() | Write-Host
# ── 镜像回退(2026-09-13 加):本机 GitHub 直连被墙,依赖 Clash 代理(127.0.0.1:7897);
#    代理未运行/被防火墙拦时 fetch 必失败 → fail-closed → 部署循环长时间停摆(实测 09-13
#    出现 uptime 单调上升 35 分钟、新提交不入库)。三仓 main 由本项目推送流程保证同步,
#    故 origin 失败时回退国内镜像;镜像落后时 behind=0 会自然跳过,不会回滚。
#    注意:镜像 fetch 同样写 FETCH_HEAD,下游 behind/merge 逻辑无需改动。
$MirrorUrls = @(
    'https://gitcode.com/IHUI-AI/IHUI-AI.git',
    'https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI.git'
)
$fetched = $false
if ($LASTEXITCODE -eq 0 -and -not ($fetchOut -match 'fatal:|Could not connect|RPC failed|Could not resolve host')) {
    $fetched = $true
} else {
    Log "WARN  origin fetch 失败,尝试国内镜像回退 ..."
    foreach ($m in $MirrorUrls) {
        Log "fetch $m main ..."
        $mOut = & git fetch $m main 2>&1 | Out-String
        $mOut.Trim() | Write-Host
        if ($LASTEXITCODE -eq 0 -and -not ($mOut -match 'fatal:|Could not connect|RPC failed|Could not resolve host')) {
            $fetched = $true
            Log "镜像回退成功:$m"
            break
        }
    }
}
if (-not $fetched) {
    Fail "git fetch 全部来源失败(origin + 镜像),fetch 未成功则无法判定是否落后,本轮不部署"
}
# 落后提交数 = 本地未含 origin/main 的提交数
# 2026-09-13 修复(实测):本机 origin/main 这个嵌套 remote-tracking ref 会被宿主吞掉、永不更新
# (fetch 打印 6eedf5b0f1..adcc23136a 但 rev-parse origin/main 仍读回旧值)→
# 旧写法 git rev-list --count HEAD..origin/main 恒 0 → 循环判定"已是最新"提前退出、永不部署。
# 改为对齐刚 fetch 下来的 FETCH_HEAD(fetch 之后它必然是远端最新),彻底免疫该问题。
$behindRaw = (& git @gitNet rev-list --count HEAD..FETCH_HEAD 2>&1 | Out-String).Trim()
if ($behindRaw -notmatch '^\d+$') { Fail "无法计算 behind(FETCH_HEAD 无效:'$behindRaw'),本轮不部署" }
$behind = [int]$behindRaw

if ($behind -eq 0 -and -not $deployLatest -and -not (Get-BuildStale)) {
    Ok "本地已是最新 main,无需部署(behind=$behind)"
    Release-DeployLock
    exit 0
}
if ($behind -eq 0 -and -not $deployLatest) {
    # 冷却拦截(2026-09-21 加):上轮构建/门禁失败后 30 分钟内不因「构建新鲜度」反复重试,
    # 防持续失败时每轮 10-20 分钟无效构建;30 分钟后自动重试,根因修复后无需人工干预。
    # behind>0(有新提交)不拦,push→部署及时性优先。
    if (Test-BuildCooldown) {
        Log "SKIP  前轮构建/门禁失败后冷却中(30 分钟内),本轮不重建;冷却结束自动重试,根因已修复则无需干预"
        Release-DeployLock
        exit 0
    }
    Log "WARN  触发原因=构建新鲜度:源码未落后但 web 构建非当前提交产物 → 强制重建"
}
if ($dryrun) { Ok "dryrun 模式: behind=$behind,即将部署到 origin/main=$($(git rev-parse --short FETCH_HEAD | Out-String).Trim())"; Release-DeployLock; exit 0 }

if ($behind -gt 0) {
    Log "本地落后远端 $behind 个提交,进行 fast-forward merge(FETCH_HEAD)"
    # 前置现场对齐(实现见 Invoke-WorktreeAlign):脏工作树是 ff-only 最常见的失败原因,其中一部分
    # 是可自愈的幻影漂移。工作树本就干净时不跑自愈,省掉逐路径扫 git log 的开销。
    $dirtyBefore = Get-TrackedDirtyEntry
    if ($dirtyBefore.Count -gt 0) {
        Log "ff-only 前置:检测到 $($dirtyBefore.Count) 个被跟踪文件有未提交改动 → 先做幻影漂移对齐(真编辑不碰)"
        Invoke-WorktreeAlign | Out-Null
        $dirtyAfter = Get-TrackedDirtyEntry
        Log "ff-only 前置:对齐后剩余 $($dirtyAfter.Count) 个未提交被跟踪文件(本轮对齐掉 $($dirtyBefore.Count - $dirtyAfter.Count) 个)"
    }
    $mergeOut = (& git merge --ff-only FETCH_HEAD 2>&1 | Out-String)
    Write-Host $mergeOut
    if ($LASTEXITCODE -ne 0) {
        # 2026-09-24 更正判据的成因归属:下面这段原先只看"工作树有没有脏文件"就判 BLOCKED-WIP,
        # 但"有脏文件"只是背景,不是这次 merge 失败的原因。真分叉时 git 报的是
        # "Not possible to fast-forward",而只要树上恰有脏文件(共享工作区常年如此),旧代码就会
        # 把结论写成"有人在写,等对方收尾" —— 实测把排查整个带去清扫工作树,白耗 1.5h 并寄出一次
        # 错因告警。现按 git 自己说的话分类,且 WIP 一支只点名**真正挡住 ff 的那几个路径**
        # (= 脏 ∩ 本次要改),不再把 41 个无关脏文件列成阻塞项。
        $stillDirty = Get-TrackedDirtyEntry
        if ($mergeOut -match 'Not possible to fast-forward') {
            Log "BLOCKED-DIVERGED 远端与本地已分叉(git 原话:Not possible to fast-forward),这不是脏文件造成的。"
            Log "BLOCKED-DIVERGED 处置:只能由人/持有人会话跑 node scripts/git-sync-converge.mjs(本脚本永不强推、永不硬回退、永不动他人未提交改动)。"
            Log "BLOCKED-DIVERGED 背景(非成因):工作树另有 $($stillDirty.Count) 个未提交被跟踪文件。"
            Fail "git merge --ff-only FETCH_HEAD 失败:仓库真分叉,需人工收敛后才能切流(未强推、未动任何在途改动)"
        }
        $dirtyPaths = @($stillDirty | ForEach-Object { $_.Substring([Math]::Min(3, $_.Length)).Trim() })
        $mustTouch = @(& git -C $Root diff --name-only HEAD FETCH_HEAD 2>&1 | Out-String) -split "`r?`n" |
            Where-Object { $_.Trim() }
        $blockers = @($dirtyPaths | Where-Object { $mustTouch -contains $_ })
        if ($blockers.Count -gt 0) {
            Report-BlockedWip -Entries (@($blockers | ForEach-Object { " M $_" }))
            Fail "git merge --ff-only FETCH_HEAD 失败:上面 $($blockers.Count) 个未提交文件与本次要更新的路径重叠,挡住 ff(不代提交不删除),已停止,未切流"
        }
        if ($stillDirty.Count -gt 0) {
            # 走到这里 = git 既没说分叉、脏文件也不与本次更新重叠 ⇒ 未判定,如实报出原文
            Log "WARN  merge 失败成因未归类(git 输出不含上述两种指纹);脏文件 $($stillDirty.Count) 个但与本次更新不重叠。git 原文尾 5 行:"
            @($mergeOut -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 5) | ForEach-Object { Log "  [git] $_" }
        }
        Fail "git merge --ff-only FETCH_HEAD 失败(成因见紧邻上一行),已停止,未切流"
    }
    Ok "merge 完成,HEAD=$(git rev-parse --short HEAD | Out-String)"
}

# 1) 备份当前 web 构建 → .rollback(web 保持在线,只读复制)
Update-DeployLockHeartbeat   # merge/seed 之后、构建之前的阶段边界(见 :980 那条注释)
Log "备份当前 web 构建 → .rollback"
$curNext = "$WebDir\.next"
if (Test-Path "$curNext\BUILD_ID") {
    $rb = "$WebDir\.rollback"
    Remove-Item $rb -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item $curNext $rb -Recurse -Force
    Ok "已备份当前构建为回滚点"
} else { Log "未发现现有 .next\BUILD_ID,跳过备份(冷启动)" }

# 2) 构建到 staging 目录(Turbopack 持久 cache 独立于 staging,每次冷构建规避
#    持久 cache 遮蔽的 CSS 解析偶发问题);web 在线,构建期零停机
try {
        Remove-Item "$WebDir\.next-staging" -Recurse -Force -ErrorAction SilentlyContinue
        Build-Web -DistDir 'staging'
    } catch {
        # 2026-09-21 根治:失败轮不再 Set-BuildMarker(旧逻辑写「尝试标记」导致
        # marker=HEAD → 下一轮误判新鲜 → 永久跳过,根因消失也无法自愈)。
        # 改记失败冷却:30 分钟内不重试,之后自动重试直到成功。
        Set-BuildCooldown
        Log "构建失败($_) → 保持当前在线版本,不动 web,已记冷却(30 分钟后自动重试)"
        Release-DeployLock
        exit 1
    }

# 3) 秒级交换:停 web → 用新构建替换 .next → 起 web
Log "交换 staging → 线上(.next),重启 web"
Stop-Web
Remove-Item "$WebDir\.next" -Recurse -Force -ErrorAction SilentlyContinue
Move-Item "$WebDir\.next-staging" "$WebDir\.next"
# 2026-09-15 修复:next build 在 IHUI_BUILD_DIST 覆盖 distDir 时会把被跟踪的
#   next-env.d.ts 改写为引用 .next-staging/types/...,但上方只移动 .next 目录、
#   不还原该文件 → 残留污染源码树(违反 AGENTS.md「.next-* 变体永不提交」铁律)。
#   交换完成后立即还原为已提交版本;git 不可用时静默跳过(不阻塞部署)。
try {
    $gitCmd = Get-Command git -ErrorAction SilentlyContinue
    if ($gitCmd) { & git -C $Root checkout -- apps/web/next-env.d.ts 2>$null }
} catch { /* 还原失败不阻塞部署,下次本地 git checkout 即可 */ }
Start-Web
Start-Sleep -Seconds 8

# 4) 健康门禁(web + api + llm)
Log "健康门禁检查"
if (-not (Test-HealthGate)) {
    if ($force) { Log "force=true,忽略门禁直接切流(违规操作,请确认)" }
    else {
        # 2026-09-21 根治:回滚属于失败轮,不再 Set-BuildMarker(旧逻辑导致 marker=HEAD
        # 误判新鲜永久跳过);改记冷却,30 分钟后自动重试。
        # 且回滚后必须提前退出 —— 旧代码会流到收尾 Set-BuildMarker,把「回滚保留的
        # 旧构建」标记成新 HEAD 的成功构建,下轮误判新鲜跳过,同样造成部署停滞。
        Set-BuildCooldown
        Do-Rollback
        Log "=== 门禁未过已回滚,旧版本在线;已记冷却,30 分钟后自动重试构建 ==="
        Release-DeployLock
        exit 0
    }
} else {
    Ok "健康门禁通过,部署成功"
    Clear-BuildCooldown
    Remove-Item "$WebDir\.rollback" -Recurse -Force -ErrorAction SilentlyContinue

    # ── 重启 api(2026-09-13 加):api 为源码直跑,pull 后需重载才能吃到后端新代码 ──
    # 服务名不确定,按候选精确匹配;找不到则跳过(tsx watch 形态会自动重载)
    $apiName = @('IHUI-API','ihui-api','svc-api','IHUI-API-SVC') |
        Where-Object { $null -ne (Get-Service -Name $_ -ErrorAction SilentlyContinue) } |
        Select-Object -First 1
    if ($apiName) {
        Log "重启 api 服务($apiName)使后端新代码生效"
        try {
            sc.exe stop $apiName | Out-Null
            Start-Sleep -Seconds 4
            sc.exe start $apiName | Out-Null
            Start-Sleep -Seconds 6
            $apiOk = $false
            for ($i = 1; $i -le 5; $i++) {
                if (Test-Http -url $ApiHealth -contains '"status":"ok"') { $apiOk = $true; break }
                Start-Sleep -Seconds 6
            }
            if ($apiOk) { Ok "api 重启完成且健康" }
            else { Log "WARN  api 重启后健康未即时通过(冷启动可能较慢),需人工核查 $apiName" }
        } catch { Log "WARN  api 重启异常: $_" }
    } else {
        Log "未找到 api 服务(候选:IHUI-API/ihui-api/svc-api),跳过重启(tsx watch 形态自动重载)"
    }

    # ── 重启 ai-service(2026-09-14 加):uvicorn 源码直跑,pull 后需重载才能吃到
    # 新路由/新代码——当日实证:ai-service 停在旧版(FIM summary 路由 404),根因
    # 即部署只重启 web+api 漏了 ai-service。服务名按候选精确匹配;找不到则跳过。
    $aiName = @('IHUI-AI-SERVICE','ihui-ai-service','svc-ai','IHUI-AI-SVC') |
        Where-Object { $null -ne (Get-Service -Name $_ -ErrorAction SilentlyContinue) } |
        Select-Object -First 1
    if ($aiName) {
        Log "重启 ai-service 服务($aiName)使 AI 新代码生效"
        try {
            sc.exe stop $aiName | Out-Null
            Start-Sleep -Seconds 4
            sc.exe start $aiName | Out-Null
            Start-Sleep -Seconds 8
            $aiOk = $false
            for ($i = 1; $i -le 5; $i++) {
                if (Test-Http -url $AiServiceHealth) { $aiOk = $true; break }
                Start-Sleep -Seconds 6
            }
            if ($aiOk) { Ok "ai-service 重启完成且健康" }
            else { Log "WARN  ai-service 重启后健康未即时通过(冷启动可能较慢),需人工核查 $aiName" }
        } catch { Log "WARN  ai-service 重启异常: $_" }
    } else {
        Log "未找到 ai-service 服务(候选:IHUI-AI-SERVICE/ihui-ai-service/svc-ai),跳过重启"
    }
}
# 收尾写成功标记(2026-09-21 语义变更):只有部署成功(或显式 -force)才会流到这里,
# marker 语义 = 「.next 是该 HEAD 的成功构建」。失败路径(构建异常/门禁回滚)均已提前
# 退出或改记冷却,绝不写 marker —— 这是本次「误判新鲜永久跳过」事故的根治点。
Set-BuildMarker
Write-Host ""
Log "=== 部署完成,HEAD=$(git rev-parse --short HEAD | Out-String).Trim() 活跃组=win(8801/8802/8803) ==="
Release-DeployLock
if ($script:DbMigrateDegraded) {
    Log "WARN  本轮收尾:DB 迁移未落地(发布按设计继续),状态见 deploy\win\.migrate-alert-state.json;-diagnose 的 [7b] 会复述落后条数"
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
