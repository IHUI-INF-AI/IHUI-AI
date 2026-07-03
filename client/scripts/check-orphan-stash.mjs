#!/usr/bin/env node
/**
 * Orphan Stash 守护脚本 (2026-07-04 立)
 *
 * 目的: 检测 git stash list 中是否有 lint-staged 自动备份的 orphan stash,
 *       防止"改完样式后过一天再启动项目就丢失了修改"问题再次发生.
 *
 * 根因背景: lint-staged 默认用 git stash --keep-index 隔离未 staged 修改,
 *   当 eslint/stylelint --fix 改了与未 staged 修改相同的位置时, git stash pop
 *   冲突失败, stash 保留在 stash list 中, 用户无感知. 重启后看到的是
 *   lint-staged 修复后的版本, stash 中的"真正修改"被遗忘, 表现为"丢失修改".
 *   (本项目 stash@{0} 曾含 327 文件、5806 行修改即此问题产物)
 *
 * 防护层级:
 *   1. lint-staged --no-stash (核心修复, 已配置) — 避免 stash 陷阱
 *   2. 本脚本 (dev 启动前置守门) — 兜底检测, 即使 --no-stash 失效也能拦截
 *   3. auto-wip-commit.mjs (定期自动 WIP commit) — 第三层兜底
 *
 * 用法:
 *   node scripts/check-orphan-stash.mjs           # 检测, 有 orphan stash 则阻塞退出
 *   node scripts/check-orphan-stash.mjs --force   # 强制跳过 (不推荐, 仅紧急用)
 *   node scripts/check-orphan-stash.mjs --drop    # 自动 drop 所有 lint-staged backup stash (危险!)
 *
 * 退出码:
 *   0 - 无 orphan stash, 或 --force 跳过
 *   1 - 检测到 orphan stash, 阻塞启动
 */

import { execSync } from 'child_process'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(clientRoot, '..')

const force = process.argv.includes('--force')
const drop = process.argv.includes('--drop')

function runGit(args) {
  try {
    return execSync(`git ${args}`, {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch (e) {
    return ''
  }
}

// 获取 stash list
const stashList = runGit('stash list')
if (!stashList) {
  // 无任何 stash, 安全
  process.exit(0)
}

// 过滤 lint-staged automatic backup stash
const lines = stashList.split('\n').filter(Boolean)
const orphanStashes = lines.filter(line =>
  line.includes('lint-staged automatic backup') ||
  line.includes('lint-staged')
)

if (orphanStashes.length === 0) {
  // 有 stash 但不是 lint-staged 的, 不阻塞 (用户手动 stash 是合理操作)
  console.log(`[OK] stash list 有 ${lines.length} 项, 但无 lint-staged orphan stash`)
  process.exit(0)
}

// 检测到 orphan stash
if (drop) {
  // 危险模式: 自动 drop
  console.warn(`[WARN] --drop 模式: 将删除 ${orphanStashes.length} 个 lint-staged orphan stash`)
  for (const line of orphanStashes) {
    const stashRef = line.split(':')[0] // stash@{0}
    console.log(`  dropping ${stashRef}...`)
    runGit(`stash drop ${stashRef}`)
  }
  console.log('[OK] 所有 lint-staged orphan stash 已删除')
  process.exit(0)
}

if (force) {
  console.warn(`[WARN] --force 跳过 orphan stash 检测, 检测到 ${orphanStashes.length} 个 orphan stash:`)
  for (const line of orphanStashes) {
    console.warn(`  ${line}`)
  }
  process.exit(0)
}

// 阻塞模式
console.error('')
console.error('╔══════════════════════════════════════════════════════════════════════════════╗')
console.error('║  [阻塞] 检测到 lint-staged orphan stash — 您的样式修改可能被锁在 stash 中!  ║')
console.error('║                                                                              ║')
console.error('║  根因: lint-staged 默认 git stash 隔离未 staged 修改, --fix 改同位置时      ║')
console.error('║        stash pop 冲突失败, 修改被锁在 stash, 重启后表现为"丢失修改"          ║')
console.error('╚══════════════════════════════════════════════════════════════════════════════╝')
console.error('')
console.error(`检测到 ${orphanStashes.length} 个 orphan stash:`)
for (const line of orphanStashes) {
  console.error(`  ${line}`)
}

// 显示 stash 内容统计
for (const line of orphanStashes) {
  const stashRef = line.split(':')[0]
  const stat = runGit(`stash show ${stashRef} --stat 2>&1`)
  if (stat) {
    const fileCount = stat.split('\n').filter(Boolean).length
    console.error(`  ${stashRef} 内容: ${fileCount} 个文件`)
  }
}

console.error('')
console.error('恢复方案 (推荐按顺序尝试):')
console.error('')
console.error('  方案 A (最安全): 新建分支保存 stash 内容')
console.error('    git stash branch recovery-stash ' + orphanStashes[0].split(':')[0])
console.error('    # 切到 recovery 分支查看/挑选修改, 完成后 git checkout main')
console.error('')
console.error('  方案 B: 直接 apply 到工作区 (可能与当前未提交修改冲突)')
console.error('    git stash apply ' + orphanStashes[0].split(':')[0])
console.error('    # 解决冲突后: git stash drop ' + orphanStashes[0].split(':')[0])
console.error('')
console.error('  方案 C (跳过检查, 不推荐):')
console.error('    node scripts/check-orphan-stash.mjs --force && npm run dev')
console.error('')
console.error('恢复并验证修改完整后, 再启动 dev server. 切勿在未恢复前启动, 否则可能覆盖 stash.')
console.error('')
process.exit(1)
