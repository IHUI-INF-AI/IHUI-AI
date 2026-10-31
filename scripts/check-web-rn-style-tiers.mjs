#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出对账报告 */
/**
 * check-web-rn-style-tiers.mjs — web↔RN 非色档(间距/字号/圆角)档位对账尺
 *
 * 立因(2026-10-31 实测):AGENTS §9 的对齐链是 web → RN → 小程序。目标口径写的是「RN 自动同步
 * web 的样式**全面**对齐」,但这一腿当时的机检面只有**颜色**:
 *   · 门 257 `check-web-rn-parity.mjs` 头注逐字自述样式维只调 `check-cross-end-tokens.mjs` 判颜色令牌;
 *   · 门 128 `check-cross-end-ui-parity.mjs` 的 `SIDES` 只有 miniapp 与 rn,其 web 腿只比圆角、
 *     只到文件级、且配的是 web↔小程序 而非 web↔RN;
 *   ⇒ 字号/间距/圆角在 web↔RN 这一腿**零判据**。本尺补的就是这一整格。
 *
 * 判据形状(为什么不是"两端同一元素逐值比"):
 *   元素级配对全仓只有门 128 的 19 对同名组件,而 RN 339 屏 / 小程序 328 页 —— 按元素比对
 *   结构上覆盖不到其余屏,也造不出第二份配对判据(§0.6)。本尺判的是**更根本的一层**:
 *   两端各自取的非色档数值,相对唯一档表(SPACING_STEPS / TYPE_STEPS / RADIUS_STEPS)落在哪一桶。
 *   一旦两端取值全部落档,档就是跨端契约本身,web 改档 ⇒ RN/小程序随派生链自动跟随,
 *   元素级分叉失去存在条件。这是"自动同步"的构造保证,不是对账追平。
 *
 * 三桶(本尺的核心输出,它把"要不要人"自动分流):
 *   inTier        取值 ∈ 档表 ⇒ 已走契约,web 调档即自动跟随
 *   missingTier   取值 ∉ 档表,**但对端同值有取用** ⇒ 档表缺位,出路是补表(零端内改动)
 *   fork          取值 ∉ 档表 ∧ 对端零同值 ⇒ 真分叉,出路是把这一侧落回某档(需定档)
 *   offTier(对端自身)对端取值 ∉ 档表 ⇒ 对端散档,同样进补表/落档队列
 *
 * 边界(不得越读):missingTier 与 fork 的区分是**端级取值集对照**,不是"同一元素同值"。
 * 它能回答"这个数在对面到底用没用过",不能回答"对面这个按钮是不是也用这个数"。后者仍归门 128。
 *
 * 取材面(§0.4):默认 HEAD blob;`--staged` 判索引 blob;`--worktree` 仅人工逃生舱。
 * 档表本身也从**被审面**读(不读工作树的源文件),否则会出现"台账按未入库判据下调 ⇒ 干净检出恒红"。
 *
 * 定级:只读报告器,exit 0(正常报告);取不到档表 / 任一端目录取不到 ⇒ exit 2「未判定」(§0.3)。
 *   刻意**不进提交链**:存量(实测 RN 侧档外 2424 处)与本次提交无关,挂 blocking = §12e 恒红门。
 *   唯一调度器 = `scripts/parity-auto.mjs` 的 gate 组 + `scripts/git-guardian.mjs` 巡检轮,
 *   只在计数净增那一档经 §5e 到人。
 *
 * 复用(§0.6 单一真相源,本文件零复算档表):
 *   档表 ← `sync-css-tokens.mjs` 的 `parseTokenTables` / `buildEntries`(与守门 93 R9–R11 同一把尺)
 *   圆角 ← `packages/design-tokens/src/radius.js` 的 `RADIUS_STEPS`(与守门 77 同一张表)
 *
 * 用法:
 *   node scripts/check-web-rn-style-tiers.mjs              # 人类可读报告
 *   node scripts/check-web-rn-style-tiers.mjs --json       # 机器可读(驾驶舱/巡检解析)
 *   node scripts/check-web-rn-style-tiers.mjs --quiet      # 仅结论行
 *   node scripts/check-web-rn-style-tiers.mjs --staged     # 索引面
 *   node scripts/check-web-rn-style-tiers.mjs --self-test  # 判据自检
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { buildEntries, parseTokenTables } from './sync-css-tokens.mjs'
// 取材面一律经统一层(§0.4 / 守门 118):自己派生 git 取 blob 正文 = 第二份取材实现,必然漂移。
import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

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

const RN_DIRS = ['apps/mobile-rn/src', 'packages/app/src', 'packages/ui-native/src']
const WEB_DIRS = ['apps/web/src', 'apps/web/app', 'packages/ui-react/src']
const SPACING_REL = 'packages/design-tokens/src/spacing.ts'
const TYPOGRAPHY_REL = 'packages/design-tokens/src/typography.ts'
const ELEVATION_REL = 'packages/design-tokens/src/elevation.ts'
const RADIUS_REL = 'packages/design-tokens/src/radius.js'

// Tailwind 默认刻度:1 数字档 = 0.25rem = 4px,半档 .5 合法存在(gap-1.5=6px / p-2.5=10px)。
// 这是 web 侧取值的量纲来源,不是本仓自造的档 —— 实测 web 用 10/6/2px 共 6682 处。
const TW_STEP_PX = 4
const TW_TEXT = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30 }

/** 清单:经统一派生层 gitRaw(stdio 纪律住在 face-reader 里,本层不再自派 git —— 守门 118/12g)。 */
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
      // --staged 走索引:`<mode> <oid> <stage>\t<path>`;--head 走树:整行即路径
      const p = FACE === 'staged' ? l.split('\t').pop() : l
      if (!p || !/\.(tsx|ts|css)$/.test(p)) continue
      if (/\.test\.|\/tests?\//.test(p)) continue
      out.push(p)
    }
  }
  return { files: out, reason: null }
}

/**
 * 正文:一次批量取。逐条 `git show` 实测 888+3674 文件要 26s;
 * `catBatch` 先把路径规格折成 oid(同 blob 只读一次),清单与内容同面同轮(§0.4)。
 */
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

/** 档表:从被审面读 TS 源,交派生器同一把尺解析 ⇒ 零复算。取不到 ⇒ 抛错由 main 落 exit 2。 */
function loadTierTable() {
  const rels = [SPACING_REL, TYPOGRAPHY_REL, ELEVATION_REL, RADIUS_REL]
  const texts = fetchTexts(rels)
  const missing = rels.filter((r) => r !== RADIUS_REL && texts.get(r) === null)
  if (missing.length) throw new Error(`档表源取不到(${FACE} 面):${missing.join(', ')}`)
  const tables = parseTokenTables({
    spacing: texts.get(SPACING_REL),
    typography: texts.get(TYPOGRAPHY_REL),
    elevation: texts.get(ELEVATION_REL),
  })
  const entries = buildEntries(tables)
  const spacingSet = new Set(Object.values(tables.SPACING_STEPS).map(Number))
  const typeSet = new Set(Object.values(tables.TYPE_STEPS).map((v) => Number(v.size)))
  const radiusRel = texts.get(RADIUS_REL)
  const radiusSet = new Set()
  if (radiusRel !== null) {
    const m = radiusRel.match(/RADIUS_STEPS\s*=\s*\{([^}]*)\}/)
    if (m) for (const pair of m[1].matchAll(/([A-Za-z0-9_'-]+)\s*:\s*([0-9.]+)/g)) radiusSet.add(Number(pair[2]))
  }
  return {
    entries,
    spacingSet,
    typeSet,
    radiusSet,
    radiusReadable: radiusRel !== null,
  }
}

const SPACING_KEYS = [
  'gap',
  'rowGap',
  'columnGap',
  'padding',
  'paddingHorizontal',
  'paddingVertical',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
]
const RN_KEYS = {
  spacing: [...SPACING_KEYS, 'marginHorizontal', 'marginVertical'],
  fontSize: ['fontSize'],
  radius: ['borderRadius'],
}

const SPACING_CLASS_PREFIX = ['gap', 'p', 'px', 'py', 'pt', 'pb', 'm', 'mx', 'my']

/**
 * 累加一处取用。
 * ⚠ 必须走 Map API:早先用 `map[key]` 读写时,数据挂在 Map 实例的**属性**上,
 *   而 `bucketize` / `mergeUniverse` 按 Map **迭代器**遍历 ⇒ 属性永远枚举不到,
 *   整把尺子静默读出 0,并被误当成"两端已对齐"。自检里那条用真实 bump 灌数的夹具就是钉这一型。
 */
function bump(map, key, val) {
  if (!map.has(key)) map.set(key, new Map())
  const inner = map.get(key)
  inner.set(val, (inner.get(val) || 0) + 1)
}

/** RN 侧:StyleSheet 数字字面量(含负值,负值按绝对值入桶——同一条偏移的两侧)。 */
function collectRn(files, readOne) {
  const acc = { spacing: new Map(), fontSize: new Map(), radius: new Map() }
  let unreadable = 0
  for (const f of files) {
    const t = readOne(f)
    if (t === null) {
      unreadable++
      continue
    }
    for (const key of RN_KEYS.spacing) {
      const re = new RegExp(`\\b${key}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)(?![\\d.])`, 'g')
      let m
      while ((m = re.exec(t))) bump(acc.spacing, key, Math.abs(Number(m[1])))
    }
    for (const m of t.matchAll(/\bfontSize\s*:\s*(-?\d+(?:\.\d+)?)(?![\d.])/g)) bump(acc.fontSize, 'fontSize', Number(m[1]))
    for (const m of t.matchAll(/\bborderRadius\s*:\s*(\d+(?:\.\d+)?)(?![\d.])/g)) bump(acc.radius, 'borderRadius', Number(m[1]))
  }
  return { acc, unreadable }
}

/** web 侧:className 工具类 + 任意值 + CSS 里的 var/字面量(仅记非色档)。 */
function collectWeb(files, readOne) {
  const acc = { spacing: new Map(), fontSize: new Map(), radius: new Map() }
  let unreadable = 0
  for (const f of files) {
    const t = readOne(f)
    if (t === null) {
      unreadable++
      continue
    }
    for (const pre of SPACING_CLASS_PREFIX) {
      for (const m of t.matchAll(new RegExp(`(?:^|[\\s"'\`])${pre}-(\\d+(?:\\.\\d+)?)(?![\\w.\\[-])`, 'g')))
        bump(acc.spacing, pre, Number(m[1]) * TW_STEP_PX)
      for (const m of t.matchAll(new RegExp(`(?:^|[\\s"'\`])${pre}-\\[(\\d+(?:\\.\\d+)?)px\\]`, 'g')))
        bump(acc.spacing, pre, Number(m[1]))
    }
    for (const m of t.matchAll(/(?:^|[\s"'`])text-(xs|sm|base|lg|xl|2xl|3xl)(?![\w-])/g)) bump(acc.fontSize, 'text', TW_TEXT[m[1]])
    for (const m of t.matchAll(/(?:^|[\s"'`])text-\[(\d+(?:\.\d+)?)px\]/g)) bump(acc.fontSize, 'text', Number(m[1]))
    for (const m of t.matchAll(/rounded-(?:\[(\d+(?:\.\d+)?)px\]|(none|sm|md|lg|xl|2xs|xs|full))/g)) {
      if (m[1] !== undefined) bump(acc.radius, 'rounded', Number(m[1]))
    }
  }
  return { acc, unreadable }
}

/** 三桶归类:一侧的取值集相对档表 + 相对另一侧取值全集。 */
function tierFor(kind, tier) {
  return kind === 'spacing' ? tier.spacingSet : kind === 'fontSize' ? tier.typeSet : tier.radiusSet
}

function bucketize(sideAcc, tier, otherValues, kind) {
  const rows = []
  const set = tierFor(kind, tier)
  for (const [prop, valMap] of sideAcc[kind]) {
    for (const [val, n] of valMap) {
      const inTier = set.has(val)
      const onOther = otherValues[kind].has(val)
      rows.push({ prop, val, n, inTier, onOther, state: inTier ? 'inTier' : onOther ? 'missingTier' : 'fork' })
    }
  }
  return rows
}

function mergeUniverse(acc) {
  const out = { spacing: new Set(), fontSize: new Set(), radius: new Set() }
  for (const kind of Object.keys(out)) for (const [, valMap] of acc[kind]) for (const v of valMap.keys()) out[kind].add(v)
  return out
}

function tally(rows) {
  const t = { inTier: 0, missingTier: 0, fork: 0, inN: 0, missingN: 0, forkN: 0 }
  for (const r of rows) {
    if (r.state === 'inTier') {
      t.inTier++
      t.inN += r.n
    } else if (r.state === 'missingTier') {
      t.missingTier++
      t.missingN += r.n
    } else {
      t.fork++
      t.forkN += r.n
    }
  }
  return t
}

function rankRows(rows, state, n = 12) {
  return rows
    .filter((r) => r.state === state)
    .sort((a, b) => b.n - a.n)
    .slice(0, n)
    .map((r) => `${r.prop}=${r.val}px×${r.n}`)
}

function runJudge() {
  const tier = loadTierTable()
  const rnList = listFiles(RN_DIRS)
  const webList = listFiles(WEB_DIRS)
  if (rnList.files === null) throw new Error(rnList.reason)
  if (webList.files === null) throw new Error(webList.reason)
  if (rnList.files.length === 0 || webList.files.length === 0) {
    throw new Error(`枚举到 0 个候选(rn ${rnList.files.length} / web ${webList.files.length})⇒ 判死,不记绿(§0.3)`)
  }
  const rnTexts = fetchTexts(rnList.files)
  const webTexts = fetchTexts(webList.files)
  const rn = collectRn(rnList.files, (p) => rnTexts.get(p) ?? null)
  const web = collectWeb(webList.files, (p) => webTexts.get(p) ?? null)
  // 取值集枚举到 0 ⇒ 判死,不记绿(§0.3)。这一条是钉住的:上一版 bump 写坏时文件数正常、
  // 桶全为 0,整把尺子把"没读到"报成了"两端都对齐"—— 坏尺子的失效形态永远是安静的。
  const rnEmpty = Object.values(rn.acc).every((m) => m.size === 0)
  const webEmpty = Object.values(web.acc).every((m) => m.size === 0)
  if (rnEmpty || webEmpty)
    throw new Error(
      `取值集枚举到 0(rn ${rnEmpty ? '空' : '非空'} / web ${webEmpty ? '空' : '非空'})⇒ 判「未判定」,不记绿也不冒红(§0.3)`,
    )
  const rnU = mergeUniverse(rn.acc)
  const webU = mergeUniverse(web.acc)
  const rnRows = [
    ...bucketize(rn.acc, tier, webU, 'spacing'),
    ...bucketize(rn.acc, tier, webU, 'fontSize'),
    ...bucketize(rn.acc, tier, webU, 'radius'),
  ]
  const webRows = [
    ...bucketize(web.acc, tier, rnU, 'spacing'),
    ...bucketize(web.acc, tier, rnU, 'fontSize'),
    ...bucketize(web.acc, tier, rnU, 'radius'),
  ]
  return {
    face: FACE,
    tier: {
      spacing: [...tier.spacingSet].sort((a, b) => a - b),
      type: [...tier.typeSet].sort((a, b) => a - b),
      radius: [...tier.radiusSet].sort((a, b) => a - b),
      radiusReadable: tier.radiusReadable,
    },
    files: { rn: rnList.files.length, web: webList.files.length, rnUnreadable: rn.unreadable, webUnreadable: web.unreadable },
    rn: { ...tally(rnRows), rows: rnRows },
    web: { ...tally(webRows), rows: webRows },
  }
}

function report(r) {
  const pad = (x, w) => String(x).padStart(w)
  console.log(`\n📐 web↔RN 非色档档位对账(只读,档表 = SPACING_STEPS/TYPE_STEPS/RADIUS_STEPS 同一把尺)`)
  console.log('─'.repeat(72))
  console.log(`判定面        : ${r.face}`)
  console.log(`档表          : 间距 ${r.tier.spacing.join('/')} · 字号 ${r.tier.type.join('/')} · 圆角 ${r.tier.radius.join('/')}${r.tier.radiusReadable ? '' : '(radius.js 取不到 ⇒ 圆角维未判定)'}`)
  console.log(`取材          : RN ${r.files.rn} 文件(取不到 ${r.files.rnUnreadable}) · web ${r.files.web} 文件(取不到 ${r.files.webUnreadable})`)
  for (const side of ['rn', 'web']) {
    const x = r[side]
    console.log(`\n【${side === 'rn' ? 'RN 侧' : 'web 侧'}取值分桶】`)
    console.log(`  ✅ inTier(已走契约)       : ${pad(x.inTier, 4)} 种 / ${pad(x.inN, 6)} 处`)
    console.log(`  🟡 missingTier(档表缺位)  : ${pad(x.missingTier, 4)} 种 / ${pad(x.missingN, 6)} 处  ← 出路=补表,零端内改动`)
    console.log(`  🔴 fork(对端零同值)       : ${pad(x.fork, 4)} 种 / ${pad(x.forkN, 6)} 处  ← 出路=落回某档`)
    if (x.missingTier) console.log(`     缺位 Top: ${rankRows(x.rows, 'missingTier').join(' ')}`)
    if (x.fork) console.log(`     分叉 Top: ${rankRows(x.rows, 'fork').join(' ')}`)
  }
  const rnMissing = rankRows(r.rn.rows, 'missingTier', 999)
  console.log(`\n结论:TIER-STATE rn_missing=${r.rn.missingTier}种/${r.rn.missingN}处 rn_fork=${r.rn.fork}种/${r.rn.forkN}处 web_off=${r.web.missingTier + r.web.fork}种/${r.web.missingN + r.web.forkN}处`)
  console.log(`     (只读尺:不进提交链也不进 CI,§12e。净增才经 §5e 到人;调度=parity-auto gate 组 + guardian 巡检轮)`)
  if (rnMissing.length) console.log(`     补表候选(去重取值): ${[...new Set(rnMissing.map((s) => s.split('=')[1].split('×')[0]))].join(' ')}`)
}

// 自检夹具:两端各一段**真实书写形态**的源码文本(不是简化过的中间结构),
// 用来喂生产采集器 —— 采集器读不出这些,就说明尺子坏了,而不是说明仓库对齐了。
const FIXTURES = {
  'a.tsx': `
    const s = StyleSheet.create({
      row: { gap: 10, padding: 12, marginTop: 8 },
      title: { fontSize: 13, lineHeight: 18, borderRadius: 6 },
      tight: { gap: 13, paddingHorizontal: 2 },
    })`,
  'b.tsx': `
    export const Card = () => <div className="gap-2.5 px-1.5 p-[10px] text-[13px] rounded-md">x</div>`,
}

const SELF_ASSERTS = () => {
  // 夹具:**必须走真实 bump**(上一版就是夹具绕开了 bump,才让坏 bump 顺利自检通过)
  const mk = (entries) => {
    const acc = { spacing: new Map(), fontSize: new Map(), radius: new Map() }
    for (const [prop, val, n] of entries) for (let i = 0; i < n; i++) bump(acc.spacing, prop, val)
    return acc
  }
  const tierSet = { spacingSet: new Set([4, 8, 12]), typeSet: new Set([14]), radiusSet: new Set([6]) }
  const out = []
  // 阳性对照:同值在对端存在 ⇒ missingTier;对端零同值 ⇒ fork;在表内 ⇒ inTier
  const rnAcc = mk([
    ['gap', 8, 10],
    ['gap', 10, 5],
    ['gap', 13, 2],
  ])
  const webAcc = mk([
    ['gap', 8, 99],
    ['gap', 10, 7],
  ])
  const webU = mergeUniverse(webAcc)
  const rows = bucketize(rnAcc, tierSet, webU, 'spacing')
  const byVal = Object.fromEntries(rows.map((r) => [r.val, r.state]))
  out.push(['inTier 命中表内值', byVal[8] === 'inTier'])
  out.push(['表外但对面在用 = 档表缺位', byVal[10] === 'missingTier'])
  out.push(['表外且对面无同值 = 真分叉', byVal[13] === 'fork'])
  // 反向对照:三桶之和必须等于取值种数(枚举漏桶 ⇒ 假绿)
  out.push(['三桶之和==取值种数', rows.length === 3 && tally(rows).inTier + tally(rows).missingTier + tally(rows).fork === rows.length])
  // 计数诚实:处数按 n 累加,不是按种数
  out.push(['处数累加而非种数', tally(rows).inN === 10 && tally(rows).missingN === 5 && tally(rows).forkN === 2])
  // 阳性对照:mergeUniverse 必须真收到对端全集(坏则 missingTier 恒 0,fork 冒充一切)
  out.push(['对端取值全集收齐', webU.spacing.has(8) && webU.spacing.has(10) && webU.spacing.size === 2])
  // 量纲:Tailwind 半档必须折成 px(gap-2.5→10 / p-3→12 / px-1.5→6),否则 web 读数系统性算小 ⇒ missingTier 假装是 fork
  const cls = 'gap-2.5 p-3 px-1.5'
  const folded = []
  for (const pre of SPACING_CLASS_PREFIX)
    for (const m of cls.matchAll(new RegExp(`(?:^|[\\s"'\`])${pre}-(\\d+(?:\\.\\d+)?)(?![\\w.\\[-])`, 'g'))) folded.push(Number(m[1]) * TW_STEP_PX)
  out.push(['半档折 px 正确(2.5→10 / 3→12 / 1.5→6)', JSON.stringify([...folded].sort((a, b) => a - b)) === JSON.stringify([6, 10, 12])])
  // 任意值形态 text-[13px] / p-[10px] 不能被漏掉(漏了就把散档读成"无此取用")
  const arb = []
  for (const m of 'p-[10px] text-[13px]'.matchAll(/(?:^|[\s"'`])p-\[(\d+(?:\.\d+)?)px\]/g)) arb.push(Number(m[1]))
  out.push(['任意值 p-[Npx] 入账', arb.length === 1 && arb[0] === 10])
  // 采集器端到端锁(本仓最高频失效型 = 尺子静默读出 0 而被当成"已对齐"):
  // 把真实形态的源码文本喂进**生产采集器**,断言它必须量出非零 —— 采集器和读桶器之间
  // 任何一次"容器换错/属性 vs 迭代器"的错位,都会在这一条当场翻红,而不是变成一片 0。
  const fakeRead = (p) => FIXTURES[p]
  const rnCollected = collectRn(['a.tsx'], fakeRead)
  const rnUniverse = mergeUniverse(rnCollected.acc)
  out.push([
    '采集器能从 StyleSheet 文本量出非零',
    rnCollected.acc.spacing.size > 0 && rnUniverse.spacing.has(10) && rnUniverse.fontSize.has(13),
  ])
  const webCollected = collectWeb(['b.tsx'], fakeRead)
  const webUniverse = mergeUniverse(webCollected.acc)
  out.push([
    '采集器能从 className 文本量出非零(含半档 6/10)',
    webUniverse.spacing.has(10) && webUniverse.spacing.has(6) && webUniverse.fontSize.has(13),
  ])
  // 三桶之和在真实采集面也必须等于取值种数(防止某一维静默丢桶)
  const realRows = bucketize(rnCollected.acc, tierSet, webUniverse, 'spacing')
  out.push(['真实采集面三桶==种数', tally(realRows).inTier + tally(realRows).missingTier + tally(realRows).fork === realRows.length && realRows.length > 0])
  // 面纪律:面只有三档,取不到别的面
  out.push(['面只有三档', ['head', 'staged', 'worktree'].includes(FACE)])
  return out
}

async function main() {
  if (selfTest) {
    let fail = 0
    for (const [name, ok] of SELF_ASSERTS()) {
      console.log(`${ok ? '✅' : '❌'} ${name}`)
      if (!ok) fail++
    }
    console.log(`自检 ${SELF_ASSERTS().length - fail}/${SELF_ASSERTS().length} 通过`)
    process.exit(fail ? 1 : 0)
  }
  let r
  try {
    r = runJudge()
  } catch (e) {
    console.error(`❌ 未判定(不记绿也不冒红):${e?.message ?? e}`)
    process.exit(2)
  }
  if (jsonMode) {
    const slim = (x) => ({ inTier: x.inTier, inN: x.inN, missingTier: x.missingTier, missingN: x.missingN, fork: x.fork, forkN: x.forkN })
    console.log(JSON.stringify({ ...r, rn: slim(r.rn), web: slim(r.web), rnMissingValues: [...new Set(rankRows(r.rn.rows, 'missingTier', 999).map((s) => Number(s.split('=')[1].split('×')[0])))], rnForkValues: [...new Set(rankRows(r.rn.rows, 'fork', 999).map((s) => Number(s.split('=')[1].split('×')[0])))] }, null, 2))
  } else if (quietMode) {
    console.log(`TIER-STATE rn_missing=${r.rn.missingTier}种/${r.rn.missingN}处 rn_fork=${r.rn.fork}种/${r.rn.forkN}处 web_off=${r.web.missingTier + r.web.fork}种/${r.web.missingN + r.web.forkN}处`)
  } else report(r)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = { bump, bucketize, mergeUniverse, tally, collectWeb, collectRn, rankRows, TW_STEP_PX, SPACING_CLASS_PREFIX }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
