// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 夹具:门结果缓存(scripts/lib/gate-cache.mjs)。
//
// 判据全部落在 mkScratch() 里的假 cacheDir 上 —— 不碰真实 `.git`,不读写开发工作区。
// 并发同键那条用两个**真子进程**(不是同进程里造两段同步代码):只有跨进程的 O_EXCL
// 才能证明"后到者读结果、而不是自己重跑"。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  computeCacheKey,
  computeConfigHash,
  isGreen,
  lockPathFor,
  lookup,
  pidAlive,
  recordPathFor,
  SCHEMA_VERSION,
  tryAcquireLock,
  withGateCache,
  writeRecord,
} from '../lib/gate-cache.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const MODULE_URL = pathToFileURL(join(REPO_ROOT, 'scripts', 'lib', 'gate-cache.mjs')).href

const TREE_A = 'a'.repeat(40)
const TREE_B = 'b'.repeat(40)

function fixture(t) {
  const base = mkScratch('gate-cache-test-')
  t.after(() => rmScratch(base))
  return { base, cacheDir: join(base, 'cache') }
}

function identity(overrides = {}) {
  return {
    key: 'key-basic',
    treeSha: TREE_A,
    gateId: '193',
    toolVersion: 'node22+deadbeefdeadbeef',
    ...overrides,
  }
}

function recordFor(overrides = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    key: 'key-basic',
    treeSha: TREE_A,
    gateId: '193',
    toolVersion: 'node22+deadbeefdeadbeef',
    rc: 0,
    durationMs: 12,
    startedAt: '2026-11-07T00:00:00.000Z',
    finishedAt: '2026-11-07T00:00:00.012Z',
    stdoutSha: 'c'.repeat(64),
    ...overrides,
  }
}

function writeRawRecord(cacheDir, key, value) {
  mkdirSync(cacheDir, { recursive: true })
  const path = recordPathFor({ key, cacheDir })
  writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value), 'utf8')
  return path
}

test('T1 未命中:返回 miss 且结构上没有 green 字段', () => {
  const f = fixture({ after() {} })
  const hit = lookup({ ...identity(), cacheDir: f.cacheDir })
  assert.equal(hit.status, 'miss')
  assert.equal(hit.reason, 'no-record')
  assert.equal(Object.prototype.hasOwnProperty.call(hit, 'green'), false)
  rmScratch(f.base)
})

test('T2 命中:同一键写 rc=0 记录后 lookup 命中且 green=true', () => {
  const f = fixture({ after() {} })
  writeRecord({ record: recordFor(), cacheDir: f.cacheDir })
  const hit = lookup({ ...identity(), cacheDir: f.cacheDir })
  assert.equal(hit.status, 'hit')
  assert.equal(hit.rc, 0)
  assert.equal(hit.green, true)
  rmScratch(f.base)
})

test('T3 工具版本变化 ⇒ 未命中', () => {
  const f = fixture({ after() {} })
  writeRecord({ record: recordFor(), cacheDir: f.cacheDir })
  const hit = lookup({ ...identity({ toolVersion: 'node22+0123456789abcdef' }), cacheDir: f.cacheDir })
  assert.equal(hit.status, 'miss')
  assert.equal(hit.reason, 'tool-version-mismatch')
  rmScratch(f.base)
})

test('T4 tree sha 变化 ⇒ 未命中', () => {
  const f = fixture({ after() {} })
  writeRecord({ record: recordFor(), cacheDir: f.cacheDir })
  const hit = lookup({ ...identity({ treeSha: TREE_B }), cacheDir: f.cacheDir })
  assert.equal(hit.status, 'miss')
  assert.equal(hit.reason, 'tree-mismatch')
  rmScratch(f.base)
})

test('T5 记录损坏(非法 JSON)⇒ 未命中', () => {
  const f = fixture({ after() {} })
  writeRawRecord(f.cacheDir, 'key-basic', '{ not json')
  const hit = lookup({ ...identity(), cacheDir: f.cacheDir })
  assert.equal(hit.status, 'miss')
  assert.match(hit.reason, /^unreadable-or-corrupt/)
  rmScratch(f.base)
})

test('T5b 记录字段缺失 ⇒ 未命中', () => {
  const f = fixture({ after() {} })
  const broken = recordFor()
  delete broken.stdoutSha
  writeRawRecord(f.cacheDir, 'key-basic', broken)
  const hit = lookup({ ...identity(), cacheDir: f.cacheDir })
  assert.equal(hit.status, 'miss')
  assert.equal(hit.reason, 'missing-field:stdoutSha')
  rmScratch(f.base)
})

test('T5c schemaVersion 不符 ⇒ 未命中', () => {
  const f = fixture({ after() {} })
  writeRawRecord(f.cacheDir, 'key-basic', recordFor({ schemaVersion: SCHEMA_VERSION + 1 }))
  const hit = lookup({ ...identity(), cacheDir: f.cacheDir })
  assert.equal(hit.status, 'miss')
  assert.equal(hit.reason, `schema-version:${SCHEMA_VERSION + 1}`)
  rmScratch(f.base)
})

test('T6 key 不符 ⇒ 未命中(文件在键路径上,记录自称另一个 key)', () => {
  const f = fixture({ after() {} })
  writeRawRecord(f.cacheDir, 'key-basic', recordFor({ key: 'key-other' }))
  const hit = lookup({ ...identity(), cacheDir: f.cacheDir })
  assert.equal(hit.status, 'miss')
  assert.equal(hit.reason, 'key-mismatch')
  rmScratch(f.base)
})

test('T7 rc=2 的记录可以命中,但绝不当绿;withGateCache 不会重跑', async () => {
  const f = fixture({ after() {} })
  writeRecord({ record: recordFor({ rc: 2 }), cacheDir: f.cacheDir })
  const hit = lookup({ ...identity(), cacheDir: f.cacheDir })
  assert.equal(hit.status, 'hit')
  assert.equal(hit.rc, 2)
  assert.equal(hit.green, false)
  assert.equal(isGreen(hit.record), false)

  let ran = false
  const outcome = await withGateCache({
    ...identity(),
    cacheDir: f.cacheDir,
    run: () => {
      ran = true
      return { rc: 0, stdout: 'should-not-run' }
    },
  })
  assert.equal(outcome.status, 'hit')
  assert.equal(outcome.rc, 2)
  assert.equal(outcome.green, false)
  assert.equal(ran, false)
  rmScratch(f.base)
})

test('T8 并发同键:只跑一次,另一方读到结果(source=waiter)', async (t) => {
  const f = fixture(t)
  const counter = join(f.base, 'runs.txt')
  const childScript = join(f.base, 'child.mjs')
  writeFileSync(
    childScript,
    [
      `import { appendFileSync } from 'node:fs'`,
      `import { withGateCache } from ${JSON.stringify(MODULE_URL)}`,
      `const [cacheDir, counter] = process.argv.slice(2)`,
      `const outcome = await withGateCache({`,
      `  cacheDir, key: 'key-race', treeSha: ${JSON.stringify(TREE_A)}, gateId: '193',`,
      `  toolVersion: 'node22+race', waitMs: 30000, pollMs: 20,`,
      `  run: () => {`,
      `    appendFileSync(counter, process.pid + '\\n')`,
      `    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 700)`,
      `    return { rc: 0, stdout: 'ok' }`,
      `  },`,
      `})`,
      `console.log(JSON.stringify({ status: outcome.status, rc: outcome.rc, green: outcome.green, source: outcome.source }))`,
    ].join('\n'),
    'utf8',
  )

  const runChild = () =>
    new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(process.execPath, [childScript, f.cacheDir, counter], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
      let out = ''
      let err = ''
      child.stdout.on('data', (d) => {
        out += d
      })
      child.stderr.on('data', (d) => {
        err += d
      })
      child.on('error', rejectPromise)
      child.on('close', (code) => {
        if (code !== 0) return rejectPromise(new Error(`child rc=${code}: ${err}`))
        resolvePromise(JSON.parse(out.trim()))
      })
    })

  const [a, b] = await Promise.all([runChild(), runChild()])
  const statuses = [a.status, b.status].sort()
  assert.deepEqual(statuses, ['hit', 'run'])
  const waiter = [a, b].find((x) => x.status === 'hit')
  assert.equal(waiter.source, 'waiter')
  assert.equal(waiter.rc, 0)
  const runs = readFileSync(counter, 'utf8').trim().split('\n').filter(Boolean)
  assert.equal(runs.length, 1, `并发同键必须只执行一次,实际 ${runs.length} 次`)
})

test('T9 死锁自愈:持有者 pid 已死 ⇒ 回收并执行', async () => {
  const f = fixture({ after() {} })
  const key = 'key-dead-lock'
  const lockPath = lockPathFor({ key, cacheDir: f.cacheDir })
  mkdirSync(f.cacheDir, { recursive: true })
  const dead = spawnSync(process.execPath, ['-e', 'process.exit(0)'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  assert.equal(pidAlive(dead.pid), false)
  writeFileSync(
    lockPath,
    `${JSON.stringify({ pid: dead.pid, host: hostname(), startedAt: '2026-11-07T00:00:00.000Z', token: 'dead-token' })}\n`,
    'utf8',
  )

  let ran = false
  const outcome = await withGateCache({
    key,
    treeSha: TREE_A,
    gateId: '193',
    toolVersion: 'node22+dead',
    cacheDir: f.cacheDir,
    run: () => {
      ran = true
      return { rc: 0, stdout: 'recovered' }
    },
  })
  assert.equal(outcome.status, 'run')
  assert.equal(ran, true)
  assert.equal(existsSync(lockPath), false, '死锁回收后锁文件不应残留')
  rmScratch(f.base)
})

test('T10 活锁不删:持有者 pid 活着 ⇒ held,锁原样保留', () => {
  const f = fixture({ after() {} })
  const key = 'key-live-lock'
  const lockPath = lockPathFor({ key, cacheDir: f.cacheDir })
  mkdirSync(f.cacheDir, { recursive: true })
  const body = `${JSON.stringify({
    pid: process.pid,
    host: hostname(),
    startedAt: '2026-11-07T00:00:00.000Z',
    token: 'live-token',
  })}\n`
  writeFileSync(lockPath, body, 'utf8')

  const attempt = tryAcquireLock({ lockPath })
  assert.equal(attempt.acquired, false)
  assert.equal(attempt.reason, 'held')
  assert.equal(existsSync(lockPath), true, '活锁绝不能被删')
  assert.equal(readFileSync(lockPath, 'utf8'), body, '活锁内容必须原样保留')
  rmScratch(f.base)
})

test('T11 异机锁不判死:host 不同 + pid 不在本机 ⇒ held,不回收', () => {
  const f = fixture({ after() {} })
  const key = 'key-foreign-lock'
  const lockPath = lockPathFor({ key, cacheDir: f.cacheDir })
  mkdirSync(f.cacheDir, { recursive: true })
  writeFileSync(
    lockPath,
    `${JSON.stringify({ pid: 424242, host: 'another-host', startedAt: '2026-11-07T00:00:00.000Z', token: 'foreign' })}\n`,
    'utf8',
  )
  const attempt = tryAcquireLock({ lockPath })
  assert.equal(attempt.acquired, false)
  assert.equal(attempt.reason, 'held')
  assert.equal(existsSync(lockPath), true)
  rmScratch(f.base)
})

test('T12 缓存键的构成:tree / gate / toolVersion / configHash 各变一次,键必变', () => {
  const base = {
    treeSha: TREE_A,
    gateId: '193',
    toolVersion: 'node22+deadbeefdeadbeef',
    configHash: computeConfigHash({ inputs: ['scripts/a.mjs'], blobShas: { 'scripts/a.mjs': '1'.repeat(40) } }),
  }
  const k0 = computeCacheKey(base)
  assert.equal(k0, computeCacheKey({ ...base }), '同输入必须得到同键')
  assert.notEqual(k0, computeCacheKey({ ...base, treeSha: TREE_B }))
  assert.notEqual(k0, computeCacheKey({ ...base, gateId: '47p' }))
  assert.notEqual(k0, computeCacheKey({ ...base, toolVersion: 'node22+feedfacefeedface' }))
  assert.notEqual(
    k0,
    computeCacheKey({
      ...base,
      configHash: computeConfigHash({ inputs: ['scripts/a.mjs'], blobShas: { 'scripts/a.mjs': '2'.repeat(40) } }),
    }),
  )
  assert.throws(() => computeCacheKey({ ...base, toolVersion: '' }), TypeError)
})

test('T13 未命中时 withGateCache 必须真的执行(不允许把 miss 当绿)', async () => {
  const f = fixture({ after() {} })
  let calls = 0
  const outcome = await withGateCache({
    ...identity({ key: 'key-run' }),
    cacheDir: f.cacheDir,
    run: () => {
      calls += 1
      return { rc: 0, stdout: 'fresh' }
    },
  })
  assert.equal(calls, 1)
  assert.equal(outcome.status, 'run')
  assert.equal(outcome.rc, 0)
  assert.equal(outcome.green, true)
  const again = await withGateCache({
    ...identity({ key: 'key-run' }),
    cacheDir: f.cacheDir,
    run: () => {
      calls += 1
      return { rc: 1, stdout: 'must-not-run' }
    },
  })
  assert.equal(calls, 1, '第二次必须命中,不得重跑')
  assert.equal(again.status, 'hit')
  assert.equal(again.green, true)
  rmScratch(f.base)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
