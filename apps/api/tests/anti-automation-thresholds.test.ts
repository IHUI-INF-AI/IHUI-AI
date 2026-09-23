// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(async (token: string) => {
    if (token === 'bad') throw new Error('invalid token')
    return { userId: `u-${token}`, phone: '', familyId: '', roleId: 0 }
  }),
}))

import { __test__ } from '../src/plugins/anti-automation.js'

function reqWith(headers: Record<string, string>, cookies?: Record<string, string>) {
  return { headers, cookies } as unknown as import('fastify').FastifyRequest
}

describe('readIntEnv', () => {
  const { readIntEnv } = __test__
  const NAME = 'ANTI_AUTOMATION_TEST_INT'

  beforeEach(() => {
    delete process.env[NAME]
  })

  it('缺失时用默认值', () => {
    expect(readIntEnv(NAME, 600)).toBe(600)
  })

  it.each(['0', '-5', 'abc', '', '1e999'])(
    '非法值 %j 也回落到默认值(不能把配置错变成不设防)',
    (raw) => {
      process.env[NAME] = raw
      expect(readIntEnv(NAME, 600)).toBe(600)
    },
  )

  it('合法正整数生效并取整', () => {
    process.env[NAME] = '750.9'
    expect(readIntEnv(NAME, 600)).toBe(750)
  })
})

describe('封禁阈值(2026-09-23 IP 封禁事故)', () => {
  it('默认封禁线是 600/分钟,不再是能被单个页面打穿的 200', () => {
    const { BLOCK_THRESHOLD, DEFAULT_THRESHOLD } = __test__.thresholds()
    expect(BLOCK_THRESHOLD).toBe(600)
    expect(BLOCK_THRESHOLD).toBeGreaterThan(200)
    // 429 挑战线仍保持低位:它是软性第一道,且现在可通过 CAPTCHA 自助通过
    expect(DEFAULT_THRESHOLD).toBe(100)
    expect(DEFAULT_THRESHOLD).toBeLessThan(BLOCK_THRESHOLD)
  })
})

describe('resolveUserIdForRate', () => {
  const { resolveUserIdForRate } = __test__

  it('Bearer 头能解析出 userId(此前 onRequest 阶段读 request.userId 恒为 undefined)', async () => {
    expect(await resolveUserIdForRate(reqWith({ authorization: 'Bearer abc' }))).toBe('u-abc')
  })

  it('无 Authorization 时回落 auth_token cookie', async () => {
    expect(await resolveUserIdForRate(reqWith({}, { auth_token: 'ck' }))).toBe('u-ck')
  })

  it('非 Bearer 前缀的 Authorization 不取', async () => {
    expect(await resolveUserIdForRate(reqWith({ authorization: 'ApiKey xyz' }))).toBeUndefined()
  })

  it('完全没有凭据时不发验证请求', async () => {
    expect(await resolveUserIdForRate(reqWith({}))).toBeUndefined()
  })

  it('token 验签失败一律当匿名处理 —— 本函数不做授权,坏 token 自有鉴权层拒绝', async () => {
    expect(await resolveUserIdForRate(reqWith({ authorization: 'Bearer bad' }))).toBeUndefined()
  })
})

describe('封禁判据只看 IP 维度', () => {
  it('不再用 max(ipCount, userCount) 触发封禁:账号跑得快不该惩罚 NAT/热点共享出口', async () => {
    const fs = await import('node:fs/promises')
    const src = await fs.readFile(
      new URL('../src/plugins/anti-automation.ts', import.meta.url),
      'utf8',
    )
    expect(src).not.toMatch(/Math\.max\(ipCount,\s*userCount\)/)
    expect(src).toMatch(/if \(ipCount > BLOCK_THRESHOLD\)/)
    // 用户维度改喂信誉体系,而不是直接封 IP
    expect(src).toContain("recordBadEvent(ip, 'user-rate-exceeded')")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
