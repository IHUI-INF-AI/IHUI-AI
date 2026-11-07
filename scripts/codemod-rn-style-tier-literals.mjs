// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- codemod 为 CLI 工具,需 console 输出出账信息 */
/**
 * codemod-rn-style-tier-literals.mjs — 「档内裸值」A 桶机械改写器
 *
 * 立因:跨端样式体检(`.ihui-agent/tmp/crossend-style-audit-2026-11-06.md`)把 RN / 共享层的
 * 3,223 处数值字面量分成四级 ——
 *   A 342 处(值**恰好等于**某个档位,可机械改写为 token 引用);
 *   B 285 处(表外值 5/7/19/32…,需一次人工裁决:补档 / 落回 / 保留);
 *   C 1,909 处(布局几何 width/height/inset/size…,档位表决定不了);
 *   D 687 处(静态例外:borderWidth:1 发丝线 648 处 + letterSpacing)。
 * 本脚本**只做 A 桶** —— B 硬凑等于静默改视觉,C 不属于档位语义,D 明确豁免。
 * B/C/D/胶囊圆角的命中数**照样统计并打印**,用来证明"本脚本没有越界",但从不改写。
 *
 * 档表不抄数字:运行时从真源文本解析 ——
 *   packages/design-tokens/src/spacing.ts    (SPACING_STEPS)
 *   packages/design-tokens/src/typography.ts (TYPE_STEPS)
 *   packages/design-tokens/src/radius.js     (RADIUS_STEPS)
 * 为什么不直接 `import '*.ts'`:仓里 CI 锁 Node 22.13(`engines >=22.13`),类型剥离默认关闭,
 * `import` .ts 会在 CI 侧直接炸;解析源文本是"读同一份真源"的等价做法,仍然零手抄数字。
 * 档表结构一旦变化到解析不出来,本脚本 exit 2「未判定」,绝不静默返回 0 命中。
 *
 * 三条硬纪律:
 *   1) **只改值、不动结构** —— 按字符偏移替换数字本身;缩进/换行/逗号/注释一个字节不动,
 *      一行内多处替换也各自独立,不会重排、不会改引号风格。
 *   2) **幂等** —— 产物里已是对 token 的引用,再跑一遍 0 命中(第二遍 `--check` 必为 0 diff)。
 *   3) **确定性** —— 文件清单 = `git ls-files` 里筛出的射程文件,按 posix 路径排序后处理;
 *      同值多名按固定优先级取值(见 `buildMaps`),不依赖遍历顺序、无时间戳/随机量。
 *   注释与字符串先做**等长遮罩**再匹配:体检里 `apps/mobile-rn/src/lib/web-shell.web.ts` 的 CSS
 *   模板串 `margin: 0;` 就是这类(审计按裸文本把 342 数进去,本脚本正确地不碰它)。
 *
 * 用法:
 *   node scripts/codemod-rn-style-tier-literals.mjs            # dry-run 出账(不写盘)
 *   node scripts/codemod-rn-style-tier-literals.mjs --write    # 落盘(只写有命中的文件)
 *   node scripts/codemod-rn-style-tier-literals.mjs --check    # 门雏形:有 drift 即 exit 1,永不写盘
 *   node scripts/codemod-rn-style-tier-literals.mjs --json     # 机器可读出账
 *
 * 射程:已跟踪的 `packages/app/src/features/**` 与 `apps/mobile-rn/src/**` 的 .ts/.tsx。
 * 不在射程(一律不碰):`apps/miniapp-taro/**`(含 rn-compat 原语)、`apps/web/**`、
 * i18n 词包、`miniapp-shell-copy-ledger.jsonl`、`ui-routes.generated.ts`、各类台账。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw } from './lib/face-reader.mjs'
import { ensureImport } from './tokens-migrate.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const SCOPE_PREFIXES = ['packages/app/src/features/', 'apps/mobile-rn/src/']
const TIER_FILES = {
  spacing: 'packages/design-tokens/src/spacing.ts',
  typography: 'packages/design-tokens/src/typography.ts',
  radius: 'packages/design-tokens/src/radius.js',
}

/** 键面(与体检同口径;A 桶四族 + C 几何 + D 静态例外) */
const SPACING_KEYS = new Set([
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingHorizontal',
  'paddingVertical',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'gap',
  'rowGap',
  'columnGap',
])
const RADIUS_KEYS = new Set([
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
])
const GEOMETRY_KEYS = new Set([
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'size',
  'flexBasis',
  'top',
  'bottom',
  'left',
  'right',
])
const EXEMPT_KEYS = new Set(['borderWidth', 'letterSpacing'])

const ALL_KEYS = [
  ...SPACING_KEYS,
  ...RADIUS_KEYS,
  'fontSize',
  'lineHeight',
  ...GEOMETRY_KEYS,
  ...EXEMPT_KEYS,
]

/** `key: 数字` 匹配面;`(?![\\d.])` 保证 8 不会吃掉 8.5 / 85 的前缀 */
const KEY_RE = new RegExp(`\\b(${ALL_KEYS.join('|')})\\s*:\\s*(-?\\d+(?:\\.\\d+)?)(?![\\d.])`, 'g')

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/

/** 档名 → 引用表达式:合法标识符走点号,`2xs` / `xs-loose` 这类走下标(与全仓既有写法一致) */
export function tokenRef(objName, step) {
  return IDENT_RE.test(step) ? `${objName}.${step}` : `${objName}['${step}']`
}

/** 等长遮罩:注释与字符串/模板字面量替换为空格(换行保留),偏移量与原文一一对应 */
export function maskCode(src) {
  let out = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? src.length : end + 2
      for (let k = i; k < stop; k++) out += src[k] === '\n' ? '\n' : ' '
      i = stop
    } else if (c === '/' && n === '/') {
      let stop = src.indexOf('\n', i)
      if (stop === -1) stop = src.length
      for (let k = i; k < stop; k++) out += ' '
      i = stop
    } else if (c === '"' || c === "'" || c === '`') {
      const quote = c
      let k = i + 1
      while (k < src.length && src[k] !== quote) {
        if (src[k] === '\\') k++
        k++
      }
      const stop = Math.min(k + 1, src.length)
      for (let j = i; j < stop; j++) out += src[j] === '\n' ? '\n' : ' '
      i = stop
    } else {
      out += c
      i++
    }
  }
  return out
}

/** 把块注释压成空格(保留换行),供档表解析用 */
function blankComments(src) {
  let out = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]
    const n = src[i + 1]
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? src.length : end + 2
      for (let k = i; k < stop; k++) out += src[k] === '\n' ? '\n' : ' '
      i = stop
    } else if (c === '/' && n === '/') {
      let stop = src.indexOf('\n', i)
      if (stop === -1) stop = src.length
      for (let k = i; k < stop; k++) out += ' '
      i = stop
    } else {
      out += c
      i++
    }
  }
  return out
}

/** 取 `export const <name> = { … }` 的对象体(已压注释;按花括号深度收口,字符串内花括号跳过) */
function objectBody(text, name) {
  const anchor = `export const ${name} = {`
  const start = text.indexOf(anchor)
  if (start < 0) throw new Error(`档表锚点未找到:${name}`)
  let depth = 0
  for (let i = start + anchor.length; i < text.length; i++) {
    const c = text[i]
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      i++
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\') i++
        i++
      }
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      if (depth === 0) return text.slice(start + anchor.length, i)
      depth--
    }
  }
  throw new Error(`档表对象未闭合:${name}`)
}

/** 解析真源三表;解析不出来直接抛(调用方翻成 exit 2「未判定」) */
function loadTiers() {
  const spacingSrc = blankComments(readFileSync(join(ROOT, TIER_FILES.spacing), 'utf8'))
  const typographySrc = blankComments(readFileSync(join(ROOT, TIER_FILES.typography), 'utf8'))
  const radiusSrc = blankComments(readFileSync(join(ROOT, TIER_FILES.radius), 'utf8'))

  const spacing = new Map()
  const spacingBody = objectBody(spacingSrc, 'SPACING_STEPS')
  const pairRe = /(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*(-?\d+(?:\.\d+)?)/g
  let m
  while ((m = pairRe.exec(spacingBody)) !== null) spacing.set(m[1] ?? m[2] ?? m[3], Number(m[4]))

  const types = new Map()
  const typeBody = objectBody(typographySrc, 'TYPE_STEPS')
  const typeRe =
    /(?:'([^']+)'|([A-Za-z_$][\w$]*))\s*:\s*\{\s*size:\s*(-?\d+(?:\.\d+)?)\s*,\s*lineHeight:\s*(-?\d+(?:\.\d+)?)\s*,\s*weight:\s*(-?\d+(?:\.\d+)?)\s*\}/g
  while ((m = typeRe.exec(typeBody)) !== null) {
    types.set(m[1] ?? m[2], { size: Number(m[3]), lineHeight: Number(m[4]), weight: Number(m[5]) })
  }

  const radius = new Map()
  const radiusBody = objectBody(radiusSrc, 'RADIUS_STEPS')
  while ((m = pairRe.exec(radiusBody)) !== null) radius.set(m[1] ?? m[2] ?? m[3], Number(m[4]))

  // 防呆:档表结构被改到解析不出来时宁可 exit 2,也不能把 0 命中当真结果报绿
  if (spacing.size < 8 || !spacing.has('none') || !spacing.has('lg')) {
    throw new Error(`SPACING_STEPS 解析不完整(实得 ${spacing.size} 档)`)
  }
  if (types.size < 8 || !types.has('body') || !types.has('label')) {
    throw new Error(`TYPE_STEPS 解析不完整(实得 ${types.size} 档)`)
  }
  if (radius.size < 4 || !radius.has('lg') || !radius.has('DEFAULT')) {
    throw new Error(`RADIUS_STEPS 解析不完整(实得 ${radius.size} 档)`)
  }
  return { spacing, types, radius }
}

let TIERS
export function tiers() {
  if (!TIERS) TIERS = loadTiers()
  return TIERS
}

/**
 * px 值 → 档名映射(确定性取自固定优先级,不依赖对象插入顺序的变化):
 *   spacing: 档值互不相同,首见即定;
 *   fontSize: 档值互不相同;
 *   lineHeight: 16 同时是 caption(11/16) 与 label(12/16) 的行高 —— 固定优先取 label
 *     (label 是 12px 正文档,本仓 fontSize:12 的取用面远大于 11;两者值恒等,渲染零变化);
 *   borderRadius: 8 同时是 DEFAULT(裸 rounded 别名) 与 lg(卡片档) —— 固定优先取 lg,
 *     跳过 Tailwind 别名 DEFAULT(别名随 v3/v4 语义漂移,档名 lg 才是角色档)。
 */
export function buildMaps(t) {
  const spacingByValue = new Map()
  for (const [step, px] of t.spacing) if (!spacingByValue.has(px)) spacingByValue.set(px, step)

  const fontByValue = new Map()
  for (const [step, v] of t.types) if (!fontByValue.has(v.size)) fontByValue.set(v.size, step)

  const lhByValue = new Map()
  const lhPriority = ['label', 'caption']
  const lhOrder = [...lhPriority.filter((s) => t.types.has(s)), ...t.types.keys()].filter(
    (s, idx, arr) => arr.indexOf(s) === idx,
  )
  for (const step of lhOrder) {
    const v = t.types.get(step).lineHeight
    if (!lhByValue.has(v)) lhByValue.set(v, step)
  }

  const radiusByValue = new Map()
  for (const [step, px] of t.radius) {
    if (step === 'DEFAULT') continue
    if (!radiusByValue.has(px)) radiusByValue.set(px, step)
  }
  return { spacingByValue, fontByValue, lhByValue, radiusByValue }
}

/** 单文件改写;返回 { text, hits, stats, edits }。不改 a 桶以外的任何字节 */
export function transformText(text) {
  const t = tiers()
  const maps = buildMaps(t)
  const masked = maskCode(text)
  const edits = []
  const stats = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    pill: 0,
    byKind: { spacing: 0, fontSize: 0, lineHeight: 0, borderRadius: 0 },
    zero: 0,
  }
  KEY_RE.lastIndex = 0
  let m
  while ((m = KEY_RE.exec(masked)) !== null) {
    const key = m[1]
    const value = Number(m[2])
    const numStart = m.index + m[0].lastIndexOf(m[2])
    const base = { start: numStart, end: numStart + m[2].length }
    if (SPACING_KEYS.has(key)) {
      const step = value < 0 ? undefined : maps.spacingByValue.get(value)
      if (!step) {
        stats.B++
        continue
      }
      edits.push({ ...base, text: tokenRef('rnSpacing', step), kind: 'spacing', obj: 'rnSpacing' })
    } else if (key === 'fontSize') {
      const step = maps.fontByValue.get(value)
      if (!step) {
        stats.B++
        continue
      }
      edits.push({
        ...base,
        text: `${tokenRef('rnType', step)}.size`,
        kind: 'fontSize',
        obj: 'rnType',
      })
    } else if (key === 'lineHeight') {
      const step = maps.lhByValue.get(value)
      if (!step) {
        stats.B++
        continue
      }
      edits.push({
        ...base,
        text: `${tokenRef('rnType', step)}.lineHeight`,
        kind: 'lineHeight',
        obj: 'rnType',
      })
    } else if (RADIUS_KEYS.has(key)) {
      if (value >= 500 || value === 999 || value === 1000) {
        stats.pill++
        continue
      }
      const step = maps.radiusByValue.get(value)
      if (!step) {
        stats.B++
        continue
      }
      edits.push({
        ...base,
        text: tokenRef('rnRadius', step),
        kind: 'borderRadius',
        obj: 'rnRadius',
      })
    } else if (GEOMETRY_KEYS.has(key)) {
      stats.C++
    } else {
      stats.D++
    }
  }
  let out = text
  for (let i = edits.length - 1; i >= 0; i--) {
    const e = edits[i]
    out = out.slice(0, e.start) + e.text + out.slice(e.end)
  }
  for (const e of edits) {
    stats.byKind[e.kind]++
    if (
      /^\d+(?:\.\d+)?$/.test(text.slice(e.start, e.end)) &&
      Number(text.slice(e.start, e.end)) === 0
    ) {
      stats.zero++
    }
  }
  stats.A = edits.length
  return { text: out, hits: edits.length, stats, edits }
}

/** 射程文件清单:已跟踪 .ts/.tsx,posix 路径排序(确定性) */
export function collectFiles() {
  return gitRaw(['ls-files', '-z'], ROOT)
    .split('\0')
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, '/'))
    .filter(
      (rel) =>
        SCOPE_PREFIXES.some((p) => rel.startsWith(p)) &&
        /\.(ts|tsx)$/.test(rel) &&
        !rel.endsWith('.d.ts'),
    )
    .sort()
}

function mergeTotals(into, stats) {
  for (const k of ['A', 'B', 'C', 'D', 'pill', 'zero']) into[k] += stats[k]
  for (const k of Object.keys(into.byKind)) into.byKind[k] += stats.byKind[k]
}

function scanRepo({ write = false } = {}) {
  const files = collectFiles()
  const totals = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    pill: 0,
    zero: 0,
    byKind: { spacing: 0, fontSize: 0, lineHeight: 0, borderRadius: 0 },
  }
  const rows = []
  let written = 0
  for (const rel of files) {
    const abs = join(ROOT, rel)
    const text = readFileSync(abs, 'utf8')
    const r = transformText(text)
    mergeTotals(totals, r.stats)
    if (r.hits === 0) continue
    rows.push({ file: rel, hits: r.hits, byKind: r.stats.byKind })
    if (write) {
      const names = [...new Set(r.edits.map((e) => e.obj))].sort()
      writeFileSync(abs, ensureImport(r.text, names))
      written++
    }
  }
  return { scanned: files.length, rows, totals, written }
}

const KIND_LABEL = {
  spacing: 'spacing',
  fontSize: 'fontSize',
  lineHeight: 'lineHeight',
  borderRadius: 'borderRadius',
}

function printReport(res, mode) {
  const t = res.totals
  const kindLine = Object.entries(t.byKind)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${KIND_LABEL[k]} ${n}`)
    .join(' / ')
  console.log(
    `[codemod] 扫描 ${res.scanned} 个射程文件(packages/app/src/features + apps/mobile-rn/src 的已跟踪 .ts/.tsx)`,
  )
  console.log(
    `A 桶应改:${res.rows.length} 个文件 / ${t.A} 处  (${kindLine};其中 0 值 ${t.zero} 处)`,
  )
  console.log(
    `未越界证明:跳过 B(表外档) ${t.B} 处 | 排除 C(布局几何) ${t.C} 处 | ` +
      `排除 D(静态例外 borderWidth/letterSpacing) ${t.D} 处 | 排除胶囊圆角(>=500) ${t.pill} 处`,
  )
  if (res.rows.length > 0) {
    console.log('逐文件改动(TOP 10):')
    const top = [...res.rows]
      .sort((a, b) => b.hits - a.hits || a.file.localeCompare(b.file))
      .slice(0, 10)
    for (const r of top) {
      const kinds = Object.entries(r.byKind)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${KIND_LABEL[k]}:${n}`)
        .join(',')
      console.log(`  ${String(r.hits).padStart(4)}  ${r.file}  (${kinds})`)
    }
    if (res.rows.length > 10) console.log(`  … 其余 ${res.rows.length - 10} 个文件见 --json`)
  }
  if (mode === 'write') console.log(`已写盘:${res.written} 个文件 / ${t.A} 处`)
  else if (mode === 'check') console.log(`应改 ${t.A} 处 / 实际改 0 处(--check 永不写盘)`)
  else console.log('dry-run:未写盘(加 --write 落盘)')
}

function run() {
  const argv = process.argv.slice(2)
  const write = argv.includes('--write')
  const check = argv.includes('--check')
  const json = argv.includes('--json')
  if (write && check) {
    console.error('❌ --write 与 --check 同给:一面写盘一面判 0 diff,语义冲突')
    return process.exit(2)
  }
  let res
  try {
    res = scanRepo({ write })
  } catch (e) {
    console.error(`❌ 未判定:${e?.message ?? e}`)
    return process.exit(2)
  }
  if (json) {
    console.log(
      JSON.stringify({ mode: write ? 'write' : check ? 'check' : 'dry-run', ...res }, null, 1),
    )
    if (check && res.totals.A > 0) process.exit(1)
    return
  }
  printReport(res, write ? 'write' : check ? 'check' : 'dry-run')
  if (check && res.totals.A > 0) process.exit(1)
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) run()

export const __test__ = { transformText, tokenRef, maskCode, buildMaps, tiers, collectFiles }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
