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
#
# 用法(在调用方脚本里,必须在自定义输出函数之前 dot-source,与 bash 链同序):
#   if (Test-Path $diagLib) { . $diagLib } else { ...空实现兜底... }
#   Initialize-IhuiDiag $ScriptDir "compose"
#   Write-IhuiDiagResult "failed" "build" "docker compose build 失败"
#   Invoke-IhuiDiagRun "deploy.ps1(compose 链)docker compose build 失败"
#
# 设计约束(与 bash 版逐条同):
#   - 默认零行为变化:所有函数任何失败一律吞进 try/catch 只留一行痕迹,
#     绝不因为"诊断跑不了"弄挂部署;调用方处于 $ErrorActionPreference='Stop' 时同样安全。
#   - 不发任何通知。到人出口只有邮件一条通道(§5e),本库只产文件。
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
# node / IHUI_AI_KEY / 日志 / 脚本 任一不齐 ⇒ 拒绝运行并留痕,绝不编造诊断。
function script:Invoke-IhuiDiagRun {
    param([string]$Context = '部署失败')
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-IhuiDiagLog '[diag] node 不可用,跳过 AI 诊断'
        return
    }
    if (-not $env:IHUI_AI_KEY) {
        Write-IhuiDiagLog '[diag] 未设 IHUI_AI_KEY,跳过 AI 诊断(不产生编造诊断)'
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
        Write-IhuiDiagLog '[diag][WARN] 找不到 ai-diagnose.mjs,诊断未执行'
        [Console]::Error.WriteLine("[diag][WARN] 找不到 ai-diagnose.mjs(试过 $($script:IHuiDiagSelfDir)/ 与 ../scripts/),跳过 AI 诊断")
        return
    }
    $logEmpty = (-not $script:IHuiDiagLogFile) -or (-not (Test-Path $script:IHuiDiagLogFile)) `
        -or ((Get-Item $script:IHuiDiagLogFile).Length -eq 0)
    if ($logEmpty) {
        Write-IhuiDiagLog '[diag][WARN] 部署日志为空,AI 诊断没有输入可用'
        [Console]::Error.WriteLine('[diag][WARN] 部署日志为空,跳过 AI 诊断')
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
            [Console]::Error.WriteLine("[diag][WARN] AI 诊断不可用(退出码 $LASTEXITCODE),不影响部署流程")
        }
    } catch {
        [Console]::Error.WriteLine("[diag][WARN] AI 诊断执行异常($_),不影响部署流程")
    } finally {
        $ErrorActionPreference = $prevEap
    }
    try {
        if (Test-Path $report) { Copy-Item -Force $report $latest }
    } catch { }
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
