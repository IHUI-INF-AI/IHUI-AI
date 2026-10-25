#!/usr/bin/env node
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
const mkWeb = ({ rot = 0, aligned = 150, unmapped = 270 } = {}) => ({
  ok: true,
  json: { rot: new Array(rot).fill({ line: 1 }), aligned, unmapped },
})

test('C1 持平无腐烂 ⇒ ok(正控:尺子不是恒拒)', () => {
  const j = P.judge({ coverage: mkCov(), webParity: mkWeb(), doc: '- 已被小程序显式镜像: **91**', prev: { mirrored: 91 } })
  assert.equal(j.state, 'ok')
  assert.deepEqual(j.reasons, [])
})

test('C2 镜像净减 ⇒ regressed/mirrored-decrease', () => {
  const j = P.judge({ coverage: mkCov({ mirrored: 89 }), webParity: mkWeb(), doc: '', prev: { mirrored: 91 } })
  assert.equal(j.state, 'regressed')
  assert.ok(j.reasons.some((r) => r.dim === 'mirrored-decrease'))
})

test('C3 镜像在涨但门判红 ⇒ 仍 regressed(涨不得顶掉红)', () => {
  const j = P.judge({ coverage: mkCov({ mirrored: 130, reds: 2 }), webParity: mkWeb(), doc: '', prev: { mirrored: 91 } })
  assert.equal(j.state, 'regressed')
  assert.ok(j.reasons.some((r) => r.dim === 'registry-rot'))
  assert.equal(j.reasons.some((r) => r.dim === 'mirrored-decrease'), false)
})

test('C4 子对账器跑不动 ⇒ undetermined,绝不记绿', () => {
  const j = P.judge({ coverage: { ok: false, why: 'boom' }, webParity: mkWeb(), doc: '', prev: { mirrored: 91 } })
  assert.equal(j.state, 'undetermined')
  assert.ok(j.missing.includes('coverage'))
  assert.equal(j.reasons.length, 0)
})

test('C5 字段名漂移(上游改了汇总行形状)⇒ undetermined 而非 ok', () => {
  const broken = { ok: true, json: { stats: { someOtherName: 1 }, red: [] } }
  const j = P.judge({ coverage: broken, webParity: mkWeb(), doc: '', prev: null })
  assert.equal(j.state, 'undetermined')
  assert.ok(j.missing.length > 0)
})

test('C6 无上一轮快照 ⇒ 不比涨跌(缺 prev 不得判成倒退)', () => {
  const j = P.judge({ coverage: mkCov({ mirrored: 10 }), webParity: mkWeb(), doc: '', prev: null })
  assert.equal(j.state, 'ok')
  assert.equal(j.prev, null)
})

test('C7 文档自述数≠现读 ⇒ doc-stale 且给出可执行重跑命令', () => {
  const j = P.judge({ coverage: mkCov({ mirrored: 91 }), webParity: mkWeb(), doc: '- 已被小程序显式镜像: **79**', prev: { mirrored: 91 } })
  const d = j.reasons.find((r) => r.dim === 'doc-stale')
  assert.ok(d, '应点名 doc-stale')
  assert.match(d.detail, /report-rn-miniapp-gaps\.mjs --write/)
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
  assert.equal(n.sharedTotal, n.mirrored + n.gaps, '共享屏 = 已镜像 + 缺口 这条恒等式在真文档上必须成立')
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
console.log(bad === 0 ? `MIRROR PASS ${results.length}/${results.length}` : `MIRROR FAIL ${bad}/${results.length}`)
process.exit(bad === 0 ? 0 : 1)
