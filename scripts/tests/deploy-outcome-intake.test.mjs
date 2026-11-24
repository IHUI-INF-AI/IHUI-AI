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
//  ⑦ 0 信号仍 exit 0 并打印机器行;
//  ⑧ 演练绝缘(B69):synthetic/旧 reason 前缀不产告警,同形真实回滚仍产 error,计数分离;
//  ⑨ build-fail 跨 retry 换 TS 码 ⇒ 同 route 只产 1 条信号(B87/B88/B91),旧行仍能去重。
//  ⑩ 十种 action(2026-11-04 补 swap-fail)由单一真源派生,PS1 发射面 ⊆ 闭集。
//  ⑪ 单行坏不拖垮整趟 + 并发撕裂行剔除:CLI 级反向锁(旧实现会整趟零产出)。
//  ⑫ 跨桶链式决策连跑三轮不重复写盘(2026-11-04 实测:滑窗去重 + 同批替换每轮追加 2 条)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { loadContract, identityOf, validateSignal } from '../lib/incident-cluster.mjs'

const SRC = resolve(fileURLToPath(import.meta.url), '../../deploy-outcome-intake.mjs')
const { __test__ } = await import(pathToFileURL(SRC).href)
const { decisionToSignal, planIntake, DEFAULT_MINUTES, RESULT_PREFIX, isSyntheticDecision, LEGACY_DRILL_REASON_PREFIX } = __test__

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

test('① 十种 action 映射全覆盖(含 2026-11-04 补回的 swap-fail;不产出的三种也不冒充失败)', () => {
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
    'swap-fail': { kind: 'alert_firing', severity: 'error' },
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
    assert.equal(lastLine(first.stdout), `${RESULT_PREFIX} signals=1 skipped=0 synthetic=0 badRows=0 torn=0 undetermined=0`)

    const second = runCli(['--in', input, '--out', out])
    assert.equal(second.status, 0, second.stderr)
    assert.equal(lastLine(second.stdout), `${RESULT_PREFIX} signals=0 skipped=1 synthetic=0 badRows=0 torn=0 undetermined=0`)

    const lines = readFileSync(out, 'utf8').trim().split(/\r?\n/)
    assert.equal(lines.length, 1, `幂等失败,台账被重复追加:${lines.length} 行`)
    const parsed = JSON.parse(lines[0])
    assert.equal(parsed.source, 'deploy_outcome')
    assert.equal(parsed.route, 'deploy/rollback')
  } finally {
    rmScratch(dir)
  }
})

test('⑫ 跨桶链式决策连跑三轮不重复写盘(滑窗去重 + 同批替换的回归锁)', () => {
  const dir = mkScratch('deploy-intake-chain-')
  try {
    const input = join(dir, 'deploy-decisions.jsonl')
    const out = join(dir, 'state', 'incident-signals.jsonl')
    // 相邻间隔 <24h、首尾跨度 >24h:旧滑窗会把整串压成 1 条(at 落串尾),
    // 下一轮串首重新漏出 ⇒ 又产出同一条并再次写盘,每轮重复追加。
    const chainTs = [
      '2026-10-26T10:00:00.000Z',
      '2026-10-27T08:00:00.000Z',
      '2026-10-27T22:00:00.000Z',
      '2026-10-28T18:00:00.000Z',
    ]
    writeFileSync(input, `${chainTs.map((ts) => JSON.stringify(decision({ action: 'build-fail', ts }))).join('\n')}\n`, 'utf8')

    const first = runCli(['--in', input, '--out', out])
    assert.equal(first.status, 0, first.stderr)
    const linesAfterFirst = readFileSync(out, 'utf8').trim().split(/\r?\n/).length
    assert.equal(linesAfterFirst, 3, `固定桶应按 3 个 UTC 天桶产 3 条,实得 ${linesAfterFirst}`)

    for (let round = 2; round <= 3; round += 1) {
      const r = runCli(['--in', input, '--out', out])
      assert.equal(r.status, 0, r.stderr)
      assert.equal(
        lastLine(r.stdout),
        `${RESULT_PREFIX} signals=0 skipped=4 synthetic=0 badRows=0 torn=0 undetermined=0`,
        `第 ${round} 轮不得再产出信号(旧实现会重复追加)`,
      )
      assert.equal(
        readFileSync(out, 'utf8').trim().split(/\r?\n/).length,
        linesAfterFirst,
        `第 ${round} 轮重复写盘 ⇒ 派发戳每 20min 一刷就会灌水信号账`,
      )
    }
  } finally {
    rmScratch(dir)
  }
})

test('⑫b 反向锁:同一夹具喂修复前的滑窗判据必然重复产出(证明 ⑫ 不是恒真锁)', () => {
  const contract = loadContract()
  const W = DEFAULT_MINUTES * 60_000
  // 刻意复刻 2026-11-04 之前的错误实现:滑窗判重 + 同批替换 + seen.find 改锚点。
  // 只作反向锁用,绝不进生产判据;删掉它就等于把 ⑫ 降级成一条恒真断言。
  const legacy = (rows, existing) => {
    const seen = existing.map((e) => ({ identity: identityOf(e), atMs: Date.parse(e.at) }))
    const pending = new Map()
    const signals = []
    for (const row of rows) {
      const s = decisionToSignal(row.object, contract).signal
      const t = Date.parse(s.at)
      const key = identityOf(s)
      if (seen.some((x) => x.identity === key && Math.abs(t - x.atMs) <= W)) {
        const at = pending.get(key)
        if (at !== undefined && t > Date.parse(signals[at].at)) {
          signals[at] = s
          const hit = seen.find((x) => x.identity === key)
          if (hit) hit.atMs = t
        }
        continue
      }
      seen.push({ identity: key, atMs: t })
      pending.set(key, signals.length)
      signals.push(s)
    }
    return signals
  }
  const chainTs = [
    '2026-10-26T10:00:00.000Z',
    '2026-10-27T08:00:00.000Z',
    '2026-10-27T22:00:00.000Z',
    '2026-10-28T18:00:00.000Z',
  ]
  const rows = chainTs.map((ts, i) => ({ line: i + 1, object: decision({ action: 'build-fail', ts }) }))
  const legacyFirst = legacy(rows, [])
  const legacySecond = legacy(rows, legacyFirst)
  assert.equal(legacyFirst.length, 1, '夹具自检:旧滑窗把整串压成 1 条(at 落串尾)')
  assert.ok(legacySecond.length > 0, '反向锁失效:旧判据第二轮没重复产出 ⇒ ⑫ 可能是恒真锁')
  assert.equal(legacySecond[0].at, legacyFirst[0].at, '旧判据第二轮产出的是逐字重复行')
  const fixedFirst = planIntake({ decisions: rows, contract, minutes: DEFAULT_MINUTES, existing: [] })
  const fixedSecond = planIntake({ decisions: rows, contract, minutes: DEFAULT_MINUTES, existing: fixedFirst.signals })
  assert.equal(fixedSecond.signals.length, 0, '新固定桶判据在同一夹具下第二轮必须 0 新行')
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
    assert.equal(lastLine(r.stdout), `${RESULT_PREFIX} signals=0 skipped=1 synthetic=0 badRows=0 torn=0 undetermined=0`)
    assert.equal(existsSync(out), false, '0 信号不应落空文件')
  } finally {
    rmScratch(dir)
  }
})

// B87/B88/B91 同题三登记:同一 /deploy/build-fail 因每轮重试的末次报错换 TS 号
// (无码 → TS2339 → TS2554)被旧身份拆成 3 条信号,再各登记一张票。
// 新口径:deploy_outcome 身份按 route(闭集 action)定,TS 号不进身份 ⇒ 3 条决策只产 1 条信号,
// 两条 skipped=2;具体编号留给 cluster.codes 作证据(deploy-feedback 侧钉)。
test('⑨ build-fail 跨 retry 换 TS 码 ⇒ 同 route 只产 1 条信号,旧行仍能去重', () => {
  const contract = loadContract()
  const fullReason = (code) =>
    `构建失败,未切流,保持当前在线版本:next build 连续 1 次失败,保持当前在线版本(末次报错: ./apps/web/src/app/page.tsx:12:34 - error ${code}: Property 'x' does not exist on type 'Y')`
  const rows = [
    {
      line: 1,
      object: decision({
        action: 'build-fail',
        ts: '2026-10-29T07:32:13.093Z',
        failDims: [],
        reason: '构建失败,未切流,保持当前在线版本:next build 连续 1 次失败,保持当前在线版本(末轮报错行不可读,exit=1)',
      }),
    },
    { line: 2, object: decision({ action: 'build-fail', ts: '2026-10-29T07:58:38.989Z', failDims: ['web'], reason: fullReason('TS2339') }) },
    { line: 3, object: decision({ action: 'build-fail', ts: '2026-10-29T08:29:24.187Z', failDims: ['web'], reason: fullReason('TS2554') }) },
  ]
  const r = planIntake({ decisions: rows, contract, minutes: DEFAULT_MINUTES, existing: [] })
  assert.equal(r.signals.length, 1, '同一 route 的三轮构建失败只能产 1 条信号')
  assert.equal(r.skipped, 2)
  assert.equal(r.undetermined, 0)
  assert.equal(r.signals[0].route, 'deploy/build-fail')
  // 保留同批最晚一轮(08:29 / TS2554):失败原因在最后一轮最可诊断,首轮"末轮报错行不可读"不固化。
  assert.equal(r.signals[0].at, '2026-10-29T08:29:24.187Z')
  assert.match(r.signals[0].message, /TS2554/)
  assert.doesNotMatch(r.signals[0].message, /末轮报错行不可读/)
  // 身份不带 code:具体 TS 号不再把同一件事拆成多键。
  assert.equal(identityOf(r.signals[0]), 'deploy_outcome|alert_firing|route:/deploy/build-fail')
  assert.doesNotMatch(identityOf(r.signals[0]), /code:/)

  // 旧台账兼容:改造前落盘的信号(message 带 TS2339,旧身份带 |code:TS2339)仍按同 route 认账。
  const legacy = decisionToSignal(rows[1].object, contract).signal
  const again = planIntake({
    decisions: [{ line: 1, object: decision({ action: 'build-fail', ts: '2026-10-29T09:10:00.000Z', reason: fullReason('TS2554') }) }],
    contract,
    minutes: DEFAULT_MINUTES,
    existing: [legacy],
  })
  assert.equal(again.signals.length, 0, '旧信号行必须仍能拦住同一 route 的新信号(否则修复当天就多一条)')
  assert.equal(again.skipped, 1)
})

test('⑧ 演练绝缘:synthetic 与旧 reason 前缀不产告警,同形真实回滚仍产 error,计数分离', () => {
  const contract = loadContract()

  // 显式 synthetic:true —— 联测/演练记录不得变成生产 error 告警。
  const drill = decisionToSignal(decision({ synthetic: true, reason: '演练,不是事故' }), contract)
  assert.equal(drill.produce, false, 'synthetic 记录不得产信号')
  assert.equal(drill.synthetic, true)

  // 旧形态(2026-10-31 那枚早于 --synthetic 字段):按 reason 显式前缀一次性归位。
  const legacy = decisionToSignal(decision({ reason: `${LEGACY_DRILL_REASON_PREFIX}:以本仓 HEAD 模拟回滚` }), contract)
  assert.equal(legacy.produce, false, '旧演练 reason 前缀不得产信号')
  assert.equal(legacy.synthetic, true)
  assert.equal(isSyntheticDecision({ reason: `${LEGACY_DRILL_REASON_PREFIX}:x` }), true)
  assert.equal(isSyntheticDecision({ reason: '真实回滚:门禁失败' }), false)
  // 字符串 "true" 不得冒充演练标记(只认显式布尔)。
  assert.equal(isSyntheticDecision({ synthetic: 'true' }), false, '字符串 true 不得绝缘')

  // 反向:同形但真实回滚(无演练标记/前缀)必须照旧产 alert_firing error。
  const real = decisionToSignal(decision({ reason: '健康门禁未过' }), contract)
  assert.equal(real.produce, true, '真实回滚必须产信号(绝缘不可过宽)')
  assert.equal(real.signal.kind, 'alert_firing')
  assert.equal(real.signal.severity, 'error')
  assert.equal(real.signal.route, 'deploy/rollback')

  // 计数分离:演练只进 synthetic,不与 skipped 混;真实信号照常产出。
  const rows = [
    { line: 1, object: decision({ ts: '2026-10-26T10:00:00.000Z', synthetic: true }) },
    { line: 2, object: decision({ ts: '2026-10-26T10:30:00.000Z', reason: `${LEGACY_DRILL_REASON_PREFIX}:旧账` }) },
    { line: 3, object: decision({ ts: '2026-10-26T11:00:00.000Z', reason: '健康门禁未过' }) },
  ]
  const plan = planIntake({ decisions: rows, contract, minutes: DEFAULT_MINUTES, existing: [] })
  assert.equal(plan.signals.length, 1, '只有真实回滚产信号')
  assert.equal(plan.synthetic, 2, '两条演练必须单列')
  assert.equal(plan.skipped, 0, '演练不得混进 skipped')
  assert.equal(plan.undetermined, 0)
})

// 2026-11-04 断链修复的 CLI 级反向锁:旧实现遇 1 行坏即 `return 2` 且不写任何信号,
// 生产实测「swap-fail 未登记」这一行让下游 incident-signals 静默 6 天。
test('⑪ 单行形状坏不拖垮整趟:好行照常落盘 + 未判定如实 exit 2', () => {
  const dir = mkScratch('deploy-intake-badrow-')
  try {
    const input = join(dir, 'deploy-decisions.jsonl')
    const out = join(dir, 'state', 'incident-signals.jsonl')
    const bad = JSON.stringify(decision({ action: 'not-a-real-action', ts: '2026-11-04T09:01:00.000Z' }))
    const good = JSON.stringify(decision({ action: 'build-fail', ts: '2026-11-04T09:00:00.000Z' }))
    writeFileSync(input, `${bad}\n${good}\n`, 'utf8')
    const r = runCli(['--in', input, '--out', out])
    assert.equal(r.status, 2, '有一行没判 ⇒ 必须如实落未判定,不得冒充全判过')
    assert.equal(
      lastLine(r.stdout),
      `${RESULT_PREFIX} signals=1 skipped=0 synthetic=0 badRows=1 torn=0 undetermined=1`,
    )
    const lines = readFileSync(out, 'utf8').trim().split(/\r?\n/)
    assert.equal(lines.length, 1, '好行信号必须落盘,不能被坏行一起丢掉')
    assert.equal(JSON.parse(lines[0]).route, 'deploy/build-fail')
    assert.match(r.stderr, /BAD-ROW/)
    assert.match(r.stderr, /未判定/)
  } finally {
    rmScratch(dir)
  }
})

test('⑫ 并发撕裂行(末段半条、无尾换行)剔除:不算未判定且好行照产', () => {
  const dir = mkScratch('deploy-intake-torn-')
  try {
    const input = join(dir, 'deploy-decisions.jsonl')
    const out = join(dir, 'state', 'incident-signals.jsonl')
    const good = JSON.stringify(decision({ action: 'rollback' }))
    // 末段半条:文件刻意不以 \n 结尾,模拟 appendFileSync 被读到一半。
    writeFileSync(input, `${good}\n{"v":1,"ts":"2026-11-04T09:02:00.000Z","action":"roll`, 'utf8')
    const r = runCli(['--in', input, '--out', out])
    assert.equal(r.status, 0, '半条记录不是一条完整输入 ⇒ 不该把整趟判成未判定')
    assert.equal(
      lastLine(r.stdout),
      `${RESULT_PREFIX} signals=1 skipped=0 synthetic=0 badRows=0 torn=1 undetermined=0`,
    )
    assert.equal(readFileSync(out, 'utf8').trim().split(/\r?\n/).length, 1, '好行信号照常落盘')
    assert.match(r.stderr, /TORN-LINE/)
  } finally {
    rmScratch(dir)
  }
})
