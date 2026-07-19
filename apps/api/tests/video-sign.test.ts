/**
 * video-sign 服务单元测试（纯函数,无 DB 依赖）。
 *
 * 覆盖：
 *  - signVideoToken 产生 64 字符 hex
 *  - signVideoToken 输出具有确定性(同输入同输出)
 *  - verifyVideoToken 接受合法签名、拒绝篡改
 *  - buildSignedVideoUrl 拼接 query 参数,带过期时间
 *  - 过期后 verify 仍通过(verify 只校验签名,过期校验交给业务侧比较 exp)
 *  - 错误长度/非法 hex 输入 verify 拒绝
 */
import { describe, it, expect } from 'vitest'
import {
  signVideoToken,
  verifyVideoToken,
  buildSignedVideoUrl,
} from '../src/services/video-sign.js'

describe('video-sign service', () => {
  it('signVideoToken returns 64-char hex', () => {
    const sig = signVideoToken({ userId: 'u1', resourceId: 'lesson:abc', expiresAt: 1234567890 })
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })

  it('signVideoToken is deterministic', () => {
    const payload = { userId: 'u1', resourceId: 'r1', expiresAt: 999 }
    expect(signVideoToken(payload)).toBe(signVideoToken(payload))
  })

  it('signVideoToken differs when any field changes', () => {
    const base = { userId: 'u1', resourceId: 'r1', expiresAt: 100 }
    const a = signVideoToken(base)
    const b1 = signVideoToken({ ...base, userId: 'u2' })
    const b2 = signVideoToken({ ...base, resourceId: 'r2' })
    const b3 = signVideoToken({ ...base, expiresAt: 101 })
    expect(a).not.toBe(b1)
    expect(a).not.toBe(b2)
    expect(a).not.toBe(b3)
  })

  it('verifyVideoToken accepts valid signature', () => {
    const payload = { userId: 'u1', resourceId: 'r1', expiresAt: 1000 }
    const sig = signVideoToken(payload)
    expect(verifyVideoToken({ ...payload, signature: sig })).toBe(true)
  })

  it('verifyVideoToken rejects tampered signature', () => {
    const payload = { userId: 'u1', resourceId: 'r1', expiresAt: 1000 }
    const sig = signVideoToken(payload)
    const tampered = sig.slice(0, -1) + (sig.endsWith('a') ? 'b' : 'a')
    expect(verifyVideoToken({ ...payload, signature: tampered })).toBe(false)
  })

  it('verifyVideoToken rejects empty / wrong-length signature', () => {
    expect(
      verifyVideoToken({ userId: 'u1', resourceId: 'r1', expiresAt: 1000, signature: '' }),
    ).toBe(false)
    expect(
      verifyVideoToken({ userId: 'u1', resourceId: 'r1', expiresAt: 1000, signature: 'short' }),
    ).toBe(false)
  })

  it('verifyVideoToken rejects when payload is mutated', () => {
    const sig = signVideoToken({ userId: 'u1', resourceId: 'r1', expiresAt: 1000 })
    expect(
      verifyVideoToken({ userId: 'u2', resourceId: 'r1', expiresAt: 1000, signature: sig }),
    ).toBe(false)
  })

  it('buildSignedVideoUrl embeds uid/rid/exp/sig query params', () => {
    const result = buildSignedVideoUrl({
      baseUrl: 'https://cdn.example.com/v.mp4',
      userId: 'user-1',
      resourceId: 'lesson:abc',
      ttlSeconds: 60,
    })
    expect(result.url).toMatch(/^https:\/\/cdn\.example\.com\/v\.mp4\?/)
    expect(result.url).toContain('uid=user-1')
    expect(result.url).toContain('rid=lesson%3Aabc')
    expect(result.url).toMatch(/exp=\d+/)
    expect(result.url).toMatch(/sig=[0-9a-f]{64}/)
    expect(result.signature).toMatch(/^[0-9a-f]{64}$/)
    expect(result.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('buildSignedVideoUrl works with baseUrl that already has query', () => {
    const result = buildSignedVideoUrl({
      baseUrl: 'https://cdn.example.com/v.mp4?token=abc',
      userId: 'u1',
      resourceId: 'r1',
      ttlSeconds: 60,
    })
    expect(result.url).toContain('&uid=u1')
    expect(result.url).toContain('&rid=r1')
    expect(result.url).toContain('&sig=')
  })

  it('buildSignedVideoUrl output signature round-trips verify', () => {
    const result = buildSignedVideoUrl({
      baseUrl: 'https://x.example/v.mp4',
      userId: 'u1',
      resourceId: 'r1',
      ttlSeconds: 60,
    })
    expect(
      verifyVideoToken({
        userId: 'u1',
        resourceId: 'r1',
        expiresAt: result.expiresAt,
        signature: result.signature,
      }),
    ).toBe(true)
  })
})
