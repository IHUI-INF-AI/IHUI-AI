# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 刻意**不写** `#requires -Version 7`(AGENTS §27 规则 2 的 `deploy/**` 适用面例外,2026-09-28 G-225 落地)。
# 本文件是被 dot-source 的模块,调用方全是 `deploy\win` 里的运维脚本:
#   ihui-monitor.ps1 / ihui-pg-backup.ps1 / ihui-pg-backup-scheduler.ps1 /
#   install-deploy-loop-service.ps1 / install-auto-deploy-task.ps1 / ihui-deploy{,-loop}.ps1
# 而这些脚本由 nssm 服务与计划任务拉起 —— 服务身份的解释器在不同机器上不是同一个:
# 生产机(WIN-20251101PXT)`%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe` 实测
# `PSVER=7.6.2`,开发机同一路径实测 `5.1.26100.6584|Desktop`(2026-10-12 两台各自现读)。
# `#requires -Version 7` 在 5.1 上是**直接拒绝执行**(实测 exit=1 +
# `ScriptRequiresUnmatchedPSVersion`),于是"补一行 pragma"在 5.1 机器上的效果不是报错难看,
# 而是让**备份 / 监控 / 部署服务整体停摆**(AGENTS §27 例外段原文口径)。故本面不带 pragma。
# 版本判据因此落在**调用侧**:谁调用 deploy\**.ps1 必须显式指名 pwsh 或经包装(§27 例外段
# 记的 `[CALLER]` 面),而不是让被调用的模块自己拒绝加载。
# 正文只用 PS5.1 / PS7 两版通用语法:pwsh 7.6.4 的 `Parser::ParseFile` 实测 0 错。
# 无 BOM 中文那一格是**全 deploy 面的既有基线**,与 pragma 无关(5.1 按 ANSI 代码页解码本面
# 中文会出假语法错:实测本文件 4 处、ihui-monitor.ps1 25 处、deploy-lock-common.ps1 22 处;
# 同一份加 BOM 后 5.1 立刻 0 错)—— AGENTS §27 规则 5 的"带 BOM 写"在本面被水印注入
# (`watermark.mjs inject` 重写时去掉 BOM)覆盖,故保持无 BOM,运行宿主一律 pwsh/PS7。

# =============================================================================
# deploy\win\ihui-root-common.ps1 — 仓库根的**唯一**解析实现
#
# 立因(2026-10-12,生产端"改了不生效"复盘):
#   同一份仓在两台机器上落在不同路径(开发机 G:\IHUI-AI / 生产机 D:\IHUI-AI),
#   而 deploy 面 23 处把 `D:\IHUI-AI` 写死成字面量。后果不是"报错难看":
#     · ihui-deploy.ps1:66  $Root 写死 ⇒ 换机/换盘后部署脚本操作的是**另一个目录**,
#       于是一边改一边不改,两端看起来"不同步",实际是同一份代码解析出了两个根;
#     · run-api.ps1:204-205 写死 tsx preflight/loader 绝对路径 ⇒ 服务直接起不来;
#     · install-* 把写死路径烤进 nssm 服务 / 计划任务 ⇒ 改了脚本也不生效,
#       因为**生效的那一份在注册表里**,不在仓库里。
#   本仓早有同型教训并已立范式:`scripts/build-next-prod.ps1:44` 的注释原文是
#   "根目录一律由脚本自身位置推导(旧盘符写死是事故源)";`deploy-lock-common.ps1`
#   立过"判据唯一出口"的规矩。本文件就是把同一套规矩推广到**根路径**这件事上。
#
# 解析顺序(第一个命中的生效,全部不中按 -Required 决定 throw 还是回退):
#   1. $env:IHUI_ROOT            —— 显式覆盖。切换仓库根 / 双根并存时用它,
#                                   不必再改任何脚本(这是"以后不要出现这种情况"的开关)。
#   2. 自 $StartDir 逐级向上找 package.json —— 脚本在哪就在哪,零配置。
#   3. git -C $StartDir rev-parse --show-toplevel —— 兜住"根下没有 package.json"的形态。
#   4. 回退 'D:\IHUI-AI'(仅当它真的有 package.json)—— 保生产机现行布局不失效。
#
# 反向护栏:
#   · **必须**由调用方显式传 -StartDir $PSScriptRoot。不传默认值取本文件所在目录,
#     那会让所有调用者都解析到 deploy\win —— 错得静默且一致,比报错更坏。
#   · 向上走有硬上限(默认 12 级),防止误从盘根之下把整个盘扫一遍。
#   · 找到的目录必须同时含 package.json;只验目录存在会把 `deploy\` 当成根。
#
# 用法(两个读者必须走同一份实现,禁止各写一遍 Split-Path 向上爬):
#   . (Join-Path $PSScriptRoot 'ihui-root-common.ps1')
#   $Root = Resolve-IhuiProjectRoot -StartDir $PSScriptRoot
#   # 找不到宁可响也不要用错根:$Root = Resolve-IhuiProjectRoot -StartDir $PSScriptRoot -Required
# =============================================================================

function Resolve-IhuiProjectRoot {
    [CmdletBinding()]
    param(
        # 调用方脚本所在目录。**必须显式传调用者自己的 $PSScriptRoot。**
        [Parameter(Mandatory = $true)]
        [string]$StartDir,

        # 向上探测的层数硬上限(防从盘根之下全盘扫描)。
        [int]$MaxLevels = 12,

        # $true:四种来源全不中即 throw(宁可响也不用错根);
        # $false:回退 'D:\IHUI-AI',再不中才 throw。
        [switch]$Required
    )

    if ([string]::IsNullOrWhiteSpace($StartDir)) {
        throw 'Resolve-IhuiProjectRoot: -StartDir 不能为空(调用方必须传自己的 $PSScriptRoot)'
    }
    if (-not (Test-Path -LiteralPath $StartDir)) {
        throw "Resolve-IhuiProjectRoot: -StartDir 不存在: $StartDir"
    }
    $StartDir = (Resolve-Path -LiteralPath $StartDir).Path

    # —— 1. 环境变量显式覆盖 ——
    $envRoot = $env:IHUI_ROOT
    if (-not [string]::IsNullOrWhiteSpace($envRoot)) {
        if (Test-Path -LiteralPath (Join-Path $envRoot 'package.json')) {
            return (Resolve-Path -LiteralPath $envRoot).Path
        }
        # 覆盖值给错不是静默忽略,而是当场失败:带着错根继续跑会操作另一个目录,
        # 正是本文件要根治的那一型事故。
        throw "Resolve-IhuiProjectRoot: `$env:IHUI_ROOT='$envRoot' 下没有 package.json —— 拒绝用错根继续"
    }

    # —— 2. 自 StartDir 逐级向上找 package.json ——
    $probe = $StartDir
    for ($i = 0; $i -lt $MaxLevels; $i++) {
        if (Test-Path -LiteralPath (Join-Path $probe 'package.json')) {
            return $probe
        }
        $parent = Split-Path -Path $probe -Parent
        if ([string]::IsNullOrEmpty($parent) -or $parent -eq $probe) { break }
        $probe = $parent
    }

    # —— 3. git toplevel ——
    try {
        $toplevel = & git -C $StartDir rev-parse --show-toplevel 2>$null
        if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($toplevel)) {
            $toplevel = ([string]$toplevel).Trim()
            if (Test-Path -LiteralPath (Join-Path $toplevel 'package.json')) {
                return (Resolve-Path -LiteralPath $toplevel).Path
            }
        }
    } catch { /* git 不在 PATH 时走下一支 */ }

    # —— 4. 回退旧根(保生产机现行布局) ——
    if (-not $Required) {
        $legacy = 'D:\IHUI-AI'
        if (Test-Path -LiteralPath (Join-Path $legacy 'package.json')) { return $legacy }
    }

    throw ("Resolve-IhuiProjectRoot: 无法确定仓库根(StartDir=$StartDir; 依次试过 `$env:IHUI_ROOT / " +
           "向上 ${MaxLevels} 级 package.json / git toplevel" +
           $(if ($Required) { '' } else { " / 回退 D:\IHUI-AI" }) + ')')
}

# 断言:本文件被 dot-source 后函数确实可用(dot-source 路径写错时当场响)。
if (-not (Get-Command -Name Resolve-IhuiProjectRoot -ErrorAction SilentlyContinue)) {
    throw 'ihui-root-common.ps1: Resolve-IhuiProjectRoot 定义失败 —— dot-source 链路异常'
}
