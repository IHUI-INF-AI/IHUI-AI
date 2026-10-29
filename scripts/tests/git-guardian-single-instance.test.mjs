// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/git-guardian-single-instance.test.mjs —— 守护"单实例闸"的取证(2026-10-28 立)。
 *
 * 钉的事实:计划任务每 2 分钟拉一轮,而一轮巡检经常超过 2 分钟(腿多、派生腿慢)。
 * 两轮并存时它们抢同一个临时检出槽位 `.worktrees/derived-heal`:一条刚 `worktree add`,
 * 另一条的 `remove` 就把它删掉,留下 EPERM 与 `already exists` 交替出现。实测样式派生腿(tokens)
 * 从 2026-10-28 15:49 起每轮 refused,日志只写「检出残留摘不掉…交人工」,真因看不见。
 *
 * 三条判据:存活的前一轮 ⇒ 拒;前一轮已死 ⇒ 接管(失效方向是多跑一轮,不是永久停摆);
 * 写不了 pid 文件 ⇒ 仍放行(锁本身绝不停摆巡检)。
 */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { __test__ as guardian } from '../git-guardian.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const { acquireSingleInstance } = guardian

test('S1 没有 pid 文件 ⇒ 接管,并把自己的 pid 写进台账', () => {
  const dir = mkScratch('guardian-single-instance')
  try {
    const f = join(dir, 'g.pid')
    const r = acquireSingleInstance(f)
    assert.equal(r.ok, true)
    assert.match(readFileSync(f, 'utf8'), new RegExp(`pid=${process.pid}`))
  } finally {
    rmScratch(dir)
  }
})

test('S2 上一轮仍存活 ⇒ 拒闸且不覆盖台账(这才是防两轮抢槽位的牙)', () => {
  const dir = mkScratch('guardian-single-instance')
  try {
    const f = join(dir, 'g.pid')
    writeFileSync(f, `pid=${process.ppid} at=x`, 'utf8')
    const r = acquireSingleInstance(f)
    assert.equal(r.ok, false)
    assert.equal(r.pid, process.ppid)
    assert.match(
      readFileSync(f, 'utf8'),
      new RegExp(`pid=${process.ppid}`),
      '拒闸时不得改写台账,否则下一轮读到的是"我自己"',
    )
  } finally {
    rmScratch(dir)
  }
})

test('S3 上一轮已死(pid 不存在)⇒ 接管', () => {
  const dir = mkScratch('guardian-single-instance')
  try {
    const f = join(dir, 'g.pid')
    writeFileSync(f, 'pid=999999999 at=x', 'utf8')
    const r = acquireSingleInstance(f)
    assert.equal(r.ok, true)
    assert.match(readFileSync(f, 'utf8'), new RegExp(`pid=${process.pid}`))
  } finally {
    rmScratch(dir)
  }
})

test('S4 pid 文件写不了 ⇒ degraded 但仍放行(锁不能把巡检停摆)', () => {
  const r = acquireSingleInstance(join('Z:', 'no-such-dir', 'g.pid'))
  assert.equal(r.ok, true)
  assert.ok(r.degraded, '写不了锁要显式标 degraded,不得默默冒充已加锁')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
