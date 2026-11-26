// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门:桌面壳 IPC 命令面预算(棘轮)。对标落地 L04 的第一层,2026-11-26 立。
 *
 * 为什么是棘轮而不是"≤20":L04 的 20 键口径来自 Electron 的 preload 暴露面,本仓桌面壳是
 * Tauri,对外的暴露面就是 `#[tauri::command]` 注册的命令面 —— 实测已有 122 枚。直接按 20 判,
 * 上线当天就是恒红门(§12e 明令禁止),所以第一层只锁**增量**:命令数不许比基线多,
 * 减了要回写基线(减是好事,不拦)。
 *
 * 第二层(每枚命令必须有 owner 与用途注释、危险命令走审批)不在本门射程内:它要求改 122 处
 * 源码注释,属独立作业;本门只保证"面不再变宽",这是可机器判定的那部分。
 *
 * 用法:`node scripts/check-ipc-command-budget.mjs [--staged|--worktree]`
 * 退出码:0 = 未超基线;1 = 超基线(点名新增文件);2 = 未判定(基线缺失/取不到判定面)。
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const BASELINE = join(ROOT, 'scripts', 'data', 'ipc-command-baseline.json')
const COMMAND_RE = /#\[tauri::command\]/g
const SRC_GLOB = 'apps/desktop/src-tauri/src'

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
}

function listRustFiles(face) {
  if (face === 'worktree') {
    const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', SRC_GLOB], {
      cwd: ROOT,
      encoding: 'utf8',
    })
    return out.split('\n').filter((line) => line.endsWith('.rs'))
  }
  return git(['ls-tree', '-r', '--name-only', face, '--', SRC_GLOB])
    .split('\n')
    .filter((line) => line.endsWith('.rs'))
}

function readBlob(face, path) {
  if (face === 'worktree') return readFileSync(join(ROOT, path), 'utf8')
  return git(['show', `${face}:${path}`])
}

function main() {
  const argv = process.argv.slice(2)
  const face = argv.includes('--staged') ? 'HEAD' : argv.includes('--worktree') ? 'worktree' : 'HEAD'
  const faceLabel = argv.includes('--staged') ? 'staged(索引)' : face === 'worktree' ? 'worktree' : 'HEAD'

  let baseline
  try {
    baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
  } catch (error) {
    console.error(`IPC-BUDGET-RESULT state=undetermined reason=baseline-unreadable(${error.message})`)
    process.exit(2)
  }

  const perFile = {}
  for (const path of listRustFiles('HEAD')) {
    const source = readBlob('HEAD', path)
    const hits = (source.match(COMMAND_RE) ?? []).length
    if (hits > 0) perFile[path] = hits
  }

  const total = Object.values(perFile).reduce((sum, n) => sum + n, 0)
  if (typeof baseline.total !== 'number') {
    console.error('IPC-BUDGET-RESULT state=undetermined reason=baseline-total-missing')
    process.exit(2)
  }

  const growth = []
  for (const [path, count] of Object.entries(perFile)) {
    const allowed = baseline.perFile?.[path] ?? 0
    if (count > allowed) growth.push(`${path} ${allowed}→${count}`)
  }
  const removed = Object.entries(baseline.perFile ?? {}).filter(([path, allowed]) => (perFile[path] ?? 0) < allowed)

  console.log(`IPC 命令面预算(棘轮) 判定面=${faceLabel} 基线=${baseline.total} 现值=${total}`)
  if (removed.length > 0) {
    console.log(`  · 回收 ${removed.length} 个文件的命令数(减少不拦;建议回写基线: ${removed.map(([p]) => p).join(', ')})`)
  }
  if (growth.length > 0) {
    for (const item of growth) console.log(`  · 超基线 ${item}`)
    console.error(`IPC-BUDGET-RESULT state=red total=${total} baseline=${baseline.total} added=${growth.length}`)
    process.exit(1)
  }
  console.log(`IPC-BUDGET-RESULT state=ok total=${total} baseline=${baseline.total}`)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
