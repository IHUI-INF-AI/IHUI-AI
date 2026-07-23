/**
 * 用户设置 /settings/*(17 个端点:通知/隐私/偏好/设备/安全日志/会话/导出/清数据/注销)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db } from '../../db/index.js'
import { users, exportTasks } from '@ihui/database'
import { isSystemAdminUser } from '../../db/queries.js'
import {
  findUserPreferences,
  upsertUserPreference,
  deleteUserPreferencesByGroup,
  deleteUserPreference,
} from '../../db/user-preferences-queries.js'
import { findSecurityLogs } from '../../db/security-logs-queries.js'
import { findActiveSessions, revokeSession } from '../../db/authorizations-queries.js'
import {
  createExportTask,
  findLatestExportTask,
  completeExportTask,
} from '../../db/export-tasks-queries.js'
import { findMyLessons } from '../../db/learn-queries.js'
import { parsePagination } from './_shared.js'

/** 内存导出内容缓存(taskId → content + 过期时间),进程重启后失效。 */
const exportContentStore = new Map<string, { content: string; expiresAt: Date }>()

const settingsRoutes: FastifyPluginAsync = async (server) => {
  server.get('/settings/notifications', async (request, reply) => {
    const { list } = await findUserPreferences(request.userId!, 'notifications')
    const settings = Object.fromEntries(list.map((r) => [r.key, r.value]))
    return reply.send(success({ settings }))
  })

  server.get('/settings/privacy', async (request, reply) => {
    const { list } = await findUserPreferences(request.userId!, 'privacy')
    const settings = Object.fromEntries(list.map((r) => [r.key, r.value]))
    return reply.send(success({ settings }))
  })

  server.get('/settings/preferences', async (request, reply) => {
    const { list } = await findUserPreferences(request.userId!, 'preferences')
    const settings = Object.fromEntries(list.map((r) => [r.key, r.value]))
    return reply.send(success({ settings }))
  })

  server.put('/settings/notifications', async (request, reply) => {
    const body = (request.body as Record<string, unknown> | null) ?? {}
    const userId = request.userId!
    await Promise.all(
      Object.entries(body).map(([key, value]) =>
        upsertUserPreference(
          userId,
          'notifications',
          key,
          value === null || value === undefined ? null : String(value),
        ),
      ),
    )
    return reply.send(success({ success: true }))
  })

  server.put('/settings/privacy', async (request, reply) => {
    const body = (request.body as Record<string, unknown> | null) ?? {}
    const userId = request.userId!
    await Promise.all(
      Object.entries(body).map(([key, value]) =>
        upsertUserPreference(
          userId,
          'privacy',
          key,
          value === null || value === undefined ? null : String(value),
        ),
      ),
    )
    return reply.send(success({ success: true }))
  })

  server.put('/settings/preferences', async (request, reply) => {
    const body = (request.body as Record<string, unknown> | null) ?? {}
    const userId = request.userId!
    await Promise.all(
      Object.entries(body).map(([key, value]) =>
        upsertUserPreference(
          userId,
          'preferences',
          key,
          value === null || value === undefined ? null : String(value),
        ),
      ),
    )
    return reply.send(success({ success: true }))
  })

  server.get('/settings/devices', async (request, reply) => {
    const { list, total } = await findUserPreferences(request.userId!, 'devices')
    return reply.send(success({ list, total }))
  })

  server.get('/settings/security-logs', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findSecurityLogs(request.userId!, q.page, q.pageSize)
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/settings/authorizations', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findActiveSessions(request.userId!, q.page, q.pageSize)
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.delete('/settings/authorizations/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const ok = await revokeSession(request.userId!, id)
    if (!ok) return reply.code(404).send({ code: 404, message: 'Session not found', data: null })
    return reply.send(success({ revoked: true }))
  })

  server.get('/settings/export', async (request, reply) => {
    const latest = await findLatestExportTask(request.userId!)
    return reply.send(
      success({
        taskId: latest?.id ?? null,
        status: latest?.status ?? null,
        url: latest?.fileUrl ?? null,
        exportedAt: latest?.completedAt?.toISOString() ?? null,
      }),
    )
  })

  server.post('/settings/export', async (request, reply) => {
    const userId = request.userId!
    const task = await createExportTask(userId, 'user_data')

    const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    const [notifPrefs, privacyPrefs, prefPrefs] = await Promise.all([
      findUserPreferences(userId, 'notifications'),
      findUserPreferences(userId, 'privacy'),
      findUserPreferences(userId, 'preferences'),
    ])
    const signups = await findMyLessons(userId, { page: 1, pageSize: 1000 })

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: userRow
        ? {
            id: userRow.id,
            nickname: userRow.nickname,
            email: userRow.email,
            phone: userRow.phone,
            avatar: userRow.avatar,
            createdAt: userRow.createdAt,
          }
        : null,
      preferences: {
        notifications: notifPrefs.list,
        privacy: privacyPrefs.list,
        preferences: prefPrefs.list,
      },
      studyRecords: signups.list.map((s) => ({
        lessonId: s.id,
        title: s.title,
        status: s.signupStatus,
        progress: s.progress,
        enrolledAt: s.signupCreatedAt,
      })),
    }
    const content = JSON.stringify(exportData, null, 2)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    exportContentStore.set(task.id, { content, expiresAt })

    const downloadUrl = `/api/settings/export/${task.id}/download`
    await completeExportTask(task.id, downloadUrl)

    return reply.send(
      success({
        url: downloadUrl,
        filename: `user-data-${userId}-${Date.now()}.json`,
        expiresAt: expiresAt.toISOString(),
        taskId: task.id,
      }),
    )
  })

  server.get('/settings/export/:taskId/download', async (request, reply) => {
    const taskId = (request.params as { taskId: string }).taskId
    const entry = exportContentStore.get(taskId)
    if (!entry) return reply.status(404).send(error(404, '导出文件不存在或已过期'))
    if (entry.expiresAt < new Date()) {
      exportContentStore.delete(taskId)
      return reply.status(410).send(error(410, '导出文件已过期'))
    }
    const [task] = await db.select().from(exportTasks).where(eq(exportTasks.id, taskId)).limit(1)
    if (!task || task.userId !== request.userId!) {
      return reply.status(403).send(error(403, '无权访问'))
    }
    reply.header('Content-Type', 'application/json')
    reply.header('Content-Disposition', `attachment; filename="user-data.json"`)
    return reply.send(entry.content)
  })

  server.post('/settings/clear-data', async (request, reply) => {
    const userId = request.userId!
    await Promise.all([
      deleteUserPreferencesByGroup(userId, 'notifications'),
      deleteUserPreferencesByGroup(userId, 'privacy'),
      deleteUserPreferencesByGroup(userId, 'devices'),
    ])
    return reply.send(success({ success: true }))
  })

  server.post('/settings/delete-account', async (request, reply) => {
    if (await isSystemAdminUser(request.userId!)) {
      return reply.status(403).send(error(403, '系统内置管理员账户不可注销'))
    }
    await db.update(users).set({ status: 0 }).where(eq(users.id, request.userId!))
    return reply.send(success({ success: true }))
  })

  server.put('/settings', async (request, reply) => {
    const userId = request.userId!
    const body = z
      .object({
        notifications: z.record(z.string(), z.unknown()).optional(),
        privacy: z.record(z.string(), z.unknown()).optional(),
        preferences: z.record(z.string(), z.unknown()).optional(),
      })
      .safeParse(request.body ?? {})
    if (!body.success) return reply.status(400).send(error(400, '参数错误'))
    const groups: Array<
      ['notifications' | 'privacy' | 'preferences', Record<string, unknown> | undefined]
    > = [
      ['notifications', body.data.notifications],
      ['privacy', body.data.privacy],
      ['preferences', body.data.preferences],
    ]
    for (const [group, obj] of groups) {
      if (!obj) continue
      await Promise.all(
        Object.entries(obj).map(([key, value]) =>
          upsertUserPreference(userId, group, key, value === null ? null : String(value)),
        ),
      )
    }
    return reply.send(success({ success: true }))
  })

  server.delete<{ Params: { deviceId: string } }>(
    '/settings/devices/:deviceId',
    async (request, reply) => {
      const { deviceId } = request.params
      if (!deviceId) return reply.status(400).send(error(400, '缺少 deviceId'))
      await deleteUserPreference(request.userId!, 'devices', deviceId)
      return reply.send(success({ success: true, deviceId, removed: true }))
    },
  )

  server.get('/settings/delete-account/status', async (request, reply) => {
    const [row] = await db
      .select({ status: users.status, updatedAt: users.updatedAt })
      .from(users)
      .where(eq(users.id, request.userId!))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '用户不存在'))
    const isScheduled = row.status === 0
    return reply.send(
      success({
        isScheduled,
        scheduledDate: isScheduled ? (row.updatedAt?.toISOString() ?? null) : null,
        canCancel: isScheduled,
      }),
    )
  })

  server.post('/settings/delete-account/cancel', async (request, reply) => {
    await db
      .update(users)
      .set({ status: 1, updatedAt: new Date() })
      .where(and(eq(users.id, request.userId!), eq(users.status, 0)))
    return reply.send(success({ success: true, cancelled: true }))
  })
}

export default settingsRoutes
