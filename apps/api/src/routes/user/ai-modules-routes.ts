/**
 * AI 模块 /ai/*, /ai-ext/*(8 个端点:index/team/chat 会话/ext reports + career-advice)。
 * 注:/ai/chat (POST) 和 /ai/history (GET) 已由 ai-user-model-chat.ts 真实实现。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, asc, sql } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db } from '../../db/index.js'
import { aiModelConfig } from '@ihui/database'
import { config } from '../../config/index.js'
import { authenticate } from '../../plugins/auth.js'
import {
  findAiIndexBanners,
  findAiTeamMembers,
  findAiTeamMemberById,
  createAiConversation,
  findAiConversations,
  deleteAiConversation,
  findAiExtReports,
  createAiExtReport,
  findAiCareers,
  findAiCareerById,
  findAiChatTypes,
  findAiCommunityPosts,
} from '../../db/ai-modules-queries.js'
import { parsePagination, parseIdParam } from './_shared.js'

const careerAdviceSchema = z.object({
  school: z.string().max(200).optional().default(''),
  classLevel: z.string().max(100).optional().default(''),
  scoreRange: z.string().max(100).optional().default(''),
  languageDifficulty: z.string().max(500).optional().default(''),
  scienceCharacteristics: z.string().max(500).optional().default(''),
  learningObstacle: z.string().max(1000).optional().default(''),
  hobbies: z.string().max(1000).optional().default(''),
  target: z.string().max(1000).optional().default(''),
})

const aiModulesRoutes: FastifyPluginAsync = async (server) => {
  server.get('/ai/index', async (_request, reply) => {
    const [banners, models] = await Promise.all([
      findAiIndexBanners(),
      db
        .select({
          id: aiModelConfig.id,
          name: aiModelConfig.name,
          provider: aiModelConfig.providerCode,
          description: aiModelConfig.description,
          type: aiModelConfig.apiFormat,
          status: sql<number>`CASE WHEN ${aiModelConfig.enabled} THEN 1 ELSE 0 END`,
          sort: aiModelConfig.sortOrder,
          baseUrl: aiModelConfig.baseUrl,
          modelIdForTest: aiModelConfig.modelIdForTest,
        })
        .from(aiModelConfig)
        .where(eq(aiModelConfig.enabled, true))
        .orderBy(asc(aiModelConfig.sortOrder), asc(aiModelConfig.id))
        .limit(10),
    ])
    return reply.send(success({ banners, models, recommend: models.slice(0, 5) }))
  })

  server.get('/ai/team', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findAiTeamMembers({ page: q.page, pageSize: q.pageSize, search: q.search })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/ai/team/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const team = await findAiTeamMemberById(id)
    if (!team) return reply.status(404).send(error(404, '团队成员不存在'))
    return reply.send(success({ team }))
  })

  server.post('/ai/chat/conversations', async (request, reply) => {
    const body = z
      .object({
        title: z.string().max(200).optional(),
        modelId: z.string().max(100).optional(),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const conversation = await createAiConversation({
      userId: request.userId!,
      title: body.data.title,
      modelId: body.data.modelId,
    })
    return reply.status(201).send(success({ conversationId: conversation.id, conversation }))
  })

  server.get('/ai/chat/conversations', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findAiConversations({
      userId: request.userId!,
      page: q.page,
      pageSize: q.pageSize,
    })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.delete('/ai/chat/conversations/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const deleted = await deleteAiConversation(id, request.userId!)
    if (!deleted) return reply.status(404).send(error(404, '会话不存在'))
    return reply.send(success({ success: true }))
  })

  server.get('/ai-ext/reports', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findAiExtReports({
      userId: request.userId!,
      page: q.page,
      pageSize: q.pageSize,
    })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.post('/ai-ext/reports/generate', async (request, reply) => {
    const body = z
      .object({
        type: z.string().max(50),
        content: z.string().optional(),
      })
      .safeParse(request.body)
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const report = await createAiExtReport({
      userId: request.userId!,
      type: body.data.type,
      content: body.data.content,
    })
    return reply.status(201).send(success({ reportId: report.id, report }))
  })

  server.get('/ai/careers', async (_request, reply) => {
    const list = await findAiCareers()
    return reply.send(success({ list }))
  })

  server.get('/ai/careers/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const career = await findAiCareerById(id)
    if (!career) return reply.status(404).send(error(404, '职位不存在'))
    return reply.send(success({ career }))
  })

  server.get('/ai/chat-types', async (_request, reply) => {
    const list = await findAiChatTypes()
    return reply.send(success({ list }))
  })

  server.get('/ai/community', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findAiCommunityPosts({
      page: q.page,
      pageSize: q.pageSize,
      search: q.search,
    })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.post('/ai/career-advice', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply
        .status(statusCode)
        .send(error(statusCode, (e as Error).message || 'Authentication required'))
    }

    const parsed = careerAdviceSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const input = parsed.data

    const prompt = [
      '你是一位资深的升学与生涯规划顾问,请根据以下学生情况给出个性化的生涯指导建议。',
      `学校: ${input.school || '未提供'}`,
      `年级: ${input.classLevel || '未提供'}`,
      `成绩区间: ${input.scoreRange || '未提供'}`,
      `语文学科特点/难度: ${input.languageDifficulty || '未提供'}`,
      `理科学科特点: ${input.scienceCharacteristics || '未提供'}`,
      `学习障碍/困难: ${input.learningObstacle || '未提供'}`,
      `兴趣爱好: ${input.hobbies || '未提供'}`,
      `目标: ${input.target || '未提供'}`,
      '请从升学方向、学科提升、兴趣发展、职业规划四个维度给出具体可执行的建议,800 字以内。',
    ].join('\n')

    try {
      const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          max_tokens: 1500,
          temperature: 0.7,
        }),
      })
      if (resp.ok) {
        const data = (await resp.json()) as { text?: string; content?: string; output?: string }
        const content = data.text ?? data.content ?? data.output ?? '暂无建议内容,请稍后重试。'
        return reply.send(success({ content }))
      }
      request.log.warn({ status: resp.status }, 'AI 服务调用失败,返回兜底建议')
    } catch (e) {
      request.log.warn({ err: e }, 'AI 服务不可用,返回兜底建议')
    }

    const fallback = [
      `针对${input.classLevel || '该'}阶段同学的生涯指导建议:`,
      '1. 升学方向:结合自身成绩区间与学科特点,优先考虑与优势学科匹配的专业方向。',
      '2. 学科提升:针对学习障碍制定阶段性小目标,弱科每日固定时间攻坚,强科保持稳定。',
      '3. 兴趣发展:将兴趣爱好与升学目标结合,参与相关竞赛或实践活动,丰富综合素质评价。',
      '4. 职业规划:多了解目标行业的真实工作内容,通过职业体验、学长交流等方式验证兴趣。',
      '(此为兜底建议,AI 服务暂不可用,请稍后重试获取个性化建议)',
    ].join('\n')
    return reply.send(success({ content: fallback }))
  })
}

export default aiModulesRoutes
