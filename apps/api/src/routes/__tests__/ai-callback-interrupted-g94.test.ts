// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-94(2026-10-18 立):ai-callback 的中断标注通道。
 *
 * 判的是"这一步究竟落了什么",不是"端点跑没跑通":
 *  ① 上游带 interrupted + interruptReason ⇒ metadata 落 `interrupted:true` 与
 *     `interrupt_reason`(键名必须与 apps/web history-message 读的那一对逐字相同,
 *     后端自立一名 = 前端要写第二份判据);
 *  ② **非中断时两键一律缺席** —— worker 侧是浅合并,写 `interrupted:false` 会把
 *     同一轮已落库的真标注盖掉,所以"没中断"必须是"不写键"而不是"写个 false";
 *  ③ reason 缺省时不顶包成 'user_cancelled':前端按"有 reason 走专属话术、无 reason
 *     走通用话术"分支,冒充原因就是把"没采到"说成"确认过";
 *  ④ 标注形态是显式列举的白名单,非法 reason 直接 400 且**不入队**(§5)。
 * 零生产库:db 层两个出口整模块 mock,队列用内存 capture,不连 PG/Redis。
 */
import Fastify, { type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../config/index.js', () => ({
  config: { AI_CALLBACK_SECRET: 'test-callback-secret' },
}))

// 权限盖章那一支要查会话/权限表:整模块 mock,零 SQL。
const dbState = vi.hoisted(() => ({ conversations: [] as unknown[] }))
vi.mock('../chat-queries.js', () => ({
  findConversationById: vi.fn(async () => undefined),
}))
vi.mock('../workspace-permission-queries.js', () => ({
  getPermission: vi.fn(async () => null),
}))

import aiCallbackPlugin from '../ai-callback.js'

type Queued = Record<string, unknown>
let app: FastifyInstance
let queued: Queued[]

beforeEach(async () => {
  queued = []
  app = Fastify()
  app.decorate(
    'aiCallbackQueue' as never,
    {
      add: async (_name: string, data: unknown) => {
        queued.push(data as Queued)
        return { id: 'job-1' }
      },
    } as never,
  )
  await app.register(aiCallbackPlugin)
  await app.ready()
  dbState.conversations.length = 0
})

afterEach(async () => {
  await app.close()
})

function body(over: Record<string, unknown> = {}) {
  return {
    content: '这是已经到达本进程的半截回答',
    model: 'gpt-x',
    usage: { total_tokens: 10, prompt_tokens: 4, completion_tokens: 6 },
    metadata: { conversationId: 'c-1', userId: 'u-1', messageId: 'm-1' },
    ...over,
  }
}

async function post(payload: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: '/api/ai/callback',
    headers: { 'x-internal-secret': 'test-callback-secret' },
    payload,
  })
}

describe('G-94 中断标注落 metadata', () => {
  it('带 interrupted + reason ⇒ 两键按读回侧键名入 metadata', async () => {
    const res = await post(body({ interrupted: true, interruptReason: 'user_cancelled' }))
    expect(res.statusCode).toBe(202)
    expect(queued.length).toBe(1)
    const meta = queued[0]?.metadata as Record<string, unknown>
    expect(meta.interrupted).toBe(true)
    expect(meta.interrupt_reason).toBe('user_cancelled')
  })

  it('阳性对照:未标注的常规回调 ⇒ interrupted / interrupt_reason 都不得出现', async () => {
    const res = await post(body())
    expect(res.statusCode).toBe(202)
    const meta = queued[0]?.metadata as Record<string, unknown>
    // 断的是"键缺席",不是"值为 falsy" —— 写 false 会在浅合并里盖掉同轮已落库的真标注。
    expect('interrupted' in meta).toBe(false)
    expect('interrupt_reason' in meta).toBe(false)
  })

  it('只有 interrupted 而没有原因 ⇒ 标注入列、原因键缺席(不许顶包成 user_cancelled)', async () => {
    const res = await post(body({ interrupted: true }))
    expect(res.statusCode).toBe(202)
    const meta = queued[0]?.metadata as Record<string, unknown>
    expect(meta.interrupted).toBe(true)
    expect('interrupt_reason' in meta).toBe(false)
  })

  it('原因取值越界 ⇒ 400 且一条都不入队(显式列举有牙)', async () => {
    const res = await post(body({ interrupted: true, interruptReason: 'timeout' }))
    expect(res.statusCode).toBe(400)
    expect(queued.length).toBe(0)
  })

  it('interrupted 非布尔 ⇒ 400(通道不接受自报形态)', async () => {
    const res = await post(body({ interrupted: 'yes', interruptReason: 'user_cancelled' }))
    expect(res.statusCode).toBe(400)
    expect(queued.length).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
