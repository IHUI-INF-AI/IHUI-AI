// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 号池「一条命令跑完全部可自动项」编排腿(2026-11-05 立)。
 *
 * 每个号依次:① 每日签到 → ② 读成长任务列表 → ③ `completed` 项全部领奖 →
 * ④ 报公众号关注项与账面 completed/total,末行打机读汇总。
 * 判据零复算:签到档、可领集、关注关系全部 import 现有出口
 * (`workbuddy-growth-{experts,claim,daily,oauth}.mjs`),本层只编排不重判(§0.6)。
 *
 * 行为类任务(需驱动桌面客户端)不在射程:只在汇总点名「需 workbuddy-growth-experts.mjs --do-all」,
 * 本命令不启动、不连接任何客户端。
 *
 * 用法:
 *   node scripts/workbuddy-growth-sweep.mjs              # 全跑(签到+领奖是真写端点)
 *   node scripts/workbuddy-growth-sweep.mjs --json       # 单个 JSON 对象到 stdout(守护进程消费)
 *   node scripts/workbuddy-growth-sweep.mjs --dry-run    # 只报将要做什么,零网络零写
 *
 * 退出码:0 没有失败 / 1 有失败(签到 failed 或领奖未到账) / 2 未判定(号池·凭据·列表读不到)。
 */
import {
  fetchGrowthTasks,
  listPoolAccounts,
  readPoolCredential,
  selectExpertTasks,
} from './workbuddy-growth-experts.mjs'
import { selectClaimable } from './workbuddy-growth-claim.mjs'
import { checkinOnce, readProfile } from './workbuddy-growth-daily.mjs'
import {
  claimTask,
  describeSubscribe,
  fetchSubscribeTaskStatus,
  subscribeVerdictOf,
} from './workbuddy-growth-oauth.mjs'
import { isDirectRun } from './lib/direct-run.mjs'

const CHECKIN_STATES = ['checked', 'already', 'failed']

/** 解析命令行(纯函数):--json / --dry-run / --help */
export function parseArgs(argv) {
  const opts = { json: false, dryRun: false, help: false }
  for (const a of Array.isArray(argv) ? argv : []) {
    if (a === '--json') opts.json = true
    else if (a === '--dry-run') opts.dryRun = true
    else if (a === '--help' || a === '-h') opts.help = true
  }
  return opts
}

/**
 * 单号本轮的决策引擎(纯函数,离线可测)。
 * 任一输入缺失/读不懂 ⇒ 该维落未判定并带原因,绝不冒充「没得领/没关注」(§0.3)。
 */
export function planSweepRound(input = {}) {
  const src = input && typeof input === 'object' ? input : {}
  const { checkin, tasks, subscribe, profile } = src
  const tasksOk = Boolean(tasks && tasks.ok === true && Array.isArray(tasks.tasks))
  return {
    checkinState:
      checkin && CHECKIN_STATES.includes(checkin.state) ? checkin.state : 'undetermined',
    tasksState: tasksOk ? 'ok' : 'undetermined',
    tasksReason: tasksOk ? '' : String(tasks?.reason ?? '读不到任务列表(未判定)'),
    claimable: tasksOk ? selectClaimable(tasks.tasks) : null,
    needsClient: tasksOk
      ? selectExpertTasks(tasks.tasks)
          .rows.filter((r) => r.done !== true)
          .map((r) => r.task_code)
      : null,
    subscribeVerdict: subscribeVerdictOf(subscribe),
    subscribeText: describeSubscribe(subscribe),
    profileOk: Boolean(profile && profile.ok === true),
    profileRead:
      profile && profile.ok === true
        ? { completed: profile.completed, total: profile.total, level: profile.level ?? null }
        : null,
  }
}

/** 汇总分桶(纯函数):签到四档、领奖成败、关注四档、账面、号级异常各自独立,永不并桶 */
export function aggregateSweep(rows) {
  const sum = {
    accounts: 0,
    checked: 0,
    already: 0,
    checkinFailed: 0,
    checkinUndetermined: 0,
    claimOk: 0,
    claimFail: 0,
    tasksUndetermined: 0,
    follow: { undetermined: 0, not_followed: 0, counting: 0, followed: 0 },
    profileRead: 0,
    profileUndetermined: 0,
    needsClient: 0,
    accountErrors: 0,
  }
  for (const r of Array.isArray(rows) ? rows : []) {
    sum.accounts += 1
    const p = r?.plan
    if (!p) {
      sum.accountErrors += 1
      sum.checkinUndetermined += 1
      sum.tasksUndetermined += 1
      sum.follow.undetermined += 1
      sum.profileUndetermined += 1
      continue
    }
    if (p.checkinState === 'checked') sum.checked += 1
    else if (p.checkinState === 'already') sum.already += 1
    else if (p.checkinState === 'failed') sum.checkinFailed += 1
    else sum.checkinUndetermined += 1
    if (p.tasksState !== 'ok') sum.tasksUndetermined += 1
    for (const c of Array.isArray(r.claims) ? r.claims : []) {
      if (c && c.ok === true) sum.claimOk += 1
      else sum.claimFail += 1
    }
    if (Object.hasOwn(sum.follow, p.subscribeVerdict)) sum.follow[p.subscribeVerdict] += 1
    else sum.follow.undetermined += 1
    if (p.profileOk) sum.profileRead += 1
    else sum.profileUndetermined += 1
    sum.needsClient += Array.isArray(p.needsClient) ? p.needsClient.length : 0
  }
  return sum
}

/** 守护进程消费的 JSON 档:白名单取键,凭据形态(令牌/手机号)结构上进不来 */
export function buildJsonReport(rows, summary, opts = {}) {
  return {
    mode: 'workbuddy-growth-sweep',
    dryRun: Boolean(opts.dryRun),
    accounts: (Array.isArray(rows) ? rows : []).map((r) => ({
      uid: String(r?.tag ?? ''),
      state: r?.state ?? 'undetermined',
      reason: String(r?.reason ?? ''),
      checkin: r?.plan?.checkinState ?? 'undetermined',
      tasks: r?.plan?.tasksState ?? 'undetermined',
      claimable: (r?.plan?.claimable ?? []).map((t) => t.task_code),
      claims: (Array.isArray(r?.claims) ? r.claims : []).map((c) => ({
        task_code: String(c?.task_code ?? ''),
        ok: c?.ok === true,
      })),
      subscribe: {
        verdict: r?.plan?.subscribeVerdict ?? 'undetermined',
        text: String(r?.plan?.subscribeText ?? ''),
      },
      profile: r?.plan?.profileRead ?? null,
      needsClient: r?.plan?.needsClient ?? [],
    })),
    summary,
  }
}

/** 单号跑一轮:任何异常只影响本号(落未判定),不影响其他号继续 */
async function sweepOne(acc) {
  const uid = String(acc?.uid ?? '')
  const tag = uid.slice(0, 8)
  try {
    const cred = readPoolCredential(uid)
    if (!cred) return { tag, state: 'undetermined', reason: '取不到凭据(未判定)' }
    const checkin = await checkinOnce(cred)
    const tasks = await fetchGrowthTasks(cred)
    const subscribe = await fetchSubscribeTaskStatus(cred)
    const profile = await readProfile(cred)
    const plan = planSweepRound({ checkin, tasks, subscribe, profile })
    const claims = []
    for (const t of plan.claimable ?? []) {
      const c = await claimTask(cred, t.task_code)
      claims.push({ task_code: t.task_code, ok: c.ok === true, status: c.status, msg: c.msg })
    }
    return { tag, state: 'ok', plan, claims, checkin }
  } catch (e) {
    return {
      tag,
      state: 'undetermined',
      reason: `本轮异常:${e instanceof Error ? e.message : String(e)}`,
    }
  }
}

const HELP = `用法:
  node scripts/workbuddy-growth-sweep.mjs
      号池每个号:签到 → 读任务列表 → 领掉全部 completed → 报关注项与账面,末行机读汇总

  node scripts/workbuddy-growth-sweep.mjs --json
      同样内容输出单个 JSON 对象(脱敏:只有 uid 前 8 位,无令牌/手机号)

  node scripts/workbuddy-growth-sweep.mjs --dry-run
      只报每个号将要做什么;零网络、零写端点

边界:行为类任务不在射程(需 workbuddy-growth-experts.mjs --do-all,本命令不启动客户端);
读不到一律落未判定并点名原因,不拿 0 冒充「没完成」,不把「读不到」说成「没关注」。
退出码:0 没有失败 / 1 有失败 / 2 未判定。
`

const CHECKIN_LABEL = {
  checked: '签到成功',
  already: '今日已签(幂等,不算失败)',
  failed: '签到失败',
  undetermined: '签到未判定',
}

function printHumanRow(r) {
  const t = `[${r.tag}]`
  if (!r.plan) {
    console.log(`${t} 本轮未判定:${r.reason}`)
    return
  }
  const p = r.plan
  const detail =
    p.checkinState === 'failed' || p.checkinState === 'undetermined'
      ? ` (code=${r.checkin?.code ?? '-'} msg=${r.checkin?.msg ?? ''} http=${r.checkin?.http ?? '-'})`
      : ''
  console.log(`${t} ${CHECKIN_LABEL[p.checkinState]}${detail}`)
  console.log(
    `${t} 任务列表=${p.tasksState}${p.claimable ? ` 可领 ${p.claimable.length} 项` : ''}${p.claimable === null ? ` —— ${p.tasksReason}` : ''}`,
  )
  for (const c of r.claims ?? []) {
    console.log(
      c.ok
        ? `${t}   ✅ ${c.task_code} 已到账 (http=${c.status})`
        : `${t}   ❌ ${c.task_code} 未到账:http=${c.status} msg=${c.msg}`,
    )
  }
  console.log(`${t} 关注项:${p.subscribeText} (verdict=${p.subscribeVerdict})`)
  console.log(
    `${t} 账面:${p.profileRead ? `${p.profileRead.completed}/${p.profileRead.total} 完成,等级=${p.profileRead.level ?? '?'}` : '未判定(读不到)'}`,
  )
  if (Array.isArray(p.needsClient) && p.needsClient.length) {
    console.log(
      `${t} 行为类待做 ${p.needsClient.length} 项:${p.needsClient.join(', ')} —— 该项需 workbuddy-growth-experts.mjs --do-all(本命令不启动客户端)`,
    )
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log(HELP)
    return 0
  }
  if (opts.dryRun) {
    const accounts = listPoolAccounts()
    if (!accounts.length) {
      console.error('号池里没有可用账号副本(未判定)')
      return 2
    }
    const tags = accounts.map((acc) => String(acc.uid ?? '').slice(0, 8))
    const will = '取凭据 → 每日签到 → 读成长任务列表 → 领掉全部 completed → 查公众号关注项 → 读账面'
    if (opts.json) {
      console.log(
        JSON.stringify({
          mode: 'workbuddy-growth-sweep',
          dryRun: true,
          endpointsCalled: 0,
          accounts: tags.map((uid) => ({ uid, will })),
        }),
      )
      return 0
    }
    for (const tag of tags) {
      console.log(`[${tag}] 将依次:${will};本档零网络零写,未调用任何端点`)
    }
    console.log(
      `SWEEP-SUMMARY ${JSON.stringify({ mode: 'dry-run', accounts: tags.length, endpointsCalled: 0 })}`,
    )
    return 0
  }
  const accounts = listPoolAccounts()
  if (!accounts.length) {
    if (opts.json) {
      console.log(
        JSON.stringify({
          ...buildJsonReport([], aggregateSweep([]), opts),
          note: '号池取不到(未判定)',
        }),
      )
    } else console.error('号池里没有可用账号副本(未判定)')
    return 2
  }
  const rows = []
  for (const acc of accounts) rows.push(await sweepOne(acc))
  const summary = aggregateSweep(rows)
  if (opts.json) {
    console.log(JSON.stringify(buildJsonReport(rows, summary, opts)))
  } else {
    for (const r of rows) printHumanRow(r)
    console.log(`\nSWEEP-SUMMARY ${JSON.stringify({ ...summary, total: accounts.length })}`)
  }
  const progressed = summary.checked + summary.already + summary.claimOk + summary.profileRead
  if (summary.checkinFailed || summary.claimFail) return 1
  if (
    !progressed &&
    (summary.accountErrors ||
      summary.checkinUndetermined ||
      summary.tasksUndetermined ||
      summary.follow.undetermined ||
      summary.profileUndetermined)
  )
    return 2
  return 0
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  process.exitCode = await main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
