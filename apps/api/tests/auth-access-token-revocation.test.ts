// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * access token 吊销面(2026-10-30 立)。
 *
 * 此前 `packages/auth` 的 TokenBlacklist 早已写好,但只在**登出**时被调用,
 * 认证链路从不查它 ⇒ 用户点了「退出登录」、或管理员把人踢下线之后,
 * 被偷走的 access token 仍能照用到自然过期(默认 15 分钟)。本文件把"登出即可生效"钉住。
 *
 * 为什么每条都成对:
 *  - 「未吊销 → 通过 / 吊销后 → 401」⇒ 摘掉 authenticateInner 里的 blacklist.has 就翻红
 *    (吊销写进了 Redis,但认证当没看见);
 *  - 「吊销 A 不影响 B」⇒ 把 key 改成按用户而不是按 token 摘要就翻红
 *    (那会把同一用户的其它设备一起踢飞,正是 passkey 场景最忌讳的);
 *  - 「已过期的 token 不写黑名单」⇒ 摘掉 ttl<=0 的早退就翻红(键永不回收,
 *    Redis 里堆一批永远命中不到的死条目);
 *  - 「Redis 读失败仍放行」是对**刻意裁决**的锁定,不是待修缺陷:
 *    auth.ts 头注写明"Redis 是限流/缓存/队列的共同依赖,它挂时全站已大面积降级,
 *    为一项吊销把全站打成 401,代价大于收益"。这条测试防止后人"顺手改成 fail-closed"
 *    而把全站登录一起带走 —— 要改这条裁决,得先改那段注释与提交信息。
 *
 * 不连真实 PG(8810)/Redis(8811):用户状态与 Redis 全走替身,@ihui/auth 用真实现签发/验签。
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import type { FastifyRequest } from 'fastify'

const state = vi.hoisted(() => ({
  store: new Map<string, { value: string; expiresAt: number }>(),
  calls: [] as Array<{ cmd: string; args: unknown[] }>,
  failures: new Set<string>(),
}))

vi.mock('ioredis', async () => {
  const { makeFakeRedisClass } = await import('./helpers/fake-redis.js')
  return { default: makeFakeRedisClass(state) }
})

const userStatusMock = vi.hoisted(() => ({ getUserStatus: vi.fn() }))
vi.mock('../src/db/usercenter-queries.js', () => userStatusMock)

import { signAccessToken } from '@ihui/auth'
import { authenticate, revokeAccessToken } from '../src/plugins/auth.js'

const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'

function makeRequest(token: string): FastifyRequest {
  return {
    headers: { authorization: `Bearer ${token}` },
    method: 'GET',
    url: '/api/me',
    ip: '10.0.0.1',
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  } as unknown as FastifyRequest
}

function bearerOf(payload: { userId: string; phone: string; familyId: string; roleId: number }) {
  return signAccessToken(payload)
}

beforeAll(() => {
  userStatusMock.getUserStatus.mockResolvedValue(1)
})

beforeEach(() => {
  state.store.clear()
  state.calls.length = 0
  state.failures.clear()
  userStatusMock.getUserStatus.mockClear()
})

describe('access token 吊销 · 认证链路真的查了黑名单', () => {
  it('未吊销的 token 正常通过,并落到正确的 userId', async () => {
    const token = await bearerOf({
      userId: USER_A,
      phone: '13800000000',
      familyId: 'fam-a',
      roleId: 2,
    })
    const payload = await authenticate(makeRequest(token))
    expect(payload.userId).toBe(USER_A)
  })

  it('吊销后同一枚 token 立即 401,不等自然过期', async () => {
    const token = await bearerOf({
      userId: USER_A,
      phone: '13800000000',
      familyId: 'fam-a',
      roleId: 2,
    })
    await authenticate(makeRequest(token))

    await revokeAccessToken(token, new Date(Date.now() + 10 * 60 * 1000))

    await expect(authenticate(makeRequest(token))).rejects.toMatchObject({
      statusCode: 401,
      message: 'Token has been revoked',
    })
  })

  it('吊销按 token 摘要生效,不波及同一用户的其它会话', async () => {
    // access token 没有 jti,同一秒内为同一用户签发会得到**完全相同**的字符串。
    // 这里把时钟推开 2 秒来模拟"两台设备先后登录",否则两枚 token 相同,本用例会
    // 把"摘要有效"测成"按用户吊销"的假阳性。
    const base = Date.now()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(base))
    const kicked = await bearerOf({
      userId: USER_A,
      phone: '13800000000',
      familyId: 'fam-a',
      roleId: 2,
    })
    vi.setSystemTime(new Date(base + 2000))
    const kept = await bearerOf({
      userId: USER_A,
      phone: '13800000000',
      familyId: 'fam-a',
      roleId: 2,
    })
    vi.useRealTimers()
    expect(kicked).not.toBe(kept)
    await revokeAccessToken(kicked, new Date(Date.now() + 10 * 60 * 1000))

    await expect(authenticate(makeRequest(kicked))).rejects.toMatchObject({ statusCode: 401 })
    await expect(authenticate(makeRequest(kept))).resolves.toMatchObject({ userId: USER_A })
  })

  it('另一用户的 token 不受影响', async () => {
    const tokenA = await bearerOf({
      userId: USER_A,
      phone: '13800000000',
      familyId: 'fam-a',
      roleId: 2,
    })
    const tokenB = await bearerOf({
      userId: USER_B,
      phone: '13900000000',
      familyId: 'fam-b',
      roleId: 2,
    })
    await revokeAccessToken(tokenA, new Date(Date.now() + 10 * 60 * 1000))

    await expect(authenticate(makeRequest(tokenB))).resolves.toMatchObject({ userId: USER_B })
  })

  it('已过期的 token 不写黑名单(键不会永不回收)', async () => {
    const token = await bearerOf({
      userId: USER_A,
      phone: '13800000000',
      familyId: 'fam-a',
      roleId: 2,
    })
    state.calls.length = 0
    await revokeAccessToken(token, new Date(Date.now() - 1000))
    expect(state.calls.filter((c) => c.cmd === 'setex')).toHaveLength(0)
  })
})

describe('access token 吊销 · 失败方向(刻意 fail-open)', () => {
  it('黑名单读不到时放行 —— 不让 Redis 抖动把全站已登录用户打成 401', async () => {
    const token = await bearerOf({
      userId: USER_A,
      phone: '13800000000',
      familyId: 'fam-a',
      roleId: 2,
    })
    state.failures.add('exists')
    await expect(authenticate(makeRequest(token))).resolves.toMatchObject({ userId: USER_A })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
