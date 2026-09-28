# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

#requires -Version 7
# ============================================================================
# Cleanup external junk at the drive root that hosts this repository
# ============================================================================
# Causes (the drive letters below are HISTORICAL; they are resolved at runtime):
#   1. WeChat Pay Merchant API Cert Tool V1.4.exe (Qt app) run at the repo's drive
#      root deploys Qt plugin dirs (platforms/iconengines/imageformats/styles/
#      bearer/translations) + Qt5*.dll + dependency DLLs + CA/cert/WXCertUtil
#   2. pnpm run at that root created .pnpm-store (v11, conflicts with project v3)
#   3. Old certs in <root>\ai_zhs (migrated into <repo>\cert)
#   4. Temp files scattered at that root (tmp/ tmp-test.log tmp_head.ts ...)
#   5. QoderCN IDE venv command wrote an absolute path as a relative one, so a full
#      path chain (c\Users\<name>\.workbuddy\binaries\python\envs\default\) landed
#      at <root>\c (evidence: pyvenv.cfg line 5 command field)
#   6. QoderCN path resolution fallback dir <root>\nonexistent-root
#   7. QoderCN JDK probe cache <root>\.appdata\jdk.md (32-bit hash)
#
# 为什么原先写死盘符必然空转(2026-09-28 实测):本仓原在 G:\,仓库根迁走之后 `G:`
# 在这台机上不存在,而本文件当时全部 47 条目标路径都写死 `G:\` ⇒ 每条 Test-Path 恒
# false ⇒ 每次运行打印 "Nothing to clean" 并 exit 0。账面成功、实为一个都没清,
# 且没有任何一行报错 —— 硬编码路径的失效表现永远是安静(AGENTS §15/§26 同族)。
# 现在:仓库根由 $PSScriptRoot 反推,目标根 = 该根所在驱动器,盘符一律来自解析。
#
# Usage:
#   pwsh -File <repo>\scripts\cleanup-external-junk.ps1              # 默认:预演,零删除
#   pwsh -File <repo>\scripts\cleanup-external-junk.ps1 -DryRun      # 同上(显式)
#   pwsh -File <repo>\scripts\cleanup-external-junk.ps1 -Force       # 真删除通道
#   pwsh -File <repo>\scripts\cleanup-external-junk.ps1 -SelfTest    # 阳性对照:证明
#                                                                    # "列候选"有牙、
#                                                                    # "预演档不删"有牙
#
# Safety:
#   - 预演是默认档;-Force 才开删除,且与 -DryRun 互斥(同时给 ⇒ exit 2,不猜)
#   - 对在册目标的删除出口全文只有一个 Remove-JunkItem,预演档拦在它的第一个判断上,
#     不碰磁盘;"预演只写在某一段里"是本项目记过的事故形态(另一段照样真删了 29.8MB),
#     所以 DIR 与 FILE 两条循环都只能经这一个函数
#   - -SelfTest 另有一条收尾清理通道 Remove-SelfTestProbe,它带前缀守卫、只认自己在
#     TEMP 下创建的探针根,不接受任何在册目标 —— 因此它不构成第二个删除出口
#   - 目标只限"仓库根所在驱动器的第一层条目";落在仓库根之内的一律拒绝
#   - 保护名单整目录不列不删:密钥 / secrets / credentials / backups / BaiduSyncdisk /
#     DevEnv / 仓库自身 / 系统目录(AGENTS §15 check-parent-pollution 同口径)
#   - 量算与删除前先判重解析点:Get-ChildItem -Recurse 会穿过 junction,跟随它就是把
#     真实目标当盘根垃圾删掉(AGENTS §26 实录);重解析点只断链,绝不递归穿透
# ============================================================================

[CmdletBinding()]
param(
    [Alias('y')]
    [switch]$Force,
    [switch]$DryRun,
    [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'

# ---- 模式判定:默认就是预演 ----
if ($Force -and $DryRun) {
    Write-Host '[ABORT] -Force 与 -DryRun 互斥,请只选一个(默认即预演,不带任何参数)。' -ForegroundColor Red
    exit 2
}
if ($SelfTest -and $Force) {
    Write-Host '[ABORT] -SelfTest 只跑预演档,禁止与 -Force 同时给(它会在临时探针根上验证删除出口必须不删)。' -ForegroundColor Red
    exit 2
}
$script:Preview = if ($Force.IsPresent) { $false } else { $true }

# ---- 路径一律按实测推导,不得写死盘符 ----
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $PSCommandPath }
if (-not $ScriptDir -or -not (Test-Path -LiteralPath $ScriptDir)) {
    Write-Host '[UNDERTERMINED] 脚本自身目录解析不到 ⇒ 仓库根无从推导,未判定,不做任何事。' -ForegroundColor Yellow
    exit 2
}
$RepoRoot = Split-Path -Parent $ScriptDir                       # <repo>\scripts 的上一级
$RepoRootFull = [System.IO.Path]::GetFullPath($RepoRoot).TrimEnd('\')
$RootQualifier = Split-Path -Qualifier $RepoRoot               # 例:'D:' —— 来自解析,不是猜
$TargetRoot = $RootQualifier + [System.IO.Path]::DirectorySeparatorChar
$TempResolved = if ($env:TEMP) { $env:TEMP } else { '(未设置)' }
$UserRoot = [Environment]::GetFolderPath('UserProfile')

# ---- Junk dirs to clean (16,按名字声明,盘符运行时推导) ----
$junkDirNames = @(
    'platforms',
    'iconengines',
    'imageformats',
    'styles',
    'bearer',
    'translations',
    'CA',
    'cert',
    'WXCertUtil',
    'rail_user_data',
    '.pnpm-store',
    'tmp',
    'ai_zhs',
    '.appdata',
    'c',
    'nonexistent-root'
)

# ---- Junk files to clean (31,同上) ----
$junkFileNames = @(
    '微信支付商户API证书工具 V1.4.exe',
    'Qt5Core.dll',
    'Qt5Gui.dll',
    'Qt5Network.dll',
    'Qt5Svg.dll',
    'Qt5Widgets.dll',
    'D3Dcompiler_47.dll',
    'libEGL.dll',
    'libGLESv2.dll',
    'opengl32sw.dll',
    'libeay32.dll',
    'ssleay32.dll',
    'libgcc_s_dw2-1.dll',
    'libstdc++-6.dll',
    'libwinpthread-1.dll',
    'msvcp120.dll',
    'msvcr120.dll',
    'quazip.dll',
    'quazip.lib',
    'quazipd.dll',
    'quazipd.lib',
    'zdll.lib',
    'zlib.def',
    'zlib1.dll',
    '.tmp-edit-zhtw.mjs',
    'tmp-test.log',
    'tmp_head.ts',
    'tmp_config_3ee96cf0.py',
    '_tmp_30412_bf90cf4040534367bbe8475beda0ce11',
    '_tmp_31272_784ba32974ff956ab605bf0d3408fda2',
    '_tmp_37636_ebf2f152cb4ebf387c892fa70e2bbd78'
)

# ---- 保护名单:整目录不列不删(名字或路径命中即拒,AGENTS §15/§26 同口径) ----
$PROTECTED_NAME_TOKENS = @(
    '密钥', 'secret', 'secrets', 'credential', 'credentials', 'certs', 'certificates',
    '.pybcrypt', 'backup', 'backups', 'baidusyncdisk', 'devenv', 'system volume information',
    '$recycle.bin', 'windows', 'program files', 'programdata', 'node_modules'
)

function Get-ProtectionReason {
    param([string]$Name, [string]$FullPath, [string]$EvalRoot)
    $n = $Name.ToLowerInvariant()
    foreach ($t in $PROTECTED_NAME_TOKENS) {
        $lt = $t.ToLowerInvariant()
        if ($n -eq $lt -or $n.Contains($lt)) { return "protected-name:$t" }
    }
    $full = [System.IO.Path]::GetFullPath($FullPath).TrimEnd('\')
    if ($full.Equals($RepoRootFull, [StringComparison]::OrdinalIgnoreCase) -or
        $full.StartsWith($RepoRootFull + '\', [StringComparison]::OrdinalIgnoreCase)) {
        return 'inside-repo-root'
    }
    # 只允许本次判定根的第一层条目;等于判定根本身(盘根)一律拒
    if ($full.Equals([System.IO.Path]::GetFullPath($EvalRoot).TrimEnd('\'), [StringComparison]::OrdinalIgnoreCase)) { return 'eval-root-itself' }
    return $null
}

function Get-TreeSizeBytes {
    # 显式栈遍历,遇重解析点即跳过(不跟随 junction);量不到就如实计数
    param([string]$Path)
    $total = [int64]0
    $unreadable = 0
    $stack = New-Object System.Collections.Generic.Stack[string]
    $stack.Push($Path)
    while ($stack.Count -gt 0) {
        $cur = $stack.Pop()
        try {
            foreach ($e in [System.IO.Directory]::GetFileSystemEntries($cur)) {
                try {
                    $attr = [System.IO.File]::GetAttributes($e)
                    if ($attr -band [System.IO.FileAttributes]::ReparsePoint) { continue }
                    if ($attr -band [System.IO.FileAttributes]::Directory) { $stack.Push($e) }
                    else { $total += (New-Object System.IO.FileInfo($e)).Length }
                } catch { $unreadable++ }
            }
        } catch { $unreadable++ }
    }
    return [pscustomobject]@{ Bytes = $total; Unreadable = $unreadable }
}

function Remove-JunkItem {
    param([string]$Kind, [string]$Path, [switch]$IsDirectory, [switch]$IsReparse)
    # ← 全文唯一删除出口。预演档拦在这里的第一条判断,不碰磁盘。
    if ($script:Preview) {
        Write-Host ('  [DRY]  {0}  {1}' -f $Kind, $Path) -ForegroundColor DarkYellow
        return 'dry'
    }
    try {
        if ($IsDirectory) {
            if ($IsReparse) {
                # junction/symlink:只断链,绝不 -Recurse 穿透真实目标(AGENTS §26)
                [System.IO.Directory]::Delete($Path, $false)
            } else {
                Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
            }
        } else {
            Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
        }
        Write-Host ('  [DEL]  {0}  {1}' -f $Kind, $Path) -ForegroundColor Green
        return 'deleted'
    } catch {
        Write-Host ('  [FAIL] {0}  {1} - {2}' -f $Kind, $Path, $_.Exception.Message) -ForegroundColor Red
        return 'failed'
    }
}

function Resolve-Candidates {
    # 判定候选的唯一实现:预演主档与 -SelfTest 都走这里,不得各写一遍。
    # -ExtraDirNames 只给 -SelfTest 用:把"受保护名字"临时当作在册项喂进同一条判据,
    # 好让保护维被端到端证明(在册名单与保护名单今天不相交,否则这一维只能靠谓词空转)。
    param([string]$EvalRoot, [string[]]$ExtraDirNames = @())
    $found = @(); $refused = @()
    foreach ($kind in @('DIR', 'FILE')) {
        $names = if ($kind -eq 'DIR') { @($junkDirNames) + @($ExtraDirNames) } else { $junkFileNames }
        foreach ($n in $names) {
            $p = [System.IO.Path]::Combine($EvalRoot, $n)
            if (-not (Test-Path -LiteralPath $p)) { continue }
            $reason = Get-ProtectionReason -Name $n -FullPath $p -EvalRoot $EvalRoot
            if ($reason) { $refused += [pscustomobject]@{ Kind = $kind; Path = $p; Reason = $reason }; continue }
            $item = Get-Item -LiteralPath $p -Force
            $isDir = $item.PSIsContainer
            $isReparse = ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
            $size = if ($isDir) { Get-TreeSizeBytes -Path $p } else { [pscustomobject]@{ Bytes = $item.Length; Unreadable = 0 } }
            $found += [pscustomobject]@{
                Kind = $kind; Path = $p; Name = $n
                IsDirectory = $isDir; IsReparse = $isReparse
                Bytes = $size.Bytes; Unreadable = $size.Unreadable
            }
        }
    }
    return [pscustomobject]@{ Found = $found; Refused = $refused }
}

function Remove-SelfTestProbe {
    # -SelfTest 的收尾清理:只接受本脚本自己创建的探针根前缀,不接受任何在册目标。
    # 在册目标的删除出口仍然只有一个(Remove-JunkItem),这条通道不为它们服务。
    param([string]$Path)
    $prefix = Join-Path ([System.IO.Path]::GetFullPath($env:TEMP)) 'ihui-cleanup-selftest-'
    $full = [System.IO.Path]::GetFullPath($Path)
    if (-not $full.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Host ('  [GUARD] 拒绝清理非探针路径:{0}' -f $full) -ForegroundColor Red
        return
    }
    if (Test-Path -LiteralPath $full) { Remove-Item -LiteralPath $full -Recurse -Force }
}

function Invoke-SelfTest {
    <#
        阳性对照:证明"列候选"与"预演档真的不删"这两件事是有牙的,而不是恒 0 的尺子。
        探针根落在 TEMP(§15b 批准的临时物落点),用后即删,且只删自己创建的那一个目录。
    #>
    $probe = Join-Path ([System.IO.Path]::GetFullPath($env:TEMP)) ('ihui-cleanup-selftest-' + $PID)
    try {
        Remove-SelfTestProbe -Path $probe
        New-Item -ItemType Directory -Path $probe | Out-Null
        # 1 个在册目录 + 1 个在册文件 + 1 个受保护目录,各带内容以便量体积
        New-Item -ItemType Directory -Path (Join-Path $probe 'tmp') | Out-Null
        Set-Content -LiteralPath (Join-Path $probe 'tmp\inner.txt') -Value 'probe' -Encoding utf8
        Set-Content -LiteralPath (Join-Path $probe 'Qt5Core.dll') -Value 'probe-file' -Encoding utf8
        New-Item -ItemType Directory -Path (Join-Path $probe 'certs') | Out-Null
        Set-Content -LiteralPath (Join-Path $probe 'certs\keep.txt') -Value 'keep' -Encoding utf8

        $r = Resolve-Candidates -EvalRoot $probe -ExtraDirNames @('certs')
        $dirHit = @($r.Found | Where-Object { $_.Kind -eq 'DIR' })
        $fileHit = @($r.Found | Where-Object { $_.Kind -eq 'FILE' })
        $certsRefused = @($r.Refused | Where-Object { $_.Path -like '*\certs' })
        $inRepoRefused = Get-ProtectionReason -Name 'tmp' -FullPath (Join-Path $RepoRootFull 'tmp') -EvalRoot $TargetRoot
        $depthRefused = Get-ProtectionReason -Name 'tmp' -FullPath $TargetRoot -EvalRoot $TargetRoot

        # 预演档必须只打 [DRY]、绝不落刀
        $out = Remove-JunkItem -Kind 'DIR' -Path (Join-Path $probe 'tmp') -IsDirectory
        $stillThere = Test-Path -LiteralPath (Join-Path $probe 'tmp')

        $checks = @(
            @{ N = 'S1 列候选有牙:在册目录必须被列出'; Ok = ($dirHit.Count -eq 1) },
            @{ N = 'S2 列候选有牙:在册文件必须被列出'; Ok = ($fileHit.Count -eq 1) },
            @{ N = 'S3 保护名单:受保护名整目录不列(端到端经 Resolve-Candidates)'; Ok = ($certsRefused.Count -eq 1) },
            @{ N = 'S4 保护名单:certs 内内容仍在(没被顺手删)'; Ok = (Test-Path -LiteralPath (Join-Path $probe 'certs\keep.txt')) },
            @{ N = 'S5 预演档返回 dry 且目标未被删除'; Ok = ($out -eq 'dry' -and $stillThere) },
            @{ N = 'S6 体积量算给出非负字节'; Ok = (($dirHit.Count -eq 1) -and ($dirHit[0].Bytes -ge 0)) },
            @{ N = 'S7 仓库根之内的路径一律拒(inside-repo-root)'; Ok = ($inRepoRefused -eq 'inside-repo-root') },
            @{ N = 'S8 判定根本身(盘根)一律拒(eval-root-itself)'; Ok = ($depthRefused -eq 'eval-root-itself') }
        )
        $bad = 0
        foreach ($c in $checks) {
            if ($c.Ok) { Write-Host ('  [PASS] {0}' -f $c.N) -ForegroundColor Green }
            else { Write-Host ('  [FAIL] {0}' -f $c.N) -ForegroundColor Red; $bad++ }
        }
        Write-Host ('[SELFTEST] 断言 {0} 条,失败 {1} 条,探针根 {2}' -f $checks.Count, $bad, $probe) -ForegroundColor Cyan
        if ($bad -gt 0) { return 2 }
        return 0
    } finally {
        Remove-SelfTestProbe -Path $probe
        Write-Host ('[SELFTEST] 探针根已清理:{0}' -f (-not (Test-Path -LiteralPath $probe))) -ForegroundColor DarkGray
    }
}

# ---- 判定面自证:根不可达 ⇒ 未判定,不得把"看不见"读成"已清理" ----
if ($SelfTest) { exit (Invoke-SelfTest) }

if (-not (Test-Path -LiteralPath $TargetRoot)) {
    Write-Host ''
    Write-Host ("[UNDERTERMINED] 推导出的目标根 {0} 在本机不存在 ⇒ 无法判定,未做任何事。" -f $TargetRoot) -ForegroundColor Yellow
    Write-Host '  这不是"已清理干净";这是这一次判据没有跑起来。请核对仓库实际所在驱动器。' -ForegroundColor Yellow
    exit 2
}

# ---- 阳性对照:同一判据必须认得出确实存在的目录 ----
$controlVisible = Test-Path -LiteralPath $RepoRootFull
$rootEntries = @(Get-ChildItem -LiteralPath $TargetRoot -Force -ErrorAction SilentlyContinue)

# ---- 逐条判定候选(与 -SelfTest 共用 Resolve-Candidates 那一份实现) ----
$res = Resolve-Candidates -EvalRoot $TargetRoot
$candidates = @($res.Found)
$blocked = @($res.Refused)

$dirCandidates = @($candidates | Where-Object { $_.IsDirectory })
$fileCandidates = @($candidates | Where-Object { -not $_.IsDirectory })

Write-Host ''
Write-Host ('======== {0} root junk cleanup ========' -f $RootQualifier) -ForegroundColor Cyan
Write-Host ('[MODE]   {0}' -f $(if ($script:Preview) { 'PREVIEW(预演,本档不删除任何东西)' } else { 'REAL DELETE(-Force 已给出)' })) -ForegroundColor Magenta
Write-Host ('[PATHS]  ScriptDir    = {0}' -f $ScriptDir)
Write-Host ('[PATHS]  RepoRoot     = {0}' -f $RepoRootFull)
Write-Host ('[PATHS]  TargetRoot   = {0}(由 RepoRoot 的驱动器限定符 {1} 推导,未写死盘符)' -f $TargetRoot, $RootQualifier)
Write-Host ('[PATHS]  TEMP (本档)  = {0}  ← 本脚本不在 TEMP 下删除任何东西;此行只如实打印当次解析值' -f $TempResolved)
Write-Host ('[PATHS]  UserProfile  = {0}' -f $UserRoot)
Write-Host ('[SELF-CHECK] 判据对确实存在的 {0} 报存在={1},根目录实枚举 {2} 项 ⇒ 0 命中读作"该形状确实不在",不是读作"尺子坏了"' -f $RepoRootFull, $controlVisible, $rootEntries.Count) -ForegroundColor DarkCyan
Write-Host ('[PROBED] 声明目标 {0} 条(DIR {1} / FILE {2}),命中 {3} 条(DIR {3} / FILE {4}),保护区拒列 {5} 条' -f `
        ($junkDirNames.Count + $junkFileNames.Count), $junkDirNames.Count, $junkFileNames.Count, $dirCandidates.Count, $fileCandidates.Count, $blocked.Count) -ForegroundColor Yellow
if ($blocked.Count -gt 0) {
    foreach ($b in $blocked) { Write-Host ('  [SKIP] {0}  {1}  依据:{2}' -f $b.Kind, $b.Path, $b.Reason) -ForegroundColor DarkGray }
}
if ($candidates.Count -gt 0) {
    $totalBytes = ($candidates | Measure-Object -Property Bytes -Sum).Sum
    Write-Host ''
    Write-Host ('候选清单({0} 项,合计约 {1:N2} MB):' -f $candidates.Count, ($totalBytes / 1MB)) -ForegroundColor Yellow
    foreach ($c in $candidates) {
        $flag = if ($c.IsReparse) { ' <REPARSE:只断链>' } else { '' }
        $un = if ($c.Unreadable -gt 0) { (' (量不到 {0} 项)' -f $c.Unreadable) } else { '' }
        Write-Host ('  [{0}] {1,-9} {2}{3}{4}' -f $c.Kind, ('{0:N2} MB' -f ($c.Bytes / 1MB)), $c.Path, $flag, $un)
    }
}
Write-Host ''

if ($candidates.Count -eq 0) {
    Write-Host ('{0} root 下没有任何在册形状的条目,无需处理。' -f $RootQualifier) -ForegroundColor Green
    # 汇总行刻意写 DEL=0 而不是 "[DEL] 0":动作标记必须是行首唯一的字面量,
    # 否则任何按 "[DEL]" 计数的人都会把汇总行读成一次真删除。
    Write-Host '[SUMMARY] candidates=0 DRY=0 DEL=0 failed=0' -ForegroundColor Cyan
    exit 0
}

# ---- 确认(预演档永远到此为止,不进入确认与删除) ----
if ($script:Preview) {
    Write-Host '[PREVIEW] 预演档到此为止:未进入确认、未调用任何删除。要真删须机主显式给 -Force。' -ForegroundColor Magenta
    Write-Host ('[SUMMARY] candidates={0} DRY={0} DEL=0 failed=0' -f $candidates.Count) -ForegroundColor Cyan
    exit 0
}

$confirm = Read-Host ('Confirm delete {0} dirs + {1} files on {2} root? (type YES to proceed)' -f $dirCandidates.Count, $fileCandidates.Count, $RootQualifier)
if ($confirm -ne 'YES') {
    Write-Host 'Cancelled. Nothing deleted.' -ForegroundColor Red
    exit 1
}

# ---- Execute(两段循环都只经 Remove-JunkItem 这一个出口) ----
$deletedDirs = 0; $deletedFiles = 0; $failed = @()
foreach ($c in $dirCandidates) {
    switch (Remove-JunkItem -Kind 'DIR' -Path $c.Path -IsDirectory -IsReparse:$c.IsReparse) {
        'deleted' { $deletedDirs++ }
        'failed' { $failed += $c.Path }
    }
}
foreach ($c in $fileCandidates) {
    switch (Remove-JunkItem -Kind 'FILE' -Path $c.Path) {
        'deleted' { $deletedFiles++ }
        'failed' { $failed += $c.Path }
    }
}

# ---- Summary ----
Write-Host ''
Write-Host '======== Cleanup complete ========' -ForegroundColor Cyan
Write-Host ('Deleted: {0} dirs + {1} files' -f $deletedDirs, $deletedFiles) -ForegroundColor Green
if ($failed.Count -gt 0) {
    Write-Host ('Failed: {0} items:' -f $failed.Count) -ForegroundColor Red
    foreach ($item in $failed) { Write-Host ('  {0}' -f $item) -ForegroundColor Red }
    Write-Host ''
    Write-Host 'Hint: failed items may be locked or read-only. Close relevant apps and retry.' -ForegroundColor Yellow
    exit 1
} else {
    Write-Host ('All deleted successfully. {0} root junk cleaned.' -f $RootQualifier) -ForegroundColor Green
    Write-Host ''
    Write-Host 'Verify: the root no longer contains Qt plugin dirs / Qt DLLs / cert tool residue.' -ForegroundColor Cyan
    exit 0
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
