import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
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
 * Redis SETNX 去重:同一用户/IP 同一资源 5 分钟内只计 1 次浏览。
 * 去重通过后自增 viewCount + 记录浏览行为。
 * Redis 不可用时降级为不去重(每次都计数)。
 * 钩子失败不阻塞主请求(try/catch + logger.warn)。
 */
const watchAspectPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.addHook('preHandler', async (request: FastifyRequest, _reply: FastifyReply) => {
    if (request.method.toUpperCase() !== 'GET') return
    const url = request.url.split('?')[0] ?? ''
    const target = parseWatchTarget(url)
    if (!target) return

    const userId = request.userId ?? request.jwtPayload?.userId
    const identity = userId ?? request.ip
    const dedupKey = `watch:${identity}:${target.topicType}:${target.topicId}`

    let shouldCount = true
    try {
      const wasSet = await server.redis.set(dedupKey, '1', 'EX', DEDUP_TTL_SEC, 'NX')
      shouldCount = wasSet === 'OK'
    } catch (e) {
      server.log.warn(
        { err: e },
        'watch-aspect: redis dedup failed, degrading to always-count',
      )
      shouldCount = true
    }

    if (!shouldCount) return

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
  })
}

export default fp(watchAspectPlugin, {
  name: 'watch-aspect',
  fastify: '5.x',
})
