#!/usr/bin/env node
/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * safe-gc.mjs — 带锁的手动 git gc(2026-08-06 立)。
 *
 * 背景:autoGc 并发 repack 是 .git 损坏主因(8-06 实锤),已通过 gc.auto=0 禁用自动触发。
 * 但手动 git gc 若与其他 agent 的写操作并发,同样可能损坏 pack。
 * 本脚本:获取 git 写锁后执行 gc,杜绝 gc 与任何 git 写操作并发。
 *
 * 用法:
 *   node scripts/safe-gc.mjs                # 带锁执行 git gc(默认 --prune=now --aggressive)
 *   node scripts/safe-gc.mjs --dry-run      # 只检查锁,不执行
 *   IHUI_GIT_NO_GC=1 环境变量可完全禁用 gc(可选策略)
 *
 * 注意:gc 前建议确认无其他 agent 正在写(锁会排队等待,超时则放弃)。
 */
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

function run(cmd, allowFail = false) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

const DRY_RUN = process.argv.includes('--dry-run')

function main() {
  if (process.env.IHUI_GIT_NO_GC === '1') {
    console.log('⏭  IHUI_GIT_NO_GC=1,gc 已禁用')
    return
  }
  const repoRoot = run('git rev-parse --show-toplevel', true)
  if (!repoRoot) {
    console.error('❌ 不在 git 仓库中')
    process.exit(1)
  }
  // 锁文件存在即说明有其他写操作
  const lockPath = join(repoRoot, '.git', 'ihui-git-write.lock')
  if (existsSync(lockPath)) {
    console.log('⏭  检测到 git 写锁,跳过 gc(有其他写操作进行中)')
    return
  }
  if (DRY_RUN) {
    console.log('✅ 无写锁,gc 可安全执行(--dry-run 未执行)')
    return
  }
  const unit = `safe-gc-${process.pid}-${Date.now()}`
  try {
    run(`node ${repoRoot}/scripts/git-lock.mjs acquire --unit ${unit} --timeout 60000`)
    console.log('🔒 已获取写锁,执行 git gc(可能耗时,请勿并行 git 操作)')
    const out = run('git gc --prune=now', true) ?? ''
    console.log(out || '✅ git gc 完成')
  } finally {
    run(`node ${repoRoot}/scripts/git-lock.mjs release --unit ${unit}`, true)
  }
}

main()
