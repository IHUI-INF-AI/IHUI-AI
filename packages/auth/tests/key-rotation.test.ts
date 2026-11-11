// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-21/DBG-22(2026-11-11 bug-hunt)回归锁:
 * - verifyWithGracePeriod / signAccessToken 必须先 await Redis 轮换状态载入
 *   (readyPromise),否则窗口内只有 env 默认密钥 ⇒ 已轮换(V2)token 批量 401;
 * - getActiveKey/getActiveVersion 同步 getter 从不 await ⇒ 改 async,
 *   等待恢复完成后才返回可信密钥/版本。
 */
import { describe, it, expect } from 'vitest'
import { SignJWT } from 'jose'
import type IORedis from 'ioredis'
import { JwtKeyRotator } from '../src/key-rotation'

const V1 = new TextEncoder().encode('regression-key-v1-at-least-32-chars!!!')
const V2 = new TextEncoder().encode('regression-key-v2-at-least-32-chars!!!')

function b64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

/** Redis 里已持久化 V2 状态(模拟"已轮换"),get 延迟 resolve 制造读取窗口。 */
function slowRedisWithV2(delayMs: number): IORedis {
  const state = {
    current: {
      version: 2,
      keyB64: b64(V2),
      createdAt: Date.now(),
      expiresAt: Date.now() + 3_600_000,
      fingerprint: 'ab'.repeat(8),
    },
    previous: null,
    phase: 'stable',
    advanceRatio: 1,
    gracePeriodSec: 86_400,
  }
  return {
    get: () => new Promise<string>((resolve) => setTimeout(() => resolve(JSON.stringify(state)), delayMs)),
    set: async () => 'OK',
  } as unknown as IORedis
}

/** 用 V2 签发一个与 key-rotation 校验口径(iss/aud/HS256/sub)一致的 access token。 */
async function signWithV2(): Promise<string> {
  return new SignJWT({ phone: '13800000000', familyId: 'fam-1', roleId: 1 })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-rotate-1')
    .setIssuer('ihui-ai')
    .setAudience('ihui-ai-users')
    .setIssuedAt()
    .setExpirationTime('60s')
    .sign(V2)
}

describe('JwtKeyRotator · readyPromise 等待锁(DBG-21/DBG-22)', () => {
  it('DBG-21: Redis 状态未载入完成时,verifyWithGracePeriod 等待恢复后放行 V2 token', async () => {
    const rotator = new JwtKeyRotator({ initialKey: V1, redis: slowRedisWithV2(30) })
    const token = await signWithV2()
    // 修复前:此刻 getVerificationKeys() 只有 V1 ⇒ 直接抛"token 验证失败"(批量 401)
    const payload = await rotator.verifyWithGracePeriod(token)
    expect(payload.userId).toBe('user-rotate-1')
    expect(payload.roleId).toBe(1)
  })

  it('DBG-22: getActiveKey/getActiveVersion await 恢复完成后返回 Redis 中的 V2', async () => {
    const rotator = new JwtKeyRotator({ initialKey: V1, redis: slowRedisWithV2(30) })
    // 修复前:同步 getter 立即返回过期的 env 默认 V1/version=1
    const key = await rotator.getActiveKey()
    expect(b64(key)).toBe(b64(V2))
    expect(await rotator.getActiveVersion()).toBe(2)
  })

  it('DBG-21 同根因: signAccessToken 等待恢复后才用 V2 签发(签出的 token 可被自己验证)', async () => {
    const rotator = new JwtKeyRotator({ initialKey: V1, redis: slowRedisWithV2(30) })
    const token = await rotator.signAccessToken({
      userId: 'user-rotate-2',
      phone: '13900000000',
      familyId: 'fam-2',
      roleId: 0,
    })
    const payload = await rotator.verifyWithGracePeriod(token)
    expect(payload.userId).toBe('user-rotate-2')
  })

  it('无 Redis(纯内存)路径不回归:版本从 1 起,签发/验证闭环可用', async () => {
    const rotator = new JwtKeyRotator({ initialKey: V1 })
    expect(await rotator.getActiveVersion()).toBe(1)
    const token = await rotator.signAccessToken({
      userId: 'user-mem-1',
      phone: '13700000000',
      familyId: 'fam-3',
      roleId: 2,
    })
    const payload = await rotator.verifyWithGracePeriod(token)
    expect(payload.userId).toBe('user-mem-1')
  })

  it('refresh/ws 类型仍被拒(第 18 批 F3 面不回归)', async () => {
    const rotator = new JwtKeyRotator({ initialKey: V1 })
    const refresh = await new SignJWT({ type: 'refresh' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-x')
      .setIssuer('ihui-ai')
      .setAudience('ihui-ai-users')
      .setIssuedAt()
      .setExpirationTime('60s')
      .sign(V1)
    await expect(rotator.verifyWithGracePeriod(refresh)).rejects.toThrow(/refresh/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
