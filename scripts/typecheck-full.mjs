#!/usr/bin/env node
/**
 * 全量 TypeScript 类型检查脚本
 *
 * 用途：清除所有 .tsbuildinfo 增量缓存后强制全量 typecheck，
 *       防止增量缓存掩盖预存在错误（项目曾因 .tsbuildinfo 陈旧导致错误被掩盖）。
 *
 * 触发场景：
 *   - CI 定期全量检查（建议每周或发版前运行）
 *   - 手动怀疑缓存陈旧时运行
 *   - 升级 TypeScript / 调整 tsconfig.json 后运行
 *
 * 用法：pnpm typecheck:full
 */

import { readdirSync, statSync, rmSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')

const EXCLUDE_DIRS = new Set(['node_modules', '.next', '.turbo', '.git', '.pnpm-store', '.pnpm-cache'])

/**
 * 递归查找并删除所有 .tsbuildinfo 文件（排除依赖与构建缓存目录）。
 * @param {string} dir 当前扫描目录
 * @param {string[]} removed 已删除文件路径收集
 * @returns {string[]} 已删除文件路径列表
 */
function cleanTsbuildinfo(dir, removed = []) {
  let entries = []
  try {
    entries = readdirSync(dir)
  } catch {
    return removed
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry)) continue
      cleanTsbuildinfo(full, removed)
    } else if (entry.endsWith('.tsbuildinfo')) {
      try {
        rmSync(full, { force: true })
        removed.push(full)
      } catch {
        /* 忽略删除失败（可能是 .next/cache 内的只读文件） */
      }
    }
  }
  return removed
}

console.log('[typecheck:full] 清除 .tsbuildinfo 增量缓存...')
const removed = cleanTsbuildinfo(ROOT)
if (removed.length === 0) {
  console.log('[typecheck:full] 未发现 .tsbuildinfo 文件，直接全量检查。')
} else {
  console.log(`[typecheck:full] 已删除 ${removed.length} 个 .tsbuildinfo 文件：`)
  for (const f of removed) {
    console.log(`  - ${f.replace(ROOT, '.')}`)
  }
}

console.log('\n[typecheck:full] 运行 pnpm -r run typecheck（串行，避免 turbo 多进程竞态）...')
// 使用 pnpm -r 递归串行运行，避免 turbo 并行/串行时的 .tsbuildinfo 与内存竞态
const result = spawnSync('pnpm -r run typecheck', {
  cwd: ROOT,
  stdio: 'inherit',
  shell: true,
})

if (result.status !== 0) {
  console.error(`\n[typecheck:full] 失败，退出码 ${result.status}`)
  process.exit(result.status ?? 1)
}

// ─── Phase 2:mypy 阻断门(2026-07-26 立, AGENTS_history 见 mypy-blocking 段) ──
// 背景:apps/ai-service 是核心 AI 服务(FastAPI + LangGraph + LiteLLM),
//       Python 类型错误长期无 CI 捕获,mypy 仅作 informational 提示。
// 升级:把 mypy 错误从 informational 升级为 blocking,mypy 退出码 != 0
//       立即终止 typecheck:full,pre-push 钩子相应阻止 push。
//
// 渐进式策略(避免一次性 strict=true 把整个 CI 阻塞在 1000+ 既有错误上):
//   - 阶段一(本任务):strict=false + check_untyped_defs=true
//     捕获基础类型错误(name-defined / no-any-return / unused-ignore 等),
//     允许现有无类型注解的代码继续编译。
//   - 阶段二(follow-up):按模块逐个 enable strict_optional / disallow_untyped_defs /
//     warn_return_any 等严格项,每启用一项就要求该模块所有错误清零。
//   - 阶段三(目标态):全部 strict=true,所有 [no-untyped-def] / [no-any-return] 错误清零。
//
// 当前基线(2026-07-26):~1400 既有错误(分布在 ~85 文件,主要为 no-untyped-call /
//   no-untyped-def / type-arg 等),由 follow-up 任务逐文件修复。
//
// 跳过:HUSKY_SKIP_MYPY=1(紧急 push 时使用,但建议修复后正常 push)。
const aiServiceDir = resolve(ROOT, 'apps/ai-service')
if (existsSync(aiServiceDir)) {
  if (process.env.HUSKY_SKIP_MYPY === '1') {
    console.log(
      '\n[typecheck:full] ⚠️  HUSKY_SKIP_MYPY=1 — 已跳过 mypy 阻断门(不推荐, Python 类型错误不会阻塞 push)',
    )
  } else {
    console.log('\n[typecheck:full] 运行 apps/ai-service mypy (blocking)...')
    const mypyResult = spawnSync('mypy', ['app/'], {
      cwd: aiServiceDir,
      stdio: 'inherit',
      shell: true,
    })

    if (mypyResult.status !== 0) {
      console.error(
        `\n[typecheck:full] ❌ mypy 失败(exit ${mypyResult.status ?? 'unknown'}),Python 类型错误需修复`,
      )
      console.error(
        '[typecheck:full]    详细配置:见 apps/ai-service/pyproject.toml [tool.mypy] 段注释',
      )
      console.error(
        '[typecheck:full]    既有错误清单(基线):见 commit message "mypy 升级 blocking 基线" 段',
      )
      console.error(
        '[typecheck:full]    跳过(不推荐):HUSKY_SKIP_MYPY=1 pnpm typecheck:full',
      )
      process.exit(mypyResult.status ?? 1)
    }
    console.log('[typecheck:full] ✅ mypy 通过(无 Python 类型错误)')
  }
} else {
  console.log('\n[typecheck:full] 未发现 apps/ai-service 目录,跳过 mypy 阶段')
}

console.log('\n[typecheck:full] 全量类型检查通过(TS + mypy)。')
