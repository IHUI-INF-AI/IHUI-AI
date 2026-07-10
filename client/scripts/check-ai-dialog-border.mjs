/**
 * 守门脚本：AI 浮窗 dialog 描边色必须用 AI 浮窗专属色 (2026-07-06 立)
 *
 * 背景:
 *   用户反馈"对话框的 div 的描边怎么都不显示了", 根因 3 重:
 *     (1) AIChat.vue base .floating-chat-dialog 用 `border: var(--unified-border)`,
 *         在暗色下 = #171717 (v26 sidebar 定稿色), 与 page bg #1a1a1a 差值仅 3 几乎不可见.
 *     (2) _sidebar-layout.scss:1934 `.ai-side-panel-body .floating-chat-dialog.is-embedded`
 *         强制 `border: none`, 整个 embedded 模式浮窗无边框.
 *     (3) .floating-chat-dialog.is-dark 写 `border-color: var(--el-border-color)` (= #171717),
 *         跟 base 一样几乎不可见.
 *
 * 修复:
 *     - AIChat.vue base .floating-chat-dialog 改用专属色:
 *         浅色 #e6e8ed (与 #fff 差值 ~25)
 *         暗色 #3a3b3d (与 #1a1a1a 差值 ~30)
 *     - _sidebar-layout.scss 移除 is-embedded 的 `border: none` 强制覆盖
 *     - .is-dark 块的 `border-color: var(--el-border-color)` 移除
 *
 * 守门规则 (5 条):
 *   1. AIChat.vue base `.floating-chat-dialog {` 块必须含 `border: 1px solid #e6e8ed` (浅色)
 *   2. AIChat.vue 不能有 `:where(html.dark) .floating-chat-dialog` 含 `border-color: var(--el-border-color)` (暗色下 = #171717 几乎不可见)
 *   3. AIChat.vue base `.floating-chat-dialog {` 块不能含 `border: var(--unified-border)` (v26 sidebar 定稿色, 跟 AI 浮窗视觉不匹配)
 *   4. _sidebar-layout.scss `.ai-side-panel-body .floating-chat-dialog.is-embedded {` 块不能含 `border: none` 强制覆盖
 *   5. AIChat.vue `.floating-chat-dialog.is-dark` 块不能含 `border-color: var(--el-border-color)` (覆盖暗色专属色)
 *
 * 用法:
 *   - 检查暂存文件:  node scripts/check-ai-dialog-border.mjs
 *   - 检查整个项目:  node scripts/check-ai-dialog-border.mjs --all
 *   - 检查指定文件:  node scripts/check-ai-dialog-border.mjs file1 file2
 *
 * 退出码: 0 通过, 1 发现违规
 *
 * 性能: <50ms (pre-commit 友好)
 */

import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

// 关键文件 (绝对路径)
const AICHAT_VUE = path.join(rootDir, 'src', 'components', 'ai', 'AIChat.vue')
const SIDEBAR_LAYOUT_SCSS = path.join(rootDir, 'src', 'styles', '_sidebar-layout.scss')

const TARGET_FILES = [AICHAT_VUE, SIDEBAR_LAYOUT_SCSS]

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      cwd: rootDir,
      encoding: 'utf-8',
    })
    return output
      .split(/\r?\n/)
      .filter(Boolean)
      .map((f) => path.resolve(rootDir, f))
  } catch {
    return []
  }
}

/**
 * 抓取 .floating-chat-dialog 块 (从 { 到匹配的 }, 支持嵌套 {}).
 * 跳过规则:
 *   - 不进字符串字面量 ('', "", ``)
 *   - 不进 SCSS 注释 (// 和 /* ... *​/)
 *   - 不进 JS 注释 (// 和 /* ... *​/)
 */
function extractBlock(text, startPattern) {
  const startMatch = text.match(startPattern)
  if (!startMatch) return null
  const openBraceIdx = text.indexOf('{', startMatch.index)
  if (openBraceIdx === -1) return null
  let depth = 0
  let inString = null  // '"' | "'" | '`'
  let inComment = null  // '//' | '/*'
  for (let i = openBraceIdx; i < text.length; i++) {
    const c = text[i]
    const next = text[i + 1]
    if (inComment === '//') {
      if (c === '\n') inComment = null
      continue
    }
    if (inComment === '/*') {
      if (c === '*' && next === '/') { inComment = null; i++ }
      continue
    }
    if (inString) {
      if (c === '\\') { i++; continue }
      if (c === inString) inString = null
      continue
    }
    if (c === '/' && next === '/') { inComment = '//'; i++; continue }
    if (c === '/' && next === '*') { inComment = '/*'; i++; continue }
    if (c === '"' || c === "'" || c === '`') { inString = c; continue }
    if (c === '{') depth++
    if (c === '}') {
      depth--
      if (depth === 0) return text.slice(openBraceIdx, i + 1)
    }
  }
  return null
}

function main() {
  let files
  if (process.argv.includes('--all')) {
    files = TARGET_FILES.map((f) => path.resolve(f))
  } else if (process.argv.length > 2 && !process.argv[2].startsWith('-')) {
    files = process.argv.slice(2).map((f) => path.resolve(f))
  } else {
    const staged = getStagedFiles()
    files = TARGET_FILES.filter((f) => staged.includes(f))
  }

  if (files.length === 0) {
    console.log('✓ [ai-dialog-border] 无相关文件在暂存区, 跳过')
    process.exit(0)
  }

  const violations = []
  const checkedFiles = []

  // --- 规则 1: AIChat.vue base `.floating-chat-dialog` 块必须含专属色 #e6e8ed ---
  if (files.includes(AICHAT_VUE) && fs.existsSync(AICHAT_VUE)) {
    const text = fs.readFileSync(AICHAT_VUE, 'utf-8')

    // 找 base .floating-chat-dialog { 块 (单类, 不带 .is-* 修饰)
    // 用 [^{]* 配合前向负向预查确保 base, 不匹配 .is-dark/.is-embedded
    const baseBlockMatch = text.match(/^\.floating-chat-dialog\s*\{/m)
    if (baseBlockMatch) {
      const block = extractBlock(text, /^\.floating-chat-dialog\s*\{/m)
      if (block) {
        checkedFiles.push(AICHAT_VUE)
        if (!/border:\s*1px\s+solid\s+#e6e8ed/i.test(block)) {
          violations.push({
            file: path.relative(rootDir, AICHAT_VUE),
            rule: 'base .floating-chat-dialog 块缺专属描边 #e6e8ed (浅色 AI 浮窗)',
            fix: '在 .floating-chat-dialog { ... } 块内加 `border: 1px solid #e6e8ed;` (浅色 AI 浮窗专属色, 与 #fff 差值 ~25 明显可见). 暗色下用 :where(html.dark) & { border-color: #3a3b3d; } 覆盖.',
          })
        }
      }
    }

    // --- 规则 2: 不能用 var(--unified-border) (v26 sidebar 定稿色) ---
    if (baseBlockMatch && extractBlock(text, /^\.floating-chat-dialog\s*\{/m)) {
      const block = extractBlock(text, /^\.floating-chat-dialog\s*\{/m)
      if (block && /border:\s*var\(--unified-border\)/.test(block)) {
        violations.push({
          file: path.relative(rootDir, AICHAT_VUE),
          rule: 'base .floating-chat-dialog 用 var(--unified-border) (= v26 sidebar 定稿色 #171717, 暗色下与 page bg 差值仅 3 几乎不可见)',
          fix: '改用 AI 浮窗专属色: 浅色 #e6e8ed / 暗色 #3a3b3d. var(--unified-border) 跟 sidebar 共享, 不适合浮窗视觉.',
        })
      }
    }

    // --- 规则 3: .floating-chat-dialog.is-dark 块不能含 border-color: var(--el-border-color) ---
    const isDarkBlock = extractBlock(text, /\.floating-chat-dialog\.is-dark\s*\{/)
    if (isDarkBlock) {
      checkedFiles.push(AICHAT_VUE)
      if (/border-color:\s*var\(--el-border-color\)/.test(isDarkBlock)) {
        violations.push({
          file: path.relative(rootDir, AICHAT_VUE),
          rule: '.floating-chat-dialog.is-dark 块含 `border-color: var(--el-border-color)` (= v26 sidebar #171717 几乎不可见, 会覆盖暗色专属色 #3a3b3d)',
          fix: '从 .is-dark 块移除 border-color. 暗色专属色由 `:where(html.dark) .floating-chat-dialog { border-color: #3a3b3d }` 统一管理.',
        })
      }
    }

    // --- 规则 4: :where(html.dark) .floating-chat-dialog 块不能含 var(--el-border-color) ---
    const darkBlock = extractBlock(text, /:where\(html\.dark\)\s+\.floating-chat-dialog\s*\{/)
    if (darkBlock) {
      checkedFiles.push(AICHAT_VUE)
      if (/border-color:\s*var\(--el-border-color\)/.test(darkBlock)) {
        violations.push({
          file: path.relative(rootDir, AICHAT_VUE),
          rule: ':where(html.dark) .floating-chat-dialog 块含 `border-color: var(--el-border-color)` (= v26 sidebar #171717 几乎不可见)',
          fix: '改用 AI 浮窗专属暗色 #3a3b3d (与 #1a1a1a 差值 ~30, 明显可见).',
        })
      }
      // 同时检查 base 块是不是有 hover 提亮 (浅色 #ced1d8 / 暗色 #54555a)
      // 这里不强制要求, 只检查不要退回 var(--el-border-color)
    }
  }

  // --- 规则 5: _sidebar-layout.scss .ai-side-panel-body .floating-chat-dialog.is-embedded 不能含 border: none ---
  if (files.includes(SIDEBAR_LAYOUT_SCSS) && fs.existsSync(SIDEBAR_LAYOUT_SCSS)) {
    const text = fs.readFileSync(SIDEBAR_LAYOUT_SCSS, 'utf-8')
    const block = extractBlock(text, /\.ai-side-panel-body\s+\.floating-chat-dialog\.is-embedded\s*\{/)
    if (block) {
      checkedFiles.push(SIDEBAR_LAYOUT_SCSS)
      // 先去除 /* ... */ 多行注释, 避免注释里出现 "border: none" 字样误判
      const blockNoComment = block.replace(/\/\*[\s\S]*?\*\//g, '')
      if (/border:\s*none/.test(blockNoComment)) {
        violations.push({
          file: path.relative(rootDir, SIDEBAR_LAYOUT_SCSS),
          rule: '.ai-side-panel-body .floating-chat-dialog.is-embedded 块含 `border: none` 强制覆盖 (用户反馈"对话框 div 描边不显示")',
          fix: '移除 border: none. 保留 padding: 0 / border-radius: 0 贴齐父容器. 让 AIChat.vue base 描边 (浅色 #e6e8ed / 暗色 #3a3b3d) 在 embedded 模式下也可见.',
        })
      }
    }
  }

  console.log(`[ai-dialog-border] 检查 ${checkedFiles.length} 个文件`)
  if (violations.length === 0) {
    console.log('✓ [ai-dialog-border] 全部通过')
    process.exit(0)
  }

  console.error(`✗ [ai-dialog-border] ${violations.length} 项违规:`)
  for (const v of violations) {
    console.error(`  - [${v.rule}]`)
    console.error(`    file: ${v.file}`)
    console.error(`    fix:  ${v.fix}`)
  }
  process.exit(1)
}

main()
