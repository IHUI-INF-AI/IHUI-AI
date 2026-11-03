// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 O67 的镜像测试:索引里「已暂存但不在本票声明集」的只读点名判据。
 * 判据单源 = scripts/lib/staged-ownership.mjs(__test__ 直接 import,测试不复写常量,§22c)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as own } from '../lib/staged-ownership.mjs'

test('纯净索引:暂存集 == 声明集 ⇒ 零点名(format 返回 null)', () => {
  const staged = ['apps/api/src/a.ts', 'scripts/x.mjs']
  const extra = own.partitionUndeclaredStaged(staged, [...staged])
  assert.deepEqual(extra, [])
  assert.equal(own.formatUndeclaredLine(extra), null)
})

test('混入非声明件:只列差的那些,保序', () => {
  const staged = ['apps/api/src/relay-task-center.ts', 'packages/i18n/messages/web/zh-CN.json', 'scripts/x.mjs']
  const declared = ['scripts/x.mjs']
  const extra = own.partitionUndeclaredStaged(staged, declared)
  assert.deepEqual(extra, ['apps/api/src/relay-task-center.ts', 'packages/i18n/messages/web/zh-CN.json'])
  const line = own.formatUndeclaredLine(extra)
  assert.match(line, /2 个已暂存件\*\*不在本票声明集\*\*/)
  assert.match(line, /只点名,不拒发/)
})

test('归一化同一把尺:反斜杠 / ./ 前缀不算"外来件"', () => {
  const staged = ['apps\\api\\src\\a.ts', './scripts/x.mjs']
  const declared = ['apps/api/src/a.ts', 'scripts/x.mjs']
  assert.deepEqual(own.partitionUndeclaredStaged(staged, declared), [])
})

test('重复路径去重(父子进程反复 add 不刷屏)', () => {
  const extra = own.partitionUndeclaredStaged(['a.ts', './a.ts', 'a.ts'], ['b.ts'])
  assert.deepEqual(extra, ['a.ts'])
})

test('超过上限截断并报余数(静默截断与"没有"同形)', () => {
  const extra = Array.from({ length: 11 }, (_, i) => `f${i}.ts`)
  const line = own.formatUndeclaredLine(extra, { limit: 8 })
  assert.match(line, /11 个已暂存件/)
  assert.match(line, /另 3 条/)
})

test('空输入与 null 容错', () => {
  assert.deepEqual(own.partitionUndeclaredStaged([], ['x']), [])
  assert.deepEqual(own.partitionUndeclaredStaged(null, null), [])
  assert.equal(own.formatUndeclaredLine([]), null)
  assert.equal(own.formatUndeclaredLine(null), null)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
