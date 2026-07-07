#!/usr/bin/env node
/**
 * 按钮/标签/消息文字反色防回归轻量级守门 (pre-commit 用, 2026-07-04 立)
 *
 * 目的: 防止把 4 类彩色按钮 (success/warning/danger/info) + 5 类 el-tag +
 *       4 类 el-alert 的暗色文字色改回 var(--el-bg-color*) / var(--el-text-color-regular) /
 *       #fff / var(--el-color-white) 等浅色硬编码, 或把 _dark-mode-global.scss 的
 *       --el-color-success/warning/danger/info 暗色映射改回 EP 默认亮色 (#67c23a/#e6a23c 等),
 *       导致暗色模式"浅色背景+浅色文字"或"深色背景+深色文字"不可见.
 *
 * 根因背景 (2026-07-04):
 *   light 模式: --el-color-success = #67c23a (亮绿), button color = --el-text-color-primary (深)
 *               → 浅色背景下深字可读
 *   dark 模式 (修复前): --el-color-success = #67c23a (亮绿, EP 默认), button color
 *                       = --el-text-color-primary (暗 = 浅 #e5eaf3) → 浅绿+浅字对比度 1.7:1 ✗
 *   dark 模式 (修复后): --el-color-success = #15803d (深绿, 暗色重映射), button color
 *                       = --app-text-on-success = #ffffff → 深绿+白字对比度 5.5:1 ✓ (WCAG AA)
 *
 * 类似处理 4 类按钮 + 4 类 tag + 4 类 alert:
 *   success: --el-color-success 暗色 #15803d + --app-text-on-success #ffffff
 *   warning: --el-color-warning 暗色 #b45309 + --app-text-on-warning #fde68a (黄底用浅黄, 非纯白)
 *   danger:  --el-color-danger  暗色 #b91c1c + --app-text-on-danger  #ffffff
 *   info:    --el-color-info    暗色 #4b5563 + --app-text-on-info    #ffffff
 *
 * 触发范围 (staged 模式):
 *   - client/src/styles/_dark-mode-global.scss
 *   - client/src/styles/_element-plus-overrides.scss
 *   - client/src/styles/_global-tokens.scss
 *
 * 与 e2e/button-text-contrast.spec.ts 的关系:
 *   - 本脚本: 轻量级文本检查 (pre-commit 阶段, < 200ms)
 *   - e2e 测试: 完整源码级断言 + 浏览器渲染验证 (CI 阶段, 12+ 用例)
 *   两者并存: pre-commit 拦截 + CI 兜底
 *
 * 用法:
 *   node scripts/check-button-text-contrast.mjs          # 全量检查
 *   node scripts/check-button-text-contrast.mjs --staged # 仅 staged 文件触发
 *   BUTTON_TEXT_CONTRAST_THRESHOLD=0 node scripts/check-button-text-contrast.mjs --staged
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
const THRESHOLD = Number(process.env.BUTTON_TEXT_CONTRAST_THRESHOLD ?? 0)

// ════════════════════════════════════════════════════════════════════════
// 期望值锚定 (与 _dark-mode-global.scss / _element-plus-overrides.scss /
//             _global-tokens.scss 当前值 + e2e spec 完全一致)
// ════════════════════════════════════════════════════════════════════════
const EXPECTED = {
  // 暗色 EP --el-color-* 主题色重映射
  darkSuccess: '#15803d', // 深绿 (Tailwind green-700)
  darkWarning: '#b45309', // 深琥珀 (Tailwind amber-700)
  darkDanger: '#b91c1c',  // 深红 (Tailwind red-700)
  darkInfo: '#4b5563',    // 深灰 (Tailwind gray-600)

  // 4 类文字色 token (永定, 不随 light/dark 切换)
  textOnSuccess: '#ffffff',
  textOnWarning: '#ffffff', // 2026-07-04 v2 修复: #ffffff on #b45309 = 5.02:1 ✓ WCAG AA 4.5 (原 #fde68a = 4.03:1 失败)
  textOnDanger: '#ffffff',
  textOnInfo: '#ffffff',
}

// 4 类按钮的色系枚举
const COLOR_TYPES = [
  { name: 'success', varName: '--el-color-success', darkBg: EXPECTED.darkSuccess, textToken: '--app-text-on-success', textValue: EXPECTED.textOnSuccess, lightBgDefault: '#67c23a' },
  { name: 'warning', varName: '--el-color-warning', darkBg: EXPECTED.darkWarning, textToken: '--app-text-on-warning', textValue: EXPECTED.textOnWarning, lightBgDefault: '#e6a23c' },
  { name: 'danger',  varName: '--el-color-danger',  darkBg: EXPECTED.darkDanger,  textToken: '--app-text-on-danger',  textValue: EXPECTED.textOnDanger,  lightBgDefault: '#f56c6c' },
  { name: 'info',    varName: '--el-color-info',    darkBg: EXPECTED.darkInfo,    textToken: '--app-text-on-info',    textValue: EXPECTED.textOnInfo,    lightBgDefault: '#909399' },
]

// 暗色 EP --el-color-* 重映射禁止的右值 (EP 默认亮色, 在暗色下形成"亮块+浅字"低对比度)
const FORBIDDEN_DARK_BG_VALUES = [
  // EP 默认 success/warning/danger/info 亮色 (在暗色背景下形成"亮块+浅字"低对比度)
  '#67c23a', '#e6a23c', '#f56c6c', '#909399',
  // 引用 --el-bg-color 系 (dark = #0d0d0d/#1a1a1a 深色, 暗色按钮撞色)
  'var(--el-bg-color)',
  'var(--el-bg-color-page)',
  'var(--el-bg-color-overlay)',
  // 引用 --el-text-color 系 (dark = #e5eaf3 浅色, 不是品牌深饱和色)
  'var(--el-text-color-primary)',
  'var(--el-text-color-regular)',
  // 显式深色 hex (与暗色背景撞色)
  '#0d0d0d', '#1a1a1a', '#000', '#000000', '#222', '#333', '#2d2d2d',
]

// 按钮 color 禁止的右值 (与暗色重映射后的深饱和背景撞色)
const FORBIDDEN_BUTTON_TEXT_VALUES = [
  'var(--el-bg-color)',
  'var(--el-bg-color-page)',
  'var(--el-bg-color-overlay)',
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
  if (!stagedFiles) return true // git 不可用 → 全量
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
 * 从 scss/css 源码中提取 html.dark / :where(html.dark) 块的内容
 * 简单实现: 用正则匹配块起始 `{` 到对应 `}`, 不处理嵌套花括号
 * (本项目 scss 暗色块均无嵌套, 安全)
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
 * 平衡大括号提取选择器块 (用于 :where(.el-button--success) { ... } 等)
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
    // 也检查 value 是否包含 f (如 var(--el-bg-color) 与 var(--el-bg-color, #fff) 都算)
    const re = new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    return re.test(value)
  })
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
    errors.push(`[REGRESSION] ${rel} 未发现 html.dark 覆盖块, 暗色模式 --el-color-* 无法生效.`)
    return
  }

  // 收集所有暗色块中 --el-color-{success,warning,danger,info} 的右值
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
          `[REGRESSION] ${rel}:${line || '?'} 暗色 ${ct.varName} 映射为 ${value} (EP 默认亮色或深色变量), 暗色下形成"亮块+浅字"低对比度.\n` +
          `          必须改为深饱和版本: ${ct.darkBg} (Tailwind 700 级色, 与 --app-text-on-${ct.name} 配合 WCAG AA 通过).\n` +
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
}

function checkElementPlusOverridesScss() {
  const rel = 'client/src/styles/_element-plus-overrides.scss'
  const abs = path.join(projectRoot, rel)
  if (!fs.existsSync(abs)) {
    errors.push(`[MISSING] ${rel} 文件不存在`)
    return
  }
  const src = readFile(abs)

  for (const ct of COLOR_TYPES) {
    // 1. 浅色 :where(.el-button--{ct.name}) 块存在 + color 必须用 --app-text-on-{ct.name}
    const lightBlocks = extractSelectorBlock(src, new RegExp(`:where\\(\\.el-button--${ct.name}\\)\\s*\\{`, 'i'))
    if (lightBlocks.length === 0) {
      errors.push(
        `[REGRESSION] ${rel} 未发现 :where(.el-button--${ct.name}) 块, 需补齐 background-color: var(${ct.varName}); color: var(${ct.textToken});`
      )
      continue
    }
    for (const { body } of lightBlocks) {
      // 检查 color 属性
      const colorMatch = body.match(/^\s*color\s*:\s*([^;]+);/im)
      if (!colorMatch) {
        errors.push(
          `[REGRESSION] ${rel} :where(.el-button--${ct.name}) 块缺 color 声明, 必须为 color: var(${ct.textToken}).`
        )
        continue
      }
      const value = colorMatch[1].trim()
      // 必须严格等于 var(--app-text-on-*)
      if (value !== `var(${ct.textToken})`) {
        const line = findLineNumber(src, `\\.el-button--${ct.name}`)
        if (isForbidden(value, FORBIDDEN_BUTTON_TEXT_VALUES)) {
          errors.push(
            `[REGRESSION] ${rel}:${line || '?'} 浅色 :where(.el-button--${ct.name}) color: ${value} (深色, 与 ${ct.varName} 撞色不可见).\n` +
            `          必须改为 var(${ct.textToken}) (= ${ct.textValue}, 永定).`
          )
        } else {
          errors.push(
            `[REGRESSION] ${rel}:${line || '?'} 浅色 :where(.el-button--${ct.name}) color: ${value} (非标准 token).\n` +
            `          必须改为 var(${ct.textToken}). 允许: #fff / #ffffff / var(--el-color-white) (兼容写法).`
          )
        }
      }
    }
  }

  // 2. 暗色 html.dark 块中 5 类 tag 暗色反色覆盖存在
  const darkBlocks = extractDarkBlock(src)
  for (const ct of ['success', 'warning', 'danger', 'info', 'primary']) {
    let foundInDark = false
    for (const { body } of darkBlocks) {
      const tagRe = new RegExp(`:where\\(\\.el-tag--${ct}\\)\\s*\\{`, 'i')
      if (tagRe.test(body)) {
        foundInDark = true
        // 验证 color 不为深色 (不能继续用 #15803d 等浅色块深字)
        const colorMatch = body.match(/:where\(\.el-tag--[a-z]+\)\s*\{[^}]*color\s*:\s*([^;]+);/i)
        if (colorMatch) {
          const value = colorMatch[1].trim()
          if (isForbidden(value, ['#15803d', '#b45309', '#b91c1c', 'var(--color-green-15803d)', 'var(--color-amber-b45309)', 'var(--color-red-b91c1c)'])) {
            const line = findLineNumber(src, `\\.el-tag--${ct}`)
            errors.push(
              `[REGRESSION] ${rel}:${line || '?'} 暗色 :where(.el-tag--${ct}) 仍用深色字 ${value}, 与暗色浅背景对比度不足.\n` +
              `          必须改为浅色字 (#bbf7d0 / #fde68a / #fecaca / #d1d5db / #93c5fd 视 type 而定).`
            )
          }
        }
        break
      }
    }
    if (!foundInDark) {
      errors.push(
        `[REGRESSION] ${rel} 暗色 html.dark 块中未发现 :where(.el-tag--${ct}) 浅色字反色覆盖.\n` +
        `          必须在 html.dark 块内为 ${ct} tag 加 :where(.el-tag--${ct}) { color: <浅色>; background-color: <深色 alpha>; }`
      )
    }
  }

  // 3. 暗色 html.dark 块中 4 类 el-alert 暗色反色覆盖存在
  for (const ct of ['success', 'warning', 'info', 'error']) {
    let foundInDark = false
    for (const { body } of darkBlocks) {
      const alertRe = new RegExp(`:where\\(\\.el-alert--${ct === 'error' ? 'error' : ct}\\)\\s*\\{`, 'i')
      if (alertRe.test(body)) {
        foundInDark = true
        break
      }
    }
    if (!foundInDark) {
      errors.push(
        `[REGRESSION] ${rel} 暗色 html.dark 块中未发现 :where(.el-alert--${ct}) 暗色覆盖.\n` +
        `          必须在 html.dark 块内为 ${ct} alert 加 :where(.el-alert--${ct}) { background-color: <深色 alpha>; color: <浅色>; }`
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

  for (const ct of COLOR_TYPES) {
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
    if (value !== ct.textValue) {
      const line = findLineNumber(src, ct.textToken)
      errors.push(
        `[REGRESSION] ${rel}:${line || '?'} ${ct.textToken}: ${value} (期望 ${ct.textValue}).\n` +
        `          根因: ${ct.textToken} 必须为永定值, 与 _dark-mode-global.scss 的 ${ct.varName}=${ct.darkBg} 配合达到 WCAG AA 对比度.`
      )
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
// 主流程
// ════════════════════════════════════════════════════════════════════════

const stagedFiles = onlyStaged ? getStagedFiles() : null

if (onlyStaged && stagedFiles && stagedFiles.length === 0) {
  console.log('[check-button-text-contrast] 无 staged 文件, 跳过')
  process.exit(0)
}

const checkDarkMode = !onlyStaged || shouldCheck('client/src/styles/_dark-mode-global.scss', stagedFiles)
const checkOverrides = !onlyStaged || shouldCheck('client/src/styles/_element-plus-overrides.scss', stagedFiles)
const checkTokens = !onlyStaged || shouldCheck('client/src/styles/_global-tokens.scss', stagedFiles)

if (checkDarkMode) checkDarkModeGlobalScss()
if (checkOverrides) checkElementPlusOverridesScss()
if (checkTokens) checkGlobalTokensScss()

if (errors.length > 0) {
  console.error(`\n❌ [check-button-text-contrast] 发现 ${errors.length} 处回归:`)
  for (const e of errors) {
    console.error(`\n  ${e}`)
  }
  console.error(`\n  修复指南:`)
  console.error(`    1. _dark-mode-global.scss html.dark 块中 4 个 EP 主题色重映射必须为深饱和版本:`)
  for (const ct of COLOR_TYPES) {
    console.error(`       ${ct.varName}: ${ct.darkBg};  /* ${ct.textToken}=${ct.textValue} */`)
  }
  console.error(`    2. _element-plus-overrides.scss :where(.el-button--{success|warning|danger|info}) color 必须为:`)
  for (const ct of COLOR_TYPES) {
    console.error(`       color: var(${ct.textToken})  /* = ${ct.textValue} */`)
  }
  console.error(`    3. _element-plus-overrides.scss html.dark 块中 5 类 tag + 4 类 alert 必须有暗色反色覆盖.`)
  console.error(`    4. _global-tokens.scss :root 中 4 个 text-on-* token 必须为:`)
  for (const ct of COLOR_TYPES) {
    console.error(`       ${ct.textToken}: ${ct.textValue};`)
  }
  console.error(`\n  禁止值: EP 默认 #67c23a/#e6a23c/#f56c6c/#909399 / var(--el-bg-color*) / #0d0d0d 等.`)
  console.error(`\n  若确需改色, 同步更新:`)
  console.error(`    - e2e/button-text-contrast.spec.ts 的 EXPECTED 锚定值`)
  console.error(`    - scripts/check-button-text-contrast.mjs 的 EXPECTED 对象`)
  console.error(`    - project_memory.md 暗色模式浅底深字修复记忆条目`)
  if (errors.length > THRESHOLD) {
    process.exit(1)
  } else {
    console.error(`\n  ⚠️  违规数 ${errors.length} ≤ THRESHOLD ${THRESHOLD}, 警告不阻断 (CI 阈值请用 0).`)
  }
}

console.log(`✓ [check-button-text-contrast] 通过 (4 类按钮 + 5 类 tag + 4 类 alert 暗色文字反色均合规)`)
