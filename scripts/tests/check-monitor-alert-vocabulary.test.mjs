// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as gate } from '../check-monitor-alert-vocabulary.mjs'

const LISTS = {
  status: ['firing', 'suppressed', 'resolved'],
  severity: ['info', 'warning', 'critical'],
}

test('parseCanonical: 两条 as const 数组解析出取值', () => {
  const r = gate.parseCanonical(
    "export const MONITOR_ALERT_STATUSES = ['firing', 'suppressed', 'resolved'] as const\n" +
      "export const MONITOR_ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const",
  )
  assert.equal(r.ok, true)
  assert.deepEqual(r.lists.status, LISTS.status)
  assert.deepEqual(r.lists.severity, LISTS.severity)
})

test('parseCanonical: 缺数组/取值不足 ⇒ 不通过并点名', () => {
  assert.equal(gate.parseCanonical("export const MONITOR_ALERT_STATUSES = ['a','b'] as const").ok, false)
  const short = gate.parseCanonical(
    "export const MONITOR_ALERT_STATUSES = ['a'] as const\nexport const MONITOR_ALERT_SEVERITIES = ['x','y'] as const",
  )
  assert.equal(short.ok, false)
  assert.match(short.why, /MONITOR_ALERT_STATUSES/)
})

test('countVocabularyCopies: 仅通用 severity(无 status)不算副本', () => {
  assert.equal(gate.countVocabularyCopies("// 'info' 'warning' 'critical'", LISTS).copies, 0)
})

test('countVocabularyCopies: status 双值 ⇒ 1 份;status+severity 双值 ⇒ 2 份', () => {
  assert.equal(gate.countVocabularyCopies("'firing' 'suppressed'", LISTS).copies, 1)
  const both = gate.countVocabularyCopies("'firing' 'suppressed' 'info' 'warning'", LISTS)
  assert.equal(both.copies, 2)
})

test('countVocabularyCopies: 单值(库表默认值形态)不算副本', () => {
  assert.equal(gate.countVocabularyCopies(".default('firing')", LISTS).copies, 0)
})

test('isExcludedPath: canonical/tests/dist 排除,生产文件不排除', () => {
  assert.equal(gate.isExcludedPath('packages/types/src/monitor-vocabulary.ts'), true)
  assert.equal(gate.isExcludedPath('apps/web/src/__tests__/x.ts'), true)
  assert.equal(gate.isExcludedPath('packages/database/dist/schema/monitor.d.ts'), true)
  assert.equal(gate.isExcludedPath('apps/web/a.test.tsx'), true)
  assert.equal(gate.isExcludedPath('apps/web/src/lib/admin/monitor-alert-vocabulary.ts'), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
