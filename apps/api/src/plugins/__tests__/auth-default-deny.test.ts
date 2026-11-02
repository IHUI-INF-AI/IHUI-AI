// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 鉴权默认拒绝兜底闸的回归锁(2026-10-29 立)。
 *
 * 缺陷形状:api 的鉴权靠每个路由/插件自己手挂,新增路由忘挂即裸奔
 * (已实测 developer-relay-keys-admin 读 request.userId 却从未鉴权,碰巧恒 401)。
 *
 * 本文件钉四件事:
 *   D1 enforce 档:名单外 + 无凭据 ⇒ 401;
 *   D2 enforce 档:已有 userId(插件级/路由级鉴权跑过)⇒ 放行,**且不重复调 checkAuth**;
 *   D3 公开名单内的路径不受影响(误列/漏列直接决定会不会打挂线上);
 *   D4 observe / off 档不拦人(新开关默认不能改变线上行为)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5399/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { state, authCalls } = vi.hoisted(() => ({
  state: { mode: 'enforce' as string | undefined, env: 'test' as string },
  authCalls: { n: 0 },
}))

vi.mock('../../config/index.js', () => ({
  get config() {
    return { AUTH_DEFAULT_DENY_MODE: state.mode }
  },
  // 2026-11-01:生产运行时"缺这枚键"必须武装(不再静默 off)。缺省 'test' 保住既有用例
  // 的原语义(D4c 那条"测试里整对象替换 config ⇒ off")。
  get runtimeEnv() {
    return state.env
  },
}))

vi.mock('../../utils/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('../auth.js', () => ({
  checkAuth: vi.fn(async (request: any, reply: any) => {
    authCalls.n += 1
    if (request.headers.authorization === 'Bearer good') {
      request.userId = 'user-from-token'
      return true
    }
    reply.status(401).send({ code: 401, message: 'Authentication required' })
    return false
  }),
}))

import authDefaultDenyPlugin, { __test__ } from '../auth-default-deny.js'

describe('鉴权默认拒绝兜底闸', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    // 插件必须在路由注册前挂上(onRoute 才能捕获每条路由)
    await app.register(authDefaultDenyPlugin)
    app.get('/api/secret', async () => ({ ok: true }))
    // D7 专用:留痕用例要走"未被其他用例记过"的键(节流键含 tag+方法+路径,60s 一条)
    app.get('/api/secret-d7', async () => ({ ok: true }))
    app.get('/api/health', async () => ({ ok: true }))
    app.get('/api/auth/login', async () => ({ ok: true }))
    // 2026-11-01:三条按证据补入的公开面(见插件名单注释里的行号出处)
    app.get('/api/configs', async () => ({ ok: true }))
    app.get('/api/announcements', async () => ({ ok: true }))
    app.get('/api/ai-education/teacher-certification', async () => ({ ok: true }))
    // 2026-11-01:"凭据校验在 handler 内"的内部面。本用例只验**闸不抢跑**;
    // 真拒否发生在 handler 的 secretsEqual/内部票校验上(那一条另有各自的用例,不在这里冒充)。
    app.post('/api/ai/callback', async () => ({ ok: true }))
    app.post('/api/internal/relay/account-pool/credential', async () => ({ ok: true }))
    app.get('/api/memory', async () => ({ ok: true }))
    app.get('/api/chat/ws/zhipu', async () => ({ ok: true }))
    // 段边界反证:这条不在豁免清单里,不能被 `/api/memory` 顺带放过
    app.get('/api/memoryXYZ', async () => ({ ok: true }))
    app.get(
      '/api/with-route-auth',
      {
        preHandler: [
          async (request: FastifyRequest) => {
            ;(request as { userId?: string }).userId = 'already-authed'
          },
        ],
      },
      async () => ({ ok: true }),
    )
    // 上游 preHandler 直接 send(401) 后仍把链交给兜底闸 —— 生产实测过这一型:
    // 兜底再 send 一次会抛 "Reply was already sent",被全局处理器收敛成 500。
    app.get(
      '/api/upstream-401',
      {
        preHandler: [
          async (_request: FastifyRequest, reply: any) => {
            reply.status(401).send({ code: 401, message: 'upstream-denied' })
          },
        ],
      },
      async () => ({ ok: true }),
    )
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    state.mode = 'enforce'
    authCalls.n = 0
  })

  it('D1 enforce:名单外且无凭据 ⇒ 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/secret' })
    expect(res.statusCode).toBe(401)
    expect(authCalls.n).toBe(1)
  })

  it('D1b enforce:带有效凭据 ⇒ 200', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/secret',
      headers: { authorization: 'Bearer good' },
    })
    expect(res.statusCode).toBe(200)
  })

  it('D2 enforce:路由已有鉴权(已写 userId)⇒ 放行且不重复认证', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/with-route-auth' })
    expect(res.statusCode).toBe(200)
    expect(authCalls.n).toBe(0)
  })

  it('D2b 上游已 send(401) 时兜底闸不得二次 send —— 必须是 401 不是 500', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/upstream-401' })
    expect(res.statusCode).toBe(401)
    expect(res.json().message).toBe('upstream-denied')
    expect(authCalls.n).toBe(0)
  })

  it('D3 公开名单内(精确)⇒ 200 且不认证', async () => {
    for (const url of ['/api/health', '/api/metrics', '/.well-known/agent.json']) {
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode, url).not.toBe(401)
    }
    expect(authCalls.n).toBe(0)
  })

  it('D3b 公开名单内(前缀)⇒ 200 且不认证', async () => {
    for (const url of ['/api/auth/login', '/api/public/x', '/v1/chat/completions']) {
      const res = await app.inject({ method: 'GET', url })
      expect(res.statusCode, url).not.toBe(401)
    }
    expect(authCalls.n).toBe(0)
  })

  it('D4 observe:不拦人(只记日志),名单外无凭据也放行', async () => {
    state.mode = 'observe'
    const res = await app.inject({ method: 'GET', url: '/api/secret' })
    expect(res.statusCode).toBe(200)
    expect(authCalls.n).toBe(0)
  })

  it('D4b off:完全不介入', async () => {
    state.mode = 'off'
    const res = await app.inject({ method: 'GET', url: '/api/secret' })
    expect(res.statusCode).toBe(200)
    expect(authCalls.n).toBe(0)
  })

  it('D4c 未配置(测试 mock 整对象替换 config)⇒ off,零行为变化', () => {
    state.mode = undefined
    expect(__test__.resolveAuthDefaultDenyMode()).toBe('off')
  })

  // ── 2026-11-01 安全强化:生产运行时"什么都没写"不再是放行 ──────────────────
  // 立因:线上那枚 `AUTH_DEFAULT_DENY_MODE=enforce` 只存在于不进仓的本地 `.env`
  // (实测 D:\DevEnv\ihui-prod\apps\api\.env:10),而仓内 `.env.example` 从未登记它。
  // 于是一次 `.env` 整体替换(2026-09-26 实测发生过)就把兜底闸静默降成 off。
  // 这四格各自成对:缺省档只在生产翻转,显式声明一律优先。
  it('D4d 生产 + 缺该键 ⇒ 武装(不再静默 off)', () => {
    state.env = 'production'
    state.mode = undefined
    try {
      expect(__test__.resolveAuthDefaultDenyMode()).toBe('enforce')
    } finally {
      state.env = 'test'
    }
  })

  it('D4d-反证 开发/测试 + 缺该键 ⇒ 仍 off(不该误伤本地面)', () => {
    for (const env of ['development', 'test']) {
      state.env = env
      state.mode = undefined
      try {
        expect(__test__.resolveAuthDefaultDenyMode()).toBe('off')
      } finally {
        state.env = 'test'
      }
    }
  })

  it('D4e 生产 + 显式 off / observe ⇒ 显式优先,缺省档不夺权', () => {
    state.env = 'production'
    try {
      state.mode = 'off'
      expect(__test__.resolveAuthDefaultDenyMode()).toBe('off')
      state.mode = 'observe'
      expect(__test__.resolveAuthDefaultDenyMode()).toBe('observe')
      state.mode = 'enforce'
      expect(__test__.resolveAuthDefaultDenyMode()).toBe('enforce')
      // 乱值仍落 observe(灰度档),既不静默放行也不静默拦死
      state.mode = 'Enforce-TYPO'
      expect(__test__.resolveAuthDefaultDenyMode()).toBe('observe')
    } finally {
      state.env = 'test'
      state.mode = 'enforce'
    }
  })

  it('D4f 生产 + 缺键时,无凭据请求**真的**被 401(不是只有解析函数变了)', () => {
    state.env = 'production'
    state.mode = undefined
    return app
      .inject({ method: 'GET', url: '/api/secret' })
      .then((res) => {
        expect(res.statusCode).toBe(401)
      })
      .finally(() => {
        state.env = 'test'
        state.mode = 'enforce'
      })
  })

  it('D4g 同一条在生产缺键时,带有效凭据仍必须放行(正向对照)', () => {
    state.env = 'production'
    state.mode = undefined
    return app
      .inject({ method: 'GET', url: '/api/secret', headers: { authorization: 'Bearer good' } })
      .then((res) => {
        expect(res.statusCode).toBe(200)
      })
      .finally(() => {
        state.env = 'test'
        state.mode = 'enforce'
      })
  })

  // ── 2026-11-01 第二组:兜底闸不得抢在"handler 内自带凭据校验"的面之前判死 ──────
  // 立因是实测:`POST /api/ai/callback`(ai-service→api 回环)在生产 enforce 下真返回
  // statusCode 401 —— 闸只认 Authorization/cookie,而这条路由认 X-Internal-Secret,校验点在
  // handler 里(routes/ai-callback.ts:251-262)。以下用例只验"闸放过去",不冒充"handler 会拒"。
  it('D5 内部回调面匿名可达闸时,本闸不拦(判据单源:isSelfAuthenticatedRoute)', async () => {
    state.env = 'production'
    state.mode = 'enforce'
    try {
      for (const url of [
        '/api/ai/callback',
        '/api/internal/relay/account-pool/credential',
        '/api/memory',
        '/api/chat/ws/zhipu',
      ]) {
        const method = url === '/api/ai/callback' || url.includes('credential') ? 'POST' : 'GET'
        const res = await app.inject({ method, url })
        expect(res.statusCode, url).not.toBe(401)
        expect(__test__.isSelfAuthenticatedRoute(url), url).toBe(true)
      }
    } finally {
      state.env = 'test'
    }
  })

  it('D5-反证 段边界:不在清单里的相近路径仍必须被拦(不许顺带放过)', async () => {
    state.env = 'production'
    state.mode = 'enforce'
    try {
      const res = await app.inject({ method: 'GET', url: '/api/memoryXYZ' })
      expect(res.statusCode).toBe(401)
      expect(__test__.isSelfAuthenticatedRoute('/api/memoryXYZ')).toBe(false)
      // 反向半格:清单里的条目加一段后仍算(前缀形条目)
      expect(__test__.isSelfAuthenticatedRoute('/api/internal/relay/account-pool/credential')).toBe(
        true,
      )
      // 而"没带斜杠的等值条目"不得变成前缀
      expect(__test__.isSelfAuthenticatedRoute('/api/ai/callbackXYZ')).toBe(false)
    } finally {
      state.env = 'test'
    }
  })

  it('D6 三条按证据补入的公开面:匿名 200(此前在生产 enforce 下被误拦)', async () => {
    state.env = 'production'
    state.mode = 'enforce'
    try {
      for (const url of [
        '/api/configs',
        '/api/announcements',
        '/api/ai-education/teacher-certification',
      ]) {
        const res = await app.inject({ method: 'GET', url })
        expect(res.statusCode, url).toBe(200)
      }
    } finally {
      state.env = 'test'
    }
  })

  it('D7 留痕诚实性:真 401 才许写 enforce-401,认到凭据的那一条改写 credential-ok', async () => {
    const { logger } = await import('../../utils/logger.js')
    state.env = 'production'
    state.mode = 'enforce'
    try {
      vi.mocked(logger.warn).mockClear()
      await app.inject({ method: 'GET', url: '/api/secret-d7' })
      const blockedEvents = vi
        .mocked(logger.warn)
        .mock.calls.map((c) => String((c[1] as { event?: string })?.event ?? ''))
      expect(blockedEvents).toContain('auth_default_deny_enforce_401')
      expect(blockedEvents).not.toContain('auth_default_deny_enforce_credential_ok')

      vi.mocked(logger.warn).mockClear()
      await app.inject({
        method: 'GET',
        url: '/api/secret-d7',
        headers: { authorization: 'Bearer good' },
      })
      const okEvents = vi
        .mocked(logger.warn)
        .mock.calls.map((c) => String((c[1] as { event?: string })?.event ?? ''))
      expect(okEvents).toContain('auth_default_deny_enforce_credential_ok')
      expect(okEvents).not.toContain('auth_default_deny_enforce_401')
    } finally {
      state.env = 'test'
    }
  })

  it('OPTIONS 预检与 HEAD 永不因本闸 401', async () => {
    state.mode = 'enforce'
    const res = await app.inject({ method: 'OPTIONS', url: '/api/secret' })
    expect(res.statusCode).not.toBe(401)
  })

  it('公开名单判据本身:查询串不参与匹配;带参数的公开前缀仍命中', () => {
    expect(__test__.isAuthDefaultPublicPath('/api/health?probe=1')).toBe(true)
    expect(__test__.isAuthDefaultPublicPath('/api/agents/abc-123')).toBe(true)
    expect(__test__.isAuthDefaultPublicPath('/api/knowledge/docs')).toBe(false)
  })

  it('enforce 实测补全的 33 条路径:内容面放行,个人/权限面拦截', () => {
    const allow = [
      '/api/news',
      '/api/articles',
      '/api/tools',
      '/api/help/categories',
      '/api/help/articles',
      '/api/ai-feed/items',
      '/api/ai-feed/hot',
      '/api/live/channels',
      '/api/vip/levels',
      '/api/circles',
      '/api/relay/models/public',
      '/api/relay/monitor/status',
      '/api/model-leaderboard',
      '/api/learn/lessons',
      '/api/exam/papers',
      '/api/analytics/track',
      '/api/visit-tracking/visit-log',
      '/api/knowledge/health',
      // 2026-11-01 改判:routes/system.ts:178 注释自述"公开配置(无需鉴权)",handler 取
      // findPublicConfigs() 并挂 withPublicEdgeCache(边缘缓存的公开载荷),全链零鉴权;
      // plugins/tenant.ts:41 早已把它列为公开面。上一轮 33 条分类把它误放进 deny。
      '/api/configs',
    ]
    for (const p of allow) expect(__test__.isAuthDefaultPublicPath(p), `应放行 ${p}`).toBe(true)

    const deny = [
      '/api/chat/conversations',
      '/api/chat/conversations/groups',
      '/api/subagents/active',
      '/api/subagents/topology',
      '/api/workspace/permission-default',
      '/api/workspace/permission/requests',
      '/api/agent-control/capability',
      '/api/settings/contact',
      // '/api/configs' 已于 2026-11-01 移到上面的 allow(证据见那条注释)
      '/api/knowledge/docs',
      '/api/knowledge/search',
    ]
    for (const p of deny) expect(__test__.isAuthDefaultPublicPath(p), `应拦截 ${p}`).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
