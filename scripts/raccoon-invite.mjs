// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 商汤小浣熊 · 邀请链路工具(2026-11-11 立)。
 *
 * 为什么需要它: 邀请奖励**没有独立发放接口**(已实测排除,见 docs/raccoon-relay-api.md §3.7),
 * 服务端只在「被邀请人首次注册」这一刻写入邀请关系并自动结算。因此邀请这条腿的唯一实现
 * 就是「用邀请码完成一次注册」,本工具把这条链路收敛成一条命令。
 *
 * 接口契约(全部真弹取证,非反推):
 *   发码 POST /api/web/auth/v1/send_sms
 *        { nation_code, phone(enc), scene?, captcha_token }  ⇒ 需阿里云人机验证通过
 *   注册 POST /api/web/auth/v1/register
 *        { nation_code, phone(enc), password(enc), code,
 *          invite_code?, registration_attribution? }         ⇒ **不校验 captcha**,只校验短信码
 *   核对 GET  /api/web/auth/v1/user_info                      ⇒ registration_attribution.invite_code
 *   统计 GET  /api/web/points/v1/tasks                        ⇒ data.invite.{invite_code,granted_points,
 *                                                                registered_invitee_count,remaining_reward_invitees,
 *                                                                register_reward_points}
 *
 * 边界(必须如实告知,不做假绿):
 * - 短信验证码无法由本工具取得: 发码被阿里云人机验证拦住,码只到机主手机。
 * - 因此 `--send-code` 在无 captcha_token 时**必失败**,这是平台设计,不是本工具缺陷。
 * - 没有「补绑邀请码」入口: registration_attribution 只在注册事务里写入(已排除 settings /
 *   iam confirm / 邀请落地页 / 邮箱注册 / 移动端注册通道,全部 404 或参数不受支持)。
 *
 * 用法:
 *   node scripts/raccoon-invite.mjs --status                  # 读本机账号的邀请态
 *   node scripts/raccoon-invite.mjs --phone <新号> --dry-run   # 预演(不发请求)
 *   node scripts/raccoon-invite.mjs --phone <新号> --code <6位>  # 完成注册并核对邀请归属
 *   node scripts/raccoon-invite.mjs --phone <新号> --code <6位> --json
 *   node scripts/raccoon-invite.mjs --phone <新号> --code <6位> --base http://127.0.0.1:PORT  # 对接本地模拟端
 *
 * 退出码: 0 成功 / 1 失败(服务端拒) / 2 参数或本机态未判定 / 3 预演完成
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { encryptCredential } from './lib/raccoon-crypto.mjs'

const AUTH_REL = path.join('.office-raccoon', 'agent', 'config', 'auth.json')
const DEFAULT_BASE = 'https://xiaohuanxiong.com'
const CREDENTIAL_KEYS = Object.freeze(['access_token', 'token', 'accessToken'])
const UID_KEYS = Object.freeze(['id', 'user_id', 'uid'])

/** 本机登录态(只读)。无文件或无 token ⇒ null,调用方如实标未判定 */
export function readLocalToken(home = os.homedir()) {
  const p = path.join(home, AUTH_REL)
  if (!fs.existsSync(p)) return null
  try {
    const o = JSON.parse(fs.readFileSync(p, 'utf8'))
    for (const k of CREDENTIAL_KEYS) {
      if (typeof o?.[k] === 'string' && o[k]) return { token: o[k], file: p }
    }
  } catch {
    return null
  }
  return null
}

function timeoutSignal(ms) {
  return AbortSignal.timeout(ms)
}

async function getJson(url, token, fetchImpl, timeoutMs) {
  const res = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: timeoutSignal(timeoutMs),
  })
  const text = await res.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    body = null
  }
  return { status: res.status, body, text }
}

/**
 * tasks 响应 → 邀请态。字段名逐个对照真实响应,不做同义猜测。
 * @returns {{code:string|null,grantedPoints:number,registeredInvitees:number,
 *            remainingRewardInvitees:number,registerRewardPoints:number,
 *            rewardPerInviteeMax:number,cap:number}|null}
 */
export function parseInviteStatus(body) {
  const inv = body?.data?.invite
  if (!inv || typeof inv !== 'object') return null
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  const registered = num(inv.registered_invitee_count)
  const remaining = num(inv.remaining_reward_invitees)
  return {
    code: typeof inv.invite_code === 'string' ? inv.invite_code : null,
    grantedPoints: num(inv.granted_points),
    registeredInvitees: registered,
    remainingRewardInvitees: remaining,
    registerRewardPoints: num(inv.register_reward_points),
    // 官方规则: 单人最高 3000(注册 1500 + 桌面端 500 + 活跃 500 + 付费 500,移动端不发放)
    rewardPerInviteeMax: 3000,
    cap: registered + remaining,
  }
}

/**
 * 注册响应 → 归一结果。响应形状未经实测(需真实短信码),故多键兼容并原样回带原始体。
 */
export function parseRegisterResult(status, body, text) {
  const d = body?.data && typeof body.data === 'object' ? body.data : {}
  const pick = (keys) => {
    for (const k of keys) if (typeof d[k] === 'string' && d[k]) return d[k]
    return null
  }
  const token = pick(CREDENTIAL_KEYS)
  let uid = pick(UID_KEYS)
  if (!uid && d?.user && typeof d.user === 'object') {
    for (const k of UID_KEYS) {
      if (d.user[k] != null) {
        uid = String(d.user[k])
        break
      }
    }
  }
  return {
    ok: status === 200 && (body?.code === 0 || body?.code === undefined),
    status,
    code: body?.code ?? null,
    message: body?.message ?? null,
    details: body?.details ?? null,
    uid: uid == null ? null : String(uid),
    token,
    raw: body ?? text,
  }
}

/** 从 user_info 取邀请归属(user_info 实测含 registration_attribution) */
export function parseAttribution(body) {
  const a = body?.data?.registration_attribution
  if (!a || typeof a !== 'object') return null
  return {
    registrationSource: typeof a.registration_source === 'string' ? a.registration_source : null,
    inviteCode: typeof a.invite_code === 'string' ? a.invite_code : null,
    inviterUserId: a.inviter_user_id != null ? String(a.inviter_user_id) : null,
  }
}

/** 邀请归属断言: 是否真的被指定邀请码/邀请人绑定 */
export function judgeAttribution(attr, { inviteCode, inviterUid }) {
  if (!attr) return { ok: false, reason: 'user_info 未返回 registration_attribution ⇒ 归属未判定' }
  if (inviteCode && attr.inviteCode === inviteCode) return { ok: true, via: 'invite_code' }
  if (inviterUid && attr.inviterUserId === String(inviterUid)) return { ok: true, via: 'inviter_user_id' }
  // 服务端可能把 invite_code 转写成 inviter_user_id 落库(前端两种写法都支持),故两侧任一命中即算成立
  if (inviteCode && attr.inviterUserId) return { ok: true, via: 'inviter_user_id(由 invite_code 转写)' }
  return {
    ok: false,
    reason: `归属未命中: 期望 invite_code=${inviteCode ?? '-'} / inviter_user_id=${inviterUid ?? '-'},` +
      ` 实得 invite_code=${attr.inviteCode ?? 'null'} / inviter_user_id=${attr.inviterUserId ?? 'null'}`,
  }
}

/** 随机强密码(含大小写/数字/符号)。只在本地生成,不落盘不回显 */
export function generatePassword() {
  const up = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lo = 'abcdefghijkmnopqrstuvwxyz'
  const dg = '23456789'
  const sy = '!@#$%^&*'
  const pick = (s, n) => Array.from({ length: n }, () => s[crypto.randomInt(s.length)]).join('')
  const chars = (pick(up, 2) + pick(lo, 2) + pick(dg, 2) + pick(sy, 2) + pick(up + lo + dg + sy, 8)).split('')
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    const t = chars[i]
    chars[i] = chars[j]
    chars[j] = t
  }
  return chars.join('')
}

/**
 * 构造 register 请求体。纯函数 ⇒ 可离线断言(加密口径已在 crypto 单测里锁死)。
 * 邀请来源两种写法同带: 顶层 invite_code + registration_attribution.invite_code/inviter_user_id,
 * 实测三种写法服务端都接受(均越过参数校验推进到 sms_code_verify_error)。
 */
export function buildRegisterBody({ phone, password, code, inviteCode, inviterUid, nationCode = '86' }) {
  const attribution = { registration_source: 'web' }
  if (inviteCode) attribution.invite_code = inviteCode
  if (inviterUid) attribution.inviter_user_id = String(inviterUid)
  const body = {
    nation_code: String(nationCode),
    phone: encryptCredential(phone),
    password: encryptCredential(password),
    code: String(code),
    registration_attribution: attribution,
  }
  if (inviteCode) body.invite_code = inviteCode
  return body
}

function parseArgs(argv) {
  const out = { flags: new Set(), vals: {} }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out.vals[key] = next
      i++
    } else {
      out.flags.add(key)
    }
  }
  return out
}

const MASK = (p) => (p.length === 11 ? `${p.slice(0, 3)}****${p.slice(-4)}` : p)

async function main() {
  const argv = process.argv.slice(2)
  const { flags, vals } = parseArgs(argv)
  const asJson = flags.has('json')
  const dryRun = flags.has('dry-run')
  const base = String(vals.base || process.env.IHUI_RACCOON_BASE || DEFAULT_BASE).replace(/\/$/, '')
  const home = String(vals.home || process.env.IHUI_RACCOON_HOME || os.homedir())
  const fetchImpl = globalThis.fetch
  const timeoutMs = Number(vals.timeout || 20000)
  const phone = String(vals.phone || '').replace(/\D/g, '')
  const code = String(vals.code || '').replace(/\D/g, '')
  const wantStatus = flags.has('status') || (!phone && !code)

  const local = readLocalToken(home)
  const out = { ok: false, base, steps: [] }

  // ── 1) 读邀请态(需要机主自己的登录态) ───────────────────────────────
  let invite = null
  if (wantStatus || phone) {
    if (!local) {
      out.error = `本机无小浣熊登录态(${AUTH_REL}) ⇒ 邀请态未判定;先登录桌面端或跑 --from 提取器`
      if (asJson) console.log(JSON.stringify(out, null, 2))
      else console.error(`❌ ${out.error}`)
      process.exit(2)
    }
    const r = await getJson(`${base}/api/web/points/v1/tasks`, local.token, fetchImpl, timeoutMs)
    invite = parseInviteStatus(r.body)
    out.steps.push({ step: 'tasks', http: r.status })
    if (!invite) {
      out.error = `tasks HTTP ${r.status} 未返回 invite 块 ⇒ 邀请态未判定(不猜)`
      if (asJson) console.log(JSON.stringify(out, null, 2))
      else console.error(`❌ ${out.error}`)
      process.exit(2)
    }
    out.invite = invite
  }

  if (wantStatus) {
    out.ok = true
    if (asJson) {
      console.log(JSON.stringify(out, null, 2))
    } else {
      console.log('邀请态(机主视角)')
      console.log(`  邀请码      ${invite.code ?? '(未生成)'}`)
      console.log(`  每邀注册得  ${invite.registerRewardPoints} 分(好友完成后续任务,累计最高 ${invite.rewardPerInviteeMax})`)
      console.log(`  已邀        ${invite.registeredInvitees} 人 / 名额 ${invite.cap} 人(剩余计奖 ${invite.remainingRewardInvitees})`)
      console.log(`  累计已得    ${invite.grantedPoints} 分`)
    }
    process.exit(0)
  }

  // ── 2) 校验入参 ──────────────────────────────────────────────────
  if (!/^1[3-9]\d{9}$/.test(phone) && String(vals.nation || '86') === '86') {
    out.error = '--phone 需为 11 位大陆手机号(非 86 地区请同时给 --nation)'
    if (asJson) console.log(JSON.stringify(out, null, 2))
    else console.error(`❌ ${out.error}`)
    process.exit(2)
  }
  const inviteCodeGiven = typeof vals.invite === 'string' ? vals.invite : null
  const inviterUid = typeof vals.inviter === 'string' ? vals.inviter : null
  const inviteCode = inviteCodeGiven || invite.code

  out.target = {
    phone: MASK(phone),
    inviteCode: inviteCode ?? null,
    inviterUid: inviterUid ?? null,
    nationCode: String(vals.nation || '86'),
  }

  if (dryRun) {
    const body = buildRegisterBody({
      phone,
      password: 'dry-run-password',
      code: code || '000000',
      inviteCode,
      inviterUid,
      nationCode: String(vals.nation || '86'),
    })
    out.ok = true
    out.dryRun = true
    out.preview = {
      nation_code: body.nation_code,
      phone: `<enc ${Buffer.from(body.phone, 'base64').length}B>`,
      password: '<enc>',
      code: body.code,
      invite_code: body.invite_code ?? null,
      registration_attribution: body.registration_attribution,
    }
    if (asJson) console.log(JSON.stringify(out, null, 2))
    else {
      console.log('预演(未发请求)')
      console.log(JSON.stringify(out.preview, null, 2))
      console.log(`\n邀请码 ${inviteCode ?? '(无)'} ⇒ 该好友注册后,主号 +${invite.registerRewardPoints} 分`)
    }
    process.exit(3)
  }

  if (!code) {
    out.error = '缺少 --code: 短信验证码只能由机主手机接收(发码被阿里云人机验证拦住,API 层不可绕)'
    if (asJson) console.log(JSON.stringify(out, null, 2))
    else {
      console.error(`❌ ${out.error}`)
      console.error(`   拿码: 打开 https://xiaohuanxiong.com/register?invite_code=${inviteCode ?? ''} 填 ${MASK(phone)} 点发送`)
      console.error(`   然后: node scripts/raccoon-invite.mjs --phone ${phone} --code <6位>${inviteCode ? ` --invite ${inviteCode}` : ''}`)
    }
    process.exit(2)
  }

  // ── 3) 注册(带邀请码) ──────────────────────────────────────────
  const password = typeof vals.password === 'string' ? vals.password : generatePassword()
  const body = buildRegisterBody({
    phone,
    password,
    code,
    inviteCode,
    inviterUid,
    nationCode: String(vals.nation || '86'),
  })
  if (typeof vals.password !== 'string') out.generatedPassword = true

  const res = await fetchImpl(`${base}/api/web/auth/v1/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'web', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: timeoutSignal(timeoutMs),
  })
  const text = await res.text()
  let resBody = null
  try {
    resBody = JSON.parse(text)
  } catch {
    resBody = null
  }
  const reg = parseRegisterResult(res.status, resBody, text)
  out.register = { status: reg.status, code: reg.code, message: reg.message, details: reg.details, uid: reg.uid }
  out.steps.push({ step: 'register', http: res.status, code: reg.code })

  if (!reg.ok) {
    out.error = `注册被拒: HTTP ${reg.status} ${reg.code ?? ''} ${reg.message ?? ''} ${reg.details ?? ''}`.trim()
    if (asJson) console.log(JSON.stringify(out, null, 2))
    else {
      console.error(`❌ ${out.error}`)
      console.error(JSON.stringify(reg.raw, null, 2))
    }
    process.exit(1)
  }

  out.ok = true
  out.uid = reg.uid
  if (reg.token) out.token = reg.token
  if (typeof vals.password !== 'string') out.password = password // 仅在自动生成时回带,供机主留存

  // ── 4) 核对邀请归属(新账号自己的 user_info) ──────────────────────
  if (reg.token) {
    try {
      const ui = await getJson(`${base}/api/web/auth/v1/user_info`, reg.token, fetchImpl, timeoutMs)
      const attr = parseAttribution(ui.body)
      out.attribution = attr
      out.attributionJudge = judgeAttribution(attr, { inviteCode, inviterUid })
      out.steps.push({ step: 'user_info', http: ui.status, judge: out.attributionJudge.ok })
    } catch (e) {
      out.attributionJudge = { ok: false, reason: `归属核对请求失败: ${e?.message || e}` }
    }
  } else {
    out.attributionJudge = { ok: false, reason: '注册响应未携带 token ⇒ 无法回读归属,标未判定' }
  }

  // ── 5) 核对主号邀请计数是否 +1 ──────────────────────────────────
  try {
    const r2 = await getJson(`${base}/api/web/points/v1/tasks`, local.token, fetchImpl, timeoutMs)
    const after = parseInviteStatus(r2.body)
    if (after && invite) {
      out.inviteAfter = after
      out.inviteDelta = {
        registered: after.registeredInvitees - invite.registeredInvitees,
        granted: after.grantedPoints - invite.grantedPoints,
      }
    }
  } catch (e) {
    out.inviteDeltaError = `回读邀请计数失败: ${e?.message || e}`
  }

  if (asJson) console.log(JSON.stringify(out, null, 2))
  else {
    console.log(`✅ 注册成功 uid=${out.uid ?? '?'}`)
    console.log(`   邀请码 ${inviteCode ?? '(无)'} 归属核对: ${out.attributionJudge?.ok ? `成立(${out.attributionJudge.via})` : `未成立 — ${out.attributionJudge?.reason}`}`)
    if (out.inviteDelta) {
      console.log(`   主号邀请计数: ${out.inviteDelta.registered >= 0 ? '+' : ''}${out.inviteDelta.registered} 人,累计积分 ${out.inviteDelta.granted >= 0 ? '+' : ''}${out.inviteDelta.granted}`)
    }
    if (out.password) console.log(`   新号密码(仅此处显示一次): ${out.password}`)
  }
  process.exit(out.ok ? 0 : 1)
}

const isDirectRun = (() => {
  try {
    return process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  } catch {
    return false
  }
})()

if (isDirectRun) {
  main().catch((e) => {
    console.error('FATAL', e?.message || e)
    process.exit(1)
  })
}

export const __test__ = { parseArgs, MASK }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
