/**
 * IDOR（Insecure Direct Object Reference）不安全直接对象引用防护。
 *
 * 检查用户是否有权访问指定资源，防止通过修改 URL 中的 ID 访问他人数据。
 * 提供独立函数 checkOwnership 与 Fastify preHandler hook。
 */

import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  eduOrders,
  eduPayments,
  eduRefunds,
  eduInvoiceTitles,
  eduInvoiceApplications,
  files,
  projects,
} from '@ihui/database'

/** 已注册的资源类型。 */
export type RegisteredResourceType =
  'order' | 'payment' | 'refund' | 'invoice-title' | 'invoice-application' | 'file' | 'project'

/**
 * 检查用户是否拥有指定资源的所有权。
 * @returns true 表示用户是该资源的 owner；false 表示无权或资源不存在
 */
export async function checkOwnership(
  userId: string,
  resourceType: string,
  resourceId: string,
): Promise<boolean> {
  switch (resourceType) {
    case 'order': {
      const rows = await db
        .select({ id: eduOrders.id })
        .from(eduOrders)
        .where(and(eq(eduOrders.id, resourceId), eq(eduOrders.userId, userId)))
        .limit(1)
      return rows.length > 0
    }
    case 'payment': {
      const rows = await db
        .select({ id: eduPayments.id })
        .from(eduPayments)
        .where(and(eq(eduPayments.id, resourceId), eq(eduPayments.userId, userId)))
        .limit(1)
      return rows.length > 0
    }
    case 'refund': {
      const rows = await db
        .select({ id: eduRefunds.id })
        .from(eduRefunds)
        .where(and(eq(eduRefunds.id, resourceId), eq(eduRefunds.userId, userId)))
        .limit(1)
      return rows.length > 0
    }
    case 'invoice-title': {
      const rows = await db
        .select({ id: eduInvoiceTitles.id })
        .from(eduInvoiceTitles)
        .where(and(eq(eduInvoiceTitles.id, resourceId), eq(eduInvoiceTitles.userId, userId)))
        .limit(1)
      return rows.length > 0
    }
    case 'invoice-application': {
      const rows = await db
        .select({ id: eduInvoiceApplications.id })
        .from(eduInvoiceApplications)
        .where(
          and(eq(eduInvoiceApplications.id, resourceId), eq(eduInvoiceApplications.userId, userId)),
        )
        .limit(1)
      return rows.length > 0
    }
    case 'file': {
      const rows = await db
        .select({ id: files.id })
        .from(files)
        .where(and(eq(files.id, resourceId), eq(files.uploadedBy, userId)))
        .limit(1)
      return rows.length > 0
    }
    case 'project': {
      const rows = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, resourceId), eq(projects.userId, userId)))
        .limit(1)
      return rows.length > 0
    }
    default:
      // 未注册的资源类型：默认拒绝，避免静默放行
      return false
  }
}

/**
 * Fastify preHandler hook 工厂。
 * 从 request.params.id 读取 resourceId，校验所有权；失败返回 403。
 *
 * 用法：
 *   server.get('/orders/:id', { preHandler: [idorGuard('order')] }, handler)
 *
 * @param resourceType 资源类型（必须已注册）
 * @param options.idParam 资源 ID 参数名，默认 'id'
 * @param options.allowAdmin 管理员是否绕过校验，默认 true
 */
export function idorGuard(
  resourceType: RegisteredResourceType,
  options: {
    idParam?: string
    allowAdmin?: boolean
  } = {},
): preHandlerHookHandler {
  const { idParam = 'id', allowAdmin = true } = options
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const params = (request.params ?? {}) as Record<string, string | undefined>
    const resourceId = params[idParam]
    if (!resourceId) {
      return reply.status(400).send({ code: 400, message: '缺少资源 ID' })
    }
    const userId = request.userId
    if (!userId) {
      return reply.status(401).send({ code: 401, message: '未登录' })
    }
    // 管理员可绕过
    if (allowAdmin) {
      const roleId = request.jwtPayload?.roleId ?? 0
      if (roleId >= 1) return
    }
    const owned = await checkOwnership(userId, resourceType, resourceId)
    if (!owned) {
      return reply.status(403).send({ code: 403, message: '无权访问该资源' })
    }
  }
}
