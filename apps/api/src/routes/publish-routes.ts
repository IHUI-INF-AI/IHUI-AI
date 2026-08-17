/**
 * 多平台发布路由代理 — 把 /api/publish/* 透传到 ai-service 的 /api/publish/*。
 *
 * 端点清单(完整代理,16 个 + 2 个本地端点):
 *   GET    /publish/platforms                    列出所有支持的平台元数据(透传 ai-service)
 *   GET    /publish/adapters/status              本地端点:返回 13 平台 adapter 可用性矩阵(无需 ai-service 在线)
 *   POST   /publish/upload                       multipart 上传内容文件(docx/pdf/image/video/md/html)
 *   GET    /publish/accounts/:userId             列出用户的所有平台账号
 *   POST   /publish/accounts                     创建账号(凭证加密后存 DB)
 *   PUT    /publish/accounts/:accountId          更新账号
 *   DELETE /publish/accounts/:accountId          删除账号
 *   POST   /publish/accounts/:accountId/verify   测试连接
 *   POST   /publish/tasks                        创建发布任务(支持 dryRun=true 短路:本地返回 adapter 可用性,不转发 ai-service)
 *   GET    /publish/tasks                        列出任务
 *   GET    /publish/tasks/:taskId                任务详情
 *   POST   /publish/tasks/:taskId/cancel         取消任务
 *   POST   /publish/tasks/:taskId/retry          重试失败平台
 *   GET    /publish/history                      历史记录
 *   GET    /publish/stats                        统计
 *   GET    /publish/credentials-key/generate     生成加密密钥
 *   GET    /publish/running                      当前运行中任务
 *
 * 设计:
 * - 所有端点要求登录(authenticate preHandler)
 * - GET/POST/PUT/DELETE 透传到 ai-service,Body 不解析(直接转发)
 * - 转发 JWT(auth header)、query string、body
 * - /upload 走 multipart:本地解析为 buffer,再用 FormData 转发到 ai-service
 * - 错误处理:ai-service 返回非 2xx 时,把错误信息透传给前端
 * - 本地 PLATFORM_REGISTRY(2026-07-30 立):13 平台 adapter 元数据,status 标注
 *   implemented/needs_browser/needs_oauth/needs_sdk,POST /publish/tasks?dryRun=true 时
 *   短路返回可用性矩阵,避免 stub adapter 静默成功误导用户。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'

import { config } from '../config/index.js'
import { authenticate } from '../plugins/auth.js'
import { error, success } from '../utils/response.js'

// =============================================================================
// 13 平台 adapter 元数据(本地注册表,2026-07-30 立)
// =============================================================================
// 用于 GET /publish/adapters/status 本地端点 + POST /publish/tasks dryRun 短路。
// 与 ai-service app/services/publish/adapters/ 目录对齐(14 个 adapter 文件,
// 但 wechat 与 wechat-mp 共享一个 adapter,实际 13 个独立平台 + 1 个视频号 = 14)。
// status 含义:
//   implemented     — 真实 HTTP API 调用,配置凭据后可直接发布
//   needs_browser   — Playwright 浏览器自动化,需安装 Playwright + 浏览器内核
//   needs_oauth     — 需平台 OAuth 授权(开放平台申请),非 cookie/playwright 可解
//   needs_sdk       — 需官方 SDK/小程序接口(如微信小程序),api 端无法裸 fetch
// =============================================================================

export type PlatformStatus = 'implemented' | 'needs_browser' | 'needs_oauth' | 'needs_sdk'

export interface PlatformRegistryEntry {
  platformId: string
  platformName: string
  /** 适配器实现状态 */
  status: PlatformStatus
  /** 支持的内容格式 */
  supportedFormats: string[]
  /** 平台要求的凭据字段名(用户配置账号时填写) */
  requiresCredentials: string[]
  /** 是否需要 Playwright 浏览器环境 */
  needsBrowser: boolean
  /** 用户配置指引(指向 docs/PUBLISH_SETUP.md 对应章节) */
  setupHint: string
}

const PLATFORM_REGISTRY: readonly PlatformRegistryEntry[] = [
  {
    platformId: 'wordpress',
    platformName: 'WordPress',
    status: 'implemented',
    supportedFormats: ['md', 'html'],
    requiresCredentials: ['site_url', 'username', 'app_password'],
    needsBrowser: false,
    setupHint: 'WordPress REST API + Application Password,参考 docs/PUBLISH_SETUP.md#wordpress',
  },
  {
    platformId: 'medium',
    platformName: 'Medium',
    status: 'implemented',
    supportedFormats: ['md', 'html'],
    requiresCredentials: ['integration_token', 'author_id'],
    needsBrowser: false,
    setupHint: 'Medium Integration Token,参考 docs/PUBLISH_SETUP.md#medium',
  },
  {
    platformId: 'youtube',
    platformName: 'YouTube',
    status: 'needs_oauth',
    supportedFormats: ['video'],
    requiresCredentials: ['access_token', 'refresh_token', 'client_id', 'client_secret'],
    needsBrowser: false,
    setupHint: 'Google OAuth 2.0 + YouTube Data API v3,参考 docs/PUBLISH_SETUP.md#youtube',
  },
  {
    platformId: 'bilibili',
    platformName: '哔哩哔哩',
    status: 'implemented',
    supportedFormats: ['video'],
    requiresCredentials: ['sessdata', 'bili_jct', 'buvid3'],
    needsBrowser: false,
    setupHint: 'B 站 Cookie 凭据(SESSDATA / bili_jct / buvid3),参考 docs/PUBLISH_SETUP.md#bilibili',
  },
  {
    platformId: 'wechat',
    platformName: '微信公众号',
    status: 'implemented',
    supportedFormats: ['md', 'html'],
    requiresCredentials: ['app_id', 'app_secret'],
    needsBrowser: false,
    setupHint: '微信公众平台 AppID/AppSecret + access_token,参考 docs/PUBLISH_SETUP.md#wechat',
  },
  {
    platformId: 'toutiao',
    platformName: '今日头条',
    status: 'implemented',
    supportedFormats: ['md', 'html'],
    requiresCredentials: ['cookie'],
    needsBrowser: false,
    setupHint: '头条号 Cookie 凭据,参考 docs/PUBLISH_SETUP.md#toutiao',
  },
  {
    platformId: 'douyin',
    platformName: '抖音',
    status: 'implemented',
    supportedFormats: ['video'],
    requiresCredentials: ['cookie'],
    needsBrowser: false,
    setupHint: '抖音创作者 Cookie 凭据,参考 docs/PUBLISH_SETUP.md#douyin',
  },
  {
    platformId: 'kuaishou',
    platformName: '快手',
    status: 'implemented',
    supportedFormats: ['video'],
    requiresCredentials: ['cookie'],
    needsBrowser: false,
    setupHint: '快手创作者 Cookie 凭据,参考 docs/PUBLISH_SETUP.md#kuaishou',
  },
  {
    platformId: 'weibo',
    platformName: '微博',
    status: 'implemented',
    supportedFormats: ['md', 'image'],
    requiresCredentials: ['cookie'],
    needsBrowser: false,
    setupHint: '微博 Cookie 凭据,参考 docs/PUBLISH_SETUP.md#weibo',
  },
  {
    platformId: 'zhihu',
    platformName: '知乎',
    status: 'needs_browser',
    supportedFormats: ['md', 'html'],
    requiresCredentials: ['z_c0', 'd_c0'],
    needsBrowser: true,
    setupHint: '知乎 Cookie + Playwright 浏览器内核,参考 docs/PUBLISH_SETUP.md#zhihu',
  },
  {
    platformId: 'csdn',
    platformName: 'CSDN',
    status: 'needs_browser',
    supportedFormats: ['md', 'html'],
    requiresCredentials: ['UserName', 'UserToken', 'UserSecret'],
    needsBrowser: true,
    setupHint: 'CSDN Cookie + Playwright 浏览器内核,参考 docs/PUBLISH_SETUP.md#csdn',
  },
  {
    platformId: 'juejin',
    platformName: '掘金',
    status: 'needs_browser',
    supportedFormats: ['md', 'html'],
    requiresCredentials: ['sessionid', 'sessionid_ss'],
    needsBrowser: true,
    setupHint: '掘金 Cookie + Playwright 浏览器内核,参考 docs/PUBLISH_SETUP.md#juejin',
  },
  {
    platformId: 'xiaohongshu',
    platformName: '小红书',
    status: 'needs_browser',
    supportedFormats: ['md', 'image'],
    requiresCredentials: ['web_session'],
    needsBrowser: true,
    setupHint: '小红书 Cookie + Playwright 浏览器内核,参考 docs/PUBLISH_SETUP.md#xiaohongshu',
  },
  {
    platformId: 'shipinhao',
    platformName: '微信视频号',
    status: 'needs_browser',
    supportedFormats: ['video'],
    requiresCredentials: ['cookie'],
    needsBrowser: true,
    setupHint: '视频号 Cookie + Playwright 浏览器内核,参考 docs/PUBLISH_SETUP.md#shipinhao',
  },
] as const

/**
 * 按 platformId 查找本地注册表项。未找到返回 undefined。
 * 导出供 verify-publish-adapters.mjs 脚本通过 GET /publish/adapters/status 间接使用。
 */
export function findPlatformEntry(platformId: string): PlatformRegistryEntry | undefined {
  return PLATFORM_REGISTRY.find((p) => p.platformId === platformId)
}

/**
 * 计算指定平台列表的 dry-run 结果(本地短路,不调 ai-service)。
 * 用于 POST /publish/tasks?dryRun=true 时返回每个平台的可用性,避免 stub 静默成功。
 */
function computeDryRunResults(
  platforms: string[],
): Array<{ platformId: string; status: PlatformStatus; canPublish: boolean; setupHint: string }> {
  return platforms.map((pid) => {
    const entry = findPlatformEntry(pid)
    if (!entry) {
      return {
        platformId: pid,
        status: 'needs_sdk' as PlatformStatus,
        canPublish: false,
        setupHint: `未知平台 ${pid},参考 docs/PUBLISH_SETUP.md`,
      }
    }
    return {
      platformId: entry.platformId,
      status: entry.status,
      canPublish: entry.status === 'implemented',
      setupHint: entry.setupHint,
    }
  })
}

async function proxyToAiService(
  request: FastifyRequest,
  reply: FastifyReply,
  path: string,
): Promise<void> {
  const url = `${config.AI_SERVICE_URL}/api/publish${path}`
  const method = request.method
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  // 转发 JWT(让 ai-service 共享鉴权上下文)
  const authHeader = request.headers.authorization
  if (authHeader) headers.authorization = authHeader

  let body: string | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    body = JSON.stringify(request.body ?? {})
  }

  try {
    const upstream = await fetch(url, { method, headers, body })
    const text = await upstream.text()
    let payload: unknown = text
    const ct = upstream.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      try {
        payload = JSON.parse(text)
      } catch {
        // 保留原始 text
      }
    }
    reply.status(upstream.status).send(payload)
  } catch (e) {
    request.log.error({ err: e, url }, 'publish proxy failed')
    reply.status(502).send(error(502, 'ai-service unavailable'))
  }
}

/**
 * multipart 上传代理:从 fastify 解析 file,转 FormData 转发到 ai-service。
 * 返回结构统一 { code, message, data }。
 */
async function proxyMultipartToAiService(
  request: FastifyRequest,
  reply: FastifyReply,
  userId: string | undefined,
): Promise<void> {
  if (!request.isMultipart()) {
    reply.status(400).send(error(400, '请求必须是 multipart/form-data'))
    return
  }
  const data = await request.file()
  if (!data) {
    reply.status(400).send(error(400, '未找到上传文件'))
    return
  }
  const buffer = await data.toBuffer()
  if (buffer.length === 0) {
    reply.status(400).send(error(400, '文件内容为空'))
    return
  }

  // 构造转发 URL(带 user_id 查询参数)
  const qs = userId ? `?user_id=${encodeURIComponent(userId)}` : ''
  const url = `${config.AI_SERVICE_URL}/api/publish/upload${qs}`

  // 用 FormData 转发(保留原始 filename + content-type)
  const formData = new FormData()
  const blob = new Blob([new Uint8Array(buffer)], {
    type: data.mimetype || 'application/octet-stream',
  })
  formData.append('file', blob, data.filename || `upload-${Date.now()}`)

  const headers: Record<string, string> = {}
  const authHeader = request.headers.authorization
  if (authHeader) headers.authorization = authHeader

  try {
    const upstream = await fetch(url, { method: 'POST', headers, body: formData })
    const text = await upstream.text()
    let payload: unknown = text
    const ct = upstream.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      try {
        payload = JSON.parse(text)
      } catch {
        // 保留原始 text
      }
    }
    // 统一封装为 { code, message, data } 格式(ai-service 返回裸 dict)
    if (
      upstream.ok &&
      payload &&
      typeof payload === 'object' &&
      !('code' in (payload as Record<string, unknown>))
    ) {
      reply.status(upstream.status).send(success(payload))
    } else {
      reply.status(upstream.status).send(payload)
    }
  } catch (e) {
    request.log.error({ err: e, url }, 'publish upload proxy failed')
    reply.status(502).send(error(502, 'ai-service unavailable'))
  }
}

export const publishRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // /upload 走 multipart,authenticate 内部会处理 JWT
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      // 2026-08-06 修复:必须 return reply,防止 handler 在未认证时继续执行
      return reply.status(statusCode).send(error(statusCode, (e as Error).message || '需要登录'))
    }
  })

  // ===== 平台元数据 =====

  server.get('/publish/platforms', async (request, reply) => {
    await proxyToAiService(request, reply, '/platforms')
  })

  /**
   * 本地端点(2026-07-30 立):返回 13 平台 adapter 可用性矩阵,无需 ai-service 在线。
   * 用于 verify-publish-adapters.mjs 脚本 + 前端"发布向导"展示哪些平台可立即发布。
   * 响应结构:{ code: 0, message: 'success', data: { items: [...], count, summary } }
   */
  server.get('/publish/adapters/status', async (_request, reply) => {
    const items = PLATFORM_REGISTRY.map((e) => ({
      platformId: e.platformId,
      platformName: e.platformName,
      status: e.status,
      canPublish: e.status === 'implemented',
      supportedFormats: e.supportedFormats,
      requiresCredentials: e.requiresCredentials,
      needsBrowser: e.needsBrowser,
      setupHint: e.setupHint,
    }))
    const summary = {
      total: items.length,
      implemented: items.filter((i) => i.status === 'implemented').length,
      needsBrowser: items.filter((i) => i.status === 'needs_browser').length,
      needsOauth: items.filter((i) => i.status === 'needs_oauth').length,
      needsSdk: items.filter((i) => i.status === 'needs_sdk').length,
    }
    return reply.send(success({ items, count: items.length, summary }))
  })

  // ===== 文件上传(multipart) =====

  server.post('/publish/upload', async (request, reply) => {
    // 2026-08-06 修复:userId 一律以 JWT 解析的 request.userId 为准,
    // 忽略 query.user_id,防止伪造上传归属(IDOR)。
    const userId = (request as FastifyRequest & { userId?: string }).userId
    await proxyMultipartToAiService(request, reply, userId)
  })

  // ===== 账号管理 =====

  server.get('/publish/accounts/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string }
    await proxyToAiService(request, reply, `/accounts/${encodeURIComponent(userId)}`)
  })

  server.post('/publish/accounts', async (request, reply) => {
    await proxyToAiService(request, reply, '/accounts')
  })

  server.put('/publish/accounts/:accountId', async (request, reply) => {
    const { accountId } = request.params as { accountId: string }
    await proxyToAiService(request, reply, `/accounts/${encodeURIComponent(accountId)}`)
  })

  server.delete('/publish/accounts/:accountId', async (request, reply) => {
    const { accountId } = request.params as { accountId: string }
    await proxyToAiService(request, reply, `/accounts/${encodeURIComponent(accountId)}`)
  })

  server.post('/publish/accounts/:accountId/verify', async (request, reply) => {
    const { accountId } = request.params as { accountId: string }
    await proxyToAiService(request, reply, `/accounts/${encodeURIComponent(accountId)}/verify`)
  })

  // ===== 任务管理 =====

  server.post('/publish/tasks', async (request, reply) => {
    // dryRun 短路(2026-07-30 立):body.dryRun=true 或 query.dryRun=true 时,
    // 本地返回每个平台的可用性,不转发 ai-service(避免 stub adapter 静默成功误导用户)。
    const query = request.query as { dryRun?: string }
    const body = (request.body ?? {}) as { dryRun?: boolean; platforms?: string[] }
    const isDryRun = body.dryRun === true || query.dryRun === 'true' || query.dryRun === '1'

    if (isDryRun) {
      // 平台列表优先取 body.platforms,未传则对所有注册平台做 dry-run
      const platforms =
        Array.isArray(body.platforms) && body.platforms.length > 0
          ? body.platforms.filter((p): p is string => typeof p === 'string')
          : PLATFORM_REGISTRY.map((e) => e.platformId)
      const results = computeDryRunResults(platforms)
      return reply.send(
        success({
          dryRun: true,
          results,
          summary: {
            total: results.length,
            canPublishNow: results.filter((r) => r.canPublish).length,
            needsSetup: results.filter((r) => !r.canPublish).length,
          },
        }),
      )
    }

    await proxyToAiService(request, reply, '/tasks')
  })

  server.get('/publish/tasks', async (request, reply) => {
    const qs = request.url.split('?')[1] ?? ''
    await proxyToAiService(request, reply, qs ? `/tasks?${qs}` : '/tasks')
  })

  server.get('/publish/tasks/:taskId', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    await proxyToAiService(request, reply, `/tasks/${encodeURIComponent(taskId)}`)
  })

  server.post('/publish/tasks/:taskId/cancel', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    await proxyToAiService(request, reply, `/tasks/${encodeURIComponent(taskId)}/cancel`)
  })

  server.post('/publish/tasks/:taskId/retry', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    await proxyToAiService(request, reply, `/tasks/${encodeURIComponent(taskId)}/retry`)
  })

  // ===== 历史 / 统计 / 密钥 / 运行中 =====

  server.get('/publish/history', async (request, reply) => {
    const qs = request.url.split('?')[1] ?? ''
    await proxyToAiService(request, reply, qs ? `/history?${qs}` : '/history')
  })

  server.get('/publish/stats', async (request, reply) => {
    const qs = request.url.split('?')[1] ?? ''
    await proxyToAiService(request, reply, qs ? `/stats?${qs}` : '/stats')
  })

  server.get('/publish/credentials-key/generate', async (request, reply) => {
    await proxyToAiService(request, reply, '/credentials-key/generate')
  })

  server.get('/publish/running', async (request, reply) => {
    const qs = request.url.split('?')[1] ?? ''
    await proxyToAiService(request, reply, qs ? `/running?${qs}` : '/running')
  })

  // ===== 扫码登录(2026-07-30 新增,WorkPanel 内置浏览器扫码 → 自动保存 cookies)=====

  server.get('/publish/scan-login/platforms', async (request, reply) => {
    await proxyToAiService(request, reply, '/scan-login/platforms')
  })

  server.post('/publish/scan-login/start', async (request, reply) => {
    await proxyToAiService(request, reply, '/scan-login/start')
  })

  server.get('/publish/scan-login/:taskId/status', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    await proxyToAiService(request, reply, `/scan-login/${encodeURIComponent(taskId)}/status`)
  })

  // 二维码截图:ai-service 返回 image/png,代理需要透传 binary
  server.get('/publish/scan-login/:taskId/qr', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    const url = `${config.AI_SERVICE_URL}/api/publish/scan-login/${encodeURIComponent(taskId)}/qr`
    const authHeader = request.headers.authorization
    const headers: Record<string, string> = {}
    if (authHeader) headers.authorization = authHeader
    try {
      const upstream = await fetch(url, { method: 'GET', headers })
      const buf = Buffer.from(await upstream.arrayBuffer())
      reply
        .status(upstream.status)
        .header('Content-Type', upstream.headers.get('content-type') ?? 'image/png')
        .header('Cache-Control', 'no-store, no-cache, must-revalidate')
        .send(buf)
    } catch (e) {
      request.log.error({ err: e, url }, 'scan-login qr proxy failed')
      reply.status(502).send(error(502, 'ai-service unavailable'))
    }
  })

  server.post('/publish/scan-login/:taskId/cancel', async (request, reply) => {
    const { taskId } = request.params as { taskId: string }
    await proxyToAiService(request, reply, `/scan-login/${encodeURIComponent(taskId)}/cancel`)
  })

  // CDP 检测(2026-08-17 补):ai-service scan_login.py 已实现 /detect-from-cdp,
  // api 代理层此前缺失 → api-client detectFromCdp 调用必 404。补透传。
  server.post('/publish/scan-login/detect-from-cdp', async (request, reply) => {
    await proxyToAiService(request, reply, '/scan-login/detect-from-cdp')
  })

  // ===== 账号分组管理(2026-08-01 新增)=====

  server.get('/publish/groups', async (request, reply) => {
    await proxyToAiService(request, reply, '/groups')
  })

  server.post('/publish/groups', async (request, reply) => {
    await proxyToAiService(request, reply, '/groups')
  })

  server.patch('/publish/groups/:groupId', async (request, reply) => {
    const { groupId } = request.params as { groupId: string }
    await proxyToAiService(request, reply, `/groups/${encodeURIComponent(groupId)}`)
  })

  server.delete('/publish/groups/:groupId', async (request, reply) => {
    const { groupId } = request.params as { groupId: string }
    await proxyToAiService(request, reply, `/groups/${encodeURIComponent(groupId)}`)
  })

  server.post('/publish/groups/:groupId/add', async (request, reply) => {
    const { groupId } = request.params as { groupId: string }
    await proxyToAiService(request, reply, `/groups/${encodeURIComponent(groupId)}/add`)
  })

  server.post('/publish/groups/:groupId/remove', async (request, reply) => {
    const { groupId } = request.params as { groupId: string }
    await proxyToAiService(request, reply, `/groups/${encodeURIComponent(groupId)}/remove`)
  })

  server.get('/publish/groups/:groupId/members', async (request, reply) => {
    const { groupId } = request.params as { groupId: string }
    await proxyToAiService(request, reply, `/groups/${encodeURIComponent(groupId)}/members`)
  })

  server.post('/publish/groups/:groupId/publish', async (request, reply) => {
    const { groupId } = request.params as { groupId: string }
    await proxyToAiService(request, reply, `/groups/${encodeURIComponent(groupId)}/publish`)
  })

  // ===== 批量账号导入/导出/验证/模板(2026-08-01 新增)=====
  // 注意:batch-template 是 GET 静态路由,需在 /accounts/:userId 之前注册(Fastify 自动优先静态)

  server.get('/publish/accounts/batch-template', async (request, reply) => {
    await proxyToAiService(request, reply, '/accounts/batch-template')
  })

  server.post('/publish/accounts/batch-import', async (request, reply) => {
    await proxyToAiService(request, reply, '/accounts/batch-import')
  })

  server.post('/publish/accounts/batch-export', async (request, reply) => {
    await proxyToAiService(request, reply, '/accounts/batch-export')
  })

  server.post('/publish/accounts/batch-verify', async (request, reply) => {
    await proxyToAiService(request, reply, '/accounts/batch-verify')
  })

  // ===== Cookie 健康度 + 手动保活(2026-08-01 新增)=====

  server.get('/publish/accounts/:accountId/cookie-health', async (request, reply) => {
    const { accountId } = request.params as { accountId: string }
    await proxyToAiService(
      request,
      reply,
      `/accounts/${encodeURIComponent(accountId)}/cookie-health`,
    )
  })

  server.post('/publish/accounts/:accountId/refresh-cookie', async (request, reply) => {
    const { accountId } = request.params as { accountId: string }
    await proxyToAiService(
      request,
      reply,
      `/accounts/${encodeURIComponent(accountId)}/refresh-cookie`,
    )
  })

  server.get('/publish/cookie-refresh/stats', async (request, reply) => {
    await proxyToAiService(request, reply, '/cookie-refresh/stats')
  })

  server.post('/publish/cookie-refresh/trigger', async (request, reply) => {
    await proxyToAiService(request, reply, '/cookie-refresh/trigger')
  })

  // ===== AI 辅助写作(2026-08-01 新增,透传 ai-service /publish/ai/* 端点)=====

  server.post('/publish/ai/titles', async (request, reply) => {
    await proxyToAiService(request, reply, '/ai/titles')
  })

  server.post('/publish/ai/polish', async (request, reply) => {
    await proxyToAiService(request, reply, '/ai/polish')
  })

  server.post('/publish/ai/tags', async (request, reply) => {
    await proxyToAiService(request, reply, '/ai/tags')
  })

  server.post('/publish/ai/summary', async (request, reply) => {
    await proxyToAiService(request, reply, '/ai/summary')
  })

  server.post('/publish/ai/seo', async (request, reply) => {
    await proxyToAiService(request, reply, '/ai/seo')
  })

  server.post('/publish/ai/cover', async (request, reply) => {
    await proxyToAiService(request, reply, '/ai/cover')
  })

  server.post('/publish/ai/analyze-all', async (request, reply) => {
    await proxyToAiService(request, reply, '/ai/analyze-all')
  })
}
