// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:等锁可观测面(scripts/git-lock.mjs 的 lock-wait 登记 / 进度行 / status 读数)
//
// 立因(机主实测):"提交总在等锁,排队的情况没有数据实时返回" —— 旧 acquire 每 300ms 轮询却零输出,
// 等待期没有任何可数事实。本测试钉住三件事,防止观测面退化成"看起来有、其实读不到":
//   ① 登记能被读出来,且**位次按开始等待的先后**(不是按文件名字典序);
//   ② pid 已退出 / 超 60s 未刷新的登记**不计数**并如实报条数(不得把残留算成排队);
//   ③ 真进等待环时**真的打进度行**,且夹具(注入 dir)**绝不回落到真实 state 账本**。
// 真机零副作用:所有锁目录/登记目录都取自 mkScratch(),不碰真实 .ihui-agent/state。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gl } from '../git-lock.mjs'

function waitDirFixture(t) {
  const scratch = mkScratch('git-lock-wait-')
  t.after(() => rmScratch(scratch))
  const dir = join(scratch, 'lock-wait')
  mkdirSync(dir, { recursive: true })
  return { scratch, dir }
}

function putEntry(dir, name, row) {
  writeFileSync(join(dir, name), JSON.stringify(row), 'utf8')
}

test('①登记可读 + 位次按开始等待先后(不是文件名字典序)', (t) => {
  const { dir } = waitDirFixture(t)
  const now = Date.now()
  // 文件名刻意让"后开始等的人"字典序在前,判据必须按 requestedAt 排
  putEntry(dir, 'aaa-1111.json', { pid: 111, unitId: '后到', requestedAt: now - 3000, lastPollAt: now - 500 })
  putEntry(dir, 'zzz-2222.json', { pid: 222, unitId: '先到', requestedAt: now - 6000, lastPollAt: now - 500 })
  const r = gl.readWaitQueue({ dir, now, alive: () => true })
  assert.equal(r.readable, true)
  assert.equal(r.entries.length, 2)
  assert.equal(r.entries[0].pid, 222, '先开始等待的必须排第 1')
  assert.equal(r.entries[0].waitedMs, 6000)
  assert.equal(r.entries[1].pid, 111)
})

test('②pid 已退出 ⇒ 不计数,只报 droppedDead(残留不得算成排队)', (t) => {
  const { dir } = waitDirFixture(t)
  const now = Date.now()
  putEntry(dir, 'a.json', { pid: 111, unitId: 'A', requestedAt: now - 1000, lastPollAt: now - 500 })
  putEntry(dir, 'b.json', { pid: 222, unitId: 'B', requestedAt: now - 2000, lastPollAt: now - 500 })
  // 只让 pid=111 活着 ⇒ 222 判死
  const r = gl.readWaitQueue({ dir, now, alive: (p) => Number(p) === 111 })
  assert.equal(r.entries.length, 1)
  assert.equal(r.entries[0].pid, 111)
  assert.equal(r.droppedDead, 1)
})

test('③超 60s 未刷新 ⇒ 不计数,只报 droppedStale(卡死/遗留的登记不得冒充排队)', (t) => {
  const { dir } = waitDirFixture(t)
  const now = Date.now()
  putEntry(dir, 'a.json', { pid: 111, unitId: 'A', requestedAt: now - 200_000, lastPollAt: now - 90_000 })
  putEntry(dir, 'b.json', { pid: 222, unitId: 'B', requestedAt: now - 2000, lastPollAt: now - 1000 })
  const r = gl.readWaitQueue({ dir, now, alive: () => true })
  assert.equal(r.entries.length, 1, '只有刷新新鲜的才算在等')
  assert.equal(r.entries[0].pid, 222)
  assert.equal(r.droppedStale, 1)
})

test('④目录不存在 = 读到了 0 人(不是"读不到");显式 null = 不可读(不复用真实账本)', () => {
  const empty = join(mkScratch('git-lock-empty-'), 'lock-wait')
  const r1 = gl.readWaitQueue({ dir: empty, now: Date.now(), alive: () => true })
  assert.equal(r1.present, false)
  assert.equal(r1.readable, true, '目录不存在是"确实没人等",必须可读')
  assert.equal(r1.entries.length, 0)
  const r2 = gl.readWaitQueue({ dir: null, now: Date.now(), alive: () => true })
  assert.equal(r2.readable, false, 'null 目录必须落"不可读"(未判定),绝不回落到真实账本')
  rmScratch(empty)
})

test('⑤进度行必须同时带"等了多久/持锁是谁/我第几位"', () => {
  const line = gl.buildWaitProgressLine({
    meta: { unitId: 'safe-commit-9', pid: 4242, ts: Date.now() - 40_000 },
    waitedMs: 12_000,
    timeoutMs: 900_000,
    queue: { readable: true, entries: [{ pid: 777, requestedAt: 1 }, { pid: process.pid, requestedAt: 2 }] },
  })
  assert.match(line, /等锁 12s\/15m00s/, '必须报已等多久与总预算(fmtSec:秒/分两种形态)')
  assert.match(line, /持锁 unit=safe-commit-9 pid=4242/, '必须报持锁者')
  assert.match(line, /已持 40s/, '必须报已持多久')
  assert.match(line, /我在第 2 位,前面 1 位/, '必须报位次(自己也算在队列里)')
  assert.match(line, /git-lock\.mjs status/, '必须给出随时可查的出路')
})

test('⑥端到端:真进等待环 ⇒ 真打进度行,且夹具不回落到真实账本', async (t) => {
  const scratch = mkScratch('git-lock-progress-')
  t.after(() => rmScratch(scratch))
  const dir = join(scratch, 'lock')
  mkdirSync(dir, { recursive: true })
  // 活 pid(=本进程)持有的锁:stale 不触发,等待环真的跑起来
  writeFileSync(
    join(dir, 'meta.json'),
    JSON.stringify({ unitId: 'other-unit', pid: process.pid, ts: Date.now() }),
    'utf8',
  )
  const timer = setTimeout(() => {
    try {
      rmScratch(dir)
    } catch {
      /* 已删 */
    }
  }, 900)
  t.after(() => clearTimeout(timer))
  const lines = []
  const got = await gl.acquire({
    unitId: 'waiter',
    timeoutMs: 4000,
    staleMs: 300_000,
    dir,
    cleanIndexLocks: false,
    progressMs: 400,
    log: (m) => lines.push(m),
  })
  assert.equal(got, true, '持有者释放后等待方必须拿到锁')
  assert.ok(lines.length > 0, `等待期必须打进度行,实得 ${JSON.stringify(lines)}`)
  assert.ok(lines.some((l) => /等锁/.test(l)), `必须至少一行等锁进度,实得 ${JSON.stringify(lines)}`)
  assert.ok(
    lines.some((l) => /队列不可读/.test(l)),
    '注入 dir 的夹具必须如实报"队列不可读",不得回落到真实 .ihui-agent/state',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
