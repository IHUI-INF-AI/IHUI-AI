// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 落地闸清单的打印形状测试(2026-10-20)。
 *
 * 钉的是"标题报 19、正文只列 15"这一型:截断必须**报名**并给出一条真跑得通的出路。
 * 判据一律 import 源模块(§22c),另配一道装车锁 —— 打印处必须真调用那个纯函数,
 * 否则函数只是"造好没装车",而旧形状会悄悄回来。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { __test__ as U } from '../union-converge.mjs'

const rows = (n) => Array.from({ length: n }, (_, i) => `PROJECT_PLAN.md 障碍 ${i + 1}`)

test('缺省档:超过打印上限 ⇒ 列前 15 条 + 报名余下条数并指向出路', () => {
  const out = U.formatBadReport(rows(19))
  assert.equal(out.length, 16, `15 条正文 + 1 条报名,实得 ${out.length}`)
  assert.match(out[15], /其余 4 条未打印/, `余数必须算对,实得:${out[15]}`)
  assert.match(out[15], /show-all-bad/, '必须给出路(可执行的旗标名),不能只喊"还有更多"')
  assert.equal(out.filter((l) => /其余 .* 条未打印/.test(l)).length, 1, '报名行只许一条')
})

test('--show-all-bad ⇒ 全列,且不再出现报名行', () => {
  const out = U.formatBadReport(rows(19), { showAll: true })
  assert.equal(out.length, 19)
  assert.ok(!out.some((l) => /未打印/.test(l)), '全列时不许再声称有余下')
  assert.equal(out[18], `   ${rows(19)[18]}`, '顺序照原清单,不重排')
})

test('边界:恰好等于上限 ⇒ 不虚报"其余 0 条"', () => {
  for (const n of [0, 1, 15]) {
    const out = U.formatBadReport(rows(n))
    assert.equal(out.length, n, `n=${n} 实得 ${out.length}`)
    assert.ok(!out.some((l) => /未打印/.test(l)), `n=${n} 不该有报名行`)
  }
  assert.deepEqual(U.formatBadReport(null), [], '清单取不到 ⇒ 空输出,不炸(也不冒充"没有障碍")')
  assert.deepEqual(U.formatBadReport(undefined, { showAll: true }), [])
})

test('装车锁:打印处必须真调用 formatBadReport,且裸 slice(0,15) 打印已不在源里', () => {
  const src = readFileSync(join(import.meta.dirname, '..', 'union-converge.mjs'), 'utf8')
  assert.ok(/for \(const line of formatBadReport\(p\.bad/.test(src), 'CLI 打印处必须走这个纯函数(否则函数只是没装车的备件)')
  assert.ok(!/p\.bad\.slice\(0, 15\)\)\s*console\.log/.test(src), '旧的静默截断形状不得回潮')
  assert.ok(/--show-all-bad/.test(src), '出路旗标必须在命令面上真存在(§0.8:文档不许写跑不通的出路)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
