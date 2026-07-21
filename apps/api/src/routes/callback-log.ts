/**
 * 通用回调日志路由。
 *
 * 迁移自旧架构 server/app/api/v1/callback/callback.py（CallBackLog）。
 *
 * 通用外呼回调日志：biz_type / biz_id / source 维度。
 * 提供 CRUD 端点：记录回调、列表查询、详情、删除。
 *
 * 存储说明：与 ai-vendors.ts 一致，使用进程内内存存储（Map），
 * 避免引入未在 schema 中定义的 callback_log 表迁移。
 * 如需持久化，可后续落库到独立表。
 *
 * 注册（server.ts）：server.register(callbackLogRoutes, { prefix: '/api/callback-log' })
 */

import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

// ============================================================================
// 内存存储
// ============================================================================

interface CallbackLogEntry {
  id: string
  bizType: string
  bizId: string | null
  source: string | null
  requestBody: string
  responseBody: string
  status: 0 | 1 // 0=失败 1=成功
  errorMsg: string | null
  ip: string | null
  processTimeMs: number
  createdAt: number
}

const store = new Map<string, CallbackLogEntry>()

// 2026-07-21 安全审计第十轮加固:用 CSPRNG 生成 callback log id
// 替代 Date.now() + counter(toString(36))(后者可预测,攻击者可伪造 ID 重放/覆盖日志)
function genId(): string {
  return `cbl_${Date.now().toString(36)}_${randomBytes(8).toString('hex')}`
}

function serialize(e: CallbackLogEntry, withBody = false) {
  return withBody
    ? {
        id: e.id,
        bizType: e.bizType,
        bizId: e.bizId,
        source: e.source,
        requestBody: e.requestBody,
        responseBody: e.responseBody,
        status: e.status,
        errorMsg: e.errorMsg,
        ip: e.ip,
        processTimeMs: e.processTimeMs,
        createdAt: e.createdAt,
      }
    : {
        id: e.id,
        bizType: e.bizType,
        bizId: e.bizId,
        source: e.source,
        status: e.status,
        errorMsg: e.errorMsg,
        ip: e.ip,
        processTimeMs: e.processTimeMs,
        createdAt: e.createdAt,
      }
}

/** 从请求体或查询中提取 biz_type / biz_id / source。 */
function extractMeta(request: FastifyRequest): {
  bizType: string
  bizId: string | null
  source: string | null
} {
  const query = (request.query as Record<string, string | undefined>) ?? {}
  const body = (request.body as Record<string, unknown>) ?? {}
  const bizType =
    (typeof body.biz_type === 'string' && body.biz_type) ||
    (typeof body.bizType === 'string' && body.bizType) ||
    query.biz_type ||
    query.bizType ||
    'call'
  const bizId =
    (typeof body.biz_id === 'string' && body.biz_id) ||
    (typeof body.bizId === 'string' && body.bizId) ||
    query.biz_id ||
    query.bizId ||
    null
  const source = (typeof body.source === 'string' && body.source) || query.source || null
  return { bizType, bizId, source }
}

/** 核心：记录一条回调日志。 */
function recordCallback(
  request: FastifyRequest,
  bizType: string,
  bizId: string | null,
  source: string | null,
  status: 0 | 1,
  errorMsg: string | null,
): CallbackLogEntry {
  const start = Date.now()
  const bodyStr = request.body ? JSON.stringify(request.body) : ''
  // 2026-07-21 安全审计第十轮加固:不再手工读 X-Forwarded-For
  // request.ip 已经过 trustProxy 验证,等同于真实客户端 IP(或最后可信代理 IP)
  // 手工读 X-Forwarded-For 会被攻击者伪造任意 IP 污染回调日志
  const ip = request.ip ?? null
  const entry: CallbackLogEntry = {
    id: genId(),
    bizType,
    bizId,
    source,
    requestBody: bodyStr,
    responseBody: '{"code":0,"message":"ok"}',
    status,
    errorMsg,
    ip,
    processTimeMs: Date.now() - start,
    createdAt: start,
  }
  store.set(entry.id, entry)
  return entry
}

// ============================================================================
// 路由
// ============================================================================

export const callbackLogRoutes: FastifyPluginAsync = async (server) => {
  // POST /callback-log/call — 通用回调记录（biz_type 默认 call）
  server.post('/call', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const meta = extractMeta(request)
    const entry = recordCallback(request, meta.bizType, meta.bizId, meta.source, 1, null)
    return reply.send(success({ callbackId: entry.id }))
  })

  // POST /callback-log/sms — 短信回调
  server.post('/sms', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const meta = extractMeta(request)
    const entry = recordCallback(request, 'sms', meta.bizId, 'sms', 1, null)
    return reply.send(success({ callbackId: entry.id }))
  })

  // POST /callback-log/payment — 支付回调
  server.post('/payment', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const meta = extractMeta(request)
    const entry = recordCallback(request, 'payment', meta.bizId, 'payment', 1, null)
    return reply.send(success({ callbackId: entry.id }))
  })

  // GET /callback-log/list — 回调日志列表（支持 biz_type/source/status 过滤 + 分页）
  server.get('/list', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const query = z
      .object({
        biz_type: z.string().optional(),
        source: z.string().optional(),
        status: z.string().optional(),
        page: z.string().optional(),
        limit: z.string().optional(),
      })
      .parse(request.query)
    const page = Math.max(1, Number(query.page ?? '1') || 1)
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? '20') || 20))
    const statusFilter = query.status === undefined ? undefined : Number(query.status)

    let list = Array.from(store.values())
    if (query.biz_type) list = list.filter((e) => e.bizType === query.biz_type)
    if (query.source) list = list.filter((e) => e.source === query.source)
    if (statusFilter === 0 || statusFilter === 1) {
      list = list.filter((e) => e.status === statusFilter)
    }
    list.sort((a, b) => b.createdAt - a.createdAt)

    const total = list.length
    const offset = (page - 1) * limit
    const items = list.slice(offset, offset + limit).map((e) => serialize(e))
    return reply.send(success({ items, total, page, limit }))
  })

  // GET /callback-log/:id — 回调详情（含请求/响应体）
  server.get('/:id', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { id } = z.object({ id: z.string() }).parse(request.params)
    const entry = store.get(id)
    if (!entry) {
      return reply.status(404).send(error(404, '日志不存在'))
    }
    return reply.send(success({ log: serialize(entry, true) }))
  })

  // DELETE /callback-log/:id — 删除回调日志
  server.delete('/:id', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { id } = z.object({ id: z.string() }).parse(request.params)
    if (!store.has(id)) {
      return reply.status(404).send(error(404, '日志不存在'))
    }
    store.delete(id)
    return reply.send(success({ id, deleted: true }))
  })
}
