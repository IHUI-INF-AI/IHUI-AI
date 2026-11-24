# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# IHUI-AI 部署诊断采集库(PowerShell 版,P2-13 deploy 运维 AI 化 · 残段①)
# =============================================================================
# 本文件是 deploy-diagnose.sh(采集库)的 PowerShell 姊妹形态:Windows compose
# 链(deploy/prod-bundle/deploy.ps1)此前零诊断接线、零结果落盘,把失败交给
# ai-diagnose.mjs 诊断的前提("把输入产出来")在 Windows 侧完全缺位。
# 函数与 bash 版一一对应,落盘形态(文件名/目录/JSON 键)逐字段同形:
#   Initialize-IhuiDiag            = ihui_diag_init          日志/结果落盘路径
#   Write-IhuiDiagLog              = ihui_diag_log           追加一行进部署日志
#   Invoke-IhuiDiagCapture         = ihui_diag_capture       stdout+stderr 透传+落盘,保留 $LASTEXITCODE
#   Write-IhuiDiagResult           = ihui_diag_result        落 .last-deploy-result.json(键与 bash 版全同)
#   Update-IhuiDiagContainerLogs   = ihui_diag_container_logs 失败时抓容器日志进部署日志
#   Update-IhuiDiagHealthJson      = ihui_diag_health_json    跑健康检查 -Json 落文件(取不到不报错)
#   Invoke-IhuiDiagRun             = ihui_diag_run            调 ai-diagnose.mjs 并 --out 落盘报告
#                                    (时刻流水一份 + 固定指针 ai-diagnose-latest.md;
#                                     node/IHUI_AI_KEY 不齐 ⇒ 拒绝运行、留一行痕迹,绝不编造诊断)
#   Resolve-IhuiDiagRepoRoot       = ihui_diag_repo_root      上溯找邮件唯一出口(取不到⇒未判定)
#   Get-IhuiDiagSafeCategory       = ihui_diag_safe_category  身份只吃稳定枚举,原文不进键
#   Update-IhuiDiagNotifyCount     = ihui_diag_bump_count     同类别第几轮(计数只进正文)
#   Write-IhuiDiagNotifyRecord     = ihui_diag_notify_record  本轮结论落 logs/.diag-notify-log.jsonl
#   Send-IhuiDiagNotify            = ihui_diag_notify         诊断结论经**唯一到人通道**寄出
#                                    (§5e:一律经 apps/api/scripts/notify-deploy-failure.ts;
#                                     身份 = compose-deploy;<类别>,计数只进正文)
#
# 用法(在调用方脚本里,必须在自定义输出函数之前 dot-source,与 bash 链同序):
#   if (Test-Path $diagLib) { . $diagLib } else { ...空实现兜底... }
#   Initialize-IhuiDiag $ScriptDir "compose"
#   Write-IhuiDiagResult "failed" "build" "docker compose build 失败"
#   Invoke-IhuiDiagRun "deploy.ps1(compose 链)docker compose build 失败" "build"
#
# 设计约束(与 bash 版逐条同):
#   - 默认零行为变化:所有函数任何失败一律吞进 try/catch 只留一行痕迹,
#     绝不因为"诊断跑不了"或"信寄不出去"弄挂部署;调用方处于 $ErrorActionPreference='Stop' 时同样安全。
#   - 到人只走**一条**通道:邮件,且一律经 apps/api/scripts/notify-deploy-failure.ts(§5e)。
#     本库不自拼传输层(守门 81 硬拦)、不引第三方推送腿(已整体摘除);投递尝试由出口自己追写
#     .ihui-agent/state/mail-send-ledger.jsonl(§5e-3),本库另在 logs/ 记一份"本轮结论"投递账。
#   - 不写死盘符:落点全部由调用方传进来的 base 目录推导(§15b)。
#   - 兼容 Windows PowerShell 5.1 与 pwsh 7:不用 7.x 专属语法;latest 指针用副本形态
#     (bash 版 ln -sf 的 cp 兜底分支在 Windows 上是唯一可靠形态,符号链接需特权)。
#   - 日志/JSON 一律无 BOM UTF-8(与 deploy.ps1 既有 [System.IO.File]::WriteAllText 口径同)。
# =============================================================================

# 由本库所在文件路径推导,调用方不需要知道它被放在哪(与 bash 的 BASH_SOURCE 同法)。
$script:IHuiDiagSelfDir = if ($PSScriptRoot) {
    $PSScriptRoot
} elseif ($PSCommandPath) {
    Split-Path -Parent $PSCommandPath
} else {
    ''
}

$script:IHuiDiagLogFile = if ($env:IHUI_DIAG_LOG_FILE) { $env:IHUI_DIAG_LOG_FILE } else { '' }
$script:IHuiDiagResultFile = if ($env:IHUI_DIAG_RESULT_FILE) { $env:IHUI_DIAG_RESULT_FILE } else { '' }
$script:IHuiDiagLogDir = if ($env:IHUI_DIAG_LOG_DIR) { $env:IHUI_DIAG_LOG_DIR } else { '' }
# 发信台账里的生产者名(§5e-3 量算仪按 (producer, 身份) 数封数)。与 bash 版同一个常量:
# 改名 = 老账对不上新账,所以它是常量,不由调用方随手传;要区分链别请改类别。
$script:IHuiDiagMailSource = 'prod-bundle-compose'
$script:IHuiDiagStartedAt = if ($env:IHUI_DIAG_STARTED_AT) {
    $env:IHUI_DIAG_STARTED_AT
} else {
    (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
}

# 无 BOM UTF-8 落一行(Add-Content -Encoding UTF8 在 5.1 上每次调用可能重复写 BOM,
# 所以下游一律走 .NET API,与 deploy.ps1 既有写法同口径)。
function script:Write-IhuiDiagRawLine {
    param([string]$Path, [string]$Line)
    if (-not $Path) { return }
    try {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::AppendAllText($Path, $Line + [Environment]::NewLine, $utf8NoBom)
    } catch { }
}

# ── 落点初始化 ─────────────────────────────────────────────────────────────
# $BaseDir = 日志与结果文件写进 <BaseDir>/logs/,$Tag = 用于日志文件名的标签
function script:Initialize-IhuiDiag {
    param([string]$BaseDir, [string]$Tag = 'deploy')
    try {
        $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
        $logs = Join-Path $BaseDir 'logs'
        if (-not (Test-Path $logs)) { New-Item -ItemType Directory -Force -Path $logs | Out-Null }
        # 固定名 latest 供采集器读,带时间戳的那份是流水(§28:日志一律落 logs/,不落一级目录)
        $script:IHuiDiagLogFile = Join-Path $logs ("deploy-{0}-{1}.log" -f $Tag, $ts)
        $script:IHuiDiagResultFile = Join-Path $logs '.last-deploy-result.json'
        $script:IHuiDiagLogDir = $logs
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($script:IHuiDiagLogFile, '', $utf8NoBom)
        if (Test-Path $script:IHuiDiagLogFile) {
            # latest 指针:Windows 上符号链接需要特权,直接采用 bash 版 cp 兜底分支的副本形态
            Copy-Item -Force $script:IHuiDiagLogFile (Join-Path $logs ("deploy-{0}-latest.log" -f $Tag))
            [Console]::Error.WriteLine("[diag] 部署日志落盘: $($script:IHuiDiagLogFile)")
        } else {
            $script:IHuiDiagLogFile = ''
            [Console]::Error.WriteLine('[diag][WARN] 日志目录不可写,诊断输入将缺失')
        }
    } catch {
        $script:IHuiDiagLogFile = ''
        [Console]::Error.WriteLine("[diag][WARN] 日志初始化异常($_),诊断输入将缺失")
    }
}

# 追加一行到部署日志(调用方已经把同一行写到终端了,这里只补盘)
function script:Write-IhuiDiagLog {
    param([string]$Message)
    if (-not $script:IHuiDiagLogFile) { return }
    Write-IhuiDiagRawLine $script:IHuiDiagLogFile (
        ('{0:yyyy-MM-dd HH:mm:ss} {1}' -f (Get-Date), $Message)
    )
}

# ── 透传 + 落盘 ────────────────────────────────────────────────────────────
# bash 版靠 pipefail 保住被调方退出码;PowerShell 侧对应物是 $LASTEXITCODE,
# 它只被原生命令改写、管道内不重置 ⇒ 调用方紧接着查 $LASTEXITCODE 即为被调方真实码。
# 临时把 EAP 降为 Continue:native stderr 经 2>&1 会包成 ErrorRecord,pwsh 7.2/7.3 在
# EAP=Stop 下会把它抛成终止错误 —— 那会把"无害的 stderr 输出"变成部署事故,必须防。
# 调用形态必须是逗号数组:刻意不学 bash 的 "$@" 变参(VRFA)——实测 ValueFromRemainingArguments
# 会把结尾的裸开关 token(如 `up -d` 的 -d)当未知参数名**静默吞掉**,等于把
# `docker compose up -d` 跑成前台 attach,部署流程直接被挂住。
#   Invoke-IhuiDiagCapture docker,'compose','up','-d'
function script:Invoke-IhuiDiagCapture {
    param([Parameter(Mandatory = $true, Position = 0)][string[]]$Command)
    if (-not $Command -or $Command.Count -eq 0) { return }
    $joined = $Command -join ' '
    Write-IhuiDiagRawLine $script:IHuiDiagLogFile ("----- $ $joined $("{0:HH:mm:ss}" -f (Get-Date)) -----")
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        if ($Command.Count -gt 1) {
            & $Command[0] $Command[1..($Command.Count - 1)] 2>&1 | ForEach-Object {
                if ($_ -is [System.Management.Automation.ErrorRecord]) {
                    $text = $_.Exception.Message
                } else {
                    $text = [string]$_
                }
                Write-IhuiDiagRawLine $script:IHuiDiagLogFile $text
                Write-Output $text
            }
        } else {
            & $Command[0] 2>&1 | ForEach-Object {
                if ($_ -is [System.Management.Automation.ErrorRecord]) {
                    $text = $_.Exception.Message
                } else {
                    $text = [string]$_
                }
                Write-IhuiDiagRawLine $script:IHuiDiagLogFile $text
                Write-Output $text
            }
        }
    } catch {
        Write-IhuiDiagLog "[diag][WARN] 捕获执行异常($_):$joined"
    } finally {
        $ErrorActionPreference = $prevEap
    }
}

# ── 部署结果落盘(.last-deploy-result.json)────────────────────────────────
# 键名与 bash 版 ihui_diag_result 逐字段同形(status/stage/message/startedAt/
# finishedAt/logFile/scriptDir),下游 apps/api/src/routes/deploy-diagnosis.ts 与
# packages/api-client 的 admin-deploy.ts 都在读它。消息里的引号/反斜杠交给
# ConvertTo-Json 转义 —— 手写转义(如 bash 版 sed 链)在 PowerShell 侧没有存在的理由。
# $Status = success|failed|skipped  $Stage = 阶段名  $Message = 一句话说明
function script:Write-IhuiDiagResult {
    param([string]$Status, [string]$Stage, [string]$Message)
    if (-not $script:IHuiDiagResultFile) { return }
    try {
        $obj = [ordered]@{
            status      = $Status
            stage       = $Stage
            message     = $Message
            startedAt   = $script:IHuiDiagStartedAt
            finishedAt  = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
            logFile     = $script:IHuiDiagLogFile
            scriptDir   = $script:IHuiDiagSelfDir
        }
        $json = ($obj | ConvertTo-Json -Compress)
        $tmp = "$($script:IHuiDiagResultFile).tmp"
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($tmp, $json + [Environment]::NewLine, $utf8NoBom)
        Move-Item -Force $tmp $script:IHuiDiagResultFile
    } catch {
        # 宁可少一条记录,也不能产一个解析不了的产物;但痕迹必须留下
        Write-IhuiDiagLog "[diag][WARN] 结果 JSON 落盘异常($_)"
    }
    Write-IhuiDiagLog "[result] $Status @ ${Stage}: $Message"
}

# ── 容器日志(唯一原本就有内容的那个输入)─────────────────────────────────
# $Note = 追加说明(进日志用);可选 $ComposeFile = compose 文件(第二栈时传)
function script:Update-IhuiDiagContainerLogs {
    param([string]$Note = '', [string]$ComposeFile = '')
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-IhuiDiagLog "[diag] docker 不可用,跳过容器日志 $Note"
        return
    }
    if (-not $script:IHuiDiagLogFile) { return }
    if ($ComposeFile) {
        $dockerArgs = @('compose', '-f', $ComposeFile, 'logs', '--tail', '200')
    } else {
        $dockerArgs = @('compose', 'logs', '--tail', '200')
    }
    $joined = $dockerArgs -join ' '
    Write-IhuiDiagRawLine $script:IHuiDiagLogFile "===== 容器日志(docker $joined) $Note ====="
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & docker $dockerArgs 2>&1 | ForEach-Object {
            if ($_ -is [System.Management.Automation.ErrorRecord]) {
                Write-IhuiDiagRawLine $script:IHuiDiagLogFile $_.Exception.Message
            } else {
                Write-IhuiDiagRawLine $script:IHuiDiagLogFile ([string]$_)
            }
        }
        if ($LASTEXITCODE -ne 0) {
            Write-IhuiDiagRawLine $script:IHuiDiagLogFile "[diag] docker $joined 退出码非 0"
        }
    } catch {
        Write-IhuiDiagRawLine $script:IHuiDiagLogFile "[diag] docker $joined 执行异常($_)"
    } finally {
        $ErrorActionPreference = $prevEap
    }
}

# ── 健康检查 JSON 落盘 ─────────────────────────────────────────────────────
# 与 bash 版同纪律:对"支持 -Json 的那份"才产文件,否则如实记一行缺失,不产半成品。
function script:Update-IhuiDiagHealthJson {
    param([string]$ScriptPath, [string]$OutFile)
    if (-not (Test-Path $ScriptPath)) {
        Write-IhuiDiagLog "[diag] health-check 不存在: $ScriptPath"
        return
    }
    # 探"是不是有 -Json 开关参数"而不是找 -Json 字样:ConvertFrom-Json 这类调用里也含
    # "-Json" 子串,按字样探会把不支持的脚本误判成支持并产出半成品(bash 版 grep '--json'
    # 同型陷阱,这里按 param 声明形态收窄)。
    $supportsJson = $false
    try { $supportsJson = Select-String -Path $ScriptPath -Pattern '\[switch\]\s*\$?[Jj]son' -Quiet } catch { }
    if (-not $supportsJson) {
        Write-IhuiDiagLog "[diag] $ScriptPath 不支持 -Json,健康检查输入缺失"
        return
    }
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $captured = & $ScriptPath -Json 2>&1 | ForEach-Object {
            if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.Exception.Message } else { [string]$_ }
        }
        $body = ($captured -join [Environment]::NewLine)
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($OutFile, $body, $utf8NoBom)
        if ($body.TrimStart().StartsWith('{')) {
            Write-IhuiDiagLog "[diag] 健康检查 JSON 已落: $OutFile"
        } else {
            Write-IhuiDiagLog '[diag] 健康检查 JSON 未取得有效载荷(保留原始输出供排查)'
        }
    } catch {
        Write-IhuiDiagLog "[diag][WARN] 健康检查执行异常($_),输入缺失"
    } finally {
        $ErrorActionPreference = $prevEap
    }
}

# ── 调 ai-diagnose.mjs(报告落盘,P2-13③ 票面明令)───────────────────────
# 流水写进部署日志同目录(每次调用一份、带时刻,同一轮两个失败点不互相覆盖),
# 外加固定名 latest 指针 —— 与 Initialize-IhuiDiag 的日志双件同型。
# node / IHUI_AI_KEY / 日志 / 脚本 任一不齐 ⇒ 拒绝运行并留痕,绝不编造诊断;
# **但"没诊断成"本身也要到人**(Send-IhuiDiagNotify 在每个出口分支都调,并写明为什么与出路)。
# $Context = 给模型的一句话  $Category = 稳定类别(build/up/health/cloudflared…),进告警身份
function script:Invoke-IhuiDiagRun {
    param([string]$Context = '部署失败', [string]$Category = 'deploy')
    $diagState = 'skipped'
    $diagWhy = ''
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        $diagWhy = '本机没有 node'
        Write-IhuiDiagLog "[diag] ${diagWhy},跳过 AI 诊断"
        Send-IhuiDiagNotify $Category $Context $diagState $diagWhy
        return
    }
    if (-not $env:IHUI_AI_KEY) {
        $diagWhy = '未设 IHUI_AI_KEY(不产生编造诊断)'
        Write-IhuiDiagLog "[diag] ${diagWhy},跳过 AI 诊断"
        Send-IhuiDiagNotify $Category $Context $diagState $diagWhy
        return
    }
    # 入库源在 deploy/scripts/,bundle 副本在 deploy/prod-bundle/ —— 两条链的相对位置
    # 不同,所以按候选列表找(与 bash 版同一张候选表)。找不到就如实落一行,绝不静默。
    $diagScript = ''
    $cands = @(
        (Join-Path $script:IHuiDiagSelfDir 'ai-diagnose.mjs'),
        (Join-Path $script:IHuiDiagSelfDir '../scripts/ai-diagnose.mjs'),
        (Join-Path $script:IHuiDiagSelfDir '../prod-bundle/ai-diagnose.mjs')
    )
    foreach ($cand in $cands) {
        if ($cand -and (Test-Path $cand)) { $diagScript = $cand; break }
    }
    if (-not $diagScript) {
        $diagWhy = "找不到 ai-diagnose.mjs(试过 $($script:IHuiDiagSelfDir)/ 与 ../scripts/)"
        Write-IhuiDiagLog "[diag][WARN] ${diagWhy},诊断未执行"
        [Console]::Error.WriteLine("[diag][WARN] ${diagWhy},跳过 AI 诊断")
        Send-IhuiDiagNotify $Category $Context $diagState $diagWhy
        return
    }
    $logEmpty = (-not $script:IHuiDiagLogFile) -or (-not (Test-Path $script:IHuiDiagLogFile)) `
        -or ((Get-Item $script:IHuiDiagLogFile).Length -eq 0)
    if ($logEmpty) {
        $diagWhy = '部署日志为空,诊断没有输入可用'
        Write-IhuiDiagLog "[diag][WARN] ${diagWhy}"
        [Console]::Error.WriteLine("[diag][WARN] ${diagWhy},跳过 AI 诊断")
        Send-IhuiDiagNotify $Category $Context $diagState $diagWhy
        return
    }
    $report = ($script:IHuiDiagLogFile -replace '\.log$', '') + ("-ai-diagnose-{0:HHmmss}.md" -f (Get-Date))
    $latest = Join-Path (Split-Path -Parent $report) 'ai-diagnose-latest.md'
    [Console]::Error.WriteLine("[diag] 调用 AI 诊断助手分析失败日志(P2-13),报告将落盘: $report")
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & node $diagScript '--log' $script:IHuiDiagLogFile '--tail' '300' '--context' $Context '--out' $report 2>&1 |
            ForEach-Object {
                if ($_ -is [System.Management.Automation.ErrorRecord]) {
                    [Console]::Error.WriteLine($_.Exception.Message)
                } else {
                    [Console]::Error.WriteLine([string]$_)
                }
            }
        if ($LASTEXITCODE -ne 0) {
            $diagWhy = "AI 诊断退出码非 0($LASTEXITCODE),没有产出可用报告"
            [Console]::Error.WriteLine("[diag][WARN] ${diagWhy},不影响部署流程")
        } else {
            $diagState = 'ok'
            $diagWhy = "诊断报告已落盘: $report"
        }
    } catch {
        $diagWhy = "AI 诊断执行异常($_),没有产出可用报告"
        [Console]::Error.WriteLine("[diag][WARN] ${diagWhy},不影响部署流程")
    } finally {
        $ErrorActionPreference = $prevEap
    }
    try {
        if (Test-Path $report) { Copy-Item -Force $report $latest }
    } catch { }
    Send-IhuiDiagNotify $Category $Context $diagState $diagWhy
}

# ── 仓库根推导(邮件唯一出口与 .ihui-agent/state 都在根下)─────────────────
# 不写死盘符(§15/§15b):从采集库自身位置逐级上溯,取第一个真带着
# `apps/api/scripts/notify-deploy-failure.ts` 的目录。取不到 ⇒ 返回 '' 由调用方
# **如实报未判定**,绝不猜一个路径去发信(§0.3)。
function script:Resolve-IhuiDiagRepoRoot {
    param([string]$Start)
    if (-not $Start) { return '' }
    $d = $Start
    for ($i = 1; $i -le 4; $i++) {
        try { $d = Split-Path -Parent $d } catch { return '' }
        if (-not $d) { return '' }
        $probe = Join-Path (Join-Path (Join-Path (Join-Path $d 'apps') 'api') 'scripts') 'notify-deploy-failure.ts'
        if (Test-Path -LiteralPath $probe) { return $d }
    }
    return ''
}

# 类别 sanitize:身份只吃**稳定枚举**,带空格/斜杠/读数的原文一律不进键(§5e-1)。
function script:Get-IhuiDiagSafeCategory {
    param([string]$Category)
    if (-not $Category) { $Category = 'deploy' }
    return ($Category -replace '[^a-zA-Z0-9-]', '_')
}

# 同一类别的第几次失败(计数只进正文与投递账,不进身份 —— 身份随计数漂移就等于没有去重)。
function script:Update-IhuiDiagNotifyCount {
    param([string]$SafeCategory)
    if (-not $script:IHuiDiagLogDir) { return 0 }
    $f = Join-Path $script:IHuiDiagLogDir (".diag-notify-count-{0}" -f $SafeCategory)
    $n = 0
    try {
        if (Test-Path -LiteralPath $f) {
            $raw = (Get-Content -LiteralPath $f -Raw -ErrorAction SilentlyContinue)
            # 只认数字:文件被别的程序塞了脏字符 ⇒ 当 0 重起,不报错、不静默放大计数
            $digits = ('{0}' -f ($raw -replace '[^0-9]', ''))
            if ($digits) { $n = [int]$digits }
        }
    } catch { $n = 0 }
    $n = $n + 1
    try {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($f, [string]$n, $utf8NoBom)
    } catch { }
    return $n
}

# 可回读投递账一行。它**不是**第二本发信台账:§5e-3 的 mail-send-ledger.jsonl 由唯一出口
# 自己追写、记"投递本身";这本记"compose 链哪一轮、哪个身份、什么结论(含 unjudged:*)".
function script:Write-IhuiDiagNotifyRecord {
    param([string]$Identity, [string]$SafeCategory, [int]$Count, [string]$DiagState, [string]$Result, [string]$MessageFile)
    if (-not $script:IHuiDiagLogDir) { return }
    try {
        $row = [ordered]@{
            at          = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
            identity    = $Identity
            category    = $SafeCategory
            count       = $Count
            diag        = $DiagState
            result      = $Result
            producer    = $script:IHuiDiagMailSource
            messageFile = $MessageFile
        }
        $line = ($row | ConvertTo-Json -Compress)
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::AppendAllText(
            (Join-Path $script:IHuiDiagLogDir '.diag-notify-log.jsonl'),
            $line + [Environment]::NewLine,
            $utf8NoBom
        )
    } catch { }
}

# ── 诊断结论投递到**邮件这一条唯一通道**(P2-13③ 票面:"结果必须落到人")────────
# 为什么必须在 Invoke-IhuiDiagRun 之内、而不是让每个调用方各写一遍:§5e 明令发信一律经
# apps/api/scripts/notify-deploy-failure.ts(版式唯一源 email-templates.ts,守门 81 硬拦
# 自拼 SMTP),第三方推送腿已整体摘除。本函数只做一件事:把正文写成文件、按唯一出口的
# 命令行调它。
# 去抖身份 = `compose-deploy;<类别>`(纯稳定枚举 × 出口自带的 4h 窗口)。刻意**不**把
# 计数/时刻/日志路径/异常原文拼进身份 —— 那是"同一件事每轮换一次身份"那一型(守门 224 V1
# 的立项凭据:48h 内 47 封同一条故障即此)。实时读数一律进正文。
# 默认零行为变化:投信任何失败只留痕 + 落未送达标记,绝不因为"信寄不出去"把部署再判挂一次。
function script:Send-IhuiDiagNotify {
    param(
        [string]$Category = 'deploy',
        [string]$Context = '部署失败',
        [string]$DiagState = 'skipped',
        [string]$DiagWhy = ''
    )
    $identity = 'compose-deploy;' + (Get-IhuiDiagSafeCategory $Category)
    $safe = Get-IhuiDiagSafeCategory $Category
    if (-not $script:IHuiDiagLogDir) {
        Write-IhuiDiagLog '[notify][未判定] logs 落点缺失,本轮没有到人通知'
        [Console]::Error.WriteLine('[notify][未判定] 没有 <base>/logs 落点 ⇒ 告警正文无处可留;出路: 先确认可写目录后重跑,或手工经 apps/api/scripts/notify-deploy-failure.ts 补寄(见其 --help)')
        return
    }
    $count = Update-IhuiDiagNotifyCount $safe
    $messageFile = Join-Path $script:IHuiDiagLogDir ("deploy-notify-{0}.txt" -f $safe)
    $reportHint = Join-Path $script:IHuiDiagLogDir 'ai-diagnose-latest.md'
    $root = Resolve-IhuiDiagRepoRoot $script:IHuiDiagSelfDir

    $lines = @(
        '部署链: docker compose(prod-bundle / Windows)',
        ("类别: {0}" -f $Category),
        ("本轮同类别第 {0} 次失败(计数只进正文,不进去重身份)" -f $count),
        ("病因: {0}" -f $Context),
        ("AI 诊断: {0}" -f $(if ($DiagWhy) { $DiagWhy } else { '未说明' })),
        ("部署结果 JSON: {0}" -f $(if ($script:IHuiDiagResultFile) { $script:IHuiDiagResultFile } else { '未落盘' })),
        ("部署日志: {0}" -f $(if ($script:IHuiDiagLogFile) { $script:IHuiDiagLogFile } else { '未落盘' })),
        '',
        '下一步(按顺序试,都是单命令):',
        ("  1) Get-Content {0}   # 诊断报告({1})" -f $reportHint, $DiagState),
        ("  2) Get-Content {0} -Tail 200" -f $(if ($script:IHuiDiagLogFile) { $script:IHuiDiagLogFile } else { '(日志未落盘)' })),
        '  3) docker compose logs --tail 200',
        '  4) pwsh -NoProfile -File .\deploy\prod-bundle\health-check.ps1',
        '  5) 修好后重跑: pwsh -NoProfile -File .\deploy\prod-bundle\deploy.ps1 -SkipBuild'
    )
    try {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllLines($messageFile, $lines, $utf8NoBom)
    } catch {
        Write-IhuiDiagLog "[notify][WARN] 正文写盘失败($_)"
    }

    if (-not $root) {
        Write-IhuiDiagNotifyRecord $identity $safe $count $DiagState 'unjudged:no-outlet' $messageFile
        Write-IhuiDiagLog "[notify][未判定] 取不到仓库根(没有 apps/api/scripts/notify-deploy-failure.ts),本轮告警未投递;身份=$identity;正文=$messageFile"
        [Console]::Error.WriteLine("[notify][未判定] 未找到邮件唯一出口 apps/api/scripts/notify-deploy-failure.ts ⇒ 本轮没有到人通知;正文已落 $messageFile(身份 $identity),出路: 在仓库根跑 pwsh -NoProfile -Command `"node apps/api/node_modules/tsx/dist/cli.mjs apps/api/scripts/notify-deploy-failure.ts --message-file '$messageFile' --alert-id '$identity' --source $($script:IHuiDiagMailSource) --strict`"")
        return
    }
    $node = $null
    foreach ($nm in @('node.exe', 'node')) {
        $cmd = Get-Command $nm -ErrorAction SilentlyContinue
        if ($cmd -and (Test-Path -LiteralPath $cmd.Source)) { $node = $cmd.Source; break }
    }
    if (-not $node) {
        # 与 ihui-deploy.ps1 / ihui-pg-backup.ps1 同一条绝对路径兜底:服务上下文(LocalSystem)的
        # PATH 常常没有 node,只靠 Get-Command 会在自动轮次里静默落空 ⇒ 告警这一腿整条哑掉。
        foreach ($p in @('D:\DevEnv\runtimes\node\node.exe', 'C:\Program Files\nodejs\node.exe')) {
            if (Test-Path -LiteralPath $p) { $node = $p; break }
        }
    }
    $tsx = ''
    foreach ($c in @((Join-Path (Join-Path (Join-Path $root 'apps') 'api') 'node_modules\tsx\dist\cli.mjs'), (Join-Path $root 'node_modules\tsx\dist\cli.mjs'))) {
        if (Test-Path -LiteralPath $c) { $tsx = $c; break }
    }
    if (-not $node -or -not $tsx) {
        Write-IhuiDiagNotifyRecord $identity $safe $count $DiagState 'unjudged:no-tsx' $messageFile
        Write-IhuiDiagLog "[notify][未判定] 取不到 node 或 tsx 入口,未投递;正文=$messageFile;身份=$identity"
        [Console]::Error.WriteLine("没有 node/tsx 入口 ⇒ 没走邮件出口;出路(单命令): cd $root; pnpm --filter @ihui/api exec tsx scripts/notify-deploy-failure.ts --title 'compose 部署失败($Category)' --message-file '$messageFile' --source $($script:IHuiDiagMailSource) --alert-id '$identity' --strict")
        return
    }

    $notifyScript = Join-Path (Join-Path (Join-Path (Join-Path $root 'apps') 'api') 'scripts') 'notify-deploy-failure.ts'
    $outFile = Join-Path $script:IHuiDiagLogDir 'deploy-notify-out.txt'
    [Console]::Error.WriteLine("[diag] 邮件唯一通道投递中(身份 $identity)…")
    $argv = @($tsx, $notifyScript,
        '--title', ("compose 部署失败({0})" -f $Category),
        '--severity', 'critical',
        '--source', $script:IHuiDiagMailSource,
        '--stage', $Category,
        '--alert-id', $identity,
        '--message-file', $messageFile,
        '--strict'
    )
    if ($env:IHUI_DIAG_NOTIFY_EXTRA) { $argv += @($env:IHUI_DIAG_NOTIFY_EXTRA -split '\s+' | Where-Object { $_ }) }
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $rc = 0
    $captured = @()
    try {
        $captured = & $node @argv 2>&1
        $rc = $LASTEXITCODE
    } catch {
        $rc = -1
        $captured = @("执行异常:$($_.Exception.Message)")
    } finally {
        $ErrorActionPreference = $prevEap
    }
    $text = (($captured | ForEach-Object { "$_" }) -join [Environment]::NewLine)
    foreach ($l in (($text -split "`r?`n") | Where-Object { $_ } | Select-Object -Last 5)) {
        Write-IhuiDiagLog "[notify-out] $l"
    }
    try {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($outFile, $text + [Environment]::NewLine, $utf8NoBom)
    } catch { }

    # 四档必须分开量出来,不能靠退出码猜:--dry-run 恒 0(通道根本没碰)、压住也恒 0、
    # 真失败才非 0。把演练读成"已到人"就是 §0.3 禁的那一型。
    $result = if ($rc -ne 0) { "failed:$rc" } elseif ($text -match '\[dry-run\]') { 'dry-run' } elseif ($text -match '已按标识去重') { 'suppressed' } else { 'delivered' }
    Write-IhuiDiagNotifyRecord $identity $safe $count $DiagState $result $messageFile

    $mark = Join-Path (Join-Path (Join-Path $root '.ihui-agent') 'state') 'deploy-diagnose-alert-UNDELIVERED.json'
    if ($rc -eq 0) {
        if ($result -eq 'delivered' -or $result -eq 'suppressed') {
            try { if (Test-Path -LiteralPath $mark) { Remove-Item -LiteralPath $mark -Force } } catch { }
            Write-IhuiDiagLog "[notify] $result,未送达标记已清除"
        } else {
            Write-IhuiDiagLog "[notify] $result(没碰通道,保留未送达标记)"
        }
    } else {
        try {
            $dir = Split-Path -Parent $mark
            if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
            $payload = [ordered]@{
                producer    = 'deploy/prod-bundle compose 链(Windows)'
                alertId     = $identity
                reason      = ("notify-deploy-failure.ts exit={0}" -f $rc)
                at          = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
                messageFile = $messageFile
            }
            $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
            [System.IO.File]::WriteAllText($mark, ($payload | ConvertTo-Json -Depth 4), $utf8NoBom)
        } catch { }
        [Console]::Error.WriteLine("[notify][ERROR] 邮件未送达(exit=$rc),已落未送达标记: $mark;补寄单命令: node $tsx $notifyScript --message-file '$messageFile' --alert-id '$identity' --source $($script:IHuiDiagMailSource) --strict")
        Write-IhuiDiagLog "[notify][ERROR] 未送达 exit=$rc,标记=$mark"
    }
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
