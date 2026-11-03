// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { UUID_STRING_RE } from '../utils/uuid.js'
import { authenticate } from '../plugins/auth.js'
import {
  VOICE_NOTE_MAX_PAGE_SIZE,
  createVoiceNote,
  deleteVoiceNotes,
  listVoiceNotes,
  setVoiceNoteArchived,
  updateVoiceNote,
} from '../db/voice-note-queries.js'
import { buildResponseSchema } from '../utils/api-schemas.js'
import { error, success } from '../utils/response.js'

/**
 * 会话内快捷笔记(D43/G-51 第②格)。前缀 /api/voice-notes(注册方见 routes/index.ts)。
 *
 * 鉴权面纪律(§5):整棵子树 preHandler 强制登录,不用任何参数正则当公开面;
 * 归属一律取令牌主体 request.userId,**不接受客户端自报 userId**(§5「认证不等于授权」)。
 * 参数校验交给下方 Zod:声明 Fastify 的 querystring schema 会让校验先于鉴权执行,
 * 且默认错误体不经本路由的统一 { code, message } 序列化。
 */

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(VOICE_NOTE_MAX_PAGE_SIZE).default(50),
  partition: z.enum(['active', 'archived']).default('active'),
  groupKey: z.string().min(1).max(64).optional(),
  q: z.string().max(200).optional(),
  conversationId: z.string().regex(UUID_STRING_RE).optional(),
  withGroups: z
    .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')])
    .optional(),
})

const createSchema = z.object({
  title: z.string().min(1).max(200),
  transcript: z.string().max(200_000).nullable().optional(),
  durationMs: z.coerce
    .number()
    .int()
    .min(0)
    .max(24 * 60 * 60 * 1000),
  audioUrl: z.string().max(500).nullable().optional(),
  groupKey: z.string().min(1).max(64).optional(),
  conversationId: z.string().regex(UUID_STRING_RE).nullable().optional(),
})

const updateSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    groupKey: z.string().min(1).max(64).optional(),
    transcript: z.string().max(200_000).nullable().optional(),
  })
  .strict()

const archiveSchema = z.object({ archived: z.boolean() }).strict()

const idParamSchema = z.string().regex(UUID_STRING_RE)

function badRequest(reply: FastifyReply, message: string) {
  return reply.status(400).send(error(400, message))
}

export const voiceNoteRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply
        .status(statusCode)
        .send(error(statusCode, (e as Error).message || '操作失败,请稍后重试'))
    }
  })

  // GET / - 列表(分页 + 归档分区 + 分组 + 关键词;withGroups=1 时附带分组计数)
  server.get(
    '/',
    {
      schema: {
        summary: '语音笔记列表',
        tags: ['voice-notes'],
        response: buildResponseSchema(400, 401),
      },
    },
    async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const withGroups = parsed.data.withGroups === '1' || parsed.data.withGroups === 'true'
      const result = await listVoiceNotes(request.userId!, {
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
        partition: parsed.data.partition,
        groupKey: parsed.data.groupKey,
        q: parsed.data.q,
        conversationId: parsed.data.conversationId,
        withGroups,
      })
      return reply.send(
        success({
          list: result.list,
          total: result.total,
          page: parsed.data.page,
          pageSize: parsed.data.pageSize,
          ...(result.groups ? { groups: result.groups } : {}),
        }),
      )
    },
  )

  // POST / - 新建(归属由令牌主体写入)
  server.post(
    '/',
    {
      schema: {
        summary: '新建语音笔记',
        tags: ['voice-notes'],
        response: buildResponseSchema(400, 401),
      },
    },
    async (request, reply) => {
      const parsed = createSchema.safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const created = await createVoiceNote(request.userId!, parsed.data)
      return reply.status(201).send(success(created))
    },
  )

  // PATCH /:id - 改标题/分组/正文(只作用于自己的行;命中 0 行 ⇒ 404)
  server.patch(
    '/:id',
    {
      schema: {
        summary: '更新语音笔记',
        tags: ['voice-notes'],
        response: buildResponseSchema(400, 401, 404),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      if (!idParamSchema.safeParse(id).success) return badRequest(reply, 'id 形状不合法')
      const parsed = updateSchema.safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const updated = await updateVoiceNote(request.userId!, id, parsed.data)
      if (!updated) return reply.status(404).send(error(404, '记录不存在'))
      return reply.send(success(updated))
    },
  )

  // POST /:id/archive - 归档/恢复(写时刻而不是删行,可撤销)
  server.post(
    '/:id/archive',
    {
      schema: {
        summary: '归档或恢复语音笔记',
        tags: ['voice-notes'],
        response: buildResponseSchema(400, 401, 404),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      if (!idParamSchema.safeParse(id).success) return badRequest(reply, 'id 形状不合法')
      const parsed = archiveSchema.safeParse(request.body)
      if (!parsed.success) return badRequest(reply, parsed.error.issues[0]?.message ?? '参数错误')
      const row = await setVoiceNoteArchived(request.userId!, id, parsed.data.archived)
      if (!row) return reply.status(404).send(error(404, '记录不存在'))
      return reply.send(success(row))
    },
  )

  // DELETE /:id - 硬删(与归档分家);.returning 回库确认集合,不把请求侧长度当 affected(§批量写诚实性)
  server.delete(
    '/:id',
    {
      schema: {
        summary: '删除语音笔记',
        tags: ['voice-notes'],
        response: buildResponseSchema(400, 401, 404),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      if (!idParamSchema.safeParse(id).success) return badRequest(reply, 'id 形状不合法')
      const { deletedIds } = await deleteVoiceNotes(request.userId!, [id])
      if (deletedIds.length === 0) return reply.status(404).send(error(404, '记录不存在'))
      return reply.send(success({ id: deletedIds[0] as string, deleted: true }))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
