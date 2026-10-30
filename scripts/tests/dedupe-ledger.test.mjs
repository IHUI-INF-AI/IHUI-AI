// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * dedupe-ledger 镜像测试(2026-10-15,机制根治 union 重复再生)。
 * 每一臂成对:该折的必须折得动、该放过的绝不能碰,且零损失断言不过 ⇒ 整批不落。
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  dedupeByFingerprint,
  pickBest,
  uniqueNotes,
  latestNoteDate,
  selfIdOf,
  noteSegments,
  collapseDuplicateNotes,
} from '../lib/dedupe-ledger.mjs'
import { __test__ as U } from '../union-converge.mjs'

describe('dedupeByFingerprint 基础折叠', () => {
  it('同题不同号必折叠成 1 行,行数 = 原行数 - (组大小-1)', () => {
    const src = [
      '# 台账',
      '- [ ] G-100 **修复登录超时问题** 详情甲',
      '- [ ] G-999 **修复登录超时问题。** 详情乙(2026-10-13)',
      '',
    ].join('\n')
    const out = dedupeByFingerprint(src)
    const taskLines = out.split('\n').filter((l) => /^- \[ \]/.test(l))
    assert.equal(taskLines.length, 1, `两行同题应折叠成 1 行,实得 ${taskLines.length}`)
  })

  it('不同题不折叠', () => {
    const src = [
      '- [ ] G-100 **修复登录超时问题**',
      '- [ ] G-101 **新增导出报表功能**',
      '',
    ].join('\n')
    assert.equal(dedupeByFingerprint(src), src, '不同题必须逐字不动')
  })

  it('幂等:无同题组时原样返回(连 split/join 都不改写)', () => {
    const src = '# 台账\n- [ ] G-100 **唯一一件事**\n'
    assert.equal(dedupeByFingerprint(src), src)
  })

  it('边角 A(焊死):已翻勾与未勾同题必须折叠成一行,保留已勾(完成态盖过待办态)', () => {
    const src = [
      '- [x] G-100 **修复登录超时问题** 〔✅(2026-10-10) 已联调〕',
      '- [ ] G-101 **修复登录超时问题** 〔进行中〕',
      '',
    ].join('\n')
    const out = dedupeByFingerprint(src)
    const tasks = out.split('\n').filter((l) => /^-\s*\[[ x]\]/.test(l.trim()))
    assert.equal(tasks.length, 1, '同题只留一行')
    assert.ok(tasks[0].startsWith('- [x]'), '保留的是已勾那一行的完成态')
    assert.ok(out.includes('进行中'), '被丢弃未勾行的独有注记并入保留行')
    assert.ok(out.includes('同题原号 G-101'), '被丢弃未勾行的票号并入(跨引用不断链)')
  })

  it('边角 A:两枚都已翻勾的同题也必须折叠成一行(不只未勾)', () => {
    const src = [
      '- [x] G-100 **修复登录超时问题** 〔✅(2026-10-10) A 侧完成〕',
      '- [x] G-999 **修复登录超时问题** 〔✅(2026-10-09) B 侧完成〕',
      '',
    ].join('\n')
    const out = dedupeByFingerprint(src)
    const tasks = out.split('\n').filter((l) => /^-\s*\[x\]/.test(l.trim()))
    assert.equal(tasks.length,1,'两枚已勾同题只留一行')
    assert.ok(out.includes('A 侧完成') && out.includes('B 侧完成'), '两侧独有注记都不丢')
    assert.ok(out.includes('同题原号 G-999'))
  })

  it('边角 A:未勾 vs 已勾,保留行优先取已勾,且未勾侧独有注记不丢', () => {
    const src = [
      '- [ ] G-100 **修复登录超时问题** 〔仅未勾侧有〕',
      '- [x] G-999 **修复登录超时问题**',
      '',
    ].join('\n')
    const out = dedupeByFingerprint(src)
    assert.ok(/^-\s*\[x\]/.test(out.split('\n')[0]), '保留已勾')
    assert.ok(out.includes('仅未勾侧有'), '未勾侧的独有注记并入保留行')
  })
})

describe('零损失:被丢弃行的独有信息必须并入保留行', () => {
  it('独有 〔…〕 注记段被并入保留行,不得丢', () => {
    const src = [
      '- [ ] G-100 **修复登录超时问题** 〔✅(2026-10-15) 已联调〕',
      '- [ ] G-999 **修复登录超时问题** 〔✅(2026-10-14) 初版已完成前端〕',
      '',
    ].join('\n')
    const out = dedupeByFingerprint(src)
    assert.equal(out.split('\n').filter((l) => /^- \[ \]/.test(l)).length, 1)
    assert.ok(out.includes('已联调'), '保留行自带注记必须还在')
    assert.ok(out.includes('初版已完成前端'), '被丢弃行的独有注记必须并入')
    assert.ok(out.includes('同题原号 G-999'), '被丢弃行的票号必须并入(跨引用不断链)')
  })

  it('保留行自身的票号不被重复记进"同题原号"', () => {
    const src = [
      '- [ ] G-100 **修复登录超时问题**',
      '- [ ] G-999 **修复登录超时问题**',
      '',
    ].join('\n')
    const out = dedupeByFingerprint(src)
    assert.ok(out.includes('G-100'), '保留行自带号必须在')
    assert.ok(out.includes('同题原号 G-999'), '另一号并入')
    assert.ok(!/同题原号[^〕]*G-100/.test(out), '保留行自身号不得又写进同题原号')
  })

  it('两条独有注记都被并入(多副本折叠)', () => {
    const src = [
      '- [ ] G-100 **修复登录超时问题** 〔甲独有〕',
      '- [ ] G-999 **修复登录超时问题** 〔乙独有〕',
      '- [ ] G-888 **修复登录超时问题** 〔丙独有〕',
      '',
    ].join('\n')
    const out = dedupeByFingerprint(src)
    assert.equal(out.split('\n').filter((l) => /^- \[ \]/.test(l)).length, 1)
    assert.ok(out.includes('甲独有') && out.includes('乙独有') && out.includes('丙独有'))
  })
})

describe('pickBest 择优选保留行', () => {
  it('优先级 ①:已翻勾 [x] 盖过未勾 [ ]', () => {
    const members = [
      { line: '- [ ] G-999 **修复登录超时问题** 最新', i: 0 },
      { line: '- [x] G-100 **修复登录超时问题** 旧', i: 1 },
    ]
    assert.equal(pickBest(members).i, 1, '已勾必须胜出')
  })

  it('优先级 ②:同态取最新注记日期', () => {
    const members = [
      { line: '- [ ] G-100 **修复登录超时问题** 〔✅(2026-10-01) 旧〕', i: 0 },
      { line: '- [ ] G-999 **修复登录超时问题** 〔✅(2026-10-20) 新〕', i: 1 },
    ]
    assert.equal(pickBest(members).i, 1, '日期更新者胜出')
  })

  it('优先级 ③:日期同级取字节最长', () => {
    const members = [
      { line: '- [ ] G-100 **修复登录超时问题** 短', i: 0 },
      { line: '- [ ] G-999 **修复登录超时问题** 这一段明显更长且信息更全', i: 1 },
    ]
    assert.equal(pickBest(members).i, 1, '字节更长者胜出')
  })
})

describe('边界:该放过的绝不能碰', () => {
  it('过短指纹(权重<16)不进组,不去重', () => {
    const src = ['- [ ] G-100 **修超时**', '- [ ] G-101 **修超时**', ''].join('\n')
    assert.equal(dedupeByFingerprint(src), src)
  })

  it('指针行(〔【归并】…〕)指纹为 null,原样透传', () => {
    const src = [
      '- [ ] G-100 **修复登录超时问题**',
      '- [ ]〔【归并】重复登记副本:本行与 G-100 同题,派单以那条为准〕',
      '',
    ].join('\n')
    assert.equal(dedupeByFingerprint(src), src, '存量指针行由 plan-tasks-merge 清偿,本模块不碰')
  })

  it('顺序保持:保留的是首次出现位置的那一行,其余删除', () => {
    const src = [
      '- [ ] G-100 **修复登录超时问题** 〔首次〕',
      '# 中间段落标题',
      '- [ ] G-999 **修复登录超时问题** 〔后续〕',
      '',
    ].join('\n')
    const out = dedupeByFingerprint(src)
    assert.ok(out.indexOf('修复登录超时问题') < out.indexOf('# 中间段落标题'), '保留行(首次出现)仍在前,删除行在后')
    assert.ok(out.includes('# 中间段落标题'), '非任务行不得被误删')
  })
})

describe('unionLines opts.dedupeTasks 接通(机制根治的落地开关)', () => {
  it('dedupeTasks=false(默认):行为逐字不变,不去重', () => {
    const ours = '- [ ] G-100 **修复登录超时问题**\n'
    const theirs = '- [ ] G-999 **修复登录超时问题**\n'
    const out = U.unionLines(ours, theirs, null)
    assert.equal(out.split('\n').filter((l) => /^- \[ \]/.test(l)).length, 2, '默认不开去重 ⇒ 两行都在')
  })

  it('dedupeTasks=true:产出即折叠成 1 行', () => {
    const ours = '- [ ] G-100 **修复登录超时问题** 〔甲〕\n'
    const theirs = '- [ ] G-999 **修复登录超时问题** 〔乙〕\n'
    const out = U.unionLines(ours, theirs, null, null, { dedupeTasks: true })
    const tasks = out.split('\n').filter((l) => /^- \[ \]/.test(l))
    assert.equal(tasks.length, 1, '开启去重 ⇒ 同题只留一行')
    assert.ok(out.includes('甲') && out.includes('乙'), '两侧独有注记都不丢')
    assert.ok(out.includes('同题原号 G-999'))
  })

  it('dedupeTasks=true 不影响 AGENTS/README 等同调路径(只在 PROJECT_PLAN 分支开启)', () => {
    // 调用方条件:unionLines(...,{dedupeTasks: p.endsWith('PROJECT_PLAN.md')})
    // 此处直接验证开关本身只作用于传入的文本,不波及无关路径 —— 无关路径根本不会传 true。
    const doc = '# AGENTS\n- [ ] G-100 **修复登录超时问题**\n- [ ] G-999 **修复登录超时问题**\n'
    assert.equal(
      U.unionLines(doc, doc, doc, null, { dedupeTasks: false }).split('\n').filter((l) => /^- \[ \]/.test(l)).length,
      2,
      '非台账路径不得去重',
    )
  })
})

describe('辅助函数', () => {
  it('latestNoteDate 取最大日期', () => {
    assert.equal(latestNoteDate('x 〔✅(2026-01-02)〕 y 〔✅(2026-10-20)〕'), '2026-10-20')
    assert.equal(latestNoteDate('无日期'), '')
  })
  it('selfIdOf / noteSegments', () => {
    assert.equal(selfIdOf('- [ ] G-123 **x**'), 'G-123')
    assert.equal(selfIdOf('- [ ] 无号 **x**'), null)
    assert.deepEqual(noteSegments('a 〔甲〕 b 〔乙〕'), ['〔甲〕', '〔乙〕'])
  })
  it('uniqueNotes 只返回保留行没有的段', () => {
    assert.equal(uniqueNotes('x 〔甲〕 〔乙〕', 'x 〔甲〕'), '〔乙〕')
    assert.equal(uniqueNotes('x 〔甲〕', 'x 〔甲〕 〔乙〕'), '')
  })
})

describe('G-240 族:同题组的注记不得按成员重复追加(旧写法一组 N 人产 N 条累计注记)', () => {
  const TITLE = '**折叠同题组不得按成员重复追加原号注记**'
  const src = [
    '# 台账',
    `- [ ] G-200 ${TITLE} 甲`,
    `- [ ] G-201 ${TITLE} 乙 〔进展@2026-10-13:已核〕`,
    `- [ ] G-202 ${TITLE} 丙`,
    `- [ ] G-203 ${TITLE} 丁 〔进展@2026-10-13:已核〕`,
    '',
  ].join('\n')

  it('四个成员折成 1 行 ⇒ 「同题原号」注记恰好一条,且一条就装下全部他号', () => {
    const out = dedupeByFingerprint(src).split('\n')
    const kept = out.filter((l) => l.includes(TITLE))
    assert.equal(kept.length, 1, `同题组必须只剩一行,实得 ${kept.length}`)
    const segs = noteSegments(kept[0])
    const idNotes = segs.filter((s) => s.startsWith('〔同题原号'))
    assert.equal(idNotes.length, 1, `原号注记必须恰好一条,实得 ${idNotes.length} 条:${JSON.stringify(idNotes)}`)
    const keptId = selfIdOf(kept[0])
    for (const other of ['G-200', 'G-201', 'G-202', 'G-203']) {
      if (other === keptId) continue
      assert.ok(idNotes[0].includes(other), `他号 ${other} 必须在同一条原号注记里(跨引用不断链)`)
    }
  })

  it('同一注记段在保留行只出现一次(两名成员各带同一条 〔进展…〕 时不得拼两遍)', () => {
    const kept = dedupeByFingerprint(src)
      .split('\n')
      .find((l) => l.includes(TITLE))
    const segs = noteSegments(kept)
    assert.equal(segs.length, new Set(segs).size, `注记段出现重复:${JSON.stringify(segs)}`)
    assert.equal(segs.filter((s) => s === '〔进展@2026-10-13:已核〕').length, 1)
  })

  it('幂等:再跑一遍逐字不变(重跑不增产注记,正是 63 条同注那一型的止口)', () => {
    const once = dedupeByFingerprint(src)
    assert.equal(dedupeByFingerprint(once), once)
  })

  it('反向锁:不同文的注记一条也不许折掉(信息守恒)', () => {
    assert.equal(collapseDuplicateNotes('x 〔甲〕 〔乙〕'), 'x 〔甲〕 〔乙〕')
    assert.equal(collapseDuplicateNotes('a 〔甲〕 b 〔甲〕 c 〔乙〕'), 'a 〔甲〕 b  c 〔乙〕')
    assert.equal(collapseDuplicateNotes('无注记的一行'), '无注记的一行')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
