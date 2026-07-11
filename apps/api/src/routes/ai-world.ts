import type { FastifyPluginAsync } from 'fastify'
import { eq, desc } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { agents } from '@ihui/database'
import { success } from '../utils/response.js'

interface AiCategory {
  id: string
  name: string
  icon: string
}

const STATIC_CATEGORIES: AiCategory[] = [
  { id: 'chat', name: 'AI对话', icon: 'message' },
  { id: 'painting', name: 'AI绘画', icon: 'palette' },
  { id: 'video', name: 'AI视频', icon: 'video' },
  { id: 'music', name: 'AI音乐', icon: 'music' },
  { id: 'code', name: 'AI代码', icon: 'code' },
  { id: 'office', name: 'AI办公', icon: 'briefcase' },
  { id: 'education', name: 'AI教育', icon: 'graduation' },
  { id: 'marketing', name: 'AI营销', icon: 'megaphone' },
]

export const aiWorldRoutes: FastifyPluginAsync = async (server) => {
  // GET /ai-world — AI 世界首页（分类 + 热门应用）
  server.get('/ai-world', async (_request, reply) => {
    const rows = await dbRead
      .select({
        id: agents.agentId,
        name: agents.name,
      })
      .from(agents)
      .where(eq(agents.status, 'published'))
      .orderBy(desc(agents.usageCount))
      .limit(4)

    return reply.send(
      success({
        categories: STATIC_CATEGORIES,
        hotApps: rows.map((r) => ({ id: r.id, name: r.name, href: `/ai-world/app/${r.id}` })),
      }),
    )
  })
}
