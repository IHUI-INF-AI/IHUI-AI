// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// L28812 端到端联合测试:部署决策 → deploy-outcome-intake 信号 → deploy-feedback 登记候选
// → feedback-loop-status 阶段审计。三器各自已有镜像测试,本文件只钉「它们串起来还走得通」,
// 判据一律 import 源脚本(`__test__` / 导出函数),不复制实现(§22c)。
//
// 三条链:
//  ① 失败链:rollback + canary-rollback ⇒ 2 条 deploy_outcome 信号(exit 0 / 末行 / JSON 形状)
//     ⇒ feedback 吃同一文件(只读 --status 真进程 + 注入 scratch 台账的 dry-run 预览行)
//     ⇒ 阶段审计 perceived=yes / ticketed=yes,summary 配平。
//  ② 成功链:pass 不产信号、pass-unproven 只落 warn 档。
//  ③ 去重链:同一 decisions 连跑两次 ⇒ 第二次 signals=0 且信号文件行数不变。
//
// 零写入:三器默认落点(deploy-decisions / incident-signals / deploy-feedback-ledger)
// 跑前跑后快照逐字相等。deploy-feedback 无台账重定向参数,且其 dry-run 会向真实台账
// 追加 result=dry-run 行(源码 runRound 的 record('dry-run')),故本链路对真进程只取
// 文档声明的只读 --status;预览行用注入 scratch ledgerPath 的同一 runRound 覆盖。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { identityOf } from '../lib/incident-cluster.mjs'
import { PLAN_PATH, runRound as feedbackRound } from '../deploy-feedback.mjs'
import { SOURCE_FILES, signalIdentityOf } from '../feedback-loop-status.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const INTAKE = join(ROOT, 'scripts', 'deploy-outcome-intake.mjs')
const FEEDBACK = join(ROOT, 'scripts', 'deploy-feedback.mjs')
const LOOP_STATUS = join(ROOT, 'scripts', 'feedback-loop-status.mjs')

const LOOP_LINE = /^LOOP-STATUS incidents=\d+ closed=\d+ open=\d+ undetermined=\d+$/
const FULL_SHA = '0123456789abcdef0123456789abcdef01234567'

const BOXES = [mkScratch('feedback-loop-e2e-')]
const BOX = BOXES[0]
const T0 = Date.now()
const iso = (minAgo) => new Date(T0 - minAgo * 60_000).toISOString()

/** 真实默认落点(三器唯一可能不显式重定向的写/读面)。 */
const REAL_TARGETS = {
  decisions: join(ROOT, '.ihui-agent', 'deploy-decisions.jsonl'),
  signals: join(ROOT, '.ihui-agent', 'state', 'incident-signals.jsonl'),
  feedback: join(ROOT, '.ihui-agent', 'state', 'deploy-feedback-ledger.jsonl'),
}

function stamp(path) {
  try {
    const st = statSync(path)
    return { exists: true, size: st.size, mtimeMs: st.mtimeMs }
  } catch {
    return { exists: false, size: -1, mtimeMs: -1 }
  }
}

/** 只钉三器默认落点:真实 .ihui-agent/state 里其余文件由并发守门进程轮写,整目录快照会恒红。 */
function snapshotRealTargets() {
  return {
    decisions: stamp(REAL_TARGETS.decisions),
    signals: stamp(REAL_TARGETS.signals),
    feedback: stamp(REAL_TARGETS.feedback),
  }
}

const REAL_BEFORE = snapshotRealTargets()

function writeLines(path, rows) {
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
}

function readRows(path) {
  return String(readFileSync(path, 'utf8'))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => JSON.parse(l))
}

function spawnCli(script, args) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { error: r.error, status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

function lastLine(text) {
  return (
    String(text ?? '')
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .pop() ?? ''
  )
}

function decision(over = {}) {
  return {
    v: 1,
    ts: iso(60),
    action: 'rollback',
    sha: FULL_SHA,
    prevSha: '',
    gateVerdict: 'fail',
    failDims: ['web', 'llm'],
    shadowRc: 0,
    reason: '健康门禁未过',
    host: 'e2e',
    pid: 1,
    ...over,
  }
}

after(() => {
  for (const dir of BOXES) {
    try {
      rmScratch(dir)
    } catch {
      /* 夹具清理失败不影响判据 */
    }
  }
})

test('① 失败链:部署决策 ⇒ intake 两条 deploy_outcome 信号(exit 0 / 末行 / JSON 形状)', () => {
  const decisions = join(BOX, 'deploy-decisions-fail.jsonl')
  const signals = join(BOX, 'incident-signals-fail.jsonl')
  writeLines(decisions, [
    decision({ action: 'rollback', ts: iso(60), route: '/deploy/rollback' }),
    decision({ action: 'canary-rollback', ts: iso(30), route: '/deploy/canary-rollback' }),
  ])

  const r = spawnCli(INTAKE, ['--in', decisions, '--out', signals, '--json'])
  assert.equal(r.error, undefined)
  assert.equal(r.status, 0, r.stderr)
  assert.equal(lastLine(r.stdout), 'DEPLOY-INTAKE signals=2 skipped=0 undetermined=0')

  const json = JSON.parse(r.stdout.trim().split(/\r?\n/)[0])
  assert.equal(json.judged, true)
  assert.equal(json.contract.version, 2)
  assert.equal(resolve(json.params.input), resolve(decisions))
  assert.equal(resolve(json.params.out), resolve(signals))
  assert.equal(json.signals, 2)
  assert.equal(json.skipped, 0)
  assert.equal(json.undetermined, 0)
  assert.equal(json.rows.length, 2)
  assert.deepEqual(json.rows.map((x) => x.source), ['deploy_outcome', 'deploy_outcome'])
  assert.deepEqual(json.rows.map((x) => x.route), ['deploy/rollback', 'deploy/canary-rollback'])
  assert.deepEqual(json.rows.map((x) => x.kind), ['alert_firing', 'perf_degradation'])
  assert.deepEqual(json.rows.map((x) => x.severity), ['error', 'error'])
  assert.ok(json.rows[0].message.includes(`sha=${FULL_SHA}`), '完整 40 位 sha 应落进 message')

  const rows = readRows(signals)
  assert.equal(rows.length, 2)
  assert.deepEqual(
    rows.map((x) => x.source),
    ['deploy_outcome', 'deploy_outcome'],
  )
})

test('② 失败链:feedback 吃同一信号文件(只读 --status 真进程 + dry-run 预览行)', () => {
  const signals = join(BOX, 'incident-signals-fail.jsonl')
  assert.ok(existsSync(signals), '前置失败链信号文件缺失')

  const st = spawnCli(FEEDBACK, ['--status', '--in', signals, '--json'])
  assert.equal(st.error, undefined)
  assert.equal(st.status, 0, st.stderr)
  const stJson = JSON.parse(st.stdout.trim().split(/\r?\n/)[0])
  assert.equal(stJson.code, 0, stJson.why ?? '')
  assert.equal(stJson.status, 'judged')
  assert.equal(resolve(stJson.input.path), resolve(signals))
  assert.equal(stJson.input.deployRows, 2)
  assert.equal(stJson.input.badRows, 0)
  assert.match(stJson.family.token, /^\{\{NEXT_ID:[A-Za-z]+\}\}$/)

  // dry-run:同一 runRound,但台账与临时块都注入 scratch(真台账零写入)。
  const logs = []
  const ledger = join(BOX, 'dry-feedback-ledger.jsonl')
  let spawned = 0
  const dry = feedbackRound({
    inputPath: signals,
    ledgerPath: ledger,
    planContent: readFileSync(PLAN_PATH, 'utf8'),
    tmpDir: join(BOX, 'tmp-dry'),
    now: new Date(),
    log: (l) => logs.push(String(l)),
    warn: (l) => logs.push(String(l)),
    spawn: () => {
      spawned += 1
      return { status: 0, stdout: '', stderr: '' }
    },
  })
  assert.equal(dry.code, 0, dry.why ?? '')
  assert.equal(spawned, 0, 'dry-run 不得 spawn live-doc-edit')
  assert.equal(dry.results.length, 2)
  assert.ok(dry.results.every((x) => x.result === 'dry-run'))
  assert.equal(dry.candidates.length, 2)
  assert.ok(dry.candidates.every((c) => c.line.length <= 400 && c.line.includes('[deploy-feedback]')))
  const preview = logs.join('\n')
  assert.ok(preview.includes('[deploy-feedback]'), '预览行缺 [deploy-feedback]')
  assert.ok(preview.includes('deploy_outcome'), '预览行缺 deploy_outcome')
  const ledgerRows = readRows(ledger)
  assert.equal(ledgerRows.length, 2)
  assert.ok(ledgerRows.every((e) => e.result === 'dry-run'))
})

test('③ 失败链:feedback-loop-status 阶段审计(perceived/ticketed=yes,summary 配平)', () => {
  const signals = join(BOX, 'incident-signals-fail.jsonl')
  const decisions = join(BOX, 'deploy-decisions-fail.jsonl')
  const stateDir = join(BOX, 'state')
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(join(stateDir, SOURCE_FILES.signals), readFileSync(signals))
  writeFileSync(join(stateDir, SOURCE_FILES.decisions), readFileSync(decisions))
  writeFileSync(join(stateDir, SOURCE_FILES.dispatch), '', 'utf8')

  const rows = readRows(signals)
  // 前置夹具只认生产端口径:intake 落盘的每一行都走它用的同一个 identityOf。
  const identities = rows.map((row) => identityOf(row))
  assert.ok(identities.every(Boolean), '信号身份不得未判定')
  assert.equal(new Set(identities).size, 2, '两条失败信号身份应互异')
  // 跨器一致性回归钉子:intake 侧身份必须与阶段审计器自算出的身份逐字相等。
  for (const row of rows) {
    assert.equal(
      signalIdentityOf(row).identity,
      identityOf(row),
      `status 与 intake 身份分家:${signalIdentityOf(row).identity} ≠ ${identityOf(row)}`,
    )
  }

  writeLines(
    join(stateDir, SOURCE_FILES.feedback),
    identities.map((identity, i) => ({ ts: iso(i + 5), identity, action: 'rollback', result: 'registered' })),
  )

  const r = spawnCli(LOOP_STATUS, ['--state-dir', stateDir, '--json'])
  assert.equal(r.error, undefined)
  assert.equal(r.status, 0, r.stderr)
  assert.match(lastLine(r.stdout), LOOP_LINE)
  assert.equal(lastLine(r.stdout), 'LOOP-STATUS incidents=2 closed=0 open=0 undetermined=2')

  const report = JSON.parse(r.stdout.trim().split(/\r?\n/)[0])
  for (const src of report.sources) {
    assert.ok(
      resolve(src.path).startsWith(resolve(stateDir)),
      `源 ${src.id} 未落 --state-dir:${src.path}`,
    )
  }
  const sum = report.summary
  assert.equal(sum.incidents, 2)
  assert.equal(sum.incidents, sum.closed + sum.open + sum.undetermined)
  assert.equal(sum.balanced, true)

  for (const identity of identities) {
    const incident = report.incidents.find((x) => x.identity === identity)
    assert.ok(incident, `未生成事故 ${identity}`)
    assert.equal(incident.stages.perceived, 'yes')
    assert.equal(incident.stages.ticketed, 'yes')
    // 源码口径:登记行无票键/票号 ⇒ dispatched undetermined 并显式点名断点;
    // 未请求 git ⇒ fixed=not-requested;上游未到 ⇒ deployed=not-reached。
    assert.equal(incident.stages.dispatched, 'undetermined')
    assert.match(incident.why, /断在 dispatched/)
    assert.equal(incident.stages.fixed, 'not-requested')
    assert.equal(incident.stages.deployed, 'not-reached')
    assert.equal(incident.status, 'undetermined')
  }
})

test('④ 成功链:pass 不产信号,pass-unproven 只落 warn 档', () => {
  const decisions = join(BOX, 'deploy-decisions-pass.jsonl')
  const signals = join(BOX, 'incident-signals-pass.jsonl')
  writeLines(decisions, [
    decision({ action: 'pass', ts: iso(50), gateVerdict: 'pass', failDims: [], reason: '门禁全绿' }),
    decision({ action: 'pass-unproven', ts: iso(40), gateVerdict: 'partial', failDims: ['entry'], reason: '放行但未三项全绿' }),
  ])

  const r = spawnCli(INTAKE, ['--in', decisions, '--out', signals, '--json'])
  assert.equal(r.error, undefined)
  assert.equal(r.status, 0, r.stderr)
  assert.equal(lastLine(r.stdout), 'DEPLOY-INTAKE signals=1 skipped=1 undetermined=0')
  const json = JSON.parse(r.stdout.trim().split(/\r?\n/)[0])
  assert.equal(json.judged, true)
  assert.equal(json.signals, 1)
  assert.equal(json.skipped, 1)
  assert.equal(json.undetermined, 0)

  const rows = readRows(signals)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].route, 'deploy/pass-unproven')
  assert.equal(rows[0].kind, 'alert_firing')
  assert.equal(rows[0].severity, 'warn')
  assert.ok(!rows.some((x) => x.route === 'deploy/pass'), 'pass 不得产信号')
  assert.ok(!rows.some((x) => /action=pass(?=\s|$)/.test(x.message)), 'pass 不得作为独立 action 混进 message')
})

test('⑤ 去重链:同一 decisions 连跑两次 ⇒ 第二次 signals=0 且行数不变', () => {
  const decisions = join(BOX, 'deploy-decisions-dedupe.jsonl')
  const signals = join(BOX, 'incident-signals-dedupe.jsonl')
  writeLines(decisions, [decision({ action: 'rollback', ts: iso(10) })])

  const first = spawnCli(INTAKE, ['--in', decisions, '--out', signals])
  assert.equal(first.error, undefined)
  assert.equal(first.status, 0, first.stderr)
  assert.equal(lastLine(first.stdout), 'DEPLOY-INTAKE signals=1 skipped=0 undetermined=0')
  const rowsAfterFirst = readRows(signals)
  assert.equal(rowsAfterFirst.length, 1)

  const second = spawnCli(INTAKE, ['--in', decisions, '--out', signals])
  assert.equal(second.error, undefined)
  assert.equal(second.status, 0, second.stderr)
  assert.equal(lastLine(second.stdout), 'DEPLOY-INTAKE signals=0 skipped=1 undetermined=0')
  assert.equal(readRows(signals).length, rowsAfterFirst.length, '追加幂等:信号文件行数不得增长')
})

test('⑥ 真实状态目录零写入:三器默认落点前后快照逐字相等', () => {
  assert.deepEqual(snapshotRealTargets(), REAL_BEFORE)
  for (const [name, path] of Object.entries(REAL_TARGETS)) {
    assert.equal(existsSync(path), REAL_BEFORE[name].exists, `真实默认落点存在性变了:${path}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
