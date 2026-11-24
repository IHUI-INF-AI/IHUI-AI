#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-horizontal-gutter.mjs —— 横向边线单一源守门(2026-11-24 立)。
 *
 * 为什么必须有这道门:
 *   发现卡曾同时存在 16(共享 HomeScreen)/ 10(RN 壳)/ 10(输入区)三套横向边线,
 *   而且卡内又写 16(通用 Card 是 12)。这不是某一次手误,是"横向值没有角色、
 *   新页面可以随手再写一个数"的结构性问题。只改一次代码挡不住下一次。
 *
 * 判据两层:
 *   RULE-1 (BLOCK): 首页关键边线必须走 home-layout-spec:
 *     - 共享 HomeScreen 的 section/headerRow 的 paddingHorizontal、errorWrap 的
 *       marginHorizontal = HOME_PAGE_GUTTER_X_PX(10);
 *     - discoverCard/card 的 padding = HOME_CARD_PADDING_PX(12);
 *     - RN 壳 aiModelWrap/sectionWrap 的 paddingHorizontal = HOME_PAGE_GUTTER_X_PX;
 *     - AiModelCard.card 的 padding = HOME_CARD_PADDING_PX;
 *     - BottomFigure 的 SIDE_INSET = HOME_PAGE_GUTTER_X_PX.
 *   RULE-2 (BLOCK): 全仓存量之外的**新增横向数值/rpx 字面量**一律拦下。
 *     含组件内 `const CONTAINER_PADDING_HORIZONTAL = 12` 这类局部常量:
 *     它照样是第二份横向真相,只是换了名字,不能靠"属性上写变量"绕过。
 *     存量在 scripts/data/horizontal-gutter-baseline.json 里按
 *     `file + 属性 + 字面值 + 出现次数` 记账,允许原样保留、只减不增;新文件/新写法必须
 *     先走 `rnSpacing.*` 或明确的 spec token。存量不一次性翻旧账(否则全仓几千处恒红,
 *     门会被人一脚 --no-verify 踢掉),但新增不再有第二条路。
 *
 * 取材: apps/mobile-rn/src、apps/miniapp-taro/src、packages/app/src、packages/ui-native/src
 * 的 ts/tsx 与 css。注释和字符串先经 scripts/lib/code-mask.mjs 遮掉,避免把说明文字当代码。
 * CSS 覆盖 `padding-left/right`、`margin-left/right` 长写;简写 `padding: a b` 仍是缺口,
 * 不在本门自述覆盖内,不得把本门当"所有 CSS 横向间距都已管住"。
 *
 * 用法:
 *   node scripts/check-horizontal-gutter.mjs             # 工作树全量
 *   node scripts/check-horizontal-gutter.mjs --quiet     # 仅失败
 *   node scripts/check-horizontal-gutter.mjs --update-baseline
 *   node scripts/check-horizontal-gutter.mjs --help
 *
 * 退出码:0 = 通过(仅有 WARN);1 = 出现新增横向字面量或首页边线走散值;2 = 无法判定。
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { maskCommentsAndStrings } from './lib/code-mask.mjs'
import { catBatch, listFaceFiles, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCAN_DIRS = ['apps/mobile-rn/src', 'apps/miniapp-taro/src', 'packages/app/src', 'packages/ui-native/src']
const EXTENSIONS = /\.(ts|tsx|css)$/
const BASELINE_PATH = join(ROOT, 'scripts/data/horizontal-gutter-baseline.json')
const HORIZONTAL_RE = /(?:paddingHorizontal|marginHorizontal|paddingLeft|paddingRight|marginLeft|marginRight)\s*:\s*(rpx\(\s*\d+(?:\.\d+)?\s*\)|\d+(?:\.\d+)?)/g
const CSS_HORIZONTAL_RE = /(?:padding|margin)-(?:left|right)\s*:\s*(\d+(?:\.\d+)?(?:rpx|px))/g
const LOCAL_HORIZONTAL_CONST_RE = /\bconst\s+([A-Za-z0-9_]*(?:HORIZONTAL|PADDING_H|MARGIN_H|GUTTER|SIDE_INSET|_LEFT|_RIGHT))\s*=\s*(\d+(?:\.\d+)?)\b/g
const quiet = process.argv.includes('--quiet')
const updateBaseline = process.argv.includes('--update-baseline')
const help = process.argv.includes('--help') || process.argv.includes('-h')
const faceResult = selectFace({
  staged: process.argv.includes('--staged'),
  worktree: process.argv.includes('--worktree'),
  def: 'head',
})
if (faceResult.error) {
  console.error(`❌ 横向边线守门：${faceResult.error}`)
  process.exit(2)
}
const FACE = faceResult.face

if (help) {
  console.log('node scripts/check-horizontal-gutter.mjs [--quiet] [--update-baseline]')
  process.exit(0)
}

const specFor = (rel) => (FACE === 'head' ? `HEAD:${rel}` : FACE === 'staged' ? `:${rel}` : null)

function readMany(rels) {
  if (FACE === 'worktree') {
    return new Map(rels.map((rel) => [rel, readWorktreeFile(ROOT, rel)]))
  }
  const specs = rels.map(specFor)
  const bySpec = catBatch(ROOT, specs)
  return new Map(rels.map((rel, i) => [rel, bySpec.get(specs[i]) ?? null]))
}

function readOne(rel) {
  return readMany([rel]).get(rel) ?? null
}

function normalizeValue(raw) {
  return raw.replace(/\s+/g, '').replace(/rpx\((\d+(?:\.\d+)?)\)/, 'rpx($1)')
}

function collect() {
  const entries = []
  const rels = listFaceFiles(ROOT, FACE, { paths: SCAN_DIRS }).filter((rel) => EXTENSIONS.test(rel))
  const sourceById = readMany(rels)
  let scannedFiles = 0
  for (const rel of rels) {
    const raw = sourceById.get(rel)
    if (raw === null || raw === undefined) continue
    scannedFiles++
    const source = maskCommentsAndStrings(raw)
    if (rel.endsWith('.css')) {
      for (const match of source.matchAll(CSS_HORIZONTAL_RE)) {
        entries.push({ file: rel, prop: match[0].slice(0, match[0].indexOf(':')).trim(), value: normalizeValue(match[1]) })
      }
      continue
    }
    for (const match of source.matchAll(HORIZONTAL_RE)) {
      entries.push({ file: rel, prop: match[0].slice(0, match[0].indexOf(':')).trim(), value: normalizeValue(match[1]) })
    }
    for (const match of source.matchAll(LOCAL_HORIZONTAL_CONST_RE)) {
      entries.push({ file: rel, prop: `const ${match[1]}`, value: normalizeValue(match[2]) })
    }
  }
  return { entries, scannedFiles }
}

function grouped(entries) {
  const map = new Map()
  for (const e of entries) {
    const key = `${e.file}|${e.prop}|${e.value}`
    map.set(key, (map.get(key) || 0) + 1)
  }
  return map
}

function readBaseline() {
  const rel = 'scripts/data/horizontal-gutter-baseline.json'
  const raw = readOne(rel)
  if (raw === null) return new Map()
  try {
    const json = JSON.parse(raw)
    return new Map((json.entries || []).map((e) => [`${e.file}|${e.prop}|${e.value}`, e.count]))
  } catch (err) {
    console.error(`❌ 横向边线基线不可读：${BASELINE_PATH} — ${err.message} ⇒ 未判定`)
    process.exit(2)
  }
}

function styleBlock(source, name) {
  const match = source.match(new RegExp(`\\b${name}:\\s*\\{([^}]*)\\}`))
  if (!match) throw new Error(`style block not found: ${name}`)
  return match[1]
}

function assertHomeSpec() {
  const problems = []
  const shared = readOne('packages/app/src/features/home/HomeScreen.tsx')
  for (const [block, prop] of [
    ['section', 'paddingHorizontal'],
    ['headerRow', 'paddingHorizontal'],
    ['errorWrap', 'marginHorizontal'],
  ]) {
    const body = styleBlock(shared, block)
    if (!body.includes('HOME_PAGE_GUTTER_X_PX')) problems.push(`shared HomeScreen ${block}.${prop} 未走 HOME_PAGE_GUTTER_X_PX`)
    if (new RegExp(`${prop}:\\s*(?:\\d|rpx\\(|rnSpacing)`).test(body)) problems.push(`shared HomeScreen ${block}.${prop} 仍有横向散值`)
  }
  for (const block of ['discoverCard', 'card']) {
    const body = styleBlock(shared, block)
    if (!body.includes('HOME_CARD_PADDING_PX')) problems.push(`shared HomeScreen ${block}.padding 未走 HOME_CARD_PADDING_PX`)
  }
  const shell = readOne('apps/mobile-rn/src/screens/HomeScreen.tsx')
  for (const block of ['aiModelWrap', 'sectionWrap']) {
    const body = styleBlock(shell, block)
    if (!body.includes('HOME_PAGE_GUTTER_X_PX')) problems.push(`RN HomeScreen ${block}.paddingHorizontal 未走 HOME_PAGE_GUTTER_X_PX`)
  }
  const aiCard = readOne('apps/mobile-rn/src/components/AiModelCard.tsx')
  if (!styleBlock(aiCard, 'card').includes('HOME_CARD_PADDING_PX')) problems.push('AiModelCard.card.padding 未走 HOME_CARD_PADDING_PX')
  const bottomFigure = readOne('apps/mobile-rn/src/components/BottomFigure.tsx')
  if (!bottomFigure.includes('const SIDE_INSET = HOME_PAGE_GUTTER_X_PX')) problems.push('BottomFigure.SIDE_INSET 未走 HOME_PAGE_GUTTER_X_PX')

  const popular = readOne('apps/mobile-rn/src/components/PopularCourses.tsx')
  if (!popular.includes('const CONTAINER_PADDING = rnSpacing.none')) problems.push('PopularCourses.CONTAINER_PADDING 应交给 HomeScreen sectionWrap,不得再叠一层页面留白')
  if (!popular.includes('const PAGE_GUTTER = HOME_PAGE_GUTTER_X_PX')) problems.push('PopularCourses.PAGE_GUTTER 未走 HOME_PAGE_GUTTER_X_PX')
  if (!popular.includes('const cardWidth = (screenWidth - PAGE_GUTTER * 2 - GRID_GAP) / 2')) problems.push('PopularCourses.cardWidth 未按 PAGE_GUTTER 计算')

  const knowledge = readOne('apps/mobile-rn/src/components/KnowledgePlanet.tsx')
  if (!knowledge.includes('const LIST_PADDING = rnSpacing.none')) problems.push('KnowledgePlanet.LIST_PADDING 应交给 HomeScreen sectionWrap,不得再叠一层页面留白')
  if (!knowledge.includes('const CARD_PADDING = HOME_CARD_PADDING_PX')) problems.push('KnowledgePlanet.CARD_PADDING 未走 HOME_CARD_PADDING_PX')

  const functionBlock = readOne('apps/mobile-rn/src/components/FunctionBlockColumn.tsx')
  if (!functionBlock.includes('const CARD_PADDING = HOME_CARD_PADDING_PX')) problems.push('FunctionBlockColumn.CARD_PADDING 未走 HOME_CARD_PADDING_PX')

  return problems
}

const { entries, scannedFiles } = collect()
if (scannedFiles === 0) {
  console.error('❌ 横向边线守门：扫描面为空 ⇒ 未判定')
  process.exit(2)
}

const actual = grouped(entries)
if (updateBaseline) {
  const json = {
    version: 1,
    note: '存量横向数值/rpx 字面量台账；只减不增。新增必须走 rnSpacing.* 或 home-layout-spec token。',
    entries: [...actual.entries()].map(([key, count]) => {
      const [file, prop, value] = key.split('|')
      return { file, prop, value, count }
    }).sort((a, b) => `${a.file}|${a.prop}|${a.value}`.localeCompare(`${b.file}|${b.prop}|${b.value}`)),
  }
  writeFileSync(BASELINE_PATH, `${JSON.stringify(json, null, 2)}\n`, 'utf8')
  console.log(`✅ 已写入横向边线基线：${json.entries.length} 条，共 ${entries.length} 处`)
  process.exit(0)
}

const failures = []
const warnings = []
const baseline = readBaseline()
for (const [key, count] of actual) {
  const allowed = baseline.get(key) || 0
  if (count > allowed) failures.push(`${key}（基线 ${allowed}，现读 ${count}）`)
}
for (const [key, count] of baseline) {
  if (!actual.has(key) || actual.get(key) < count) warnings.push(`${key}（基线 ${count}，现读 ${actual.get(key) || 0}）`)
}

const homeProblems = assertHomeSpec()
if (failures.length > 0 || homeProblems.length > 0) {
  console.error('❌ 横向边线守门未通过')
  for (const f of failures) console.error(`  [新增散值] ${f}`)
  for (const p of homeProblems) console.error(`  [首页散值] ${p}`)
  process.exit(1)
}

if (!quiet) {
  console.log(`✅ 横向边线守门通过：${actual.size} 种存量签名，${entries.length} 处；首页关键边线全部走 token`)
  if (warnings.length > 0) console.log(`⚠️  存量已减少但基线未收紧：${warnings.length} 条（可择机 --update-baseline）`)
}
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
