/**
 * Newsletter 订阅路由(定价页转化率优化配套,lead capture)。
 *
 * 路径前缀:/api/newsletter(index.ts 通过 fastify.register 指定)
 *
 * 端点:
 * - POST /subscribe         公开,订阅周报(Zod 校验 + 邮箱去重)
 * - POST /unsubscribe       公开,取消订阅
 * - GET  /admin/list        需 admin,列出所有订阅者
 * - POST /admin/send        需 admin,发送邮件给所有订阅者(占位)
 *
 * 数据存储:内存 Map 暂存(后续接数据库),符合 AGENTS.md §5 幂等去重约定。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, parseOrThrow } from '../utils/response.js'

const ADMIN_ROLE_ID = 1

const subscribeSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  interests: z.array(z.string()).default([]),
  agreedPrivacy: z.boolean().refine((v) => v === true, '必须同意隐私政策'),
})

const unsubscribeSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
})

const sendSchema = z.object({
  subject: z.string().min(1),
  content: z.string().min(1),
})

interface Subscriber {
  email: string
  interests: string[]
  subscribedAt: string
}

// 内存存储(后续迁移到数据库)
const subscribers = new Map<string, Subscriber>()

const newsletterRoutes: FastifyPluginAsync = async (server) => {
  // POST /subscribe — 公开,订阅周报
  server.post('/subscribe', async (request, reply) => {
    const body = parseOrThrow(subscribeSchema, request.body)
    if (subscribers.has(body.email)) {
      return reply.send(success({ subscribed: true, deduplicated: true }))
    }
    subscribers.set(body.email, {
      email: body.email,
      interests: body.interests ?? [],
      subscribedAt: new Date().toISOString(),
    })
    return reply.send(success({ subscribed: true }))
  })

  // POST /unsubscribe — 公开,取消订阅
  server.post('/unsubscribe', async (request, reply) => {
    const body = parseOrThrow(unsubscribeSchema, request.body)
    subscribers.delete(body.email)
    return reply.send(success({ unsubscribed: true }))
  })

  // ===== Admin 路由(需管理员权限)=====
  server.register(async (adminServer) => {
    adminServer.addHook('preHandler', async (request) => {
      const payload = await authenticate(request)
      if (payload.roleId < ADMIN_ROLE_ID) {
        const err = new Error('需要管理员权限')
        ;(err as Error & { statusCode: number }).statusCode = 403
        throw err
      }
    })

    // GET /admin/list — 列出所有订阅者
    adminServer.get('/admin/list', async (_request, reply) => {
      const items = Array.from(subscribers.values())
      return reply.send(success({ items, total: items.length }))
    })

    // POST /admin/send — 发送邮件给所有订阅者(占位)
    adminServer.post('/admin/send', async (request, reply) => {
      const body = parseOrThrow(sendSchema, request.body)
      const recipientCount = subscribers.size
      // 占位:后续接入邮件服务(mail.ts / SES / SendGrid)
      request.log.info(
        { subject: body.subject, recipientCount },
        '[newsletter] send placeholder',
      )
      return reply.send(success({ sent: true, recipientCount }))
    })
  })
}

export default newsletterRoutes
