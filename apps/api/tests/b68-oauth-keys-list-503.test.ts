// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B68 回归:GET /api/oauth-keys/list 的 503 签名。
 *
 * 一手现场(api_logs 哨兵,2026-10-31 登记):24h 内 3 次
 * `GET /api/oauth-keys/list -> 503 | FastifyError: Service Unavailable`。
 *
 * 判定链(本套件逐条钉住):
 *  ① 读副本失败**不是** 503 的来源:路由 catch 出栈为 500(体 `密钥列表查询失败`)。
 *     503 的 FastifyError/Service Unavailable 由 `@fastify/under-pressure` 的
 *     `handlePressure()` 产生(`reply.status(503).header('Retry-After', 10)`
 *     + `next(new UnderPressureError())`),与 `dbRead` 无关 —— 生产事件循环延迟
 *     > `maxEventLoopDelay`(server.ts 注册为 1000ms)时**全站路由**都会被这一刀切。
 *  ② 治本面分两笔:
 *     · `/list` 是纯只读元数据查询(单表、无写、无 CPU),不该被压力闸误杀 ⇒
 *       按 under-pressure 官方支持的 per-route `config.pressureHandler` 显式豁免;
 *       其余路由与所有写路由仍照常被 shed(本套件用未豁免的 /control 作阳性对照,
 *       同一压力下必须仍是 503,证明豁免只落在这一条路由上)。
 *     · 读副本在健康探测窗口内(连续失败未达 3 次 / 约 45s)仍被 getReader() 选中,
 *       单次读失败会把本端点整段打成 500 ⇒ 显式降级主库一次;主库也失败才回既有
 *       500 出栈。不是 try/catch 吞错:两跳都失败仍报错并带原始 err 进日志。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyError, type FastifyInstance, type FastifyRequest } from 'fastify'
import underPressure from '@fastify/under-pressure'
import { oauthKeysRoutes } from '../src/routes/oauth-keys.js'

const USER_ID = '00000000-0000-4000-8000-000000000001'

/** 读/写两池的可配置替身:select 链只在 await(即 then 访问)时"打到库"。 */
const state = vi.hoisted(() => ({
  readerRows: [] as unknown[],
  primaryRows: [] as unknown[],
  readerFails: false,
  primaryFails: false,
  readerQueries: 0,
  primaryQueries: 0,
}))

function selectChain(kind: 'reader' | 'primary'): Record<string, unknown> {
  // 目标须同时是"可调用"与"可挂索引签名"的链节点:空 Record 并入函数即两者兼备,避免裸函数被拒。
  const empty: Record<string, unknown> = {}
  const target = Object.assign(function () {}, empty)
  const proxy: Record<string, unknown> = new Proxy(target, {
    get(_target, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
          if (kind === 'reader') state.readerQueries += 1
          else state.primaryQueries += 1
          try {
            if (kind === 'reader' && state.readerFails) {
              throw new Error('read replica: ECONNREFUSED 10.0.0.9:5432')
            }
            if (kind === 'primary' && state.primaryFails) {
              throw new Error('primary: ECONNREFUSED 10.0.0.1:5432')
            }
            resolve(kind === 'reader' ? state.readerRows : state.primaryRows)
          } catch (e) {
            reject?.(e)
          }
        }
      }
      return proxy
    },
    apply() {
      return proxy
    },
  })
  return proxy
}

vi.mock('../src/db/index.js', () => ({
  db: { select: () => selectChain('primary') },
  dbRead: { select: () => selectChain('reader') },
  dbClient: {},
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: FastifyRequest) => {
    ;(request as { userId?: string }).userId = USER_ID
    return { userId: USER_ID, familyId: 'f-1', roleId: 0, type: 'access' as const }
  }),
}))

interface Row {
  id: string
  clientId: string
  publicKey: string | null
  keyType: string
  isActive: number
  createdAt: Date
  updatedAt: Date
}

function row(id: string, clientId: string): Row {
  const at = new Date('2026-10-01T00:00:00.000Z')
  return {
    id,
    clientId,
    publicKey: `-----BEGIN PUBLIC KEY-----${id}`,
    keyType: 'RSA',
    isActive: 1,
    createdAt: at,
    updatedAt: at,
  }
}

interface CapturedError {
  name?: string
  code?: string
  message?: string
}

/**
 * 与 server.ts errorHandler 同形(4xx 透传、5xx 收敛成「服务器错误」),
 * 让断言看到的是生产真实响应体,而不是 Fastify 默认错误体。
 */
async function buildApp(options: { pressure: boolean }): Promise<{
  app: FastifyInstance
  errors: CapturedError[]
}> {
  const errors: CapturedError[] = []
  const app = Fastify({ logger: false })
  app.setErrorHandler((err: FastifyError, _request, reply) => {
    const statusCode =
      err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
    reply
      .status(statusCode)
      .send({ code: statusCode, message: statusCode >= 500 ? '服务器错误' : err.message })
  })
  app.addHook('onError', async (_request, _reply, error) => {
    errors.push({
      name: error.name,
      code: (error as { code?: string }).code,
      message: error.message,
    })
  })
  if (options.pressure) {
    // healthCheck 恒 false ⇒ 压力态确定性置位(无需靠真实事件循环抖动),
    // 但走的仍是 handlePressure() 同一条线:503 + Retry-After + FST_UNDER_PRESSURE。
    await app.register(underPressure, {
      healthCheck: async () => false,
      healthCheckInterval: 60_000,
      retryAfter: 10,
    })
  }
  // 阳性对照:未豁免的普通只读路由,同一压力下必须仍被 shed。
  app.get('/control', async () => ({ ok: true }))
  await app.register(oauthKeysRoutes, { prefix: '/api/oauth-keys' })
  await app.ready()
  return { app, errors }
}

beforeEach(() => {
  state.readerRows = []
  state.primaryRows = []
  state.readerFails = false
  state.primaryFails = false
  state.readerQueries = 0
  state.primaryQueries = 0
})

describe('GET /api/oauth-keys/list — 读路径', () => {
  it('正例:读副本正常时返回白名单元数据(200,不触主库)', async () => {
    state.readerRows = [row('k-1', 'github'), row('k-2', 'google')]
    const { app } = await buildApp({ pressure: false })
    try {
      const res = await app.inject({ method: 'GET', url: '/api/oauth-keys/list' })
      expect(res.statusCode, `body=${res.body}`).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.keys).toHaveLength(2)
      expect(body.data.keys[0]).toMatchObject({ keyId: 'k-1', clientId: 'github', keyType: 'RSA' })
      // 白名单:不得出现 privateKey / encryptionKeyId
      expect(Object.keys(body.data.keys[0]).sort()).toEqual([
        'clientId',
        'createdAt',
        'isActive',
        'keyId',
        'keyType',
        'publicKey',
        'updatedAt',
      ])
      expect(state.readerQueries).toBe(1)
      expect(state.primaryQueries).toBe(0)
    } finally {
      await app.close()
    }
  })

  it('反向例:读副本失败 ⇒ 降级主库一次,仍是 200(副本抖动不再打到用户面)', async () => {
    state.readerFails = true
    state.primaryRows = [row('k-1', 'github')]
    const { app } = await buildApp({ pressure: false })
    try {
      const res = await app.inject({ method: 'GET', url: '/api/oauth-keys/list' })
      expect(res.statusCode, `body=${res.body}`).toBe(200)
      expect(res.json().data.keys).toHaveLength(1)
      expect(state.readerQueries).toBe(1)
      expect(state.primaryQueries).toBe(1)
    } finally {
      await app.close()
    }
  })

  it('两跳都失败 ⇒ 500(非 503)+ 可诊断文案,不静默吞错', async () => {
    state.readerFails = true
    state.primaryFails = true
    const { app } = await buildApp({ pressure: false })
    try {
      const res = await app.inject({ method: 'GET', url: '/api/oauth-keys/list' })
      expect(res.statusCode, `body=${res.body}`).toBe(500)
      expect(res.json()).toEqual({ code: 500, message: '密钥列表查询失败' })
      expect(state.readerQueries).toBe(1)
      expect(state.primaryQueries).toBe(1)
    } finally {
      await app.close()
    }
  })
})

describe('GET /api/oauth-keys/list — 事件循环压力闸', () => {
  it('未豁免路由在压力下 503,且错误签名与 api_logs 一手现场逐字一致', async () => {
    state.readerRows = [row('k-1', 'github')]
    const { app, errors } = await buildApp({ pressure: true })
    try {
      const res = await app.inject({ method: 'GET', url: '/control' })
      expect(res.statusCode, `body=${res.body}`).toBe(503)
      // 生产 errorHandler 对 >=500 统一收敛文案
      expect(res.json()).toEqual({ code: 503, message: '服务器错误' })
      expect(res.headers['retry-after']).toBe('10')
      expect(errors.at(-1)).toEqual({
        name: 'FastifyError',
        code: 'FST_UNDER_PRESSURE',
        message: 'Service Unavailable',
      })
    } finally {
      await app.close()
    }
  })

  it('/list 在压力下不再被 shed(200);撤回 per-route 豁免即回到上一例的 503', async () => {
    state.readerRows = [row('k-1', 'github')]
    const { app } = await buildApp({ pressure: true })
    try {
      const res = await app.inject({ method: 'GET', url: '/api/oauth-keys/list' })
      expect(res.statusCode, `body=${res.body}`).toBe(200)
      expect(res.json().data.keys).toHaveLength(1)
    } finally {
      await app.close()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
