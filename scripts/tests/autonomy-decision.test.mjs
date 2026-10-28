// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `autonomy-decision.mjs` 镜像测试(§22c:判据一律 import 源脚本 `__test__`,本文件零复制判据)。
 *
 * 钉五环:
 *  ① 策略形状锁:真策略可加载(权重/因子权重各自合到 1),各型坏策略逐条抛;
 *  ② 候选形状锁:裸数组与 `{candidates}` 都认,空/坏/重复 id 逐型抛;
 *  ③ 贡献可加:总分 = 各维度贡献之和,维度贡献 = 维度权重 × 维度得分,因子同构;
 *  ④ 归一语义:风险/成本越高分越低,租约越临近到期越紧急,验证时长到参照即零余量;
 *  ⑤ 排序与可审计理由 + CLI 三档退出码(0/3/2),夹具落 `.ihui-agent/tmp` 并在测试后清理。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as ad } from '../autonomy-decision.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'autonomy-decision.mjs')
const POLICY = ad.loadPolicy(readFileSync(ad.POLICY_PATH, 'utf8'))
const MAX = POLICY.scales.levelMax
const STEP = Math.max(0, MAX - 1)

const make = (id, patch = {}) => ({
  id,
  title: `${id} 票`,
  benefit: { impact: MAX, userValue: MAX, ...patch.benefit },
  risk: { irreversible: 0, externalDependency: 0, ruleTouch: 0, ...patch.risk },
  cost: { changeSurface: 0, verifyMinutes: 0, ...patch.cost },
  urgency: { leaseHours: 0, blockingOthers: MAX, ...patch.urgency },
})

const BEST = make('A')
const MID = make('M', {
  benefit: { impact: STEP, userValue: STEP },
  risk: { externalDependency: STEP },
  cost: { changeSurface: STEP, verifyMinutes: POLICY.scales.verifyMinutesRef / 2 },
  urgency: { leaseHours: POLICY.scales.leaseHoursRef / 3, blockingOthers: STEP },
})
const HARD = make('H', { risk: { ruleTouch: MAX } })
const LOW = make('L', {
  benefit: { impact: 0, userValue: 0 },
  risk: { irreversible: STEP, externalDependency: STEP },
  cost: { changeSurface: MAX, verifyMinutes: POLICY.scales.verifyMinutesRef * 2 },
  urgency: { leaseHours: POLICY.scales.leaseHoursRef, blockingOthers: 0 },
})

const jsonOf = (mutate) => {
  const doc = JSON.parse(JSON.stringify(POLICY))
  mutate(doc)
  return JSON.stringify(doc)
}

const runCli = (args) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  })

function fixture(t, tag, doc) {
  const dir = join(ROOT, '.ihui-agent', 'tmp', `autonomy-decision-${process.pid}-${tag}`)
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'candidates.json')
  writeFileSync(file, JSON.stringify(doc, null, 2), 'utf8')
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return file
}

test('① 策略形状锁:真策略四维齐全,维度权重与各维因子权重各自合到 1', () => {
  assert.deepEqual(Object.keys(POLICY.dimensions.weights).sort(), [...ad.DIMENSIONS].sort())
  const weightSum = ad.DIMENSIONS.reduce((s, d) => s + POLICY.dimensions.weights[d], 0)
  assert.ok(Math.abs(weightSum - 1) < 1e-9, `维度权重之和应为 1,现为 ${weightSum}`)
  for (const dim of ad.DIMENSIONS) {
    const factors = POLICY.dimensions.factors[dim]
    assert.deepEqual(Object.keys(factors).sort(), [...ad.FACTOR_KEYS[dim]].sort())
    const sum = Object.values(factors).reduce((s, v) => s + v, 0)
    assert.ok(Math.abs(sum - 1) < 1e-9, `${dim} 因子权重之和应为 1,现为 ${sum}`)
  }
})

test('① 策略形状锁:各型坏策略一律抛,不回落内置默认值', () => {
  const bad = [
    'not-json',
    '{}',
    jsonOf((p) => {
      p.version = 0
    }),
    jsonOf((p) => {
      p.dimensions.weights.benefit = 0.5
    }),
    jsonOf((p) => {
      delete p.dimensions.factors.risk.ruleTouch
    }),
    jsonOf((p) => {
      p.scales.levelMax = 0
    }),
    jsonOf((p) => {
      p.thresholds.riskReview = 0.9
      p.thresholds.riskBlock = 0.5
    }),
    jsonOf((p) => {
      p.thresholds.hardBlock.impact = MAX
    }),
    jsonOf((p) => {
      p.thresholds.minScore = 2
    }),
  ]
  for (const raw of bad) {
    assert.throws(() => ad.loadPolicy(raw), /策略形状坏|不是合法 JSON/, raw.slice(0, 80))
  }
})

test('② 候选形状锁:裸数组与 candidates 对象都认,坏形状逐型抛', () => {
  assert.equal(ad.validateCandidates([BEST], POLICY)[0].id, 'A')
  assert.equal(ad.validateCandidates({ candidates: [BEST] }, POLICY).length, 1)
  assert.throws(() => ad.validateCandidates([], POLICY), /候选为空/)
  assert.throws(() => ad.validateCandidates('x', POLICY), /必须是数组/)
  assert.throws(() => ad.validateCandidates([{ ...BEST, id: ' ' }], POLICY), /缺 id/)
  assert.throws(() => ad.validateCandidates([{ ...BEST, title: '' }], POLICY), /缺 title/)
  assert.throws(
    () => ad.validateCandidates([make('X', { benefit: { impact: MAX + 1 } })], POLICY),
    /benefit\.impact/,
  )
  assert.throws(
    () => ad.validateCandidates([make('X', { cost: { verifyMinutes: -1 } })], POLICY),
    /verifyMinutes/,
  )
  assert.throws(() => ad.validateCandidates([BEST, BEST], POLICY), /id 重复/)
  const noLease = ad.validateCandidates([make('N', { urgency: { leaseHours: null } })], POLICY)
  assert.equal(noLease[0].urgency.leaseHours, null, '无租约必须保留 null 而不是补 0')
})

test('③ 贡献可加:总分 = 维度贡献之和,维度 = 权重×得分,因子 = 权重×因子得分', () => {
  const item = ad.scoreCandidate(POLICY, MID)
  const total = item.contributions.reduce((s, d) => s + d.contribution, 0)
  assert.ok(Math.abs(item.score - total) < 1e-9, `总分 ${item.score} 应等于贡献之和 ${total}`)
  for (const dim of item.contributions) {
    assert.equal(dim.weight, POLICY.dimensions.weights[dim.dimension])
    // 落库值保留 6 位小数(审计要加得出),故用 1e-6 档复核等式而不是逐位全等。
    assert.ok(Math.abs(dim.contribution - dim.weight * dim.credit) < 1e-6)
    let factorCredits = 0
    for (const factor of dim.factors) {
      assert.equal(factor.factorWeight, POLICY.dimensions.factors[dim.dimension][factor.key])
      assert.ok(Math.abs(factor.weight - dim.weight * factor.factorWeight) < 1e-6)
      assert.ok(Math.abs(factor.contribution - factor.weight * factor.credit) < 1e-6)
      factorCredits += factor.factorWeight * factor.credit
    }
    assert.ok(Math.abs(dim.credit - factorCredits) < 1e-5)
  }
})

test('④ 归一语义:风险/成本越高分越低,租约越临近到期越紧急,验证时长到参照即零余量', () => {
  const lowRisk = ad.scoreCandidate(POLICY, BEST)
  const highRisk = ad.scoreCandidate(
    POLICY,
    make('R', { risk: { irreversible: STEP, externalDependency: MAX } }),
  )
  assert.ok(lowRisk.riskSeverity < highRisk.riskSeverity)
  assert.ok(lowRisk.score > highRisk.score, '风险更高时总分必须更低')

  const urgencyOf = (leaseHours) =>
    ad
      .scoreCandidate(POLICY, make('U', { urgency: { leaseHours, blockingOthers: 0 } }))
      .contributions.find((d) => d.dimension === 'urgency')
      .factors.find((f) => f.key === 'leaseHours')
  assert.equal(urgencyOf(0).normalized, 1, '零小时剩余 = 最紧急')
  assert.equal(urgencyOf(POLICY.scales.leaseHoursRef).normalized, 0, '到参照小时 = 不紧急')
  assert.equal(urgencyOf(null).normalized, 0, '无租约 = 不紧急')

  const costly = ad.scoreCandidate(
    POLICY,
    make('C', { cost: { verifyMinutes: POLICY.scales.verifyMinutesRef * 3 } }),
  )
  const minutes = costly.contributions
    .find((d) => d.dimension === 'cost')
    .factors.find((f) => f.key === 'verifyMinutes')
  assert.equal(minutes.normalized, 1)
  assert.equal(minutes.credit, 0, '验证时长超过参照即无余量,不得为负')
})

test('⑤ 排序与理由:高分在前、硬阻断/低分压后、理由点名前一位与失分项', () => {
  const result = ad.decide({ policy: POLICY, candidates: [LOW, HARD, MID, BEST] })
  assert.equal(result.state, 'decided')
  assert.deepEqual(
    result.ranked.map((x) => x.id),
    ['A', 'M'],
    '高分在前,且压后票不进排序',
  )
  assert.match(result.ranked[0].reason, /^首位:/)
  assert.ok(result.ranked[1].reason.includes('A'), '第二位理由必须点名前一位 id')
  assert.match(result.ranked[1].reason, /失分项/)
  assert.equal(result.deferred.find((x) => x.id === 'H').code, 'hard-block')
  assert.equal(result.deferred.find((x) => x.id === 'L').code, 'low-score')
  assert.equal(result.counts.input, 4)
  assert.equal(result.counts.ranked, 2)
  assert.equal(result.counts.deferred, 2)
  assert.equal(ad.exitCodeOf(result), ad.EXIT_DECIDED)
  assert.match(ad.formatReport(result), /理由:首位:/)

  const allDeferred = ad.decide({ policy: POLICY, candidates: [HARD, LOW] })
  assert.equal(allDeferred.state, 'deferred-all')
  assert.equal(ad.exitCodeOf(allDeferred), ad.EXIT_DEFERRED)

  const tie = ad.decide({ policy: POLICY, candidates: [make('Z'), make('A')] })
  assert.equal(tie.ranked[0].id, 'A', '同分时按 id 字典序,任何人重跑顺序一致')
})

test('⑥ CLI:缺输入 exit 2;有效输入 exit 0 且 --json 可解析;全压后 exit 3;夹具清理', (t) => {
  const missing = runCli([])
  assert.equal(missing.status, ad.EXIT_UNKNOWN)
  assert.match(missing.stderr, /未判定/)

  const okFile = fixture(t, 'ok', { candidates: [BEST, MID] })
  const okJson = runCli(['--input', okFile, '--json'])
  assert.equal(okJson.status, ad.EXIT_DECIDED, okJson.stderr)
  const doc = JSON.parse(okJson.stdout)
  assert.equal(doc.state, 'decided')
  assert.equal(doc.ranked.length, 2)
  assert.ok(Array.isArray(doc.ranked[0].contributions))
  assert.equal(doc.policy.version, POLICY.version, '--json 必须带策略快照供复核')

  const okText = runCli(['--input', okFile])
  assert.equal(okText.status, ad.EXIT_DECIDED)
  assert.match(okText.stdout, /理由:/)

  const badFile = fixture(t, 'deferred', [HARD, LOW])
  const deferred = runCli(['--input', badFile])
  assert.equal(deferred.status, ad.EXIT_DEFERRED)

  const emptyFile = fixture(t, 'empty', [])
  const undetermined = runCli(['--input', emptyFile])
  assert.equal(undetermined.status, ad.EXIT_UNKNOWN)
  assert.match(undetermined.stderr, /未判定/)

  const selfTest = runCli(['--self-test'])
  assert.equal(selfTest.status, 0, selfTest.stderr)
  assert.match(selfTest.stdout, /self-test: 全绿/)
})
