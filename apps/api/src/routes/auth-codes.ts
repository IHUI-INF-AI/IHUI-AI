import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sendSmsCode } from '../services/sms.js'
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

const mobileQuery = z.object({
  mobile: z
    .string()
    .min(1, 'mobile 为必填项')
    .regex(/^1[3-9]\d{9}$/, '手机号码格式错误')
    .max(20, '手机号过长'),
})

const checkSchema = z.object({
  mobile: z
    .string()
    .min(1, 'mobile 为必填项')
    .regex(/^1[3-9]\d{9}$/, '手机号码格式错误'),
  code: z.string().min(1, 'code 为必填项').max(8, 'code 过长'),
})

const authCodeRoutes: FastifyPluginAsync = async (server) => {
  // GET / — 获取验证码(Java: GET /public-api/auth-code, query: ?mobile=)
  // 公开端点(Java 无鉴权),发送短信验证码到指定手机号
  server.get('/', async (request, reply) => {
    const parsed = mobileQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { mobile } = parsed.data
    const result = await sendSmsCode(mobile)
    if (!result.success) {
      // 限速或发送失败:返回 429(对应 Java 抛 GlobalException 的语义)
      return reply.status(429).send(error(429, result.msg))
    }
    return reply.send(success({ mobile, sent: true, message: result.msg }))
  })

  // POST /check — 校验验证码(Java: POST /public-api/auth-code/check)
  // body: { mobile, code } — 校验通过返回 true,失败返回 false
  server.post('/check', async (request, reply) => {
    const parsed = checkSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { mobile, code } = parsed.data
    const ok = verifyCode(mobile, code)
    return reply.send(success({ valid: ok }))
  })
}

export default authCodeRoutes
