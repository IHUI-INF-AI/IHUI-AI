#!/usr/bin/env node
/**
 * RULE 1「先问再做」PR 模板硬约束守门 (2026-07-06 立)
 *
 * 目的: 保证 .github/pull_request_template.md 存在, 5 项 RULE 1 必填 checkbox
 *       齐全, 任意 PR 必须全勾选才能 merge. 这是 commit-msg 守门之外的第二层防
 *       回归 (commit-msg 拦截本地, PR 模板拦截远程 PR review 阶段).
 *
 * 与 commit-msg 守门区别:
 *   - commit-msg 守门: 拦截单个 commit message, 适合一个 commit = 一项改动
 *   - PR 模板守门: 拦截整个 PR description, 适合 squash merge (所有 commit
 *     合并成 1 个), 也适合多 commit 协作模式
 *
 * 触发场景:
 *   - CI 阶段 (.github/workflows/*.yml) 跑全量 check
 *   - pre-push 钩子 跑全量 check
 *   - 开发者本地 跑全量 check (调试用)
 *
 * 退出码:
 *   0 - 通过
 *   1 - 模板缺失/5 项 checkbox 缺失/格式错乱
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..', '..')

const candidates = [
  path.join(projectRoot, '.github', 'pull_request_template.md'),
  path.join(projectRoot, '.github', 'PULL_REQUEST_TEMPLATE.md'),
]
const prTemplatePath = candidates.find((p) => fs.existsSync(p))

let hasError = false
function fail(msg) {
  console.error(`[FAIL] ${msg}`)
  hasError = true
}

// --- 规则 1: 模板文件必须存在 ---
if (!prTemplatePath) {
  fail(`.github/pull_request_template.md 不存在 (PR 模板是 RULE 1 第二层硬约束)`)
  console.error('  候选路径:')
  for (const c of candidates) {
    console.error(`    - ${c}`)
  }
  console.error('  修复: 复制 client/templates/pull_request_template.md 到 .github/')
  process.exit(1)
}

const content = fs.readFileSync(prTemplatePath, 'utf8')

// --- 规则 2: 5 项 RULE 1 必填 checkbox 齐全 ---
// 关键词: 范围 / 模式 / token / 守门 / 验证 (与 commit-msg 守门一致)
const REQUIRED_CHECKBOX_KEYWORDS = [
  { kw: '改动范围', desc: '5 项方向锁定 #1: 改动范围' },
  { kw: '模式', desc: '5 项方向锁定 #2: 浅色/暗色/双模式' },
  { kw: 'token', desc: '5 项方向锁定 #3: 影响的 token' },
  { kw: '守门', desc: '5 项方向锁定 #4: 守门规则 (check-*)' },
  { kw: '验证', desc: '5 项方向锁定 #5: 验证方式' },
]

for (const { kw, desc } of REQUIRED_CHECKBOX_KEYWORDS) {
  if (!content.includes(kw)) {
    fail(`PR 模板缺失关键字: "${kw}" (${desc})`)
  }
}

// --- 规则 3: checkbox 格式必须存在 (Markdown `- [ ]` 形式) ---
const checkboxRe = /^\s*-\s*\[\s*[xX ]\s*\]\s+/gm
const checkboxes = content.match(checkboxRe) || []
if (checkboxes.length < 5) {
  fail(`PR 模板 checkbox 数量 = ${checkboxes.length}, 期望 ≥ 5 (5 项 RULE 1 必填 + 至少 1 项其他)`)
}

// --- 规则 4: 模板必须引用 RULE 1 章节编号 (便于追溯) ---
if (!content.includes('RULE 1') && !content.includes('RULE1')) {
  fail('PR 模板未引用 RULE 1 (无法追溯到 AGENTS.md 第 28 章)')
}

// --- 规则 5: 模板必须包含 "UI 改动判定" 提示 ---
if (!content.includes('UI') && !content.includes('ui')) {
  fail('PR 模板未含 UI 判定提示 (非 UI 改动 PR 不强制 RULE 1)')
}

// --- 规则 6: 模板不能含 TODO 占位符 (防 stale 模板被提交) ---
if (content.includes('TODO:') || content.includes('FIXME:')) {
  fail('PR 模板含 TODO/FIXME 占位符, 需替换为实际内容')
}

// --- 规则 7: 文件不能为空 / 行数 < 10 ---
const lineCount = content.split('\n').length
if (lineCount < 10) {
  fail(`PR 模板行数 ${lineCount} < 10, 可能是空模板`)
}

// --- 规则 8: 模板必须含"截图验证"区段 (AGENTS.md 强约束) ---
if (!content.includes('截图') && !content.includes('screenshot')) {
  fail('PR 模板未含"截图验证"区段 (AGENTS.md 强约束: 涉及 UI 必须附截图)')
}

// --- 输出 ---
if (hasError) {
  console.error('\n[FAIL] PR 模板守门失败, 详见上方具体错误')
  console.error('  参考模板: client/templates/pull_request_template.md')
  process.exit(1)
}

console.log(`[OK] PR 模板守门通过: ${prTemplatePath}`)
console.log(`     ${lineCount} 行, ${checkboxes.length} 个 checkbox, 5 项 RULE 1 关键字齐全`)
console.log(`     模板位置: ${path.relative(projectRoot, prTemplatePath)}`)
process.exit(0)
