/**
 * 笔记(从 frontend-stub-other-routes.ts 拆分)。
 * POST /notes, GET /notes/public, GET/PUT/DELETE /notes/:id
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db, dbRead } from '../../db/index.js'
import { notes, users } from '@ihui/database'
import { parseIdParam } from './_shared.js'

export const notesRoutes: FastifyPluginAsync = async (server) => {
  // POST /notes - 创建笔记(mobile-rn NoteCreateScreen)
  server.post('/notes', async (request, reply) => {
    const body = z
      .object({
        title: z.string().min(1).max(200),
        content: z.string().min(1),
        courseId: z.string().max(100).optional(),
        isPublic: z.boolean().optional(),
        tags: z.array(z.string().max(50)).default([]),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [note] = await db
      .insert(notes)
      .values({
        userId: request.userId!,
        title: body.data.title,
        content: body.data.content,
        isPublic: body.data.isPublic ?? false,
        lessonId: body.data.courseId ?? null,
      })
      .returning()
    if (!note) return reply.status(500).send(error(500, '创建笔记失败'))
    return reply.status(201).send(success({ id: note.id }))
  })

  // GET /notes/public - 公开笔记列表(mobile-rn NoteListScreen)
  server.get('/notes/public', async (_request, reply) => {
    const rows = await dbRead
      .select({
        id: notes.id,
        title: notes.title,
        content: notes.content,
        createdAt: notes.createdAt,
        author: users.nickname,
      })
      .from(notes)
      .leftJoin(users, eq(users.id, notes.userId))
      .where(eq(notes.isPublic, true))
      .orderBy(desc(notes.createdAt))
      .limit(50)
    const list = rows.map((r) => ({
      id: r.id,
      title: r.title,
      summary: (r.content ?? '').slice(0, 100),
      author: r.author ?? '',
      likes: 0,
      createdAt: r.createdAt.toISOString(),
    }))
    return reply.send(success(list))
  })

  // GET /notes/:id - 笔记详情
  server.get('/notes/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [note] = await dbRead
      .select({
        id: notes.id,
        title: notes.title,
        content: notes.content,
        isPublic: notes.isPublic,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        userId: notes.userId,
        author: users.nickname,
      })
      .from(notes)
      .leftJoin(users, eq(users.id, notes.userId))
      .where(eq(notes.id, id))
      .limit(1)
    if (!note) return reply.status(404).send(error(404, '笔记不存在'))
    if (!note.isPublic && note.userId !== request.userId)
      return reply.status(403).send(error(403, '无权查看此笔记'))
    return reply.send(
      success({
        id: note.id,
        title: note.title,
        content: note.content,
        isPublic: note.isPublic,
        author: note.author ?? '',
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      }),
    )
  })

  // PUT /notes/:id - 更新笔记(仅所有者)
  server.put('/notes/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const bodySchema = z.object({
      title: z.string().min(1).max(200).optional(),
      content: z.string().min(1),
      isPublic: z.boolean().optional(),
      lessonId: z.string().optional(),
    })
    const body = bodySchema.safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await dbRead
      .select({ id: notes.id, userId: notes.userId })
      .from(notes)
      .where(eq(notes.id, id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '笔记不存在'))
    if (existing.userId !== request.userId!)
      return reply.status(403).send(error(403, '无权修改此笔记'))
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      content: body.data.content,
    }
    if (body.data.title !== undefined) updateData.title = body.data.title
    if (body.data.isPublic !== undefined) updateData.isPublic = body.data.isPublic
    if (body.data.lessonId !== undefined) updateData.lessonId = body.data.lessonId
    await db.update(notes).set(updateData).where(eq(notes.id, id))
    return reply.send(success({ updated: true }))
  })

  // DELETE /notes/:id - 删除笔记(仅所有者)
  server.delete('/notes/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [existing] = await dbRead
      .select({ id: notes.id, userId: notes.userId })
      .from(notes)
      .where(eq(notes.id, id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '笔记不存在'))
    if (existing.userId !== request.userId!)
      return reply.status(403).send(error(403, '无权删除此笔记'))
    await db.delete(notes).where(eq(notes.id, id))
    return reply.send(success({ deleted: true }))
  })
}
