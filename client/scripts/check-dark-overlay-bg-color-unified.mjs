#!/usr/bin/env node
/**
 * 暗色浮层底色统一硬约束轻量级守门 (pre-commit)
 *
 * 目的: 防止 _element-plus-overrides.scss 等样式文件中的浮层组件
 *       (ElMessageBox / ElNotification / ElDialog / ElMessage / ElPopper / ElDropdown)
 *       被人误加 hardcode 颜色 (如 #ffffff, #2a2a2a, white, black, rgb(...)),
 *       导致暗色浮层底色偏离 #1a1a1a (--color-dark-bg-3 = --el-bg-color-overlay).
 *
 * 设计原则:
 *   - 浮层底色必须用 var(--el-bg-color) / var(--el-bg-color-overlay) 系列
 *     (允许带 fallback: var(--el-bg-color-overlay, #1a1a1a))
 *   - 禁止 hardcode 颜色: #xxx / rgb(...) / rgba(...) / white / black / red 等
 *   - 仅检查浮层组件规则块内的 background-color / background 属性
 *
 * 与 e2e/dark-overlay-bg-color-unified.spec.ts 的关系:
 *   - 本脚本: 轻量级文本检查 (pre-commit 阶段, <10ms)
 *   - e2e 测试: 完整源码级断言 (CI 阶段)
 *   两者并存: pre-commit 拦截 + CI 兜底
 *
 * 用法:
 *   node scripts/check-dark-overlay-bg-color-unified.mjs          # 全量检查
 *   node scripts/check-dark-overlay-bg-color-unified.mjs --staged # 仅当目标文件 staged 时才检查
 *
 * 退出码:
 *   0 - 通过
 *   1 - 浮层组件含 hardcode 颜色 (视为回归)
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const clientRoot = join(__dirname, '..')

// 被守门的样式文件清单 (浮层组件 background-color 集中定义处)
const TARGET_FILES = [
  'src/styles/_element-plus-overrides.scss',
  'src/styles/_el-message-box.scss',
  'src/styles/_el-message-global.scss',
  'src/styles/_session-expired-notification.scss',
]

// 6 类浮层组件选择器 (用于定位规则块)
// 注: .el-popper 用 .el-popper.el-dropdown-menu__popper 子类, 因为 .el-popper.is-dark
//     是 Element Plus 设计的反差 tooltip (暗色下背景=浅色文字色), 不属于"浮层底色统一"范畴
const OVERLAY_SELECTORS = [
  '.el-message-box',
  '.el-notification',
  '.el-dialog',
  '.el-message', // 注意: 必须在 .el-message-box 之后匹配, 防止前缀误匹配
  '.el-popper.el-dropdown-menu__popper',
  '.el-dropdown-menu',
]

// hardcode 颜色检测正则 (允许 var(), 禁止 #xxx / rgb / white / black 等)
const HARDCODE_COLOR_RE = /(?:background|background-color)\s*:\s*(#[0-9a-fA-F]{3,8}\b|rgb[a]?\s*\(|\bwhite\b|\bblack\b|\bred\b|\bgreen\b|\bblue\b|\byellow\b|\borange\b|\bgray\b|\bgrey\b)/i

const onlyStaged = process.argv.includes('--staged')

if (onlyStaged) {
  try {
    const staged = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: clientRoot,
      encoding: 'utf-8',
    })
    const stagedFiles = staged.split('\n').map((s) => s.trim()).filter(Boolean)
    const anyStaged = TARGET_FILES.some((f) => stagedFiles.includes(f))
    if (!anyStaged) {
      process.exit(0)
    }
  } catch {
    // git 不可用, 退回到全量检查
  }
}

const errors = []

for (const relPath of TARGET_FILES) {
  const absPath = join(clientRoot, relPath)
  if (!existsSync(absPath)) {
    // 文件不存在不视为错误 (可能是新增文件名变化), 仅警告
    console.warn(`[WARN] 文件不存在, 跳过: ${relPath}`)
    continue
  }
  const scss = readFileSync(absPath, 'utf-8')

  // 简化做法: 找到每个浮层组件选择器出现的位置, 取其后 1500 字符的"规则块上下文",
  // 检查其中是否有 hardcode 颜色 (background / background-color 属性)
  // 注: 这种简化匹配可能误报嵌套规则块内的 hardcode, 但比解析 SCSS AST 更轻量
  //     且对当前文件结构 (浮层组件规则块紧邻 selector) 适用
  for (const selector of OVERLAY_SELECTORS) {
    // 转义 selector 中的点
    const selEscaped = selector.replace(/\./g, '\\.')
    // 找所有 selector 出现位置 (允许 :where() 包裹)
    const re = new RegExp(`(:where\\(\\s*)?${selEscaped}(\\s*,\\s*[.a-zA-Z-]+)*\\s*\\)?\\s*\\{`, 'g')
    let match
    while ((match = re.exec(scss)) !== null) {
      const startIdx = match.index + match[0].length
      // 取后 1500 字符 (足够覆盖一个规则块, 不会误跨到下一个浮层组件)
      const ctx = scss.slice(startIdx, startIdx + 1500)
      // 找到匹配的右大括号 (考虑嵌套)
      let depth = 1
      let blockEnd = -1
      for (let i = 0; i < ctx.length; i++) {
        if (ctx[i] === '{') depth++
        else if (ctx[i] === '}') {
          depth--
          if (depth === 0) {
            blockEnd = i
            break
          }
        }
      }
      if (blockEnd === -1) continue
      const blockContent = ctx.slice(0, blockEnd)

      // 检查 blockContent 是否含 hardcode 颜色
      const hardcodeMatch = blockContent.match(HARDCODE_COLOR_RE)
      if (hardcodeMatch) {
        // 找到 hardcode 颜色所在的行号 (从 startIdx 计算)
        const lineStart = scss.slice(0, startIdx).split('\n').length
        const offsetInBlock = blockContent.indexOf(hardcodeMatch[0])
        const linesInBlock = blockContent.slice(0, offsetInBlock).split('\n').length - 1
        const lineNum = lineStart + linesInBlock
        errors.push(
          `${relPath}:${lineNum} 浮层组件 ${selector} 规则块内含 hardcode 颜色 "${hardcodeMatch[0]}"\n` +
            `  浮层底色必须用 var(--el-bg-color) / var(--el-bg-color-overlay) (允许带 fallback: var(--el-bg-color-overlay, #1a1a1a))\n` +
            `  禁止 hardcode: #xxx / rgb(...) / rgba(...) / white / black 等`,
        )
      }
    }
  }
}

if (errors.length > 0) {
  console.error('[FAIL] 暗色浮层底色统一硬约束守门失败:')
  for (const err of errors) {
    console.error(`  - ${err}`)
  }
  console.error('')
  console.error('修复: 把浮层组件的 background-color / background 改为 var(--el-bg-color) 或 var(--el-bg-color-overlay)')
  console.error('  允许带 fallback: var(--el-bg-color-overlay, #1a1a1a)')
  console.error('参考: e2e/dark-overlay-bg-color-unified.spec.ts (源码级断言)')
  process.exit(1)
}

console.log(`[OK] 暗色浮层底色统一硬约束守门通过 (${TARGET_FILES.length} 个文件, ${OVERLAY_SELECTORS.length} 类浮层组件, 0 处 hardcode 颜色)`)
