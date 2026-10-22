// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:判据一律 import 源脚本的 `__test__`,本文件零复算。
 *
 * 台账这种工具最容易的失效不是算错,而是**静默算少**(维度没进总数、消失的族被当成清零),
 * 那会让人安心地继续分叉 —— 所以每条臂都盯着"少算"这一侧。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as L } from '../cross-end-ui-parity-debt.mjs'

const { debtOf, langMismatch, buildRows, diffAgainst, uncoveredDimensions } = L
const HERE = dirname(fileURLToPath(import.meta.url))

const fam = (name, o = {}) => ({
  name,
  diffCount: o.geometry ?? 0,
  radiusCount: o.radiusFile ?? 0,
  elementRadiusCount: o.radiusElement ?? 0,
  radius: { onlyMiniapp: [], onlyRn: [] },
  elementRadius: { mismatched: [], onlyMiniapp: [], onlyRn: [], ambiguous: [] },
  lang: { miniapp: o.mini ?? 'className', rn: o.rn ?? 'className' },
})

describe('debtOf:四个维度都必须进总数', () => {
  it('T1 逐维相加,不漏维', () => {
    assert.equal(
      debtOf(fam('X', { geometry: 16, radiusFile: 3, mini: 'className', rn: 'stylesheet' })),
      20,
    )
  })

  it('T2 取用形态分叉单独也计 1(13 族里 10 族是 className vs stylesheet —— 这一维归零等于抹掉最大成因)', () => {
    assert.equal(debtOf(fam('X', { mini: 'className', rn: 'stylesheet' })), 1)
    assert.equal(debtOf(fam('X', { mini: 'className', rn: 'className' })), 0)
  })

  it('T3 形态读不出来 ⇒ 既不冒充分叉也不冒充相同(未判定不得记成任何一色)', () => {
    assert.equal(langMismatch({ lang: { miniapp: undefined, rn: 'stylesheet' } }), 0)
    assert.equal(langMismatch({}), 0)
  })
})

describe('buildRows:排序与投影', () => {
  it('T4 按欠债降序、同债按族名(读数必须可复现,不得随 Map 顺序漂)', () => {
    const rows = buildRows({
      findings: [fam('B', { geometry: 2 }), fam('A', { geometry: 9 }), fam('C', { geometry: 2 })],
    })
    assert.deepEqual(
      rows.map((r) => r.name),
      ['A', 'B', 'C'],
    )
  })

  it('T5 空 findings ⇒ 空表(不得读成"零欠债"的合格证)', () => {
    assert.deepEqual(buildRows({ findings: [] }), [])
    assert.deepEqual(buildRows({}), [])
  })
})

describe('diffAgainst:涨跌与"消失"分得开', () => {
  const snap = (list) => ({ recordedAt: 'x', families: list })

  it('T6 涨/降/持平各归各桶', () => {
    const d = diffAgainst(
      [
        { name: 'Up', debt: 5 },
        { name: 'Down', debt: 1 },
        { name: 'Same', debt: 2 },
      ],
      snap([
        { name: 'Up', debt: 2 },
        { name: 'Down', debt: 4 },
        { name: 'Same', debt: 2 },
      ]),
    )
    assert.deepEqual(
      d.up.map((x) => [x.name, x.delta]),
      [['Up', 3]],
    )
    assert.deepEqual(
      d.down.map((x) => [x.name, x.delta]),
      [['Down', -3]],
    )
    assert.deepEqual(
      d.same.map((x) => x.name),
      ['Same'],
    )
  })

  it('T7 快照里有、这次读不到 ⇒ 记 vanished,不当"清零"(配对没了不等于债还了)', () => {
    const d = diffAgainst([{ name: 'Still', debt: 1 }], snap([{ name: 'Gone', debt: 7 }]))
    assert.deepEqual(d.vanished, [{ name: 'Gone', was: 7 }])
    assert.ok(!d.down.some((x) => x.name === 'Gone'))
  })

  it('T8 新出现的配对算进"涨"(它带着全新欠债进来)', () => {
    const d = diffAgainst([{ name: 'New', debt: 6 }], snap([{ name: 'Old', debt: 1 }]))
    assert.deepEqual(d.up, [{ name: 'New', from: null, to: 6, delta: 6 }])
  })

  it('T9 没有基线 ⇒ 一律不判(基线为 null,调用方据此落"未判定")', () => {
    assert.equal(diffAgainst([{ name: 'A', debt: 3 }], null).baseline, null)
  })
})

describe('uncoveredDimensions:门加维必须喊出来', () => {
  it('T10 门多吐一个维度 ⇒ 点名,不得静默把 total 当全量', () => {
    const json = {
      findings: [
        { name: 'X', diffCount: 1, radiusCount: 0, elementRadiusCount: 0, lang: {}, brandNew: 3 },
      ],
    }
    assert.ok(uncoveredDimensions(json).includes('brandNew'))
  })

  it('T11 已知维度不误报(否则每行都喊,等于没人听)', () => {
    assert.deepEqual(uncoveredDimensions({ findings: [fam('X')] }), [])
  })
})

describe('在册快照与源脚本口径一致', () => {
  const snapshot = () =>
    JSON.parse(readFileSync(resolve(HERE, '../cross-end-ui-parity-debt.json'), 'utf8'))

  it('T12 快照声明的 dimensions 与源脚本 DIMENSIONS 同集(改维必须同批改档)', () => {
    const src = readFileSync(resolve(HERE, '../cross-end-ui-parity-debt.mjs'), 'utf8')
    const declared = /const DIMENSIONS = \[([\s\S]*?)\]/.exec(src)?.[1] ?? ''
    const keys = [...declared.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()
    assert.deepEqual([...snapshot().dimensions].sort(), keys)
  })

  it('T13 快照 total == 各族 debt 之和(自证,不靠写档那一步的口头保证)', () => {
    const s = snapshot()
    assert.equal(
      s.families.reduce((acc, f) => acc + f.debt, 0),
      s.total,
    )
  })
})
