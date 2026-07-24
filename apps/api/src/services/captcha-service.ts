/**
 * 挑战码服务 (CAPTCHA)。
 *
 * 挑战类型:
 *  - 'image': 图形验证码(纯 SVG 生成,4-6 位字符 + 干扰线 + 字符旋转),零依赖
 *  - 'math':  数学题后备(如 "2 + 3 = ?"),用于无 SVG 渲染能力的客户端
 *  - 'recaptcha': reCAPTCHA v3 验证(需配置 RECAPTCHA_SECRET,未配置则降级 math)
 *
 * 验证:verifyChallenge 用常量时间比较 (timingSafeEqual),验证后立即删除(单次使用)。
 * 存储:Redis key=captcha:{challengeId} → JSON{answer,type} TTL 5min。
 * 频率限制:同一 IP 1 分钟内最多 10 次挑战请求。
 *
 * 降级:Redis 不可用时回退内存。
 */

import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import type { Redis } from 'ioredis'
import { logger } from '../utils/logger.js'

/* -------------------------------------------------------------------------- */
/* 类型                                                                        */
/* -------------------------------------------------------------------------- */

export type ChallengeType = 'image' | 'math' | 'recaptcha'

export interface Challenge {
  challengeId: string
  /** base64 data URI(SVG),客户端可直接 <img src="..."> */
  imageData: string
  type: ChallengeType
  /** math 类型下的题目文本,如 "2 + 3 = ?" */
  question?: string
  expiresAt: number
}

export interface VerifyResult {
  valid: boolean
  /** 验证通过后下发的临时 token,用于后续受保护请求 */
  token?: string
  reason?: string
}

/* -------------------------------------------------------------------------- */
/* 常量                                                                        */
/* -------------------------------------------------------------------------- */

const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
const CHALLENGE_TTL_SEC = 5 * 60
const TOKEN_TTL_SEC = 10 * 60
const RATE_LIMIT_PER_MIN = 10
const RATE_LIMIT_WINDOW_SEC = 60

const K_CHALLENGE = (id: string) => `captcha:${id}`
const K_TOKEN = (token: string) => `captcha:token:${token}`
const K_RATE = (ip: string) => `captcha:ratelimit:${ip}`

/* -------------------------------------------------------------------------- */
/* 服务实现                                                                    */
/* -------------------------------------------------------------------------- */

export class CaptchaService {
  constructor(private readonly redis: Redis | null) {}

  /* ----------------------------- 生成挑战 ----------------------------- */

  /**
   * 生成 CAPTCHA 挑战。
   * @param type  挑战类型,默认 'image'
   * @param ip    调用方 IP,用于频率限制
   */
  async generateChallenge(
    type: ChallengeType = 'image',
    ip?: string,
  ): Promise<Challenge> {
    // 频率限制
    if (ip) {
      const allowed = await this.checkRateLimit(ip)
      if (!allowed) {
        throw new Error('challenge rate limit exceeded')
      }
    }

    const challengeId = randomBytes(16).toString('hex')
    const expiresAt = Date.now() + CHALLENGE_TTL_SEC * 1000

    // reCAPTCHA 未配置 secret 时降级为 math
    let actualType = type
    if (type === 'recaptcha' && !process.env.RECAPTCHA_SECRET) {
      actualType = 'math'
    }

    let answer: string
    let imageData: string
    let question: string | undefined

    if (actualType === 'image') {
      const len = randomInt(4, 7) // 4-6 位
      answer = randomCode(len)
      imageData = renderSvgImage(answer)
    } else if (actualType === 'math') {
      const { text, result } = mathProblem()
      question = text
      answer = String(result)
      imageData = renderMathSvg(text)
    } else {
      // recaptcha:客户端应自行渲染 Google reCAPTCHA,此处仅登记 challengeId 占位
      answer = ''
      imageData = ''
    }

    await this.storeChallenge(challengeId, { answer: answer.toLowerCase(), type: actualType })

    return {
      challengeId,
      imageData,
      type: actualType,
      question,
      expiresAt,
    }
  }

  /* ----------------------------- 验证挑战 ----------------------------- */

  /**
   * 验证挑战答案。常量时间比较,验证后立即删除(单次使用)。
   * 通过则下发临时 token。
   */
  async verifyChallenge(challengeId: string, answer: string): Promise<VerifyResult> {
    if (!challengeId || !answer) {
      return { valid: false, reason: 'missing-challenge-or-answer' }
    }

    const stored = await this.loadChallenge(challengeId)
    if (!stored) {
      return { valid: false, reason: 'challenge-not-found-or-expired' }
    }

    // 单次使用:无论对错都删除,防止重放
    await this.deleteChallenge(challengeId)

    // recaptcha 类型:answer 应为 Google token,需走 verifyRecaptcha
    if (stored.type === 'recaptcha') {
      const ok = await this.verifyRecaptcha(answer, undefined)
      if (!ok) return { valid: false, reason: 'recaptcha-verification-failed' }
      const token = await this.issueToken()
      return { valid: true, token }
    }

    const expected = stored.answer
    const provided = answer.toLowerCase()
    if (!constantTimeEqual(provided, expected)) {
      return { valid: false, reason: 'wrong-answer' }
    }

    const token = await this.issueToken()
    return { valid: true, token }
  }

  /** 校验临时 token 是否有效(单次校验不消费,token 自然过期)。 */
  async verifyToken(token: string): Promise<boolean> {
    if (!token) return false
    if (!this.redis) {
      const v = CaptchaService.memTokens.get(token)
      return !!v && v > Date.now()
    }
    try {
      const r = await this.redis.exists(K_TOKEN(token))
      return r === 1
    } catch (e) {
      logger.warn('captcha: verifyToken failed', { err: e })
      return false
    }
  }

  /** 消费 token(一次性使用场景)。 */
  async consumeToken(token: string): Promise<void> {
    if (!token) return
    if (!this.redis) {
      CaptchaService.memTokens.delete(token)
      return
    }
    try {
      await this.redis.del(K_TOKEN(token))
    } catch (e) {
      logger.warn('captcha: consumeToken failed', { err: e })
    }
  }

  /* ----------------------------- reCAPTCHA ----------------------------- */

  /** reCAPTCHA v3 服务端验证(需 RECAPTCHA_SECRET)。未配置返回 false。 */
  private async verifyRecaptcha(token: string, ip: string | undefined): Promise<boolean> {
    const secret = process.env.RECAPTCHA_SECRET
    if (!secret || !token) return false
    try {
      const params = new URLSearchParams({ secret, response: token })
      if (ip) params.set('remoteip', ip)
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        body: params,
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!resp.ok) return false
      const data = (await resp.json()) as { success?: boolean; score?: number }
      // 要求 success 且分数 >= 0.5
      return data.success === true && (data.score ?? 0) >= 0.5
    } catch (e) {
      logger.warn('captcha: recaptcha verify failed', { err: e })
      return false
    }
  }

  /* ----------------------------- 频率限制 ----------------------------- */

  private async checkRateLimit(ip: string): Promise<boolean> {
    if (!this.redis) {
      const cur = CaptchaService.memRate.get(ip) ?? { count: 0, expiresAt: 0 }
      if (cur.expiresAt < Date.now()) cur.count = 0
      cur.count += 1
      cur.expiresAt = Date.now() + RATE_LIMIT_WINDOW_SEC * 1000
      CaptchaService.memRate.set(ip, cur)
      return cur.count <= RATE_LIMIT_PER_MIN
    }
    try {
      const key = K_RATE(ip)
      const count = await this.redis.incr(key)
      if (count === 1) await this.redis.expire(key, RATE_LIMIT_WINDOW_SEC)
      return count <= RATE_LIMIT_PER_MIN
    } catch (e) {
      logger.warn('captcha: rate limit check failed, allow', { err: e })
      return true
    }
  }

  /* ----------------------------- 挑战存储 ----------------------------- */

  private async storeChallenge(id: string, data: { answer: string; type: ChallengeType }): Promise<void> {
    if (!this.redis) {
      CaptchaService.memChallenges.set(id, { ...data, expiresAt: Date.now() + CHALLENGE_TTL_SEC * 1000 })
      return
    }
    try {
      await this.redis.set(K_CHALLENGE(id), JSON.stringify(data), 'EX', CHALLENGE_TTL_SEC)
    } catch (e) {
      CaptchaService.memChallenges.set(id, { ...data, expiresAt: Date.now() + CHALLENGE_TTL_SEC * 1000 })
      logger.warn('captcha: storeChallenge failed, used mem', { err: e })
    }
  }

  private async loadChallenge(id: string): Promise<{ answer: string; type: ChallengeType } | null> {
    if (!this.redis) {
      const v = CaptchaService.memChallenges.get(id)
      if (!v || v.expiresAt < Date.now()) {
        if (v) CaptchaService.memChallenges.delete(id)
        return null
      }
      return { answer: v.answer, type: v.type }
    }
    try {
      const raw = await this.redis.get(K_CHALLENGE(id))
      if (!raw) return null
      return JSON.parse(raw) as { answer: string; type: ChallengeType }
    } catch (e) {
      logger.warn('captcha: loadChallenge failed', { err: e })
      return null
    }
  }

  private async deleteChallenge(id: string): Promise<void> {
    if (!this.redis) {
      CaptchaService.memChallenges.delete(id)
      return
    }
    try {
      await this.redis.del(K_CHALLENGE(id))
    } catch (e) {
      logger.warn('captcha: deleteChallenge failed', { err: e })
    }
  }

  private async issueToken(): Promise<string> {
    const token = randomBytes(24).toString('hex')
    if (!this.redis) {
      CaptchaService.memTokens.set(token, Date.now() + TOKEN_TTL_SEC * 1000)
      return token
    }
    try {
      await this.redis.set(K_TOKEN(token), '1', 'EX', TOKEN_TTL_SEC)
    } catch (e) {
      CaptchaService.memTokens.set(token, Date.now() + TOKEN_TTL_SEC * 1000)
      logger.warn('captcha: issueToken failed, used mem', { err: e })
    }
    return token
  }

  /* ----------------------------- 内存降级存储 ----------------------------- */

  private static readonly memChallenges = new Map<
    string,
    { answer: string; type: ChallengeType; expiresAt: number }
  >()
  private static readonly memTokens = new Map<string, number>()
  private static readonly memRate = new Map<string, { count: number; expiresAt: number }>()
}

/* -------------------------------------------------------------------------- */
/* 常量时间比较                                                                */
/* -------------------------------------------------------------------------- */

/**
 * 常量时间字符串相等比较。长度不同时也走完比较(用零填充),不提前返回,
 * 防止通过计时差异判断答案长度/前缀。
 */
function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  const len = Math.max(ba.length, bb.length)
  if (len === 0) return ba.length === bb.length
  // 用零填充到等长
  const pa = Buffer.alloc(len)
  const pb = Buffer.alloc(len)
  ba.copy(pa)
  bb.copy(pb)
  return timingSafeEqual(pa, pb)
}

/* -------------------------------------------------------------------------- */
/* 图形 / 数学挑战生成                                                         */
/* -------------------------------------------------------------------------- */

function randomCode(length: number): string {
  let code = ''
  const rand = randomBytes(length)
  for (let i = 0; i < length; i++) {
    code += CHARS[(rand[i] ?? 0) % CHARS.length] ?? ''
  }
  return code
}

/** 生成 SVG 图形验证码:字符随机旋转 + 颜色 + 干扰线 + 噪点。 */
function renderSvgImage(code: string): string {
  const width = 140
  const height = 44
  const chars = code.split('')
  const rand = randomBytes(128)
  let offset = 0
  const nextRand = (): number => {
    const v = rand[offset] ?? 0
    offset = (offset + 1) % rand.length
    return v
  }

  // 噪点
  const noise: string[] = []
  for (let i = 0; i < 18; i++) {
    const x = nextRand() * width / 256
    const y = nextRand() * height / 256
    const c = (nextRand() * 0xffffff & 0xffffff)
    const color = `#${c.toString(16).padStart(6, '0')}`
    noise.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1" fill="${color}" opacity="0.35"/>`)
  }

  // 干扰线
  const lines: string[] = []
  for (let i = 0; i < 3; i++) {
    const x1 = nextRand() * width / 256
    const y1 = nextRand() * height / 256
    const x2 = nextRand() * width / 256
    const y2 = nextRand() * height / 256
    const c = (nextRand() * 0x999999 + 0x333333 & 0xffffff)
    const color = `#${c.toString(16).padStart(6, '0')}`
    lines.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="1" opacity="0.5"/>`)
  }

  // 字符
  const charEls = chars
    .map((ch, i) => {
      const rotate = randomInt(-22, 23)
      const y = 28 + randomInt(-3, 4)
      const c = 0x333333 + (nextRand() * 0x444444 & 0xcccccc)
      const color = `#${c.toString(16).padStart(6, '0')}`
      const x = 18 + i * 24
      return `<text x="${x}" y="${y}" font-size="26" font-family="monospace" fill="${color}" transform="rotate(${rotate} ${x} ${y - 6})" font-weight="bold">${escapeXml(ch)}</text>`
    })
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#f7f7f8"/>${lines.join('')}${noise.join('')}${charEls}</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
}

function renderMathSvg(text: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="44" viewBox="0 0 160 44"><rect width="160" height="44" fill="#f7f7f8"/><text x="80" y="29" font-size="20" font-family="monospace" fill="#333" text-anchor="middle" font-weight="bold">${escapeXml(text)}</text></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
}

function mathProblem(): { text: string; result: number } {
  const a = randomInt(1, 10)
  const b = randomInt(1, 10)
  const op = randomInt(0, 2)
  if (op === 0) return { text: `${a} + ${b} = ?`, result: a + b }
  if (op === 1) return { text: `${a} × ${b} = ?`, result: a * b }
  // 减法保证非负
  const [big, small] = a >= b ? [a, b] : [b, a]
  return { text: `${big} − ${small} = ?`, result: big - small }
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (ch) => {
    switch (ch) {
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '&': return '&amp;'
      case "'": return '&apos;'
      case '"': return '&quot;'
      default: return ch
    }
  })
}

/* -------------------------------------------------------------------------- */
/* 单例工厂                                                                    */
/* -------------------------------------------------------------------------- */

let singleton: CaptchaService | null = null
export function getCaptchaService(redis: Redis | null): CaptchaService {
  if (!singleton) singleton = new CaptchaService(redis)
  return singleton
}
