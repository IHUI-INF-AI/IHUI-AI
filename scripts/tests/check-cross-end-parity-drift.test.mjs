#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 测试需逐条打印用例结论 */

/**
 * 镜像测试:check-cross-end-parity-drift(跨端对齐漂移只读尺)。
 * §22c:判据全部 import 源脚本 __test__,本文件不复制第二份比较逻辑。
 * 重点钉三族失效型:① 字段名漂移必须落 undetermined(不得读成 ok);
 * ② 门判红时即使镜像数在涨也必须 regressed(涨不能顶掉红);
 * ③ 文档数字与现读不等必须点名并给出可执行的重跑命令(§5e-1 可整改性)。
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as P, GATE_DIRECTIONS } from '../check-cross-end-parity-drift.mjs'

const results = []
const test = (name, fn) => results.push({ name, fn })

const mkCov = ({ mirrored = 91, reds = 0, entries = 90, sharedTotal = 218 } = {}) => ({
  ok: true,
  json: {
    stats: { mirroredShared: mirrored, registryEntries: entries, sharedTotal },
    red: new Array(reds).fill({ rule: 'R1' }),
  },
})
// webParity 夹具:形状与尺子 check-web-rn-screen-parity.mjs --json 逐字同形。
// 2026-10-30 起多两组字段:① 承载面去重计数 alignedUnique —— 承载面是"一组 web 键",不是台账行数;
// ② 段级豁免四维 prefixContradicted / staleCountAssertions / missingExpiry.items / duplicateWebKeys。
// `omit` 用于构造"尺子那一维取不到"(字段整个不在)⇒ 哨兵必须判未判定(不冒红、也不折成 0)。
const mkWeb = ({
  rot = 0,
  aligned = 150,
  alignedUnique = aligned,
  unmapped = 270,
  judgedGap = 0,
  prefixContradicted = [],
  staleCountAssertions = [],
  missingExpiry = [],
  duplicateWebKeys = 0,
  // 键级集合(2026-11-08 立):登记面与承载削减面靠它分开判,不能只看计数。
  judgedGapKeys = null,
  alignedKeys = null,
  portalKeys = null,
  omit = [],
} = {}) => {
  const json = { rot: new Array(rot).fill({ line: 1 }), aligned, unmapped, judgedGap }
  if (!omit.includes('alignedUnique')) json.alignedUnique = alignedUnique
  if (judgedGapKeys !== null) json.judgedGapKeys = judgedGapKeys
  if (alignedKeys !== null) json.alignedKeys = alignedKeys
  if (portalKeys !== null) json.portalKeys = portalKeys
  if (!omit.includes('prefixContradicted')) json.prefixContradicted = prefixContradicted
  if (!omit.includes('staleCountAssertions')) json.staleCountAssertions = staleCountAssertions
  if (!omit.includes('missingExpiry')) {
    // 尺子真身:missingExpiry 是**数组本身**(逐条点名),未判定另走 missingExpiryUndetermined
    json.missingExpiry = missingExpiry
    json.missingExpiryUndetermined = []
  }
  if (!omit.includes('duplicateWebKeys')) json.duplicateWebKeys = duplicateWebKeys
  return { ok: true, json }
}

// judge() 的输入面在 2026-10-27/29 长到了 12 维(fidelity 8 + conversion 2 + coverage/web 各外),
// 而本文件的夹具只给 coverage+webParity ⇒ 每一格都被 null 扫描记成"取不到输入" ⇒
// C1/C2/C3/C6/C7 从那天起就是红的(尺子的镜像测试与尺子同批才能钉住行为)。
// 补齐正例夹具后,新增维必须在这里同批加默认值,否则又会出现"测试恒红 ⇒ 没人看"。
const mkFid = ({
  hosted = 100,
  hand = 20,
  missing = 0,
  broken = 0,
  other = 0,
  packAbsentRows = 0,
  packUndetermined = false,
  totalRetracted = 0,
  retractionTotal = 0,
  retractionRefused = [],
  retractionBad = [],
  retractionRot = [],
  rows = [],
} = {}) => ({
  ok: true,
  json: {
    hosted,
    hand,
    totalMissing: missing,
    broken,
    other,
    packUndetermined,
    packAbsentRows,
    totalRetracted,
    retractionTotal,
    retractionRefused,
    retractionBad,
    retractionRot,
    rows,
  },
})
const mkConv = ({ upgradable = 0, refused = 0 } = {}) => ({
  ok: true,
  json: { upgradable, refused },
})
const J = (o) => P.judge({ fidelity: mkFid(), conversion: mkConv(), ...o })

test('C1 持平无腐烂 ⇒ ok(正控:尺子不是恒拒)', () => {
  const j = J({
    coverage: mkCov(),
    webParity: mkWeb(),
    doc: '- 已被小程序显式镜像: **91**',
    prev: { mirrored: 91 },
  })
  assert.equal(j.state, 'ok')
  assert.deepEqual(j.reasons, [])
})

test('C2 镜像净减 ⇒ regressed/mirrored-decrease', () => {
  const j = J({
    coverage: mkCov({ mirrored: 89 }),
    webParity: mkWeb(),
    doc: '',
    prev: { mirrored: 91 },
  })
  assert.equal(j.state, 'regressed')
  assert.ok(j.reasons.some((r) => r.dim === 'mirrored-decrease'))
})

test('C3 镜像在涨但门判红 ⇒ 仍 regressed(涨不得顶掉红)', () => {
  const j = J({
    coverage: mkCov({ mirrored: 130, reds: 2 }),
    webParity: mkWeb(),
    doc: '',
    prev: { mirrored: 91 },
  })
  assert.equal(j.state, 'regressed')
  assert.ok(j.reasons.some((r) => r.dim === 'registry-rot'))
  assert.equal(
    j.reasons.some((r) => r.dim === 'mirrored-decrease'),
    false,
  )
})

test('C4 子对账器跑不动 ⇒ undetermined,绝不记绿', () => {
  const j = J({
    coverage: { ok: false, why: 'boom' },
    webParity: mkWeb(),
    doc: '',
    prev: { mirrored: 91 },
  })
  assert.equal(j.state, 'undetermined')
  assert.ok(j.missing.includes('coverage'))
  assert.equal(j.reasons.length, 0)
})

test('C5 字段名漂移(上游改了汇总行形状)⇒ undetermined 而非 ok', () => {
  const broken = { ok: true, json: { stats: { someOtherName: 1 }, red: [] } }
  const j = J({ coverage: broken, webParity: mkWeb(), doc: '', prev: null })
  assert.equal(j.state, 'undetermined')
  assert.ok(j.missing.length > 0)
})

test('C6 无上一轮快照 ⇒ 不比涨跌(缺 prev 不得判成倒退)', () => {
  const j = J({ coverage: mkCov({ mirrored: 10 }), webParity: mkWeb(), doc: '', prev: null })
  assert.equal(j.state, 'ok')
  assert.equal(j.prev, null)
})

test('C7 文档自述数≠现读 ⇒ 点名 doc-stale 并给可执行重跑命令,但**不算倒退也不喊人**(派生件滞后归派生件)', () => {
  const j = J({
    coverage: mkCov({ mirrored: 91 }),
    webParity: mkWeb(),
    doc: '- 已被小程序显式镜像: **79**',
    prev: { mirrored: 91 },
  })
  const d = (j.stale || []).find((r) => r.dim === 'doc-stale')
  assert.ok(d, `应点名 doc-stale,实得 stale=${JSON.stringify(j.stale)}`)
  assert.match(d.detail, /report-rn-miniapp-gaps\.mjs --write/)
  assert.equal(j.state, 'ok', '文档滞后不得把整轮判成倒退(§12e:那不是提交者能当场满足的判据)')
})

test('C8 docNumbers 解析生成文档三行,缺失落 null 不用 0 冒充', () => {
  const md = [
    '- 判定面: **HEAD blob**',
    '- 共享屏(真相源): **218**',
    '- 已被小程序显式镜像: **91**',
    '- 缺口(未判定镜像): **127**',
  ].join('\n')
  assert.deepEqual(P.docNumbers(md), { sharedTotal: 218, mirrored: 91, gaps: 127 })
  assert.deepEqual(P.docNumbers(''), { sharedTotal: null, mirrored: null, gaps: null })
  assert.equal(P.docNumbers(null).mirrored, null)
})

test('C9 阳性对照:解析 HEAD 面上**真·生成文档**,三个数都不得为 null(坏尺子会把"没解析出来"读成"没有缺口")', () => {
  const md = execFileSync('git', ['show', `HEAD:${P.DOC_PATH}`], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 1 << 22,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const n = P.docNumbers(md)
  for (const k of ['sharedTotal', 'mirrored', 'gaps']) {
    assert.ok(Number.isFinite(n[k]), `${k} 未从真文档解析出来:${JSON.stringify(n)}`)
  }
  assert.equal(
    n.sharedTotal,
    n.mirrored + n.gaps,
    '共享屏 = 已镜像 + 缺口 这条恒等式在真文档上必须成立',
  )
})

test('C10 撤除台账腐烂(有行现在不免除任何东西)⇒ 按绝对值出声,维名可去重', () => {
  const j = J({
    coverage: mkCov(),
    webParity: mkWeb(),
    fidelity: mkFid({ retractionRot: ['pages/study/record\x00a\x00studyRecord.duration'] }),
    doc: '',
    prev: { mirrored: 91 },
  })
  assert.equal(j.state, 'regressed')
  assert.ok(j.reasons.some((r) => r.dim === 'key-retraction-rot'))
})

test('C11 撤除台账行不成立(缺出处/已到期)⇒ 另一维出声,且与腐烂不串门', () => {
  const j = J({
    coverage: mkCov(),
    webParity: mkWeb(),
    fidelity: mkFid({ retractionRefused: [{ id: 'x', why: '已到期(2020-01-01)' }] }),
    doc: '',
    prev: { mirrored: 91 },
  })
  const dims = j.reasons.map((r) => r.dim)
  assert.ok(dims.includes('key-retraction-invalid'), JSON.stringify(dims))
  assert.equal(dims.includes('key-retraction-rot'), false, '腐烂那一维不得被顺手喊出去')
})

test('C12 缺口从 6 回到 0(撤除已入账)⇒ 只算好转,不算倒退也不要求解释', () => {
  const j = J({
    coverage: mkCov(),
    webParity: mkWeb(),
    fidelity: mkFid({ missing: 0, totalRetracted: 6, retractionTotal: 6 }),
    doc: '',
    prev: { mirrored: 91, fidelityMissing: 6 },
  })
  assert.equal(j.state, 'ok', JSON.stringify(j.reasons))
})

test('C13 方向锁:fidelity 少了撤除维(上游改字段名)⇒ 未判定,绝不读成"台账没问题"', () => {
  const fid = mkFid()
  delete fid.json.totalRetracted
  delete fid.json.retractionRot
  const j = J({
    coverage: mkCov(),
    webParity: mkWeb(),
    fidelity: fid,
    doc: '',
    prev: { mirrored: 91 },
  })
  assert.equal(j.state, 'undetermined')
  assert.ok(j.missing.includes('fidelityRetracted'))
  assert.ok(j.missing.includes('fidelityRetractionRot'))
})

/* ---------- 承载面口径(2026-10-30 立):比去重 web 键,不比台账行数 ---------- */

test('D1 台账折叠同键重复行(行数掉、承载面不变)⇒ **不**报"RN 承载被拆"', () => {
  const j = J({
    coverage: mkCov(),
    webParity: mkWeb({ aligned: 143, alignedUnique: 150 }),
    doc: '',
    prev: { mirrored: 91, aligned: 150, alignedUnique: 150 },
  })
  assert.equal(
    j.reasons.some((r) => r.dim === 'web-aligned-decrease'),
    false,
    `折叠重复行不是承载被拆,不该出声:实得 ${JSON.stringify(j.reasons)}`
  )
  assert.equal(j.state, 'ok')
})

test('D2 承载面真掉 ⇒ regressed/web-aligned-decrease(去重口径仍抓真倒退)', () => {
  const j = J({
    coverage: mkCov(),
    webParity: mkWeb({ aligned: 140, alignedUnique: 140 }),
    doc: '',
    prev: { mirrored: 91, aligned: 150, alignedUnique: 150 },
  })
  assert.equal(j.state, 'regressed')
  const r = j.reasons.find((x) => x.dim === 'web-aligned-decrease')
  assert.ok(r, `承载面掉了必须出声:实得 ${JSON.stringify(j.reasons)}`)
  assert.match(r.detail, /承载面 150 → 140/)
})

test('D3 上轮基线没有去重口径(旧快照)⇒ 本维未判定:不产假告警,但要可追', () => {
  const j = J({
    coverage: mkCov(),
    webParity: mkWeb({ aligned: 143, alignedUnique: 150 }),
    doc: '',
    prev: { mirrored: 91, aligned: 150 },
  })
  assert.equal(j.reasons.some((r) => r.dim === 'web-aligned-decrease'), false)
  assert.ok(
    (j.stale || []).some((s) => s.dim === 'web-aligned-uncompared'),
    `未判定要可追(点名不响):实得 stale=${JSON.stringify(j.stale)}`
  )
})

/* ---------- judgedGapWeb 拆两栏(2026-11-08 立):登记动作 ≠ 承载被拆 ---------- */

test('D7 如实登记新 gap(承载面一枚未减)⇒ 不判红,只进登记面(advisory)', () => {
  const j = J({
    coverage: mkCov(),
    webParity: mkWeb({ judgedGap: 3, judgedGapKeys: ['old-gap', 'sag2', 'new-gap'] }),
    doc: '',
    prev: {
      mirrored: 91,
      alignedUnique: 150,
      judgedGapWeb: 1,
      judgedGapKeys: ['old-gap'],
      alignedKeys: ['settings'],
      portalKeys: ['admin/x'],
    },
  })
  assert.equal(
    j.state,
    'ok',
    `诚实登记 gap 不得被判红:实得 ${JSON.stringify((j.reasons || []).map((r) => r.dim))}`,
  )
  const a = (j.advisories || []).find((x) => x.dim === 'web-judged-gap-registered')
  assert.ok(a, `登记动作必须只报数地被看见:实得 ${JSON.stringify(j.advisories)}`)
  assert.match(a.detail, /sag2/)
})

test('D8 既有承载键被登记成 gap ⇒ regressed/web-judged-gap-regression 并点名该键', () => {
  const j = J({
    coverage: mkCov(),
    webParity: mkWeb({ judgedGap: 2, judgedGapKeys: ['old-gap', 'settings'] }),
    doc: '',
    prev: {
      mirrored: 91,
      alignedUnique: 150,
      judgedGapWeb: 1,
      judgedGapKeys: ['old-gap'],
      alignedKeys: ['settings'],
      portalKeys: [],
    },
  })
  assert.equal(j.state, 'regressed')
  const r = j.reasons.find((x) => x.dim === 'web-judged-gap-regression')
  assert.ok(r, `承载键退化成 gap 必须判红:实得 ${JSON.stringify(j.reasons.map((x) => x.dim))}`)
  assert.match(r.detail, /settings/, '必须点名被拆的 web 键')
})

test('D9 门户承载键被登记成 gap 也属承载被拆(不只 aligned 一档)', () => {
  const j = J({
    coverage: mkCov(),
    webParity: mkWeb({ judgedGap: 1, judgedGapKeys: ['admin/x'] }),
    doc: '',
    prev: {
      mirrored: 91,
      alignedUnique: 150,
      judgedGapWeb: 0,
      judgedGapKeys: [],
      alignedKeys: [],
      portalKeys: ['admin/x'],
    },
  })
  assert.equal(j.state, 'regressed')
  assert.ok(j.reasons.some((r) => r.dim === 'web-judged-gap-regression' && /admin\/x/.test(r.detail)))
})

/* ---------- 段级豁免四维装车(2026-10-30 立):§0.9「造好没装车」= 没有 ---------- */

test('D4 四维净增 ⇒ 各自出一条理由(带可执行出路),存量只报数不喊人', () => {
  const base = { mirrored: 91, prefixContradicted: 0, staleCountAssertions: 0, missingExpiry: 0, duplicateWebKeys: 0 }
  const grown = J({
    coverage: mkCov(),
    webParity: mkWeb({
      prefixContradicted: [{}, {}, {}],
      staleCountAssertions: [{}, {}],
      missingExpiry: [{}, {}, {}, {}],
      duplicateWebKeys: 1,
    }),
    doc: '',
    prev: base,
  })
  for (const dim of [
    'web-prefix-contradicted-increase',
    'web-stale-count-increase',
    'web-expiry-missing-increase',
    'web-duplicate-key-increase',
  ])
    assert.ok(grown.reasons.some((r) => r.dim === dim), `缺 ${dim}:${JSON.stringify(grown.reasons.map((r) => r.dim))}`)
  for (const r of grown.reasons) assert.match(r.detail, /出路:/, '每一维都要给可执行下一步')
  // 存量不变 ⇒ 不喊人(§12e 棘轮)
  const flat = J({
    coverage: mkCov(),
    webParity: mkWeb({
      prefixContradicted: [],
      staleCountAssertions: [],
      missingExpiry: [],
      duplicateWebKeys: 0,
    }),
    doc: '',
    prev: base,
  })
  assert.equal(flat.state, 'ok', JSON.stringify(flat.reasons))
})

test('D5 四维取不到(字段整个不在)⇒ 该维未判定:不冒红、不折成 0、不产出理由', () => {
  const j = J({
    coverage: mkCov(),
    webParity: mkWeb({
      omit: ['prefixContradicted', 'staleCountAssertions', 'missingExpiry', 'duplicateWebKeys', 'alignedUnique'],
    }),
    doc: '',
    prev: { mirrored: 91, prefixContradicted: 0, staleCountAssertions: 0, missingExpiry: 0, duplicateWebKeys: 0 },
  })
  assert.equal(
    j.reasons.filter((r) => r.dim.startsWith('web-') && r.dim.includes('increase')).length,
    0,
    '取不到不是"没涨",不得出声'
  )
  assert.equal(j.extras.prefixContradicted, null)
  assert.equal(j.extras.missingExpiry, null)
  assert.equal(j.extras.alignedUnique, null)
})

test('D6 上轮基线没有这一维 ⇒ 本轮首次量到**不是净增**(别把"没有基线"读成"基线是零")', () => {
  const j = J({
    coverage: mkCov(),
    webParity: mkWeb({
      prefixContradicted: [{}, {}, {}],
      staleCountAssertions: [{}, {}],
      missingExpiry: [{}],
      duplicateWebKeys: 2,
    }),
    doc: '',
    // 上轮快照是旧格式:这四维压根不在 ⇒ 无基线可比
    prev: { mirrored: 91, aligned: 301 },
  })
  assert.equal(
    j.reasons.filter((r) => r.dim.includes('increase')).length,
    0,
    `没有基线不得当"净增"喊出去:实得 ${JSON.stringify(j.reasons.map((r) => r.dim))}`
  )
  // 但本轮读到的数必须进快照面,下一轮起才可比
  assert.equal(j.extras.prefixContradicted, 3)
  assert.equal(j.extras.missingExpiry, 1)
})

/* ---------- 回归制(gate)同一拆法:基线面也只判承载被拆,不判登记动作 ---------- */

test('G5 --gate:如实登记 gap(承载面与基线持平)⇒ ok,不得逼人刷基线', () => {
  const baseline = {
    dims: { mirrored: 256, aligned: 292, alignedUnique: 292, unmapped: 0, judgedGapWeb: 0 },
  }
  const values = { mirrored: 256, aligned: 292, alignedUnique: 292, unmapped: 0, judgedGapWeb: 1 }
  const judged = P.judgeBaseline({ values, baseline, directions: GATE_DIRECTIONS })
  assert.equal(
    judged.state,
    'ok',
    `诚实登记不得判红:实得 ${JSON.stringify(judged.regressions.map((r) => r.dim))}`,
  )
})

test('G6 --gate:既有承载被拆(alignedUnique 292→291)⇒ regressed,修后仍红', () => {
  const baseline = {
    dims: { mirrored: 256, aligned: 292, alignedUnique: 292, unmapped: 0, judgedGapWeb: 0 },
  }
  const values = { mirrored: 256, aligned: 291, alignedUnique: 291, unmapped: 0, judgedGapWeb: 1 }
  const judged = P.judgeBaseline({ values, baseline, directions: GATE_DIRECTIONS })
  assert.equal(judged.state, 'regressed')
  assert.ok(judged.regressions.some((r) => r.dim === 'alignedUnique'))
})

test('G7 键级判据:同一 web 键从 aligned/portal 退化为 gap ⇒ regression,并点名', () => {
  assert.equal(
    typeof P.judgeJudgedGapFaces,
    'function',
    '缺 judgeJudgedGapFaces ⇒ 登记面与承载面在键级上仍无法分开判',
  )
  const face = P.judgeJudgedGapFaces({
    nowGapKeys: ['settings', 'sag2'],
    baseGapKeys: ['old-gap'],
    baseCarriedKeys: ['settings', 'admin/x'],
  })
  assert.equal(face.compared, true)
  assert.deepEqual(face.regression, ['settings'], '承载键退化必须单独成面')
  assert.deepEqual(face.registered, ['settings', 'sag2'], '新登记键只进登记面')
})

test('G8 键级判据:新登记 gap 不在基线承载集 ⇒ regression 为空(诚实登记不阻断)', () => {
  const face = P.judgeJudgedGapFaces({
    nowGapKeys: ['sag2'],
    baseGapKeys: [],
    baseCarriedKeys: ['settings'],
  })
  assert.equal(face.compared, true)
  assert.deepEqual(face.regression, [])
  assert.deepEqual(face.registered, ['sag2'])
})

/* ---------- 提交面分档(2026-11-08 302 接 blocking):只拦承载削减,登记只报数 ---------- */

test('H1 提交面:新增未登记屏(unmapped 0→1)⇒ 只报数可见,不判红;push 面同数据仍红', () => {
  assert.equal(
    typeof P.commitFaceOf,
    'function',
    '缺 commitFaceOf ⇒ 提交面会按整表判红,重演「如实登记就被判倒退」的坑',
  )
  const baseline = { dims: { mirrored: 256, aligned: 292, alignedUnique: 292, unmapped: 0 } }
  const values = { mirrored: 256, aligned: 292, alignedUnique: 292, unmapped: 1 }
  const push = P.judgeBaseline({ values, baseline, directions: GATE_DIRECTIONS })
  assert.equal(push.state, 'regressed', 'push 面不许被提交面分档放宽')
  const commit = P.commitFaceOf(push)
  assert.equal(commit.state, 'ok', '新增未登记屏在提交面只能报数')
  assert.equal(commit.regressions.length, 0)
  assert.ok(
    commit.advisories.some((a) => a.dim === 'unmapped' && /只报数/.test(a.detail)),
    '报数行必须进人读输出,不能只写日志',
  )
})

test('H2 提交面:拆掉既有承载(alignedUnique 292→291)⇒ 提交面必须 regressed', () => {
  const baseline = { dims: { mirrored: 256, aligned: 292, alignedUnique: 292, unmapped: 0 } }
  const values = { mirrored: 256, aligned: 292, alignedUnique: 291, unmapped: 0 }
  const commit = P.commitFaceOf(
    P.judgeBaseline({ values, baseline, directions: GATE_DIRECTIONS }),
  )
  assert.equal(commit.state, 'regressed', '承载被拆在提交面必须判红')
  assert.ok(commit.regressions.some((r) => r.dim === 'alignedUnique'))
})

test('H3 提交面:既有承载键被登记成 gap ⇒ regressed(承载面同源,不许降成只报数)', () => {
  const commit = P.commitFaceOf({
    state: 'regressed',
    regressions: [
      { dim: 'judgedGapWebRegression', label: '既有承载键被登记成 gap', baseline: 0, current: 1, delta: 1 },
    ],
  })
  assert.equal(commit.state, 'regressed')
  assert.ok(commit.regressions.some((r) => r.dim === 'judgedGapWebRegression'))
})

test('H4 提交面:如实登记 gap、承载面一枚未减 ⇒ ok(不因"登记了"误红)', () => {
  const baseline = { dims: { mirrored: 256, aligned: 292, alignedUnique: 292, unmapped: 0 } }
  const values = { mirrored: 256, aligned: 292, alignedUnique: 292, unmapped: 0 }
  const commit = P.commitFaceOf(
    P.judgeBaseline({ values, baseline, directions: GATE_DIRECTIONS }),
  )
  assert.equal(commit.state, 'ok')
  assert.equal(commit.regressions.length, 0)
})

test('E1 存续锁:这台尺的 self-test 必须整趟绿,且例数钉死(2026-11-05 实测它坏了 19/24 却无人发现)', () => {
  // 为什么必须有这一条:本尺的取证面是自造的(六把子尺 + 基线 + 键集),
  // 自检坏了不会有别的门替它发现(2026-11-05 实测它坏了 19/24 却连日无人发现)。
  // 现读复证:HEAD 版 --self-test 19/24 失败(坏例连实际 state 都不打印),而镜像用例此前只测纯函数,
  // 从不跑整趟自检 ⇒ "夹具落后于判据"这一型结构上无人守。这里把整趟自检与例数一起钉住:
  // 少一例(被删/被注释)⇒ 末行数字对不上即翻红;某一例坏 ⇒ rc=1 直接抛。
  const script = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'check-cross-end-parity-drift.mjs')
  let out = ''
  try {
    out = execFileSync(process.execPath, [script, '--self-test'], {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 1 << 24,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    const body = `${String(e.stdout ?? '')}${String(e.stderr ?? '')}`
    const last = body.trim().split('\n').filter(Boolean).slice(-3).join(' / ')
    assert.fail(`self-test 未整趟通过 ⇒ 跨端倒退看门狗的取证面是坏的:${last}`)
  }
  const m = /SELF-TEST PASS (\d+)\/(\d+)/.exec(out)
  assert.ok(m, `self-test 跑通了却没有 PASS 末行:${out.trim().split('\n').slice(-1)[0]}`)
  assert.equal(m[1], m[2], 'PASS 的分母与分子必须相等')
  assert.ok(
    Number(m[1]) >= 24,
    `自检例数从 24 掉到 ${m[1]} ⇒ 有用例被删/失效,这条锁必须拦住(要减例请连本锁一起改并写明理由)`,
  )
})

test('F1 并发跑尺:单把异常必须折成 ok:false,不许被 Promise.all 吞掉', async () => {
  // 立因(2026-11-07 302p 提速):六把尺从串行改成并发后,最容易静默退化的就是"某一把崩了,
  // 并发包装 resolve 成空结论" —— 整门会把缺面读成 ok。夹具在临时目录现造(不进仓库,
  // 免得为四支假尺增 trackedFiles / 新 lint 抑制),把五种出口一起钉住:
  // 正常 / 非零退出但 stdout 是 JSON(判红档结论照收)/ 非 JSON / 直接崩 / 尺子不在位。
  const dir = mkdtempSync(join(tmpdir(), 'drift-ruler-'))
  const mk = (name, body) => {
    const p = join(dir, name)
    writeFileSync(p, body)
    return p
  }
  try {
    const good = mk('good.mjs', "console.log(JSON.stringify({ fixture: 'good', value: 7 }))\n")
    const exit1 = mk(
      'exit1.mjs',
      "console.log(JSON.stringify({ fixture: 'exit1', value: 41 }))\nprocess.exitCode = 1\n",
    )
    const badJson = mk('bad-json.mjs', "console.log('this is not json')\n")
    const crash = mk('crash.mjs', "console.error('ruler exploded')\nprocess.exit(2)\n")
    const [rGood, rExit1, rBadJson, rCrash, rMissing] = await Promise.all([
      P.runRulerAsync(good),
      P.runRulerAsync(exit1),
      P.runRulerAsync(badJson),
      P.runRulerAsync(crash),
      P.runRulerAsync(join(dir, '__no_such_ruler__.mjs')),
    ])
    assert.equal(rGood.ok, true, '正常尺子必须 ok')
    assert.equal(rGood.json.value, 7)
    assert.equal(rExit1.ok, true, '非零退出但 stdout 是完整 JSON ⇒ 结论照收')
    assert.equal(rExit1.status, 1, '退出码必须如实带出')
    assert.equal(rExit1.json.value, 41)
    assert.equal(rBadJson.ok, false, '非 JSON 必须折成 ok:false')
    assert.equal(rCrash.ok, false, '崩溃必须折成 ok:false')
    assert.equal(rMissing.ok, false, '尺子不在位必须折成 ok:false')
    assert.match(rMissing.why, /尺子不在位/, '缺尺原因必须点名')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

;(async () => {
  let bad = 0
  for (const t of results) {
    try {
      const r = t.fn()
      if (r && typeof r.then === 'function') await r
      console.log(`✓ ${t.name}`)
    } catch (e) {
      bad++
      console.log(`✗ ${t.name}\n    ${String(e.message).split('\n')[0]}`)
    }
  }
  console.log(
    bad === 0
      ? `MIRROR PASS ${results.length}/${results.length}`
      : `MIRROR FAIL ${bad}/${results.length}`,
  )
  process.exit(bad === 0 ? 0 : 1)
})()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
