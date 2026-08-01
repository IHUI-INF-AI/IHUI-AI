#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-miniapp-taro-design-tokens.mjs - miniapp-taro design-tokens 同步守门(P3-1.3 立,2026-08-01)。
 *
 * 作用:校验 apps/miniapp-taro/src/app.css 中的 design-tokens 变量值与
 *       packages/design-tokens/src/styles/tokens.css(单一真相源)严格一致。
 *
 * 背景:Taro 4 + Tailwind v3 不兼容 v4 @theme 语法,无法 @import tokens.css,
 *       需手抄 :root + .dark 块。值漂移 = 视觉 bug,本脚本捕获。
 *       与 check-design-tokens-sync.mjs --target=miniapp-taro 互补:
 *       本脚本独立运行,额外校验 app.config.ts 硬编码色值 + 输出 [PASS]/[FAIL] 格式。
 *
 * 校验内容:
 *   1. app.css :root 块变量值 vs tokens.css @theme + :root(亮色,子集检查)
 *   2. app.css .dark 块变量值 vs tokens.css .dark(暗色,子集检查)
 *   3. app.config.ts 硬编码色值(warn-only,原生导航栏/tabBar 无法用 CSS var)
 *
 * 用法:
 *   node scripts/check-miniapp-taro-design-tokens.mjs           # 全量校验
 *   node scripts/check-miniapp-taro-design-tokens.mjs --quiet    # 仅输出错误
 *   node scripts/check-miniapp-taro-design-tokens.mjs --help     # 帮助
 *
 * 退出码:0 = 一致,1 = 发现不一致
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码中文绝对路径) ───
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const TOKENS_PATH = join(root, 'packages/design-tokens/src/styles/tokens.css')
const APP_CSS_PATH = join(root, 'apps/miniapp-taro/src/app.css')
const APP_CONFIG_PATH = join(root, 'apps/miniapp-taro/src/app.config.ts')

// ─── CLI 解析 ───
const argv = process.argv.slice(2)
const quiet = argv.includes('--quiet') || argv.includes('-q')
const showHelp = argv.includes('--help') || argv.includes('-h')

if (showHelp) {
  console.log(`
check-miniapp-taro-design-tokens.mjs — miniapp-taro design-tokens 同步守门(P3-1.3)

用法:
  node scripts/check-miniapp-taro-design-tokens.mjs [选项]

选项:
  --quiet, -q    仅输出错误(抑制通过消息)
  --help, -h     显示此帮助

校验内容:
  1. app.css :root/.dark 块变量值 vs tokens.css(子集检查)
  2. app.config.ts 硬编码色值(warn-only)

退出码:
  0 = 一致
  1 = 发现不一致
`)
  process.exit(0)
}

// ─── 工具函数 ───

/** 读 CSS 文件并去除 BOM(UTF-8 BOM 鲁棒性)。 */
function readCss(p) {
  let s = readFileSync(p, 'utf8')
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
  return s
}

/** 提取所有匹配选择器的块内容(花括号平衡匹配)。
 *  @param {string} css
 *  @param {string} selector  如 ':root' / '.dark' / '@theme'
 *  @returns {string[]} */
function extractAllBlocks(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(escaped + '\\s*\\{', 'g')
  const blocks = []
  let m
  while ((m = re.exec(css)) !== null) {
    let i = m.index + m[0].length
    let depth = 1
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++
      else if (css[i] === '}') depth--
      i++
    }
    blocks.push(css.slice(m.index + m[0].length, i - 1))
    re.lastIndex = i
  }
  return blocks
}

/** 去除 CSS 块注释。 */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '')
}

// design-tokens 变量正则(7 类:color/radius/chart/font/animate/z/shadow)
const DESIGN_TOKEN_VAR_RE =
  /(--(?:radius[\w-]*|color-[\w-]+|chart-[\w-]+|font-[\w-]+|animate-[\w-]+|z-[\w-]+|shadow-[\w-]+))\s*:\s*([^;]+);/g

/** 从块文本提取 design-tokens 变量(7 类,非仅 --color-*)。
 *  @param {string} text
 *  @returns {Record<string, string>}  { name: value } */
function extractDesignTokenVars(text) {
  const clean = stripComments(text)
  const vars = {}
  const re = new RegExp(DESIGN_TOKEN_VAR_RE.source, 'g')
  let m
  while ((m = re.exec(clean)) !== null) vars[m[1]] = m[2].trim()
  return vars
}

/** 从多个选择器块合并变量(后者覆盖前者)。用于 tokens.css(单一真相源)。
 *  @param {string} css
 *  @param {string[]} selectors
 *  @returns {Record<string, string>} */
function mergeAllVars(css, selectors) {
  const merged = {}
  for (const sel of selectors)
    for (const block of extractAllBlocks(css, sel))
      Object.assign(merged, extractDesignTokenVars(block))
  return merged
}

/** 仅取每个选择器的首个块,合并变量。用于 app.css(避免本地扩展块干扰)。
 *  @param {string} css
 *  @param {string[]} selectors
 *  @returns {Record<string, string>} */
function mergeFirstVars(css, selectors) {
  const merged = {}
  for (const sel of selectors) {
    const blocks = extractAllBlocks(css, sel)
    if (blocks.length > 0) Object.assign(merged, extractDesignTokenVars(blocks[0]))
  }
  return merged
}

/** 从 app.config.ts 提取硬编码色值(warn-only 检查)。
 *  匹配 #hex / rgba() / hsl() 格式的色值字符串。
 *  @param {string} content
 *  @returns {Array<{ line: number, value: string, context: string }>} */
function extractHardcodedColors(content) {
  const lines = content.split('\n')
  const results = []
  // 匹配 #hex(3/6/8 位)/ rgba() / hsl() 色值,排除注释行
  const colorRe = /(#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\))/g
  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    // 跳过注释行 + import 行
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return
    let m
    const re = new RegExp(colorRe.source, 'g')
    while ((m = re.exec(line)) !== null) {
      // 提取上下文(键名)
      const before = line.slice(0, m.index).trim()
      const keyMatch = before.match(/(\w+)\s*:\s*$/)
      const context = keyMatch ? keyMatch[1] : before.slice(-30)
      results.push({ line: idx + 1, value: m[1], context })
    }
  })
  return results
}

// ─── 主校验逻辑 ───

/** @returns {number} exit code */
function main() {
  // 文件存在性检查
  if (!existsSync(TOKENS_PATH)) {
    console.error(`[FAIL] tokens.css not found: ${TOKENS_PATH}`)
    return 1
  }
  if (!existsSync(APP_CSS_PATH)) {
    console.error(`[FAIL] app.css not found: ${APP_CSS_PATH}`)
    return 1
  }

  if (!quiet)
    console.log('[check-miniapp-taro-design-tokens] Checking miniapp-taro vs design-tokens/tokens.css...')

  const appCss = readCss(APP_CSS_PATH)
  const tokensCss = readCss(TOKENS_PATH)

  // app.css:仅取首个 :root / .dark 块(避免本地扩展块干扰)
  const appRoot = mergeFirstVars(appCss, [':root'])
  const appDark = mergeFirstVars(appCss, ['.dark'])

  // tokens.css(单一真相源):合并所有 @theme + :root 块 + .dark 块
  const tokensRoot = mergeAllVars(tokensCss, ['@theme', ':root'])
  const tokensDark = mergeAllVars(tokensCss, ['.dark'])

  // 子集检查:只校验 app.css 中存在的变量(tokens.css 多出的不报错)
  /** @type {{ block: string, name: string, app: string, tok: string }[]} */
  const diffs = []
  for (const [name, val] of Object.entries(appRoot)) {
    const t = tokensRoot[name]
    if (t === undefined || t !== val)
      diffs.push({ block: ':root', name, app: val, tok: t ?? '<missing>' })
  }
  for (const [name, val] of Object.entries(appDark)) {
    const t = tokensDark[name]
    if (t === undefined || t !== val)
      diffs.push({ block: '.dark', name, app: val, tok: t ?? '<missing>' })
  }

  let exitCode = 0

  // ── 校验 1:app.css 变量值比对(blocking) ──
  if (diffs.length === 0) {
    const total = Object.keys(appRoot).length + Object.keys(appDark).length
    if (!quiet) console.log(`[PASS] app.css: ${total} variables in sync with tokens.css`)
  } else {
    console.error(`[FAIL] app.css: ${diffs.length} mismatch(es) vs tokens.css:`)
    for (const block of [':root', '.dark']) {
      const items = diffs.filter((d) => d.block === block)
      if (!items.length) continue
      console.error(`  ${block} block:`)
      for (const d of items)
        console.error(`    ${d.name}: app.css='${d.app}' vs tokens='${d.tok}'`)
    }
    exitCode = 1
  }

  // ── 校验 2:app.config.ts 硬编码色值(warn-only) ──
  if (existsSync(APP_CONFIG_PATH)) {
    const configContent = readFileSync(APP_CONFIG_PATH, 'utf8')
    const hardcoded = extractHardcodedColors(configContent)
    if (hardcoded.length > 0 && !quiet) {
      console.log(`[WARN] app.config.ts: ${hardcoded.length} hardcoded color(s) (native config, cannot use CSS var):`)
      for (const c of hardcoded.slice(0, 10)) {
        console.log(`  line ${c.line}: ${c.context} = '${c.value}'`)
      }
      if (hardcoded.length > 10) console.log(`  ... and ${hardcoded.length - 10} more`)
    }
  }

  if (exitCode === 0 && !quiet) {
    console.log('[PASS] miniapp-taro design-tokens sync OK')
  }

  return exitCode
}

process.exit(main())
