#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** main 保活腿镜像测试:判据一律 import 生产源,不在测试里复制五档逻辑。 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import {
  __test__ as mainline,
  MAINLINE_KEEP_LATEST_INTERVAL_MS,
  MAINLINE_KEEP_LATEST_TICK,
  sweepMainlineKeepLatest,
  startMainlineSweepTimer,
} from '../mainline-keep-latest.mjs'
import { GIT_EGRESS_DIRECT_ARGS } from '../lib/face-reader.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const { classify, keepLatest, runSelfTest, EXIT_CODES, REPORT_KEYS, stateExitCode } = mainline
const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const A = 'a'.repeat(40)
const B = 'b'.repeat(40)
const C = 'c'.repeat(40)
const REMOTE_REF = 'refs/remotes/origin/main^{commit}'
const LOCK_OK = () => ({ acquired: true, release() {} })
const notAncestor = () => {
  const e = new Error('not ancestor')
  e.status = 1
  throw e
}

test('五档纯判据:相等/远端包含/本地包含/双向分叉/未判定', () => {
  assert.equal(classify({ localSha: A, remoteSha: A, isAncestor: true }).state, 'up-to-date')
  assert.equal(
    classify({ localSha: A, remoteSha: B, isAncestor: true, behindCount: 2 }).state,
    'behind',
  )
  assert.equal(
    classify({
      localSha: B,
      remoteSha: A,
      isAncestor: false,
      remoteIsAncestor: true,
      aheadCount: 3,
    }).state,
    'ahead',
  )
  assert.equal(
    classify({
      localSha: A,
      remoteSha: B,
      isAncestor: false,
      remoteIsAncestor: false,
      behindCount: 2,
      aheadCount: 3,
    }).state,
    'diverged',
  )
  assert.equal(classify({ localSha: A, remoteSha: B, isAncestor: false }).state, 'undetermined')
})

test('退出码契约与 JSON 固定键', () => {
  assert.deepEqual(EXIT_CODES, {
    'up-to-date': 0,
    behind: 0,
    ahead: 0,
    diverged: 1,
    undetermined: 2,
  })
  assert.equal(stateExitCode('diverged'), 1)
  assert.equal(stateExitCode('非法'), 2)
  const r = classify({ localSha: A, remoteSha: B, isAncestor: true, behindCount: 1 })
  assert.deepEqual(Object.keys(r), [...REPORT_KEYS])
})

test('undetermined 不折绿:fetch/ref/merge-base 失败均显式 exit 2 档', () => {
  for (const failure of ['fetch', 'ref', 'merge-base']) {
    const calls = []
    const r = keepLatest({
      run(args) {
        calls.push(args)
        if (args[4] === 'fetch' && failure === 'fetch') throw new Error('fetch failed')
        if (args[0] === 'rev-parse' && failure === 'ref') throw new Error('ref failed')
        if (args[0] === 'merge-base' && failure === 'merge-base') {
          const e = new Error('merge-base failed')
          e.status = 128
          throw e
        }
        if (args[0] === 'rev-parse') return args.includes('HEAD^{commit}') ? A : B
        return ''
      },
    })
    assert.equal(r.state, 'undetermined', failure)
    assert.equal(EXIT_CODES[r.state], 2)
    assert.equal(
      calls.some((args) => args[0] === 'merge' || args[0] === 'push'),
      false,
    )
  }
})

test('直连 fetch 失败后用环境代理重试,成功即继续判定', () => {
  const calls = []
  let fetchCalls = 0
  const r = keepLatest({
    env: { HTTPS_PROXY: 'http://127.0.0.1:62010' },
    run(args) {
      calls.push(args)
      if (args[4] === 'fetch') {
        fetchCalls += 1
        if (fetchCalls === 1) throw new Error('direct reset')
        assert.equal(args[1], 'http.proxy=http://127.0.0.1:62010')
        return ''
      }
      if (args[0] === 'rev-parse') return A
      throw new Error('unexpected command')
    },
  })
  assert.equal(r.state, 'up-to-date')
  assert.equal(fetchCalls, 2)
  assert.equal(
    calls.some((args) => args[0] === 'merge' || args[0] === 'push'),
    false,
  )
})

test('已知死亡的 7897 环境代理不重试,避免把一次失败拖成两次', () => {
  const calls = []
  const r = keepLatest({
    env: { HTTPS_PROXY: 'http://127.0.0.1:7897' },
    run(args) {
      calls.push(args)
      if (args[4] === 'fetch') throw new Error('direct reset')
      throw new Error('unexpected command')
    },
  })
  assert.equal(r.state, 'undetermined')
  assert.equal(calls.filter((args) => args[4] === 'fetch').length, 1)
})

test('diverged 两边都有独有提交时绝不调用写执行器', () => {
  const calls = []
  const r = keepLatest({
    run(args) {
      calls.push(args)
      if (args[0] === 'rev-parse') return args.includes('HEAD^{commit}') ? A : B
      if (args[0] === 'merge-base') return notAncestor()
      if (args[0] === 'rev-list') return '4'
      return ''
    },
  })
  assert.equal(r.state, 'diverged')
  assert.equal(r.behindCount, 4)
  assert.equal(r.aheadCount, 4)
  assert.equal(
    calls.some((args) => args[0] === 'merge' || args[0] === 'push' || args[0] === 'reset'),
    false,
  )
})

test('ahead 只报告并指向既有 git-sync-converge,不推不合', () => {
  const calls = []
  const r = keepLatest({
    run(args) {
      calls.push(args)
      if (args[0] === 'rev-parse') return args.includes('HEAD^{commit}') ? B : A
      if (args[0] === 'merge-base') return args[2] === A ? '' : notAncestor()
      if (args[0] === 'rev-list') return '3'
      return ''
    },
  })
  assert.equal(r.state, 'ahead')
  assert.match(r.reason, /git-sync-converge/)
  assert.equal(
    calls.some((args) => args[0] === 'merge' || args[0] === 'push'),
    false,
  )
})

test('behind 复用直连参数,写锁内锁定远端 commit 执行 merge --ff-only 并回读', () => {
  const calls = []
  let headReads = 0
  let released = 0
  const r = keepLatest({
    acquireWriteLock: () => ({ acquired: true, release: () => (released += 1) }),
    run(args) {
      calls.push(args)
      if (args[4] === 'fetch') {
        assert.deepEqual(args.slice(0, 4), GIT_EGRESS_DIRECT_ARGS)
        assert.deepEqual(args.slice(4), ['fetch', 'origin', '+main:refs/remotes/origin/main'])
        return ''
      }
      if (args[0] === 'rev-parse') {
        if (args.includes(REMOTE_REF)) return B
        headReads += 1
        return headReads <= 2 ? A : B
      }
      if (args[0] === 'merge-base') return ''
      if (args[0] === 'rev-list') return '2'
      if (args[0] === 'symbolic-ref') return 'main'
      if (args[0] === 'status') return ''
      if (args[0] === 'merge') {
        assert.deepEqual(args, ['merge', '--ff-only', B])
        return ''
      }
      throw new Error(`unexpected command:${args.join(' ')}`)
    },
  })
  assert.equal(r.state, 'behind')
  assert.equal(r.localSha, B)
  assert.equal(r.behindCount, 2)
  assert.equal(calls.filter((args) => args[0] === 'merge').length, 1)
  assert.equal(released, 1)
  assert.equal(
    calls.some((args) => args.some((arg) => arg.includes('FETCH_HEAD'))),
    false,
  )
})

test('git 写锁被占用时未判定且绝不 merge', () => {
  const calls = []
  const r = keepLatest({
    acquireWriteLock: () => ({ acquired: false, kind: 'skipped-held', why: '持有者 alive' }),
    run(args) {
      calls.push(args)
      if (args[4] === 'fetch') return ''
      if (args[0] === 'rev-parse') return args.includes(REMOTE_REF) ? B : A
      if (args[0] === 'merge-base') return ''
      if (args[0] === 'rev-list') return '1'
      throw new Error('unexpected command')
    },
  })
  assert.equal(r.state, 'undetermined')
  assert.match(r.reason, /写锁被占用/)
  assert.equal(
    calls.some((args) => args[0] === 'merge'),
    false,
  )
})

test('取锁后 HEAD 已变化时拒绝按旧判定快进', () => {
  const calls = []
  let headReads = 0
  const r = keepLatest({
    acquireWriteLock: LOCK_OK,
    run(args) {
      calls.push(args)
      if (args[4] === 'fetch') return ''
      if (args[0] === 'rev-parse') {
        if (args.includes(REMOTE_REF)) return B
        headReads += 1
        return headReads === 1 ? A : C
      }
      if (args[0] === 'merge-base') return ''
      if (args[0] === 'rev-list') return '1'
      throw new Error('unexpected command')
    },
  })
  assert.equal(r.state, 'undetermined')
  assert.match(r.reason, /取锁后 HEAD 已变化/)
  assert.equal(
    calls.some((args) => args[0] === 'merge'),
    false,
  )
})

test('behind 回读不一致降 undetermined,不冒绿', () => {
  const r = keepLatest({
    acquireWriteLock: LOCK_OK,
    run(args) {
      if (args[4] === 'fetch') return ''
      if (args[0] === 'rev-parse') return args.includes(REMOTE_REF) ? B : C
      if (args[0] === 'merge-base') return ''
      if (args[0] === 'rev-list') return '1'
      if (args[0] === 'symbolic-ref') return 'main'
      if (args[0] === 'status') return ''
      if (args[0] === 'merge') return ''
      throw new Error('unexpected command')
    },
  })
  assert.equal(r.state, 'undetermined')
  assert.match(r.reason, /回读 HEAD 与远端不一致/)
})

test('工作树有改动时拒绝快进并点名文件', () => {
  const calls = []
  const r = keepLatest({
    acquireWriteLock: LOCK_OK,
    run(args) {
      calls.push(args)
      if (args[4] === 'fetch') return ''
      if (args[0] === 'rev-parse') return args.includes(REMOTE_REF) ? B : A
      if (args[0] === 'merge-base') return ''
      if (args[0] === 'rev-list') return '1'
      if (args[0] === 'symbolic-ref') return 'main'
      if (args[0] === 'status') return ' M src/local-work.tsx\n?? scripts/new.mjs'
      throw new Error('unexpected command')
    },
  })
  assert.equal(r.state, 'undetermined')
  assert.match(r.reason, /src\/local-work.tsx/)
  assert.match(r.reason, /scripts\/new.mjs/)
  assert.equal(
    calls.some((args) => args[0] === 'merge'),
    false,
  )
})

test('非 main 分支拒绝快进,不推进 detached 或其它分支', () => {
  const calls = []
  const r = keepLatest({
    acquireWriteLock: LOCK_OK,
    run(args) {
      calls.push(args)
      if (args[4] === 'fetch') return ''
      if (args[0] === 'rev-parse') return args.includes(REMOTE_REF) ? B : A
      if (args[0] === 'merge-base') return ''
      if (args[0] === 'rev-list') return '1'
      if (args[0] === 'symbolic-ref') return 'feature/demo'
      throw new Error('unexpected command')
    },
  })
  assert.equal(r.state, 'undetermined')
  assert.match(r.reason, /拒绝快进非 main/)
  assert.equal(
    calls.some((args) => args[0] === 'merge' || args[0] === 'status'),
    false,
  )
})

test('--self-test 生产入口纯内存覆盖十格且可重复', () => {
  const first = runSelfTest()
  const second = runSelfTest()
  assert.equal(first.passed, 10)
  assert.equal(first.failed, 0)
  assert.deepEqual(second, first)
})

test('sweep 调度腿从生产源导出,默认节流 15 分钟且台账落在 .ihui-agent/state', () => {
  assert.equal(typeof sweepMainlineKeepLatest, 'function')
  assert.equal(MAINLINE_KEEP_LATEST_INTERVAL_MS, 15 * 60 * 1000)
  assert.ok(
    MAINLINE_KEEP_LATEST_TICK.replace(/\\/g, '/').endsWith(
      '/.ihui-agent/state/mainline-keep-latest-last.json',
    ),
  )
  assert.ok(MAINLINE_KEEP_LATEST_TICK.startsWith(ROOT))
})

test('sweep up-to-date 不写节流戳,同进程 15 分钟窗口内不重复执行', async () => {
  const dir = mkScratch('g-mainline-keep-latest')
  try {
    const tickFile = join(dir, 'tick.json')
    const memory = new Map()
    let runs = 0
    const opts = {
      tickFile,
      memory,
      now: 1_780_000_000_000,
      logger: () => {},
      keepLatestImpl: () => {
        runs += 1
        return classify({ localSha: A, remoteSha: A, isAncestor: true })
      },
    }
    assert.equal((await sweepMainlineKeepLatest(opts)).state, 'up-to-date')
    assert.equal(existsSync(tickFile), false)
    assert.equal((await sweepMainlineKeepLatest({ ...opts, now: opts.now + 60_000 })).ran, false)
    assert.equal(runs, 1)
  } finally {
    rmScratch(dir)
  }
})

test('sweep 失败落盘冷却,15 分钟内不重复执行', async () => {
  const dir = mkScratch('g-mainline-keep-latest-fail')
  try {
    const tickFile = join(dir, 'tick.json')
    let runs = 0
    const opts = {
      tickFile,
      memory: new Map(),
      now: 1_780_000_000_000,
      logger: () => {},
      keepLatestImpl: () => {
        runs += 1
        return { state: 'undetermined', reason: 'fetch failed' }
      },
    }
    assert.equal((await sweepMainlineKeepLatest(opts)).state, 'undetermined')
    assert.equal(existsSync(tickFile), true)
    assert.equal((await sweepMainlineKeepLatest({ ...opts, now: opts.now + 60_000 })).ran, false)
    assert.equal(runs, 1)
  } finally {
    rmScratch(dir)
  }
})

test('sweep 非法节流间隔回退 15 分钟,不会退化成零节流', async () => {
  const dir = mkScratch('g-mainline-keep-latest-interval')
  try {
    let runs = 0
    const opts = {
      tickFile: join(dir, 'tick.json'),
      memory: new Map(),
      intervalMs: 0,
      now: 1_780_000_000_000,
      logger: () => {},
      keepLatestImpl: () => {
        runs += 1
        return classify({ localSha: A, remoteSha: A, isAncestor: true })
      },
    }
    assert.equal((await sweepMainlineKeepLatest(opts)).state, 'up-to-date')
    assert.equal((await sweepMainlineKeepLatest({ ...opts, now: opts.now + 60_000 })).ran, false)
    assert.equal(runs, 1)
  } finally {
    rmScratch(dir)
  }
})

test('sweep 坏结论/抛错一律降级未判定,不冒绿', async () => {
  for (const keepLatestImpl of [
    () => ({ state: 'bogus' }),
    () => null,
    () => {
      throw new Error('boom')
    },
  ]) {
    const dir = mkScratch('g-mainline-keep-latest-bad')
    try {
      const r = await sweepMainlineKeepLatest({
        tickFile: join(dir, 'tick.json'),
        memory: new Map(),
        now: 1_780_000_000_000,
        logger: () => {},
        keepLatestImpl,
      })
      assert.equal(r.state, 'undetermined')
    } finally {
      rmScratch(dir)
    }
  }
})

test('常驻看守:异步 sweep 不重入,stop 后定时器不再触发', async () => {
  let callback = null
  let cleared = null
  let runs = 0
  let release = null
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const timer = startMainlineSweepTimer({
    startImmediately: false,
    setIntervalImpl: (fn) => {
      callback = fn
      return 42
    },
    clearIntervalImpl: (id) => {
      cleared = id
    },
    sweepImpl: async () => {
      runs += 1
      await gate
      return { state: 'up-to-date' }
    },
  })
  callback()
  callback()
  assert.equal(runs, 1)
  release()
  await new Promise((resolve) => setImmediate(resolve))
  await timer.tick()
  assert.equal(runs, 2)
  timer.stop()
  callback()
  await timer.tick()
  assert.equal(runs, 2)
  assert.equal(cleared, 42)
})

test('常驻看守:sweep 抛错只记一行,不把 dev 看守带崩', async () => {
  const logs = []
  const timer = startMainlineSweepTimer({
    startImmediately: false,
    setIntervalImpl: () => 1,
    clearIntervalImpl: () => {},
    logger: (line) => logs.push(line),
    sweepImpl: async () => {
      throw new Error('boom')
    },
  })
  assert.equal(await timer.tick(), null)
  assert.equal(logs.length, 1)
  assert.match(logs[0], /看守异常/)
  timer.stop()
})

test('sweep diverged 只日志不写分支,并落盘冷却', async () => {
  const dir = mkScratch('g-mainline-keep-latest-diverged')
  try {
    const logs = []
    const r = await sweepMainlineKeepLatest({
      tickFile: join(dir, 'tick.json'),
      memory: new Map(),
      now: 1_780_000_000_000,
      logger: (line) => logs.push(line),
      keepLatestImpl: () =>
        classify({
          localSha: A,
          remoteSha: B,
          isAncestor: false,
          remoteIsAncestor: false,
          behindCount: 2,
          aheadCount: 2,
        }),
    })
    assert.equal(r.state, 'diverged')
    assert.equal(logs.length, 1)
    assert.match(logs[0], /历史线分叉/)
    assert.equal(existsSync(join(dir, 'tick.json')), true)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
