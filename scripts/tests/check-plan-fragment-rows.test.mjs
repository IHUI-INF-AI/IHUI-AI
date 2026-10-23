// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像档(§22c):判据一律 import 源脚本的 __test__,这里**不抄第二份规则**。
 * 钉的是:
 *  1. F1 命中「复选框后整行只剩配平注记」;
 *  2. F1 不收「行首注记 + 后面整段正文」的健康长行(32 vs 1 那一次收窄的阳性对照);
 *  3. F2 命中「正文以续写标点收尾」;F2 不收闭括号/句号收尾的合法行;
 *  4. 两型互斥:同一行最多落一型(空正文优先);
 *  5. 嵌套注记逐段吃尽;未闭合开括号立刻停(保守方向:放过而非误判);
 *  6. 枚举到 0 枚登记行 ⇒ inspectFace 判死 blind(不记绿,§0.3);
 *  7. 面选择:两面旗同给判死、默认 HEAD 档、单旗各归各面(委派单源 selectFace);
 *  8. previewOf 按码点切(代理对不得被 UTF-16 单元切劈);
 *  9. readFace 取不到面 ⇒ 抛 Undetermined(仓外 scratch 两臂都试,不回落不记绿)。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { Undetermined } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as G } from '../check-plan-fragment-rows.mjs'

const EMPTY = '- [ ]（认领已释放@2026-10-23/stale-claim-strip#fixture）'
const HEALTHY_LEAD =
  '- [ ]（认领已释放@2026-10-23/x） **本项遗留的待拍板事项**(已量化):① 补 SMTP ② 补退信钩子'
const TRUNCATED = '- [ ] G-9001 确认旁路仍在调用方(`commands/agent.ts:1757`),'
const CLOSED = '- [ ] G-9002 现状一句(收尾是闭括号)'

describe('check-plan-fragment-rows 镜像档', () => {
  it('F1 命中整行只剩注记;不收行首注记+整段正文(32vs1 收窄对照)', () => {
    const r = G.findFragmentRows([EMPTY, HEALTHY_LEAD, TRUNCATED, CLOSED].join('\n'))
    assert.equal(r.counts[G.TYPE_EMPTY], 1, 'F1 必须恰好命中空正文那一枚')
    assert.equal(r.hits.find((h) => h.line === 2)?.type, undefined, '健康长行不得判 F1')
    assert.equal(r.denominator.rows, 4, '分母按单源 parseTaskRows 数,叙述行不计入')
  })

  it('F2 命中续写标点收尾;不收闭括号/句号;集内标点逐个都能命中', () => {
    const r = G.findFragmentRows([TRUNCATED, CLOSED].join('\n'))
    assert.equal(r.counts[G.TYPE_TRUNCATED], 1)
    assert.equal(r.hits[0].line, 1)
    assert.equal(G.findFragmentRows('- [ ] G-9 正文。').counts[G.TYPE_TRUNCATED], 0)
    assert.equal(G.findFragmentRows('- [ ] G-9 正文」').counts[G.TYPE_TRUNCATED], 0)
    for (const p of G.CONTINUATION_PUNCT) {
      assert.equal(
        G.findFragmentRows(`- [ ] G-9 正文${p}`).counts[G.TYPE_TRUNCATED],
        1,
        `集内标点「${p}」不收 ⇒ 集里有哑臂`,
      )
    }
  })

  it('两型互斥:剥尽注记后只剩续写标点的行只落 F2 一次', () => {
    const r = G.findFragmentRows('- [ ]（注记）,')
    assert.equal(r.hits.length, 1, '同一行不得同时落两型')
    assert.equal(r.hits[0].type, G.TYPE_TRUNCATED)
  })

  it('嵌套注记吃尽 ⇒ F1;未闭合开括号立刻停 ⇒ 放过', () => {
    assert.equal(
      G.findFragmentRows('- [ ]（【归并】重复登记副本）〔归:—｜等:等环境〕').counts[G.TYPE_EMPTY],
      1,
    )
    assert.equal(G.findFragmentRows('- [ ]（未闭合的开括号').counts[G.TYPE_EMPTY], 0)
  })

  it('annotationResidue 对非登记行返回 null(叙述行不进尺子)', () => {
    assert.equal(G.annotationResidue('一句叙述,以逗号收尾,'), null)
    assert.equal(G.annotationResidue('# 标题'), null)
  })

  it('inspectFace:枚举到 0 判死 blind;有命中 hit;零命中 clean', () => {
    assert.equal(G.inspectFace('head', '# 只有标题,没有登记行\n').state, 'blind')
    assert.equal(G.inspectFace('head', EMPTY).state, 'hit')
    assert.equal(G.inspectFace('head', CLOSED).state, 'clean')
  })

  it('面选择委派单源:默认 head、单旗各归各面、两面旗同给判死', () => {
    assert.equal(G.pickFace([]).face, 'head')
    assert.equal(G.pickFace(['--staged']).face, 'staged')
    assert.equal(G.pickFace(['--worktree']).face, 'worktree')
    const both = G.pickFace(['--staged', '--worktree'])
    assert.equal(both.face, null)
    assert.ok(both.error, '两面旗同给必须点名原因')
  })

  it('previewOf 按码点切,代理对不得被劈开', () => {
    const p = G.previewOf('😀'.repeat(100), 10)
    assert.equal([...p].length, 10)
    assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(p), '出现落单高位代理 = 代理对被切劈')
  })

  it('readFace 取不到面 ⇒ 抛 Undetermined(仓外 scratch,head/staged/worktree 三臂)', () => {
    const dir = mkScratch('fragment-rows-mirror')
    try {
      for (const face of ['head', 'staged', 'worktree']) {
        assert.throws(() => G.readFace(face, dir, 'NO-SUCH-DOC-FIXTURE.md'), Undetermined, `${face} 臂必须抛 Undetermined 而非返回空面`)
      }
    } finally {
      rmScratch(dir)
    }
  })
})
