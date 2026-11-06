/**
 * 灰度槽位三档终态镜像锁(票 L31441)——§22c:判据一律 import 生产纯函数/源码,本文件零复制判据。
 *
 * 钉的那一格:灰度产物已镜像 ≠ 灰度实例在位。灰度实例有「在位 / 不在位 / 未判定」三档,
 * 后两档一律是「未判定」——不得折成判定通过(§0.3)、不得折成失败、不得 advance,
 * 也不得把部署整轮升成恒红(§12e)。三档终态全部由生产判据链现算:
 *   ihui-canary-artifact.mjs: contrastGaps(对照面) → rampVerdictFrom(档位判定词)
 *   ihui-canary-stage.mjs:    decideStageAction(终态动作)
 * 「不在位」用采样面回落 stable 表达,「未判定」用时序/身份取不到表达 —— 与
 * deploy/win/ihui-deploy-loop.ps1 的 $graySampledFrom / $rampVerdict 折算同形,不在本文件另写一把尺子。
 *
 * 判据有牙:两组变异自证 —— ① 把生产 rampVerdictFrom 的「其余一律折 unknown」改成沿用 pass,
 * 本锁必须翻红(杀死「未判定折成判过」);② 摘掉 ihui-deploy.ps1 的三档措辞锚点,措辞锁必须翻红。
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const ARTIFACT_MJS = join(ROOT, 'deploy', 'win', 'ihui-canary-artifact.mjs')
const STAGE_MJS = join(ROOT, 'deploy', 'win', 'ihui-canary-stage.mjs')
const DEPLOY_PS1 = join(ROOT, 'deploy', 'win', 'ihui-deploy.ps1')
const POLICY = join(ROOT, 'scripts', 'data', 'canary-policy.json')

const { __test__: ART } = await import(pathToFileURL(ARTIFACT_MJS).href)
const { decideStageAction } = await import(pathToFileURL(STAGE_MJS).href)
const STAGES = JSON.parse(readFileSync(POLICY, 'utf8')).traffic.stages

// 三档夹具:只喂生产判据,期望值就是终态本身(不在测试里实现判据)
const CASES = [
  {
    name: '在位',
    args: { gateAfterSwitch: false, baselineBuildId: 'old111', candidateBuildId: 'new222', sampledFrom: 'canary' },
    wantContrast: 'contrast',
    wantRamp: 'pass',
    wantAction: 'advance',
  },
  {
    name: '不在位',
    args: { gateAfterSwitch: false, baselineBuildId: 'old111', candidateBuildId: 'new222', sampledFrom: 'stable' },
    wantContrast: 'unproven',
    wantRamp: 'unknown',
    wantAction: 'hold',
  },
  {
    name: '未判定',
    args: { gateAfterSwitch: null, baselineBuildId: 'old111', candidateBuildId: 'new222', sampledFrom: 'canary' },
    wantContrast: 'unproven',
    wantRamp: 'unknown',
    wantAction: 'hold',
  },
]

function lockThreeStates(artifact, decide) {
  for (const c of CASES) {
    const contrast = artifact.contrastGaps(c.args).verdict
    assert.equal(contrast, c.wantContrast, `${c.name}:对照面判据漂移`)
    const ramp = artifact.rampVerdictFrom(contrast, 'pass')
    assert.equal(ramp, c.wantRamp, `${c.name}:档位判定词漂移(未判定不得折成判过 §0.3)`)
    const d = decide({ verdict: ramp, currentStage: STAGES[0].id, stages: STAGES })
    assert.equal(d.action, c.wantAction, `${c.name}:终态漂移`)
    assert.notEqual(d.action, 'rollback', `${c.name}:不得把部署整轮升成恒红(§12e)`)
    if (c.name !== '在位') {
      assert.notEqual(d.action, 'advance', `${c.name}:未判定不得 advance(§0.3)`)
    }
  }
}

test('正例:生产判据链钉住「在位 / 不在位 / 未判定」三档终态(advance / hold / hold)', () => {
  lockThreeStates(ART, decideStageAction)
})

test('变异自证①:「未判定折成判定通过」的变异体必须被本锁杀死', async () => {
  const src = readFileSync(ARTIFACT_MJS, 'utf8')
  // 变异:把 rampVerdictFrom 的「其余一律折 unknown」改成沿用采样结论(pass)
  const mutated = src.replace(
    "return ok ? String(sampleVerdict || 'unknown') : 'unknown'",
    "return ok ? String(sampleVerdict || 'unknown') : String(sampleVerdict || 'unknown')",
  )
  assert.notEqual(mutated, src, '夹具前提:变异锚点不在生产判据里 ⇒ 自证假绿')
  const dir = mkdtempSync(join(tmpdir(), 'gray-slot-3state-'))
  const f = join(dir, 'ihui-canary-artifact.mjs')
  try {
    writeFileSync(f, mutated, 'utf8')
    const { __test__: MUT } = await import(pathToFileURL(f).href)
    // 变异体确实把未判定折成了 pass(不是夹具没生效)
    assert.equal(ART.rampVerdictFrom('unproven', 'pass'), 'unknown', '生产判据本身已不再折 unknown ⇒ 本锁前提破了')
    assert.equal(MUT.rampVerdictFrom('unproven', 'pass'), 'pass', '变异未改变行为 ⇒ 变异自证不成立')
    // 变异体喂进同一把锁 ⇒ 不在位/未判定档必翻红(被杀死)
    assert.throws(
      () => lockThreeStates(MUT, decideStageAction),
      /档位判定词漂移|终态漂移|未判定不得 advance/,
      '变异体仍全绿 ⇒ 镜像锁是摆设',
    )
  } finally {
    try { rmSync(dir, { recursive: true, force: true }) } catch {}
  }
})

const ANCHORS = [
  '[GRAY-SLOT-3STATE]',
  '产物在位 ≠ 灰度实例在位',
  '在位 / 不在位 / 未判定',
  '不折成判定通过',
  '不折成失败',
  '不 advance',
  '§12e',
]

function lockWording(text) {
  for (const a of ANCHORS) {
    assert.ok(text.includes(a), `deploy.ps1 灰度三档措辞缺锚点:${a}`)
  }
}

test('措辞锁:ihui-deploy.ps1 把「灰度实例不在位」单独出声,不混入判定通过', () => {
  lockWording(readFileSync(DEPLOY_PS1, 'utf8'))
})

test('变异自证②:摘掉 deploy.ps1 的「不折成判定通过」措辞 ⇒ 措辞锁翻红', () => {
  const text = readFileSync(DEPLOY_PS1, 'utf8')
  // 该措辞在注释/WARN/OK 三处都在位:必须全部摘净才翻红(只摘一处不算摘掉这一档)
  const muted = text.replaceAll('不折成判定通过', '「措辞已摘」')
  assert.notEqual(muted, text, '夹具前提:锚点根本不在文本里')
  assert.ok(!muted.includes('不折成判定通过'), '夹具前提:仍有残留锚点 ⇒ 变异没摘净')
  assert.throws(() => lockWording(muted), /缺锚点/, '摘掉措辞仍全绿 ⇒ 措辞锁是摆设')
})
