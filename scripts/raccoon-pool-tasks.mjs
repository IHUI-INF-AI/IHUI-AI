// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小浣熊积分/任务核对与领取 CLI(2026-11-11 立,号池"自动签到"腿的单机执行面)。
 *
 * 默认只读;带 --claim/--claim-new-user 才写。
 *  1) 余额核对   GET  /api/web/points/v1/balance
 *  2) 任务态核对 GET  /api/web/points/v1/tasks(新手任务/邀请统计/邀请码)
 *  3) 每日领取   POST /api/web/desktop/v1/login/points/grant
 *                幂等:今日已发 ⇒ granted=false;首发 ⇒ popup 带 points/source
 *  4) 新手奖励   POST /api/web/mobile/v1/login/points/grant
 *                移动端登录奖励(账号级一次性 3000;领过即 granted=false)
 *  5) 积分流水   GET  /api/web/points/v2/bills
 *
 * 取证:桌面端 app.asar 静态枚举 + 真弹复核,bill 记录 event_name/daily_grant 双证。
 * 凭据来源(优先级):--token > --file <auth.json> > 本机提取(单源 raccoon-auth-extract)。
 * 退出码:0 核对/领取成功 / 1 上游拒绝(401/403 ⇒ 号池侧应标凭证失效) / 2 未判定(取不到输入)。
 *
 * 用法:
 *   node scripts/raccoon-pool-tasks.mjs [--json] [--token <jwt>] [--file <auth.json>]
 *                                       [--claim] [--claim-new-user] [--bills]
 *                                       [--base http://127.0.0.1:8899]  # 指向本地模拟上游演练
 */
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { decodeJwtPayload, extractRaccoonAccounts } from './lib/raccoon-auth-extract.mjs'

// 基址可用 --base / IHUI_RACCOON_BASE 覆盖,只用于指向本地模拟上游做演练;缺省线上。
let API_BASE = (process.env.IHUI_RACCOON_BASE || 'https://xiaohuanxiong.com').replace(/\/$/, '')
const CLIENT_VERSION = 'v1.2.0'

const HEADERS_BASE = {
  Accept: 'application/json',
  'User-Agent': 'ihui-relay-pool/1.0',
  connection: 'close',
}

async function getJson(pathname, token, fetchImpl = globalThis.fetch) {
  const r = await fetchImpl(`${API_BASE}${pathname}`, {
    headers: { ...HEADERS_BASE, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  })
  const text = await r.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {}
  return { status: r.status, body, text }
}

/** 发放接口:POST + 空 JSON 体 + 平台/版本头(与客户端同形) */
async function postJson(pathname, token, platform, fetchImpl = globalThis.fetch) {
  const r = await fetchImpl(`${API_BASE}${pathname}`, {
    method: 'POST',
    headers: {
      ...HEADERS_BASE,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Client-Platform': platform,
      'X-Client-Version': CLIENT_VERSION,
    },
    body: '{}',
    signal: AbortSignal.timeout(20000),
  })
  const text = await r.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {}
  return { status: r.status, body, text }
}

/** 结果三态:ok / finding(量到了但状态不对) / undetermined(取不到 ⇒ §0.3 不记绿也不冒红) */
export function judgeBalance(res) {
  if (res.status === 401 || res.status === 403) return { verdict: 'finding', code: 'AUTH_EXPIRED' }
  if (res.status !== 200 || !res.body || res.body.code !== 0 || !res.body.data) {
    return { verdict: 'undetermined', code: `HTTP_${res.status}` }
  }
  const d = res.body.data
  return {
    verdict: 'ok',
    availablePoints: Number(d.available_points ?? NaN),
    dailyPoints: Number(d.daily_points ?? 0),
    rewardPoints: Number(d.reward_points ?? 0),
    topupPoints: Number(d.topup_points ?? 0),
    ownerId: d.owner_id ?? null,
  }
}

export function judgeTasks(res) {
  if (res.status === 401 || res.status === 403) return { verdict: 'finding', code: 'AUTH_EXPIRED' }
  if (res.status !== 200 || !res.body || res.body.code !== 0 || !res.body.data) {
    return { verdict: 'undetermined', code: `HTTP_${res.status}` }
  }
  const d = res.body.data
  const states = Array.isArray(d.new_user_task_states) ? d.new_user_task_states : []
  const byKey = Object.fromEntries(states.map((s) => [String(s.key), String(s.status)]))
  return {
    verdict: 'ok',
    newUserTasks: byKey,
    invite: d.invite
      ? {
          code: d.invite.invite_code ?? null,
          grantedPoints: Number(d.invite.granted_points ?? 0),
          registeredInvitees: Number(d.invite.registered_invitee_count ?? 0),
          remainingRewardInvitees: Number(d.invite.remaining_reward_invitees ?? 0),
          registerRewardPoints: Number(d.invite.register_reward_points ?? 0),
        }
      : null,
  }
}

/**
 * 发放响应判定。`granted=true` 才是真到账;`granted=false` 是幂等"已领",
 * **不是失败**——这一点必须与余额面区分开,否则号池会把已领账号误标红。
 */
export function judgeGrant(res) {
  if (res.status === 401 || res.status === 403) return { verdict: 'finding', code: 'AUTH_EXPIRED' }
  if (res.status !== 200 || !res.body || res.body.code !== 0 || !res.body.data) {
    return { verdict: 'undetermined', code: `HTTP_${res.status}` }
  }
  const d = res.body.data
  if (typeof d.granted !== 'boolean') return { verdict: 'undetermined', code: 'GRANTED_NOT_BOOL' }
  const popup = d.popup && typeof d.popup === 'object' ? d.popup : null
  return {
    verdict: 'ok',
    granted: d.granted,
    points: popup && Number.isFinite(Number(popup.points)) ? Number(popup.points) : 0,
    source: popup?.source ?? null,
    displayName: popup?.display_name ?? null,
    expireAt: popup?.expire_at ?? null,
  }
}

export function judgeBills(res) {
  if (res.status === 401 || res.status === 403) return { verdict: 'finding', code: 'AUTH_EXPIRED' }
  if (res.status !== 200 || !res.body || res.body.code !== 0 || !res.body.data) {
    return { verdict: 'undetermined', code: `HTTP_${res.status}` }
  }
  const items = Array.isArray(res.body.data.items) ? res.body.data.items : []
  return {
    verdict: 'ok',
    items: items.map((b) => ({
      at: b.created_at ?? null,
      event: b.event_name ?? null,
      bizType: b.biz_type ?? null,
      points: Number(b.points ?? 0),
    })),
  }
}

/** 下一步建议(人读;按任务态与余额给出) */
export function suggestNext(balance, tasks, grant) {
  const out = []
  if (balance.verdict === 'finding' && balance.code === 'AUTH_EXPIRED') {
    out.push('令牌已失效/过期 ⇒ 在小浣熊客户端重新登录一次,再跑 --from raccoon 覆盖入池')
    return out
  }
  if (grant && grant.verdict === 'ok') {
    out.push(grant.granted ? `本次领取 +${grant.points}(${grant.displayName ?? grant.source ?? '登录奖励'})` : '每日额度今日已发放(granted=false 幂等,非失败)')
  }
  if (tasks.verdict === 'ok') {
    const t = tasks.newUserTasks
    if (t.mobile_login === 'unfinished') out.push('新手任务 mobile_login 未完成 ⇒ 跑 --claim-new-user 领移动端登录奖励(账号级一次性)')
    if (t.desktop_login === 'unfinished') out.push('新手任务 desktop_login 未完成 ⇒ 跑 --claim 领桌面端登录奖励')
    if (t.register_pack === 'unfinished') out.push('新手任务 register_pack 未完成 ⇒ 到 设置→积分 面板点领取')
    const inv = tasks.invite
    if (inv && inv.grantedPoints === 0 && inv.remainingRewardInvitees > 0) {
      out.push(`邀请未开张(邀请码 ${inv.code} 已生成):每邀 1 位好友注册得 ${inv.registerRewardPoints},好友完成任务再得等额;上限 ${inv.remainingRewardInvitees} 位`)
    }
  }
  if (balance.verdict === 'ok') {
    out.push(`当前可用 ${balance.availablePoints} 分(每日登录发放 ${balance.dailyPoints};奖励池 ${balance.rewardPoints})`)
    out.push('SenseNova 6.8 Flash 限免至 2026-12-01:重活(PPT/海报/网页/数据分析)优先在限免窗口内跑')
  }
  return out
}

async function resolveToken(argv) {
  const tIdx = argv.indexOf('--token')
  if (tIdx >= 0 && argv[tIdx + 1]) return { token: argv[tIdx + 1], source: 'cli' }
  const fIdx = argv.indexOf('--file')
  if (fIdx >= 0 && argv[fIdx + 1]) {
    const parsed = JSON.parse(fs.readFileSync(argv[fIdx + 1], 'utf8'))
    const token = typeof parsed.access_token === 'string' ? parsed.access_token.trim() : ''
    if (!token) return { err: 'auth.json 里没有 access_token' }
    return { token, source: argv[fIdx + 1] }
  }
  const extract = await extractRaccoonAccounts({
    verify: false,
    pick: argv.includes('--pick') ? argv[argv.indexOf('--pick') + 1] : undefined,
    home: argv.includes('--home') ? argv[argv.indexOf('--home') + 1] : undefined,
  })
  if (!extract.ok) return { err: extract.reason }
  return { token: extract.accounts[0].token, source: '本机 auth.json(单源提取器)' }
}

async function main() {
  const argv = process.argv.slice(2)
  const baseIdx = argv.indexOf('--base')
  if (baseIdx >= 0 && argv[baseIdx + 1]) API_BASE = String(argv[baseIdx + 1]).replace(/\/$/, '')
  if (argv.includes('--help')) {
    console.log('用法:node scripts/raccoon-pool-tasks.mjs [--json] [--token <jwt>|--file <auth.json>] [--claim] [--claim-new-user] [--bills]')
    console.log('      [--base <http://127.0.0.1:8899>]  指向本地模拟上游(scripts/raccoon-mock-upstream.mjs)演练')
    console.log('  默认只读(余额 + 任务态)。')
    console.log('  --claim           领取每日额度(POST desktop grant;幂等,已领返回 granted=false)')
    console.log('  --claim-new-user  领取移动端登录奖励(POST mobile grant;账号级一次性)')
    console.log('  --bills           打印最近 10 笔积分流水(biz_type/event_name/points)')
    return 0
  }
  const resolved = await resolveToken(argv)
  if (resolved.err) {
    console.error(`❌ 未判定:${resolved.err}`)
    return 2
  }
  const payload = decodeJwtPayload(resolved.token)
  const exp = payload?.exp ? new Date(payload.exp * 1000) : null
  const wantClaim = argv.includes('--claim')
  const wantNewUser = argv.includes('--claim-new-user')
  const wantBills = argv.includes('--bills')

  const [balRes, taskRes] = await Promise.all([getJson('/api/web/points/v1/balance', resolved.token), getJson('/api/web/points/v1/tasks', resolved.token)])

  const grant = wantClaim ? judgeGrant(await postJson('/api/web/desktop/v1/login/points/grant', resolved.token, 'desktop-windows')) : null
  // 每日额度刚变过 ⇒ 余额以领取后的回读为准
  const balAfter = grant ? await getJson('/api/web/points/v1/balance', resolved.token) : null
  const newUser = wantNewUser ? judgeGrant(await postJson('/api/web/mobile/v1/login/points/grant', resolved.token, 'mobile-android')) : null
  const bills = wantBills ? judgeBills(await getJson('/api/web/points/v2/bills?page=1&page_size=10', resolved.token)) : null

  // 领取动作本身会改任务态 ⇒ 有领取就以领取后的回读为准。否则拿领取前的快照,
  // 会把刚刚 completed 的任务报成 unfinished(号池据此重复派单/误报)。
  const taskResAfter = grant || newUser ? await getJson('/api/web/points/v1/tasks', resolved.token) : null

  const balance = judgeBalance(balAfter ?? balRes)
  const tasks = judgeTasks(taskResAfter ?? taskRes)
  const suggestions = suggestNext(balance, tasks, grant)
  const report = {
    provider: 'raccoon',
    checkedAt: new Date().toISOString(),
    tokenSource: resolved.source,
    tokenExpiresAt: exp ? exp.toISOString() : null,
    tokenExpiringSoon: exp ? exp.getTime() - Date.now() < 24 * 3600 * 1000 : null,
    balance,
    tasks,
    grant,
    newUserGrant: newUser,
    bills,
    suggestions,
  }
  if (argv.includes('--json')) {
    process.stdout.write(JSON.stringify(report, null, 1) + '\n')
  } else {
    console.log(`== 小浣熊核对 ${report.checkedAt} ==`)
    if (balance.verdict === 'ok') console.log(`余额:可用 ${balance.availablePoints} = 每日 ${balance.dailyPoints} + 奖励 ${balance.rewardPoints} + 充值 ${balance.topupPoints}(owner ${balance.ownerId})`)
    else console.log(`余额:${balance.verdict}(${balance.code ?? ''})`)
    if (grant) {
      if (grant.verdict === 'ok') console.log(`每日领取:${grant.granted ? `+${grant.points} ${grant.displayName ?? grant.source ?? ''}` : '今日已领(granted=false)'}`)
      else console.log(`每日领取:${grant.verdict}(${grant.code ?? ''})`)
    }
    if (newUser) {
      if (newUser.verdict === 'ok') console.log(`新手奖励:${newUser.granted ? `+${newUser.points} ${newUser.displayName ?? newUser.source ?? ''}` : '已领过(granted=false)'}`)
      else console.log(`新手奖励:${newUser.verdict}(${newUser.code ?? ''})`)
    }
    if (tasks.verdict === 'ok') {
      console.log('新手任务:', JSON.stringify(tasks.newUserTasks))
      if (tasks.invite) console.log(`邀请:码=${tasks.invite.code} 已得=${tasks.invite.grantedPoints} 已邀=${tasks.invite.registeredInvitees}/${tasks.invite.remainingRewardInvitees + tasks.invite.registeredInvitees}`)
    } else console.log(`任务:${tasks.verdict}(${tasks.code ?? ''})`)
    if (bills && bills.verdict === 'ok') {
      console.log('最近流水:')
      for (const b of bills.items) console.log(`  ${b.at} | ${b.bizType} | ${b.event} | ${b.points > 0 ? '+' : ''}${b.points}`)
    }
    if (report.tokenExpiresAt) console.log(`令牌到期:${report.tokenExpiresAt}${report.tokenExpiringSoon ? ' ⚠ 24h 内到期' : ''}`)
    for (const s of suggestions) console.log('→ ' + s)
  }
  if (balance.verdict === 'undetermined' && tasks.verdict === 'undetermined') return 2
  if (balance.verdict === 'finding' || tasks.verdict === 'finding') return 1
  if (grant && grant.verdict === 'finding') return 1
  if (newUser && newUser.verdict === 'finding') return 1
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => {
      process.exitCode = code ?? 0
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exitCode = 2
    })
}

export const __test__ = { judgeBalance, judgeTasks, judgeGrant, judgeBills, suggestNext, getJson, postJson }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
