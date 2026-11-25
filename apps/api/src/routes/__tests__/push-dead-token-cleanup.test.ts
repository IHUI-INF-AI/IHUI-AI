// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 失效 token 清理（2026-11-26）。
 *
 * 判据：
 *  - 只有上游明确说"设备不存在"（DeviceNotRegistered / Unregistered / invalid registration token）
 *    才置 isActive=false；
 *  - 超时 / 限流 / 鉴权失败 / 网络不可达都是"这次没发成"，绝不能把好设备打成静音；
 *  - 清理是卫生动作，DB 失败只 warn，不影响本次投递结果与响应形状。
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const USER_ID = '00000000-0000-4000-8000-0000000000aa'

const { state, sendPushBatchMock, authenticateMock } = vi.hoisted(() => ({
  state: {
    deviceRows: [] as Array<Array<{ token: string; userId: string }>>,
    prefRows: [] as Array<Array<{ userId: string; key: string; value: string | null }>>,
    selectCalls: 0,
    updateCalls: 0,
    updateReject: false,
  },
  sendPushBatchMock: vi.fn(),
  authenticateMock: vi.fn(),
}))

vi.mock('../../db/index.js', () => {
  interface Chain {
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>
    from: () => Chain
    where: () => Chain
    limit: () => Chain
    orderBy: () => Chain
  }
  return {
    db: {
      execute: vi.fn(async () => []),
      select: vi.fn(() => {
        const chain: Chain = {
          from: () => chain,
          where: () => chain,
          limit: () => chain,
          orderBy: () => chain,
          then: (resolve, reject) => {
            state.selectCalls += 1
            if (state.selectCalls === 1) {
              return Promise.resolve(state.deviceRows.shift() ?? []).then(resolve, reject)
            }
            return Promise.resolve(state.prefRows.shift() ?? []).then(resolve, reject)
          },
        }
        return chain
      }),
      update: vi.fn(() => ({
        set: () => ({
          where: () => {
            state.updateCalls += 1
            return state.updateReject
              ? Promise.reject(new Error('db down'))
              : Promise.resolve([])
          },
        }),
      })),
    },
  }
})

vi.mock('../../plugins/auth.js', () => ({
  authenticate: authenticateMock,
  checkAuth: vi.fn(async () => true),
}))
vi.mock('../../plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async () => true),
}))
vi.mock('../../services/push-provider.js', () => ({
  sendPushBatch: sendPushBatchMock,
  detectPushProvider: vi.fn(() => 'stub'),
}))

import { adminPushRoutes, collectDeadTokens, isDeadTokenError } from '../push.js'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }

describe('isDeadTokenError 命中面', () => {
  it('认上游明确的"设备没了"四类错误', () => {
    expect(isDeadTokenError('FCM 404: {"error":{"details":[{"errorCode":"UNREGISTERED"}]}}')).toBe(true)
    expect(isDeadTokenError('The device push token is invalid (DeviceNotRegistered)')).toBe(true)
    expect(isDeadTokenError('InvalidRegistration')).toBe(true)
    expect(isDeadTokenError('invalid registration token')).toBe(true)
    expect(isDeadTokenError('NotRegistered')).toBe(true)
  })

  it('超时/限流/鉴权/网络一律不算设备失效', () => {
    expect(isDeadTokenError('The operation was aborted')).toBe(false)
    expect(isDeadTokenError('Expo 429: rate limited')).toBe(false)
    expect(isDeadTokenError('FCM 401: unauthorized')).toBe(false)
    expect(isDeadTokenError('fetch failed')).toBe(false)
    expect(isDeadTokenError(undefined)).toBe(false)
    expect(isDeadTokenError('')).toBe(false)
  })
})

describe('collectDeadTokens 对齐取', () => {
  it('只挑失败且判为失效的那几条', () => {
    const targets = ['tok-a', 'tok-b', 'tok-c', 'tok-d']
    const results = [
      { provider: 'expo' as const, success: true },
      { provider: 'expo' as const, success: false, error: 'DeviceNotRegistered' },
      { provider: 'expo' as const, success: false, error: 'Expo 429: rate limited' },
      { provider: 'expo' as const, success: false, error: 'unregistered' },
    ]
    expect(collectDeadTokens(targets, results)).toEqual(['tok-b', 'tok-d'])
  })

  it('结果比 targets 短时只取可靠前缀，不越界也不瞎猜', () => {
    expect(
      collectDeadTokens(['a', 'b', 'c'], [
        { provider: 'stub' as const, success: false, error: 'NotRegistered' },
      ]),
    ).toEqual(['a'])
  })
})

describe('POST /admin/push/send 失效 token 清理接线', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(adminPushRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  beforeEach(() => {
    state.deviceRows.length = 0
    state.prefRows.length = 0
    state.selectCalls = 0
    state.updateCalls = 0
    state.updateReject = false
    authenticateMock.mockImplementation(async (request: { userId?: string }) => {
      request.userId = USER_ID
    })
    sendPushBatchMock.mockReset()
  })

  it('tokens 分支：一条 DeviceNotRegistered ⇒ deactivated=1 且触发一次 update', async () => {
    sendPushBatchMock.mockImplementation(async (targets: Array<{ token: string }>) =>
      targets.map((t) =>
        t.token === 'tok-dead'
          ? { provider: 'expo', success: false, error: 'DeviceNotRegistered' }
          : { provider: 'expo', success: true },
      ),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/push/send',
      headers: AUTH_HEADERS,
      body: { title: 't', body: 'b', tokens: ['tok-live', 'tok-dead'] },
    })

    const body = res.json().data
    expect(body.success).toBe(1)
    expect(body.failed).toBe(1)
    expect(body.deactivated).toBe(1)
    expect(state.updateCalls).toBe(1)
  })

  it('memberIds 分支：按渠道分组后仍能对齐取失效 token', async () => {
    state.deviceRows.push([
      { token: 'tok-dead', userId: USER_ID },
      { token: 'tok-live', userId: USER_ID },
    ])
    state.prefRows.push([
      { userId: USER_ID, key: 'ringtone', value: 'chime' },
      { userId: USER_ID, key: 'soundEnabled', value: 'true' },
    ])
    sendPushBatchMock.mockImplementation(async (targets: Array<{ token: string }>) =>
      targets.map((t) =>
        t.token === 'tok-dead'
          ? { provider: 'fcm', success: false, error: 'InvalidRegistration' }
          : { provider: 'fcm', success: true },
      ),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/push/send',
      headers: AUTH_HEADERS,
      body: { title: 't', body: 'b', memberIds: [USER_ID] },
    })

    const body = res.json().data
    expect(body.total).toBe(2)
    expect(body.failed).toBe(1)
    expect(body.deactivated).toBe(1)
  })

  it('全部成功 ⇒ 响应不出现 deactivated，也不碰 DB', async () => {
    sendPushBatchMock.mockImplementation(async (targets: Array<{ token: string }>) =>
      targets.map(() => ({ provider: 'fcm', success: true })),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/push/send',
      headers: AUTH_HEADERS,
      body: { title: 't', body: 'b', tokens: ['tok-ok'] },
    })

    expect(res.json().data).not.toHaveProperty('deactivated')
    expect(state.updateCalls).toBe(0)
  })

  it('普通失败（超时）不清理：失败不等于设备没了', async () => {
    sendPushBatchMock.mockImplementation(async (targets: Array<{ token: string }>) =>
      targets.map(() => ({ provider: 'expo', success: false, error: 'The operation was aborted' })),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/push/send',
      headers: AUTH_HEADERS,
      body: { title: 't', body: 'b', tokens: ['tok-timeout'] },
    })

    expect(res.json().data.failed).toBe(1)
    expect(res.json().data).not.toHaveProperty('deactivated')
    expect(state.updateCalls).toBe(0)
  })

  it('清理写库失败只 warn，不改变本次投递结果', async () => {
    state.updateReject = true
    sendPushBatchMock.mockImplementation(async (targets: Array<{ token: string }>) =>
      targets.map(() => ({ provider: 'fcm', success: false, error: 'NotRegistered' })),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/push/send',
      headers: AUTH_HEADERS,
      body: { title: 't', body: 'b', tokens: ['tok-dead'] },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json().data
    expect(body.failed).toBe(1)
    // 写库失败 ⇒ deactivated 计 0，但响应本身仍正常（清理绝不连累投递结论）
    expect(body).not.toHaveProperty('deactivated')
    expect(state.updateCalls).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
