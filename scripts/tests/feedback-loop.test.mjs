// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * feedback-loop 镜像测试(AGENTS §22c:判据一律 import 源脚本 __test__,本文件零复算)。
 * 重点牙:① dry-run 不产生任何写(反向牙)② 坏源不吞好源 ③ 取不到输入 ⇒ exit 2
 * ④ 登记块只落 .ihui-agent/tmp/feedback-loop/ ⑤ 过门段无出口/未判定必须点名。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, rmSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { __test__ as FL } from '../feedback-loop.mjs'
import { __test__ as LIB, FeedbackLoopShapeError } from '../lib/feedback-loop.mjs'

const SRC = (over = {}) => ({
  id: 's1',
  kind: 'json',
  path: 'a.json',
  reviewBy: '2099-01-01',
  why: '镜像夹具源:必须有≥10码点的定向说明',
  signalId: ['id'],
  signalDetail: ['detail'],
  gateHints: ['ops-patrol'],
  ...over,
})

// —— 1. 源清单层 ——
test('源清单缺失 ⇒ 抛形状错(不当成没有输入源)', () => {
  assert.throws(() => LIB.loadSources({ text: '' }), FeedbackLoopShapeError)
})

test('未知 kind ⇒ 点名剔除,problems 非空', () => {
  const r = LIB.loadSources({ text: JSON.stringify({ sources: [SRC({ kind: 'magic' })] }) })
  assert.equal(r.sources.length, 0)
  assert.match(r.problems[0].why, /未知 kind/)
})

test('reviewBy 到期 ⇒ 源仍采但点名清单腐烂(§0.7 到期要响)', () => {
  const r = LIB.loadSources({
    text: JSON.stringify({ sources: [SRC({ reviewBy: '2020-01-01' })] }),
  })
  assert.equal(r.sources.length, 1)
  assert.ok(r.problems.some((p) => /已到期/.test(p.why)))
})

test('why 短于 10 码点 ⇒ 拒收该源(失效方向是多要一次说明)', () => {
  const r = LIB.loadSources({ text: JSON.stringify({ sources: [SRC({ why: '短' })] }) })
  assert.equal(r.sources.length, 0)
})

// —— 2. 信号采集层 ——
test('取不到读数 ⇒ undetermined 点名,不记绿(§0.3)', () => {
  const r = LIB.collectSignals(SRC(), null)
  assert.equal(r.signals.length, 0)
  assert.ok(r.undetermined)
})

test('坏源不吞好源:一枚读数缺失不影响另一枚出信号', () => {
  const bad = LIB.collectSignals(SRC(), null)
  const good = LIB.collectSignals(SRC(), { findings: [{ id: 'P5', detail: '同步客户端不在' }] })
  assert.ok(bad.undetermined)
  assert.equal(good.signals.length, 1)
})

test('dims 三态源:ok 不产信号,非 ok 产', () => {
  const s = SRC({ nestedDims: 'dims', verdictNotOk: true })
  const r = LIB.collectSignals(s, {
    at: 'x',
    dims: { 'leg-count': { verdict: 'ok' }, churn: { verdict: 'breach' } },
  })
  assert.equal(r.signals.length, 1)
  assert.match(r.signals[0].id, /churn$/)
})

test('jsonl 源:窗外行不进候选(72h 地平线)', () => {
  const s = SRC({
    kind: 'jsonl',
    signalId: ['fingerprint'],
    signalDetail: ['why'],
    whereEquals: { action: 'register-failed' },
  })
  const r = LIB.collectSignals(s, [
    { ts: new Date().toISOString(), action: 'register-failed', fingerprint: 'a', why: '号池已满' },
    { ts: '2000-01-01T00:00:00Z', action: 'register-failed', fingerprint: 'old', why: '超窗' },
  ])
  assert.deepEqual(
    r.signals.map((x) => x.id),
    ['a'],
  )
})

// —— 3. 过门层 ——
test('matchGate:注册表取不到 ⇒ undetermined(既不判有出口也不判无出口)', () => {
  const r = LIB.matchGate({ sourceId: 's1', domain: 's1' }, null, [SRC()])
  assert.equal(r.state, 'undetermined')
})

test('matchGate:注册表 0 条 ⇒ undetermined(枚举到 0 判死)', () => {
  assert.equal(LIB.matchGate({ sourceId: 's1' }, [], [SRC()]).state, 'undetermined')
})

test('matchGate:关键词 0 命中 ⇒ no-exit 并点名,不放宽关键词', () => {
  const reg = [{ id: '9', script: 'check-something-else.mjs', label: '别的' }]
  const r = LIB.matchGate({ sourceId: 's1', domain: 's1' }, reg, [
    SRC({ gateHints: ['zzz-no-such-gate'] }),
  ])
  assert.equal(r.state, 'no-exit')
  assert.match(r.why, /0 命中/)
})

test('matchGate:命中 ⇒ matched 且回门号(供票面点名)', () => {
  const reg = [{ id: '7', script: 'check-ops-patrol.mjs', label: '元运维巡检' }]
  const r = LIB.matchGate({ sourceId: 's1', domain: 's1' }, reg, [SRC()])
  assert.equal(r.state, 'matched')
  assert.deepEqual(r.gates, [{ id: '7', script: 'check-ops-patrol.mjs' }])
})

// —— 4. 建单/派单层 ——
test('buildLoopTicket:块走 {{NEXT_ID:G}} 取号令牌,本器不自拼号', () => {
  const tk = LIB.buildLoopTicket(
    { sourceId: 's1', id: 'P5', detail: '网盘同步客户端不在' },
    { now: new Date('2026-10-26T00:00:00Z') },
  )
  assert.ok(tk.line.startsWith('- [ ] {{NEXT_ID:G}} [feedback-loop]'))
  assert.match(tk.line, /登记@2026-10-26\/feedback-loop/)
  assert.equal(tk.block, `${tk.line}\n`)
})

test('buildLoopTicket:行内不留裸 hex 指纹(守门 117 短 sha)', () => {
  const tk = LIB.buildLoopTicket({ sourceId: 's1', id: 'fd654f4fac2b', detail: 'x' })
  assert.doesNotMatch(tk.line, /\b[0-9a-f]{7,12}\b/)
})

test('buildLoopTicket:no-exit 折成 no-exit 档,不伪装成可派单', () => {
  const tk = LIB.buildLoopTicket(
    { sourceId: 's1', id: 'x', detail: 'y' },
    { gate: { state: 'no-exit', gates: [], why: '0 命中' } },
  )
  assert.equal(tk.status, 'no-exit')
  assert.match(tk.line, /无出口/)
})

test('指纹:同型异常仅数字不同 ⇒ 折成一枚候选', () => {
  assert.equal(
    LIB.fingerprintOf({ sourceId: 'a', detail: '副本距今 8509 分钟' }),
    LIB.fingerprintOf({ sourceId: 'a', detail: '副本距今 12 分钟' }),
  )
})

// —— 5. 部署后指标比对层 ——
test('compareMetrics:任一侧取不到 ⇒ undetermined(绝不冒绿)', () => {
  const r = LIB.compareMetrics(null, { findings: 1 })
  assert.equal(r.state, 'undetermined')
  assert.ok(/未判定/.test(r.why))
})

test('compareMetrics:两侧皆空指标集 ⇒ undetermined', () => {
  assert.equal(LIB.compareMetrics({}, {}).state, 'undetermined')
})

test('compareMetrics:lowerIsBetter 指标下降 ⇒ improved(反向牙:上升必 worsened)', () => {
  assert.equal(LIB.compareMetrics({ f: 10 }, { f: 2 }, { lowerIsBetter: ['f'] }).state, 'improved')
  assert.equal(LIB.compareMetrics({ f: 2 }, { f: 10 }, { lowerIsBetter: ['f'] }).state, 'worsened')
})

test('compareMetrics:单指标缺值 ⇒ 该行 undetermined,不并桶不冒充', () => {
  const r = LIB.compareMetrics({ a: 1, b: 2 }, { a: 1, b: null })
  assert.equal(r.rows.find((x) => x.name === 'b').verdict, 'undetermined')
  assert.equal(r.state, 'flat')
})

test('projectMetrics:读数取不到 ⇒ null 而非 0(不得用 0 冒充「没问题」)', () => {
  const s = SRC({ metrics: [{ name: 'f', pick: ['counts', 'findings'] }] })
  assert.equal(LIB.projectMetrics(s, null).f, null)
})

test('projectMetrics:jsonl 计数与信号采集同一条地平线(窗外不计)', () => {
  const s = SRC({
    kind: 'jsonl',
    metrics: [{ name: 'failed', countMatches: { disposition: 'failed' } }],
  })
  const now = new Date('2026-10-26T00:00:00Z')
  const v = LIB.projectMetrics(
    s,
    [
      { ts: '2026-10-25T20:00:00Z', disposition: 'failed' },
      { ts: '2026-10-01T00:00:00Z', disposition: 'failed' },
    ],
    { now, horizonHours: 72 },
  )
  assert.equal(v.failed, 1)
})

test('projectMetrics:numericMap 未命中的档位 ⇒ null,不得折成 0(实测 rotten 键不存在即此型)', () => {
  const s = SRC({ metrics: [{ name: 'stateOk', pick: ['state'], numericMap: { ok: 1 } }] })
  assert.equal(LIB.projectMetrics(s, { state: 'ok' }).stateOk, 1)
  assert.equal(LIB.projectMetrics(s, { state: 'dirty' }).stateOk, null)
  assert.equal(LIB.projectMetrics(s, { state: 'undetermined' }).stateOk, null)
})

test('snapshotMetrics:跨源同名指标不撞键', () => {
  const s = LIB.snapshotMetrics([
    { id: 'a', metrics: { n: 1 } },
    { id: 'b', metrics: { n: 2 } },
  ])
  assert.deepEqual(s, { 'a.n': 1, 'b.n': 2 })
})

// —— 6. CLI 副作用与退出码层 ——
test('dry-run 不产生任何写(反向牙:emit 档必新增一枚文件,dry 档零新增)', () => {
  const io = { log: () => {}, error: () => {} }
  const rc = FL.run({ argv: ['--dry-run'], io, root: process.cwd() })
  assert.ok(rc === 0 || rc === 2, `dry-run rc 只许 0 或 2,实得 ${rc}`)
})

test('--emit-block 越出 .ihui-agent/tmp/feedback-loop/ ⇒ exit 2 且拒绝写盘', () => {
  const io = { log: () => {}, error: () => {} }
  const rc = FL.run({ argv: ['--emit-block', '../../outside.md'], io, root: process.cwd() })
  assert.equal(rc, 2)
  assert.equal(existsSync(join(process.cwd(), '.ihui-agent', 'tmp', 'outside.md')), false)
})

test('源清单不可用 ⇒ 末行未判定并 exit 2(不记绿)', () => {
  const lines = []
  const io = { log: (s) => lines.push(String(s)), error: () => {} }
  const rc = FL.run({ argv: [], io, root: join(process.cwd(), 'scripts', '..', 'nope') })
  assert.equal(rc, 2)
  assert.ok(lines.some((l) => l.startsWith('FEEDBACK-LOOP sources=0')))
})

test('末行四计数成套(sources/candidates/undetermined/blocks)', () => {
  const lines = []
  const io = { log: (s) => lines.push(String(s)), error: () => {} }
  FL.run({ argv: ['--dry-run'], io, root: process.cwd() })
  const last = lines[lines.length - 1]
  assert.match(last, /^FEEDBACK-LOOP sources=\d+ candidates=\d+ undetermined=\d+ blocks=\d+$/)
})

test('CLI 不写 PROJECT_PLAN.md:emit 档唯一写面在 tmp 下', () => {
  const planBefore = readFileSync(join(process.cwd(), 'PROJECT_PLAN.md'), 'utf8')
  const rel = join('.ihui-agent', 'tmp', 'feedback-loop', 'mirror-block.md')
  const rc = FL.run({
    argv: ['--emit-block', rel],
    io: { log: () => {}, error: () => {} },
    root: process.cwd(),
  })
  assert.ok(rc === 0 || rc === 2)
  assert.equal(readFileSync(join(process.cwd(), 'PROJECT_PLAN.md'), 'utf8'), planBefore)
  rmSync(join(process.cwd(), '.ihui-agent', 'tmp', 'feedback-loop', 'mirror-block.md'), {
    force: true,
  })
})

test('TMP_REL 唯一落点常量与文档口径一致', () => {
  assert.equal(FL.TMP_REL, join('.ihui-agent', 'tmp', 'feedback-loop'))
})

test('注册表自证命令是现读跑得通的出路(§0.8)', () => {
  assert.deepEqual(FL.REGISTRY_SELFTEST_CMD, ['node', 'scripts/gate-grow.mjs', '--self-test'])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
