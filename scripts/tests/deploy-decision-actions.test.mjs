// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * deploy-decision-actions 镜像测试 —— 部署决策「发射面 → 记账面 → 摄入面」三面同源锁。
 *
 * 立因(2026-11-04 /goal 自进化轮实测):`deploy/win/ihui-deploy.ps1` 发射 `swap-fail`,
 * 而 `deploy-decision.mjs` 与 `deploy-outcome-intake.mjs` 各自手抄的闭集都漏了它 ⇒
 * 上游记不上账、下游整趟零信号,反馈闭环静默 6 天,七维健康尺全绿量不到。
 *
 * 本文件零复制判据:全部 import `scripts/lib/deploy-decision-actions.mjs` 的 `__test__`,
 * 发射面收割也只用真源的 `collectDeclaredActions`,不另写正则(§22c)。
 * 成对反向锁:每把锁都要有"加回 bug 就该红"的反例,防止守门恒真。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const ACTIONS_SRC = join(ROOT, 'scripts', 'lib', 'deploy-decision-actions.mjs')
const PS1_REL = join('deploy', 'win', 'ihui-deploy.ps1')

const {
  DEPLOY_DECISION_ACTIONS,
  OUTCOME_SIGNAL_RULES,
  assertActionParity,
  assertEmitterParity,
  collectDeclaredActions,
  isFailureAction,
} = (await import(pathToFileURL(ACTIONS_SRC).href)).__test__
const { DECISION_ACTIONS, buildDecision } = await import(pathToFileURL(join(ROOT, 'scripts', 'deploy-decision.mjs')).href)
const { __test__: intake } = await import(pathToFileURL(join(ROOT, 'scripts', 'deploy-outcome-intake.mjs')).href)
const { loadContract } = await import(pathToFileURL(join(ROOT, 'scripts', 'lib', 'incident-cluster.mjs')).href)

/** 从真源码取发射面;读不到必须炸,不许拿空串冒充"没有未登记动作"。 */
function ps1Source() {
  return readFileSync(join(ROOT, PS1_REL), 'utf8')
}

test('① 闭集与信号映射逐字同源,且 swap-fail 在位', () => {
  const r = assertActionParity()
  assert.equal(r.ok, true, r.why)
  assert.equal(DEPLOY_DECISION_ACTIONS.length, Object.keys(OUTCOME_SIGNAL_RULES).length)
  assert.ok(DEPLOY_DECISION_ACTIONS.includes('swap-fail'), '切流失败出口不得再从闭集消失')
  assert.deepEqual(OUTCOME_SIGNAL_RULES['swap-fail'], { kind: 'alert_firing', severity: 'error' })
  assert.equal(isFailureAction('swap-fail'), true)
  assert.equal(isFailureAction('pass'), false)
  assert.equal(isFailureAction('canary-unproven'), false)
})

test('② 记账面与摄入面都从真源派生,不存在第二份清单', () => {
  assert.deepEqual([...DECISION_ACTIONS], [...DEPLOY_DECISION_ACTIONS], 'deploy-decision.mjs 又自抄了闭集')
  assert.equal(intake.OUTCOME_MAP, OUTCOME_SIGNAL_RULES, 'deploy-outcome-intake.mjs 又自抄了映射表')
  assert.deepEqual(Object.keys(intake.OUTCOME_MAP), [...DEPLOY_DECISION_ACTIONS])
})

test('③ 真实发射面(ihui-deploy.ps1)全部在闭集且有映射 —— 断链不得复发', () => {
  const r = assertEmitterParity(ps1Source())
  assert.equal(r.state, 'ok', r.why)
  assert.ok(r.emitted.length >= 8, `发射面只收割到 ${r.emitted.length} 枚,正则可能失效`)
  assert.ok(r.emitted.includes('swap-fail'), 'PS1 的切流失败出口没被收割到 ⇒ 这把锁恒真,等于没锁')
  assert.equal(r.undeclared.length, 0)
  assert.equal(r.unmapped.length, 0)
})

test('④ 反向锁:发射面冒出未登记 action 必须判漂移(不是恒真)', () => {
  const poisoned = `${ps1Source()}\nWrite-DeployDecision -Action 'canary-nuke'\n`
  const r = assertEmitterParity(poisoned)
  assert.equal(r.state, 'drift', '新出口没登记却判绿 ⇒ 锁失效')
  assert.deepEqual(r.undeclared, ['canary-nuke'])
  assert.deepEqual(r.unmapped, ['canary-nuke'])
  assert.match(r.why, /canary-nuke/)
})

test('⑤ 反向锁:收割到 0 枚 ⇒ 未判定,绝不冒充"发射面干净"(§0.3)', () => {
  const r = assertEmitterParity('这里没有任何显式的 action 字面量')
  assert.equal(r.state, 'unjudged')
  assert.equal(r.emitted.length, 0)
  assert.match(r.why, /未判定/)
})

test('⑥ 端到端:PS1 的 swap-fail 字面量 → 记账器落账 → 摄入器产 error 信号', () => {
  const actions = collectDeclaredActions(ps1Source())
  assert.ok(actions.includes('swap-fail'))
  const record = buildDecision(
    { action: 'swap-fail', sha: 'ca2b080abfee6b9709f756d5cb1670438e84eab9', gateVerdict: 'not-run', reason: 'web 蓝绿切换失败,未切流' },
    { now: new Date('2026-10-28T16:07:44.316Z'), host: '服务器', pid: 40780 },
  )
  assert.equal(record.action, 'swap-fail')
  // 走真实落盘形状(JSON 往返),不直接把对象递给下游 —— 台账是 JSONL,这是断链发生的那一面。
  const reread = JSON.parse(JSON.stringify(record))
  const signal = intake.decisionToSignal(reread, loadContract())
  assert.equal(signal.produce, true)
  assert.equal(signal.signal.severity, 'error')
  assert.equal(signal.signal.route, 'deploy/swap-fail')
  assert.match(signal.signal.message, /action=swap-fail/)
  // 完整 40 位 sha 必须保留,不得被短 sha 折叠规则吃掉。
  assert.ok(signal.signal.message.includes('ca2b080abfee6b9709f756d5cb1670438e84eab9'))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
