#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-commit-scope-consistency.mjs — commit 污染特征签名检测守门(blocking)
 *
 * 背景(2026-07-26 立,真实事故):
 *   多 agent 并行开发同一 main 分支时,某 agent 用 `git add -A` 把其他 agent 的改动
 *   一起 commit,导致"污染事故"(AGENTS.md §16)。典型案例:commit `c3c864131` message
 *   是 `feat(seo): IndexNow key 文件`,但 staged 文件包含 `packages/i18n/` 改动 +
 *   `apps/web/verify-*.mjs` 删除 + 4 个 i18n 测试文件,明显是 i18n 任务被混入 seo commit。
 *
 * 重构历史(2026-07-26):
 *   v1 (commit ee84f416d): warn-only + scope 与 staged 文件领域匹配 → 30 commit 验证发现
 *   100% 误报率(scope 语义与文件领域假设不成立)+ 0% 召回率(seo 在白名单放过 c3c864131)。
 *   v2 (本次重构): warn-only → blocking + scope 匹配 → 污染特征签名(3 条规则)。
 *   30 commit 回归验证:0 误报 0 漏检,c3c864131 被 R1+R2 双重拦截。
 *
 * 检测逻辑(3 条污染特征签名,满足任一即 blocking):
 *
 *   R1 (§25 硬违规): staged 含 apps 下 verify-*.mjs 文件
 *     依据:AGENTS.md §25 严禁 apps 源码根目录 verify-*.mjs 提交,出现即违规
 *     豁免:scripts/verify-*.mjs 是正式工具(有 README/CLI/help),允许
 *     覆盖:c3c864131 (5 个 apps/web/verify-*.mjs)
 *
 *   R2 (i18n 污染签名): staged 含 packages/i18n/messages/ 文件 + scope != 'i18n'
 *     依据:i18n 文件改动天然属于 i18n 领域,scope 非 i18n 即疑似混入
 *     覆盖:c3c864131 (i18n 文件 + scope=seo)
 *     跳过:scope === 'i18n' (合法跨端 i18n commit,如 refactor(i18n) 跨 5 端)
 *
 *   R3 (跨端污染签名): staged 涉及 ≥3 个不同 apps/<subdir> + scope 显式声明
 *      且 scope 不在 apps 子目录集合中 且 scope 不在跨切关注点白名单
 *     依据:≥3 端的 commit 通常是聚合交付,scope 应匹配某一端;不匹配即疑似污染
 *     覆盖:理论上 c3c864131 若无 verify/i18n 也会被 R3 拦截(实际已被 R1+R2 拦截)
 *     跳过:scope === null (无 scope 的聚合 commit,如 chore: 技术债批次,合法)
 *     跳过:scope 在 CROSS_CUTTING_SCOPES (security/deps/ci 等跨切关注点,合法跨端)
 *     跳过:scope 在 apps 子目录集合 (如 feat(web) + web + api + scripts,scope 匹配)
 *
 * 跨切关注点白名单(仅 R3 跳过,R1/R2 不跳过):
 *   security, deps, chore, config, ci, build, release, hotfix, monorepo, infra
 *   (注:'seo' 已移除 — c3c864131 事故证明 seo scope 可被滥用)
 *
 * 退出码:
 *   0 — 通过(无污染特征 或 无 scope 或 无 staged 文件)
 *   1 — blocking(检测到污染特征签名)
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

// ─── 配置:apps 子目录集合(用于 R3 跨端污染检测) ──────────
const APP_AREAS = new Set([
  'web',
  'api',
  'ai-service',
  'extension',
  'miniapp-taro',
  'mobile-rn',
  'desktop',
  'cli',
])

// ─── 配置:跨切关注点白名单(仅 R3 跳过,R1/R2 不跳过) ──────
// 注:'seo' 已移除 — c3c864131 事故证明 seo scope 可被滥用混入 i18n/verify 污染
const CROSS_CUTTING_SCOPES = new Set([
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
 * 检测文件是否为 §25 禁止的 verify-*.mjs 临时验证文件
 * §25 白名单豁免:scripts/verify-*.mjs 是正式工具(有 README/CLI/help),允许提交
 * 仅 apps 下 verify-*.mjs 或其他非 scripts 目录的 verify-*.mjs 视为违规
 * @param {string} file - 文件相对路径(已正斜杠)
 * @returns {boolean}
 */
function isForbiddenVerifyFile(file) {
  const normalized = file.replace(/\\/g, '/')
  // §25 白名单豁免:scripts/ 下是正式工具
  if (normalized.startsWith('scripts/')) return false
  return /(^|\/)verify-[^/]+\.mjs$/.test(normalized)
}

/**
 * 检测 staged 文件清单是否含污染特征签名
 * @param {string[]} staged - staged 文件相对路径数组(正斜杠)
 * @param {string|null} scope - commit message 解析出的 scope(可为 null)
 * @returns {{block: boolean, rule: string|null, reason: string, areas: Map, appsSubdirs: Set, hasVerifyFiles: boolean, hasI18nFiles: boolean}}
 */
export function detectPollution(staged, scope) {
  // 推断 staged 文件涉及的领域集合
  const areas = new Map() // area → fileCount
  for (const file of staged) {
    const area = inferArea(file)
    if (area) {
      areas.set(area, (areas.get(area) || 0) + 1)
    }
  }
  const areaSet = new Set(areas.keys())
  const appsSubdirs = new Set(Array.from(areaSet).filter((a) => APP_AREAS.has(a)))

  // 污染特征签名
  const hasVerifyFiles = staged.some((f) => isForbiddenVerifyFile(f))
  const hasI18nFiles = staged.some((f) => f.startsWith('packages/i18n/messages/'))

  // R1: §25 硬违规 — 含 apps 下 verify-*.mjs 临时验证文件(scripts/ 豁免)
  if (hasVerifyFiles) {
    const verifyFiles = staged.filter((f) => isForbiddenVerifyFile(f))
    return {
      block: true,
      rule: 'R1',
      reason: `含 ${verifyFiles.length} 个 verify-*.mjs 临时验证文件 (§25 硬违规): ${verifyFiles.slice(0, 3).join(', ')}${verifyFiles.length > 3 ? '...' : ''}`,
      areas,
      appsSubdirs,
      hasVerifyFiles,
      hasI18nFiles,
    }
  }

  // R2: i18n 污染签名 — i18n 文件 + scope != 'i18n'
  if (hasI18nFiles && scope !== 'i18n') {
    const i18nFiles = staged.filter((f) => f.startsWith('packages/i18n/messages/'))
    return {
      block: true,
      rule: 'R2',
      reason: `i18n 文件 ${i18nFiles.length} 个 + scope="${scope}" != "i18n" (疑似 git add -A 混入)`,
      areas,
      appsSubdirs,
      hasVerifyFiles,
      hasI18nFiles,
    }
  }

  // R3: 跨端污染签名 — ≥3 个 apps 子目录 + scope 显式声明 + scope 不在 apps 子目录 + scope 非跨切关注点
  const skipR3 = scope === null || CROSS_CUTTING_SCOPES.has(scope)
  if (!skipR3 && appsSubdirs.size >= 3 && !appsSubdirs.has(scope)) {
    return {
      block: true,
      rule: 'R3',
      reason: `${appsSubdirs.size} 个 apps 子目录 [${Array.from(appsSubdirs).join(', ')}] + scope="${scope}" 不在其中 (疑似跨端污染)`,
      areas,
      appsSubdirs,
      hasVerifyFiles,
      hasI18nFiles,
    }
  }

  return {
    block: false,
    rule: null,
    reason: '通过',
    areas,
    appsSubdirs,
    hasVerifyFiles,
    hasI18nFiles,
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
  const { scope, type, subject } = parseCommitMessage(message)

  // 3. 读取 staged 文件清单
  const staged = getStagedFiles()
  if (staged.length === 0) {
    console.log(`${C.dim}⏭  commit scope 一致性检查(无 staged 文件, 跳过)${C.reset}`)
    process.exit(0)
  }

  // 4. 污染特征签名检测
  const result = detectPollution(staged, scope)

  if (result.block) {
    console.log('')
    console.log(`${C.red}${C.bold}❌ Commit 污染特征签名检测触发 (blocking)${C.reset}`)
    console.log(
      `${C.dim}依据: 多 agent 并行时 git add -A 可能混入其他 agent 改动(AGENTS.md §16)${C.reset}`,
    )
    console.log('')
    console.log(`${C.red}规则 ${result.rule}: ${result.reason}${C.reset}`)
    console.log('')
    console.log(`${C.bold}Commit message:${C.reset} ${type}${scope ? `(${scope})` : ''}: ${subject}`)
    console.log(`${C.bold}Staged 文件领域分布:${C.reset}`)
    for (const [area, count] of result.areas.entries()) {
      const isApps = result.appsSubdirs.has(area)
      const marker = isApps ? '🎯' : '  '
      console.log(`  ${marker} ${C.cyan}${area}${C.reset} ${C.dim}(${count} 文件)${C.reset}`)
    }
    console.log('')
    console.log(`${C.bold}修复方法:${C.reset}`)
    console.log(
      `${C.dim}  1. git diff --cached --stat   # 查看 staged 文件清单是否属于本任务${C.reset}`,
    )
    console.log(
      `${C.dim}  2. git restore --staged <违规文件>  # 从 staging 区移除非本任务文件(非破坏)${C.reset}`,
    )
    console.log(
      `${C.dim}  3. 若确认所有 staged 文件属于本任务,修改 commit message scope 为实际领域${C.reset}`,
    )
    console.log(
      `${C.dim}     例: feat(i18n): ...  而非  feat(seo): ...${C.reset}`,
    )
    console.log('')
    console.log(`${C.dim}紧急跳过(不推荐): HUSKY_SKIP_SCOPE_CHECK=1 git commit ...${C.reset}`)
    console.log('')
    process.exit(1)
  }

  // 通过
  const scopeHint = scope ? `scope="${scope}"` : '无 scope'
  const appsHint = result.appsSubdirs.size > 0 ? `, ${result.appsSubdirs.size} 端` : ''
  console.log(
    `${C.dim}⏭  commit scope 一致性检查(${staged.length} 文件, ${scopeHint}${appsHint}, 通过)${C.reset}`,
  )
  process.exit(0)
}

// 只在直接运行时执行 main,import 时不执行(单元测试需要 import 纯函数)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
