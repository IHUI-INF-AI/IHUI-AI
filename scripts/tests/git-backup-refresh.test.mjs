// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:直接 import 源脚本的 `__test__`,不在本文件里重写任何判据。
//
// 本票要钉住的是 2026-09-27 夜间实测到的那一型的**四件事**:
//   ① 旧盲点表达式不得回来(它是"恢复源不可用却报绿"的唯一成因);
//   ② 结论必须由 `judgeCheck` 出,`main()` 不得再自己算 `stale`;
//   ③ 坏 ref 的归档必须真挂在 `refreshBackup` 上(函数在而无人调 = 提交链上一路绿灯);
//   ④ 归档必须**先于**删除,且"内容合法而对象取不到"那一格绝不允许清 ref。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as src } from '../git-backup-refresh.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE = readFileSync(resolve(HERE, '../git-backup-refresh.mjs'), 'utf8')

test('T1 导入源模块不得触发 main() 副作用,且三个新出口必须在位(§22d)', () => {
  for (const key of [
    'refreshBackup',
    'classifyBackupTip',
    'judgeCheck',
    'quarantineBrokenTipRef',
  ]) {
    assert.equal(typeof src[key], 'function', `__test__ 缺出口:${key}`)
  }
})

test('T2 反向锁:旧的"读不到就算追平"表达式不得回到源码里', () => {
  // 只锁**可执行形态**(`const stale = r.before !== null …`),不锁描述它的注释文字 ——
  // 否则本文件与源码头注里那次如实复盘都会把自己判红(§4/守门 70 同型:说明性文字也带执行性字符)。
  assert.equal(
    /const\s+stale\s*=\s*r\.before\s*!==\s*null/.test(SOURCE),
    false,
    '旧盲点表达式回来了',
  )
})

test('T3 接线锁:--check 的结论必须出自 judgeCheck,不得在 main() 里另算一遍', () => {
  assert.match(
    SOURCE,
    /const\s*\{\s*stale\s*,\s*reason\s*\}\s*=\s*judgeCheck\(/,
    'main() 未委托给 judgeCheck',
  )
  const mainAt = SOURCE.indexOf('async function main(')
  // 取**调用形态**(赋值右侧)而不是裸 `judgeCheck({` —— 后者先撞上函数声明自身那一行,
  // 顺序判据就会永远成立不了(本测试第一版就栽在这里)。
  const callAt = SOURCE.indexOf('= judgeCheck({')
  assert.ok(mainAt > 0 && callAt > mainAt, 'judgeCheck 未在 main() 内被调用')
})

test('T4 接线锁:坏 ref 归档必须真挂在 refreshBackup 上(函数在而无人调=没有)', () => {
  const fnAt = SOURCE.indexOf('export function refreshBackup(')
  const callAt = SOURCE.indexOf('quarantineBrokenTipRef({ refPath: tipRefPath')
  assert.ok(fnAt > 0 && callAt > fnAt, 'refreshBackup 未调用 quarantineBrokenTipRef')
  assert.ok(/tipState === 'broken-ref'/.test(SOURCE), '未先分档就动手 ⇒ 会把"对象取不到"当坏文件删')
})

test('T5 顺序锁:必须先归档并回读逐字节一致,才允许 unlink', () => {
  const verifyAt = SOURCE.indexOf('back.equals(raw)')
  const unlinkAt = SOURCE.indexOf('unlinkSync(refPath)')
  assert.ok(verifyAt > 0 && unlinkAt > verifyAt, '删除动作没有排在归档回读校验之后')
})

test('T6 判据有牙(构造面):读不到/落后一律"需刷新",只有逐字等值才算追平', () => {
  const S = 'c'.repeat(40)
  for (const tipState of ['broken-ref', 'missing', 'missing-object', 'ok']) {
    assert.equal(
      src.judgeCheck({ srcHead: S, before: null, tipState }).stale,
      true,
      `${tipState} 读不到时不得记绿`,
    )
  }
  assert.equal(
    src.judgeCheck({ srcHead: S, before: 'd'.repeat(40), tipState: 'ok' }).stale,
    true,
    '落后必须判红',
  )
  assert.equal(
    src.judgeCheck({ srcHead: null, before: S, tipState: 'ok' }).stale,
    true,
    '源 HEAD 取不到不得记绿',
  )
  assert.equal(
    src.judgeCheck({ srcHead: S, before: S, tipState: 'ok' }).stale,
    false,
    '等值仍须判追平(反向对照)',
  )
})

test('T7 四态互斥:半截写入与"对象取不到"不得并桶', () => {
  const hex = `${'b'.repeat(40)}\n`
  assert.equal(
    src.classifyBackupTip({ sha: 'f'.repeat(40), refFileExists: true, refFileText: hex }),
    'ok',
  )
  assert.equal(
    src.classifyBackupTip({ sha: null, refFileExists: false, refFileText: null }),
    'missing',
  )
  assert.equal(
    src.classifyBackupTip({ sha: null, refFileExists: true, refFileText: '\0'.repeat(41) }),
    'broken-ref',
  )
  assert.equal(
    src.classifyBackupTip({ sha: null, refFileExists: true, refFileText: 'a'.repeat(17) }),
    'broken-ref',
  )
  assert.equal(
    src.classifyBackupTip({ sha: null, refFileExists: true, refFileText: hex }),
    'missing-object',
  )
})

test('T8 行为面:合法 sha 的 ref 绝不被清除,全 NUL 的才归档后清除', () => {
  const dir = mkScratch('ihui-bkrefresh-')
  try {
    const arch = join(dir, 'arch')
    const goodPath = join(dir, 'good-main')
    writeFileSync(goodPath, `${'9'.repeat(40)}\n`)
    const g = src.quarantineBrokenTipRef({ refPath: goodPath, archiveDir: arch, label: 'good' })
    assert.equal(g.did, false, '合法 sha 不得被清除')
    assert.ok(existsSync(goodPath), '合法 sha 的 ref 文件被删了')
    assert.match(g.error || '', /禁止清除/)

    const badPath = join(dir, 'bad-main')
    writeFileSync(badPath, Buffer.alloc(41, 0))
    const b = src.quarantineBrokenTipRef({ refPath: badPath, archiveDir: arch, label: 'bad' })
    assert.equal(b.did, true, b.error || '坏 ref 未被处理')
    assert.ok(!existsSync(badPath), '清除未生效')
    assert.ok(existsSync(b.dest), '现场未归档')
    assert.deepEqual([...readFileSync(b.dest)], Array(41).fill(0), '归档字节与现场不等')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
