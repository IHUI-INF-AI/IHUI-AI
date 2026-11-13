// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-475 回归锁(2026-11-13)。
 *
 * 病灶:chat 历史进程内表只增不删,model_name 无长度上限 ⇒ 内存单调增长,
 * 单条可塞超长/控制字符字符串,可作内存 DoS 与畸形回显。
 *
 * 本文件锁:
 *   ① 超长(>128)与含控制字符的 model_name 一律 400,不落表;
 *   ② 同一用户超过 MAX_HISTORY_PER_USER 后淘汰最旧记录,total 不超上限;
 *   ③ 淘汰后新写入仍可正常读回;
 *   ④ 合法请求行为不变(201 + trim + 既有字段/分页形状)。
 *
 * 只 mock checkAuth 与 db 模块,不触达真实 PG / Redis / 上游。
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'f475-user'
    return true
  }),
}))

vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {}, dbClient: {} }))

import { chatModelRoutes, MAX_HISTORY_PER_USER } from '../src/routes/chat-models.js'

const AUTH = { authorization: 'Bearer f475-token' }

interface HistoryItem {
  id: number
  user_uuid: string
  model_name: string
  mark: string | null
  create_time: string
}

interface QueryBody {
  code: number
  data: { list: HistoryItem[]; total: number; page: number; pageSize: number }
}

describe('F-475 chat 历史容量与 model_name 校验', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(chatModelRoutes, { prefix: '/api/chat' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  async function create(body: Record<string, unknown>) {
    return app.inject({
      method: 'POST',
      url: '/api/chat/history/create',
      headers: AUTH,
      payload: body,
    })
  }

  async function query(modelName?: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat/history/query',
      headers: AUTH,
      payload: { limit: 100, ...(modelName ? { model_name: modelName } : {}) },
    })
    expect(res.statusCode).toBe(200)
    return res.json() as QueryBody
  }

  it('① 超长 / 控制字符 model_name 返回 400', async () => {
    const tooLong = await create({ model_name: 'a'.repeat(129) })
    expect(tooLong.statusCode).toBe(400)

    const withCtrl = await create({ model_name: 'deepseek\u0000chat' })
    expect(withCtrl.statusCode).toBe(400)

    const blank = await create({ model_name: '   ' })
    expect(blank.statusCode).toBe(400)

    // 恰好 128 字符仍合法
    const atLimit = await create({ model_name: 'b'.repeat(128) })
    expect(atLimit.statusCode).toBe(201)
  })

  it('④ 合法请求行为不变:201 + trim + 既有字段', async () => {
    const res = await create({ model_name: '  deepseek-chat  ', mark: '标签' })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { code: number; data: HistoryItem }
    expect(body.code).toBe(0)
    expect(body.data.model_name).toBe('deepseek-chat')
    expect(body.data.mark).toBe('标签')
    expect(body.data.user_uuid).toBe('f475-user')
    expect(typeof body.data.id).toBe('number')
    expect(Number.isNaN(Date.parse(body.data.create_time))).toBe(false)

    const list = await query('deepseek-chat')
    expect(list.data.total).toBe(1)
    expect(list.data.list[0]?.id).toBe(body.data.id)
    expect(list.data.list[0]?.model_name).toBe('deepseek-chat')
  })

  it('② 超过单用户上限后淘汰最旧记录且 total 不超上限', async () => {
    const created: number[] = []
    for (let i = 0; i < MAX_HISTORY_PER_USER + 5; i += 1) {
      const res = await create({ model_name: `cap-model-${i}` })
      expect(res.statusCode).toBe(201)
      created.push((res.json() as { data: HistoryItem }).data.id)
    }

    const list = await query()
    expect(list.data.total).toBe(MAX_HISTORY_PER_USER)
    expect(list.data.list).toHaveLength(MAX_HISTORY_PER_USER)

    const kept = new Set(list.data.list.map((r) => r.id))
    // 最旧 5 条已被淘汰,最新的必须留存
    for (const id of created.slice(0, 5)) expect(kept.has(id)).toBe(false)
    expect(kept.has(created[created.length - 1]!)).toBe(true)
  })

  it('③ 淘汰后新写入仍可读回', async () => {
    const res = await create({ model_name: 'after-evict' })
    expect(res.statusCode).toBe(201)
    const newId = (res.json() as { data: HistoryItem }).data.id

    const list = await query('after-evict')
    expect(list.data.total).toBe(1)
    expect(list.data.list[0]?.id).toBe(newId)

    const all = await query()
    expect(all.data.total).toBe(MAX_HISTORY_PER_USER)
  })
})
