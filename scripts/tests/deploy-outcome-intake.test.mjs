// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// deploy-outcome-intake 镜像测试(§22c:判据 import 源脚本 `__test__`,本文件零复制实现)。
//
// 票面 L28812 第一切片:部署失败/回滚 → incident signal。钉七格:
//  ① 九种 action 映射全覆盖(产出/不产出、kind、severity、route);
//  ② 短 sha 拒绝(7~39 hex 折占位)、完整 40 位 sha 保留;
//  ③ 同身份 24h 窗口去重、超窗再产;
//  ④ 追加幂等(第二次跑 0 新行);
//  ⑤ 输入缺失 exit 2 且末行点名「未判定」;
//  ⑥ 契约新增 deploy_outcome 后既有校验器仍可校验;
//  ⑦ 0 信号仍 exit 0 并打印机器行。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { loadContract, validateSignal } from '../lib/incident-cluster.mjs'

const SRC = resolve(fileURLToPath(import.meta.url), '../../deploy-outcome-intake.mjs')
const { __test__ } = await import(pathToFileURL(SRC).href)
const { decisionToSignal, planIntake, DEFAULT_MINUTES, RESULT_PREFIX } = __test__

const FULL_SHA = '0123456789abcdef0123456789abcdef01234567'

function decision(over = {}) {
  return {
    v: 1,
    ts: '2026-10-26T10:00:00.000Z',
    action: 'rollback',
    sha: FULL_SHA,
    prevSha: '',
    rollbackBuildId: '',
    gateVerdict: 'fail',
    failDims: ['web', 'llm'],
    shadowRc: 0,
    reason: '健康门禁未过',
    host: 'testhost',
    pid: 1,
    ...over,
  }
}

function runCli(args) {
  const r = spawnSync(process.execPath, [SRC, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

const lastLine = (s) =>
  String(s ?? '')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .pop() ?? ''

test('① 九种 action 映射全覆盖(不产出的三种也不冒充失败)', () => {
  const contract = loadContract()
  const expected = {
    pass: null,
    'canary-pass': null,
    'canary-unproven': null,
    'pass-unproven': { kind: 'alert_firing', severity: 'warn' },
    'pass-entry-broken': { kind: 'alert_firing', severity: 'warn' },
    rollback: { kind: 'alert_firing', severity: 'error' },
    'manual-rollback': { kind: 'alert_firing', severity: 'warn' },
    'build-fail': { kind: 'alert_firing', severity: 'error' },
    'canary-rollback': { kind: 'perf_degradation', severity: 'error' },
  }
  for (const [action, exp] of Object.entries(expected)) {
    const r = decisionToSignal(decision({ action }), contract)
    if (!exp) {
      assert.equal(r.produce, false, `${action} 不应产出信号`)
      continue
    }
    assert.equal(r.produce, true, `${action} 必须产出信号`)
    assert.equal(r.signal.source, 'deploy_outcome')
    assert.equal(r.signal.kind, exp.kind, `${action} kind 错`)
    assert.equal(r.signal.severity, exp.severity, `${action} severity 错`)
    assert.equal(r.signal.route, `deploy/${action}`)
    assert.match(r.signal.message, new RegExp(`action=${action}`))
    assert.equal(validateSignal(r.signal, contract).ok, true, `${action} 信号不过契约`)
  }
})

test('② 短 sha 拒绝(折占位)、完整 40 位 sha 保留、密钥不落 message', () => {
  const contract = loadContract()
  const full = decisionToSignal(decision({}), contract).signal
  assert.ok(full.message.includes(FULL_SHA), `完整 sha 丢了:${full.message}`)
  assert.ok(!full.message.includes('[sha-redacted'), '完整 sha 不得被折占位')

  const short = decisionToSignal(decision({ sha: '8486d01d', reason: '回滚到 8486d01d' }), contract).signal
  assert.ok(!short.message.includes('8486d01d'), `短 sha 混进 message:${short.message}`)
  assert.ok(short.message.includes('[sha-redacted:8]'), `短 sha 应折占位:${short.message}`)
  // 12 位短 sha(守门 117 的典型误伤长度)同样拒绝
  const twelve = decisionToSignal(decision({ sha: 'c05ca0d5beef' }), contract).signal
  assert.ok(!twelve.message.includes('c05ca0d5beef'), `12 位短 sha 混进 message:${twelve.message}`)

  const secret = decisionToSignal(decision({ reason: 'api_key=sk-live-123456 与 token=abc' }), contract).signal
  assert.ok(!/sk-live-123456/.test(secret.message), `密钥值落进 message:${secret.message}`)
  assert.ok(!/token=abc/.test(secret.message), `token 值落进 message:${secret.message}`)
})

test('③ 同身份按 identityOf 去重:24h 内只产一次,超窗再产,跨 action 不混', () => {
  const contract = loadContract()
  const rows = [
    { line: 1, object: decision({ ts: '2026-10-26T10:00:00.000Z' }) },
    { line: 2, object: decision({ ts: '2026-10-26T11:00:00.000Z' }) },
  ]
  const same = planIntake({ decisions: rows, contract, minutes: DEFAULT_MINUTES, existing: [] })
  assert.equal(same.signals.length, 1, '同身份 24h 内应只产一条')
  assert.equal(same.skipped, 1)
  assert.equal(same.undetermined, 0)

  const far = [
    { line: 1, object: decision({ ts: '2026-10-26T10:00:00.000Z' }) },
    { line: 2, object: decision({ ts: '2026-10-27T12:00:00.000Z' }) },
  ]
  assert.equal(planIntake({ decisions: far, contract, minutes: DEFAULT_MINUTES, existing: [] }).signals.length, 2, '超过 24h 应再产')

  const cross = [
    { line: 1, object: decision({ action: 'rollback', ts: '2026-10-26T10:00:00.000Z' }) },
    { line: 2, object: decision({ action: 'build-fail', ts: '2026-10-26T10:30:00.000Z' }) },
  ]
  assert.equal(planIntake({ decisions: cross, contract, minutes: DEFAULT_MINUTES, existing: [] }).signals.length, 2, '不同 action 是不同身份')
})

test('④ 追加幂等:同一份输入跑两次,第二次 0 新行且 --out 只有 1 行', () => {
  const dir = mkScratch('deploy-intake-idem-')
  try {
    const input = join(dir, 'deploy-decisions.jsonl')
    const out = join(dir, 'state', 'incident-signals.jsonl')
    writeFileSync(input, `${JSON.stringify(decision())}\n`, 'utf8')

    const first = runCli(['--in', input, '--out', out])
    assert.equal(first.status, 0, first.stderr)
    assert.equal(lastLine(first.stdout), `${RESULT_PREFIX} signals=1 skipped=0 undetermined=0`)

    const second = runCli(['--in', input, '--out', out])
    assert.equal(second.status, 0, second.stderr)
    assert.equal(lastLine(second.stdout), `${RESULT_PREFIX} signals=0 skipped=1 undetermined=0`)

    const lines = readFileSync(out, 'utf8').trim().split(/\r?\n/)
    assert.equal(lines.length, 1, `幂等失败,台账被重复追加:${lines.length} 行`)
    const parsed = JSON.parse(lines[0])
    assert.equal(parsed.source, 'deploy_outcome')
    assert.equal(parsed.route, 'deploy/rollback')
  } finally {
    rmScratch(dir)
  }
})

test('⑤ 输入缺失 ⇒ exit 2,末行点名「未判定」,不写 --out', () => {
  const dir = mkScratch('deploy-intake-missing-')
  try {
    const out = join(dir, 'state', 'incident-signals.jsonl')
    const r = runCli(['--in', join(dir, 'nope.jsonl'), '--out', out])
    assert.equal(r.status, 2)
    assert.match(lastLine(r.stderr), /未判定/)
    assert.match(lastLine(r.stderr), /读不到/)
    assert.equal(existsSync(out), false, '未判定档不得写盘')
  } finally {
    rmScratch(dir)
  }
})

test('⑥ 契约新增 deploy_outcome:版本升级、枚举可校验、owners 已登记', () => {
  const contract = loadContract()
  assert.ok(contract.version >= 2, `契约 version 未升级:${contract.version}`)
  assert.ok(contract.fields.source.enum.includes('deploy_outcome'), 'source 枚举缺 deploy_outcome')
  assert.equal(typeof contract.owners.deploy_outcome, 'string')
  assert.notEqual(contract.owners.deploy_outcome, '')
  const signal = decisionToSignal(decision({ action: 'canary-rollback' }), contract).signal
  const checked = validateSignal(signal, contract)
  assert.equal(checked.ok, true, checked.ok ? '' : checked.error)
  assert.equal(checked.signal.kind, 'perf_degradation')
})

test('⑦ 0 信号(只有 pass)仍 exit 0 并打印机器行', () => {
  const dir = mkScratch('deploy-intake-zero-')
  try {
    const input = join(dir, 'deploy-decisions.jsonl')
    const out = join(dir, 'state', 'incident-signals.jsonl')
    writeFileSync(input, `${JSON.stringify(decision({ action: 'pass' }))}\n`, 'utf8')
    const r = runCli(['--in', input, '--out', out])
    assert.equal(r.status, 0, r.stderr)
    assert.equal(lastLine(r.stdout), `${RESULT_PREFIX} signals=0 skipped=1 undetermined=0`)
    assert.equal(existsSync(out), false, '0 信号不应落空文件')
  } finally {
    rmScratch(dir)
  }
})
