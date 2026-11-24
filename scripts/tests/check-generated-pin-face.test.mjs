// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/check-generated-pin-face.mjs` 的镜像测试(元门 C)。
 *
 * 阴性对照:2026-11-07 的"派生钉面不一致" —— 钉值按 **worktree** 面算,却拿去判 **staged**
 * 提交 —— 必须判 `face-mismatch` 并点名 `pinnedBy=worktree`。
 * 阳性对照:同一面算出的钉值判 `ok`;三个面都不匹配判 `stale`(陈旧),不得洗成 ok。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { digestInputs, parsePin, renderPin } from '../lib/generated-input-pin.mjs'
import { judgeProduct } from '../check-generated-pin-face.mjs'

const IN_REL = 'packages/i18n/messages/en.json'

function digestFor(text) {
  return digestInputs([{ rel: IN_REL, text }])
}

test('阴性对照:钉按 worktree 算、被审面是 staged ⇒ face-mismatch 且点名 worktree', () => {
  const worktree = digestFor('{"hello":"hi"}')
  const staged = digestFor('{"hello":"hello"}')
  const perFace = new Map([
    ['head', staged],
    ['staged', staged],
    ['worktree', worktree],
  ])
  const parsed = { digest: worktree.digest, perInput: worktree.perInput }
  const r = judgeProduct(parsed, perFace, 'staged')
  assert.equal(r.status, 'face-mismatch')
  assert.equal(r.pinnedBy, 'worktree')
  assert.equal(r.auditFace, 'staged')
  assert.ok(r.diffs.length >= 1)
})

test('阳性对照:同一面算出的钉值 ⇒ ok', () => {
  const staged = digestFor('{"hello":"hello"}')
  const perFace = new Map([
    ['head', digestFor('{"hello":"head"}')],
    ['staged', staged],
    ['worktree', digestFor('{"hello":"wt"}')],
  ])
  const r = judgeProduct({ digest: staged.digest, perInput: staged.perInput }, perFace, 'staged')
  assert.equal(r.status, 'ok')
  assert.equal(r.pinnedBy, 'staged')
})

test('三个面都不匹配 ⇒ stale(不得判成 ok)', () => {
  const pinned = digestFor('{"hello":"old"}')
  const perFace = new Map([
    ['head', digestFor('{"hello":"a"}')],
    ['staged', digestFor('{"hello":"b"}')],
    ['worktree', digestFor('{"hello":"c"}')],
  ])
  const r = judgeProduct({ digest: pinned.digest, perInput: pinned.perInput }, perFace, 'head')
  assert.equal(r.status, 'stale')
  assert.match(r.pinnedBy, /none/)
})

test('钉块可解析:renderPin → parsePin 的 inputsSha256 与现算一致', () => {
  const inputs = [{ rel: IN_REL, text: '{"a":1}' }]
  const { digest } = digestInputs(inputs)
  const lines = renderPin({ generator: 'x', inputs, generatedAt: '2026-11-07T00:00:00Z' })
  const parsed = parsePin(lines.join('\n'))
  assert.equal(parsed.present, true)
  assert.equal(parsed.malformed, false)
  assert.equal(parsed.digest, digest)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
