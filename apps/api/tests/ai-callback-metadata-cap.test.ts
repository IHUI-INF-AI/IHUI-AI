// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D33 metadata 体积护栏(capMetadataObject,64KB/项)在 ai-callback 构造点上的判据。
 *
 * 背景:924e74f4 接回 8 个字段、e8ef6512/b3b6c8aa 又接回 usageDetail/fallback/
 * memoryUpdates/steerApplied 与 G-165 盖章,而护栏本身(超限降级为
 * { truncated: true, originalBytes })在全仓 **零断言** —— 一旦有人把
 * `capMetadataObject({...})` 改回 `metadata` 裸传,超大 citations/memoryUpdates
 * 会直接撑爆 chat_messages.metadata jsonb 行,而测试全绿。
 * 本文件把"降级形状 + 键保留 + 逐项不误伤"钉住。
 *
 * 全部 DB 访问经 vi.mock 注入,不连生产 PostgreSQL/Redis(§5 测试隔离铁律)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const { findConversationById, getPermission } = vi.hoisted(() => ({
  findConversationById: vi.fn(),
  getPermission: vi.fn(),
}))

vi.mock('../src/db/chat-queries.js', () => ({ findConversationById }))
vi.mock('../src/db/workspace-permission-queries.js', () => ({ getPermission }))

vi.mock('../src/config/index.js', () => ({
  config: { AI_CALLBACK_SECRET: 'test-secret' },
}))

import aiCallbackRoutes from '../src/routes/ai-callback'

/** 与 src/routes/ai-callback.ts 的 METADATA_VALUE_MAX_BYTES 同值(护栏契约常量) */
const METADATA_VALUE_MAX_BYTES = 64 * 1024

async function buildServerWithQueue() {
  const server = Fastify({ logger: false })
  const add = vi.fn(async (_name: string, _data: unknown) => ({ id: 'job-1' }))
  // 不用 server.decorate:src 侧 fastify 模块扩展把 aiCallbackQueue 声明为完整 BullMQ
  // Queue(queue.ts:87),测试替身无法实现其全部成员,强塞必撞 TS2322。Object.assign
  // 与 decorate 运行时等价(插件实例经原型链继承根实例属性),且不需要 any / 断言戏法。
  Object.assign(server, { aiCallbackQueue: { add } })
  await server.register(aiCallbackRoutes)
  await server.ready()
  return { server, add }
}

async function enqueueWith(payload: Record<string, unknown>) {
  const { server, add } = await buildServerWithQueue()
  const res = await server.inject({
    method: 'POST',
    url: '/api/ai/callback',
    headers: { 'x-internal-secret': 'test-secret' },
    payload: {
      ...payload,
      metadata: { conversationId: 'conv-1', userId: 'user-1', messageId: 'msg-1' },
    },
  })
  const call = add.mock.calls.at(-1)
  if (!call) throw new Error('aiCallbackQueue.add 未被调用,无法断言 metadata')
  const job = call[1] as { metadata: Record<string, unknown> }
  await server.close()
  return { res, metadata: job.metadata }
}

describe('ai-callback metadata 64KB 体积护栏(D33)', () => {
  beforeEach(() => {
    findConversationById.mockReset().mockResolvedValue(undefined)
    getPermission.mockReset().mockResolvedValue(undefined)
  })

  it('超限项降级为 { truncated, originalBytes } 占位:键保留、字节数如实标注', async () => {
    const memoryUpdates = ['偏好深色主题', `超大条目:${'x'.repeat(METADATA_VALUE_MAX_BYTES)}`]
    const { res, metadata } = await enqueueWith({ content: 'AI 回复', memoryUpdates })
    expect(res.statusCode).toBe(202)

    const originalBytes = JSON.stringify(memoryUpdates).length
    expect(originalBytes).toBeGreaterThan(METADATA_VALUE_MAX_BYTES)
    expect(metadata).toHaveProperty('memoryUpdates')
    expect(metadata.memoryUpdates).toEqual({ truncated: true, originalBytes })
  })

  it('逐项降级:同一次回调里未超限的通道原样落库,不被连带截断', async () => {
    const usageDetail = { promptTokens: 100, totalTokens: 150, model: 'm-1' }
    const fallback = {
      primary_model: 'm-a',
      backup_model: 'm-b',
      reason: `原因:${'y'.repeat(METADATA_VALUE_MAX_BYTES)}`,
    }
    const { metadata } = await enqueueWith({ content: 'AI 回复', usageDetail, fallback })

    expect(metadata.fallback).toEqual({
      truncated: true,
      originalBytes: JSON.stringify(fallback).length,
    })
    // 同批小载荷不受影响 —— 护栏是"逐项降级",不是"整条丢弃"
    expect(metadata.usageDetail).toEqual(usageDetail)
  })

  it('临界以下原样透传(护栏不得把好数据也降级成占位)', async () => {
    const label = 'z'.repeat(1024)
    const citations = [{ source: 's1', label }]
    const { metadata } = await enqueueWith({ content: 'AI 回复', citations })
    expect(metadata.citations).toEqual(citations)
    expect(JSON.stringify(citations).length).toBeLessThan(METADATA_VALUE_MAX_BYTES)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
