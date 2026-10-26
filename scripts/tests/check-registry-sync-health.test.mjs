// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-registry-sync-health 镜像测试(2026-10-25 立)。
 * §22c:判据一律 import 源脚本 __test__,测试不复制第二份。
 * 全离线:审计层的 runner/logger/notify 走注入,不派生 psql、不发真邮件(§5 隔离)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as H } from '../check-registry-sync-health.mjs'
import { __test__ as AUDIT } from '../lib/registry-sync-audit.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GUARDIAN_SRC = readFileSync(join(HERE, '..', 'git-guardian.mjs'), 'utf8')

const H_OK = (startedAt) => ({ status: 'success', startedAt, err: '' })
const H_BAD = (startedAt, err = 'boom') => ({ status: 'fail', startedAt, err })
const NOW = Date.parse('2026-10-25T12:00:00.000Z')
const HR = 3600_000

// ── 尺子判据三态 ─────────────────────────────────────────────────────────────
test('J1 空账/非数组 ⇒ 未判定(不拿"没同步过"冒充健康,也不冒充停更)', () => {
  for (const rows of [[], null, undefined, 'x']) {
    const v = H.judgeSyncHealth({ rows, nowMs: NOW })
    assert.equal(v.state, 'undetermined')
  }
})

test('J2a 最新一轮 fail(昨天还成功) ⇒ 当轮即 finding —— "静默报红"不许等它烂过陈旧档', () => {
  const v = H.judgeSyncHealth({
    rows: [
      H_BAD(NOW - 1 * HR),
      { status: 'success', startedAt: new Date(NOW - 2 * HR).toISOString(), err: '' },
      H_BAD(NOW - 40 * HR),
    ],
    nowMs: NOW,
  })
  assert.equal(v.state, 'finding')
  assert.match(v.reason, /最新一轮已定局为 fail/)
  assert.match(v.reason, /上一轮 success 距今 2\.0h/)
  assert.equal(v.consecutiveBad, 1)
  assert.equal(v.lastSuccessAt, new Date(NOW - 2 * HR).toISOString())
})

test('J2b 最新一轮 success ⇒ ok,其前再大的 fail 洪也不回改结论(恢复即绿)', () => {
  const v = H.judgeSyncHealth({
    rows: [
      H_OK(new Date(NOW - 1 * HR).toISOString()),
      H_BAD(NOW - 2 * HR),
      { status: 'skipped', startedAt: new Date(NOW - 3 * HR).toISOString(), err: '' },
      H_BAD(NOW - 4 * HR),
    ],
    nowMs: NOW,
  })
  assert.equal(v.state, 'ok')
  assert.equal(v.consecutiveBad, 0)
})

test('J2c 最新 success 但陈旧超阈 ⇒ finding(全 success 却早停的形态兜底)', () => {
  const v = H.judgeSyncHealth({ rows: [H_OK(new Date(NOW - 40 * HR).toISOString())], nowMs: NOW })
  assert.equal(v.state, 'finding')
  assert.match(v.reason, /距今 40\.0h > 36h/)
})

test('J3 有轮次但从未 success ⇒ finding(never-success)', () => {
  const v = H.judgeSyncHealth({
    rows: [
      H_BAD(NOW - 1 * HR),
      { status: 'skipped', startedAt: new Date(NOW - 2 * HR).toISOString(), err: '' },
    ],
    nowMs: NOW,
  })
  assert.equal(v.state, 'finding')
  assert.match(v.reason, /从未有过 success/)
  assert.equal(v.consecutiveBad, 2)
})

test('J4 skipped(上游整轮空手)不算成功证据;running 也不算失败证据', () => {
  const v = H.judgeSyncHealth({
    rows: [
      { status: 'skipped', startedAt: new Date(NOW - 3 * HR).toISOString(), err: '' },
      { status: 'running', startedAt: new Date(NOW - 5 * HR).toISOString(), err: '' },
      H_OK(new Date(NOW - 50 * HR).toISOString()),
    ],
    nowMs: NOW,
  })
  assert.equal(v.state, 'finding', '唯一 success 在 50h 前 ⇒ 停更')
  assert.match(v.reason, /距今 50/)
  assert.equal(v.consecutiveBad, 1, 'running 不计数、skipped 计数')
})

test('J5 started_at 不可解 ⇒ 未判定(判据本身问不到时两头都不许写死)', () => {
  const v = H.judgeSyncHealth({ rows: [H_OK('不是日期')], nowMs: NOW })
  assert.equal(v.state, 'undetermined')
})

// ── SQL 构造与解析 ───────────────────────────────────────────────────────────
test('S1 buildSql:只收有限正整数,别的一律回落默认(注入面焊死)', () => {
  assert.match(H.buildSql(10), /limit 10;/)
  for (const bad of [0, -5, NaN, 9999, '30; drop table', undefined]) {
    const sql = H.buildSql(bad)
    assert.match(sql, /limit 30;/, `坏值 ${String(bad)} 必须回落默认`)
    assert.ok(!/;.*;/.test(sql.slice(0, -1)), '不允许多语句')
  }
})

test('S2 parseRows:制表符切列、错误信息内嵌 tab 归一、空行与无状态行丢弃', () => {
  const rows = H.parseRows(
    'success\t2026-10-25 04:00:00+00\t\nfail\t2026-10-24 04:00:00+00\tbad\tthing\n\t\n',
  )
  assert.equal(rows.length, 2)
  assert.equal(rows[1].err, 'bad\tthing')
})

// ── 审计层(lib) ─────────────────────────────────────────────────────────────
function harness({ stdout, status = 0 } = {}) {
  const dir = mkScratch('rsah-')
  const calls = []
  const notifies = []
  const logs = []
  const opts = {
    now: NOW,
    script: join(dir, 'ruler.mjs'),
    tickFile: join(dir, 'state', 'tick.ts'),
    cwd: dir,
    logger: (m) => logs.push(String(m)),
    notify: (name, detail, o) => {
      calls.push([name, detail, o])
      const ret = { suppressed: notifies.includes(o?.dedupKey) ? true : false, sent: true }
      notifies.push(o?.dedupKey)
      return ret
    },
    runner: () => ({ status, stdout, stderr: '' }),
  }
  writeFileSync(opts.script, '// 占位尺子(存在性判据用)\n', 'utf8')
  return { dir, opts, logs, calls }
}

test('A1 尺子不在位 ⇒ ran=false,不记为已巡检(§0.3)', () => {
  const h = harness({})
  rmSync(h.opts.script, { force: true })
  const r = AUDIT.runRegistrySyncHealth(h.opts)
  assert.equal(r.ran, false)
})

test('A2 ok 读数 ⇒ 一行✅零通知;undetermined ⇒ 不喊人(缺库机器不得恒响)', () => {
  const h = harness({
    stdout: JSON.stringify({
      state: 'ok',
      reason: '最近一次 success 距今 2.0h',
      lastSuccessAt: 'x',
      consecutiveBad: 0,
    }),
  })
  try {
    const r = AUDIT.runRegistrySyncHealth(h.opts)
    assert.equal(r.state, 'ok')
    assert.equal(h.calls.length, 0)
    assert.match(h.logs.join('\n'), /✅ 目录同步哨兵/)
  } finally {
    rmSync(h.dir, { recursive: true, force: true })
  }
  const h2 = harness({ stdout: JSON.stringify({ state: 'undetermined', reason: 'DSN 取不到' }) })
  try {
    const r2 = AUDIT.runRegistrySyncHealth(h2.opts)
    assert.equal(r2.judged, false)
    assert.equal(h2.calls.length, 0)
    assert.match(h2.logs.join('\n'), /未判定/)
  } finally {
    rmSync(h2.dir, { recursive: true, force: true })
  }
})

test('A3 finding ⇒ notify 一次且 identity 是「episode锚」不含会抖的连续数;同锚二次命中 suppressed', () => {
  const h = harness({
    stdout: JSON.stringify({
      state: 'finding',
      reason: '最近一次 success 距今 40h,其后连续 fail/skipped=2',
      lastSuccessAt: '2026-10-23T04:00:00.000Z',
      consecutiveBad: 2,
    }),
  })
  try {
    const r = AUDIT.runRegistrySyncHealth(h.opts)
    assert.equal(r.state, 'finding')
    assert.equal(h.calls.length, 1)
    const dedupKey = h.calls[0][2].dedupKey
    assert.ok(dedupKey, 'finding 必须给稳定 dedupKey(否则每轮一封信)')
    assert.doesNotMatch(dedupKey, /40h|连续|consecutiveBad|距今/, '抖量不得进身份(224 V1)')
    assert.match(dedupKey, /last=2026-10-23T04:00:00\.000Z/)
    const r2 = AUDIT.runRegistrySyncHealth({ ...h.opts, now: NOW + 31 * 60_000 })
    assert.equal(r2.state, 'finding')
    assert.equal(h.calls.length, 2, '第二次也调用 notify(压不压由通道按身份裁决)')
    assert.match(
      h.calls[1][1],
      /check-registry-sync-health/,
      '正文必须给可执行取证出口(5e-1 可整改性)',
    )
  } finally {
    rmSync(h.dir, { recursive: true, force: true })
  }
})

test('A4 节流失效自检:同窗口第二轮零派发', () => {
  const h = harness({ stdout: JSON.stringify({ state: 'ok', reason: 'r' }) })
  try {
    const first = AUDIT.runRegistrySyncHealth(h.opts)
    assert.equal(first.ran, true)
    const second = AUDIT.runRegistrySyncHealth({ ...h.opts, now: NOW + 60_000 })
    assert.equal(second.ran, false)
    assert.equal(second.why, '未到节流窗口')
  } finally {
    rmSync(h.dir, { recursive: true, force: true })
  }
})

test('A5 读数不可解析 ⇒ 未判定留痕,不猜健康', () => {
  const h = harness({ stdout: 'boom not json', status: 2 })
  try {
    const r = AUDIT.runRegistrySyncHealth(h.opts)
    assert.equal(r.judged, false)
    assert.match(h.logs.join('\n'), /未判定/)
  } finally {
    rmSync(h.dir, { recursive: true, force: true })
  }
})

// ── 装车锁(§0.9:判据在、工具在、没人调度 = 没有) ────────────────────────────
test('W1 守护必须真派发本格:恰一处实调用,且排在迁移缺口审计之后', () => {
  const lines = GUARDIAN_SRC.split('\n')
  const at = (needle) => lines.findIndex((l) => l.trim() === needle)
  const dispatch = lines.filter((l) => l.trim() === 'if (!CHECK_ONLY) auditRegistrySyncHealth()')
  assert.equal(dispatch.length, 1, `派发点必须恰一处,实得 ${dispatch.length}`)
  const mig = at('if (!CHECK_ONLY) auditMigrationGaps()')
  const mine = at('if (!CHECK_ONLY) auditRegistrySyncHealth()')
  assert.ok(mig >= 0 && mine > mig, '必须与迁移缺口审计同族排布(同一 DB 观测层)')
  assert.ok(
    GUARDIAN_SRC.includes('runRegistrySyncHealth'),
    '守护接线必须调 lib 审计层(判据单源在住 lib)',
  )
})

test('W2 接线薄度:guardian 里本格只做依赖注入,判定与文案不得回流(§0.6)', () => {
  const i = GUARDIAN_SRC.indexOf('export function auditRegistrySyncHealth')
  assert.ok(i > 0)
  const body = GUARDIAN_SRC.slice(i, i + 900)
  assert.ok(!/notify\(|execFileSync\(/.test(body), '通知与派生住在 lib,守护函数体不得再生第二份')
  assert.match(body, /tickFile: REGISTRY_SYNC_AUDIT_TICK/)
})

test('T1 节流纯函数:差一秒不进窗口,满窗必进,tick 缺省 ⇒ 该跑', () => {
  const due = AUDIT.registrySyncHealthDue
  assert.equal(due(NOW, NaN), true)
  assert.equal(due(NOW + 30 * 60_000 - 1, NOW), false)
  assert.equal(due(NOW + 30 * 60_000, NOW), true)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
