import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { type JWTPayload, verifyRefreshToken } from '@ihui/auth'
import { authenticate } from '../plugins/auth.js'
import { issueTokenPair } from '../services/token-service.js'
import {
  findUserById,
  revokeAllUserRefreshTokens,
  findRefreshToken,
  revokeRefreshToken,
} from '../db/queries.js'
import { getUserPermissions } from '../db/rbac-queries.js'
import { success, error } from '../utils/response.js'
import { randomBytes } from 'node:crypto'

const SSO_CODE_PREFIX = 'sso:code:'
const SSO_CODE_TTL_SEC = 30
const ADMIN_ROLE_ID = 1
const ADMIN_WILDCARD_PERMISSIONS = ['*:*:*']

/**
 * redirectUri 校验(2026-08-01 扩展:支持 localhost + 配置化 origins + Chrome 扩展 chromiumapp.org):
 * - 相对路径:必须以 "/" 开头(站内路径,防 open redirect),不允许以 "//" 开头
 * - localhost:http://localhost:NNNN/* 或 http://127.0.0.1:NNNN/*(CLI 本地回调服务器)
 * - 配置化 origins:env SSO_ALLOWED_ORIGINS(逗号分隔,如 http://localhost:8801,https://aizhs.top)
 * - Chrome 扩展 redirect:https://<extension-id>.chromiumapp.org/(chrome.identity.launchWebAuthFlow 固定域)
 * - 不允许包含 "\n\r" 等控制字符
 * - 总长度不超过 2048
 *
 * 安全边界:relative path 防 open redirect;localhost 仅限 loopback;origins 走 env 白名单;
 * chromiumapp.org 是 Chrome 扩展 identity 固定 redirect 域,只有已安装的扩展能接收该 URL 回调。
 */
const SSO_ALLOWED_ORIGINS = (process.env.SSO_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function isAllowedOrigin(url: string): boolean {
  try {
    const parsed = new URL(url)
    // 仅允许 http(s) scheme,防 javascript:/data: 等
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    return SSO_ALLOWED_ORIGINS.includes(parsed.origin)
  } catch {
    return false
  }
}

function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:') return false
    // 仅 loopback 地址(cli 本地回调服务器),不允许 0.0.0.0 或外网 IP
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1'
    )
  } catch {
    return false
  }
}

/**
 * Chrome 扩展 chrome.identity.launchWebAuthFlow 的固定 redirect 域。
 * 格式:https://<extension-id>.chromiumapp.org/
 * 安全性:只有已安装的 Chrome 扩展能接收该 URL 回调,第三方无法截获。
 */
function isChromeExtensionRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    // chromiumapp.org 是 Chrome 扩展 identity 固定 redirect 域
    // 子域是 extension-id(32 字符 a-p),path 通常为 / 或 /callback
    return parsed.hostname.endsWith('.chromiumapp.org')
  } catch {
    return false
  }
}

const isSafeRedirectUri = (s: string): boolean => {
  if (!s || s.length > 2048) return false
  if (/[\r\n\t]/.test(s)) return false
  // 1. 相对路径(站内重定向)
  if (s.startsWith('/') && !s.startsWith('//')) return true
  // 2. localhost(cli 本地回调服务器)
  if (isLocalhostUrl(s)) return true
  // 3. 配置化 origins(env SSO_ALLOWED_ORIGINS)
  if (isAllowedOrigin(s)) return true
  // 4. Chrome 扩展 redirect(chromiumapp.org 固定域)
  if (isChromeExtensionRedirectUrl(s)) return true
  return false
}

const generateCodeSchema = z.object({
  clientId: z.string().min(1).max(128),
  redirectUri: z.string().refine(isSafeRedirectUri, {
    message: 'redirectUri 必须是站内相对路径(以 / 开头且不以 // 开头)',
  }),
})

const exchangeCodeSchema = z.object({
  code: z.string().min(1).max(256),
  clientId: z.string().min(1).max(128),
})

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken 不能为空'),
})

const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60

async function buildTokenPair(user: {
  id: string
  phone: string | null
  roleId: number | null
  familyId: string | null
}) {
  const payload: JWTPayload = {
    userId: user.id,
    phone: user.phone ?? '',
    familyId: user.familyId ?? user.id,
    roleId: user.roleId ?? 0,
  }
  const tokens = await issueTokenPair(payload)
  return { ...tokens, refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS }
}

async function resolveUserPermissions(userId: string, roleId: number | null): Promise<string[]> {
  if (roleId !== null && roleId >= ADMIN_ROLE_ID) return ADMIN_WILDCARD_PERMISSIONS
  return getUserPermissions(userId)
}

export const authSsoRoutes: FastifyPluginAsync = async (server) => {
  // SSO 路由响应中携带 accessToken/refreshToken,必须跳过响应脱敏
  // 否则会被 response-sanitizer 的 'token' 子串匹配误伤为 '***'
  server.addHook('onRequest', async (request) => {
    request.skipResponseSanitization = true
  })

  server.post(
    '/sso/code',
    {
      preHandler: authenticate,
      schema: {
        summary: '生成 SSO 一次性授权码',
        description: '已登录用户生成一次性 code（30 秒有效），用于跨子项目共享登录态',
        tags: ['sso'],
        body: {
          type: 'object',
          required: ['clientId', 'redirectUri'],
          properties: {
            clientId: { type: 'string', description: '子项目标识（如 miniapp/ai-service/admin）' },
            redirectUri: { type: 'string', description: '授权后重定向地址' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = generateCodeSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const { clientId, redirectUri } = parsed.data
      const userId = request.userId!

      const user = await findUserById(userId)
      if (!user) {
        return reply.code(404).send(error(404, '用户不存在'))
      }

      const code = randomBytes(32).toString('base64url')
      const codeData = JSON.stringify({ userId, clientId, redirectUri, createdAt: Date.now() })
      await server.redis.set(SSO_CODE_PREFIX + code, codeData, 'EX', SSO_CODE_TTL_SEC)

      request.log.info({ userId, clientId }, 'SSO code generated')

      return reply.send(success({ code, redirectUri, expiresIn: SSO_CODE_TTL_SEC }))
    },
  )

  server.post(
    '/sso/exchange',
    {
      schema: {
        summary: 'SSO 授权码换取 Token',
        description: '子项目用一次性 code 换取 accessToken + refreshToken，实现跨子项目共享登录',
        tags: ['sso'],
        body: {
          type: 'object',
          required: ['code', 'clientId'],
          properties: {
            code: { type: 'string', description: 'SSO 一次性授权码' },
            clientId: { type: 'string', description: '子项目标识' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = exchangeCodeSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const { code, clientId } = parsed.data

      const stored = await server.redis.getdel(SSO_CODE_PREFIX + code)
      if (!stored) {
        return reply.code(401).send(error(401, '授权码无效或已过期'))
      }

      let codeData: { userId: string; clientId: string; redirectUri: string; createdAt: number }
      try {
        codeData = JSON.parse(stored)
      } catch {
        return reply.code(401).send(error(401, '授权码格式错误'))
      }

      if (codeData.clientId !== clientId) {
        request.log.warn({ expected: codeData.clientId, got: clientId }, 'SSO clientId mismatch')
        return reply.code(401).send(error(401, 'clientId 不匹配'))
      }

      const user = await findUserById(codeData.userId)
      if (!user) {
        return reply.code(404).send(error(404, '用户不存在'))
      }
      if (user.status !== 1) {
        return reply.code(403).send(error(403, '用户已被禁用'))
      }

      const tokens = await buildTokenPair(user)
      const permissions = await resolveUserPermissions(user.id, user.roleId)

      request.log.info({ userId: user.id, clientId }, 'SSO token exchanged')

      return reply.send(
        success({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          refreshExpiresIn: tokens.refreshExpiresIn,
          user: {
            id: user.id,
            phone: user.phone ?? '',
            email: user.email ?? '',
            nickname: user.nickname ?? '',
            avatar: user.avatar ?? '',
            roleId: user.roleId ?? 0,
            status: user.status ?? 1,
            permissions,
          },
        }),
      )
    },
  )

  server.post(
    '/sso/refresh',
    {
      schema: {
        summary: 'SSO 刷新 Token',
        description: '使用 refreshToken 轮换签发新的 accessToken / refreshToken（旧 token 吊销）',
        tags: ['sso'],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', description: '刷新令牌' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = refreshTokenSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.code(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const { refreshToken: token } = parsed.data

      // 1. 验证 refresh token 签名 + 过期
      let payload: JWTPayload
      try {
        payload = await verifyRefreshToken(token)
      } catch {
        return reply.code(401).send(error(401, 'refresh_token 无效或已过期'))
      }

      // 2. 查库确认未被吊销
      const record = await findRefreshToken(token)
      if (!record || record.revokedAt) {
        return reply.code(401).send(error(401, 'refresh_token 无效或已被吊销'))
      }

      // 3. 确认用户仍然存在且启用
      const user = await findUserById(payload.userId)
      if (!user) {
        return reply.code(404).send(error(404, '用户不存在'))
      }
      if (user.status !== 1) {
        return reply.code(403).send(error(403, '用户已被禁用'))
      }

      // 4. 吊销旧 refresh token（轮转）
      await revokeRefreshToken(token)

      // 5. 用同一 familyId 签发新 token 对
      const tokens = await buildTokenPair({
        id: user.id,
        phone: user.phone,
        roleId: user.roleId,
        familyId: payload.familyId,
      })
      const permissions = await resolveUserPermissions(user.id, user.roleId)

      request.log.info({ userId: user.id }, 'SSO token refreshed')

      return reply.send(
        success({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          refreshExpiresIn: tokens.refreshExpiresIn,
          user: {
            id: user.id,
            phone: user.phone ?? '',
            email: user.email ?? '',
            nickname: user.nickname ?? '',
            avatar: user.avatar ?? '',
            roleId: user.roleId ?? 0,
            status: user.status ?? 1,
            permissions,
          },
        }),
      )
    },
  )

  server.post(
    '/sso/logout',
    {
      preHandler: authenticate,
      schema: {
        summary: 'SSO 统一登出',
        description: '吊销当前用户的所有 token（踢下线所有子项目），实现单点登出',
        tags: ['sso'],
      },
    },
    async (request, reply) => {
      const userId = request.userId!
      await revokeAllUserRefreshTokens(userId)
      request.log.info({ userId }, 'SSO global logout')
      return reply.send(success({ loggedOut: true }))
    },
  )

  server.get(
    '/sso/validate',
    {
      preHandler: authenticate,
      schema: {
        summary: '验证当前 token 是否有效',
        description: '子项目调用此端点验证 token 有效性，返回用户信息',
        tags: ['sso'],
      },
    },
    async (request, reply) => {
      const userId = request.userId!
      const user = await findUserById(userId)
      if (!user) {
        return reply.code(404).send(error(404, '用户不存在'))
      }
      const permissions = await resolveUserPermissions(user.id, user.roleId)
      return reply.send(
        success({
          valid: true,
          user: {
            id: user.id,
            phone: user.phone ?? '',
            email: user.email ?? '',
            nickname: user.nickname ?? '',
            avatar: user.avatar ?? '',
            roleId: user.roleId ?? 0,
            status: user.status ?? 1,
            permissions,
          },
        }),
      )
    },
  )
}
