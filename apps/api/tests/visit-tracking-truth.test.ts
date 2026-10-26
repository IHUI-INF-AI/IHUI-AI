// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 访客明细真值化取证(2026-10-23 立)。
 *
 * 立因(现读实测):`visit_logs` 2555 行里 2550 行 `user_agent` 为空、IP 维度读不出
 * 任何东西 —— 因为上报方压根不带这两个字段,而 `saveVisitLog` 又**照单接收客户端自报
 * 的同名值**(AGENTS §5:身份/归属不得信客户端可整写的字段);`/source/record` 与
 * `/page/record` 两个端点更是根本不写 userAgent。修法:UA 照 `routes/analytics.ts` 的
 * POST /analytics/track 那把尺子取 `user-agent` 头并钳到 500;ip 走本仓已被 trustProxy
 * 清单门控过的唯一出口 `RateLimiter.getClientIp`(= `request.ip`,与写 api_logs.ip 的
 * `plugins/api-logger.ts` 同口径)—— 手读 `X-Forwarded-For` 首段那一型**刻意不继承**,
 * 理由与残余暴露逐条写在 `routes/visit-tracking.ts` 的观测函数头注里。
 * 客户端自报值一律丢弃(不是"传了就用客户端的")。
 *
 * 取证面:这一族用例把 `../src/db/index.js` mock 成"把 insert 的 values 原样记下来",
 * 所以断言的是**真正进库的那一行**,不是 handler 的返回值,也不是中间层的形状。
 * 反向对照(伪造值一个字节都不许进库)与正向对照(正常请求也要写对)成对给,
 * 只给一边等于没修。测试零连接:不碰 PG 8810 / Redis 8811(AGENTS §5 测试隔离铁律)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { bizDayKey } from '../src/utils/biz-day.js'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

/** 进库行捕获面(唯一一份 insert 记录口,三个公开端点都汇到它)。 */
const h = vi.hoisted(() => {
  const state: { inserted: Array<Record<string, unknown>> } = { inserted: [] }
  const chain = {
    values: (v: Record<string, unknown>) => ({
      returning: async () => {
        state.inserted.push(v)
        return [{ id: '00000000-0000-4000-8000-000000000001', ...v }]
      },
    }),
  }
  const db = {
    insert: vi.fn(() => chain),
    select: vi.fn(() => ({ from: () => ({ where: () => [], limit: () => [] }) })),
    execute: vi.fn(async () => []),
    query: {},
  }
  return { state, db }
})

vi.mock('../src/db/index.js', () => ({ db: h.db, dbRead: h.db }))

import { visitTrackingRoutes } from '../src/routes/visit-tracking'

/** 2026-10-23 从 api_logs 现读的真实浏览器 UA 形态,不造样本。 */
const REAL_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36'
const REAL_IP = '198.51.100.9'
/** 攻击者可整写的客户端面 —— 断言它们一个字节也进不了库。 */
const FORGED_IP = '9.9.9.9'
const FORGED_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) EvilFaker/1.0'

let server: FastifyInstance

async function lastInserted(): Promise<Record<string, unknown>> {
  const row = h.state.inserted[h.state.inserted.length - 1]
  expect(row, '没有任何一行进库').toBeTruthy()
  return row
}

beforeAll(async () => {
  server = Fastify({ logger: false })
  await server.register(visitTrackingRoutes, { prefix: '/api' })
  await server.ready()
})

afterAll(async () => {
  await server.close()
})

beforeEach(() => {
  h.state.inserted.length = 0
})

describe('A) /visit-tracking/visit-log 真值化:服务端观测面覆盖客户端自报', () => {
  it('A1 body 伪造 ip/UA 与未过信任门的 XFF 伪造都进不了库(反向对照)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/visit-tracking/visit-log',
      remoteAddress: REAL_IP,
      headers: { 'user-agent': REAL_UA, 'x-forwarded-for': '203.0.113.77, 10.0.0.1' },
      body: { ip: FORGED_IP, userAgent: FORGED_UA, url: '/agent/detail', sessionId: 'sid-1' },
    })
    expect(res.statusCode).toBe(200)
    const row = await lastInserted()
    // 三个伪造面一次钉死:① body 的 ip / userAgent 被剥;② 裸 XFF 首段不被采信
    // (本探针实例没配 trustProxy ⇒ request.ip 就是 socket 远端;生产由
    //  config.TRUSTED_PROXIES 清单门控,详见 routes/visit-tracking.ts 观测函数头注)。
    expect(row.ip).toBe(REAL_IP)
    expect(row.userAgent).toBe(REAL_UA)
    const serialized = JSON.stringify(row)
    expect(serialized).not.toContain(FORGED_IP)
    expect(serialized).not.toContain('EvilFaker')
    expect(serialized).not.toContain('203.0.113.77')
  })

  it('A2 不带 XFF 时取 socket 远端地址,UA 取头(正向对照:正常请求也要写对)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/visit-tracking/visit-log',
      remoteAddress: REAL_IP,
      headers: { 'user-agent': REAL_UA },
      body: { ip: FORGED_IP, userAgent: FORGED_UA, url: '/' },
    })
    expect(res.statusCode).toBe(200)
    const row = await lastInserted()
    expect(row.ip).toBe(REAL_IP)
    expect(row.userAgent).toBe(REAL_UA)
    expect(row.url).toBe('/')
    expect(JSON.stringify(row)).not.toContain('EvilFaker')
  })

  it('A3 客户端不带 ip/UA(线上真实形态:2550/2555 行 UA 为空即由此而来)也必须有值', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/visit-tracking/visit-log',
      remoteAddress: REAL_IP,
      headers: { 'user-agent': 'curl/8.21.0' },
      body: { url: '/agent/list' },
    })
    expect(res.statusCode).toBe(200)
    const row = await lastInserted()
    expect(row.ip).toBe(REAL_IP)
    expect(row.userAgent).toBe('curl/8.21.0')
  })

  it('A4 UA 头为空(观测不到)时写 null,不编一个 "unknown" 冒充实测(§0.3)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/visit-tracking/visit-log',
      remoteAddress: REAL_IP,
      headers: { 'user-agent': '' },
      body: { url: '/x' },
    })
    expect(res.statusCode).toBe(200)
    const row = await lastInserted()
    expect(row.userAgent).toBeNull()
    expect(row.ip).toBe(REAL_IP)
  })

  it('A4b 观测层不做二次判断:注入器自带的 UA 照实记,不因其"看着像工具"改成 null', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/visit-tracking/visit-log',
      remoteAddress: REAL_IP,
      body: { url: '/x' },
    })
    expect(res.statusCode).toBe(200)
    const row = await lastInserted()
    // light-my-request 注入器自己会带一把 UA;真值化的口径是"头里有什么就记什么",
    // 不因为"看着像工具"就改成 null —— 那样等于在观测层做二次判断(判据不越权)。
    // 判"它像不像真人"是 bot-detection 族归一的活,取证见 tests/traffic-stats-gauge.test.ts。
    expect(row.userAgent).toBe('lightMyRequest')
    expect(row.ip).toBe(REAL_IP)
  })

  it('A5 UA 按 analytics 同口径钳到 500 字符(列长 varchar(512))', async () => {
    const long = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/151.0.0.0 Safari/537.36 ${'pad-'.repeat(200)}`
    const res = await server.inject({
      method: 'POST',
      url: '/api/visit-tracking/visit-log',
      remoteAddress: REAL_IP,
      headers: { 'user-agent': long },
      body: { url: '/x' },
    })
    expect(res.statusCode).toBe(200)
    const row = await lastInserted()
    expect(typeof row.userAgent).toBe('string')
    expect((row.userAgent as string).length).toBe(500)
    expect(long.startsWith(row.userAgent as string)).toBe(true)
  })

  it('A6 {data:{...}} 包裹形同样只认服务端观测面(兼容旧壳不被放宽)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/visit-tracking/visit-log',
      remoteAddress: REAL_IP,
      headers: { 'user-agent': REAL_UA },
      body: { data: { ip: FORGED_IP, userAgent: FORGED_UA, url: '/y' } },
    })
    expect(res.statusCode).toBe(200)
    const row = await lastInserted()
    expect(row.ip).toBe(REAL_IP)
    expect(row.userAgent).toBe(REAL_UA)
    expect(JSON.stringify(row)).not.toContain('EvilFaker')
  })
})

describe('B) /source/record 与 /page/record:此前根本不写 userAgent 的两个端点补齐', () => {
  it('B1 source/record 落库带服务端 UA 与 IP,客户端自报 ip 被丢', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/visit-tracking/source/record',
      remoteAddress: REAL_IP,
      headers: { 'user-agent': REAL_UA },
      body: { referer: 'https://www.google.com/', ip: FORGED_IP, userAgent: FORGED_UA },
    })
    expect(res.statusCode).toBe(200)
    const row = await lastInserted()
    expect(row.referer).toBe('https://www.google.com/')
    expect(row.ip).toBe(REAL_IP)
    expect(row.userAgent).toBe(REAL_UA)
    expect(JSON.stringify(row)).not.toContain(FORGED_IP)
    expect(JSON.stringify(row)).not.toContain('EvilFaker')
  })

  it('B2 page/record 落库带服务端 UA 与 IP,客户端自报 ip 被丢', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/visit-tracking/page/record',
      remoteAddress: REAL_IP,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; GrokBot/1.0; +https://x.ai/)' },
      body: { url: '/agent/detail?id=1', sessionId: 'sid-2', ip: FORGED_IP },
    })
    expect(res.statusCode).toBe(200)
    const row = await lastInserted()
    // 2026-10-26:落库前按页面路径唯一归一判据入库 ⇒ query 段(含凭据)不进表。
    // 此前这里存的是原始串 '/agent/detail?id=1',页面排行会按原串分组,同一页面被拆成多行。
    expect(row.url).toBe('/agent/detail')
    expect(row.sessionId).toBe('sid-2')
    expect(row.ip).toBe(REAL_IP)
    expect(row.userAgent).toBe('Mozilla/5.0 (compatible; GrokBot/1.0; +https://x.ai/)')
    expect(JSON.stringify(row)).not.toContain(FORGED_IP)
  })

  it('B3 两个端点与 visit-log 共用同一个写入口:visitDate 同为当天、形状同构', async () => {
    const a = await server.inject({
      method: 'POST',
      url: '/api/visit-tracking/page/record',
      remoteAddress: REAL_IP,
      headers: { 'user-agent': REAL_UA },
      body: { url: '/z' },
    })
    expect(a.statusCode).toBe(200)
    const row = await lastInserted()
    // 业务日 = 上海日界(服务端 saveVisitLog 的口径);取 UTC 日期在上海 00:00-08:00
    // 窗口里必然差一天,那是本用例原来的时区缺陷,不是服务端写错。
    expect(row.visitDate).toBe(bizDayKey())
    expect(Object.keys(row).sort()).toEqual(
      ['city', 'ip', 'referer', 'sessionId', 'url', 'userId', 'userAgent', 'visitDate'].sort(),
    )
  })
})

/**
 * C) 落库前的页面路径归一(2026-10-26 立)。
 *
 * 立因(生产实测):`visit_logs.url` 此前存客户端上报的原始串 ⇒
 *  ① 同一页面因 query 不同被拆成多行(`/chat` 与 `/chat?conversationId=…` 各一行),
 *     「共 N 个页面」实测 235(真实约 30);
 *  ② 历史行里留着授权凭据(`/?sso_code=…`、`/callback?…&code=…&state=…`),
 *     它们会原样出现在管理端「页面访问排行」上。
 *
 * 判据单一真相源 = `@ihui/shared/utils/visit-url`(写入面 / 存量清洗 / 覆盖面尺共用)。
 * 这里钉的是**真正进库的那一行**(harness 把 insert 的 values 原样记下来)。
 */
describe('C) 落库前页面路径归一:排名口径与凭据防线', () => {
  it('C1 query 段不进库:同一页面的不同 query 归到同一路径', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/visit-tracking/visit-log',
      remoteAddress: REAL_IP,
      headers: { 'user-agent': REAL_UA },
      body: { url: '/chat?conversationId=40c9df01-5fd3-4cb0-8b51-d1a98fe213a6' },
    })
    expect(res.statusCode).toBe(200)
    const row = await lastInserted()
    expect(row.url).toBe('/chat')
  })

  it('C2 授权凭据不进库:SSO code 与 OAuth code+state 随 query 一并剥掉', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/visit-tracking/visit-log',
      remoteAddress: REAL_IP,
      headers: { 'user-agent': REAL_UA },
      body: { url: '/?sso_code=B-ZKi3yQwCUOS1LCKFw6XWvez-5Sx1JfJzRY5J-gkGE' },
    })
    expect(res.statusCode).toBe(200)
    const row = await lastInserted()
    expect(row.url).toBe('/')
    // 反向对照:落库的这一行里一个授权码字节都不许剩
    expect(JSON.stringify(row)).not.toContain('sso_code')
    expect(JSON.stringify(row)).not.toContain('B-ZKi3yQwCUOS1LCKFw6XWvez')
  })

  it('C3 资源 id 归一为 :id:每个工作区/智能体不各占一行', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/visit-tracking/visit-log',
      remoteAddress: REAL_IP,
      headers: { 'user-agent': REAL_UA },
      body: { url: '/workspace/8cc904a4-01b1-4613-96c7-0df824b338d2' },
    })
    expect(res.statusCode).toBe(200)
    const row = await lastInserted()
    expect(row.url).toBe('/workspace/:id')
  })

  it('C4 噪声路径(静态资源 / 路由组)不落成页面:url 置 null,行仍写 ⇒ PV 不丢', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/visit-tracking/visit-log',
      remoteAddress: REAL_IP,
      headers: { 'user-agent': REAL_UA },
      body: { url: '/claude.md' },
    })
    expect(res.statusCode).toBe(200)
    const row = await lastInserted()
    expect(row.url).toBeNull()
    // 行仍在:这次访问是发生过的,只是它不是一次「页面访问」
    expect(row.visitDate).toBe(bizDayKey())
  })

  it('C5 referer 的凭据段不进库,host 保留(访问来源按主机分桶不受影响)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/visit-tracking/visit-log',
      remoteAddress: REAL_IP,
      headers: { 'user-agent': REAL_UA },
      body: { url: '/x', referer: 'https://github.com/IHUI-INF-AI/IHUI-AI?utm_source=chatgpt.com' },
    })
    expect(res.statusCode).toBe(200)
    const row = await lastInserted()
    expect(row.referer).toBe('https://github.com/IHUI-INF-AI/IHUI-AI')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
