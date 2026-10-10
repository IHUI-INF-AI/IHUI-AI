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
#   1. git fetch origin main + 把当次远端 tip **立刻定格成显式 sha**($remoteTip)再算落后提交数
#      (既不用会被宿主清理层吞掉、读回残值的 origin/main 嵌套 ref,也不用会被并发 fetch 改写的
#       共享文件 FETCH_HEAD —— 2026-09-28 实测后者造成"behind=15 却照常切流旧提交")
#   2. 落后>0 才继续;先做幻影漂移现场对齐(heal-worktree-tracked --align-drift,真编辑不碰),
#      再 git merge --ff-only $remoteTip,并用 merge-base --is-ancestor **复核 HEAD 真的包含了
#      那一枚**才允许往下走(禁 force,不动他人未提交改动;对齐后仍脏 → BLOCKED-WIP)
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

# ── 子进程输出编码 = UTF-8(G-305,2026-09-28 立)──────────────────────────────
# 病灶(实测,最小复现见交付报告):本脚本被部署环用 `Start-Process -RedirectStandardOutput`
# 调起,而 LocalSystem 上下文里 `[Console]::OutputEncoding` 默认是 **gb2312(CP936)**。
# 于是本脚本写的每一行中文(以及它 `& git`/`& node` 捕获后转写的中文)都以 **GBK 字节**
# 落进 run-*.out.log,而读取侧(ihui-deploy-loop.ps1 里那句增量 `StreamReader` 尾读)
# 按 UTF-8 解 ⇒ deploy-loop.log 里的中文全成 `?`/U+FFFD。后果不是难看,而是**所有靠中文
# 措辞写的复盘与判读在这个面上读不出来**(实测近 400 行里有 129 处 U+FFFD)。
# 取证两组字节(同一行「中文探针你好」):
#   现状  : 47 41 54 45 2D 4D 41 52 4B 20 D6 D0 CE C4 CC BD D5 EB C4 E3   ← GBK
#   修复后: 47 41 54 45 2D 4D 41 52 4B 20 E4 B8 AD E6 96 87 E6 8E A2 E9  ← UTF-8
# 为什么改这一层而不是"事后把整份日志转码":转码要在 GBK/UTF-8 之间猜,猜错即二次损坏;
# 而在**写的一侧**定死编码,链路上每一跳(本脚本 → out.log → 守护 → deploy-loop.log)
# 都是同一份 UTF-8,无需再猜。`$OutputEncoding` 管的是"喂给原生命令的 stdin",一并设
# 成 UTF-8,免得 `& git` 这类调用只修一半。判据一律不依赖中文措辞(本仓 ASCII 标记
# GATE-ITER / HEALTH / behind= 等保持原样),所以这次只改编码、**不动任何判定逻辑**。
# 生效时机如实登记:本文件每轮由守护**新起子进程**读取 ⇒ 下一轮即生效,无需重启服务;
# 而守护自身(ihui-deploy-loop.ps1)那半截要等 IHUI-DEPLOYLOOP 重启。
try {
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)   # 无 BOM:日志文件首字节必须是内容
    $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch {
    # 不得静默降级:设不上就是"这一轮日志仍会是乱码",必须喊出来。
    # 用 ASCII 写这条,因为此刻编码还是坏的,中文喊了也读不出来。
    Write-Warning 'WARN console-output-encoding NOT set to UTF-8; deploy-loop.log will keep mojibake for CJK lines'
}

$Root       = 'D:\IHUI-AI'
$WebDir     = "$Root\apps\web"
$ApiDir     = "$Root\apps\api"
# ── 构建取源码面:干净导出(worktree @ 目标 SHA)而**不再是共享工作树**(2026-09-29 机主拍板)──
# 成因(当天实测,不是假想):本机就是生产机,而旧口径从 `$WebDir`(共享工作树)取源码,
# 于是任何一个并行会话写一半的文件都能当场把全队上线打死 —— 16:10/16:14/16:21/16:27 四轮
# `next build` 全红,报错 5 条全在 `apps/web/src/components/chat/stream-alert-bar.tsx`,
# 其中被判"未使用"的符号 `isActiveAlert` 在 **HEAD 面出现 0 次** ⇒ 红来自一份**未提交**的副本,
# 线上因此停在 `34d27084f1` 而 origin 已到 `65b8ac19`。蓝绿只隔离产物不隔离源码,这就是那一格。
# 两臂对照已跑过:同一枚 HEAD,脏面 4 连败;`git worktree add --detach` + `pnpm install` 后
# 在导出面跑 `pnpm --filter @ihui/web typecheck` = RC 0(证据 `.ihui-agent/tmp/ledger/ev-clean-tc.txt`)。
# 应急回退:`IHUI_DEPLOY_CLEAN_BUILD=0` 退回旧行为(读共享工作树);导出面本身准备失败时也会
# **大声回退**并打 `[CLEAN-BUILD] FALLBACK` 行 —— 宁可线上继续更新但隔离暂时失效,也不要没有部署。
$CleanBuildEnabled = ($env:IHUI_DEPLOY_CLEAN_BUILD -ne '0')
# 默认净面根搬到仓外(2026-10-10,根治"仓库里又冒出一个 clean-build-wt"这一反复现象):
# 默认路径此前是 $Root\.ihui-agent\tmp\clean-build-wt,这意味着**只要 IHUI_DEPLOY_CLEAN_WT 一丢**
# (重装服务 / nssm 配置回滚 / 换机 / 别人照抄旧配置),它就自动在仓库里长出一个 3.4 GB 的净面,
# 且该目录被 .gitignore 吞掉 ⇒ 用户在仓库里"又看到一个 clean build",而配环境变量那一步只治了
# 有环境变量的那台机器。改成仓外专用根后,回落也回不到仓库里 —— 这才是根因那一半。
# 再搬一层、搬出 TEMP 根(同日第二处根治):第一处把它放到了 D:\DevEnv\Temp\ihui-deploy-build,
# 而 `D:\DevEnv\Temp` 正是**本机的系统 TEMP 根**(HKCU TEMP 现读值,scripts/build-next-prod.ps1:51
# 与 scripts/check-temp-landing.mjs:10 两处独立确认)。净面是 3~6 GB 的**长期**构建缓存、跨部署轮次
# 复用(每轮只 `checkout --detach --force`,不重装依赖),把它放在一个"契约就是用来被清空"的目录里,
# 等于把长期状态寄放在临时区 —— 宿主清理层一旦扫到就整目录删掉,下一轮部署再原样重建
# (本仓 §5b 已记"实测本机 .git 与工作区目录都曾被啃"),用户看到的正是"这目录怎么又出现了"。
# 现落在 D:\DevEnv\ihui-deploy-build:与 $BackupDir('D:\DevEnv\backups\deploy')同属 D:\DevEnv\ 这一
# **非临时**根,清理脚本(c-drive-auto-maintain.ps1 只扫 C 盘产物、盘根与若干具名目录)够不着它。
# 硬编码 D:\DevEnv\... 与本文件既有风格一致($BackupDir 即在此根下)。
$CleanBuildRootDefault = 'D:\DevEnv\ihui-deploy-build'
$CleanBuildWt = if ($env:IHUI_DEPLOY_CLEAN_WT) { $env:IHUI_DEPLOY_CLEAN_WT } else { "$CleanBuildRootDefault\clean-build-wt" }
# 净面的一切 git 调用都必须带这一串:服务身份是 **SYSTEM**,而净面目录由交互账户创建,
# git 会判"dubious ownership"直接 exit 128(2026-09-29 17:38:56 实测,`[clean-out] fatal:
# detected dubious ownership … WIN-20251101PXT/Administrator … but the current user is
# NT AUTHORITY/SYSTEM`)。主仓那些 git 调用不带它也能跑,是因为仓库根在机器级配置里已被
# 放行过 —— 净面是**新建路径**,没有任何一处替它放行。AGENTS §5b 那条"git 调用不得依赖环境:
# 一律 -c safe.directory=*,服务账户与交互账户的 safe.directory 互不相通"说的就是这件事,
# 我第一次写这段时照抄了本文件的旧写法而没带上它,于是净面在真实服务里从未生效。
$gitFace = @('-c', 'safe.directory=*')
# 爆炸半径防线(2026-10-10 扩面,原判据一字未松):本函数会在新建净面前 `Remove-Item -Recurse -Force`
# 那个目录。环境变量被写歪(拼错、指到仓库根、指到盘根)时,那一条就成了"删掉整个仓库"。判据三条同时成立:
#   ① 路径**严格**落在某个已授权临时根之下(去尾斜杠后长度必须大于该根 ⇒ 根目录本身、盘根都进不来);
#   ② 该根不是盘根;
#   ③ 该根不包含 $Root(仓库根)。这条对仓内根天然成立,对**仓外根**是必需闸门:不设它的话,把外部根
#      授权成 `D:\` 或 `D:\IHUI` 这类祖先时,`CleanBuildWt=$Root` 会因为"严格更深"而被 ① 放行 ——
#      那正好是 2026-09-29 注释里点名要防的"删掉整个仓库"。
# 默认根是仓外专用根 $CleanBuildRootDefault;仓内根 $Root\.ihui-agent\tmp\ 保留在授权表里只为**显式**
# 指回去的老配置仍可用(直接删掉它会让那种配置落进"路径不合法 ⇒ CLEAN-BUILD DISABLED ⇒ 退回共享工作树
# 就地构建",正好重开 2026-09-29 那条生产伤口,比它在仓库里留个目录更坏)。保留 ≠ 默认:新装的机器
# 在没有环境变量时走的是仓外根,不会再在仓库里长出净面。
# 仓外根还可由 $env:IHUI_DEPLOY_CLEAN_WT_ROOTS(分号分隔)再显式追加,追加即视为机主对该根下递归删除的
# **显式授权** —— 故只收**专用窄根**,不收繁忙共享临时根:
# 共享根(如 D:\DevEnv\Temp\ihui-scratch,底下有几百个他人在用/自测残留的目录)一旦被授权,任何落到
# 它内部的笔误都会变成可递归删除目标,爆炸半径比仓内根大一个量级。
$CleanBuildRoots = @("$CleanBuildRootDefault\", "$Root\.ihui-agent\tmp\")
if ($env:IHUI_DEPLOY_CLEAN_WT_ROOTS) {
    foreach ($extra in ($env:IHUI_DEPLOY_CLEAN_WT_ROOTS -split ';')) {
        $t = $extra.Trim()
        if ($t -eq '') { continue }
        $norm = $t.TrimEnd('\')
        if ($t -notmatch '^[A-Za-z]:\\') { Write-Output "[CLEAN-BUILD] 忽略非绝对路径的额外根:$t"; continue }
        if ($norm.Length -le 2) { Write-Output "[CLEAN-BUILD] 忽略盘根:$t"; continue }
        if ($Root.StartsWith($t, [System.StringComparison]::OrdinalIgnoreCase)) {
            Write-Output "[CLEAN-BUILD] 忽略包含仓库根的额外根(会让 CleanBuildWt 有机会指到仓库本身):$t"
            continue
        }
        $CleanBuildRoots += ($norm + '\')
    }
}
# 去重:默认根已在表里,而机主把它也写进 IHUI_DEPLOY_CLEAN_WT_ROOTS 是很自然的一步(实测就是如此),
# 不去重的话下面 DISABLED 那行的"(已授权根:…)"会把同一个根列两遍 —— 那是排障时要逐字读的行。
$CleanBuildRoots = @($CleanBuildRoots | Select-Object -Unique)
$CleanBuildPathOk = $false
foreach ($r in $CleanBuildRoots) {
    if (($CleanBuildWt -like ($r + '*')) -and ($CleanBuildWt.TrimEnd('\').Length -gt $r.Length)) { $CleanBuildPathOk = $true; break }
}
if (-not $CleanBuildPathOk) {
    Write-Output "[CLEAN-BUILD] DISABLED: 净面路径不落在任何已授权临时根之下,拒绝带着它执行递归删除:$CleanBuildWt (已授权根:$($CleanBuildRoots -join ' | '))"
    $CleanBuildEnabled = $false
}
$AiDir      = "$Root\apps\ai-service"
$BackupDir  = 'D:\DevEnv\backups\deploy'
# 健康门禁凭据的生产机本地兜底文件(仓库外;IHUI_ADMIN_PASSWORD 优先)
$AdminPwdFile = if ($env:IHUI_ADMIN_PASSWORD_FILE) { $env:IHUI_ADMIN_PASSWORD_FILE } else { 'D:\DevEnv\secrets\admin-password.txt' }
# 凭据解析与"两处漂移"对照的唯一实现(admin-credential.ps1);本文件不得再手写第二份取值序。
# 2026-10-10 立:env 块陈旧而文件可用时,旧写法全程无声(llm 门禁盲 + 白烧失败登录),
# 现在两处不一致会在 BackendLogin-Token 里记一条 WARN(只记指纹,不记口令)。
. (Join-Path $PSScriptRoot 'admin-credential.ps1')
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

# ── pnpm 缓存目录钉死(2026-10-06 加,G-1059129):同一型问题的第二半 —— 上面那段补的是
#    "找不到 pnpm",这一段补的是"找到了但把它的缓存扔到盘根"。
#    IHUI-DEPLOYLOOP 的 AppEnvironmentExtra 实测只有 IHUI_ADMIN_PASSWORD 一项,LocalSystem
#    不读 HKCU 的用户级环境变量,所以服务上下文里 PNPM_HOME 是空的;pnpm 缺省按
#    "<工作目录所在卷根>\.pnpm-store\v11" 落缓存 ⇒ 本脚本那两处 `pnpm install` 每装一次
#    就往 D:\.pnpm-store 里堆(2026-10-05 量到 2550.1 MB / 194517 个文件)。
#    判据取值经四臂实测(S1-S4,同版本 pnpm.cjs):
#      · 不设 PNPM_HOME ⇒ D:\.pnpm-store\v11(就是这个坏形态)
#      · 只设 npm_config_store_dir ⇒ **仍然** D:\.pnpm-store\v11 —— 这一族配置键在本版本
#        不通过 npm_config_* 生效,按直觉写它等于没改,所以这里不写它。
#      · 只设 PNPM_HOME ⇒ D:\DevEnv\tools\pnpm\store\v11,即交互上下文一直在用的那份
#        已装满的缓存(实测目录内 files/index.db/links/projects 均在)⇒ 钉它不会让下次
#        部署重下全部依赖。
#    路径不存在时不静默钉(那会把部署冻结换成一次盘根污染,两头都是错),而是喊出来:
#    落点由人裁,但"没人知道它在长"必须结束。
$IhuiPnpmHome = 'D:\DevEnv\tools\pnpm'
if (Test-Path $IhuiPnpmHome) {
    $env:PNPM_HOME = $IhuiPnpmHome
} elseif (-not $env:PNPM_HOME) {
    Write-Host '[WARN][PNPM-STORE] 未找到 pnpm 缓存根 D:\DevEnv\tools\pnpm 且环境无 PNPM_HOME ⇒ 本次 install 的缓存将落在盘根 .pnpm-store(台账 G-1059129 那一型),请人工裁落点'
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

# 去重实现与监控侧共用同一份模块(路径按 $PSScriptRoot 推导,不写死盘符 —— AGENTS 顶部
# 「盘符每次现取」口径;本仓从 G: 迁到 D: 时写死绝对路径的脚本集体失效过一次)。
# 为什么收成一份:本文件与 ihui-monitor.ps1 各写过一遍"按签名去重",两份都只存"最后一条
# 签名",同故障两条措辞交替时互相抹时间戳 ⇒ 48h 寄出 47 封同一件事。两处各写一遍必漂,
# 修法只能是一份实现(与「两处算同一件事必须共用一份实现」那条同族)。
. (Join-Path $PSScriptRoot 'alert-dedup.ps1')

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
# 切流受阻类告警的宽限窗(分钟,2026-10-10 加)。阈值是量出来的,不是拍的:
#   · 轮询节奏实测 ~70 秒/轮(10-10 10:56:37→11:03:06 六轮,间隔 70±6s)⇒ 15 分钟 = 13 轮
#   · 被挡段时长分布(10-04→10-10 全日志,37 段)min 8 / p50 32 / p90 288 分钟 ⇒ 37 段里 13 段(35%)
#     在 15 分钟内自己好了(典型:并发会话同窗口的 git index.lock、别人正在写的 PROJECT_PLAN.md)
# 这一型当日就产出一封假信:10:56 那轮撞 index.lock ⇒ 10:57 寄"生产环境部署失败",而 11:18/11:33
# 各完成一次切流 —— 线上一切正常。所以"本轮没切过去"不等于"部署失败",持续超过一个可发布的
# 周期才算。窗内只记日志不寄信,超窗即升级为正式告警(Test-AlertSuppressionGrace 自带终态,
# 不会变成永久静音);其他类告警的判据一字未动。
$StallAlertGraceMinutes = 15
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
    param([string]$m, [switch]$Stall)
    # 去重逻辑住在共享模块 deploy/win/alert-dedup.ps1(**按签名分槽**持久),本函数只负责发送。
    # 2026-09-28 之前的这里是"单槽"实现:状态文件只存最后一条签名,于是同一故障的两条措辞
    # ("远端分叉需人工收敛" / "有未提交文件挡住 ff")随现场交替出现时,每次交替都①被当成
    # 新告警立即另发、②顺手把另一条的时间戳覆盖掉 ⇒ 4h 窗口结构上永不命中。
    # 实测代价:近 48h 寄出 47 封,内容全是同一件事"ff 切流被挡"。
    # 这是**按身份去重**,不是总量封顶 —— 无"每日 N 封"计数闸(成因见文件头 §5e 注释块)。
    $sig = ($m -replace '\s+', ' ').Trim()
    # 切流受阻类先过"持续够一个可发布周期才算停摆"的宽限窗(阈值出处见 $StallAlertGraceMinutes)。
    # 窗内只在日志留一行并写明"还差多久升级",绝不静默丢弃;超窗或判不出都照常往下走并发信。
    if ($Stall) {
        $grace = Test-AlertSuppressionGrace -Sig $sig -StateFile $AlertNotifyStateFile -GraceMinutes $StallAlertGraceMinutes -Stall
        if ($grace.Suppressed) {
            Log "ALERT 切流受阻仍在宽限窗($StallAlertGraceMinutes 分钟)内,本轮不寄:$($grace.Note) | 身份=$($grace.Key)"
            return
        }
        Log "ALERT 切流受阻超出宽限窗,转正式告警:$($grace.Note)"
    }
    $due = Test-AlertDueByIdentity -Sig $sig -StateFile $AlertNotifyStateFile -RepeatHours $FailAlertRepeatHours -Stall:$Stall
    if (-not $due.Due) {
        Log "ALERT 同身份失败告警本轮跳过:$($due.Note)"
        return
    }
    if ($due.Decision -eq 'undetermined') {
        Log "ALERT 去重状态不可用,本轮按'未寄过'照常寄出(宁可多喊一次,绝不静默压掉真失败)"
    }
    $repeatNote = $due.Note
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
}
function Fail {
    param([string]$m)
    Log "FAIL  $m"
    # Fail == 本轮以未切流收场 ⇒ 全部走"切流受阻"类(宽限窗 + 成功切流即清偿)。
    try { Invoke-FailNotify -m $m -Stall } catch {}
    try { Release-DeployLock } catch {}
    exit 1
}

# ── 分叉自动收敛与连续计数(2026-09-27 立,值守第一件工程活)────────────────────
# 为什么"一撞分叉就寄信"是错的:这台机同时有多个会话在提交+推送,ff-only 撞上「远端刚被
# 推走、本地也有新提交」是**每几分钟一次的常态中间态**,不是生产事故。旧写法每撞一次就 Fail,
# 而告警签名取整条文案 ⇒ 换一种措辞就被当成新故障立刻重发(实测 09-27 03:34 与 03:35
# 相隔一分钟各寄一封,一小时内四封到人)。
# 仓库为这一型早有唯一出口 scripts/git-sync-converge.mjs(§12d:索引层合并、从不 checkout、
# 从不碰他人未提交文件、冲突才交人工),而本脚本此前**只把它的名字写进日志"请人工跑",
# 从未调用过** —— 判据在、调用点没有,正是本仓记过最多次的那一型失效。
# 计数落文件而不是内存变量:外壳每轮重新起一个子进程,进程内变量活不过一轮。
$DivergedAlertStreak = 5   # 连续 5 轮(外壳 ~60s/轮 ⇒ 约 5 分钟)仍分叉才认定为真停摆
function Get-DivergedStateFile { Join-Path $PSScriptRoot '.diverged-streak.json' }
function Read-DivergedStreak {
    try {
        $j = Get-Content (Get-DivergedStateFile) -Raw -ErrorAction Stop | ConvertFrom-Json
        if ($j.count) { return @{ count = [int]$j.count; first = $j.first } }
    } catch { }
    return @{ count = 0; first = $null }
}
function Add-DivergedStreak {
    $s = Read-DivergedStreak
    $n = $s.count + 1
    try {
        @{ count = $n; first = $(if ($s.first) { $s.first } else { (Get-Date).ToString('o') }) } |
            ConvertTo-Json -Compress | Set-Content (Get-DivergedStateFile) -NoNewline -Encoding utf8
    } catch { Log "WARN  分叉计数写不进去:$($_.Exception.Message)(不因此报警,也不因此判成已修)" }
    return $n
}
function Reset-DivergedStreak {
    Remove-Item (Get-DivergedStateFile) -Force -ErrorAction SilentlyContinue
}
function Invoke-AutoConverge {
    # 只发起、不等待:收敛一轮可跑几分钟,而外壳 60 秒一趟,同步等待等于把部署轮询钉死。
    # marker 10 分钟内不重复发起 —— 并发收敛会互相抢 CAS,§12d 的 git 写锁只串行化单次写,
    # 不为"同一件事被 20 个进程同时做"设计。
    $marker = Join-Path $PSScriptRoot '.converge-inflight.marker'
    if (Test-Path $marker) {
        $ageMin = ((Get-Date) - (Get-Item $marker).LastWriteTime).TotalMinutes
        if ($ageMin -ge 0 -and $ageMin -lt 10) {
            Log "AUTO-CONVERGE 上一轮收敛发起于 $([Math]::Round($ageMin, 1)) 分钟前,仍在 10 分钟窗口内 ⇒ 不重复发起"
            return
        }
    }
    # 服务身份(LocalSystem)的 PATH 里没有 node —— 必须走 Resolve-NodeExe 的绝对路径兜底,
    # 否则这里会得到一个"命令不存在"的静默失败,现象正是本文件头注记过的"自动跑用的还是旧档"。
    $node = Resolve-NodeExe
    if (-not $node) {
        Log 'WARN  取不到 node 可执行文件 ⇒ 本轮无法自动收敛,只计入连续轮数(到阈值仍会报警)'
        return
    }
    try {
        Set-Content -Path $marker -Value (Get-Date).ToString('o') -NoNewline -Encoding utf8
        Start-Process -FilePath $node -ArgumentList (Join-Path $Root 'scripts\git-sync-converge.mjs') `
            -WorkingDirectory $Root -WindowStyle Hidden `
            -RedirectStandardOutput (Join-Path $PSScriptRoot '.converge.out.log') `
            -RedirectStandardError (Join-Path $PSScriptRoot '.converge.err.log') | Out-Null
        Log "AUTO-CONVERGE 已后台发起 git-sync-converge(输出落 deploy\win\.converge.{out,err}.log)"
    } catch { Log "WARN  自动收敛发起失败:$($_.Exception.Message)" }
}

function Invoke-Step { param([string]$name,[scriptblock]$body)
    Log "── $name ──"
    & $body | ForEach-Object { Write-Host "   $_" }
    return $LASTEXITCODE
}

# ── 探测的"操作级"硬上限(2026-09-27 加,实测 LocalSystem 下 -TimeoutSec 不被尊重)──────
# 关键实测(本机 powershell.exe 与 pwsh.exe 都是 7.6.2,`(Get-Command Invoke-WebRequest)
# .Parameters` 现读):`TimeoutSec` **是 `ConnectionTimeoutSeconds` 的别名**,不是第三个维度
# —— 它只封"连不上"这一段,封不住"连上了但对端不回应/回得极慢"。所以把 `-TimeoutSec` 原样
# 保留(不改既有语义),另加 `OperationTimeoutSeconds`;两者同传合法,而 `-TimeoutSec` 与
# `-ConnectionTimeoutSeconds` **同传会直接绑定报错**("specified more than once",实测),
# 故此处绝不换成 ConnectionTimeoutSeconds。
# 为什么必须加:健康门禁探的是公网 URL(经 Cloudflare Tunnel),2026-09-27 实测两次整轮挂死
# 38.6 / 38.5 分钟(日志零行、CPU 增量 0ms ⇒ 阻塞非空转),而同一批 URL 从交互账户 1.1–1.3s
# 返回 200 —— 故障在 LocalSystem 那份网络栈,不在站点侧。见 Test-HealthGate 的单轮预算。
$ProbeOpSec = 15    # 与两处 -TimeoutSec 15 同值:连接 + 操作,单次探测最坏 30s
$LoginOpSec = 20   # 登录取探测令牌是 POST,与其 -TimeoutSec 20 同值
function Test-Http {
    param([string]$url,[string]$contains='')
    try {
        $r = Invoke-WebRequest -Uri $url -TimeoutSec 15 -OperationTimeoutSeconds $ProbeOpSec -ErrorAction Stop -UseBasicParsing
        if ($contains -and $r.Content -notmatch [regex]::Escape($contains)) { return $false }
        return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
    } catch { return $false }
}

function BackendLogin-Token {
    # 探测 LLM 网关需带 Bearer;用 admin 获取 token(仅作健康探测,不改数据)
    # 凭据不入仓库:密码经环境变量 IHUI_ADMIN_PASSWORD 注入;
    # 服务上下文(NSSM/计划任务)拿不到该变量时,回落到生产机本机密钥文件 ——
    # 否则 p3 恒 False → 门禁 8 轮必失败 → 每次构建成功后又被回滚,api/ai-service 永不重启。
    # 取值序(env 优先)一字不改;解析与"两处漂移"对照收在 admin-credential.ps1(唯一实现)。
    $cred = Resolve-AdminCredential -EnvValue $env:IHUI_ADMIN_PASSWORD -File $AdminPwdFile
    if ($cred.Drift) {
        Log "WARN  两处 admin 口令不一致(env 块 $($cred.EnvFingerprint) ≠ 回落文件 $($cred.FileFingerprint))—— 取用序 env 优先,陈旧那处会静默地把门禁打成盲的;修法=§5e 事务式把陈旧那处同步,再重启本服务。判它是否已修好:本轮或下一轮应出现 'HEALTH 已取得探测令牌'(坏态是 401)"
    }
    $adminPwd = $cred.Value
    if (-not $adminPwd) { return $null }
    try {
        $b = @{ username='admin'; password=$adminPwd } | ConvertTo-Json
        $login = Invoke-RestMethod -Uri "$PublicWeb/api/auth/login/username" -Method Post `
                        -Body $b -ContentType 'application/json' -TimeoutSec 20 -OperationTimeoutSeconds $LoginOpSec -ErrorAction Stop
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
        # -OperationTimeoutSeconds 是给"连上了但不回应"封顶的那一道(见本文件上方
        # $ProbeOpSec / $LoginOpSec 那段实测注释:
        # -TimeoutSec 实为 ConnectionTimeoutSeconds 的别名,只管连接段)。异常一律落
        # Verdict='unknown' —— 超时**不**产生"健康"结论,也不产生"失败"结论,由调用方按未知处理。
        $resp = Invoke-WebRequest -Uri $Url -TimeoutSec 15 -OperationTimeoutSeconds $ProbeOpSec -Headers $hdr -ErrorAction Stop -UseBasicParsing -SkipHttpErrorCheck
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
    # 单轮墙钟预算(2026-09-27 加):上一段那次实测里,一次门禁迭代耗了 2312–2315 秒(38.5–38.6
    # 分钟)且**一行日志都不出**,整轮被外层 taskkill 冻死。这里给"一轮"有界上限,并让"卡住"
    # 在日志里数得出来(GATE-ITER / GATE-ITER-STALLED 两枚标记均为纯 ASCII —— 实测 deploy-loop.log
    # 的中文经 LocalSystem 子进程管道后已损坏成 U+FFFD,只有 ASCII 片段还看得见)。
    # 两道防线的分工必须如实理解:单次探测**之内**的硬阻塞由上面的 OperationTimeoutSeconds 断,
    # 本预算只断"三次探测各自没超时但加起来超预算"这一型;两者都失效时仍由外层
    # ihui-deploy-loop.ps1 的 RunBudgetMin=45 分钟兜底(未改,那是机主的 tuning)。
    # env 覆盖:IHUI_DEPLOY_GATE_ITER_BUDGET_SEC(仅接受非负整数,否则回落 120)。
    [int]$IterBudgetSec = 120
    if ($env:IHUI_DEPLOY_GATE_ITER_BUDGET_SEC -and $env:IHUI_DEPLOY_GATE_ITER_BUDGET_SEC -match '^\d+$') {
        $IterBudgetSec = [int]$env:IHUI_DEPLOY_GATE_ITER_BUDGET_SEC
    }
    $lastFails = @(); $lastUnknown = @()
    for ($i = 1; $i -le $Tries; $i++) {
        Update-DeployLockHeartbeat   # 门禁每轮续心跳(8 轮 × 12s + 探测超时,最长约 9.6 分钟)
        $iterStart = Get-Date       # 本轮起点(含 12s 退避),用于 GATE-ITER elapsed 与预算判定
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
        # ASCII 标记:每完成一轮都打一行(含通过那一轮),便于事后按秒数复原分布、定位卡在哪一轮
        $iterSec = [int]((Get-Date) - $iterStart).TotalSeconds
        Log ("GATE-ITER {0}/{1} elapsed={2}s budget={3}s" -f $i, $Tries, $iterSec, $IterBudgetSec)
        # 成功条件不放宽:三项全部真绿才算通过("未知"也不算绿,继续下一轮重试)
        if ($fails.Count -eq 0 -and $unknown.Count -eq 0) { return $true }
        if ($iterSec -gt $IterBudgetSec) {
            # 方向性要求:超预算**不**判失败、**不**判健康 —— 跳出到下方既有的
            # "无明确失败项 ⇒ unknown ⇒ 放行、不回滚"返回。若此前某轮拿得出明确失败项,
            # 既有判据仍先 return $false(那是真证据,不因本 break 而被洗成放行)。
            Log ("GATE-ITER-STALLED {0}/{1} elapsed={2}s budget={3}s items=[web={4} api={5} llm={6}]" -f $i, $Tries, $iterSec, $IterBudgetSec, $w.Verdict, $a.Verdict, $l)
            Log "WARN  健康门禁第 $i/$Tries 轮超单轮预算 $IterBudgetSec 秒(探测被阻塞的特征)→ 停止继续轮询;不判健康、不判失败、不回滚,按既有'未知即放行'语义收尾并继续重启 api/ai-service"
            break
        }
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

# 多会话共写的活文档:工作区副本常年滞后 HEAD(旁路提交只推进 HEAD,不 checkout 工作树)。
$LiveDocPaths = @('PROJECT_PLAN.md', 'README.md', 'AGENTS.md')
function Invoke-LiveDocStaleRecovery {
    <#
      挡 ff 的路径**全部**是活文档时,先逐行证明"这份副本没有任何 HEAD∪归档∪远端(origin/main) 之外的内容"
      (2026-10-10 起:除整行等值外,还按"剥记账装饰后实质内容逐字见于三面"认「旧修订被取代」;
       判定器 `scripts/live-doc-staleness-decision.mjs`,取不到远端面时自动退回两面口径),
      证得了才把它复原到 HEAD(先落逐字节备份),并让调用方重试一次 ff。
      返回 $true = 已复原可重试;$false = 不复原(照旧 BLOCKED-WIP)。

      2026-09-28 实测代价:这一型把生产整整挡住 4.5 小时(16:30 起连续 19 轮),期间每 4 小时
      给机主寄一封"有未提交文件挡住 ff",而那两个文件里没有任何人在写的东西 —— 它们只是
      归档前的旧快照。当时是我人工逐行验完才 checkout 的;判据必须常驻,否则下一个人只能
      凭感觉决定要不要覆盖别人的台账,而凭感觉覆盖台账会抹掉别人正在写的活账。
      判据本身不住在这里:在 scripts/live-doc-staleness-decision.mjs(多重集逐行出处判定)。
    #>
    param([string[]]$Blockers)
    $nonLive = @($Blockers | Where-Object { $LiveDocPaths -notcontains $_ })
    if ($nonLive.Count -gt 0) {
        Log "LIVE-DOC 不复原:挡路清单里有 $($nonLive.Count) 个非活文档路径($($nonLive -join ', '))"
        return $false
    }
    $node = Resolve-NodeExe
    if (-not $node) { Log 'LIVE-DOC 未判定:node.exe 取不到,本轮不复原(等同改动前行为)'; return $false }
    $decider = Join-Path $Root 'scripts/live-doc-staleness-decision.mjs'
    if (-not (Test-Path -LiteralPath $decider)) { Log "LIVE-DOC 未判定:判定器不在位 $decider,本轮不复原"; return $false }
    $argv = @($decider, '--paths') + @($Blockers) + @('--json')
    $out = & $node @argv 2>&1 | Out-String
    $code = $LASTEXITCODE
    if ($code -ne 0) {
        # exit 1 = 有无出处行(可能有人的活账就在这份副本里) / exit 2 = 判不出。两种都不许覆盖。
        Log "LIVE-DOC 判不可复原(exit=$code):副本含 HEAD∪归档∪远端(origin/main) 都无出处、且长度闸内也认不出「被取代」的行,禁止覆盖(不代提交不删除)"
        @($out -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 14) | ForEach-Object { Log "  [decide] $_" }
        return $false
    }
    $bakDir = Join-Path $Root '.ihui-agent/tmp/live-doc-stale'
    # 备份必须是**终止错误 + 逐字节自证**。两条都是被实测逼出来的:
    # ① 本脚本 $ErrorActionPreference='Continue',而 Copy-Item 的失败默认是**非终止错误** ⇒
    #    裸 try/catch 接不住,备份没成也照样往下走到 git checkout(镜像测试 D5 第一次跑就
    #    抓到我这个写法:结果是 False,但理由是"git checkout 失败",守卫等于没写)。
    # ② "写了个同名文件"不等于"底稿可用" ⇒ 落盘后必须比哈希,不一致就不覆盖。
    try {
        if (-not (Test-Path -LiteralPath $bakDir)) { New-Item -ItemType Directory -Path $bakDir -Force -ErrorAction Stop | Out-Null }
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        foreach ($p in $Blockers) {
            $srcP = Join-Path $Root $p
            if (-not (Test-Path -LiteralPath $srcP)) {
                Log "LIVE-DOC 不复原:台账路径 $p 在工作区读不出来,拿不到逐字节底稿"
                return $false
            }
            $dst = Join-Path $bakDir ("{0}.pre-align.{1}" -f (Split-Path $p -Leaf), $stamp)
            Copy-Item -LiteralPath $srcP -Destination $dst -Force -ErrorAction Stop
            $hSrc = (Get-FileHash -LiteralPath $srcP -Algorithm SHA256).Hash
            $hDst = (Get-FileHash -LiteralPath $dst -Algorithm SHA256).Hash
            if ($hSrc -ne $hDst) {
                Log "LIVE-DOC 不复原:底稿哈希与原件不一致($p),不能声称有可还原的备份"
                return $false
            }
        }
    } catch {
        Log "LIVE-DOC 备份失败,放弃复原(没有逐字节底稿就不许覆盖台账): $($_.Exception.Message)"
        return $false
    }
    & git -C $Root checkout HEAD -- @Blockers 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Log "LIVE-DOC git checkout 失败(exit=$LASTEXITCODE),不复原"; return $false }
    Log "LIVE-DOC 已复原 $($Blockers.Count) 个滞台活文档副本到 HEAD(逐行证明其内容在 HEAD ∪ 归档全部有出处;逐字节底稿在 $bakDir;判据实现 scripts/live-doc-staleness-decision.mjs)"
    return $true
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

function Get-CleanBuildWebDir {
    <#
      返回一个"内容恰等于目标 SHA"的 apps\web 目录路径;返回 '' 表示不可用(调用方大声回退)。
      为什么要有它:旧口径直接编译 $WebDir(共享工作树),于是任何一个并行会话的半截编辑都能
      打死全队上线(2026-09-29 16:10–16:27 四轮构建全红,红源是一份**未提交**的文件,HEAD 面
      连那个符号都没有)。linked worktree 与主仓**共用对象库** ⇒ 同步到目标 SHA 不联网、不 fetch。
      三条"不许把没判当成判过":① 不信命令的退出码,`rev-parse HEAD` 回读必须等于目标 SHA;
      ② 导出面 `status --porcelain` 非空即拒绝使用(它就不再是净面);③ 依赖缺失时是**装完再回读**
      判定,而不是"pnpm install 没报错就算好"。
    #>
    param([string]$Sha)
    if (-not $CleanBuildEnabled) { return '' }
    if (-not $Sha) { Log '[CLEAN-BUILD] 目标 SHA 取不到 ⇒ 本轮不启用净面(未判定,不是已通过)'; return '' }
    try {
        if (-not (Test-Path (Join-Path $CleanBuildWt '.git'))) {
            if (Test-Path $CleanBuildWt) {
                Log "[CLEAN-BUILD] 目录存在但不是 worktree(疑半截残留)⇒ 删除重建:$CleanBuildWt"
                Remove-Item $CleanBuildWt -Recurse -Force -ErrorAction SilentlyContinue
            }
            Log "[CLEAN-BUILD] git worktree add --detach $CleanBuildWt $Sha"
            # 先 prune 再 add:宿主清理层会整目录删掉工作树(§5b 实测本机 `.git` 与工作区目录都曾被啃),
            # 目录没了但**注册还在** `$Root\.git\worktrees\` 里时,`worktree add` 直接报
            # "already registered by working tree at …" ⇒ 净面从此永久不可用,而这一型不会自己好。
            # prune 只注销"目录已不存在"的登记,不动任何在用的工作树 ⇒ 零风险,放在 add 前一步。
            git @gitFace -C $Root worktree prune 2>&1 | ForEach-Object { Log "[clean-prune] $_" }
            git @gitFace -C $Root worktree add --detach $CleanBuildWt $Sha 2>&1 | ForEach-Object { Log "[clean-out] $_" }
            if ($LASTEXITCODE -ne 0) { throw "worktree add 失败 exit=$LASTEXITCODE" }
        } else {
            git @gitFace -C $CleanBuildWt checkout --detach --force $Sha 2>&1 | ForEach-Object { Log "[clean-out] $_" }
            if ($LASTEXITCODE -ne 0) { throw "checkout --detach 失败 exit=$LASTEXITCODE" }
        }
        $at = ((git @gitFace -C $CleanBuildWt rev-parse HEAD) | Out-String).Trim()
        if ($at -ne $Sha) { throw "回读不一致:导出面 HEAD=$at 目标=$Sha" }
        $dirtyLines = @((git @gitFace -C $CleanBuildWt status --porcelain 2>$null | Out-String) -split "`n" | Where-Object { $_.Trim() -ne '' }).Count
        if ($dirtyLines -gt 0) { throw "导出面有 $dirtyLines 项改动 ⇒ 它不是净面,拒绝用来构建" }
        $webBin = Join-Path $CleanBuildWt 'apps\web\node_modules\.bin\next.cmd'
        if (-not (Test-Path $webBin)) {
            Log '[CLEAN-BUILD] 导出面依赖缺失 ⇒ pnpm install --frozen-lockfile(首次数分钟,期间持续续心跳)'
            Push-Location $CleanBuildWt
            try {
                & 'D:\DevEnv\tools\npm-global\pnpm.cmd' install --frozen-lockfile 2>&1 |
                    Select-Object -Last 6 | ForEach-Object { Log "[clean-install] $_" }
                $irc = $LASTEXITCODE
            } finally { Pop-Location }
            Update-DeployLockHeartbeat
            if ($irc -ne 0) { throw "导出面 pnpm install 失败 exit=$irc" }
            if (-not (Test-Path $webBin)) { throw 'install 后 next.cmd 仍不在位 ⇒ 判定失败,不当作就绪' }
        }
        # ── 被 .gitignore 忽略、但**是构建输入**的文件必须覆盖给净面 ──────────────
        # `git worktree` 只带已跟踪内容,而 apps/web/.env.production 是被忽略的(gitignore
        # **/.env.production),里面 30 个 NEXT_PUBLIC_* 键(OAuth client id、Turnstile site key、
        # APK/iOS 下载地址与版本、各登录方式 ENABLED 开关)由 next build **编译期静态内联**
        # (见 apps/web/src/lib/third-party-config.ts:19 的注释)。净面缺它 ⇒ 构建"成功"而产物里
        # 这些值全是 undefined —— 症状是社交登录按钮消失/验证码不工作/下载页空白,且不报错。
        # 刻意**不**镜像 apps/web/public/ 下那 75MB 被忽略资源(downloads/、vs/):生产不设
        # output:'export'(next.config.ts:18 起按环境变量控制),public 由运行时的 $WebDir 提供,
        # 而交换链只搬 .next-$DistDir 不碰 public ⇒ 它们不是构建输入;真要做静态导出那一路时,
        # 这一条必须一起改,否则产物缺素材。
        $envSrc = Join-Path $WebDir '.env.production'
        $envDst = Join-Path $CleanBuildWt 'apps\web\.env.production'
        if (Test-Path -LiteralPath $envSrc) {
            Copy-Item -LiteralPath $envSrc -Destination $envDst -Force
            if (-not (Test-Path -LiteralPath $envDst)) { throw 'env.production 复制后不在位 ⇒ 不用这一份构建' }
            $srcLen = (Get-Item -LiteralPath $envSrc).Length
            $dstLen = (Get-Item -LiteralPath $envDst).Length
            if ($srcLen -ne $dstLen) { throw "env.production 复制字节不等 src=$srcLen dst=$dstLen" }
        } else {
            Log '[CLEAN-BUILD] 警告:本机 apps\web\.env.production 不在位 ⇒ 净面与旧面同样烘不进 NEXT_PUBLIC_*(不是净面新缺陷,但线上功能会缺,请人工确认它是否该存在)'
        }
        Ok ("[CLEAN-BUILD] 净面就绪:{0} @ {1}" -f $CleanBuildWt, $Sha.Substring(0, [Math]::Min(10, $Sha.Length)))
        return (Join-Path $CleanBuildWt 'apps\web')
    } catch {
        Log ("[CLEAN-BUILD] FALLBACK 净面不可用({0})⇒ 本轮退回共享工作树构建:隔离暂时失效,线上仍在更新,需人工修" -f $_.Exception.Message)
        return ''
    }
}

function Test-CleanBuildEnvInlined {
    <#
      判"这一份产物到底把 .env.production 里的 NEXT_PUBLIC_* 烘进去了没有",返回三态:
        'ok'           —— 至少一个候选值在 .next-*/static 的 js 里逐字命中
        'absent'       —— 候选都在、一个都没命中 ⇒ 构建没读到 env(拒绝交换)
        'undetermined' —— 取不到候选 / 取不到产物 js / 扫不动 ⇒ **不拦本轮,但必须喊"这一维没被看过"**
      为什么需要它:净面来自 `git worktree`,只带**已跟踪**内容,而 `.env.production` 被 gitignore。
      一旦那份覆盖没做到位(或将来有人把净面目录换到别处),next build 会**成功**地产出一个
      所有 NEXT_PUBLIC_* 都是 undefined 的包 —— 症状是登录按钮消失/验证码不工作/下载页空白,
      而构建、健康检查、门禁全都不红。这属本仓记过最多次的"失效形态是安静"那一型,所以把
      断言常驻在交换之前,而不是等肉眼在屏幕上看出来。
      刻意只扫 static/client bundle(值就烘在那里),不扫 server 段 —— 后者 2GB 级,一遍要几分钟。
    #>
    param([string]$ArtifactDir, [string]$EnvFile, [bool]$SourceEnvExists = $false)
    $vals = @()
    try {
        if (-not (Test-Path -LiteralPath $EnvFile)) {
            # 两侧都不在位 = 旧口径也一样缺它,那是既有机器状态,拦它等于把部署永久冻住 ⇒ 未判定;
            # 而**主目录有、净面没有**只可能是"覆盖这一步没做到",正是本判据要拦的那一型。
            if ($SourceEnvExists) { return @('absent', "主目录有 .env.production 而净面没有($EnvFile 不在位)⇒ 覆盖步骤没生效") }
            return @('undetermined', "env 文件两侧都不在位:$EnvFile")
        }
        foreach ($line in @(Get-Content -LiteralPath $EnvFile -Encoding UTF8 -ErrorAction Stop)) {
            if ($line -match '^\s*NEXT_PUBLIC_([A-Z0-9_]+)\s*=\s*(.*)$') {
                $v = $Matches[2].Trim().Trim('"').Trim("'")
                # 只要可能被客户端代码用到的那种值:够长、不含模板占位、不含空格
                if ($v.Length -ge 12 -and $v -notmatch '[${}\s]') { $vals += $v }
                if ($vals.Count -ge 8) { break }
            }
        }
    } catch { return @('undetermined', "env 读取失败:$($_.Exception.Message)") }
    if ($vals.Count -eq 0) { return @('undetermined', 'env 里没有可作探针的 NEXT_PUBLIC_* 值(全被长度/字符门槛挡掉)') }
    $staticRoot = Join-Path $ArtifactDir 'static'
    $scanRoot = if (Test-Path -LiteralPath $staticRoot) { $staticRoot } else { $ArtifactDir }
    $js = @()
    try { $js = @(Get-ChildItem -LiteralPath $scanRoot -Recurse -Filter *.js -File -ErrorAction Stop) } catch { }
    if ($js.Count -eq 0) { return @('undetermined', "产物里没量到可扫的 js($scanRoot)") }
    $paths = @($js | ForEach-Object { $_.FullName })
    foreach ($v in $vals) {
        try {
            if (Select-String -LiteralPath $paths -SimpleMatch -Pattern $v -Quiet -ErrorAction Stop) {
                return @('ok', "命中 1 个候选值(共 $($vals.Count) 个候选、$($js.Count) 个 js)")
            }
        } catch { return @('undetermined', "扫描派生失败:$($_.Exception.Message)") }
    }
    return @('absent', "$($vals.Count) 个 NEXT_PUBLIC_* 候选值在 $($js.Count) 个 js 里**逐字一个都没有**")
}

function Build-Web {
    param(
        [string]$DistDir = 'staging',
        [int]$MaxTries = 4,
        # 非空 ⇒ 编译这一份(净面)而不是 $WebDir;产物仍搬回 $WebDir 走既有交换链。
        [string]$SrcWebDir = ''
    )
    $bwd = if ($SrcWebDir) { $SrcWebDir } else { $WebDir }
    # 心跳(判据 C4 的持有侧):本函数是最长的一段(依赖安装 + 6 个 workspace 包 dist +
    # 最多 4 次 next build try),不续心跳就会被下一轮轮询或手工部署按"陈旧"抢占 ⇒
    # 两个构建同时写 .next —— 那正是这把锁存在的理由。上限 45 分钟的推导见
    # deploy-lock-common.ps1 头注;函数内部 15s 节流,放在循环里代价只有一次时间判断。
    Update-DeployLockHeartbeat
    Set-Location $bwd
    if (-not (Test-Path (Join-Path $bwd 'node_modules\.bin\next.cmd'))) {
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
    foreach ($pkg in @('@ihui/types','@ihui/i18n','@ihui/dom-actions','@ihui/context-compaction','@ihui/api-client','@ihui/design-tokens','@ihui/shared','@ihui/auth','@ihui/ui-react')) {
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
            Log "构建尝试 $try/$MaxTries -> .next-$DistDir (源码面=$(if ($SrcWebDir) { '净面:' + $CleanBuildWt } else { '共享工作树' }))"
            Update-DeployLockHeartbeat      # 每次 try 开头续心跳(单次 try 墙钟 30 分钟 < 45 分钟上限)
            Remove-Item "$bwd\.next-$DistDir" -Recurse -Force -ErrorAction SilentlyContinue
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
                    -WorkingDirectory $bwd -NoNewWindow -PassThru `
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
            $ok = ($exitCode -eq 0) -and (Test-Path "$bwd\.next-$DistDir\BUILD_ID")
            Update-DeployLockHeartbeat      # try 结束再续一次:上一行之后还要跑 Tail 读日志与判定
            if ($ok) {
                # 净面构建 ⇒ 产物必须搬回 $WebDir 才能走既有 `.rollback → 交换 → 重启` 链。
                # 刻意用"清空目标再整目录复制"而不是就地构建:交换链、回滚点、`IHUI_BUILD_SHA`
                # 写入、健康门禁全部保持原样,本票只换"源码从哪来"这一维。
                if ($SrcWebDir) {
                    # 交换前最后一道:确认这份产物真的读到了 .env.production(判据与三态见
                    # Test-CleanBuildEnvInlined 头注)。'absent' ⇒ 拒绝交换,保持当前在线版本;
                    # 'undetermined' ⇒ 照旧交换但**大声**喊"这一维今天没被看过",不得静默。
                    $probe = Test-CleanBuildEnvInlined -ArtifactDir "$bwd\.next-$DistDir" -EnvFile (Join-Path $bwd '.env.production') -SourceEnvExists ([bool](Test-Path -LiteralPath (Join-Path $WebDir '.env.production')))
                    if ($probe[0] -eq 'absent') {
                        throw "净面产物里量不到任何 NEXT_PUBLIC_* 内联值($($probe[1]))⇒ 判定构建没读到 .env.production,拒绝交换"
                    }
                    Log "[CLEAN-BUILD] env 内联核对:$($probe[0]) —— $($probe[1])"
                    # next build 会把**被跟踪的** next-env.d.ts 改写成引用 `.next-staging/...`
                    # (主流程 1635 行那条老修复说的就是这件事)。在净面上留着他,下一轮
                    # Get-CleanBuildWebDir 的"导出面必须零改动"判据就会红 ⇒ 从此永久回退到共享
                    # 工作树,隔离静默失效。所以回搬之前先把导出面还原成已提交版本。
                    try { git @gitFace -C $CleanBuildWt checkout -- apps/web/next-env.d.ts 2>$null } catch {}
                    $dirtyAfter = @((git @gitFace -C $CleanBuildWt status --porcelain 2>$null | Out-String) -split "`n" | Where-Object { $_.Trim() -ne '' }).Count
                    if ($dirtyAfter -gt 0) { Log "[CLEAN-BUILD] 警告:构建后导出面仍残留 $dirtyAfter 项改动(下一轮会拒绝用净面)⇒ 需人工看是什么写脏了它" }
                    $dstStaging = "$WebDir\.next-$DistDir"
                    Log "[CLEAN-BUILD] 产物回搬 $bwd\.next-$DistDir → $dstStaging"
                    Remove-Item $dstStaging -Recurse -Force -ErrorAction SilentlyContinue
                    # 目标必须**不存在**才能复制:PowerShell 的 Copy-Item -Recurse 在目标是已存在
                    # 目录时,会把源目录整个放进去,产出 `.next-staging\.next-staging\BUILD_ID` ——
                    # 而下面的 BUILD_ID 判据会因此红,症状读起来像"产物坏了"。删除可能因文件被占用
                    # 而静默失败(-ErrorAction SilentlyContinue),所以必须回读确认。
                    if (Test-Path -LiteralPath $dstStaging) {
                        throw "产物回搬目标 $dstStaging 删不掉(被占用?)⇒ 不交换,保持当前在线版本;需人工查是谁开着它"
                    }
                    Copy-Item "$bwd\.next-$DistDir" $dstStaging -Recurse -Force
                    if (-not (Test-Path "$dstStaging\BUILD_ID")) { throw "产物回搬后 BUILD_ID 不在位 ⇒ 不交换,保持当前在线版本" }
                    Update-DeployLockHeartbeat
                }
                Ok "next build 完成 -> .next-$DistDir"; return
            }
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
            # 诊断面同样必须"取完立刻定格":旧写法在三个源各 fetch 一次之后才读 FETCH_HEAD,
            # 那一刻它是**最后一个应答的镜像**而不是 origin —— 镜像按设计会落后,于是
            # ahead 被报成 >0,而 :971 那句提示把"本地领先 ⇒ 分叉,需人工决定处理策略"写给
            # 下一个读日志的人。同一条竞态在决策面造成的是静默部署旧提交,在诊断面造成的
            # 是错误归因(本仓 09-24 那次"把排查带去清扫工作树、白耗 1.5h"就是这类)。
            $diagOriginTip = $null
            foreach ($s in $srcs) {
                $o = & git @gitNet fetch $s main 2>&1 | Out-String
                if ($LASTEXITCODE -eq 0) {
                    DiagLog ("fetch {0} → OK" -f $s)
                    $script:diagFetched = $true
                    $t = (GitText @('rev-parse','FETCH_HEAD')).Trim()
                    if ($t -match '^[0-9a-f]{40}$') {
                        $bN = GitText @('rev-list','--count',"HEAD..$t")
                        $aN = GitText @('rev-list','--count',"$t..HEAD")
                        $short = $t.Substring(0, 10)
                        if ($bN -match '^\d+$') { DiagLog ("相对 {0}(tip {1}):behind={2} ahead={3}" -f $s, $short, $bN, $aN) }
                        if ($s -eq 'origin' -and $null -eq $diagOriginTip) {
                            $diagOriginTip = $t
                            if ($aN -match '^\d+$') { $script:diagAhead = [int]$aN }
                        }
                    } else {
                        DiagLog ("rev-parse FETCH_HEAD 未给出 40 位 sha(实得:{0})⇒ 该源的 behind/ahead 未判定,不写进结论" -f $t)
                    }
                } else {
                    DiagLog ("fetch {0} → FAIL:{1}" -f $s, (($o.Trim() -split "`n" | Select-Object -First 2) -join ' / '))
                }
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
    if ($script:diagAhead -gt 0) { DiagLog "  · 本地领先 origin 的当次 tip(分叉)→ ff-only 必失败,需人工决定处理策略(勿盲目 reset)。" }
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
    # 返回 $null 表示"判不了"(取不到 journal 或连不上库)—— 宁可不说,也不误报 0。
    # 2026-09-26 票:$null 有 6 条路径,而旧写法把它们全折成一句"未知"—— 而调用侧
    # $null -gt 0 为假 ⇒ "判不了"与"没有待办"在输出面合流,直落"完成"。现在每条 $null
    # 路径都写 $script:PendingMigrationReason,由调用侧"无法判定"分支原样打印。
    $script:PendingMigrationReason = $null
    $total = 0
    try {
        $jp = Join-Path $Root 'packages\database\drizzle\meta\_journal.json'
        if (-not (Test-Path $jp)) { $script:PendingMigrationReason = "journal 文件缺失:$jp"; return $null }
        $total = (@((Get-Content $jp -Raw | ConvertFrom-Json).entries)).Count
        if ($total -lt 1) { $script:PendingMigrationReason = 'journal entries 为空'; return $null }
    } catch { $script:PendingMigrationReason = "journal 读取异常:$_"; return $null }
    try {
        $psql = Get-PsqlExe
        if (-not $psql) { $script:PendingMigrationReason = 'psql.exe 不可达(绝对候选与 PATH 均落空)'; return $null }
        if (-not $env:DATABASE_URL) { $script:PendingMigrationReason = 'DATABASE_URL 未设'; return $null }
        $raw = ((& $psql $env:DATABASE_URL -At -c "select count(*) from drizzle.__drizzle_migrations;" 2>$null) | Out-String).Trim()
        if ($raw -notmatch '^\d+$') { $script:PendingMigrationReason = 'psql 输出非数字(连不上库或迁移表不存在)'; return $null }
        $d = $total - ([int]$raw)
        if ($d -lt 0) { $d = 0 }
        return $d
    } catch { $script:PendingMigrationReason = "psql 调用异常:$_"; return $null }
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

function Get-MigrateBudgetSec {
    # db:migrate 硬预算(秒)。默认 180 的依据:部署环每 30 分钟一轮,正常迁移实测远小于
    # 此值,而"迁移挂死"恰是必须放手的场景(§80 无界挂起同型,且这里是写路径,不能只加
    # timeout 不终止进程)。env IHUI_DEPLOY_MIGRATE_TIMEOUT_SEC 覆写;生效值在每次调用前
    # 打进日志 —— 报告里的数字必须以当轮日志行为准,不得照文档派单。
    $raw = "$env:IHUI_DEPLOY_MIGRATE_TIMEOUT_SEC"
    if ($raw -match '^\d+$' -and [int]$raw -gt 0) { return [int]$raw }
    return 180
}

function Get-MigrateOutcome {
    # 纯判据:不打日志、不派生命令、无副作用,返回 ASCII 枚举供调用方分流 ——
    # 使 scripts/tests/deploy-migrate-exitcode.test.mjs 能离线用假数据抽出本函数直接跑。
    #   TIMEOUT — 超硬预算被终止,没有可信退出码,判"超时未判定"(不得冒充失败或成功)
    #   FAIL    — migrate 自身退出码≠0;此判优先于 Pending,后面 psql 成败不改判
    #   UNDET   — exit 0 但 pending 取不出来 ⇒ "无法判定",既不是完成也不是失败
    #   PEND    — exit 0 但仍落后(跑过但没应用完)
    #   OK      — exit 0 且 pending=0
    param(
        [int]$MigExit,
        [AllowNull()][object]$Pending,
        [switch]$TimedOut
    )
    if ($TimedOut) { return 'TIMEOUT' }
    if ($MigExit -ne 0) { return 'FAIL' }
    if ($null -eq $Pending) { return 'UNDET' }
    if ([int]$Pending -gt 0) { return 'PEND' }
    return 'OK'
}

function Invoke-MigrateWithBudget {
    # 2026-09-26 票:db:migrate 此前是无 timeout 的同步 `&`。同文件构建段(2026-09-21 注释)
    # 记过那一型:直调可被孤儿孙进程持管道永久挂起。这里按构建段同形改 Start-Process +
    # stdout/stderr 重定向文件 + WaitForExit(ms),超时 taskkill /T 杀整树(pnpm.cmd 派生
    # node/psql,只杀根进程会留它们继续写库)。重定向落点用完即删 —— 服务身份(LocalSystem)
    # 的 $env:TEMP 在 C:\Windows\Temp,HKCU 迁盘对它无效(§26 实测),留着就是每天堆垃圾。
    # 返回 @{ Exit; Out; TimedOut };超时没有退出码,Exit=$null(判定层按 TIMEOUT 走)。
    param([int]$BudgetSec)
    $migOutFile = Join-Path $env:TEMP "ihui-migrate-$PID-out.log"
    $migErrFile = Join-Path $env:TEMP "ihui-migrate-$PID-err.log"
    $timedOut = $false
    $code = $null
    try {
        try {
            $migProc = Start-Process -FilePath 'D:\DevEnv\tools\npm-global\pnpm.cmd' -ArgumentList 'run', 'db:migrate' `
                -WorkingDirectory (Get-Location).Path -NoNewWindow -PassThru `
                -RedirectStandardOutput $migOutFile -RedirectStandardError $migErrFile
            if (-not $migProc.WaitForExit($BudgetSec * 1000)) {
                Log "WARN  db:migrate 超 ${BudgetSec}s 墙钟(pid=$($migProc.Id))判挂死,taskkill /T 整树"
                & taskkill /PID $migProc.Id /T /F 2>&1 | Out-Null
                $timedOut = $true
            } else {
                $migProc.WaitForExit()   # 确保重定向文件缓冲已落盘再读
                $code = $migProc.ExitCode
            }
        } catch {
            # 与构建段同形的兜底:Start-Process 起不来时回退直调(无预算保护,如实喊出来)。
            # 回退分支同样**取码即存** —— 本票修的就是隔步读码,不在兜底路径上重犯。
            Log "Start-Process 迁移异常($($_.Exception.Message)),回退直调(本轮无超时保护,生效预算=不适用)"
            & "D:\DevEnv\tools\npm-global\pnpm.cmd" run db:migrate 2>&1 | Out-File -FilePath $migOutFile -Encoding utf8
            $code = $LASTEXITCODE
        }
        $out = ((Get-Content $migOutFile -Raw -ErrorAction SilentlyContinue) + "`n" +
                (Get-Content $migErrFile -Raw -ErrorAction SilentlyContinue))
        return @{ Exit = $code; Out = "$out"; TimedOut = $timedOut }
    } finally {
        try { Remove-Item -LiteralPath $migOutFile, $migErrFile -Force -ErrorAction SilentlyContinue } catch {}
    }
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
        $migBudgetSec = Get-MigrateBudgetSec
        Log "MIG   db:migrate 硬预算=${migBudgetSec}s(env IHUI_DEPLOY_MIGRATE_TIMEOUT_SEC 可覆写;生效值以此行为准)"
        $mig = Invoke-MigrateWithBudget -BudgetSec $migBudgetSec
        # 取码即存(2026-09-26 主修点,现读复现):旧顺序是 & pnpm db:migrate → Get-PendingMigrationCount
        # (原生 psql)→ Test-MigrateOrphans(又一次原生 psql)→ 才判 $LASTEXITCODE —— 两次 psql 把它
        # 覆写,第 4 步判的根本不是 migrate 的退出码:迁移失败也照样打"完成(exit 0)"。
        # 现在码在诞生处就落成 $migExit/$migTimedOut,本函数后续判定一律不碰 $LASTEXITCODE。
        $migExit = $mig.Exit
        $migTimedOut = [bool]$mig.TimedOut
        $migOut = $mig.Out
        $migOut | Write-Host
        $pend = Get-PendingMigrationCount
        $pendTxt = if ($null -eq $pend) { '未知' } else { "$pend 个" }
        Log "MIG   待应用迁移=$pendTxt(journal vs drizzle.__drizzle_migrations)"
        # 孤儿记录检测(2026-09-21 加):有孤儿时 pending 永远清不掉且 migrate 假成功,必须显式告警
        $orphans = Test-MigrateOrphans
        if ($orphans) {
            Note-MigrateFailure -reason "孤儿迁移记录(DB max created_at 超过 journal 最大 when)" -pendingTxt $pendTxt
        } elseif ($null -eq $orphans) {
            # 旧写法 if (Test-MigrateOrphans) 把 $null(判不了)与 $false(无孤儿)合流成静默通过;
            # 与本票主修点是同一型"判不了冒充已判定",此处一并点名,只喊原因不定性。
            Log "WARN  孤儿迁移检测无法判定(原因:${script:PendingMigrationReason})—— 不计「已核」,也不冒判有孤儿"
        }
        $outcome = Get-MigrateOutcome -MigExit ([int]$migExit) -Pending $pend -TimedOut:$migTimedOut
        switch ($outcome) {
            'FAIL' {
                # 2026-09-13 加固:失败必须能定位到具体迁移,而不是只报退出码
                $bad = ($migOut -split "`n" | Where-Object { $_ -match "\.sql|ERROR|error:" } | Select-Object -First 6) -join " | "
                Log "WARN  db:migrate 失败(exit $migExit),本轮继续但需人工核查;线索: $bad"
                Note-MigrateFailure -reason "exit $migExit" -pendingTxt $pendTxt
            }
            'TIMEOUT' {
                # 超时不改写退出码语义(根本没有码)、不静默继续:按既有失败记账器记,标注未判定
                Log "WARN  db:migrate 超 ${migBudgetSec}s 被终止 —— **超时未判定**(成败未知,无退出码可引用),本轮记 degraded"
                Note-MigrateFailure -reason "超时 ${migBudgetSec}s(未判定,无退出码)" -pendingTxt $pendTxt
            }
            'UNDET' {
                # 显式"无法判定"分支:既不得记成功,也不得记失败(两回事);打印取不到的原因。
                # 措辞刻意不含「完成」二字 —— 让"判不了"在日志 grep 面上也不冒充成功态。
                Log "WARN  db:migrate exit 0 但待应用数**无法判定**(原因:${script:PendingMigrationReason})—— 不计为成功,也不计失败"
            }
            'PEND' {
                Log "WARN  db:migrate exit 0 但仍落后 $pend 个迁移 —— 属于「跑过但没应用完」,需人工核查"
                Note-MigrateFailure -reason "exit 0 但仍有待应用" -pendingTxt $pendTxt
            }
            'OK' {
                # 唯一能打出"完成"字样的分支:退出码=0(取码即存的那份)且 pending=0 两者齐备。
                Ok "db:migrate 完成(exit 0)"
            }
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
#    注意:镜像 fetch 同样写 FETCH_HEAD,而下游只认下面立刻定格的 $remoteTip(取自当次
#    FETCH_HEAD 的第一行),所以镜像回退不需要另一条取值路径 —— 但它也不再回头看那枚共享文件。
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
# 落后提交数 = 本地未含本轮远端 tip 的提交数
# 2026-09-13 修复(实测):本机 origin/main 这个嵌套 remote-tracking ref 会被宿主吞掉、永不更新
# (fetch 打印 6eedf5b0f1..adcc23136a 但 rev-parse origin/main 仍读回旧值)→
# 旧写法 git rev-list --count HEAD..origin/main 恒 0 → 循环判定"已是最新"提前退出、永不部署。
# 改为对齐刚 fetch 下来的远端 tip,彻底免疫该问题。
# ── 但那枚 tip 必须先"定格"成一枚显式 sha(2026-09-28 实测竞态)────────────────────
# FETCH_HEAD 是 .git 下**全局共享的单文件**:任何一次并发 `git fetch`(其它会话、post-commit 的
# push-guard、git-guardian、本文件的镜像回退分支)都会整体重写它。旧写法在 behind 计算与
# `git merge --ff-only FETCH_HEAD` 之间夹了一次现场对齐(实测 15 秒),那 15 秒里 FETCH_HEAD
# 可以被换成一枚**本地 HEAD 的祖先**,于是 merge 打印 "Already up to date." 且 **exit 0**,
# 旧代码只看退出码 ⇒ 照常打一条"merge 已完成"的成功结论,随后备份、重建、切流。
# 后果不是报错而是**安静地部署旧版本**:2026-09-28 09:02 那一轮 behind 现读 15、日志写"merge
# 完成"并进入构建,而 apps/web/.next/IHUI_BUILD_SHA 仍是 4d6d62ba1d —— 一台"成功"的部署环对
# 远端 15 枚提交零感知,且 4h 去重的告警永远不会因此响起(它认为没失败)。
# 与 §5b 那句"origin/main 以 FETCH_HEAD 为准"不冲突:那一局否的是**嵌套跟踪 ref 的残值**,
# 这一行做的是把"刚 fetch 到的那一枚"从可被别人改写的共享文件里取出来、定格成变量。
# 下游三处决策(behind / 挡路路径清单 / merge)一律只认这个变量,不再回头看 FETCH_HEAD。
$remoteTipRaw = (& git rev-parse FETCH_HEAD 2>&1 | Out-String).Trim()
if ($remoteTipRaw -notmatch '^[0-9a-f]{40}$') {
    Log "git rev-parse FETCH_HEAD 未给出 40 位十六进制(实得:'$(($remoteTipRaw -split "`n")[0])'),无法判定远端在哪"
    # Fail 文案刻意不含变量:告警按整条文案去重(:230 `$sig = 文案本身`),把 sha/计数写进去
    # 等于每轮一个新签名 ⇒ 去重结构上永不命中(09-27 每 ~80 秒寄一封、连续 17 封的实录教训)。
    Fail "无法固化本轮远端 sha,fetch 结论不可用则不部署"
}
$remoteTip = $remoteTipRaw
# 对象必须在当轮真的在本地:并发进程可能把 FETCH_HEAD 换成一枚尚未下载对象的 sha,那样下游
# rev-list/merge 会以 `Not a valid object name` 崩在调用栈里而不是给出结论(G-209 同一口径)。
& git cat-file -e "$remoteTip^{commit}" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Log "远端 sha $remoteTip 的对象不在本地对象库:定向 fetch 一次后复核"
    & git @gitNet fetch origin $remoteTip 2>&1 | Out-String | Write-Host
    & git cat-file -e "$remoteTip^{commit}" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "本轮远端 sha 的对象取不到,无法判定是否落后 ⇒ 本轮不部署、不切流" }
}
$behindRaw = (& git @gitNet rev-list --count "HEAD..$remoteTip" 2>&1 | Out-String).Trim()
if ($behindRaw -notmatch '^\d+$') { Fail "无法计算 behind(本轮远端 sha 无效),本轮不部署" }
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
if ($dryrun) { Ok "dryrun 模式: behind=$behind,即将部署到本轮远端 tip=$($remoteTip.Substring(0,10))"; Release-DeployLock; exit 0 }

if ($behind -gt 0) {
    Log "本地落后远端 $behind 个提交,进行 fast-forward merge(本轮钉住的显式 sha)"
    # 前置现场对齐(实现见 Invoke-WorktreeAlign):脏工作树是 ff-only 最常见的失败原因,其中一部分
    # 是可自愈的幻影漂移。工作树本就干净时不跑自愈,省掉逐路径扫 git log 的开销。
    $dirtyBefore = Get-TrackedDirtyEntry
    if ($dirtyBefore.Count -gt 0) {
        Log "ff-only 前置:检测到 $($dirtyBefore.Count) 个被跟踪文件有未提交改动 → 先做幻影漂移对齐(真编辑不碰)"
        Invoke-WorktreeAlign | Out-Null
        $dirtyAfter = Get-TrackedDirtyEntry
        Log "ff-only 前置:对齐后剩余 $($dirtyAfter.Count) 个未提交被跟踪文件(本轮对齐掉 $($dirtyBefore.Count - $dirtyAfter.Count) 个)"
    }
    $mergeOut = (& git merge --ff-only $remoteTip 2>&1 | Out-String)
    Write-Host $mergeOut
    $ffRecovered = $false
    if ($LASTEXITCODE -ne 0) {
        # 2026-09-24 更正判据的成因归属:下面这段原先只看"工作树有没有脏文件"就判 BLOCKED-WIP,
        # 但"有脏文件"只是背景,不是这次 merge 失败的原因。真分叉时 git 报的是
        # "Not possible to fast-forward",而只要树上恰有脏文件(共享工作区常年如此),旧代码就会
        # 把结论写成"有人在写,等对方收尾" —— 实测把排查整个带去清扫工作树,白耗 1.5h 并寄出一次
        # 错因告警。现按 git 自己说的话分类,且 WIP 一支只点名**真正挡住 ff 的那几个路径**
        # (= 脏 ∩ 本次要改),不再把 41 个无关脏文件列成阻塞项。
        $stillDirty = Get-TrackedDirtyEntry
        if ($mergeOut -match 'Not possible to fast-forward') {
            # 先自愈再判事故:发起一次后台收敛(§12d 唯一出口),本轮优雅退出让下一轮复检;
            # 只有连续 $DivergedAlertStreak 轮仍收不拢才认定是真停摆并寄信 —— 那才是用户
            # 真的在看旧版本。绝不强推、绝不硬回退、绝不动他人未提交改动(收敛脚本自身的保证)。
            $streak = Add-DivergedStreak
            Invoke-AutoConverge
            Log "BLOCKED-DIVERGED 远端与本地已分叉(git 原话:Not possible to fast-forward),这不是脏文件造成的;已连续第 $streak 轮,阈值 $DivergedAlertStreak 轮"
            Log "BLOCKED-DIVERGED 背景(非成因):工作树另有 $($stillDirty.Count) 个未提交被跟踪文件。"
            if ($streak -lt $DivergedAlertStreak) {
                Log "SKIP  本轮不切流(自动收敛在途),优雅退出不报警,下一轮外壳复检;未切流、未动线上"
                try { Release-DeployLock } catch {}
                exit 0
            }
            # 签名里不得出现 $streak:告警按整条文案去重(:230 `$sig = 文案本身`),而这个数字
            # 每轮 +1 ⇒ 每轮都是"新故障" ⇒ 4h 去重结构上永不命中。实测 09-27 04:29 起每 ~80 秒
            # 寄一封,连续 17 封到人(状态文件 repeatNo 恒 0 即证据)。轮数是运维要看的信息,
            # 已经写在上面那条 BLOCKED-DIVERGED 日志行里,不需要也不应该进签名。
            # (第二半同理:换阈值/换措辞都会造出一个新签名,所以文案保持与计数无关。)
            Fail "git merge --ff-only 本轮远端 tip 分叉且自动收敛无效:需人工收敛后才能切流(未强推、未动任何在途改动)"
        }
        $dirtyPaths = @($stillDirty | ForEach-Object { $_.Substring([Math]::Min(3, $_.Length)).Trim() })
        $mustTouch = @(& git -C $Root diff --name-only HEAD $remoteTip 2>&1 | Out-String) -split "`r?`n" |
            Where-Object { $_.Trim() }
        $blockers = @($dirtyPaths | Where-Object { $mustTouch -contains $_ })
        if ($blockers.Count -gt 0) {
            Report-BlockedWip -Entries (@($blockers | ForEach-Object { " M $_" }))
            # 同上一条:挡路的文件数随其他会话在飞的改动逐轮漂移,把它写进签名等于每轮换一次
            # 身份 ⇒ 去重失效。数量与清单由 Report-BlockedWip 逐轮写进日志(BLOCKED-WIP 行),
            # 证据不丢,只是不再参与"这是不是同一件事"的判定。
            # 挡路的全是活文档时先试一次"有出处的复原"(实现见 Invoke-LiveDocStaleRecovery):
            # 逐行证明这份副本没有任何 HEAD 与归档之外的内容才覆盖,证不了就照旧停 —— 停是对的,
            # 但 2026-09-28 它把生产挡了 4.5 小时,而那两个文件里根本没有人在写的东西。
            if (Invoke-LiveDocStaleRecovery -Blockers $blockers) {
                Log "LIVE-DOC 复原后重试一次 ff-only"
                $mergeOut = (& git merge --ff-only $remoteTip 2>&1 | Out-String)
                Write-Host $mergeOut
                if ($LASTEXITCODE -eq 0) {
                    $ffRecovered = $true
                    Log "LIVE-DOC ff 重试成功,本轮按正常路径继续(仍要走下面的'HEAD 必须含本轮 tip'内容复核)"
                }
            }
            if (-not $ffRecovered) {
                Fail "git merge --ff-only 失败:有未提交文件与本次要更新的路径重叠,挡住 ff(不代提交不删除),已停止,未切流"
            }
        }
        if (-not $ffRecovered) {
            if ($stillDirty.Count -gt 0) {
                # 走到这里 = git 既没说分叉、脏文件也不与本次更新重叠 ⇒ 未判定,如实报出原文
                Log "WARN  merge 失败成因未归类(git 输出不含上述两种指纹);脏文件 $($stillDirty.Count) 个但与本次更新不重叠。git 原文尾 5 行:"
                @($mergeOut -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 5) | ForEach-Object { Log "  [git] $_" }
            }
            Fail "git merge --ff-only 失败(成因见紧邻上一行),已停止,未切流"
        }
    }
    # ── "merge 成功"必须由内容证明,不得由退出码证明(2026-09-28 竞态的第三刀)──────────
    # 钉了显式 sha 之后,窗口从 15 秒缩到接近 0,但**结构上仍然存在**(并发进程可以在我们
    # rev-parse 与 merge 之间再推一枚)。git 在"本轮 tip 已是 HEAD 祖先"这种现场里照样
    # exit 0 并打印 "Already up to date." —— 退出码在这里不携带任何信息。所以判据下沉一层:
    # **本轮钉住的那枚 commit 必须真的被 HEAD 包含**,否则就是"什么都没推进",绝不能继续
    # 备份/重建/切流(那等于用一条写着成功的日志替旧版本背书)。
    # 用 is-ancestor 而不是字符串等值:并发会话在 tip 之上又本地提交一枚时,HEAD 是 tip 的
    # **后代**,那种情况确实包含 tip ⇒ 必须放过,否则会把正常并发误判成故障。
    & git merge-base --is-ancestor $remoteTip HEAD 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Log ("ff 返回成功但 HEAD 未包含本轮远端 tip:期望包含 {0} 实得 HEAD={1};git 原文尾 3 行:" -f $remoteTip, (& git rev-parse HEAD 2>&1 | Out-String).Trim())
        @($mergeOut -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -Last 3) | ForEach-Object { Log "  [git] $_" }
        # 文案同样保持与 sha 无关(理由见上面 :230 去重那三条注释):sha 已在 Log 里逐轮点名。
        Fail "git merge --ff-only 未真正推进到本轮远端 tip,不按未推进的提交切流(未动任何在途改动)"
    }
    Reset-DivergedStreak   # 能走到这里 = ff 成功 ⇒ 连续计数归零(否则一次抖动会永久累加到阈值)
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
        # 源码面:净面(内容 == 本轮要上线的那枚提交)优先;拿不到净面则大声回退到共享工作树。
        # 放在 merge 之后取 SHA ⇒ 编译的就是这一轮决定要上线的那一份,不会与交换后的标记错位。
        $buildSha = (& git -C $Root rev-parse HEAD 2>&1 | Out-String).Trim()
        $cleanWeb = Get-CleanBuildWebDir -Sha $buildSha
        Build-Web -DistDir 'staging' -SrcWebDir $cleanWeb
    } catch {
        # 2026-09-21 根治:失败轮不再 Set-BuildMarker(旧逻辑写「尝试标记」导致
        # marker=HEAD → 下一轮误判新鲜 → 永久跳过,根因消失也无法自愈)。
        # 改记失败冷却:30 分钟内不重试,之后自动重试直到成功。
        Set-BuildCooldown
        # 2026-09-29 补的正是"上面那句注释声称已有的那一半":Build-Web:721 的注释写着
        # "throw 统一走主流程 catch → Set-BuildCooldown → 告警去重",而这一支只 Log 后
        # Release-DeployLock + exit 1,从未调用 Invoke-FailNotify —— 于是**构建连败对人完全静音**。
        # 当天实测代价:线上停在 34d27084f1,16:17/16:21/16:27/16:32 连撞四轮 next build 失败
        # (红因是别人一份未提交的工作树副本),日志一片响而邮件零封。§5e「失败必须响」在这里没兑现。
        # 走 Fail 而不是另调一次 Send-EmailNotify:Fail 已含 Log + 去重发信 + 释放部署锁 + exit 1,
        # 在这台常年有并行会话的文件里留第二份收口路径就是留第二个真相。
        # 签名稳定性:消息体只含 $_ 的固定措辞("next build 连续 N 次失败…"),不含时间戳/轮次号,
        # 所以按身份去重(4h)生效,不会每轮另发一封(:1381/:1453 那两条同型教训)。
        Fail "构建失败($_) → 保持当前在线版本,不动 web,已记冷却(30 分钟后自动重试)"
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

# ── 成功标记写到"它成立的那一刻"(2026-09-27 从收尾移到此处)────────────────────
# 此刻 .next 逐字节就是 HEAD 的构建(交换已完成),标记说的就是事实。
# 旧位置在门禁 + api/ai-service 重启**之后**(实测中位 +73 秒,门禁挂死时 +45 分钟),所以一次
# 被杀/被回滚前退出的轮次结束时,.next 是一份完整构建却**没有**标记 → 下一轮 Get-BuildStale
# 判"构建非当前提交产物" → 强制整包重建(重建 9 个包 dist + next build)。实测 09-27 两次正是
# 这一型:14:42:15 taskkill → 14:43:27 触发原因=构建新鲜度;17:29:37 taskkill → 17:30:47 同样触发。
# 守住的两条不变量:
#   ① 构建失败在交换**之前**就已 exit 1(见上方 catch 段),失败的构建永远走不到这里 ⇒ 不落标记;
#   ② 门禁未过 → Do-Rollback 用 .rollback 整份副本替换 .next,而 .rollback 自带上一份成功标记
#      (实测两文件同为 bed001c83c…)⇒ 回滚后标记 = 上一个成功 sha,既没消失也没假指 HEAD。
# 如实登记新残余:被杀的轮次现在会留下"标记=HEAD 但健康未经证明"。且**下一轮不会重新走门禁**
# —— behind=0 且 marker==HEAD 会命中主流程那条 `if ($behind -eq 0 -and -not $deployLatest
#    -and -not (Get-BuildStale))` 的"无需部署"跳过判定,整轮不跑。这与旧行为的差别是:
# 旧的要付一次 7–13 分钟整包重建(重建顺带把门禁重跑了一遍),新的不付,代价是那段时间
# 没有人证明过这个构建活着。要闭掉这一格需要第二份 .next/IHUI_INSTALLED_SHA 并把
# Get-BuildStale 拆成"需重建 / 只需重新验证 / 跳过"三态(改上面那条跳过判定),属更大的
# 控制流改动,已作为补丁提案单独登记,未随本票写入。
Set-BuildMarker

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
        # 2026-09-29 补:这一支过去只 Log + exit 0,对到人通道**静音**。而它是用户影响面最大的
        # 一种失败 —— 新构建已经切进 .next 才发现健康不过,又整份退回旧版本(线上短暂跑过一版
        # 未证明健康的东西)。当天实测:门禁那一层同时探着 web/api/llm 与公网图片路径,它一红
        # 而邮件零封,和构建连败那一型是同一个洞(§5e「失败必须响」)。
        # 刻意不调 Fail:Fail 是 exit 1,而上面 :1564 那条登记写明这一支的契约是 exit 0
        # (外壳按退出码记账,换码会改"门禁失败轮"在流水里的形态)。这里只补发信那一件事,
        # 收口路径与退出码逐字不动 —— 只加响,不改流。
        # 签名稳定性同 :1380 那条:文案不含 sha/时间戳/轮次,按身份去重(4h)才会真命中。
        try { Invoke-FailNotify -Stall -m "健康门禁未过,新构建已回滚:旧版本仍在线(30 分钟后自动重试;构建本身成功,是 web/api/llm 门禁判不过)" } catch { Log "ALERT 门禁失败告警发信异常(不影响回滚已成立):$_" }
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
# 标记的唯一写入点已在"交换完成 + Start-Web 之后"(见上一段 Set-BuildMarker 及其注释),此处不再重复写。
# 原收尾写入的语义(2026-09-21 立):只有成功轮才写 marker、失败轮一律不写(旧写法在失败轮
# 也写 → marker=HEAD → 误判新鲜 → 永久跳过,是那一次部署停滞的根因)。移到交换后仍然成立:
# 构建失败在交换前 exit 1、门禁失败走 Do-Rollback 后 exit 0,两条失败路径都**不会**把标记
# 留在 HEAD 上 —— 前者从未写过,后者被 .rollback 自带的旧 sha 覆盖回去。
Write-Host ""
# 注意 `.Trim()` 必须**在 `$(...)` 里面**:写成 `"$(...).Trim()"` 时 PowerShell 把 `.Trim()`
# 当字面量留在字符串里,这行日志会打成 `HEAD=.Trim()` —— 而它正是运维判"线上跑哪一枚"的那一行。
# 全脚本现读只有这一处该形态(`grep -nE '"[^"]*\$\([^"]*\)\.Trim\(\)'` 命中 1),改法:先求值再拼字符串。
# ⚠️ 但"先求值"只是第一层,当场就被实测推翻:改成先求值后 19:02 那轮打的是 `HEAD=`(**空值**)——
#    也就是①那个字面量一直掩着②"这句 git 一个字都没输出"这件事(看着像"只是没 Trim")。
#    **②的成因我还没证出来**(候选:服务身份 PATH 里那台机器级死目录 / 当时 cwd 不在仓库内 /
#    与 :706 同形但被外层重定向吞掉),所以不做归因断言,改成**让它自己说**:调用换成同文件 :706
#    已在用的形态(`& git -C $Root … 2>&1`,不依赖当前目录),再对结果做**形状校验**——拿不到
#    7-40 位十六进制就打印 `未判定(实得:<git 的原文>)`,而不是留一个空的 `HEAD=`。
#    空值与"这一版真没有提交"在账面上长得一模一样,而下一轮日志会直接带出 git 说的是什么。
$deployDoneSha = (& git -C $Root rev-parse --short HEAD 2>&1 | Out-String).Trim()
if ($deployDoneSha -notmatch '^[0-9a-f]{7,40}$') { $deployDoneSha = "未判定(实得:$deployDoneSha)" }
Log "=== 部署完成,HEAD=$deployDoneSha 活跃组=win(8801/8802/8803) ==="
# 成功切流就是"本轮未切流"类告警的**终态**:把这些身份从去重档案里摘掉,下一次再挡按新故障重计。
# 不清这一格,已恢复的故障会按 4h 周期一直寄下去(2026-10-10 现读同一身份 repeatNo=40,而这期间
# 日志里有 92 行"部署完成")。档案读不出时只喊"未清偿 + 原因",绝不把"没清成"写成"已清"。
try {
    $cleared = Clear-AlertStallIdentities -StateFile $AlertNotifyStateFile
    if ($cleared.Ok) {
        if ($cleared.Cleared -gt 0) {
            $shown = @($cleared.Labels | Select-Object -First 3) -join ' ;; '
            Log "ALERT-CLEARED 本轮切流成功,清偿 $($cleared.Cleared) 个切流受阻告警身份(前 3 条:$shown)"
        }
    } else {
        Log "WARN  告警身份未清偿(去重档案判不出:$($cleared.Error))—— 不等于已清,下一轮仍可能重发"
    }
} catch { Log "WARN  告警清偿调用异常(不影响本轮发布):$_" }
Release-DeployLock
if ($script:DbMigrateDegraded) {
    Log "WARN  本轮收尾:DB 迁移未落地(发布按设计继续),状态见 deploy\win\.migrate-alert-state.json;-diagnose 的 [7b] 会复述落后条数"
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
