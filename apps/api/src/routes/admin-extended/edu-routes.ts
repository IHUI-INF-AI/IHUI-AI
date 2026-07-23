/**
 * 教育业务路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 含:公告批量更新 / 证书模板批量更新 / 班级成员 / 课时报名重试。
 * 路径前缀:/admin/messages, /admin/certificates, /admin/edu, /admin/learn
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  eduAnnouncements,
  certificateTemplates,
  eduClassesMembers,
  lessonSignUps,
} from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../../utils/response.js'
import { idParamSchema } from './_shared.js'

/** P0-3 修复:edu_announcements 批量更新 schema。 */
const updateAnnouncementsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  patch: z
    .object({
      isPublished: z.boolean().optional(),
      isTop: z.boolean().optional(),
      sort: z.number().int().optional(),
      status: z.number().int().min(0).max(1).optional(),
    })
    .strict(),
})

/** P0-3 修复:certificate_templates 批量更新 schema。 */
const updateCertificateTemplatesSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  patch: z
    .object({
      status: z.number().int().min(0).max(1).optional(),
      awardingOrganization: z.string().max(500).optional(),
    })
    .strict(),
})

/** P0-3 修复:edu_classes_members 添加成员 schema。 */
const addClassMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['student', 'assistant', 'teacher']).default('student'),
})

export const eduRoutes: FastifyPluginAsync = async (server) => {
  server.put(
    '/admin/messages/announcements',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = parseOrThrow(updateAnnouncementsSchema, request.body)
      const updated = await db
        .update(eduAnnouncements)
        .set({ ...body.patch, updatedAt: new Date() })
        .where(inArray(eduAnnouncements.id, body.ids))
        .returning({ id: eduAnnouncements.id })
      if (updated.length === 0) {
        return reply.status(404).send(error(404, '公告不存在'))
      }
      return reply.send(success({ updated: updated.length, ids: body.ids }))
    },
  )
  server.put(
    '/admin/certificates/templates',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const body = parseOrThrow(updateCertificateTemplatesSchema, request.body)
      const updated = await db
        .update(certificateTemplates)
        .set({ ...body.patch, updatedAt: new Date() })
        .where(inArray(certificateTemplates.id, body.ids))
        .returning({ id: certificateTemplates.id })
      if (updated.length === 0) {
        return reply.status(404).send(error(404, '证书模板不存在'))
      }
      return reply.send(success({ updated: updated.length, ids: body.ids }))
    },
  )
  server.post(
    '/admin/edu/classes/:id/members',
    { preHandler: requireAdmin },
    async (request, reply) => {
      const { id: classId } = parseOrThrow(idParamSchema, request.params)
      const body = parseOrThrow(addClassMemberSchema, request.body)
      const [row] = await db
        .insert(eduClassesMembers)
        .values({ classId, userId: body.userId, role: body.role })
        .returning()
      if (!row) {
        return reply.status(500).send(error(500, '添加成员失败'))
      }
      return reply.status(201).send(success({ created: true, id: row.id }))
    },
  )
  server.delete(
    '/admin/edu/classes/:id/members/:id',
    { preHandler: requireAdmin },
    async (request, reply) => {
      // Fastify 路径中两个同名 :id,request.params.id 指向最后一个(memberId uuid)
      const memberId = parseOrThrow(z.object({ id: z.string().uuid() }), request.params).id
      const [row] = await db
        .delete(eduClassesMembers)
        .where(eq(eduClassesMembers.id, memberId))
        .returning({ id: eduClassesMembers.id })
      if (!row) {
        return reply.status(404).send(error(404, '成员不存在'))
      }
      return reply.send(success({ deleted: true, id: row.id }))
    },
  )
  server.post(
    '/admin/learn/signup-batchlesson/:id/retry',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const [row] = await db
        .update(lessonSignUps)
        .set({ status: 1 })
        .where(eq(lessonSignUps.id, id))
        .returning()
      if (!row) return reply.status(404).send(error(404, '报名记录不存在'))
      return reply.send(success(row))
    },
  )
}
