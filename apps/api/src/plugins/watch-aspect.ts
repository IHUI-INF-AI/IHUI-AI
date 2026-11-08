// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  // F-206:挂在根实例的 preHandler 早于路由级 authenticate,request.userId 恒空 ⇒
  // 观看行为从不落库;且与路由自身的 +1 叠加成浏览双计。改到 onResponse:
  // 此时 handler/preHandler 已跑完,身份可取,且只在 2xx 真正返回时计数。
  //
  // 合波 1108 裁决回归留痕:同批分支把钩子改挂 onRoute → 路由 preHandler 链末尾,
  // 实测**不可用**(非注册顺序问题):本仓多数详情端点的身份是在 handler 内
  // `authenticate(request, reply)` 写的,preHandler 阶段读不到 ⇒ 属主观看记录 0 条;
  // 且 preHandler 先于 handler,404/403 也会先计一次浏览量,与 main 的
  // 「非 2xx 不计数」直接冲突。故按裁决退回 onResponse 版。
  // 「记录失败请求」的诉求在此显式处理:失败请求属于访问日志面(onResponse 已由
  // request-log 落痕),不进浏览量/观看行为——把 404/401 自增 viewCount 只会造脏数据。
  server.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.method.toUpperCase() !== 'GET') return
    if (reply.statusCode < 200 || reply.statusCode >= 300) return
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
      server.log.warn({ err: e }, 'watch-aspect: redis dedup failed, degrading to always-count')
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
