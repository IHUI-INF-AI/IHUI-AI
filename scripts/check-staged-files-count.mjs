#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * Pre-commit 守门:staged 文件数预检(2026-07-30 立)。
 *
 * 背景:多 agent 并行 + IDE 自动 stage / lint-staged 副作用曾导致 commit 包含
 *       非本任务文件的事故(2026-07-30 真实案例:agent 只 add 1 个文件,commit 时
 *       实际包含 8 个文件,污染了 7 个其他 agent 改的 M 文件,post-commit 钩子
 *       自动 push 了污染 commit 到 origin)。现有 staging-snapshot 机制在 hook
 *       退出前自动 unstage 新增文件,但缺少"显式文件数预检"作为快速告警信号。
 *
 * 行为:
 * - 默认:staged 文件数 > 10 时打印警告到 stderr,exit 0(不阻断)
 * - --strict:超过阈值时 exit 1(阻断 commit)
 * - --max=N:自定义阈值(默认 10)
 * - --quiet:正常时不输出(超过阈值仍输出警告)
 * - HUSKY_SKIP_STAGED_COUNT=1:跳过
 *
 * 集成位置:.husky/pre-commit 第 0 项(lint-staged 之前,最早执行)
 *
 * 用法:
 *   node scripts/check-staged-files-count.mjs                 (默认阈值 10, warn-only)
 *   node scripts/check-staged-files-count.mjs --max=20        (自定义阈值)
 *   node scripts/check-staged-files-count.mjs --strict        (超过阈值阻断)
 *   node scripts/check-staged-files-count.mjs --quiet         (正常时不输出)
 *   HUSKY_SKIP_STAGED_COUNT=1 git commit ...                  (紧急跳过)
 */
import { execSync } from 'node:child_process'

const args = process.argv.slice(2)
const skip = process.env.HUSKY_SKIP_STAGED_COUNT === '1'
const strict = args.includes('--strict')
const quiet = args.includes('--quiet')
const maxArg = args.find((a) => a.startsWith('--max='))
const max = maxArg ? Number.parseInt(maxArg.slice(6), 10) : 10

if (skip) process.exit(0)

let staged = []
try {
  const out = execSync('git diff --cached --name-only', {
    encoding: 'utf-8',
    cwd: process.cwd(),
  })
  staged = out.split('\n').filter(Boolean)
} catch {
  // git 命令失败(非 git 环境),不阻塞 commit
  process.exit(0)
}

if (staged.length === 0) process.exit(0)

if (staged.length > max) {
  console.error(`⚠️  staged 文件数 ${staged.length} > 阈值 ${max},可能存在污染事故:`)
  console.error(staged.slice(0, 20).map((f) => `   ${f}`).join('\n'))
  if (staged.length > 20) console.error(`   ... 还有 ${staged.length - 20} 个`)
  console.error(
    `   如确认全部为本任务文件,可用 --max=${staged.length} 或 HUSKY_SKIP_STAGED_COUNT=1 跳过`,
  )
  if (strict) process.exit(1)
} else if (!quiet) {
  console.log(`✅ staged 文件数 ${staged.length} ≤ 阈值 ${max}(正常)`)
}

process.exit(0)
