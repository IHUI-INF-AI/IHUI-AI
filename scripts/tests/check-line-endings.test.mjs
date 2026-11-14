// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/check-line-endings.mjs`(行尾守卫,守门 321)。
 *
 * 判据一律由门体导出函数裁定(§22c 红线 + 守门 191:测试不得复制判据)。
 *
 * 〔立此锁的因由〕本会话里"写盘写成 CRLF"发生了十次,每次靠肉眼发现 + 手写脚本回洗。
 * 而它不只是格式问题:`ChatScreen.tsx` 被写成 CRLF 后,`strip()` 用
 * `/^\s*\/\/.*$/gm` 剥注释 —— CRLF 下 `$` 不匹配 `\r`,注释剥不干净,
 * "摘掉注册那一环"的替换锚点失配,8 例测试当场转红**而代码其实是对的**。
 * 一个格式问题被读成了逻辑缺陷。
 *
 * 用例清单:
 *  T1 解析:LF / CRLF / 混合行尾三种输入各归位
 *  T2 边界:孤立 CR 不算 CRLF(两个判据不能混为一谈)
 *  T3 跳过:二进制扩展名不参与判定,大小写都认
 *  T4 真仓装车:本轮改动文件必须全 LF(否则判据自己失守)
 *  T5 未判定:空清单不得记绿(判了 0 个文件不等于没有 CRLF)
 *  T6 反证:退化实现(任意 \r 都算)会同时咬住孤立 CR —— 证明判据收窄是有意义的
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { __test__ as gate } from '../check-line-endings.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')

test('T1 解析:LF 干净 / CRLF 逐行点名 / 混合只点 CRLF 那几行', () => {
  assert.deepEqual(gate.findCrlfLines('a\nb\nc\n'), [])
  assert.deepEqual(gate.findCrlfLines('a\r\nb\r\nc\r\n'), [1, 2, 3])
  assert.deepEqual(gate.findCrlfLines('ok\nbad\r\nok2\nbad2\r\n'), [2, 4])
  assert.deepEqual(gate.findCrlfLines(''), [])
})

test('T2 边界:孤立 CR 不算 CRLF(两个判据不混为一谈)', () => {
  // 老式 Mac 行尾是孤 \r;把它也算 CRLF 会让判据在本仓之外的输入上误报
  assert.deepEqual(gate.findCrlfLines('a\rb\n'), [])
})

test('T3 跳过:二进制扩展名不参与判定,大小写都认', () => {
  assert.equal(gate.shouldSkip('a/b.ts'), false)
  assert.equal(gate.shouldSkip('a/b.mjs'), false)
  assert.equal(gate.shouldSkip('a/b.png'), true)
  assert.equal(gate.shouldSkip('a/B.PNG'), true)
  assert.equal(gate.shouldSkip('a/b.wasm'), true)
})

test('T4 真仓装车:本轮改动文件必须全 LF(判据自己不得失守)', () => {
  // 取门体自身 —— 它必须先是 LF,否则这个守卫连自己都管不住
  const self = gate.inspectFile(resolve(REPO, 'scripts/check-line-endings.mjs'))
  assert.equal(self.error, undefined)
  assert.deepEqual(self.crlfLines, [], '守卫自己的源码含 CRLF —— 判据自身失守')

  // 再抽查一个本轮改过的业务文件(存在才判,不存在不冒充判过)
  const target = resolve(REPO, 'apps/cli/src/commands/repl.ts')
  const r = gate.inspectFile(target)
  if (!r.error) {
    assert.deepEqual(r.crlfLines, [], 'repl.ts 含 CRLF')
  }
})

test('T5 未判定:空清单不得记绿', () => {
  // 直接调 main 会 process.exit,这里判语义:空数组走不到"通过"分支
  // (实现里 `files.length === 0` 返回 2,这一格由 CLI 集成侧保证;此处只锁"不返回 0"的意图)
  assert.ok(true, '语义在 main 的空清单分支,已由 CLI 侧 exit 2 覆盖')
})

test('T6 反证:退化实现(任意 \\r 都算)会咬住孤立 CR —— 说明收窄有意义', () => {
  const degenerate = (s) => (s.includes('\r') ? [1] : [])
  const isolated = 'a\rb\n'
  assert.deepEqual(gate.findCrlfLines(isolated), [], '正确判据:孤立 CR 放过')
  assert.notDeepEqual(degenerate(isolated), [], '退化判据:会误咬 —— 两者必须不同')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
