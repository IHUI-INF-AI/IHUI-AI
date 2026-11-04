// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * A11-closure-output 镜像测试(§22c:判据 import 源脚本 `__test__`,本文件零复算)。
 *
 * 立因(2026-11-04):A1-A10 全绿时,部署反馈闭环其实已静默 6 天 —— 派发戳每 20min
 * 照刷(A8 判绿),但 incident-signals.jsonl 零新增,根因是 action 闭集漏 swap-fail。
 * A11 用摄入器自己的 planIntake() 做只读对账,把"腿在跑却零产出"变成可整改的 drift。
 *
 * 钉十格:
 *  ① 纯判据三态分桶(ok/drift/unjudged 不并桶);
 *  ② 恒红门反向锁:全 pass 决策账 + 空信号账 + 陈旧派发戳 ⇒ 仍 ok;
 *  ③ 端到端:swap-fail 决策 + 空信号账 + 新鲜戳 ⇒ drift 且按 route 点名;
 *  ④ 补齐信号后 ⇒ ok(漏产可整改,不是永久红门);
 *  ⑤ 尺子只读:判定前后信号账逐字节不变(不许改被量的东西);
 *  ⑥ 决策面两候选都不在 ⇒ unjudged(不拿影子账当全量);
 *  ⑦ 形状坏行 ⇒ unjudged(摄入器会落未判定,尺子不替它判);
 *  ⑧ 接线锁:main 真的取料、evaluateAll 真的计入(有定义无接线 = 判据没装车);
 *  ⑨ 戳只作旁证:戳新不等于产出,戳旧不等于断链;
 *  ⑩ A11 的 drift 必须顶起整尺。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { decisionToSignal } from '../deploy-outcome-intake.mjs'
import { loadContract } from '../lib/incident-cluster.mjs'

const SRC = resolve(fileURLToPath(import.meta.url), '../../check-autonomy-leg-health.mjs')
const { __test__ } = await import(pathToFileURL(SRC).href)
const { judgeClosureOutput, judgeClosureOutputFace, evaluateAll, CLOSURE_SIGNALS_REL, CLOSURE_STAMP_REL } = __test__

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const NOW = Date.parse('2026-11-04T11:40:00.000Z')
const FULL_SHA = '0123456789abcdef0123456789abcdef01234567'
const contract = loadContract()

function decision(over = {}) {
  return {
    v: 1,
    ts: '2026-11-04T10:00:00.000Z',
    action: 'swap-fail',
    sha: FULL_SHA,
    reason: 'web 蓝绿切换失败,未切流',
    ...over,
  }
}

/** 每例独立临时仓根:决策面走注入 faceResolver,信号账/派发戳按运行态相对路径落盘。 */
function fixture(decisions, { withStamp = true, signals = [] } = {}) {
  const root = mkScratch('leg-health-output-')
  const decisionsPath = join(root, 'deploy-decisions.jsonl')
  writeFileSync(decisionsPath, `${decisions.map((d) => (typeof d === 'string' ? d : JSON.stringify(d))).join('\n')}\n`, 'utf8')
  const signalsPath = join(root, CLOSURE_SIGNALS_REL)
  mkdirSync(dirname(signalsPath), { recursive: true })
  if (signals.length) writeFileSync(signalsPath, `${signals.map((s) => JSON.stringify(s)).join('\n')}\n`, 'utf8')
  if (withStamp) writeFileSync(join(root, CLOSURE_STAMP_REL), JSON.stringify({ attemptAt: '2026-11-04T11:30:00.000Z' }), 'utf8')
  return { root, decisionsPath, signalsPath, faceResolver: () => ({ found: true, kind: 'test', path: decisionsPath }) }
}

test('① 纯判据三态分桶:待产 0 ⇒ ok / 待产 >0 ⇒ drift / 取不到 ⇒ unjudged', () => {
  const ok = judgeClosureOutput({ inputsOk: true, pending: 0, decisions: 10, existingCount: 3 })
  const drift = judgeClosureOutput({ inputsOk: true, pending: 2, pendingRows: [{ route: 'deploy/swap-fail' }, { route: 'deploy/build-fail' }] })
  const unjudged = judgeClosureOutput({ inputsOk: false, why: '契约读不到' })
  assert.equal(ok.state, 'ok')
  assert.equal(drift.state, 'drift')
  assert.equal(unjudged.state, 'unjudged')
  assert.equal(drift.dim, 'A11-closure-output')
  assert.match(drift.readout, /deploy\/swap-fail×1/)
  assert.match(unjudged.readout, /契约读不到/)
})

test('② 恒红门反向锁:全 pass 决策账 + 空信号账 + 陈旧派发戳 ⇒ 仍 ok', () => {
  const f = fixture([decision({ action: 'pass' }), decision({ action: 'canary-pass', ts: '2026-11-04T10:20:00.000Z' })], { withStamp: false })
  try {
    const r = judgeClosureOutputFace({ root: f.root, now: NOW, faceResolver: f.faceResolver })
    assert.equal(r.state, 'ok', '没事故不该报红;把 A11 做成"没信号就报红"就是 §12e 恒红门')
    assert.match(r.readout, /待产 0/)
    assert.match(r.readout, /\(尚无\)/)
    assert.match(r.readout, /取不到\(A8/)
  } finally {
    rmScratch(f.root)
  }
})

test('③ 端到端:swap-fail 决策 + 空信号账 + 新鲜派发戳 ⇒ drift 且点名漏产', () => {
  const f = fixture([decision()])
  try {
    const r = judgeClosureOutputFace({ root: f.root, now: NOW, faceResolver: f.faceResolver })
    assert.equal(r.state, 'drift')
    assert.match(r.readout, /腿在跑但闭环漏产 1 条/)
    assert.match(r.readout, /deploy\/swap-fail×1/)
    assert.match(r.readout, /派发戳 10min 前/, '戳照刷正是本尺要照出来的旁证')
    assert.match(r.next, /deploy-outcome-intake/, '出路必须可执行')
    assert.match(r.next, /signals=0/, '补齐后必须复查幂等,不能只补一次就算完')
  } finally {
    rmScratch(f.root)
  }
})

test('④ 补齐信号后 ⇒ ok(漏产可整改,不是永久红门)', () => {
  const d = decision()
  const signal = decisionToSignal(d, contract).signal
  const f = fixture([d], { signals: [signal] })
  try {
    const r = judgeClosureOutputFace({ root: f.root, now: NOW, faceResolver: f.faceResolver })
    assert.equal(r.state, 'ok')
    assert.match(r.readout, /待产 0/)
    assert.match(r.readout, /信号 1 条/)
    assert.match(r.readout, /最近产出 2026-11-04T10:00:00.000Z/)
  } finally {
    rmScratch(f.root)
  }
})

test('⑤ 尺子只读:判定前后信号账逐字节不变(不许改被量的东西)', () => {
  const swap = decision({ action: 'swap-fail' })
  const build = decision({ action: 'build-fail', ts: '2026-11-04T10:10:00.000Z' })
  const signal = decisionToSignal(swap, contract).signal
  const f = fixture([swap, build], { signals: [signal] })
  try {
    const before = readFileSync(f.signalsPath, 'utf8')
    const r = judgeClosureOutputFace({ root: f.root, now: NOW, faceResolver: f.faceResolver })
    assert.equal(r.state, 'drift', '夹具自检:这里必须还剩 1 条待产,否则本例空转')
    assert.equal(readFileSync(f.signalsPath, 'utf8'), before, 'A11 只准对账,绝不 appendSignals')
    assert.equal(readFileSync(f.decisionsPath, 'utf8').trim().split(/\r?\n/).length, 2, '决策账也不许被改写')
  } finally {
    rmScratch(f.root)
  }
})

test('⑥ 决策面两候选都不在 ⇒ unjudged(不拿主仓影子账当全量)', () => {
  const f = fixture([decision()])
  try {
    const r = judgeClosureOutputFace({
      root: f.root,
      now: NOW,
      faceResolver: () => ({ found: false, candidates: [{ kind: 'prod-checkout' }, { kind: 'repo' }] }),
    })
    assert.equal(r.state, 'unjudged')
    assert.match(r.readout, /两候选都不在\(prod-checkout,repo\)/)
  } finally {
    rmScratch(f.root)
  }
})

test('⑦ 形状坏行 ⇒ unjudged(摄入器会落未判定,尺子不替它判)', () => {
  const f = fixture([decision(), '{broken json'])
  try {
    const r = judgeClosureOutputFace({ root: f.root, now: NOW, faceResolver: f.faceResolver })
    assert.equal(r.state, 'unjudged')
    assert.match(r.readout, /1 行形状坏/)
  } finally {
    rmScratch(f.root)
  }
})

test('⑧ 接线锁:main 真的取料、evaluateAll 真的计入(有定义无接线 = 判据没装车)', () => {
  const src = readFileSync(SRC, 'utf8')
  const at = src.indexOf('async function main()')
  assert.ok(at > 0, 'main 取不到')
  const mainBody = src.slice(at, src.indexOf('const isDirectRun'))
  assert.match(mainBody, /const output = judgeClosureOutputFace\(/, 'main 没调取料层 ⇒ A11 永远不会出现在巡检读数里')
  assert.match(mainBody, /claims, output }\)/, 'evaluateAll 调用没把 output 传进去')
  assert.match(src, /if \(output\) dims\.push\(output\)/, 'evaluateAll 没把 output 计入 dims ⇒ 判据造了没装车')
  assert.match(src, /import \{ readDecisionText, parseExistingSignals, planIntake, DEFAULT_MINUTES \}/, '判据必须零复算 import 摄入器')
})

test('⑨ 戳只作旁证:戳新不等于产出,戳旧不等于断链', () => {
  const stale = judgeClosureOutput({ inputsOk: true, pending: 0, dispatchAt: '2026-10-01T00:00:00.000Z', now: NOW })
  const fresh = judgeClosureOutput({ inputsOk: true, pending: 1, pendingRows: [{ route: 'deploy/swap-fail' }], dispatchAt: '2026-11-04T11:39:00.000Z', now: NOW })
  assert.equal(stale.state, 'ok')
  assert.equal(fresh.state, 'drift')
  assert.match(fresh.readout, /派发戳 1min 前/)
})

test('⑩ A11 的 drift 必须顶起整尺', () => {
  const gatesText = JSON.stringify({ sessionCommandTemplate: 'x', ticketWhitelist: ['a'] })
  const output = judgeClosureOutput({ inputsOk: true, pending: 1, pendingRows: [{ route: 'deploy/swap-fail' }] })
  const r = evaluateAll({ repoRoot: ROOT, gatesText, events: { ok: true, events: [] }, ticketRows: [{ text: 'a', line: 1 }], output })
  assert.equal(r.state, 'drift')
  assert.ok(r.dims.some((d) => d.dim === 'A11-closure-output'))
  assert.match(r.summary, /DRIFT=1/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
