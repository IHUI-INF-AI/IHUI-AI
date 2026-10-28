# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# clean-build-purge.ps1 —— 净面回收站后台删除器(2026-10-22 立,去 git 化改造的配套件)
#
# 为什么需要它:净面 node_modules\.pnpm\<pkg>@<hash>_<deps>\node_modules\... 路径远超 260 字符,
# `git worktree remove` 报 `Permission denied`/`Filename too long`,`Remove-Item -Recurse -Force`
# 同样删不净(2026-10-22 两次实测);.NET 的递归删(走 `\\?\` 前缀)能删净,但要几分钟 ——
# 这段耗时不能压在部署轮次的收尾上(收尾要尽早放部署锁)。
#
# 于是主脚本只负责把净面**改名**成 `.trash-<ts>`(毫秒级),真正的删除交给这个独立进程:
# 父脚本退出后它仍继续,机器重启也最多留下一个 `.trash-*`,由主脚本下次启动时的
# Clear-CleanBuildTrash 兜底清理。
#
# 2026-10-22 13:24 实测补丁一:改名本身也可能失败(`Rename-Item` 报 `because it is in use` ——
# 重命名要求**整棵目录树**没有任何打开句柄,而删除单个文件只要**该文件**无锁,宽容度天差地别)。
# 所以主脚本在改名失败时也走本进程,只是不改名、直接删原路径(`-AllowPlain` 放行)。
#
# 2026-10-22 13:35 实测补丁二:删到一半撞上**还被占用**的文件,`[File]::Delete` 抛异常被
# catch 吞掉后就**再也不回来** —— 那一棵文件永久留在盘上(实测 50 个文件里 1 个被占 ⇒ 整目录删不掉)。
# 删除现在把失败项收进重试表,按 3 秒间隔轮询到句柄释放,预算 120 秒(生产实测构建刚结束时
# node/pnpm 句柄能持续 20s 以上,所以启动延迟也给到 15 秒)。
#
# 用法:pwsh -NoProfile -ExecutionPolicy Bypass -File clean-build-purge.ps1 -Path <目录> [-DelaySeconds 15] [-AllowPlain]
# 退出码:0 = 目标已不在位;2 = 删除后仍在位(重试预算耗尽);3 = 路径未通过安全闸(拒绝删)。

param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [int]$DelaySeconds = 15,
    [switch]$AllowPlain
)

# ── 安全闸:只删净面专用根下的东西 ──
# 调用方(ihui-deploy.ps1)传进来的路径必须严格落在净面授权根之下,且不是根本身。
# 这里不依赖调用方守约 —— 误传参把别处删了是不可逆的,所以自己再判一遍。
$Root0 = 'D:\DevEnv\ihui-deploy-build'
$norm = $Path.Replace('/', '\').TrimEnd('\')
if ($norm -notlike ($Root0 + '\*')) { exit 3 }
if ($norm -eq $Root0) { exit 3 }
if (-not $AllowPlain -and $norm -notmatch '\\\.trash-') { exit 3 }
if ($DelaySeconds -gt 0) { Start-Sleep -Seconds $DelaySeconds }

$script:Retry = New-Object System.Collections.Generic.List[string]

# ── 长路径递归删 ──
# 必须跳过 reparse point/junction:pnpm 的 @expo\metro-config junction 指向自身,
# 无脑递归会抛「参数错误」而整棵树一棵没删(ihui-deploy.ps1 1088 行段记的同一个坑)。
# 删不动的项进 $script:Retry,由末尾的重试循环等句柄释放后再来,绝不静默留下。
function Remove-DirLongPath {
    param([string]$Path)
    if (-not $Path) { return }
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    if (-not $item) { return }
    if (-not $item.PSIsContainer) {
        try { [System.IO.File]::Delete($Path) } catch { $script:Retry.Add($Path) }
        return
    }
    foreach ($it in @(Get-ChildItem -LiteralPath $Path -Force -ErrorAction SilentlyContinue)) {
        $isLink = ($it.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
        if ($isLink) {
            try { [System.IO.Directory]::Delete($it.FullName, $false) } catch { try { [System.IO.File]::Delete($it.FullName) } catch { $script:Retry.Add($it.FullName) } }
        } elseif ($it.PSIsContainer) {
            Remove-DirLongPath $it.FullName
        } else {
            try { [System.IO.File]::Delete($it.FullName) } catch { $script:Retry.Add($it.FullName) }
        }
    }
    try { [System.IO.Directory]::Delete($Path, $false) } catch { $script:Retry.Add($Path) }
}

if (-not (Test-Path -LiteralPath $norm)) { exit 0 }
Remove-DirLongPath -Path $norm

# ── 重试循环:等句柄释放 ──
$deadline = (Get-Date).AddSeconds(120)
while (($script:Retry.Count -gt 0) -and ((Get-Date) -lt $deadline)) {
    Start-Sleep -Seconds 3
    $pend = @($script:Retry)
    $script:Retry.Clear()
    foreach ($p in $pend) {
        if (Test-Path -LiteralPath $p) { Remove-DirLongPath -Path $p }
    }
}

if (Test-Path -LiteralPath $norm) { exit 2 }
exit 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
