// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'

// §22c:直接 import 源脚本导出的 __test__,不维护任何"镜像常量",杜绝源/测两份真相漂移。
// §22d:源脚本的 main() 受 isDirectRun 守护,被 import 时不得有任何副作用。
import { __test__ as src } from '../git-sync-converge.mjs'

test('导入源模块不得触发 main() 副作用(§22d isDirectRun)', () => {
  // 若 main() 被误执行,进程会因 process.exit 在此处直接终止,断言根本跑不到;
  // 这里额外校验导出对象形状齐全。
  for (const key of [
    'parseLsTreeZ',
    'verifySingleSided',
    'collectTreeEntries',
    'assertNoSilentRevert',
    'selfTest',
  ]) {
    assert.ok(key in src, `__test__ 缺少导出键 ${key}`)
  }
})

test('parseLsTreeZ:常规/空格/中文路径/空段', () => {
  const sample = '100644 blob aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\ta.txt\0' +
    '100755 blob bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\tsp ace/x 中文.ts\0' +
    '\0'
  const m = src.parseLsTreeZ(sample)
  assert.equal(m.get('a.txt'), '100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  assert.equal(m.get('sp ace/x 中文.ts'), '100755 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
  assert.equal(m.size, 2)
})

test('parseLsTreeZ:畸形条目抛错', () => {
  assert.throws(() => src.parseLsTreeZ('not-a-tree-entry\0'))
})

const BLOB_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const BLOB_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const BLOB_C = 'cccccccccccccccccccccccccccccccccccccccc'

test('verifySingleSided:本地单边变更被吞 → 1 违反(side=local)', () => {
  const v = src.verifySingleSided(
    new Map([['app.json', `100644 ${BLOB_A}`]]),
    new Map([['app.json', `100644 ${BLOB_B}`]]),
    new Map([['app.json', `100644 ${BLOB_A}`]]),
    new Map([['app.json', `100644 ${BLOB_A}`]]),
  )
  assert.equal(v.length, 1)
  assert.equal(v[0].path, 'app.json')
  assert.equal(v[0].side, 'local')
  assert.equal(v[0].expected, `100644 ${BLOB_B}`)
  assert.equal(v[0].actual, `100644 ${BLOB_A}`)
})

test('verifySingleSided:远端单边变更保留 → 0 违反', () => {
  const v = src.verifySingleSided(
    new Map([['f', `100644 ${BLOB_A}`]]),
    new Map([['f', `100644 ${BLOB_A}`]]),
    new Map([['f', `100644 ${BLOB_C}`]]),
    new Map([['f', `100644 ${BLOB_C}`]]),
  )
  assert.equal(v.length, 0)
})

test('verifySingleSided:单边删除被复活 → 违反(期望 null)', () => {
  const v = src.verifySingleSided(
    new Map([['k', `100644 ${BLOB_A}`]]),
    new Map(),
    new Map([['k', `100644 ${BLOB_A}`]]),
    new Map([['k', `100644 ${BLOB_A}`]]),
  )
  assert.equal(v.length, 1)
  assert.equal(v[0].expected, null)
  assert.equal(v[0].side, 'local')
})

test('verifySingleSided:单边删除被保留 → 0 违反', () => {
  const v = src.verifySingleSided(
    new Map([['k', `100644 ${BLOB_A}`]]),
    new Map(),
    new Map([['k', `100644 ${BLOB_A}`]]),
    new Map(),
  )
  assert.equal(v.length, 0)
})

test('verifySingleSided:双边互异 → 跳过(归 merge-tree 管)', () => {
  const v = src.verifySingleSided(
    new Map([['f', `100644 ${BLOB_A}`]]),
    new Map([['f', `100644 ${BLOB_B}`]]),
    new Map([['f', `100644 ${BLOB_C}`]]),
    new Map([['f', `100644 ${BLOB_B}`]]),
  )
  assert.equal(v.length, 0)
})

test('verifySingleSided:纯 mode 回退 → 违反', () => {
  const v = src.verifySingleSided(
    new Map([['run', `100644 ${BLOB_A}`]]),
    new Map([['run', `100755 ${BLOB_A}`]]),
    new Map([['run', `100644 ${BLOB_A}`]]),
    new Map([['run', `100644 ${BLOB_A}`]]),
  )
  assert.equal(v.length, 1)
  assert.equal(v[0].side, 'local')
})

test('verifySingleSided:单边重命名(删+增)保留 → 0 违反', () => {
  const v = src.verifySingleSided(
    new Map([['old', `100644 ${BLOB_A}`]]),
    new Map([['new', `100644 ${BLOB_A}`]]),
    new Map([['old', `100644 ${BLOB_A}`]]),
    new Map([['new', `100644 ${BLOB_A}`]]),
  )
  assert.equal(v.length, 0)
})
