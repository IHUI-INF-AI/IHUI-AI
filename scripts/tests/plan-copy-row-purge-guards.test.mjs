// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/plan-copy-row-purge.mjs` 的**判据盲区**补充测试(票 G-946 同主键副本行物理归并专项)。
 *
 * 只补 HEAD 面**零测试**的那几格(2026-10-24 票面自述:「⑤⑥零测试、③真实 analyzeLeases 接线未测」),
 * 外加 2026-10-29 本席改动的两处机器阀:
 *  - ④c 归档接收方的副作用面:`splitPointedId` / `leadingTokenOf` / `buildArchiveIndex` 的多文件
 *    行号累计与三态(取不到正文 ⇒ ok:false),以及**题面收窄在台账面同样生效**(同编号不同议题
 *    的 open 行不得被当接收方);
 *  - 安全阀 2 的精确对账(`verifyNewFace`):批1/批3 "副本行全集恰好减 N" 双向(少减 = 有行没删够,
 *    多减 = 把非副本行算成副本),批1 mergeNotes 必须不变,批2 必须下降,F1/F9 不得恶化。
 *
 * 判据一律 import 源脚本,零复算(§22c);镜像件只钉**行为**,不复制任何常量或公式。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  buildArchiveIndex,
  filterCandidates,
  leadingTokenOf,
  pointerTargetVerdict,
  selectCopyRowsToPurge,
  splitPointedId,
  verifyNewFace,
} from '../plan-copy-row-purge.mjs'
import { analyzeLeases, resolveTtlHours, scanTasks } from '../check-task-claims.mjs'

const row = (line, raw, extra = {}) => ({
  line,
  state: 'open',
  raw,
  body: raw,
  key: null,
  claim: null,
  ...extra,
})
const archOf = (entries) => buildArchiveIndex(entries)
const ARCH = '.ihui-agent/archive/PROJECT_PLAN_x.md'

describe('④c 接收方补齐:编号拆解与归档索引', () => {
  it('splitPointedId:·后是题面收窄串,不是编号的一部分', () => {
    assert.deepEqual(splitPointedId('4·观察期'), { id: '4', hint: '观察期' })
    assert.deepEqual(splitPointedId('62'), { id: '62', hint: null })
    assert.deepEqual(splitPointedId('  P1-①  '), { id: 'P1-①', hint: null })
    assert.deepEqual(splitPointedId(''), { id: null, hint: null })
  })

  it('leadingTokenOf:字面取正文首段(keyOfRow 给不出键的族也要有落点)', () => {
    assert.equal(leadingTokenOf('- [ ] 62. 会话搜索栏挂载 + 侧栏批量选择'), '62')
    assert.equal(leadingTokenOf('- [x] ✅(2026-09-27) 62. 会话搜索栏'), '62')
    assert.equal(leadingTokenOf('- [ ] **G-40 题面甲** 正文'), 'G-40')
    assert.equal(leadingTokenOf('- [ ] P1-① 扩共享层首批:等容器运行时。'), 'P1-①')
    assert.equal(leadingTokenOf('不是复选框行'), null)
  })

  it('buildArchiveIndex:多文件行号累计;缺正文 ⇒ ok:false(判不出 ≠ 零份)', () => {
    const idx = archOf([
      { path: 'a.md', text: ['# 甲', '- [x] ✅(2026-09-01) 5. 甲任务'].join('\n') },
      { path: 'b.md', text: ['# 乙', '- [ ] 6. 乙任务'].join('\n') },
    ])
    assert.equal(idx.ok, true)
    assert.equal(idx.byId.get('5')[0].line, 2)
    assert.equal(idx.byId.get('5')[0].path, 'a.md')
    assert.equal(idx.byId.get('6')[0].line, 4, '第二份文件的行号从累计偏移继续')
    assert.equal(idx.byId.get('6')[0].state, 'open')
    const broken = archOf([{ path: 'a.md', text: '# 甲' }, { path: 'b.md' }])
    assert.equal(broken.ok, false, '任一份正文缺席 ⇒ 整面未判定')
  })

  it('台账面的接收方也吃题面收窄:同编号不同议题的 open 行不得顶替', () => {
    const openById = new Map([['4', [row(9, '- [ ] 4. 另一件完全不同的事', { key: '4' })]]])
    const v = pointerTargetVerdict(
      row(1, '- [ ] 副本指针(编号 4·观察期)：同一件事的第二份。'),
      openById,
      archOf([]),
    )
    assert.notEqual(v.verdict, 'ledger', '题面不匹配 ⇒ 不得当接收方')
    assert.equal(v.verdict, 'archive-absent', '台账判不出时落到归档面,归档空 ⇒ 缺席(拒删)')
    const v2 = pointerTargetVerdict(
      row(1, '- [ ] 副本指针(编号 4·观察期)：同一件事的第二份。'),
      new Map([
        ['4', [row(3, '- [ ] 4. 观察期:连续 3 次 main push e2e 稳定绿后收官。', { key: '4' })]],
      ]),
      archOf([]),
    )
    assert.equal(v2.verdict, 'ledger')
    assert.equal(v2.targets[0].line, 3)
  })
})

describe('批3 ③真实接线:analyzeLeases 判出的过期集才放行', () => {
  it('过期租约的副本行删、在飞租约的副本行留、任务行本体不代摘', () => {
    const text = [
      '- [ ] 3. 主行甲(进行中@2020-01-01/某人)',
      '- [ ] 副本指针(编号 3)：同主键第二份未勾选副本(进行中@2020-01-02/乙)',
      '- [ ] 副本指针(编号 3)：同主键第二份未勾选副本(进行中@2099-01-02/丙)',
    ].join('\n')
    const { inProgress } = scanTasks(text)
    const ttl = resolveTtlHours(null, undefined)
    const lease = analyzeLeases(inProgress, {
      nowMs: Date.parse('2026-10-29T00:00:00Z'),
      ttlHours: ttl.ttlHours,
    })
    const staleLeaseLines = new Set(lease.stale.map((v) => v.line))
    assert.deepEqual([...staleLeaseLines].sort(), [1, 2], '过期 = 主行甲 + 乙那条副本(2099 在飞)')
    const rows = [
      row(1, '- [ ] 3. 主行甲(进行中@2020-01-01/某人)', {
        key: '3',
        claim: '（进行中@2020-01-01/某人）',
      }),
      row(2, '- [ ] 副本指针(编号 3)：同主键第二份未勾选副本(进行中@2020-01-02/乙)', {
        claim: '（进行中@2020-01-02/乙）',
      }),
      row(3, '- [ ] 副本指针(编号 3)：同主键第二份未勾选副本(进行中@2099-01-02/丙)', {
        claim: '（进行中@2099-01-02/丙）',
      }),
    ]
    const d = selectCopyRowsToPurge(rows, { expiredLease: true, staleLeaseLines })
    assert.equal(d.length, 1, '只清过期租约里的自述副本行')
    assert.equal(d[0].row.line, 2)
    assert.equal(d[0].family, 'pointer-lease')
    assert.ok(!d.some((x) => x.row.line === 1), '过期租约的任务行本体绝不代摘(CLI 棘轮)')
    assert.ok(!d.some((x) => x.row.line === 3), '租约在飞的副本行保留')
  })
})

describe('⑤F9 / ⑥F1 过滤器(此前零测试)', () => {
  const cand = [
    {
      row: row(1, '- [ ] **G-70 题** 副本 - 【归并】重复登记副本'),
      family: 'merge-note',
      key: 'G-70',
    },
    { row: row(2, '- [ ] 副本指针(编号 G-71)：x'), family: 'pointer-row', key: 'G-71' },
    { row: row(3, '- [ ] **G-72 题** 主行'), family: 'merge-note', key: 'G-72' },
  ]
  it('⑤ 同键组判定进撞号组 ⇒ 剔;指针族走指向判定不查 F9(与补档前同口径)', () => {
    const kept = filterCandidates(cand, { f9Keys: new Set(['G-70', 'G-71']) })
    assert.deepEqual(
      kept.map((d) => d.row.line),
      [2, 3],
    )
  })
  it('⑥ F1 分叉活行 ⇒ 剔', () => {
    assert.deepEqual(
      filterCandidates(cand, { forkOpenLines: new Set([3]) }).map((d) => d.row.line),
      [1, 2],
    )
  })
  it('两维空集 ⇒ 一条不少(不误杀)', () => {
    assert.equal(filterCandidates(cand).length, 3)
  })
})

describe('安全阀 2 verifyNewFace:副本行全集精确对账', () => {
  const BEFORE = [
    '- [ ] 62. 主任务',
    '- [ ] 副本指针(编号 62)：同主键第二份未勾选副本。',
    '- [ ] 51. 另一件',
  ].join('\n')
  const del = [
    {
      row: row(2, '- [ ] 副本指针(编号 62)：同主键第二份未勾选副本。'),
      family: 'pointer-row',
      key: '62',
    },
  ]
  it('批1 删 1 行副本 ⇒ 全集 1→0,无 violations', () => {
    const after = ['- [ ] 62. 主任务', '- [ ] 51. 另一件'].join('\n')
    const { violations, stats } = verifyNewFace({
      beforeContent: BEFORE,
      afterContent: after,
      candidates: del,
    })
    assert.deepEqual(violations, [])
    assert.equal(stats.beforeCopyRows, 1)
    assert.equal(stats.afterCopyRows, 0)
  })
  it('少减(副本行还在)⇒ 红', () => {
    const { violations } = verifyNewFace({
      beforeContent: BEFORE,
      afterContent: BEFORE,
      candidates: del,
    })
    assert.ok(violations.some((v) => v.includes('副本行全集')))
  })
  it('多减(把非副本行算成副本)⇒ 红', () => {
    const after = ['- [ ] 51. 另一件'].join('\n')
    const cands = [...del, { row: row(1, '- [ ] 62. 主任务'), family: 'merge-note', key: '62' }]
    const { violations } = verifyNewFace({
      beforeContent: BEFORE,
      afterContent: after,
      candidates: cands,
    })
    assert.ok(violations.some((v) => v.includes('副本行全集')))
  })
  it('批1 动到落账注记 ⇒ 红(注记行是批2对象)', () => {
    const after = [
      '- [ ] 62. 主任务',
      '- [ ] 51. 另一件 - 〔【归并】G-51 落账:复测 2026-10-01: 取证〕',
    ].join('\n')
    const { violations } = verifyNewFace({
      beforeContent: BEFORE,
      afterContent: after,
      candidates: del,
    })
    assert.ok(violations.some((v) => v.includes('mergeNotes')))
  })
  it('新面出现 F1 分叉 ⇒ 红;F9 声明组增加 ⇒ 红', () => {
    const forked = [
      '- [x] ✅(2026-10-01) G-80 题面甲',
      '- [ ] G-80 题面甲',
      '- [ ] 62. 主任务',
    ].join('\n')
    const r1 = verifyNewFace({
      beforeContent: '- [ ] G-80 题面甲',
      afterContent: forked,
      candidates: [],
    })
    assert.ok(r1.violations.some((v) => v.includes('F1')))
  })
  it('批2:注记必须降且降幅 === 被删行行级注记和', () => {
    const before = [
      '- [ ] **G-50 题** 主行',
      '- [ ] **G-50 题** 副本 - 〔【归并】G-50 落账:复测 2026-10-01: 取证〕',
    ].join('\n')
    const after = ['- [ ] **G-50 题** 主行'].join('\n')
    const cands = [
      {
        row: row(2, '- [ ] **G-50 题** 副本 - 〔【归并】G-50 落账:复测 2026-10-01: 取证〕'),
        family: 'settled-note',
        key: 'G-50',
      },
    ]
    assert.deepEqual(
      verifyNewFace({
        beforeContent: before,
        afterContent: after,
        candidates: cands,
        includeSettled: true,
      }).violations,
      [],
    )
    const flat = verifyNewFace({
      beforeContent: before,
      afterContent: before,
      candidates: cands,
      includeSettled: true,
    })
    assert.ok(flat.violations.some((v) => v.includes('批2必须下降')))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
