// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/plan-row-conservation.mjs` 的镜像测试(§22c:判据一律 import,零复算)。
 *
 * 立因是 2026-10-22 的实测事故:把 161 枚超长行压到 ≤400 字时切掉了行内"归属:…"句子,
 * 派单口径 48→100(52 枚他人持有的票变成可领),而门 71/109/130/203/229/234 当时**全绿**。
 * 所以"改写整行"这件事必须有器物守门,不能只写在 AGENTS 里当规矩。
 *
 * 五类各挡一种静默失真:归属会漂 / 主键漂(门 71 会按缺失回捞) / 租约被切(=本器代摘)
 * / 旧行不是登记行(拿"没什么可守恒"蒙过) / 合法缩短正文必须放行(否则尺子过牙,谁都用不了)。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as C } from '../lib/plan-row-conservation.mjs'

const WITH_OWN = '- [ ] G-7 标题 —— 归属:门 130 持有人,等容器运行时,细节细节细节细节细节'
const SHORT = '- [ ] G-7 标题 —— 细节细节细节'
const REC = { key: 'G-7#标题', owner: '门 130 持有人', waiting: 'env', blocking: '容器运行时' }

describe('登记行改写三维守恒', () => {
  it('散文里没了归属句、但侧车接住了 ⇒ 放行', () => {
    assert.deepEqual(
      C.assertRowRewriteConservation({
        oldLine: WITH_OWN,
        newLine: SHORT,
        oldRec: null,
        newRec: REC,
      }),
      [],
    )
  })

  it('散文里没了归属句、侧车也没接 ⇒ 判「归属判定会漂」并拒', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: WITH_OWN,
      newLine: SHORT,
      oldRec: null,
      newRec: null,
    })
    assert.ok(
      v.some((x) => /归属/.test(x)),
      JSON.stringify(v),
    )
  })

  it('主键漂了 ⇒ 拒(改号与删行同型,门 71 会按缺失回捞)', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: '- [ ] G-7 标题 —— 归属:门 130 持有人',
      newLine: '- [ ] G-8 标题 —— 归属:门 130 持有人',
      oldRec: REC,
      newRec: REC,
    })
    assert.ok(
      v.some((x) => /主键/.test(x)),
      JSON.stringify(v),
    )
  })

  it('把别人的租约切掉 ⇒ 拒(那等于本器代摘他人认领)', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: '- [ ]（进行中@2026-10-21/甲） G-9 标题 —— 长正文长正文',
      newLine: '- [ ] G-9 标题 —— 短正文',
      oldRec: null,
      newRec: null,
    })
    assert.ok(
      v.some((x) => /租约/.test(x)),
      JSON.stringify(v),
    )
  })

  it('新行加上了牌也不算守恒通过(形态变化就是变化,得让人看见)', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: '- [ ] G-10 标题 —— 正文',
      newLine: '- [ ]（进行中@2026-10-22/乙） G-10 标题 —— 正文',
      oldRec: null,
      newRec: null,
    })
    assert.ok(
      v.some((x) => /租约/.test(x)),
      JSON.stringify(v),
    )
  })

  it('旧行不是登记行 ⇒ 判未判定并拒(不许拿"没什么可守恒"蒙过)', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: '散文一',
      newLine: '散文二',
      oldRec: null,
      newRec: null,
    })
    assert.ok(
      v.some((x) => /未判定|非登记行/.test(x)),
      JSON.stringify(v),
    )
  })

  it('新行不是未勾登记行 ⇒ 拒并指路(那属于翻勾/删行,不归本断言管)', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: '- [ ] G-11 标题',
      newLine: '- [x] ✅(2026-10-22) G-11 标题',
      oldRec: null,
      newRec: null,
    })
    assert.ok(
      v.some((x) => /翻勾|删行/.test(x)),
      JSON.stringify(v),
    )
  })

  it('两侧都有侧车且值一致 ⇒ 放行(哪怕散文完全不同)', () => {
    assert.deepEqual(
      C.assertRowRewriteConservation({
        oldLine: '- [ ] G-12 甲 —— 很长的取证流水' + '字'.repeat(300),
        newLine: '- [ ] G-12 甲 —— 一句现状',
        oldRec: { key: 'G-12#甲', owner: '丙', waiting: 'none' },
        newRec: { key: 'G-12#甲', owner: '丙', waiting: 'none' },
      }),
      [],
    )
  })

  it('侧车把桶改了(迁移期不允许顺手改判) ⇒ 拒', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: '- [ ] G-13 甲 —— 归属:丙',
      newLine: '- [ ] G-13 甲 —— 一句现状',
      oldRec: null,
      newRec: { key: 'G-13#甲', owner: '', waiting: 'none' },
    })
    assert.ok(
      v.some((x) => /归属/.test(x)),
      JSON.stringify(v),
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
