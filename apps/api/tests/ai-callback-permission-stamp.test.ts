// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-165「助手消息权限档盖章」的**路由集成面**判据。
 *
 * 为什么单独成文:`tests/message-permission-stamp.test.ts` 只钉住 permissionStamp 这个
 * 纯函数(拼写归一 / 认不出不写 key / arity=1),而历史上真正断掉的是**下一跳** ——
 * 50770d5 把算好的 `permissionMeta` 用 `void permissionMeta` 挂起(0a44dca 原本把它
 * spread 进 metadata),链路"算出来不用",web 读回侧
 * (apps/web/src/hooks/use-chat/history-message.ts 读 meta.permissionMode) 恒空。
 * 纯函数测试对这种回退完全无感,故本文件把"算出来 → 并入入队 payload"钉死。
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

/** 入队 payload 中本判据关心的部分(其余字段由既有测试覆盖,此处不做严格等于) */
interface EnqueuedJob {
  conversationId: string
  userId: string
  metadata: Record<string, unknown>
}

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

/** 入队 mock(类型直接从 buildServerWithQueue 派生,不写 any / 不复制签名) */
type EnqueueAdd = Awaited<ReturnType<typeof buildServerWithQueue>>['add']

/** 取最近一次入队的 metadata(未入队则直接失败,避免断言打在 undefined 上假绿) */
function lastMetadata(add: EnqueueAdd): EnqueuedJob {
  const call = add.mock.calls.at(-1)
  if (!call) throw new Error('aiCallbackQueue.add 未被调用,无法断言 metadata')
  return call[1] as EnqueuedJob
}

describe('ai-callback G-165 权限档盖章并入 metadata', () => {
  beforeEach(() => {
    findConversationById.mockReset()
    getPermission.mockReset()
    // 默认:会话未绑定工作区(与"未查库"等价的不写 key 语义),用例各自覆盖
    findConversationById.mockResolvedValue(undefined)
    getPermission.mockResolvedValue(undefined)
  })

  it('会话绑定工作区且档位可识别时,章随 metadata 下发并与其他元数据共存', async () => {
    findConversationById.mockResolvedValue({ metadata: { workspacePath: '/ws/demo' } })
    getPermission.mockResolvedValue({ mode: 'acceptEdits' })
    const { server, add } = await buildServerWithQueue()

    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
      payload: {
        content: 'AI 回复',
        model: 'stepfun/step-3.7-flash',
        usage: { total_tokens: 50 },
        stub: false,
        toolCalls: [{ id: 'tc-1', toolName: 'read_file', status: 'success' }],
        metadata: { conversationId: 'conv-1', userId: 'user-1', messageId: 'msg-1' },
      },
    })
    expect(res.statusCode).toBe(202)

    const job = lastMetadata(add)
    // 档位一律以 wire 拼写落库(camelCase 输入 → kebab wire),与前端词表同源
    expect(job.metadata).toMatchObject({ permissionMode: 'accept-edits' })
    // 盖章不得把同批过程性元数据挤掉(worker 侧浅合并,共存才有回放价值)
    expect(job.metadata).toMatchObject({
      model: 'stepfun/step-3.7-flash',
      toolCalls: [{ id: 'tc-1', toolName: 'read_file' }],
    })
    // 取值链路必须是服务端自取:会话 → workspacePath → workspace_permissions
    expect(findConversationById).toHaveBeenCalledWith('conv-1')
    expect(getPermission).toHaveBeenCalledWith('user-1', '/ws/demo')

    await server.close()
  })

  it('历史 kebab 拼写同样归一为 wire 值(单一真相源,不产生第二套拼写)', async () => {
    findConversationById.mockResolvedValue({ metadata: { workspacePath: '/ws/demo' } })
    getPermission.mockResolvedValue({ mode: 'bypass-permissions' })
    const { server, add } = await buildServerWithQueue()

    await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
      payload: {
        content: 'AI 回复',
        metadata: { conversationId: 'conv-1', userId: 'user-1' },
      },
    })
    expect(lastMetadata(add).metadata).toMatchObject({ permissionMode: 'bypass-permissions' })

    await server.close()
  })

  it('会话未绑定工作区时不查权限表、不写 permissionMode key', async () => {
    findConversationById.mockResolvedValue({ metadata: { workspacePath: '   ' } })
    const { server, add } = await buildServerWithQueue()

    await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
      payload: {
        content: 'AI 回复',
        stub: false,
        metadata: { conversationId: 'conv-1', userId: 'user-1' },
      },
    })
    expect(getPermission).not.toHaveBeenCalled()
    const meta = lastMetadata(add).metadata
    // "未绑定" ≠ "default 档":写默认值等于把不知道伪装成知道(G-165③)
    expect(meta).not.toHaveProperty('permissionMode')
    expect(meta).toHaveProperty('stub', false)

    await server.close()
  })

  it('workspace_permissions 无记录时不写 key(不回退用户全局默认档)', async () => {
    findConversationById.mockResolvedValue({ metadata: { workspacePath: '/ws/demo' } })
    getPermission.mockResolvedValue(undefined)
    const { server, add } = await buildServerWithQueue()

    await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
      payload: {
        content: 'AI 回复',
        metadata: { conversationId: 'conv-1', userId: 'user-1' },
      },
    })
    expect(getPermission).toHaveBeenCalledWith('user-1', '/ws/demo')
    expect(lastMetadata(add).metadata).not.toHaveProperty('permissionMode')

    await server.close()
  })

  it('档位认不出时不写 key,绝不静默降级成 default', async () => {
    findConversationById.mockResolvedValue({ metadata: { workspacePath: '/ws/demo' } })
    getPermission.mockResolvedValue({ mode: 'yolo-mode' })
    const { server, add } = await buildServerWithQueue()

    await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
      payload: {
        content: 'AI 回复',
        metadata: { conversationId: 'conv-1', userId: 'user-1' },
      },
    })
    expect(lastMetadata(add).metadata).not.toHaveProperty('permissionMode')

    await server.close()
  })

  it('反查档位抛错只降级盖章,不阻断消息落库(202 + 其余 metadata 完整)', async () => {
    findConversationById.mockRejectedValue(new Error('connection reset'))
    const { server, add } = await buildServerWithQueue()

    const res = await server.inject({
      method: 'POST',
      url: '/api/ai/callback',
      headers: { 'x-internal-secret': 'test-secret' },
      payload: {
        content: 'AI 回复',
        model: 'm-1',
        usage: { total_tokens: 7 },
        citations: [{ source: 's1', label: 'L1' }],
        metadata: { conversationId: 'conv-1', userId: 'user-1' },
      },
    })
    expect(res.statusCode).toBe(202)
    expect(res.json().data.queued).toBe(true)
    const meta = lastMetadata(add).metadata
    expect(meta).not.toHaveProperty('permissionMode')
    expect(meta).toMatchObject({ model: 'm-1', citations: [{ source: 's1', label: 'L1' }] })

    await server.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
