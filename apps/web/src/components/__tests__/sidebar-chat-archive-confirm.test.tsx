// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌‌​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​​‌‌‌‌‍‍​‌​‌‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​⁠

/**
 * D186:会话归档二次确认 + 「不再提示」偏好持久化 + 归档在途态(挂载级 DOM 对账)。
 *
 * 骨架沿用 sidebar-chat-mounted-dom.test.tsx 的整组件挂载模式:每条断言都从
 * `render(<SidebarChatHistory />)` 出来的真实 DOM 上 query,不读内部状态;
 * 断言一律用裸 DOM 匹配器(本仓 apps/web 未装 @testing-library/jest-dom)。
 * Radix DropdownMenu 在 happy-dom 下走键盘路径打开(Enter,见 openDropdown)。
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const packPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  // 上溯 5 层:__tests__ → components → src → web → apps → 仓库根
  '../../../../..',
  'packages/i18n/messages/web/zh-CN.json',
)
const pack = JSON.parse(readFileSync(packPath, 'utf8')) as unknown as Record<string, unknown>

function msg(path: string, vars?: Record<string, number | string>): string {
  let cur: unknown = pack
  for (const s of path.split('.')) {
    if (cur && typeof cur === 'object') cur = (cur as Record<string, unknown>)[s]
    else return path
  }
  if (typeof cur !== 'string') return path
  return vars ? cur.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : cur
}

const CONV_A = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Q3 销售复盘',
  model: 'gpt-4o',
  lastMessageAt: '',
  messageCount: 2,
}
const CONV_B = {
  id: '22222222-2222-4222-8222-222222222222',
  title: 'Weekend Plan',
  model: 'gpt-4o',
  lastMessageAt: '',
  messageCount: 3,
}
const CONVERSATIONS = [CONV_A, CONV_B]
const TITLE_A = CONV_A.title
const ID_A = CONV_A.id

const h = vi.hoisted(() => ({
  archiveSpy: vi.fn(),
  batchSpy: vi.fn(),
  openPanelSpy: vi.fn(),
  setConversationIdSpy: vi.fn(),
  successSpy: vi.fn(),
  errorSpy: vi.fn(),
}))

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key?: string, vars?: Record<string, number | string>) =>
    key ? msg(`${ns}.${key}`, vars) : ns,
  useLocale: () => 'zh-CN',
}))

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(async () => ({
    success: true,
    data: { conversations: CONVERSATIONS, total: CONVERSATIONS.length, page: 1, pageSize: 20 },
  })),
}))

vi.mock('@ihui/api-client', () => ({
  archiveConversation: h.archiveSpy,
  unarchiveConversation: vi.fn(async () => ({ success: true, data: {} })),
  exportConversation: vi.fn(async () => ({ success: true, data: 'x' })),
  compressConversation: vi.fn(async () => ({ success: true, data: { content: 'x' } })),
  setConversationPinned: vi.fn(async () => ({ success: true, data: {} })),
  batchOperateConversations: h.batchSpy,
}))

vi.mock('@/hooks/use-auth-bootstrap', () => ({ useAuthBootstrap: () => ({ ready: true }) }))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ success: h.successSpy, error: h.errorSpy }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ isAuthenticated: true, user: { id: 'u1' } }),
}))

vi.mock('@/stores/chat', () => {
  const state = {
    conversationId: null as string | null,
    pendingQuestion: null,
    isStreaming: false,
    setConversationId: h.setConversationIdSpy,
  }
  const useChatStore = (sel: (s: typeof state) => unknown) => sel(state)
  Object.assign(useChatStore, { getState: () => state })
  return { useChatStore }
})

vi.mock('@/stores/ai-panel', () => ({
  useAiPanelStore: (sel: (s: { openPanel: () => void }) => unknown) =>
    sel({ openPanel: h.openPanelSpy }),
}))

vi.mock('@/stores/conversation-org', () => ({
  useConversationOrgMap: () => ({}),
  useConversationOrgStore: (sel: (s: unknown) => unknown) =>
    sel({ setFolder: vi.fn(), setTags: vi.fn() }),
}))

vi.mock('@/components/chat/conversation-list', () => ({ ConversationAttentionBadges: () => null }))
vi.mock('@/components/chat/conversation-org-dialog', () => ({ ConversationOrgDialog: () => null }))
vi.mock('@/components/chat/conversation-export', () => ({
  downloadConversationJson: vi.fn(),
  downloadConversationSnapshot: vi.fn(),
  downloadConversationShareCard: vi.fn(),
  copyConversationShareLink: vi.fn(),
  printConversationPdf: vi.fn(),
}))
vi.mock('@/hooks/use-sidebar', () => ({
  isWaitingForConversation: () => false,
  resolveConversationAttention: () => 'idle',
}))

import { SidebarChatHistory } from '../sidebar-chat-history'
import { useArchivePrefsStore } from '@/stores/archive-prefs'

function renderSidebar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <TooltipProvider>
      <QueryClientProvider client={client}>
        <SidebarChatHistory collapsed={false} />
      </QueryClientProvider>
    </TooltipProvider>,
  )
}

/** 打开 Radix DropdownMenu:happy-dom 下 pointer 事件序列不可靠,走键盘路径(Enter) */
const openDropdown = (trigger: HTMLElement) => {
  fireEvent.keyDown(trigger, { key: 'Enter' })
  fireEvent.click(trigger)
}

const openArchiveMenu = async (index: number) => {
  await screen.findByText(TITLE_A)
  openDropdown(screen.getAllByTestId('conversation-more-menu')[index] as HTMLElement)
  fireEvent.click(screen.getByTestId('conversation-archive-action'))
}

beforeEach(() => {
  h.archiveSpy.mockReset()
  h.archiveSpy.mockResolvedValue({ success: true, data: {} })
  h.batchSpy.mockReset()
  h.batchSpy.mockResolvedValue({ success: true, data: { action: 'archive', affected: 2 } })
  h.openPanelSpy.mockReset()
  h.setConversationIdSpy.mockReset()
  h.successSpy.mockReset()
  h.errorSpy.mockReset()
  localStorage.clear()
  useArchivePrefsStore.setState({ skipArchiveConfirm: false })
})

afterEach(() => cleanup())

describe('D186:归档二次确认(挂载级,语言包真值)', () => {
  it('归档先弹确认:标题带「{title}」插值;未确认不发请求', async () => {
    renderSidebar()
    await openArchiveMenu(0)

    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain(msg('chatHistory.archiveChatTitle', { title: TITLE_A }))
    expect(dialog.textContent).toContain(msg('chatHistory.archiveChatDoNotAskAgain'))
    expect(h.archiveSpy).not.toHaveBeenCalled()
  })

  it('确认后在途态:确认钮切「正在归档...」并禁用;完成即关弹层 + 成功 toast', async () => {
    let release: (v: unknown) => void = () => {}
    h.archiveSpy.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    renderSidebar()
    await openArchiveMenu(0)
    await screen.findByRole('dialog')

    fireEvent.click(screen.getByTestId('confirm-button'))
    await waitFor(() => expect(h.archiveSpy).toHaveBeenCalledWith(ID_A))

    const confirmButton = screen.getByTestId('confirm-button')
    expect(confirmButton.textContent).toBe(msg('chatHistory.archivingChat'))
    expect(confirmButton.hasAttribute('disabled')).toBe(true)

    await act(async () => {
      release({ success: true, data: {} })
    })
    await waitFor(() => expect(h.successSpy).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('取消不发请求,弹层关闭', async () => {
    renderSidebar()
    await openArchiveMenu(0)
    await screen.findByRole('dialog')

    fireEvent.click(screen.getByTestId('confirm-cancel-button'))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(h.archiveSpy).not.toHaveBeenCalled()
  })

  it('勾选「不再提示」→ 确认后偏好持久化;后续归档不再弹层直达', async () => {
    renderSidebar()
    await openArchiveMenu(0)
    await screen.findByRole('dialog')

    fireEvent.click(screen.getByTestId('archive-confirm-no-ask-checkbox'))
    fireEvent.click(screen.getByTestId('confirm-button'))
    await waitFor(() => expect(h.archiveSpy).toHaveBeenCalledWith(ID_A))
    await waitFor(() => expect(h.successSpy).toHaveBeenCalled())

    const parsed = JSON.parse(localStorage.getItem('ihui-archive-prefs') as string) as {
      state: { skipArchiveConfirm: boolean }
    }
    expect(parsed.state.skipArchiveConfirm).toBe(true)
    expect(useArchivePrefsStore.getState().skipArchiveConfirm).toBe(true)

    // 第二次归档:不弹确认,直达 api-client 出口
    await openArchiveMenu(0)
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(h.archiveSpy).toHaveBeenCalledTimes(2))
  })

  it('批量归档在途:动作条归档钮切「正在归档任务...」并禁用;完成恢复「批量归档」', async () => {
    let release: (v: unknown) => void = () => {}
    h.batchSpy.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    renderSidebar()
    await screen.findByText(TITLE_A)
    fireEvent.click(screen.getByTestId('conversation-select-toggle'))
    fireEvent.click(screen.getByTestId('batch-select-all'))
    fireEvent.click(screen.getByTestId('batch-archive'))

    await waitFor(() => expect(h.batchSpy).toHaveBeenCalled())
    const archiveButton = screen.getByTestId('batch-archive')
    expect(archiveButton.textContent).toContain(msg('chatHistory.archivingChats'))
    expect(archiveButton.hasAttribute('disabled')).toBe(true)

    await act(async () => {
      release({ success: true, data: { action: 'archive', affected: 2 } })
    })
    await waitFor(() => expect(h.successSpy).toHaveBeenCalled())
    expect(screen.getByTestId('batch-archive').textContent).toContain(
      msg('chatHistory.batchArchive'),
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌‌​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​​‌‌‌‌‍‍​‌​‌‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​⁠
