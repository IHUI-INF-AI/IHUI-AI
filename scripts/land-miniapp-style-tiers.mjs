#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出落档报告 */
/**
 * land-miniapp-style-tiers.mjs — 把小程序 CSS 里「等值命中档表」的间距 / 字号裸 rpx 字面量
 * 改写为 `var(--spacing-*)` / `var(--text-*)` 引用(**等值改写 ⇒ 像素零变化**)。
 *
 * 立因(2026-10-31):上一枚 f5db1221ae 把项目具名档注册进小程序 `@theme`,产物里已有
 * `--spacing-md: 24rpx` / `--text-body: 28rpx` 等 49 档。但端内 CSS 仍写裸字面量:
 * `check-miniapp-style-tiers.mjs` 现读 —— 项目档消费率 14.8%,rpx 字面量 58.6%;
 * 其中 1366 处(间距)/ 767 处(字号)的**值恰好等于某档**。值对而不跟随,正是 RN 落档前的同一型。
 *
 * 三条硬边界(与 `land-rn-style-tiers.mjs` 同构):
 *   ① **只改等值命中档表的数**。档外的数(22/26/13rpx 等)一律不动 —— 那是"该落哪一档"的判断,
 *      归尺子的 fork 桶点名给人,不归器物猜。
 *   ② **只改 `.css` 文件的声明体**,不碰 className、不碰内联 style 对象(那是 taroSpacing 的场,
 *      另立票)、不碰 `calc()`/`var()` 表达式,只吃纯 `<数>rpx`。
 *   ③ **不碰 `apps/miniapp-taro/src/app.css`**:它是 `sync-miniapp-tokens.mjs` 的派生态,
 *      手改会被下一次 sync 洗掉,而且在受管块外改写会与守门 36 的取材面打架。
 *   ④ **不碰 line-height**:多个档可能共享同一行高,反查档名不是单值 ⇒ 有歧义。只改 font-size。
 *
 * 归属避让(多会话共享工作区):`git status --porcelain` 对该文件非空 ⇒ 跳过并点名(held)。
 *
 * 水印(§5c 强制):逐文件 `watermark clean` → 改写 → `watermark inject`,inject 后 verify 复核。
 * 幂等:已是 `var(--spacing-*)` / `var(--text-*)` 的位置不会再命中 ⇒ 重跑改 0 处。
 *
 * 用法:
 *   node scripts/land-miniapp-style-tiers.mjs                 # 只读预演(默认)
 *   node scripts/land-miniapp-style-tiers.mjs --apply         # 落盘
 *   node scripts/land-miniapp-style-tiers.mjs --file <path>   # 单文件试点(可重复)
 *   node scripts/land-miniapp-style-tiers.mjs --json
 *   node scripts/land-miniapp-style-tiers.mjs --self-test
 *
 * 退出码:0 正常(含"改 0 处");2 用法错 / 取不到档表 / 注入校验失败。
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { gitRaw, readWorktreeFile } from './lib/face-reader.mjs'
import { parseTokenTables } from './sync-css-tokens.mjs'
import { maskComments } from './lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WATERMARK = join(ROOT, 'scripts', 'watermark.mjs')
const SRC_DIR = 'apps/miniapp-taro/src'
const DERIVED_EXCLUDE = new Set(['apps/miniapp-taro/src/app.css'])

const argv = process.argv.slice(2)
const apply = argv.includes('--apply')
const jsonMode = argv.includes('--json')
const selfTest = argv.includes('--self-test')
const fileArgs = argv.reduce((acc, a, i) => (a === '--file' && argv[i + 1] ? [...acc, argv[i + 1].replace(/\\/g, '/')] : acc), [])

const SPACING_PROPS = ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'gap', 'row-gap', 'column-gap']
const FONT_PROPS = ['font-size']

/** 反向档名查表:值(px) → 档名。同值多档取**首个声明**(档表里先出现的语义更通用)。 */
export function buildReverse(spacingPx, typeSizes) {
  const spacing = new Map()
  for (const [k, v] of Object.entries(spacingPx)) if (!spacing.has(Number(v))) spacing.set(Number(v), k)
  const type = new Map()
  for (const [k, v] of Object.entries(typeSizes)) if (!type.has(Number(v))) type.set(Number(v), k)
  return { spacing, type }
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * 纯函数:改写一段 CSS 正文。返回 { out, changes, samples }。
 * 测试直接 import 它(§22c),不复制正则。
 *
 * **只认代码面**:用 `maskComments`(等长空格遮罩)交叉判定 —— 落在注释/字符串里的同形文本
 * 一律不动。立因是实测踩出来的:首版不看遮罩,把注释 `原项目用 … padding:4rpx 20rpx` 里的
 * 数字也换成了 `var(--spacing-2xs)`,注释本身是"这一处以原项目某值为准"的说明,改它等于毁证据。
 */
export function rewriteCss(css, rev) {
  const masked = maskComments(css)
  let changes = 0
  const samples = []
  const propRe = new RegExp(`(^|[;{\\s])(${SPACING_PROPS.map(esc).join('|')}|${FONT_PROPS.map(esc).join('|')})\\s*:\\s*(\\d+(?:\\.\\d+)?)rpx(?![\\w%.])`, 'g')
  const out = css.replace(propRe, (all, lead, prop, num, offset) => {
    // 代码面判定:遮罩在该区间的字节必须与原文逐字相同(注释/字符串已被抹成空格)
    if (masked.slice(offset, offset + all.length) !== all) return all
    const px = Number(num) / 2
    let replaced = null
    if (FONT_PROPS.includes(prop)) {
      const step = rev.type.get(px)
      if (step) replaced = `var(--text-${step})`
    } else {
      const step = rev.spacing.get(px)
      if (step) replaced = `var(--spacing-${step})`
    }
    if (!replaced) return all
    changes++
    if (samples.length < 6) samples.push(`${prop}: ${num}rpx → ${replaced}`)
    return `${lead}${prop}: ${replaced}`
  })
  return { out, changes, samples }
}

function listCssFiles() {
  if (fileArgs.length) return fileArgs
  const text = String(gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', SRC_DIR], ROOT))
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter((p) => p.endsWith('.css') && !DERIVED_EXCLUDE.has(p) && !/\.test\./.test(p))
}

/** 工作树脏 ⇒ 归属未知 ⇒ 跳过(与 land-rn-style-tiers 同一条避让)。 */
function dirtySet(paths) {
  const out = new Set()
  try {
    const text = String(gitRaw(['status', '--porcelain', '--', ...paths], ROOT))
    for (const l of text.split('\n')) {
      const p = l.slice(3).trim().replace(/^"|"$/g, '')
      if (p) out.add(p)
    }
  } catch {
    return null
  }
  return out
}

function watermark(mode, file) {
  execFileSync(process.execPath, [WATERMARK, mode, file], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

const SELF_TEST_CASES = [
  { name: '间距等值命中 ⇒ 换 var', css: '.a{padding:24rpx}', want: '.a{padding: var(--spacing-md)}', n: 1 },
  { name: '字号等值命中 ⇒ 换 var', css: '.b{font-size:28rpx}', want: '.b{font-size: var(--text-body)}', n: 1 },
  { name: '档外值不动', css: '.c{padding:26rpx}', want: '.c{padding:26rpx}', n: 0 },
  { name: 'line-height 不动(有歧义)', css: '.d{line-height:40rpx}', want: '.d{line-height:40rpx}', n: 0 },
  { name: 'calc/var 表达式不动', css: '.e{padding:calc(24rpx + 1px)}', want: '.e{padding:calc(24rpx + 1px)}', n: 0 },
  // 量纲:rpx ÷ 2 = 逻辑 px。16rpx=8px(=sm)、8rpx=4px(=xs)—— 期望值按档表现算,不是按"看起来像"。
  { name: '短横线属性也认', css: '.f{padding-left:16rpx;margin-top:8rpx}', want: '.f{padding-left: var(--spacing-sm);margin-top: var(--spacing-xs)}', n: 2 },
  { name: '百分号/其它单位不动', css: '.g{padding:24rpx 24%;}', want: '.g{padding: var(--spacing-md) 24%;}', n: 1 },
  // 实测踩过:注释里的同形文本被改写,等于把"这一处以原项目某值为准"的证据毁掉。
  { name: '注释里的同形文本不动', css: '/* 原项目 padding:4rpx 20rpx */\n.h{padding:8rpx}', want: '/* 原项目 padding:4rpx 20rpx */\n.h{padding: var(--spacing-xs)}', n: 1 },
]

function runSelfTest() {
  const spacingPx = { none: 0, '2xs': 2, xs: 4, 'xs-loose': 6, sm: 8, 'sm-loose': 10, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 48, '6xl': 64 }
  const typeSizes = { badge: 10, caption: 11, label: 12, body: 14, strong: 15, title: 16, subtitle: 18, heading: 20, display: 24, 'display-lg': 30 }
  const rev = buildReverse(spacingPx, typeSizes)
  let pass = 0
  let fail = 0
  for (const c of SELF_TEST_CASES) {
    const r = rewriteCss(c.css, rev)
    const ok = r.out === c.want && r.changes === c.n
    if (ok) pass++
    else {
      fail++
      console.error(`✗ ${c.name}\n  得到:${r.out}\n  期望:${c.want} (changes=${r.changes}, want=${c.n})`)
    }
  }
  console.log(`--self-test: ${pass} passed / ${fail} failed`)
  process.exit(fail === 0 ? 0 : 1)
}

function main() {
  if (selfTest) runSelfTest()
  const refs = ['packages/design-tokens/src/spacing.ts', 'packages/design-tokens/src/typography.ts', 'packages/design-tokens/src/elevation.ts']
  const texts = new Map()
  for (const r of refs) {
    try {
      texts.set(r, String(gitRaw(['show', `HEAD:${r}`], ROOT)))
    } catch {
      console.error(`❌ 未判定:档表源取不到 ${r}`)
      process.exit(2)
    }
  }
  const tables = parseTokenTables({
    spacing: texts.get(refs[0]),
    typography: texts.get(refs[1]),
    elevation: texts.get(refs[2]),
  })
  const rev = buildReverse(tables.SPACING_STEPS, tables.TYPE_STEPS)

  const files = listCssFiles()
  if (!files.length) {
    console.error('❌ 未判定:CSS 候选枚举到 0 个')
    process.exit(2)
  }
  const dirty = dirtySet(files)
  if (dirty === null) {
    console.error('❌ 未判定:git status 取不到,归属未知不猜')
    process.exit(2)
  }

  const held = []
  const results = []
  let totalChanges = 0
  const allSamples = []
  for (const f of files) {
    let src
    try {
      src = readWorktreeFile(ROOT, f)
    } catch {
      held.push(`${f}(工作树读不到)`)
      continue
    }
    const r = rewriteCss(src, rev)
    if (r.changes === 0) continue
    if (dirty.has(f)) {
      held.push(f)
      continue
    }
    results.push({ file: f, changes: r.changes })
    totalChanges += r.changes
    for (const s of r.samples) if (allSamples.length < 10) allSamples.push(`${f}: ${s}`)
    if (apply) {
      if (fileArgs.length) {
        writeFileSync(join(ROOT, f), r.out)
      } else {
        watermark('clean', f)
        const cleaned = readWorktreeFile(ROOT, f)
        const rr = rewriteCss(cleaned, rev)
        if (rr.changes === 0) {
          watermark('inject', f)
          continue
        }
        writeFileSync(join(ROOT, f), rr.out)
        watermark('inject', f)
        watermark('verify', f)
      }
    }
  }

  const summary = {
    scanned: files.length,
    changedFiles: results.length,
    changes: totalChanges,
    held: held.length,
    applied: apply,
  }
  if (jsonMode) {
    console.log(JSON.stringify({ ...summary, files: results, samples: allSamples }, null, 0))
    return
  }
  for (const r of results.slice(0, 12)) console.log(`  ${r.file}  ${r.changes} 处`)
  if (results.length > 12) console.log(`  …另 ${results.length - 12} 个文件`)
  for (const s of allSamples) console.log(`  样例 ${s}`)
  if (held.length) console.log(`  🔒 held(工作树脏,归属未知不猜)${held.length} 个:${held.slice(0, 6).join(', ')}${held.length > 6 ? ' …' : ''}`)
  console.log(
    `结论:LAND-MINIAPP-TIERS state=${apply ? 'applied' : 'dry-run'} files=${results.length} changes=${totalChanges} held=${held.length}`,
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

export const __test__ = { rewriteCss, buildReverse, SELF_TEST_CASES }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
