// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 个人号池反向同步内网端的凭据比较强度(2026-11-01 安全强化)。
 *
 * 立因:`requireInternal` 此前写 `provided !== secret` —— 原生字符串比较是**非常数时间**的
 * (遇到第一个不同字节就返回),而它比的是 `AI_CALLBACK_SECRET` 这枚长期内部凭据。
 * 兄弟文件 `internal-relay-account-pool-credential.ts` 早在 2026-10-31 那批就改走了
 * `secretsEqual` 单源,同一枚密钥在两处两种强度 ⇒ 漏的那一侧不会响,这正是"两份实现必漂移"
 * 的安全版形态。
 *
 * 本文件判三格:未配置 ⇒ 503;缺失/错误凭据 ⇒ 401;并钉一条源码形状锁禁止裸比较回潮。
 * 刻意不测"正确密钥后的写入路径" —— 那需要 importAccounts 的整条服务链,属另一张票的射程,
 * 在这里把它写进断言只会得到"桩得太厚以至于什么都没判"的假绿。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const ROUTE_FILE = 'apps/api/src/routes/internal-relay-user-pool.ts'

// vi.mock 的工厂会被提升到文件最前执行,普通 const 那时还没初始化 ⇒ 供值件必须走 vi.hoisted
const { SECRET_HOLDER } = vi.hoisted(() => ({ SECRET_HOLDER: { AI_CALLBACK_SECRET: '' } }))

vi.mock('../src/config/index.js', () => ({ config: SECRET_HOLDER }))

// 测试隔离铁律(AGENTS §5):被审模块的 db 入口一律换成"问到就抛"的替身,
// 本文件三条断言都应停在凭据闸上 —— 一旦有任何一格走到了库,这里当场炸而不是静默连生产 PG。
vi.mock('../src/db/index.js', () => {
  const boom = () => {
    throw new Error('内网凭据回归不得触库(AGENTS §5:测试禁连生产 PG)')
  }
  return { db: new Proxy({}, { get: boom }), dbRead: new Proxy({}, { get: boom }) }
})

import internalRelayUserPoolRoutes from '../src/routes/internal-relay-user-pool.js'

async function build(): Promise<FastifyInstance> {
  const app = Fastify()
  await app.register(internalRelayUserPoolRoutes)
  await app.ready()
  return app
}

const URL_PATH = '/api/internal/relay/user-pool/upsert'

describe('内部凭据比较必须走 secretsEqual 单源', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    SECRET_HOLDER.AI_CALLBACK_SECRET = 's'.repeat(48)
    app = await build()
  })

  afterEach(async () => {
    await app.close()
  })

  it('缺 x-internal-secret 头 ⇒ 401(而不是"未提供就当通过")', async () => {
    const res = await app.inject({ method: 'POST', url: URL_PATH, payload: {} })
    expect(res.statusCode).toBe(401)
  })

  it('错误密钥 ⇒ 401;长度相同也不行(非常数时间比较的可测形态)', async () => {
    const wrong = 'a'.repeat(48)
    expect(wrong).toHaveLength(SECRET_HOLDER.AI_CALLBACK_SECRET.length)
    const res = await app.inject({
      method: 'POST',
      url: URL_PATH,
      headers: { 'x-internal-secret': wrong },
      payload: {},
    })
    expect(res.statusCode).toBe(401)
  })

  it('密钥未配置 ⇒ 503 fail-closed(不得读成"没配就放行")', async () => {
    SECRET_HOLDER.AI_CALLBACK_SECRET = ''
    const fresh = await build()
    const res = await fresh.inject({
      method: 'POST',
      url: URL_PATH,
      headers: { 'x-internal-secret': 'anything' },
      payload: {},
    })
    expect(res.statusCode).toBe(503)
    await fresh.close()
  })

  it('接线锁:该文件不得再出现裸 `!==` 比内部密钥,且必须 import secretsEqual', () => {
    const src = readFileSync(join(ROOT, ROUTE_FILE), 'utf8')
    expect(src).toMatch(
      /import \{ secretsEqual \} from '\.\.\/plugins\/internal-service-token\.js'/,
    )
    expect(src).not.toMatch(/provided\s*!==\s*secret/)
    // 变异自证:把新写法摘回旧写法,同一把尺子必须量出来(否则上面那条 not.toMatch 只是文本巧合)
    const mutated = src.replace('!secretsEqual(provided, secret)', 'provided !== secret')
    expect(mutated).not.toBe(src)
    expect(/provided\s*!==\s*secret/.test(mutated)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
