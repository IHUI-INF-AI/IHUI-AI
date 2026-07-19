import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { gradeExam, getExamRecordStatus } from '../db/exam-extended-queries.js'

// =============================================================================
// 阅卷(legacy /auth-api/mark/paper 补开发,1 个端点)
// 业务逻辑参考 D 盘 RecordController.mark(评分,服务调用)
// 复用 exam-extended-queries.ts gradeExam(submitted→graded,记录分数 + 是否通过)
// =============================================================================

const markPaperSchema = z.object({
  recordId: z.string().uuid('recordId 必须为 UUID'),
  score: z
    .number()
    .min(0, '分数不能为负')
    .max(1000, '分数过高')
    .refine((v) => !Number.isNaN(v), '分数必须为数字'),
  // 兼容 Java RecordResponse 扩展字段(当前 gradeExam 仅使用 recordId + score)
  paperId: z.string().uuid().optional(),
  memberId: z.string().uuid().optional(),
  answer: z.string().optional(),
  referenceAnswer: z.string().optional(),
})

const examMarkingRoutes: FastifyPluginAsync = async (server) => {
  // POST / — 评分(Java: POST /auth-api/mark/paper,需登录)
  // 接收 recordId + score,将答题记录从 submitted 状态置为 graded,记录得分
  server.post('/', async (request, reply) => {
    let userId: string
    try {
      const payload = await authenticate(request)
      userId = payload.userId
    } catch {
      return reply.status(401).send(error(401, '未授权'))
    }
    const parsed = markPaperSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { recordId, score } = parsed.data

    // 校验记录存在
    const existing = await getExamRecordStatus(recordId)
    if (!existing) {
      return reply.status(404).send(error(404, '答题记录不存在'))
    }
    // 仅允许评分 submitted 状态的记录(已提交未评分)
    if (existing.status !== 'submitted') {
      return reply.status(409).send(error(409, `当前状态 ${existing.status} 不可评分`))
    }

    try {
      const record = await gradeExam(recordId, score)
      request.log.info({ recordId, score, userId }, 'exam-marking 评分完成')
      return reply.send(success(record))
    } catch (e) {
      request.log.error({ err: e, recordId, score }, 'exam-marking 评分失败')
      return reply.status(500).send(error(500, (e as Error).message ?? '评分失败'))
    }
  })
}

export default examMarkingRoutes
