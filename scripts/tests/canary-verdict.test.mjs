// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `canary-verdict.mjs` 的镜像测试(§22c:判据 import 源脚本,本文件不复制判据)。
 *
 * 钉五环(O65 第 2 期「金丝雀观察窗」):
 *  ① 策略面:真实 scripts/data/canary-policy.json 必须能过 loadPolicy;缺 origin 腿必须拒;
 *  ② 判据面:绝对阈值(错误率/P95)、相对基线(错误率抬升/P95 放大)、三态归并;
 *  ③ 边界面:unknown 不进错误率分母、public 腿不参与回滚、样本不足/全未知 ⇒ unknown;
 *  ④ 采样面:假 fetch 驱动 runSampling,429/网络异常记 unknown,正文未命中记 fail;
 *  ⑤ 接线面:部署环必须真调本模块、回滚必须带 -CanaryRollback、回滚后不得刷绿色态,
 *     且 ihui-deploy.ps1 不得在成功分支把 .rollback 删掉(否则自动回滚无包可退)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import {
  CanaryShapeError,
  EXIT_FAIL,
  EXIT_PASS,
  EXIT_UNKNOWN,
  POLICY_PATH,
  decideCanary,
  loadPolicy,
  normalizeSample,
  parseSampleLines,
  percentile95,
  recordCanaryDecision,
  runSampling,
  summarizeSamples,
} from '../canary-verdict.mjs'

const SCRIPT = fileURLToPath(new URL('../canary-verdict.mjs', import.meta.url))
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const LOOP_PS1 = join(ROOT, 'deploy', 'win', 'ihui-deploy-loop.ps1')
const DEPLOY_PS1 = join(ROOT, 'deploy', 'win', 'ihui-deploy.ps1')

const TH = {
  minSamples: 3,
  maxErrorRate: 0.2,
  maxErrorRateDelta: 0.1,
  maxP95Ms: 500,
  maxP95Ratio: 2,
  maxP95DeltaMs: 100,
  minBaselineP95Ms: 10,
  maxUnknownRatio: 0.5,
}
const POLICY = {
  version: 1,
  window: { ticks: 1, gapMs: 1, timeoutMs: 1000 },
  thresholds: TH,
  endpoints: [
    { id: 'web', kind: 'origin', url: 'http://127.0.0.1:8801/', contains: '<!DOCTYPE html' },
    { id: 'pub', kind: 'public', url: 'https://example.com/', contains: '' },
  ],
}
const rec = (endpoint, verdict, ms, kind = 'origin') => ({
  endpoint,
  kind,
  verdict,
  ms,
  status: verdict === 'pass' ? 200 : verdict === 'fail' ? 500 : 0,
  stage: 'candidate',
  ts: '',
})

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'canary-verdict-'))
}

test('① 策略面:真实策略可加载,缺 origin 腿拒绝,坏形状全抛', () => {
  const real = loadPolicy(readFileSync(POLICY_PATH, 'utf8'))
  assert.ok(real.endpoints.some((e) => e.kind === 'origin'), '真实策略必须至少有一条源站腿')
  assert.ok(real.window.ticks >= 2, '观察窗至少要 2 tick(单点不算观察窗)')
  assert.equal(real.thresholds.minSamples >= 2, true, 'minSamples 至少 2(单样本算不出错误率)')

  assert.throws(
    () => loadPolicy('{"version":1,"window":{"ticks":1,"gapMs":1,"timeoutMs":1},"thresholds":' + JSON.stringify(TH) + ',"endpoints":[{"id":"p","kind":"public","url":"http://x/"}]}'),
    CanaryShapeError,
    '只有 public 腿的策略无法出可回滚结论,必须拒绝',
  )
  assert.throws(() => loadPolicy('not-json'), CanaryShapeError)
  assert.throws(() => loadPolicy(JSON.stringify({ ...POLICY, endpoints: [] })), CanaryShapeError)
  assert.throws(
    () => loadPolicy(JSON.stringify({ ...POLICY, endpoints: [{ id: 'a', kind: 'origin', url: 'ftp://x/' }] })),
    CanaryShapeError,
  )
  assert.throws(
    () => loadPolicy(JSON.stringify({ ...POLICY, thresholds: { ...TH, minSamples: 1 } })),
    CanaryShapeError,
    'minSamples < 2 必须拒绝(不得给出单样本结论)',
  )
})

test('② 判据面:绝对阈值与相对基线各自生效', () => {
  const green = [rec('web', 'pass', 10), rec('web', 'pass', 12), rec('web', 'pass', 11)]
  assert.equal(decideCanary({ policy: POLICY, candidate: green }).verdict, 'pass')
  assert.equal(decideCanary({ policy: POLICY, candidate: green }).exitCode, EXIT_PASS)

  const errHigh = [rec('web', 'fail', 10), rec('web', 'fail', 10), rec('web', 'pass', 10)]
  const r1 = decideCanary({ policy: POLICY, candidate: errHigh })
  assert.equal(r1.verdict, 'fail')
  assert.equal(r1.exitCode, EXIT_FAIL)

  const slow = [rec('web', 'pass', 600), rec('web', 'pass', 700), rec('web', 'pass', 800)]
  assert.equal(decideCanary({ policy: POLICY, candidate: slow }).verdict, 'fail', 'P95 超绝对阈值必须 fail')

  const base = [rec('web', 'pass', 10), rec('web', 'pass', 10), rec('web', 'pass', 10)]
  const deltaErr = [rec('web', 'fail', 10), rec('web', 'pass', 10), rec('web', 'pass', 10)]
  assert.equal(
    decideCanary({ policy: POLICY, baseline: base, candidate: deltaErr }).verdict,
    'fail',
    '错误率较基线抬升 > delta 必须 fail',
  )

  const deltaP95 = [rec('web', 'pass', 400), rec('web', 'pass', 420), rec('web', 'pass', 430)]
  const rP95 = decideCanary({ policy: POLICY, baseline: base, candidate: deltaP95 })
  assert.equal(rP95.verdict, 'fail', 'P95 放大 2x 且增量 > 100ms 必须 fail')
  assert.ok(rP95.reasons.join(' ').includes('基线'), '失败理由必须带基线读数(可复核)')

  // 基线样本不足 ⇒ 相对判据不启用(不拿 1 个样本的 P95 当基准)
  const thinBase = [rec('web', 'pass', 10)]
  const fastCand = [rec('web', 'pass', 100), rec('web', 'pass', 100), rec('web', 'pass', 100)]
  assert.equal(
    decideCanary({ policy: POLICY, baseline: thinBase, candidate: fastCand }).verdict,
    'pass',
    '基线有效样本 < minSamples 时不得启用相对判据',
  )
})

test('③ 边界面:unknown 不进分母、public 腿不参与回滚、样本不足不出结论', () => {
  const halfUnknown = [rec('web', 'unknown', 10), rec('web', 'unknown', 10), rec('web', 'pass', 10)]
  const r = decideCanary({ policy: POLICY, candidate: halfUnknown })
  assert.equal(r.verdict, 'unknown')
  assert.equal(r.exitCode, EXIT_UNKNOWN)

  const pubBroken = [
    rec('web', 'pass', 10),
    rec('web', 'pass', 10),
    rec('web', 'pass', 10),
    rec('pub', 'fail', 10, 'public'),
    rec('pub', 'fail', 10, 'public'),
    rec('pub', 'fail', 10, 'public'),
  ]
  assert.equal(decideCanary({ policy: POLICY, candidate: pubBroken }).verdict, 'pass', '公网腿坏了不回滚好构建')

  const thin = [rec('web', 'pass', 10), rec('web', 'pass', 10)]
  assert.equal(decideCanary({ policy: POLICY, candidate: thin }).verdict, 'unknown')

  assert.equal(decideCanary({ policy: POLICY, candidate: [rec('pub', 'pass', 10, 'public')] }).verdict, 'unknown', '源站腿零样本不得判绿')
  assert.throws(() => decideCanary({ policy: POLICY, candidate: [] }), CanaryShapeError, '空候选不得记绿')

  const s = summarizeSamples([rec('web', 'pass', 10), rec('web', 'fail', 999), rec('web', 'unknown', 888)])
  const w = s.get('web')
  assert.equal(w.measured, 2, 'unknown 不进 measured')
  assert.equal(w.errorRate, 0.5, '错误率分母只含 pass+fail')
  assert.equal(w.p95Ms, 10, 'P95 只取 pass 样本耗时(失败响应无延迟语义)')
  assert.equal(percentile95([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 10)
  assert.equal(percentile95([]), null)
})

test('④ 采样面:假 fetch 驱动,429/异常记 unknown,正文不命中记 fail', async () => {
  const dir = tmpDir()
  const out = join(dir, 'candidate.jsonl')
  const policy = loadPolicy(
    JSON.stringify({ ...POLICY, window: { ticks: 4, gapMs: 1, timeoutMs: 50 } }),
  )
  let calls = 0
  const fakeFetch = async (url) => {
    if (url.includes('8801')) {
      calls += 1
      if (calls === 1) return { status: 200, text: async () => '<!DOCTYPE html><html></html>' }
      if (calls === 2) return { status: 429, text: async () => 'slow down' }
      if (calls === 3) return { status: 200, text: async () => 'login page' }
      throw new Error('ECONNRESET')
    }
    return { status: 200, text: async () => 'ok' }
  }
  const r = await runSampling({ policy, stage: 'candidate', out, fetchImpl: fakeFetch, sleep: async () => {} })
  assert.equal(r.count, 8, '4 tick × 2 端点 = 8 条样本')
  const lines = readFileSync(out, 'utf8').trim().split(/\r?\n/)
  assert.equal(lines.length, 8)
  const rows = lines.map((l) => JSON.parse(l))
  assert.deepEqual(
    rows.map((x) => x.verdict),
    ['pass', 'pass', 'unknown', 'pass', 'fail', 'pass', 'unknown', 'pass'],
    '429⇒unknown,正文未命中⇒fail,网络异常⇒unknown',
  )
  for (const row of rows) {
    assert.equal(row.v, 1)
    assert.equal(row.stage, 'candidate')
    assert.ok(Number.isFinite(row.ms))
  }
  assert.equal(existsSync(out), true)
})

test('⑤ 接线面:部署环真调本模块、回滚带金丝雀语义、成功分支保留回滚点', () => {
  const loop = readFileSync(LOOP_PS1, 'utf8')
  const deploy = readFileSync(DEPLOY_PS1, 'utf8')

  assert.ok(loop.includes('Invoke-CanaryGate'), '守护进程必须有观察窗入口')
  assert.ok(loop.includes("scripts\\canary-verdict.mjs"), '观察窗必须调唯一判据模块')
  assert.ok(loop.includes("scripts\\data\\canary-policy.json"), '观察窗必须读唯一策略文件')
  assert.ok(loop.includes('--record-decision'), '裁决必须进机读台账')
  assert.ok(loop.includes('-rollbackOnly -CanaryRollback'), '自动回滚必须交给部署脚本的既有 -rollbackOnly 出口')
  assert.ok(!/Invoke-FailNotify\s+-/.test(loop), '守护进程里没有 Invoke-FailNotify:在这里直调等于零投递(注释可提,调用不可有)')
  assert.ok(loop.includes('$canaryRolledBack'), '回滚结论必须能挡住绿色态')
  assert.ok(
    /if \(\$deployDoneThisRound -and -not \$canaryRolledBack\)/.test(loop),
    '绿色态刷新必须同时满足「本轮部署完成」与「金丝雀未撤下本轮」',
  )

  assert.ok(/\[switch\]\$CanaryRollback/.test(deploy), '部署脚本必须认识 -CanaryRollback')
  assert.ok(/-Action 'canary-rollback'/.test(deploy), '自动回滚必须按 canary-rollback 记账,不得记成人工回滚')
  assert.ok(
    !/Remove-Item "\$WebDir\\\.rollback" -Recurse -Force -ErrorAction SilentlyContinue/.test(deploy),
    '成功分支不得删除 .rollback:删了之后守护进程的自动回滚无包可退',
  )
  assert.ok(/Remove-Item \$rb -Recurse -Force/.test(deploy), '下一轮备份步仍要整份替换旧回滚点(不累积多份)')
})

test('⑥ CLI 面:--decide 退出码/JSON/记账一条龙,坏输入 exit 2', () => {
  const dir = tmpDir()
  const policyFile = join(dir, 'policy.json')
  writeFileSync(policyFile, JSON.stringify(POLICY))
  const ok = join(dir, 'ok.jsonl')
  const bad = join(dir, 'bad.jsonl')
  writeFileSync(ok, [
    rec('web', 'pass', 10),
    rec('web', 'pass', 11),
    rec('web', 'pass', 12),
    rec('pub', 'pass', 30, 'public'),
  ].map((r) => JSON.stringify(r)).join('\n') + '\n')
  writeFileSync(bad, [
    rec('web', 'fail', 10),
    rec('web', 'fail', 10),
    rec('web', 'pass', 10),
  ].map((r) => JSON.stringify(r)).join('\n') + '\n')

  const passRun = spawnSync(process.execPath, [SCRIPT, '--policy', policyFile, '--decide', '--candidate', ok, '--json'], { encoding: 'utf8' })
  assert.equal(passRun.status, EXIT_PASS, passRun.stderr)
  const passJson = JSON.parse(passRun.stdout.trim().split(/\r?\n/).pop())
  assert.equal(passJson.verdict, 'pass')
  assert.equal(passJson.comparedWithBaseline, false)

  const ledger = join(dir, 'decisions.jsonl')
  const failRun = spawnSync(
    process.execPath,
    [SCRIPT, '--policy', policyFile, '--decide', '--candidate', bad, '--json', '--record-decision', '--deploy-sha', 'c05ca0d5', '--ledger', ledger],
    { encoding: 'utf8' },
  )
  assert.equal(failRun.status, EXIT_FAIL, failRun.stderr)
  const arms = readFileSync(ledger, 'utf8').trim().split(/\r?\n/)
  assert.equal(arms.length, 1)
  const decision = JSON.parse(arms[0])
  assert.equal(decision.action, 'canary-rollback')
  assert.equal(decision.gateVerdict, 'fail')
  assert.equal(decision.sha, 'c05ca0d5')
  assert.deepEqual(decision.failDims, ['web'])

  const d = recordCanaryDecision({ verdict: 'unknown', dims: ['web'], reasons: ['x'], sha: '', ledger })
  assert.equal(d.action, 'canary-unproven')

  const missing = spawnSync(process.execPath, [SCRIPT, '--decide', '--candidate', join(dir, 'nope.jsonl')], { encoding: 'utf8' })
  assert.equal(missing.status, EXIT_UNKNOWN, '读不到候选必须 exit 2,不得记绿')

  const emptyPolicy = join(dir, 'policy.json')
  writeFileSync(emptyPolicy, '{}')
  const badPolicy = spawnSync(process.execPath, [SCRIPT, '--policy', emptyPolicy, '--decide', '--candidate', ok], { encoding: 'utf8' })
  assert.equal(badPolicy.status, EXIT_UNKNOWN, '策略形状坏必须 exit 2')
  assert.match(badPolicy.stderr, /未判定/)
})

test('⑦ 样本形状锁:坏行计数不静默,非法 verdict 必须拒', () => {
  const parsed = parseSampleLines(`${JSON.stringify(rec('web', 'pass', 10))}\nhalf-line\n{"endpoint":"web"}\n`)
  assert.equal(parsed.records.length, 1)
  assert.equal(parsed.badLines.length, 2)
  assert.throws(() => normalizeSample({ endpoint: 'web', verdict: 'great', ms: 1 }), CanaryShapeError)
  assert.throws(() => normalizeSample({ endpoint: 'web', verdict: 'pass', ms: -1 }), CanaryShapeError)
  assert.throws(() => normalizeSample({ verdict: 'pass', ms: 1 }), CanaryShapeError)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
