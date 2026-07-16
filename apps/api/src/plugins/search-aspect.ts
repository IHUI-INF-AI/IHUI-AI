import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { hotWords } from '@ihui/database'

const KEYWORD_MAX_LEN = 100

/**
 * 搜索关键词索引写入(等价 Java SearchAspect)。
 *
 * 拦截 GET /api/search,onResponse 异步将关键词写入 hot_words 表并累加搜索次数。
 * hot_words.word 无唯一约束,采用 select-then-update-or-insert 的手动 upsert
 * (语义等价 onConflictDoUpdate),避免运行时因缺失唯一约束而报错。
 * 钩子失败不阻塞主请求(setImmediate + try/catch)。
 */
async function upsertSearchKeyword(keyword: string): Promise<void> {
  const trimmed = keyword.trim().slice(0, KEYWORD_MAX_LEN)
  if (!trimmed) return

  const existing = await db
    .select({ id: hotWords.id, sort: hotWords.sort })
    .from(hotWords)
    .where(eq(hotWords.word, trimmed))
    .limit(1)

  if (existing[0]) {
    await db
      .update(hotWords)
      .set({ sort: (existing[0].sort ?? 0) + 1, updatedAt: new Date() })
      .where(eq(hotWords.id, existing[0].id))
  } else {
    await db.insert(hotWords).values({ word: trimmed, sort: 1, status: 'active' })
  }
}

const searchAspectPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.addHook('onResponse', async (request: FastifyRequest, _reply: FastifyReply) => {
    if (request.method.toUpperCase() !== 'GET') return
    const url = request.url.split('?')[0] ?? ''
    if (url !== '/api/search') return

    const query = request.query as { q?: string }
    if (!query.q || !query.q.trim()) return

    const keyword = query.q.trim()
    setImmediate(() => {
      upsertSearchKeyword(keyword).catch((e) => {
        server.log.warn({ err: e }, 'search-aspect: upsert keyword failed')
      })
    })
  })
}

export default fp(searchAspectPlugin, {
  name: 'search-aspect',
  fastify: '5.x',
})
