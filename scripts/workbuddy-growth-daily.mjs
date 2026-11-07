// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 每日签到与账面读数(2026-11-05 立,对照程序逆向而来)。
 *
 * ## 这条腿是从哪来的
 *
 * 机主给的对照程序 `wb2api.exe`(workbuddy2api 面板)里,自动面覆盖的是:
 * `accept_all` / `claim` / **`/billing/meter/daily-checkin`** / `makeup-cards/use` /
 * `lottery/draw` / `buddy/travel/*`(取证 = 二进制原文串扫描,见交付报告)。
 * 咱们仓里此前**只有**成长任务列表与领奖,签到这一条完全没接。
 *
 * 实测 2026-11-05:`POST https://www.workbuddy.cn/v2/billing/meter/daily-checkin`
 * ⇒ `{"code":10001,"msg":"今天已签到，请明天再来"}` ⇒ 端点成立,且**幂等信号是专码**,
 * 不是一句模糊报错 ⇒ 「今天已签」和「签到失败」必须分档,不能并桶。
 *
 * ## 它不干什么
 *
 *   · **不自动花资源**:补签卡(`makeup-cards/use`)、抽奖(`lottery/draw`)、伙伴旅行
 *     (`buddy/travel/depart`)都是**消耗型**动作(花卡/花次数/花体力),本命令一律不碰——
 *     "攒积分"不等于"替号主做消费决定"。要做请单独点名。
 *   · **不代做任何成长任务行为**(那归 `workbuddy-growth-experts.mjs`)。
 *   · **不伪造任何判定**:服务端没判成立的,本命令只报状态。
 *
 * ## 用法
 *
 *   node scripts/workbuddy-growth-daily.mjs --checkin   # 每个号签到一次(已签则报「今日已签」)
 *   node scripts/workbuddy-growth-daily.mjs --profile   # 只读:每个号的完成数/总数/等级/能量
 *
 * 退出码:0 没有失败 / 1 有签到失败 / 2 未判定(取不到号池·凭据·响应读不懂)。
 */
import { listPoolAccounts, readPoolCredential } from './workbuddy-growth-experts.mjs'
import { isDirectRun } from './lib/direct-run.mjs'

const HOST = 'https://www.workbuddy.cn'
/** 每日签到(实测 2026-11-05:POST-only,GET 会落到网页 404 而不是网关 404) */
export const CHECKIN_URL = `${HOST}/v2/billing/meter/daily-checkin`
/** 成长账面(只读):完成数/总数/等级 */
export const PROFILE_URL = `${HOST}/v2/activity/growth/profile`

/** 组装鉴权头 */
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
 * 解析签到响应(纯函数,离线可测)。四档**不得并桶**:
 *   · `checked`      —— 本次真签上了(http 2xx ∧ code=0);
 *   · `already`      —— 专码 10001 或文案「已签到/明天再来」⇒ 幂等成功,**不是失败**;
 *   · `failed`       —— 服务端明确回了一个别的业务码 ⇒ 报 code+msg;
 *   · `undetermined` —— 读不懂(非 2xx / 非 JSON / 没有 code)⇒ **未判定**,不冒充前三档。
 *
 * @param {number} status HTTP 状态码
 * @param {string} text 响应体原文
 */
export function parseCheckinResponse(status, text) {
  const httpOk = status >= 200 && status < 300
  let j = null
  try {
    j = JSON.parse(text)
  } catch {
    j = null
  }
  if (!j || typeof j.code !== 'number') {
    return {
      state: 'undetermined',
      code: null,
      msg: String(text ?? '').slice(0, 120),
      http: status,
    }
  }
  const code = j.code
  const msg = String(j.msg ?? '').slice(0, 120)
  if (code === 0 && httpOk) return { state: 'checked', code, msg, http: status }
  const alreadyByCode = code === 10001
  const alreadyByMsg = /已签到|明天再来|already.*check|check.*today/i.test(msg)
  if (alreadyByCode || alreadyByMsg) return { state: 'already', code, msg, http: status }
  return { state: 'failed', code, msg, http: status }
}

/**
 * 解析成长账面响应(纯函数,离线可测)。
 *
 * 取不到 `completed`/`total` 两个数 ⇒ 未判定(**不用 0 冒充「一个都没完成」**,§0.3)。
 *
 * @param {number} status HTTP 状态码
 * @param {string} text 响应体原文
 */
export function parseProfileResponse(status, text) {
  const httpOk = status >= 200 && status < 300
  let j = null
  try {
    j = JSON.parse(text)
  } catch {
    j = null
  }
  const d = j?.data
  if (!httpOk || !d || !Number.isFinite(Number(d.completed)) || !Number.isFinite(Number(d.total))) {
    return {
      ok: false,
      completed: null,
      total: null,
      level: null,
      reason: `读不到账面(http=${status} code=${j?.code ?? '-'})`,
    }
  }
  return {
    ok: true,
    completed: Number(d.completed),
    total: Number(d.total),
    level: Number.isFinite(Number(d.level)) ? Number(d.level) : null,
    reason: '',
  }
}

/** 解析命令行(纯函数,离线可测) */
export function parseArgs(argv) {
  const opts = { checkin: false, profile: false, help: false }
  const arr = Array.isArray(argv) ? argv : []
  for (const a of arr) {
    if (a === '--checkin') opts.checkin = true
    else if (a === '--profile') opts.profile = true
    else if (a === '--help' || a === '-h') opts.help = true
  }
  return opts
}

const HELP = `用法:
  node scripts/workbuddy-growth-daily.mjs --checkin
      给号池每个号做每日签到(专码 10001「今天已签到」算幂等成功,不算失败)

  node scripts/workbuddy-growth-daily.mjs --profile
      只读:每个号的完成数/总数/等级(读不到 ⇒ 未判定,不拿 0 冒充「都没完成」)

不碰的事:补签卡、抽奖、伙伴旅行都是消耗型动作,本命令不替号主做消费决定;成长任务的行为归 workbuddy-growth-experts.mjs。
退出码:0 没有失败 / 1 有签到失败 / 2 未判定。
`

/**
 * 签一个号。
 * @param {{accessToken:string, uid:string, domain:string}} cred
 */
export async function checkinOnce(cred) {
  try {
    const r = await fetch(CHECKIN_URL, { method: 'POST', headers: authHeaders(cred), body: '{}' })
    const txt = await r.text()
    return parseCheckinResponse(r.status, txt)
  } catch (e) {
    return {
      state: 'undetermined',
      code: null,
      msg: e instanceof Error ? e.message : String(e),
      http: 0,
    }
  }
}

/**
 * 读一个号的成长账面。
 * @param {{accessToken:string, uid:string, domain:string}} cred
 */
export async function readProfile(cred) {
  try {
    const r = await fetch(PROFILE_URL, { headers: authHeaders(cred) })
    const txt = await r.text()
    return parseProfileResponse(r.status, txt)
  } catch (e) {
    return {
      ok: false,
      completed: null,
      total: null,
      level: null,
      reason: `请求失败:${e instanceof Error ? e.message : String(e)}`,
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help || (!opts.checkin && !opts.profile)) {
    console.log(HELP)
    return opts.help ? 0 : 2
  }
  const accounts = listPoolAccounts()
  if (!accounts.length) {
    console.error('号池里没有可用账号副本(未判定)')
    return 2
  }

  let checked = 0
  let already = 0
  let failed = 0
  let undetermined = 0

  for (const acc of accounts) {
    const tag = `[${acc.uid.slice(0, 8)}]`
    const cred = readPoolCredential(acc.uid)
    if (!cred) {
      console.log(`${tag} 取不到凭据 —— 未判定`)
      undetermined += 1
      continue
    }
    if (opts.checkin) {
      const r = await checkinOnce(cred)
      if (r.state === 'checked') {
        checked += 1
        console.log(`${tag} 签到成功 (code=${r.code} msg=${r.msg})`)
      } else if (r.state === 'already') {
        already += 1
        console.log(`${tag} 今日已签到 —— 幂等,不算失败 (code=${r.code})`)
      } else if (r.state === 'failed') {
        failed += 1
        console.log(`${tag} 签到失败 (http=${r.http} code=${r.code} msg=${r.msg})`)
      } else {
        undetermined += 1
        console.log(`${tag} 签到**未判定**(读不懂响应,不冒充前三档):${r.msg}`)
      }
    }
    if (opts.profile) {
      const p = await readProfile(cred)
      console.log(
        p.ok
          ? `${tag} 账面 ${p.completed}/${p.total} 完成,等级=${p.level ?? '?'}`
          : `${tag} 账面 ${p.reason}`,
      )
      if (!p.ok) undetermined += 1
    }
  }

  if (opts.profile && !opts.checkin) return undetermined ? 2 : 0
  console.log(
    `\n汇总:新签 ${checked},今日已签 ${already},失败 ${failed},未判定 ${undetermined}(号池共 ${accounts.length} 个号)`,
  )
  if (failed) return 1
  if (undetermined && !checked && !already) return 2
  return 0
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  process.exitCode = await main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
