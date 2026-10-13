// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 指针棘轮门 + 清偿脚本镜像测试 —— 从外部 import 生产出口,证明判据确实接在实现上。
 * 覆盖:① 棘轮差值(新增⇒红 / 不新增⇒绿 / 存量不担责);② 剥注记器三形态(〔〕/【】/（）)
 *      + 括号平衡(不误剥中文正文里的普通括注);③ 清偿分层(L1 外部持有行 / L2 族内 / L3 纯指针)
 *      + 认领转移;④ 守恒断言(A1 勾选态 / A3 注记归零 / A4 族级认领守恒)。
 */
import { test } from 'node:test'
import { ratchetVerdict, countPointerRows, pointerRows } from '../check-plan-dup-pointer-ratchet.mjs'
import { stripMergeNotes, buildPlan, renderPurge, verifyPurge } from '../plan-pointer-purge.mjs'

const NOTE =
  '〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记,派单以那条为准,本行不再单独派单。〕'
const NOTE2 = '**[归并]** 【归并】重复登记副本:本行与同标题登记 L6542(枚 b0d91000e)重复,以主行为准。'
const NOTE3 = '（【归并】重复登记副本·同题不同编号·2026-09-28·本行与同题登记的持有行重复,派单以持有行为准）'
const NOTE4 = '（【归并】重复登记副本:行首那个号是改派工具造出来的,派单以持有行为准。）'
const PROSE_PAREN = '正常正文(含中文括注:说明)保持不变。'

test('R1 棘轮:本次提交新增指针注记 ⇒ 红;不新增 ⇒ 绿', () => {
  const before = '- [ ] G-1 做点啥\n'
  const after = `- [ ] G-1 做点啥 ${NOTE}\n`
  const v1 = ratchetVerdict(before, after)
  if (v1.compliant) throw new Error('新增注记应判红')
  const v2 = ratchetVerdict(after, after)
  if (!v2.compliant) throw new Error('存量不担责:同面比对应绿')
  const v3 = ratchetVerdict(before, '- [ ] G-1 做点啥\n')
  if (!v3.compliant) throw new Error('未带注记应绿')
})

test('R2 countPointerRows/pointerRows:只数登记行,散文占位注释不数', () => {
  const doc = [
    `- [ ] A ${NOTE}`,
    '<!-- 已归档(2026-10-08:✅(2026-10-07) 〔【归并】重复登记副本(2026-09-28):x,完整内容在 archive.md -->',
    '- [ ] B 正常行',
    '[x] ✅(2026-10-09) 残缺行也带注记 ' + NOTE,
  ].join('\n')
  const n = countPointerRows(doc)
  if (n !== 2) throw new Error(`登记行注记数=${n},期望 2(A + 残缺行;占位注释不计)`)
  const rows = pointerRows(doc)
  if (rows.length !== 2 || rows[0].line !== 1 || rows[1].line !== 4)
    throw new Error(`行号=${JSON.stringify(rows.map((r) => r.line))},期望 [1,4]`)
})

test('P1 剥注记:〔〕/【】/（）三形态全剥,不动普通中文括注', () => {
  const cases = [
    [`- [ ] x ${NOTE}`, '- [ ] x'],
    [NOTE2, ''],
    [NOTE3, ''],
    [NOTE4, ''],
    [`- [ ] x ${PROSE_PAREN}`, `- [ ] x ${PROSE_PAREN}`],
  ]
  for (const [input, expect] of cases) {
    const got = stripMergeNotes(input).trim()
    if (got !== expect.trim()) throw new Error(`输入=${JSON.stringify(input.slice(0, 60))}\n得到=${JSON.stringify(got)}\n期望=${JSON.stringify(expect)}`)
  }
})

test('P2 清偿分层:L1 删副本留持有行 / L3 删纯指针 / 认领转移到持有行', () => {
  const lines = [
    '# 计划',
    `- [ ]（进行中）G-1 真任务持有行 ${NOTE}`, // L1:有外部持有行(本行是候选但也有同主键持有行?) —— 见下
    `- [ ] G-2 真任务持有行`,
    `- [ ] G-2 真任务持有行 ${NOTE}`, // L1:外部持有行存在 ⇒ 删
    `- [ ] ${NOTE}`, // L3:纯指针行
    `- [ ]（进行中@2026-10-01/张三）G-3 认领在副本上 ${NOTE}`, // 认领转移
    `- [ ] G-3 认领在副本上`, // 持有行(无认领)
  ]
  const plan = buildPlan(lines)
  const next = renderPurge(lines, plan)
  const text = next.join('\n')
  if (countPointerRows(text) !== 0) throw new Error(`注记残留:\n${text}`)
  // 持有行仍在(未丢任务;认领转移后持有行带认领前缀,故按任务文本判在场)
  if (!text.includes('G-2 真任务持有行')) throw new Error('L1 持有行被误删')
  if (!text.includes('G-3 认领在副本上')) throw new Error('L4/认领行被误删')
  // 认领已转移到持有行(剥除器可能留一个空格,允许)
  if (!/- \[ \]（进行中@2026-10-01\/张三）\s*G-3 认领在副本上/.test(text))
    throw new Error(`认领未转移到持有行:\n${text}`)
  // 纯指针行已删
  if (/^- \[ \]\s*$/m.test(text)) throw new Error('纯指针行未删')
  const errs = verifyPurge(lines, next, plan)
  if (errs.length) throw new Error(`守恒断言失败:${errs.join('; ')}`)
})

test('P3 守恒断言:A3 注记残留必红(有牙证明:注入一行注记,断言必须报错)', () => {
  const lines = ['# t', '- [ ] A 任务', `- [ ] A 任务 ${NOTE}`]
  const plan = buildPlan(lines)
  const next = renderPurge(lines, plan)
  // 正向:清偿后通过
  if (verifyPurge(lines, next, plan).length !== 0) throw new Error('清偿后应无断言失败')
  // 反向:手动在 next 里注入一行注记,断言必报 A3(证明判据真的在数,不是空过)
  const corrupted = next.slice()
  corrupted.push(`- [ ] 注入的 ${NOTE}`)
  const errs = verifyPurge(lines, corrupted, plan)
  if (!errs.some((e) => e.startsWith('A3'))) throw new Error(`A3 未报警:${errs.join('; ')}`)
})

test('P4 守恒断言:A1 已勾选行数变化必红(有牙证明)', () => {
  const lines = ['# t', '- [x] A 已完成', `- [x] A 已完成 ${NOTE}`]
  const plan = buildPlan(lines)
  const next = renderPurge(lines, plan)
  // 清偿:已勾带注记的只剥注记不删行
  const errs = verifyPurge(lines, next, plan)
  if (errs.length) throw new Error(`已勾剥注记不应触发断言:${errs.join('; ')}`)
  // 反向:删掉一条已勾行,断言必报 A1
  const corrupted = next.filter((l) => !l.includes('A 已完成'))
  const errs2 = verifyPurge(lines, corrupted, plan)
  if (!errs2.some((e) => e.startsWith('A1'))) throw new Error(`A1 未报警:${errs2.join('; ')}`)
})

test('P5 认领守恒按族断言:副本带认领、持有行无认领 ⇒ 认领必须转移到持有行后保留', () => {
  const lines = [
    '- [ ] G-5 持有行无认领',
    `- [ ]（进行中@2026-10-02/李四）G-5 持有行无认领 ${NOTE}`,
  ]
  const plan = buildPlan(lines)
  const next = renderPurge(lines, plan)
  const errs = verifyPurge(lines, next, plan)
  if (errs.length) throw new Error(`守恒断言失败:${errs.join('; ')}`)
  const text = next.join('\n')
  if (!/（进行中@2026-10-02\/李四）/.test(text)) throw new Error('认领标记随副本删除而消失')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
