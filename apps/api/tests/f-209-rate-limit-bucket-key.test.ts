// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-209 回归锁（2026-11-13）。
 *
 * 病灶：distributed-rate-limit 的 `tenant` scope 桶键取客户端 `x-tenant-id` 原始值，
 * 攻击者每次换 header 就落入新桶 ⇒ 限流恒不触发。
 *
 * 本文件锁（桶键只认服务端可信身份）：
 *   ① 同一已认证 userId 携带不同 x-tenant-id → 生成完全相同的桶键；
 *   ② 未认证请求 → 按 IP 分桶；
 *   ③ 已认证且 tenant_members 成员校验出服务端租户 → 桶键含该租户；
 *   ④ 桶键不含客户端 header 原文（防回归）。
 *
 * 只桩限流存储（server.redis.eval）与成员租户解析，不触达真实 Redis/PG。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => ({
  memberTenantByUser: new Map<string, string>(),
  bucketKeys: [] as string[],
}))

vi.mock('../src/plugins/tenant.js', () => ({
  resolveVerifiedTenantIdForUser: vi.fn(
    async (userId: string) => h.memberTenantByUser.get(userId) ?? null,
  ),
}))

import { distributedRateLimit } from '../src/plugins/distributed-rate-limit.js'

const RULE = 'f209-tenant-probe'
const TENANT_VERIFIED = '3f1c1a76-8a1e-4c31-9a4f-52bd0c1d2e01'
const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'
const USER_C = '33333333-3333-4333-8333-333333333333'

describe('F-209 tenant scope 桶键只取服务端可信身份', () => {
  let app: FastifyInstance

  const redisEval = vi.fn(async (...args: unknown[]) => {
    h.bucketKeys.push(String(args[2]))
    return [1, 1, 60_000]
  })

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate('redis', { eval: redisEval } as unknown as FastifyInstance['redis'])
    await app.register(distributedRateLimit)
    app.distributedRateLimit.addRule({
      name: RULE,
      limit: 100,
      windowSec: 60,
      scope: 'tenant',
    })
    app.get(
      '/probe',
      {
        preHandler: [
          // 模拟鉴权：鉴权完成后 request.userId 才对限流可见
          async (request) => {
            const uid = request.headers['x-test-user']
            if (typeof uid === 'string' && uid) request.userId = uid
          },
          app.distributedRateLimit.preHandler(RULE),
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
    h.bucketKeys.length = 0
    h.memberTenantByUser.clear()
    redisEval.mockClear()
  })

  async function probe(headers: Record<string, string>, remoteAddress = '127.0.0.1') {
    await app.inject({ method: 'GET', url: '/probe', headers, remoteAddress })
    return h.bucketKeys[h.bucketKeys.length - 1] ?? ''
  }

  it('① 同一 userId 切换 x-tenant-id 仍落到同一个桶', async () => {
    const keyA = await probe({ 'x-test-user': USER_A, 'x-tenant-id': 'tenant-alpha' })
    const keyB = await probe({ 'x-test-user': USER_A, 'x-tenant-id': 'tenant-beta' })

    expect(keyA).toBe(keyB)
    expect(keyA).toContain(`user:${USER_A}`)
    expect(h.bucketKeys).toHaveLength(2)
  })

  it('② 未认证请求按 IP 分桶', async () => {
    const key = await probe({ 'x-tenant-id': 'tenant-alpha' }, '203.0.113.9')

    expect(key).toContain('ip:203.0.113.9')
    expect(key).not.toContain('tenant-alpha')
  })

  it('③ 已认证且成员校验出服务端租户时，桶键含该租户', async () => {
    h.memberTenantByUser.set(USER_B, TENANT_VERIFIED)

    const key = await probe({ 'x-test-user': USER_B, 'x-tenant-id': 'attacker-tenant-9999' })

    expect(key).toContain(`tenant:${TENANT_VERIFIED}`)
    expect(key).not.toContain('attacker-tenant-9999')
  })

  it('④ 桶键不包含客户端原始 header 值', async () => {
    const evil = 'deadbeef-attacker-tenant-header'
    await probe({ 'x-test-user': USER_C, 'x-tenant-id': evil })
    await probe({ 'x-tenant-id': evil }, '198.51.100.7')

    expect(h.bucketKeys.length).toBeGreaterThan(0)
    for (const key of h.bucketKeys) {
      expect(key).not.toContain(evil)
      expect(key).not.toContain('x-tenant-id')
    }
  })
})
