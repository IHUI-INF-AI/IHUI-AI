// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * 外部会话导入(RN 端)测试 — D28 多端同步补齐(2026-09-21)
 *
 * 覆盖:
 * - 初始:拉取导入历史 + 渲染 4 个来源(不自动解析)
 * - 平台 adapter:expo-document-picker 选文件 → fetchApi 拼 RN multipart(source 字段 + {uri,type,name} 文件部分)
 * - 隐私:预览只渲染会话元信息,消息正文不进 DOM
 * - 串行提交:逐会话 commit,单个失败不中断其余,完成后重拉历史
 * - 取消选择:不触发解析请求
 *
 * 说明:@ihui/rn-app 由 vitest.config.ts alias 到 tests/__mocks__/ihui-rn-app.ts,
 * 该 mock 对 ConversationImportScreen 走真实共享实现(与 SettingsScreen/OrderScreen 同款),
 * 因此本测试同时验证 wrapper 注入与共享 UI 的联动。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { rnMocks } = vi.hoisted(() => ({
  rnMocks: {
    getDocumentAsync: vi.fn(),
    fetchApi: vi.fn(),
    commitConversationImport: vi.fn(),
    getConversationImportHistory: vi.fn(),
    goBack: vi.fn(),
  },
}))

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: rnMocks.getDocumentAsync,
}))

vi.mock('@ihui/api-client', () => ({
  fetchApi: rnMocks.fetchApi,
  commitConversationImport: rnMocks.commitConversationImport,
  getConversationImportHistory: rnMocks.getConversationImportHistory,
}))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: rnMocks.goBack, navigate: vi.fn() }),
}))

vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

vi.mock('../src/components/NavBar', async () => {
  const { createElement } = await import('react')
  return {
    NavBar: ({ title, onBack }: { title?: string; onBack?: () => void }) =>
      createElement(
        'div',
        null,
        createElement('button', { onClick: onBack }, 'back'),
        createElement('span', null, title ?? ''),
      ),
  }
})

import { ConversationImportScreen } from '../src/screens/ConversationImportScreen'

/** 解析端点响应(ai-service 裸 JSON,fetchApi 直出 data) */
const PARSE_RESULT = {
  success: true as const,
  data: {
    conversations: [
      {
        title: '重构计费模块',
        source: 'claude_code' as const,
        model: 'claude-sonnet-4-5',
        sourceCreatedAt: '2026-09-20T10:00:00.000Z',
        messages: [
          { role: 'user' as const, content: 'PRIVATE-BODY-ALPHA' },
          { role: 'assistant' as const, content: 'PRIVATE-BODY-BETA' },
        ],
      },
      {
        title: '联调支付回调',
        source: 'claude_code' as const,
        messages: [{ role: 'user' as const, content: 'PRIVATE-BODY-GAMMA' }],
      },
      {
        // 正文全空白:过滤后无消息 → 不发 commit 请求,直接计失败
        title: '空消息会话',
        source: 'claude_code' as const,
        messages: [{ role: 'user' as const, content: '   ' }],
      },
    ],
    truncated: false,
    warnings: ['缺少模型信息'],
  },
}

const HISTORY_RESULT = {
  success: true as const,
  data: {
    list: [
      {
        id: 'b1',
        source: 'claude_code',
        conversationId: 'c1',
        fileName: 'export.jsonl',
        parsedCount: 2,
        importedCount: 1,
        failedCount: 1,
        status: 'partial',
        errorMessage: null,
        importedAt: '2026-09-18T12:00:00.000Z',
      },
    ],
    total: 1,
  },
}

function mockPickedFile(): void {
  rnMocks.getDocumentAsync.mockResolvedValue({
    canceled: false,
    assets: [
      {
        uri: 'file:///cache/export.jsonl',
        name: 'export.jsonl',
        mimeType: 'application/jsonl',
        size: 2048,
      },
    ],
  })
}

/** commit 请求体(仅取断言所需字段,避免依赖 api-client 内部类型) */
interface CommitPayload {
  source: string
  fileName?: string
  title?: string
  model?: string
  createdAt?: string
  messages: Array<{ role: string; content: string }>
}

function commitPayloadAt(index: number): CommitPayload {
  const call = rnMocks.commitConversationImport.mock.calls[index]?.[0]
  if (!call) throw new Error(`commitConversationImport 第 ${index} 次调用缺失`)
  return call as CommitPayload
}

beforeEach(() => {
  rnMocks.getConversationImportHistory.mockResolvedValue(HISTORY_RESULT)
})

describe('ConversationImportScreen(RN)', () => {
  it('初始只拉导入历史并渲染 4 个来源', async () => {
    render(<ConversationImportScreen />)

    await waitFor(() => expect(rnMocks.getConversationImportHistory).toHaveBeenCalledTimes(1))

    expect(screen.getByText('conversationImport.sourceClaudeCode')).toBeTruthy()
    expect(screen.getByText('conversationImport.sourceCodex')).toBeTruthy()
    expect(screen.getByText('conversationImport.sourceCursor')).toBeTruthy()
    expect(screen.getByText('conversationImport.sourceAider')).toBeTruthy()
    // 历史渲染:批次文件名 + 计数
    expect(screen.getByText('export.jsonl')).toBeTruthy()
    expect(screen.getByText(/2026-09-18/)).toBeTruthy()
    // 未选来源就点解析 → 只做本地校验,不发请求
    fireEvent.click(screen.getByText('conversationImport.pickFile'))
    expect(rnMocks.getDocumentAsync).not.toHaveBeenCalled()
    expect(rnMocks.fetchApi).not.toHaveBeenCalled()
    expect(screen.getByText('conversationImport.errorNoSource')).toBeTruthy()
  })

  it('选文件后以 RN multipart 形态调 parse 端点,预览不含消息正文', async () => {
    mockPickedFile()
    rnMocks.fetchApi.mockResolvedValue(PARSE_RESULT)
    // jsdom 的 FormData 会把非 Blob 值字符串化,故在 append 处断言 RN 文件对象原样传入
    const appendSpy = vi.spyOn(FormData.prototype, 'append')

    render(<ConversationImportScreen />)
    await waitFor(() => expect(rnMocks.getConversationImportHistory).toHaveBeenCalled())

    fireEvent.click(screen.getByText('conversationImport.sourceClaudeCode'))
    fireEvent.click(screen.getByText('conversationImport.pickFile'))

    await waitFor(() => expect(rnMocks.fetchApi).toHaveBeenCalledTimes(1))

    const fetchCall = rnMocks.fetchApi.mock.calls[0]
    if (!fetchCall) throw new Error('fetchApi 未被调用')
    const [url, options] = fetchCall as [string, { method: string; body: FormData }]
    expect(url).toBe('/api/user/conversation-import/parse')
    expect(options.method).toBe('POST')
    expect(options.body).toBeInstanceOf(FormData)
    expect(appendSpy.mock.calls.filter(([field]) => field === 'source')).toEqual([
      ['source', 'claude_code'],
    ])
    // RN 文件部分为 { uri, type, name } 对象(非 Blob/File)
    expect(appendSpy.mock.calls.find(([field]) => field === 'file')?.[1]).toEqual({
      uri: 'file:///cache/export.jsonl',
      type: 'application/jsonl',
      name: 'export.jsonl',
    })
    appendSpy.mockRestore()

    // 元信息可见:标题 / 消息数 / 模型 / 日期
    await waitFor(() => expect(screen.getByText('重构计费模块')).toBeTruthy())
    expect(screen.getAllByText(/conversationImport\.messagesCount/)).toHaveLength(3)
    expect(screen.getByText(/claude-sonnet-4-5/)).toBeTruthy()
    expect(screen.getByText(/2026-09-20/)).toBeTruthy()
    expect(screen.getByText('缺少模型信息')).toBeTruthy()
    // 隐私:正文绝不进 DOM
    expect(screen.queryByText(/PRIVATE-BODY-ALPHA/)).toBeNull()
    expect(screen.queryByText(/PRIVATE-BODY-BETA/)).toBeNull()
  })

  it('串行提交:单会话失败不中断,正文空白会话不发请求,完成后重拉历史', async () => {
    mockPickedFile()
    rnMocks.fetchApi.mockResolvedValue(PARSE_RESULT)
    rnMocks.commitConversationImport
      .mockResolvedValueOnce({
        success: true,
        data: { importId: 'i1', conversationId: 'c1', importedMessages: 2 },
      })
      .mockResolvedValueOnce({ success: false, error: '服务暂不可用' })

    render(<ConversationImportScreen />)
    await waitFor(() => expect(rnMocks.getConversationImportHistory).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByText('conversationImport.sourceClaudeCode'))
    fireEvent.click(screen.getByText('conversationImport.pickFile'))
    await waitFor(() => expect(screen.getByText('重构计费模块')).toBeTruthy())

    // 默认全选 3 条(其中 1 条正文空白)
    fireEvent.click(screen.getByText('conversationImport.commit'))

    await waitFor(() => expect(rnMocks.commitConversationImport).toHaveBeenCalledTimes(2))
    const firstPayload = commitPayloadAt(0)
    expect(firstPayload.source).toBe('claude_code')
    expect(firstPayload.fileName).toBe('export.jsonl')
    expect(firstPayload.title).toBe('重构计费模块')
    expect(firstPayload.model).toBe('claude-sonnet-4-5')
    expect(firstPayload.messages).toHaveLength(2)
    // 第二条失败后仍继续处理第三条;第三条无有效消息 → 不发请求
    const secondPayload = commitPayloadAt(1)
    expect(secondPayload.title).toBe('联调支付回调')
    // t 为恒等 mock,故完成文案只呈现 key(计数已插入)
    expect(screen.getByText('conversationImport.commitDone')).toBeTruthy()
    await waitFor(() => expect(rnMocks.getConversationImportHistory).toHaveBeenCalledTimes(2))
  })

  it('取消文件选择不触发解析', async () => {
    rnMocks.getDocumentAsync.mockResolvedValue({ canceled: true, assets: [] })

    render(<ConversationImportScreen />)
    await waitFor(() => expect(rnMocks.getConversationImportHistory).toHaveBeenCalled())

    fireEvent.click(screen.getByText('conversationImport.sourceCursor'))
    fireEvent.click(screen.getByText('conversationImport.pickFile'))

    await waitFor(() => expect(rnMocks.getDocumentAsync).toHaveBeenCalledTimes(1))
    expect(rnMocks.fetchApi).not.toHaveBeenCalled()
    expect(screen.queryByText('conversationImport.previewTitle')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
