// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  judgeContentLoss,
  formatLossReport,
  missingLines,
  missingLineCounts,
  foldPairsOf,
  foldCreditOf,
  lineMultiset,
} from '../lib/content-loss-gate.mjs'
import { foldDedupe, foldLedgerOf } from '../lib/union-converge-judgments.mjs'

/**
 * 内容级防丢闸 · 折叠台账这一格(2026-11-06,在册票 G-32「归并侧那半格」的续办)。
 *
 * 立因:本闸初版是**第三把**不认折叠的尺子 —— `verifyUnion` 认(`attestFoldPair` 四问)、
 * F5 ⑤ 档也认(2026-10-16 立),唯独本闸按字面多重集比 ⇒ 把**合法折叠**(信息守恒,少的只是
 * 行份数)读成"少带行"⇒ 恒红。仓内实测记录就是这个形状:关折叠 0 处 / 开折叠 289 处、真丢失 0 处。
 *
 * 本文件钉住两件事:
 *  ① 正例:台账四问全过的折叠 ⇒ 不判红,且销掉的份数必须**报名**(不许静默折进"0 丢失");
 *  ② 反例:台账没喂 / 台账没这一行 / 台账只解释一部分 / 举证判不出 ⇒ 一律照旧判红或记「未判定」。
 *     成对纪律:每一档"放过"都必须配一档"不放过",否则这层就成了掩体(§0.2)。
 *
 * 夹具用**真折叠面**(跑真的 `foldDedupe`),不手写"折叠后长什么样" —— 手写等于在测试里
 * 复制了一份折叠判据(§22c),两处必然漂移。
 */

// ── 夹具 ────────────────────────────────────────────────────────────────────
const TITLE = '内容级防丢闸不许对着折叠前的重数判红'
/** 本侧:同题两行(G-780 无注记 / G-781 带取证注记),真折叠会折成一份。 */
const OURS = [
  '# 计划',
  `- [ ] G-780 **${TITLE}**,夹具标题够长以过指纹权重门。`,
  `- [ ] G-781 **${TITLE}**,夹具标题够长以过指纹权重门。〔取证:2026-11-06〕`,
].join('\n')
/** 真折叠面:跑真的 foldDedupe 产出的"折叠后"那份。 */
const MERGED = foldDedupe(OURS).text
/** 折叠台账:与上面那次折叠**同轮**产出(§0.4 同面同轮)。 */
const LEDGER = foldLedgerOf(OURS, MERGED)

/** 取面注入(本闸的 `read` 是依赖注入口,测试不必起真 git 仓)。 */
const read = (rev, path) => {
  if (path !== 'PROJECT_PLAN.md') return null
  if (rev === 'OURS') return OURS
  if (rev === 'THEIRS') return MERGED
  if (rev === 'MERGED') return MERGED
  return null
}
const base = {
  root: 'G:/IHUI-AI',
  ours: 'OURS',
  theirs: 'THEIRS',
  merged: 'MERGED',
  paths: ['PROJECT_PLAN.md'],
  read,
}
const withLedger = (ledger) => ({ ...base, foldLedgers: new Map([['PROJECT_PLAN.md', ledger]]) })

describe('内容级防丢闸 · 折叠台账这一格', () => {
  it('前置自证:夹具真的发生了折叠,台账真的有两条去向(否则下面全是空转)', () => {
    assert.equal(LEDGER.pairs.length, 2, '台账必须有两条去向')
    assert.ok(
      LEDGER.pairs.every((x) => x.kept && MERGED.includes(x.kept)),
      '每条去向的保留行都必须真在折叠产物面里',
    )
  })

  it('正例:台账四问全过的合法折叠 ⇒ 不判红', () => {
    const r = judgeContentLoss(withLedger(LEDGER))
    assert.equal(r.violations.length, 0, `不该有违规:${JSON.stringify(r.violations)}`)
    assert.equal(r.undetermined.length, 0)
    assert.equal(r.ok, true)
  })

  it('正例:销掉的份数必须报名(不许静默折进"0 丢失")', () => {
    const r = judgeContentLoss(withLedger(LEDGER))
    assert.equal(r.folded.length, 2, '两条被折行都要报出来')
    assert.ok(
      r.folded.every((e) => e.copies === 1 && e.kept && e.dropped),
      '每一笔都要带份数、去向行与被折行',
    )
    assert.match(formatLossReport(r), /折叠销账/)
  })

  it('反例一:台账没喂进来 ⇒ 照旧判红(与初版逐字一致)', () => {
    const r = judgeContentLoss(base)
    assert.equal(r.ok, false)
    assert.equal(r.violations.length, 1)
    assert.equal(r.violations[0].kind, 'lines')
    assert.equal(r.violations[0].missingOurs.length, 2, '两条同题行都该被点名')
    assert.equal(r.violations[0].missingTheirs.length, 0)
  })

  it('反例二:台账指向另一件事 ⇒ 举证不成立 ⇒ 判红', () => {
    const forged = {
      pairs: [
        {
          dropped: `- [ ] G-780 **${TITLE}**,夹具标题够长以过指纹权重门。`,
          kept: '- [ ] G-999 **完全另一件事**:正文',
          droppedCopies: 1,
        },
      ],
    }
    const r = judgeContentLoss(withLedger(forged))
    assert.equal(r.ok, false, '不是同一件事不许销账')
    assert.equal(r.violations.length, 1)
  })

  it('反例三:台账只解释一部分份数 ⇒ 剩下的是真少带 ⇒ 仍判红', () => {
    const partial = {
      pairs: LEDGER.pairs.map((x) => ({ ...x, droppedCopies: 0 })),
    }
    const r = judgeContentLoss(withLedger(partial))
    assert.equal(r.ok, false, '台账额度为 0 ⇒ 一份都销不掉')
    assert.equal(r.violations.length, 1)
  })

  it('反例四:举证判不出(去向给不出)⇒ 记「未判定」,不记绿也不冒红', () => {
    const noKept = {
      pairs: LEDGER.pairs.map((x) => ({ ...x, kept: null })),
    }
    const r = judgeContentLoss(withLedger(noKept))
    assert.equal(r.ok, false, '判不出不是放行的许可证')
    assert.ok(r.undetermined.length > 0, '必须落进未判定面')
    assert.match(r.undetermined[0], /未判定|折叠去向/)
  })

  it('反例五:产物面把两行都吃了(台账在、产物不在)⇒ 判红', () => {
    const emptyMerged = '# 计划'
    const r = judgeContentLoss({
      ...base,
      merged: 'EMPTY',
      read: (rev, path) => {
        if (path !== 'PROJECT_PLAN.md') return null
        if (rev === 'EMPTY') return emptyMerged
        if (rev === 'OURS') return OURS
        return MERGED
      },
      foldLedgers: new Map([['PROJECT_PLAN.md', LEDGER]]),
    })
    assert.equal(r.ok, false, '台账不是免死金牌')
    assert.equal(r.violations.length, 1)
  })
})

describe('内容级防丢闸 · 键集维与份数口径', () => {
  it('键集维不受折叠账影响:scripts/data 少键照旧判红', () => {
    const r = judgeContentLoss({
      root: 'G:/IHUI-AI',
      ours: 'OURS',
      theirs: 'THEIRS',
      merged: 'MERGED',
      paths: ['scripts/data/demo.json'],
      read: (rev, path) => {
        if (path !== 'scripts/data/demo.json') return null
        if (rev === 'OURS') return JSON.stringify({ a: 1, b: 2 })
        if (rev === 'THEIRS') return JSON.stringify({ a: 1 })
        return JSON.stringify({ a: 1 })
      },
      foldLedgers: new Map([['scripts/data/demo.json', { pairs: [] }]]),
    })
    assert.equal(r.ok, false, '键丢了必须判红')
    assert.equal(r.violations[0].kind, 'keys')
    assert.deepEqual(r.violations[0].missingOurs, ['b'])
  })

  it('份数口径只有一份:missingLines 与 missingLineCounts 同形', () => {
    const side = ['x', 'x', 'y'].join('\n')
    const merged = ['x'].join('\n')
    assert.deepEqual(missingLines(side, merged), ['x', 'y'])
    assert.deepEqual(missingLineCounts(side, merged), [
      { line: 'x', deficit: 1 },
      { line: 'y', deficit: 1 },
    ])
  })

  it('台账归一只做裁剪:字面裁剪后与行重数同一空间', () => {
    const pairs = foldPairsOf({
      pairs: [{ dropped: '  a  ', kept: '  b  ', droppedCopies: 2 }],
    })
    assert.ok(pairs.has('a'))
    assert.equal(pairs.get('a').kept, 'b')
    assert.equal(pairs.get('a').droppedCopies, 2)
  })

  it('销账额度封顶在台账申报的份数', () => {
    const pairOf = new Map([['a', { dropped: 'a', kept: 'a', droppedCopies: 1 }]])
    const m = lineMultiset('a')
    const r = foldCreditOf('a', 5, pairOf, m)
    assert.equal(r.status, 'attested')
    assert.equal(r.credit, 1, '台账只报 1 份就只销 1 份')
  })

  it('台账申报 0 份 = 一份都不销(不得回落成"台账没报就全销")', () => {
    const pairOf = new Map([['a', { dropped: 'a', kept: 'a', droppedCopies: 0 }]])
    const m = lineMultiset('a')
    assert.equal(foldCreditOf('a', 1, pairOf, m).credit, 0, '0 份额度必须销 0 份')
  })
})
