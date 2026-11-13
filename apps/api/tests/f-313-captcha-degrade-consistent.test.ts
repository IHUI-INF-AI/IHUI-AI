// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-313 回归锁(2026-11-13)。
 *
 * 病灶:Redis 单条命令报错时,写侧落内存(memChallenges / memTokens),
 * 读/删/消费侧只查 Redis 并 catch return null/false ⇒ Redis 抖动期间
 * 验证码与一次性 token 全部失效,登录/注册/改密被锁死。
 *
 * 本文件锁:
 *   ① Redis 全部命令抛错:generateChallenge → verifyChallenge 仍成功(降级闭环),且仍单次使用;
 *   ② 降级下 token 签发后可校验一次,消费后第二次失败(一次性语义保留);
 *   ③ Redis 正常时以 Redis 为准,不读内存兜底(内存里的正确条目不会"救活"错误答案);
 *   ④ 限流异常 fail-open 不抛给调用方,但留下含限流键与原因的结构化 warn。
 *
 * 用假 Redis 对象直接注入 CaptchaService,不连真实 Redis。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Redis } from 'ioredis'
import { CaptchaService } from '../src/services/captcha-service.js'
import { logger } from '../src/utils/logger.js'

/** 全部命令抛错的 Redis(模拟 Redis 抖动/不可用)。 */
function brokenRedis(): Redis {
  const fail = (cmd: string) => async (): Promise<never> => {
    throw new Error(`redis ${cmd} down`)
  }
  return {
    get: fail('get'),
    set: fail('set'),
    del: fail('del'),
    incr: fail('incr'),
    expire: fail('expire'),
    exists: fail('exists'),
  } as unknown as Redis
}

/** 从 image 挑战的 SVG 里解出答案字符序列(与 sms-send-captcha 测试同一手法)。 */
function answerOf(imageData: string): string {
  const svg = Buffer.from(
    imageData.replace(/^data:image\/svg\+xml;base64,/, ''),
    'base64',
  ).toString('utf8')
  const answer = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)]
    .map((m) => m[1])
    .join('')
    .toLowerCase()
  expect(answer.length).toBeGreaterThanOrEqual(4)
  return answer
}

/** 内存降级表(私有静态字段运行时可直接访问,用于用例间隔离)。 */
const MEM = CaptchaService as unknown as {
  memChallenges: Map<string, unknown>
  memTokens: Map<string, unknown>
  memRate: Map<string, unknown>
}

describe('F-313 CAPTCHA 读写降级一致性', () => {
  beforeEach(() => {
    MEM.memChallenges.clear()
    MEM.memTokens.clear()
    MEM.memRate.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('① Redis 全部命令抛错:challenge 仍能生成并校验通过(且单次使用)', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const svc = new CaptchaService(brokenRedis())

    const ch = await svc.generateChallenge('image')
    const answer = answerOf(ch.imageData)
    const v = await svc.verifyChallenge(ch.challengeId, answer)

    expect(v.reason).toBeUndefined()
    expect(v.valid).toBe(true)
    expect(v.token).toBeTruthy()

    // 单次使用:同一 challenge 不能二次校验
    const again = await svc.verifyChallenge(ch.challengeId, answer)
    expect(again.valid).toBe(false)
    expect(again.reason).toBe('challenge-not-found-or-expired')
  })

  it('② 降级下 token 可校验一次,消费后第二次失败', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const svc = new CaptchaService(brokenRedis())

    const ch = await svc.generateChallenge('image')
    const v = await svc.verifyChallenge(ch.challengeId, answerOf(ch.imageData))
    if (!v.valid || !v.token) throw new Error(`token 签发失败: ${v.reason}`)
    const token = v.token

    expect(await svc.verifyToken(token)).toBe(true)
    await svc.consumeToken(token)
    expect(await svc.verifyToken(token)).toBe(false)
  })

  it('③ Redis 正常时以 Redis 为准,不读内存兜底', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})

    // 先用故障 Redis 生成挑战,让内存里存在该 challenge 的"正确"条目
    const broken = new CaptchaService(brokenRedis())
    const ch = await broken.generateChallenge('image')
    const correct = answerOf(ch.imageData)
    warn.mockClear()

    // Redis 正常且命中一条不同答案的记录
    const healthy = {
      get: async () => JSON.stringify({ answer: 'zzzz', type: 'image' }),
      set: async () => 'OK',
      del: async () => 1,
      incr: async () => 1,
      expire: async () => 1,
      exists: async () => 1,
    } as unknown as Redis
    const svc = new CaptchaService(healthy)

    const v = await svc.verifyChallenge(ch.challengeId, correct)
    expect(v.valid).toBe(false)
    expect(v.reason).toBe('wrong-answer')
    // 未走降级分支:没有 loadChallenge 失败告警
    expect(warn.mock.calls.some(([msg]) => String(msg).includes('loadChallenge'))).toBe(false)
  })

  it('④ 限流异常 fail-open,但留下含限流键与原因的结构化 warn', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const svc = new CaptchaService(brokenRedis())
    const ip = '198.51.100.7'

    // 不抛给调用方,挑战照常签发
    const ch = await svc.generateChallenge('math', ip)
    expect(ch.challengeId).toMatch(/^[0-9a-f]{32}$/)

    const hit = warn.mock.calls.find(([msg]) => msg === 'captcha: rate limit check failed, allow')
    expect(hit).toBeTruthy()
    expect(hit?.[1]).toMatchObject({
      key: `captcha:ratelimit:${ip}`,
      reason: 'redis-error',
    })
  })
})
