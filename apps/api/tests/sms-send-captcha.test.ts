// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { getCaptchaService } from '../src/services/captcha-service.js'
import smsSendCaptchaPlugin, { __test__ } from '../src/utils/sms-send-captcha.js'

const { isSmsSendUrl } = __test__

/**
 * 走真实 CaptchaService(内存降级模式)发一枚一次性 token:
 * generateChallenge('image') → 从 SVG 里解出字符序列(答案即 <text> 文本,4-6 位)
 * → verifyChallenge 换临时 token。零 mock,连插件内部的同一个单例。
 */
async function issueCaptchaToken(): Promise<string> {
  const svc = getCaptchaService(null)
  const ch = await svc.generateChallenge('image')
  const b64 = ch.imageData.replace(/^data:image\/svg\+xml;base64,/, '')
  const svg = Buffer.from(b64, 'base64').toString('utf8')
  const answer = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)]
    .map((m) => m[1])
    .join('')
    .toLowerCase()
  expect(answer.length).toBeGreaterThanOrEqual(4)
  const v = await svc.verifyChallenge(ch.challengeId, answer)
  if (!v.valid || !v.token) throw new Error(`captcha token 签发失败: ${v.reason}`)
  return v.token
}

/** 构建最小 app:插件 + 假发码路由(真实路由在 auth/auth-extended,行为契约由本假路由代表)。 */
async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(smsSendCaptchaPlugin)
  await app.register(
    async (scope) => {
      scope.post('/send-code', async () => ({ sent: true }))
      scope.post('/sms/send', async () => ({ sent: true }))
      scope.post('/change-phone/send-new-code', async () => ({ sent: true }))
      scope.get('/unrelated', async () => ({ ok: true }))
    },
    { prefix: '/api/auth' },
  )
  await app.ready()
  return app
}

/**
 * escalation 计数走共享 Redis(若在跑),跨测试运行会残留 ⇒ 每次运行用随机 B 段,
 * 保证阈值语义在"本运行内"自洽。
 */
const IP_BASE = 100 + (Date.now() % 50)
let ipSeq = 0
const nextIp = (): string => `${IP_BASE === 127 ? 128 : IP_BASE}.${++ipSeq % 200}`

describe('sms-send-captcha — isSmsSendUrl 前缀无关匹配', () => {
  it('命中全部发码端点(带 /api/auth 前缀)', () => {
    expect(isSmsSendUrl('/api/auth/send-code')).toBe(true)
    expect(isSmsSendUrl('/api/auth/sms/send')).toBe(true)
    expect(isSmsSendUrl('/api/auth/sms/code')).toBe(true)
    expect(isSmsSendUrl('/api/sms-proxy/send')).toBe(true)
    expect(isSmsSendUrl('/api/auth/change-phone/send-old-code')).toBe(true)
    expect(isSmsSendUrl('/api/auth/change-phone/send-new-code')).toBe(true)
  })

  it('不误伤相邻路径', () => {
    expect(isSmsSendUrl('/api/auth/resend-code')).toBe(false)
    expect(isSmsSendUrl('/api/auth/login')).toBe(false)
    expect(isSmsSendUrl('/api/admin/sms/callback')).toBe(false)
    expect(isSmsSendUrl(undefined)).toBe(false)
  })
})

describe('sms-send-captcha — 三模式行为', () => {
  let app: FastifyInstance
  const savedMode = process.env.SMS_SEND_CAPTCHA_MODE
  const savedThreshold = process.env.SMS_SEND_CAPTCHA_THRESHOLD

  beforeAll(async () => {
    app = await buildApp()
  })

  afterEach(() => {
    process.env.SMS_SEND_CAPTCHA_MODE = savedMode
    process.env.SMS_SEND_CAPTCHA_THRESHOLD = savedThreshold
  })

  afterAll(async () => {
    await app.close()
  })

  const post = (url: string, body: unknown, ip: string) =>
    app.inject({ method: 'POST', url, payload: body as object, remoteAddress: ip })

  it('off 模式:无 token 放行', async () => {
    process.env.SMS_SEND_CAPTCHA_MODE = 'off'
    const res = await post('/api/auth/send-code', { phone: '13812345678' }, nextIp())
    expect(res.statusCode).toBe(200)
  })

  it('off 模式:带了无效 token 仍拒(防篡改,不存在垃圾 token 放行)', async () => {
    process.env.SMS_SEND_CAPTCHA_MODE = 'off'
    const res = await post(
      '/api/auth/send-code',
      { phone: '13812345678', captchaToken: 'garbage-token' },
      nextIp(),
    )
    expect(res.statusCode).toBe(429)
    expect(res.headers['x-challenge-required']).toBe('captcha')
  })

  it('required 模式:缺 token ⇒ 429 + 挑战端点指引', async () => {
    process.env.SMS_SEND_CAPTCHA_MODE = 'required'
    const res = await post('/api/auth/send-code', { phone: '13812345678' }, nextIp())
    expect(res.statusCode).toBe(429)
    expect(res.json().captchaEndpoint).toBe('/api/security/challenge')
  })

  it('required 模式:有效 captchaToken 放行,且一次性(重放即拒)', async () => {
    process.env.SMS_SEND_CAPTCHA_MODE = 'required'
    const token = await issueCaptchaToken()
    const ok = await post(
      '/api/auth/send-code',
      { phone: '13812345678', captchaToken: token },
      nextIp(),
    )
    expect(ok.statusCode).toBe(200)
    const replay = await post(
      '/api/auth/send-code',
      { phone: '13812345678', captchaToken: token },
      nextIp(),
    )
    expect(replay.statusCode).toBe(429)
  })

  it('required 模式:内网/回环 IP 豁免(运维探测不应被卡)', async () => {
    process.env.SMS_SEND_CAPTCHA_MODE = 'required'
    const res = await post('/api/auth/send-code', { phone: '13812345678' }, '127.0.0.1')
    expect(res.statusCode).toBe(200)
  })

  it('escalate 模式:阈值内零摩擦,超阈值强制 token;带有效 token 可继续', async () => {
    process.env.SMS_SEND_CAPTCHA_MODE = 'escalate'
    process.env.SMS_SEND_CAPTCHA_THRESHOLD = '2'
    const ip = nextIp()
    const body = { phone: '13812345678' }
    expect((await post('/api/auth/change-phone/send-new-code', body, ip)).statusCode).toBe(200)
    expect((await post('/api/auth/change-phone/send-new-code', body, ip)).statusCode).toBe(200)
    expect((await post('/api/auth/change-phone/send-new-code', body, ip)).statusCode).toBe(429)
    const withToken = await post(
      '/api/auth/change-phone/send-new-code',
      { ...body, captchaToken: await issueCaptchaToken() },
      ip,
    )
    expect(withToken.statusCode).toBe(200)
  })

  it('escalate 模式:不同 IP 计数互不干扰', async () => {
    process.env.SMS_SEND_CAPTCHA_MODE = 'escalate'
    process.env.SMS_SEND_CAPTCHA_THRESHOLD = '1'
    const a = await post('/api/auth/send-code', { phone: '13812345678' }, nextIp())
    const b = await post('/api/auth/send-code', { phone: '13812345678' }, nextIp())
    expect(a.statusCode).toBe(200)
    expect(b.statusCode).toBe(200)
  })

  it('非发码路径不受影响', async () => {
    process.env.SMS_SEND_CAPTCHA_MODE = 'required'
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/unrelated',
      payload: {},
      remoteAddress: nextIp(),
    })
    // 未注册 POST /unrelated ⇒ 404 而非 429,证明闸没拦它
    expect(res.statusCode).toBe(404)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
