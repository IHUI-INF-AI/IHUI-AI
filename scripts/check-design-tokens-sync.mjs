#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-design-tokens-sync.mjs - 统一 design-tokens 同步守门(P1-C + P1-F 合并)。
 *
 * 合并自三个原脚本(P1-F):
 *   - check-miniapp-tokens-sync.mjs → --target=miniapp-taro
 *   - check-web-tokens-sync.mjs      → --target=web
 *   - check-rn-global-css-sync.mjs   → --target=mobile-rn
 *
 * 变量覆盖扩展(P1-C):从仅 `--color-*` 扩展到全部 design-tokens 变量:
 *   --color-* / --radius* / --chart-* / --font-* / --animate-* / --z-* / --shadow-*
 *   (原三个脚本只校验 --color-,其余 139 个变量(radius/chart/font/animate/z/shadow)无守门)
 *
 * 两类校验模式:
 *   1. 值比对(miniapp-taro / mobile-rn):Taro 4 + Tailwind v3 / NativeWind 4.x
 *      不兼容 v4 @theme 语法,无法 @import tokens.css,需手抄 :root + .dark 块。
 *      本脚本比对目标文件中存在的 design-tokens 变量值是否与 tokens.css 严格一致
 *      (子集检查:只校验目标文件中存在的变量,tokens.css 多出的变量不报错)。
 *
 *   2. @import 单源(web):web 用 Tailwind v4 @import tokens.css 单一来源。
 *      本脚本校验:① globals.css 含 @import 语句;② 顶层 :root/.dark 块未手抄
 *      tokens.css @theme 中已定义的变量(防回归)。
 *
 * 兼容性:接受 --quiet / --staged / --check(均为 no-op 或仅抑制输出),
 *   原调用方迁移到 --target=<web|miniapp-taro|mobile-rn> 即可。
 *
 * 用法:
 *   node scripts/check-design-tokens-sync.mjs --target=miniapp-taro
 *   node scripts/check-design-tokens-sync.mjs --target=mobile-rn [--quiet] [--staged]
 *   node scripts/check-design-tokens-sync.mjs --target=web
 *   node scripts/check-design-tokens-sync.mjs --help
 *
 * 退出码:0 = 同步/无回归,1 = 发现不一致/回归,2 = CLI 参数错误
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码中文绝对路径) ───
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const TOKENS_PATH = join(root, 'packages/design-tokens/src/styles/tokens.css')
const TOKEN_REGISTRY_PATH = join(root, 'packages/design-tokens/src/token-registry.ts')
const RN_GLOBAL_CSS_PATH = join(root, 'apps/mobile-rn/global.css')

// ─── 目标配置 ───
/** @type {Record<string, { label: string, cssPath: string, mode: 'value-match' | 'import-check' | 'registry-check' }>} */
const TARGETS = {
  'miniapp-taro': {
    label: 'miniapp-taro/src/app.css',
    cssPath: join(root, 'apps/miniapp-taro/src/app.css'),
    mode: 'value-match',
  },
  'mobile-rn': {
    label: 'mobile-rn/global.css',
    cssPath: RN_GLOBAL_CSS_PATH,
    mode: 'value-match',
  },
  web: {
    label: 'web/app/globals.css',
    cssPath: join(root, 'apps/web/app/globals.css'),
    mode: 'import-check',
  },
  registry: {
    label: 'token-registry.ts vs tokens.css + RN name set',
    cssPath: TOKENS_PATH,
    mode: 'registry-check',
  },
}

// ─── CLI 解析 ───
const argv = process.argv.slice(2)
const quiet = argv.includes('--quiet') || argv.includes('-q')
// --staged / --check 接受但无操作(向后兼容,原三脚本均全量扫描)
const acceptsStaged = argv.includes('--staged')
const acceptsCheck = argv.includes('--check')
void acceptsStaged
void acceptsCheck
const showHelp = argv.includes('--help') || argv.includes('-h')

/** @returns {string|null} */
function parseTarget() {
  for (const arg of argv) {
    if (arg.startsWith('--target=')) return arg.slice('--target='.length)
  }
  return null
}

if (showHelp) {
  console.log(`
check-design-tokens-sync.mjs — 统一 design-tokens 同步守门(P1-C + P1-F)

用法:
  node scripts/check-design-tokens-sync.mjs --target=<target> [选项]

目标(--target,必填):
  miniapp-taro   校验 apps/miniapp-taro/src/app.css 变量值与 tokens.css 一致
  mobile-rn      校验 apps/mobile-rn/global.css 变量值与 tokens.css 一致
  web            校验 apps/web/app/globals.css @import 单源 + 无手抄回归
  registry       校验 token-registry.ts 与 tokens.css 双向一致 + RN token 名称子集

选项:
  --quiet, -q    仅输出错误(抑制通过消息)
  --staged       接受但无操作(全量扫描,向后兼容)
  --check        接受但无操作(向后兼容)
  --help, -h     显示此帮助

变量覆盖(P1-C 扩展):
  --color-* / --radius* / --chart-* / --font-* / --animate-* / --z-* / --shadow-*

退出码:
  0 = 同步/无回归
  1 = 发现不一致/回归
  2 = CLI 参数错误
`)
  process.exit(0)
}

const target = parseTarget()
if (!target) {
  console.error('[check-design-tokens-sync] 错误:缺少 --target 参数')
  console.error('  用法: node scripts/check-design-tokens-sync.mjs --target=<miniapp-taro|mobile-rn|web>')
  console.error('  帮助: node scripts/check-design-tokens-sync.mjs --help')
  process.exit(2)
}
const config = TARGETS[target]
if (!config) {
  console.error(`[check-design-tokens-sync] 错误:未知 target '${target}'`)
  console.error(`  可选值: ${Object.keys(TARGETS).join(', ')}`)
  process.exit(2)
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

/** 去除 CSS 块注释 /*(...)*​/(防止注释中的 `--chart-text:图表文字色` 等文本被
 *  变量正则误匹配,导致后续真实变量 `--chart-1` 被吞进"值"部分而报 <missing>)。
 *  @param {string} text
 *  @returns {string} */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '')
}

// P1-C 扩展:匹配所有 design-tokens 变量(原仅 --color-)
// --radius 可无后缀(--radius)或有后缀(--radius-sm),用 radius[\w-]* 覆盖两种
// 其余 6 类均要求前缀+后缀:color-/chart-/font-/animate-/z-/shadow-
const DESIGN_TOKEN_VAR_RE =
  /(--(?:radius[\w-]*|color-[\w-]+|chart-[\w-]+|font-[\w-]+|animate-[\w-]+|z-[\w-]+|shadow-[\w-]+))\s*:\s*([^;]+);/g

/** 从块文本提取 design-tokens 变量(P1-C 扩展:7 类变量,非仅 --color-*)。
 *  先剥离注释,避免注释内的 `--xxx: 描述文字` 被误匹配。
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

/** 从多个选择器块合并变量,合并所有块(后者覆盖前者)。用于 tokens.css(单一真相源)。
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

/** 仅取每个选择器的**首个**块,合并变量。用于目标文件(miniapp-taro / mobile-rn)。
 *
 *  背景:miniapp-taro/src/app.css 含两个 :root 块 —— 首块由 sync-design-tokens.mjs
 *  自动生成(与 tokens.css 同步),次块是 miniapp-taro 本地扩展色板(非 tokens.css
 *  同步范围,见 app.css 注释"本块不会被覆盖")。若合并所有块,本地扩展变量
 *  (--color-link / --color-brand 等)会被误报为与 tokens.css 不一致。
 *
 *  mobile-rn/global.css 只有一个 :root/.dark 块,取首个 = 取全部,行为不变。
 *
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

// ─── 模式 1:值比对(miniapp-taro / mobile-rn) ──────────────────────────

function runValueMatchCheck(targetName, targetCssPath) {
  if (!quiet)
    console.log(
      `[check-design-tokens-sync] Checking ${targetName} vs design-tokens/tokens.css...`,
    )

  const appCss = readCss(targetCssPath)
  const tokensCss = readCss(TOKENS_PATH)

  // 目标文件:仅取首个 :root / .dark 块(避免本地扩展块干扰,见 mergeFirstVars 文档)
  const appRoot = mergeFirstVars(appCss, [':root'])
  const appDark = mergeFirstVars(appCss, ['.dark'])

  // tokens.css(单一真相源):合并所有 @theme + :root 块(后者覆盖前者)+ .dark 块
  const tokensRoot = mergeAllVars(tokensCss, ['@theme', ':root'])
  const tokensDark = mergeAllVars(tokensCss, ['.dark'])

  // 子集检查:只校验目标文件中存在的变量(tokens.css 多出的不报错)
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

  if (diffs.length === 0) {
    const total = Object.keys(appRoot).length + Object.keys(appDark).length
    if (!quiet)
      console.log(`[check-design-tokens-sync] [PASS] All ${total} variables are in sync`)
    process.exit(0)
  }

  console.error(`[check-design-tokens-sync] [FAIL] Found ${diffs.length} mismatch(es):`)
  for (const block of [':root', '.dark']) {
    const items = diffs.filter((d) => d.block === block)
    if (!items.length) continue
    console.error(`  ${block} block:`)
    for (const d of items)
      console.error(`    ${d.name}: ${targetName}='${d.app}' vs tokens='${d.tok}'`)
  }
  process.exit(1)
}

// ─── 模式 2:@import 单源检查(web) ──────────────────────────────────

/**
 * 在 CSS 中查找顶层(非 @at-rule 内)的选择器块。
 * 复刻自原 check-web-tokens-sync.mjs 的 findTopLevelBlocks。
 * @param {string} css
 * @param {string[]} selectors
 * @returns {{ selector: string, content: string, line: number }[]} */
function findTopLevelBlocks(css, selectors) {
  const blocks = []
  /** @type {{ type: string, name?: string, selector?: string }[]} */
  const stack = []
  let i = 0
  let line = 1
  while (i < css.length) {
    const ch = css[i]
    if (ch === '\n') { line++; i++; continue }
    // 跳过块注释 /* ... */
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      if (end === -1) break
      for (let k = i; k < end + 2; k++) if (css[k] === '\n') line++
      i = end + 2
      continue
    }
    // @at-rule 处理(@media / @layer / @container 等)
    if (ch === '@') {
      const m = css.slice(i).match(/^@(\w[\w-]*)/)
      if (m) {
        let j = i + m[0].length
        while (j < css.length && css[j] !== '{' && css[j] !== ';') {
          if (css[j] === '\n') line++
          if (css[j] === '/' && css[j + 1] === '*') {
            const end = css.indexOf('*/', j + 2)
            if (end === -1) { j = css.length; break }
            for (let k = j; k < end + 2; k++) if (css[k] === '\n') line++
            j = end + 2
            continue
          }
          j++
        }
        if (css[j] === '{') { stack.push({ type: 'at-rule', name: m[1] }); i = j + 1; continue }
        if (css[j] === ';') { i = j + 1; continue }
        i = j
        continue
      }
    }
    // 选择器块开始 {
    if (ch === '{') {
      let k = i - 1
      while (k >= 0 && /\s/.test(css[k])) k--
      const selEnd = k + 1
      while (k >= 0) {
        if (css[k] === '}' || css[k] === '{' || css[k] === ';') break
        if (css[k] === '/' && css[k - 1] === '*') {
          k -= 2
          while (k >= 0 && !(css[k] === '/' && css[k + 1] === '*')) k--
          k--
          continue
        }
        k--
      }
      const selector = css.slice(k + 1, selEnd).trim()
      const inAtRule = stack.some((s) => s.type === 'at-rule')
      if (!inAtRule && selectors.includes(selector)) {
        const bs = i + 1
        let bd = 1, be = bs
        const bl = line
        while (be < css.length && bd > 0) {
          if (css[be] === '/' && css[be + 1] === '*') {
            const end = css.indexOf('*/', be + 2)
            be = end === -1 ? css.length : end + 2
            continue
          }
          if (css[be] === '{') bd++
          else if (css[be] === '}') bd--
          else if (css[be] === '\n') line++
          be++
        }
        blocks.push({ selector, content: css.slice(bs, be - 1), line: bl })
      }
      stack.push({ type: 'block', selector })
      i++
      continue
    }
    if (ch === '}') { stack.pop(); i++; continue }
    i++
  }
  return blocks
}

/** 从 tokens.css @theme 块提取所有变量名(P1-C:任意 --* 变量名,非仅 --color-*)。
 *  @param {string} css
 *  @returns {Set<string>} */
function extractThemeVarNames(css) {
  const tm = css.match(/@theme\s*\{([\s\S]*?)\}/)
  if (!tm) return new Set()
  const names = new Set()
  const re = /(--[\w-]+)\s*:/g
  let m
  while ((m = re.exec(tm[1])) !== null) names.add(m[1])
  return names
}

/** 从任意文本提取所有 CSS 变量名(用于检测 web 顶层块是否手抄 @theme 变量)。
 *  @param {string} text
 *  @returns {string[]} */
function extractVarNames(text) {
  const names = new Set()
  const re = /(--[\w-]+)\s*:/g
  let m
  while ((m = re.exec(text)) !== null) names.add(m[1])
  return [...names]
}

function runImportCheck(targetName, targetCssPath) {
  if (!quiet)
    console.log(`[check-design-tokens-sync] Verifying ${targetName} @import single source...`)

  /** @type {number} */
  let exitCode = 0
  let webCss, tokensCss
  try {
    webCss = readCss(targetCssPath)
    tokensCss = readCss(TOKENS_PATH)
  } catch (e) {
    console.error('[check-design-tokens-sync] Read fail: ' + e.message)
    process.exit(1)
  }

  // ① 校验 @import tokens.css 存在
  const hasImport = /@import\s+['"][^'"]*design-tokens\/src\/styles\/tokens\.css['"]/.test(webCss)
  if (!hasImport) {
    console.error('[check-design-tokens-sync] [FAIL] REGRESSION: globals.css missing @import tokens.css!')
    console.error('  web must @import single source token, do not remove.')
    exitCode = 1
  } else if (!quiet) {
    console.log('[check-design-tokens-sync] [PASS] @import tokens.css OK')
  }

  // ② 校验顶层 :root/.dark 未手抄 @theme 变量(P1-C:覆盖所有 @theme 变量,非仅 --color-*)
  const themeVarNames = extractThemeVarNames(tokensCss)
  if (themeVarNames.size === 0) {
    console.error('[check-design-tokens-sync] WARN: tokens.css @theme has no vars')
  } else if (!quiet) {
    console.log('[check-design-tokens-sync] tokens.css @theme: ' + themeVarNames.size + ' vars')
  }

  const topBlocks = findTopLevelBlocks(webCss, [':root', '.dark'])

  if (topBlocks.length === 0) {
    if (!quiet)
      console.log(
        '[check-design-tokens-sync] no top-level :root/.dark blocks OK (high-contrast in @media allowed)',
      )
  } else {
    /** @type {{ selector: string, line: number, dups: string[] }[]} */
    const regressions = []
    for (const b of topBlocks) {
      const vars = extractVarNames(b.content)
      // P1-C:检测所有 @theme 变量的手抄,不限于 --color-*
      const dups = vars.filter((v) => themeVarNames.has(v))
      if (dups.length > 0) regressions.push({ selector: b.selector, line: b.line, dups })
    }
    if (regressions.length > 0) {
      console.error(
        '[check-design-tokens-sync] [FAIL] REGRESSION: top-level :root/.dark hand-copies tokens.css @theme vars!',
      )
      console.error('  Should use @import, duplicate defs cause multi-end drift.')
      for (const r of regressions) {
        console.error('  ' + r.selector + ' (line ' + r.line + '): ' + r.dups.join(', '))
      }
      exitCode = 1
    } else if (!quiet) {
      console.log(
        '[check-design-tokens-sync] [PASS] ' + topBlocks.length + ' top-level blocks no dup OK',
      )
    }
  }

  if (exitCode === 0) {
    if (!quiet)
      console.log('[check-design-tokens-sync] [PASS] OK token single source normal, no regression')
    process.exit(0)
  }
  process.exit(exitCode)
}

// ─── 模式 3:TOKEN_REGISTRY 校验(P3-1.3 立,2026-08-01) ──────────────

/** 从 token-registry.ts 文本中提取所有 token 名称(regex 匹配 name: '--xxx')。
 *  @param {string} content
 *  @returns {Set<string>} */
function extractRegistryTokenNames(content) {
  const names = new Set()
  const re = /name:\s*('[^']*--[^']*'|"[^"]*--[^"]*")/g
  let m
  while ((m = re.exec(content)) !== null) {
    // 去引号
    names.add(m[1].slice(1, -1))
  }
  return names
}

/** 从 CSS 文本中提取所有 CSS 变量名(任意 --* 前缀,去注释)。
 *  @param {string} css
 *  @returns {Set<string>} */
function extractAllCssVarNames(css) {
  const clean = stripComments(css)
  const names = new Set()
  const re = /(--[\w-]+)\s*:/g
  let m
  while ((m = re.exec(clean)) !== null) names.add(m[1])
  return names
}

function runRegistryCheck() {
  if (!quiet)
    console.log('[check-design-tokens-sync] Checking token-registry.ts vs tokens.css + RN name set...')

  /** @type {number} */
  let exitCode = 0

  // ── 校验 1:TOKEN_REGISTRY ↔ tokens.css 双向一致 ──
  let registryContent, tokensCss
  try {
    registryContent = readCss(TOKEN_REGISTRY_PATH)
    tokensCss = readCss(TOKENS_PATH)
  } catch (e) {
    console.error('[check-design-tokens-sync] [FAIL] Read fail: ' + e.message)
    process.exit(1)
  }

  const registryNames = extractRegistryTokenNames(registryContent)
  const cssVarNames = extractAllCssVarNames(tokensCss)

  if (registryNames.size === 0) {
    console.error('[check-design-tokens-sync] [FAIL] token-registry.ts: no token names extracted')
    exitCode = 1
  } else if (!quiet) {
    console.log(`[check-design-tokens-sync] [PASS] token-registry.ts: ${registryNames.size} tokens registered`)
  }

  if (cssVarNames.size === 0) {
    console.error('[check-design-tokens-sync] [FAIL] tokens.css: no CSS variables found')
    exitCode = 1
  } else if (!quiet) {
    console.log(`[check-design-tokens-sync] [PASS] tokens.css: ${cssVarNames.size} CSS variables defined`)
  }

  // registry → tokens.css:注册表中的 token 必须在 tokens.css 中定义
  /** @type {string[]} */
  const missingInCss = []
  for (const name of registryNames) {
    if (!cssVarNames.has(name)) missingInCss.push(name)
  }
  if (missingInCss.length > 0) {
    console.error(`[check-design-tokens-sync] [FAIL] ${missingInCss.length} registry token(s) missing in tokens.css:`)
    for (const n of missingInCss) console.error(`  ${n}`)
    exitCode = 1
  } else if (!quiet) {
    console.log('[check-design-tokens-sync] [PASS] All registry tokens exist in tokens.css')
  }

  // tokens.css → registry:tokens.css 中的 design-token 变量应在注册表中(信息性,warn-only)
  // 注:tokens.css 可能有注册表未覆盖的边缘变量(如 --el-* / --app-* 语义层),仅 warn
  /** @type {string[]} */
  const missingInRegistry = []
  for (const name of cssVarNames) {
    if (!registryNames.has(name)) missingInRegistry.push(name)
  }
  if (missingInRegistry.length > 0 && !quiet) {
    console.log(`[check-design-tokens-sync] [WARN] ${missingInRegistry.length} CSS var(s) not in registry (semantic/alias layer, acceptable):`)
    for (const n of missingInRegistry.slice(0, 15)) console.log(`  ${n}`)
    if (missingInRegistry.length > 15) console.log(`  ... and ${missingInRegistry.length - 15} more`)
  }

  // ── 校验 2:RN token 名称是 web CSS token 名称的子集 ──
  let rnCss = null
  try {
    rnCss = readCss(RN_GLOBAL_CSS_PATH)
  } catch {
    if (!quiet) console.log('[check-design-tokens-sync] [WARN] mobile-rn/global.css not found, skipping RN name set check')
  }

  if (rnCss) {
    // 提取 RN 中的 design-token 变量名(7 类,同 DESIGN_TOKEN_VAR_RE)
    const rnRootVars = mergeFirstVars(rnCss, [':root'])
    const rnDarkVars = mergeFirstVars(rnCss, ['.dark'])
    const rnNames = new Set([...Object.keys(rnRootVars), ...Object.keys(rnDarkVars)])

    // tokens.css 中的 design-token 变量名(7 类)
    const tokensRootVars = mergeAllVars(tokensCss, ['@theme', ':root'])
    const tokensDarkVars = mergeAllVars(tokensCss, ['.dark'])
    const tokensDesignNames = new Set([
      ...Object.keys(tokensRootVars),
      ...Object.keys(tokensDarkVars),
    ])

    /** @type {string[]} */
    const rnExtra = []
    for (const name of rnNames) {
      if (!tokensDesignNames.has(name)) rnExtra.push(name)
    }

    if (rnExtra.length > 0) {
      console.error(`[check-design-tokens-sync] [FAIL] ${rnExtra.length} RN token(s) not in tokens.css:`)
      for (const n of rnExtra) console.error(`  ${n}`)
      exitCode = 1
    } else if (!quiet) {
      console.log(`[check-design-tokens-sync] [PASS] RN name set is subset of tokens.css (${rnNames.size} RN tokens)`)
    }
  }

  if (exitCode === 0) {
    if (!quiet) console.log('[check-design-tokens-sync] [PASS] Registry + RN name set consistency OK')
    process.exit(0)
  }
  process.exit(exitCode)
}

// ─── 主入口 ───
if (config.mode === 'value-match') {
  runValueMatchCheck(config.label, config.cssPath)
} else if (config.mode === 'registry-check') {
  runRegistryCheck()
} else {
  runImportCheck(config.label, config.cssPath)
}
