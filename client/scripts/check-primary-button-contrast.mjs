#!/usr/bin/env node
/**
 * primary 按钮暗色对比度防回归轻量级守门 (pre-commit 用, 2026-07-04 立)
 *
 * 目的: 防止有人把 _dark-mode-global.scss 的暗色 --el-color-primary 改回 var(--el-bg-color) /
 *       var(--el-text-color-*) / #0d0d0d 等深色, 或把 _element-plus-overrides.scss 的
 *       :where(.el-button--primary) 块 color 改回 var(--el-bg-color-page), 导致 dark 模式
 *       primary 按钮背景与文字同色 (#0d0d0d on #0d0d0d = 1:1 不可见).
 *
 * 根因背景 (2026-07-04):
 *   light 模式: --el-color-primary = --el-text-color-primary = #000 (黑底白字 21:1 ✓)
 *   dark 模式 (修复前): --el-color-primary = --el-bg-color = #0d0d0d, button color =
 *                       --el-bg-color-page = #0d0d0d → 1:1 ✗
 *   dark 模式 (修复后): --el-color-primary = #2563eb, button color = --app-button-text-on-primary
 *                       = #ffffff → 5.17:1 ✓ (WCAG AA)
 *
 * 触发范围 (staged 模式):
 *   - client/src/styles/_dark-mode-global.scss
 *   - client/src/styles/_element-plus-overrides.scss
 *   - client/src/styles/_global-tokens.scss
 *
 * 与 e2e/primary-button-contrast.spec.ts 的关系:
 *   - 本脚本: 轻量级文本检查 (pre-commit 阶段, < 100ms)
 *   - e2e 测试: 完整源码级断言 + 浏览器渲染验证 (CI 阶段, 12 用例)
 *   两者并存: pre-commit 拦截 + CI 兜底
 *
 * 用法:
 *   node scripts/check-primary-button-contrast.mjs          # 全量检查
 *   node scripts/check-primary-button-contrast.mjs --staged # 仅 staged 文件触发
 *   PRIMARY_BUTTON_CONTRAST_THRESHOLD=0 node scripts/check-primary-button-contrast.mjs --staged
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
const THRESHOLD = Number(process.env.PRIMARY_BUTTON_CONTRAST_THRESHOLD ?? 0)

// ════════════════════════════════════════════════════════════════════════
// 期望值锚定 (与 _dark-mode-global.scss / _element-plus-overrides.scss /
//             _global-tokens.scss 当前值 + e2e spec 完全一致)
// ════════════════════════════════════════════════════════════════════════
const EXPECTED = {
  // 暗色 --el-color-primary (必须为蓝色, 不可引用 --el-bg-color 等深色变量)
  darkPrimaryBg: '#2563eb',
  // 暗色 primary 按钮文字色 (永为白, 蓝底白字 5.17:1)
  primaryText: '#ffffff',
}

// 违规: --el-color-primary 暗色映射禁止的右值 (黑/深色)
const FORBIDDEN_PRIMARY_VALUES = [
  // 引用 --el-bg-color 系 (dark = #0d0d0d/#1a1a1a 深色)
  'var(--el-bg-color)',
  'var(--el-bg-color-page)',
  'var(--el-bg-color-overlay)',
  // 引用 --el-text-color 系 (dark = #e5eaf3 浅色, 仍不是品牌蓝)
  'var(--el-text-color-primary)',
  'var(--el-text-color-regular)',
  // 显式深色 hex
  '#0d0d0d',
  '#1a1a1a',
  '#000',
  '#000000',
  '#222',
  '#333',
  '#2d2d2d',
]

// 违规: primary 按钮 color 禁止的右值 (与背景撞色或变深)
const FORBIDDEN_PRIMARY_BUTTON_COLOR = [
  'var(--el-bg-color)',
  'var(--el-bg-color-page)',
  'var(--el-bg-color-overlay)',
  '#0d0d0d',
  '#1a1a1a',
  '#000',
  '#000000',
  '#222',
  '#333',
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
  // 匹配 html.dark { ... } 或 :where(html.dark) { ... }
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
 * 平衡大括号提取选择器块 (用于 :where(.el-button--primary) { ... } 等)
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

  // 提取所有 html.dark / :where(html.dark) 块
  const darkBlocks = extractDarkBlock(src)
  if (darkBlocks.length === 0) {
    errors.push(`[REGRESSION] ${rel} 未发现 html.dark 覆盖块, 暗色模式 --el-color-primary 无法生效.`)
    return
  }

  // 1. 所有暗色块中 --el-color-primary 的右值必须为蓝色
  //    (任意暗色块不能引用 --el-bg-color 等深色变量)
  for (const { body, full } of darkBlocks) {
    // 跳过 light-mode-only 块 (通过上下文判断: 含 :where(html:not(.dark)) 视为浅色, 不检查)
    // (本项目暂未出现 light-only 块, 留扩展位)
    const primaryMatch = body.match(/--el-color-primary\s*:\s*([^;]+);/i)
    if (!primaryMatch) continue
    const value = primaryMatch[1].trim()
    const isForbidden = FORBIDDEN_PRIMARY_VALUES.some(forbidden => {
      return value === forbidden || value.includes(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    })
    if (isForbidden) {
      const line = findLineNumber(src, '--el-color-primary\\s*:\\s*' + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      errors.push(
        `[REGRESSION] ${rel}:${line || '?'} 暗色 --el-color-primary 映射为 ${value} (深色), 与 button color 撞色不可见.\n` +
          `          必须为蓝色: ${EXPECTED.darkPrimaryBg} / #3b82f6 / #60a5fa / var(--color-cta-blue*) 等.\n` +
          `          根因: 2026-07-04 之前 var(--el-bg-color) (dark=#0d0d0d) 导致 primary 按钮 1:1 不可见.`
      )
    } else if (value !== EXPECTED.darkPrimaryBg) {
      // 不是禁止值, 但也不是当前期望值, 仅警告不阻断 (允许蓝色变体)
      // (不报错, 留给项目演进)
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

  // 1. 浅色 :where(.el-button--primary) 块内 color: 必须用 --app-button-text-on-primary
  //    (允许 --el-color-white / #ffffff / #fff 兼容写法, 但禁止 var(--el-bg-color-page) 等撞色值)
  const lightPrimaryBlocks = extractSelectorBlock(src, /:where\(\.el-button--primary\)\s*\{/i)
  let lightBlockFound = false
  for (const { body } of lightPrimaryBlocks) {
    lightBlockFound = true
    const colorMatch = body.match(/^\s*color\s*:\s*([^;]+);/im)
    if (!colorMatch) continue
    const value = colorMatch[1].trim()
    // 允许: var(--app-button-text-on-primary) / var(--el-color-white) / #fff / #ffffff
    const isAllowed =
      value === 'var(--app-button-text-on-primary)' ||
      value === 'var(--el-color-white)' ||
      value === '#fff' ||
      value === '#ffffff'
    if (!isAllowed) {
      const isForbidden = FORBIDDEN_PRIMARY_BUTTON_COLOR.some(f => value === f)
      if (isForbidden) {
        const line = findLineNumber(src, '\\.el-button--primary')
        errors.push(
          `[REGRESSION] ${rel}:${line || '?'} 浅色 :where(.el-button--primary) color: ${value} (深色, 与背景撞色).\n` +
            `          必须改为 var(--app-button-text-on-primary) (= #ffffff, 永为白).\n` +
            `          根因: 2026-07-04 之前 color: var(--el-bg-color-page) (dark=#0d0d0d) 撞色不可见.`
        )
      } else {
        const line = findLineNumber(src, '\\.el-button--primary')
        errors.push(
          `[REGRESSION] ${rel}:${line || '?'} 浅色 :where(.el-button--primary) color: ${value} (非标准 token).\n` +
            `          推荐改为 var(--app-button-text-on-primary) (= #ffffff). 允许: --el-color-white / #fff.`
        )
      }
    }
  }
  if (!lightBlockFound) {
    errors.push(`[REGRESSION] ${rel} 未发现浅色 :where(.el-button--primary) 块, 需补齐.`)
  }

  // 2. 暗色 html.dark :where(.el-button--primary) 块内 color: 必须用 --app-button-text-on-primary
  //    用更宽松的正则: 找 html.dark 块内含 .el-button--primary 的子块
  const darkBlocks = extractDarkBlock(src)
  let darkPrimaryChecked = false
  for (const { body } of darkBlocks) {
    if (!body.includes('.el-button--primary')) continue
    darkPrimaryChecked = true
    const colorMatch = body.match(/color\s*:\s*([^;]+);/i)
    if (!colorMatch) continue
    const value = colorMatch[1].trim()
    const isAllowed =
      value === 'var(--app-button-text-on-primary)' ||
      value === 'var(--el-color-white)' ||
      value === '#fff' ||
      value === '#ffffff'
    if (!isAllowed) {
      const isForbidden = FORBIDDEN_PRIMARY_BUTTON_COLOR.some(f => value === f)
      if (isForbidden) {
        errors.push(
          `[REGRESSION] ${rel} 暗色 html.dark :where(.el-button--primary) color: ${value} (深色, 与背景撞色).\n` +
            `          必须改为 var(--app-button-text-on-primary) (= #ffffff, 永为白).\n` +
            `          根因: 2026-07-04 之前 color: var(--el-bg-color-page) (dark=#0d0d0d) 撞色不可见.`
        )
      }
    }
  }
  if (!darkPrimaryChecked) {
    errors.push(`[REGRESSION] ${rel} 未发现暗色 html.dark :where(.el-button--primary) 块, 需补齐.`)
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

  // 1. --app-button-text-on-primary: 必须是 #ffffff / #fff / var(--el-color-white)
  const tokenRe = /--app-button-text-on-primary\s*:\s*([^;]+);/i
  const m = src.match(tokenRe)
  if (!m) {
    errors.push(`[REGRESSION] ${rel} 缺少 --app-button-text-on-primary token 定义.\n` +
      `          必须在 :root 块中显式定义, 推荐值 #ffffff.`)
    return
  }
  const value = m[1].trim()
  const isAllowed =
    value === '#ffffff' ||
    value === '#fff' ||
    value === 'var(--el-color-white)' ||
    value === 'white'
  if (!isAllowed) {
    const line = findLineNumber(src, '--app-button-text-on-primary')
    const isForbidden = FORBIDDEN_PRIMARY_BUTTON_COLOR.some(f => value === f) ||
      value.startsWith('var(--el-bg-color')
    if (isForbidden) {
      errors.push(
        `[REGRESSION] ${rel}:${line || '?'} --app-button-text-on-primary: ${value} (深色, primary 按钮撞色).\n` +
          `          必须为浅色: #ffffff / #fff / var(--el-color-white) / white.\n` +
          `          根因: 2026-07-04 之前 var(--el-bg-color) (dark=#0d0d0d) 与 primary 背景撞色.`
      )
    } else {
      errors.push(
        `[REGRESSION] ${rel}:${line || '?'} --app-button-text-on-primary: ${value} (非标准 token, 不确定浅色).\n` +
          `          推荐值: #ffffff. 允许: #fff / var(--el-color-white) / white.`
      )
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
// 主流程
// ════════════════════════════════════════════════════════════════════════

const stagedFiles = onlyStaged ? getStagedFiles() : null

if (onlyStaged && stagedFiles && stagedFiles.length === 0) {
  console.log('[check-primary-button-contrast] 无 staged 文件, 跳过')
  process.exit(0)
}

const checkDarkMode = !onlyStaged || shouldCheck('client/src/styles/_dark-mode-global.scss', stagedFiles)
const checkOverrides = !onlyStaged || shouldCheck('client/src/styles/_element-plus-overrides.scss', stagedFiles)
const checkTokens = !onlyStaged || shouldCheck('client/src/styles/_global-tokens.scss', stagedFiles)

if (checkDarkMode) checkDarkModeGlobalScss()
if (checkOverrides) checkElementPlusOverridesScss()
if (checkTokens) checkGlobalTokensScss()

if (errors.length > 0) {
  console.error(`\n❌ [check-primary-button-contrast] 发现 ${errors.length} 处回归:`)
  for (const e of errors) {
    console.error(`\n  ${e}`)
  }
  console.error(`\n  修复指南:`)
  console.error(`    1. _dark-mode-global.scss html.dark 块中 --el-color-primary 必须为:`)
  console.error(`       --el-color-primary: ${EXPECTED.darkPrimaryBg}  /* CTA 蓝, 5.17:1 */`)
  console.error(`    2. _element-plus-overrides.scss :where(.el-button--primary) 块 color 必须为:`)
  console.error(`       color: var(--app-button-text-on-primary)  /* 永为白 */`)
  console.error(`    3. _global-tokens.scss :root 中 --app-button-text-on-primary 必须为:`)
  console.error(`       --app-button-text-on-primary: #ffffff`)
  console.error(`\n  禁止值: var(--el-bg-color*) / #0d0d0d / #1a1a1a / #000 (dark 下与蓝底撞色).`)
  console.error(`\n  若确需改色, 同步更新:`)
  console.error(`    - e2e/primary-button-contrast.spec.ts 的 EXPECTED_DARK_PRIMARY_BG / EXPECTED_PRIMARY_TEXT`)
  console.error(`    - scripts/check-primary-button-contrast.mjs 的 EXPECTED 对象`)
  console.error(`    - project_memory.md primary 按钮暗色对比度修复记忆条目`)
  if (errors.length > THRESHOLD) {
    process.exit(1)
  } else {
    console.error(`\n  ⚠️  违规数 ${errors.length} ≤ THRESHOLD ${THRESHOLD}, 警告不阻断 (CI 阈值请用 0).`)
  }
}

console.log(`✓ [check-primary-button-contrast] 通过 (dark --el-color-primary: ${EXPECTED.darkPrimaryBg}, button text: ${EXPECTED.primaryText})`)
