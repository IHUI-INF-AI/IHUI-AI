// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 黑名单对象建不起来时的失败闭合(与 TokenBlacklist.has 默认一致)。
 *
 * getTokenBlacklist() 在 IORedis 构造抛错时返回 null,且模块内会记住失败。
 * 本文件单独 import,避免把 auth-access-token-revocation.test.ts 里已经建好的
 * 单例打成永久失败。空 token 仍返回 false,与 has('') 一致。
 */
import { describe, it, expect, vi } from 'vitest'
import type { FastifyRequest } from 'fastify'

vi.mock('ioredis', () => ({
  default: class FailingRedis {
    constructor() {
      throw new Error('blacklist init injected failure')
    }
  },
}))

const userStatusMock = vi.hoisted(() => ({ getUserStatus: vi.fn() }))
vi.mock('../src/db/usercenter-queries.js', () => userStatusMock)

import { signAccessToken } from '@ihui/auth'
import { authenticate, isAccessTokenRevoked } from '../src/plugins/auth.js'

const USER_A = '11111111-1111-4111-8111-111111111111'

function makeRequest(token: string): FastifyRequest {
  return {
    headers: { authorization: `Bearer ${token}` },
    method: 'GET',
    url: '/api/me',
    ip: '10.0.0.1',
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  } as unknown as FastifyRequest
}

describe('access token 吊销 · 黑名单对象建不起来(fail-closed)', () => {
  it('初始化失败时 authenticate 视为已吊销并拒绝', async () => {
    const token = await signAccessToken({
      userId: USER_A,
      phone: '13800000000',
      familyId: 'fam-a',
      roleId: 2,
    })
    await expect(authenticate(makeRequest(token))).rejects.toMatchObject({
      statusCode: 401,
      message: 'Token has been revoked',
    })
    expect(userStatusMock.getUserStatus).not.toHaveBeenCalled()
  })

  it('初始化失败时非空 token 视为已吊销,空 token 仍不是吊销', async () => {
    const token = await signAccessToken({
      userId: USER_A,
      phone: '13800000000',
      familyId: 'fam-a',
      roleId: 2,
    })
    await expect(isAccessTokenRevoked(token)).resolves.toBe(true)
    await expect(isAccessTokenRevoked('')).resolves.toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
