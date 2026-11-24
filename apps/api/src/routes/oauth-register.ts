// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O7:RFC 7591 动态客户端注册(DCR)+ RFC 7592 客户端注册管理。
 *
 * 注册方式:**不带 prefix**(与 oauth-authorization-server.ts 同一根级 AS 表面),
 * discovery 里的 registration_endpoint 指向 `POST /oauth/register`。
 *   server.register(oauthRegisterRoutes)   // ← 不加 { prefix: '/api' }
 *
 * 为什么第三方 Agent 需要它:没有 DCR,Claude/Cursor/Zed 这类连接器必须先人工
 * 到后台建应用拿 client_id,自助接入链就断了。
 *
 * 存储说明(零 schema 变更):
 *  - oauth_apps 现有列足够:client_id / client_secret / client_secret_hash / name /
 *    description / redirect_uris(jsonb) / scopes(jsonb) / icon / owner_uuid / is_active。
 *  - 公开客户端(token_endpoint_auth_method=none)把 client_secret 写成 PUBLIC_CLIENT_SECRET
 *    哨兵值(永远匹配不上任何 secret)→ 无需 client_type 列。
 *  - 机密客户端只存 v1hmac 摘要(明文列同值占位,不可匹配)→ 无需新列。
 *  - grant_types / token_endpoint_auth_method 不落库(无列),由上述两列推导,
 *    因此可选增强 SQL 见交付说明(要精确回显注册期原值才需要加列)。
 *    2026-09-21 O17b-④ 收口:注册**响应**按客户端声明的 auth method 原样回显(RFC 7591 §3.2.1),
 *    因为 AS 对机密客户端同时接受 basic 与 post(见 extractClientCredentials 读 header 也读 body);
 *    GET/DELETE 读回时没有列可依据,只能回推导默认值 basic —— 那是"一定可用"的取值,
 *    但**不等于**注册期原值。要逐字段忠实回显必须加 `token_endpoint_auth_method` 列。
 *  - owner_uuid 为 NULL:匿名 DCR 注册的客户端不能走 client_credentials(mint 侧要求
 *    sub = owner_uuid,见 plugins/principal.ts「机器凭据不得脱离归属用户持有数据」)。
 *    2026-09-21 O17b-④:该结论从"注册成功、换令牌恒 400"改为**注册时即显式拒绝**,
 *    不再静默受理一个永远用不上的 grant。需 M2M 请由登录用户经开发者后台建应用。
 */
import { and, eq } from 'drizzle-orm'
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  PUBLIC_CLIENT_SECRET,
  extractClientCredentials,
  generateClientId,
  generateClientSecret,
  hashClientSecret,
  isPublicClientApp,
  oauthErrorStatus,
  normalizeScopes,
  resolveGrantedScopes,
  validateRegistrationRedirectUris,
  type OAuthErrorCode,
} from '@ihui/auth'
// 错误体统一走 utils/oauth-as 的本地实现(带数字 `code`),不再用 @ihui/auth 的两参版:
// 根级 AS 表面(/oauth/token、/oauth/introspect、/oauth/revoke)回 `{error,code,error_description}`,
// 注册面若只回 `{error,error_description}` 就成了"一半一半",第三方客户端库按 code 判
// 成功/失败的分支会失效。文档口径见 utils/oauth-as.ts:135 与 oauth-tokens.ts 文件头。
import { buildOAuthErrorBody } from '../utils/oauth-as.js'
import { db } from '../db/index.js'
import { oauthApps } from '@ihui/database'
import { createAuditLog, findOAuthAppByClientId, listActiveScopeMeta } from '../db/oauth-queries.js'
import { matchesOAuthAppSecret, type OAuthAppRow } from './auth-extended.js'

/** RFC 7591 §2 客户端元数据(只收我们真存/真用的字段,其余按 RFC 要求拒绝而非静默丢弃)。 */
const clientMetadataSchema = z.object({
  redirect_uris: z.array(z.string()).optional(),
  token_endpoint_auth_method: z
    .enum(['client_secret_basic', 'client_secret_post', 'none'])
    .optional()
    .default('client_secret_basic'),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
  client_name: z.string().max(100).optional(),
  client_uri: z.string().url().optional(),
  logo_uri: z.string().url().optional(),
  scope: z.string().optional(),
  contacts: z.array(z.string()).optional(),
})

/** 本 AS 实际支持的 grant / response_type(与 discovery 同源,不接受未实现的声明)。 */
const SUPPORTED_GRANTS = ['authorization_code', 'refresh_token', 'client_credentials']
const SUPPORTED_RESPONSE_TYPES = ['code']

/** 未显式传 scope 时,DCR 客户端默认拿到的 scope 集(最小可用集)。 */
const DEFAULT_DCR_SCOPES = ['read:profile']

/** 立即失败并写好 RFC 形状响应(Fastify 里 return reply.send(...) 后必须不再往下走)。 */
function deny(
  reply: FastifyReply,
  error: OAuthErrorCode,
  description: string,
  status = oauthErrorStatus(error),
): FastifyReply {
  return reply
    .status(status)
    .header('cache-control', 'no-store')
    .send(buildOAuthErrorBody(error, status, description))
}

/**
 * 读/删端点的客户端认证(RFC 7592 §2.1 允许 registration_access_token,
 * 我们没有引入第二套注册令牌,改用客户端自身凭证做 Basic 认证 —— 更少密钥种类)。
 */
async function authorizeClientManagement(
  request: FastifyRequest,
  clientId: string,
): Promise<OAuthAppRow | null> {
  const presented = extractClientCredentials({
    authorizationHeader: request.headers.authorization ?? null,
    body: request.body,
  })
  if (presented.clientId !== clientId || !presented.clientId) return null
  const app = await findOAuthAppByClientId(clientId)
  if (!app) return null
  if (isPublicClientApp(app)) return app // 公开客户端无 secret,只能按 client_id 取公开元数据
  if (!presented.clientSecret) return null
  return (await matchesOAuthAppSecret(app, presented.clientSecret)) ? app : null
}

/** oauth_apps 行 → RFC 7591 §3.2 客户端元数据响应(绝不含 secret)。 */
function toClientResponse(
  app: OAuthAppRow,
  includeSecretOnce?: string,
  registeredAuthMethod?: string,
) {
  const publicClient = isPublicClientApp(app)
  // grant 回显同理不能用"机密客户端"一概而论:client_credentials 只有在应用绑定了
  // 归属用户时才真能签发(mint 侧硬要求 sub = owner_uuid)。owner_uuid 为空的行**不
  // 回显**这个 grant —— 否则注册面又变成"承诺了一个换不到令牌的授权类型"。
  const grants =
    !publicClient && app.ownerUuid
      ? ['authorization_code', 'refresh_token', 'client_credentials']
      : ['authorization_code', 'refresh_token']
  // 机密客户端的 token_endpoint_auth_method 没有列可存(见文件头「存储说明」):
  // - 注册响应回显客户端声明的值 —— 前提是该值 AS 真能用(`extractClientCredentials`
  //   既读 Authorization 头也读表单 body,basic 与 post 同等有效),回显不是空头承诺;
  // - GET/DELETE 没有注册期上下文,回推导默认值 basic(一定可用,但不是原值)。
  const authMethod = publicClient
    ? 'none'
    : registeredAuthMethod === 'client_secret_post'
      ? 'client_secret_post'
      : 'client_secret_basic'
  const body: Record<string, unknown> = {
    client_id: app.clientId,
    client_id_issued_at: Math.floor(app.createdAt.getTime() / 1000),
    redirect_uris: Array.isArray(app.redirectUris) ? app.redirectUris : [],
    token_endpoint_auth_method: authMethod,
    grant_types: grants,
    response_types: ['code'],
    client_name: app.name,
    scope: normalizeScopes((app.scopes as string[]) ?? []).join(' '),
  }
  if (app.description) body.client_description = app.description
  if (app.icon) body.logo_uri = app.icon
  if (includeSecretOnce) {
    body.client_secret = includeSecretOnce
    body.client_secret_expires_at = 0 // 0 = 永不过期(RFC 7591 §3.2.1)
  }
  return body
}

/** 幂等冲突防护:同 redirect_uris + 同名的重复注册请求返回已存在的客户端。 */
async function findDuplicateRegistration(input: {
  redirectUris: string[]
  name: string
}): Promise<OAuthAppRow | undefined> {
  const rows = await db
    .select()
    .from(oauthApps)
    .where(and(eq(oauthApps.name, input.name), eq(oauthApps.isActive, 1)))
    .limit(50)
  const target = [...input.redirectUris].sort().join('|')
  return rows.find((row) => {
    const uris = Array.isArray(row.redirectUris)
      ? (row.redirectUris as string[]).sort().join('|')
      : ''
    return uris === target
  })
}

export const oauthRegisterRoutes: FastifyPluginAsync = async (server) => {
  /**
   * POST /oauth/register — RFC 7591 动态客户端注册(公开端点)。
   * 滥用防护:沿用项目既有 rateLimit 形态(@fastify/rate-limit 按 IP 计数),不自造限流算法。
   */
  server.post(
    '/oauth/register',
    { config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const parsed = clientMetadataSchema.safeParse(request.body)
      if (!parsed.success) {
        return deny(
          reply,
          'invalid_client_metadata',
          parsed.error.issues[0]?.message ?? '客户端元数据非法',
        )
      }
      const meta = parsed.data
      const publicClient = meta.token_endpoint_auth_method === 'none'
      const redirectUris = meta.redirect_uris ?? []

      // authorization_code grant 必须有 redirect_uri(RFC 7591 §2 要求 + 防 open redirect)。
      // 2026-09-21 实跑纠正:判据原先只看"有没有 redirect_uris",把**纯 M2M 客户端**
      // (只声明 client_credentials,压根不走授权码、没有回调)一并拒掉 ⇒ 第三方机器凭据
      // 自助接入这条路被自己堵死。redirect_uri 只在确实会用到跳转时才必需。
      const grants = meta.grant_types ?? ['authorization_code']
      const needsRedirectUri = grants.includes('authorization_code')
      if (needsRedirectUri && redirectUris.length === 0 && !publicClient) {
        return deny(
          reply,
          'invalid_redirect_uri',
          '使用 authorization_code 的机密客户端注册必须提供 redirect_uris',
        )
      }
      if (redirectUris.length > 0) {
        const uriError = validateRegistrationRedirectUris(redirectUris)
        if (uriError) return deny(reply, 'invalid_redirect_uri', uriError)
      }
      const badGrant = (meta.grant_types ?? []).find((g) => !SUPPORTED_GRANTS.includes(g))
      if (badGrant) {
        return deny(reply, 'invalid_client_metadata', `不支持的 grant_type: ${badGrant}`)
      }
      const badResponse = (meta.response_types ?? []).find(
        (r) => !SUPPORTED_RESPONSE_TYPES.includes(r),
      )
      if (badResponse) {
        return deny(reply, 'invalid_client_metadata', `不支持的 response_type: ${badResponse}`)
      }
      if (publicClient && (meta.grant_types ?? []).includes('client_credentials')) {
        return deny(reply, 'invalid_client_metadata', '公开客户端不得使用 client_credentials')
      }
      // O17b-④ 真因收口(2026-09-21):本端点 inserted 的 owner_uuid 恒为 null,而
      // `mintClientCredentialsToken` 要求 sub = owner_uuid(平台数据归属不变量:机器凭据
      // 不得脱离归属用户持有数据,见 plugins/principal.ts)。此前 DCR **静默受理**
      // `grant_types:["client_credentials"]`,注册 201 成功、换令牌恒 400 invalid_client
      // —— 报错点离病因三跳远。现按要求"不许静默接受"在注册时就拒,并给出可用路径。
      if (grants.includes('client_credentials')) {
        return deny(
          reply,
          'invalid_client_metadata',
          '动态注册(匿名、无 owner_uuid)不得声明 client_credentials:M2M 令牌必须以归属用户为 sub。' +
            '需要机器凭据请由登录用户经 POST /api/auth/oauth/apps/create 创建应用;第三方连接器请只声明 authorization_code',
        )
      }

      // scope 必须落在 oauth_scope_meta 活跃集内(不发放不存在的 scope)
      const requested = normalizeScopes(meta.scope)
      let grantedScopes = requested
      if (requested.length > 0) {
        const active = (await listActiveScopeMeta())
          .map((m) => m.scope)
          .filter((s): s is string => typeof s === 'string')
        const { rejected } = resolveGrantedScopes(requested, active)
        if (rejected.length > 0) {
          return deny(reply, 'invalid_scope', `未知或未启用的 scope: ${rejected.join(' ')}`)
        }
      } else {
        grantedScopes = DEFAULT_DCR_SCOPES
      }

      const clientId = generateClientId()
      const clientName = (meta.client_name?.trim() || `DCR ${clientId.slice(0, 12)}`).slice(0, 100)

      // 幂等防护:同名 + 同回调集合的重复注册返回既有客户端(连接器重启反复注册是常态,
      // 不做幂等就会在 oauth_apps 里堆出几十个同义客户端)
      const duplicate = await findDuplicateRegistration({ redirectUris, name: clientName })
      if (duplicate) {
        await createAuditLog({
          event: 'dcr_register_reuse',
          clientId: duplicate.clientId,
          ip: request.ip,
          status: 'success',
        })
        return reply
          .status(200)
          .header('cache-control', 'no-store')
          .send(toClientResponse(duplicate, undefined, meta.token_endpoint_auth_method))
      }

      const clientSecret = publicClient ? PUBLIC_CLIENT_SECRET : generateClientSecret()
      // 机密客户端:明文 secret 只在响应里出现一次,库里两列都存摘要(明文列填摘要占位,
      // 因其 NOT NULL 且 verifyClientSecret 对 v1hmac 形态走摘要分支,永不匹配明文)
      const storedDigest = publicClient ? PUBLIC_CLIENT_SECRET : hashClientSecret(clientSecret)

      const inserted = await db
        .insert(oauthApps)
        .values({
          clientId,
          clientSecret: storedDigest,
          clientSecretHash: publicClient ? null : storedDigest,
          name: clientName,
          description: meta.client_uri ?? null,
          redirectUris,
          scopes: grantedScopes,
          icon: meta.logo_uri ?? null,
          ownerUuid: null,
          isActive: 1,
        })
        .onConflictDoNothing({ target: [oauthApps.clientId] })
        .returning()
      const app = inserted[0]
      if (!app) {
        // 极少见:client_id 碰撞(32 hex 随机)→ 明确 500,不静默返回半成品
        return deny(reply, 'server_error', '客户端创建失败,请重试', 500)
      }

      await createAuditLog({
        event: 'dcr_register',
        clientId,
        ip: request.ip,
        status: 'success',
        detail: JSON.stringify({ publicClient, redirectUris, scopes: grantedScopes }),
      })

      // 机密客户端:本次是 client_secret **唯一一次**明文下发。响应脱敏会把任何看起来
      // 像密钥的字段替换成 '***'(与 developer API Key 下发同一机制,那边显式跳过),
      // 于是 RFC 7591 返回体里的 client_secret 变成 "***" ⇒ 客户端拿不到可用凭据,
      // 后续 /oauth/token 恒 invalid_client ⇒ OAuth M2M 通道事实上走不通。
      // 2026-09-21 O17 三通道实跑抓到(no-verify 无法发现,只有真发请求才暴露)。
      if (!publicClient) request.skipResponseSanitization = true

      return reply
        .status(201)
        .header('cache-control', 'no-store')
        .header('pragma', 'no-cache')
        .send({
          ...toClientResponse(
            app,
            publicClient ? undefined : clientSecret,
            meta.token_endpoint_auth_method,
          ),
          ...(meta.contacts?.length ? { contacts: meta.contacts } : {}),
        })
    },
  )

  /** GET /oauth/register/:client_id — RFC 7592 读取客户端元数据。 */
  server.get('/oauth/register/:clientId', async (request, reply) => {
    const { clientId } = z.object({ clientId: z.string().min(1) }).parse(request.params)
    const app = await authorizeClientManagement(request, clientId)
    if (!app) return deny(reply, 'invalid_client', '客户端认证失败或客户端不存在', 401)
    return reply.send(toClientResponse(app))
  })

  /**
   * DELETE /oauth/register/:client_id — RFC 7592 §2.2 删除客户端。
   * 实现为软删除(is_active=0):授权码/会话/审计与客户端行仍有外键语义,
   * 物理删除会让历史 token 归属不可追溯(与 /api/auth/oauth/apps/:clientId 的物理删除不同)。
   */
  server.delete('/oauth/register/:clientId', async (request, reply) => {
    const { clientId } = z.object({ clientId: z.string().min(1) }).parse(request.params)
    const app = await authorizeClientManagement(request, clientId)
    if (!app) return deny(reply, 'invalid_client', '客户端认证失败或客户端不存在', 401)
    await db
      .update(oauthApps)
      .set({ isActive: 0, updatedAt: new Date() })
      .where(eq(oauthApps.clientId, clientId))
    await createAuditLog({
      event: 'dcr_unregister',
      clientId,
      ip: request.ip,
      status: 'success',
    })
    return reply.status(204).send()
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
