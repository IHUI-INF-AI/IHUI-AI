// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池管理面公网可达回归锁(2026-11-10 机主永久指令)。
 *
 * 钉住的真实缺陷(2026-11-10 aizhs.top 浏览器实测,不是推断):
 *   server.ts 的 onRoute 对 /api/admin/* 注入 `network: existingConfig.network ??
 *   { allowExternal: false }` ⇒ 公网打开 /admin/relay/account-pool 时三个视图
 *   (运营池/全部归属/我的个人池)全部报 "External network access not allowed for
 *   this route"、共 0 条。机主纪律:号池账号必须跟着 admin 账号在公网上走。
 *
 * 修法:_shared.exposeRelayPoolRoutesToPublicNetwork 在号池两个路由插件的封装
 * 作用域内挂 onRoute 钩子,无条件注入 network.allowExternal:true。
 *
 * 用例覆盖:
 *  1 判据单源:RELAY_POOL_NETWORK.allowExternal === true(取模块导出,不重抄)
 *  2 真插件接线:注册真实 relay-account-pool / capability 插件后,号池页实际调用的
 *    端点逐条带公网 XFF 打,无一再被分段封(Fastify 5 无 lookupRoute,经请求面取证)
 *  3 鉴权成对:过了网络闸仍被 requireAdmin 401 ⇒ 放行只松网络不松鉴权
 *  4 对照组:不带钩子的同形态 admin 路由,带公网 XFF 必 403(证明 2/3 不是恒真)
 *  5 接线锁:server.ts admin 分支仍是 `existingConfig.network ??`(尊重路由自声明,
 *    本机制的顺序前提);两个号池路由文件仍装 requireAdmin preHandler(放行必带鉴权)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { readFileSync, readdirSync } from 'node:fs'
import networkSegmentPlugin from '../src/plugins/network-segment.js'
import { RELAY_POOL_NETWORK } from '../src/routes/admin/_shared.js'
import relayAccountPoolRoutes from '../src/routes/admin/relay-account-pool.js'
import relayAccountPoolCapabilityRoutes from '../src/routes/admin/relay-account-pool-capability.js'

/** 内存版 redis 替身:network-segment 只用 sismember/sadd/ttl/expire/srem(同 deny-proxied 测试)。 */
function makeRedisStub() {
  const sets = new Map<string, Set<string>>()
  const get = (k: string): Set<string> => {
    let s = sets.get(k)
    if (!s) {
      s = new Set<string>()
      sets.set(k, s)
    }
    return s
  }
  return {
    sismember: async (k: string, m: string) => (get(k).has(m) ? 1 : 0),
    sadd: async (k: string, m: string) => {
      get(k).add(m)
      return 1
    },
    srem: async (k: string, m: string) => (get(k).delete(m) ? 1 : 0),
    ttl: async () => -1,
    expire: async () => 1,
  }
}

/**
 * 复刻 server.ts onRoute 的 admin 分支(单一真相源在 server.ts,本函数只是测试夹具;
 * 用例 5 的接线锁保证 server.ts 语义漂移时本夹具与真实行为同步失效点名)。
 */
function installAdminNetworkInjection(app: FastifyInstance) {
  app.addHook('onRoute', (routeOptions) => {
    const url = routeOptions.url ?? ''
    if (url.startsWith('/api/admin/') || url === '/api/admin') {
      const existingConfig = (routeOptions.config ?? {}) as Record<string, unknown>
      routeOptions.config = {
        ...existingConfig,
        network: existingConfig.network ?? { allowExternal: false },
        mtls: existingConfig.mtls ?? { required: false },
      }
    }
  })
}

/**
 * 行为探针:带公网 XFF 打一条路由。网络分段 preHandler(全局,先于路由级 requireAdmin)
 * 若仍封禁 ⇒ 403 "External network access..."(res.body 含该文案);放行则落到鉴权闸。
 * 返回分段拒绝文案(true=被分段封)。Fastify 5 无 lookupRoute,config 只能经请求面取证。
 */
async function segmentBlocked(app: FastifyInstance, method: string, url: string): Promise<boolean> {
  const res = await app.inject({ method, url, headers: { 'x-forwarded-for': '8.8.8.8' } })
  return String(res.body ?? '').includes('External network access not allowed')
}

describe('号池管理面公网可达(2026-11-10 机主指令)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    // trustProxy 与生产一致(TRUSTED_PROXIES 默认含 127.0.0.1):request.ip 取 XFF
    // 最左值,8.8.8.8 才会被分段插件判成 external。不加这枚,inject 的 socket 恒
    // 127.0.0.1 ⇒ 一切判 internal,对照组封不住,测试变假绿。
    app = Fastify({ logger: false, trustProxy: true })
    const decorable = app as unknown as { decorate(name: string, value: unknown): void }
    decorable.decorate('redis', makeRedisStub())
    await app.register(networkSegmentPlugin)
    installAdminNetworkInjection(app)

    // 真插件,注册前缀与 routes/index.ts 逐字节一致
    app.register(relayAccountPoolRoutes, { prefix: '/api' })
    app.register(relayAccountPoolCapabilityRoutes, { prefix: '/api' })

    // 对照组:同前缀、不带放行钩子的 admin 路由
    app.register(
      async (s) => {
        s.get('/admin/relay/control-naked', async () => ({ ok: true }))
      },
      { prefix: '/api' },
    )

    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('1 判据单源:allowExternal 取模块导出,判的就是 true', () => {
    expect(RELAY_POOL_NETWORK.allowExternal).toBe(true)
  })

  it('2 真插件接线:号池页实际调用的端点逐条带公网 XFF 打,无一被分段封', async () => {
    for (const [method, url] of [
      ['GET', '/api/admin/relay/accounts'],
      ['POST', '/api/admin/relay/accounts/import'],
      ['GET', '/api/admin/relay/account-pool/renewal-capability'],
      ['GET', '/api/admin/relay/accounts/00000000-0000-0000-0000-000000000000'],
      ['POST', '/api/admin/relay/accounts/00000000-0000-0000-0000-000000000000/health'],
      ['POST', '/api/admin/relay/account-pool/sweep'],
      ['POST', '/api/admin/relay/account-pool/checkin-status'],
      ['GET', '/api/admin/relay/account-pool/reauth-status'],
      ['GET', '/api/admin/relay/proxy-pool'],
      ['GET', '/api/admin/relay/model-catalog'],
    ] as const) {
      expect(await segmentBlocked(app, method, url), `${method} ${url}`).toBe(false)
    }
  })

  it('3 鉴权面不随放行松动:公网 XFF 过了网络闸,仍被 requireAdmin 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/relay/accounts',
      headers: { 'x-forwarded-for': '8.8.8.8' },
    })
    expect(String(res.body ?? '')).not.toContain('External network access not allowed')
    // 网络闸过了,下一档是无凭据 ⇒ requireAdmin 拦(401),绝不放行到 handler
    expect(res.statusCode).toBe(401)
  })

  it('4 对照组:不带放行钩子的同前缀 admin 路由带公网 XFF 必 403(证明 2/3 非恒真)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/relay/control-naked',
      headers: { 'x-forwarded-for': '8.8.8.8' },
    })
    expect(res.statusCode).toBe(403)
    expect(String(res.body)).toContain('External network access not allowed')
  })
})

describe('接线锁:机制前提与鉴权成对', () => {
  const serverSrc = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf-8')
  const adminBlock = (() => {
    const start = serverSrc.indexOf("if (url.startsWith('/api/admin/')")
    expect(start).toBeGreaterThan(-1)
    const end = serverSrc.indexOf('return', start)
    return serverSrc.slice(start, end)
  })()

  it('server.ts admin 分支仍尊重路由自声明的 network(?? 语义,放行钩子的顺序前提)', () => {
    expect(adminBlock).toContain('existingConfig.network ??')
  })

  it('号池两个路由文件都装了放行出口,且同插件仍装 requireAdmin(没有鉴权就不许放行)', () => {
    for (const rel of [
      '../src/routes/admin/relay-account-pool.ts',
      '../src/routes/admin/relay-account-pool-capability.ts',
    ] as const) {
      const src = readFileSync(new URL(rel, import.meta.url), 'utf-8')
      expect(src, rel).toContain('exposeRelayPoolRoutesToPublicNetwork(server)')
      expect(src, rel).toContain("server.addHook('preHandler', requireAdmin)")
    }
  })

  it('放行作用域只住在这两个号池文件:其余 admin 路由文件不得引用该出口', () => {
    // _shared 出口是号池专用件;若被别的 admin 路由顺手拿去,公网面会无声扩大。
    const dir = new URL('../src/routes/admin/', import.meta.url)
    const consumers = readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) =>
        readFileSync(new URL(f, dir), 'utf-8').includes('exposeRelayPoolRoutesToPublicNetwork('),
      )
      .sort()
    // _shared.ts 是定义处(函数签名里带同名),消费方只许号池两文件
    expect(consumers).toEqual([
      '_shared.ts',
      'relay-account-pool-capability.ts',
      'relay-account-pool.ts',
    ])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
