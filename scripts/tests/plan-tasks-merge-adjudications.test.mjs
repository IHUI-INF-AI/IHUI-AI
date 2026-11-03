// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:plan-tasks-merge 的裁决账档(F1 归零判据的"有交代"出口)。
 *
 * 立因(2026-09-30 真仓实测):一条不可机械归并的 F1(翻勾会改正文)卡死整批交付 —— F1 永远差一组
 * 归不了零,其余几十组可归并的行陪着落不了地。修复 = ① buildMerge 翻勾前自检 forkPreserved,
 * 不成 ⇒ 跳过翻勾并记入 adjudicationNeeded(F4 指针仍可加);② verifyMerge 收第四参裁决账面,
 * 剩余分叉逐组被覆盖才算"有交代"。两条硬护栏**一字不松**:forkPreserved 的逐字相等守卫原样在
 * verifyMerge 里(生产侧只是不再产出它要拦的形态);F4 绝不翻勾。
 *
 *  P1  buildMerge:翻勾会改正文的行必须被跳过并进 adjudicationNeeded,行原文逐字保留。
 *  P2  同夹具、翻勾不改正文的行:照常翻勾(自检守卫不得把合法翻勾也拦掉 —— 阳性对照)。
 *  P3  verifyMerge+裁决账:覆盖的剩余分叉不再判红;没传裁决账(旧口径)同样形态必须红(方向锁)。
 *  P4  裁决账三型:AJ1 字段不全 / AJ2 到期 ⇒ 不构成覆盖(该组红);AJ3 分叉已消失 ⇒ 清单腐烂红。
 *  P5  零损失护栏照旧:未参与改写的行被改动 / 行被丢 ⇒ 红(裁决账档不放行任何零损失违规)。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { buildMerge, verifyMerge } from '../plan-tasks-merge.mjs'
import { forkPreserved } from '../lib/plan-merge-annotation.mjs'


test('P1 不变式:任意真实形态混合面上,buildMerge 绝不产出落地闸会拦的翻转(守卫是纵深防御)', () => {
  // 两个根修复(完成被打断的翻勾 / 翻勾前自检)之后,已知的 forkPreserved 失败族都不再产出门拦形态。
  // 本测试不再依赖某一个构造形状,而是把已知真实形态混进一张面,断言不变式:
  // ① 每一条 changed 的翻转都过 forkPreserved 同一把尺;② adjudicationNeeded(若有)必带 key+reason。
  const note =
    '（[归并] 本行与已完成登记同题(主键 「D910 并集复活」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、正文逐字保留于前、不删行、不重复计账）'
  const src = [
    '- [x] ✅(2026-09-20) **D910 并集复活**:一条。',
    '- [ ] **D910 并集复活**:另一份正文。' + note,
    '- [x] ✅(2026-09-20) **D913 普通分叉**:说明文字。',
    '- [ ] **D913 普通分叉**:旧副本,正文可逐字保留。',
    '- [ ] **D914 作废**:〔本行判:已完成,勿照本行派单〕。',
  ].join('\n')
  const r = buildMerge(src, '2026-09-30')
  for (const c of r.changed) {
    if (/(?:^|\+)F[12](?:\+|$)/.test(c.kind))
      assert.ok(
        forkPreserved(c.before, c.after),
        `生产侧不得产出落地闸会拦的翻转(L${c.line}):${JSON.stringify(c)}`,
      )
  }
  for (const x of r.adjudicationNeeded)
    assert.ok(x.key && x.reason, `裁决需条目必须带 key+reason:${JSON.stringify(x)}`)
})

test('P1b 并集复活态:翻勾注记在而复选框被写丢 ⇒ 完成那次被打断的翻勾(只落状态、不叠第二句注记)', () => {
  // 2026-09-30 真仓 L11529 实测形态:上一枚翻转的注记在,复选框被并集写回 [ ]。
  // 旧路径 buildForkedLine 幂等判到注记就整行不动 ⇒ F1 永远差一组;F4 指针再叠一句又会打破
  // 既有注记的可剥性 ⇒ 整批停。正解 = 只落复选框与状态装饰,正文(含既有注记)逐字保留。
  const note =
    '（[归并] 本行与已完成登记同题(主键 「D911 并集复活」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、正文逐字保留于前、不删行、不重复计账）'
  const src = [
    '- [x] ✅(2026-09-20) **D911 并集复活**:一条。',
    '- [ ] **D911 并集复活**:另一份正文。' + note,
  ].join('\n')
  const r = buildMerge(src, '2026-09-30')
  const hit = r.changed.find((c) => c.line === 2)
  assert.ok(hit && hit.kind.includes('F1'), `复活态必须被完成翻勾,实得 ${JSON.stringify(r.changed)}`)
  assert.ok(hit.after.startsWith('- [x] ✅('), '复选框必须落为已完成')
  assert.equal(
    hit.after.split('（[归并]').length - 1,
    1,
    '不得叠加第二句注记(注记只许有一份,叠句正是 forkPreserved 被打破的成因)',
  )
  assert.equal(r.adjudicationNeeded.length, 0, `复活态不得进裁决需列表,实得 ${JSON.stringify(r.adjudicationNeeded)}`)
  const v = verifyMerge(src, r.text, r.changed)
  assert.deepEqual(v.problems, [], `零损失与归零必须全过:${JSON.stringify(v.problems)}`)
})

test('P2 阳性对照:翻勾不改正文的 F1 行照常翻勾(守卫不得把合法翻勾也拦掉)', () => {
  const src = [
    '- [x] ✅(2026-09-20) **D901 复合主键正例**:说明文字。',
    '- [ ] **D901 复合主键正例**:旧副本,正文在翻转后剥掉注记必须仍逐字相等。',
  ].join('\n')
  const r = buildMerge(src, '2026-09-30')
  const hit = r.changed.find((c) => c.line === 2)
  assert.ok(hit && hit.kind.includes('F1'), `合法翻勾必须照常发生,实得 ${JSON.stringify(r.changed)}`)
  assert.equal(r.adjudicationNeeded.length, 0, '正文可保留的翻勾不得进裁决需列表')
  assert.ok(r.text.split('\n')[1].startsWith('- [x]'), '翻勾必须真的落进去')
})

test('P3 verifyMerge 方向锁:同样的剩余分叉,带覆盖条目 ⇒ 绿;不带裁决账(旧口径)⇒ 红', () => {
  const original = [
    '- [x] ✅(2026-09-20) **D902 状态分叉**:一条。',
    '- [ ] **D902 状态分叉**:另一条,谁作数须由人裁。',
  ].join('\n')
  const merged = original // 什么都没改(该分叉被裁决账接管)
  const adj = {
    file: 'scripts/data/plan-merge-adjudications.json',
    today: '2026-09-30',
    items: [
      { key: 'D902#状态分叉', reason: '两条正文谁作数须由人裁', owner: '台账持有人', reviewBy: '2026-10-30' },
    ],
  }
  const withAdj = verifyMerge(original, merged, [], adj)
  assert.deepEqual(
    withAdj.problems.filter((p) => p.includes('F1') || p.includes('AJ')),
    [],
    `覆盖条目在场 ⇒ F1 不得再红,实得 ${JSON.stringify(withAdj.problems)}`,
  )
  const withoutAdj = verifyMerge(original, merged, [])
  assert.ok(
    withoutAdj.problems.some((p) => p.includes('F1 未归零')),
    `不带裁决账(旧口径)必须照旧红,实得 ${JSON.stringify(withoutAdj.problems)}`,
  )
})

test('P4 裁决账三型:AJ1 字段不全 / AJ2 到期 ⇒ 不构成覆盖;AJ3 分叉已消失 ⇒ 清单腐烂红', () => {
  const original = [
    '- [x] ✅(2026-09-20) **D903 状态分叉**:一条。',
    '- [ ] **D903 状态分叉**:另一条。',
  ].join('\n')
  const base = { file: 'adj.json', today: '2026-09-30' }
  const mk = (items) => verifyMerge(original, original, [], { ...base, items })

  const aj1 = mk([{ key: 'D903#状态分叉', reason: '等裁' }])
  assert.ok(aj1.problems.some((p) => p.startsWith('AJ1')), `AJ1 必须红,实得 ${JSON.stringify(aj1.problems)}`)
  assert.ok(aj1.problems.some((p) => p.includes('F1 未归零')), 'AJ1 条目不得构成覆盖(该组必须仍点名)')

  const aj2 = mk([{ key: 'D903#状态分叉', reason: '等裁', owner: '某人', reviewBy: '2026-09-01' }])
  assert.ok(aj2.problems.some((p) => p.startsWith('AJ2')), `AJ2 到期必须红,实得 ${JSON.stringify(aj2.problems)}`)
  assert.ok(aj2.problems.some((p) => p.includes('F1 未归零')), '到期条目不得构成覆盖(回队列)')

  const aj3 = mk([{ key: 'D999 分叉早已消失', reason: '等裁', owner: '某人', reviewBy: '2026-10-30' }])
  assert.ok(aj3.problems.some((p) => p.startsWith('AJ3')), `AJ3 腐烂必须红,实得 ${JSON.stringify(aj3.problems)}`)
})

test('P5 零损失护栏照旧:裁决账档不放行任何零损失违规(未登记行被改 / 行丢失)', () => {
  const original = [
    '- [x] ✅(2026-09-20) **D904 状态分叉**:一条。',
    '- [ ] **D904 状态分叉**:另一条。',
    '- [ ] **D905 无辜行**:谁都不该动我。',
  ].join('\n')
  const adj = {
    file: 'adj.json',
    today: '2026-09-30',
    items: [{ key: 'D904#状态分叉', reason: '等裁', owner: '某人', reviewBy: '2026-10-30' }],
  }
  const sabotaged = original.replace('- [ ] **D905 无辜行**:谁都不该动我。', '- [ ] **D905 被篡改**:!')
  const v = verifyMerge(original, sabotaged, [], adj)
  assert.ok(
    v.problems.some((p) => p.includes('未参与改写却被改动')),
    `裁决账档必须照旧拦零损失违规,实得 ${JSON.stringify(v.problems)}`,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
