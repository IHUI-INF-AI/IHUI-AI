// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * conflict-marker-guard 镜像测试(2026-10-25)。§22c:判据 import 源,零复制。
 * 输入全为构造字符串,不触真仓。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as G } from '../lib/conflict-marker-guard.mjs'

const LT = '<'.repeat(7)
const GT = '>'.repeat(7)
const EQ = '='.repeat(7)

test('M1 完整三元组必点(带 label / 裸标记两式);双段各记一次', () => {
  const a = ['line1', `${LT} HEAD`, 'ours', EQ, 'theirs', `${GT} origin/main`, 'tail'].join('\n')
  assert.deepEqual(G.findConflictMarkerRuns(a), [2])
  const b = [LT, 'x', EQ, 'y', GT].join('\n')
  assert.deepEqual(G.findConflictMarkerRuns(b), [1])
  const two = [`${LT} A`, 'p', EQ, 'q', `${GT} A`, 'clean', `${LT} B`, 'r', EQ, 's', `${GT} B`].join('\n')
  assert.deepEqual(G.findConflictMarkerRuns(two), [1, 7])
})

test('M2 保守向:孤立 <<<< / 缺 ====== / 缺 >>>>>> 的畸形引用一律不判(不为文档造假红)', () => {
  assert.deepEqual(G.findConflictMarkerRuns(`${LT} SEARCH\nbody\nmore`), [], '只有开放标记 ⇒ 不判')
  assert.deepEqual(G.findConflictMarkerRuns(`${LT} A\nno eq\n${GT} A`), [], '缺 ======= ⇒ 不判')
  assert.deepEqual(G.findConflictMarkerRuns(`just ${EQ} here\n${LT} late`), [], '等号行孤立 + 行尾新开端 ⇒ 不判')
})

test('M3 未闭合再开新段:锚移到最近一次,不双计不遗漏', () => {
  const t = [`${LT} A`, 'oops-never-closed', EQ, `${LT} B`, 'r', EQ, 's', `${GT} B`].join('\n')
  assert.deepEqual(G.findConflictMarkerRuns(t), [4])
})

test('M4 豁免面与 79 同族;真代码文件不豁免', () => {
  const marked = [`${LT} HEAD`, 'a', EQ, 'b', `${GT} x`].join('\n')
  const probe = (p) => {
    try {
      G.assertNoConflictMarkers(p, marked, { source: 'test' })
      return 'pass'
    } catch {
      return 'refuse'
    }
  }
  assert.equal(probe('scripts/check-no-conflict-markers.mjs'), 'pass')
  assert.equal(probe('scripts/tests/check-no-conflict-markers.test.mjs'), 'pass')
  assert.equal(probe('scripts/lib/conflict-marker-guard.mjs'), 'pass')
  assert.equal(probe('apps/cli/src/tools/file-edit.ts'), 'pass', 'PATCH SEARCH/REPLACE 与冲突形态同形(79 E1 豁免同款)')
  assert.equal(probe('apps/web/app/(main)/admin/monitor/wallboard/page.tsx'), 'refuse')
})

test('M5 非字符串/二进制/NUL 文本不瞎判;干净文本过;throw 消息含指路', () => {
  for (const v of [null, undefined, 42, {}]) G.assertNoConflictMarkers('x.ts', v, { source: 't' })
  G.assertNoConflictMarkers('x.bin', `${LT}\n${EQ}\n${GT}\u0000`, { source: 't' })
  G.assertNoConflictMarkers('ok.ts', 'const a = 1\nplain ${"=".repeat(7)} not a marker line\n', { source: 't' })
  assert.throws(
    () => G.assertNoConflictMarkers('y.tsx', [LT, 'a', EQ, 'b', `${GT} o`].join('\n'), { source: 'union' }),
    /冲突标记拒绝进树.*union.*y\.tsx/s,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
