// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/sync-readme-numbers.test.mjs
// ─────────────────────────────────────────────────────────────────────────
// sync-readme-numbers 覆盖面夹具(§22c:判据零复算 —— 散文替换直接复用清偿器/门 173 同一套)。
// 一对牙口:散文漂移必须被修掉(且历史快照区不批量改写);生成块漂移必须被修掉(块外逐字不动)。
// ─────────────────────────────────────────────────────────────────────────
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as SYNC } from '../lib/readme-prose-sync.mjs'

const BEGIN = '<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->'
const END = '<!-- END GENERATED NUMBERS -->'

test('T1 散文漂移必须被修掉:活性区替换,历史快照区不批量改写', () => {
  const text = [
    '# Demo',
    '- 4699 API 路由',
    '<!-- END RECENT UPDATES -->',
    '- 4699 API 路由',
  ].join('\n')
  const out = SYNC.syncProseText('README.md', text, { apiRoutes: 4700 })
  assert.equal(out.edits, 1, '活性区那 1 行陈旧数字必须被规划写回')
  const lines = out.text.split('\n')
  assert.equal(lines[1], '- 4700 API 路由')
  assert.equal(lines[3], '- 4699 API 路由', '历史快照区不得被批量改写(防跑步机)')
})

test('T2 生成块漂移必须被修掉:块内替换,块前/块后逐字不动', () => {
  const text = ['# Demo', BEGIN, 'guardianGates 299', END, 'tail'].join('\n')
  const fresh = [BEGIN, 'guardianGates 300', END].join('\n') + '\n'
  const out = SYNC.rebuildBlock(text, fresh, BEGIN, END)
  assert.equal(out, ['# Demo', BEGIN, 'guardianGates 300', END, 'tail'].join('\n'))
})
