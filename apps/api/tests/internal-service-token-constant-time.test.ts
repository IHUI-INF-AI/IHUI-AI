// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 内部服务令牌比较的常数时间化(第三十八批)。
 *
 * 两件事分开测,缺一不可:
 * ① 行为等价:改成常数时间比较后,**每一种既有判定结论必须一字不变**
 *    (未配置 / 错票 / 对票 + 用户活跃 / 用户不存在)—— 否则"加固"就变成了回归。
 * ② 源码形状锁:比较处必须经唯一出口 `secretsEqual`,明文 `!==` 形态不得回来。
 *    只测①不够:把常数时间比较换回明文比较,行为断言**照样全绿**,
 *    因为差异只在耗时上——那一维在本机不可稳定测量,所以只能钉源码形状(§22c 同型)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }))

vi.mock('../src/db/index.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({ limit: () => mockSelect() }),
        }),
      }),
    },
  }
})

vi.mock('../src/config/index.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    config: {
      ...((actual as { config?: Record<string, unknown> }).config ?? {}),
      AI_CALLBACK_SECRET: 'internal-secret-value-for-tests-0123456789',
    },
  }
})

import { checkInternalServiceToken, secretsEqual } from '../src/plugins/internal-service-token'

const SECRET = 'internal-secret-value-for-tests-0123456789'

describe('secretsEqual:长度与内容都要盖住', () => {
  it('同值 ⇒ true(含非 ASCII;UTF-8 字节序一致才算同一把)', () => {
    expect(secretsEqual(SECRET, SECRET)).toBe(true)
    expect(secretsEqual('密钥-α', '密钥-α')).toBe(true)
  })

  it('等长不同值 ⇒ false', () => {
    expect(secretsEqual(SECRET, SECRET.replace(/9$/, '8'))).toBe(false)
  })

  it('不等长 ⇒ false 且**不抛**(明文 timingSafeEqual 在这一臂会抛错)', () => {
    expect(secretsEqual('short', SECRET)).toBe(false)
    expect(secretsEqual(SECRET, '')).toBe(false)
    expect(() => secretsEqual('', '')).not.toThrow()
  })
})

describe('checkInternalServiceToken:判定结论一字未变', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    mockSelect.mockReset()
    app = Fastify({ logger: false })
    // 用真路由 + inject 驱动:Fastify 5 没有 app.mockRequest,而手搓的 request/reply 对象
    // 恰好跳过本票要验的那一维(reply 真的被 send 过、statusCode 真的落到了响应上)
    app.addHook('preHandler', async (request, reply) => {
      if (request.url !== '/probe') return
      const ok = await checkInternalServiceToken(request, reply)
      if (!ok) return reply
    })
    app.get('/probe', async () => ({ ok: true }))
    await app.ready()
  })
  afterEach(async () => {
    await app.close()
  })

  const call = async (headers: Record<string, string>): Promise<{ ok: boolean; code: number }> => {
    const res = await app.inject({ method: 'GET', url: '/probe', headers })
    return { ok: res.statusCode === 200, code: res.statusCode }
  }

  it('对票 + 用户存在且活跃 ⇒ true 并注入 userId', async () => {
    mockSelect.mockResolvedValue([{ id: 'user-1', status: 1, roleId: 0 }])
    const r = await call({ 'x-internal-service-token': SECRET, 'x-user-id': 'user-1' })
    expect(r.ok).toBe(true)
  })

  it('错票 ⇒ 401(等长与不等长两种结论必须同形,不许因长度走到不同分支)', async () => {
    mockSelect.mockResolvedValue([{ id: 'user-1', status: 1, roleId: 0 }])
    const sameLen = await call({
      'x-internal-service-token': SECRET.replace(/9$/, '8'),
      'x-user-id': 'user-1',
    })
    const diffLen = await call({ 'x-internal-service-token': 'x', 'x-user-id': 'user-1' })
    expect(sameLen.code).toBe(401)
    expect(diffLen.code).toBe(401)
    // 关键:错票必须在**查库之前**就被拒 ⇒ 两条臂都不许触到 select
    expect(mockSelect).not.toHaveBeenCalled()
  })

  it('缺 x-user-id ⇒ 400(格式校验是第二道门,与"票不对"分档)', async () => {
    mockSelect.mockResolvedValue([{ id: 'user-1', status: 1, roleId: 0 }])
    const r = await call({ 'x-internal-service-token': SECRET })
    expect(r.code).toBe(400)
  })

  it('对票但库里没有这个用户 ⇒ 401', async () => {
    mockSelect.mockResolvedValue([])
    const r = await call({ 'x-internal-service-token': SECRET, 'x-user-id': 'ghost' })
    expect(r.code).toBe(401)
  })
})

describe('源码形状锁:比较必须经唯一出口', () => {
  const SRC = resolve(__dirname, '../src/plugins/internal-service-token.ts')

  it('比较处调用 secretsEqual,而不是明文 !== 比配置项', () => {
    // 逐字面量在本文件里拼出来:测试自己不得成为被扫描命中的那一行(否则锁会自我误伤)
    const needle = ['token', ' ', '!==', ' config.AI_CALLBACK_SECRET'].join('')
    const code = readFileSync(SRC, 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n')
    expect(code.includes(needle)).toBe(false)
    expect(code).toMatch(/secretsEqual\(\s*token\s*,\s*config\.AI_CALLBACK_SECRET\s*\)/)
  })

  it('secretsEqual 必须是"先摘要再比"(否则长度泄漏与早退都还在)', () => {
    const body = readFileSync(SRC, 'utf8')
    const fn = body.slice(body.indexOf('export function secretsEqual'))
    const head = fn.slice(0, fn.indexOf('\n}\n') + 2)
    expect(head).toContain("createHash('sha256')")
    expect(head).toContain('timingSafeEqual(')
    // 反例锁:直接对两把原文做 timingSafeEqual 的写法(会抛且泄漏长度)不得回来
    expect(head).not.toMatch(/timingSafeEqual\(\s*[ab]\s*,\s*[ab]\s*\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
