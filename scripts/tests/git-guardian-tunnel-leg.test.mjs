// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 隧道腿健康哨的派发点镜像测试(2026-10-16 立,当天实测到"4 条腿全吊在首选寿命 0s 的将删地址上")。
// 判据一律 import 自 `../git-guardian.mjs` 的 `__test__` 出口(§22c),本文件不重写任何判定。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { __test__ as G } from '../git-guardian.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const dims = (over) => ({
  'leg-count': { verdict: 'ok', reading: { legs: 4, pids: ['1484'] } },
  'deprecated-source': { verdict: 'ok', reading: { sources: [{ addr: '2408:…:60a3', preferredLifetime: '22h1m12s', state: '首选项' }] } },
  'single-source-point': { verdict: 'warn', reason: '4 条腿共用一个源地址(健康态亦此形态 ⇒ 只报数)', reading: { sources: 1 } },
  ...over,
})

function harness(d, extra = {}) {
  const dir = mkScratch('gg-tunnel-')
  const sent = []
  const logs = []
  return {
    dir,
    sent,
    logs,
    opts: {
      now: 1_700_000_000_000,
      intervalMs: 0,
      tickFile: `${dir}/tick`,
      lastFile: `${dir}/last.json`,
      logger: (l) => logs.push(String(l)),
      notify: (name, detail, o) => {
        sent.push({ name, detail: String(detail), opts: o || {} })
        return { sent: true }
      },
      runner: () => ({ status: 0, stdout: JSON.stringify({ exitCode: 0, legs: 4, pids: ['1484'], dims: d }), stderr: '' }),
      ...extra,
    },
  }
}

test('deprecated-source ⇒ 到人,身份点名是哪一维,出路给可执行的重启动作', () => {
  const h = harness(dims({ 'deprecated-source': { verdict: 'breach', reason: '在用源地址 2408:…:bb3 首选寿命 0s(反对)', reading: { sources: [{ addr: '2408:…:bb3', preferredLifetime: '0s', state: '反对' }] } } }))
  try {
    G.auditTunnelLegHealth(h.opts)
    assert.equal(h.sent.length, 1, `越阈必须到人,实寄 ${h.sent.length}`)
    assert.match(h.sent[0].name, /deprecated-source/, '身份必须点名是哪一维红了')
    assert.match(h.sent[0].detail, /2408:/, '在用地址必须进正文(否则收信人不知道是哪条)')
    assert.match(h.sent[0].detail, /重启 `Cloudflared`/, '出路必须给能动手的那一下')
    assert.match(h.sent[0].detail, /530/, '必须写清不后果,让人知道为什么现在做')
    assert.ok(h.sent[0].opts.dedupKey, '必须给 dedupKey(§5e-1:同身份去重而不是按抖动明细)')
  } finally {
    rmScratch(h.dir)
  }
})

test('变异对照:同一份 dims 只把 verdict 从 breach 改成 ok ⇒ 一封都不许发', () => {
  const breach = harness(dims({ 'deprecated-source': { verdict: 'breach', reason: '寿命 0s', reading: {} } }))
  const ok = harness(dims({}))
  try {
    G.auditTunnelLegHealth(breach.opts)
    G.auditTunnelLegHealth(ok.opts)
    assert.equal(breach.sent.length, 1, '阳性色必须发')
    assert.equal(ok.sent.length, 0, `全绿却发信 = 判据被写死(breach=${breach.sent.length} ok=${ok.sent.length})`)
    assert.ok(ok.logs.some((l) => l.includes('✅ 隧道腿健康') && l.includes('4 条腿')), '绿也必须报名(不得静默成"没跑")')
  } finally {
    rmScratch(breach.dir)
    rmScratch(ok.dir)
  }
})

test('单点共用只报数不判红(健康态亦此形态 ⇒ 判红就是 §12e 的恒红门)', () => {
  const h = harness(dims({}))
  try {
    const r = G.auditTunnelLegHealth(h.opts)
    assert.equal(h.sent.length, 0, 'warn 维不得到人')
    assert.equal(r.warns, 1, `warn 必须计数并写日志,实得 ${r.warns}`)
    assert.ok(h.logs.some((l) => l.includes('报数') && l.includes('single-source-point')), 'warn 的读数必须可见')
  } finally {
    rmScratch(h.dir)
  }
})

test('edge-location 落点:境外 PoP 只报数不寄信(本机在国内而 CF 无大陆 PoP ⇒ 判红即 §12e 恒红门)', () => {
  const h = harness(dims({ 'edge-location': { verdict: 'warn', reason: '隧道 3 条腿全部落在非亚太 PoP(lax09/lax13/lax05);入口慢先归因跨境段,别去查 web/api', reading: { pops: ['lax09', 'lax13', 'lax05'], near: [], far: ['lax09', 'lax13', 'lax05'] } } }))
  try {
    const r = G.auditTunnelLegHealth(h.opts)
    assert.equal(h.sent.length, 0, '落点报数不得寄信(常态形态)')
    assert.equal(r.warns, 2, `warn 必须计数(单点 + 落点),实得 ${r.warns}`)
    assert.ok(h.logs.some((l) => l.includes('edge-location') && l.includes('lax09')), '落点读数必须进日志,否则收信人不知道该归因到哪一段')
  } finally {
    rmScratch(h.dir)
  }
})

test('未判定:不喊人但必须点名原因(把"没量到"写成"没问题"是本仓最高频失效型)', () => {
  const h = harness(dims({ 'leg-count': { verdict: 'unjudged', reason: 'cloudflared 进程不在(不是"0 条腿")', reading: { pids: [] } } }))
  try {
    const r = G.auditTunnelLegHealth(h.opts)
    assert.equal(h.sent.length, 0)
    assert.equal(r.unjudged, 1)
    assert.ok(h.logs.some((l) => l.includes('未判定') && l.includes('进程不在')), '原因必须原样进日志')
  } finally {
    rmScratch(h.dir)
  }
})

test('尺子没产出可解析结论 ⇒ judged=false,不记为已探测,也不寄信', () => {
  const h = harness(dims({}), {})
  h.opts.runner = () => ({ status: 2, stdout: '', stderr: 'boom' })
  try {
    const r = G.auditTunnelLegHealth(h.opts)
    assert.equal(r.judged, false)
    assert.equal(h.sent.length, 0)
    assert.ok(h.logs.some((l) => l.includes('未产出结论')))
  } finally {
    rmScratch(h.dir)
  }
})

test('节流:同一窗口内第二次不得再派生(节奏控制,不是每日封顶)', () => {
  const h = harness(dims({}), { intervalMs: 15 * 60 * 1000 })
  try {
    const first = G.auditTunnelLegHealth(h.opts)
    const second = G.auditTunnelLegHealth(h.opts)
    assert.equal(first.ran, true)
    assert.equal(second.ran, false, '未到窗口不得重跑(两个执行体共用一个戳,靠这里挡重复测量)')
    assert.equal(second.why, '未到节流窗口')
  } finally {
    rmScratch(h.dir)
  }
})

test('尺子自己的阳性对照失手 ⇒ 整轮不采信:即使 dims 报 breach 也不寄信(瞎掉的尺子没资格出合格证,也没资格喊人)', () => {
  const h = harness(dims({ 'deprecated-source': { verdict: 'breach', reason: '寿命 0s', reading: {} } }))
  h.opts.runner = () => ({ status: 3, stdout: JSON.stringify({ exitCode: 3, legs: 4, positiveControl: 'miss', dims: dims({ 'deprecated-source': { verdict: 'breach', reason: '寿命 0s', reading: {} } }) }), stderr: '' })
  try {
    const r = G.auditTunnelLegHealth(h.opts)
    assert.equal(r.judged, false, '对照未命中必须判"本轮不采信"')
    assert.equal(h.sent.length, 0, `失明的一轮不得派人,实寄 ${h.sent.length}`)
    assert.ok(h.logs.some((l) => l.includes('阳性对照未命中')), '而且必须报名,不得静默当"没问题"')
  } finally {
    rmScratch(h.dir)
  }
})

test('形状锁:已接调度器且调用点状态件全钉在 scratch 内(判据没上车=没有;污染生产件=事故)', () => {
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  const guardian = readFileSync(fileURLToPath(new URL('../git-guardian.mjs', import.meta.url)), 'utf8')
  assert.ok(/if \(!CHECK_ONLY\) auditTunnelLegHealth\(\)/.test(guardian), '派发点必须真挂在守护的非 --check 轮次里 —— 造好没装车 = 没有(§0.9)')
  assert.ok(/auditTunnelLegHealth,/.test(guardian), '必须从 __test__ 出口可达,否则镜像只能复制判据(§22c)')
  const calls = [...src.matchAll(/G\.auditTunnelLegHealth\(([^)]*)\)/g)].map((m) => m[1].trim())
  assert.ok(calls.length >= 6, `调用点少于 6 处说明有档没测,现读 ${calls.length}`)
  for (const c of calls) assert.match(c, /^(h|breach|ok)\.opts$/, `必须经 harness 造 opts,实得:${c}`)
  const harnessBlock = src.slice(src.indexOf('function harness('), src.indexOf('const dims') > 0 ? src.indexOf('test(') : src.indexOf('test('))
  for (const key of ['tickFile', 'lastFile']) assert.ok(new RegExp(`${key}:\\s*\`\\$\\{dir\\}/`).test(harnessBlock), `harness 缺 ${key} 的 scratch 覆写`)
  assert.ok(/now:\s*1_700_000_000_000/.test(harnessBlock), '夹具 now 必须是过去时刻(泄漏的条目才会按龄回收,不会永生)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
