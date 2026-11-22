// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-54(P1,越权域):`GET /api/coze/chat/history/:botId/:conversationId` 无会话归属校验。
 *
 * 立因(修前):路由只挂用户级 preHandler,handler 不使用 `request.userId`;
 * 查询层 `apps/api/src/db/coze-chat-queries.ts` 的 where 只有 `botId + conversationId`,
 * 任意登录用户按 conversationId 即可读他人会话全文。
 *
 * 现状事实:`packages/database/src/schema/coze-chat-history.ts` 只有
 * id/bot_id/conversation_id/role/content/created_at,**没有任何 user/owner 列**,
 * 也没有可关联的会话归属表 ⇒ 无法在不臆造归属的前提下按 user 过滤。
 * 因此最小安全修法是端点整体 fail-closed(404 下线),无需 DB 读取;
 * 恢复该端点必须先补 `user_id` 列迁移,再把查询改成 `AND user_id = request.userId`。
 *
 * 本文件钉:
 *   ① 未登录仍 401(父级鉴权未被移除);
 *   ② 他人 conversationId 404,且响应不含任何会话正文;
 *   ③ 本人 conversationId 同样 404(降级态,表无归属列,不按 id 猜测归属);
 *   ④ 该请求零 DB/会员查询(端点不再触碰数据层);
 *   ⑤ 旧的「无归属谓词」查询层不得回归。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// mock db:coze 历史端点不应触碰任何数据层;findMyMember 是 member-routes 唯一可达的 DB 出口。
const memberQueries = vi.hoisted(() => ({ findMyMember: vi.fn(async () => null) }))

vi.mock('../src/db/my-member-queries.js', () => memberQueries)

import memberRoutes from '../src/routes/user/member-routes.js'
import { error } from '../src/utils/response.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const HISTORY_URL = '/api/coze/chat/history/bot-1'

describe('F-54 Coze 聊天历史归属校验', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    // 复刻 routes/user/index.ts 的父级鉴权:缺登录态 401,有则注入 userId。
    app.addHook('preHandler', async (request, reply) => {
      const userId = request.headers['x-test-user']
      if (typeof userId !== 'string' || userId.length === 0) {
        return reply.status(401).send(error(401, '请先登录'))
      }
      request.userId = userId
    })
    await app.register(memberRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('未登录访问仍返回 401,端点没有绕过鉴权', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${HISTORY_URL}/conversation-of-user-b`,
    })
    expect(res.statusCode).toBe(401)
  })

  it('user-a 读 user-b 的 conversationId 返回 404 且不泄露正文', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${HISTORY_URL}/conversation-of-user-b`,
      headers: { 'x-test-user': 'user-a' },
    })
    expect(res.statusCode).toBe(404)
    const body = res.json() as { code: number; message: string; data?: unknown }
    expect(body.code).toBe(404)
    expect(body.message).toBe('接口已下线')
    expect(body).not.toHaveProperty('data')
    expect(res.body).not.toContain('他人会话机密内容')
  })

  it('user-a 读自己的 conversationId 同样 404(表无归属列,降级态)', async () => {
    const mine = await app.inject({
      method: 'GET',
      url: `${HISTORY_URL}/conversation-of-user-a`,
      headers: { 'x-test-user': 'user-a' },
    })
    expect(mine.statusCode).toBe(404)
    // 与「他人会话」响应完全一致,不泄露会话是否存在。
    expect(mine.json()).toEqual({ code: 404, message: '接口已下线' })
  })

  it('该端点不执行任何 DB/会员查询', async () => {
    await app.inject({
      method: 'GET',
      url: `${HISTORY_URL}/conversation-of-user-b`,
      headers: { 'x-test-user': 'user-a' },
    })
    expect(memberQueries.findMyMember).not.toHaveBeenCalled()
  })

  it('无归属谓词的查询层 coze-chat-queries.ts 不得回归', () => {
    expect(existsSync(resolve(HERE, '..', 'src', 'db', 'coze-chat-queries.ts'))).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
