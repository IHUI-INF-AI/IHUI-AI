// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/plan-fields.mjs` 的镜像测试(§22c:判据一律 import 源脚本 `__test__`,
 * 本文件零复制校验逻辑 —— 复制一份迟早漂成"一边收记录、一边不收")。
 *
 * 四条各挡一种静默失效:值域外被猜成默认值、缺主键的孤儿记录、坏 JSON 被静默跳过、
 * 侧车取不到被读成"大家都没归属"。最后一条是 §0.3 在本件上的落点。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as F } from '../lib/plan-fields.mjs'
import { compositeKeyOf } from '../lib/plan-task-index.mjs'

const OK = {
  key: 'G-9#跨端头像尺寸唯一表',
  owner: 'union-converge 落地闸持有人',
  waiting: 'env',
  blocking: '容器运行时',
  next: '补三端接入',
  updatedAt: '2026-10-22T00:00:00.000Z',
  updatedBy: 'qoder-x',
}

describe('plan-fields 侧车层', () => {
  it('合法记录被收下并保留全部字段', () => {
    const r = F.normalizeRecord(OK)
    assert.equal(r.ok, true)
    assert.equal(r.rec.waiting, 'env')
    assert.equal(r.rec.next, '补三端接入')
  })

  it('waiting 值域外 ⇒ 拒收并点名原因(不猜默认值)', () => {
    const r = F.normalizeRecord({ ...OK, waiting: 'maybe' })
    assert.equal(r.ok, false)
    assert.match(r.why, /waiting/)
  })

  it('缺 key ⇒ 拒收(记录必须可寻址)', () => {
    const noKey = { ...OK }
    delete noKey.key
    assert.equal(F.normalizeRecord(noKey).ok, false)
  })

  it('缺 waiting ⇒ 拒收(不能默认成 none,那会把"没填"说成"不等任何东西")', () => {
    const noWaiting = { ...OK }
    delete noWaiting.waiting
    assert.equal(F.normalizeRecord(noWaiting).ok, false)
  })

  it('坏 JSON 行计数并跳过,整件不崩', () => {
    const { map, malformed } = F.loadFields(
      '/nonexistent-root',
      '{坏的\n' + JSON.stringify(OK) + '\n',
    )
    assert.equal(malformed, 1)
    assert.equal(map.size, 1)
  })

  it('同键两条 ⇒ 取 updatedAt 较新者,旧者计 orphan(不静默 last-wins)', () => {
    const txt = [
      JSON.stringify({ ...OK, updatedAt: '2026-01-01T00:00:00.000Z' }),
      JSON.stringify(OK),
    ].join('\n')
    const { map, orphans } = F.loadFields('/nonexistent-root', txt)
    assert.equal(map.size, 1)
    assert.equal(orphans.length, 1)
    assert.equal(map.get(OK.key).updatedAt, '2026-10-22T00:00:00.000Z')
  })

  it('台账侧车取不到 ⇒ undetermined(不得当成"字段都缺所以都 actionable")', () => {
    const r = F.loadFields('/nonexistent-root', null)
    assert.equal(r.undetermined, true)
    assert.match(r.why, /取不到/)
  })

  it('侧车文件在位但为空 ⇒ 两态之分:不是未判定,是"零条记录"', () => {
    const r = F.loadFields('/nonexistent-root', '')
    assert.equal(r.undetermined, false)
    assert.equal(r.map.size, 0)
  })

  it('查找键=复合主键:同一行必须真取回记录;无主键行走 rowhash 且不充当权威', () => {
    const line = '- [ ] G-9 跨端头像尺寸唯一表 —— 细节细节细节'
    const key = compositeKeyOf(line)
    assert.ok(key && key.startsWith('G-9#'), `复合主键形态不对:${key}`)
    const { map } = F.loadFields('/nonexistent-root', JSON.stringify({ ...OK, key }))
    const hit = F.fieldsFor({ line, map })
    assert.equal(hit.keyKind, 'id')
    assert.equal(hit.key, key)
    assert.equal(hit.rec?.owner, OK.owner) // 真取回记录,而不是只对上键型
    const miss = F.fieldsFor({ line: '- [ ] 没有编号也没有题面锚的一行', map })
    assert.equal(miss.keyKind, 'rowhash')
    assert.equal(miss.rec, null)
  })

  it('evidence 不是字符串数组 ⇒ 拒收(它是将来跑判据的凭据面,坏了不能留)', () => {
    assert.equal(F.normalizeRecord({ ...OK, evidence: 'node x.mjs --run' }).ok, false)
    assert.equal(F.normalizeRecord({ ...OK, evidence: [123] }).ok, false)
    assert.equal(F.normalizeRecord({ ...OK, evidence: ['node x.mjs --run'] }).ok, true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
