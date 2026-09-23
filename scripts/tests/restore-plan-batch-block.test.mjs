// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:直接 import 源脚本的 __test__,不复制判据实现。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ } from '../restore-plan-batch-block.mjs'

const {
  extractBlock,
  extractBlockAt,
  headingMatches,
  resolveBlock,
  restoreBlock,
  assertPureInsertion,
} = __test__
const HEAD = '### 第二十四批(2026-09-23):标题'
const BODY = ['- 正文一', '- 正文二', '- 正文三']

test('源脚本必须 export __test__ 六个核心函数', () => {
  for (const k of [
    'extractBlock',
    'extractBlockAt',
    'headingMatches',
    'resolveBlock',
    'restoreBlock',
    'assertPureInsertion',
  ])
    assert.equal(typeof __test__[k], 'function', `缺少 ${k}`)
})

test('同号撞车(两枚"第十九批")必须报 ambiguous,绝不静默取首枚', () => {
  const src = [
    '### 第十九批(2026-09-23):守门 71 补盲区',
    '- 甲批正文',
    '### 第十九批:守门 70 覆盖补齐三端(2026-09-24)',
    '- 乙批正文',
  ]
  const r = resolveBlock(src, '第十九批')
  assert.equal(r.ok, false)
  assert.equal(r.reason, 'ambiguous')
  assert.equal(r.hits.length, 2)
  const pinned = resolveBlock(src, '第十九批(2026-09-23)')
  assert.equal(pinned.ok, true)
  assert.equal(pinned.block.lines[0], src[0])
  assert.equal(pinned.block.lines.length, 2)
})

test('批次名里的括号按字面量匹配,不当正则量词', () => {
  const src = ['### 第二十五批(2026-09-23):标题', '- 正文']
  assert.equal(resolveBlock(src, '第二十五批(2026-09-23)').ok, true)
  assert.equal(resolveBlock(src, '第二十五批(2099').ok, false)
  assert.equal(headingMatches(src, '第二十五批(2099').length, 0)
})

test('extractBlockAt 与兼容入口 extractBlock 给出同一块', () => {
  const src = ['# 计划', '', HEAD, ...BODY, '### 下一批']
  const byRe = extractBlock(src, /^###\s*第二十四批/)
  const byIdx = extractBlockAt(src, 2)
  assert.deepEqual(byRe, byIdx)
  assert.equal(byIdx.lines.length, 4)
  assert.equal(extractBlockAt(src, -1), null)
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
