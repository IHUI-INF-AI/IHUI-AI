#!/usr/bin/env node
/**
 * AGENTS.md 章节完整性守门脚本 (轻量级, pre-commit 用)
 *
 * 目的: 防止 AGENTS.md 章节被误删/替换/乱序。
 *       2026-07-02 曾因 stash 误覆盖导致 2 章节整体丢失近 1 天才被发现,
 *       此脚本在 pre-commit 阶段就把这类回归拦下, 不必等到 e2e 跑完。
 *
 * 与 e2e/agents-md-sections.spec.ts 的关系:
 *   - 本脚本: 轻量级文本检查 (pre-commit 阶段, <50ms)
 *   - e2e 测试: 完整源码级断言 (CI 阶段, 含行尾/正文要点)
 *   两者并存: pre-commit 拦截 + CI 兜底
 *
 * 用法:
 *   node scripts/check-agents-md-sections.mjs          # 检查 AGENTS.md
 *   node scripts/check-agents-md-sections.mjs --staged # 仅当 AGENTS.md 在 staged 时才检查
 *
 * 退出码:
 *   0 - 通过
 *   1 - 章节缺失/乱序/行尾错误
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

// 如果 --staged 且 AGENTS.md 不在 staged 文件中, 直接通过 (不浪费 pre-commit 时间)
if (onlyStaged) {
  try {
    const staged = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: projectRoot,
      encoding: 'utf-8',
    })
    const stagedFiles = staged.split('\n').map((s) => s.trim()).filter(Boolean)
    const agentsMdRelative = path.relative(projectRoot, agentsMdPath).replace(/\\/g, '/')
    if (!stagedFiles.includes(agentsMdRelative)) {
      // AGENTS.md 未改动, 跳过
      process.exit(0)
    }
  } catch {
    // git 不可用, 退回到全量检查
  }
}

// 14 个 H2 章节的精确标题 (按 AGENTS.md 中出现的顺序)
// 与 e2e/agents-md-sections.spec.ts 中 EXPECTED_SECTIONS 保持一致
const EXPECTED_SECTIONS = [
  '## 目标驱动模式执行规范（/goal）',
  '## 开发服务器启动约定（2026-07-03 立）',
  '## 主题色改动硬约束（2026-07-02 立）',
  '## 纯白/纯黑边框改动硬约束（2026-07-02 立）',
  '## AI 面板 embedded/floating 模式样式分离约束（2026-07-02 立）',
  '## 多 commit 协作模式下的 hunks 边界规范（2026-07-02 立）',
  '## 端口配置统一守门（2026-07-02 立）',
  '## 行尾格式守门（2026-07-02 立）',
  '## AI 浮窗对话历史入口唯一性硬约束（2026-07-02 立）',
  '## 登录/注册按钮设计令牌应用硬约束（2026-07-02 立）',
  '## 文案 / i18n 联动改动硬约束（2026-07-03 立）',
  '## 会话过期通知位置 + 自动关闭硬约束（2026-07-03 立）',
  '## 会话过期通知按钮双层蓝边 + 中间白线视觉 bug 硬约束（2026-07-03 立）',
  '## Vue scoped + @use partial 规范（2026-07-03 立）',
]

// 文件不存在
if (!fs.existsSync(agentsMdPath)) {
  console.error(`[FAIL] AGENTS.md 不存在: ${agentsMdPath}`)
  console.error('  AGENTS.md 是项目级 Agent 行为规范的唯一来源, 禁止删除。')
  process.exit(1)
}

const buf = fs.readFileSync(agentsMdPath)
const content = buf.toString('utf8')

let hasError = false

// 检查 1: 行尾必须全部为 LF (CRLF = 0)
let crlfCount = 0
let crOnlyCount = 0
for (let i = 0; i < buf.length; i++) {
  if (buf[i] === 0x0a) {
    if (i > 0 && buf[i - 1] === 0x0d) crlfCount++
  } else if (buf[i] === 0x0d) {
    if (i + 1 >= buf.length || buf[i + 1] !== 0x0a) crOnlyCount++
  }
}
if (crlfCount > 0 || crOnlyCount > 0) {
  console.error(
    `[FAIL] AGENTS.md 行尾违规: CRLF=${crlfCount}  CR=${crOnlyCount}  (必须全部 LF)`
  )
  console.error('  修复: node -e "const fs=require(\'fs\');let c=fs.readFileSync(\'AGENTS.md\',\'utf8\');fs.writeFileSync(\'AGENTS.md\',c.replace(/\\r\\n/g,\'\\n\').replace(/\\r/g,\'\\n\'))"')
  hasError = true
}

// 检查 2: 行数下限 (防截断)
const lineCount = content.split('\n').length
if (lineCount < 200) {
  console.error(`[FAIL] AGENTS.md 行数 ${lineCount} < 200, 可能被截断`)
  hasError = true
}

// 检查 3: H2 章节计数
const h2Matches = content.match(/^## [^\n]+$/gm) || []
if (h2Matches.length !== EXPECTED_SECTIONS.length) {
  console.error(
    `[FAIL] AGENTS.md H2 章节数 = ${h2Matches.length}, 期望 = ${EXPECTED_SECTIONS.length}`
  )
  console.error('  实际 H2 列表:')
  h2Matches.forEach((h, i) => console.error(`    ${i + 1}. ${h}`))
  console.error('  期望 H2 列表:')
  EXPECTED_SECTIONS.forEach((h, i) => console.error(`    ${i + 1}. ${h}`))
  console.error('  新增章节: 先在 AGENTS.md 追加, 再更新本脚本 + e2e/agents-md-sections.spec.ts')
  console.error('  删除章节: 先更新本脚本 + e2e 测试, 再删 AGENTS.md')
  hasError = true
}

// 检查 4: 9 个章节标题按既定顺序逐字匹配
EXPECTED_SECTIONS.forEach((expected, idx) => {
  const actual = h2Matches[idx]
  if (!actual) {
    console.error(
      `[FAIL] AGENTS.md 第 ${idx + 1} 个 H2 章节缺失 (期望: ${expected})`
    )
    hasError = true
  } else if (actual !== expected) {
    console.error(
      `[FAIL] AGENTS.md 第 ${idx + 1} 个 H2 章节标题不匹配`
    )
    console.error(`  期望: ${expected}`)
    console.error(`  实际: ${actual}`)
    console.error('  可能原因: 标题被改字 / 顺序被打乱 / 章节被替换成另一个')
    hasError = true
  }
})

// 检查 5: 关键章节正文要点抽查 (防"标题在但正文被删")
const sectionSpotChecks = [
  { keyword: '目标驱动模式', mustContain: 'STATE.md' },
  { keyword: '主题色改动硬约束', mustContain: 'check:theme-tokens' },
  { keyword: '纯白/纯黑边框改动硬约束', mustContain: 'declaration-property-value-disallowed-list' },
  { keyword: 'AI 面板 embedded/floating', mustContain: '.floating-chat-dialog.is-embedded' },
  { keyword: 'hunks 边界规范', mustContain: 'Hunks-Overlap' },
  { keyword: '端口配置统一守门', mustContain: 'check:port-drift' },
  { keyword: '行尾格式守门', mustContain: 'check:line-endings' },
  { keyword: 'AI 浮窗对话历史入口唯一性', mustContain: 'ChatSessionPanel.vue' },
  { keyword: '登录/注册按钮设计令牌', mustContain: '_login-tokens.scss' },
  { keyword: '文案 / i18n 联动改动硬约束', mustContain: 'check:becomesupplier:join-us' },
  { keyword: '会话过期通知位置', mustContain: 'SESSION_EXPIRED_DURATION_MS' },
  { keyword: '会话过期通知按钮双层蓝边', mustContain: '.session-expired-notification' },
  { keyword: 'Vue scoped + @use partial 规范', mustContain: 'check-ai-header-style-scope' },
]
for (const { keyword, mustContain } of sectionSpotChecks) {
  const sectionStart = content.indexOf(keyword)
  if (sectionStart < 0) {
    console.error(`[FAIL] AGENTS.md 缺失含 "${keyword}" 的章节`)
    hasError = true
    continue
  }
  const nextH2 = content.indexOf('\n## ', sectionStart + 1)
  const sectionBody = nextH2 === -1 ? content.slice(sectionStart) : content.slice(sectionStart, nextH2)
  if (!sectionBody.includes(mustContain)) {
    console.error(
      `[FAIL] AGENTS.md 中 "${keyword}" 章节正文缺失关键标识 "${mustContain}"`
    )
    console.error('  可能原因: 章节正文被删/被截断/被替换成另一个章节的内容')
    hasError = true
  }
}

if (hasError) {
  console.error('\n[FAIL] AGENTS.md 章节完整性检查未通过')
  console.error('  历史 bug: 2026-07-02 stash ai-panel-cleanup-batch 误覆盖曾导致 2 章节丢失近 1 天')
  console.error('  修复参考: git stash list / git stash show -p stash@{0} -- AGENTS.md')
  process.exit(1)
}

console.log(`[OK] AGENTS.md: ${lineCount} 行, ${h2Matches.length} 个 H2 章节, LF 行尾, 完整性通过`)
process.exit(0)
