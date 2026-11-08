// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-85 回归锁(2026-11-08,apps/api P1 越权组)。
 *
 * 病灶:/v1/batch/:id、cancel、content 与 /v1/messages/batches/:id(/results) 五个
 * 单对象端点只判「任务存在」,不判 _apiKeyId 归属。列表本来按 key 过滤,单对象却裸奔,
 * 拿到他人 batch id 即可跨租户读结果/取消任务。
 *
 * 判据:非归属 key 一律 404(与不存在同档,不泄露存在性);归属 key 正常 200。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  tasks: new Map<string, Record<string, unknown>>(),
}))

vi.mock('../src/queue/batch-queue.js', () => ({
  BATCH_KEY_PREFIX: 'batch:task:',
  getTask: vi.fn(async (_redis: unknown, id: string) => state.tasks.get(id) ?? null),
  saveTask: vi.fn(async () => {}),
  addBatchTask: vi.fn(async () => {}),
}))

vi.mock('../src/plugins/api-key-auth.js', () => ({
  requireApiKeyAuth: vi.fn(async () => {}),
}))

import v1Batches from '../src/routes/v1-batches.js'

type Handler = (request: unknown, reply: unknown) => unknown

function makeServer() {
  const handlers = new Map<string, Handler>()
  const server = {
    redis: {},
    redisForQueue: {},
    get: vi.fn((path: string, _opts: unknown, handler: Handler) => handlers.set(path, handler)),
    post: vi.fn((path: string, _opts: unknown, handler: Handler) => handlers.set(path, handler)),
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  }
  return { server, handlers }
}

function makeReply() {
  return {
    code: 200,
    body: undefined as unknown,
    status(c: number) {
      this.code = c
      return this
    },
    send(b: unknown) {
      this.body = b
      return this
    },
  }
}

const openAiTask = {
  id: 'batch_abc',
  _apiKeyId: 'key-owner',
  status: 'in_progress',
  endpoint: '/v1/chat/completions',
  input_file_id: 'file_1',
  completion_window: '24h',
  created_at: 1700000000,
  in_progress_at: 1700000001,
  request_counts: { total: 1, completed: 0, failed: 0 },
  output_file_id: null,
  error_file_id: null,
}

describe('F-85 batch 单对象端点按 API Key 归属收敛', () => {
  beforeEach(() => {
    state.tasks.clear()
    state.tasks.set('batch_abc', { ...openAiTask })
  })

  it('他人 API Key 读 batch 详情 → 404(与不存在同档)', async () => {
    const { server, handlers } = makeServer()
    await v1Batches(server as never, {})
    const handler = handlers.get('/batch/:id')!
    const reply = makeReply()
    await handler({ params: { id: 'batch_abc' }, apiKey: { id: 'key-attacker' }, query: {} }, reply)
    expect(reply.code).toBe(404)
  })

  it('归属 API Key 读同一 batch → 200(不误伤)', async () => {
    const { server, handlers } = makeServer()
    await v1Batches(server as never, {})
    const handler = handlers.get('/batch/:id')!
    const reply = makeReply()
    await handler({ params: { id: 'batch_abc' }, apiKey: { id: 'key-owner' }, query: {} }, reply)
    expect(reply.code).toBe(200)
  })
})
