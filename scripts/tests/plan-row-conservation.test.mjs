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
 *
 * 2026-10-23 补「挂牌放行档」的双向锁(承「台账挂牌没有合法通道」票):放行只认
 * 「旧行本来没牌 ∧ 新牌是完整租约(日期不晚于今天) ∧ 剥掉那枚牌后与旧行逐字节相等」这一条窄缝,所以必须
 * **成对**钉 —— 加牌放行(结构位与行尾两种净差同形)对 摘约/换持有者/只改日期/裸牌/半牌/
 * 非法日期/未来日期/加牌顺带改正文/加牌多打空格 全拒,且每条拒都要点名是①②③哪一条不满足
 * (§0.10:失效方向恒为"多要一次定向说明");另钉 §0.3 那一格:牌的位置量不出来 ⇒ 未判定不放行。
 * 2026-10-26 本票续席补条件②的最后一格:`@2099-01-01` 这类**未来日期**的"完整租约"是日历合法日,
 * `parseLeaseForm` 那一把尺拦不住它,而它会把守门 109 CL1 的 72h 超龄兜底永远推到够不着
 * (免死牌)⇒ 单独成 `add-future` 档;成对正控 = 按 `todayIso()` 现算的当天日期必须放行
 * (证明这条是"不晚于今天"的边界,不是一刀切拒掉挂牌动作本身)。
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

  it('把别人的租约切掉 ⇒ 拒(那等于本器代摘他人认领,条件①)', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: '- [ ]（进行中@2026-10-21/甲） G-9 标题 —— 长正文长正文',
      newLine: '- [ ] G-9 标题 —— 短正文',
      oldRec: null,
      newRec: null,
    })
    assert.ok(
      v.some((x) => /租约被切掉/.test(x) && /条件①/.test(x)),
      JSON.stringify(v),
    )
  })

  it('无牌 → 完整租约(日期+持有者)⇒ 放行(AGENTS §1 认领动作)', () => {
    assert.deepEqual(
      C.assertRowRewriteConservation({
        oldLine: '- [ ] G-10 标题 —— 正文',
        newLine: '- [ ]（进行中@2026-10-22/乙） G-10 标题 —— 正文',
        oldRec: null,
        newRec: null,
      }),
      [],
    )
  })

  it('行尾挂完整租约(非结构位)、唯一差异是那枚牌 ⇒ 同样放行', () => {
    assert.deepEqual(
      C.assertRowRewriteConservation({
        oldLine: '- [ ] G-10 标题 —— 现状',
        newLine: '- [ ] G-10 标题 —— 现状（进行中@2026-10-23/乙）',
        oldRec: null,
        newRec: null,
      }),
      [],
    )
  })

  it('加牌同时动了正文 ⇒ 仍拒(条件③:唯一差异必须只是插入这枚牌)', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: '- [ ] G-20 标题 —— 正文',
      newLine: '- [ ]（进行中@2026-10-23/乙） G-20 标题 —— 正文又加了五个字',
      oldRec: null,
      newRec: null,
    })
    assert.ok(
      v.some((x) => /条件③/.test(x)),
      JSON.stringify(v),
    )
    assert.ok(
      v.some((x) => /剥掉那枚牌后与旧行第 \d+ 个字起不再逐字节相等/.test(x)),
      `拒绝必须给出行内分歧位置(§0.10 要"定向说明"),实际:${JSON.stringify(v)}`,
    )
  })

  it('牌写在复选框后或紧跟一个空格 ⇒ 两种净差都只有那枚牌,都放行(不猜列位,只比逐字节)', () => {
    for (const newLine of [
      '- [ ]（进行中@2026-10-23/乙） G-20 标题 —— 正文',
      '- [ ] （进行中@2026-10-23/乙）G-20 标题 —— 正文',
    ]) {
      assert.deepEqual(
        C.assertRowRewriteConservation({
          oldLine: '- [ ] G-20 标题 —— 正文',
          newLine,
          oldRec: null,
          newRec: null,
        }),
        [],
        `${newLine} ⇒ 剥掉那枚牌后与旧行逐字节相等,必须放行`,
      )
    }
  })

  it('加牌时多打一个空格 ⇒ 仍拒并点名条件③(放行档逐字节,不做空格启发式)', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: '- [ ] G-20 标题 —— 正文',
      newLine: '- [ ]（进行中@2026-10-23/乙）  G-20 标题 —— 正文',
      oldRec: null,
      newRec: null,
    })
    assert.ok(
      v.some((x) => /条件③/.test(x)),
      JSON.stringify(v),
    )
    assert.ok(
      v.some((x) => /分两次定向改写/.test(x)),
      `出路必须写成"下一步怎么做"(§0.10),实际:${JSON.stringify(v)}`,
    )
  })

  it('加牌同时把「归属:…」判据句删了 ⇒ 拒(条件④:归属桶维不随加牌放行)', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: '- [ ] G-23 标题 —— 归属:web 线',
      newLine: '- [ ]（进行中@2026-10-23/乙） G-23 标题 —— 正文',
      oldRec: null,
      newRec: null,
    })
    assert.ok(
      v.some((x) => /归属判定会漂/.test(x)),
      JSON.stringify(v),
    )
    assert.ok(
      v.some((x) => /条件③/.test(x)),
      `除了归属漂,还必须点名"顺带改了别的东西",实际:${JSON.stringify(v)}`,
    )
  })

  it('牌的位置量不出来 ⇒ 判未判定并拒(§0.3:取不到输入既不冒绿也不放行)', () => {
    const d = C.addedMarkIsIsolated('- [ ] G-1 正文', '- [ ]（进行中@2026-10-23/乙） G-1 正文', {})
    assert.equal(d.ok, false)
    assert.match(d.why, /未判定/)
  })

  it('无牌 → 裸牌/半牌 ⇒ 仍拒(只有"完整租约"这一档放行,条件②)', () => {
    for (const mark of ['（进行中）', '（进行中@2026-10-22）', '（进行中@2026-10-22/）']) {
      const v = C.assertRowRewriteConservation({
        oldLine: '- [ ] G-10 标题 —— 正文',
        newLine: `- [ ]${mark} G-10 标题 —— 正文`,
        oldRec: null,
        newRec: null,
      })
      assert.ok(
        v.some((x) => /租约/.test(x)),
        `${mark} ⇒ ${JSON.stringify(v)}`,
      )
      assert.ok(
        v.some((x) => /条件②/.test(x)),
        `${mark} ⇒ 拒绝必须点名"加的不是完整租约"这一条,实际:${JSON.stringify(v)}`,
      )
    }
  })

  it('换持有者 ⇒ 仍拒(条件①:旧行本来没牌这一条不成立)', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: '- [ ]（进行中@2026-10-21/甲） G-10 标题 —— 正文',
      newLine: '- [ ]（进行中@2026-10-21/乙） G-10 标题 —— 正文',
      oldRec: null,
      newRec: null,
    })
    assert.ok(
      v.some((x) => /租约形态变化/.test(x) && /条件①/.test(x)),
      JSON.stringify(v),
    )
  })

  it('只改牌上的日期 ⇒ 仍拒(续租不是本器该做的事,条件①)', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: '- [ ]（进行中@2026-10-21/甲） G-10 标题 —— 正文',
      newLine: '- [ ]（进行中@2026-10-23/甲） G-10 标题 —— 正文',
      oldRec: null,
      newRec: null,
    })
    assert.ok(
      v.some((x) => /租约形态变化/.test(x) && /条件①/.test(x)),
      JSON.stringify(v),
    )
  })

  it('非法日期的"完整租约" ⇒ 仍拒(条件②走 claimMarkOf 现读判据,本层不放宽)', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: '- [ ] G-10 标题 —— 正文',
      newLine: '- [ ]（进行中@2026-02-31/乙） G-10 标题 —— 正文',
      oldRec: null,
      newRec: null,
    })
    assert.ok(v.length > 0, `2026-02-31 不是日历日,不该被当完整租约放行,实际:${JSON.stringify(v)}`)
  })

  it('未来日期的完整租约 ⇒ 仍拒并点名条件②(日期不晚于今天;未来牌=免死牌,72h 超龄兜底永远够不着)', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: '- [ ] G-10 标题 —— 正文',
      newLine: '- [ ]（进行中@2099-01-01/乙） G-10 标题 —— 正文',
      oldRec: null,
      newRec: null,
    })
    assert.equal(v.length, 1, `只该有"未来日期"这一条违规,实际:${JSON.stringify(v)}`)
    assert.match(v[0], /在未来/, '拒绝必须点名"日期在未来"这一维')
    assert.match(v[0], /条件②/, '拒绝必须说是哪一条条件不满足(§0.10)')
    assert.match(v[0], /出路/, '拒绝必须给下一步怎么做(§0.10:多要一次定向说明)')
  })

  it('当天日期挂完整租约 ⇒ 放行(正控:条件②是"不晚于今天"的边界,不是一刀切拒掉挂牌)', () => {
    // today 一律借源层同一把尺现算(§22c:测试不自拼日期口径;摘掉 add-future 档不会让本例变红,
    // 摘掉 add-complete 放行档会让上面「无牌 → 完整租约」与本例一起翻红 —— 双向锁成对在此)。
    const t = C.todayIso()
    assert.deepEqual(
      C.assertRowRewriteConservation({
        oldLine: '- [ ] G-10 标题 —— 正文',
        newLine: `- [ ]（进行中@${t}/乙） G-10 标题 —— 正文`,
        oldRec: null,
        newRec: null,
      }),
      [],
      `${t} 是今天,必须走 add-complete 放行档`,
    )
  })

  it('leaseTransitionOf 七档:same / add-complete / add-attached / add-incomplete / add-future / removed / changed', () => {
    assert.equal(C.leaseTransitionOf('- [ ] G-1 正文', '- [ ] G-1 正文'), 'same')
    assert.equal(
      C.leaseTransitionOf('- [ ] G-1 正文', '- [ ]（进行中@2026-10-23/b） G-1 正文'),
      'add-complete',
    )
    assert.equal(
      C.leaseTransitionOf('- [ ] G-1 正文', '- [ ]（进行中@2026-10-23/b） G-1 正文改了字'),
      'add-attached',
    )
    assert.equal(
      C.leaseTransitionOf('- [ ] G-1 正文', '- [ ]（进行中） G-1 正文'),
      'add-incomplete',
    )
    assert.equal(
      C.leaseTransitionOf('- [ ]（进行中@2026-10-23/b） G-1 正文', '- [ ] G-1 正文'),
      'removed',
    )
    assert.equal(
      C.leaseTransitionOf(
        '- [ ]（进行中@2026-10-23/b） G-1 正文',
        '- [ ]（进行中@2026-10-23/c） G-1 正文',
      ),
      'changed',
    )
  })

  it('换牌/改持有者/改日期 ⇒ 仍拒(会改派单面归属)', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: '- [ ]（进行中@2026-10-21/甲） G-10 标题 —— 正文',
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
