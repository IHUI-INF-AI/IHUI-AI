// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:git-refs-heal 的"死引用分流"判据 —— 源脚本已按 §22d 加 isDirectRun 守卫,
// 被 import 时不会触发任何写动作,因此这里直接 import __test__,不复制判据实现。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ } from '../git-refs-heal.mjs'

const { splitDeadRefs, isNestedRef, objectExists } = __test__
const A = 'refs/remotes/origin/main'
const B = 'refs/tags/backup/x'
const ALIVE = 'a'.repeat(40)
const DEAD = 'b'.repeat(40)

test('源脚本必须 export __test__ 三个核心函数', () => {
  for (const k of ['splitDeadRefs', 'isNestedRef', 'objectExists'])
    assert.equal(typeof __test__[k], 'function', `缺少 ${k}`)
})

test('死引用进 dead,活引用进 rebuildable(不得混流)', () => {
  const { dead, rebuildable } = splitDeadRefs(
    [
      [A, ALIVE],
      [B, DEAD],
    ],
    (s) => s === ALIVE,
  )
  assert.deepEqual(dead, [[B, DEAD]])
  assert.deepEqual(rebuildable, [[A, ALIVE]])
})

test('全部存活 → dead 必须为空(反向对照:"恒判死"会把清单删光)', () => {
  const { dead, rebuildable } = splitDeadRefs(
    [
      [A, ALIVE],
      [B, ALIVE],
    ],
    () => true,
  )
  assert.equal(dead.length, 0)
  assert.equal(rebuildable.length, 2)
})

test('全部死 → rebuildable 为空(调用方据此走"剔除后正常退出"分支)', () => {
  const { dead, rebuildable } = splitDeadRefs([[A, DEAD]], () => false)
  assert.equal(dead.length, 1)
  assert.equal(rebuildable.length, 0)
})

test('空输入产出空两侧(不凭空造 ref)', () => {
  const { dead, rebuildable } = splitDeadRefs([], () => true)
  assert.deepEqual({ dead, rebuildable }, { dead: [], rebuildable: [] })
})

test('分流必须保序(重建顺序影响 packed-refs 差异可读性)', () => {
  const rows = Array.from({ length: 6 }, (_, i) => [`refs/tags/n/p${i}`, i % 2 ? DEAD : ALIVE])
  const { rebuildable } = splitDeadRefs(rows, (s) => s === ALIVE)
  assert.deepEqual(
    rebuildable.map(([r]) => r),
    ['refs/tags/n/p0', 'refs/tags/n/p2', 'refs/tags/n/p4'],
  )
})

test('objectExists:空值/非法值直接判不存在,不去问 git', () => {
  for (const bad of ['', null, undefined, 'not-a-sha', 'zzzzzzzz'])
    assert.equal(objectExists(bad), false, `${String(bad)} 应判不存在`)
})

test('objectExists:活 sha 判存在 / 40 位但不存在的 sha 判不存在', () => {
  // cat-file -e 成功时 stdout 是空串,而 git(...,allowFail) 只在失败时返回 null ——
  // 写成 !!git(...) 会把每个好对象读成"死",清单会被整批删光。这里两头都钉住。
  assert.equal(objectExists('0'.repeat(40)), false)
  assert.equal(objectExists('f'.repeat(40)), false)
})

test('isNestedRef 只把 depth>=2 的命名空间纳入固化范围', () => {
  assert.equal(isNestedRef('refs/tags/backup/x'), true)
  assert.equal(isNestedRef('refs/remotes/origin/main'), true)
  assert.equal(isNestedRef('refs/heads/main'), false) // depth1 天然存活,入清单反而成噪音
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
