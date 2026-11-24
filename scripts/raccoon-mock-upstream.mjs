// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 商汤小浣熊 · 本地模拟上游(2026-11-11 立)。
 *
 * 为什么需要它: 真站的注册/发码最后一道关是**手机短信验证码**,码由服务端经运营商下发、
 * 只在机主手机上,客户端拿不到也没有任何接口能"造"一个服务端认可的码 —— 这是平台的身份
 * 验证控制,不能绕也不应绕。所以"模拟验证码"唯一正当的落点是**把服务端本身在本地模拟出来**:
 * 协议形状逐字段对齐线上实得,让客户端代码(加密口径/签到领取/新手任务态回读)
 * 在没有真实手机号的情况下也能端到端跑通并可回归。
 *
 * 覆盖的接口面(全部照线上实测形状复刻,docs/raccoon-relay-api.md 有取证记录):
 *   POST /api/web/auth/v1/send_sms                 发码(本地直接回显码,不接运营商)
 *   POST /api/web/auth/v1/register                 注册(phone/password 真解密,验码)
 *   GET  /api/web/auth/v1/user_info                用户态 + registration_attribution
 *   GET  /api/web/points/v1/balance                available/daily/monthly/reward/topup
 *   GET  /api/web/points/v1/tasks                  新手任务态
 *   GET  /api/web/points/v2/bills                  积分流水(分页)
 *   POST /api/web/desktop/v1/login/points/grant    桌面端登录奖励(一次性 3000)+ 每日 300
 *   POST /api/web/mobile/v1/login/points/grant     移动端登录奖励(一次性 3000)
 *   GET  /api/web/llm/v2/model_catalog             模型目录
 *   POST /api/web/llm/v2/chat/completions          对话(OpenAI 兼容,含 SSE)
 *
 * 与真站**刻意不同**的地方(避免把 mock 当真相):
 * - 码不经过运营商: `send_sms` 在 `data.mock_code` 回显,并打印到本进程 stdout。
 * - `captcha_token` 默认不校验(本地没有阿里云),`--strict-captcha` 可打开。
 * - 账号存内存,进程退出即清;不做持久化(避免留下假账号壳)。
 * - 已注册手机号的错误码值未实证,mock 内部约定 100009 + `phone_registered`。
 *
 * 只监听 127.0.0.1: 模拟上游是一个测试替身,不能暴露到局域网/公网。
 *
 * 用法:
 *   node scripts/raccoon-mock-upstream.mjs                      # 127.0.0.1:8899
 *   node scripts/raccoon-mock-upstream.mjs --port 0 --json       # 随机端口,输出一行 JSON 供脚本抓
 *   node scripts/raccoon-mock-upstream.mjs --seed 13100000000,13200000000
 *   node scripts/raccoon-mock-upstream.mjs --random-code         # 每号一码(更接近真站)
 *
 * 配合 CLI(另开一个终端):
 *   node scripts/raccoon-pool-tasks.mjs --base http://127.0.0.1:8899 --token <mock token> --claim --claim-new-user --bills
 */
import http from 'node:http'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decryptCredential } from './lib/raccoon-crypto.mjs'

/** 积分口径(与线上流水实测一致:注册礼包 3000 / 桌面端 3000 / 移动端 3000 / 每日 300) */
export const POINTS = Object.freeze({
  REGISTER_PACK: 3000,
  DESKTOP_ONCE: 3000,
  MOBILE_ONCE: 3000,
  DAILY: 300,
})

/** 新手任务键(与 ai-service NEW_USER_TASKS 同集合) */
export const NEW_USER_TASK_KEYS = Object.freeze(['register_pack', 'desktop_login', 'mobile_login'])

const DEFAULT_CODE = '123456'
const DEFAULT_PORT = 8899
const DEFAULT_SEED_PHONES = Object.freeze(['13100000000'])

// =============================================================================
// 状态与账号
// =============================================================================

function today() {
  return new Date().toISOString().slice(0, 10)
}

function nowIso() {
  return new Date().toISOString()
}

function createState() {
  return {
    uidSeq: 0,
    accounts: [],
    byUid: new Map(),
    byToken: new Map(),
    byPhone: new Map(),
    smsByPhone: new Map(),
    registers: [],
    grantCalls: [],
    seedPhones: [],
  }
}

/** 记一笔流水并加余额。bucket 决定进哪一个分项(daily 每日额度 / reward 任务奖励) */
function credit(acct, points, { bizType, eventName, bucket = 'reward' }) {
  acct.points.available += points
  acct.points[bucket] = (acct.points[bucket] ?? 0) + points
  acct.bills.unshift({ created_at: nowIso(), biz_type: bizType, event_name: eventName, points })
  if (acct.bills.length > 200) acct.bills.length = 200
}

/**
 * 造一枚 JWT 形状的假令牌(三段 base64url)。真站发的是 JWT,引擎侧 `_validate_token` 会按
 * 三段形状先淘汰非法令牌 —— mock 若发非 JWT 串,引擎会在打网络前就判 SessionDead,
 * 那样"在 mock 上演练签到"根本进不去。签名是假的: mock 不验签,只提供形状。
 */
function makeMockJwt(uid, phone) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const iat = Math.floor(Date.now() / 1000)
  return [
    b64({ alg: 'HS256', typ: 'JWT' }),
    b64({ sub: uid, uid, phone, iat, exp: iat + 7 * 86400, iss: 'raccoon-mock' }),
    crypto.randomBytes(16).toString('base64url'),
  ].join('.')
}

function createAccount(state, { phone, password, nationCode = '86', registrationAttribution = null, seeded = false }) {
  state.uidSeq += 1
  const uid = String(880000 + state.uidSeq)
  const token = makeMockJwt(uid, phone)
  const acct = {
    uid,
    phone,
    password,
    nationCode,
    token,
    createdAt: nowIso(),
    seeded,
    points: { available: 0, daily: 0, monthly: 0, reward: 0, topup: 0 },
    newUserTasks: Object.fromEntries(NEW_USER_TASK_KEYS.map((k) => [k, 'unfinished'])),
    registrationAttribution,
    lastDailyGrantDay: null,
    bills: [],
  }
  state.accounts.push(acct)
  state.byUid.set(uid, acct)
  state.byToken.set(token, acct)
  state.byPhone.set(phone, acct)
  return acct
}

/** 注册礼包:线上实测注册即到账 3000 且 register_pack 立刻 completed */
function applyRegisterPack(acct) {
  if (acct.newUserTasks.register_pack === 'completed') return
  applyGrant(acct, POINTS.REGISTER_PACK, { bizType: 'register_pack', eventName: '注册礼包' })
  acct.newUserTasks.register_pack = 'completed'
}

function applyGrant(acct, points, { bizType, eventName, bucket = 'reward' }) {
  credit(acct, points, { bizType, eventName, bucket })
}

/**
 * 登录发放(桌面/移动同一套结算逻辑)。
 * 一次调用把所有应发项都发掉,`popup` 只回带金额最大的一笔 —— 线上实测单次调用后流水出现
 * 多笔(桌面 3000 + 每日 300),`popup` 仅报其中一笔,这里按观测形状复刻。
 * @returns {{granted:boolean, popup:object|null}}
 */
function grantLogin(acct, channel) {
  const items = []
  if (channel === 'desktop') {
    if (acct.newUserTasks.desktop_login !== 'completed') {
      items.push({ source: 'desktop_login', displayName: '桌面端登录奖励', points: POINTS.DESKTOP_ONCE, bucket: 'reward', task: 'desktop_login' })
    }
    if (acct.lastDailyGrantDay !== today()) {
      items.push({ source: 'daily_grant', displayName: '每日登录额度', points: POINTS.DAILY, bucket: 'daily', task: null })
    }
  } else if (channel === 'mobile') {
    if (acct.newUserTasks.mobile_login !== 'completed') {
      items.push({ source: 'mobile_login', displayName: '移动端登录奖励', points: POINTS.MOBILE_ONCE, bucket: 'reward', task: 'mobile_login' })
    }
  } else {
    throw new Error(`unknown channel: ${channel}`)
  }

  if (items.length === 0) return { granted: false, popup: null }

  for (const it of items) {
    applyGrant(acct, it.points, { bizType: it.source, eventName: it.displayName, bucket: it.bucket })
    if (it.task) acct.newUserTasks[it.task] = 'completed'
    if (it.source === 'daily_grant') acct.lastDailyGrantDay = today()
  }
  const top = items.reduce((a, b) => (b.points > a.points ? b : a))
  return {
    granted: true,
    popup: {
      source: top.source,
      display_name: top.displayName,
      points: top.points,
      expire_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    },
  }
}

// =============================================================================
// HTTP 工具
// =============================================================================

function json(res, status, obj) {
  const body = JSON.stringify(obj)
  if (res.headersSent) return
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) })
  res.end(body)
}

const ok = (res, data) => json(res, 200, { code: 0, message: 'success', data })

/** 业务错误:HTTP 状态与业务码分开传,复刻线上 400 + code 的组合 */
const fail = (res, status, code, message, details) =>
  json(res, status, { code, message, ...(details === undefined ? {} : { details }) })

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 1_000_000) reject(new Error('body too large'))
    })
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

function parseJson(raw) {
  try {
    const o = JSON.parse(raw)
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null
  } catch {
    return null
  }
}

function bearer(req) {
  const h = String(req.headers.authorization || '')
  return h.startsWith('Bearer ') ? h.slice(7).trim() : ''
}

/** 解密一个敏感字段;失败 ⇒ null(调用方按真站措辞报 param ... encrypted error) */
function dec(value) {
  if (typeof value !== 'string' || !value) return null
  try {
    return decryptCredential(value)
  } catch {
    return null
  }
}

// =============================================================================
// 路由
// =============================================================================

function createHandler(state, opts) {
  const sendCode = (phone) => {
    if (opts.randomCode) {
      const code = String(crypto.randomInt(100000, 1000000))
      state.smsByPhone.set(phone, code)
      return code
    }
    state.smsByPhone.set(phone, opts.code)
    return opts.code
  }

  return async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    const p = url.pathname
    const method = req.method || 'GET'

    try {
      // ── 发码 ──────────────────────────────────────────────────────
      if (p === '/api/web/auth/v1/send_sms' && method === 'POST') {
        const body = parseJson(await readBody(req))
        if (!body) return fail(res, 400, 100004, 'params_unsupport_error')
        if (opts.strictCaptcha && !body.captcha_token) {
          return fail(res, 400, 100010, 'captcha_verify_error', 'mock --strict-captcha 已开启')
        }
        const phone = dec(body.phone)
        if (!phone) return fail(res, 400, 100003, 'params_encryted_error', 'param phone encrypted error')
        if (!/^\d{6,15}$/.test(phone)) return fail(res, 400, 100002, 'param phone error')
        const code = sendCode(phone)
        if (!opts.quiet) opts.log(`[mock] send_sms → ${maskPhone(phone)} code=${code}`)
        return ok(res, { sent: true, expires_in: 300, mock_code: code, mock: true })
      }

      // ── 注册 ──────────────────────────────────────────────────────
      if (p === '/api/web/auth/v1/register' && method === 'POST') {
        const body = parseJson(await readBody(req))
        if (!body) return fail(res, 400, 100004, 'params_unsupport_error')
        const phone = dec(body.phone)
        if (!phone) return fail(res, 400, 100003, 'params_encryted_error', 'param phone encrypted error')
        const password = dec(body.password)
        if (!password) return fail(res, 400, 100003, 'params_encryted_error', 'param password encrypted error')
        if (!/^\d{6,15}$/.test(phone)) return fail(res, 400, 100002, 'param phone error')

        const record = {
          phone,
          passwordLen: password.length,
          code: body.code === null || body.code === undefined ? null : String(body.code),
          nation_code: body.nation_code ?? null,
        }
        state.registers.push(record)

        if (state.byPhone.has(phone)) return fail(res, 400, 100009, 'phone_registered', '手机号已注册(mock 约定码值)')

        const expected = state.smsByPhone.get(phone)
        if (!expected || String(body.code ?? '') !== expected) {
          return fail(res, 400, 100007, 'sms_code_verify_error', 'sms code verify failed')
        }
        state.smsByPhone.delete(phone) // 一次性

        const acct = createAccount(state, { phone, password, nationCode: String(body.nation_code ?? '86') })
        applyRegisterPack(acct)
        return ok(res, { access_token: acct.token, id: acct.uid, phone: acct.phone })
      }

      // ── 以下都需要 Bearer ─────────────────────────────────────────
      const token = bearer(req)
      const acct = token ? state.byToken.get(token) : null
      const needsAuth = p.startsWith('/api/web/')
      if (needsAuth && !acct) return json(res, 401, { code: 401, message: 'unauthorized' })

      if (p === '/api/web/auth/v1/user_info' && method === 'GET') {
        return ok(res, {
          id: acct.uid,
          phone: acct.phone,
          nickname: `mock-${acct.uid}`,
          nation_code: acct.nationCode,
          registration_attribution: acct.registrationAttribution ?? { registration_source: 'web' },
        })
      }

      if (p === '/api/web/points/v1/balance' && method === 'GET') {
        return ok(res, {
          available_points: acct.points.available,
          daily_points: acct.points.daily,
          monthly_points: acct.points.monthly,
          reward_points: acct.points.reward,
          topup_points: acct.points.topup,
          owner_id: Number(acct.uid),
        })
      }

      if (p === '/api/web/points/v1/tasks' && method === 'GET') {
        return ok(res, {
          new_user_task_states: NEW_USER_TASK_KEYS.map((k) => ({ key: k, status: acct.newUserTasks[k] })),
        })
      }

      if (p === '/api/web/points/v2/bills' && method === 'GET') {
        const page = Math.max(1, Number(url.searchParams.get('page') || 1))
        const size = Math.min(100, Math.max(1, Number(url.searchParams.get('page_size') || 10)))
        const start = (page - 1) * size
        return ok(res, {
          items: acct.bills.slice(start, start + size),
          total: acct.bills.length,
          page,
          page_size: size,
        })
      }

      if (p === '/api/web/desktop/v1/login/points/grant' && method === 'POST') {
        const r = grantLogin(acct, 'desktop')
        state.grantCalls.push({ uid: acct.uid, channel: 'desktop', granted: r.granted, platform: req.headers['x-client-platform'] ?? null })
        return ok(res, { granted: r.granted, popup: r.popup })
      }

      if (p === '/api/web/mobile/v1/login/points/grant' && method === 'POST') {
        const r = grantLogin(acct, 'mobile')
        state.grantCalls.push({ uid: acct.uid, channel: 'mobile', granted: r.granted, platform: req.headers['x-client-platform'] ?? null })
        return ok(res, { granted: r.granted, popup: r.popup })
      }

      if (p === '/api/web/llm/v2/model_catalog' && method === 'GET') {
        return ok(res, {
          models: [
            { id: 'SenseNova-6.8-Flash', name: 'SenseNova 6.8 Flash' },
            { id: 'mock-model-chat', name: 'mock chat' },
          ],
        })
      }

      if (p === '/api/web/llm/v2/chat/completions' && method === 'POST') {
        const body = parseJson(await readBody(req)) ?? {}
        const model = String(body.model || 'SenseNova-6.8-Flash')
        const content = '这是本地模拟上游的回复(mock),不消耗任何真实积分。'
        const id = `chatcmpl-mock-${crypto.randomBytes(6).toString('hex')}`
        const created = Math.floor(Date.now() / 1000)
        if (body.stream) {
          res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' })
          for (const piece of [content.slice(0, 12), content.slice(12)]) {
            res.write(
              `data: ${JSON.stringify({
                id,
                object: 'chat.completion.chunk',
                created,
                model,
                choices: [{ index: 0, delta: { content: piece } }],
              })}\n\n`,
            )
          }
          res.write('data: [DONE]\n\n')
          return res.end()
        }
        return ok(res, {
          id,
          object: 'chat.completion',
          created,
          model,
          choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 8, completion_tokens: content.length, total_tokens: 8 + content.length },
        })
      }

      return json(res, 404, { code: 404, message: '404 page not found' })
    } catch (e) {
      if (!res.headersSent) json(res, 500, { code: 500, message: 'mock_internal_error', details: String(e?.message || e) })
    }
  }
}

function maskPhone(p) {
  return p.length === 11 ? `${p.slice(0, 3)}****${p.slice(-4)}` : p
}

/**
 * 起一个模拟上游(测试直接 import 调用,不要起子进程 —— 同进程 spawnSync 会自死锁)。
 * @param {object} [options]
 * @param {number} [options.port] 默认 8899,`0` 表示随机
 * @param {string} [options.code] 固定短信码,默认 123456
 * @param {boolean} [options.randomCode] 每号一码
 * @param {string[]} [options.seedPhones] 预置主号,默认 ['13100000000']
 * @param {boolean} [options.quiet] 不打印请求日志
 * @param {boolean} [options.strictCaptcha] 发码强制要 captcha_token
 * @param {(msg:string)=>void} [options.log] 日志出口
 */
export async function createMockUpstream(options = {}) {
  const state = createState()
  const log = options.log ?? ((m) => console.log(m))
  const opts = {
    code: String(options.code ?? DEFAULT_CODE),
    randomCode: Boolean(options.randomCode),
    quiet: Boolean(options.quiet),
    strictCaptcha: Boolean(options.strictCaptcha),
    log,
  }
  const seedPhones = Array.isArray(options.seedPhones) && options.seedPhones.length ? options.seedPhones : [...DEFAULT_SEED_PHONES]
  const seeds = seedPhones.map((phone) => {
    const acct = createAccount(state, { phone, password: 'mock-seed-password', seeded: true })
    applyRegisterPack(acct)
    return acct
  })
  state.seedPhones = seedPhones

  const server = http.createServer(createHandler(state, opts))
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(Number(options.port ?? DEFAULT_PORT), '127.0.0.1', resolve)
  })
  const { port } = server.address()
  const base = `http://127.0.0.1:${port}`
  return {
    server,
    state,
    base,
    port,
    seeds,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
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

async function main() {
  const { flags, vals } = parseArgs(process.argv.slice(2))
  if (flags.has('help')) {
    console.log('用法:node scripts/raccoon-mock-upstream.mjs [--port 8899] [--code 123456] [--random-code]')
    console.log('       [--seed 13100000000,13200000000] [--quiet] [--strict-captcha] [--json]')
    console.log('  仅监听 127.0.0.1,账号存内存,退出即清。')
    return 0
  }
  const seedPhones = typeof vals.seed === 'string' ? vals.seed.split(',').map((s) => s.trim()).filter(Boolean) : undefined
  const m = await createMockUpstream({
    port: vals.port === undefined ? DEFAULT_PORT : Number(vals.port),
    code: vals.code,
    randomCode: flags.has('random-code'),
    seedPhones,
    quiet: flags.has('quiet'),
    strictCaptcha: flags.has('strict-captcha'),
  })

  if (flags.has('json')) {
    console.log(
      JSON.stringify({
        base: m.base,
        port: m.port,
        code: m.state.smsByPhone.size === 0 ? (flags.has('random-code') ? null : String(vals.code ?? DEFAULT_CODE)) : null,
        seeds: m.seeds.map((a) => ({ phone: a.phone, uid: a.uid, token: a.token })),
      }),
    )
  } else {
    console.log('[mock] 小浣熊模拟上游已启动')
    console.log(`  base      ${m.base}`)
    console.log(`  短信码    ${flags.has('random-code') ? '每号一码(send_sms 响应里回显 mock_code)' : String(vals.code ?? DEFAULT_CODE)}`)
    for (const a of m.seeds) console.log(`  主号      ${a.phone} uid=${a.uid}`)
    for (const a of m.seeds) console.log(`             token=${a.token}`)
    console.log('  提示      仅监听 127.0.0.1,账号存内存,仅用于本地演练;真实注册仍需机主本人手机收码')
    console.log('  停止      Ctrl+C')
  }
  return null // 常驻
}

const isDirectRun = (() => {
  try {
    return process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
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

export const __test__ = { createState, createAccount, applyRegisterPack, grantLogin, maskPhone, parseArgs }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
