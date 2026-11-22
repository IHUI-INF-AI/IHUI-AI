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
      C.leaseTransitionOf('- [ ] G-1 正文', '- [ ]（进行中@2099-01-01/b） G-1 正文'),
      'add-future',
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

// ---------------------------------------------------------------------------
// 窄「补号档」双向锁(2026-10-30 立,承票 RP-1:g34-s7 一手复现)
//
// 立因(复现读数,不是推断):RP-1 要求把 6 枚「未取号」登记行迁进 RP 族(两字母族+个位号)。
// `live-doc-edit` 整行改写的「同题让号放行」臂按 `extractTaskFingerprint` 比对,其剥编号的
// 两处族字面量 `/[A-Z]-?\d+/g` 与 `/[a-z]{1,3}-?\d{2,}/g` 都不认 `RP-7`(前者只接单字母、
// 后者要求 ≥2 位数字)⇒ 补号后指纹凭空多出 `rp7` 前缀,实测两侧
// fp=`冷启动腿整族迁入新字母族` vs `rp7冷启动腿整族迁入新字母族` ⇒ 让号臂恒不触发
// ⇒ 整行只剩「主键漂了:(无) → RP-7」一条拒写,RP-1 的出路在器物层结构性不可达。
// 补号档把放行收在判据核这一格(改指纹定义会波及 9 枚镜像与所有按指纹判同题的门),
// 三条件与挂牌档 `addedMarkIsIsolated` 同型:① 旧行整行无号 ② 新行声明位有合法号
// (两把尺都 import 单源 keyOfRow/declaredKeyOf,族合法性由 TASK_ID_PATTERN 背书)
// ③ 剥掉那枚号(含其后一个空白)后与旧行逐字节相等。**只替主键维放行**,租约/归属桶维照判。
// 成对钉:纯补号放行(带空格/不带空格/粗体外三形)对 括注被引号/旧行有号(换号)/双写号/
// 族外假号/顺带改桶/顺带改题面/顺带挂牌/多打空格 全拒,每条点名是哪一条件不满足(§0.10)。
// ---------------------------------------------------------------------------
describe('窄补号档(从(无)到一个合法号)', () => {
  const O = '- [ ] 标题 —— 现状'

  it('正控:声明位纯补 RP-7(号+一个空格)⇒ 放行', () => {
    assert.deepEqual(
      C.assertRowRewriteConservation({ oldLine: O, newLine: '- [ ] RP-7 标题 —— 现状', oldRec: null, newRec: null }),
      [],
    )
  })

  it('正控:号后不带空格 / 补在粗体外 / 补其它在册族(G-42)⇒ 同样放行(档不认族,认逐字节)', () => {
    for (const [oldLine, newLine] of [
      [O, '- [ ] RP-7标题 —— 现状'],
      ['- [ ] **标题** —— 现状', '- [ ] RP-7 **标题** —— 现状'],
      [O, '- [ ] G-42 标题 —— 现状'],
    ]) {
      assert.deepEqual(
        C.assertRowRewriteConservation({ oldLine, newLine, oldRec: null, newRec: null }),
        [],
        `${newLine} ⇒ 唯一差异只是插入这枚声明位编号,必须放行`,
      )
    }
  })

  it('反向①a:号写在**行首装饰括注**里 ⇒ 条件②拒(declaredKeyOf 与 keyOfRow 不同形,被引号不算补号声明)', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: O,
      newLine: '- [ ]（原RP-7）标题 —— 现状',
      oldRec: null,
      newRec: null,
    })
    assert.ok(
      v.some((x) => /主键漂了/.test(x) && /不在本行声明位/.test(x) && /条件②/.test(x)),
      JSON.stringify(v),
    )
  })

  it('反向①b:旧行已有号(G-7→RP-7 换号)⇒ 条件①拒,仍走同题让号额度', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: '- [ ] G-7 标题 —— 现状',
      newLine: '- [ ] RP-7 标题 —— 现状',
      oldRec: null,
      newRec: null,
    })
    assert.ok(
      v.some((x) => /主键漂了:G-7 → RP-7/.test(x) && /条件①/.test(x)),
      JSON.stringify(v),
    )
  })

  it('反向①c:双写同号 ⇒ 条件③拒(剥掉一枚还剩一枚,不是"唯一差异=插入")', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: O,
      newLine: '- [ ] RP-7 RP-7 标题 —— 现状',
      oldRec: null,
      newRec: null,
    })
    assert.ok(
      v.some((x) => /主键漂了/.test(x) && /条件③/.test(x)),
      JSON.stringify(v),
    )
  })

  it('反向①d:族外假号(QQ-7 被窗口尺读成 Q-7)⇒ 剥号后剩孤儿字符,条件③拒', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: O,
      newLine: '- [ ] QQ-7 标题 —— 现状',
      oldRec: null,
      newRec: null,
    })
    assert.ok(
      v.some((x) => /主键漂了:\(无\) → Q-7/.test(x) && /条件③/.test(x)),
      JSON.stringify(v),
    )
  })

  it('反向②:补号同时把「归属:…」句子换了 ⇒ 主键维放行但归属桶维仍拒(补号档不替桶维说话)', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: '- [ ] 标题 —— 归属:web 线',
      newLine: '- [ ] RP-7 标题 —— 一句现状',
      oldRec: null,
      newRec: null,
    })
    // 剥号后正文确实变了(归属句没了)⇒ 条件③同拒;而即便有人构造"补号+桶经侧车改判"
    // 的合法补号形态,桶维也独立点名(见下面侧车用例)。
    assert.ok(
      v.some((x) => /归属判定会漂/.test(x)),
      JSON.stringify(v),
    )
    const v2 = C.assertRowRewriteConservation({
      oldLine: '- [ ] 标题 —— 现状',
      newLine: '- [ ] RP-7 标题 —— 现状',
      oldRec: null,
      newRec: { key: 'RP-7#标题', owner: '某人', waiting: 'env', blocking: '等环境' },
    })
    assert.ok(
      v2.some((x) => /归属判定会漂/.test(x)),
      `补号后新行侧车把桶改了 ⇒ 必须仍拒,实际:${JSON.stringify(v2)}`,
    )
  })

  it('反向③:补号同时改题面 ⇒ 条件③拒并给出行内分歧位置(§0.10 定向说明)', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: O,
      newLine: '- [ ] RP-7 标题改字 —— 现状',
      oldRec: null,
      newRec: null,
    })
    assert.ok(
      v.some((x) => /主键漂了/.test(x) && /不再逐字节相等/.test(x)),
      JSON.stringify(v),
    )
  })

  it('反向④:补号同时挂牌 ⇒ 双维各点名(主键条件③ + 租约 add-attached),不放行任何一维', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: O,
      newLine: `- [ ]（进行中@${C.todayIso()}/乙） RP-7 标题 —— 现状`,
      oldRec: null,
      newRec: null,
    })
    assert.ok(
      v.some((x) => /主键漂了/.test(x)),
      JSON.stringify(v),
    )
    assert.ok(
      v.some((x) => /加牌这一步顺带改了别的东西/.test(x)),
      `补号+挂牌必须两笔分开,实际:${JSON.stringify(v)}`,
    )
  })

  it('反向⑤:补号多打一个空格 ⇒ 条件③拒(与挂牌档同一条逐字节纪律,不做空格启发式)', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: O,
      newLine: '- [ ]  RP-7 标题 —— 现状',
      oldRec: null,
      newRec: null,
    })
    assert.ok(
      v.some((x) => /主键漂了/.test(x) && /条件③/.test(x)),
      JSON.stringify(v),
    )
  })

  it('形状锁:拒写文案仍以「主键漂了:」开头(live-doc-edit 同题让号臂的 filter 锚),且带出路', () => {
    const v = C.assertRowRewriteConservation({
      oldLine: O,
      newLine: '- [ ] RP-7 标题 —— 现状改一个字',
      oldRec: null,
      newRec: null,
    })
    assert.equal(v.length, 1, JSON.stringify(v))
    assert.ok(v[0].startsWith('主键漂了:'), `让号臂按 startsWith 过滤,前缀被改即失明,实际:${v[0]}`)
    assert.match(v[0], /出路=/)
    assert.match(v[0], /补号档不成立/)
  })

  it('idFillTransitionOf 直读:ok 档交出 token/at;新行无号 ⇒ 未成立并点名(主键漂移的另一向不被本档掩盖)', () => {
    const good = C.idFillTransitionOf(O, '- [ ] RP-7 标题 —— 现状')
    assert.equal(good.ok, true)
    assert.equal(good.token, 'RP-7')
    assert.equal(typeof good.at, 'number')
    const noKey = C.idFillTransitionOf(O, '- [ ] 标题 —— 现状(改了尾巴)')
    assert.equal(noKey.ok, false)
    assert.match(noKey.why, /条件②/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
