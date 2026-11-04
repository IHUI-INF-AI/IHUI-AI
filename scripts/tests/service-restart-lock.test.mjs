// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * scripts/tests/service-restart-lock.test.mjs —— `nssm restart` 的按服务名互斥取证(2026-11-02 立)。
 *
 * 铁律:本文件**不执行任何 nssm、不碰任何真实服务名、不读生产台账**。
 * 服务名一律用 `IHUI-TEST-FAKE-*`,restartFn 是纯计数器;锁落点用临时目录。
 */

import assert from 'node:assert/strict'
import { existsSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { test } from 'node:test'

import { __test__ as heal } from '../heal-unresponsive-services.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const { serviceRestartLockPath, runGuardedRestart, rollbackPreRecordedRestart } = heal

function writeForeignLock(file, pid) {
  writeFileSync(
    file,
    `pid=${pid}\ntoken=foreign-holder\nat=${new Date().toISOString()}\nhost=test\nrole=service-restart:fake\n`,
    'utf8',
  )
}

test('R1 服务名 → 锁路径:只允许安全字符,不产生目录穿越', () => {
  const dir = mkScratch('service-restart-lock')
  try {
    const normal = serviceRestartLockPath('IHUI-TEST-FAKE-WEB', { root: dir })
    assert.equal(normal, join(dir, 'IHUI-TEST-FAKE-WEB.lock'))
    const hostile = serviceRestartLockPath('../../evil name', { root: dir })
    assert.equal(hostile.startsWith(dir), true, '锁必须落在给定根之内')
    // 取 basename 而不是 slice(dir.length):slice 会把开头的路径分隔符带进来,那会让
    // 「文件名里有没有分隔符」的断言永远为真 —— 测的是拼接符,不是穿越。
    const file = basename(hostile)
    assert.equal(/[\\/]/.test(file), false, `锁文件名不得含分隔符:${file}`)
    assert.equal(file.startsWith('.'), false, `锁文件名不得以 . 开头:${file}`)
  } finally {
    rmScratch(dir)
  }
})

test('R2 另一场重启持锁 ⇒ lock-skip,restartFn 一次都不执行', () => {
  const dir = mkScratch('service-restart-lock')
  try {
    const name = 'IHUI-TEST-FAKE-HELD'
    const lock = serviceRestartLockPath(name, { root: dir })
    writeForeignLock(lock, process.ppid) // 活 pid + 新鲜 mtime ⇒ 必须被拒
    let calls = 0
    const r = runGuardedRestart(name, () => {
      calls += 1
      return { ok: true }
    }, { lockRoot: dir })
    assert.equal(calls, 0, '持锁时绝不许执行 nssm restart')
    assert.equal(r.ok, false)
    assert.equal(r.kind, 'lock-skip')
    assert.equal(r.pid, process.ppid)
    assert.match(r.why, /另一场重启持锁/)
    assert.equal(existsSync(lock), true, '跳过者不得删除持有者的锁')
  } finally {
    rmScratch(dir)
  }
})

test('R3 无锁 ⇒ 执行恰好一次,返回值透传,退出后锁已释放', () => {
  const dir = mkScratch('service-restart-lock')
  try {
    const name = 'IHUI-TEST-FAKE-FREE'
    const lock = serviceRestartLockPath(name, { root: dir })
    let calls = 0
    const r = runGuardedRestart(name, () => {
      calls += 1
      return { ok: true, marker: 'fake-restart-ran' }
    }, { lockRoot: dir })
    assert.equal(calls, 1)
    assert.deepEqual(r, { ok: true, marker: 'fake-restart-ran' })
    assert.equal(existsSync(lock), false, '动作结束必须释放锁,否则这一台会被永久挡在门外')
  } finally {
    rmScratch(dir)
  }
})

test('R4 lock-skip 的预记必须撤回:strikes 与 lastRestartMs 回到本轮之前', () => {
  const prev = { strikes: 2, lastRestartMs: 500, lastVerdict: 'silent', sinceMs: 500 }
  const next = {
    services: { 'IHUI-TEST-FAKE-ROLLBACK': { strikes: 0, lastRestartMs: 999, lastVerdict: 'silent', sinceMs: null } },
    restarts: [50, 999],
  }
  rollbackPreRecordedRestart({
    next,
    prevState: { services: { 'IHUI-TEST-FAKE-ROLLBACK': prev } },
    name: 'IHUI-TEST-FAKE-ROLLBACK',
    nowMs: 999,
  })
  assert.deepEqual(next.services['IHUI-TEST-FAKE-ROLLBACK'], prev)
  assert.deepEqual(next.restarts, [50], '预记的窗口时间戳必须撤掉')
})

test('R5 旧状态没有这台 ⇒ 撤回成零计数,而不是 undefined', () => {
  const next = {
    services: { 'IHUI-TEST-FAKE-NEW': { strikes: 0, lastRestartMs: 999, lastVerdict: 'silent', sinceMs: null } },
    restarts: [999],
  }
  rollbackPreRecordedRestart({ next, prevState: { services: {} }, name: 'IHUI-TEST-FAKE-NEW', nowMs: 999 })
  assert.deepEqual(next.services['IHUI-TEST-FAKE-NEW'], { strikes: 0, lastRestartMs: null })
  assert.deepEqual(next.restarts, [])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
