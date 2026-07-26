#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * check-commit-scope-consistency.mjs — commit message scope 与 staged 文件领域一致性守门
 *
 * 背景(2026-07-26 立,真实事故):
 *   多 agent 并行开发同一 main 分支时,某 agent 用 `git add -A` 把其他 agent 的改动
 *   一起 commit,导致"污染事故"(AGENTS.md §16)。典型案例:commit `c3c864131` message
 *   是 `feat(seo): IndexNow key 文件`,但 staged 文件包含 `packages/i18n/` 改动 +
 *   `apps/web/verify-*.mjs` 删除 + 4 个 i18n 测试文件,明显是 i18n 任务被混入 seo commit。
 *
 * 现有工具 gap:
 *   - check-staged-pollution.mjs: 只检测"跨 ≥4 目录",阈值太高,seo+i18n+web 只有 3 个目录不触发
 *   - guard-push-other-agent-changes.mjs: 白名单模式,需手动传入本任务文件清单
 *   - 两者都不检查 commit message scope 与 staged 文件领域的一致性
 *
 * 检测逻辑:
 *   1. 从 commit-msg hook 的 $1 参数读取 commit message 文件
 *   2. 解析 `<type>(<scope>): <subject>` 格式,提取 scope
 *   3. 读取 staged 文件清单(git diff --cached --name-only)
 *   4. 根据文件路径推断"业务领域"集合
 *   5. 如果领域集合 size ≥ 2,且 scope 不在领域集合中,且 scope 不在白名单 → 警告
 *
 * 领域映射(文件路径 → 领域):
 *   packages/i18n/**           → i18n
 *   apps/web/**                → web
 *   apps/api/**                → api
 *   apps/ai-service/**         → ai-service
 *   apps/extension/**          → extension
 *   apps/miniapp-taro/**       → miniapp-taro
 *   apps/mobile-rn/**          → mobile-rn
 *   apps/desktop/**            → desktop
 *   apps/cli/**                → cli
 *   packages/database/**       → database
 *   packages/auth/**           → auth
 *   packages/ui/**             → ui
 *   packages/ui-react/**       → ui-react
 *   packages/shared/**         → shared
 *   packages/api-client/**     → api-client
 *   packages/design-tokens/**  → design-tokens
 *   scripts/**                 → scripts
 *   .github/**                 → ci
 *   docs/**                    → docs
 *
 * 白名单 scope(不直接对应文件领域,但合法,跳过检查):
 *   seo, security, deps, chore, config, ci, build, release, deps, hotfix
 *
 * 退出码: 始终 0 (warn-only, 不阻塞 commit)
 *   紧急跳过: HUSKY_SKIP_SCOPE_CHECK=1
 *
 * 用法:
 *   node scripts/check-commit-scope-consistency.mjs <commit-msg-file>
 *   HUSKY_SKIP_SCOPE_CHECK=1 git commit -m "..."
 *
 * 集成位置: .husky/commit-msg
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

// ─── 豁免检查 ───────────────────────────────────────────────
if (process.env.HUSKY_SKIP_SCOPE_CHECK === '1') {
  console.log('⏭  HUSKY_SKIP_SCOPE_CHECK=1 — 跳过 commit scope 一致性检查')
  process.exit(0)
}

// ─── 配置:文件路径 → 领域映射 ──────────────────────────────
const PATH_TO_AREA = [
  // 顺序重要:更具体的路径优先匹配
  { prefix: 'packages/i18n/', area: 'i18n' },
  { prefix: 'packages/database/', area: 'database' },
  { prefix: 'packages/auth/', area: 'auth' },
  { prefix: 'packages/ui-react/', area: 'ui-react' },
  { prefix: 'packages/ui/', area: 'ui' },
  { prefix: 'packages/shared/', area: 'shared' },
  { prefix: 'packages/api-client/', area: 'api-client' },
  { prefix: 'packages/design-tokens/', area: 'design-tokens' },
  { prefix: 'apps/web/', area: 'web' },
  { prefix: 'apps/api/', area: 'api' },
  { prefix: 'apps/ai-service/', area: 'ai-service' },
  { prefix: 'apps/extension/', area: 'extension' },
  { prefix: 'apps/miniapp-taro/', area: 'miniapp-taro' },
  { prefix: 'apps/mobile-rn/', area: 'mobile-rn' },
  { prefix: 'apps/desktop/', area: 'desktop' },
  { prefix: 'apps/cli/', area: 'cli' },
  { prefix: 'scripts/', area: 'scripts' },
  { prefix: '.github/', area: 'ci' },
  { prefix: 'docs/', area: 'docs' },
]

// ─── 配置:白名单 scope(不直接对应文件领域,但合法) ──────────
const WHITELIST_SCOPES = new Set([
  'seo',
  'security',
  'deps',
  'chore',
  'config',
  'ci',
  'build',
  'release',
  'hotfix',
  'monorepo',
  'infra',
])

// ─── 工具函数 ─────────────────────────────────────────────

/**
 * 从文件路径推断业务领域
 * @param {string} file - 相对路径(正斜杠)
 * @returns {string|null} 领域名,未匹配返回 null
 */
export function inferArea(file) {
  const normalized = file.replace(/\\/g, '/')
  for (const { prefix, area } of PATH_TO_AREA) {
    if (normalized.startsWith(prefix)) return area
  }
  // 根目录 .md 文件归 docs
  if (/^[^/]+\.md$/.test(normalized)) return 'docs'
  // 根目录配置文件归 config
  if (/^[^/]+\.(json|yml|yaml|toml)$/.test(normalized)) return 'config'
  return null
}

/**
 * 解析 commit message,提取 type 和 scope
 * 支持格式: <type>(<scope>): <subject>  或  <type>: <subject>
 * @param {string} message - commit message 文本(可含多行,取第一行)
 * @returns {{type: string|null, scope: string|null, subject: string|null}}
 */
export function parseCommitMessage(message) {
  if (!message) return { type: null, scope: null, subject: null }
  // 取第一行,去掉注释行(git commit 模板可能含 # 开头注释)
  const lines = message.split('\n')
  const firstLine = lines.find((l) => l.trim() && !l.trim().startsWith('#')) || ''
  // 匹配 <type>(<scope>): <subject>  或  <type>: <subject>
  const match = firstLine.match(/^([a-z]+)(?:\(([^)]+)\))?:\s*(.+)$/)
  if (!match) return { type: null, scope: null, subject: null }
  return {
    type: match[1],
    scope: match[2] || null,
    subject: match[3],
  }
}

/**
 * 获取 staged 文件清单
 * @returns {string[]} 相对路径数组
 */
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACDMR', {
      encoding: 'utf8',
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return output
      .split('\n')
      .filter(Boolean)
      .map((f) => f.replace(/\\/g, '/'))
  } catch {
    return []
  }
}

// ─── 主逻辑 ───────────────────────────────────────────────

function main() {
  // 1. 读取 commit message 文件
  const commitMsgFile = process.argv[2]
  if (!commitMsgFile) {
    console.log(`${C.dim}⏭  commit scope 一致性检查(无 commit message 文件参数, 跳过)${C.reset}`)
    process.exit(0)
  }

  let message
  try {
    message = readFileSync(commitMsgFile, 'utf8')
  } catch {
    console.log(`${C.dim}⏭  commit scope 一致性检查(无法读取 commit message 文件, 跳过)${C.reset}`)
    process.exit(0)
  }

  // 2. 解析 commit message
  const { scope } = parseCommitMessage(message)

  // 无 scope → 跳过(不强制要求 scope)
  if (!scope) {
    console.log(`${C.dim}⏭  commit scope 一致性检查(无 scope, 跳过)${C.reset}`)
    process.exit(0)
  }

  // scope 在白名单 → 跳过(seo/security/deps 等不直接对应文件领域)
  if (WHITELIST_SCOPES.has(scope)) {
    console.log(`${C.dim}⏭  commit scope 一致性检查(scope "${scope}" 在白名单, 跳过)${C.reset}`)
    process.exit(0)
  }

  // 3. 读取 staged 文件清单
  const staged = getStagedFiles()
  if (staged.length === 0) {
    console.log(`${C.dim}⏭  commit scope 一致性检查(无 staged 文件, 跳过)${C.reset}`)
    process.exit(0)
  }

  // 4. 推断 staged 文件涉及的领域集合
  const areas = new Map() // area → fileCount
  for (const file of staged) {
    const area = inferArea(file)
    if (area) {
      areas.set(area, (areas.get(area) || 0) + 1)
    }
  }

  const areaSet = new Set(areas.keys())

  // 5. 一致性检查
  // 如果领域集合 size ≥ 2,且 scope 不在领域集合中 → 警告
  if (areaSet.size >= 2 && !areaSet.has(scope)) {
    console.log('')
    console.log(
      `${C.yellow}${C.bold}⚠️  Commit scope 一致性预警 (warn-only, 不阻塞)${C.reset}`,
    )
    console.log(
      `${C.dim}依据: 多 agent 并行时 git add -A 可能混入其他 agent 改动(AGENTS.md §16)${C.reset}`,
    )
    console.log('')
    console.log(
      `${C.yellow}commit message scope "${C.bold}${scope}${C.reset}${C.yellow}" 与 staged 文件领域不匹配${C.reset}`,
    )
    console.log(`${C.bold}Staged 文件领域分布:${C.reset}`)
    for (const [area, count] of areas.entries()) {
      const marker = area === scope ? '✓' : ' '
      console.log(`  ${marker} ${C.cyan}${area}${C.reset} ${C.dim}(${count} 文件)${C.reset}`)
    }
    console.log('')
    console.log(`${C.bold}可能原因:${C.reset}`)
    console.log(
      `${C.dim}  1. 使用了 git add . / git add -A 把其他 agent 改动混入本次 commit${C.reset}`,
    )
    console.log(
      `${C.dim}  2. commit message scope 写错(应为实际涉及的领域名)${C.reset}`,
    )
    console.log('')
    console.log(`${C.bold}建议预检:${C.reset}`)
    console.log(
      `${C.dim}  git diff --cached --stat   # 查看 staged 文件清单是否属于本任务${C.reset}`,
    )
    console.log(
      `${C.dim}  git restore --staged <违规文件>  # 从 staging 区移除非本任务文件(非破坏)${C.reset}`,
    )
    console.log(
      `${C.dim}  若确认所有 staged 文件属于本任务,可忽略此警告直接 commit${C.reset}`,
    )
    console.log('')
    // warn-only, exit 0 不阻塞
    process.exit(0)
  }

  // 一致性 OK
  const matchHint = areaSet.has(scope) ? `(scope "${scope}" 匹配领域 ✓)` : ''
  console.log(
    `${C.dim}⏭  commit scope 一致性检查(${staged.length} 文件, ${areaSet.size} 领域, ${matchHint}通过)${C.reset}`,
  )
  process.exit(0)
}

// 只在直接运行时执行 main,import 时不执行(单元测试需要 import 纯函数)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
