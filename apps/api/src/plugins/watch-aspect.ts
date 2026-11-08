// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  RouteOptions,
} from 'fastify'
import fp from 'fastify-plugin'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { resources, newsArticles } from '@ihui/database'
import { recordWatch } from '../db/behavior-queries.js'

const DEDUP_TTL_SEC = 300

type ViewTable = 'resources' | 'newsArticles'

interface WatchTarget {
  topicType: string
  topicId: string
  table: ViewTable
}

function parseWatchTarget(url: string): WatchTarget | null {
  let m = url.match(/^\/api\/resources\/([a-f0-9-]{36})$/i)
  if (m && m[1]) return { topicType: 'resource', topicId: m[1], table: 'resources' }
  m = url.match(/^\/api\/news\/articles\/([a-f0-9-]{36})$/i)
  if (m && m[1]) return { topicType: 'news', topicId: m[1], table: 'newsArticles' }
  m = url.match(/^\/api\/articles\/([a-f0-9-]{36})$/i)
  if (m && m[1]) return { topicType: 'article', topicId: m[1], table: 'newsArticles' }
  return null
}

async function incrementViewCount(target: WatchTarget): Promise<void> {
  if (target.table === 'resources') {
    await db
      .update(resources)
      .set({ viewCount: sql<number>`${resources.viewCount} + 1` })
      .where(eq(resources.id, target.topicId))
  } else {
    await db
      .update(newsArticles)
      .set({ viewCount: sql<number>`${newsArticles.viewCount} + 1` })
      .where(eq(newsArticles.id, target.topicId))
  }
}

/**
 * 浏览去重 + 浏览量计数(等价 Java WatchAspect)。
 *
 * 拦截 GET /api/resources/:id、/api/news/articles/:id、/api/articles/:id 详情端点。
 *
 * F-206 根因修复:钩子此前挂在**根实例 preHandler**,Fastify 的钩子顺序是
 * 「外层插件钩子 → 路由自身 preHandler → handler」,于是计数跑在鉴权之前 ——
 * `request.userId` 恒 undefined(观看记录永远不落库),且 handler 里的
 * `incrementViewCount` 又计一次(一次浏览计两次)。
 * 现在改用 onRoute 把钩子**追加到目标路由 preHandler 链末尾**(与 rls-context /
 * auth-default-deny 同一招):鉴权/授权先跑,计数后跑且读到已认证身份;
 * 请求被鉴权拒绝(401/403)时链在 handler 之前终止,计数一次都不发生。
 *
 * Redis SETNX 去重:同一用户/IP 同一资源 5 分钟内只计 1 次;
 * 另用 WeakSet 做**单请求幂等**(同一 request 被多条钩子链命中也只计一次)。
 * Redis 不可用时降级为不去重(仍受单请求幂等约束)。
 * 计数失败不阻塞主请求(try/catch + logger.warn)。
 */

/** 路由模板形态(onRoute 收到的 url 含前缀,参数段为 `:id`)。 */
const WATCH_ROUTE_PATTERNS: readonly RegExp[] = [
  /^\/api\/resources\/:id\/?$/i,
  /^\/api\/news\/articles\/:id\/?$/i,
  /^\/api\/articles\/:id\/?$/i,
]

function isWatchRouteUrl(url: string | undefined): boolean {
  const path = (url ?? '').split('?')[0] ?? ''
  return WATCH_ROUTE_PATTERNS.some((re) => re.test(path))
}

/** 单请求幂等:request 结束时随对象回收,不占用额外内存。 */
const countedRequests = new WeakSet<FastifyRequest>()

async function countWatch(
  server: FastifyInstance,
  request: FastifyRequest,
): Promise<void> {
  if (request.method.toUpperCase() !== 'GET') return
  const target = parseWatchTarget(request.url.split('?')[0] ?? '')
  if (!target) return
  if (countedRequests.has(request)) return

  // 本钩子已在路由 preHandler 链末尾 ⇒ 鉴权已完成,这里读到的是认证后的真值。
  const userId = request.userId ?? request.jwtPayload?.userId ?? request.principal?.subjectId
  const identity = userId ?? request.ip
  const dedupKey = `watch:${identity}:${target.topicType}:${target.topicId}`

  let shouldCount = true
  try {
    const wasSet = await server.redis.set(dedupKey, '1', 'EX', DEDUP_TTL_SEC, 'NX')
    shouldCount = wasSet === 'OK'
  } catch (e) {
    server.log.warn({ err: e }, 'watch-aspect: redis dedup failed, degrading to always-count')
    shouldCount = true
  }

  if (!shouldCount) return

  countedRequests.add(request)
  try {
    await incrementViewCount(target)
    if (userId) {
      await recordWatch({
        userId,
        topicId: target.topicId,
        topicType: target.topicType,
      })
    }
  } catch (e) {
    server.log.warn({ err: e }, 'watch-aspect: increment viewCount failed')
  }
}

const watchAspectPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.addHook('onRoute', (routeOptions: RouteOptions) => {
    if (!isWatchRouteUrl(routeOptions.url)) return
    const counter = async (request: FastifyRequest): Promise<void> => {
      await countWatch(server, request)
    }
    const existing = routeOptions.preHandler
    if (existing === undefined) {
      routeOptions.preHandler = [counter]
    } else if (Array.isArray(existing)) {
      routeOptions.preHandler = [...existing, counter]
    } else {
      routeOptions.preHandler = [existing, counter]
    }
  })
}

export default fp(watchAspectPlugin, {
  name: 'watch-aspect',
  fastify: '5.x',
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
