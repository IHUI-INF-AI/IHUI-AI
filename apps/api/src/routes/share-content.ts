// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { success, error } from '../utils/response.js'
import { dbRead } from '../db/index.js'
import { aiGcContent, users } from '@ihui/database'

/**
 * 分享内容路由：/api/share/content/:code
 * 通过分享 code（aiGcContent 的 UUID）获取 AI 生成内容。
 */
export const shareContentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/content/:code', async (request, reply) => {
    const { code } = z.object({ code: z.string() }).parse(request.params)

    const invalidCodes = ['', 'dist', 'index.html', 'index', 'share', 'error']
    if (!code || invalidCodes.includes(code)) {
      return reply.code(400).send(error(400, '分享链接无效'))
    }

    const rows = await dbRead
      .select({
        id: aiGcContent.id,
        gcType: aiGcContent.gcType,
        content: aiGcContent.content,
        agentId: aiGcContent.agentId,
        userUuid: aiGcContent.userUuid,
        createdAt: aiGcContent.createdAt,
        status: aiGcContent.status,
        userNickname: users.nickname,
        userAvatar: users.avatar,
      })
      .from(aiGcContent)
      .leftJoin(users, eq(sql`${users.id}::text`, aiGcContent.userUuid))
      .where(eq(aiGcContent.id, code))
      .limit(1)

    const content = rows[0]
    if (!content || content.gcType === undefined || content.status === 0) {
      return reply.code(404).send(error(404, '分享内容不存在或已下线'))
    }
    const status = content.status ?? 1

    let parsed: { question?: string; answer?: Record<string, unknown> } = {}
    try {
      if (content.content) {
        parsed = JSON.parse(content.content) as typeof parsed
      }
    } catch {
      parsed = { answer: { text: content.content } }
    }

    // 规范化 answer 结构,匹配前端 ShareAnswer 接口 (thinking/text/images/video/audio/lists)
    const rawAnswer = parsed.answer ?? { text: content.content ?? '' }
    const answer = {
      thinking: typeof rawAnswer.thinking === 'string' ? rawAnswer.thinking : undefined,
      text: typeof rawAnswer.text === 'string' ? rawAnswer.text : undefined,
      images: Array.isArray(rawAnswer.images)
        ? (rawAnswer.images as unknown[]).filter((x): x is string => typeof x === 'string')
        : undefined,
      video:
        rawAnswer.video && typeof rawAnswer.video === 'object'
          ? (rawAnswer.video as { url: string; cover?: string; width?: number; height?: number })
          : undefined,
      audio:
        rawAnswer.audio && typeof rawAnswer.audio === 'object'
          ? (rawAnswer.audio as { url: string; duration?: number })
          : undefined,
      lists: Array.isArray(rawAnswer.lists)
        ? (rawAnswer.lists as Array<{ type: string; content: string }>)
        : undefined,
    }

    return reply.send(
      success({
        code,
        gcType: content.gcType,
        modelName: '',
        modelIcon: '',
        question: parsed.question || '',
        answer,
        content: content.content,
        agentId: content.agentId,
        userUuid: content.userUuid,
        userName: content.userNickname ?? null,
        userAvatar: content.userAvatar ?? null,
        createdAt: content.createdAt.toISOString(),
        status,
      }),
    )
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
