/**
 * Coze OAuth 路由 (Fastify)。
 * 迁移自 v1.0.2-sealed: server/app/api/v1/auth/coze_oauth.py
 *
 * 提供 4 种 OAuth 模式:
 * - device: 设备码授权
 * - web: Web 授权码流程
 * - pkce: PKCE 扩展授权码流程
 * - jwt: JWT 授权 (最常用, 服务端直接签发)
 *
 * 端点:
 * - GET  /authorize  获取授权 URL (支持 device/web/pkce/jwt 四种模式)
 * - POST /token      获取 access_token
 * - POST /refresh    刷新 token
 * - POST /jwt        直接获取 JWT access_token (最常用)
 * - GET  /config     查看 Coze OAuth 配置 (脱敏)
 *
 * 注册前缀: /api/coze/oauth
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { success, error } from '../utils/response.js'
import { loadCozeOAuthConfig, getCozeAccessToken } from '../services/coze-auth-utils.js'
import {
  DeviceOAuthApp,
  WebOAuthApp,
  PKCEOAuthApp,
  JWTOAuthApp,
} from '../services/coze-oauth-apps.js'

const OAUTH_TYPES = ['device', 'web', 'pkce', 'jwt'] as const

const authorizeQuerySchema = z.object({
  type: z.enum(OAUTH_TYPES).default('jwt'),
  redirect_uri: z.string().optional(),
  state: z.string().optional(),
  scope: z.string().optional(),
  workspace_id: z.string().optional(),
  code_verifier: z.string().optional(),
  code_challenge_method: z.string().default('S256'),
  base_url: z.string().optional(),
})

const tokenBodySchema = z.object({
  type: z.enum(OAUTH_TYPES).default('jwt'),
  device_code: z.string().optional(),
  code: z.string().optional(),
  redirect_uri: z.string().optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  code_verifier: z.string().optional(),
  user_uuid: z.string().nullable().optional(),
  scope: z.string().optional(),
  ttl: z.number().optional(),
  force_refresh: z.boolean().default(false),
  base_url: z.string().optional(),
})

const refreshBodySchema = z.object({
  type: z.enum(OAUTH_TYPES).default('jwt'),
  refresh_token: z.string().optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  user_uuid: z.string().nullable().optional(),
  base_url: z.string().optional(),
})

const jwtBodySchema = z.object({
  user_uuid: z.string().nullable().optional(),
  scope: z.string().optional(),
  ttl: z.number().optional(),
  force_refresh: z.boolean().default(false),
})

function genState(): string {
  return randomBytes(16).toString('base64url')
}

export const cozeOauthRoutes: FastifyPluginAsync = async (server) => {
  // GET /authorize - 获取授权 URL
  server.get('/authorize', async (request, reply) => {
    const parsed = authorizeQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const q = parsed.data
    try {
      if (q.type === 'jwt') {
        return reply.send(
          success({
            type: 'jwt',
            message: 'JWT 模式无需授权 URL, 请直接 POST /api/coze/oauth/jwt 获取 access_token',
          }),
        )
      }
      if (q.type === 'device') {
        const app = new DeviceOAuthApp({ baseUrl: q.base_url })
        const data = await app.getDeviceCode(q.workspace_id)
        return reply.send(success(data))
      }
      if (q.type === 'web') {
        if (!q.redirect_uri) {
          return reply.status(400).send(error(400, 'web 模式需要 redirect_uri'))
        }
        const app = new WebOAuthApp({ baseUrl: q.base_url })
        const st = q.state ?? genState()
        const url = app.getOAuthUrl(q.redirect_uri, st, q.scope)
        return reply.send(success({ auth_url: url, state: st }))
      }
      // pkce
      if (!q.redirect_uri) {
        return reply.status(400).send(error(400, 'pkce 模式需要 redirect_uri'))
      }
      const app = new PKCEOAuthApp({ baseUrl: q.base_url })
      const verifier = q.code_verifier ?? PKCEOAuthApp.generateCodeVerifier()
      const st = q.state ?? genState()
      const url = app.getOAuthUrl({
        redirectUri: q.redirect_uri,
        codeVerifier: verifier,
        codeChallengeMethod: q.code_challenge_method,
        state: st,
        scope: q.scope,
      })
      return reply.send(
        success({
          auth_url: url,
          state: st,
          code_verifier: verifier,
          code_challenge_method: q.code_challenge_method,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, `授权失败: ${e instanceof Error ? e.message : String(e)}`))
    }
  })

  // POST /token - 获取 access_token
  server.post('/token', async (request, reply) => {
    const parsed = tokenBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const b = parsed.data
    try {
      if (b.type === 'jwt') {
        const accessToken = await getCozeAccessToken({
          userUuid: b.user_uuid,
          forceRefresh: b.force_refresh,
        })
        if (!accessToken) return reply.status(500).send(error(500, '获取 JWT access_token 失败'))
        return reply.send(
          success({
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: b.ttl ?? 86399,
          }),
        )
      }
      if (b.type === 'device') {
        if (!b.device_code) {
          return reply.status(400).send(error(400, 'device 模式需要 device_code'))
        }
        const app = new DeviceOAuthApp({ clientId: b.client_id, baseUrl: b.base_url })
        const result = await app.getAccessToken(b.device_code)
        return reply.send(success(result))
      }
      if (b.type === 'web') {
        if (!b.code || !b.redirect_uri) {
          return reply.status(400).send(error(400, 'web 模式需要 code 与 redirect_uri'))
        }
        const app = new WebOAuthApp({
          clientId: b.client_id,
          clientSecret: b.client_secret,
          baseUrl: b.base_url,
        })
        const result = await app.getAccessToken(b.code, b.redirect_uri)
        return reply.send(success(result))
      }
      // pkce
      if (!b.code || !b.redirect_uri || !b.code_verifier) {
        return reply
          .status(400)
          .send(error(400, 'pkce 模式需要 code, redirect_uri, code_verifier'))
      }
      const app = new PKCEOAuthApp({ clientId: b.client_id, baseUrl: b.base_url })
      const result = await app.getAccessToken({
        redirectUri: b.redirect_uri,
        code: b.code,
        codeVerifier: b.code_verifier,
      })
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply
        .status(500)
        .send(error(500, `获取 token 失败: ${e instanceof Error ? e.message : String(e)}`))
    }
  })

  // POST /refresh - 刷新 token
  server.post('/refresh', async (request, reply) => {
    const parsed = refreshBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const b = parsed.data
    try {
      if (b.type === 'jwt') {
        const accessToken = await getCozeAccessToken({
          userUuid: b.user_uuid,
          forceRefresh: true,
        })
        if (!accessToken) return reply.status(500).send(error(500, '刷新 JWT access_token 失败'))
        return reply.send(
          success({
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: 86399,
          }),
        )
      }
      if (!b.refresh_token) {
        return reply.status(400).send(error(400, '需要 refresh_token'))
      }
      let result
      if (b.type === 'device') {
        const app = new DeviceOAuthApp({ clientId: b.client_id, baseUrl: b.base_url })
        result = await app.refreshAccessToken(b.refresh_token)
      } else if (b.type === 'web') {
        const app = new WebOAuthApp({
          clientId: b.client_id,
          clientSecret: b.client_secret,
          baseUrl: b.base_url,
        })
        result = await app.refreshAccessToken(b.refresh_token)
      } else {
        // pkce
        const app = new PKCEOAuthApp({ clientId: b.client_id, baseUrl: b.base_url })
        result = await app.refreshAccessToken(b.refresh_token)
      }
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply
        .status(500)
        .send(error(500, `刷新 token 失败: ${e instanceof Error ? e.message : String(e)}`))
    }
  })

  // POST /jwt - 直接获取 JWT access_token (最常用)
  server.post('/jwt', async (request, reply) => {
    const parsed = jwtBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const b = parsed.data
    try {
      const app = new JWTOAuthApp()
      const result = await app.getAccessToken({
        userUuid: b.user_uuid,
        scope: b.scope,
        ttl: b.ttl,
        forceRefresh: b.force_refresh,
      })
      return reply.send(success(result))
    } catch (e) {
      if (e instanceof Error && e.message.includes('未配置')) {
        return reply.status(400).send(error(400, e.message))
      }
      request.log.error(e)
      return reply
        .status(500)
        .send(error(500, `获取 JWT access_token 失败: ${e instanceof Error ? e.message : String(e)}`))
    }
  })

  // GET /config - 查看当前 OAuth 配置 (脱敏)
  server.get('/config', async (_request, reply) => {
    const cfg = loadCozeOAuthConfig()
    if (!cfg) return reply.status(500).send(error(500, 'OAuth 配置不可用'))
    return reply.send(
      success({
        client_type: cfg.clientType,
        client_id: cfg.clientId,
        coze_www_base: cfg.cozeWwwBase,
        coze_api_base: cfg.cozeApiBase,
        public_key_id: cfg.publicKeyId,
        private_key_configured: Boolean(cfg.privateKey),
      }),
    )
  })
}
