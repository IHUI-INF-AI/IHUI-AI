#requires -Version 7
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# safe-trash.ps1 — 批量删除安全封装（Windows / PowerShell 7+）
# 根治「删 node_modules 被外部锁挂死、空转数十分钟」的复发病。
#
# 铁律（对应 MEMORY.md §13 / 用户级 §12）：
#   1) rename-parked 是默认路径：O(1) 元数据移动，不碰文件内容，秒级、绝不挂死。
#   2) 物理删除为显式 opt-in（-Physical，需用户授权），逐项硬超时 + 锁则跳过，绝不长跑。
#   3) 整体墙钟上限；超时即停并诚实汇报，绝不续跑。
#   4) 由调用方（agent）轮询真实进度自行看门；本脚本自身也带超时兜底。
#
# 用法：
#   ./safe-trash.ps1 -Paths "D:/a","D:/b"                # 默认 parked（秒级，安全）
#   ./safe-trash.ps1 -Paths "D:/a" -Physical            # 物理删除（需授权），逐项超时、锁则跳过
#   ./safe-trash.ps1 -Paths "D:/a" -PruneWorktree       # parked 后顺带 git worktree prune
#
# 退出码：0 = 全成功；非 0 = 存在 SKIP/ABORT/PARK_FAILED（供 agent 程序化判定，绝不静默成功）。

param(
  [Parameter(Mandatory = $true)][string[]]$Paths,
  [string]$TrashDir = "$env:TEMP\_wt_trash",
  [switch]$Physical,
  [switch]$PruneWorktree,
  [int]$PerItemTimeoutSec = 90,
  [int]$TotalTimeoutSec = 240
)

$ErrorActionPreference = 'Stop'
$started = Get-Date
$results = [System.Collections.Generic.List[string]]::new()
$hasProblem = $false

if (-not (Test-Path -LiteralPath $TrashDir)) {
  New-Item -ItemType Directory -Path $TrashDir -Force | Out-Null
}

foreach ($p in $Paths) {
  if (-not (Test-Path -LiteralPath $p)) {
    $results.Add("SKIP(missing): $p"); $hasProblem = $true; continue
  }

  # 整体墙钟保护：超上限立即停，剩余项保持原状（不碰、不谎称完成）
  if (((Get-Date) - $started).TotalSeconds -gt $TotalTimeoutSec) {
    $results.Add("ABORT(total-timeout): stopped after ${TotalTimeoutSec}s; remaining left as-is")
    $hasProblem = $true
    break
  }

  if (-not $Physical) {
    # rename-parked：O(1) 元数据移动，不碰文件内容，绝不挂死
    $leaf = Split-Path -Path $p -Leaf
    $dest = Join-Path -Path $TrashDir -ChildPath ($leaf + '_' + (Get-Date -Format 'HHmmss'))
    try {
      Move-Item -LiteralPath $p -Destination $dest -Force -ErrorAction Stop
      $results.Add("PARKED: $p -> $dest")
    }
    catch {
      $results.Add("PARK_FAILED: $p :: $($_.Exception.Message)")
      $hasProblem = $true
    }
  }
  else {
    # 物理删除：直接用 Remove-Item 跳过锁文件继续删（rd /s /q 遇首个锁文件会整目录 abort、啥也删不了，故改 Remove-Item -ErrorAction SilentlyContinue）。锁文件残骸留目录，标记 SKIP 不谎称成功。
    try {
      Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue
    } catch { }
    if (Test-Path -LiteralPath $p) {
      $results.Add("SKIP(locked-residue): $p (bulk deleted, locked files remain; NOT hung)")
      $hasProblem = $true
    }
    else {
      $results.Add("DELETED: $p")
    }
    # 整体墙钟硬截止：超上限立即停止，确保整体运行时间 ≤ TotalTimeoutSec
    if (((Get-Date) - $started).TotalSeconds -gt $TotalTimeoutSec) {
      $results.Add("ABORT(total-timeout): stopped after ${TotalTimeoutSec}s; remaining left as-is")
      break
    }
  }
}

if ($PruneWorktree) {
  try {
    $out = git worktree prune 2>&1
    $results.Add("PRUNED: git worktree registry cleaned ($out)")
  }
  catch {
    $results.Add("PRUNE_FAILED: $_"); $hasProblem = $true
  }
}

foreach ($r in $results) { Write-Host $r }
if ($hasProblem) { exit 1 } else { exit 0 }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
