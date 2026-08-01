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
import { generateReportPDF } from '../../services/pdf-service.js'
import pptxgen from 'pptxgenjs'

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

    const aiUrl = `${config.AI_SERVICE_URL}/api/llm/complete`
    // 30s 超时:step-3.5-flash 正常 5-15s,留 2x 余量,超时则走兜底
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    try {
      const resp = await fetch(aiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          // ai-service /llm/complete 契约:OpenAI 格式 messages 数组(非 prompt 字段)
          messages: [{ role: 'user', content: prompt }],
          // step-3.5-flash:reasoning 模型,max_tokens 太小会把全部预算耗在 reasoning
          // 导致 content 为空;2500 给 reasoning 留 ~1800 + content 留 ~700 tokens(约 800 字)
          model: 'stepfun/step-3.5-flash',
          max_tokens: 2500,
          temperature: 0.7,
        }),
      })
      if (resp.ok) {
        const data = (await resp.json()) as {
          text?: string
          content?: string
          output?: string
          reasoning?: string
        }
        // 优先 content;reasoning 模型可能把建议放 reasoning 字段(content 为空时回退)
        // reasoning 是模型的真实输出(个性化建议),非模板,作为兜底比静态文本更贴合用户需求
        const content =
          data.content?.trim() ||
          data.reasoning?.trim() ||
          data.text?.trim() ||
          data.output?.trim() ||
          ''
        if (content) {
          return reply.send(success({ content }))
        }
        request.log.warn({ data }, 'AI 服务返回空 content,返回兜底建议')
      }
      const errBody = await resp.text().catch(() => '')
      request.log.warn({ status: resp.status, errBody }, 'AI 服务调用失败,返回兜底建议')
    } catch (e) {
      request.log.warn({ err: (e as Error).message }, 'AI 服务不可用,返回兜底建议')
    } finally {
      clearTimeout(timeout)
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

  // ----- 导出 AI 生涯指导报告(PDF / Word / PPT)-----
  // 结构化报告:封面(标题+生成日期+孩子信息摘要)+ AI 建议正文(四维度)+ 页脚
  const careerExportSchema = z.object({
    format: z.enum(['pdf', 'word', 'ppt']),
    school: z.string().max(200).optional().default(''),
    classLevel: z.string().max(100).optional().default(''),
    scoreRange: z.string().max(100).optional().default(''),
    languageDifficulty: z.string().max(500).optional().default(''),
    scienceCharacteristics: z.string().max(500).optional().default(''),
    learningObstacle: z.string().max(1000).optional().default(''),
    hobbies: z.string().max(1000).optional().default(''),
    target: z.string().max(1000).optional().default(''),
    content: z.string().max(10000).optional().default(''),
  })
  server.post('/ai/career-advice/export', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply
        .status(statusCode)
        .send(error(statusCode, (e as Error).message || 'Authentication required'))
    }

    const parsed = careerExportSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const input = parsed.data
    const generatedAt = new Date()
    const dateStr = generatedAt.toISOString().slice(0, 10)
    const filenameBase = `ai-career-report-${dateStr}`

    // 孩子信息摘要(封面用)
    const studentInfo = [
      `学校: ${input.school || '未提供'}`,
      `班级水平: ${input.classLevel || '未提供'}`,
      `成绩区间: ${input.scoreRange || '未提供'}`,
      `学习困难: ${input.languageDifficulty || '未提供'}`,
      `理科特点: ${input.scienceCharacteristics || '未提供'}`,
      `学习障碍: ${input.learningObstacle || '未提供'}`,
      `兴趣爱好: ${input.hobbies || '未提供'}`,
      `升学目标: ${input.target || '未提供'}`,
    ]

    // AI 建议正文按段落拆分为 sections
    const adviceText = input.content || '(未生成 AI 建议,请先在页面点击「生成生涯指导」。)'
    const adviceSections = adviceText
      .split(/\n(?=[0-9一二三四五六七八九十]+[.、])/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((block) => {
        const lineBreakIdx = block.indexOf('\n')
        return lineBreakIdx > 0 && lineBreakIdx < 30
          ? {
              heading: block.slice(0, lineBreakIdx).trim(),
              content: block.slice(lineBreakIdx + 1).trim(),
            }
          : { heading: '生涯指导建议', content: block }
      })
    const sections = [
      { heading: '学生信息', content: studentInfo.join('\n') },
      ...(adviceSections.length > 0
        ? adviceSections
        : [{ heading: '生涯指导建议', content: adviceText }]),
    ]

    if (input.format === 'pdf') {
      const pdfResult = await generateReportPDF({
        title: 'AI 生涯指导报告',
        subtitle: `生成日期: ${dateStr}`,
        sections,
        generatedAt,
      })
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`)
        .send(pdfResult.buffer)
    }

    if (input.format === 'ppt') {
      const pptx = new pptxgen()
      pptx.defineLayout({ name: 'A4', width: 10, height: 7.5 })
      pptx.layout = 'A4'
      // 封面
      const cover = pptx.addSlide()
      cover.addText('AI 生涯指导报告', {
        x: 0.5,
        y: 2.5,
        w: 9,
        h: 1,
        fontSize: 32,
        bold: true,
        align: 'center',
        color: '1a1a1a',
      })
      cover.addText(`生成日期: ${dateStr}`, {
        x: 0.5,
        y: 3.6,
        w: 9,
        h: 0.5,
        fontSize: 14,
        align: 'center',
        color: '666666',
      })
      // 内容页:每个 section 一张幻灯片
      for (const s of sections) {
        const slide = pptx.addSlide()
        slide.addText(s.heading, {
          x: 0.5,
          y: 0.3,
          w: 9,
          h: 0.6,
          fontSize: 22,
          bold: true,
          color: '1a1a1a',
        })
        slide.addText(s.content, {
          x: 0.5,
          y: 1.1,
          w: 9,
          h: 5.8,
          fontSize: 14,
          lineSpacingMultiple: 1.5,
          valign: 'top',
          color: '333333',
        })
      }
      const pptxBuffer = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer
      return reply
        .header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        )
        .header('Content-Disposition', `attachment; filename="${filenameBase}.pptx"`)
        .send(pptxBuffer)
    }

    // Word(.doc,HTML 格式,Word/WPS 可直接打开,零新依赖)
    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const htmlSections = sections
      .map(
        (s) =>
          `<h2 style="font-size:16px;margin:16px 0 8px;color:#1a1a1a;">${escapeHtml(s.heading)}</h2><p style="font-size:12px;line-height:1.8;margin:0 0 12px;white-space:pre-wrap;">${escapeHtml(s.content)}</p>`,
      )
      .join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>AI 生涯指导报告</title></head><body style="font-family:'微软雅黑','Microsoft YaHei',sans-serif;margin:40px;">
<h1 style="font-size:24px;text-align:center;color:#1a1a1a;margin:0 0 8px;">AI 生涯指导报告</h1>
<p style="font-size:12px;text-align:center;color:#666;margin:0 0 32px;">生成日期: ${dateStr}</p>
${htmlSections}
<p style="font-size:10px;color:#999;margin-top:40px;border-top:1px solid #eee;padding-top:8px;">本报告由 IHUI AI 平台生成 · ${dateStr}</p>
</body></html>`
    return reply
      .header('Content-Type', 'application/msword; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filenameBase}.doc"`)
      .send(Buffer.from(html, 'utf-8'))
  })
}

export default aiModulesRoutes
