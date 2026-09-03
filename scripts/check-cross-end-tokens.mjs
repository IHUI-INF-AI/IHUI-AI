#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-cross-end-tokens.mjs - Guard: RN color tokens (rn-tokens.ts) vs
 * miniapp/web color tokens (design-tokens/tokens.css) drift for
 * semantically-identical pairs.
 *
 * 两端唯一定义处:
 *   RN:        packages/design-tokens/src/rn-tokens.ts (rnTokens/rnLightTokens/rnDarkTokens, HEX)
 *   miniapp/web: packages/design-tokens/src/styles/tokens.css (@theme+:root 亮色 / .dark 暗色)
 *
 * 映射表只收"确定语义相同"的色值对(宁缺毋滥),每条注明取值依据。
 * 任何映射对值不一致 → ❌ + exit 1(阻塞),防止跨端颜色漂移。
 *
 * 比对规则:比对前归一为统一格式 —— HEX 原样保留(小写+去空白);
 * hsl(h s% l%) / hsl(h, s%, l%) 转换为 #rrggbb 后比对;rgba/hsla 保持原样不转换
 * (rn rgba(78,163,245,0.15) 与 css rgba(78, 163, 245, 0.15) 视为相等)。
 * tokens.css .dark 未覆盖的变量按 CSS cascade 回退到亮色值参与暗色比对。
 *
 * Usage:
 *   node scripts/check-cross-end-tokens.mjs           # full check
 *   node scripts/check-cross-end-tokens.mjs --list    # print mapping table only
 *   node scripts/check-cross-end-tokens.mjs --quiet   # errors only
 *
 * Exit: 0 = all mappings in sync, 1 = mismatches found
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const RN_TOKENS_PATH = join(root, 'packages/design-tokens/src/rn-tokens.ts')
const TOKENS_CSS_PATH = join(root, 'packages/design-tokens/src/styles/tokens.css')

const argv = process.argv.slice(2)
const quiet = argv.includes('--quiet') || argv.includes('-q')
const listOnly = argv.includes('--list')

// ─── 映射表(每条含取值依据,rn 路径 = [常量名, ...嵌套键]) ───
const MAPPINGS = [
  {
    label: 'vip.gold ↔ --color-vip-gold-start',
    rn: { light: ['rnLightTokens', 'vip', 'gold'], dark: ['rnDarkTokens', 'vip', 'gold'] },
    css: { light: '--color-vip-gold-start', dark: '--color-vip-gold-start' },
    basis: 'rn-tokens.ts L52 注释「VIP 会员金色(对齐 --color-vip-gold-start/end,明暗同值)」;tokens.css @theme L136,.dark 无覆盖(cascade 回退亮色)',
  },
  {
    label: 'vip.goldEnd ↔ --color-vip-gold-end',
    rn: { light: ['rnLightTokens', 'vip', 'goldEnd'], dark: ['rnDarkTokens', 'vip', 'goldEnd'] },
    css: { light: '--color-vip-gold-end', dark: '--color-vip-gold-end' },
    basis: '同上(rn-tokens.ts L52 注释);tokens.css @theme L137,.dark 无覆盖',
  },
  {
    label: 'surface.inputBg (light) ↔ --color-link-bg (:root)',
    rn: { light: ['rnLightTokens', 'surface', 'inputBg'] },
    css: { light: '--color-link-bg' },
    basis: 'rn-tokens.ts L70 注释「输入框背景对齐 miniapp 输入框底色(亮 #f0f7ff)」;tokens.css @theme L148 --color-link-bg: #f0f7ff',
  },
  {
    label: 'surface.inputBg (dark) ↔ --color-link-bg (.dark)',
    rn: { dark: ['rnDarkTokens', 'surface', 'inputBg'] },
    css: { dark: '--color-link-bg' },
    basis: 'rn-tokens.ts L245 rnDarkTokens surface.inputBg = rgba(78,163,245,0.15);tokens.css L410 .dark --color-link-bg: rgba(78, 163, 245, 0.15)(空白归一后相等)',
  },
  {
    label: 'indigo.DEFAULT (light) ↔ --color-brand (:root)',
    rn: { light: ['rnLightTokens', 'indigo', 'DEFAULT'] },
    css: { light: '--color-brand' },
    basis: 'rn-tokens.ts rnLightTokens L193 indigo.DEFAULT = #6366f1;tokens.css @theme L152 --color-brand: #6366f1(hex 完全一致)',
  },
  {
    label: 'indigo.DEFAULT (dark) ↔ --color-brand (.dark)',
    rn: { dark: ['rnDarkTokens', 'indigo', 'DEFAULT'] },
    css: { dark: '--color-brand' },
    basis: 'rn-tokens.ts rnDarkTokens L251 indigo.DEFAULT = #6366f1;tokens.css L414 .dark --color-brand: #818cf8 —— 若红灯即两端暗色品牌色真实漂移,需人工决策',
  },
  {
    label: 'brand.DEFAULT (light) ↔ --color-primary (:root/@theme)',
    rn: { light: ['rnLightTokens', 'brand', 'DEFAULT'] },
    css: { light: '--color-primary' },
    basis: 'rn-tokens.ts L14/L59/L177 注释「brand.DEFAULT = #000000 对齐 web 亮色 --color-primary」;tokens.css @theme L50 --color-primary: hsl(0 0% 0%)(HSL→HEX 归一后 #000000)',
  },
  {
    label: 'brand.DEFAULT (dark) ↔ --color-primary (.dark)',
    rn: { dark: ['rnDarkTokens', 'brand', 'DEFAULT'] },
    css: { dark: '--color-primary' },
    basis: 'rn-tokens.ts L15/L231 注释「brand.DEFAULT = #FFFFFF 对齐 web 暗色 --color-primary(纯白底)」;tokens.css L354 .dark --color-primary: hsl(0 0% 100%)(有覆盖,HSL→HEX 归一后 #ffffff)',
  },
]

// ─── 提取:rn-tokens.ts ───

/** 提取 `export const <name> ... = {` 的平衡花括号对象体。 */
function extractTsObjectBody(src, constName) {
  const re = new RegExp(`export const ${constName}[^=]*=\\s*\\{`)
  const m = re.exec(src)
  if (!m) return null
  let i = m.index + m[0].length
  let depth = 1
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') depth--
    i++
  }
  return src.slice(m.index + m[0].length, i - 1)
}

/** 在对象体内按嵌套键路径解析叶子字符串字面量(如 ['vip','gold'] → '#FFD700')。 */
function resolveTsPath(body, path) {
  let text = body
  for (let idx = 0; idx < path.length; idx++) {
    const key = path[idx]
    const isLeaf = idx === path.length - 1
    const re = new RegExp(`(?:^|[\\s,{])${key}\\s*:`)
    const m = re.exec(text)
    if (!m) return null
    let i = m.index + m[0].length
    while (i < text.length && /\s/.test(text[i])) i++
    if (text[i] === '{') {
      if (isLeaf) return null
      let depth = 1
      i++
      const start = i
      while (i < text.length && depth > 0) {
        if (text[i] === '{') depth++
        else if (text[i] === '}') depth--
        i++
      }
      text = text.slice(start, i - 1)
    } else {
      if (!isLeaf) return null
      const sm = /^'([^']*)'|^"([^"]*)"/.exec(text.slice(i))
      return sm ? (sm[1] ?? sm[2]) : null
    }
  }
  return null
}

// ─── 提取:tokens.css(复用 check-rn-global-css-sync.mjs 的块提取模式) ───

/** 提取所有匹配 selector 的块内文本(平衡花括号)。 */
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

/** 提取块内 CSS 变量,返回 { name: value }。 */
function extractCssVars(text) {
  const vars = {}
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g
  let m
  while ((m = re.exec(text)) !== null) vars[m[1]] = m[2].trim()
  return vars
}

/** 合并多个 selector 块的变量(后者覆盖前者)。 */
function mergeCssVars(css, selectors) {
  const merged = {}
  for (const sel of selectors)
    for (const block of extractAllBlocks(css, sel)) Object.assign(merged, extractCssVars(block))
  return merged
}

// ─── 比对 ───

/** hsl(h s% l%) / hsl(h, s%, l%) → '#rrggbb'。s=0 时 a=0、f(n)=l,灰度边界天然正确。 */
function hslToHex(h, s, l) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const f = n => {
    const k = (n + h / 30) % 12
    return l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
  }
  const hex = x => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`
}

/**
 * 归一化比对值:HEX 原样保留(小写+去空白);hsl(h s% l%) / hsl(h, s%, l%)
 * 转换为 #rrggbb;rgba/hsla 保持原样不转换(仅小写+去空白)。
 * 注意:必须先提取 hsl 再处理空白 —— 空格分隔格式 `hsl(0 0% 0%)` 一旦
 * 去空白会破坏参数边界,导致无法解析。
 */
function normalizeColor(v) {
  const compact = v.trim().replace(/\s+/g, ' ').toLowerCase()
  const m = /^hsla?\(\s*([\d.]+)\s*(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%\s*\)$/.exec(compact)
  if (m) return hslToHex(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]))
  return compact.replace(/\s+/g, '')
}

// ─── Main ───

if (listOnly) {
  console.log('check-cross-end-tokens.mjs 映射表(RN rn-tokens.ts ↔ tokens.css):')
  for (const [i, mp] of MAPPINGS.entries())
    console.log(`  ${i + 1}. ${mp.label}\n     依据: ${mp.basis}`)
  process.exit(0)
}

if (!quiet) console.log('[check-cross-end-tokens] Checking rn-tokens.ts vs tokens.css...')

const rnSrc = readFileSync(RN_TOKENS_PATH, 'utf8')
const cssSrc = readFileSync(TOKENS_CSS_PATH, 'utf8')

const rnBodies = {}
for (const name of ['rnTokens', 'rnLightTokens', 'rnDarkTokens']) {
  rnBodies[name] = extractTsObjectBody(rnSrc, name)
  if (rnBodies[name] === null) {
    console.error(`[check-cross-end-tokens] ❌ 无法在 rn-tokens.ts 中定位 export const ${name}`)
    process.exit(1)
  }
}

// tokens.css: @theme + :root = 亮色;.dark = 暗色(未覆盖变量 cascade 回退亮色)
const cssLight = mergeCssVars(cssSrc, ['@theme', ':root'])
const cssDark = { ...cssLight, ...mergeCssVars(cssSrc, ['.dark']) }

const failures = []
let checked = 0
for (const mp of MAPPINGS) {
  for (const mode of ['light', 'dark']) {
    const rnPath = mp.rn[mode]
    const cssVar = mp.css[mode]
    if (!rnPath || !cssVar) continue
    checked++
    const rnVal = resolveTsPath(rnBodies[rnPath[0]], rnPath.slice(1))
    const table = mode === 'dark' ? cssDark : cssLight
    const cssVal = cssVar in table ? table[cssVar] : null
    const tag = `${mp.label} [${mode}]`
    if (rnVal === null || cssVal === null) {
      failures.push({ tag, detail: `提取失败: rn='${rnVal ?? '<missing>'}' css='${cssVal ?? '<missing>'}'` })
      continue
    }
    if (normalizeColor(rnVal) !== normalizeColor(cssVal))
      failures.push({ tag, detail: `rn='${rnVal}' vs css='${cssVal}'` })
  }
}

if (failures.length === 0) {
  if (!quiet) console.log(`[check-cross-end-tokens] ✅ All ${checked} cross-end token mappings in sync`)
  process.exit(0)
}

console.error(`[check-cross-end-tokens] Found ${failures.length} mismatch(es) (of ${checked} mappings):`)
for (const f of failures) console.error(`  ❌ ${f.tag}: ${f.detail}`)
console.error('  两端值均未改动,请人工决策对齐方向(改 rn-tokens.ts 或 tokens.css 后重跑)。')
process.exit(1)
