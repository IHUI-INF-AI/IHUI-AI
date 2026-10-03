// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:plan-tasks-merge 落地档接上裁决账(G-1038502)。
 *
 * 立因(2026-10-03 轮 28 实测):裁决账只接在**报告档** `verifyMerge` 上,落地档
 * `healAndLand → healStopReasons` 永不加载它 ⇒ 一旦存在"不可机械归并"的分叉键
 * (翻勾会改正文 ⇒ 工具拒绝机械归并),报告档判它"有交代、已覆盖",而 `--heal --commit`
 * 的落地闸因 `after.forks` 非零**整批 return 1** —— 于是该命令结构上永远落不了地,
 * 而账面上 F2/F4 那些本可机械归并的行陪着一起卡住。
 *
 * 本文件钉四件事(每条都成对:正例 + 反向对照):
 *  Q1 落地闸认覆盖:同一道分叉键,在裁决账内 ⇒ `healStopReasons` **不**因它停手;
 *     不在账内 ⇒ 照旧停手。**这一条与 P3(报告档)是同一把尺的两个调用点**。
 *  Q2 **反向对照(最要紧的一条)**:`adj` 传 `null` ⇒ 必须与改前**逐字同行为**(判红)。
 *     没有这一条,"把裁决账接上"和"把落地闸放水"在账面上一模一样。
 *  Q3 其余四维一字未松:行数不等 / 未登记行被改 / 翻勾未逐字保留正文 / 折叠未闭合,
 *     **即便裁决账覆盖了那个 fork 也照样红** —— 覆盖判据只放宽 fork 那一维。
 *  Q4 `adjudicationProblems` 两处调用点同源:AJ1/AJ2/AJ3 三型在**落地档**同样判
 *     (尤其 AJ3 清单腐烂 —— 共用实现在结构上就排除了"只在一侧判")。
 *
 * 一条硬约束:本文件**只 import 生产实现**,一条判据都不重写(§22c)。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  adjudicationProblems,
  buildMerge,
  healStopReasons,
  verifyMerge,
} from '../plan-tasks-merge.mjs'
import { auditPlan } from '../lib/plan-task-index.mjs'

/** 造一张"同一道题两态并存"的面:一条已勾正主 + 一条未勾副本(正文逐字相同 ⇒ F1)。 */
function forkFace(key = 'D906', title = '落地档接裁决账') {
  return [
    `- [x] ✅(2026-09-20) **${key} ${title}**:正主。`,
    `- [ ] **${key} ${title}**:副本。`,
  ].join('\n')
}

/** 逐字取该面的 fork 键(复合主键 = 编号 + 标题前缀),判据住在台账 lib,不重写。 */
function forkKeyOf(text) {
  const a = auditPlan(text)
  return (a.forks ?? [])[0]?.key ?? null
}

test('Q1 落地闸认裁决账覆盖:同一道分叉键,在账内不因它停手、不在账内照旧停手', () => {
  const src = forkFace()
  const key = forkKeyOf(src)
  assert.ok(key, '夹具必须真的造出一道 F1,否则本测试什么都没钉')

  // 未改动的面本身就有分叉 ⇒ 改前行为:归并后未归零
  const noAdj = healStopReasons(src, src, [], 0)
  assert.ok(
    noAdj.some((x) => x.includes('归并后未归零')),
    `未传裁决面时必须判「归并后未归零」(从严),实得 ${JSON.stringify(noAdj)}`,
  )

  // 账内且未到期 ⇒ 不再因这个 fork 停手
  const adj = { file: 'adj.json', today: '2026-09-30', items: [{ key, reason: '等裁', owner: '某人', reviewBy: '2026-10-30' }] }
  const withAdj = healStopReasons(src, src, [], 0, adj)
  assert.ok(
    !withAdj.some((x) => x.includes('归并后未归零')),
    `裁决账覆盖后落地闸不得再因该 fork 停手,实得 ${JSON.stringify(withAdj)}`,
  )

  // 账外同键(空 items)⇒ 照旧停手(证明起作用的是"覆盖",不是"传了 adj"这件事本身)
  const emptyAdj = { file: 'adj.json', today: '2026-09-30', items: [] }
  const withEmpty = healStopReasons(src, src, [], 0, emptyAdj)
  assert.ok(
    withEmpty.some((x) => x.includes('归并后未归零')),
    `裁决账为空时必须照旧停手,实得 ${JSON.stringify(withEmpty)}`,
  )
})

test('Q2 反向对照:adj 传 null ⇒ 与改前逐字同行为(防"接上线"退化成"放水")', () => {
  // 造一张**零分叉**的面:正确归并不该停手
  const clean = ['- [x] ✅(2026-09-20) **D907 干净行**:说明。', '- [ ] **D908 另一条**:说明。'].join('\n')
  const okNull = healStopReasons(clean, clean, [], 0, null)
  assert.deepEqual(
    okNull,
    [],
    `无分叉的面即便传 null 也不该有任何停手项,实得 ${JSON.stringify(okNull)}`,
  )
  // 有分叉的面传 null ⇒ 必须红(这是"不许漂"第②条:这一维没被删,只是改了谁有资格让它红)
  const forked = forkFace()
  assert.ok(
    healStopReasons(forked, forked, [], 0, null).some((x) => x.includes('归并后未归零')),
    '传 null 必须与改前同行为(判红)⇒ 否则"覆盖判据"就退化成"落地闸放水"',
  )
  // 显式 undefined(默认值)同 null
  assert.deepEqual(
    healStopReasons(clean, clean, [], 0),
    healStopReasons(clean, clean, [], 0, null),
    '省略第五参与显式传 null 必须逐字等价(默认值语义)',
  )
})

test('Q3 覆盖只放宽 fork 那一维:行数不等 / 未登记行被改 / 逐字保留/ 折叠未闭合照样红', () => {
  const src = forkFace()
  const key = forkKeyOf(src)
  const adj = { file: 'adj.json', today: '2026-09-30', items: [{ key, reason: '等裁', owner: '某人', reviewBy: '2026-10-30' }] }

  const lineCount = healStopReasons(src, src + '\n多塞一行', [], 0, adj)
  assert.ok(lineCount.some((x) => x.includes('行数不等')), '行数不等必须照旧红')

  const untouched = healStopReasons(src, src.replace('正主。', '正主被改!'), [], 0, adj)
  assert.ok(untouched.some((x) => x.includes('未登记行被改动')), '未参与改写却被改动必须照旧红')

  const trunc = healStopReasons(src, src.replace('副本。', '副本'), [{ line: 2, kind: 'F1', before: src.split('\n')[1], after: '- [x] ✅(2026-09-30) **D906 落地档接裁决账**:副本' }], 0, adj)
  assert.ok(
    trunc.some((x) => x.includes('逐字保留')),
    `翻勾截断正文必须照旧红(G-998073②的守卫一字未松),实得 ${JSON.stringify(trunc)}`,
  )
})

test('Q4 三型判红在落地档同样判:AJ1 字段不全 / AJ2 到期 不构成覆盖、AJ3 清单腐烂红', () => {
  const src = forkFace()
  const key = forkKeyOf(src)

  // AJ1 字段不全 ⇒ 不构成覆盖 ⇒ 落地闸仍停手
  const aj1 = { file: 'adj.json', today: '2026-09-30', items: [{ key, reason: '等裁', owner: '某人' }] }
  const r1 = adjudicationProblems(auditPlan(src), aj1)
  assert.ok(r1.problems.some((p) => p.includes('AJ1')), `字段不全必须 AJ1 判红,实得 ${JSON.stringify(r1.problems)}`)
  assert.ok(
    healStopReasons(src, src, [], 0, aj1).some((x) => x.includes('归并后未归零')),
    'AJ1 不构成覆盖 ⇒ 落地闸仍须停手',
  )

  // AJ2 到期 ⇒ 不构成覆盖
  const aj2 = { file: 'adj.json', today: '2026-09-30', items: [{ key, reason: '等裁', owner: '某人', reviewBy: '2026-01-01' }] }
  const r2 = adjudicationProblems(auditPlan(src), aj2)
  assert.ok(r2.problems.some((p) => p.includes('AJ2')), `到期未复裁必须 AJ2 判红,实得 ${JSON.stringify(r2.problems)}`)

  // AJ3 台账已无此分叉 ⇒ 清单腐烂(这条在**落地档**同样判 —— 共用实现保证的)
  const aj3 = { file: 'adj.json', today: '2026-09-30', items: [{ key: 'D999#早已不在台账里的键', reason: 'r', owner: 'o', reviewBy: '2026-10-30' }] }
  const r3 = adjudicationProblems(auditPlan(src), aj3)
  assert.ok(r3.problems.some((p) => p.includes('AJ3')), `分叉已消失必须 AJ3 判红(否则账只涨不消),实得 ${JSON.stringify(r3.problems)}`)
})

test('Q5 两处调用点同源:报告档与落地档对同一份面给出一致的覆盖判定', () => {
  const src = forkFace()
  const key = forkKeyOf(src)
  const cases = [
    { label: '覆盖且未到期', adj: { file: 'a', today: '2026-09-30', items: [{ key, reason: 'r', owner: 'o', reviewBy: '2026-10-30' }] } },
    { label: '字段不全', adj: { file: 'a', today: '2026-09-30', items: [{ key, reason: 'r' }] } },
    { label: '已到期', adj: { file: 'a', today: '2026-09-30', items: [{ key, reason: 'r', owner: 'o', reviewBy: '2026-01-01' }] } },
    { label: '空账', adj: { file: 'a', today: '2026-09-30', items: [] } },
  ]
  for (const c of cases) {
    const report = verifyMerge(src, src, [], c.adj).problems.filter((p) => p.includes('F1 未归零'))
    const land = healStopReasons(src, src, [], 0, c.adj).filter((p) => p.includes('归并后未归零'))
    assert.equal(
      report.length > 0,
      land.length > 0,
      `${c.label}:报告档判「F1 未归零」=${report.length > 0},落地闸判「归并后未归零」=${land.length > 0},两者必须一致(同一把尺)`,
    )
  }
})

test('Q6 端到端:族被成功归并(分叉消失)⇒ 裁决账条目触发 AJ3 清单腐烂(账只涨不消的守卫)', () => {
  // 真实形态:两行正文逐字相同 ⇒ buildMerge **能**归并 ⇒ 归并后分叉消失。
  // 此时若裁决账里还留着那条键,AJ3 必须判红("条目必须了结")——
  // 这正是"不许漂"第③条:共用实现让 AJ3 在落地档同样判,账不会悄悄只涨不消。
  const src = [
    '- [x] ✅(2026-09-20) **D910 会被归并的题**:短版正文。',
    '- [ ] **D910 会被归并的题**:短版正文。',
  ].join('\n')
  const key = forkKeyOf(src)
  assert.ok(key, '夹具必须造出 F1')
  const r = buildMerge(src, '2026-09-30')
  const stillForked = (auditPlan(r.text).forks ?? []).length > 0
  assert.equal(stillForked, false, '本夹具前提:正文逐字相同 ⇒ 归并后分叉消失')

  // 账里那条键已无对应分叉 ⇒ AJ3 判红,且落地闸停手(等有人把条目了结)
  const stale = { file: 'a', today: '2026-09-30', items: [{ key, reason: 'r', owner: 'o', reviewBy: '2026-10-30' }] }
  const ap = adjudicationProblems(auditPlan(r.text), stale)
  assert.ok(
    ap.problems.some((p) => p.includes('AJ3')),
    `分叉已消失而账里条目还在 ⇒ 必须 AJ3 判红,实得 ${JSON.stringify(ap.problems)}`,
  )
  assert.ok(
    healStopReasons(src, r.text, r.changed, 0, stale).some((x) => x.includes('归并后未归零')),
    'AJ3 未了结前落地闸必须停手(账只涨不消的守卫在落地档同样生效)',
  )

  // 把条目了结(清空账)⇒ 归并结果本身干净 ⇒ 落地闸放行
  const cleared = { file: 'a', today: '2026-09-30', items: [] }
  assert.deepEqual(
    adjudicationProblems(auditPlan(r.text), cleared).problems,
    [],
    '账清空后不该有任何 AJ 判红',
  )
  assert.ok(
    !healStopReasons(src, r.text, r.changed, 0, cleared).some((x) => x.includes('归并后未归零')),
    '归并干净且账已了结 ⇒ 落地闸必须放行(这正是本票要恢复的能力)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
