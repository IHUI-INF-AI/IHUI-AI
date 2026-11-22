// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// daemon 档存活兜底的镜像测试(2026-10-29)。
// 判据一律 import 源脚本的 __test__(§22c),不在本文件复制 STATE 码表。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { __test__ as G } from '../git-guardian.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const GUARDIAN = path.join(ROOT, 'scripts', 'git-guardian.mjs')
const CONFIG = path.join(ROOT, 'scripts', 'data', 'service-auto-restart.json')

const { judgeGuardDaemonAlive, ensureGuardDaemonAlive } = G
const SRC = readFileSync(GUARDIAN, 'utf8')

/** 按动词分桶、按次取值的假 runner;值为 Error 时 throw(模拟 sc 非 0 退出)。 */
function makeRunner(table) {
  const calls = []
  const seen = {}
  const run = (args) => {
    const verb = args[0]
    calls.push(verb)
    const list = table[verb]
    if (!list) return ''
    const i = seen[verb] ?? 0
    seen[verb] = i + 1
    const v = list[Math.min(i, list.length - 1)]
    if (v instanceof Error) throw v
    return v
  }
  run.calls = calls
  return run
}

const AUTO = 'START_TYPE : 2   AUTO_START (DELAYED)'
const MANUAL = 'START_TYPE : 3   DEMAND_START'

// ── 纯判据 ────────────────────────────────────────────────────────────────
test('daemon 档永不代拉自己:哪怕状态是 STOPPED+AUTO', () => {
  const v = judgeGuardDaemonAlive({
    daemon: true,
    queryOutput: 'STATE : 1  STOPPED',
    configOutput: AUTO,
  })
  assert.deepEqual(v, { action: 'noop', reason: 'daemon-self' })
})

test('RUNNING ⇒ 不动', () => {
  assert.deepEqual(judgeGuardDaemonAlive({ queryOutput: 'STATE : 4  RUNNING', configOutput: AUTO }), {
    action: 'noop',
    reason: 'running',
  })
})

test('过渡态 START_PENDING / STOP_PENDING 都不插一脚', () => {
  for (const code of [2, 3]) {
    const v = judgeGuardDaemonAlive({ queryOutput: `STATE : ${code}  PENDING`, configOutput: AUTO })
    assert.equal(v.action, 'noop')
    assert.equal(v.reason, 'pending')
  }
})

test('STOPPED + 自动启动 ⇒ 代拉', () => {
  assert.deepEqual(
    judgeGuardDaemonAlive({ queryOutput: 'STATE : 1  STOPPED', configOutput: AUTO }),
    { action: 'start', reason: 'stopped' },
  )
})

test('STOPPED + 手动启动 ⇒ 不代拉(人刻意停的)', () => {
  const v = judgeGuardDaemonAlive({ queryOutput: 'STATE : 1  STOPPED', configOutput: MANUAL })
  assert.equal(v.action, 'noop')
  assert.equal(v.reason, 'not-auto-start')
})

test('取不到状态 / 取不到启动类型 / 未知码 ⇒ 一律未判定', () => {
  assert.equal(judgeGuardDaemonAlive({ queryOutput: '', configOutput: AUTO }).reason, 'state-unreadable')
  assert.equal(
    judgeGuardDaemonAlive({ queryOutput: 'STATE : 1  STOPPED', configOutput: '' }).reason,
    'config-unreadable',
  )
  assert.equal(
    judgeGuardDaemonAlive({ queryOutput: 'STATE : 7  SOMETHING', configOutput: AUTO }).reason,
    'state-7',
  )
})

// ── 执行器(注入 runner,零真实服务操作)────────────────────────────────────
test('执行器:daemon 档直接返回,一个 sc 都不调', () => {
  const run = makeRunner({})
  const r = ensureGuardDaemonAlive({ runner: run, daemon: true })
  assert.equal(r.ran, false)
  assert.equal(r.why, 'daemon-self')
  assert.deepEqual(run.calls, [])
})

test('执行器:RUNNING 时只查一次,不碰 qc / start', () => {
  const run = makeRunner({ query: ['STATE : 4  RUNNING'] })
  const r = ensureGuardDaemonAlive({ runner: run, daemon: false, logger: () => {} })
  assert.equal(r.ok, true)
  assert.equal(r.why, 'running')
  assert.deepEqual(run.calls, ['query'])
})

test('执行器:STOPPED+AUTO ⇒ start 后复验 RUNNING 才算成功', () => {
  const run = makeRunner({
    query: ['STATE : 1  STOPPED', 'STATE : 4  RUNNING'],
    qc: [AUTO],
    start: [''],
  })
  const r = ensureGuardDaemonAlive({ runner: run, daemon: false, logger: () => {} })
  assert.equal(r.ok, true)
  assert.equal(r.why, 'restarted')
  assert.deepEqual(run.calls, ['query', 'qc', 'start', 'query'])
})

test('执行器:代拉后先 START_PENDING 再 RUNNING ⇒ 必须等到 RUNNING,不能把过渡态当失败', () => {
  const run = makeRunner({
    query: ['STATE : 1  STOPPED', 'STATE : 2  START_PENDING', 'STATE : 4  RUNNING'],
    qc: [AUTO],
    start: [''],
  })
  const r = ensureGuardDaemonAlive({ runner: run, daemon: false, logger: () => {}, sleep: () => {} })
  assert.equal(r.ok, true)
  assert.equal(r.why, 'restarted')
  assert.ok(!run.calls.includes('query') === false)
  assert.equal(run.calls.filter((c) => c === 'query').length, 3, '要查三次:停 → 启动中 → 已运行')
})

test('执行器:过渡态一直不落定 ⇒ 等待超时后判失败,不挂死', () => {
  const run = makeRunner({
    query: ['STATE : 1  STOPPED', 'STATE : 2  START_PENDING'],
    qc: [AUTO],
    start: [''],
  })
  const r = ensureGuardDaemonAlive({
    runner: run,
    daemon: false,
    logger: () => {},
    sleep: () => {},
    waitMs: 0,
  })
  assert.equal(r.ok, false)
  assert.equal(r.why, 'pending')
})

test('执行器:代拉后仍 STOPPED ⇒ 判失败,不谎报', () => {
  const lines = []
  const run = makeRunner({
    query: ['STATE : 1  STOPPED', 'STATE : 1  STOPPED'],
    qc: [AUTO],
    start: [''],
  })
  const r = ensureGuardDaemonAlive({ runner: run, daemon: false, logger: (m) => lines.push(m) })
  assert.equal(r.ok, false)
  assert.equal(r.why, 'stopped')
  assert.match(lines.join('\n'), /代拉后仍非 RUNNING/)
})

test('执行器:sc query 抛错(服务不存在 1060)⇒ 未判定且不调 start', () => {
  const run = makeRunner({ query: [new Error('1060')] })
  const r = ensureGuardDaemonAlive({ runner: run, daemon: false, logger: () => {} })
  assert.equal(r.ok, false)
  assert.equal(r.why, 'state-unreadable')
  assert.deepEqual(run.calls, ['query'])
})

// ── 接线形状锁(摘掉即翻红)─────────────────────────────────────────────────
test('单轮路径真的挂了这条腿', () => {
  assert.match(SRC, /if \(!CHECK_ONLY\) ensureGuardDaemonAlive\(\)/)
})

test('全文件只有一处调用:daemon tick 段不得调它(防自杀)', () => {
  assert.equal((SRC.match(/ensureGuardDaemonAlive\(\)/g) || []).length, 1)
})

test('台账仍把 IHUI-GIT-GUARD 排除在通用自愈之外(两条腿的分工不能混)', () => {
  const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'))
  const hit = (cfg.excluded || []).filter((x) => x.name === 'IHUI-GIT-GUARD')
  assert.equal(hit.length, 1, '被挪进 services 就会让 heal-unresponsive-services 去重启正在跑它的自己')
  assert.match(hit[0].reason, /自我杀进程/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
