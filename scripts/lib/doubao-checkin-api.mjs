// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 豆包每日签到 API(2026-11-11 契约实测定稿)。
 *
 * 接口对(均 POST JSON):
 *   读状态 /alice/ug/campaign/v3/detail/     body {campaign_group_code}
 *   领取   /alice/ug/campaign/landing/checkin body {scene}
 *   活动组: pc_incentive_task_mvp_v3,任务码 daily_signin(奖励 200 额度/天)
 *
 * 鉴权指纹(2026-11-11 组合矩阵实测):
 *   - 会话必须取客户端活跃 profile(Profile 2);Default web 会话已过期会 710012001
 *   - 读接口两套指纹皆通:
 *     A 客户端指纹 aid=582478+device_id=1976300013104096+client_platform=pc_client+SamanthaDoubao UA
 *     B web 指纹 aid=497858+device_id 空+web_platform=desktop+DoubaoDesktop UA(CreditDaddy issue#32 已验证形状)
 *   - 写接口(checkin)当前稳定 710010702「系统错误」,与参数无关;10-20 社区纯 cookie 可打,
 *     疑为账号风控/频控期(710022002 同步进行中)的服务侧表现——频控解除后复测定论
 *
 * 返回契约:{ code:'ok'|'checked-in'|'no-activity'|'login-invalid'|'failed'|'blocked',
 *            checkedIn, rewardAmount, totalAmount, raw? }
 */
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

export const CAMPAIGN_GROUP = 'pc_incentive_task_mvp_v3'
export const DETAIL_PATH = '/alice/ug/campaign/v3/detail/'
export const CHECKIN_PATH = '/alice/ug/campaign/landing/checkin'
export const BASE = 'https://www.doubao.com'

/** web 指纹(detail 实测 code:0;字段按 CreditDaddy issue#32 形状 + 当前客户端版本号) */
export const CHECKIN_COMMON_PARAMS = Object.freeze({
  version_code: '20800',
  language: 'zh',
  device_platform: 'web',
  doubao_device_platform: 'web',
  aid: '497858',
  real_aid: '497858',
  pkg_type: 'release_version',
  pc_version: '2.33.5',
  doubao_pc_version: '5.72.66',
  samantha_web: '1',
  web_platform: 'desktop',
  'use-olympus-account': '1',
  web_tab_id: '0',
})

/** 豆包桌面 webview 同款 UA(DoubaoDesktop 标识;裸浏览器 UA 会吃请求非法) */
export const CHECKIN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) DoubaoDesktop/2.32.6 Chrome/147.0.7727.149 Safari/537.36'

/** 按 uid 派生稳定设备标识(每号恒定;服务端不严格校验但保持账号间互异) */
export function deviceIdsFor(uid) {
  const seed = crypto.createHash('sha256').update(`doubao-dev:${uid || 'anonymous'}`).digest()
  const webId = '76' + [...seed.subarray(0, 8)].map((b) => b % 10).join('')
  const teaUuid = [...seed.subarray(8, 16)].map((b) => b % 10).join('').padEnd(16, '7')
  return { web_id: webId, tea_uuid: teaUuid }
}

function clientProfileDir(env = process.env) {
  return path.join(env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'Doubao', 'User Data', 'Profile 2')
}

/**
 * 从 Chromium cookie 库解密 Profile 2 会话(复用 doubao-carry 的解密;带 .bytedance.com 域 msToken)。
 * 独立实现避免循环依赖:直接 import readDoubaoCookie。
 */
async function loadSession() {
  const carry = await import('./doubao-carry.mjs')
  return carry.readDoubaoCookie({ profileDir: clientProfileDir() })
}

function buildQuery(uid) {
  return new URLSearchParams({
    ...CHECKIN_COMMON_PARAMS,
    ...deviceIdsFor(uid),
    device_id: '',
    region: '',
    sys_region: '',
  }).toString()
}

async function postJson(cookieHeader, pathname, body, uid, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(`${BASE}${pathname}?${buildQuery(uid)}`, {
    method: 'POST',
    headers: {
      cookie: cookieHeader,
      'content-type': 'application/json',
      accept: 'application/json, text/plain, */*',
      referer: `${BASE}/pc/agent-explore`,
      origin: BASE,
      'user-agent': CHECKIN_UA,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  try {
    return { json: JSON.parse(text), text }
  } catch {
    return { json: null, text }
  }
}

/** detail 响应 → 签到任务(daily_signin) */
export function findCheckinTask(detailJson) {
  const tasks = detailJson?.data?.tasks
  if (!Array.isArray(tasks)) return null
  return tasks.find((t) => t && t.task_kind === 'daily_signin') ?? null
}

/**
 * 查询签到状态(detail 接口)。
 * @returns {Promise<{code:string, checkedIn?:boolean, continuousDays?:number, rewardAmount?:number,
 *   totalAmount?:number, raw?:object, message?:string}>}
 */
export async function getCheckinStatus({ cookieHeader, uid = '744846990510748', fetchImpl } = {}) {
  let session = { cookieHeader }
  if (!session.cookieHeader) {
    const r = await loadSession()
    if (r.code !== 'ok') return { code: 'failed', message: `cookie 读取失败: ${r.code}` }
    session = r
  }
  const { json } = await postJson(session.cookieHeader, DETAIL_PATH, { campaign_group_code: CAMPAIGN_GROUP }, uid, fetchImpl)
  if (!json) return { code: 'failed', message: 'detail 响应非 JSON' }
  const num = Number(json.code)
  if (num === 710012001) return { code: 'login-invalid', message: '登录已过期', raw: json }
  if (num === 710022002 || num === 710022004) return { code: 'blocked', message: `频控 ${num}`, raw: json }
  if (num !== 0) return { code: 'failed', message: `detail code ${num} ${json.msg ?? ''}`, raw: json }
  const task = findCheckinTask(json)
  if (!task) return { code: 'no-activity', message: '无签到任务(活动未开放或账号类型不支持)', raw: json }
  const c = task.daily_checkin ?? {}
  return {
    code: 'ok',
    checkedIn: c.checked_in_today === true,
    continuousDays: Number(c.continuous_days) || 0,
    rewardAmount: Number(c.reward?.reward_amount) || 0,
    totalAmount: Number(json.data?.progress?.total_amount) || 0,
    raw: json,
  }
}

/**
 * 每日签到:先查状态,未签才领取;服务端幂等(idempotent:true 归已签)。
 * @returns {Promise<{code:string, message:string, rewardAmount?:number, raw?:object}>}
 */
export async function dailyCheckin({ cookieHeader, uid = '744846990510748', fetchImpl } = {}) {
  const st = await getCheckinStatus({ cookieHeader, uid, fetchImpl })
  if (st.code !== 'ok') return { code: st.code, message: st.message ?? '状态查询失败', raw: st.raw }
  if (st.checkedIn) return { code: 'checked-in', message: '今天已签到', rewardAmount: st.rewardAmount }
  let session = { cookieHeader }
  if (!session.cookieHeader) {
    const r = await loadSession()
    if (r.code !== 'ok') return { code: 'failed', message: `cookie 读取失败: ${r.code}` }
    session = r
  }
  const { json } = await postJson(session.cookieHeader, CHECKIN_PATH, { scene: CAMPAIGN_GROUP }, uid, fetchImpl)
  if (!json) return { code: 'failed', message: 'checkin 响应非 JSON' }
  const num = Number(json.code)
  if (num === 0) {
    const d = json.data ?? {}
    if (d.idempotent === true) return { code: 'checked-in', message: '今天已签到(服务端幂等去重)', raw: json }
    const amount = Number(d.reward_amount) || st.rewardAmount || 200
    return { code: 'ok', message: `签到成功 +${amount} 额度(连续 ${Number(d.continuous_days) || st.continuousDays + 1} 天)`, rewardAmount: amount, raw: json }
  }
  if (num === 710012001) return { code: 'login-invalid', message: '登录已过期', raw: json }
  // 710010702 系统错误:2026-11-11 实测写接口在账号风控/频控期稳定返回,解除后复测
  return { code: 'blocked', message: `checkin code ${num} ${json.msg ?? ''}(写接口被拦,疑风控/频控期)`, raw: json }
}

// CLI 直跑:node scripts/lib/doubao-checkin-api.mjs [--claim]
/* eslint-disable no-console */
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('doubao-checkin-api.mjs')) {
  const claim = process.argv.includes('--claim')
  const out = claim ? await dailyCheckin() : await getCheckinStatus()
  const { raw: _raw, ...rest } = out
  console.log(JSON.stringify(rest, null, 2))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
