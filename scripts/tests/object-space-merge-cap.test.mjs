#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `object-space-merge-cap` 的镜像用例(§22c:判据只住源脚本,这里 import `__test__` 直接用)。
 *
 * 钉的是"封顶后不许丢东西"这一条:闸拦下的是真丢失(git 三方合并实测吞过本侧登记行),
 * 所以本器的价值全在断言面上 —— 断言一旦不成立就必须拒绝落地,而不是"少带一行照样落"。
 * 全部纯内存,不建临时仓、不碰 git。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { __test__ as CAP } from '../object-space-merge-cap.mjs'

const { capMergedLines, LEDGER_ROW_RE } = CAP

test('判据单源:导出的就是源脚本那一份函数本体,不在测试里复算', () => {
  assert.equal(typeof capMergedLines, 'function')
  assert.equal(capMergedLines.name, 'capMergedLines')
})

test('两侧各存一份的同一组登记行 ⇒ 封顶到 max,不翻倍', () => {
  const ours = ['head', '- [ ] P1 同一行', '- [ ] P2 同一行', 'tail']
  const theirs = ['head', '- [ ] P1 同一行', '- [ ] P2 同一行', 'other']
  const merged = ['head', '- [ ] P1 同一行', '- [ ] P1 同一行', '- [ ] P2 同一行', '- [ ] P2 同一行', 'tail', 'other']
  const r = capMergedLines({ merged, ours, theirs })
  assert.equal(r.problemFree(), true, r.problems.join('\n'))
  assert.equal(r.countOf('- [ ] P1 同一行'), 1, '重复副本必须折到一份')
  assert.equal(r.countOf('- [ ] P2 同一行'), 1)
  assert.ok(r.kept.includes('tail') && r.kept.includes('other'), '两侧各自的独有行都还得在场')
})

test('git 合并吞掉的本侧登记行被补回,且落点不是 EOF', () => {
  const ours = ['- [x] P9 租约行', 'footer']
  const theirs = ['- [ ] P8 对侧行', 'footer']
  const merged = ['- [ ] P8 对侧行', 'footer']
  const r = capMergedLines({ merged, ours, theirs })
  assert.equal(r.problemFree(), true, r.problems.join('\n'))
  assert.deepEqual(r.restored, ['- [x] P9 租约行'])
  const idx = r.kept.indexOf('- [x] P9 租约行')
  assert.ok(idx > r.kept.indexOf('- [ ] P8 对侧行'), '补回点必须在台账块之后')
  assert.notEqual(idx, r.kept.length - 1, '绝不补到 EOF(兜底清扫轮会削尾吞票)')
})

test('两侧都没有、却出现在合并结果里的复合整行 ⇒ 保留一份而非删掉', () => {
  const r = capMergedLines({ merged: ['复合行', '复合行', 'a'], ours: ['a'], theirs: ['a'] })
  assert.equal(r.kept.filter((l) => l === '复合行').length, 1)
  assert.equal(r.problemFree(), true)
})

test('冲突标记在场 ⇒ 断言不过(不得落)', () => {
  const r = capMergedLines({ merged: ['<<<<<<< HEAD', 'a'], ours: ['a'], theirs: ['b'], anchorLedgerRows: false })
  assert.ok(r.problems.some((p) => p.includes('冲突标记')), '冲突标记必须被点名')
  assert.equal(r.problemFree(), false)
})

test('关掉登记行锚点 ⇒ 被吞的行无处可补,判 problems 交人工(失效方向是多要一次说明)', () => {
  const r = capMergedLines({ merged: ['x'], ours: ['- [ ] 缺席行'], theirs: ['x'], anchorLedgerRows: false })
  assert.equal(r.problemFree(), false, '没补回来却宣称通过 = 假绿')
  assert.ok(r.problems.some((p) => p.includes('本侧独有行丢失')))
})

test('本侧重复两行而合并结果只带回一行 ⇒ 按 max 配平补回(不是报 problems 就完事)', () => {
  const ours = ['- [ ] T 行', '- [ ] T 行']
  const theirs = ['- [ ] U 行']
  const merged = ['- [ ] T 行', '- [ ] U 行']
  const r = capMergedLines({ merged, ours, theirs })
  assert.equal(r.countOf('- [ ] T 行'), 2, 'want=2 就得真给到 2 份')
  assert.deepEqual(r.restored, ['- [ ] T 行'])
  assert.equal(r.problemFree(), true, r.problems.join('\n'))
})

test('登记行判定正则单源:顶层 `- [ ]`/`- [x]` 算,缩进与正文提及不算', () => {
  assert.equal(LEDGER_ROW_RE.test('- [ ] P1 开活'), true)
  assert.equal(LEDGER_ROW_RE.test('- [x] P1 结清'), true)
  assert.equal(LEDGER_ROW_RE.test('  - [ ] 缩进副本'), false)
  assert.equal(LEDGER_ROW_RE.test('正文里写 - [ ] 不算'), false)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
