// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * verify-guardian-mutex.test.mjs —— 双跑结论口径的取证(2026-11-03 立)。
 *
 * 只测纯判据 `decideVerdict` / `duplicateStats`,不跑任何真探针、不读锁、不发信:
 * 同 pid 同轮的 ℹ️ 重复是"一轮刷两行",不得把结论拉成 undetermined;
 * 只有两个不同 pid 的 ✅/❌ 同 minute 重复、双载体、拒锁/失锁日志才算双跑实证。
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { decideVerdict, duplicateStats } from '../verify-guardian-mutex.mjs'

function makeRows(list) {
  return list.map(([iso, msg]) => ({
    ts: Date.parse(iso),
    iso,
    msg,
    pid: Number(String(msg).match(/pid=(\d+)/)?.[1] ?? 0) || 0,
    line: `[${iso}] ${msg}`,
  }))
}

const cleanLock = { exists: true, state: 'held', pid: 10676, role: 'git-guardian:daemon' }

test('S1 同 pid 同轮两行 ℹ️ ⇒ single-run-clean(宽档 extras 只作附注)', () => {
  const rows = makeRows([
    ['2026-11-03T00:36:03.468Z', 'ℹ️ 收尾对齐自愈未派发:对齐台账无失败 pid=10676'],
    ['2026-11-03T00:36:03.469Z', 'ℹ️ 收尾对齐自愈未派发:对齐台账无失败 pid=10676'],
  ])
  const allDup = duplicateStats(rows)
  const strictDup = duplicateStats(rows, { onlyStrict: true })
  assert.equal(allDup.groups, 1)
  assert.equal(allDup.extras, 1)
  assert.equal(allDup.twoPidGroups, 0)
  assert.equal(strictDup.extras, 0)
  const verdict = decideVerdict({
    carriers: 1,
    daemonCount: 1,
    daemonPids: [10676],
    lock: cleanLock,
    strictDup,
    refusalHits: 0,
  })
  assert.equal(verdict, 'single-run-clean')
})

test('S2 同 minute 同语义 ✅/❌ 出现两个不同 pid ⇒ double-run', () => {
  const rows = makeRows([
    ['2026-11-03T00:36:03.468Z', '❌ 生产签出存在外来改动 pid=111'],
    ['2026-11-03T00:36:03.500Z', '❌ 生产签出存在外来改动 pid=222'],
  ])
  const strictDup = duplicateStats(rows, { onlyStrict: true })
  assert.equal(strictDup.groups, 1)
  assert.equal(strictDup.twoPidGroups, 1)
  assert.deepEqual(strictDup.top[0].pids.sort(), [111, 222])

  // 日志已证明两个 pid,即使抓拍那一刻只剩一台,也判双跑。
  assert.equal(
    decideVerdict({
      carriers: 1,
      daemonCount: 1,
      daemonPids: [111],
      lock: { ...cleanLock, pid: 111 },
        strictDup,
      refusalHits: 0,
    }),
    'double-run-unmitigated',
  )

  // 双载体是硬证据;拒锁/失锁日志同样是硬证据。
  assert.equal(
    decideVerdict({
      carriers: 2,
      daemonCount: 2,
      daemonPids: [111, 222],
      lock: { ...cleanLock, pid: 111 },
        strictDup: { twoPidGroups: 0 },
      refusalHits: 0,
    }),
    'double-run-unmitigated',
  )
  assert.equal(
    decideVerdict({
      carriers: 1,
      daemonCount: 1,
      daemonPids: [111],
      lock: { ...cleanLock, pid: 111 },
        strictDup: { twoPidGroups: 0 },
      refusalHits: 1,
    }),
    'double-run-unmitigated',
  )
})

test('S3 窗口内无载体 / 无 daemon 载体 ⇒ undetermined', () => {
  assert.equal(decideVerdict({ carriers: 0, daemonCount: 0, strictDup: { twoPidGroups: 0 } }), 'undetermined')
  assert.equal(decideVerdict({ carriers: 1, daemonCount: 0, strictDup: { twoPidGroups: 0 } }), 'undetermined')
  assert.equal(decideVerdict({ carriers: null, daemonCount: null }), 'undetermined')
  assert.equal(
    decideVerdict({ carriers: 1, daemonCount: 1, lock: cleanLock, strictDup: { twoPidGroups: 0 }, logReadable: false }),
    'undetermined',
  )
})
