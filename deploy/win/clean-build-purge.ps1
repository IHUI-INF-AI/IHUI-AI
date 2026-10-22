# clean-build-purge.ps1 —— 净面回收站后台删除器(2026-10-22 立,去 git 化改造的配套件)
#
# 为什么需要它:净面 node_modules\.pnpm\<pkg>@<hash>_<deps>\node_modules\... 路径远超 260 字符,
# `git worktree remove` 报 `Permission denied`/`Filename too long`,`Remove-Item -Recurse -Force`
# 同样删不净(2026-10-22 08:54 实测);.NET 的递归删(走 `\\?\` 前缀)能删净,但要几分钟 ——
# 这段耗时不能压在部署轮次的收尾上(收尾要尽早放部署锁)。
#
# 于是主脚本只负责把净面**改名**成 `.trash-<ts>`(毫秒级、几乎不会 Permission denied),
# 真正的删除交给这个独立进程:父脚本(ihui-deploy.ps1)退出后它仍继续,机器重启也最多留下一个
# `.trash-*`,由主脚本下次启动时的 Clear-CleanBuildTrash 兜底清理。
#
# 用法:pwsh -NoProfile -ExecutionPolicy Bypass -File clean-build-purge.ps1 -Path <目录>
# 退出码:0 = 目标已不在位;2 = 删除后仍在位(调用方日志已打印,不重试以免叠加)。

param(
    [Parameter(Mandatory = $true)]
    [string]$Path
)

# ── 长路径递归删(与 ihui-deploy.ps1 的 Remove-DirLongPath 同款,刻意自包含) ──
# 必须跳过 reparse point/junction:pnpm 的 @expo\metro-config junction 指向自身,
# 无脑递归会抛「参数错误」而整棵树一棵没删(ihui-deploy.ps1 1077 行段记的同一个坑)。
function Remove-DirLongPath {
    param([string]$Path)
    if (-not $Path) { return }
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    if (-not $item) { return }
    if (-not $item.PSIsContainer) {
        try { [System.IO.File]::Delete($Path) } catch {}
        return
    }
    foreach ($it in @(Get-ChildItem -LiteralPath $Path -Force -ErrorAction SilentlyContinue)) {
        $isLink = ($it.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
        if ($isLink) {
            try { [System.IO.Directory]::Delete($it.FullName, $false) } catch { try { [System.IO.File]::Delete($it.FullName) } catch {} }
        } elseif ($it.PSIsContainer) {
            Remove-DirLongPath $it.FullName
        } else {
            try { [System.IO.File]::Delete($it.FullName) } catch {}
        }
    }
    try { [System.IO.Directory]::Delete($Path, $false) } catch {}
}

if (-not (Test-Path -LiteralPath $Path)) { exit 0 }

# 只删白名单:调用方传进来的必须是"净面回收站"语义(由主脚本命名约束)。
# 这里再加一道硬闸:拒绝删盘根、拒绝删仓库常见根,防止误传参把别处删了。
$norm = $Path.Replace('/', '\').TrimEnd('\')
$forbidden = @('C:\', 'D:\', 'C:\Windows', 'C:\Users', 'C:\Program Files', 'D:\DevEnv', 'D:\DevEnv\ihui-prod', 'D:\IHUI-AI')
foreach ($f in $forbidden) {
    if ($norm -eq $f) { exit 3 }
}
if ($norm -notmatch '\\\.trash-') { exit 3 }

Remove-DirLongPath -Path $norm
if (Test-Path -LiteralPath $norm) { exit 2 }
exit 0
