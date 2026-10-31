#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出对账报告 */
/**
 * check-miniapp-style-tiers.mjs — 小程序端「非色档取值」的三桶对账尺
 *
 * 立因(2026-10-31 现读):跨端非色档的单向链是 web → RN → 小程序。
 *   · RN 侧已有 `check-web-rn-style-tiers.mjs` + `land-rn-style-tiers.mjs` + guardian 自愈轮;
 *   · 小程序侧此前**零判据** —— `check-miniapp-taro-style-parity.mjs` 判的是旧 rpx 口径的视觉对齐,
 *     不回答"这处取值到底跟不跟档表走"。
 * 上一枚提交(f5db1221ae)把项目具名档注册进小程序 `@theme`,从此 `.p-md` / `.text-body` /
 * `.shadow-elevation-md` 在 weapp 产物里可生成。**但"能生成"不等于"有人用"**:实测端内
 * 字号任意值 1265 处、间距 rpx 字面量 870 处,档引用只有 5 处。本尺量这一格。
 *
 * 三桶(为什么不是"值合不合法"):
 *   projectRef   走项目档 ⇒ 改 tokens.css 的档值,小程序自动跟随(构造性保证)
 *   defaultTier  走 Tailwind **默认**档(`text-sm` / `p-3`)⇒ 值可能恰好等于项目档,
 *                但**不跟项目档走**(改档表它不动)。这是本项目最隐蔽的一型:
 *                两端屏幕上一样,而"自动同步"结构上不成立。
 *   literal      裸 rpx 字面量(`text-[length:28rpx]` / `padding: 24rpx`)⇒ 连默认档都没走。
 * 另输出**可等值落档数**:literal 里值恰好等于某档的处数 —— 这是落档器(等值改写、像素零变化)
 * 的射程上界,不等于"可以无脑替换"(字号替换会带入档的 line-height,另见 `--self-test` 注释)。
 *
 * 取材面(§0.4 / 守门 118):默认 HEAD blob;`--staged` 判索引 blob;`--worktree` 仅人工逃生舱。
 * 档表从**被审面**读 TS 源后交 `sync-css-tokens.mjs` 的 `parseTokenTables` 同一把尺解析(§0.6 零复算)。
 *
 * 定级:只读报告器,exit 0(正常报告);取不到档表/目录 ⇒ exit 2「未判定」(§0.3)。
 *   刻意**不进提交链**:存量与本次提交无关,挂 blocking = §12e 恒红门。唯一调度器 =
 *   `scripts/parity-auto.mjs` 的 gate 组(与 RN 尺子同组)。
 *
 * 用法:
 *   node scripts/check-miniapp-style-tiers.mjs              # 人类可读
 *   node scripts/check-miniapp-style-tiers.mjs --json       # 机器可读
 *   node scripts/check-miniapp-style-tiers.mjs --quiet      # 仅结论行
 *   node scripts/check-miniapp-style-tiers.mjs --staged     # 索引面
 *   node scripts/check-miniapp-style-tiers.mjs --self-test  # 判据自检(纯函数 + 夹具)
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { buildEntries, parseTokenTables } from './sync-css-tokens.mjs'
import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { maskComments } from './lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const quietMode = argv.includes('--quiet')
const selfTest = argv.includes('--self-test')
const faceSel = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
if (faceSel.error) {
  console.error(`❌ ${faceSel.error} ⇒ 未判定,不猜哪一个算`)
  process.exit(2)
}
const FACE = faceSel.face
const SPEC_PREFIX = FACE === 'head' ? 'HEAD:' : FACE === 'staged' ? ':' : ''

const MINIAPP_DIRS = ['apps/miniapp-taro/src']
const SPACING_REL = 'packages/design-tokens/src/spacing.ts'
const TYPOGRAPHY_REL = 'packages/design-tokens/src/typography.ts'
const ELEVATION_REL = 'packages/design-tokens/src/elevation.ts'

/** Tailwind v4 默认档(小程序产物引擎同源):这些键**不跟项目档表**。 */
const TW_TEXT_KEYS = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl']
const TW_SPACING_CLASSES = ['p', 'px', 'py', 'pt', 'pb', 'pl', 'pr', 'm', 'mx', 'my', 'mt', 'mb', 'ml', 'mr', 'gap', 'space-x', 'space-y', 'size', 'w', 'h', 'min-w', 'min-h', 'max-w', 'max-h', 'inset', 'top', 'right', 'bottom', 'left']
/** 项目间距档名(与 SPACING_STEPS 键同源;此处只是类名的形状白名单,值仍从档表取)。 */
const PROJECT_SPACING_KEYS = ['none', '2xs', 'xs', 'xs-loose', 'sm', 'sm-loose', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl']
const PROJECT_RADIUS_KEYS = ['xs', 'sm', 'md', 'lg', 'xl', '2xl']

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 纯函数:从单文件正文里抽取四类计数。测试直接 import 它,不复制判据(§22c)。
 * 传入正文必须是**已剥注释**的代码面(`--self-test` 与调用方都走 maskComments)。
 */
export function scanText(text, table) {
  const out = {
    textProject: 0,
    textDefault: 0,
    textArbitrary: 0,
    textArbitraryHittable: 0,
    spaceProjectNamed: 0,
    spaceDefaultNumeric: 0,
    spaceLiteral: 0,
    spaceLiteralHittable: 0,
    radiusProject: 0,
    radiusLiteral: 0,
    shadowProject: 0,
    tsRefs: 0,
    cssVarRefs: 0,
    samples: { textHittable: [], spaceHittable: [] },
  }

  // ── 字号:项目档类 / Tailwind 默认类 / 任意值 ──
  // 项目字号档名与 Tailwind 默认字号档名**刻意不共用一张表**:`text-sm`/`text-lg` 是 v4 默认档,
  // 归 default 桶(改项目档不跟随);`text-body`/`text-title` 才是项目档。
  const PROJECT_TEXT_KEYS = ['badge', 'caption', 'label', 'body', 'strong', 'title', 'subtitle', 'heading', 'display', 'display-lg']
  for (const m of text.matchAll(new RegExp(`\\btext-(${PROJECT_TEXT_KEYS.map((k) => esc(k)).join('|')})\\b`, 'g'))) {
    void m
    out.textProject++
  }
  for (const m of text.matchAll(new RegExp(`\\btext-(${TW_TEXT_KEYS.map((k) => esc(k)).join('|')})\\b`, 'g'))) {
    void m
    out.textDefault++
  }
  for (const m of text.matchAll(/text-\[(?:length:)?(\d+(?:\.\d+)?)rpx\]/g)) {
    out.textArbitrary++
    const px = Number(m[1]) / 2
    // 任意值是否命中项目档(等值可落档):只认字号档
    if (table.typeSizes.has(px)) {
      out.textArbitraryHittable++
      if (out.samples.textHittable.length < 5) out.samples.textHittable.push(`${m[0]} → ${px}px`)
    }
  }

  // ── 间距:具名档类 / 默认数字档类 / rpx 字面量 ──
  const projSpaceCls = new RegExp(`\\b(?:${TW_SPACING_CLASSES.map((c) => esc(c)).join('|')})-(${PROJECT_SPACING_KEYS.map((k) => esc(k)).join('|')})\\b`, 'g')
  for (const m of text.matchAll(projSpaceCls)) {
    void m
    out.spaceProjectNamed++
  }
  const defSpaceCls = new RegExp(`\\b(?:${TW_SPACING_CLASSES.map((c) => esc(c)).join('|')})-(\\d+(?:\\.\\d+)?)\\b`, 'g')
  for (const m of text.matchAll(defSpaceCls)) {
    void m
    out.spaceDefaultNumeric++
  }
  // 字面量:style 对象 / CSS 属性里的 rpx 长度
  const litRe = /\b(padding|paddingHorizontal|paddingVertical|paddingTop|paddingBottom|paddingLeft|paddingRight|margin|marginTop|marginBottom|marginLeft|marginRight|marginHorizontal|marginVertical|gap|rowGap|columnGap|fontSize|lineHeight|width|height|minWidth|minHeight|maxWidth|maxHeight|top|right|bottom|left|borderRadius)\s*:\s*'?(\d+(?:\.\d+)?)rpx'?/g
  for (const m of text.matchAll(litRe)) {
    const prop = m[1]
    const px = Number(m[2]) / 2
    if (prop === 'fontSize' || prop === 'lineHeight') continue // 字号维已由 text-[length:] 统计;lineHeight 另计
    if (prop === 'borderRadius') {
      out.radiusLiteral++
      continue
    }
    out.spaceLiteral++
    if (table.spacingPx.has(px)) {
      out.spaceLiteralHittable++
      if (out.samples.spaceHittable.length < 5) out.samples.spaceHittable.push(`${prop}: ${m[2]}rpx → ${px}px`)
    }
  }

  // ── 圆角:项目档类(rounded-xs..2xl 与项目档同名同值) ──
  out.radiusProject += [...text.matchAll(new RegExp(`\\brounded-(${PROJECT_RADIUS_KEYS.map((k) => esc(k)).join('|')})\\b`, 'g'))].length

  // ── 阴影:项目档类 ──
  out.shadowProject += [...text.matchAll(/\bshadow-elevation-(?:none|sm|md|lg|xl)\b/g)].length

  // ── TS 档引用与 CSS 变量引用 ──
  out.tsRefs += [...text.matchAll(/\b(?:taroSpacingFor|taroSpacing|taroType|taroElevation)\s*[.[]/g)].length
  out.cssVarRefs += [...text.matchAll(/var\(\s*--(?:spacing|text|shadow-elevation)-[a-z0-9-]+/g)].length

  return out
}

/** 汇总多个文件的计数。 */
export function reduceCounts(list) {
  const keys = [
    'textProject',
    'textDefault',
    'textArbitrary',
    'textArbitraryHittable',
    'spaceProjectNamed',
    'spaceDefaultNumeric',
    'spaceLiteral',
    'spaceLiteralHittable',
    'radiusProject',
    'radiusLiteral',
    'shadowProject',
    'tsRefs',
    'cssVarRefs',
  ]
  const total = Object.fromEntries(keys.map((k) => [k, 0]))
  const samples = { textHittable: [], spaceHittable: [] }
  for (const c of list) {
    for (const k of keys) total[k] += c[k]
    for (const k of Object.keys(samples)) {
      for (const s of c.samples[k]) if (samples[k].length < 5) samples[k].push(s)
    }
  }
  const project = total.textProject + total.spaceProjectNamed + total.tsRefs + total.cssVarRefs + total.radiusProject + total.shadowProject
  const defaulted = total.textDefault + total.spaceDefaultNumeric
  const literal = total.textArbitrary + total.spaceLiteral + total.radiusLiteral
  const all = project + defaulted + literal
  return {
    ...total,
    project,
    defaulted,
    literal,
    all,
    projectPct: all ? Number(((project / all) * 100).toFixed(1)) : 0,
    defaultPct: all ? Number(((defaulted / all) * 100).toFixed(1)) : 0,
    literalPct: all ? Number(((literal / all) * 100).toFixed(1)) : 0,
    samples,
  }
}

function listFiles(dirs) {
  const out = []
  for (const d of dirs) {
    let text
    try {
      text = String(
        FACE === 'staged'
          ? gitRaw(['ls-files', '-s', '--', d], ROOT)
          : gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', d], ROOT),
      )
    } catch {
      return { files: null, reason: `${d} 目录清单取不到(${FACE} 面)` }
    }
    for (const l of text.split('\n')) {
      const p = FACE === 'staged' ? l.split('\t').pop() : l
      if (!p || !/\.(tsx|ts|css)$/.test(p)) continue
      if (/\.test\.|\/tests?\//.test(p)) continue
      out.push(p)
    }
  }
  return { files: out, reason: null }
}

function fetchTexts(paths) {
  const m = new Map()
  if (FACE === 'worktree') {
    for (const p of paths) {
      try {
        m.set(p, readWorktreeFile(ROOT, p))
      } catch {
        m.set(p, null)
      }
    }
    return m
  }
  const specs = paths.map((p) => SPEC_PREFIX + p)
  const got = catBatch(ROOT, specs, { maxBuffer: 1 << 28 })
  for (const p of paths) m.set(p, got.get(SPEC_PREFIX + p) ?? null)
  return m
}

function loadTierTable() {
  const rels = [SPACING_REL, TYPOGRAPHY_REL, ELEVATION_REL]
  const texts = fetchTexts(rels)
  const missing = rels.filter((r) => texts.get(r) === null)
  if (missing.length) throw new Error(`档表源取不到(${FACE} 面):${missing.join(', ')}`)
  const tables = parseTokenTables({
    spacing: texts.get(SPACING_REL),
    typography: texts.get(TYPOGRAPHY_REL),
    elevation: texts.get(ELEVATION_REL),
  })
  const entries = buildEntries(tables)
  const spacingPx = new Set(Object.values(tables.SPACING_STEPS).map(Number))
  const typeSizes = new Set(Object.values(tables.TYPE_STEPS).map((v) => Number(v.size)))
  return { entries, spacingPx, typeSizes }
}

const SELF_TEST_CASES = [
  {
    name: '项目字号档类计入 project',
    text: 'className="text-body text-title"',
    expect: (c) => c.textProject === 2 && c.textDefault === 0,
  },
  {
    name: 'Tailwind 默认字号档计入 default(不是 project)',
    text: 'className="text-sm text-xs"',
    expect: (c) => c.textDefault === 2 && c.textProject === 0,
  },
  {
    name: '字号任意值 28rpx(=14px)命中档表 ⇒ 可等值落档',
    text: 'className="text-[length:28rpx]"',
    expect: (c) => c.textArbitrary === 1 && c.textArbitraryHittable === 1,
  },
  {
    name: '字号任意值 26rpx(=13px)不在档表 ⇒ 不算可落档',
    text: 'className="text-[length:26rpx]"',
    expect: (c) => c.textArbitrary === 1 && c.textArbitraryHittable === 0,
  },
  {
    name: '间距 rpx 字面量 24rpx(=12px)命中档表',
    text: "style={{ padding: '24rpx', marginTop: 12rpx }}",
    expect: (c) => c.spaceLiteral === 2 && c.spaceLiteralHittable === 2,
  },
  {
    name: '具名间距类 vs 默认数字类分流',
    text: 'className="p-md gap-lg p-3 gap-2"',
    expect: (c) => c.spaceProjectNamed === 2 && c.spaceDefaultNumeric === 2,
  },
  {
    name: 'CSS 变量引用与 TS 档引用各计一格',
    text: "const s = taroSpacing.md; const t = taroType.body.fontSize; .x{padding:var(--spacing-md)}",
    expect: (c) => c.tsRefs === 2 && c.cssVarRefs === 1,
  },
  {
    name: '注释里的写法不得计数(剥注释后为空)',
    text: '// className="text-sm p-3"\n/* text-[length:28rpx] */\n',
    maskFirst: true,
    expect: (c) => c.textDefault === 0 && c.spaceDefaultNumeric === 0 && c.textArbitrary === 0,
  },
]

function runSelfTest() {
  const table = { spacingPx: new Set([0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64]), typeSizes: new Set([10, 11, 12, 14, 15, 16, 18, 20, 24, 30]) }
  let pass = 0
  let fail = 0
  for (const c of SELF_TEST_CASES) {
    const src = c.maskFirst ? maskComments(c.text) : c.text
    const got = scanText(src, table)
    const ok = c.expect(got)
    if (ok) pass++
    else {
      fail++
      console.error(`✗ ${c.name} — 实得 ${JSON.stringify({ textProject: got.textProject, textDefault: got.textDefault, textArbitrary: got.textArbitrary, textArbitraryHittable: got.textArbitraryHittable, spaceProjectNamed: got.spaceProjectNamed, spaceDefaultNumeric: got.spaceDefaultNumeric, spaceLiteral: got.spaceLiteral, spaceLiteralHittable: got.spaceLiteralHittable, tsRefs: got.tsRefs, cssVarRefs: got.cssVarRefs })}`)
    }
  }
  console.log(`--self-test: ${pass} passed / ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

function main() {
  if (selfTest) runSelfTest()
  const table = loadTierTable()
  const listed = listFiles(MINIAPP_DIRS)
  if (!listed.files) {
    console.error(`❌ 未判定:${listed.reason}`)
    process.exit(2)
  }
  if (listed.files.length === 0) {
    console.error('❌ 未判定:候选文件枚举到 0 个(枚举到 0 不许记绿,§0.3)')
    process.exit(2)
  }
  const texts = fetchTexts(listed.files)
  const unreadable = listed.files.filter((f) => texts.get(f) === null)
  if (unreadable.length) {
    console.error(`❌ 未判定:${unreadable.length} 个文件正文取不到(${FACE} 面),例:${unreadable.slice(0, 3).join(', ')}`)
    process.exit(2)
  }
  const counts = listed.files.map((f) => scanText(maskComments(texts.get(f)), table))
  const r = reduceCounts(counts)

  if (jsonMode) {
    console.log(JSON.stringify({ face: FACE, files: listed.files.length, ...r }, null, 0))
    return
  }
  if (!quietMode) {
    console.log(`小程序非色档三桶对账(取材面:${FACE},文件 ${listed.files.length} 个)`)
    console.log(`  字号  项目档 ${r.textProject} · Tailwind默认 ${r.textDefault} · 任意值 ${r.textArbitrary}(其中 ${r.textArbitraryHittable} 处值命中档表)`)
    console.log(`  间距  具名档 ${r.spaceProjectNamed} · 默认数字档 ${r.spaceDefaultNumeric} · rpx字面量 ${r.spaceLiteral}(其中 ${r.spaceLiteralHittable} 处值命中档表)`)
    console.log(`  圆角  具名档 ${r.radiusProject} · 字面量 ${r.radiusLiteral}`)
    console.log(`  阴影  项目档 ${r.shadowProject}`)
    console.log(`  引用  TS 档 ${r.tsRefs} · CSS 变量 ${r.cssVarRefs}`)
    if (r.samples.textHittable.length) console.log(`  字号可落档样例:${r.samples.textHittable.join(' | ')}`)
    if (r.samples.spaceHittable.length) console.log(`  间距可落档样例:${r.samples.spaceHittable.join(' | ')}`)
  }
  console.log(
    `结论:MINIAPP-TIER-STATE files=${listed.files.length} project=${r.project}/${r.all}=${r.projectPct}% default=${r.defaulted}/${r.all}=${r.defaultPct}% literal=${r.literal}/${r.all}=${r.literalPct}% hittable=${r.textArbitraryHittable + r.spaceLiteralHittable}`,
  )
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ 未判定:${e?.message ?? e}`)
    process.exit(2)
  }
}

export const __test__ = { scanText, reduceCounts, SELF_TEST_CASES, loadTierTable }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
