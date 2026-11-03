// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 结构锁:daemon 常驻 tick 链必须覆盖 29 个"曾只挂 main() 单轮链"的审计面(2026-11-03 立,同日先补 2 面、晚间再补 12 面)。
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

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const GUARDIAN_SRC = path.join(ROOT, 'scripts', 'git-guardian.mjs')

/** 这 29 面原先只挂 main() 单轮链;计划任务档禁用后 daemon 是唯一执行体 ⇒ 必须同挂 tick。 */
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
    if (!t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*') && t.includes(`${name}(`)) {
      return off
    }
    off += raw.length + 1
  }
  return -1
}

test('T1 装车锁:daemon tick 链必须有 29 个非注释派发,缺哪个就点哪个名', () => {
  const body = tickBodyOf(src)
  assert.notEqual(body, '', '判不出 tick 体(startDaemon/const tick 形态变了)⇒ 不得默认已接线')
  const missing = TICK_REQUIRED.filter((name) => !hasLiveCall(body, name))
  assert.deepEqual(
    missing,
    [],
    `daemon 常驻链缺少这些派发: ${missing.join(', ')} —— 计划任务档禁用后 daemon 是唯一执行体,缺一行该面就永久不跑`,
  )
})

test('T2 回填锁:main() 单轮链里原有 29 个派发仍在(不得因人工归并回灌被删)', () => {
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
    '    auditOpsPatrol()',
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
