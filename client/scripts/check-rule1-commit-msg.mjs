#!/usr/bin/env node
/**
 * RULE 1「先问再做」commit-msg 硬约束守门 (2026-07-06 立)
 *
 * 目的: 把 AGENTS.md 第 28 章「RULE 1 先问再做硬约束」从"君子协定"提升为"git
 *       commit 阶段硬约束"。任何涉及 UI 视觉改动的 commit, 必须在 message 中:
 *         (1) 包含 `RULE1:` 前缀标签
 *         (2) 5 项方向锁定关键词: 范围 / 模式 / token / 守门 / 验证
 *         (3) 任意 UI 改动关键词触发 (避免"明明改 UI 但漏标")
 *
 * 与 DESIGN.md / AGENTS.md 关系:
 *   - DESIGN.md 9. Agent Prompt Guide 第 1 条 = RULE 1
 *   - AGENTS.md 第 28 章 = 本约束的行为规范 + 守门工具列表
 *   - 本脚本 = 守门工具第一层 (commit-msg 阶段, < 10ms)
 *   - check-rule1-pr-template.mjs = 守门工具第二层 (PR 阶段, CI 跑)
 *   - e2e/check-rule1-enforcement.spec.ts = 守门工具第三层 (E2E 浏览器级兜底)
 *
 * 用法:
 *   node scripts/check-rule1-commit-msg.mjs <commit-msg-file>
 *   例: node scripts/check-rule1-commit-msg.mjs .git/COMMIT_EDITMSG
 *
 * 退出码:
 *   0 - 通过 (非 UI 改动, 或 UI 改动且 5 项齐全)
 *   1 - UI 改动但 RULE1: 前缀/5 项方向关键词缺失
 *
 * 重要: 本脚本不应阻塞:
 *   - merge commit (--allow-on-non-ui-pattern: 含 'Merge' 前缀)
 *   - revert commit (含 'Revert' 前缀)
 *   - 纯文档/配置/后端/测试 commit (不含 UI 关键词, 自动放行)
 */

import * as fs from 'fs'

const commitMsgFile = process.argv[2]
if (!commitMsgFile) {
  console.error('[FAIL] 用法: node scripts/check-rule1-commit-msg.mjs <commit-msg-file>')
  process.exit(1)
}

if (!fs.existsSync(commitMsgFile)) {
  console.error(`[FAIL] commit-msg 文件不存在: ${commitMsgFile}`)
  process.exit(1)
}

const msg = fs.readFileSync(commitMsgFile, 'utf8')

// --- 步骤 1: 提取首行 (commit message 第一行 = subject, 后续 = body) ---
const firstLine = msg.split('\n')[0].trim()
const fullLower = msg.toLowerCase()

// --- 步骤 2: 放行 merge / revert / 自动化 commit ---
const isMerge = /^(Merge |merge |Revert |revert |fixup!|squash!|amend!)/i.test(firstLine) ||
  firstLine.startsWith('Merge branch') ||
  firstLine.startsWith('Merge pull request') ||
  firstLine.startsWith('Revert "')
if (isMerge) {
  console.log(`[OK] commit-msg 放行: merge/revert/fixup commit, 不强制 RULE 1`)
  process.exit(0)
}

// --- 步骤 3: 判定是否"涉及 UI 视觉改动" ---
// 触发关键词: UI 组件名 / 样式文件 / 设计 token / 图标 / 颜色 / 描边 / 圆角 / 暗色模式
// 触发逻辑: 任一关键词命中, 必须含 RULE1: 前缀
const UI_TRIGGER_KEYWORDS = [
  // 文件级 (大小写不敏感, 已在 lower 后匹配)
  '.vue', '.scss', '.css', 'sidebar', 'dialog', 'button', 'input', 'modal',
  'theme', 'token', 'color', 'palette', 'tier', 'contrast',
  // 设计概念
  '描边', '圆角', '暗色', '浅色', '侧边栏', '浮窗', '弹窗', '按钮', '输入框', '输入',
  'icon', '图标', 'border', 'radius', 'shadow', '阴影', 'shadow', 'glow',
  'light mode', 'dark mode', 'light-mode', 'dark-mode', 'ui', '界面', '视觉',
  'layout', '布局', 'spacing', '间距', 'padding', 'margin',
  // DESIGN.md 章节关键词
  'design.md', 'design', '设计',
  // AGENTS.md 第 28 章核心词
  'rule 1', 'rule1', 'rule-1', 'rule  1',
]

const isUiCommit = UI_TRIGGER_KEYWORDS.some((kw) => fullLower.includes(kw.toLowerCase()))

// --- 步骤 4: 非 UI 改动直接放行 ---
if (!isUiCommit) {
  console.log(`[OK] commit-msg 非 UI 改动, 放行: "${firstLine}"`)
  process.exit(0)
}

// --- 步骤 5: UI 改动 → 必须含 RULE1: 前缀 ---
// 接受: "RULE1: xxx" / "[RULE1] xxx" / "rule1: xxx" / "rule-1: xxx"
// 拒绝: "feat(scope): xxx" 无 RULE1 标签
const RULE1_PREFIX_RE = /(?:^|\s)\[?(RULE1|RULE 1|RULE-1)\]?:\s/i
if (!RULE1_PREFIX_RE.test(firstLine)) {
  console.error(`[FAIL] commit-msg 含 UI 改动关键词, 但缺失 RULE1: 前缀标签`)
  console.error(`  首行: "${firstLine}"`)
  console.error(``)
  console.error(`  RULE 1「先问再做」硬约束 (AGENTS.md 第 28 章):`)
  console.error(`    任何涉及 UI 视觉改动的 commit, 必须在 subject 首行加 RULE1: 前缀,`)
  console.error(`    并在 body 中说明 5 项方向锁定 (范围/模式/token/守门/验证).`)
  console.error(``)
  console.error(`  修复模板:`)
  console.error(`    RULE1: <一句话描述改动>`)
  console.error(``)
  console.error(`    ## 1. 改动范围`)
  console.error(`    <哪些组件/文件/路由>`)
  console.error(``)
  console.error(`    ## 2. 模式`)
  console.error(`    - 浅色模式: <...>`)
  console.error(`    - 暗色模式: <...>`)
  console.error(``)
  console.error(`    ## 3. 影响的 token`)
  console.error(`    <--el-* / --app-* / --color-* token 列表>`)
  console.error(``)
  console.error(`    ## 4. 守门规则`)
  console.error(`    <check-no-pill-radius / check-sidebar-dark-tier / ...>`)
  console.error(``)
  console.error(`    ## 5. 验证方式`)
  console.error(`    <puppeteer 截图 / 视觉 diff / manual>`)
  console.error(``)
  console.error(`  例:`)
  console.error(`    git commit -m "RULE1: 修复 sidebar v27 暗色描边色撞背景" \\`)
  console.error(`      -m "## 1. 改动范围: client/src/styles/_dark-mode-global.scss" \\`)
  console.error(`      -m "## 2. 模式: 暗色 (暗色背景 #0d0d0d 下 #171717 差值仅 3)" \\`)
  console.error(`      -m "## 3. 影响的 token: --app-sidebar-border #171717 → #2e2e2e" \\`)
  console.error(`      -m "## 4. 守门: check-sidebar-dark-tier + check-design-md" \\`)
  console.error(`      -m "## 5. 验证: Puppeteer 截图 + 视觉对比 light/dark"`)
  process.exit(1)
}

// --- 步骤 6: RULE1: 标签已含 → 检查 5 项方向锁定关键词 ---
// 必须出现 5 个关键词中的至少 4 个 (允许 1 项省略, 实际工程常见)
const DIRECTION_LOCK_KEYWORDS = [
  { key: '范围', weight: 1, desc: '改动范围: 哪些组件/文件/路由' },
  { key: '模式', weight: 1, desc: '模式: 浅色 / 暗色 / 双模式' },
  { key: 'token', weight: 1, desc: '影响的 token: --el-* / --app-* / --color-*' },
  { key: '守门', weight: 1, desc: '守门规则: check-* 脚本' },
  { key: '验证', weight: 1, desc: '验证方式: puppeteer / 视觉 diff / manual' },
]

const found = DIRECTION_LOCK_KEYWORDS.filter((item) => fullLower.includes(item.key.toLowerCase()))
const missing = DIRECTION_LOCK_KEYWORDS.filter((item) => !fullLower.includes(item.key.toLowerCase()))

if (found.length < 4) {
  console.error(`[FAIL] commit-msg RULE1: 前缀已含, 但 5 项方向锁定仅 ${found.length}/5 命中 (要求 ≥ 4):`)
  for (const m of missing) {
    console.error(`  - 缺失: ${m.key} (${m.desc})`)
  }
  console.error(``)
  console.error(`  首行: "${firstLine}"`)
  console.error(``)
  console.error(`  修复: 在 commit body (空行后) 添加缺失关键词, 例:`)
  console.error(`    - '范围: client/src/...'`)
  console.error(`    - '模式: 暗色'`)
  console.error(`    - 'token: --el-bg-color'`)
  console.error(`    - '守门: check-no-pill-radius'`)
  console.error(`    - '验证: Puppeteer 截图'`)
  process.exit(1)
}

// --- 步骤 7: 通过 ---
console.log(`[OK] commit-msg RULE 1 硬约束通过:`)
console.log(`     首行: "${firstLine}"`)
console.log(`     5 项方向锁定: ${found.length}/5 命中 (允许 1 项省略)`)
for (const f of found) {
  console.log(`       ✓ ${f.key}: ${f.desc}`)
}
if (missing.length > 0) {
  for (const m of missing) {
    console.log(`       - ${m.key}: 省略 (允许)`)
  }
}
process.exit(0)
