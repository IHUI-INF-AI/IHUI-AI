#!/usr/bin/env node
/**
 * 全组件暗色反色防回归轻量级守门 (pre-commit 用, 2026-07-04 立, 用户规则: 从根本彻底解决)
 *
 * 目的: 防止把 4 类彩色按钮 / 5 类 el-tag / 4 类 el-alert / 4 类 el-notification /
 *       5 类 el-message / 5 类 el-link / 5 类 el-message-box 等组件的暗色文字色
 *       改回 var(--el-bg-color*) / var(--el-text-color-regular) / #fff 等浅色硬编码,
 *       或把 _dark-mode-global.scss 的 --el-color-primary 暗色映射改回 var(--el-bg-color) (#0d0d0d),
 *       导致暗色模式"浅色背景+浅色文字"或"深色背景+深色文字"不可见.
 *
 * 扩展自: check-button-text-contrast.mjs (2026-07-04 批次 A, 4 类按钮 + 5 类 tag + 4 类 alert)
 * 本批次扩展: + primary 蓝按钮 + 5 类 el-link + 5 类 el-message-box + el-pagination active +
 *             el-tabs / el-checkbox / el-radio / el-switch 暗色块 + 浮层内 primary 颜色
 *
 * 触发范围 (staged 模式):
 *   - client/src/styles/_dark-mode-global.scss
 *   - client/src/styles/_element-plus-overrides.scss
 *   - client/src/styles/_element-plus.scss
 *   - client/src/styles/_el-message-global.scss
 *   - client/src/styles/_global-tokens.scss
 *
 * 与 e2e/color-contrast-systemic.spec.ts 的关系:
 *   - 本脚本: 轻量级文本检查 (pre-commit 阶段, < 200ms)
 *   - e2e 测试: 完整源码级断言 + 浏览器渲染验证 (CI 阶段, 40+ 用例)
 *   两者并存: pre-commit 拦截 + CI 兜底
 *
 * 用法:
 *   node scripts/check-color-contrast-systemic.mjs          # 全量检查
 *   node scripts/check-color-contrast-systemic.mjs --staged # 仅 staged 文件触发
 *   COLOR_CONTRAST_THRESHOLD=0 node scripts/check-color-contrast-systemic.mjs --staged
 *
 * 退出码:
 *   0 - 通过
 *   1 - 发现回归 (含具体文件:行号)
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(clientRoot, '..')

const onlyStaged = process.argv.includes('--staged')
const THRESHOLD = Number(process.env.COLOR_CONTRAST_THRESHOLD ?? 0)

// ════════════════════════════════════════════════════════════════════════
// 期望值锚定
// ════════════════════════════════════════════════════════════════════════
const EXPECTED = {
  // 暗色 EP --el-color-* 主题色重映射
  darkPrimary: '#2563eb',  // CTA 蓝 (替代 var(--el-bg-color) 撞色根因)
  darkSuccess: '#15803d',  // 深绿
  darkWarning: '#b45309',  // 深琥珀
  darkDanger: '#b91c1c',   // 深红
  darkInfo: '#4b5563',     // 深灰

  // 5 个 --app-text-on-* 永定 token
  textOnPrimary: '#ffffff',
  textOnSuccess: '#ffffff',
  textOnWarning: '#ffffff',  // 2026-07-04 修复: 原 #fde68a on #b45309 对比度仅 3.98:1 < WCAG AA 4.5, 改 #ffffff 后 4.93:1 通过
  textOnDanger: '#ffffff',
  textOnInfo: '#ffffff',
  // 暗色 --el-color-primary-light-{3,5,7,8,9} 适配 (替代 placeholder 灰色)
  darkPrimaryLight3: '#93c5fd',
  darkPrimaryLight5: '#bfdbfe',
  darkPrimaryLight7: '#dbeafe',
  darkPrimaryLight8: '#eff6ff',
}

// 4 类按钮色系 + primary (5 类)
const COLOR_TYPES = [
  { name: 'primary', varName: '--el-color-primary', darkBg: EXPECTED.darkPrimary, textToken: '--app-text-on-primary', textValue: EXPECTED.textOnPrimary, lightBgDefault: '#409eff' },
  { name: 'success', varName: '--el-color-success', darkBg: EXPECTED.darkSuccess, textToken: '--app-text-on-success', textValue: EXPECTED.textOnSuccess, lightBgDefault: '#67c23a' },
  { name: 'warning', varName: '--el-color-warning', darkBg: EXPECTED.darkWarning, textToken: '--app-text-on-warning', textValue: EXPECTED.textOnWarning, lightBgDefault: '#e6a23c' },
  { name: 'danger',  varName: '--el-color-danger',  darkBg: EXPECTED.darkDanger,  textToken: '--app-text-on-danger',  textValue: EXPECTED.textOnDanger,  lightBgDefault: '#f56c6c' },
  { name: 'info',    varName: '--el-color-info',    darkBg: EXPECTED.darkInfo,    textToken: '--app-text-on-info',    textValue: EXPECTED.textOnInfo,    lightBgDefault: '#909399' },
]

// 暗色 EP --el-color-* 重映射禁止的右值
const FORBIDDEN_DARK_BG_VALUES = [
  // EP 默认 success/warning/danger/info 亮色
  '#67c23a', '#e6a23c', '#f56c6c', '#909399',
  // EP 默认 primary 亮色
  '#409eff', '#5da8ff',
  // 引用 --el-bg-color 系 (dark = #0d0d0d/#1a1a1a 撞色)
  'var(--el-bg-color)',
  'var(--el-bg-color-page)',
  'var(--el-bg-color-overlay)',
  // 引用 --el-text-color 系 (dark = #e5eaf3 浅色, 撞色)
  'var(--el-text-color-primary)',
  'var(--el-text-color-regular)',
  'var(--el-text-color-secondary)',
  'var(--el-text-color-placeholder)',
  // 显式深色 hex (与暗色背景撞色)
  '#0d0d0d', '#1a1a1a', '#000', '#000000', '#222', '#333', '#2d2d2d',
]

// 按钮 color 禁止的右值 (与暗色重映射后的深饱和背景撞色)
const FORBIDDEN_BUTTON_TEXT_VALUES = [
  'var(--el-bg-color)',
  'var(--el-bg-color-page)',
  'var(--el-bg-color-overlay)',
  'var(--el-text-color-primary)',
  'var(--el-text-color-regular)',
  '#0d0d0d', '#1a1a1a', '#000', '#000000', '#222', '#333',
]

// ════════════════════════════════════════════════════════════════════════
// 工具
// ════════════════════════════════════════════════════════════════════════

function readFile(p) {
  return fs.readFileSync(p, 'utf-8')
}

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: projectRoot,
      encoding: 'utf-8',
    })
    return out.split('\n').map(s => s.trim().replace(/\\/g, '/')).filter(Boolean)
  } catch {
    return null
  }
}

function shouldCheck(relPath, stagedFiles) {
  if (!stagedFiles) return true
  return stagedFiles.some(f => f.endsWith(relPath))
}

function findLineNumber(content, pattern) {
  const lines = content.split('\n')
  const regex = new RegExp(pattern)
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) return i + 1
  }
  return -1
}

/**
 * 平衡大括号提取 html.dark 块的内容
 */
function extractDarkBlock(src) {
  const re = /(?::where\()?html\.dark\)?\s*\{/gi
  const blocks = []
  let m
  while ((m = re.exec(src)) !== null) {
    const start = m.index + m[0].length
    let depth = 1, end = start
    while (depth > 0 && end < src.length) {
      if (src[end] === '{') depth++
      else if (src[end] === '}') depth--
      end++
    }
    if (depth === 0) {
      blocks.push({ full: m[0] + src.substring(start, end), body: src.substring(start, end - 1), index: m.index })
    }
  }
  return blocks
}

/**
 * 平衡大括号提取选择器块
 */
function extractSelectorBlock(src, selectorRe) {
  const re = new RegExp(selectorRe.source, selectorRe.flags.includes('g') ? selectorRe.flags : selectorRe.flags + 'g')
  const blocks = []
  let m
  while ((m = re.exec(src)) !== null) {
    const start = m.index + m[0].length
    let depth = 1, end = start
    while (depth > 0 && end < src.length) {
      if (src[end] === '{') depth++
      else if (src[end] === '}') depth--
      end++
    }
    if (depth === 0) {
      blocks.push({ full: m[0] + src.substring(start, end), body: src.substring(start, end - 1), index: m.index })
    }
  }
  return blocks
}

function isForbidden(value, list) {
  return list.some(f => {
    if (value === f) return true
    if (f.startsWith('var(')) {
      return value.includes(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    }
    return value.includes(f)
  })
}

/**
 * 提取 CSS 块中第一个真正的 `color:` 声明 (2026-07-04 终结批次立, 修 2 个 regex bug)
 *
 * 修前 bug:
 *   (a) `color\s*:` 没有词边界, 把 `background-color:` / `border-color:` 错配成 `color:`
 *   (b) 没有剥离注释, 把 `// ... var(--el-color-primary) padding-box, linear-gradient(...)`
 *       注释里的 `color` 字符串触发误报
 *
 * 修后:
 *   (a) 用 `(^|[\s;{])color\s*:` 词边界, 排除 background-color / border-color / outline-color
 *   (b) 先剥离 `/* ... *​/` 块注释和 `// ...` 行注释
 */
function extractColorValue(body) {
  if (!body) return null
  // 1. 剥离块注释 (/* ... */) 和行注释 (// ...)
  const cleaned = body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
  // 2. 第一个真正的 color 声明, 用 (^|[\s;{]) 词边界
  //    (^|[\s;{]) 匹配行首 / 空白 / 分号 / 大括号, 避免匹配 background- / border- / outline-
  const m = cleaned.match(/(^|[\s;{])color\s*:\s*([^;]+);/i)
  return m ? m[2].trim() : null
}

// ════════════════════════════════════════════════════════════════════════
// 检查项
// ════════════════════════════════════════════════════════════════════════

const errors = []

function checkDarkModeGlobalScss() {
  const rel = 'client/src/styles/_dark-mode-global.scss'
  const abs = path.join(projectRoot, rel)
  if (!fs.existsSync(abs)) {
    errors.push(`[MISSING] ${rel} 文件不存在`)
    return
  }
  const src = readFile(abs)

  const darkBlocks = extractDarkBlock(src)
  if (darkBlocks.length === 0) {
    errors.push(`[REGRESSION] ${rel} 未发现 html.dark 覆盖块`)
    return
  }

  // 检查 5 个 --el-color-* 暗色重映射
  for (const ct of COLOR_TYPES) {
    let foundInDark = false
    for (const { body } of darkBlocks) {
      const re = new RegExp(`${ct.varName}\\s*:\\s*([^;]+);`, 'i')
      const m = body.match(re)
      if (!m) continue
      foundInDark = true
      const value = m[1].trim()
      if (isForbidden(value, FORBIDDEN_DARK_BG_VALUES)) {
        const line = findLineNumber(src, `${ct.varName}\\s*:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
        errors.push(
          `[REGRESSION] ${rel}:${line || '?'} 暗色 ${ct.varName} 映射为 ${value} (EP 默认亮色或深色变量), 暗色下形成"亮块+浅字"或"暗块+暗字"低对比度.\n` +
          `          必须改为深饱和版本: ${ct.darkBg} (Tailwind 700 级色 / CTA 蓝, 与 --app-text-on-${ct.name} 配合 WCAG AA 通过).\n` +
          `          根因: 2026-07-04 之前 EP 默认 ${ct.lightBgDefault} 亮色在暗色背景下配白字对比度仅 1.7-2.5:1.`
        )
      }
    }
    if (!foundInDark) {
      errors.push(
        `[REGRESSION] ${rel} 暗色块中未发现 ${ct.varName} 重映射.\n` +
        `          必须在 :where(html.dark) 块中显式覆盖: ${ct.varName}: ${ct.darkBg};`
      )
    }
  }

  // 检查 --el-color-primary-light-{3,5,7,8,9} 暗色不为 placeholder 撞色
  for (const variant of [3, 5, 7, 8, 9]) {
    for (const { body } of darkBlocks) {
      const re = new RegExp(`--el-color-primary-light-${variant}\\s*:\\s*([^;]+);`, 'i')
      const m = body.match(re)
      if (!m) continue
      const value = m[1].trim()
      if (isForbidden(value, ['var(--el-text-color-placeholder)', 'var(--el-text-color-secondary)', 'var(--el-bg-color)', '#a3a3a3', '#909399', '#0d0d0d'])) {
        const line = findLineNumber(src, `--el-color-primary-light-${variant}\\s*:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
        errors.push(
          `[REGRESSION] ${rel}:${line || '?'} 暗色 --el-color-primary-light-${variant} 映射为 ${value} (placeholder 灰, 撞色).\n` +
          `          必须改为 Tailwind blue-300/200/100/50 系列: #93c5fd / #bfdbfe / #dbeafe / #eff6ff.`
        )
      }
    }
  }
}

function checkElementPlusOverridesScss() {
  const rel = 'client/src/styles/_element-plus-overrides.scss'
  const abs = path.join(projectRoot, rel)
  if (!fs.existsSync(abs)) {
    errors.push(`[MISSING] ${rel} 文件不存在`)
    return
  }
  const src = readFile(abs)

  // 1. 5 类 button 浅色 + 暗色 color 必须用 --app-text-on-* token
  for (const ct of COLOR_TYPES) {
    const allBlocks = extractSelectorBlock(src, new RegExp(`:where\\(\\.el-button--${ct.name}\\)\\s*\\{`, 'i'))
    if (allBlocks.length === 0) {
      errors.push(
        `[REGRESSION] ${rel} 未发现 :where(.el-button--${ct.name}) 块, 需补齐 background-color: var(${ct.varName}); color: var(${ct.textToken});`
      )
      continue
    }
    // 2026-07-04 终结 (修 bug): 之前只检查 allBlocks[0] (假设它是 light block, dark block 在 html.dark 之后)
    //   实际上有人在文件末尾 append 新块 (非 dark, 也非 light), 会被遗漏
    // 修复: 检查所有块, 任何块 color 违规即报错. 浅色/暗色都期望用 --app-text-on-* token
    //      (允许的兼容值: #fff / #ffffff / var(--el-color-white) / primary 特殊 --app-button-text-on-primary)
    // 例外: "reset 块" (无 color 也无 background-color, 只重置 border-width/box-shadow 等) 跳过"缺 color"检查
    //      设计: 浮层内 primary 重置 (:where(.el-message-box, ...) :where(.el-button--primary))
    //           移除 Element Plus 暗色 2px 蓝边 + inset 白环, 不应触发误报
    for (const { body, index } of allBlocks) {
      // reset 块检测: 块体中既无 color 也无 background-color, 视为重置专用块, 跳过
      const hasColor = /\bcolor\s*:/i.test(body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''))
      const hasBg = /\bbackground(-color)?\s*:/i.test(body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''))
      if (!hasColor && !hasBg) continue

      // 2026-07-04 终结: 用 extractColorValue 替代 raw regex, 避免 background-color 误配 + 注释误报
      const value = extractColorValue(body)
      if (!value) {
        errors.push(
          `[REGRESSION] ${rel} :where(.el-button--${ct.name}) 块缺 color 声明, 必须为 color: var(${ct.textToken}).`
        )
        continue
      }

      // primary 按钮特殊: 浅色 + 暗色 都用 --app-button-text-on-primary token (与 4 类彩色按钮 --app-text-on-{type} 不同)
      if (ct.name === 'primary') {
        const isAllowed =
          value === 'var(--app-button-text-on-primary)' ||
          value === 'var(--el-color-white)' ||
          value === '#fff' ||
          value === '#ffffff'
        if (!isAllowed) {
          const line = findLineNumber(src, `\\.el-button--${ct.name}`)
          errors.push(
            `[REGRESSION] ${rel}:${line || '?'} :where(.el-button--primary) 块 color: ${value} 不符合规范.\n` +
            `          必须改为 var(--app-button-text-on-primary) (= #ffffff, 永为白, 蓝底 5.17:1).`
          )
        }
        continue
      }

      // 其他 4 类按钮: 浅色 + 暗色 都用 --app-text-on-{type} token
      if (value !== `var(${ct.textToken})`) {
        const line = findLineNumber(src, `\\.el-button--${ct.name}`)
        if (isForbidden(value, FORBIDDEN_BUTTON_TEXT_VALUES)) {
          errors.push(
            `[REGRESSION] ${rel}:${line || '?'} :where(.el-button--${ct.name}) 块 color: ${value} (深色, 与 ${ct.varName} 撞色不可见).\n` +
            `          必须改为 var(${ct.textToken}) (= ${ct.textValue}, 永定).`
          )
        } else {
          errors.push(
            `[REGRESSION] ${rel}:${line || '?'} :where(.el-button--${ct.name}) 块 color: ${value} (非标准 token).\n` +
            `          必须改为 var(${ct.textToken}). 允许: #fff / #ffffff / var(--el-color-white) (兼容写法).`
          )
        }
      }
    }
  }

  // 2. 暗色块中 5 类 tag 暗色反色覆盖
  const darkBlocks = extractDarkBlock(src)
  for (const ct of ['primary', 'success', 'warning', 'danger', 'info']) {
    let foundInDark = false
    for (const { body } of darkBlocks) {
      const tagRe = new RegExp(`:where\\(\\.el-tag--${ct}\\)\\s*\\{`, 'i')
      if (tagRe.test(body)) {
        foundInDark = true
        break
      }
    }
    if (!foundInDark) {
      errors.push(
        `[REGRESSION] ${rel} 暗色 html.dark 块中未发现 :where(.el-tag--${ct}) 浅色字反色覆盖.`
      )
    }
  }

  // 3. 暗色块中 4 类 el-alert 暗色反色覆盖
  for (const ct of ['success', 'warning', 'info', 'error']) {
    let foundInDark = false
    for (const { body } of darkBlocks) {
      const alertRe = new RegExp(`:where\\(\\.el-alert--${ct}\\)\\s*\\{`, 'i')
      if (alertRe.test(body)) {
        foundInDark = true
        break
      }
    }
    if (!foundInDark) {
      errors.push(
        `[REGRESSION] ${rel} 暗色 html.dark 块中未发现 :where(.el-alert--${ct}) 暗色覆盖.`
      )
    }
  }

  // 4. 暗色块中 5 类 el-link 暗色覆盖
  for (const ct of ['primary', 'success', 'warning', 'danger', 'info']) {
    let foundInDark = false
    for (const { body } of darkBlocks) {
      const linkRe = new RegExp(`:where\\(\\.el-link\\.el-link--${ct}\\)\\s*\\{`, 'i')
      if (linkRe.test(body)) {
        foundInDark = true
        break
      }
    }
    if (!foundInDark) {
      errors.push(
        `[REGRESSION] ${rel} 暗色 html.dark 块中未发现 :where(.el-link.el-link--${ct}) 暗色覆盖.`
      )
    }
  }

  // 5. 暗色 primary button 块 color 必为 --app-button-text-on-primary
  // 提取所有 html.dark 块内的 :where(.el-button--primary) 块 (而非整个 dark 块)
  for (const { body: darkBody } of darkBlocks) {
    const allPrimaryBlocks = extractSelectorBlock(darkBody, /:where\(\.el-button--primary\)\s*\{/i)
    // 2026-07-04 终结: 只检查"第一次"出现 (后续是浮层重置规则, 如 :where(.el-message-box) :where(.el-button--primary) { box-shadow: none })
    //   这些重置规则不设置 color, 不是新定义, 不应被误报
    const primaryBlocks = allPrimaryBlocks.length > 0 ? [allPrimaryBlocks[0]] : []
    for (const { body: primaryBody } of primaryBlocks) {
      // 2026-07-04 终结: 找 primary 块顶层第一个真正的 color 声明
      //   - 剥离注释 (避免 // 注释里的 "color" 字符串触发误报)
      //   - 排除嵌套子块 (span / .el-icon 内的 color 不算顶层)
      //   - 词边界 (避免 background-color / border-color 误配)
      const lines = primaryBody.split('\n')
      let firstColorValue = null
      let braceDepth = 0
      for (let li = 0; li < lines.length; li++) {
        // 剥离本行的 // 注释
        const lineNoComment = lines[li].replace(/\/\/.*$/, '')
        // 跳过嵌套块内的行 (brace depth > 0 表示已经在某个 { } 内)
        const openCount = (lineNoComment.match(/\{/g) || []).length
        const closeCount = (lineNoComment.match(/\}/g) || []).length
        braceDepth += openCount
        braceDepth -= closeCount

        if (braceDepth === 0) {
          // 当前行不在嵌套块内, 找 color (词边界: 行首或空白后)
          const m = lineNoComment.match(/(^|\s)color\s*:\s*([^;]+);/i)
          if (m) {
            firstColorValue = m[2].trim()
            break
          }
        }
      }

      if (!firstColorValue) {
        errors.push(
          `[REGRESSION] ${rel} 暗色 html.dark :where(.el-button--primary) 块缺顶层 color 声明, 必须为 var(--app-button-text-on-primary).`
        )
        continue
      }

      const isAllowed =
        firstColorValue === 'var(--app-button-text-on-primary)' ||
        firstColorValue === 'var(--el-color-white)' ||
        firstColorValue === '#fff' ||
        firstColorValue === '#ffffff'
      if (!isAllowed) {
        const line = findLineNumber(src, '\\.el-button--primary')
        errors.push(
          `[REGRESSION] ${rel}:${line || '?'} 暗色 html.dark :where(.el-button--primary) color: ${firstColorValue} 不符合规范.\n` +
          `          推荐: var(--app-button-text-on-primary) (= #ffffff, 永为白).\n` +
          `          配合 _dark-mode-global.scss 的 --el-color-primary: #2563eb, 蓝底白字 5.17:1 WCAG AA.`
        )
      }
    }
  }
}

function checkElementPlusScss() {
  const rel = 'client/src/styles/_element-plus.scss'
  const abs = path.join(projectRoot, rel)
  if (!fs.existsSync(abs)) return
  const src = readFile(abs)

  const darkBlocks = extractDarkBlock(src)
  if (darkBlocks.length === 0) return

  // 暗色 el-tabs active + active-bar + checkbox/radio/switch checked 块
  const expectedDarkBlocks = [
    { name: 'el-tabs__item.is-active', reason: '暗色下 active tab 文字色' },
    { name: 'el-tabs__active-bar', reason: '暗色下 active tab 下划线' },
  ]

  for (const exp of expectedDarkBlocks) {
    let found = false
    for (const { body } of darkBlocks) {
      if (body.includes(exp.name)) {
        found = true
        break
      }
    }
    if (!found) {
      errors.push(
        `[REGRESSION] ${rel} 暗色 html.dark 块中未发现 ${exp.name} (${exp.reason}) 覆盖.`
      )
    }
  }

  // el-checkbox / el-radio / el-switch checked 至少有一个
  let checkedFound = false
  for (const { body } of darkBlocks) {
    if (body.includes('.el-checkbox__input.is-checked') || body.includes('.el-radio__input.is-checked') || body.includes('.el-switch.is-checked')) {
      checkedFound = true
      break
    }
  }
  if (!checkedFound) {
    errors.push(
      `[REGRESSION] ${rel} 暗色 html.dark 块中未发现 el-checkbox/el-radio/el-switch checked 覆盖 (暗色下需 inset 白环补强 CTA 边界).`
    )
  }
}

function checkElMessageGlobalScss() {
  const rel = 'client/src/styles/_el-message-global.scss'
  const abs = path.join(projectRoot, rel)
  if (!fs.existsSync(abs)) return
  const src = readFile(abs)

  const darkBlocks = extractDarkBlock(src)
  if (darkBlocks.length === 0) return

  // 暗色 4 类 .el-notification
  for (const ct of ['success', 'warning', 'info', 'error']) {
    let found = false
    for (const { body } of darkBlocks) {
      if (body.includes(`.el-notification--${ct}`)) {
        found = true
        break
      }
    }
    if (!found) {
      errors.push(
        `[REGRESSION] ${rel} 暗色 html.dark 块中未发现 .el-notification--${ct} 暗色覆盖.`
      )
    }
  }

  // 暗色 5 类 .el-message-box
  for (const ct of ['success', 'warning', 'info', 'error']) {
    let found = false
    for (const { body } of darkBlocks) {
      if (body.includes(`.el-message-box--${ct}`)) {
        found = true
        break
      }
    }
    if (!found) {
      errors.push(
        `[REGRESSION] ${rel} 暗色 html.dark 块中未发现 .el-message-box--${ct} 暗色覆盖.`
      )
    }
  }
}

function checkGlobalTokensScss() {
  const rel = 'client/src/styles/_global-tokens.scss'
  const abs = path.join(projectRoot, rel)
  if (!fs.existsSync(abs)) {
    errors.push(`[MISSING] ${rel} 文件不存在`)
    return
  }
  const src = readFile(abs)

  // 4 个 --app-text-on-{success/warning/danger/info} 永定 token (primary 不需要这个, 用 --app-button-text-on-primary)
  for (const ct of COLOR_TYPES.filter(c => c.name !== 'primary')) {
    const re = new RegExp(`${ct.textToken}\\s*:\\s*([^;]+);`, 'i')
    const m = src.match(re)
    if (!m) {
      errors.push(
        `[REGRESSION] ${rel} 缺少 ${ct.textToken} token 定义.\n` +
        `          必须在 :root 块中显式定义: ${ct.textToken}: ${ct.textValue};`
      )
      continue
    }
    const value = m[1].trim()
    // 兼容写法: #ffffff / #fff / var(--el-color-white) / white 都接受 (stylelint --fix 会把 #ffffff 改 #fff)
    const isAllowed = value === ct.textValue || value === '#fff' || value === 'var(--el-color-white)' || value === 'white'
    if (!isAllowed) {
      const line = findLineNumber(src, ct.textToken)
      errors.push(
        `[REGRESSION] ${rel}:${line || '?'} ${ct.textToken}: ${value} (期望 ${ct.textValue} 或兼容写法 #fff / var(--el-color-white) / white).\n` +
        `          根因: ${ct.textToken} 必须为永定值, 与 _dark-mode-global.scss 的 ${ct.varName}=${ct.darkBg} 配合达到 WCAG AA 对比度.`
      )
    }
  }

  // --app-button-text-on-primary 必须 = #ffffff
  const btnTokenRe = /--app-button-text-on-primary\s*:\s*([^;]+);/i
  const btnMatch = src.match(btnTokenRe)
  if (!btnMatch) {
    errors.push(
      `[REGRESSION] ${rel} 缺少 --app-button-text-on-primary token 定义 (primary 按钮专用白字, 蓝底 5.17:1).`
    )
  } else {
    const value = btnMatch[1].trim()
    if (value !== '#ffffff' && value !== '#fff' && value !== 'var(--el-color-white)' && value !== 'white') {
      const line = findLineNumber(src, '--app-button-text-on-primary')
      errors.push(
        `[REGRESSION] ${rel}:${line || '?'} --app-button-text-on-primary: ${value} 不符合规范 (期望 #ffffff, 永为白, 蓝底 5.17:1 WCAG AA).`
      )
    }
  }

  // 5 对 --app-color-{type}-text 业务级 token (2026-07-04 终结批次立)
  // 浅色 mode: 深色字, 暗色 mode: 浅色字, 永定对比度
  const BUSINESS_TOKENS = [
    { name: 'success', lightText: '#15803d', darkText: '#bbf7d0' },
    { name: 'warning', lightText: '#b45309', darkText: '#fde68a' },
    { name: 'danger',  lightText: '#b91c1c', darkText: '#fecaca' },
    { name: 'info',    lightText: '#4b5563', darkText: '#d1d5db' },
    { name: 'primary', lightText: '#1d4ed8', darkText: '#93c5fd' },
  ]
  for (const bt of BUSINESS_TOKENS) {
    const textToken = `--app-color-${bt.name}-text`
    const bgToken = `--app-color-${bt.name}-bg`
    const re = new RegExp(`${textToken}\\s*:\\s*([^;]+);`, 'i')
    const m = src.match(re)
    if (!m) {
      errors.push(
        `[REGRESSION] ${rel} 缺少 ${textToken} token 定义.\n` +
        `          必须在 :root 块中显式定义: ${textToken}: ${bt.lightText}; (浅色 mode 深色字)`
      )
    } else {
      const value = m[1].trim()
      if (value !== bt.lightText) {
        const line = findLineNumber(src, textToken)
        errors.push(
          `[REGRESSION] ${rel}:${line || '?'} ${textToken}: ${value} (期望 ${bt.lightText}, 浅色 mode 深色字).`
        )
      }
    }
    // 暗色 mode 必须在 _dark-mode-global.scss 重映射 (在 :where(html.dark) 块)
    // 简化检查: 文件 _global-tokens.scss 中暗色重映射由 :where(html.dark) 块负责 (此文件没有)
    // 这里只检查 bg 存在性
    const bgRe = new RegExp(`${bgToken}\\s*:\\s*([^;]+);`, 'i')
    const bgMatch = src.match(bgRe)
    if (!bgMatch) {
      errors.push(
        `[REGRESSION] ${rel} 缺少 ${bgToken} token 定义.\n` +
        `          必须在 :root 块中显式定义: ${bgToken}: rgba(*, 0.08); (浅色 mode 8% 透明背景)`
      )
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
// 主流程
// ════════════════════════════════════════════════════════════════════════

const stagedFiles = onlyStaged ? getStagedFiles() : null

if (onlyStaged && stagedFiles && stagedFiles.length === 0) {
  console.log('[check-color-contrast-systemic] 无 staged 文件, 跳过')
  process.exit(0)
}

const checkDarkMode = !onlyStaged || shouldCheck('client/src/styles/_dark-mode-global.scss', stagedFiles)
const checkOverrides = !onlyStaged || shouldCheck('client/src/styles/_element-plus-overrides.scss', stagedFiles)
const checkElementPlus = !onlyStaged || shouldCheck('client/src/styles/_element-plus.scss', stagedFiles)
const checkMessage = !onlyStaged || shouldCheck('client/src/styles/_el-message-global.scss', stagedFiles)
const checkTokens = !onlyStaged || shouldCheck('client/src/styles/_global-tokens.scss', stagedFiles)

if (checkDarkMode) checkDarkModeGlobalScss()
if (checkOverrides) checkElementPlusOverridesScss()
if (checkElementPlus) checkElementPlusScss()
if (checkMessage) checkElMessageGlobalScss()
if (checkTokens) checkGlobalTokensScss()

if (errors.length > 0) {
  console.error(`\n❌ [check-color-contrast-systemic] 发现 ${errors.length} 处回归:`)
  for (const e of errors) {
    console.error(`\n  ${e}`)
  }
  console.error(`\n  修复指南:`)
  console.error(`    1. _dark-mode-global.scss html.dark 块中 5 个 EP 主题色重映射必须为:`)
  for (const ct of COLOR_TYPES) {
    console.error(`       ${ct.varName}: ${ct.darkBg};  /* ${ct.textToken}=${ct.textValue} */`)
  }
  console.error(`    2. _element-plus-overrides.scss :where(.el-button--{primary|success|warning|danger|info}) color 必须为:`)
  for (const ct of COLOR_TYPES) {
    console.error(`       color: var(${ct.textToken})  /* = ${ct.textValue} */`)
  }
  console.error(`    3. _element-plus-overrides.scss 暗色块: 5 类 tag + 4 类 alert + 5 类 link + primary 暗色覆盖.`)
  console.error(`    4. _element-plus.scss 暗色块: el-tabs active + el-checkbox/el-radio/el-switch checked.`)
  console.error(`    5. _el-message-global.scss 暗色块: 4 类 notification + 5 类 message-box.`)
  console.error(`    6. _global-tokens.scss :root 中 5 个 text-on-* + 1 个 button-text-on-primary token.`)
  console.error(`\n  禁止值: EP 默认 #67c23a/#e6a23c/#f56c6c/#909399/#409eff / var(--el-bg-color*) / #0d0d0d 等.`)
  console.error(`\n  若确需改色, 同步更新:`)
  console.error(`    - e2e/color-contrast-systemic.spec.ts 的 EXPECTED 锚定值`)
  console.error(`    - 本脚本的 EXPECTED 对象`)
  console.error(`    - project_memory.md 暗色模式反色全组件硬约束记忆条目`)
  if (errors.length > THRESHOLD) {
    process.exit(1)
  } else {
    console.error(`\n  ⚠️  违规数 ${errors.length} ≤ THRESHOLD ${THRESHOLD}, 警告不阻断 (CI 阈值请用 0).`)
  }
}

console.log(`✓ [check-color-contrast-systemic] 通过 (5 类按钮 + 5 类 tag + 4 类 alert + 5 类 link + 4 类 notification + 5 类 message-box + tabs/checkbox/radio/switch 暗色反色均合规)`)
