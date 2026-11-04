// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 结构锁:daemon 常驻 tick 链必须覆盖 96 个"曾只挂 main() 单轮链"的审计面(2026-11-03 立,
 * 同日先补 2 面、晚间再补 12 面;2026-11-04 再补 1 面 sweepFormatParity,与前两批共 30 面)。
 * 本席 W2 按票 RP-74 收口:HEAD 里 A9「承载面补齐(2026-11-04)」已把这批面搬进 tick,却没同步
 * 钉进本清单 ⇒ 按「该面读数谁在消费」分 3 批补齐 66 面(合计 96 面),每批带变异自证;
 * B 档(单轮≥5min / 真换口令 / 重启服务那族)一律不进本清单,理由钉在 git-guardian.mjs 挂点旁。
 *
 * 失效形态(已实测 18 小时零派发):`startDaemon()` 是内存常驻的 setTimeout 链,**不重读本文件**;
 * 隧道腿 / 短信通道 / 自开发发起腿 / 隧道指标这 4 面原先只写在 `main()` 的单轮链上,而
 * `\IHUI-AI git-guardian` 计划任务档于 0:28:47 被禁用后,daemon 成了唯一执行体 ⇒ 缺这 4 行
 * 就等于 4 面永久不跑。重启守护无效,因为码本身就缺行。
 * 2026-11-03 补的两面同一型且更静:判据面审计游标(`auditImmutableGuardNewCommits`,现读冻结在
 * 11-02T16:08Z / 积压 596 枚)与"清扫器还活着吗"(`auditSweeperLiveness`)也只在 main() 链上 ——
 * 后者本该是发现前者停摆的那只眼,眼自己闭着 ⇒ 这类事故只会一直靠人事后翻台账才发现。
 *
 * 本文件只锁"调用出现在 tick 体内"这一件事,不复制任何判据(判据在 git-guardian.mjs)。
 * 切片/非注释实调用判据一律 import `check-sweeper-liveness.mjs` 的 `__test__`(§0.6/§22c
 * 单一真相源),与门体第三族 dispatch-parity 共用同一把尺,本文件不再自带副本。
 * 按**区段切片**断言:绝不用 `assert.match(整个文件)` —— 全文件匹配会被 main() 那几行命中,
 * 于是恒真,等于没锁。
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { __test__ as P } from '../check-sweeper-liveness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const GUARDIAN_SRC = path.join(ROOT, 'scripts', 'git-guardian.mjs')
// 判据只此一份(§0.6/§22c):与门体 dispatch-parity 第三族共用,别处零副本
const { tickBodyOf, mainBodyOf, hasLiveCall, liveCallOffset } = P

/** 这 96 面原先只挂 main() 单轮链;计划任务档禁用后 daemon 是唯一执行体 ⇒ 必须同挂 tick。 */
const TICK_REQUIRED = [
  'auditTunnelLegHealth',
  'auditSmsChannelHealth',
  'sweepAutonomyLegHealth',
  'auditTunnelMetrics',
  // 游标类(2026-11-03 加):计划任务档 00:28 被禁用后,这两枚随整条 main() 链停摆 ——
  // 判据面审计游标冻结在 11-02T16:08Z(积压 596 枚),而本该第一个喊出来的"清扫器存活"
  // 尺子自己就住在停摆链里(看守者无人看守)。失效方向必须是"多要一次说明",不能是"多停一轮"。
  'auditImmutableGuardNewCommits',
  'auditSweeperLiveness',
  // A 档 12 面(2026-11-03 晚加):同一场事故的其余射程,现读节流戳全部冻结在 11-02T15:56–16:05Z。
  // 逐面核过才进清单:自带节流戳 + 健康时只读一份 json + 派生子进程 ≤120s(拆刀顺序见源脚本注释)。
  // 反证同一把尺:重开计划任务档**不算**出路 —— daemon 常驻持轮级锁,任务那轮实测静默退出。
  'watchPatrolHeartbeat',
  'watchWatchdog',
  'auditIndexUnmerged',
  'auditDeployStall',
  'auditPushDivergenceLeg',
  'auditGitFilterResidue',
  'auditHostTimezone',
  'auditDiskRootHygiene',
  'auditTempLanding',
  'auditOrphanDeletionRefs',
  'auditMigrationGaps',
  'auditRegistrySyncHealth',
  // 第二批 11 面(同日深夜续):6h/30min/5min 自带节流、健康档只读、不写工作树;
  'auditAasaPublicHealth',
  'auditAppVersionLatest',
  'auditAssetPathHealth',
  'auditOriginGuardLiveness',
  'auditProdDepAdvisories',
  'sweepDesktopDiscoveryBudget',
  'auditQoderSessionSyncTask',
  'auditWorkbuddySessionSyncTask',
  'sweepLessonDraft',
  'healMirrorPurgeLeg',
  'sweepHandMirrorUpgrades',
  // 格式对账尺(2026-11-04 立):只读一把尺、30 分钟自带节流戳、不写工作树、派生子进程 ≤5min。
  'sweepFormatParity',
  // ── W2 收口 批 1/3(29 面):跨端对账 / 落点 / 自愈只读巡检面 —— 读数由巡检轮与镜像门消费 ──
  'auditCrossEndParityDrift',
  'auditEgressIpDrift',
  'auditEnvDrift',
  'auditFeedbackLoopClosure',
  'auditGuardianCodeFreshness',
  'auditI18nCrossEndWording',
  'auditLandedReverts',
  'auditLintStagedPins',
  'auditOpsPatrol',
  'auditProdForeignWork',
  'auditPublicPathProbe',
  'auditPushChannel',
  'auditRootGuardManifestSync',
  'auditServiceInventory',
  'auditVerbatimResurrection',
  'auditWebRnParity',
  'checkConvergeAlignStall',
  'convergeCrossEndPortalVerdicts',
  'healCrossEndMirror',
  'healHomeJunctions',
  'healI18nBundleLeg',
  'healRootSeal',
  'healStaleDistLeg',
  'healStaleMiniappDist',
  'healStyleTokensLeg',
  'healUiRoutesLeg',
  'healUnresponsiveServices',
  'healWorktreeTracked',
  'reapWorktrees',
  // ── W2 收口 批 2/3(27 面):清扫 / 轮换 / 风格档节流面 —— 读数由 .ihui-agent/state 节流戳消费 ──
  'archiveGcDryRun',
  'gcSessionTranscripts',
  'scrubTempFixtures',
  'sweepBannedBuckets',
  'sweepCrossEndLandingLeg',
  'sweepCrossEndShellPages',
  'sweepCssTokensSourceLeg',
  'sweepDanglingCommitAutotag',
  'sweepDownloadsLiveHealth',
  'sweepExposedCredentialRotation',
  'sweepGitProbeHeadroom',
  'sweepHeadRecallRows',
  'sweepIosIpaRelay',
  'sweepKeepAliveForever',
  'sweepLessonApply',
  'sweepLocalDevDbRotation',
  'sweepMiniappStyleTiers',
  'sweepParityCockpit',
  'sweepPoolIsolation',
  'sweepRnColorLiteralLeg',
  'sweepRnCompatLeg',
  'sweepRnHostShells',
  'sweepRnStyleTiers',
  'sweepStaleClaimMarks',
  'sweepStaleClosedRows',
  'sweepUiMirrorLeg',
  'sweepWebStyleTiers',
  // ── W2 收口 批 3/3(10 面):自进化调度 / 自陈述 / 机构派生面 —— 读数由派发链消费 ──
  'autoRegisterRnTokenPairs',
  'devenvMigratePatrol',
  'dispatchAutoEvolve',
  'dispatchAutoTriage',
  'dispatchDepAdvisoryRadar',
  'dispatchDeployFeedback',
  'dispatchDeployOutcomeIntake',
  'dispatchE2eAutofill',
  'dispatchGateRot',
  'dispatchRelayCapacity',
  // B 档 7 条(auditMergeAdditionLoss / dispatchGuardMail / ensureGuardDaemonAlive / ensureS4u /
  // refreshRecoverySource / reportBaselineFreshness / rotateRunLogs)按票面不搬,不进本清单;
  // healRefs 只在 tick 面(T2 要求双在),也不进。理由逐条钉在 git-guardian.mjs:13576 挂点旁。
]

const src = readFileSync(GUARDIAN_SRC, 'utf8')

// 切片/非注释判据已上移 import 门体 __test__(§0.6/§22c),本文件零副本。
test('T0 判据单源:切片/非注释判据 import 门体 __test__,本文件零副本(§0.6/§22c)', () => {
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  assert.equal(typeof P.tickBodyOf, 'function')
  assert.equal(typeof P.mainBodyOf, 'function')
  assert.equal(typeof P.hasLiveCall, 'function')
  assert.equal(typeof P.liveCallOffset, 'function')
  assert.ok(
    !/function\s+(tickBodyOf|mainBodyOf|hasLiveCall|liveCallOffset)\s*\(/.test(self),
    '不得自带切片/判据副本 ⇒ 第二份必然漂移(§0.6)',
  )
  assert.deepEqual(
    [tickBodyOf, mainBodyOf, hasLiveCall, liveCallOffset],
    [P.tickBodyOf, P.mainBodyOf, P.hasLiveCall, P.liveCallOffset],
    '本文件用的必须是门体同一把尺',
  )
})

test('T1 装车锁:daemon tick 链必须有 96 个非注释派发,缺哪个就点哪个名', () => {
  const body = tickBodyOf(src)
  assert.notEqual(body, '', '判不出 tick 体(startDaemon/const tick 形态变了)⇒ 不得默认已接线')
  const missing = TICK_REQUIRED.filter((name) => !hasLiveCall(body, name))
  assert.deepEqual(
    missing,
    [],
    `daemon 常驻链缺少这些派发: ${missing.join(', ')} —— 计划任务档禁用后 daemon 是唯一执行体,缺一行该面就永久不跑`,
  )
})

test('T2 回填锁:main() 单轮链里原有 96 个派发仍在(不得因人工归并回灌被删)', () => {
  const main = mainBodyOf(src)
  assert.notEqual(main, '', '判不出 main 体 ⇒ 本锁失效,按判红处理')
  const missing = TICK_REQUIRED.filter((name) => !hasLiveCall(main, name))
  assert.deepEqual(missing, [], `main() 单轮链丢失了原有派发: ${missing.join(', ')}`)
})

test('T3 顺序锁:daemon 链内 publicProbe → tunnelLeg → sms → autonomyLeg 与 main() 同序', () => {
  const body = tickBodyOf(src)
  const order = ['auditPublicPathProbe', ...TICK_REQUIRED.slice(0, 3)].map((name) => liveCallOffset(body, name))
  assert.ok(
    order.every((o) => o >= 0),
    `顺序判据的前置调用缺失: ${['auditPublicPathProbe', ...TICK_REQUIRED.slice(0, 3)].filter((n) => liveCallOffset(body, n) < 0).join(', ')}`,
  )
  for (let k = 1; k < order.length; k++) {
    assert.ok(order[k] > order[k - 1], '三面插入位置必须紧跟 publicPathProbe 之后,与 main() 的相对顺序一致')
  }
})

test('T4 靠后锁:auditTunnelMetrics 必须落在链尾段,不得插到最前', () => {
  const body = tickBodyOf(src)
  const metrics = liveCallOffset(body, 'auditTunnelMetrics')
  assert.ok(metrics >= 0, 'daemon tick 链里找不到 auditTunnelMetrics() 派发')
  // 与 main() 里的链尾相对位置一致:必须晚于链中段的 opsPatrol 与 tail 前的 devenvMigratePatrol。
  for (const anchor of ['auditOpsPatrol', 'devenvMigratePatrol']) {
    const at = liveCallOffset(body, anchor)
    assert.ok(at >= 0, `靠后判据的锚点缺失: ${anchor}() 不在 tick 链上`)
    assert.ok(metrics > at, `auditTunnelMetrics() 早于 ${anchor}() ⇒ 被插到链前段,与 main() 的链尾位置不一致`)
  }
})

test('T5 反证:只挂 main() 的形态必须判未接线(本次事故的原始形态)', () => {
  const onlyMain = [
    'async function main() {',
    ...TICK_REQUIRED.map((n) => `  if (!CHECK_ONLY) ${n}()`),
    '}',
    'function startDaemon() {',
    '  const tick = () => {',
    '    neutralAnchorOnlyInTick()', // 锚点不得是 TICK_REQUIRED 里的名字,否则反证被自家清单命中 ⇒ 恒真
    '  }',
    '}',
  ].join('\n')
  assert.notEqual(tickBodyOf(onlyMain), '', '反证夹具本身判不出 tick 体')
  assert.deepEqual(
    TICK_REQUIRED.filter((n) => !hasLiveCall(tickBodyOf(onlyMain), n)),
    TICK_REQUIRED,
    '只挂 main() 的形态被读成已接线 ⇒ 这道锁恒真,等于没锁',
  )
})

test('T6 反证:注释行出现调用名不算接线', () => {
  const commented = [
    'function startDaemon() {',
    '  const tick = () => {',
    ...TICK_REQUIRED.map((n) => `    // ${n}()`),
    '  }',
    '}',
  ].join('\n')
  for (const name of TICK_REQUIRED) assert.equal(hasLiveCall(tickBodyOf(commented), name), false)
})

test('T7 区段自证:两段切片非空且互不串味,防止"切错段⇒恒真"', () => {
  const body = tickBodyOf(src)
  const main = mainBodyOf(src)
  assert.ok(hasLiveCall(body, 'dispatchAutoEvolve'), 'tick 切片丢了链尾派发 ⇒ 切片边界不对')
  assert.ok(hasLiveCall(body, 'healWorktreeTracked'), 'tick 切片丢了链首派发 ⇒ 切片边界不对')
  assert.ok(hasLiveCall(main, 'auditDeployStall'), 'main 切片丢了自身派发 ⇒ 切片边界不对')
  // daemon 专属留痕(只出现在 tick 体内;main 与 daemon 都会派发 dispatchAutoEvolve,不能用它区分)
  assert.ok(body.includes('daemon:提交窗口期'), 'tick 切片丢了提交窗口判据 ⇒ 切片边界不对')
  assert.equal(main.includes('daemon:提交窗口期'), false, 'main 段读到了 daemon 段 ⇒ 两段串味,按区段断言已失效')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
