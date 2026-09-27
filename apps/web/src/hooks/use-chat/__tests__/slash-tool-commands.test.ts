// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D117 工具型斜杠命令(tryHandleToolSlash)行为测试:
// 断言"识别 + 分发 + 副作用落点",副作用模块(store/compact)一律 mock。
import { describe, expect, it, vi, beforeEach } from 'vitest'

const { mockOpenWith, mockRunCompact, mockAddMessage } = vi.hoisted(() => ({
  mockOpenWith: vi.fn(),
  mockRunCompact: vi.fn(async () => 'ok' as const),
  mockAddMessage: vi.fn(),
}))

vi.mock('@ihui/shared/chat/session-file-changes', async (importOriginal) => {
  // `importOriginal()` 的返回是 `unknown`,直接展开会撞 TS2698("Spread types may only be
  // created from object types")—— 这是**已入库**的红灯(该文件工作树==HEAD),CI 的 web
  // typecheck 每次都红在这一行。只加断言,运行时行为一字不变。
  const mod = (await importOriginal()) as Record<string, unknown>
  return {
    ...mod,
    collectSessionFileChanges: vi.fn(() => [
      {
        filePath: 'a.ts',
        isNewFile: false,
        toolName: 'edit_file',
        changedCount: 1,
        oldContent: 'x',
        newContent: 'y',
      },
    ]),
  }
})
vi.mock('@/stores/session-diff', () => ({
  useSessionDiffStore: { getState: () => ({ openWith: mockOpenWith }) },
}))
vi.mock('../manual-compact', () => ({ runManualCompact: mockRunCompact }))

// chat store 最小 mock:/status 会读 getState()
const storeState = {
  messages: [
    { id: 'u1', role: 'user', content: 'hi' },
    { id: 'a1', role: 'assistant', content: 'hello', error: false },
  ],
  usageByMessageId: {
    a1: { promptTokens: 1000, completionTokens: 500, costUsd: 0.01 },
  },
  currentModel: 'test-model',
  conversationId: 'conv-1' as string | null,
  isStreaming: false,
  addMessage: mockAddMessage,
}
vi.mock('@/stores/chat', () => ({
  useChatStore: { getState: () => storeState },
}))
vi.mock('@/stores/ai-panel', () => ({
  useAiPanelStore: {
    getState: () => ({ activeWorkspace: { mode: 'default' }, pendingPermissionMode: null }),
  },
}))
vi.mock('@/lib/model-context-capacity', () => ({
  getModelContextCapacity: vi.fn(() => 128000),
  formatTokenCount: vi.fn((n: number) => `${n}`),
}))

import { tryHandleToolSlash, buildSessionStatusReport } from '../slash-commands'

const t = (key: string, vars?: Record<string, string | number>) =>
  `${key}${vars ? JSON.stringify(vars) : ''}`

describe('tryHandleToolSlash — D117 工具型命令分发', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeState.conversationId = 'conv-1'
    storeState.isStreaming = false
  })

  it('非斜杠 / 非清单内命令 → false,零副作用', async () => {
    await expect(tryHandleToolSlash('hello world', t)).resolves.toBe(false)
    await expect(tryHandleToolSlash('/unknown', t)).resolves.toBe(false)
    await expect(tryHandleToolSlash('/compact extra args', t)).resolves.toBe(false)
    expect(mockOpenWith).not.toHaveBeenCalled()
  })

  it('/diff:聚合非空 → openWith 注入弹窗 store', async () => {
    await expect(tryHandleToolSlash('/diff', t)).resolves.toBe(true)
    expect(mockOpenWith).toHaveBeenCalledTimes(1)
    expect(mockOpenWith.mock.calls[0]![0]).toHaveLength(1)
  })

  it('/status:组装 sidechat 消息(role=assistant + meta.sidechat),含上下文占用行', async () => {
    await expect(tryHandleToolSlash('/status', t)).resolves.toBe(true)
    expect(mockAddMessage).toHaveBeenCalledTimes(1)
    const arg = mockAddMessage.mock.calls[0]![0] as {
      role: string
      meta?: { sidechat?: boolean }
      content: string
    }
    expect(arg.role).toBe('assistant')
    expect(arg.meta?.sidechat).toBe(true)
    expect(arg.content).toContain('slashCmd.statusContext')
  })

  it('/model:派发全局事件 ihui:model-selector:open', async () => {
    const spy = vi.fn()
    window.addEventListener('ihui:model-selector:open', spy)
    await expect(tryHandleToolSlash('/model', t)).resolves.toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
    window.removeEventListener('ihui:model-selector:open', spy)
  })

  it('/compact:委托 runManualCompact(带 conversationId)', async () => {
    await expect(tryHandleToolSlash('/compact', t)).resolves.toBe(true)
    expect(mockRunCompact).toHaveBeenCalledWith('conv-1', expect.any(Function))
  })

  it('/compact:流式中 → store 守卫短路,不调 compact 端点路径(仍委托单一实现)', async () => {
    storeState.isStreaming = true
    await expect(tryHandleToolSlash('/compact', t)).resolves.toBe(true)
    expect(mockRunCompact).toHaveBeenCalledTimes(1)
    storeState.isStreaming = false
  })
})

describe('buildSessionStatusReport — /status 纯组装', () => {
  it('全量字段:模型/会话/权限/占用/输出/成本/消息数逐行在位', () => {
    const report = buildSessionStatusReport(
      {
        model: 'm1',
        conversationId: 'c1',
        permissionMode: 'default',
        contextCapacityTokens: 128000,
        lastAssistantPromptTokens: 64000,
        sessionCompletionTokens: 2000,
        sessionCostUsd: 0.1234,
        messageCount: 7,
      },
      t,
    )
    expect(report).toContain('m1')
    expect(report).toContain('c1')
    expect(report).toContain('default')
    expect(report).toContain('"pct":"50"')
    expect(report).toContain('0.1234')
    expect(report).toContain('7')
  })

  it('降级形态:无会话/无 usage → 占用行与成本行不出现,不冒充 0', () => {
    const report = buildSessionStatusReport(
      {
        model: '',
        conversationId: null,
        permissionMode: null,
        contextCapacityTokens: 128000,
        lastAssistantPromptTokens: null,
        sessionCompletionTokens: 0,
        sessionCostUsd: null,
        messageCount: 0,
      },
      t,
    )
    expect(report).not.toContain('statusContext')
    expect(report).not.toContain('statusCost')
    expect(report).toContain('`-`')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
