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
import { __test__ as P } from '../check-cross-end-parity-drift.mjs'

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
  prefixContradicted = [],
  staleCountAssertions = [],
  missingExpiry = [],
  duplicateWebKeys = 0,
  omit = [],
} = {}) => {
  const json = { rot: new Array(rot).fill({ line: 1 }), aligned, unmapped }
  if (!omit.includes('alignedUnique')) json.alignedUnique = alignedUnique
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

let bad = 0
for (const t of results) {
  try {
    t.fn()
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
