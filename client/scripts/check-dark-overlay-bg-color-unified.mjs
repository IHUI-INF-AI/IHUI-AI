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
  'src/styles/_dark-mode-global.scss', // 2026-07-04 新增: 锚定暗色 --el-bg-color = --color-dark-bg-3
  'src/styles/element-plus-vars.scss', // 2026-07-04 新增: 锚定暗色 --el-bg-color = --color-dark-bg-3
  'src/styles/dark-mode-override.scss', // 2026-07-04 新增: 锚定暗色 --el-bg-color = --color-dark-bg-3
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
  // 注: 跳过嵌套规则块内的 hardcode (2026-07-04 修复)
  //   之前是粗略检查整个 outer block 文本, 会把 .el-message-box--error 嵌套块里的
  //   #281414 (错误态红色调) 当成浮层主底色误报
  //   现在只取 outer block 在 depth 1 的内容 (即 immediate 属性), 嵌套块内容被排除
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

      // 2026-07-04 修复: 只取 immediate block 内容, 跳过嵌套块
      // immediate 内容 = depth 1 区间的字符 (即 outer { 之后, 第一个 { 之前)
      let immediateContent = ''
      let iDepth = 1
      for (let i = 0; i < blockContent.length; i++) {
        if (blockContent[i] === '{') {
          // 进入嵌套块, 停止收集
          break
        }
        immediateContent += blockContent[i]
      }

      // 检查 immediateContent 是否含 hardcode 颜色
      const hardcodeMatch = immediateContent.match(HARDCODE_COLOR_RE)
      if (hardcodeMatch) {
        // 找到 hardcode 颜色所在的行号 (从 startIdx 计算)
        const lineStart = scss.slice(0, startIdx).split('\n').length
        const offsetInBlock = immediateContent.indexOf(hardcodeMatch[0])
        const linesInBlock = immediateContent.slice(0, offsetInBlock).split('\n').length - 1
        const lineNum = lineStart + linesInBlock
        errors.push(
          `${relPath}:${lineNum} 浮层组件 ${selector} immediate 规则块内含 hardcode 颜色 "${hardcodeMatch[0]}"\n` +
            `  浮层底色必须用 var(--el-bg-color) / var(--el-bg-color-overlay) (允许带 fallback: var(--el-bg-color-overlay, #1a1a1a))\n` +
            `  禁止 hardcode: #xxx / rgb(...) / rgba(...) / white / black 等\n` +
            `  注: 嵌套块 (如 .el-message-box--error 错误态) 不在守门范围内`,
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

// 锚定检查 (2026-07-04 新增): 暗色下 --el-bg-color / --el-bg-color-overlay 必须 = --color-dark-bg-3
//   目的: 显式锁死"暗色浮层底色 = #1a1a1a"的关系, 防止 --el-bg-color 在未来被重定义为别的值
//         破坏浮层内 primary 按钮的 4.5:1 对比度
//   范围: _dark-mode-global.scss, element-plus-vars.scss, dark-mode-override.scss
const DARK_BG_ANCHOR_FILES = [
  'src/styles/_dark-mode-global.scss',
  'src/styles/element-plus-vars.scss',
  'src/styles/dark-mode-override.scss',
]

const anchorErrors = []
for (const relPath of DARK_BG_ANCHOR_FILES) {
  const absPath = join(clientRoot, relPath)
  if (!existsSync(absPath)) {
    // 文件不存在不视为错误, 仅警告 (可能是新增文件名变化)
    continue
  }
  const scss = readFileSync(absPath, 'utf-8')

  // 找到 html.dark 块 (或 .dark 选择器块)
  const darkBlockMatch = scss.match(/(?:^|\n)\s*(?::where\()?html\.dark\s*(?:\))?\s*\{[\s\S]*?^\s*\}/m)
  if (!darkBlockMatch) continue

  const darkBlock = darkBlockMatch[0]
  // 检查 --el-bg-color 必须用 --color-dark-bg-3 (允许 fallback)
  // 禁止: #0d0d0d / #1a1a1a / #ffffff / #2a2a2a 等 hardcode
  // 允许: var(--color-dark-bg-3) / var(--color-dark-bg-3, #1a1a1a)
  const elBgColorInDark = darkBlock.match(/--el-bg-color\s*:\s*([^;]+);/)
  if (elBgColorInDark) {
    const value = elBgColorInDark[1].trim()
    if (!/var\(\s*--color-dark-bg-3\b/.test(value)) {
      anchorErrors.push(
        `${relPath} 暗色块 --el-bg-color 必须用 var(--color-dark-bg-3) 锚定暗色浮层底色\n` +
          `  当前值: ${value}\n` +
          `  期望: var(--color-dark-bg-3) 或 var(--color-dark-bg-3, #1a1a1a)\n` +
          `  防止 --el-bg-color 在未来被重定义, 破坏浮层内 primary 按钮 4.5:1 对比度`,
      )
    }
  }

  // 检查 --el-bg-color-overlay 也必须用 --color-dark-bg-3
  const elBgColorOverlayInDark = darkBlock.match(/--el-bg-color-overlay\s*:\s*([^;]+);/)
  if (elBgColorOverlayInDark) {
    const value = elBgColorOverlayInDark[1].trim()
    if (!/var\(\s*--color-dark-bg-3\b/.test(value)) {
      anchorErrors.push(
        `${relPath} 暗色块 --el-bg-color-overlay 必须用 var(--color-dark-bg-3) 锚定暗色浮层底色\n` +
          `  当前值: ${value}\n` +
          `  期望: var(--color-dark-bg-3) 或 var(--color-dark-bg-3, #1a1a1a)\n` +
          `  防止 --el-bg-color-overlay 在未来被重定义, 破坏浮层内 primary 按钮 4.5:1 对比度`,
      )
    }
  }
}

if (anchorErrors.length > 0) {
  console.error('[FAIL] 暗色浮层底色 = #1a1a1a 锚定检查失败:')
  for (const err of anchorErrors) {
    console.error(`  - ${err}`)
  }
  console.error('')
  console.error('修复: 把 _dark-mode-global.scss / element-plus-vars.scss / dark-mode-override.scss 中')
  console.error('  html.dark 块的 --el-bg-color / --el-bg-color-overlay 改为:')
  console.error('    --el-bg-color: var(--color-dark-bg-3);')
  console.error('    --el-bg-color-overlay: var(--color-dark-bg-3);')
  console.error('  这样保证暗色浮层底色统一锚定在 #1a1a1a, 浮层内 primary 按钮保持 4.5:1 对比度')
  process.exit(1)
}

console.log(`[OK] 暗色浮层底色统一硬约束守门通过 (${TARGET_FILES.length} 个文件, ${OVERLAY_SELECTORS.length} 类浮层组件, 0 处 hardcode 颜色, 暗色锚定 --color-dark-bg-3 通过)`)
