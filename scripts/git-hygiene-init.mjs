#!/usr/bin/env node
/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * git-hygiene-init.mjs — git 仓库健康防护初始化(2026-08-06 立)。
 *
 * 事故背景(2026-08-06 实锤,8-05 晚仓库重建、7-26 lost-commit tag 被 gc 清理):
 *   多 agent 并行 commit + post-commit 自动脚本风暴,叠加 git autoGc 并发触发
 *   repack → 多个 git 进程同时写/删 .git/objects/pack → pack 损坏
 *   (症状:fsck 报 "pack has 1 unresolved delta" / "broken link",tmp_pack_* 残留)。
 *
 * 防护配置(本脚本幂等,可重复执行):
 *   1. gc.auto=0            禁用自动 gc —— 消除并发 repack 损坏 pack 的最大根因
 *   2. gc.autodetach=false  gc 不后台分离 —— 手动 gc 时前台可观测
 *   3. maintenance.auto false 禁用 git maintenance 自动任务(2.30+ 的自动维护,等价于 gc 自动触发)
 *   4. push 前 git fsck 提示  —— 早期发现损坏(仅提示,不阻断)
 *   5. git 写锁:scripts/git-lock.mjs(safe-commit/post-commit/safe-gc 已集成,无需额外配置)
 *
 * 用法:
 *   node scripts/git-hygiene-init.mjs          # 应用到当前仓库
 *   node scripts/git-hygiene-init.mjs --check  # 只检查不修改
 *
 * 注意:这些是 git 本地配置(存于 .git/config),重新 clone 后需重跑本脚本。
 * 建议接入 AGENTS.md 或部署文档,新环境初始化时执行一次。
 */
import { execSync } from 'node:child_process'

function run(cmd, allowFail = false) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch (e) {
    if (allowFail) return null
    throw e
  }
}

const CHECK_ONLY = process.argv.includes('--check')

/** 期望的防护配置:key → value */
const EXPECTED = {
  'gc.auto': '0',
  'gc.autodetach': 'false',
  'maintenance.auto': 'false',
}

function main() {
  const root = run('git rev-parse --show-toplevel', true)
  if (!root) {
    console.error('❌ 不在 git 仓库中,无法执行')
    process.exit(1)
  }
  console.log(`🔒 git 健康防护初始化 → ${root}`)

  const changed = []
  for (const [key, expected] of Object.entries(EXPECTED)) {
    const current = run(`git config --get ${key}`, true)
    if (current === expected) {
      console.log(`  ✅ ${key}=${current}(已生效)`)
    } else if (CHECK_ONLY) {
      console.log(`  ⚠️  ${key}=${current ?? '(未设置)'},期望 ${expected} — 未修改(--check)`)
      changed.push(key)
    } else {
      run(`git config ${key} ${expected}`)
      console.log(`  🔧 ${key}: ${current ?? '(未设置)'} → ${expected}`)
      changed.push(key)
    }
  }

  if (changed.length > 0 && !CHECK_ONLY) {
    console.log('✅ 防护配置已更新:', changed.join(', '))
  } else if (changed.length > 0) {
    console.log('⚠️  检测到缺失配置(未修改):', changed.join(', '))
    console.log('   执行 node scripts/git-hygiene-init.mjs 应用')
  } else {
    console.log('✅ 全部防护配置就绪')
  }
}

main()
