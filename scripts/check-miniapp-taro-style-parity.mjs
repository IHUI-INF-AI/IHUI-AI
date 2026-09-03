#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-miniapp-taro-style-parity.mjs — miniapp-taro 跨端样式一致性守门(2026-09-03 立)。
 *
 * 背景:web 与 miniapp-taro 必须视觉完全一致(除平台独占差异)。此前 app.css 硬编码
 *       深色科技风全局覆盖 + 565 处硬编码 hex + 同名工具类冲突,导致两端样式严重
 *       不一致。本次重构后建立守门,防止回潮,落实「两端修改必须同步」铁律。
 *
 * 校验内容(RULE-1~5):
 *   RULE-1a (BLOCK): 页面/组件 CSS 规则中出现深色科技风禁用色板
 *                    (#00f2ff/#121217/#1f1f28/#1a1a2e/#1a1a23/#12121a/#0a0a0f/#1e1e2e/#2a2a3e)。
 *   RULE-1b (WARN) : 页面/组件 CSS 规则中其他硬编码 #hex(建议改用 design-tokens 变量)。
 *   RULE-2  (BLOCK): app.css 回归 —— 不得再出现深色科技风全局覆盖
 *                    (禁用色板 / page{...!important 字体} / *{font-family!important})。
 *   RULE-3  (BLOCK): app.config.ts 中每个路由页 .tsx 必须挂载 <ThemeRoot>(主题根节点)。
 *   RULE-4  (WARN) : tsx 内联硬编码色值(style color/backgroundColor/fill/stroke)建议改用 token。
 *   RULE-5  (BLOCK): 已删除的深色科技装饰类(card-neon/cyber-card/tech-card/tech-border/
 *                    tech-grid/tech-loading/glass/gradient-primary/text-light/text-neon/
 *                    text-error/list-cell/uni-tabbar/btn-accent)不得被重新引用。
 *   RULE-6  (BLOCK): CSS 伪类不得带空格(`: active` 会导致 weapp-tailwindcss 构建失败),
 *                    必须为 `:active`(无空格)。扫描 app.css + 页面/组件 CSS。
 *
 * 退出码:0 = 全部通过(含 WARN,不阻塞);1 = 出现 BLOCK 级失败(阻塞)。
 *
 * 用法:
 *   node scripts/check-miniapp-taro-style-parity.mjs           # 全量校验
 *   node scripts/check-miniapp-taro-style-parity.mjs --quiet   # 仅输出失败
 *   node scripts/check-miniapp-taro-style-parity.mjs --help    # 帮助
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码中文绝对路径) ───
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'apps/miniapp-taro/src')
const APP_CSS_PATH = join(SRC, 'app.css')
const APP_CONFIG_PATH = join(SRC, 'app.config.ts')
const PAGES_DIR = join(SRC, 'pages')
const COMPONENTS_DIR = join(SRC, 'components')

// ─── CLI 解析 ───
const argv = process.argv.slice(2)
const quiet = argv.includes('--quiet') || argv.includes('-q')
const showHelp = argv.includes('--help') || argv.includes('-h')

if (showHelp) {
  console.log(`
check-miniapp-taro-style-parity.mjs — miniapp-taro 跨端样式一致性守门(2026-09-03)

用法:
  node scripts/check-miniapp-taro-style-parity.mjs [选项]

选项:
  --quiet, -q    仅输出失败(BLOCK 级)信息
  --help, -h     显示此帮助

校验内容:
  RULE-1a (BLOCK) 页面/组件 CSS 禁用深色科技风色板
  RULE-1b (WARN)  页面/组件 CSS 其他硬编码 #hex
  RULE-2  (BLOCK) app.css 深色科技风全局覆盖回归
  RULE-3  (BLOCK) 路由页必须挂载 <ThemeRoot>
  RULE-4  (WARN)  tsx 内联硬编码色值
  RULE-5  (BLOCK) 已删除的科技装饰类被重新引用
  RULE-6  (BLOCK) CSS 伪类带空格(: active 导致构建失败)

退出码:
  0 = 通过(含 WARN)
  1 = BLOCK 级失败
`)
  process.exit(0)
}

// ─── 常量 ───

/** 深色科技风禁用色板(本次重构从 app.css 彻底移除,任何回潮即 BLOCK)。 */
const BANNED_DARKTECH = new Set([
  '#00f2ff',
  '#121217',
  '#1f1f28',
  '#1a1a2e',
  '#1a1a23',
  '#12121a',
  '#0a0a0f',
  '#1e1e2e',
  '#2a2a3e',
])

/** 已删除的深色科技装饰类(零引用,重新引用即 BLOCK)。 */
const DELETED_CLASSES = [
  'card-neon',
  'cyber-card',
  'tech-card',
  'tech-border',
  'tech-grid',
  'tech-loading',
  'glass',
  'gradient-primary',
  'text-light',
  'text-neon',
  'text-error',
  'list-cell',
  'uni-tabbar',
  'btn-accent',
]

/** RULE-4 平台/品牌色白名单(微信绿、链接蓝、VIP 金、状态色等,属平台常量,允许硬编码)。 */
const PLATFORM_COLORS = new Set([
  '#07c160',
  '#09bb07',
  '#4cd964',
  '#00b578',
  '#1677ff',
  '#409eff',
  '#517bff',
  '#8b91ff',
  '#847cff',
  '#6366f1',
  '#ffd700',
  '#ffc107',
  '#ff6b00',
  '#d4a017',
  '#d4af6a',
  '#b8860b',
  '#cd7f32',
  '#c0c0c0',
  '#b89dff',
  '#ec4899',
  '#f8d486',
  '#ff0b0b',
  '#e94d3a',
  '#ff9800',
  '#fff',
  '#ffffff',
  '#000',
  '#000000',
  '#f0f8e8',
  '#f0eeff',
  '#7ca500',
  '#716fff',
  '#6b6980',
  '#b7b5ca',
  '#d1d1d1',
  '#222',
  '#2c2c2c',
  '#3a3a3a',
  '#3d3d3d',
])

// ─── 工具函数 ───

/** 读取文本并去除 BOM。 */
function readText(p) {
  let s = readFileSync(p, 'utf8')
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
  return s
}

/** 去除 CSS 块注释 /* ... *\/。 */
function stripCssComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** 去除 TS/JS 行注释与块注释(用于 tsx 扫描)。 */
function stripTsComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** 递归收集目录下所有指定后缀文件。 */
function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, exts, out)
    else if (exts.includes(full.slice(full.lastIndexOf('.') + 1))) out.push(full)
  }
  return out
}

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g

/** 从已去注释文本提取所有 #hex(小写)。 */
function extractHexes(cleanText) {
  const out = []
  let m
  const re = new RegExp(HEX_RE.source, 'g')
  while ((m = re.exec(cleanText)) !== null) out.push(m[0].toLowerCase())
  return out
}

// ─── 主校验逻辑 ───

/** @returns {number} exit code */
function main() {
  if (!quiet) console.log('[check-miniapp-taro-style-parity] 跨端样式一致性守门...')
  let blocking = 0
  let warnings = 0

  const pageCss = walk(PAGES_DIR, ['css'])
  const compCss = walk(COMPONENTS_DIR, ['css'])
  const allCss = [...pageCss, ...compCss]
  const pageTsx = walk(PAGES_DIR, ['tsx'])
  const compTsx = walk(COMPONENTS_DIR, ['tsx'])
  const allTsx = [...pageTsx, ...compTsx]

  // ── RULE-1a / RULE-1b:页面/组件 CSS 硬编码 hex ──
  const bannedHits = [] // { file, hex }
  const otherHex = new Map() // file -> Set<hex>
  for (const f of allCss) {
    const clean = stripCssComments(readText(f))
    for (const hex of extractHexes(clean)) {
      if (BANNED_DARKTECH.has(hex)) bannedHits.push({ file: f, hex })
      else {
        if (!otherHex.has(f)) otherHex.set(f, new Set())
        otherHex.get(f).add(hex)
      }
    }
  }
  if (bannedHits.length > 0) {
    blocking++
    console.error(`[FAIL] RULE-1a: ${bannedHits.length} 处深色科技风禁用色板回潮:`)
    for (const h of bannedHits.slice(0, 20))
      console.error(`    ${h.file.replace(SRC + '/', '')}: ${h.hex}`)
  } else if (!quiet) {
    console.log('[PASS] RULE-1a: 无深色科技风禁用色板回潮')
  }
  let otherTotal = 0
  for (const set of otherHex.values()) otherTotal += set.size
  if (otherTotal > 0) {
    warnings++
    if (!quiet) {
      console.log(`[WARN] RULE-1b: ${otherTotal} 处其他硬编码 #hex(建议改用 design-tokens 变量):`)
      let shown = 0
      for (const [f, set] of otherHex) {
        if (shown >= 15) break
        console.log(`    ${f.replace(SRC + '/', '')}: ${[...set].join(' ')}`)
        shown++
      }
      if (otherHex.size > 15) console.log(`  ... 共 ${otherHex.size} 个文件`)
    }
  } else if (!quiet) {
    console.log('[PASS] RULE-1b: 页面/组件 CSS 无硬编码 #hex')
  }

  // ── RULE-2:app.css 深色科技风回归 ──
  if (existsSync(APP_CSS_PATH)) {
    const clean = stripCssComments(readText(APP_CSS_PATH))
    const bannedInApp = extractHexes(clean).filter((h) => BANNED_DARKTECH.has(h))
    // 深色全局覆盖签名:page{...} 含背景十六进制,或 *{font-family...!important}
    const darkOverride =
      /\bpage\s*\{[^}]*background\s*:\s*#[0-9a-fA-F]{3,8}/.test(clean) ||
      /\*\s*\{[^}]*font-family[^}]*!important/.test(clean)
    if (bannedInApp.length > 0 || darkOverride) {
      blocking++
      console.error('[FAIL] RULE-2: app.css 出现深色科技风全局覆盖回归:')
      if (bannedInApp.length > 0)
        console.error(`    禁用色板: ${[...new Set(bannedInApp)].join(' ')}`)
      if (darkOverride) console.error('    检测到 page{...!important 字体} 或 *{font-family!important} 覆盖')
    } else if (!quiet) {
      console.log('[PASS] RULE-2: app.css 无深色科技风全局覆盖回归')
    }
  } else if (!quiet) {
    console.log('[SKIP] RULE-2: app.css 不存在,跳过')
  }

  // ── RULE-3:路由页必须挂载 <ThemeRoot> ──
  if (existsSync(APP_CONFIG_PATH)) {
    const cfg = readText(APP_CONFIG_PATH)
    const m = cfg.match(/pages:\s*\[([\s\S]*?)\]/)
    if (m) {
      const pages = (m[1].match(/'[^']+'|"[^"]+"/g) || []).map((s) =>
        s.replace(/['"]/g, ''),
      )
      const missing = []
      for (const p of pages) {
        const tsx = join(SRC, p + '.tsx')
        if (!existsSync(tsx)) continue
        if (!/ThemeRoot/.test(readText(tsx))) missing.push(p)
      }
      if (missing.length > 0) {
        blocking++
        console.error(`[FAIL] RULE-3: ${missing.length}/${pages.length} 路由页未挂载 <ThemeRoot>:`)
        for (const p of missing.slice(0, 30)) console.error(`    pages/${p}.tsx`)
      } else if (!quiet) {
        console.log(`[PASS] RULE-3: ${pages.length} 个路由页全部挂载 <ThemeRoot>`)
      }
    } else if (!quiet) {
      console.log('[SKIP] RULE-3: 未能解析 app.config.ts pages[],跳过')
    }
  } else if (!quiet) {
    console.log('[SKIP] RULE-3: app.config.ts 不存在,跳过')
  }

  // ── RULE-4:tsx 内联硬编码色值(WARN) ──
  const inlineColorRe =
    /(color|backgroundColor|fill|stroke|borderColor)\s*[:=]\s*["'](#[0-9a-fA-F]{3,8})["']/g
  let inlineCount = 0
  const inlineSamples = []
  for (const f of allTsx) {
    const clean = stripTsComments(readText(f))
    let m
    const re = new RegExp(inlineColorRe.source, 'g')
    while ((m = re.exec(clean)) !== null) {
      const hex = m[2].toLowerCase()
      if (PLATFORM_COLORS.has(hex)) continue
      inlineCount++
      if (inlineSamples.length < 15)
        inlineSamples.push(`${f.replace(SRC + '/', '')}:${m[1]}=${m[2]}`)
    }
  }
  if (inlineCount > 0) {
    warnings++
    if (!quiet) {
      console.log(`[WARN] RULE-4: ${inlineCount} 处 tsx 内联硬编码色值(非平台色,建议改用 token):`)
      for (const s of inlineSamples) console.log(`    ${s}`)
      if (inlineCount > 15) console.log(`  ... 共 ${inlineCount} 处`)
    }
  } else if (!quiet) {
    console.log('[PASS] RULE-4: tsx 无非常规内联硬编码色值')
  }

  // ── RULE-5:已删除科技装饰类被重新引用(BLOCK) ──
  const reintro = []
  const scanForDeleted = (files, isCss) => {
    for (const f of files) {
      const clean = isCss ? stripCssComments(readText(f)) : stripTsComments(readText(f))
      for (const cls of DELETED_CLASSES) {
        // 类选择器 .cls 或 className 中的 "cls"/'cls'/ cls 边界
        const re = isCss
          ? new RegExp(`\\.${cls}\\b`)
          : new RegExp(`['"\`\\s]${cls}\\b`)
        if (re.test(clean)) reintro.push({ file: f, cls })
      }
    }
  }
  scanForDeleted(allCss, true)
  scanForDeleted(allTsx, false)
  if (reintro.length > 0) {
    blocking++
    console.error(`[FAIL] RULE-5: ${reintro.length} 处已删除科技装饰类被重新引用:`)
    for (const r of reintro.slice(0, 30))
      console.error(`    ${r.file.replace(SRC + '/', '')}: .${r.cls}`)
  } else if (!quiet) {
    console.log('[PASS] RULE-5: 无已删除科技装饰类被重新引用')
  }

  // ── RULE-6:CSS 伪类/伪元素带空格(`: active` / `: last-child` 导致 weapp-tailwindcss 构建失败) ──
  const PSEUDO_KW = [
    'active', 'hover', 'focus', 'focus-within', 'focus-visible', 'visited', 'link',
    'checked', 'unchecked', 'disabled', 'enabled', 'first-child', 'last-child',
    'first-of-type', 'last-of-type', 'nth-child', 'nth-of-type', 'only-child',
    'only-of-type', 'empty', 'not', 'root', 'target', 'default', 'valid', 'invalid',
    'required', 'optional', 'in-range', 'out-of-range', 'read-only', 'read-write',
    'placeholder-shown', 'odd', 'even', 'first-letter', 'first-line', 'selection',
    'backdrop', 'marker', 'placeholder', 'shadow', 'before', 'after',
  ]
  const spacePseudoRe = new RegExp(':[ \\t]+(' + PSEUDO_KW.join('|') + ')\\b', 'g')
  const spacePseudoHits = []
  for (const f of [...allCss, APP_CSS_PATH]) {
    if (!existsSync(f)) continue
    const clean = stripCssComments(readText(f))
    let m
    const re = new RegExp(spacePseudoRe.source, 'g')
    while ((m = re.exec(clean)) !== null) spacePseudoHits.push(`${f.replace(SRC + '/', '')} -> :${m[1]}`)
  }
  if (spacePseudoHits.length > 0) {
    blocking++
    console.error(`[FAIL] RULE-6: ${spacePseudoHits.length} 处 CSS 伪类带空格(应为 :pseudo 无空格,否则构建失败):`)
    for (const h of [...new Set(spacePseudoHits)].slice(0, 30)) console.error(`    ${h}`)
  } else if (!quiet) {
    console.log('[PASS] RULE-6: 无 CSS 伪类带空格')
  }

  // ── 汇总 ──
  if (blocking > 0) {
    console.error(`\n❌ 跨端样式一致性守门失败:${blocking} 项 BLOCK 级问题(已阻塞)`)
    return 1
  }
  if (!quiet) {
    if (warnings > 0) console.log(`\n✅ 跨端样式一致性守门通过(${warnings} 项 WARN,不阻塞)`)
    else console.log('\n✅ 跨端样式一致性守门通过(无 WARN)')
  }
  return 0
}

process.exit(main())
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
