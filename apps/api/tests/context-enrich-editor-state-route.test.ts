// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * editor_state 上报腿 —— api 路由层断言(2026-11-01 立)。
 *
 * 判 POST /api/context/enrich 的 zod 白名单接住 editorState(activeFile /
 * cursorLine / selection,web 侧 camelCase 形态)并逐字段原样交给
 * contextEngineService.enrich;服务层整模块 mock,不触库不发 HTTP。
 * 与 context-enrich-editor-state-service.test.ts(服务层→ai-service snake_case
 * 映射)合起来钉住「web 入参 → api 转发体 → ai-service 请求体 逐字段不丢」
 * 全链路的 api 两段。
 */
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockAuthenticate, mockEnrich } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockEnrich: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({ authenticate: mockAuthenticate }))
vi.mock('../src/services/context-engine-service.js', () => ({
  contextEngineService: {
    enrich: mockEnrich,
    search: vi.fn(),
    searchDatabaseTables: vi.fn(),
    getTableSchema: vi.fn(),
    searchSymbols: vi.fn(),
    searchFolders: vi.fn(),
    getSources: vi.fn(),
    updateSources: vi.fn(),
    trackVisualization: vi.fn(),
    getVisualization: vi.fn(),
    getCompressionStats: vi.fn(),
    getSessionMemory: vi.fn(),
    clearSessionMemory: vi.fn(),
  },
}))

import { contextMentionRoutes } from '../src/routes/context-mentions.js'

let app: FastifyInstance

beforeAll(async () => {
  // 鉴权桩:authenticate 成功即挂 request.userId(与真实插件对 request 的挂载一致)
  mockAuthenticate.mockImplementation(async (request: { userId?: string }) => {
    request.userId = 'u1'
  })
  mockEnrich.mockResolvedValue({
    enrichedContext: '',
    tokenCount: 0,
    sources: [],
    conversationId: 'c1',
  })
  app = Fastify()
  await app.register(contextMentionRoutes, { prefix: '/api/context' })
  await app.ready()
})

afterAll(async () => {
  await app?.close()
})

async function postEnrich(payload: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: '/api/context/enrich',
    payload,
  })
}

describe('POST /api/context/enrich → editorState 透传', () => {
  it('editorState 三字段原样(camelCase)进入服务层入参,一字段不丢', async () => {
    const res = await postEnrich({
      userMessage: 'q',
      conversationId: 'c1',
      mentions: [],
      editorState: {
        activeFile: 'apps/web/src/components/editor/CodeEditor.tsx',
        cursorLine: 780,
        selection: 'const a = 1',
      },
    })
    expect(res.statusCode).toBe(200)
    const opts = mockEnrich.mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect(opts.editorState).toEqual({
      activeFile: 'apps/web/src/components/editor/CodeEditor.tsx',
      cursorLine: 780,
      selection: 'const a = 1',
    })
  })

  it('请求体未给 editorState ⇒ 服务层入参不含该键(默认关,不凭空半发)', async () => {
    const res = await postEnrich({
      userMessage: 'q',
      conversationId: 'c1',
      mentions: [],
    })
    expect(res.statusCode).toBe(200)
    const opts = mockEnrich.mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect('editorState' in opts).toBe(false)
  })

  it('activeFile 空串 ⇒ 400(zod min(1) 显式拒绝,不静默丢弃)', async () => {
    const res = await postEnrich({
      userMessage: 'q',
      conversationId: 'c1',
      mentions: [],
      editorState: { activeFile: '' },
    })
    expect(res.statusCode).toBe(400)
    expect(mockEnrich.mock.calls.length).toBe(2) // 未新增调用
  })

  it('cursorLine 非正整数 ⇒ 400(拒收而非降级省略)', async () => {
    const before = mockEnrich.mock.calls.length
    const res = await postEnrich({
      userMessage: 'q',
      conversationId: 'c1',
      mentions: [],
      editorState: { activeFile: 'a/b.py', cursorLine: 0 },
    })
    expect(res.statusCode).toBe(400)
    expect(mockEnrich.mock.calls.length).toBe(before)
  })
})
