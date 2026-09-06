// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​​‌​​‌​​‌​⁠

/**
 * 运营商一键登录端点：POST /api/auth/login/carrier
 * - 入参: { accessToken, operator, sceneType? }
 * - 流程: 校验入参 → 运营商网关换号(verifyCarrierToken) → 按手机号查找/创建用户 → 2FA 检查 → 签发 JWT
 * - 复用 auth.ts 既有登录链路(issueTokenPair / setAuthCookies / publicUser / signChallengeToken)
 * - 网关错误统一处理为友好信息，不泄漏 KEY/SECRET 等凭据细节
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { createFamilyId } from '@ihui/auth'
import { issueTokenPair } from '../services/token-service.js'
import { signChallengeToken, CHALLENGE_TOKEN_TTL_SECONDS } from '../services/totp-service.js'
import { findUserByPhone, createUser } from '../db/queries.js'
import { success, error } from '../utils/response.js'
import { setAuthCookies } from '../utils/auth-cookies.js'
import { publicUser, resolveUserPermissions } from './auth.js'
import {
  verifyCarrierToken,
  CarrierLoginError,
  CarrierErrorCode,
} from '../services/carrier-login.js'

export const authCarrierRoutes: FastifyPluginAsync = async (server) => {
  const carrierLoginSchema = z.object({
    accessToken: z.string().min(1, 'accessToken 不能为空'),
    operator: z.string().min(1, 'operator 不能为空'),
    sceneType: z.enum(['one_click_login']).optional(),
  })

  server.post(
    '/login/carrier',
    {
      schema: {
        summary: '运营商一键登录(闪验 Univerify 聚合)',
        description:
          '使用运营商一键登录 token 换取手机号并登录。需 SDK 返回的 accessToken 与运营商标识(operator=flashverify)',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['accessToken', 'operator'],
          properties: {
            accessToken: { type: 'string', description: 'SDK 一键登录返回的运营商 token(一次有效)' },
            operator: { type: 'string', description: '运营商标识: flashverify / cmcc / cucc / ctcc' },
            sceneType: { type: 'string', description: '登录场景,默认 one_click_login', enum: ['one_click_login'] },
          },
        },
        // 注:与其他登录端点一致,不声明 response schema(避免固定状态码破坏 reply 的弱类型 send)
      },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = carrierLoginSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { accessToken, operator } = parsed.data

      // 1) 运营商网关换取手机号（捕获网关错误 → 友好信息，不泄漏凭据）
      let phone: string
      try {
        const result = await verifyCarrierToken({ operator, accessToken })
        phone = result.phone
      } catch (e) {
        if (e instanceof CarrierLoginError) {
          const status = e.status
          const message = friendlyMessage(e.code, status)
          return reply.status(status).send(error(status, message))
        }
        request.log.error({ err: e, operator }, '运营商一键登录网关调用失败')
        return reply.status(500).send(error(500, '运营商登录服务异常，请稍后重试'))
      }

      // 2) 查找或创建用户（复用微信 phone 登录用户逻辑）
      let user = await findUserByPhone(phone)
      if (!user) {
        try {
          user = await createUser({
            phone,
            nickname: `用户${phone.slice(-4)}`,
            roleId: 0,
            status: 1,
          })
        } catch (e) {
          request.log.error({ err: e, operator }, '运营商一键登录创建用户失败')
          return reply.status(500).send(error(500, '运营商一键登录创建用户失败'))
        }
      } else if (user.status !== 1) {
        return reply.status(403).send(error(403, '账号已被禁用'))
      }

      // 3) 2FA 检查:已启用两步验证时返回 challenge token,前端走 /auth/2fa/login-verify 二次校验
      if (user.twoFactorEnabled) {
        const challengeToken = await signChallengeToken({
          userId: user.id,
          phone: user.phone ?? '',
          familyId: '',
          roleId: user.roleId ?? 0,
        })
        request.skipResponseSanitization = true
        return reply.send(
          success({
            twoFactorRequired: true,
            challengeToken,
            expiresIn: CHALLENGE_TOKEN_TTL_SECONDS,
          }),
        )
      }

      // 4) 签发 token 对并返回统一登录结构
      request.skipResponseSanitization = true
      const familyId = createFamilyId()
      const tokens = await issueTokenPair({
        userId: user.id,
        phone: user.phone ?? '',
        familyId,
        roleId: user.roleId ?? 0,
      })
      const permissions = await resolveUserPermissions(user.id, user.roleId)
      setAuthCookies(reply, tokens, true)
      return reply.send(
        success({
          ...tokens,
          refreshExpiresIn: 30 * 24 * 60 * 60,
          user: publicUser(user, permissions),
        }),
      )
    },
  )
}

/** 将网关错误码映射为面向用户的友好文案（不暴露密钥 / 内部字段）。 */
function friendlyMessage(code: string, status: number): string {
  switch (code) {
    case CarrierErrorCode.NOT_CONFIGURED:
      return '运营商一键登录暂未配置，请联系管理员'
    case CarrierErrorCode.UNSUPPORTED:
      return '不支持的运营商或该运营商暂未接入'
    case CarrierErrorCode.TIMEOUT:
      return '运营商网关请求超时，请稍后重试'
    case CarrierErrorCode.INVALID_PHONE:
      return '运营商返回的手机号无效，请重试'
    default:
      return status >= 500 ? '运营商登录网关异常，请稍后重试' : '运营商手机号校验失败，请重试'
  }
}