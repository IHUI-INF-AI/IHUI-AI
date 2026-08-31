// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { and, desc, eq, sql, type SQL } from 'drizzle-orm'
import {
  aiGeneratedQuestion,
  aiGradingRecord,
  examQuestions,
  type NewAiGeneratedQuestion,
} from '@ihui/database'
import { db } from '../db/index.js'
import { requireAuth } from '../plugins/require-permission.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { success, error } from '../utils/response.js'

// AI 出题题型(与 ai_generated_question.question_type 注释对齐)
const QUESTION_TYPES = ['choice', 'fill', 'subjective'] as const
// AI 出题难度(与 ai_generated_question.difficulty 注释对齐)
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
// 批改记录状态
const RECORD_STATUSES = ['pending', 'approved', 'rejected'] as const

const LLM_TIMEOUT_MS = 90_000

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

const generateSchema = z.object({
  subject: z.string().min(1, '学科不能为空').max(50),
  chapter: z.string().max(200).optional(),
  questionType: z.enum(QUESTION_TYPES, { error: '无效的题型' }),
  difficulty: z.enum(DIFFICULTIES, { error: '无效的难度' }),
  count: z.number().int().min(1).max(10, '数量需在 1-10 之间'),
})

const questionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  subject: z.string().max(50).optional(),
  chapter: z.string().max(200).optional(),
  questionType: z.string().max(20).optional(),
})

const gradeSchema = z.object({
  questionId: z.uuid({ error: '无效的题目 ID' }),
  studentAnswer: z.string().min(1, '学生答案不能为空').max(20_000),
  examId: z.uuid({ error: '无效的试卷 ID' }).optional(),
})

const recordsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(RECORD_STATUSES).optional(),
})

const reviewSchema = z.object({
  teacherReview: z.string().min(1, '复核意见不能为空').max(2000),
  status: z.enum(['approved', 'rejected'], { error: '无效的复核状态' }),
})

// =============================================================================
// LLM 工具
// =============================================================================

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

/**
 * 调用 ai-service /api/llm/complete 完成一次 JSON 任务。
 * 返回 LLM 输出的原始文本与模型名;HTTP/服务层失败直接抛错(调用方转 502)。
 */
async function callLlm(
  request: FastifyRequest,
  systemPrompt: string,
  userContent: string,
): Promise<{ content: string; model: string | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)
  try {
    const res = await aiServiceFetch(request, '/api/llm/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0,
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`LLM 服务返回 ${res.status}`)
    }
    const json = (await res.json()) as {
      content?: string
      error?: boolean
      error_message?: string
      stub?: boolean
      model?: string
    }
    if (json.error || json.stub) {
      throw new Error(json.error_message ?? 'LLM 调用失败')
    }
    const content = (json.content ?? '').trim()
    if (!content) throw new Error('LLM 返回内容为空')
    return { content, model: json.model ?? null }
  } catch (e) {
    if (isAbortError(e)) throw new Error('LLM 调用超时')
    throw e
  } finally {
    clearTimeout(timer)
  }
}

function tryParseJson(text: string): unknown {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
  if (!cleaned) return null
  try {
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

/** 从 LLM 输出中提取 JSON 数组(容忍 markdown 代码块包裹)。 */
function extractJsonArray(text: string): unknown[] {
  const parsed = tryParseJson(text)
  if (Array.isArray(parsed)) return parsed
  const first = text.indexOf('[')
  const last = text.lastIndexOf(']')
  if (first !== -1 && last > first) {
    const sliced = tryParseJson(text.slice(first, last + 1))
    if (Array.isArray(sliced)) return sliced
  }
  return []
}

/** 从 LLM 输出中提取 JSON 对象(容忍 markdown 代码块包裹)。 */
function extractJsonObject(text: string): Record<string, unknown> | null {
  const parsed = tryParseJson(text)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>
  }
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first !== -1 && last > first) {
    const sliced = tryParseJson(text.slice(first, last + 1))
    if (sliced && typeof sliced === 'object' && !Array.isArray(sliced)) {
      return sliced as Record<string, unknown>
    }
  }
  return null
}

// =============================================================================
// 路由
// =============================================================================

export const aiGradingRoutes: FastifyPluginAsync = async (server) => {
  // ---------------------------------------------------------------------------
  // POST /ai-grading/generate — AI 出题
  // ---------------------------------------------------------------------------
  server.post('/ai-grading/generate', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = generateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { subject, chapter, questionType, difficulty, count } = parsed.data

    const systemPrompt =
      '你是资深学科命题专家。请根据学科、章节、题型、难度生成指定数量的题目。' +
      '只输出一个 JSON 数组,不要输出 markdown 代码块标记,不要输出任何额外文字。' +
      '每个题目对象格式为:' +
      '{"stem":"题干","options":[{"key":"A","text":"选项文本"}],"correctAnswer":"正确答案","analysis":"解析"}。' +
      '其中 options 仅 choice 题型需要;fill 题型 options 为空数组;correctAnswer 必须准确无歧义。'

    const userContent = [
      `学科:${subject}`,
      chapter ? `章节:${chapter}` : '章节:不限',
      `题型:${questionType}`,
      `难度:${difficulty}`,
      `题目数量:${count}`,
    ].join('\n')

    let llm
    try {
      llm = await callLlm(request, systemPrompt, userContent)
    } catch (e) {
      return reply.status(502).send(error(502, `AI 出题失败:${(e as Error).message}`))
    }

    const items = extractJsonArray(llm.content)
    const values: NewAiGeneratedQuestion[] = []
    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      const q = item as Record<string, unknown>
      const stem = String(q.stem ?? q.questionText ?? '').trim()
      if (!stem) continue
      values.push({
        subject,
        chapter: chapter ?? null,
        questionType,
        difficulty,
        questionText: stem,
        options: Array.isArray(q.options) ? (q.options as unknown) : null,
        answer: String(q.correctAnswer ?? q.answer ?? '').trim() || 'A',
        explanation: q.analysis ? String(q.analysis).trim() : null,
        prompt: systemPrompt,
        model: llm.model,
        createdBy: request.userId ?? null,
      })
    }

    if (values.length === 0) {
      return reply.status(502).send(error(502, 'AI 生成的题目无法解析,请重试'))
    }

    const inserted = await db.insert(aiGeneratedQuestion).values(values).returning()

    return reply.send(success({ list: inserted, count: inserted.length }))
  })

  // ---------------------------------------------------------------------------
  // GET /ai-grading/questions — 生成题目列表
  // ---------------------------------------------------------------------------
  server.get('/ai-grading/questions', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = questionsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, subject, chapter, questionType } = parsed.data

    const conds: SQL[] = []
    if (subject) conds.push(eq(aiGeneratedQuestion.subject, subject))
    if (chapter) conds.push(eq(aiGeneratedQuestion.chapter, chapter))
    if (questionType) conds.push(eq(aiGeneratedQuestion.questionType, questionType))
    const where = conds.length > 0 ? and(...conds) : undefined

    const [list, totalRows] = await Promise.all([
      db
        .select()
        .from(aiGeneratedQuestion)
        .where(where)
        .orderBy(desc(aiGeneratedQuestion.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiGeneratedQuestion)
        .where(where),
    ])

    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  // ---------------------------------------------------------------------------
  // DELETE /ai-grading/questions/:id — 删除生成题目
  // ---------------------------------------------------------------------------
  server.delete(
    '/ai-grading/questions/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const deleted = await db
        .delete(aiGeneratedQuestion)
        .where(eq(aiGeneratedQuestion.id, parsed.data.id))
        .returning()
      if (!deleted[0]) {
        return reply.status(404).send(error(404, '题目不存在'))
      }
      return reply.send(success({ ok: true }))
    },
  )

  // ---------------------------------------------------------------------------
  // POST /ai-grading/grade — AI 批改
  // ---------------------------------------------------------------------------
  server.post('/ai-grading/grade', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = gradeSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { questionId, studentAnswer, examId } = parsed.data

    // 先查 AI 生成题,再查正式题库,取题目详情供 LLM 评分参考
    let source: {
      stem: string
      options: unknown
      correctAnswer: string
      analysis: string
    } | null = null

    const aiRows = await db
      .select()
      .from(aiGeneratedQuestion)
      .where(eq(aiGeneratedQuestion.id, questionId))
      .limit(1)
    const aiQ = aiRows[0]
    if (aiQ) {
      source = {
        stem: String(aiQ.questionText ?? '').trim(),
        options: aiQ.options,
        correctAnswer: String(aiQ.answer ?? '').trim(),
        analysis: String(aiQ.explanation ?? '').trim(),
      }
    } else {
      const examRows = await db
        .select()
        .from(examQuestions)
        .where(eq(examQuestions.id, questionId))
        .limit(1)
      const examQ = examRows[0]
      if (examQ) {
        source = {
          stem: String(examQ.title ?? '').trim(),
          options: examQ.options,
          // jsonb 答案可能是数组/对象,String() 会得 "[object Object]",需 JSON.stringify
          correctAnswer: (typeof examQ.answer === 'string'
            ? examQ.answer
            : JSON.stringify(examQ.answer ?? '')
          ).trim(),
          analysis: String(examQ.analysis ?? '').trim(),
        }
      }
    }
    if (!source) {
      return reply.status(404).send(error(404, '题目不存在'))
    }
    const { stem, options, correctAnswer, analysis } = source

    const systemPrompt =
      '你是资深阅卷教师。请根据题目、参考答案与解析,对学生答案进行评分。' +
      '只输出一个 JSON 对象,不要输出 markdown 代码块标记,不要输出任何额外文字。' +
      '格式:{"aiScore":0到100的整数,"aiFeedback":"评语,含优点/不足/改进建议","rubric":[{"criterion":"评分维度","weight":权重数值}]}。' +
      '评分标准:完全正确接近满分;部分正确按比例给分;答案与题目无关给低分并说明。'

    const userContent = JSON.stringify({ stem, options, correctAnswer, analysis, studentAnswer })

    let llm
    try {
      llm = await callLlm(request, systemPrompt, userContent)
    } catch (e) {
      return reply.status(502).send(error(502, `AI 批改失败:${(e as Error).message}`))
    }

    const obj = extractJsonObject(llm.content)
    if (!obj) {
      return reply.status(502).send(error(502, 'AI 批改结果解析失败,请重试'))
    }
    let aiScore = Number(obj.aiScore)
    if (!Number.isFinite(aiScore)) aiScore = 0
    aiScore = Math.max(0, Math.min(100, Math.round(aiScore)))
    const aiFeedback = String(obj.aiFeedback ?? obj.feedback ?? '').trim()
    if (!aiFeedback) {
      return reply.status(502).send(error(502, 'AI 批改反馈为空,请重试'))
    }
    const rubric = Array.isArray(obj.rubric) ? (obj.rubric as unknown) : null

    const record = await db
      .insert(aiGradingRecord)
      .values({
        studentId: request.userId!,
        questionId,
        examId: examId ?? null,
        studentAnswer,
        aiScore,
        aiFeedback,
        rubric,
        model: llm.model,
        status: 'pending',
      })
      .returning()

    return reply.send(success({ record: record[0] }))
  })

  // ---------------------------------------------------------------------------
  // GET /ai-grading/records — 批改记录列表(JOIN 题干)
  // ---------------------------------------------------------------------------
  server.get('/ai-grading/records', { preHandler: requireAuth }, async (request, reply) => {
    const parsed = recordsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, status } = parsed.data

    const conds: SQL[] = []
    if (status) conds.push(eq(aiGradingRecord.status, status))
    const where = conds.length > 0 ? and(...conds) : undefined

    const joinQuestion = sql`COALESCE(${aiGeneratedQuestion.questionText}, ${examQuestions.title}, '')`
    const [list, totalRows] = await Promise.all([
      db
        .select({
          id: aiGradingRecord.id,
          studentId: aiGradingRecord.studentId,
          questionId: aiGradingRecord.questionId,
          examId: aiGradingRecord.examId,
          studentAnswer: aiGradingRecord.studentAnswer,
          aiScore: aiGradingRecord.aiScore,
          aiFeedback: aiGradingRecord.aiFeedback,
          rubric: aiGradingRecord.rubric,
          model: aiGradingRecord.model,
          status: aiGradingRecord.status,
          teacherReview: aiGradingRecord.teacherReview,
          createdAt: aiGradingRecord.createdAt,
          updatedAt: aiGradingRecord.updatedAt,
          questionTitle: joinQuestion,
        })
        .from(aiGradingRecord)
        .leftJoin(examQuestions, eq(aiGradingRecord.questionId, examQuestions.id))
        .leftJoin(aiGeneratedQuestion, eq(aiGradingRecord.questionId, aiGeneratedQuestion.id))
        .where(where)
        .orderBy(desc(aiGradingRecord.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiGradingRecord)
        .leftJoin(examQuestions, eq(aiGradingRecord.questionId, examQuestions.id))
        .leftJoin(aiGeneratedQuestion, eq(aiGradingRecord.questionId, aiGeneratedQuestion.id))
        .where(where),
    ])

    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  // ---------------------------------------------------------------------------
  // POST /ai-grading/records/:id/review — 教师复核
  // ---------------------------------------------------------------------------
  server.post(
    '/ai-grading/records/:id/review',
    { preHandler: requireAuth },
    async (request, reply) => {
      const idParsed = idParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const bodyParsed = reviewSchema.safeParse(request.body)
      if (!bodyParsed.success) {
        return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const updated = await db
        .update(aiGradingRecord)
        .set({
          teacherReview: bodyParsed.data.teacherReview,
          status: bodyParsed.data.status,
          updatedAt: new Date(),
        })
        .where(eq(aiGradingRecord.id, idParsed.data.id))
        .returning()
      if (!updated[0]) {
        return reply.status(404).send(error(404, '批改记录不存在'))
      }
      return reply.send(success({ record: updated[0] }))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
