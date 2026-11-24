// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/check-gate-owner-declaration.mjs` 的镜像测试(元门 D)。
 *
 * 阴性对照:改了**已登记属主**的门、提交信息却没写 `Gate-Owner:` ⇒ 必须判红。
 * 阳性对照:同一改动带上属主声明 ⇒ 不判红;改**未登记属主**的门 ⇒ 只列清单不判红
 * (本仓现在大量门没有属主,不能为了变绿把它们批量填成"公共")。
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { judgeOwnerDeclarations, loadRegistry } from '../check-gate-owner-declaration.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const OWNED = new Map([['scripts/check-a.mjs', 'line-x']])
const UNOWNED = new Set(['scripts/check-b.mjs'])

test('阴性对照:改已登记属主的门但缺 Gate-Owner 声明 ⇒ 判红', () => {
  const r = judgeOwnerDeclarations({ changed: ['scripts/check-a.mjs'], owned: OWNED, unowned: UNOWNED, message: 'fix: 顺手改一下' })
  assert.equal(r.missing.length, 1)
  assert.equal(r.missing[0].ownerId, 'line-x')
})

test('阳性对照:提交信息带 `Gate-Owner: <属主>` ⇒ 不判红', () => {
  const r = judgeOwnerDeclarations({
    changed: ['scripts/check-a.mjs'],
    owned: OWNED,
    unowned: UNOWNED,
    message: 'fix: 改门\n\nGate-Owner: line-x',
  })
  assert.deepEqual(r.missing, [])
})

test('阳性对照:Gate-Owner 也可写脚本名(便于一个人改多门)', () => {
  const r = judgeOwnerDeclarations({
    changed: ['scripts/check-a.mjs'],
    owned: OWNED,
    unowned: UNOWNED,
    message: 'fix\n\nGate-Owner: check-a.mjs',
  })
  assert.deepEqual(r.missing, [])
})

test('多个属主可用逗号分隔;声明给错属主仍判红', () => {
  const r = judgeOwnerDeclarations({
    changed: ['scripts/check-a.mjs'],
    owned: OWNED,
    unowned: UNOWNED,
    message: 'fix\n\nGate-Owner: line-y, line-z',
  })
  assert.equal(r.missing.length, 1)
})

test('改未登记属主的门:只列清单,不判红', () => {
  const r = judgeOwnerDeclarations({ changed: ['scripts/check-b.mjs'], owned: OWNED, unowned: UNOWNED, message: 'fix' })
  assert.deepEqual(r.missing, [])
  assert.deepEqual(r.unownedChanged, ['scripts/check-b.mjs'])
})

test('登记表完全没覆盖的门:单独列出(登记表不完整)', () => {
  const r = judgeOwnerDeclarations({ changed: ['scripts/check-c.mjs'], owned: OWNED, unowned: UNOWNED, message: 'fix' })
  assert.deepEqual(r.uncovered, ['scripts/check-c.mjs'])
  assert.deepEqual(r.missing, [])
})

test('登记表异常:同一门同时出现在 owners 与 unowned ⇒ 未判定', () => {
  const dir = mkScratch('gate-owners-test')
  try {
    const file = join(dir, 'reg.json')
    writeFileSync(
      file,
      JSON.stringify({ owners: { 'line-x': { scripts: ['check-a.mjs'] } }, unowned: [{ script: 'check-a.mjs', owner: null }] }),
      'utf8',
    )
    const reg = loadRegistry(file)
    assert.equal(reg.ok, false)
    assert.match(reg.error, /自相矛盾/)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
