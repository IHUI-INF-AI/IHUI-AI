#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-token-literal-debt.mjs — RN 样式裸数字回潮锁(差值棘轮,门 247;原拟 240,远端已占 240=大屏读数百度门,合并前改号)
 *
 * 为什么要有这道门:tokens-migrate 把 261 个已入库屏的 3720 处裸数字转成了 rnSpacing/rnType 档,
 * 但仓里没有任何判据管"新增" —— 不加门,下一次随手写 `padding: 16` 就把它加回来了,
 * 两端样式对齐会重新漂移,而已做的转写没有任何机制保护(§0.9 造好没装车 = 没有)。
 *
 * 判据(复用 tokens-migrate 的 migrateText,单一真相源,本文件零复算):
 *   - "违规" = 该文件里**可自动对档**的裸数字命中数(恰在档才计;10/13/18 这类杂值不计 —— 它们没法自动修,
 *     按 §12e 不做成只有作者能猜的恒红门)。
 *   - 差值棘轮:只拦"本次暂存把违规数变大"。锚点 = **该文件 HEAD blob 自身**的违规数(§0.5)。
 *     存量(HEAD 已有的)只在全量档报数,不判红。
 *   - 新增文件:HEAD 不存在 ⇒ 锚点 0,索引有命中即红(新屏从第一行起就该用档位)。
 *
 * 取材面纪律(§0.4):--staged 判**索引 blob** vs HEAD blob 同面同轮;默认(全量)只报数;
 * --worktree 仅人工逃生舱;两面旗同给 exit 2。取不到任一面 ⇒ exit 2「未判定」,不记绿也不冒红。
 *
 * Usage:
 *   node scripts/check-token-literal-debt.mjs            # 全量报数(不判红)
 *   node scripts/check-token-literal-debt.mjs --staged   # 提交链档:只拦本次新增
 *   node scripts/check-token-literal-debt.mjs --strict   # 全量问责存量(人工盘点用,不进提交链)
 *   node scripts/check-token-literal-debt.mjs --self-test
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitRaw } from './lib/face-reader.mjs'
import { migrateText } from './tokens-migrate.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCOPE_DIRS = ['packages/app/src/', 'apps/mobile-rn/src/']
const isScopedTsx = (rel) => rel.endsWith('.tsx') && SCOPE_DIRS.some((d) => rel.startsWith(d))

/**
 * ===== S1/S2(2026-11-06 并入门 270,不另开重复门)=====
 * S1 行高跟随字号:样式对象里 `lineHeight` 若写成数字,必须等于配对 `fontSize` 的 rnType 行高;
 *   或显式引用 `rnType.*`。配对读不到(找不到 fontSize)也计违规 —— 裸行高没有档位锚点,
 *   两端对齐时它不会跟随源头。档表读不到 ⇒ exit 2 未判定(不折成"零违规")。
 * S2 几何裸值棘轮:width/height/min-max 宽高、inset、top/right/bottom/left、size、flexBasis 的纯数字
 *   按**文件**计数,只降不升;上调必须在 approvedRaises 里附"不能由父容器推导"的理由(带到期日)。
 * 静态例外(borderWidth:1 发丝线、letterSpacing)只报数、不进棘轮账本(设计稿点名的显式例外)。
 * 账本 = scripts/data/style-literal-baseline.json(存量固化;与漂移门同一「回归制」纪律)。
 */
const TIER_TABLE_REL = 'packages/design-tokens/src/typography.ts'
const STYLE_BASELINE_PATH = join(ROOT, 'scripts', 'data', 'style-literal-baseline.json')
const GEOMETRY_KEYS = [
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'top', 'right', 'bottom', 'left', 'inset', 'insetX', 'insetY', 'size', 'flexBasis',
]
const GEOMETRY_RE = new RegExp(`\\b(${GEOMETRY_KEYS.join('|')}):\\s*(-?\\d+(?:\\.\\d+)?)\\s*(?:,|\\})`, 'g')

/** 解析 rnType 档表的「字号 → 行高」映射;解析不到任何一个档 ⇒ null(调用方判未判定) */
export function parseTypeLineHeights(text) {
  const map = new Map()
  if (!text) return null
  for (const m of text.matchAll(/(\w+):\s*\{\s*size:\s*(\d+),\s*lineHeight:\s*(\d+)/g)) {
    map.set(Number(m[2]), Number(m[3]))
  }
  return map.size > 0 ? map : null
}

/** S1:一个文件里的行高违规行(paired 不符 / 无配对锚点);显式 rnType.* 不算 */
export function lineHeightViolations(text, sizeMap) {
  const rows = []
  if (!text || !(sizeMap instanceof Map)) return rows
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    if (/\blineHeight:\s*rnType\./.test(line)) return
    const m = /\blineHeight:\s*(-?\d+(?:\.\d+)?)/.exec(line)
    if (!m) return
    const value = Number(m[1])
    let size = null
    for (let k = i; k >= Math.max(0, i - 8); k--) {
      const fm = /\bfontSize:\s*(\d+)/.exec(lines[k])
      if (fm) {
        size = Number(fm[1])
        break
      }
      if (k !== i && /\}\s*[),]?\s*$/.test(lines[k])) break
    }
    if (size === null || sizeMap.get(size) !== value) {
      rows.push({ line: i + 1, value, size, expected: size === null ? null : (sizeMap.get(size) ?? null) })
    }
  })
  return rows
}

/** S2:一个文件里的几何裸值处数(静态例外 borderWidth/letterSpacing 不在本 key 集,天然不计) */
export function geometryRawCount(text) {
  if (!text) return 0
  let n = 0
  for (const _ of text.matchAll(GEOMETRY_RE)) n++
  return n
}

/** 静态例外处数(只报数,不进棘轮) */
export function staticExemptionCounts(text) {
  const t = text || ''
  return {
    borderWidth1: (t.match(/\bborderWidth:\s*1\s*(?:,|\})/g) || []).length,
    letterSpacing: (t.match(/\bletterSpacing:\s*-?\d/g) || []).length,
  }
}

/** 棘轮:现读处数超过基线处数的文件;审批条必须带够长的理由/出处/到期日才免 */
export function exceedRows(byFile, baselineByFile, kind, approved = [], today = new Date().toISOString().slice(0, 10)) {
  const rows = []
  for (const [file, now] of Object.entries(byFile || {})) {
    const base = Number((baselineByFile || {})[file] ?? 0)
    if (!Number.isFinite(base) || now <= base) continue
    const ok = (approved || []).some(
      (a) =>
        a &&
        a.file === file &&
        a.kind === kind &&
        typeof a.reason === 'string' &&
        a.reason.trim().length >= 20 &&
        typeof a.evidence === 'string' &&
        a.evidence.includes(':') &&
        typeof a.expires === 'string' &&
        a.expires >= today,
    )
    if (!ok) rows.push({ file, base, now, delta: now - base, kind })
  }
  return rows
}

/** 文本里可自动对档的裸数字处数;空文本 = 0 */
export function literalDebtOf(text) {
  return text ? migrateText(text).hits : 0
}

/** 差值判定:索引比 HEAD 多出来的处数;>0 即本次回潮 */
export function addedDebt(headHits, stagedHits) {
  return Math.max(0, stagedHits - headHits)
}

function git(args) {
  // 取材统一走层(scripts/lib/face-reader.mjs):-C/encoding/显式 stdio 由 gitRaw 接管
  // (另带 safe.directory + quotepath),不再自拼裸 'git' 派生;maxBuffer 与原调用一致。
  return gitRaw(args, ROOT, { maxBuffer: 1 << 28 })
}

function scopedTracked() {
  return git(['ls-files', '-z'])
    .split('\0')
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, '/'))
    .filter(isScopedTsx)
}

function stagedScoped() {
  return git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
    .split('\0')
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, '/'))
    .filter(isScopedTsx)
}

/** 批量取面内容;取不到抛(catBatch 语义),由调用方翻成「未判定」 */
function readFace(face, rels) {
  if (rels.length === 0) return new Map()
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const got = catBatch(ROOT, rels.map((r) => prefix + r), { maxBuffer: 1 << 27 })
  const out = new Map()
  for (const r of rels) out.set(r, got.has(prefix + r) ? got.get(prefix + r) : null)
  return out
}

function scanFull() {
  const files = scopedTracked()
  let headTexts
  try {
    headTexts = readFace('head', files)
  } catch (e) {
    console.error(`❌ 未判定:取不到 HEAD 面(${e?.message ?? e})`)
    process.exit(2)
  }
  const rows = files
    .map((f) => ({ file: f, hits: literalDebtOf(headTexts.get(f)) }))
    .filter((r) => r.hits > 0)
  return { files: files.length, rels: files, texts: headTexts, rows, total: rows.reduce((s, r) => s + r.hits, 0) }
}

function scanStaged() {
  const files = stagedScoped()
  if (files.length === 0) return { files: [], texts: new Map() }
  let headTexts
  let stagedTexts
  try {
    headTexts = readFace('head', files)
    stagedTexts = readFace('staged', files)
  } catch (e) {
    console.error(`❌ 未判定:取不到被审面(${e?.message ?? e})`)
    process.exit(2)
  }
  const rows = []
  for (const f of files) {
    const headHits = literalDebtOf(headTexts.get(f))
    const stagedHits = literalDebtOf(stagedTexts.get(f))
    const added = addedDebt(headHits, stagedHits)
    if (added > 0) rows.push({ file: f, headHits, stagedHits, added })
  }
  return { files, texts: stagedTexts, rows }
}

/** rnType 档表(HEAD 面为准);解析不到 ⇒ null,调用方按未判定处理(§0.3) */
function readTypeLineHeights() {
  try {
    const got = catBatch(ROOT, [`HEAD:${TIER_TABLE_REL}`], { maxBuffer: 1 << 24 })
    return parseTypeLineHeights(got.get(`HEAD:${TIER_TABLE_REL}`))
  } catch {
    return null
  }
}

function readStyleBaseline() {
  try {
    const baseline = JSON.parse(readFileSync(STYLE_BASELINE_PATH, 'utf8'))
    if (!baseline?.lineHeight?.byFile || !baseline?.geometry?.byFile) {
      return { ok: false, baseline: null, why: '基线缺 lineHeight.byFile / geometry.byFile' }
    }
    return { ok: true, baseline }
  } catch (e) {
    return { ok: false, baseline: null, why: `基线读不出:${String(e?.message ?? e).slice(0, 120)}` }
  }
}

/** S1/S2 逐文件计数(不判红,判红只在 exceedRows) */
function styleScan(files, texts, sizeMap) {
  const lineHeightByFile = {}
  const geometryByFile = {}
  let lineHeightTotal = 0
  let geometryTotal = 0
  let borderWidth1 = 0
  let letterSpacing = 0
  for (const f of files) {
    const text = texts.get(f) ?? ''
    const lh = lineHeightViolations(text, sizeMap).length
    const geo = geometryRawCount(text)
    const ex = staticExemptionCounts(text)
    if (lh > 0) lineHeightByFile[f] = lh
    if (geo > 0) geometryByFile[f] = geo
    lineHeightTotal += lh
    geometryTotal += geo
    borderWidth1 += ex.borderWidth1
    letterSpacing += ex.letterSpacing
  }
  return { lineHeightByFile, geometryByFile, lineHeightTotal, geometryTotal, borderWidth1, letterSpacing }
}

function emitBaseline() {
  const sizeMap = readTypeLineHeights()
  if (!sizeMap) {
    console.error(`❌ 未判定:取不到档表 ${TIER_TABLE_REL},不放行基线重固化`)
    process.exit(2)
  }
  let texts
  try {
    texts = readFace('head', scopedTracked())
  } catch (e) {
    console.error(`❌ 未判定:取不到 HEAD 面(${e?.message ?? e})`)
    process.exit(2)
  }
  const scan = styleScan(scopedTracked(), texts, sizeMap)
  const prev = readStyleBaseline()
  const out = {
    version: 1,
    owner: 'cross-end-style',
    expires: '2027-06-30',
    generatedAt: new Date().toISOString().slice(0, 10),
    face: 'HEAD',
    why: 'S1 行高跟随字号 / S2 几何裸值棘轮的存量固化:只降不升,新增或上调必须在 approvedRaises 附「不能由父容器推导」理由+出处+到期日',
    evidence: [
      `${TIER_TABLE_REL}:(rnType 档表真源)`,
      'packages/design-tokens/src/typography.ts:39-50(size/lineHeight 配对取值)',
      'scripts/check-token-literal-debt.mjs:41-133(S1/S2 判据实现)',
    ],
    tierTable: { path: TIER_TABLE_REL, steps: sizeMap.size },
    lineHeight: { total: scan.lineHeightTotal, byFile: scan.lineHeightByFile },
    geometry: { total: scan.geometryTotal, byFile: scan.geometryByFile },
    exemptions: {
      borderWidth1: scan.borderWidth1,
      letterSpacing: scan.letterSpacing,
      note: 'borderWidth:1(发丝线)与 letterSpacing 为设计稿点名的静态例外,只报数、不进棘轮账本',
    },
    approvedRaises: prev.ok ? (prev.baseline.approvedRaises ?? []) : [],
  }
  writeFileSync(STYLE_BASELINE_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8')
  console.log(
    `已固化 S1/S2 基线:行高违规 ${scan.lineHeightTotal} 处;几何裸值 ${scan.geometryTotal} 处;静态例外 borderWidth:1 ${scan.borderWidth1} / letterSpacing ${scan.letterSpacing}(未计入棘轮)`,
  )
  process.exit(0)
}

function selfTest() {
  const cases = [
    ['padding: 16', 1],
    ['padding: rnSpacing.lg', 0],
    ['padding: 10', 0],
    ['fontSize: 14', 1],
    ['fontSize: rnType.body.size', 0],
    ['marginTop: -16', 0],
    ['gap: 8, rowGap: 12', 2],
  ]
  let failed = 0
  for (const [src, want] of cases) {
    const got = literalDebtOf(src)
    if (got !== want) {
      failed++
      console.error(`✗ 判据对照失败: ${JSON.stringify(src)} 期望 ${want} 实得 ${got}`)
    }
  }
  const diffCases = [
    [3, 3, 0],
    [3, 5, 2],
    [0, 1, 1],
    [5, 3, 0],
  ]
  for (const [h, s, want] of diffCases) {
    if (addedDebt(h, s) !== want) {
      failed++
      console.error(`✗ 差值对照失败: HEAD ${h} / 索引 ${s} 期望 ${want}`)
    }
  }
  // 阳性对照:同一段文本换回裸数字必须被差值判据抓到
  const head = 'const s = { padding: rnSpacing.lg }'
  const staged = 'const s = { padding: 16 }'
  if (addedDebt(literalDebtOf(head), literalDebtOf(staged)) === 0) {
    failed++
    console.error('✗ 阳性对照失败:把档改回裸数字,差值判据没抓到')
  }
  // S1/S2 自检(2026-11-06):每条都配阳性(该红)与阴性(不该红)对照,避免"补了就算过"。
  const sizeMap = parseTypeLineHeights('body: { size: 14, lineHeight: 20, weight: 400 }, caption: { size: 11, lineHeight: 16, weight: 400 }')
  if (!sizeMap || sizeMap.get(14) !== 20) {
    failed++
    console.error('✗ S1 档表解析失败(预期 14→20)')
  }
  const lhCases = [
    ['const s = { fontSize: 14, lineHeight: 20 }', 0, '配对一致'],
    ['const s = { fontSize: 14, lineHeight: 18 }', 1, '配对不符'],
    ['const s = { fontSize: 14, lineHeight: rnType.body.lineHeight }', 0, '显式 rnType'],
    ['const s = { lineHeight: 24 }', 1, '裸行高无锚点'],
  ]
  for (const [src, want, label] of lhCases) {
    const got = lineHeightViolations(src, sizeMap).length
    if (got !== want) {
      failed++
      console.error(`✗ S1 ${label}:期望 ${want} 实得 ${got}`)
    }
  }
  const genusCases = [
    ['const s = { width: 120, height: 48, left: 0 }', 3],
    ['const s = { width: rnGeometry.card }', 0],
    ['const s = { borderWidth: 1, letterSpacing: 2 }', 0],
  ]
  for (const [src, want] of genusCases) {
    const got = geometryRawCount(src)
    if (got !== want) {
      failed++
      console.error(`✗ S2 几何计数:${JSON.stringify(src)} 期望 ${want} 实得 ${got}`)
    }
  }
  const ratchetCases = [
    [{ a: 5 }, { a: 5 }, 0],
    [{ a: 6 }, { a: 5 }, 1],
    [{ a: 4 }, { a: 5 }, 0],
    [{ b: 1 }, { a: 5 }, 1],
  ]
  for (const [now, base, want] of ratchetCases) {
    const got = exceedRows(now, base, 'geometry').length
    if (got !== want) {
      failed++
      console.error(`✗ S2 棘轮:期望 ${want} 实得 ${got}`)
    }
  }
  const approved = [{ file: 'a.tsx', kind: 'geometry', reason: '此处宽高由原生视频画布尺寸决定,不能由父容器推导', evidence: 'a.tsx:10', expires: '2099-01-01' }]
  if (exceedRows({ 'a.tsx': 6 }, { 'a.tsx': 5 }, 'geometry', approved).length !== 0) {
    failed++
    console.error('✗ S2 审批条未生效(带理由/出处/到期日应免)')
  }
  if (exceedRows({ 'a.tsx': 6 }, { 'a.tsx': 5 }, 'geometry', [{ ...approved[0], expires: '2000-01-01' }]).length !== 1) {
    failed++
    console.error('✗ S2 过期审批条仍被当成免(应判红)')
  }
  console.log(failed === 0 ? `自检 ${cases.length + diffCases.length + 1 + lhCases.length + genusCases.length + ratchetCases.length + 2} 例,失败 0` : `自检失败 ${failed} 例`)
  process.exit(failed === 0 ? 0 : 1)
}

function run() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  if (argv.includes('--emit-baseline')) return emitBaseline()
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  const strict = argv.includes('--strict')
  if (staged && worktree) {
    console.error('❌ 未判定:--staged 与 --worktree 同给,取材面不明(§0.4 不允许回落另一个面)')
    process.exit(2)
  }
  const sizeMap = readTypeLineHeights()
  if (!sizeMap) {
    console.error(`❌ 未判定:取不到 rnType 档表 ${TIER_TABLE_REL}(S1 无法配对行高,不折成 0 违规)`)
    process.exit(2)
  }
  const styleBase = readStyleBaseline()
  if (!styleBase.ok) {
    console.error(`❌ 未判定:${styleBase.why}(修复:node scripts/check-token-literal-debt.mjs --emit-baseline)`)
    process.exit(2)
  }
  const approved = styleBase.baseline.approvedRaises ?? []
  if (staged) {
    const { files, texts, rows } = scanStaged()
    if (files.length === 0) {
      console.log('✅ token/S1/S2 检查:本次暂存 0 个射程文件')
      return process.exit(0)
    }
    const scan = styleScan(files, texts, sizeMap)
    const lhRows = exceedRows(scan.lineHeightByFile, styleBase.baseline.lineHeight.byFile, 'lineHeight', approved)
    const geoRows = exceedRows(scan.geometryByFile, styleBase.baseline.geometry.byFile, 'geometry', approved)
    if (rows.length === 0 && lhRows.length === 0 && geoRows.length === 0) {
      console.log(
        `✅ token/S1/S2 检查:本次暂存 ${files.length} 个射程文件,新增可对档裸数字 0 处 / 行高违规新增 0 / 几何裸值新增 0`,
      )
      return process.exit(0)
    }
    if (rows.length > 0) {
      console.error(`❌ 本次把可自动对档的裸数字加回来(${rows.length} 个文件):`)
      for (const r of rows) console.error(`   ${r.file}: HEAD ${r.headHits} → 索引 ${r.stagedHits} (+${r.added})`)
      console.error('   修复:node scripts/tokens-migrate.mjs <file> --apply(恰在档才换,杂值不动)')
    }
    if (lhRows.length > 0) {
      console.error(`❌ S1 行高未跟随字号(${lhRows.length} 个文件超过基线):`)
      for (const r of lhRows) console.error(`   ${r.file}: 基线 ${r.base} → 现读 ${r.now} (+${r.delta});改用配对 rnType 行高或 rnType.* 引用`)
    }
    if (geoRows.length > 0) {
      console.error(`❌ S2 几何裸值棘轮被抬高(${geoRows.length} 个文件):`)
      for (const r of geoRows) console.error(`   ${r.file}: 基线 ${r.base} → 现读 ${r.now} (+${r.delta});可由父容器推导则删除,确有理由请在 scripts/data/style-literal-baseline.json#approvedRaises 登记(需 reason≥20 字+evidence file:line+expires)`)
    }
    return process.exit(1)
  }
  const full = scanFull()
  const scan = styleScan(full.rels ?? [], full.texts ?? new Map(), sizeMap)
  console.log(`token 裸数字报数:射程 ${full.files} 个 .tsx,可对档存量 ${full.rows.length} 文件 / ${full.total} 处`)
  for (const r of full.rows.sort((a, b) => b.hits - a.hits).slice(0, 20)) {
    console.log(`  ${String(r.hits).padStart(5)} ${r.file}`)
  }
  if (full.rows.length > 20) console.log(`  … 其余 ${full.rows.length - 20} 个文件(明细:--strict 或 tokens-migrate 目录档)`)
  console.log(
    `S1 行高跟随字号:存量 ${scan.lineHeightTotal} 处(基线 ${styleBase.baseline.lineHeight.total}) · S2 几何裸值:${scan.geometryTotal} 处(基线 ${styleBase.baseline.geometry.total})`,
  )
  console.log(
    `静态例外(不进棘轮):borderWidth:1 ${scan.borderWidth1} 处 · letterSpacing ${scan.letterSpacing} 处`,
  )
  if (worktree) console.log('说明:--worktree 与全量档同口径(读 HEAD 面),逐文件棘轮只在 --staged 面判红。')
  if (strict && full.rows.length > 0) {
    console.error(`❌ --strict 问责存量:${full.total} 处待转写(修复:node scripts/tokens-migrate.mjs packages/app/src apps/mobile-rn/src --apply)`)
    return process.exit(1)
  }
  console.log('说明:默认档只报数不判红(§12e 存量未清零不得 blocking);提交链只拦本次新增/棘轮抬高。')
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) run()

export const __test__ = { literalDebtOf, addedDebt }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
