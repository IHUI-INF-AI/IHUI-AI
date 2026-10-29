// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 短信发码端点人机验证闸(2026-10-27 立,补「换 IP/高频轰炸」最后一道人墙)。
 *
 * 覆盖端点(全站发码面,后缀匹配,前缀无关):
 *   POST /api/auth/send-code                    (auth.ts)
 *   POST /api/auth/sms/send                     (auth.ts)
 *   POST /api/auth/sms/code                     (auth-extended.ts)
 *   POST /api/sms-proxy/send                    (auth-extended.ts)
 *   POST /api/auth/change-phone/send-old-code   (auth-extended.ts)
 *   POST /api/auth/change-phone/send-new-code   (auth-extended.ts)
 *
 * 模式(env.SMS_SEND_CAPTCHA_MODE,逐请求读取,便于运维热切换):
 *   - 'escalate'(默认):每 IP 1 小时内发码请求超 SMS_SEND_CAPTCHA_THRESHOLD(默认 20)次后,
 *     必须携带有效人机验证 token;阈值内零摩擦(正常用户永远遇不到验证)。
 *     —— 2026-10-20 机主曾以「服务端软校验可被不带 token 绕过 ⇒ 纯摩擦」为由关闭登录勾选,
 *        故本闸采用风险升级制:不对人加摩擦,只对脚本升压。
 *   - 'required':全量强制,所有请求都必须带有效 token(三端全部接入 widget 后启用)。
 *   - 'off':不主动要求 token;但请求若带了 token 仍会校验,无效即拒(防篡改,不存在
 *     "带垃圾 token 反而通过"的语义漏洞)。
 *
 * token 双通道(任一):
 *   - body.turnstileToken → Cloudflare Turnstile(TURNSTILE_SECRET_KEY 未配置时
 *     verifyTurnstile 降级放行,与登录端点同一语义);
 *   - body.captchaToken → CaptchaService 临时 token(POST /api/security/challenge 取
 *     图形/数学挑战 → /api/security/challenge/verify 换 token;一次性消费)。
 *
 * 豁免:内网/回环 IP(isPrivateIp)整闸跳过 —— 与 anti-automation 同一语义,
 * 开发与运维探测不受影响。
 *
 * 拒绝响应:429 + X-Challenge-Required: captcha + body.captchaEndpoint,
 * 客户端据此走挑战流程后重试。
 */

import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import type { Redis } from 'ioredis'
import { logger } from './logger.js'
import { tryConsumeWindows } from './window-counter.js'
import { isPrivateIp } from '../services/ip-reputation.js'
import { verifyTurnstile } from '../services/turnstile-service.js'
import { getCaptchaService } from '../services/captcha-service.js'

/** 发码端点 URL 后缀集(与 routeOptions.url 做 endsWith 匹配,天然覆盖各注册前缀)。 */
export const SMS_SEND_URL_SUFFIXES = [
  '/send-code',
  '/sms/send',
  '/auth/sms/code',
  '/sms-proxy/send',
  '/auth/change-phone/send-old-code',
  '/auth/change-phone/send-new-code',
] as const

const ESCALATE_WINDOW_MS = 60 * 60 * 1000
const DEFAULT_THRESHOLD = 20
const CHALLENGE_ENDPOINT = '/api/security/challenge'

export type SmsCaptchaMode = 'escalate' | 'required' | 'off'

/** 逐请求读取,运维改 env + 重启即生效,也便于测试注入。 */
function readMode(): SmsCaptchaMode {
  const raw = process.env.SMS_SEND_CAPTCHA_MODE?.trim().toLowerCase()
  if (raw === 'required' || raw === 'off') return raw
  return 'escalate'
}

function readThreshold(): number {
  const n = Number(process.env.SMS_SEND_CAPTCHA_THRESHOLD)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_THRESHOLD
}

/** 是否发码端点(后缀匹配;'?' 已被 routeOptions.url 排除)。 */
export function isSmsSendUrl(url: string | undefined): boolean {
  if (!url) return false
  return SMS_SEND_URL_SUFFIXES.some((s) => url === s || url.endsWith(s))
}

/** 从请求体提取人机验证 token(两种通道任一)。返回 null = 未提供。 */
function extractToken(body: unknown): { kind: 'turnstile' | 'captcha'; token: string } | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  const t = b.turnstileToken
  if (typeof t === 'string' && t) return { kind: 'turnstile', token: t }
  const c = b.captchaToken
  if (typeof c === 'string' && c) return { kind: 'captcha', token: c }
  return null
}

function reject(reply: FastifyReply): void {
  reply.status(429).header('X-Challenge-Required', 'captcha').header('Retry-After', '60').send({
    code: 429,
    message: '验证码请求过于频繁,请先完成人机验证',
    captchaEndpoint: CHALLENGE_ENDPOINT,
  })
}

async function verifyProvidedToken(request: FastifyRequest, redis: Redis | null): Promise<boolean> {
  const provided = extractToken(request.body)
  if (!provided) return false
  if (provided.kind === 'turnstile') {
    try {
      const r = await verifyTurnstile(provided.token, request.ip)
      return r.success
    } catch {
      return false
    }
  }
  const captcha = getCaptchaService(redis)
  const ok = await captcha.verifyToken(provided.token)
  if (ok) await captcha.consumeToken(provided.token) // 一次性:一次验证换一次发码
  return ok
}

const smsSendCaptchaPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  const redis: Redis | null = (server as unknown as { redis?: Redis }).redis ?? null

  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method !== 'POST') return
    if (!isSmsSendUrl(request.routeOptions?.url)) return
    if (isPrivateIp(request.ip)) return

    const mode = readMode()
    const provided = extractToken(request.body)

    // 带 token 就验,无效即拒 —— 任何模式下都不存在"垃圾 token 放行"
    if (provided) {
      const ok = await verifyProvidedToken(request, redis)
      if (!ok) {
        logger.warn('sms-send-captcha: 提供的 token 无效', {
          ip: request.ip,
          kind: provided.kind,
          url: request.routeOptions?.url,
        })
        reject(reply)
        return
      }
      // token 有效:视为已通过人机验证,不再进入 escalate 计数(不惩罚已验证的调用方)
      return
    }

    if (mode === 'off') return

    if (mode === 'required') {
      logger.info('sms-send-captcha: required 模式缺 token', {
        ip: request.ip,
        url: request.routeOptions?.url,
      })
      reject(reply)
      return
    }

    // escalate:阈值内放行,超阈值强制 token
    const exceeded = await tryConsumeWindows([
      { key: `sms:cap:esc:${request.ip}`, windowMs: ESCALATE_WINDOW_MS, max: readThreshold() },
    ])
    if (exceeded > 0) {
      logger.warn('sms-send-captcha: 阈值升级,要求人机验证', {
        ip: request.ip,
        url: request.routeOptions?.url,
      })
      reject(reply)
    }
  })
}

export default fp(smsSendCaptchaPlugin, {
  name: 'sms-send-captcha',
  fastify: '5.x',
})

/** 供单测直接命中判据,不引入 CLI 副作用。 */
export const __test__ = {
  isSmsSendUrl,
  readMode,
  readThreshold,
  extractToken,
  SMS_SEND_URL_SUFFIXES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
