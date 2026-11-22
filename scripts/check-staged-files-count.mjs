#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


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
 * 行为(三态,AGENTS.md §0.3):
 * - 真 0:staged 文件数 ≤ 阈值 → exit 0
 * - 真违规:staged 文件数 > 阈值 → exit 1(是否阻断由调用方决定;pre-commit 侧吞掉非零即保持 advisory)
 * - 未判定:git diff --cached 失败(非 git / 一过性失败)→ exit 2 并点名
 * - --max=N:自定义阈值(默认 10)
 * - --quiet:正常时不输出(超过阈值仍输出警告)
 * - HUSKY_SKIP_STAGED_COUNT=1:跳过
 *
 * 集成位置:.husky/pre-commit 第 0 项(lint-staged 之前,最早执行)
 *
 * 用法:
 *   node scripts/check-staged-files-count.mjs                 (默认阈值 10)
 *   node scripts/check-staged-files-count.mjs --max=20        (自定义阈值)
 *   node scripts/check-staged-files-count.mjs --quiet         (正常时不输出)
 *   HUSKY_SKIP_STAGED_COUNT=1 git commit ...                  (紧急跳过)
 */
import { execSync } from 'node:child_process'

const args = process.argv.slice(2)
const skip = process.env.HUSKY_SKIP_STAGED_COUNT === '1'
const quiet = args.includes('--quiet')
const maxArg = args.find((a) => a.startsWith('--max='))
const max = maxArg ? Number.parseInt(maxArg.slice(6), 10) : 10

if (skip) process.exit(0)

let staged = []
try {
  const out = execSync('git diff --cached --name-only', {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
    cwd: process.cwd(),
      windowsHide: true,
    })
  staged = out.split('\n').filter(Boolean)
} catch (e) {
  // git 命令失败(非 git 环境 / 一过性失败)⇒ 取不到输入,未判定,不得报绿
  console.error(
    `❌ check-staged-files-count: 取不到 git 暂存区(git diff --cached 失败)—— 未判定(exit 2):${e?.message ?? e}`,
  )
  process.exit(2)
}

if (staged.length === 0) {
  // 暂存区为空:真 0(计数门无违规),不是"扫描面取不到"
  if (!quiet) console.log('✅ staged 文件数 0 ≤ 阈值(暂存区为空)')
  process.exit(0)
}

if (staged.length > max) {
  console.error(`⚠️  staged 文件数 ${staged.length} > 阈值 ${max},可能存在污染事故:`)
  console.error(staged.slice(0, 20).map((f) => `   ${f}`).join('\n'))
  if (staged.length > 20) console.error(`   ... 还有 ${staged.length - 20} 个`)
  console.error(
    `   如确认全部为本任务文件,可用 --max=${staged.length} 或 HUSKY_SKIP_STAGED_COUNT=1 跳过`,
  )
  // 真违规 ⇒ exit 1;是否阻断由调用方决定(pre-commit 侧吞非零 = advisory)
  process.exit(1)
}

if (!quiet) {
  console.log(`✅ staged 文件数 ${staged.length} ≤ 阈值 ${max}(正常)`)
}

process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
