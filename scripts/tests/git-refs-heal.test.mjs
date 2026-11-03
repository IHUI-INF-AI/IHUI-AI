// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:git-refs-heal 的"死引用分流"判据 —— 源脚本已按 §22d 加 isDirectRun 守卫,
// 被 import 时不会触发任何写动作,因此这里直接 import __test__,不复制判据实现。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ } from '../git-refs-heal.mjs'

const { splitDeadRefs, isNestedRef, objectExists, parseRefsTable } = __test__
const A = 'refs/remotes/origin/main'
const B = 'refs/tags/backup/x'
const ALIVE = 'a'.repeat(40)
const DEAD = 'b'.repeat(40)

test('源脚本必须 export __test__ 的全部核心判据(本层不复制实现)', () => {
  for (const k of ['splitDeadRefs', 'isNestedRef', 'objectExists', 'parseRefsTable'])
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

/**
 * 装车证明:守护侧不得再养第 2 份"无校验写 ref"的路径。
 *
 * 成因实测:`git-refs-heal.mjs` 里 `splitDeadRefs` 把死值挡在写盘之前,但
 * `git-guardian.mjs` 有一份**同名同实现的私有 writeLooseRef**,而每 2 分钟真跑的 `healRefs()`
 * 直接遍历 broken 无校验地写 —— 修好的那一份只在人工敲 CLI 时才生效,活的那份恰恰是没修的。
 * 写出指向不存在对象的 ref ⇒ 每一次 `git fetch` 直接 fatal(§5b 当日坏链 83,108 条即此型)。
 * 本条把"共用同一份判定"钉成源码级不变量:任一条件被后人拆掉即红。
 */
test('装车证明:守护必须复用同一份死值分流,且写 ref 前自证对象存在', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'git-guardian.mjs'), 'utf8')
  assert.match(
    src,
    /import \{ splitDeadRefs, objectExists \} from '\.\/git-refs-heal\.mjs'/,
    '守护未 import 那份纯函数 ⇒ 它会再长出自己的无校验副本',
  )
  assert.match(src, /splitDeadRefs\(broken, objectExists\)/, 'healRefs 未走分流就写 ref')
  assert.match(
    src,
    /function writeLooseRef\(ref, sha\) \{[\s\S]{0,260}if \(!objectExists\(sha\)\)/,
    'writeLooseRef 丢了"写前自证对象存在"这道兜底(双层防御的第二层,护后来的调用者)',
  )
  // 反向对照:不得有人把校验删掉后靠"调用方自觉"
  const writer = src.slice(src.indexOf('function writeLooseRef'))
  assert.ok(writer.indexOf('objectExists') < writer.indexOf('writeFileSync'), '校验必须在写盘之前')
})

/**
 * 2026-11-03 实测的第二格:`currentRefs()` 的派生 git 没设 maxBuffer。`for-each-ref refs/heads
 * refs/tags refs/remotes` 在本仓(23,031 枚 tag)输出 1,052,662 B,顶穿 execFileSync 默认 1 MiB
 * ⇒ ENOBUFS ⇒ 旧代码把 null 折成空表 ⇒ `--status` 把清单 22,298 条期望项**全报成缺失**、
 * currentCount 报 0。空表是这台工具 learning/prune 的底表,所以"问不到"绝不能与"一个都没有"并桶。
 */
test('ref 面三态:问不到⇒null、真空⇒{}、有行⇒表(三者不得并桶)', () => {
  assert.equal(parseRefsTable(null), null, '问不到被折成空表 = 22,298 条假缺失的成因')
  assert.equal(parseRefsTable(undefined), null, 'undefined 同样必须判"问不到"')
  assert.deepEqual(parseRefsTable(''), {}, '真空输出应是空表,且形态要与"问不到"可区分')
  assert.deepEqual(parseRefsTable(`${A} ${ALIVE}\n${B} ${DEAD}\n`), { [A]: ALIVE, [B]: DEAD })
})

test('形状锁:派生 git 带显式 maxBuffer,且 currentRefs 不把 null 折回空表', () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'git-refs-heal.mjs'),
    'utf8',
  )
  const gi = src.indexOf('function git(')
  assert.ok(gi >= 0, '找不到 git() 实现')
  assert.match(
    src.slice(gi, gi + 900),
    /maxBuffer:\s*GIT_MAX_BUFFER_BYTES/,
    'git() 丢了显式 maxBuffer ⇒ 大输出静默变 null(与不设 stdio 报 EBUSY 同一族失效)',
  )
  assert.ok(__test__.GIT_MAX_BUFFER_BYTES >= 16 * 1024 * 1024, 'maxBuffer 余量小于 16 MiB')
  const ci = src.indexOf('function currentRefs(')
  assert.ok(ci >= 0, '找不到 currentRefs() 实现')
  assert.doesNotMatch(
    src.slice(ci, ci + 700),
    /if \(!out\)\s*return\s+map/,
    'currentRefs 又把"问不到"折成空表了(三态并桶回潮)',
  )
  // 写路径必须在拿不到 ref 面时整轮让路,而不是按空表纳管/摘除
  // (锚点取 main() 那一处:`const cur = currentRefs()` 紧跟守卫;status() 那处后面接的是 readManifest,
  //  不锚死就会把"删掉 status 守卫"这种变异当成没发生 —— 变异自证实测过这一点)
  assert.match(
    src,
    /const cur = currentRefs\(\)\s*\n\s*if \(cur === null\)[\s\S]{0,400}?process\.exit\(2\)/,
    'main() 未对"ref 面问不到"让路 ⇒ 空底表会抹掉全部期望项',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
