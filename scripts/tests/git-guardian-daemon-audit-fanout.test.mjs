// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 结构锁:daemon 常驻 tick 链必须逐枚覆盖 TICK_REQUIRED 的全部审计面(2026-11-03 立,
 * 2026-11-04 补承载面,2026-11-05 票 RP-74 把清单从 30 面扩到现读 99 面 —— 枚数由 T10
 * 与 tick 派发现算对账,本清单不再靠人记数)。
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
 * 按**区段切片**断言:绝不用 `assert.match(整个文件)` —— 全文件匹配会被 main() 那几行命中,
 * 于是恒真,等于没锁。
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
// T10 的"什么算一次派发"一律 import 族三那份解析器(§0.6/§22c:本文件不复写第二份判据)
import { __test__ as parityGate } from '../check-sweeper-liveness.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const GUARDIAN_SRC = path.join(ROOT, 'scripts', 'git-guardian.mjs')

/** 下列 99 面(RP-74 分四批搬齐,枚数由 T10 现算对账)原先只挂 main() 单轮链;
 *  计划任务档禁用后 daemon 是唯一执行体 ⇒ 必须同挂 tick,并逐枚进本清单。 */
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
  // ── RP-74 批 A(8 面)· 分组键「该面读数谁在消费」= 自进化腿在位尺 ───────────────
  // 这 8 面的读数落 `.ihui-agent/state/<腿>-dispatch-last.json`,消费者现读为
  // `scripts/check-autonomy-leg-health.mjs`(A8 腿在位 / A9 双链对等)+ 台账
  // `scripts/data/autonomy-leg-liveness.json`;dispatchAutoEvolve 另写 cost-caps.json,
  // 由 `scripts/auto-evolve.mjs` 与 `scripts/cost-breaker.mjs` 现读(预算熔断吃的是那枚 json)。
  // ⇒ 读数是"另一把判机器状态的尺"的输入:它们一停,A8/A9 立刻报 dark,所以整批必须常驻。
  'dispatchGateRot',
  'dispatchRelayCapacity',
  'dispatchAutoTriage',
  'dispatchDepAdvisoryRadar',
  'dispatchAutoEvolve',
  'dispatchDeployOutcomeIntake',
  'dispatchDeployFeedback',
  'dispatchE2eAutofill',
  // ── RP-74 批 B(22 面)· 分组键 = 跨端汇总面(驾驶舱)与同族装车顺序锁 ────────────
  // 这 22 面写的 *-land-last.json / cross-end-*-last.json / rn-*-last.json,消费者现读为
  // `scripts/parity-auto.mjs`(驾驶舱,由 sweepParityCockpit 派生)、
  // `scripts/gen-rn-host-shell.mjs`(读 rn-host-shell-last.json),以及既有同族镜像测试的
  // 装车顺序锁 `scripts/tests/cross-end-landing-dispatch.test.mjs` T9(源头先补→再收编→最后汇总面)。
  // ⇒ 下游那几条腿的判据要问的就是"上一腿在不在",断一环同源门就每天新长一笔分叉。
  'auditCrossEndParityDrift',
  'auditI18nCrossEndWording',
  'auditWebRnParity',
  'healCrossEndMirror',
  'healI18nBundleLeg',
  'healStaleDistLeg',
  'healStaleMiniappDist',
  'healStyleTokensLeg',
  'healUiRoutesLeg',
  'convergeCrossEndPortalVerdicts',
  'autoRegisterRnTokenPairs',
  'sweepRnHostShells',
  'sweepCrossEndShellPages',
  'sweepWebStyleTiers',
  'sweepRnStyleTiers',
  'sweepMiniappStyleTiers',
  'sweepCssTokensSourceLeg',
  'sweepUiMirrorLeg',
  'sweepRnColorLiteralLeg',
  'sweepRnCompatLeg',
  'sweepCrossEndLandingLeg',
  'sweepParityCockpit',
  // ── RP-74 批 C(16 面)· 分组键 = 留痕台账被下一道门/器物本体 import ─────────────
  // 这 16 面写的是**别的判据要吃的台账**:sweepStaleClosedRows / sweepStaleClaimMarks 的
  // tick+ledger 是 `scripts/check-sweeper-liveness.mjs` 族一族二的输入;
  // sweepBannedBuckets / sweepHeadRecallRows 的 SWEEP-RESULT 由 strip-* 器物与门 268 现读;
  // sweepLocalDevDbRotation ⇒ `check-dev-db-rotation-window.mjs` + `rotate-local-dev-db-password.mjs`;
  // sweepExposedCredentialRotation ⇒ `rotate-exposed-upstream-credentials.mjs`;
  // sweepDownloadsLiveHealth ⇒ `check-downloads-live-health.mjs`;
  // sweepDanglingCommitAutotag 吃守门 30a 的 --list-unbacked,tag 面由 `sync-lost-commit-tags.mjs` 对账。
  // ⇒ 消费方读到旧台账就会把"没干"说成"干过"(§0.9 的反面)。
  'sweepStaleClosedRows',
  'sweepStaleClaimMarks',
  'sweepBannedBuckets',
  'sweepHeadRecallRows',
  'sweepLessonApply',
  'sweepDanglingCommitAutotag',
  'sweepLocalDevDbRotation',
  'sweepExposedCredentialRotation',
  'sweepKeepAliveForever',
  'sweepPoolIsolation',
  'sweepDownloadsLiveHealth',
  'sweepIosIpaRelay',
  'sweepGitProbeHeadroom',
  'archiveGcDryRun',
  'scrubTempFixtures',
  'reapWorktrees',
  // ── RP-74 批 D(23 面)· 分组键 = 元运维巡检 P1-P6 与到人邮箱面(看守者本身)─────
  // 这一批的读数消费者现读为 `scripts/check-ops-patrol.mjs`(P1-P6 吃 ops-patrol-last.json /
  // mail-probe-last.json / git-guardian-notify-state.json / *-sync-task-last.json /
  // undelivered-debt-settlements.json)、`scripts/check-public-path-probe.mjs`、
  // `data/service-inventory.json` 快照、`scripts/feedback-loop-status.mjs` 六段闭环;
  // healWorktreeTracked / healRootSeal / healHomeJunctions 的产物面由 `re-home-junctions.mjs`
  // 与门 96/213 对账;auditGuardianCodeFreshness 吃"进程启动时刻 vs 源码 mtime"。
  // ⇒ 谁在消费=「看守者本身」:它哑了,账面没有任何一格会红(§附 元运维巡检轮同一条教训)。
  'auditPublicPathProbe',
  'auditEgressIpDrift',
  'auditEnvDrift',
  'auditProdForeignWork',
  'auditServiceInventory',
  'auditOpsPatrol',
  'auditLintStagedPins',
  'auditMergeAdditionLoss',
  'auditLandedReverts',
  'auditPushChannel',
  'auditRootGuardManifestSync',
  'auditVerbatimResurrection',
  'auditGuardianCodeFreshness',
  'checkConvergeAlignStall',
  'healWorktreeTracked',
  'healRootSeal',
  'healHomeJunctions',
  'healUnresponsiveServices',
  'gcSessionTranscripts',
  'refreshRecoverySource',
  'rotateRunLogs',
  'reportBaselineFreshness',
  'auditFeedbackLoopClosure',
  // 【刻意不进清单的 B 档(票 RP-74 口径:单轮 ≥5 分钟 / 真换口令 / 重启服务那族)】
  // ensureGuardDaemonAlive —— 执行体就是 daemon 自己,挂进常驻 tick 属自指(函数内有挡板);
  // ensureS4u —— 改计划任务登录身份(InteractiveToken→S4U)= 真换账户那一档,非幂等抖动不可承受;
  // 两枚的理由都钉在 git-guardian.mjs main 链挂点旁的 `dispatch-parity-exempt:` 标记行上,
  // 由 scripts/check-sweeper-liveness.mjs 的 dispatch-parity 族现解析(本文件不另立豁免清单)。
  // healRefs —— 只在"核心不健康"分支里被 remediate 调用,main 面上没有独立派发行(进清单必假红)。
]

const src = readFileSync(GUARDIAN_SRC, 'utf8')

/**
 * 取 startDaemon 里 `const tick = () => {` 之后的正文(判不出 ⇒ 空串,由断言判红)。
 * 边界按**缩进**收口:配平花括号会被模板字符串/注释里的 `{` 带偏;遇到列 0 的非空行即视为
 * startDaemon 结束。失效方向是"提前收口 ⇒ 判不出 ⇒ 判红",绝不会把 main() 的调用读成 tick 接线。
 */
function tickBodyOf(source) {
  const i = source.indexOf('function startDaemon')
  if (i < 0) return ''
  const j = source.indexOf('const tick = () => {', i)
  if (j < 0) return ''
  const lines = source.slice(j).split(/\r?\n/)
  const out = []
  for (let k = 1; k < lines.length; k++) {
    const l = lines[k]
    if (l.trim() !== '' && !/^\s/.test(l)) break
    out.push(l)
  }
  return out.join('\n')
}

/** 取 main() 正文:从 `async function main()` 到 `function startDaemon`(两段天然相邻)。 */
function mainBodyOf(source) {
  const i = source.indexOf('async function main()')
  if (i < 0) return ''
  const j = source.indexOf('function startDaemon', i)
  if (j < 0) return ''
  return source.slice(i, j)
}

/** 只看非注释行:注释里出现调用名不算接线。 */
function hasLiveCall(body, name) {
  return liveCallOffset(body, name) >= 0
}

/** 非注释行中首次出现 `${name}(` 的字符偏移;找不到 ⇒ -1。 */
function liveCallOffset(body, name) {
  const lines = String(body).split(/\r?\n/)
  let off = 0
  for (const raw of lines) {
    const t = raw.trim()
    if (
      !t.startsWith('//') &&
      !t.startsWith('*') &&
      !t.startsWith('/*') &&
      t.includes(`${name}(`)
    ) {
      return off
    }
    off += raw.length + 1
  }
  return -1
}

test('T1 装车锁:daemon tick 链必须逐枚有本清单全部非注释派发,缺哪个就点哪个名', () => {
  const body = tickBodyOf(src)
  assert.notEqual(body, '', '判不出 tick 体(startDaemon/const tick 形态变了)⇒ 不得默认已接线')
  const missing = TICK_REQUIRED.filter((name) => !hasLiveCall(body, name))
  assert.deepEqual(
    missing,
    [],
    `daemon 常驻链缺少这些派发: ${missing.join(', ')} —— 计划任务档禁用后 daemon 是唯一执行体,缺一行该面就永久不跑`,
  )
})

test('T2 回填锁:main() 单轮链里原有派发仍在(不得因人工归并回灌被删)', () => {
  const main = mainBodyOf(src)
  assert.notEqual(main, '', '判不出 main 体 ⇒ 本锁失效,按判红处理')
  const missing = TICK_REQUIRED.filter((name) => !hasLiveCall(main, name))
  assert.deepEqual(missing, [], `main() 单轮链丢失了原有派发: ${missing.join(', ')}`)
})

test('T3 顺序锁:daemon 链内 publicProbe → tunnelLeg → sms → autonomyLeg 与 main() 同序', () => {
  const body = tickBodyOf(src)
  const order = ['auditPublicPathProbe', ...TICK_REQUIRED.slice(0, 3)].map((name) =>
    liveCallOffset(body, name),
  )
  assert.ok(
    order.every((o) => o >= 0),
    `顺序判据的前置调用缺失: ${['auditPublicPathProbe', ...TICK_REQUIRED.slice(0, 3)].filter((n) => liveCallOffset(body, n) < 0).join(', ')}`,
  )
  for (let k = 1; k < order.length; k++) {
    assert.ok(
      order[k] > order[k - 1],
      '三面插入位置必须紧跟 publicPathProbe 之后,与 main() 的相对顺序一致',
    )
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
    assert.ok(
      metrics > at,
      `auditTunnelMetrics() 早于 ${anchor}() ⇒ 被插到链前段,与 main() 的链尾位置不一致`,
    )
  }
})

test('T5 反证:只挂 main() 的形态必须判未接线(本次事故的原始形态)', () => {
  // tick 体里的填充调用必须**不在**清单上(2026-11-05 RP-74 踩过:原先用 auditOpsPatrol,
  // 它进了批 D 清单之后,这条反证就把那一枚读成"已接线"而恒假 ⇒ 换成永不入清单的哨兵名)
  const FILLER = 'daemonTickFillerNotInRoster'
  assert.equal(TICK_REQUIRED.includes(FILLER), false, `哨兵名 ${FILLER} 不该出现在清单里`)
  const onlyMain = [
    'async function main() {',
    ...TICK_REQUIRED.map((n) => `  if (!CHECK_ONLY) ${n}()`),
    '}',
    'function startDaemon() {',
    '  const tick = () => {',
    `    ${FILLER}()`,
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
  assert.equal(
    main.includes('daemon:提交窗口期'),
    false,
    'main 段读到了 daemon 段 ⇒ 两段串味,按区段断言已失效',
  )
})

// RP-65(2026-11-05):判据面护栏巡检报 breach 时必须**逐枚**带判别码。
// 立因:旧行只印第一枚的 sha+标题且不带 code/signatureCode/密钥来源,于是"静默改动 2 枚"
// 这种指控一旦事后复跑变绿(同批 `--range` 重跑三枚全 sig-verified),没有任何一面留下
// "当时判的是哪一格"的证据 ⇒ 不可复现的指控无法定位,只能逼人再猜或跳门(§12e 同型)。
test('T8 breach 行逐枚带判别码(且旧"只点第一枚"形态不得回潮)', () => {
  const i = src.indexOf("if (parsed.state === 'breach')")
  assert.ok(i > 0, 'breach 分支必须存在(巡检出口被人摘掉 ⇒ 本锁该红)')
  const block = src.slice(i, i + 3000)
  assert.ok(block.includes('describeBreach'), '必须有逐枚描述器,不得只印第一枚')
  for (const key of ['b.code', 'b.signatureCode', 'b.keySource', 'b.expired', 'b.ackedBy'])
    assert.ok(block.includes(key), `逐枚描述必须带 ${key}`)
  assert.ok(block.includes('.map(describeBreach).join'), '❌ 行必须逐枚拼接')
  assert.equal(
    block.includes('枚 —— ${first.sha ??'),
    false,
    '旧形态"只点第一枚的 sha"不得回潮(它就是无法事后定位的那一型)',
  )
  const dedupExpr = (block.match(/dedupKey:\s*([^\n]*)/) || [])[1] || ''
  assert.equal(
    /breaches|breachCount|\.sha|signatureCode|describeBreach|perBreach/.test(dedupExpr),
    false,
    `去重身份里出现了会逐枚抖动的明细(现读:${dedupExpr.slice(0, 90) || '(本档无 dedupKey)'})` +
      '⇒ 正文/日志可带 sha 与判别码,身份不可(守门 224 同族:身份抖动=同日多封的真根因)',
  )
})

/**
 * T9 变异自证(票 RP-74 对"每批都要带自证"的回答):逐枚把 tick 链上那一行派发摘成注释,
 * 本清单必须**恰好**点到这一枚的名。摘了还全绿 ⇒ 这道锁是瞎的(恒真),当场判这条自证无效。
 * 变异只发生在内存里的字符串副本,绝不回写 git-guardian.mjs(本机是生产机,且这是最热文件)。
 */
test('T9 变异自证:逐枚摘掉 tick 链的一行派发 ⇒ 清单必须恰好点到这一枚', () => {
  const body = tickBodyOf(src)
  assert.notEqual(body, '', '判不出 tick 体 ⇒ 自证无从谈起')
  let proven = 0
  for (const name of TICK_REQUIRED) {
    const callLine = new RegExp(`^[ \\t]*${name}\\(`)
    assert.ok(
      body.split(/\r?\n/).some((l) => callLine.test(l) && !l.trim().startsWith('//')),
      `${name}:tick 体里找不到可摘的调用行 ⇒ 本枚根本锁不住(清单是抄来的?)`,
    )
    const mutated = body
      .split(/\r?\n/)
      .map((l) =>
        callLine.test(l) && !l.trim().startsWith('//') ? `  // 变异摘除:${l.trim()}` : l,
      )
      .join('\n')
    assert.notEqual(mutated, body, `${name}:摘除没改动文本 ⇒ 夹具失效`)
    const named = TICK_REQUIRED.filter((n) => !hasLiveCall(mutated, n))
    assert.deepEqual(
      named,
      [name],
      `摘掉 ${name} 的派发后,清单点到的不是它一个(实点:${named.join(',') || '一个也没点'} ⇒ 后者意味着这道锁恒真)`,
    )
    proven++
  }
  assert.equal(proven, TICK_REQUIRED.length, '自证枚数≠清单枚数 ⇒ 中途被 break')
})

/**
 * T10 棘轮锁(防"搬了却不进清单"再次发生):凡两条链**都**挂着的腿,必须逐枚在本清单里。
 * 判据一律 import 族三那份解析器(`check-sweeper-liveness.mjs` 的 facesOf/dispatchFaceOf),
 * 本文件不复写第二份"什么算一次派发"(§0.6/§22c)—— 两边各解析一遍,迟早漂。
 */
test('T10 棘轮锁:双挂腿一枚都不许落在清单外(解析器 import 自族三,零复写)', () => {
  const faces = parityGate.facesOf(src)
  assert.ok(faces, '族三解析器判不出两条链 ⇒ 本棘轮不得默认通过')
  const mainLegs = [...parityGate.dispatchFaceOf(faces.main).keys()]
  const tickLegs = [...parityGate.dispatchFaceOf(faces.tick).keys()]
  assert.ok(
    mainLegs.length > 50 && tickLegs.length > 50,
    `两面读数塌了:main=${mainLegs.length} tick=${tickLegs.length}`,
  )
  const both = [...new Set(mainLegs.filter((n) => tickLegs.includes(n)))]
  const missing = both.filter((n) => !TICK_REQUIRED.includes(n))
  assert.deepEqual(
    missing,
    [],
    `这些腿已双挂却没进清单(下一次人工归并就会静默删掉那一行,没人会红):${missing.join(', ')}`,
  )
  const ghost = TICK_REQUIRED.filter((n) => !tickLegs.includes(n))
  assert.deepEqual(
    ghost,
    [],
    `清单里有 tick 面现读没挂的腿(等于把 B 档塞进 tick):${ghost.join(', ')}`,
  )
  // 清单枚数必须 == 双挂腿枚数(两侧都不得有多余)
  assert.equal(
    TICK_REQUIRED.length,
    both.length,
    `清单 ${TICK_REQUIRED.length} 面 vs 双挂 ${both.length} 面 ⇒ 有一侧在长毛`,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
