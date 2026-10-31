// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * editor_state 上报腿 —— api 服务层断言(2026-11-01 立)。
 *
 * 判 contextEngineService.enrich 把 camelCase editorState 映射为 ai-service
 * 请求体的 snake_case 键(active_file / cursor_line / selection,与
 * apps/ai-service/app/services/context_engine.py 的 normalize_editor_state
 * 逐字段对齐),且:
 * - 三个字段逐个不丢、值原样;
 * - 未给 editorState / activeFile 空白 ⇒ 转发体整个 editorState 键不发
 *   (与 ai-service「失效方向 = 丢弃」同构,不半发);
 * - cursorLine / selection 缺省时对应 snake_case 键也不出现(不写 undefined 占位);
 * - 转发体不得出现 camelCase 泄漏键(activeFile/cursorLine)。
 * 全程 mock ai-service-fetch,不发真实 HTTP、不连库。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockAiServiceFetch } = vi.hoisted(() => ({ mockAiServiceFetch: vi.fn() }))

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetch: mockAiServiceFetch,
  aiServiceFetchStream: vi.fn(),
}))
vi.mock('../src/db/index.js', () => ({ db: { execute: vi.fn() } }))
vi.mock('../src/services/codebase-index-service.js', () => ({
  codebaseIndexService: { search: vi.fn() },
}))
vi.mock('../src/db/file-queries.js', () => ({ findRecentFiles: vi.fn(async () => []) }))

import { contextEngineService } from '../src/services/context-engine-service.js'

/** 取第 n 次 aiServiceFetch 调用的转发请求体(JSON 已解回对象) */
function forwardedBody(callIndex = 0): Record<string, unknown> {
  const call = mockAiServiceFetch.mock.calls[callIndex] as unknown as [
    unknown,
    string,
    { body: string },
  ]
  return JSON.parse(call[2].body) as Record<string, unknown>
}

function okResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      code: 0,
      data: { enrichedContext: '', tokenCount: 0, sources: [], conversationId: 'c1' },
    }),
  }
}

beforeEach(() => {
  mockAiServiceFetch.mockReset()
  mockAiServiceFetch.mockResolvedValue(okResponse() as never)
})

describe('contextEngineService.enrich → ai-service editorState 转发', () => {
  it('editorState 三字段逐字段映射为 snake_case,值原样不丢', async () => {
    await contextEngineService.enrich({
      userMessage: '重构这个组件',
      conversationId: 'c1',
      mentions: [],
      editorState: {
        activeFile: 'apps/web/src/components/editor/CodeEditor.tsx',
        cursorLine: 780,
        selection: 'const a = 1',
      },
    })
    const body = forwardedBody()
    expect(body.editorState).toEqual({
      active_file: 'apps/web/src/components/editor/CodeEditor.tsx',
      cursor_line: 780,
      selection: 'const a = 1',
    })
    // 既有字段一条不少(转发路径只是多带一个可选字段)
    expect(body.query).toBe('重构这个组件')
    expect(body.conversationId).toBe('c1')
    expect(body.totalBudget).toBe(8000)
  })

  it('只给 activeFile ⇒ cursor_line / selection 键不出现(不写 undefined 占位)', async () => {
    await contextEngineService.enrich({
      userMessage: 'x',
      conversationId: 'c1',
      mentions: [],
      editorState: { activeFile: 'a/b.py' },
    })
    const es = forwardedBody().editorState as Record<string, unknown>
    expect(es).toEqual({ active_file: 'a/b.py' })
    expect('cursor_line' in es).toBe(false)
    expect('selection' in es).toBe(false)
  })

  it('未给 editorState ⇒ 转发体不含 editorState 键(默认关语义)', async () => {
    await contextEngineService.enrich({
      userMessage: 'x',
      conversationId: 'c1',
      mentions: [],
    })
    expect('editorState' in forwardedBody()).toBe(false)
  })

  it('activeFile 缺失/空白 ⇒ editorState 整字段不发(与 ai-service 丢弃语义同构)', async () => {
    await contextEngineService.enrich({
      userMessage: 'x',
      conversationId: 'c1',
      mentions: [],
      editorState: { activeFile: '   ', cursorLine: 3, selection: 'y' },
    })
    expect('editorState' in forwardedBody()).toBe(false)
  })

  it('转发体不得出现 camelCase 泄漏键', async () => {
    await contextEngineService.enrich({
      userMessage: 'x',
      conversationId: 'c1',
      mentions: [],
      editorState: { activeFile: 'a/b.py', cursorLine: 2, selection: 's' },
    })
    const es = forwardedBody().editorState as Record<string, unknown>
    expect(Object.keys(es).sort()).toEqual(['active_file', 'cursor_line', 'selection'])
  })
})
