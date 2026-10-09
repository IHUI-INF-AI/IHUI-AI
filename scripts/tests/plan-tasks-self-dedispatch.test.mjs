// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-tasks-self-dedispatch.test.mjs —— 派单口径认「行内自述不再单独派单」这一族的镜像测试。
 *
 * 判据本体不在这里重写:全部经 `isSelfDeDisclaimed` / `SELF_DEDISPATCH_RE` / `auditPlan` 生产入口裁定。
 *
 * 分工:
 *  · U1/U2 正面:两种自述措辞都要被认(漏一种 = 那一族仍进派单清单)。
 *  · U3/U4 **反向对照(本判据的假阳线)**:`勿照本行数字` / `勿照本行取字面数字` 说的是"数字不可照抄",
 *    活仍要做 —— 认了就是把真待办静默踢出派单面(§1:把没做的记成做过的比原病更响)。
 *  · U5 普通活待办不被误认。
 *  · E1/E2 端到端:同一份台账面里,自述行**不进** claimableRows 而真活票**进**,且两行勾选状态一字未动。
 *  · S1 源码锁:判据不得被并进 `VOID_MARK_RE` 或 `DUP_POINTER_RE`(那两处有 30+ 消费点与配对改写规则)。
 */
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  auditPlan,
  isSelfDeDisclaimed,
} from '../lib/plan-task-index.mjs'

test('U1 「本行不再单独派单」被认', () => {
  const line =
    '- [ ] P1 区段头「更多」与箭头折成两行 ⇒ 派单以题面中较长的那条为准,本行不再单独派单。'
  const got = (() => {
    try {
      return isSelfDeDisclaimed(line)
    } catch {
      return false
    }
  })()
  if (!got) throw new Error('自述"不再单独派单"的行必须被扣出派单口径')
})

test('U2 「派单一律走持有行」被认', () => {
  const line = '- [ ] /api/agent/goal-verify 无生产消费方,派单一律走持有行,勿照本行。'
  if (!isSelfDeDisclaimed(line)) throw new Error('走持有行的自述必须被认')
})

test('U3 反向对照:勿照本行**数字** 不得被认(那是数字口径,不是作废声明)', () => {
  const line = '- [ ] G-631 给吸收台账补具名清单 —— 派单前先看现量,勿照本行数字'
  if (isSelfDeDisclaimed(line)) throw new Error('把真待办静默踢出派单口径 = 比原病更响')
})

test('U4 反向对照:勿照本行**取字面数字** 不得被认', () => {
  const line = '- [ ] 守门现读值一律跑该门自己,勿照本行取字面数字'
  if (isSelfDeDisclaimed(line)) throw new Error('同上:这一族必须留在派单面')
})

test('U5 普通活待办不被误认', () => {
  if (isSelfDeDisclaimed('- [ ] 新增导出并配镜像测试')) throw new Error('无声明的真活票不得被扣')
})

const FACE = [
  '# t',
  '',
  '- [ ] 真活票甲:补一条具名清单并跑镜像',
  '- [ ] 真活票乙:派单以题面中较长的那条为准,本行不再单独派单',
  '- [ ] 真活票丙:派单前先看现量,勿照本行数字',
  '- [x] 已完成的登记:落账复测 2026-10-09',
].join('\n')

test('E1 端到端:自述行不进 claimableRows,而"勿照本行数字"那行仍进', () => {
  const a = auditPlan(FACE)
  const lines = a.claimableRows.map((r) => r.line)
  if (lines.includes(4)) throw new Error('第 4 行自述"不再单独派单",必须被扣出派单口径')
  if (!lines.includes(5)) throw new Error('第 5 行只是"数字不可照抄",活仍在 —— 不得被扣')
  if (!lines.includes(3)) throw new Error('第 3 行是无声明的真活票,不得被扣')
})

test('E2 端到端:计数与名单同面同轮,且勾选一字未动', () => {
  const a = auditPlan(FACE)
  if (a.counts.selfDedispatchRows !== 1)
    throw new Error(`计数应为 1,实得 ${String(a.counts.selfDedispatchRows)}`)
  const one = a.counts.selfDedispatchList?.[0]
  if (!one || one.line !== 4) throw new Error('报数必须报名:名单要点名第 4 行')
  if (!/本行不再单独派单/.test(FACE.split('\n')[4 - 1])) throw new Error('夹具自身失效')
  if (a.counts.open === undefined) throw new Error('auditPlan 未产出 open 计数')
  if (!/^- \[x\] 已完成的登记/m.test(FACE)) throw new Error('夹具的勾选形态不得被改动')
})

test('S1 源码锁:判据不得被并进 VOID_MARK_RE / DUP_POINTER_RE(消费面不同)', () => {
  const src = readFileSync(new URL('../lib/plan-task-index.mjs', import.meta.url), 'utf8')
  const re = (name) => {
    const m = src.match(new RegExp(`export const ${name} =\\s*([^\\n]+)`))
    return m ? m[1] : ''
  }
  for (const name of ['VOID_MARK_RE', 'DUP_POINTER_RE']) {
    if (/本行不再单独派单|SELF_DEDISPATCH/.test(re(name)))
      throw new Error(`${name} 被并入本判据 = 让 F2/归并器同时改行为,影响面远超派单口径`)
  }
  if (!/isSelfDeDisclaimed\(r\.raw\)/.test(src))
    throw new Error('判据必须真挂在 isClaimable 上,否则函数在而提交链不咬(守门 70/76/81 同型)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
