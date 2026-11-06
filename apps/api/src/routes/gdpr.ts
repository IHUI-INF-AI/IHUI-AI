// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { eq, inArray } from 'drizzle-orm'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { db } from '../db/index.js'
import {
  chatConversations,
  chatMessages,
  notes,
  userAddresses,
  userMemories,
  eduOrders,
} from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { findUserById } from '../db/queries.js'
import { purgeUserPii } from '../services/purge-user-pii.js'
import {
  findSearchHistory,
  findAuditLogs,
  addAuditLog,
  clearSearchHistory,
} from '../db/search-queries.js'
import { success, error } from '../utils/response.js'

/**
 * 收集用户在可携带权 / 导出中应覆盖的核心数据（按 userId 读取）。
 * 增补:收货地址、笔记、用户记忆、AI 会话及其消息、教育订单。
 */
async function collectPortableData(userId: string) {
  const [addresses, notesList, memories, orders] = await Promise.all([
    db.select().from(userAddresses).where(eq(userAddresses.userId, userId)),
    db.select().from(notes).where(eq(notes.userId, userId)),
    db.select().from(userMemories).where(eq(userMemories.userId, userId)),
    db.select().from(eduOrders).where(eq(eduOrders.userId, userId)),
  ])
  const conversations = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.userId, userId))
  const conversationIds = conversations.map((c) => c.id)
  const messages =
    conversationIds.length > 0
      ? await db
          .select()
          .from(chatMessages)
          .where(inArray(chatMessages.conversationId, conversationIds))
      : []
  return {
    addresses,
    notes: notesList,
    memories,
    chat: {
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
      })),
      messageCount: messages.length,
    },
    orders,
  }
}

/**
 * GDPR 数据擦除路由。
 *
 * - POST /api/gdpr/export        导出当前用户所有数据（用户档案 + 搜索历史 + 审计日志）
 * - POST /api/gdpr/erase         擦除用户数据（软删除 status=3 + PII 匿名化 + 吊销 refresh token）
 * - POST /api/gdpr/portability   数据可携带性导出（结构化 JSON，机器可读）
 *
 * 所有端点均需登录（authenticate）。
 */
export const gdprRoutes: FastifyPluginAsync = async (server) => {
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply): Promise<boolean> => {
    try {
      await authenticate(request)
      return true
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || '操作失败,请稍后重试'
      reply.status(statusCode).send(error(statusCode, message))
      return false
    }
  }

  // POST /export - 导出用户所有数据
  server.post('/export', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const userId = request.userId!
    // 数据主体访问自身完整 PII，跳过响应脱敏
    request.skipResponseSanitization = true

    const [user, searchHistory, auditLogs, portableData] = await Promise.all([
      findUserById(userId),
      findSearchHistory(userId, 500),
      findAuditLogs(1, 500, { userId }),
      collectPortableData(userId),
    ])

    if (!user) {
      return reply.status(404).send(error(404, '用户不存在'))
    }

    await addAuditLog({
      userId,
      action: 'GDPR_EXPORT',
      resourceType: 'gdpr',
      resourceId: userId,
      details: {
        searchHistoryCount: searchHistory.length,
        auditLogCount: auditLogs.total,
        chatCount: portableData.chat.conversations.length,
      },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    })

    return reply.send(
      success({
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
          username: user.username,
          nickname: user.nickname,
          avatar: user.avatar,
          bio: user.bio,
          gender: user.gender,
          birthday: user.birthday,
          status: user.status,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        searchHistory: searchHistory.map((h) => ({
          id: h.id,
          query: h.query,
          resultsCount: h.resultsCount,
          createdAt: h.createdAt,
        })),
        auditLogs: auditLogs.list.map((a) => ({
          id: a.id,
          action: a.action,
          resourceType: a.resourceType,
          resourceId: a.resourceId,
          createdAt: a.createdAt,
        })),
        // 可携数据扩充（保持既有字段不变，仅新增）
        addresses: portableData.addresses,
        notes: portableData.notes,
        memories: portableData.memories,
        chat: portableData.chat,
        orders: portableData.orders,
      }),
    )
  })

  // POST /erase - 擦除用户数据（软删除 + 匿名化）
  server.post('/erase', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const userId = request.userId!

    const user = await findUserById(userId)
    if (!user) {
      return reply.status(404).send(error(404, '用户不存在'))
    }
    if (user.status === 3) {
      return reply.status(400).send(error(400, '账户已注销'))
    }

    // T-6(P1,合规):擦除必须做到「要么确认删干净,要么明确告知没删干净」。
    // 旧实现把 clearSearchHistory 的失败吞掉后仍回 erased:true —— 对外承诺已完全擦除,
    // 实际可能仍留有检索记录,属于合规事故。以下逐步收集失败,不允许任何一步静默。
    const failedSteps: string[] = []
    let piiPurged = true

    // 1. 统一 PII 清除：遍历删除 PII 子表 + 彻底匿名化 users 主行(status=3) + 吊销 refresh token
    //    （含 user_auth_info / addresses / devices / chat / memory / notes / oauth / preferences / passkeys 等，幂等）
    try {
      await purgeUserPii(userId)
    } catch (e) {
      piiPurged = false
      failedSteps.push('pii')
      request.log.error({ err: e, userId, step: 'purgeUserPii' }, 'GDPR erase: PII 清除失败')
    }

    // 2. 清理搜索历史（失败必须计入 failedSteps,不得 catch 后当成功）
    try {
      await clearSearchHistory(userId)
    } catch (e) {
      failedSteps.push('searchHistory')
      request.log.error(
        { err: e, userId, step: 'clearSearchHistory' },
        'GDPR erase: 搜索历史清理失败',
      )
    }

    const partial = failedSteps.length > 0
    // 审计必须记录真实结果:未删干净时不得写 anonymized:true/status:3
    try {
      await addAuditLog({
        userId,
        action: 'GDPR_ERASE',
        resourceType: 'gdpr',
        resourceId: userId,
        details: {
          anonymized: piiPurged,
          status: piiPurged ? 3 : null,
          outcome: partial ? (piiPurged ? 'partial' : 'failed') : 'completed',
          failedSteps,
        },
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      })
    } catch (e) {
      request.log.error({ err: e, userId }, 'GDPR erase: 审计日志写入失败')
    }

    if (!piiPurged) {
      // 主行未匿名化 ⇒ 不能回 200;让调用方重试,避免把「失败」误报成「已擦除」
      return reply.status(500).send(error(500, '数据擦除未完成,请稍后重试'))
    }
    return reply.send(success({ erased: !partial, partial, userId, failedSteps }))
  })

  // POST /portability - 数据可携带性导出（结构化 JSON）
  server.post('/portability', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const userId = request.userId!
    // 数据主体访问自身完整 PII，跳过响应脱敏
    request.skipResponseSanitization = true

    const [user, searchHistory, auditLogs, portableData] = await Promise.all([
      findUserById(userId),
      findSearchHistory(userId, 1000),
      findAuditLogs(1, 1000, { userId }),
      collectPortableData(userId),
    ])

    if (!user) {
      return reply.status(404).send(error(404, '用户不存在'))
    }

    // 机器可读的结构化导出（符合 GDPR 可携带性要求）
    const portable = {
      schema: 'ihui-gdpr-portability/v1',
      exportedAt: new Date().toISOString(),
      subject: {
        id: user.id,
        identifier: user.phone ?? user.email ?? user.username,
      },
      data: {
        profile: {
          username: user.username,
          nickname: user.nickname,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar,
          bio: user.bio,
          gender: user.gender,
          birthday: user.birthday,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        searchHistory: searchHistory.map((h) => ({
          query: h.query,
          resultsCount: h.resultsCount,
          createdAt: h.createdAt,
        })),
        auditTrail: auditLogs.list.map((a) => ({
          action: a.action,
          resourceType: a.resourceType,
          resourceId: a.resourceId,
          createdAt: a.createdAt,
        })),
        // 可携数据扩充（保持既有结构不变，仅新增字段）
        addresses: portableData.addresses,
        notes: portableData.notes,
        memories: portableData.memories,
        chat: portableData.chat,
        orders: portableData.orders,
      },
    }

    reply.header('content-type', 'application/json; charset=utf-8')
    reply.header('content-disposition', `attachment; filename="gdpr-portability-${userId}.json"`)

    return reply.send(success(portable))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
