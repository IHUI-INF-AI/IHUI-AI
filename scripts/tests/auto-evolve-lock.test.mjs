/**
 * DBG-93 / DBG-97:auto-evolve 单实例锁。
 * 判据只走源脚本 `__test__`(acquireLock / releaseLock),本文件不另写一份抢锁算法。
 * 不启动 auto-evolve 派发(不跑 --once / --dry-run / main)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as ae } from '../auto-evolve.mjs'

const AE_HREF = new URL('../auto-evolve.mjs', import.meta.url).href
const SRC = readFileSync(fileURLToPath(new URL('../auto-evolve.mjs', import.meta.url)), 'utf8')

function nap(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function lockPath(dir) {
  return join(dir, 'auto-evolve.lock')
}

function strayNames(dir) {
  return readdirSync(dir).filter((name) => name.includes('.pending') || name.includes('.claim-'))
}

function harnessSource() {
  return `import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { __test__ as ae } from ${JSON.stringify(AE_HREF)}

function nap(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

const [mode, id, lockFile, dir] = process.argv.slice(2)

function snap() {
  try {
    return readFileSync(lockFile, 'utf8')
  } catch {
    return null
  }
}

try {
  if (mode !== 'race') throw new Error('unknown mode ' + mode)
  writeFileSync(join(dir, 'ready-' + id), String(process.pid))
  const deadline = Date.now() + 20000
  while (!existsSync(join(dir, 'start')) && Date.now() < deadline) nap(30)
  const r = ae.acquireLock(lockFile)
  const text = snap()
  let afterRelease = text
  if (r.held) {
    ae.releaseLock(lockFile)
    afterRelease = snap()
  } else {
    nap(2000)
    ae.releaseLock(lockFile)
  }
  writeFileSync(
    join(dir, 'result-' + id + '.json'),
    JSON.stringify({
      id,
      self: process.pid,
      held: Boolean(r.held),
      lockPid: r.pid ?? null,
      text,
      afterRelease,
    }),
  )
} catch (e) {
  writeFileSync(
    join(dir, 'result-' + id + '.json'),
    JSON.stringify({ id, error: String(e && e.stack ? e.stack : e) }),
  )
  process.exit(1)
}
`
}

test('DBG-93 源码不再对正式锁先 wx 出空文件再补写 pid', () => {
  assert.equal(SRC.includes("openSync(LOCK_FILE, 'wx')"), false)
  assert.equal(SRC.includes('锁文件坏 = 无有效持有者'), false)
  assert.match(SRC, /function releaseLock\(lockFile = LOCK_FILE\)/)
  assert.match(SRC, /cls\.pid !== process\.pid/)
})

test('拿到锁时正式文件已是完整身份,释放后路径消失且无临时名残留', () => {
  const dir = mkScratch('auto-evolve-lock-')
  try {
    const file = lockPath(dir)
    const got = ae.acquireLock(file)
    assert.equal(got.held, false)
    const body = JSON.parse(readFileSync(file, 'utf8'))
    assert.equal(body.pid, process.pid)
    assert.equal(typeof body.at, 'string')
    assert.ok(body.at.length > 0)
    const again = ae.acquireLock(file)
    assert.equal(again.held, true)
    assert.equal(again.pid, process.pid)
    assert.equal(readFileSync(file, 'utf8').includes(String(process.pid)), true)
    ae.releaseLock(file)
    assert.equal(existsSync(file), false)
    ae.releaseLock(file)
    assert.equal(existsSync(file), false)
    assert.deepEqual(strayNames(dir), [])
  } finally {
    rmScratch(dir)
  }
})

test('DBG-93 空文件与纯空白不是无主锁,acquire 与 release 都不许动它', () => {
  const dir = mkScratch('auto-evolve-lock-')
  try {
    const file = lockPath(dir)
    for (const raw of ['', '\n', '  \n\t']) {
      writeFileSync(file, raw)
      const got = ae.acquireLock(file)
      assert.equal(got.held, true, JSON.stringify(raw))
      assert.equal(got.pid, null, JSON.stringify(raw))
      assert.equal(readFileSync(file, 'utf8'), raw)
      ae.releaseLock(file)
      assert.equal(readFileSync(file, 'utf8'), raw)
    }
  } finally {
    rmScratch(dir)
  }
})

test('DBG-97 活着的别人的 pid 让路,释放不删;进程死后才能接手', () => {
  const dir = mkScratch('auto-evolve-lock-')
  const sleeper = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    windowsHide: true,
    stdio: 'ignore',
  })
  try {
    const file = lockPath(dir)
    const born = Date.now() + 3000
    while (!ae.isPidAlive(sleeper.pid) && Date.now() < born) nap(30)
    assert.equal(ae.isPidAlive(sleeper.pid), true)
    const planted = JSON.stringify({ pid: sleeper.pid, at: '2000-01-01T00:00:00.000Z' })
    writeFileSync(file, planted)
    const blocked = ae.acquireLock(file)
    assert.equal(blocked.held, true)
    assert.equal(blocked.pid, sleeper.pid)
    ae.releaseLock(file)
    assert.equal(readFileSync(file, 'utf8'), planted)
    sleeper.kill()
    const dead = Date.now() + 5000
    while (ae.isPidAlive(sleeper.pid) && Date.now() < dead) nap(30)
    assert.equal(ae.isPidAlive(sleeper.pid), false)
    const got = ae.acquireLock(file)
    assert.equal(got.held, false)
    const body = JSON.parse(readFileSync(file, 'utf8'))
    assert.equal(body.pid, process.pid)
    assert.notEqual(body.at, '2000-01-01T00:00:00.000Z')
    ae.releaseLock(file)
    assert.equal(existsSync(file), false)
  } finally {
    try {
      sleeper.kill()
    } catch {
      /* 已经退出 */
    }
    rmScratch(dir)
  }
})

test('死 pid 与非空坏内容仍可接手,不把调度器卡在坏锁上', () => {
  const dir = mkScratch('auto-evolve-lock-')
  try {
    const file = lockPath(dir)
    for (const raw of [JSON.stringify({ pid: 999999999, at: '2000-01-01T00:00:00.000Z' }), '{', '{}']) {
      writeFileSync(file, raw)
      const got = ae.acquireLock(file)
      assert.equal(got.held, false, raw)
      assert.equal(JSON.parse(readFileSync(file, 'utf8')).pid, process.pid)
      ae.releaseLock(file)
      assert.equal(existsSync(file), false)
    }
  } finally {
    rmScratch(dir)
  }
})

test('DBG-93/97 两个进程同时抢,只有一个持有,落败者释放删不掉持有者的锁', { timeout: 60_000 }, async () => {
  const dir = mkScratch('auto-evolve-lock-')
  writeFileSync(join(dir, 'harness.mjs'), harnessSource())
  const children = []
  try {
    const file = lockPath(dir)
    for (const id of ['1', '2']) {
      const child = spawn(process.execPath, [join(dir, 'harness.mjs'), 'race', id, file, dir], {
        cwd: dir,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      child.err = ''
      child.stderr.on('data', (buf) => {
        child.err += String(buf)
      })
      children.push(child)
    }
    const readyBy = Date.now() + 45000
    while (Date.now() < readyBy) {
      if (existsSync(join(dir, 'ready-1')) && existsSync(join(dir, 'ready-2'))) break
      nap(40)
    }
    const errText = children.map((child) => child.err).join('\n')
    assert.ok(existsSync(join(dir, 'ready-1')) && existsSync(join(dir, 'ready-2')), errText || '抢锁进程没有进入起跑线')
    writeFileSync(join(dir, 'start'), 'go')
    const doneBy = Date.now() + 20000
    while (Date.now() < doneBy) {
      if (existsSync(join(dir, 'result-1.json')) && existsSync(join(dir, 'result-2.json'))) break
      nap(40)
    }
    assert.ok(
      existsSync(join(dir, 'result-1.json')) && existsSync(join(dir, 'result-2.json')),
      errText || '抢锁进程没有写出结果',
    )
    const results = ['1', '2'].map((id) => JSON.parse(readFileSync(join(dir, `result-${id}.json`), 'utf8')))
    for (const row of results) assert.equal(row.error, undefined, JSON.stringify(row))
    const winners = results.filter((row) => row.held === false)
    const losers = results.filter((row) => row.held === true)
    assert.equal(winners.length, 1, JSON.stringify(results))
    assert.equal(losers.length, 1, JSON.stringify(results))
    const winner = winners[0]
    const loser = losers[0]
    const payload = JSON.parse(winner.text)
    assert.equal(payload.pid, winner.self)
    assert.notEqual(String(winner.text).trim(), '')
    assert.equal(loser.lockPid, winner.self)
    assert.equal(loser.text, winner.text)
    assert.equal(loser.afterRelease, loser.text)
  } finally {
    for (const child of children) {
      try {
        child.kill()
      } catch {
        /* 已经退出 */
      }
    }
    rmScratch(dir)
  }
})
