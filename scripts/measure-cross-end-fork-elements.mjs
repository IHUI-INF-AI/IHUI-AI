#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出对账报告 */
/**
 * measure-cross-end-fork-elements.mjs — 非色档分叉的**元素级**归类台账(2026-11-02 Phase 4)
 *
 * 立因:档位尺(`check-web-rn-style-tiers.mjs`)只回答"某个 prop×value 在对端有没有同值",
 * 不回答"这个值落在什么元素上"。于是 `fontSize:22` 这种同一数值既可能是屏标题、也可能
 * 是头像首字母/图标/emoji 的字形盒 —— 两者出路完全相反(正文标题要两端对齐、字形盒是单侧渲染)。
 * 本器把每个字号取值逐处定位到**样式键 + 宿主文件**,按语义分成三类:
 *   rn-only-display / rn-only-shape / rn-only-hairline  RN 单侧渲染,登记允许差异(零观感改动)
 *   web-align                                           两端同一元素,进「待 web 同步对齐」清单
 *   comment-noise                                       注释里的数字(尺子读到了,但不是元素)
 * 归属不明的样式键一律 `undetermined` 并判红(exit 1),不许默认归进"允许差异"(§0.3)。
 *
 * 单一真相源(§0.6):
 *   文件清单/正文/分桶 ← `check-web-rn-style-tiers.mjs` 的同名导出(同一面、同一枚举)
 *   档表/三桶         ← 该器 `runJudge()` 现读,本器不重算档表
 *   允许差异条目       ← `scripts/data/cross-end-allowed-diffs.json`(与门 128 同一本账)
 *
 * 用法:
 *   node scripts/measure-cross-end-fork-elements.mjs            # 核对(默认;台账过期/有未归类/额度不足 ⇒ exit 1)
 *   node scripts/measure-cross-end-fork-elements.mjs --write     # 重生成台账(不碰允许差异表)
 *   node scripts/measure-cross-end-fork-elements.mjs --json      # 机器可读
 */
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { FACE, fetchTexts, listFiles, RN_DIRS, runJudge } from './check-web-rn-style-tiers.mjs'
import { ALLOWED_DIFFS_REL } from './check-cross-end-ui-parity.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LEDGER_REL = 'scripts/data/cross-end-fork-decisions.json'
const argv = process.argv.slice(2)
const writeMode = argv.includes('--write')
const jsonMode = argv.includes('--json')

/** RN 侧样式键清单:从档位尺导出的同一套键(不另抄一份 prop 字典)。 */
const RN_PROPS = [
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
  'marginHorizontal',
  'marginVertical',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'fontSize',
  'borderRadius',
]

const KIND_OF = (prop) => (prop === 'fontSize' ? 'fontSize' : prop === 'borderRadius' ? 'radius' : 'spacing')

/** 字形盒:web 侧由 SVG/图标组件承载,字号只是 RN 的盒尺寸,没有可对齐的排版档。 */
const GLYPH_KEY_RE =
  /^(thumbIcon|menuIcon|categoryIcon|entryIcon|featureIcon|icon|customIcon|pickerIcon|unsubscribeIcon|fabIcon|playerIcon|stateGlyph|heroEmoji|bannerFloatEmoji|emoji|emptyIcon|coverEmoji|courseCoverEmoji|pathCoverEmoji|popularCoverEmoji|courseImageEmoji|qrPlaceholder|qrPlaceholderIconText|avatarInitial|avatarText|avatarEmoji|avatarFallbackText|identityAvatarFallbackText|editProfileAvatarFallbackText|materialSheetClose|detailDialogClose|modelModalClose|carrierWebClose|sharePopupCloseText)$/

/** 内容文字/展示数字:两端是同一元素,差值要走对齐清单(不登记成允许差异)。 */
const TEXT_KEY_RE =
  /^(title|titleText|heroTitle|headerTitle|heroSubtitle|subtitle|sectionTitle|welcomeText|nickname|levelName|userName|topicName|wfTitle|unsubscribeTitle|submitBtnText|body|amount|price|purchasePrice|footPrice|incomeValue|withdrawValue|earningsValue|value|amountText|amountValue|statValue|statsValue|statValueCompleted|statValueBrand|cardValue|balanceValue|scoreValue|scoreText|pairCode)$/

/** 若台账首次覆盖到新样式键,必须由人先定语义 —— 默认 undetermined,不默认放行。 */
export function classifyStyleKey(prop, val, styleKey, isComment) {
  if (isComment) return 'comment-noise'
  if (prop === 'borderRadius') return 'rn-only-shape'
  if (prop !== 'fontSize' && prop !== 'borderRadius') {
    // 1px / 半像素 / 9.6 / 7.8 是 RN 逻辑像素对齐,web 无同值;整数值的组件内边距归"同一元素"。
    return [1, 2.5, 7.8, 9.6].includes(val) ? 'rn-only-hairline' : 'web-align'
  }
  if (GLYPH_KEY_RE.test(styleKey)) return 'rn-only-display'
  if (TEXT_KEY_RE.test(styleKey)) return 'web-align'
  return 'undetermined'
}

/** 逐处扫描:返回 `{prop,val,file,styleKey,isComment,class}`;不改取值、不改源码。 */
export function scanElements(files, readOne) {
  const out = []
  const re = new RegExp(
    `\\b(${RN_PROPS.join('|')})\\s*:\\s*(-?\\d+(?:\\.\\d+)?)(?![\\d.])`,
    'g',
  )
  for (const f of files) {
    const t = readOne(f)
    if (typeof t !== 'string') continue
    const lines = t.split('\n')
    for (const m of t.matchAll(re)) {
      const prop = m[1]
      const val = Math.abs(Number(m[2]))
      const line = lines[t.slice(0, m.index).split('\n').length - 1] ?? ''
      const trimmed = line.trim()
      const isComment = /^(?:\/\/|\/\*|\*)/.test(trimmed)
      let styleKey = '(none)'
      if (!isComment) {
        const before = t.slice(Math.max(0, m.index - 1200), m.index)
        const km = [...before.matchAll(/\n\s*(?:'([^']+)'|([A-Za-z_$][\w$]*))\s*:\s*\{/g)].pop()
        if (km) styleKey = km[1] ?? km[2]
      }
      out.push({ prop, val, file: f, styleKey, isComment, class: classifyStyleKey(prop, val, styleKey, isComment) })
    }
  }
  return out
}

const ALLOWED_CLASSES = new Set(['rn-only-display', 'rn-only-shape', 'rn-only-hairline'])
const fileBase = (p) => p.split(/[\\/]/).pop().replace(/\.(tsx?|jsx?)$/, '')

/** 元素级 component:字形/圆形按 `<文件基名>.<样式键>`,细线按 `RN:<kind>:<prop>`(整值语义)。 */
function componentOf(o) {
  return ALLOWED_CLASSES.has(o.class) && o.class !== 'rn-only-hairline'
    ? `${fileBase(o.file)}.${o.styleKey}`
    : `RN:${KIND_OF(o.prop)}:${o.prop}`
}
const keyOf = (o) => `styleTier:${KIND_OF(o.prop)}:${o.prop}:${o.val}`

/** 允许差异额度:同 component×key 的条目额度相加(逐处登记);到期取最早。 */
export function allowanceIndex(entries) {
  const m = new Map()
  for (const e of Array.isArray(entries) ? entries : []) {
    if (typeof e?.key !== 'string' || !e.key.startsWith('styleTier:')) continue
    if (!Number.isInteger(e.count) || e.count < 1 || typeof e.expires !== 'string') continue
    const k = `${e.component}|${e.key}`
    const prev = m.get(k)
    m.set(k, { count: (prev?.count ?? 0) + e.count, expires: prev && prev.expires < e.expires ? prev.expires : e.expires })
  }
  return m
}

const KIND_DECISION = {
  'rn-only-display': 'allowance',
  'rn-only-shape': 'allowance',
  'rn-only-hairline': 'allowance',
  'web-align': 'web-alignment-todo',
  'comment-noise': 'not-an-element',
  undetermined: 'undetermined',
}

/** 台账主产物(纯函数):元素级归类 + 分叉行 roll-up + 缺位决策 + 额度覆盖。 */
export function buildLedger({ face, elements, tierRows, allowedEntries, today = new Date().toISOString().slice(0, 10) }) {
  /**
   * 射程 = 档表外的取值(分叉 + 缺位)。档内取值已走契约,不在本台账射程内;
   * 不先筛会把 755 处(含 fontSize 13/14 这类已落档值)混进来,让"单侧展示"读数失去意义。
   */
  const outside = new Set(
    tierRows.filter((r) => r.state === 'fork' || r.state === 'missingTier').map((r) => `${r.prop}=${r.val}`),
  )
  elements = elements.filter((o) => outside.has(`${o.prop}=${o.val}`))
  const groups = new Map()
  for (const o of elements) {
    const k = `${o.file}|${o.styleKey}|${o.prop}|${o.val}|${o.class}`
    const g = groups.get(k)
    if (g) g.count++
    else groups.set(k, { ...o, count: 1 })
  }
  const fontSizeElements = [...groups.values()]
    .filter((g) => g.prop === 'fontSize')
    .map((g) => ({
      file: g.file,
      styleKey: g.styleKey,
      size: g.val,
      count: g.count,
      class: g.class,
      decision: KIND_DECISION[g.class],
      ...(KIND_DECISION[g.class] === 'web-alignment-todo'
        ? {
            changeSide: 'rn',
            evidenceNeeded:
              'web 同名元素当前字号档 + 两端截图对照 + owner 签字;改 RN 侧向 web 现用档收敛,不得在本表内直接改值',
          }
        : {}),
    }))
  const forkRows = tierRows
    .filter((r) => r.state === 'fork')
    .map((r) => {
      const cls = {}
      for (const o of elements) if (o.prop === r.prop && o.val === r.val) cls[o.class] = (cls[o.class] ?? 0) + 1
      const allowedN =
        (cls['rn-only-display'] ?? 0) + (cls['rn-only-shape'] ?? 0) + (cls['rn-only-hairline'] ?? 0)
      return {
        kind: r.kind,
        prop: r.prop,
        value: r.val,
        occurrences: r.n,
        classes: cls,
        decision: allowedN >= r.n ? 'allowance' : allowedN > 0 ? 'partial-allowance' : 'pending-decision',
      }
    })
  // 额度覆盖:允许类元素必须有登记,且额度 ≥ 实测处数、未到期。
  const idx = allowanceIndex(allowedEntries)
  const missing = []
  const short = []
  const expired = []
  for (const g of groups.values()) {
    if (!ALLOWED_CLASSES.has(g.class)) continue
    const comp = componentOf(g)
    const key = keyOf(g)
    const hit = idx.get(`${comp}|${key}`)
    if (!hit) missing.push({ component: comp, key, count: g.count, file: g.file, styleKey: g.styleKey })
    else if (hit.expires < today) expired.push({ component: comp, key, expires: hit.expires, file: g.file })
    else if (hit.count < g.count) short.push({ component: comp, key, count: g.count, allowed: hit.count, file: g.file })
  }
  const undetermined = elements.filter((o) => o.class === 'undetermined')
  const classes = {}
  for (const o of elements) classes[o.class] = (classes[o.class] ?? 0) + 1
  return {
    version: 1,
    note:
      '非色档分叉的元素级归类(2026-11-02 Phase 4)。只读台账:不改任何取值、不新增类型档。' +
      'rn-only-* 是 RN 单侧渲染,必须在 cross-end-allowed-diffs.json 有 styleTier 条目(到期回红);' +
      'web-align 是两端同一元素,差值进「待 web 同步对齐」清单,不登记成允许差异;' +
      'undetermined 必须由人定语义,本器对非零 undetermined 判红。',
    face,
    summary: {
      elements: elements.length,
      fontSize: elements.filter((o) => o.prop === 'fontSize').length,
      classes,
      forkRows: forkRows.length,
      forkOccurrences: forkRows.reduce((s, r) => s + r.occurrences, 0),
      missingTierRows: tierRows.filter((r) => r.state === 'missingTier').length,
      missingTierOccurrences: tierRows.filter((r) => r.state === 'missingTier').reduce((s, r) => s + r.n, 0),
    },
    fontSizeElements,
    forkRows,
    missingTierDecisions: missingTierDecisions(tierRows),
    allowanceCoverage: { missing, short, expired, ok: !missing.length && !short.length && !expired.length },
    undetermined,
  }
}

/**
 * missingTier 决策表(19 行/89 处,2026-11-02 Phase 4 现读)。
 * 硬约束:不新增类型档 ⇒ `fontSize 26` 不可能补表;Δ>1px ⇒ 落最近档会改观感 ⇒ 也不做。
 * spacing 3/5/28/80/96 的归属已在 `spacing.ts` 头注钉住(Phase 3 明写"不得借本表顺手补入"),
 * 本表只承接"为什么不补"的依据,不改档表。
 */
function missingTierDecisions(tierRows) {
  const VALUES = {
    3: '半步档规模未过 Phase 3 准入线(RN 20 处),且 spacing.ts 头注已把 3 留给决策表;补表会扩张公开档而无派生收益。',
    5: '半步档规模未过 Phase 3 准入线(RN 25+ 处,web 同值在用),spacing.ts 头注已明写"不得借本表顺手补入"。',
    26: '字号 26 无对应 TYPE_STEPS 档;本阶段硬约束"不新增类型档",最近档 24/30 的 Δ=2px > 1px ⇒ 落档会改观感。',
    28: '布局专用值(marginTop/padding 各 1-2 处),非间距刻度;未过准入线,补表会把局部布局值升成公共档。',
    80: '屏级留白(paddingBottom 1 处),远离现有档表上界 64,不具备跨端复用规模。',
    96: '屏级留底(paddingBottom 2 处),同上;补表会新增无派生消费方的档。',
  }
  return tierRows
    .filter((r) => r.state === 'missingTier')
    .map((r) => ({
      kind: r.kind,
      prop: r.prop,
      value: r.val,
      occurrences: r.n,
      verdict: 'decision-table',
      reject: ['补表', '落最近档'],
      reason: VALUES[r.val] ?? '未归类取值:必须由人先定归属,不得默认补表或默认放行。',
      evidence: `档位尺 --json: ${r.prop}=${r.val}px×${r.n}(missingTier:对端同值在用但不在档表)`,
    }))
}

function loadAllowed() {
  const text = fetchTexts([ALLOWED_DIFFS_REL]).get(ALLOWED_DIFFS_REL)
  if (typeof text !== 'string') return { entries: [], problem: `取不到 ${ALLOWED_DIFFS_REL}(${FACE} 面)` }
  try {
    return { entries: JSON.parse(text)?.entries ?? [], problem: null }
  } catch {
    return { entries: [], problem: `${ALLOWED_DIFFS_REL} 不是合法 JSON(${FACE} 面)` }
  }
}

function main() {
  const rnList = listFiles(RN_DIRS)
  if (rnList.files === null) throw new Error(rnList.reason)
  const texts = fetchTexts(rnList.files)
  const elements = scanElements(rnList.files, (p) => texts.get(p) ?? null)
  const judge = runJudge()
  const { entries, problem } = loadAllowed()
  const ledger = buildLedger({ face: FACE, elements, tierRows: judge.rn.rows, allowedEntries: entries })
  const ledgerText = JSON.stringify(ledger, null, 2) + '\n'
  if (writeMode) {
    writeFileSync(resolve(ROOT, LEDGER_REL), ledgerText)
    console.log(`✅ 已写入 ${LEDGER_REL}:元素 ${ledger.summary.elements} 处 / 分叉 ${ledger.summary.forkRows} 行 / 缺位 ${ledger.summary.missingTierRows} 行`)
  }
  if (jsonMode) console.log(ledgerText)
  else if (!writeMode) {
    const c = ledger.summary.classes
    console.log(
      `FORK-ELEMENTS face=${FACE} 元素 ${ledger.summary.elements} 处 | ` +
        `单侧展示 ${(c['rn-only-display'] ?? 0) + (c['rn-only-shape'] ?? 0) + (c['rn-only-hairline'] ?? 0)} / ` +
        `待对齐 ${c['web-align'] ?? 0} / 注释噪声 ${c['comment-noise'] ?? 0} / 未归类 ${ledger.undetermined.length}`,
    )
    const cov = ledger.allowanceCoverage
    console.log(
      `登记覆盖:缺 ${cov.missing.length} / 额度不足 ${cov.short.length} / 到期 ${cov.expired.length}` +
        `${problem ? ` · ⚠ ${problem}` : ''}`,
    )
  }
  // 判红:未归类 / 额度缺口 / 到期 —— 台账坏了就是坏了,不得当成"都登记过"。
  const bad = ledger.undetermined.length + ledger.allowanceCoverage.missing.length + ledger.allowanceCoverage.short.length + ledger.allowanceCoverage.expired.length + (problem ? 1 : 0)
  if (bad) {
    console.error(`❌ 元素级归类未收口:${bad} 处(未归类/额度缺失/到期/登记表取不到)⇒ 先定语义或补登记,不得放行`)
    for (const u of ledger.undetermined.slice(0, 8))
      console.error(`   ? ${u.file}: ${u.prop}=${u.val}(${u.styleKey})`)
    for (const m of ledger.allowanceCoverage.missing.slice(0, 8))
      console.error(`   + ${m.component}|${m.key} 需登记 ${m.count} 处(${m.file}:${m.styleKey})`)
    process.exitCode = 1
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = {
  classifyStyleKey,
  scanElements,
  allowanceIndex,
  buildLedger,
  componentOf,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
