// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/knip-ratchet-face.test.mjs — Knip 棘轮"口径闸门"的镜像测试(§22c)。
 *
 * 被测对象是**纯函数**,输入全是构造面:不派生 git、不跑 knip、不碰仓库瞬时状态
 * (证明取材面/口径这类行为只能靠纯函数 + 构造面 —— 守门 103 的 T12 同教训)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyFace, provenanceNote } from '../lib/knip-ratchet-face.mjs'

test('K1 本地脏树必判 incomparable,且理由里带条数(不许只说"不可比")', () => {
  const r = classifyFace({ ci: false, dirtyCount: 238 })
  assert.equal(r.verdict, 'incomparable')
  assert.match(r.reason, /238/)
})

test('K2 干净树判 comparable(反向对照:闸门不是一律判死)', () => {
  assert.equal(classifyFace({ ci: false, dirtyCount: 0 }).verdict, 'comparable')
})

test('K3 CI 干净检出判 comparable;CI 却有脏改动要判 incomparable 并点名配置异常', () => {
  assert.equal(classifyFace({ ci: true, dirtyCount: 0 }).verdict, 'comparable')
  const r = classifyFace({ ci: true, dirtyCount: 3 })
  assert.equal(r.verdict, 'incomparable')
  assert.match(r.reason, /checkout|配置/)
})

test('K4 问不到条数 ⇒ 判 undetermined,绝不冒判可比', () => {
  const r = classifyFace({ ci: false, dirtyCount: null })
  assert.equal(r.verdict, 'undetermined')
  assert.doesNotMatch(r.reason, /可比\b.*✓/)
  assert.match(r.reason, /无法判定/)
})

test('K5 出处标注三态互不串门,且 DIRTY 一定带"经人工放行"字样', () => {
  assert.match(provenanceNote({ comparable: true, dirtyCount: 0, forced: false }), /clean face/)
  const dirtyForced = provenanceNote({ comparable: false, dirtyCount: 42, forced: true })
  assert.match(dirtyForced, /DIRTY worktree\(42 个未提交改动\)/)
  assert.match(dirtyForced, /--allow-dirty/)
  assert.match(provenanceNote({ comparable: false, dirtyCount: null, forced: false }), /DIRTY worktree\(\?\)/)
})

test('K6 反向锁:脏树 + 未放行 与 脏树 + 放行 的文案必须不同形(静默放行 = 没有出处)', () => {
  const a = provenanceNote({ comparable: false, dirtyCount: 7, forced: false })
  const b = provenanceNote({ comparable: false, dirtyCount: 7, forced: true })
  assert.notEqual(a, b)
  assert.doesNotMatch(a, /人工放行/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
