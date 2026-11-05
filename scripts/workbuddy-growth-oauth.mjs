// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 成长任务「公众号关注」项的收口(2026-11-05 立)。
 *
 * ## 这一项为什么与其它项不同
 *
 * `wb_wechat_oa_subscribe_task`(关注「腾讯 WorkBuddy」官方公众号,奖励 100 积分 + 5 能量)
 * 的判定**在服务端**,判据字段服务端直接回给客户端(实测 2026-11-05):
 *
 *   `GET /v2/activity/growth/subscribe-task/status` ⇒
 *   `{"subscribe_task":{"task_code":"wb_wechat_oa_subscribe_task","subscribed":false,` +
 *   `"remaining_seconds":-1,"task_status":"accepted","advanced":false}}`
 *
 * ⇒ `subscribed` 是服务端读微信关注关系算出来的布尔,`remaining_seconds` 是 24 小时窗的余量。
 *   客户端**只能读它,不能写它**:把官方成长空间 bundle 里 `/activity/growth/*` 端点全枚举出来
 *   (accept / claim / redeem / lottery/draw / makeup-cards/use / buddy/* / heatmap/share / visible),
 *   **没有任何一条写 subscribe 状态**;官方取任务列表的函数 `to()` 本身就是「先 `qa()`(读这条状态)
 *   再取列表」——即客户端对这一项唯一能做的动作就是"问一次让服务端重算"。
 *   (旧版本文写的取证依据是「asar 里搜 0 命中」——那是**搜错了面**:成长计划页是端内 iframe
 *    远程加载的网页,不打包进 asar。已按上面的服务端直读结论更正。)
 *
 * ⇒ **关注动作本身只能由机主用微信完成**(微信账号维度的关注关系 + 满 24 小时的时间窗),
 *   程序侧无捷径,也**不应伪造关注**。
 *   但**关注之后到领奖这一段可以自动化**:服务端一旦判 `subscribed=true` 且窗口满,
 *   任务 `accept_status` 会翻成终态,本命令负责盯着它、到账即领。
 *
 * ## 本命令做什么
 *
 *   ① `--status` :只读报公众号项当前状态(每个号一行:关注关系/倒计时/状态/进度/是否已到账);
 *   ② `--watch`  :轮询直到服务端把这一项判成完成(或超时),到账即调 claim 领奖。
 *
 * ## 状态词口径(实测,别按字面猜)
 *
 *   `accepted` = 任务已接受、等行为(≠ 完成)
 *   `completed` = 行为完成、奖励**可领**
 *   `claimed`   = 奖励**已领取**(到账)
 *   ⇒ `accepted` 当成"已完成"会让引擎跳过真待办;`claimed` 当成"可领"会让引擎反复重领。
 *
 * ## 用法
 *
 *   node scripts/workbuddy-growth-oauth.mjs --status
 *   node scripts/workbuddy-growth-oauth.mjs --watch [--interval 300] [--timeout 90000]
 *
 * 退出码:0 已领到 / 1 未领到(仍未达标) / 2 未判定(环境·输入·读不到任务)。
 */
import {
  fetchGrowthTasks,
  listPoolAccounts,
  readPoolCredential,
} from './workbuddy-growth-experts.mjs'
import { isDirectRun } from './lib/direct-run.mjs'

/** 公众号关注项的任务码 */
export const OA_TASK_CODE = 'wb_wechat_oa_subscribe_task'

/** 领奖端点(任务码在 URL 路径里,body 无关) */
export function oaClaimUrl(code = OA_TASK_CODE) {
  return `https://www.workbuddy.cn/v2/activity/growth/tasks/${code}/claim`
}

/**
 * 订阅任务状态端点(官方 bundle 里的 `qa()`)。
 *
 * 这是官方客户端**取任务列表之前必调**的一次刷新:服务端借这一问重算关注关系。
 * 本命令每轮先打它再读列表,就是为了和官方同一个时序,不拿旧判定当现状。
 */
export const OA_SUBSCRIBE_STATUS_URL =
  'https://www.workbuddy.cn/v2/activity/growth/subscribe-task/status'

/** 组装鉴权头(本文件内两处 fetch 共用) */
function authHeaders(cred) {
  return {
    Authorization: `Bearer ${cred.accessToken}`,
    'Content-Type': 'application/json',
    'X-User-Id': cred.uid,
    'x-user-id': cred.uid,
    'X-Domain': cred.domain,
  }
}

/**
 * 解析订阅任务状态响应(纯函数,离线可测)。
 *
 * 三态不许并桶(§0.3):
 *   · `ok:true`  —— 服务端明确回了 `subscribed` 布尔;
 *   · `ok:false` —— HTTP 非 2xx / 非 JSON / 体里没有 `subscribed` 字段 ⇒ **未判定**,
 *     绝不回落成「没关注」(那会把"读不到"说成"事实")。
 *
 * @param {number} status HTTP 状态码
 * @param {string} text 响应体原文
 */
export function parseSubscribeStatus(status, text) {
  const httpOk = status >= 200 && status < 300
  let j = {}
  try {
    j = JSON.parse(text)
  } catch {
    return {
      ok: false,
      subscribed: null,
      remainingSeconds: null,
      taskStatus: '',
      reason: '响应非 JSON',
    }
  }
  const st = j?.data?.subscribe_task
  if (!st || typeof st.subscribed !== 'boolean') {
    return {
      ok: false,
      subscribed: null,
      remainingSeconds: null,
      taskStatus: '',
      reason: `响应里没有 subscribe_task.subscribed 布尔(http=${status} code=${j?.code ?? '-'})`,
    }
  }
  const rs = Number(st.remaining_seconds)
  return {
    ok: httpOk && j?.code === 0,
    subscribed: st.subscribed,
    remainingSeconds: Number.isFinite(rs) ? rs : null,
    taskStatus: String(st.task_status ?? ''),
    reason:
      httpOk && j?.code === 0
        ? ''
        : `http=${status} code=${j?.code ?? '-'} msg=${String(j?.msg ?? '').slice(0, 60)}`,
  }
}

/**
 * 关注关系落到哪一格(纯函数,离线可测;`--status` 与 `--watch` 共用同一个说法)。
 *
 * @param {object|null} sub parseSubscribeStatus 的返回
 * @returns {'undetermined'|'not_followed'|'counting'|'followed'}
 */
export function subscribeVerdictOf(sub) {
  if (!sub || sub.ok !== true || typeof sub.subscribed !== 'boolean') return 'undetermined'
  if (sub.subscribed === false) return 'not_followed'
  // 已关注但 24h 窗还没走完:remaining_seconds>0 才叫倒计时,-1 是"没有这个读数"
  if (Number.isFinite(sub.remainingSeconds) && sub.remainingSeconds > 0) return 'counting'
  return 'followed'
}

/** 一行的关注关系怎么对人讲(不编造:读不到就说读不到) */
export function describeSubscribe(sub) {
  const verdict = subscribeVerdictOf(sub)
  if (verdict === 'undetermined') return `关注关系未判定(${sub?.reason || '取不到状态'})`
  if (verdict === 'not_followed') return '关注关系=服务端未检测到'
  if (verdict === 'counting') {
    const h = Math.floor(sub.remainingSeconds / 3600)
    const m = Math.floor((sub.remainingSeconds % 3600) / 60)
    return `已关注,24h 窗还差 ${h}h${String(m).padStart(2, '0')}m`
  }
  return '已关注(倒计时读数已过窗或无)'
}

/**
 * 问一次服务端「这条关注关系现在算不算成立」,顺带触发它重算。
 *
 * @param {{accessToken:string, uid:string, domain:string}} cred
 */
export async function fetchSubscribeTaskStatus(cred) {
  if (!cred?.accessToken || !cred?.uid) {
    return {
      ok: false,
      subscribed: null,
      remainingSeconds: null,
      taskStatus: '',
      reason: '缺凭据(未判定)',
    }
  }
  try {
    const r = await fetch(OA_SUBSCRIBE_STATUS_URL, { headers: authHeaders(cred) })
    const txt = await r.text()
    return parseSubscribeStatus(r.status, txt)
  } catch (e) {
    return {
      ok: false,
      subscribed: null,
      remainingSeconds: null,
      taskStatus: '',
      reason: `请求失败:${e instanceof Error ? e.message : String(e)}`,
    }
  }
}

/**
 * 从成长任务列表里挑出公众号项,归一成一行判据。
 *
 * 取不到 ⇒ null(**未判定**,不猜、不静默丢)。
 *
 * @param {unknown} tasks 成长任务列表
 * @returns {null|{
 *   task_code: string, title: string, task_desc: string, jump_url: string,
 *   accept_status: string, progress: {current:number, target:number},
 *   reward_credit: number, reward_energy: number, has_reward: boolean,
 *   serviceDone: boolean, rewardClaimed: boolean, claimable: boolean, done: boolean,
 * }}
 */
export function selectOaTask(tasks) {
  const arr = Array.isArray(tasks) ? tasks : []
  const t = arr.find((x) => String(x?.task_code ?? '') === OA_TASK_CODE)
  if (!t) return null
  const status = String(t.accept_status ?? '')
    .trim()
    .toLowerCase()
  const rawProgress = t.progress ?? {}
  const current = Number(rawProgress?.current ?? 0)
  const target = Number(rawProgress?.target ?? 1)
  const serviceDone = status === 'completed' || status === 'claimed'
  const rewardClaimed = status === 'claimed'
  return {
    task_code: OA_TASK_CODE,
    title: String(t.title ?? ''),
    task_desc: String(t.task_desc ?? ''),
    jump_url: String(t.jump_url ?? ''),
    accept_status: String(t.accept_status ?? ''),
    progress: { current, target },
    reward_credit: Number(t.reward_credit ?? 0),
    reward_energy: Number(t.reward_energy ?? 0),
    has_reward: t.has_reward === true,
    /** 服务端已判完成(含已领) */
    serviceDone,
    /** 奖励已到账 */
    rewardClaimed,
    /** 服务端判完成、但奖励还没领 ⇒ 这一轮该调 claim */
    claimable: serviceDone && !rewardClaimed,
    /** 终态:已领 或 可领 或 进度已达标 */
    done: serviceDone || (current >= 1 && target >= 1),
  }
}

/**
 * 解析领奖响应(纯函数,离线可测)。
 *
 * 受理回执 ≠ 业务事实(§0.3):HTTP 200 **不**等于领到了。
 * 以响应体的 `code` 为准;`code` 缺失且 HTTP 2xx 才当作成功。
 *
 * @param {number} status HTTP 状态码
 * @param {string} text 响应体原文
 */
export function parseClaimResponse(status, text) {
  let j = {}
  try {
    j = JSON.parse(text)
  } catch {
    /* 非 JSON 原文 ⇒ 走下方 msg 兜底 */
  }
  const code = j?.code
  const msg = String(j?.msg ?? text ?? '').slice(0, 160)
  const httpOk = status >= 200 && status < 300
  const ok = httpOk && (code === 0 || code === undefined)
  /** 服务端说"已经领过了" ⇒ 视为已到账 */
  const already = /already|已领取|已领过|重复领取/i.test(msg)
  return { ok: ok || already, status, code, msg, already }
}

/**
 * 一轮轮询的决策(纯函数,离线可测)。
 *
 * 分流四类:
 *   · `claim`     —— 服务端判完成、奖励未领 ⇒ 这一轮调 claim;
 *   · `already`   —— 奖励已在账上(accept_status=claimed)⇒ 不用再领,退出轮询;
 *   · `pending`   —— 还没达标 ⇒ 继续等;
 *   · `undecided` —— 列表里没有这一项 ⇒ 无法判定,退出轮询(不退化成"失败",只报未判定)。
 *
 * @param {Array<{uid: string, task: object|null}>} rows
 */
export function planOaRound(rows) {
  const claim = []
  const already = []
  const pending = []
  const undecided = []
  for (const row of Array.isArray(rows) ? rows : []) {
    const uid = String(row?.uid ?? '')
    const task = row?.task
    if (!task) {
      undecided.push(uid)
      continue
    }
    if (task.rewardClaimed) {
      already.push(uid)
      continue
    }
    if (task.claimable) {
      claim.push(uid)
      continue
    }
    pending.push(uid)
  }
  return { claim, already, pending, undecided }
}

/**
 * 领奖(通用档):任何**服务端已判完成**的任务码都能领。
 *
 * 这是官方客户端「领取奖励」按钮自己那条端点,不是代做行为 —— `completed` 是服务端判出来的,
 * 本函数只负责把已经属于这个号的奖励取走。**不**接受 `accepted`(行为还没做)当可领。
 *
 * @param {{accessToken:string, uid:string, domain:string}} cred
 * @param {string} code 任务码
 */
export async function claimTask(cred, code) {
  const c = String(code ?? '').trim()
  if (!c) return { ok: false, status: 0, code: -1, msg: '任务码为空(未判定)', already: false }
  try {
    const r = await fetch(oaClaimUrl(c), {
      method: 'POST',
      headers: authHeaders(cred),
      body: '{}',
    })
    const txt = await r.text()
    return parseClaimResponse(r.status, txt)
  } catch (e) {
    return {
      ok: false,
      status: 0,
      code: -1,
      msg: e instanceof Error ? e.message : String(e),
      already: false,
    }
  }
}

/**
 * 领奖(公众号关注项专用档)—— 走 `claimTask` 同一实现,只把任务码钉成 OA。
 * @param {{accessToken:string, uid:string, domain:string}} cred
 */
export async function claimOaTask(cred) {
  return claimTask(cred, OA_TASK_CODE)
}

/** 解析命令行(纯函数,离线可测) */
export function parseArgs(argv) {
  const opts = {
    status: false,
    watch: false,
    intervalSec: 300,
    timeoutSec: 90_000,
    help: false,
  }
  const arr = Array.isArray(argv) ? argv : []
  for (let i = 0; i < arr.length; i += 1) {
    const a = String(arr[i])
    if (a === '--status') opts.status = true
    else if (a === '--watch') opts.watch = true
    else if (a === '--help' || a === '-h') opts.help = true
    else if (a.startsWith('--interval=')) opts.intervalSec = Number(a.slice('--interval='.length))
    else if (a === '--interval') opts.intervalSec = Number(arr[i + 1] ?? 300)
    else if (a.startsWith('--timeout=')) opts.timeoutSec = Number(a.slice('--timeout='.length))
    else if (a === '--timeout') opts.timeoutSec = Number(arr[i + 1] ?? 90_000)
  }
  // 间隔下限 30s:再密就是拿服务端当靶子打,且 24h 窗口本来就不需要秒级
  if (!Number.isFinite(opts.intervalSec) || opts.intervalSec < 30) opts.intervalSec = 30
  if (!Number.isFinite(opts.timeoutSec) || opts.timeoutSec <= 0) opts.timeoutSec = 90_000
  return opts
}

const HELP = `用法:
  node scripts/workbuddy-growth-oauth.mjs --status
      只读:列出每个号「公众号关注」项的状态(关注关系 / 24h 倒计时 / 状态 / 进度 / 是否已到账)

  node scripts/workbuddy-growth-oauth.mjs --watch [--interval 300] [--timeout 90000]
      轮询到服务端把该项判成完成,到账即调 claim 领奖(关注动作需机主本人在微信完成)
      --interval 轮询间隔秒数(下限 30,默认 300)
      --timeout  总预算秒数(默认 90000 ≈ 25 小时,覆盖满 24 小时窗口)

说明:这一项的判据是服务端一个布尔(GET /v2/activity/growth/subscribe-task/status 里的
      subscribed),官方成长空间的全部端点里没有任何一条能写它 ⇒ 只能真关注,程序不伪造。
      每轮先问一次这条状态(官方取列表前也是这个时序,顺带触发服务端重算),再读任务列表。
      本命令覆盖的是「关注之后 → 领奖」这一段。
`

async function readAll(accounts) {
  /** @type {Array<{uid:string, task:object|null, sub:object|null, reason:string}>} */
  const rows = []
  for (const acc of accounts) {
    const cred = readPoolCredential(acc.uid)
    if (!cred) {
      rows.push({ uid: acc.uid, task: null, sub: null, reason: '取不到凭据(未判定)' })
      continue
    }
    // 官方时序:先问一次订阅状态(服务端借此重算关注关系),再读任务列表
    const sub = await fetchSubscribeTaskStatus(cred)
    const res = await fetchGrowthTasks(cred)
    if (!res.ok) {
      rows.push({ uid: acc.uid, task: null, sub, reason: `读任务失败:${res.reason}` })
      continue
    }
    const t = selectOaTask(res.tasks)
    rows.push({
      uid: acc.uid,
      task: t,
      sub,
      reason: t ? '' : `列表里没有 ${OA_TASK_CODE}(未判定)`,
    })
  }
  return rows
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help || (!opts.status && !opts.watch)) {
    console.log(HELP)
    return opts.help ? 0 : 2
  }
  const accounts = listPoolAccounts()
  if (!accounts.length) {
    console.error('号池里没有可用账号副本(未判定)')
    return 2
  }

  const rows = await readAll(accounts)

  if (opts.status) {
    let desc = ''
    for (const r of rows) {
      const tag = `[${r.uid.slice(0, 8)}]`
      if (!r.task) {
        console.log(`${tag} ${r.reason}`)
        continue
      }
      const t = r.task
      if (!desc) desc = t.task_desc
      console.log(
        `${tag} ${t.accept_status || '(无状态)'} ${t.progress.current}/${t.progress.target} ` +
          `奖励=${t.reward_credit}c/${t.reward_energy}e 已到账=${t.rewardClaimed} ` +
          `待领=${t.claimable} | ${describeSubscribe(r.sub)}`,
      )
    }
    if (desc) console.log(`\n条件:${desc}\n跳转:${rows.find((r) => r.task)?.task.jump_url ?? ''}`)
    return 0
  }

  // ── watch:轮询到达标即领 ──
  const deadline = Date.now() + opts.timeoutSec * 1000
  const intervalMs = opts.intervalSec * 1000
  console.log(`[watch] 每 ${opts.intervalSec}s 轮询一次,总预算 ${opts.timeoutSec}s`)
  /** 已收口的号(已领到 / 已确认不可领)⇒ 退出轮询。避免"已领到的号被反复重领" */
  const finished = new Set()
  let claimedAny = false
  while (Date.now() < deadline) {
    const live = accounts.filter((a) => !finished.has(a.uid))
    if (!live.length) break
    const liveRows = rows.filter((r) => !finished.has(r.uid))
    // 每轮重读一次任务列表(业务态是服务端判的,本地缓存会过期)
    const fresh = await readAll(live)
    for (const r of fresh) {
      const old = liveRows.find((x) => x.uid === r.uid)
      if (old) r.reason = r.task ? old.reason : r.reason
    }
    const plan = planOaRound(fresh)
    for (const uid of plan.already) {
      console.log(`[${uid.slice(0, 8)}] 奖励已在账上(accept_status=claimed),跳过领奖`)
      claimedAny = true
      finished.add(uid)
    }
    for (const uid of plan.undecided) {
      const r = fresh.find((x) => x.uid === uid)
      console.log(`[${uid.slice(0, 8)}] ${r?.reason ?? '未判定'}`)
      finished.add(uid)
    }
    for (const uid of plan.claim) {
      const cred = readPoolCredential(uid)
      if (!cred) {
        finished.add(uid)
        continue
      }
      const c = await claimOaTask(cred)
      console.log(
        `[${uid.slice(0, 8)}] 已达标准,领奖结果: http=${c.status} code=${c.code} msg=${c.msg}`,
      )
      if (c.ok) {
        claimedAny = true
        finished.add(uid)
      }
      // 领奖失败(网络/服务端 5xx)⇒ 不收口,留到下一轮重试(失败方向恒为"多试一次")
    }
    for (const uid of plan.pending) {
      const r = fresh.find((x) => x.uid === uid)
      const t = r?.task
      console.log(
        `[${uid.slice(0, 8)}] ${t?.accept_status ?? '?'} ${t?.progress.current ?? 0}/${t?.progress.target ?? 1} ` +
          `—— 尚未达标 | ${describeSubscribe(r?.sub)}`,
      )
    }
    if (finished.size >= accounts.length) break
    if (Date.now() + intervalMs > deadline) break
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  if (claimedAny) {
    console.log('✅ 至少一个号的公众号项奖励已到账')
    return 0
  }
  console.log(
    '⚠ 未领到:服务端还没把关注关系判成立(上面每行已给出该号的关注关系与倒计时)。' +
      '这不是失败,是条件未到——判据是服务端的 subscribed 布尔,官方端点里没有任何一条能写它。',
  )
  return 1
}

/**
 * 直接跑 ⇒ 执行;被 import ⇒ 不执行。
 * 判据来自 `lib/direct-run.mjs`(单一真相源,§0.6)。
 */
if (isDirectRun(import.meta.url, process.argv[1])) {
  process.exitCode = await main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
