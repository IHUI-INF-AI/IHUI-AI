// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Trae 协议层 HTTP 真跑验收(2026-10-23 立)。
 *
 * 立因:此前 Trae 适配器的全部用例都是 vi.fn() 打桩 fetch,**从未走过一次真 socket**;
 * 真上游联调又被卡在鉴权面(本机 IDE 凭证 401/1001、ExchangeToken 20101)。
 * 本用例把上游换成本机假 Trae(按线上 bundle 实证的端点/帧形状实现),
 * 让"我们这侧的协议实现"第一次被真实 HTTP 往返量到 —— 不发任何真实上游请求。
 *
 * 覆盖面:请求头指纹、创建回合体形状、SSE 帧翻译、tokenusage、stop 收尾、
 * 401 → ExchangeToken 换票、error 帧 → 风控分类。
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

interface Seen {
  path: string
  method: string
  headers: NodeJS.Dict<string | string[]>
  body: string
}

let server: Server
let base = ''
const seen: Seen[] = []
/** 上游剧本:每次请求按队列决定返回什么(测 401 自愈用) */
let createStatus = 200
let eventsFrames: 'ok' | 'risk' | 'real' = 'ok'
/** 健康检查端点剧本(测三态定级):500 = 上游故障,401 = 凭据被拒 */
let modelListStatus = 200
let userTokenStatus = 200
/** 设备证明通道剧本(测产品线组合兜底):ide-ok = 首发即成功 / solo-only = 仅 SOLO 线可续 / reject = 全拒 */
let proofMode: 'ide-ok' | 'solo-only' | 'reject' = 'ide-ok'

/** 线上真形状帧(2026-10-23 真号抓帧实证):正文住 thought(累积快照,可重复),
 * 推理增量住 reasoning_content;usage 帧字段为 input/output/prompt_tokens/completion_tokens。 */
const REAL_SHAPE_FRAMES = [
  'event: message\ndata: {"id":"pi_1","task_id":"t1","thought":"","reasoning_content":"思考"}\n\n',
  'event: message\ndata: {"id":"pi_1","thought":"","reasoning_content":"中"}\n\n',
  'event: message\ndata: {"id":"pi_1","thought":"好的","reasoning_content":"完毕"}\n\n',
  'event: message\ndata: {"id":"pi_1","thought":"好的","reasoning_content":"完毕"}\n\n',
  'event: usage\ndata: {"input":10,"output":2,"prompt_tokens":10,"completion_tokens":2,"reasoning_tokens":8,"total_tokens":12}\n\n',
  'event: done\ndata: {}\n\n',
]

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let text = ''
    req.on('data', (c: Buffer) => {
      text += c.toString('utf8')
    })
    req.on('end', () => resolve(text))
  })
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  const text = JSON.stringify(payload)
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(text)
}

function sse(res: ServerResponse, frames: string[]): void {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  for (const f of frames) res.write(f)
  res.end()
}

const MODEL_CONFIGS = {
  model_configs: [
    {
      name: 'auto',
      model_name: 'auto',
      display_model_name: 'Auto',
      is_preset: true,
      use_remote_service: true,
      config_source: 'preset',
      config_name: 'auto',
      provider: 'trae',
      multimodal: false,
      prompt_max_tokens: 200000,
      support_thinking: false,
    },
  ],
}

/** 上游剧本:余额端点返回码(测 401 归 ok:false) */
let entUsageStatus = 200

/**
 * 积分余额端点线上实证 200 回包(2026-10-23,Authorization: Cloud-IDE-JWT ⇒ 200)。
 * 逐字保留判据相关键位:包名只有 display_desc/group_name(无 name 键),
 * 到期在 expire_time 与 entitlement_base_info.end_time(秒),credits_limit 在 quota 内。
 * 第二枚包按实证截断处只留已见键(免费包无 quota.credits_limit ⇒ 认不出就该 undefined)。
 */
const ENT_USAGE_BODY = {
  is_credits_billing: true,
  is_dollar_usage_billing: false,
  is_pay_freshman: true,
  trial_status: { is_eligible_for_trial: false, is_in_trial: false },
  usage_summary: {
    consumed_amount: 4502.1,
    consumption_ratio: 0.9787173913043479,
    total_amount: 4600,
  },
  user_entitlement_pack_list: [
    {
      display_desc: '老用户福利',
      entitlement_base_info: {
        end_time: 1795334916,
        quota: { credits_limit: 4000, no_bonus_quota: true },
      },
      expire_time: 1795334916,
      group_name: '用户福利',
      quota: { credits_limit: 4000, no_bonus_quota: true },
      usage: { credits_amount: 4000 },
    },
    {
      display_desc: '免费',
      entitlement_base_info: { end_time: 1793462399 },
      group_name: '免费',
    },
  ],
}

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const body = await readBody(req)
    const url = req.url ?? ''
    seen.push({ path: url, method: req.method ?? '', headers: req.headers, body })

    if (url.startsWith('/api/ide/v1/model_list')) {
      if (modelListStatus !== 200) return json(res, modelListStatus, { code: modelListStatus })
      return json(res, 200, MODEL_CONFIGS)
    }
    if (url.startsWith('/oauth/ExchangeToken')) {
      return json(res, 200, {
        Result: { Token: 'jwt-rotated', RefreshToken: 'rt-2', ExpiredAt: 1_893_456_000 },
      })
    }
    // 新版设备证明换票:按剧本模拟"产品线不匹配"(10101)与成功
    if (url.startsWith('/trae/api/v3/oauth/ExchangeToken')) {
      const parsed = JSON.parse(body || '{}') as { ClientID?: string; DeviceInfo?: { PlatformCode?: string } }
      if (proofMode === 'reject') {
        return json(res, 400, {
          ResponseMetadata: { Error: { Code: 10101, Message: 'refresh token is not matched to the client' } },
        })
      }
      if (proofMode === 'solo-only' && parsed.DeviceInfo?.PlatformCode !== 'SOLO_PC') {
        return json(res, 400, {
          ResponseMetadata: { Error: { Code: 10101, Message: 'refresh token is not matched to the client' } },
        })
      }
      return json(res, 200, {
        Result: { Token: proofMode === 'solo-only' ? 'jwt-proof-solo' : 'jwt-proof-ide', RefreshToken: 'rt-proof-2', TokenExpireAt: 1_893_456_000 },
      })
    }
    // web 官网 cookie 换票(线上实证:credentials:'include',无 body;有 cookie → 新 JWT)
    if (url.endsWith('/common/GetUserToken') && req.method === 'POST') {
      const cookie = req.headers.cookie
      if (!cookie || !cookie.includes('sessionid=')) {
        return json(res, 401, { ResponseMetadata: { Error: { Code: '20101' } } })
      }
      if (userTokenStatus !== 200) return json(res, userTokenStatus, { code: userTokenStatus })
      return json(res, 200, {
        Result: {
          Token: 'jwt-from-cookie',
          ExpiredAt: 1_893_456_000,
          UserID: 'u1',
          TenantID: 't1',
        },
      })
    }
    if (url.endsWith('/chat_sessions') && req.method === 'POST') {
      if (createStatus === 401) return json(res, 401, { code: 1001, message: 'unauthorized' })
      return json(res, 200, { data: { chat_session_id: 'cs-http-1', message_id: 'ms-http-1' } })
    }
    if (url.includes('/events')) {
      if (eventsFrames === 'risk') {
        return sse(res, [
          'event: message\ndata: {"delta":"部"}\n\n',
          'event: error\ndata: {"code":4015,"message":"账号或 IP 存在风险"}\n\n',
        ])
      }
      if (eventsFrames === 'real') return sse(res, REAL_SHAPE_FRAMES)
      return sse(res, [
        'event: message\ndata: {"delta":"你好"}\n\n',
        'event: message\ndata: {"delta":"，世界"}\n\n',
        'event: tokenusage\ndata: {"input_tokens":11,"output_tokens":4}\n\n',
        'event: done\ndata: {}\n\n',
      ])
    }
    if (url.endsWith('/stop')) return json(res, 200, { code: 0 })
    // 积分余额(线上实证:带 Cloud-IDE-JWT ⇒ 200;无凭据 ⇒ 401 body.code=1001)
    if (url.endsWith('/pay/web_user_ent_usage')) {
      if (entUsageStatus !== 200) {
        return json(res, entUsageStatus, {
          code: 1001,
          message: 'not able to authenticate you',
          usage_summary: {},
          user_entitlement_pack_list: [],
        })
      }
      return json(res, 200, ENT_USAGE_BODY)
    }
    return json(res, 404, { code: 404 })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  // 端点覆写必须在 import 适配器之前(常量是模块级的)
  process.env.NODE_ENV = 'test'
  process.env.TRAE_REMOTE_BASE = `${base}/api/remote/v1`
  process.env.TRAE_MODEL_LIST_URL = `${base}/api/ide/v1/model_list?type=chat`
  process.env.TRAE_EXCHANGE_TOKEN_URL = `${base}/oauth/ExchangeToken`
  process.env.TRAE_EXCHANGE_TOKEN_PROOF_URL = `${base}/trae/api/v3/oauth/ExchangeToken`
  process.env.TRAE_GET_USER_TOKEN_URL = `${base}/cloudide/api/v3/common/GetUserToken`
  process.env.TRAE_ENT_USAGE_URL = `${base}/trae/api/v2/pay/web_user_ent_usage`
})

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()))
  delete process.env.TRAE_REMOTE_BASE
  delete process.env.TRAE_MODEL_LIST_URL
  delete process.env.TRAE_EXCHANGE_TOKEN_URL
  delete process.env.TRAE_EXCHANGE_TOKEN_PROOF_URL
  delete process.env.TRAE_GET_USER_TOKEN_URL
  delete process.env.TRAE_ENT_USAGE_URL
})

async function loadAdapter() {
  const mod = await import('../src/services/upstream-adapters/trae-adapter.js')
  return mod
}

function makeCtx(token = 'jwt-original') {
  return {
    row: {
      id: 'acct-http-1',
      providerCode: 'trae',
      uid: 'uid-http-1',
      name: '协议线测试号',
      proxyUrl: null,
    } as never,
    credentials: { token, refreshToken: 'rt-original', cookies: [], secrets: {} },
  }
}

const CHAT_REQ = {
  model: 'auto',
  messages: [{ role: 'user', content: '说句话' }],
  stream: true,
} as never

describe('Trae 协议层 · 真 HTTP 往返(本机假上游)', () => {
  it('流式:创建回合 → SSE 翻译 → tokenusage → stop 收尾', async () => {
    const { traeAdapter } = await loadAdapter()
    seen.length = 0
    createStatus = 200

    const res = await traeAdapter.executeChat!(makeCtx(), CHAT_REQ, {})
    expect(res.stream).toBeTruthy()

    const chunks: Array<Record<string, unknown>> = []
    for await (const c of res.stream!) chunks.push(c as Record<string, unknown>)

    const text = chunks
      .flatMap((c) =>
        Array.isArray(c.choices) ? (c.choices as Array<Record<string, unknown>>) : [],
      )
      .map((ch) => (ch.delta as { content?: string } | undefined)?.content ?? '')
      .join('')
    expect(text).toBe('你好，世界')
    expect(chunks.some((c) => c.usage)).toBe(true)

    const paths = seen.map((s) => `${s.method} ${s.path.split('?')[0]}`)
    expect(paths).toContain(`POST ${'/api/remote/v1/chat_sessions'}`)
    expect(paths.some((p) => p.includes('/events'))).toBe(true)

    // stop 是尽力而为的异步收尾:等一拍再断言
    await new Promise((r) => setTimeout(r, 150))
    expect(seen.some((s) => s.path.endsWith('/stop'))).toBe(true)
    const stop = seen.find((s) => s.path.endsWith('/stop'))
    expect(JSON.parse(stop!.body)).toMatchObject({
      chat_session_id: 'cs-http-1',
      user_message_id: 'ms-http-1',
    })
  })

  it('线上真形状:正文住 thought 累积快照(重复帧不重复),推理住 reasoning_content,usage 真字段', async () => {
    const { traeAdapter } = await loadAdapter()
    seen.length = 0
    createStatus = 200
    eventsFrames = 'real'
    try {
      const res = await traeAdapter.executeChat!(makeCtx(), CHAT_REQ, {})
      expect(res.stream).toBeTruthy()

      const chunks: Array<Record<string, unknown>> = []
      for await (const c of res.stream!) chunks.push(c as Record<string, unknown>)

      const choices = chunks.flatMap((c) =>
        Array.isArray(c.choices) ? (c.choices as Array<Record<string, unknown>>) : [],
      )
      const text = choices
        .map((ch) => (ch.delta as { content?: string } | undefined)?.content ?? '')
        .join('')
      const reasoning = choices
        .map(
          (ch) => (ch.delta as { reasoning_content?: string } | undefined)?.reasoning_content ?? '',
        )
        .join('')
      expect(text).toBe('好的')
      expect(reasoning).toBe('思考中完毕')
      const usage = chunks.find((c) => c.usage) as { usage?: Record<string, number> } | undefined
      expect(usage?.usage?.prompt_tokens).toBe(10)
      expect(usage?.usage?.completion_tokens).toBe(2)
      // thought 重复快照不得产出第二帧 content
      expect(choices.filter((ch) => (ch.delta as { content?: string })?.content).length).toBe(1)
    } finally {
      eventsFrames = 'ok'
    }
  })

  it('web 号无 refreshToken 但有 cookies → GetUserToken cookie 换票成功', async () => {
    const { traeAdapter } = await loadAdapter()
    seen.length = 0
    const ctx = makeCtx('jwt-stale')
    ;(ctx.credentials as { refreshToken: string | null }).refreshToken = null
    ;(ctx.credentials as { cookies: unknown[] }).cookies = [
      { name: 'sessionid', value: 'abc', domain: '.trae.cn', path: '/' },
      { name: 'csrftoken', value: 'xyz', domain: '.trae.cn', path: '/' },
    ]
    const res = await traeAdapter.refreshToken!(ctx, {})
    expect(res).toBeTruthy()
    expect(res!.token).toBe('jwt-from-cookie')
    // refreshToken 返回 undefined = 调度器保留原值(web 号本无 rt)
    expect(res!.refreshToken).toBeUndefined()
    expect(res!.expiresAt).toBeTruthy()
    // 换票请求必须带 Cookie 头且无 Authorization
    const gt = seen.find((s) => s.path.endsWith('/common/GetUserToken'))
    expect(gt).toBeTruthy()
    expect(gt!.method).toBe('POST')
    expect(gt!.headers.cookie).toContain('sessionid=abc')
    expect(gt!.headers.authorization).toBeUndefined()
  })

  it('cookie 换票 401 且有 refreshToken → 落回 ExchangeToken', async () => {
    const { traeAdapter } = await loadAdapter()
    seen.length = 0
    const ctx = makeCtx('jwt-stale')
    ;(ctx.credentials as { cookies: unknown[] }).cookies = [{ name: 'other', value: 'no-session' }]
    const res = await traeAdapter.refreshToken!(ctx, {})
    expect(res).toBeTruthy()
    expect(res!.token).toBe('jwt-rotated')
    expect(seen.some((s) => s.path.endsWith('/common/GetUserToken'))).toBe(true)
    expect(seen.some((s) => s.path.startsWith('/oauth/ExchangeToken'))).toBe(true)
  })

  it('无 refreshToken 也无 cookies → null(不抛)', async () => {
    const { traeAdapter } = await loadAdapter()
    const ctx = makeCtx('jwt-stale')
    ;(ctx.credentials as { refreshToken: string | null }).refreshToken = null
    await expect(traeAdapter.refreshToken!(ctx, {})).resolves.toBeNull()
  })

  it('设备证明通道:IDE 线 10101 → SOLO 线组合重试命中(产品线兜底)', async () => {
    const { traeAdapter } = await loadAdapter()
    seen.length = 0
    proofMode = 'solo-only'
    try {
      const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
      const ctx = makeCtx('jwt-stale')
      ;(ctx.row as unknown as { deviceId: string }).deviceId = '4355605738307003'
      ;(ctx.credentials as { secrets: Record<string, unknown> }).secrets = {
        deviceKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        devicePubPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      }
      const res = await traeAdapter.refreshToken!(ctx, {})
      expect(res).toBeTruthy()
      expect(res!.token).toBe('jwt-proof-solo')
      expect(res!.refreshToken).toBe('rt-proof-2')

      const proofReqs = seen.filter((s) => s.path.startsWith('/trae/api/v3/oauth/ExchangeToken'))
      expect(proofReqs).toHaveLength(2)
      const first = JSON.parse(proofReqs[0]!.body) as {
        ClientID: string
        DeviceInfo: { PlatformCode: string }
        DeviceProof: { Signature: string }
      }
      const second = JSON.parse(proofReqs[1]!.body) as {
        ClientID: string
        DeviceInfo: { PlatformCode: string }
      }
      // 首发默认 IDE 线,失败后换 SOLO 线(ClientID 与 PlatformCode 成对切换)
      expect(first.DeviceInfo.PlatformCode).toBe('IDE_PC')
      expect(first.ClientID).toBe('ono9krqynydwx5')
      expect(first.DeviceProof.Signature).toBeTruthy()
      expect(second.DeviceInfo.PlatformCode).toBe('SOLO_PC')
      expect(second.ClientID).toBe('en1oxy7wnw8j9n')
      // 旧通道不应被用到(设备证明已成功)
      expect(seen.some((s) => s.path.startsWith('/oauth/ExchangeToken'))).toBe(false)
    } finally {
      proofMode = 'ide-ok'
    }
  })

  it('设备证明全组合被拒(10101) → 落回旧 ExchangeToken 并以其错误口径抛出', async () => {
    const { traeAdapter } = await loadAdapter()
    seen.length = 0
    proofMode = 'reject'
    try {
      const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
      const ctx = makeCtx('jwt-stale')
      ;(ctx.row as unknown as { deviceId: string }).deviceId = '4355605738307003'
      ;(ctx.credentials as { secrets: Record<string, unknown> }).secrets = {
        deviceKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        devicePubPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      }
      await expect(traeAdapter.refreshToken!(ctx, {})).resolves.toBeTruthy()
      // 旧通道(假上游恒 200)兜底成功 —— 证明全拒时确实落回旧通道
      expect(seen.filter((s) => s.path.startsWith('/trae/api/v3/oauth/ExchangeToken'))).toHaveLength(2)
      expect(seen.some((s) => s.path.startsWith('/oauth/ExchangeToken'))).toBe(true)
    } finally {
      proofMode = 'ide-ok'
    }
  })

  it('请求指纹:Cloud-IDE-JWT + web 渠道头,且不得带 x-user-region', async () => {
    const { traeAdapter } = await loadAdapter()
    seen.length = 0
    await traeAdapter.executeChat!(makeCtx('jwt-fp'), CHAT_REQ, {})

    const create = seen.find((s) => s.path.endsWith('/chat_sessions') && s.method === 'POST')
    expect(create).toBeTruthy()
    const h = create!.headers
    expect(h.authorization).toBe('Cloud-IDE-JWT jwt-fp')
    expect(h['x-trae-client-type']).toBe('web')
    expect(h['x-trae-user-timezone']).toBeTruthy()
    expect(h.origin).toBe('https://solo.trae.cn')
    expect(h['x-user-region']).toBeUndefined()
    // 全链路无签名/nonce
    expect(Object.keys(h).some((k) => /signature|nonce|x-flow-traceparent/i.test(k))).toBe(false)

    const body = JSON.parse(create!.body) as Record<string, unknown>
    const initial = body.initial_message as Record<string, unknown>
    expect(typeof initial.query).toBe('string')
    const blocks = JSON.parse(String(initial.query)) as Array<Record<string, unknown>>
    expect(Array.isArray(blocks)).toBe(true)
    expect(blocks[0]).toMatchObject({ type: 'text' })
    expect(JSON.stringify(blocks[0])).toContain('说句话')
    // common_params 是 JSON 字符串(CN 渠道 scope/tenant=marscode,登录态带 biz_user_id)
    const cp = JSON.parse(String(initial.common_params)) as Record<string, unknown>
    expect(cp).toMatchObject({ scope: 'marscode', tenant: 'marscode', region: 'cn' })
    expect(cp.biz_user_id).toBe('uid-http-1')
    expect(initial.agent_type).toBe('solo_agent_remote')
  })

  it('401 → ExchangeToken 换票(该端点无 Authorization),新票可继续用', async () => {
    const { traeAdapter, TraeAuthFailureError } = await loadAdapter()
    seen.length = 0
    createStatus = 401
    await expect(traeAdapter.executeChat!(makeCtx(), CHAT_REQ, {})).rejects.toBeInstanceOf(
      TraeAuthFailureError,
    )
    createStatus = 200

    seen.length = 0
    const refreshed = await traeAdapter.refreshToken!(makeCtx() as never, {})
    expect(refreshed?.token).toBe('jwt-rotated')
    expect(refreshed?.refreshToken).toBe('rt-2')
    const ex = seen.find((s) => s.path.includes('ExchangeToken'))
    expect(ex).toBeTruthy()
    expect(ex!.headers.authorization).toBeUndefined()
    expect(ex!.body).toContain('ClientID')
    expect(ex!.body).toContain('rt-original')

    // 换票后同一条链路真跑通
    seen.length = 0
    createStatus = 200
    const res = await traeAdapter.executeChat!(makeCtx('jwt-rotated'), CHAT_REQ, {})
    let n = 0
    for await (const _c of res.stream!) n++
    expect(n).toBeGreaterThan(0)
  })

  it('健康检查与模型列表走 model_configs', async () => {
    const { traeAdapter } = await loadAdapter()
    const health = await traeAdapter.checkHealth(makeCtx() as never, {})
    expect(health.ok).toBe(true)
    const models = await traeAdapter.listModels!(makeCtx() as never, {})
    expect(models).toContain('auto')
  })
})

describe('Trae 健康检查 · 三态定级(真 HTTP)', () => {
  afterEach(() => {
    modelListStatus = 200
    userTokenStatus = 200
    entUsageStatus = 200
    seen.length = 0
  })

  function makeWebCtx() {
    return {
      row: { id: 'acct-web-1', providerCode: 'trae', uid: 'uid-web-1', proxyUrl: null } as never,
      credentials: {
        token: '',
        refreshToken: undefined,
        cookies: [{ name: 'sessionid', value: 's-1' }],
        secrets: {},
      },
    }
  }

  it('web 号(cookie)以 GetUserToken 自证:200 → healthy,且不再依赖 model_list', async () => {
    const { traeAdapter } = await loadAdapter()
    modelListStatus = 500 // 元数据面挂了也不影响凭据活性判定
    const health = await traeAdapter.checkHealth(makeWebCtx() as never, {})
    expect(health.ok).toBe(true)
    expect(health.indeterminate).toBeUndefined()
    expect(seen.some((s) => s.path.includes('GetUserToken'))).toBe(true)
    expect(seen.some((s) => s.path.includes('model_list'))).toBe(false)
  })

  it('web 号 cookie 被上游拒收 401 → 明确失败(非未判定,应写 down)', async () => {
    const { traeAdapter } = await loadAdapter()
    const ctx = makeWebCtx()
    // 有 cookie 头但不含 sessionid ⇒ 假上游按线上口径回 401
    ctx.credentials.cookies = [{ name: 'foo', value: 'bar' }]
    const health = await traeAdapter.checkHealth(ctx as never, {})
    expect(health.ok).toBe(false)
    expect(health.indeterminate).toBe(false)
  })

  it('web 号 GetUserToken 500 → 未判定(不得写 down)', async () => {
    const { traeAdapter } = await loadAdapter()
    userTokenStatus = 500
    const health = await traeAdapter.checkHealth(makeWebCtx() as never, {})
    expect(health.ok).toBe(false)
    expect(health.indeterminate).toBe(true)
    expect(health.error).toContain('500')
  })

  it('IDE 号(无 cookie)model_list 500 → 退 ent_usage 自证 200 ⇒ healthy', async () => {
    const { traeAdapter } = await loadAdapter()
    modelListStatus = 500
    const health = await traeAdapter.checkHealth(makeCtx() as never, {})
    expect(health.ok).toBe(true)
    expect(health.indeterminate).toBeUndefined()
    expect(seen.some((s) => s.path.includes('web_user_ent_usage'))).toBe(true)
  })

  it('IDE 号 model_list 500 且 ent_usage 401 → 明确 down(凭据真死了)', async () => {
    const { traeAdapter } = await loadAdapter()
    modelListStatus = 500
    entUsageStatus = 401
    const health = await traeAdapter.checkHealth(makeCtx() as never, {})
    expect(health.ok).toBe(false)
    expect(health.indeterminate).toBe(false)
    expect(health.authFailed).toBe(true)
    expect(health.error).toContain('ent_usage HTTP 401')
  })

  it('IDE 号 model_list 500 且 ent_usage 500 → 未判定(两侧都拿不到结论)', async () => {
    const { traeAdapter } = await loadAdapter()
    modelListStatus = 500
    entUsageStatus = 500
    const health = await traeAdapter.checkHealth(makeCtx() as never, {})
    expect(health.ok).toBe(false)
    expect(health.indeterminate).toBe(true)
  })

  it('IDE 号 model_list 401 → 明确失败(应写 down)', async () => {
    const { traeAdapter } = await loadAdapter()
    modelListStatus = 401
    const health = await traeAdapter.checkHealth(makeCtx() as never, {})
    expect(health.ok).toBe(false)
    expect(health.indeterminate).toBe(false)
  })
})

describe('Trae 协议层 · 风控帧分类(真 HTTP)', () => {
  it('error 帧 4015 → TraeUpstreamError 带业务码,分类为 risk', async () => {
    const { traeAdapter, TraeUpstreamError, classifyUpstreamFailure } = await loadAdapter()
    seen.length = 0
    eventsFrames = 'risk'
    let caught: unknown = null
    try {
      const res = await traeAdapter.executeChat!(makeCtx(), CHAT_REQ, {})
      for await (const _c of res.stream!) void _c
    } catch (e) {
      caught = e
    }
    eventsFrames = 'ok'
    expect(caught).toBeInstanceOf(TraeUpstreamError)
    expect((caught as InstanceType<typeof TraeUpstreamError>).upstreamCode).toBe('4015')
    expect(classifyUpstreamFailure(0, 'code:4015')).toBe('risk')
  })
})

describe('Trae 积分余额 getQuota(真 HTTP · 实证回包形状)', () => {
  it('200 实证包 ⇒ used/total/remaining/ratio 全对,包名与到期取自实证键位', async () => {
    const { traeAdapter } = await loadAdapter()
    seen.length = 0
    entUsageStatus = 200

    const out = await traeAdapter.getQuota!(makeCtx() as never, {})
    expect(out.ok).toBe(true)
    const q = out.quota!
    expect(q.used).toBe(4502.1)
    expect(q.total).toBe(4600)
    expect(q.remaining).toBeCloseTo(97.9, 6)
    expect(q.ratio).toBeCloseTo(0.9787173913043479, 12)
    expect(q.unit).toBe('trae 积分')

    // 回归锁①:包名真源是 display_desc(实证回包无 name 键 ⇒ 取 name 的写法恒 undefined)
    expect(q.packs?.[0]?.name).toBe('老用户福利')
    // 回归锁②:credits_limit 在 quota 内,免费包无 quota ⇒ 认不出就留空,不编 0
    expect(q.packs?.[0]?.limit).toBe(4000)
    expect(q.packs?.[1]?.limit).toBeUndefined()
    // 回归锁③:到期时刻在 expire_time / entitlement_base_info.end_time(秒),不在 quota 内
    expect(q.packs?.[0]?.endAt).toBe(new Date(1795334916 * 1000).toISOString())
    expect(q.packs?.[1]?.endAt).toBe(new Date(1793462399 * 1000).toISOString())
    // resetsAt = 最早到期那枚(不是第一枚 ⇒ 排序必须真做)
    expect(q.resetsAt).toBe(new Date(1793462399 * 1000).toISOString())

    const req = seen.find((s) => s.path.includes('/pay/web_user_ent_usage'))
    expect(req?.method).toBe('GET')
    expect(req?.headers.authorization).toBe('Cloud-IDE-JWT jwt-original')
  })

  it('带 cookie 的账号 ⇒ 余额请求同时带上 Cookie 头(线上 200 的取证形态是 JWT+cookie)', async () => {
    const { traeAdapter } = await loadAdapter()
    seen.length = 0
    entUsageStatus = 200
    const ctxWithCookies = {
      row: { id: 'acct-http-1', providerCode: 'trae', proxyUrl: null } as never,
      credentials: {
        token: 'jwt-original',
        refreshToken: null,
        cookies: [
          { name: 'sessionid', value: 'sid-1', domain: '.trae.cn', path: '/' },
          { name: 'd_ticket', value: 'dt-1', domain: '.trae.cn', path: '/' },
        ],
        secrets: {},
      },
    } as never
    const out = await traeAdapter.getQuota!(ctxWithCookies, {})
    expect(out.ok).toBe(true)
    const req = seen.find((s) => s.path.includes('/pay/web_user_ent_usage'))
    expect(req?.headers.authorization).toBe('Cloud-IDE-JWT jwt-original')
    expect(String(req?.headers.cookie)).toContain('sessionid=sid-1')
  })

  it('401 ⇒ ok:false 且带原因(不得把"取不到"写成余额 0),并给出 authFailed 供承载层自愈', async () => {
    const { traeAdapter } = await loadAdapter()
    entUsageStatus = 401
    const out = await traeAdapter.getQuota!(makeCtx() as never, {})
    entUsageStatus = 200
    expect(out.ok).toBe(false)
    expect(out.error).toContain('401')
    expect(out.authFailed).toBe(true)
    expect(out.quota).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
