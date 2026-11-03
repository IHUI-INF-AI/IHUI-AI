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

const { debtOf, langMismatch, buildRows, diffAgainst, uncoveredDimensions, waiverState } = L
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

describe('waiverState:已裁决 ≠ 待修,但"验过才免"且会到期(§0.7)', () => {
  const today = '2026-10-23'
  const w = (o) => ({ X: o })

  it('W1 有原因 + 未过期 ⇒ 已裁决,不得计进待修', () => {
    const s = waiverState('X', w({ reason: '一端多元素', until: '2027-03-27' }), today)
    assert.equal(s.waived, true)
    assert.equal(s.until, '2027-03-27')
  })

  it('W2 豁免到期 ⇒ 自动回到待修(不是"登记过就永远免")', () => {
    const s = waiverState('X', w({ reason: '一端多元素', until: '2026-10-22' }), today)
    assert.equal(s.waived, false)
    assert.equal(s.expired, true)
  })

  it('W3 没有终态的豁免不算豁免(无期限豁免是本仓记过最多次的死角)', () => {
    const s = waiverState('X', w({ reason: '一端多元素' }), today)
    assert.equal(s.waived, false)
    assert.equal(s.noExpiry, true)
  })

  it('W4 没登记、或登记了空原因 ⇒ 一律未裁决', () => {
    assert.equal(waiverState('X', {}, today).waived, false)
    assert.equal(waiverState('X', w({ reason: '   ', until: '2027-03-27' }), today).waived, false)
  })

  it('W5 buildRows 把豁免投影进每一行,待修/已裁决两个数分得开', () => {
    const json = {
      findings: [fam('Waived', { geometry: 9 }), fam('Open', { geometry: 4 })],
    }
    const waivers = {
      Waived: { reason: '机制差异', until: '2027-03-27' },
      Open: { reason: '机制差异', until: '2020-01-01' },
    }
    const rows = buildRows(json, waivers, today)
    const by = Object.fromEntries(rows.map((r) => [r.name, r]))
    assert.equal(by.Waived.waived, true)
    assert.equal(by.Open.waived, false)
    assert.equal(by.Open.waiverExpired, true)
    const total = rows.reduce((acc, r) => acc + r.debt, 0)
    const waivedTotal = rows.filter((r) => r.waived).reduce((acc, r) => acc + r.debt, 0)
    assert.equal(total, 13)
    assert.equal(total - waivedTotal, 4)
  })
})

describe('在册快照与源脚本口径一致', () => {  const snapshot = () =>
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

describe('「门判红」与「门跑不动」必须是两条口径(2026-10-25 立)', () => {
  const { parseGateOutput } = L
  const goodJson = JSON.stringify({ face: 'head', findings: [{ name: 'X', diffCount: 1 }] })

  it('T14 门 rc=1 且 stdout 完好 ⇒ 照常出账(旧形态在这里抛,台账因此恒瞎)', () => {
    const j = parseGateOutput(goodJson, 1)
    assert.equal(j.findings.length, 1)
  })

  it('T15 真·跑不动仍要落未判定:rc=0 但 stdout 空 ⇒ 抛', () => {
    assert.throws(() => parseGateOutput('', 0), /未判定/)
  })

  it('T16 rc 取不到(超时被杀/ENOENT)但 stdout 有 JSON ⇒ 仍出账(stdout 是唯一凭据)', () => {
    assert.equal(parseGateOutput(goodJson, null).face, 'head')
  })

  it('T17 阳性对照:垃圾输出带 rc=1 也照样抛,且消息点名 stdout 字节数(不许把坏读成红)', () => {
    assert.throws(() => parseGateOutput('boom without brace', 1), /stdout 18 字节/)
  })

  it('T18 接线形状锁:readGateJson 必须接住非零退出并把 e.stdout 交给 parseGateOutput', () => {
    const src = readFileSync(resolve(HERE, '../cross-end-ui-parity-debt.mjs'), 'utf8').replace(/\s+/g, ' ')
    const at = src.indexOf('function readGateJson()')
    assert.ok(at >= 0, 'readGateJson 不在了')
    // 取函数体那一段(邻接会被合法注释插断,所以按结构取段再判锚点成套,不拿"紧挨着"当凭据)
    const body = src.slice(at, at + 900)
    for (const anchor of ['catch (e)', 'e.stdout', 'parseGateOutput(out, rc)', 'gateRc = rc']) {
      assert.ok(body.includes(anchor), `readGateJson 里缺锚点 ${anchor} ⇒ 可能已改回裸 execFileSync(门一红台账就瞎)`)
    }
  })
})
