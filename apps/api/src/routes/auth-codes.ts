// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sendSmsCode, extractSmsSendGuard } from '../services/sms.js'
import { normalizeSmsPhone } from '../utils/phone.js'
import { verifyCode } from '../utils/code-store.js'
import { success, error } from '../utils/response.js'

// =============================================================================
// 验证码(legacy /public-api/auth-code + /public-api/auth-code/check 补开发,2 个端点)
// 业务逻辑参考 D 盘 AuthController:
//   GET  /public-api/auth-code       生成 6 位验证码 + 存缓存 + 发送短信
//   POST /public-api/auth-code/check 校验验证码(一次性)
// 复用现有 sms.ts sendSmsCode(阿里云/代理/console 三级降级)
// 复用 code-store.ts verifyCode(内存存储,一次性校验)
// =============================================================================

/** 入参允许 +86 / 0086 / 空格 / 连字符,先归一为 11 位再校验 ——
 *  与后台表单、群发 SQL 的号码口径收口成同一条判据(utils/phone.ts)。 */
const normalizedMobile = z
  .string()
  .min(1, 'mobile 为必填项')
  .max(20, '手机号过长')
  .refine((v) => normalizeSmsPhone(v) !== null, '手机号码格式错误')
  .transform((v) => normalizeSmsPhone(v) as string)

const mobileQuery = z.object({
  mobile: normalizedMobile,
})

const checkSchema = z.object({
  mobile: normalizedMobile,
  code: z.string().min(1, 'code 为必填项').max(8, 'code 过长'),
})

const authCodeRoutes: FastifyPluginAsync = async (server) => {
  // GET / — 获取验证码(Java: GET /public-api/auth-code, query: ?mobile=)
  // 公开端点(Java 无鉴权),发送短信验证码到指定手机号
  // P0 安全修复(2026-08-02):公开短信端点无限流可被刷短信轰炸,限制 1 次/分钟/IP。
  server.get(
    '/',
    { config: { rateLimit: { max: 1, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = mobileQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { mobile } = parsed.data
      const result = await sendSmsCode(
        mobile,
        undefined,
        extractSmsSendGuard(request.headers, request.ip),
      )
      if (!result.success) {
        // 限速 → 429(对应 Java 抛 GlobalException 的语义);云侧没发出去 → 502,两者不得同形
        const status = result.failure === 'delivery_failed' ? 502 : 429
        return reply.status(status).send(error(status, result.msg))
      }
      return reply.send(success({ mobile, sent: true, message: result.msg }))
    },
  )

  // POST /check — 校验验证码(Java: POST /public-api/auth-code/check)
  // body: { mobile, code } — 校验通过返回 true,失败返回 false
  // P0 安全修复(2026-08-02):6 位数字验证码仅 100 万种组合,无限流可暴力破解。
  // 限制每分钟 5 次校验尝试,覆盖单 IP 暴力破解场景。
  server.post(
    '/check',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = checkSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { mobile, code } = parsed.data
      const ok = await verifyCode(mobile, code)
      return reply.send(success({ valid: ok }))
    },
  )
}

export default authCodeRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
