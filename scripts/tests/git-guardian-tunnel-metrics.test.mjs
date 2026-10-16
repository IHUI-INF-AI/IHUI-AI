// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 隧道指标落台账的派发点镜像测试(2026-10-16 立,当天实测缺口:cloudflared 无 --logfile、
// monitoring/prometheus 里也没有 cloudflared job ⇒ 事故后没有任何时间轴可回放)。
// 判据一律 import 自 `../git-guardian.mjs` 的 `__test__` 出口(§22c),本文件不重写任何判定。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { __test__ as G } from '../git-guardian.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const round = (over = {}) => ({
  tool: 'record-tunnel-metrics',
  exitCode: 0,
  ok: true,
  ledger: 'ledger/tunnel-metrics.jsonl',
  at: '2026-10-16T16:10:12.243Z',
  port: 20241,
  pids: ['1484'],
  haConnections: 4,
  totalRequests: 20364,
  requestErrors: 103,
  concurrent: 1,
  processStartSeconds: 1792136580,
  pops: ['lax09', 'lax13', 'lax05'],
  previousPops: ['lax12'],
  diff: { requestsDelta: 211, errorsDelta: 0, restarted: false, popChanged: false },
  ...over,
})

function harness(payload, extra = {}) {
  const dir = mkScratch('gg-tunnel-metrics-')
  const logs = []
  return {
    dir,
    logs,
    opts: {
      now: 1_700_000_000_000,
      intervalMs: 0,
      tickFile: `${dir}/tick`,
      lastFile: `${dir}/last.json`,
      logger: (l) => logs.push(String(l)),
      runner: () => ({ status: 0, stdout: JSON.stringify(payload), stderr: '' }),
      ...extra,
    },
  }
}

test('落盘成功 ⇒ 报名并把读数写进 scratch 状态件(污染生产件 = 事故)', () => {
  const h = harness(round())
  try {
    const r = G.auditTunnelMetrics(h.opts)
    assert.equal(r.judged, true, '取到了就该判已落盘')
    assert.ok(h.logs.some((l) => l.includes('✅ 隧道指标台账') && l.includes('lax09')), '落点与腿数必须进日志')
    assert.ok(existsSync(`${h.dir}/last.json`), '状态件必须落在 scratch(证明派发点没写死生产路径)')
  } finally {
    rmScratch(h.dir)
  }
})

test('尺子没取到 ⇒ 未判定并**点名原因**,不落行、不写状态件(假台账比没台账更害人)', () => {
  const h = harness({ ok: false, exitCode: 3, reason: 'netstat 里没枚举到本 pid 的回环 LISTENING 端口 ⇒ metrics 端点不可达' })
  try {
    const r = G.auditTunnelMetrics(h.opts)
    assert.equal(r.judged, false)
    assert.ok(h.logs.some((l) => l.includes('未判定') && l.includes('回环 LISTENING')), '原因必须原样进日志')
    assert.equal(existsSync(`${h.dir}/last.json`), false, '没取到不许写状态件')
  } finally {
    rmScratch(h.dir)
  }
})

test('结论不可解析 ⇒ 未判定,不记成"已落盘"', () => {
  const h = harness(round(), { runner: () => ({ status: 2, stdout: '', stderr: 'boom' }) })
  try {
    const r = G.auditTunnelMetrics(h.opts)
    assert.equal(r.judged, false)
    assert.ok(h.logs.some((l) => l.includes('未取到')), '必须报名,不得静默')
  } finally {
    rmScratch(h.dir)
  }
})

test('落点 PoP 换过 / 进程重启过 ⇒ 报数进日志(这是唯一有告警语义的两档,但仍不寄信)', () => {
  const mv = harness(round({ diff: { requestsDelta: null, errorsDelta: null, restarted: true, popChanged: true } }))
  try {
    G.auditTunnelMetrics(mv.opts)
    assert.ok(mv.logs.some((l) => l.includes('落点 PoP 变了') && l.includes('lax12')), '换 PoP 必须报数')
    assert.ok(mv.logs.some((l) => l.includes('重启过')), '进程重启必须报数(累计值已归零,差分不许相减)')
  } finally {
    rmScratch(mv.dir)
  }
})

test('新增回源错误 ⇒ 报数进日志(带增量与累计两个数,只报数不判红)', () => {
  const h = harness(round({ diff: { requestsDelta: 211, errorsDelta: 7, restarted: false, popChanged: false } }))
  try {
    G.auditTunnelMetrics(h.opts)
    assert.ok(h.logs.some((l) => l.includes('新增回源错误 7 次') && l.includes('103')), '增量与累计都要写')
  } finally {
    rmScratch(h.dir)
  }
})

test('节流:同一窗口内第二次不得再派生', () => {
  const h = harness(round(), { intervalMs: 15 * 60 * 1000 })
  try {
    const first = G.auditTunnelMetrics(h.opts)
    const second = G.auditTunnelMetrics(h.opts)
    assert.equal(first.ran, true)
    assert.equal(second.ran, false, '未到窗口不得重跑')
    assert.equal(second.why, '未到节流窗口')
  } finally {
    rmScratch(h.dir)
  }
})

test('形状锁:已接调度器(造好没装车 = 没有,§0.9)且判据从 __test__ 可达(§22c)', () => {
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  const guardian = readFileSync(fileURLToPath(new URL('../git-guardian.mjs', import.meta.url)), 'utf8')
  assert.ok(/if \(!CHECK_ONLY\) auditTunnelMetrics\(\)/.test(guardian), '派发点必须真挂在守护的非 --check 轮次里')
  assert.ok(/auditTunnelMetrics,/.test(guardian), '必须从 __test__ 出口可达,否则镜像只能复制判据')
  assert.ok(/existsSync\(script\)/.test(guardian.slice(guardian.indexOf('export function auditTunnelMetrics'))), '尺子脚本不在位必须显式跳过,不得硬跑')
  const calls = [...src.matchAll(/G\.auditTunnelMetrics\(([^)]*)\)/g)].map((m) => m[1].trim())
  assert.ok(calls.length >= 5, `调用点少于 5 处说明有档没测,现读 ${calls.length}`)
  for (const c of calls) assert.match(c, /^(h|mv)\.opts$/, `必须经 harness 造 opts,实得:${c}`)
  const harnessBlock = src.slice(src.indexOf('function harness('), src.indexOf('test('))
  for (const key of ['tickFile', 'lastFile']) assert.ok(new RegExp(`${key}:\\s*\`\\$\\{dir\\}/`).test(harnessBlock), `harness 缺 ${key} 的 scratch 覆写`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
