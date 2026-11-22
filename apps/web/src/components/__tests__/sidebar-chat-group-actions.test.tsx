// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D165(承 V4 §9.4②):会话分组三动作 —— 移动到分组 / 批量移动所选到分组 / 分组置顶。
 *
 * 骨架沿用 sidebar-chat-archive-confirm.test.tsx 的整组件挂载模式,但 conversation-org
 * 与 conversation-group-pin 两个 store **不 mock**(用真 store):验收要求断言
 * "store/列表顺序即时更新"与"pin 持久化",mock 掉就没有断言对象了。
 * 断言一律裸 DOM 匹配器(本仓未装 @testing-library/jest-dom)。
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
const ID_B = CONV_B.id
const FOLDER = '工作'

const h = vi.hoisted(() => ({
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
  archiveConversation: vi.fn(),
  unarchiveConversation: vi.fn(),
  exportConversation: vi.fn(),
  compressConversation: vi.fn(),
  setConversationPinned: vi.fn(),
  batchOperateConversations: vi.fn(),
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
    setConversationId: vi.fn(),
  }
  const useChatStore = (sel: (s: typeof state) => unknown) => sel(state)
  Object.assign(useChatStore, { getState: () => state })
  return { useChatStore }
})

vi.mock('@/stores/ai-panel', () => ({
  useAiPanelStore: (sel: (s: { openPanel: () => void }) => unknown) =>
    sel({ openPanel: vi.fn() }),
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
// 真 store:不 mock(验收要求断言 store 更新与 localStorage 持久化)
import { useConversationOrgStore } from '@/stores/conversation-org'
import { useConversationGroupPinStore } from '@/stores/conversation-group-pin'
import { resolveMoveToGroup, orderFoldersWithPinned } from '../sidebar/move-to-group'

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

/** 打开 Radix DropdownMenu:happy-dom 下走键盘路径(与 archive 测试同款) */
const openDropdown = (trigger: HTMLElement) => {
  fireEvent.keyDown(trigger, { key: 'Enter' })
  fireEvent.click(trigger)
}

const openMoveDialogForFirstRow = async () => {
  await screen.findByText(TITLE_A)
  openDropdown(screen.getAllByTestId('conversation-more-menu')[0] as HTMLElement)
  fireEvent.click(screen.getByTestId('conversation-move-to-group-action'))
  await screen.findByTestId('move-to-group-dialog')
}

beforeEach(() => {
  h.successSpy.mockReset()
  h.errorSpy.mockReset()
  localStorage.clear()
  useConversationOrgStore.setState({ byUser: { u1: { [ID_B]: { folder: FOLDER } } } })
  useConversationGroupPinStore.setState({ byUser: {} })
})

afterEach(() => cleanup())

describe('D165:移动到分组(单选)', () => {
  it('① 行菜单入口存在;提交后 orgMap store 即时更新(位置即时生效)', async () => {
    renderSidebar()
    await openMoveDialogForFirstRow()

    fireEvent.click(screen.getByTestId(`move-target-${FOLDER}`))
    fireEvent.click(screen.getByTestId('move-dialog-submit'))

    await waitFor(() => expect(h.successSpy).toHaveBeenCalled())
    const byUser = useConversationOrgStore.getState().byUser
    expect(byUser.u1?.[ID_A]?.folder).toBe(FOLDER)
    // 弹层关闭
    expect(screen.queryByTestId('move-to-group-dialog')).toBeNull()
    // 成功文案点名去向(带分组名插值)
    expect(h.successSpy.mock.calls[0]?.[0]).toBe(
      msg('chatHistory.moveSuccess', { count: 1, folder: FOLDER }),
    )
  })

  it('移动到「未分组」= setFolder(null),store 即时清空文件夹', async () => {
    useConversationOrgStore.setState({ byUser: { u1: { [ID_A]: { folder: FOLDER } } } })
    renderSidebar()
    await openMoveDialogForFirstRow()

    fireEvent.click(screen.getByTestId('move-target-none'))
    fireEvent.click(screen.getByTestId('move-dialog-submit'))

    await waitFor(() => expect(h.successSpy).toHaveBeenCalled())
    expect(useConversationOrgStore.getState().byUser.u1?.[ID_A]?.folder ?? null).toBeNull()
  })
})

describe('D165:移动所选到分组(批量)', () => {
  it('① 批量条入口存在;全选提交后两个会话都在 store 中移入目标分组', async () => {
    renderSidebar()
    await screen.findByText(TITLE_A)
    fireEvent.click(screen.getByTestId('conversation-select-toggle'))
    fireEvent.click(screen.getByTestId('batch-select-all'))
    fireEvent.click(screen.getByTestId('batch-move-to-group'))
    await screen.findByTestId('move-to-group-dialog')

    fireEvent.click(screen.getByTestId(`move-target-${FOLDER}`))
    fireEvent.click(screen.getByTestId('move-dialog-submit'))

    await waitFor(() => expect(h.successSpy).toHaveBeenCalled())
    const byUser = useConversationOrgStore.getState().byUser
    expect(byUser.u1?.[ID_A]?.folder).toBe(FOLDER)
    expect(byUser.u1?.[ID_B]?.folder).toBe(FOLDER)
  })
})

describe('D165:失败三态(必须点名原因,禁止裸「操作失败」)', () => {
  it('② 目标分组已被删除:错误文案点名「已被删除」+ 分组名,弹层保留可重试', async () => {
    renderSidebar()
    await openMoveDialogForFirstRow()
    fireEvent.click(screen.getByTestId(`move-target-${FOLDER}`))

    // 人为制造失败:对话框打开期间目标分组被删(orgMap 清空 → listFolderNames 变空)
    // act 包裹:确保 store 变更同步冲刷到组件,再点提交(否则闭包里 orgFolders 还是旧值)
    await act(async () => {
      useConversationOrgStore.setState({ byUser: { u1: {} } })
    })
    fireEvent.click(screen.getByTestId('move-dialog-submit'))

    await waitFor(() => expect(h.errorSpy).toHaveBeenCalled())
    const text = (h.errorSpy.mock.calls[0]?.[0] ?? '') as string
    expect(text).toContain(msg('chatHistory.moveFailFolderMissing', { folder: FOLDER }))
    expect(text).toContain('已被删除')
    expect(text).toContain(FOLDER)
    // 可重试出口:弹层未关闭,可直接重新提交
    expect(screen.getByTestId('move-dialog-submit')).toBeTruthy()
  })

  it('② 冲突:会话已在目标分组 → 文案点名「已全部在」+ 分组名', async () => {
    useConversationOrgStore.setState({
      byUser: { u1: { [ID_A]: { folder: FOLDER }, [ID_B]: { folder: FOLDER } } },
    })
    renderSidebar()
    await openMoveDialogForFirstRow()
    fireEvent.click(screen.getByTestId(`move-target-${FOLDER}`))
    fireEvent.click(screen.getByTestId('move-dialog-submit'))

    await waitFor(() => expect(h.errorSpy).toHaveBeenCalled())
    const text = (h.errorSpy.mock.calls[0]?.[0] ?? '') as string
    expect(text).toBe(msg('chatHistory.moveFailConflict', { folder: FOLDER }))
    expect(text).toContain('已全部在')
    expect(h.successSpy).not.toHaveBeenCalled()
  })
})

describe('D165:分组置顶(pin/unpin,含持久化)', () => {
  it('③ 筛选下拉行内置顶 → localStorage 持久化 + store 更新;再点取消置顶', async () => {
    renderSidebar()
    await screen.findByText(TITLE_A)
    openDropdown(screen.getByTestId('conversation-folder-filter') as HTMLElement)

    fireEvent.click(screen.getByTestId(`conversation-group-pin-toggle-${FOLDER}`))

    await waitFor(() =>
      expect(useConversationGroupPinStore.getState().byUser.u1).toContain(FOLDER),
    )
    const parsed = JSON.parse(
      localStorage.getItem('ihui-conversation-group-pin') as string,
    ) as { state: { byUser: Record<string, string[]> } }
    expect(parsed.state.byUser.u1).toContain(FOLDER)

    // 取消置顶:store 与持久化同步回收
    fireEvent.click(screen.getByTestId(`conversation-group-pin-toggle-${FOLDER}`))
    await waitFor(() =>
      expect(useConversationGroupPinStore.getState().byUser.u1 ?? []).not.toContain(FOLDER),
    )
    expect(useConversationGroupPinStore.getState().byUser.u1).toBeUndefined()
  })

  it('③ 置顶分组在列表中整体前移(orderFoldersWithPinned)', () => {
    expect(orderFoldersWithPinned(['b', 'a', 'c'], ['c', 'a'])).toEqual(['a', 'c', 'b'])
    // 置顶记录里的分组已不存在 → 不凭空长出
    expect(orderFoldersWithPinned(['b'], ['ghost'])).toEqual(['b'])
  })
})

describe('D165:resolveMoveToGroup 纯函数四态', () => {
  it('unauthorized / folderMissing / conflict / ok', () => {
    expect(
      resolveMoveToGroup({ authorized: false, target: FOLDER, knownFolders: [FOLDER], currentFolderByConv: { [ID_A]: null } }).status,
    ).toBe('unauthorized')
    expect(
      resolveMoveToGroup({ authorized: true, target: FOLDER, knownFolders: [], currentFolderByConv: { [ID_A]: null } }),
    ).toEqual({ status: 'folderMissing', folder: FOLDER })
    expect(
      resolveMoveToGroup({ authorized: true, target: FOLDER, knownFolders: [FOLDER], currentFolderByConv: { [ID_A]: FOLDER } }).status,
    ).toBe('conflict')
    expect(
      resolveMoveToGroup({ authorized: true, target: FOLDER, knownFolders: [FOLDER], currentFolderByConv: { [ID_A]: null, [ID_B]: FOLDER } }),
    ).toEqual({ status: 'ok', moved: 1, folder: FOLDER })
  })
})
