// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-tasks 镜像测试(§22c)—— 判据跑在**构造面**上，真实文档只用来做"形态对得上"的正向证明。
 *
 * 为什么必须有这一份：`node scripts/plan-tasks.mjs --self-test` 是同一个模块自己写的断言，
 * 它和被测实现同源；这一文件从**外部** import 生产出口，证明"接线在位的判据"确实能被消费者拿到。
 *
 * §5c 溯源水印：本文件受 `scripts/watermark.mjs` 管理。
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { VOID_MARK_RE, auditPlan, findRotatedPointers } from '../lib/plan-task-index.mjs'
import { gitRaw } from '../lib/face-reader.mjs'
import { ratchetViolations } from '../plan-tasks.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const FIXTURE = [
  '# 计划',
  '- [x] ✅(2026-09-26) **D99 复合主键正例**:说明文字。',
  '- [ ] **D99 复合主键正例**:同一件事的旧副本还挂着 —— 该被 F1 点名。',
  '- [ ] **D98 未做的任务**:这条是真待办,不得被任何判据点名。',
  '- [ ] **D97 作废声明**:〔本行判:已完成,勿照本行派单〕—— 该被 F2 点名。',
  '- [ ] **D96 指针**:本行正题逐字存活于 L1 的同编号登记 —— L1 不是条目行,该被 F3 点名。',
  '- [x] ✅(2026-09-26) **D95 重复登记已完成**:两行逐字同态。',
  '- [x] ✅(2026-09-26) **D95 重复登记已完成**:两行逐字同态。',
  '',
].join('\n')

test('M1 构造面:三条判据各命中一条,且真待办不被点名', () => {
  const a = auditPlan(FIXTURE)
  if (a.counts.forks !== 1 || !a.forks[0].key.startsWith('D99')) throw new Error(`F1 判歪:${JSON.stringify(a.forks.map((f) => f.key))}`)
  if (a.counts.voidRows !== 1 || !a.voidRows[0].raw.includes('D97')) throw new Error(`F2 判歪:${JSON.stringify(a.voidRows.map((r) => r.line))}`)
  if (a.counts.rotatedPointers !== 1 || a.rotated[0].target !== 1) throw new Error(`F3 判歪:${JSON.stringify(a.rotated)}`)
  if (a.counts.claimable !== 2) throw new Error(`派单口径应为 2,实测 ${a.counts.claimable}`)
  const opened = a.claimableRows.map((r) => r.raw)
  if (!opened.some((s) => s.includes('D98')) || !opened.some((s) => s.includes('D96'))) throw new Error('派单口径漏掉真待办')
})

test('M2 反向对照:干净文档三条全零(判据不得无牙地一直红)', () => {
  const a = auditPlan(['- [ ] **D90 干净任务**:无人认领。', '- [x] ✅(2026-09-26) **D91 干净完成**:已落账。'].join('\n'))
  for (const k of ['forks', 'voidRows', 'rotatedPointers']) if (a.counts[k] !== 0) throw new Error(`${k} 应为 0,实测 ${a.counts[k]}`)
  if (a.counts.claimable !== 1) throw new Error(`派单口径应为 1,实测 ${a.counts.claimable}`)
})

test('M3 变异对照:把 F1 的判据对象拆开写,分叉必须消失(证明 F1 靠的是主键相等而非巧合)', () => {
  const mutated = FIXTURE.replace('- [ ] **D99 复合主键正例**:同一件事的旧副本还挂着', '- [ ] **D99 已被改写成另一件事**:内容完全不同')
  const a = auditPlan(mutated)
  if (a.counts.forks !== 0) throw new Error('拆掉同主键后 F1 仍报分叉 ⇒ 判据在巧合上发光')
  if (a.counts.rotatedPointers !== 1) throw new Error('变异不应波及 F3,实测变了')
})

/**
 * 真实形态样本取自**固定的历史 blob**(`0bc0af653df^` = 首次归并的前一版),不取当前 HEAD。
 *
 * 为什么不取 HEAD:这两条要证的是"判据认得现实里发生过的形态"。而现实已经**被自己修好了** ——
 * 清偿之后 HEAD 上就没有"判:裸副本"的未勾选行、也没有腐烂指针了,拿 HEAD 当夹具的断言
 * 会在成功那一轮变红(第一版正是如此)。钉一个历史版本 = 证明永久可复现;
 * 读不到该版本时**必须失败**,不许静默跳过(跳过就是把"没判"写成"判过了")。
 */
const SAMPLE_REV = '0bc0af653df^'
function realSample() {
  const lines = gitRaw(['show', `${SAMPLE_REV}:PROJECT_PLAN.md`], ROOT).split(/\r?\n/)
  const voidRows = lines.filter((l) => /^\s*- \[ \]/.test(l) && /判:裸副本|勿照本行派单/.test(l))
  const pointerRows = lines.filter((l) => /存活于\s*L\d{1,6}/.test(l))
  return { voidRows, pointerRows }
}

test('M4 真实形态正向证明:历史 HEAD 里"判:裸副本"那批行必须被 F2 认得(§22c)', () => {
  const { voidRows } = realSample()
  if (voidRows.length === 0) throw new Error(`${SAMPLE_REV} 里读不到"判:裸副本/勿照本行派单"的未勾选行 —— 样本钉死失效,须换一个历史版本,不得跳过`)
  const a = auditPlan(voidRows.join('\n'))
  if (a.voidRows.length !== voidRows.length) throw new Error(`F2 对真实形态漏判:${a.voidRows.length}/${voidRows.length}`)
  if (!VOID_MARK_RE.test(voidRows[0])) throw new Error('VOID_MARK_RE 不认第一条真实样本')
})

test('M5 真实文档的行号指针确实会腐烂(F3 守的是发生过的事,不是假想)', () => {
  const { pointerRows } = realSample()
  if (pointerRows.length === 0) throw new Error(`${SAMPLE_REV} 里已无 L 号指针样本 —— 换历史版本,不得跳过`)
  const bad = findRotatedPointers(pointerRows.join('\n'))
  if (bad.length === 0) throw new Error('F3 对真实形态一条都没点到 ⇒ 判据对该形态失明')
  const known = ['目标行不存在', '目标行不是条目行', '目标行是另一条(复合主键不等)']
  for (const b of bad) if (!known.includes(b.reason)) throw new Error(`出现未登记的原因分类:${b.reason}`)
})

test('M6 棘轮只点名上涨:等值/下降/缺项/坏值都不许判红', () => {
  const items = [['F1', '同主键两态并存(组)', 5], ['F2', '带作废声明未落账(行)', 3], ['F3', '行号指针已腐烂(处)', 0]]
  if (ratchetViolations(null, items).length !== 0) throw new Error('无基线时不得凭空判红')
  const one = ratchetViolations({ F1: 4, F2: 3, F3: 0 }, items)
  if (one.length !== 1 || !one[0].includes('F1')) throw new Error(`应只点名上涨项,实测 ${JSON.stringify(one)}`)
  if (ratchetViolations({ F1: 9, F2: 9 }, items).length !== 0) throw new Error('低于基线不得判红')
  if (ratchetViolations({ F1: 'x' }, items).length !== 0) throw new Error('基线坏值不得判红(也不得声称通过)')
})

test('M7 主键收窄:行文引用不得算第二次登记', () => {
  const src = ['- [x] ✅(2026-09-26) **D10 真条目**:说明。', '- [ ] **D11 另一件事**:见 D10 的结论。'].join('\n')
  const a = auditPlan(src)
  if (a.counts.forks !== 0) throw new Error(`引用被误算成分叉:${JSON.stringify(a.forks.map((f) => f.key))}`)
  if (a.counts.claimable !== 1) throw new Error('D11 应留在派单口径里')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
