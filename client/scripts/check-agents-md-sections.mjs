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

// 17 个 H2 章节的精确标题 + 正文要点 (按 AGENTS.md 中出现的顺序)
// 与 e2e/agents-md-sections.spec.ts 中 EXPECTED_SECTIONS 保持一致
//
// 维护规则 (2026-07-03 改进):
//   - 新增章节: 在 AGENTS.md 追加正文 + 在本数组追加 { title, mustContain }
//   - keyword 从 title 自动派生 (deriveKeyword), 不再手动维护
//   - mustContain 是章节正文必须含的关键标识 (每个章节不同, 必须手动写)
const EXPECTED_SECTIONS = [
  { title: '## 目标驱动模式执行规范（/goal）', mustContain: 'STATE.md' },
  { title: '## 开发服务器启动约定（2026-07-03 立）', mustContain: 'dev-up.ps1' },
  { title: '## 主题色改动硬约束（2026-07-02 立）', mustContain: 'check:theme-tokens' },
  { title: '## 纯白/纯黑边框改动硬约束（2026-07-02 立）', mustContain: 'declaration-property-value-disallowed-list' },
  { title: '## AI 面板 embedded/floating 模式样式分离约束（2026-07-02 立）', mustContain: '.floating-chat-dialog.is-embedded' },
  { title: '## 多 commit 协作模式下的 hunks 边界规范（2026-07-02 立）', mustContain: 'Hunks-Overlap' },
  { title: '## 端口配置统一守门（2026-07-02 立）', mustContain: 'check:port-drift' },
  { title: '## 行尾格式守门（2026-07-02 立）', mustContain: 'check:line-endings' },
  { title: '## AI 浮窗对话历史入口唯一性硬约束（2026-07-02 立）', mustContain: 'ChatSessionPanel.vue' },
  { title: '## 登录/注册按钮设计令牌应用硬约束（2026-07-02 立）', mustContain: '_login-tokens.scss' },
  { title: '## 文案 / i18n 联动改动硬约束（2026-07-03 立）', mustContain: 'check:becomesupplier:join-us' },
  { title: '## 会话过期通知位置 + 自动关闭硬约束（2026-07-03 立）', mustContain: 'SESSION_EXPIRED_DURATION_MS' },
  { title: '## 会话过期通知按钮双层蓝边 + 中间白线视觉 bug 硬约束（2026-07-03 立）', mustContain: '.session-expired-notification' },
  { title: '## Vue scoped + @use partial 规范（2026-07-03 立）', mustContain: 'check-ai-header-style-scope' },
  { title: '## 暗色浮层 primary 按钮双层蓝边 + 中间白线视觉 bug 硬约束（2026-07-03 立）', mustContain: ':where(.el-message-box, .el-notification, .el-dialog' },
  { title: '## 暗色浮层底色统一硬约束（2026-07-03 立）', mustContain: 'check-dark-overlay-bg-color-unified' },
  { title: '## 圆角统一硬约束（2026-07-03 立）', mustContain: 'check-no-pill-radius' },
  { title: '## 侧边栏尺寸永久锁定 v11 硬约束（2026-07-04 立）', mustContain: 'check-sidebar-config.mjs' },
  { title: '## 暗色模式按钮/标签/消息文字反色硬约束（2026-07-04 立）', mustContain: 'check-button-text-contrast.mjs' },
  { title: '## Git Hook 同步硬约束（2026-07-04 立）', mustContain: 'check-pre-commit-hook-content.mjs' },
]

// 从 H2 标题自动派生 keyword (用于在正文中定位章节)
// 规则: 去掉 '## ' 前缀, 取 '（' 前的部分
// 例: '## 主题色改动硬约束（2026-07-02 立）' → '主题色改动硬约束'
function deriveKeyword(title) {
  return title.replace(/^## /, '').split('（')[0]
}

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
  EXPECTED_SECTIONS.forEach((s, i) => console.error(`    ${i + 1}. ${s.title}`))
  console.error('  新增章节: 先在 AGENTS.md 追加, 再更新本脚本 + e2e/agents-md-sections.spec.ts')
  console.error('  删除章节: 先更新本脚本 + e2e 测试, 再删 AGENTS.md')
  hasError = true
}

// 检查 4: 章节标题按既定顺序逐字匹配
EXPECTED_SECTIONS.forEach((expected, idx) => {
  const actual = h2Matches[idx]
  if (!actual) {
    console.error(
      `[FAIL] AGENTS.md 第 ${idx + 1} 个 H2 章节缺失 (期望: ${expected.title})`
    )
    hasError = true
  } else if (actual !== expected.title) {
    console.error(
      `[FAIL] AGENTS.md 第 ${idx + 1} 个 H2 章节标题不匹配`
    )
    console.error(`  期望: ${expected.title}`)
    console.error(`  实际: ${actual}`)
    console.error('  可能原因: 标题被改字 / 顺序被打乱 / 章节被替换成另一个')
    hasError = true
  }
})

// 检查 5: 关键章节正文要点抽查 (防"标题在但正文被删")
// keyword 从 title 自动派生 (deriveKeyword), mustContain 从 EXPECTED_SECTIONS 取
for (const section of EXPECTED_SECTIONS) {
  const keyword = deriveKeyword(section.title)
  const mustContain = section.mustContain
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
