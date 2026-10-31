// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全强化第 18 批(2026-10-31)修复钉住:WS ticket 与 access token 的**双向**隔离。
 *
 * 背景:ws-auth 的设计声明是「access token 被盗不能直接连 WS」,但隔离此前是
 * 单向的 —— verifyAccessToken 只拒 type='refresh',type='ws' 的 5 分钟 ticket
 * 放行 ⇒ ticket 经 URL query 泄漏(WS 平台约束)后可在 TTL 内当
 * Authorization: Bearer 打任意 REST 端点,危害面从 WS 扩大到全 REST。
 * 修复:verifyAccessToken 与 key-rotation 的 verifyWithGracePeriod 都拒 type='ws';
 * key-rotation 链同时补齐缺 subject 即拒(与 jwt.ts 同口径)。
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { signAccessToken, verifyAccessToken, getJwtSecret, type JWTPayload } from '../src/jwt'
import { generateWsToken } from '../src/ws-auth'

const TEST_SECRET = 'test-jwt-secret-at-least-32-characters-long!!!'
const originalSecret = process.env.JWT_SECRET

const basePayload: JWTPayload = {
  userId: 'user-uuid-1',
  phone: '13800000000',
  familyId: '11111111-1111-1111-1111-111111111111',
  roleId: 0,
}

describe('WS ticket 双向隔离(第 18 批 F3)', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET
  })

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = originalSecret
  })

  it('type=ws 的 token 被 verifyAccessToken 拒绝(401)', async () => {
    const wsToken = await generateWsToken(basePayload.userId)
    await expect(verifyAccessToken(wsToken)).rejects.toThrow(/ws ticket 不能用作 access token/)
  })

  it('带 device payload 的 ws ticket 同样被拒', async () => {
    const wsToken = await generateWsToken(basePayload.userId, { deviceId: 'device-1' })
    await expect(verifyAccessToken(wsToken)).rejects.toThrow(/ws ticket/)
  })

  it('正常 access token 不受影响(放行面回归)', async () => {
    const token = await signAccessToken(basePayload)
    const decoded = await verifyAccessToken(token)
    expect(decoded.userId).toBe(basePayload.userId)
  })

  it('getJwtSecret 需要的环境就位(自检)', () => {
    expect(getJwtSecret().length).toBeGreaterThanOrEqual(32)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
