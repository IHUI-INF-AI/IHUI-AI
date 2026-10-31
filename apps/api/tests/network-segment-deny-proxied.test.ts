// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全强化第 14 批回归锁(2026-10-31):内部端点不得经代理转发到达。
 *
 * 钉住的真实缺陷(2026-10-31 现读实测,不是推断):
 *   本机前门是 EdgeOne/Cloudflared → Next.js(8801) → rewrites → Fastify(8802)。
 *   Fastify 的 `TRUSTED_PROXIES` 默认含 127.0.0.1 ⇒ `request.ip` 取 `X-Forwarded-For`
 *   最左值(= 客户端可整写字段)。于是攻击者加一枚 `X-Forwarded-For: 127.0.0.1`
 *   就能让 `allowExternal: false` 判成 internal 而放行;不带 XFF 时 socket 对端
 *   也是 127.0.0.1(Next 转发的连接) ⇒ 同样判成 internal。
 *   实测证据:经 8801 打 `/api/internal/relay/user-pool/upsert` 返回的是
 *   `{"code":403,"message":"CSRF 令牌缺失或无效"}` —— 网络分段那道闸从未触发;
 *   而 `/api/csrf-token` 是公开端点(200),CSRF 对"直接发 HTTP 请求的工具"不构成防线。
 *
 * 修法:`denyProxied` 判据与 IP 分类完全解耦 —— 只看这枚请求是否携带任何代理注入头。
 * 内部服务(ai-service → 8802)直连不带转发头;凡经 Next/EdgeOne/Cloudflared 的请求必带。
 *
 * 用例覆盖:
 *  A 带 XFF(公网值)⇒ 403
 *  B 带 XFF(伪造内网 127.0.0.1)⇒ 仍 403 —— 本批核心:伪造内网身份不再能过
 *  C 带 cf-connecting-ip / x-real-ip / forwarded 等每一枚 ⇒ 403(逐头矩阵)
 *  D 不带任何代理头 ⇒ 200(内部服务直连不受影响)
 *  E 未配置 denyProxied 的普通路由带 XFF ⇒ 200(不误伤全站)
 *  F 路由自己声明 network 时 denyProxied 不被覆盖(server.ts 合并语义)
 *  G 变异自证:把 denyProxied 摘掉,B 立即变 200 —— 证明红绿确由本判据驱动
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import networkSegmentPlugin, { hasProxyHeaders } from '../src/plugins/network-segment.js'

/** 内存版 redis 替身:network-segment 只用 sismember/sadd/ttl/expire/srem。 */
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

type RouteOptions = NonNullable<Parameters<FastifyInstance['route']>[0]>

describe('network-segment denyProxied(第 14 批)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate('redis', makeRedisStub())
    await app.register(networkSegmentPlugin)

    const ok = async () => ({ ok: true })
    // 未配置 network 的普通路由(对照组:证明判据不是全站生效)
    app.get('/plain', ok)
    // 内部路由形态:强制内网 + 拒绝代理转发
    app.get(
      '/internal-like',
      { config: { network: { allowExternal: false, denyProxied: true } } },
      ok,
    )
    // 路由自声明 network:验证 denyProxied 与既有键并存
    app.get(
      '/internal-own',
      { config: { network: { allowExternal: true, denyProxied: true } } },
      ok,
    )
    // 变异自证夹具:同样的 allowExternal:false,但**不装** denyProxied
    app.get('/internal-no-deny', { config: { network: { allowExternal: false } } }, ok)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  const hit = (url: string, headers: Record<string, string> = {}) =>
    app.inject({ method: 'GET', url, headers })

  it('D 不带任何代理头 ⇒ 内部路由可达(内部服务直连不被误伤)', async () => {
    const res = await hit('/internal-like')
    expect(res.statusCode).toBe(200)
  })

  it('A 带 XFF 公网值 ⇒ 403', async () => {
    const res = await hit('/internal-like', { 'x-forwarded-for': '8.8.8.8' })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('代理')
  })

  it('B 带伪造内网 XFF ⇒ 仍 403(核心:伪造 127.0.0.1 不再冒充内网)', async () => {
    for (const spoof of ['127.0.0.1', '::1', '10.0.0.5', '127.0.0.1, 8.8.8.8']) {
      const res = await hit('/internal-like', { 'x-forwarded-for': spoof })
      expect(res.statusCode, `XFF=${spoof} 必须被拒`).toBe(403)
    }
  })

  it('C 逐头矩阵:任一代理注入头都触发拒绝', async () => {
    const headers = [
      'x-forwarded-for',
      'x-forwarded-host',
      'x-forwarded-proto',
      'x-forwarded-port',
      'x-real-ip',
      'forwarded',
      'cf-connecting-ip',
      'cf-ray',
      'true-client-ip',
      'x-client-ip',
      'eo-connecting-ip',
    ]
    for (const name of headers) {
      const res = await hit('/internal-like', { [name]: 'x' })
      expect(res.statusCode, `${name} 必须触发拒绝`).toBe(403)
    }
  })

  it('C2 显式空值的代理头同样算痕迹(fail-closed)', async () => {
    const res = await hit('/internal-like', { 'x-forwarded-for': '' })
    expect(res.statusCode).toBe(403)
  })

  it('E 普通路由带 XFF ⇒ 200(不误伤全站)', async () => {
    const res = await hit('/plain', { 'x-forwarded-for': '8.8.8.8' })
    expect(res.statusCode).toBe(200)
  })

  it('F 路由自声明 network 时 denyProxied 依然生效', async () => {
    expect((await hit('/internal-own')).statusCode).toBe(200)
    expect((await hit('/internal-own', { 'x-forwarded-for': '127.0.0.1' })).statusCode).toBe(403)
  })

  it('G 变异自证:同一路由摘掉 denyProxied ⇒ 伪造内网 XFF 直接放行', async () => {
    const res = await hit('/internal-no-deny', { 'x-forwarded-for': '127.0.0.1' })
    expect(res.statusCode).toBe(200)
  })
})

describe('hasProxyHeaders 纯判据', () => {
  it('空对象 / 无头 ⇒ false', () => {
    expect(hasProxyHeaders({})).toBe(false)
    expect(hasProxyHeaders({ host: 'a', 'user-agent': 'x' })).toBe(false)
  })

  it('任一枚命中 ⇒ true(含 undefined 之外的全部值形态)', () => {
    expect(hasProxyHeaders({ 'x-forwarded-for': '' })).toBe(true)
    expect(hasProxyHeaders({ forwarded: 'for=1.2.3.4' })).toBe(true)
    expect(hasProxyHeaders({ 'cf-ray': 'abc' })).toBe(true)
  })
})

describe('接线锁:server.ts 对内部路由注入 denyProxied', () => {
  const serverSrc = readFileSync(resolve(__dirname, '../src/server.ts'), 'utf-8')
  // 逐块取:从每个 if 的条件开始到本段 return 结束。只判这两块自己的写法,
  // 不用"两锚点之间"的宽切片 —— 那会把兄弟分支(敏感业务)的写法一起算进来。
  const blockAt = (marker: string) => {
    const start = serverSrc.indexOf(marker)
    expect(start).toBeGreaterThan(-1)
    const end = serverSrc.indexOf('return', start)
    return serverSrc.slice(start, end === -1 ? start + 600 : end)
  }
  const internalBlock = blockAt('if (INTERNAL_ONLY_PREFIXES.some')
  const debugBlock = blockAt("url.startsWith('/api/debug/')")

  it('/api/internal/ 与 /api/debug/ 两族都带 denyProxied', () => {
    expect(internalBlock).toContain('denyProxied: true')
    expect(internalBlock).toContain('allowExternal: false')
    expect(debugBlock).toContain('denyProxied: true')
  })

  it('注入走合并而不是 ?? 覆盖(否则路由自声明 network 会把 denyProxied 洗掉)', () => {
    expect(internalBlock).not.toContain('??')
    expect(internalBlock).toContain('toNetworkConfig(existingConfig.network)')
    expect(debugBlock).not.toContain('??')
    expect(debugBlock).toContain('toNetworkConfig(existingConfig.network)')
  })
})

// 让 TS 认为 RouteOptions 被使用(route 的 config 形状取自同一类型)
export type _RouteOptions = RouteOptions
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
