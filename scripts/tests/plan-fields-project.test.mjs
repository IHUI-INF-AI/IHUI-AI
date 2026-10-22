// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `plan-fields-project.mjs` 镜像测试(§22c)—— 判据全从生产出口 import,本文件零复算。
 *
 * 承重的是"什么情况下**不许**改行":信息不被侧车覆盖 / 顶破 400 字档 / 三维守恒任一违规 /
 * 记录里没有可渲染的信息。失效方向永远是"少改一行",绝不是"先收下再说"。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { __test__ as P } from '../plan-fields-project.mjs'
import { compositeKeyOf, dispositionOf } from '../lib/plan-task-index.mjs'
import { renderHeader } from '../lib/plan-field-line.mjs'

const rec = (over = {}) => ({
  key: 'K#1',
  owner: '门 130 持有人',
  waiting: 'none',
  updatedAt: '2026-10-22T00:00:00.000Z',
  updatedBy: 't',
  ...over,
})

describe('投影规划:只做加法(实测删散文句会挪复合主键)', () => {
  it('加标头:正文逐字留在新行里,一个字符都不删', () => {
    const line = '- [ ] **G-1 甲题** 细节一:归属:门 130 持有人,细节二'
    const r = rec({ key: compositeKeyOf(line) })
    const p = P.planRow(line, r)
    assert.equal(p.action, 'rewrite')
    assert.ok(p.line.includes(renderHeader(r)), '标头必须在位(门 234 A2 逐字对账的对象)')
    assert.ok(
      p.line.includes('细节一:归属:门 130 持有人,细节二'),
      '原正文必须逐字留着 —— 删散文句要先让 compositeKeyOf 认标头为装饰,那是另一件事',
    )
  })

  it('散文说的持有人与记录不一致 ⇒ 不动(侧车没覆盖的信息不许删)', () => {
    const line = '- [ ] **G-2 乙题** 归属:另一个组持有,细节'
    const p = P.planRow(line, rec({ key: compositeKeyOf(line) }))
    assert.equal(p.action, 'skip')
    assert.match(p.reason, /覆盖|不等价/)
  })

  it('记录里没有可渲染的信息(owner 与 blocking 都空)⇒ 不造空标头', () => {
    const line = '- [ ] **G-3 丙题** 需真机复跑'
    const p = P.planRow(line, rec({ key: compositeKeyOf(line), owner: '', blocking: '' }))
    assert.equal(p.action, 'skip')
    assert.match(p.reason, /没有可渲染/)
  })

  it('超预算 ⇒ 点名长度并跳过(差值棘轮会把"被我顶过档"算成新增违规)', () => {
    const long = '- [ ] **G-4 丁题** ' + '细'.repeat(397) + ' 归属:门 130 持有人'
    assert.ok(long.length > 400, `夹具本身要过档,实得 ${long.length}`)
    const p = P.planRow(long, rec({ key: compositeKeyOf(long) }), { maxLen: 400 })
    assert.equal(p.action, 'skip')
    assert.match(p.reason, /预算/)
  })

  it('标头已在位且与记录一致 ⇒ already(幂等,重跑不再改这一行)', () => {
    const r = rec({ key: compositeKeyOf('- [ ] **G-5 戊题** 细节') })
    const line = `- [ ] ${renderHeader(r)} **G-5 戊题** 细节`
    assert.equal(P.planRow(line, r).action, 'already')
  })

  it('waiting 记录带 blocking ⇒ 标头写出等什么,散文原话不动', () => {
    const line = '- [ ] **G-6 己题** 在等什么:dev 栈依赖被拉回'
    const r = rec({
      key: compositeKeyOf(line),
      owner: '',
      waiting: 'env',
      blocking: 'dev 栈依赖被拉回',
    })
    const p = P.planRow(line, r)
    assert.equal(p.action, 'rewrite')
    assert.ok(p.line.includes('在等什么:dev 栈依赖被拉回'), '散文原话必须原样留着')
  })
})

describe('投影规划:判定面一根头发都不许动', () => {
  it('rewrite 前后:主键/复合主键/租约/归属桶四维逐字等值', () => {
    const line = '- [ ] （进行中@2026-10-22/holder-x） **G-7 庚题** 归属:门 130 持有人,细节'
    const r = rec({ key: compositeKeyOf(line) })
    const p = P.planRow(line, r)
    if (p.action !== 'rewrite')
      throw new Error(`带租约的行也应可投影,实得 ${p.action}:${p.reason ?? ''}`)
    const a = P.dimsOf(line)
    const b = P.dimsOf(p.line)
    assert.equal(b.key, a.key, 'keyOfRow 变了 ⇒ 门 203/归并/守恒全认不出这一行')
    assert.equal(b.composite, a.composite, '复合主键变了 ⇒ 同题查重与 F4 归全会把它当新事项')
    assert.equal(b.claim, a.claim, '租约三要素必须原样(代别人摘牌 = §1 禁令)')
    assert.equal(p.dims.conserved, true, '守恒器物必须亲自说通过')
  })
  it('侧车权威前后桶不变(桶维等值由守恒器物判,这里不复算)', () => {
    const line = '- [ ] **G-8 辛题** 归属:门 130 持有人,细节'
    const r = rec({ key: compositeKeyOf(line) })
    const p = P.planRow(line, r)
    assert.equal(p.action, 'rewrite')
    assert.equal(p.dims.bucketOldFields, p.dims.bucketNewFields, '侧车权威前后必须同桶')
  })

  it('形状锁:规划器必须问守恒器物,不得自己判桶', () => {
    const src = readFileSync(new URL('../plan-fields-project.mjs', import.meta.url), 'utf8')
    assert.match(src, /assertRowRewriteConservation/, '整行改写必须先过三维守恒器物')
    assert.match(src, /renderHeader/, '标头只能由投影层渲染')
    assert.ok(!/归属\[:：\]\|本票不认领/.test(src), '不得出现第二份归属词表')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
