// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-pointer-purge 的吸收折并(--absorb)与 L7 逐字孪生折并 —— 镜像测试(AGENTS §22c:
 * 判据实现直接从源脚本导入,禁止在本文件复制一份)。
 *
 * 钉住的形态锁(每条都对应一次真实失效方向):
 *  ① 不开 --absorb 时行为逐字不变:正文未被幸存行承载 ⇒ 交人工,一行都不许折(保守方向)
 *  ② 开 --absorb ⇒ 折并发生,且幸存行确实逐字承载了候选行的归一化正文(不是"折了就完事")
 *  ③ 承载段命中 13d 判据字面 ⇒ 整对跳过(不许绕棘轮写注记)
 *  ④ L7 折的是**逐字等值**孪生行,折完认领标记必须还活在幸存行上(A4 族级认领守恒)
 *  ⑤ 折并不得把未勾选行数改多(A2),也不得造出新的 F4/F10(A5 由源脚本自己的断言把关)
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { buildPlan, renderPurge, verifyPurge } from '../plan-pointer-purge.mjs'

const HEAD = ['# 计划', '', '']

function planOf(lines, opts) {
  const plan = buildPlan(lines, opts)
  const next = renderPurge(lines, plan)
  return { plan, next: next.filter((l) => l !== null) }
}

test('① 不开 --absorb:承载不成立 ⇒ 交人工,一行不折(既有行为逐字不变)', () => {
  const lines = [
    ...HEAD,
    '- [ ] G-10 **标题甲** —— 完整正文,含只有这一行才有的关键发现(K-918472 实测区间)。',
    '- [ ] G-11 **标题甲** —— 完整正文,含只有这一行才有的关键发现。追加了独有的一段判据说明。',
  ]
  const { plan, next } = planOf(lines)
  assert.equal(plan.stats.L5 + plan.stats.L6, 0, '不开吸收档时这一对不得被折')
  assert.ok(plan.skipped.some((s) => /未承载的独有增量/.test(s.why)))
  assert.equal(next.filter((l) => l.startsWith('- [ ]')).length, 2)
})

test('② 开 --absorb:折并发生,且幸存行逐字承载候选行的归一化正文', () => {
  const lines = [
    ...HEAD,
    '- [ ] G-12 **标题乙** —— 同一件事的长正文,带甲种措辞的让号记录。',
    '- [ ] G-13 **标题乙** —— 同一件事的长正文,带乙种措辞的让号记录,另有一句只在这里出现的补充。',
  ]
  const { plan, next } = planOf(lines, { absorb: true })
  assert.equal(plan.stats.absorbed, 1, '--absorb 应折掉一对')
  const kept = next.find((l) => l.startsWith('- [ ]'))
  assert.ok(kept.includes('副本正文并入·承载整段:'), '幸存行必须带上承载段')
  const body = kept.split('副本正文并入·承载整段:')[1].replace(/〕$/, '')
  assert.ok(kept.includes(body) && body.length > 0, '承载段里就是候选行的归一化正文')
  assert.equal(next.filter((l) => l.startsWith('- [ ]')).length, 1)
})

test('③ 承载段会命中 13d 判据字面 ⇒ 整对跳过,绝不绕棘轮', () => {
  const lines = [
    ...HEAD,
    '- [ ] G-14 **标题丙** —— 正文甲,只有这一行独有的关键发现内容在这里完整登记。',
    '- [ ] G-15 **标题丙** —— 正文甲,只有这一行独有的关键发现内容在这里完整登记,且本行自带【归并】重复登记副本字样。',
  ]
  const { plan, next } = planOf(lines, { absorb: true })
  assert.equal(plan.stats.absorbed, 0, '命中 13d 字面的这一对不得被吸收折并')
  assert.equal(next.filter((l) => l.startsWith('- [ ]')).length, 2)
})

test('④ L7:逐字等值的孪生行可以折,而认领标记必须活在幸存行上(§1 门不代摘认领)', () => {
  const twin = '- [ ]（进行中@2026-10-15/mp-arb） **无编号叙述式待办** —— 两端各写了一份一模一样的话。'
  const lines = [...HEAD, twin, '一段与折并无关的散文。', twin]
  const { plan, next } = planOf(lines)
  assert.equal(plan.stats.L7, 1, '两条逐字相同的无主键待办应折掉一份')
  const kept = next.filter((l) => l.startsWith('- [ ]'))
  assert.equal(kept.length, 1)
  assert.ok(kept[0].includes('（进行中@2026-10-15/mp-arb）'), '折完认领牌还在')
  const errs = verifyPurge(lines, kept, plan)
  assert.deepEqual(errs.filter((e) => e.startsWith('A4')), [], 'A4 族级认领守恒必须仍绿')
})

test('⑤ 折并不得把未勾选行数改多,也不得造出新的注记残留(A2/A3)', () => {
  const twin = '- [ ] **一模一样的两行** —— 逐字等值。'
  const lines = [...HEAD, twin, twin, '- [ ] G-16 **另一件事** —— 独立正文。']
  const { plan, next } = planOf(lines)
  assert.equal(next.filter((l) => l.startsWith('- [ ]')).length, 2)
  assert.equal(next.filter((l) => /【归并】重复登记副本/.test(l)).length, 0)
  assert.deepEqual(verifyPurge(lines, next, plan), [])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
