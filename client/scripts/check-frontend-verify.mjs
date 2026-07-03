#!/usr/bin/env node
/**
 * 前端样式改动后 Agent 自验硬约束守门脚本 (2026-07-04 立)
 *
 * 目的: 强制 Agent 在改完前端样式后**自己**验证页面已生效, 而不是让用户去硬刷新
 *       (Ctrl+Shift+R). 这是 2026-07-04 用户明确要求的"绝对不能让用户自己硬刷新"
 *       红线规则的源码级兜底.
 *
 * 检测范围 (在 AGENTS.md 中按 2026-07-04 新章节确认):
 *   1. AGENTS.md 中必须含 "前端样式改动后 Agent 自验硬约束" 章节
 *   2. 该章节必须含 "browser_navigate" + "browser_take_screenshot" 关键词
 *   3. 该章节必须明确禁止让用户手动硬刷新 (Ctrl+Shift+R) 的字面量
 *   4. 必须含 "修改 SCSS / CSS / scoped 样式" 触发条件关键词
 *
 * 用法:
 *   node scripts/check-frontend-verify.mjs          # 检查 AGENTS.md
 *   node scripts/check-frontend-verify.mjs --staged # 仅当 AGENTS.md 在 staged 时才检查
 *
 * 退出码:
 *   0 - 通过
 *   1 - 缺失关键词 / 章节 / 字面量
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(clientRoot, '..')
const agentsMdPath = path.join(projectRoot, 'AGENTS.md')

const onlyStaged = process.argv.includes('--staged')

// --staged 模式: AGENTS.md 未在 staged 时直接通过
if (onlyStaged) {
  try {
    const staged = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: projectRoot,
      encoding: 'utf-8',
    })
    const stagedFiles = staged.split('\n').map((s) => s.trim()).filter(Boolean)
    const agentsMdRelative = path.relative(projectRoot, agentsMdPath).replace(/\\/g, '/')
    if (!stagedFiles.includes(agentsMdRelative)) {
      process.exit(0)
    }
  } catch {
    // git 不可用, 退回到全量检查
  }
}

if (!fs.existsSync(agentsMdPath)) {
  console.error(`[FAIL] AGENTS.md 不存在: ${agentsMdPath}`)
  process.exit(1)
}

const content = fs.readFileSync(agentsMdPath, 'utf8')

// 必含关键词 (2026-07-04 用户明确要求)
const REQUIRED_KEYWORDS = [
  { kw: '前端样式改动后 Agent 自验硬约束', desc: '章节标题' },
  { kw: 'browser_navigate', desc: 'MCP 浏览器强制刷新工具' },
  { kw: 'browser_take_screenshot', desc: 'MCP 浏览器截图工具' },
  { kw: 'Ctrl+Shift+R', desc: '用户手动硬刷新 (必须明确禁止让用户做此操作)' },
  { kw: 'scss', desc: '触发条件: SCSS 改动' },
  { kw: 'scss', desc: '触发条件: scoped 样式改动' },
  { kw: 'computed', desc: 'getComputedStyle 验证计算样式' },
]

let hasError = false
for (const { kw, desc } of REQUIRED_KEYWORDS) {
  if (!content.includes(kw)) {
    console.error(`[FAIL] AGENTS.md 缺失关键词: "${kw}" (${desc})`)
    hasError = true
  }
}

// 章节位置检查: 章节必须存在, 且标题行存在
const sectionTitle = '## 前端样式改动后 Agent 自验硬约束（2026-07-04 立）'
if (!content.includes(sectionTitle)) {
  console.error(`[FAIL] AGENTS.md 缺失章节: ${sectionTitle}`)
  hasError = true
}

// 章节正文必须强调 "不能 / 禁止 让用户硬刷新" 语义
const negationPatterns = [
  '不能让用户自己去硬刷新',
  '绝对不能',
  '禁止让用户',
  '不能要求用户',
]
const hasNegation = negationPatterns.some((p) => content.includes(p))
if (!hasNegation) {
  console.error(
    `[FAIL] AGENTS.md 前端样式自验章节必须含明确否定语义 (不能/禁止让用户硬刷新)\n` +
      `  示例: "绝对不能让用户自己去硬刷新"`
  )
  hasError = true
}

if (hasError) {
  console.error('\n[FAIL] 前端样式改动后 Agent 自验硬约束守门未通过')
  console.error('  修复: 在 AGENTS.md 追加 H2 章节 "前端样式改动后 Agent 自验硬约束",')
  console.error('        含上述全部关键词 + 明确的"不能让用户硬刷新"语义。')
  process.exit(1)
}

console.log('[OK] AGENTS.md 前端样式改动后 Agent 自验硬约束章节完整性通过')
console.log(`     含 ${REQUIRED_KEYWORDS.length} 项必含关键词 + 否定语义 + 章节标题`)
process.exit(0)
