// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// F-042 回归:未签名临时 config 必须"每次构建独占一格"(并发构建不再互删),
// 且清理失败要反映到退出码。判据直接取生产实现(scripts/desktop-build.mjs 的 __test__),
// 不在测试里抄第二份。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { UNSIGNED_CONFIG_CONTENT, ensureUnsignedConfig, removeUnsignedConfig } from '../lib/desktop-unsigned-config.mjs'
import { __test__ as B } from '../desktop-build.mjs'

const { unsignedSlotForRun, exitCodeAfterCleanup } = B
const norm = (p) => String(p).replace(/\//g, '\\').toUpperCase()

test('正例:连续两次准备各得独占槽(带 pid + 随机段),槽名互不相同', () => {
  const a = unsignedSlotForRun()
  const b = unsignedSlotForRun()
  assert.notEqual(a, b, '两次构建不得共用同一格')
  assert.ok(a.startsWith('desktop-build-'), `槽名必须仍以 desktop-build- 开头:${a}`)
  assert.ok(a.includes(`-${process.pid}-`), `槽名必须带本次 pid:${a}`)
  assert.ok(b.includes(`-${process.pid}-`), `槽名必须带本次 pid:${b}`)
})

test('正例:两次并发准备各写一份,收掉一份不会删掉另一份', () => {
  const root = mkScratch('ihui-unsigned-f042-')
  try {
    const slotA = unsignedSlotForRun()
    const slotB = unsignedSlotForRun()
    const a = ensureUnsignedConfig(root, slotA)
    const b = ensureUnsignedConfig(root, slotB)
    assert.notEqual(a, b, '两次准备必须落到不同临时文件')
    assert.ok(norm(a).includes(norm(slotA)))
    assert.ok(norm(b).includes(norm(slotB)))
    assert.equal(readFileSync(a, 'utf8'), UNSIGNED_CONFIG_CONTENT)
    assert.equal(readFileSync(b, 'utf8'), UNSIGNED_CONFIG_CONTENT)

    const ra = removeUnsignedConfig(root, slotA)
    assert.equal(ra.removed, true)
    assert.equal(existsSync(a), false, '自己那份要收掉')
    assert.equal(existsSync(b), true, '另一轮构建的临时 config 不得被连带删除')
    assert.equal(readFileSync(b, 'utf8'), UNSIGNED_CONFIG_CONTENT)

    assert.equal(removeUnsignedConfig(root, slotB).removed, true)
  } finally {
    rmScratch(root)
  }
})

test('反例对照:清理确实失败(文件还在)⇒ 原本为绿的退出码被抬成非 0', () => {
  assert.equal(exitCodeAfterCleanup(0, { removed: false, leftover: true }), 2)
})

test('正例:清理成功 / 文件已不在(无残留)⇒ 退出码不动', () => {
  assert.equal(exitCodeAfterCleanup(0, { removed: true, leftover: false }), 0)
  assert.equal(exitCodeAfterCleanup(0, { removed: false, leftover: false }), 0)
})

test('正例:构建本身已红时,清理失败不改写原退出码(透传承诺)', () => {
  assert.equal(exitCodeAfterCleanup(1, { removed: false, leftover: true }), 1)
  assert.equal(exitCodeAfterCleanup(3, { removed: false, leftover: true }), 3)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
