// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  judgeContentLoss,
  formatLossReport,
  dropCreditOf,
  lineMultiset,
} from '../lib/content-loss-gate.mjs'
import { declaredDropCaps } from '../lib/union-converge-judgments.mjs'

/**
 * 内容级防丢闸 · **摘除台账**这一格(2026-11-06,续办在册票 G-32「归并侧那半格」的另一半)。
 *
 * 立因:防丢闸(2026-11-05 独立一笔)只认折叠台账,不认「本机已声明摘除」那本账,于是把活文档
 * union 侧的 `declaredDropCaps`(刻意不回捞已声明摘除的行)读成"少带内容"⇒ 两道尺结论相反、
 * 合并恒拒(实测:整份取对侧判「本侧缺失 3」,行级 union 判「对侧缺失 15」,两头都堵)。
 *
 * 成对纪律(§0.2):每一档"放过"都必须配一档"不放过",否则这层就成了掩体——
 * 真丢失的牙(台账没这一行 / 产物面还留着 / 不是登记行形 / 台账根本没喂)必须一处不松。
 */

const DOC = 'PROJECT_PLAN.md'
const KEEP = '- [ ] G-9001 **甲事**:留在产物面的那行'
const LOST = '- [ ] G-9002 **乙事**:被本机摘除台账声明正当摘走的那行'
const CLOSED = '- [x] G-9003 **丙事**:已结清并按 §1 完成即删摘除的那行'
const PLAIN = '本行不是登记行形(没有复选框前缀)'

const OURS = ['头', KEEP].join('\n')
const THEIRS = ['头', KEEP, LOST, CLOSED, PLAIN].join('\n')
// 产物面留着 PLAIN:它既不是"少带行"也不是销账对象,把它留在场上才能证明销账只作用于登记行
const MERGED = ['头', KEEP, PLAIN].join('\n')

const read = (rev) => ({ ours: OURS, theirs: THEIRS, merged: MERGED }[rev])

const run = (declaredRemovals) =>
  judgeContentLoss({
    root: '(内存夹具,不碰盘)',
    ours: 'ours',
    theirs: 'theirs',
    merged: 'merged',
    paths: [DOC],
    liveDocs: [DOC],
    read,
    declaredRemovals,
  })

const ledgerOf = (...rows) => new Set(rows)

describe('内容级防丢闸 · 摘除台账销账', () => {
  it('① 正例:对侧行被本机台账逐字声明摘除 ⇒ 不判红,且逐条报名', () => {
    const r = run(ledgerOf(LOST, CLOSED))
    assert.equal(r.ok, true, `应放行,实得:${formatLossReport(r)}`)
    const lines = r.dropped.filter((e) => e.path === DOC)
    assert.equal(lines.length, 2, '两行都该被销账并报名')
    assert.ok(r.dropped.every((e) => e.side === '对侧'), '这两行来自对侧')
    assert.ok(!r.violations.some((v) => v.path === DOC), 'violations 里不该再留这一路径')
    const rep = formatLossReport(r)
    assert.match(rep, /摘除.*销账/, '报告必须点名摘除销账这一档(不许静默折进 0 丢失)')
    assert.match(rep, /G-9002/, '被销账的行要逐条看得见')
  })

  it('② 反向牙:同一行而台账没有它 ⇒ 照旧判红(真丢失的牙不松)', () => {
    const r = run(ledgerOf('（台账里只有别的行）无关内容'))
    assert.equal(r.ok, false)
    const v = r.violations.find((x) => x.path === DOC)
    assert.ok(v && v.missingTheirs.includes(LOST), `缺失清单要点名 LOST,实得:${JSON.stringify(v)}`)
  })

  it('③ 反向牙:产物面还留着该行 ⇒ declaredDropCaps 条件②不扣,照旧判红(还留着=处置权未行使)', () => {
    const dup = ['头', KEEP, LOST].join('\n')
    const ours2 = ['头', KEEP, LOST, LOST].join('\n') // 本侧 2 份,产物面 1 份 ⇒ 少带 1 份
    const r = judgeContentLoss({
      root: '(内存夹具)',
      ours: 'ours',
      theirs: 'theirs',
      merged: 'merged',
      paths: [DOC],
      liveDocs: [DOC],
      read: (rev) => (rev === 'ours' ? ours2 : rev === 'theirs' ? dup : dup),
      declaredRemovals: ledgerOf(LOST),
    })
    assert.equal(r.ok, false, `产物面留着 LOST 时不该销账:${formatLossReport(r)}`)
    const caps = declaredDropCaps(dup, ledgerOf(LOST))
    assert.equal(caps.has(LOST), false, '这把尺自己也要判:面上还留着 ⇒ 不入册')
  })

  it('④ 反向牙:非登记行形(无复选框)即便逐字命中台账也不销', () => {
    const mergedNoPlain = ['头', KEEP, LOST, CLOSED].join('\n')
    const r = judgeContentLoss({
      root: '(内存夹具)',
      ours: 'ours',
      theirs: 'theirs',
      merged: 'merged',
      paths: [DOC],
      liveDocs: [DOC],
      read: (rev) => (rev === 'merged' ? mergedNoPlain : read(rev)),
      declaredRemovals: ledgerOf(PLAIN),
    })
    assert.equal(r.ok, false)
    const v = r.violations.find((x) => x.path === DOC)
    assert.ok(v.missingTheirs.includes(PLAIN), `普通文本行不得被当成合法摘除:${JSON.stringify(v)}`)
  })

  it('⑤ 台账没喂进来(null)⇒ 行为与初版逐字一致(旧调用方一条都不放松)', () => {
    const r = run(null)
    assert.equal(r.ok, false)
    assert.equal(r.dropped.length, 0)
    const v = r.violations.find((x) => x.path === DOC)
    assert.deepEqual(
      [...v.missingTheirs].sort(),
      [CLOSED, LOST].sort(),
      '未喂台账时这两行都该照旧判红(PLAIN 在场,不参与少带清单)',
    )
  })

  it('⑥ 本侧对称:本侧行被台账声明摘除同样销账(两把尺同形,不偏一侧)', () => {
    const oursL = ['头', KEEP, LOST].join('\n')
    const r = judgeContentLoss({
      root: '(内存夹具)',
      ours: 'ours',
      theirs: 'theirs',
      merged: 'merged',
      paths: [DOC],
      liveDocs: [DOC],
      read: (rev) => (rev === 'ours' ? oursL : read(rev)),
      declaredRemovals: ledgerOf(LOST, CLOSED),
    })
    assert.equal(r.ok, true, `本侧也该销账:${formatLossReport(r)}`)
    assert.ok(
      r.dropped.some((e) => e.side === '本侧' && e.line === LOST),
      '要能看见"本侧少带"这一笔',
    )
  })

  it('⑦ dropCreditOf 单元:全额销 deficit、空账不销、非 Set 不销', () => {
    const caps = declaredDropCaps(MERGED, ledgerOf(LOST))
    assert.equal(caps.has(LOST), true, '夹具前提:这把尺在产物面确实认它入册')
    assert.deepEqual(dropCreditOf(LOST, 3, caps), { status: 'declared', credit: 3 })
    assert.equal(dropCreditOf(KEEP, 1, caps).status, 'none', '留在产物面的行不该被销')
    assert.equal(dropCreditOf(LOST, 1, new Set()).status, 'none', '空集 ⇒ 一分不销')
    assert.equal(dropCreditOf(LOST, 1, null).status, 'none', 'null ⇒ 一分不销')
  })

  it('⑧ 形状锁:销账不改清单算法本身(行级包含仍是底线,只是在其上扣额度)', () => {
    // 同一份夹具:不喂台账时的"缺行清单"必须与喂台账时的"violations 清单 + dropped 清单"逐字对齐
    const bare = run(null)
    const lit = run(ledgerOf(LOST, CLOSED))
    const bareList = bare.violations.flatMap((v) => v.missingTheirs).sort()
    const litList = [...lit.violations.flatMap((v) => v.missingTheirs), ...lit.dropped.map((e) => e.line)].sort()
    assert.deepEqual(litList, bareList, '销账只能改变"判不判红",不能改变"少了哪些行"')
    assert.ok(lineMultiset(MERGED).get(KEEP) === 1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
