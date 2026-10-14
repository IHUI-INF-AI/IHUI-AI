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
import { ratchetVerdict, countPointerRows, pointerRows, twinRatchetVerdict } from '../check-plan-dup-pointer-ratchet.mjs'
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
    // G-1 题面刻意与 G-2 不同:L5/L6(A5 单调性,2026-10-14)之后,剥注记会让行重新进入
    // foldTwins 的候选面 —— 若两行同题面而编号不同,剥注记会"造出"一个新的 F10 族,
    // A5 当场拦(它在真仓 HEAD 面实测为净减,不拦;这里改题面让夹具只测 L1/L3/认领转移)。
    `- [ ]（进行中）G-1 另一件真任务 ${NOTE}`, // L4:剥注记保留(无同题持有行)
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

test('P2b L5/L6 真归并:无注记重复行真删行,注记移植到幸存行,独有增量整行跳过(2026-10-14)', () => {
  // L6(F4):同复合主键的未勾副本(无任何注记)⇒ 删副本留幸存者(组内最长行),一行注记不产
  // (夹具形态照抄真仓实测:副本 = 幸存者标题的精确前缀,D18/82 两族都是这个形状)
  const l6 = [
    '# 计划',
    '- [ ] D21 同一件事(G-9)',
    '- [ ] D21 同一件事(G-9)。较长的那条登记,承载了更多上下文说明,是幸存行。',
  ]
  const p6 = buildPlan(l6)
  if (!p6.deleteSet.has(1)) throw new Error(`L6 应删短副本行,实得 ${[...p6.deleteSet]}`)
  const n6 = renderPurge(l6, p6)
  if (n6.length !== 2 || !n6[1].includes('较长的那条登记')) throw new Error(`L6 幸存行不对:${n6}`)
  if (verifyPurge(l6, n6, p6).length) throw new Error('L6 清偿不应触发守恒断言')
  if (countPointerRows(n6.join('\n')) !== 0) throw new Error('L6 不得产任何指针注记(用户禁令)')
  // L5(F10):同题面不同编号的可折行 ⇒ 删被折行留 keeper,候选行尾的让号/拍板段移植过去
  // (候选正文必须是幸存行的子串 —— 本夹具候选=纯标题行+注记,正文即题面,幸存行天然承载)
  const l5 = [
    '# 计划',
    '- [ ] G-801. 同一件事被并发登记成两个不同的号:第一份登记,持有行,后面是它的正文交代。',
    '- [ ] G-802. 同一件事被并发登记成两个不同的号 〔让号记录(2026-10-14):原号 G-802 同号多题,本行让出。〕',
  ]
  const p5 = buildPlan(l5)
  if (!p5.deleteSet.has(2)) throw new Error(`L5 应删被折行,实得 ${[...p5.deleteSet]}`)
  const n5 = renderPurge(l5, p5)
  if (n5.length !== 2) throw new Error(`L5 应一行不增不删地并成一行:${n5}`)
  if (!n5[1].includes('G-801') || !n5[1].includes('让号记录'))
    throw new Error(`keeper 丢失或移植段丢失:${n5[1].slice(0, 120)}`)
  if (verifyPurge(l5, n5, p5).length) throw new Error('L5 清偿不应触发守恒断言')
  // 准入闸:候选正文有幸存行未承载的独有增量 ⇒ 整行跳过点名,绝不硬删
  const lSkip = [
    '# 计划',
    '- [ ] G-901. 同一件事的两个号:第一份登记,持有行,正文很短。',
    '- [ ] G-902. 同一件事的两个号:第二份登记带着大量只有本行才有的关键发现与待拍板决定,幸存行完全没有这些内容,所以本行必须保留。',
  ]
  const pSkip = buildPlan(lSkip)
  if (pSkip.deleteSet.has(2) && !pSkip.skipped.some((s) => s.i === 2))
    throw new Error('独有增量的行被硬删了 ⇒ 准入闸失明')
  const nSkip = renderPurge(lSkip, pSkip)
  if (!nSkip.some((l) => l.includes('G-902'))) throw new Error('独有增量行被删 = 丢活账')
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

test('P6 F10 差值棘轮(维②):同题不同编号可折重复登记只拦变多,同键副本(F4)不归它管', () => {
  // 正向:HEAD 面 1 族,staged 面多登记一份同题不同号 ⇒ grew=true(拦)
  const head = [
    '# 计划',
    '- [ ] G-601. 同一件事被并发登记成两个号:第一份登记,持有行,正文交代。',
    '- [ ] G-602. 同一件事被并发登记成两个号',
  ]
  const staged = [
    ...head,
    '- [ ] G-603. 同一件事被并发登记成两个号:又一份登记,题面同、号不同。',
  ]
  const grew = twinRatchetVerdict(head.join('\n'), staged.join('\n'))
  if (grew.undetermined) throw new Error('判据未判定 ⇒ 不得当通过')
  if (!grew.grew) throw new Error(`新增同题不同号应判 grew,实得 ${JSON.stringify(grew)}`)
  // 反向一:面不变 ⇒ 不增(存量豁免的差值棘轮纪律)
  const same = twinRatchetVerdict(head.join('\n'), head.join('\n'))
  if (same.grew) throw new Error('面不变不得判 grew')
  // 反向二:F4 同键副本(编号同、题面同)不进本维 —— 那是守门 130 的 F4 维,重复设门=同罪两罚
  const f4pair = ['# 计划', '- [ ] D31 同一件事(G-9)', '- [ ] D31 同一件事(G-9)。较长的正文。']
  const f4 = twinRatchetVerdict('# 计划', f4pair.join('\n'))
  if (f4.grew) throw new Error('同键副本被算进 F10 维 ⇒ 与守门 130 重复设门')
  // 收敛方向:删掉一份 ⇒ 不增(变少永远放行)
  const shrunk = twinRatchetVerdict(staged.join('\n'), head.join('\n'))
  if (shrunk.grew) throw new Error('变少被拦 ⇒ 棘轮方向反了')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
