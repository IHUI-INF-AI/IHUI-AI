// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ConversationImportPanel 渲染冒烟测试(D28,2026-09-20)
 *
 * 覆盖:来源卡片渲染、accept 按来源切换、解析预览默认全选 + truncated/warnings 警示、
 * 逐会话串行 commit(空会话跳过、payload 组装、完成后 invalidate 会话列表)、
 * 20MB 客户端预校验、导入历史渲染。与 next-steps-card.test.tsx 同款 mock 模式。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { ConversationImportPanel } from '../app/(main)/settings/import/conversation-import-panel'
import type { ConversationImportCommitPayload } from '@ihui/api-client'

// Mock next-intl — vi.hoisted 确保 mockT 在 vi.mock 工厂和测试体中均可使用
const {
  mockT,
  IconSpan,
  UiButton,
  UiCard,
  UiCardContent,
  toastError,
  toastSuccess,
  parseMock,
  commitMock,
  historyMock,
} = vi.hoisted(() => {
  const map: Record<string, string> = {
    tab: '会话导入',
    desc: '将 Claude Code / Codex / Cursor / Aider 等外部工具的会话记录导入为平台会话,导入完成后可在侧栏直接查看',
    sourcesTitle: '选择会话来源',
    sourceClaudeCode: 'Claude Code',
    sourceClaudeCodeHint: '典型路径:~/.claude/projects/**/*.jsonl',
    sourceCodex: 'Codex CLI',
    sourceCodexHint: '典型路径:~/.codex/sessions/**/*.jsonl',
    sourceCursor: 'Cursor',
    sourceCursorHint: '典型路径:Cursor 工作区 state.vscdb 导出',
    sourceAider: 'Aider',
    sourceAiderHint: '典型路径:~/.aider/chat 历史(.md)',
    upload: '上传会话导出文件',
    uploadHint: '仅支持文本导出格式,单文件不超过 20MB',
    dragDrop: '拖拽导出文件到此处,或点击选择',
    fileSelected: '已选择:{name} ({size})',
    fileTooLarge: '文件超过 20MB 限制,请拆分后重试',
    errorNoSource: '请选择会话来源',
    errorNoFile: '请先选择导出文件',
    parse: '解析文件',
    parsing: '处理中...',
    parseSuccess: '解析成功,共 {count} 个会话',
    parseFailed: '解析失败:{error}',
    parseEmpty: '未在文件中解析出任何会话',
    previewTitle: '解析预览',
    selectAll: '全选',
    deselectAll: '全不选',
    selected: '已选 {count}/{total}',
    truncatedWarning: '文件过大,仅解析出部分会话,请拆分导出文件后重试',
    conversationUntitled: '未命名会话',
    messagesCount: '{count} 条消息',
    commit: '导入所选',
    committing: '导入中...({done}/{total})',
    commitDone: '导入完成:成功 {imported},失败 {failed}',
    commitFailed: '导入失败:{error}',
    historyTitle: '导入历史',
    historyEmpty: '暂无导入记录',
    historyParsed: '解析',
    historyImported: '导入',
    historyFailed: '失败',
    statusSuccess: '成功',
    statusPartial: '部分成功',
    statusFailed: '失败',
  }
  const mockT = (key: string, params?: Record<string, unknown>) => {
    let v = map[key] ?? key
    if (params) {
      for (const [k, val] of Object.entries(params)) {
        v = v.replace(`{${k}}`, String(val))
      }
    }
    return v
  }

  // lucide 图标 mock 为简单 span(与 next-steps-card.test.tsx 同款)
  const IconSpan = ({
    className,
    'data-testid': dataTestId,
    ...rest
  }: {
    className?: string
    'data-testid'?: string
    [key: string]: unknown
  }) => (
    <span
      data-testid={dataTestId ?? 'lucide-icon'}
      className={className}
      data-lucide-span="true"
      {...rest}
    />
  )

  // ui-react 基础组件 mock 为原生标签(隔离包实现细节)
  const UiButton = ({ children, ...rest }: React.ComponentProps<'button'>) => (
    <button type="button" {...rest}>
      {children}
    </button>
  )
  const UiCard = ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  )
  const UiCardContent = ({
    children,
    className,
  }: {
    children?: React.ReactNode
    className?: string
  }) => <div className={className}>{children}</div>

  const toastError = vi.fn()
  const toastSuccess = vi.fn()
  const parseMock = vi.fn()
  const commitMock = vi.fn()
  const historyMock = vi.fn()
  return {
    mockT,
    IconSpan,
    UiButton,
    UiCard,
    UiCardContent,
    toastError,
    toastSuccess,
    parseMock,
    commitMock,
    historyMock,
  }
})

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}))

vi.mock('@ihui/api-client', () => ({
  parseConversationImport: parseMock,
  commitConversationImport: commitMock,
  getConversationImportHistory: historyMock,
}))

// helpers.ts 顶层 import '@/lib/api'(会触发 setTokenProvider/setBaseUrl 等真实副作用),整体隔离
vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(),
}))

vi.mock('@ihui/ui-react', () => ({
  Button: UiButton,
  Card: UiCard,
  CardContent: UiCardContent,
  CloseButton: () => null,
}))

vi.mock('lucide-react', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    __esModule: true,
    ...actual,
    AlertTriangle: IconSpan,
    CheckCircle: IconSpan,
    CheckCircle2: IconSpan,
    FileUp: IconSpan,
    History: IconSpan,
    Info: IconSpan,
    Loader2: IconSpan,
    Upload: IconSpan,
    XCircle: IconSpan,
  }
})

/** 每个用例独立的 QueryClient(关 retry)+ invalidate 侦测 */
function renderPanel() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
  const wrapper = ({ children }: { children?: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  render(<ConversationImportPanel />, { wrapper })
  return { invalidateSpy }
}

/** 点选来源卡并注入文件(绕过 hidden input 的 files 只读) */
function pickSourceAndFile(source: string, file: File) {
  const cards = screen.getAllByTestId('import-source-card')
  const card = cards.find((c) => c.getAttribute('data-source') === source)
  if (!card) throw new Error(`source card not found: ${source}`)
  fireEvent.click(card)
  const input = screen.getByTestId('import-file-input')
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.change(input)
  return file
}

describe('ConversationImportPanel — 外部会话导入四步流', () => {
  beforeEach(() => {
    parseMock.mockReset()
    commitMock.mockReset()
    historyMock.mockReset()
    historyMock.mockResolvedValue({ success: true, data: { list: [], total: 0 } })
    toastError.mockClear()
    toastSuccess.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('场景1: 初始渲染四个来源卡片与历史空态,上传区未出现', async () => {
    renderPanel()

    const cards = screen.getAllByTestId('import-source-card')
    expect(cards).toHaveLength(4)
    expect(cards.map((c) => c.getAttribute('data-source'))).toEqual([
      'claude_code',
      'codex',
      'cursor',
      'aider',
    ])
    expect(screen.getByText('选择会话来源')).toBeTruthy()
    expect(screen.queryByTestId('import-file-input')).toBeNull()
    expect(screen.queryByTestId('import-preview-list')).toBeNull()
    expect(screen.queryByTestId('import-commit-btn')).toBeNull()
    await waitFor(() => expect(screen.getByText('暂无导入记录')).toBeTruthy())
    expect(screen.queryByTestId('import-history-list')).toBeNull()
  })

  it('场景2: 选中来源后显示上传区,accept 与 ai-service 白名单逐源对齐', () => {
    renderPanel()

    // 单一真相源 = apps/ai-service/app/routers/session_import.py 的 _ALLOWED_EXTENSIONS
    const serverWhitelist = ['.jsonl', '.json', '.md', '.sqlite', '.db', '.vscdb']
    const expected: Record<string, string> = {
      claude_code: '.jsonl,.json',
      codex: '.jsonl,.json',
      cursor: '.json,.jsonl,.vscdb,.db,.sqlite',
      aider: '.md,.json,.jsonl',
    }
    for (const [source, accept] of Object.entries(expected)) {
      pickSourceAndFileBeforeChange(source)
      const got = (screen.getByTestId('import-file-input') as HTMLInputElement).getAttribute(
        'accept',
      )
      expect(got, source).toBe(accept)
      // 反向防漂移:客户端不得给出服务端会 400 的后缀
      for (const ext of got?.split(',') ?? []) {
        expect(serverWhitelist, `${source}:${ext}`).toContain(ext)
      }
    }
    expect(screen.queryByText(/已选择:/)).toBeNull()
  })

  it('场景3: 解析成功后默认全选,truncated/warnings 警示与预览列表齐备', async () => {
    parseMock.mockResolvedValue({
      success: true,
      data: {
        conversations: [
          { title: '会话一', messages: [{ role: 'user', content: 'hi' }] },
          { title: '会话二', messages: [{ role: 'assistant', content: 'hello' }] },
          { title: '  ', messages: [] },
        ],
        truncated: true,
        warnings: ['部分消息缺失时间戳'],
      },
    })
    renderPanel()

    pickSourceAndFile(
      'claude_code',
      new File(['{}'], 'sessions.jsonl', { type: 'application/json' }),
    )
    expect(screen.getByText('已选择:sessions.jsonl (2 B)')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '解析文件' }))
    await waitFor(() => expect(screen.getByTestId('import-preview-list')).toBeTruthy())

    expect(screen.getByText('解析预览')).toBeTruthy()
    expect(screen.getByText('文件过大,仅解析出部分会话,请拆分导出文件后重试')).toBeTruthy()
    expect(screen.getByText('部分消息缺失时间戳')).toBeTruthy()
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(3)
    for (const box of boxes) expect((box as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText('已选 3/3')).toBeTruthy()
    expect(screen.getByText('未命名会话')).toBeTruthy()
    expect((screen.getByTestId('import-commit-btn') as HTMLButtonElement).disabled).toBe(false)
  })

  it('场景4: 逐会话串行 commit,空会话跳过,完成后失效会话列表与历史', async () => {
    parseMock.mockResolvedValue({
      success: true,
      data: {
        conversations: [
          {
            title: '会话一',
            messages: [
              { role: 'user', content: 'hi' },
              { role: 'assistant', content: 'hello' },
            ],
          },
          {
            title: '会话二',
            messages: [
              { role: 'user', content: '   ' },
              { role: 'assistant', content: 'ok' },
            ],
          },
          { title: '', messages: [{ role: 'user', content: ' ' }] },
        ],
        truncated: false,
        warnings: [],
      },
    })
    commitMock.mockResolvedValue({
      success: true,
      data: { importId: 'imp-1', conversationId: 'conv-1', importedMessages: 2 },
    })
    const { invalidateSpy } = renderPanel()

    pickSourceAndFile(
      'claude_code',
      new File(['{}'], 'sessions.jsonl', { type: 'application/json' }),
    )
    fireEvent.click(screen.getByRole('button', { name: '解析文件' }))
    await waitFor(() => expect(screen.getByTestId('import-preview-list')).toBeTruthy())

    fireEvent.click(screen.getByTestId('import-commit-btn'))
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled())

    expect(commitMock).toHaveBeenCalledTimes(2)
    const p1 = commitMock.mock.calls[0]?.[0] as ConversationImportCommitPayload
    expect(p1.source).toBe('claude_code')
    expect(p1.fileName).toBe('sessions.jsonl')
    expect(p1.title).toBe('会话一')
    expect(p1.messages).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ])
    const p2 = commitMock.mock.calls[1]?.[0] as ConversationImportCommitPayload
    expect(p2.title).toBe('会话二')
    // 空白 content 消息被过滤
    expect(p2.messages).toEqual([{ role: 'assistant', content: 'ok' }])

    const invalidatedKeys = invalidateSpy.mock.calls.map(
      (c) => (c[0] as { queryKey?: unknown[] }).queryKey,
    )
    expect(invalidatedKeys).toContainEqual(['chat', 'conversations'])
    expect(invalidatedKeys).toContainEqual(['conversation-import-history'])

    await waitFor(() => expect(screen.queryByTestId('import-preview-list')).toBeNull())
  })

  it('场景5: 超过 20MB 客户端预校验拦截,解析按钮不可用', async () => {
    renderPanel()

    pickSourceAndFile('claude_code', new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'big.jsonl'))

    expect(toastError).toHaveBeenCalledWith('文件超过 20MB 限制,请拆分后重试')
    expect(screen.queryByText(/已选择:/)).toBeNull()
    expect((screen.getByRole('button', { name: '解析文件' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect(parseMock).not.toHaveBeenCalled()
  })

  it('场景6: 导入历史渲染文件名、状态徽标与计数', async () => {
    historyMock.mockResolvedValue({
      success: true,
      data: {
        list: [
          {
            id: 'h1',
            source: 'claude_code',
            conversationId: 'conv-1',
            fileName: 'chat.jsonl',
            parsedCount: 3,
            importedCount: 2,
            failedCount: 1,
            status: 'success',
            errorMessage: null,
            importedAt: '2026-09-20T10:00:00.000Z',
          },
        ],
        total: 1,
      },
    })
    renderPanel()

    await waitFor(() => expect(screen.getByTestId('import-history-list')).toBeTruthy())
    const row = screen.getByTestId('import-history-list').textContent ?? ''
    expect(row).toContain('chat.jsonl')
    expect(row).toContain('成功')
    expect(row).toContain('解析: 3 · 导入: 2 · 失败: 1')
  })
})

/** 仅点选来源卡(不注入文件),供 accept 断言使用 */
function pickSourceAndFileBeforeChange(source: string) {
  const cards = screen.getAllByTestId('import-source-card')
  const card = cards.find((c) => c.getAttribute('data-source') === source)
  if (!card) throw new Error(`source card not found: ${source}`)
  fireEvent.click(card)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
