// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 后台推送按用户通知偏好分 Android 渠道/铃声(2026-11-26)。
 *
 * 契约单一真相源在 `@ihui/shared/notifications/ringtone` 的
 * `resolveAndroidNotificationTarget`;本层只负责:批量读偏好 → 按渠道分组投递 →
 * 偏好读不到/无行/查询失败一律回落 `default`,绝不因偏好问题让推送失败或 500。
 *
 * mock 手法沿用同目录 push-devices.test.ts:mock db 查询链、authenticate/requireAdmin、
 * push-provider;select 按调用次序区分第 1 次(device_tokens)与第 2 次(user_preferences)。
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const USER_ID = '00000000-0000-4000-8000-0000000000aa'
const OTHER_ID = '00000000-0000-4000-8000-0000000000bb'

const { state, authenticateMock, sendPushBatchMock } = vi.hoisted(() => ({
  state: {
    deviceRows: [] as Array<Array<{ token: string; userId: string }>>,
    prefRows: [] as Array<Array<{ userId: string; key: string; value: string | null }>>,
    prefReject: false,
    selectCalls: 0,
  },
  authenticateMock: vi.fn(),
  sendPushBatchMock: vi.fn(),
}))

vi.mock('../../db/index.js', () => {
  interface Chain {
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise<unknown>
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
            // 第 1 次 select = device_tokens 收件人;第 2 次 = user_preferences 偏好。
            if (state.selectCalls === 1) {
              return Promise.resolve(state.deviceRows.shift() ?? []).then(resolve, reject)
            }
            if (state.prefReject) {
              return Promise.reject(new Error('db preferences down')).then(resolve, reject)
            }
            return Promise.resolve(state.prefRows.shift() ?? []).then(resolve, reject)
          },
        }
        return chain
      }),
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

import { adminPushRoutes } from '../push.js'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }

describe('POST /admin/push/send 按偏好分 Android 渠道/铃声', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(adminPushRoutes, { prefix: '/api/admin' })
    await app.ready()
  })

  beforeEach(() => {
    state.deviceRows.length = 0
    state.prefRows.length = 0
    state.prefReject = false
    state.selectCalls = 0
    authenticateMock.mockImplementation(async (request: { userId?: string }) => {
      request.userId = USER_ID
    })
    sendPushBatchMock.mockReset()
    sendPushBatchMock.mockImplementation(async (targets: Array<unknown>) =>
      targets.map(() => ({ provider: 'stub', success: true })),
    )
  })

  it('① ringtone=marimba ⇒ channelId=msg-marimba 且 sound=ringtone_marimba', async () => {
    state.deviceRows.push([{ token: 'tok-1', userId: USER_ID }])
    state.prefRows.push([
      { userId: USER_ID, key: 'ringtone', value: 'marimba' },
      { userId: USER_ID, key: 'soundEnabled', value: 'true' },
    ])

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/push/send',
      headers: AUTH_HEADERS,
      body: { title: 't', body: 'b', memberIds: [USER_ID] },
    })

    expect(res.statusCode).toBe(200)
    expect(sendPushBatchMock).toHaveBeenCalledTimes(1)
    const [targets, message] = sendPushBatchMock.mock.calls[0] as [
      Array<{ token: string }>,
      Record<string, unknown>,
    ]
    expect(targets).toEqual([{ token: 'tok-1' }])
    expect(message.channelId).toBe('msg-marimba')
    expect(message.sound).toBe('ringtone_marimba')
    expect(res.json().data.total).toBe(1)
  })

  it('② soundEnabled=false ⇒ channelId=msg-silent 且不带 sound', async () => {
    state.deviceRows.push([{ token: 'tok-1', userId: USER_ID }])
    state.prefRows.push([{ userId: USER_ID, key: 'soundEnabled', value: 'false' }])

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/push/send',
      headers: AUTH_HEADERS,
      body: { title: 't', body: 'b', memberIds: [USER_ID] },
    })

    expect(res.statusCode).toBe(200)
    const [, message] = sendPushBatchMock.mock.calls[0] as [
      Array<{ token: string }>,
      Record<string, unknown>,
    ]
    expect(message.channelId).toBe('msg-silent')
    expect(message).not.toHaveProperty('sound')
  })

  it('③ 偏好表无该行 ⇒ 回落兜底渠道 default,不带 sound', async () => {
    state.deviceRows.push([{ token: 'tok-1', userId: USER_ID }])
    state.prefRows.push([])

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/push/send',
      headers: AUTH_HEADERS,
      body: { title: 't', body: 'b', memberIds: [USER_ID] },
    })

    expect(res.statusCode).toBe(200)
    const [, message] = sendPushBatchMock.mock.calls[0] as [
      Array<{ token: string }>,
      Record<string, unknown>,
    ]
    expect(message.channelId).toBe('default')
    expect(message).not.toHaveProperty('sound')
  })

  it('④ 偏好查询抛错 ⇒ 仍走 default 且推送照发(未 500)', async () => {
    state.deviceRows.push([{ token: 'tok-1', userId: USER_ID }])
    state.prefReject = true
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/push/send',
      headers: AUTH_HEADERS,
      body: { title: 't', body: 'b', memberIds: [USER_ID] },
    })

    expect(res.statusCode).toBe(200)
    expect(warnSpy).toHaveBeenCalled()
    expect(sendPushBatchMock).toHaveBeenCalledTimes(1)
    const [, message] = sendPushBatchMock.mock.calls[0] as [
      Array<{ token: string }>,
      Record<string, unknown>,
    ]
    expect(message.channelId).toBe('default')
    expect(res.json().data.total).toBe(1)
    warnSpy.mockRestore()
  })

  it('⑤ 同渠道 token 合并一批,不同渠道分批发,条数不丢', async () => {
    state.deviceRows.push([
      { token: 'tok-1', userId: USER_ID },
      { token: 'tok-2', userId: OTHER_ID },
      { token: 'tok-3', userId: USER_ID },
    ])
    state.prefRows.push([
      { userId: USER_ID, key: 'ringtone', value: 'marimba' },
      { userId: USER_ID, key: 'soundEnabled', value: 'true' },
      { userId: OTHER_ID, key: 'ringtone', value: 'dingdong' },
      { userId: OTHER_ID, key: 'soundEnabled', value: 'true' },
    ])

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/push/send',
      headers: AUTH_HEADERS,
      body: { title: 't', body: 'b', memberIds: [USER_ID, OTHER_ID] },
    })

    expect(res.statusCode).toBe(200)
    expect(sendPushBatchMock).toHaveBeenCalledTimes(2)
    const calls = sendPushBatchMock.mock.calls as Array<
      [Array<{ token: string }>, Record<string, unknown>]
    >
    const marimbaCall = calls.find(([, m]) => m.channelId === 'msg-marimba')
    const dingdongCall = calls.find(([, m]) => m.channelId === 'msg-dingdong')
    expect(marimbaCall?.[0].map((t) => t.token).sort()).toEqual(['tok-1', 'tok-3'])
    expect(dingdongCall?.[0].map((t) => t.token)).toEqual(['tok-2'])
    expect(marimbaCall?.[1].sound).toBe('ringtone_marimba')
    expect(dingdongCall?.[1].sound).toBe('ringtone_dingdong')
    // 三枚 token 全部投递,条数不丢。
    expect(res.json().data.total).toBe(3)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
