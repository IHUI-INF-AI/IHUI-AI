// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:直接 import 源脚本的 __test__,不复制判据实现。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ } from '../restore-plan-batch-block.mjs'

const { extractBlock, restoreBlock, assertPureInsertion } = __test__
const HEAD = '### 第二十四批(2026-09-23):标题'
const BODY = ['- 正文一', '- 正文二', '- 正文三']

test('源脚本必须 export __test__ 三个核心函数', () => {
  for (const k of ['extractBlock', 'restoreBlock', 'assertPureInsertion'])
    assert.equal(typeof __test__[k], 'function', `缺少 ${k}`)
})

test('标题在、正文缺 → 纯插入缺失行,原行原文原序一行不少', () => {
  const target = ['前文', HEAD, '- 正文二', '## 下一节']
  const { out, inserted } = restoreBlock(target, [HEAD, ...BODY])
  assert.equal(inserted, 2)
  assert.equal(out.filter((l) => l === HEAD).length, 1)
  assert.equal(out[out.indexOf(HEAD) + 1], '- 正文一')
  assert.doesNotThrow(() => assertPureInsertion(target, out, inserted))
})

test('幂等:整块已齐在时零改动(反向对照,防重复插入)', () => {
  const target = [HEAD, ...BODY]
  const { out, inserted } = restoreBlock(target, [HEAD, ...BODY])
  assert.equal(inserted, 0)
  assert.deepEqual(out, target)
})

test('连标题一起丢 → 整块追加而不是静默放弃', () => {
  const target = ['- 别人的在飞改动']
  const { out, inserted, appendedTitle } = restoreBlock(target, [HEAD, ...BODY])
  assert.equal(appendedTitle, true)
  assert.equal(inserted, 4)
  assert.ok(out.includes(HEAD) && out.includes('- 正文三'))
  assert.doesNotThrow(() => assertPureInsertion(target, out, inserted))
})

test('extractBlock 在下一个标题处收口,不吞他人批次', () => {
  const src = [HEAD, ...BODY, '', '### 第二十五批:他人批次', '- 不该被带走']
  const blk = extractBlock(src, /^###\s*第二十四批/)
  assert.equal(blk.lines.length, 4)
  assert.ok(!blk.lines.some((l) => l.includes('不该被带走')))
})

test('extractBlock 找不到标题时返回 null(不抛、不误插)', () => {
  assert.equal(extractBlock(['- 无标题'], /^###\s*第九十九批/), null)
})

test('空正文行不被当作缺失反复插(否则每跑一次多一行空白)', () => {
  const { inserted } = restoreBlock([HEAD, '- 正文一'], [HEAD, '', '- 正文一', ''])
  assert.equal(inserted, 0)
})

test('assertPureInsertion 拒绝"删旧插新"的替换式改写', () => {
  assert.throws(() => assertPureInsertion(['- 旧措辞', '- 保留'], ['- 新措辞', '- 保留'], 1))
})

test('assertPureInsertion 拒绝行数变化与声称值不符', () => {
  assert.throws(() => assertPureInsertion(['a'], ['a', 'b', 'c'], 1))
})

test('超序列判定对"顺序被打乱"敏感(原序是纯插入的一部分语义)', () => {
  assert.throws(() => assertPureInsertion(['x', 'y'], ['y', 'x'], 0))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
