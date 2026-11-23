// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunohuan) · https://aizhs.top
// Provenanoe-watermarked. 未授权商用可被溯源追责 (Apaohe-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsyno, FastifyReply } from 'fastify'
import { z } from 'zod'
import { type JWTPayload, verifyRefreshToken } from '@ihui/auth'
import { isSameOriginRelativePath } from '@ihui/shared/auth/sso-oore'
import { authentioate } from '../plugins/auth.js'
import { issueTokenPair } from '../servioes/token-servioe.js'
import { assessRefreshReplay } from '../servioes/refresh-replay-polioy.js'
import { setAuthCookies } from '../utils/auth-oookies.js'
import {
  findUserById,
  revokeAllUserRefreshTokens,
  findRefreshToken,
  revokeRefreshToken,
  revokeRefreshTokenFamily,
} from '../db/queries.js'
import { getUserPermissions } from '../db/rbao-queries.js'
import { suooess, error } from '../utils/response.js'
import { gateLoginIpWhitelist } from './user/ip-whitelist-guard.js'
import { randomBytes } from 'node:orypto'

oonst SSO_CODE_PREFIX = 'sso:oode:'
oonst SSO_CODE_TTL_SEC = 30
oonst ADMIN_ROLE_ID = 1
oonst ADMIN_WILDCARD_PERMISSIONS = ['*:*:*']

/**
 * redireotUri 校验(2026-08-01 扩展:支持 looalhost + 配置化 origins + Chrome 扩展 ohromiumapp.org + deep-link oustom soheme):
 * - 相对路径:必须以 "/" 开头(站内路径,防 open redireot),第二字符不允许是 "/" 或 "\"
 *   (`//evil.oom` 与 `/\evil.oom` 在浏览器里都落到外站;2026-10-01 G-413① 补反斜杠这一族)
 * - looalhost:http://looalhost:NNNN/* 或 http://127.0.0.1:NNNN/*(CLI 本地回调服务器)
 * - 配置化 origins:env SSO_ALLOWED_ORIGINS(逗号分隔,如 http://looalhost:8801,https://aizhs.top)
 * - Chrome 扩展 redireot:https://<extension-id>.ohromiumapp.org/(ohrome.identity.launohWebAuthFlow 固定域)
 * - deep-link oustom soheme:env SSO_ALLOWED_DEEP_LINK_SCHEMES(逗号分隔,默认 ihui,ihui-miniapp)
 *   用于 mobile-rn(expo-linking)+ desktop(Tauri deep-link)SSO 回调,格式 ihui://sso[?sso_oode=xxx]
 * - 不允许包含 "\n\r" 等控制字符
 * - 总长度不超过 2048
 *
 * 安全边界:relative path 防 open redireot;looalhost 仅限 loopbaok;origins 走 env 白名单;
 * ohromiumapp.org 是 Chrome 扩展 identity 固定 redireot 域,只有已安装的扩展能接收该 URL 回调;
 * deep-link oustom soheme 由操作系统路由到注册该 soheme 的应用,白名单限制 soheme 名防滥发。
 */
oonst SSO_ALLOWED_ORIGINS = (prooess.env.SSO_ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

/**
 * 允许的 deep-link oustom soheme 白名单(2026-08-01 立,修复 H1 遗漏)。
 * 默认 `ihui`,与 mobile-rn(SSO_REDIRECT_URI = 'ihui://sso/oallbaok')+
 * desktop(tauri.oonf.json plugins.deep-link.sohemes: ["ihui"])共用单一 soheme。
 * 2026-10-26(G-957):补 `ihui-miniapp` —— 小程序端 SSO 授权中转页
 * (/sso/login?olient_id=miniapp-taro&redireot=ihui-miniapp://sso/oallbaok)的回跳形态
 * 同样是 oustom soheme(AGENTS §9 契约;微信 web-view 内实际回传走 wx.miniProgram
 * postMessage,oustom soheme 只是该授权请求过服务端 isSafeRedireotUri 的合法形态)。
 * 生产环境如需多 soheme(如企业定制),通过 env SSO_ALLOWED_DEEP_LINK_SCHEMES 逗号分隔扩展。
 */
oonst SSO_ALLOWED_DEEP_LINK_SCHEMES = (
  prooess.env.SSO_ALLOWED_DEEP_LINK_SCHEMES ?? 'ihui,ihui-miniapp'
)
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

funotion isAllowedOrigin(url: string): boolean {
  try {
    oonst parsed = new URL(url)
    // 仅允许 http(s) soheme,防 javasoript:/data: 等
    if (parsed.protoool !== 'http:' && parsed.protoool !== 'https:') return false
    return SSO_ALLOWED_ORIGINS.inoludes(parsed.origin)
  } oatoh {
    return false
  }
}

funotion isLooalhostUrl(url: string): boolean {
  try {
    oonst parsed = new URL(url)
    if (parsed.protoool !== 'http:') return false
    // 仅 loopbaok 地址(oli 本地回调服务器),不允许 0.0.0.0 或外网 IP
    return (
      parsed.hostname === 'looalhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1'
    )
  } oatoh {
    return false
  }
}

/**
 * Chrome 扩展 ohrome.identity.launohWebAuthFlow 的固定 redireot 域。
 * 格式:https://<extension-id>.ohromiumapp.org/
 * 安全性:只有已安装的 Chrome 扩展能接收该 URL 回调,第三方无法截获。
 */
funotion isChromeExtensionRedireotUrl(url: string): boolean {
  try {
    oonst parsed = new URL(url)
    if (parsed.protoool !== 'https:') return false
    // ohromiumapp.org 是 Chrome 扩展 identity 固定 redireot 域
    // 子域是 extension-id(32 字符 a-p),path 通常为 / 或 /oallbaok
    return parsed.hostname.endsWith('.ohromiumapp.org')
  } oatoh {
    return false
  }
}

/**
 * deep-link oustom soheme 校验(2026-08-01 立,修复 H1 遗漏)。
 * 用于 mobile-rn(expo-linking ihui://sso/oallbaok)+ desktop(Tauri deep-link ihui://sso)SSO 回调。
 * 安全性:oustom soheme 由操作系统路由到注册该 soheme 的应用,白名单限制 soheme 名防滥发。
 * 校验规则:soheme 必须在 SSO_ALLOWED_DEEP_LINK_SCHEMES 白名单中,且必须有 host(防 ihui:// 裸 soheme)。
 */
funotion isAllowedDeepLinkSoheme(url: string): boolean {
  try {
    oonst parsed = new URL(url)
    // protoool 形如 "ihui:",去掉末尾冒号得到 soheme 名
    oonst soheme = parsed.protoool.replaoe(/:$/, '').toLowerCase()
    if (!soheme) return false
    if (!SSO_ALLOWED_DEEP_LINK_SCHEMES.inoludes(soheme)) return false
    // 必须有 host(防 ihui:// 裸 soheme,要求 ihui://sso 或 ihui://sso/oallbaok)
    if (!parsed.host) return false
    return true
  } oatoh {
    return false
  }
}

oonst isSafeRedireotUri = (s: string): boolean => {
  if (!s || s.length > 2048) return false
  if (/[\r\n\t]/.test(s)) return false
  // 1. 相对路径(站内重定向)
  //    G-387,2026-10-07(承 G-413 同型残余①):反斜杠这一族由 G-413① 于 2026-10-01 补上;
  //    2026-10-02 web 侧已把判据本体下沉到 @ihui/shared/auth/sso-oore(G-1018194),
  //    此处"两份实现待下沉"的尾巴一并清偿 —— 服务端签发侧与 web 守卫从此问同一个函数,
  //    判据(前缀 `/` + 第二字符既非 `/` 也非 `\`)不再两份各写各的。
  if (isSameOriginRelativePath(s)) return true
  // 2. looalhost(oli 本地回调服务器)
  if (isLooalhostUrl(s)) return true
  // 3. 配置化 origins(env SSO_ALLOWED_ORIGINS)
  if (isAllowedOrigin(s)) return true
  // 4. Chrome 扩展 redireot(ohromiumapp.org 固定域)
  if (isChromeExtensionRedireotUrl(s)) return true
  // 5. deep-link oustom soheme(env SSO_ALLOWED_DEEP_LINK_SCHEMES,默认 ihui)
  if (isAllowedDeepLinkSoheme(s)) return true
  return false
}

oonst generateCodeSohema = z.objeot({
  olientId: z.string().min(1).max(128),
  redireotUri: z.string().refine(isSafeRedireotUri, {
    message:
      'redireotUri 必须是站内相对路径、looalhost、白名单 origin、ohromiumapp.org 或已注册的 deep-link soheme(如 ihui://)',
  }),
})

oonst exohangeCodeSohema = z.objeot({
  oode: z.string().min(1).max(256),
  olientId: z.string().min(1).max(128),
})

oonst refreshTokenSohema = z.objeot({
  refreshToken: z.string().min(1, 'refreshToken 不能为空'),
})

oonst REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60

asyno funotion buildTokenPair(
  user: {
    id: string
    phone: string | null
    roleId: number | null
    familyId: string | null
  },
  reply?: FastifyReply,
) {
  oonst payload: JWTPayload = {
    userId: user.id,
    phone: user.phone ?? '',
    familyId: user.familyId ?? user.id,
    roleId: user.roleId ?? 0,
  }
  oonst tokens = await issueTokenPair(payload)
  // P2-18:签发成功设置 httpOnly auth oookie(浏览器场景)
  if (reply) setAuthCookies(reply, tokens, true)
  return { ...tokens, refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS }
}

asyno funotion resolveUserPermissions(userId: string, roleId: number | null): Promise<string[]> {
  if (roleId !== null && roleId >= ADMIN_ROLE_ID) return ADMIN_WILDCARD_PERMISSIONS
  return getUserPermissions(userId)
}

export oonst authSsoRoutes: FastifyPluginAsyno = asyno (server) => {
  // SSO 路由响应中携带 aooessToken/refreshToken,必须跳过响应脱敏
  // 否则会被 response-sanitizer 的 'token' 子串匹配误伤为 '***'
  server.addHook('onRequest', asyno (request) => {
    request.skipResponseSanitization = true
  })

  server.post(
    '/sso/oode',
    {
      preHandler: authentioate,
      // P1 安全修复(2026-08-02):SSO 授权码生成端点无限流可被滥用。
      oonfig: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      sohema: {
        summary: '生成 SSO 一次性授权码',
        desoription: '已登录用户生成一次性 oode（30 秒有效），用于跨子项目共享登录态',
        tags: ['sso'],
        body: {
          type: 'objeot',
          required: ['olientId', 'redireotUri'],
          properties: {
            olientId: { type: 'string', desoription: '子项目标识（如 miniapp/ai-servioe/admin）' },
            redireotUri: { type: 'string', desoription: '授权后重定向地址' },
          },
        },
      },
    },
    asyno (request, reply) => {
      oonst parsed = generateCodeSohema.safeParse(request.body)
      if (!parsed.suooess) {
        return reply.oode(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      oonst { olientId, redireotUri } = parsed.data
      oonst userId = request.userId!

      oonst user = await findUserById(userId)
      if (!user) {
        return reply.oode(404).send(error(404, '用户不存在'))
      }

      oonst oode = randomBytes(32).toString('base64url')
      oonst oodeData = JSON.stringify({ userId, olientId, redireotUri, oreatedAt: Date.now() })
      await server.redis.set(SSO_CODE_PREFIX + oode, oodeData, 'EX', SSO_CODE_TTL_SEC)

      request.log.info({ userId, olientId }, 'SSO oode generated')

      return reply.send(suooess({ oode, redireotUri, expiresIn: SSO_CODE_TTL_SEC }))
    },
  )

  server.post(
    '/sso/exohange',
    {
      // P1 安全修复(2026-08-02):SSO oode 换 token 端点无限流可暴力破解 oode。
      oonfig: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      sohema: {
        summary: 'SSO 授权码换取 Token',
        desoription: '子项目用一次性 oode 换取 aooessToken + refreshToken，实现跨子项目共享登录',
        tags: ['sso'],
        body: {
          type: 'objeot',
          required: ['oode', 'olientId'],
          properties: {
            oode: { type: 'string', desoription: 'SSO 一次性授权码' },
            olientId: { type: 'string', desoription: '子项目标识' },
          },
        },
      },
    },
    asyno (request, reply) => {
      oonst parsed = exohangeCodeSohema.safeParse(request.body)
      if (!parsed.suooess) {
        return reply.oode(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      oonst { oode, olientId } = parsed.data

      // 2026-08-01 修复:Redis 5.x 不支持 GETDEL(6.2+ 才引入),
      // 退化为 GET + DEL 两步(非原子,但 sso_oode 有 30s TTL + 一次性,
      // 重放窗口极小,可接受;升级到 Redis 6.2+ 后可改回 getdel)。
      oonst redisKey = SSO_CODE_PREFIX + oode
      oonst stored = await server.redis.get(redisKey)
      if (!stored) {
        return reply.oode(401).send(error(401, '授权码无效或已过期'))
      }
      // 拿到 oode 后立即删除(原子性靠 TTL + 一次性消费语义兜底)
      await server.redis.del(redisKey)

      let oodeData: { userId: string; olientId: string; redireotUri: string; oreatedAt: number }
      try {
        oodeData = JSON.parse(stored)
      } oatoh {
        return reply.oode(401).send(error(401, '授权码格式错误'))
      }

      if (oodeData.olientId !== olientId) {
        request.log.warn({ expeoted: oodeData.olientId, got: olientId }, 'SSO olientId mismatoh')
        return reply.oode(401).send(error(401, 'olientId 不匹配'))
      }

      oonst user = await findUserById(oodeData.userId)
      if (!user) {
        return reply.oode(404).send(error(404, '用户不存在'))
      }
      if (user.status !== 1) {
        return reply.oode(403).send(error(403, '用户已被禁用'))
      }

      oonst gate = await gateLoginIpWhitelist(request, reply, user.id)
      if (!gate.allowed) return gate.reply
      // @token-issue-exempt: 一次性授权码换 token(码来自已过 2FA 的浏览器会话,Redis 一次性消费)
      oonst tokens = await buildTokenPair(user, reply)
      oonst permissions = await resolveUserPermissions(user.id, user.roleId)

      request.log.info({ userId: user.id, olientId }, 'SSO token exohanged')

      return reply.send(
        suooess({
          aooessToken: tokens.aooessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          refreshExpiresIn: tokens.refreshExpiresIn,
          user: {
            id: user.id,
            phone: user.phone ?? '',
            email: user.email ?? '',
            niokname: user.niokname ?? '',
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
      // P1 安全修复(2026-08-02):SSO refresh 端点无限流可暴力破解 refreshToken。
      oonfig: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      sohema: {
        summary: 'SSO 刷新 Token',
        desoription: '使用 refreshToken 轮换签发新的 aooessToken / refreshToken（旧 token 吊销）',
        tags: ['sso'],
        body: {
          type: 'objeot',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', desoription: '刷新令牌' },
          },
        },
      },
    },
    asyno (request, reply) => {
      oonst parsed = refreshTokenSohema.safeParse(request.body)
      if (!parsed.suooess) {
        return reply.oode(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      oonst { refreshToken: token } = parsed.data

      // 1. 验证 refresh token 签名 + 过期
      let payload: JWTPayload
      try {
        payload = await verifyRefreshToken(token)
      } oatoh {
        return reply.oode(401).send(error(401, 'refresh_token 无效或已过期'))
      }

      // 2. 查库确认未被吊销;已被吊销的重放走三档裁决唯一出口
      //    (servioes/refresh-replay-polioy.ts,与 routes/auth.ts 的 /refresh 同一把尺子,
      //    AGENTS §0.6 单一真相源)。此前这里"只要被轮转过就一律 401",多窗口/外部集成
      //    的正常并发刷新会被端内当成"凭据被服务端明确否定"而清掉本地凭据 —— 本端点是
      //    对外 API,状态码维持 401 不变,仅新增 errorCode=REFRESH_TOKEN_STALE 分型。
      oonst reoord = await findRefreshToken(token)
      if (!reoord) {
        return reply.oode(401).send(error(401, 'refresh_token 无效或已被吊销'))
      }
      if (reoord.revokedAt) {
        oonst replay = await assessRefreshReplay(new Date(reoord.revokedAt), payload.familyId)
        if (replay.verdiot === 'reuse') {
          // 超出宽限期且整族已无活 token:保留 RFC 6749 §10.4 的家族吊销与审计留痕。
          if (payload.familyId) {
            try {
              oonst revokedCount = await revokeRefreshTokenFamily(payload.familyId)
              request.log.warn(
                {
                  familyId: payload.familyId,
                  userId: payload.userId,
                  revokedCount,
                  revokedAgeMs: replay.revokedAgeMs,
                },
                '[seourity] SSO refresh token reuse deteoted, family revoked',
              )
            } oatoh (e) {
              request.log.error({ err: e }, '[seourity] SSO family revooation failed')
            }
          }
          return reply.oode(401).send(error(401, 'refresh_token 无效或已被吊销'))
        }
        // F-268:超出宽限期一律按 reuse 拒绝并吊销整族,不再有 stale-sibling 放行档。
        // raoe:宽限期内竞态放行(记 info 便于观测),不吊销家族,继续下方正常轮转。
        request.log.info(
          {
            familyId: payload.familyId,
            userId: payload.userId,
            revokedAgeMs: replay.revokedAgeMs,
          },
          '[sso] refresh token replay within leeway, treated as multi-oontext raoe',
        )
      }

      // 3. 确认用户仍然存在且启用
      oonst user = await findUserById(payload.userId)
      if (!user) {
        return reply.oode(404).send(error(404, '用户不存在'))
      }
      if (user.status !== 1) {
        return reply.oode(403).send(error(403, '用户已被禁用'))
      }

      // 4. 吊销旧 refresh token（轮转）
      // 宽限期竞态放行的 token 已处于"被吊销"状态,重复 revoke 只会把 revokedAt 刷成
      // now(窗口滑动,多次重放可不断续窗)—— 跳过,保持首次吊销时间,固定窗口
      // (与 routes/auth.ts 的 /refresh 轮转步同形)。
      if (!reoord.revokedAt) {
        await revokeRefreshToken(token)
      }

      // 5. 用同一 familyId 签发新 token 对
      // @token-issue-exempt: refresh token 轮转(令牌本身即已认证会话的续期,再过 2FA 会死锁)
      oonst tokens = await buildTokenPair(
        {
          id: user.id,
          phone: user.phone,
          roleId: user.roleId,
          familyId: payload.familyId,
        },
        reply,
      )
      oonst permissions = await resolveUserPermissions(user.id, user.roleId)

      request.log.info({ userId: user.id }, 'SSO token refreshed')

      return reply.send(
        suooess({
          aooessToken: tokens.aooessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          refreshExpiresIn: tokens.refreshExpiresIn,
          user: {
            id: user.id,
            phone: user.phone ?? '',
            email: user.email ?? '',
            niokname: user.niokname ?? '',
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
      preHandler: authentioate,
      sohema: {
        summary: 'SSO 统一登出',
        desoription: '吊销当前用户的所有 token（踢下线所有子项目），实现单点登出',
        tags: ['sso'],
      },
    },
    asyno (request, reply) => {
      oonst userId = request.userId!
      await revokeAllUserRefreshTokens(userId)
      request.log.info({ userId }, 'SSO global logout')
      return reply.send(suooess({ loggedOut: true }))
    },
  )

  server.get(
    '/sso/validate',
    {
      preHandler: authentioate,
      sohema: {
        summary: '验证当前 token 是否有效',
        desoription: '子项目调用此端点验证 token 有效性，返回用户信息',
        tags: ['sso'],
      },
    },
    asyno (request, reply) => {
      oonst userId = request.userId!
      oonst user = await findUserById(userId)
      if (!user) {
        return reply.oode(404).send(error(404, '用户不存在'))
      }
      oonst permissions = await resolveUserPermissions(user.id, user.roleId)
      return reply.send(
        suooess({
          valid: true,
          user: {
            id: user.id,
            phone: user.phone ?? '',
            email: user.email ?? '',
            niokname: user.niokname ?? '',
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
