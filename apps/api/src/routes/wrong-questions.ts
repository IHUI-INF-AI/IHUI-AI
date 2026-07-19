import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { examWrongQuestion } from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import {
  createOrUpdateWrongQuestion,
  findWrongQuestionsByUser,
} from '../db/exam-extended-queries.js'

// =============================================================================
// 错题本(legacy /auth-api/wrong-question 补开发,3 个端点)
// 数据表: exam_wrong_question(已迁移,exam-extended.ts)
// 业务逻辑参考 D 盘 WrongQuestionController + WrongQuestionServiceImpl
// =============================================================================

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}

const createSchema = z.object({
  questionId: z.string().uuid('questionId 必须为 UUID'),
  paperId: z.string().uuid('paperId 必须为 UUID'),
  paperTitle: z.string().max(200).optional(),
  userAnswer: z.string().min(1, '用户答案不能为空'),
  rightAnswer: z.string().min(1, '正确答案不能为空'),
})

const deleteSchema = z.object({
  id: z.string().uuid('id 必须为 UUID'),
})

const listQuery = z.object({
  ...paginationQuery,
  paperId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  isMastered: z.preprocess(emptyToUndefined, z.coerce.boolean().optional()),
})

const wrongQuestionRoutes: FastifyPluginAsync = async (server) => {
  // 全部端点需登录(对应 Java /auth-api/* 鉴权)
  server.addHook('preHandler', async (request, reply) => {
    try {
      await authenticate(request)
    } catch {
      return reply.status(401).send(error(401, '未授权'))
    }
  })

  // POST / — 添加错题(Java: POST /auth-api/wrong-question)
  // 复用 createOrUpdateWrongQuestion 实现幂等(同题同用户只一条记录,重错时 wrongCount+1)
  server.post('/', async (request, reply) => {
    const userId = request.userId!
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const record = await createOrUpdateWrongQuestion({
      userId,
      questionId: parsed.data.questionId,
      paperId: parsed.data.paperId,
      paperTitle: parsed.data.paperTitle,
      userAnswer: parsed.data.userAnswer,
      rightAnswer: parsed.data.rightAnswer,
    })
    return reply.status(201).send(success(record))
  })

  // DELETE / — 删除错题(Java: DELETE /auth-api/wrong-question, body: { id })
  // 仅允许删除本人的错题
  server.delete('/', async (request, reply) => {
    const userId = request.userId!
    const parsed = deleteSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [deleted] = await db
      .delete(examWrongQuestion)
      .where(
        and(eq(examWrongQuestion.id, parsed.data.id), eq(examWrongQuestion.userId, userId)),
      )
      .returning()
    if (!deleted) return reply.status(404).send(error(404, '错题不存在或无权删除'))
    return reply.send(success({ id: deleted.id, deleted: true }))
  })

  // GET / — 获取错题列表(Java: GET /auth-api/wrong-question/list)
  // 复用 findWrongQuestionsByUser,支持 paperId / isMastered 筛选
  server.get('/', async (request, reply) => {
    const userId = request.userId!
    const parsed = listQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, paperId, isMastered } = parsed.data
    const result = await findWrongQuestionsByUser(userId, {
      page,
      pageSize,
      paperId,
      isMastered,
    })
    return reply.send(success(result))
  })
}

export default wrongQuestionRoutes
