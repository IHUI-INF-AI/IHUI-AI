// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 灰度"对照面"的镜像用例(§22c:判据只许住一份,本文件 import 生产实现的 __test__ 出口,不复制判据)。
 *
 * 钉的回归面(票「灰度观察窗排在换流之后」):router 早在 Invoke-CanaryGate 之前就被指向新构建,
 * 而 pass 分支从不 -Action stop ⇒ 灰度期 stable 侧跑的就是候选本身,升档依据退化成"新 vs 新"。
 * 两条夹具各自可证伪:
 *   · 反例:两侧同一份构建 ⇒ 判 no-contrast,且喂给 decideStageAction 的判定必须折成 unknown ⇒ hold(不升档);
 *   · 正例:换流前观察 + 旧色基线 + 候选新色 + 采样面=canary ⇒ contrast,pass 照常喂进档位推进 ⇒ advance。
 * 档位/比例一律取 scripts/data/canary-policy.json(不在本文件写第二个数字)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const ARTIFACT_CLI = join(ROOT, 'deploy', 'win', 'ihui-canary-artifact.mjs')
const STAGE_CLI = join(ROOT, 'deploy', 'win', 'ihui-canary-stage.mjs')
const POLICY = join(ROOT, 'scripts', 'data', 'canary-policy.json')

const { __test__: ART } = await import(`file://${ARTIFACT_CLI.replace(/\\/g, '/')}`)
const { decideStageAction } = await import(`file://${STAGE_CLI.replace(/\\/g, '/')}`)
const POLICY_DOC = JSON.parse(readFileSync(POLICY, 'utf8'))
const STAGES = POLICY_DOC.traffic.stages

test('反例夹具:灰度期 stable 侧 == 候选构建(新 vs 新)⇒ 判红,且不得升档', () => {
  const r = ART.contrastGaps({
    gateAfterSwitch: false,
    baselineBuildId: 'aaa111',
    candidateBuildId: 'AAA111',
    sampledFrom: 'canary',
  })
  assert.equal(r.verdict, 'no-contrast', '同一份构建竟被判成有对照')
  assert.ok(
    r.gaps.some((g) => g.id === 'C3'),
    `缺口里没点名"同一份构建":${JSON.stringify(r.gaps)}`,
  )
  const word = ART.rampVerdictFrom(r.verdict, 'pass')
  assert.equal(word, 'unknown', '同构建仍把 pass 喂给档位推进')
  const d = decideStageAction({
    verdict: word,
    currentStage: STAGES[0].id,
    stages: STAGES,
    canaryServing: 'yes',
  })
  assert.equal(d.action, 'hold', `同构建竟升档:${JSON.stringify(d)}`)
  assert.equal(d.stage, STAGES[0].id, '同构建仍改了档位')
})

test('反例夹具:观察窗排在换流之后 ⇒ 判红(即使两侧构建 id 不同)', () => {
  const r = ART.contrastGaps({
    gateAfterSwitch: true,
    baselineBuildId: 'old111',
    candidateBuildId: 'new222',
    sampledFrom: 'canary',
  })
  assert.equal(r.verdict, 'no-contrast')
  assert.ok(
    r.gaps.some((g) => g.id === 'C1'),
    `缺口里没点名时序:${JSON.stringify(r.gaps)}`,
  )
  assert.equal(ART.rampVerdictFrom(r.verdict, 'pass'), 'unknown', '时序错位仍把 pass 喂给档位推进')
})

test('正例夹具:stable 旧色 + 候选新色 + 采样面=canary ⇒ 判绿并按档位升', () => {
  const r = ART.contrastGaps({
    gateAfterSwitch: false,
    baselineBuildId: 'old111',
    candidateBuildId: 'new222',
    sampledFrom: 'canary',
  })
  assert.equal(r.verdict, 'contrast', `正例被判红:${JSON.stringify(r.gaps)}`)
  assert.deepEqual(r.gaps, [])
  const word = ART.rampVerdictFrom(r.verdict, 'pass')
  assert.equal(word, 'pass')
  const d = decideStageAction({
    verdict: word,
    currentStage: STAGES[0].id,
    stages: STAGES,
    canaryServing: 'yes',
  })
  assert.equal(d.action, 'advance', `正例没升档:${JSON.stringify(d)}`)
  assert.equal(d.stage, STAGES[1].id, '升到的不是档位表的下一档')
  assert.equal(d.percent, STAGES[1].percent, '比例不是从 canary-policy.json 取的')
})

test('未判定:构建身份/时序取不到,或采样面不是候选 ⇒ unproven(不冒绿也不冒红,不升档)', () => {
  const noId = ART.contrastGaps({ gateAfterSwitch: false, baselineBuildId: null })
  const noOrder = ART.contrastGaps({
    gateAfterSwitch: null,
    baselineBuildId: 'a',
    candidateBuildId: 'b',
  })
  const stableFace = ART.contrastGaps({
    gateAfterSwitch: false,
    baselineBuildId: 'old',
    candidateBuildId: 'new',
    sampledFrom: 'stable',
  })
  for (const r of [noId, noOrder, stableFace]) assert.equal(r.verdict, 'unproven')
  assert.equal(ART.rampVerdictFrom(stableFace.verdict, 'pass'), 'unknown')
})

test('时序取证器:现读真仓两侧调用点 ⇒ 给出确定答案(不是恒 null 的摆设)', () => {
  const r = ART.readContrastOrder({
    deployText: readFileSync(ART.DEPLOY_PS1, 'utf8'),
    loopText: readFileSync(ART.LOOP_PS1, 'utf8'),
  })
  assert.equal(typeof r.gateAfterSwitch, 'boolean', `两侧调用点没读到:${JSON.stringify(r.facts)}`)
  assert.ok(r.facts.switchLine > 0 && r.facts.gateLine > 0, `行号取不到:${JSON.stringify(r.facts)}`)
})

test('时序取证器认"切流前置闸":deploy.ps1 把 --gate-cmd 交给编排器 ⇒ 观察点在换流之前', () => {
  // 2026-11-01 本票的正解:观察窗不再只住在 loop 的成品窗里。只要 deploy.ps1 有非注释行把
  // --gate-cmd 传给编排器,那一刻(旧色仍在服务、候选已健康)就是观察点 ⇒ 时序缺口消失。
  // 反过来(没有 --gate-cmd)必须仍按旧判据判红 —— 这条反向锁防"判据被顺手放宽成恒绿"。
  const loopText = [
    'Invoke-CanaryGate -Node $guardNode',
    '& $PwshExe -File (Join-Path $WinDir "ihui-deploy.ps1")',
  ].join('\n')
  const wired = ART.readContrastOrder({
    deployText: [
      '$bgOut = & $bgNode $bgMjs --target $webTarget `',
      "if ($bgGate) { $bgGateArgs = @('--gate-cmd', $bgGate) }",
    ].join('\n'),
    loopText,
  })
  assert.equal(wired.gateAfterSwitch, false, '接了切流前置闸却仍判"观察在换流后"')
  assert.ok(wired.facts.preSwapGateLine > 0, `没点名前置闸行号:${JSON.stringify(wired.facts)}`)

  const unwired = ART.readContrastOrder({
    deployText: '$bgOut = & $bgNode $bgMjs --target $webTarget `',
    // 真实 loop 的顺序是"先调子部署脚本、再跑成品观察窗"(缺陷本体);合成面必须照这个顺序,
    // 否则测的是"观察窗写在前面"这个不存在的现场。
    loopText: [
      '& $PwshExe -File (Join-Path $WinDir "ihui-deploy.ps1")',
      'Invoke-CanaryGate -Node $guardNode',
    ].join('\n'),
  })
  assert.equal(unwired.gateAfterSwitch, true, '没接前置闸却判成"观察在换流前"(判据被放宽)')
  assert.equal(unwired.facts.preSwapGateLine, null)
})

test('冷启动(本机无旧色):判 no-baseline 放行并记账,不得与"该有基线却取不到"混同', () => {
  const cold = ART.contrastGaps({
    gateAfterSwitch: false,
    baselineBuildId: null,
    candidateBuildId: 'new222',
    sampledFrom: 'canary',
    baselineExpected: false,
  })
  assert.equal(cold.verdict, 'no-baseline', `冷启动被判成 ${cold.verdict}(首轮会被永久拦死)`)
  assert.ok(
    cold.gaps.some((g) => g.id === 'C5'),
    `冷启动没留下记账:${JSON.stringify(cold.gaps)}`,
  )
  assert.equal(ART.rampVerdictFrom(cold.verdict, 'pass'), 'pass', '冷启动仍把 pass 折成 unknown')

  // 反向锁一:该有基线(缺省 baselineExpected=true)却取不到 ⇒ 仍按 C2 未判定,不许借冷启动开口子
  const missing = ART.contrastGaps({
    gateAfterSwitch: false,
    baselineBuildId: null,
    candidateBuildId: 'new222',
    sampledFrom: 'canary',
  })
  assert.equal(missing.verdict, 'unproven', `基线取不到却判 ${missing.verdict}`)
  assert.ok(missing.gaps.some((g) => g.id === 'C2'))
  assert.equal(ART.rampVerdictFrom(missing.verdict, 'pass'), 'unknown')

  // 反向锁二:冷启动也不许盖掉时序缺口(C1 一旦成立仍判红,不因"首轮"就放行新 vs 新)
  const coldButLate = ART.contrastGaps({
    gateAfterSwitch: true,
    baselineBuildId: null,
    candidateBuildId: 'new222',
    sampledFrom: 'canary',
    baselineExpected: false,
  })
  assert.equal(coldButLate.verdict, 'no-contrast', '冷启动把时序缺口盖掉了')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
