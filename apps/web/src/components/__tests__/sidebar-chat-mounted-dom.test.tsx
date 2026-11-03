// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * V3 #62:侧栏「会话搜索 + 批量选择」的挂载级 DOM 对账。
 *
 * 为什么必须整组件挂载而不是只测纯函数:第 62 票的病是"组件写好了、界面上永远
 * 不出现"(纯函数单测一路绿,而用户看不见搜索框)。所以这里每条断言都从
 * `render(<SidebarChatHistory />)` 出来的真实 DOM 上 query 节点,不读内部状态。
 * 已有的 `sidebar-chat-search.test.ts` 测的是过滤函数的集合语义,两者互补不互替。
 *
 * 被 mock 的都是与本票无关的旁支(注意力徽章 / 导出 / 组织对话框 / 登录 bootstrap /
 * 传输层);没有 mock 掉的正是本票要证明的三件:侧栏本体、
 * `sidebar/use-conversation-selection.ts`、`sidebar/conversation-batch-bar.tsx`。
 *
 * 断言一律用裸 DOM 匹配器(本仓 apps/web 没装 @testing-library/jest-dom,
 * 见 apps/web/tests/setup.ts 与既有 delivery-review-panel.test.tsx 的写法)。
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 语言包真值(嵌套路径取词 + {count} 插值):不在测试里另抄一份文案表(§22c)。
// 用 fileURLToPath + 相对层数定位,不用 new URL —— 本仓 vitest 跑在 happy-dom 下,
// 全局 URL 被 happy-dom 版本替换,`new URL('../…', import.meta.url)` 直接 Invalid URL。
const packPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  // 上溯 5 层:__tests__ → components → src → web → apps → 仓库根
  '../../../../..',
  'packages/i18n/messages/web/zh-CN.json',
)
const pack = JSON.parse(readFileSync(packPath, 'utf8')) as unknown as Record<string, unknown>

// shared 包真值(D188 运行中徽标等跨端键;msg() 在 web 包未命中时回退到此包)
const sharedPackPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../..',
  'packages/i18n/messages/shared/zh-CN.json',
)
const sharedPack = JSON.parse(readFileSync(sharedPackPath, 'utf8')) as unknown as Record<
  string,
  unknown
>
const ACTIVITY_RUNNING = (sharedPack.taskStatus as { activityRunning: string }).activityRunning

function msg(path: string, vars?: Record<string, number | string>): string {
  const resolveIn = (root: unknown): string | null => {
    let cur: unknown = root
    for (const s of path.split('.')) {
      if (cur && typeof cur === 'object') cur = (cur as Record<string, unknown>)[s]
      else return null
    }
    return typeof cur === 'string' ? cur : null
  }
  // web 包优先,shared 包回退(D188 运行中徽标等跨端键;两包都没有才回落键名)
  const raw = resolveIn(pack) ?? resolveIn(sharedPack)
  if (raw === null) return path
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : raw
}

const SEARCH_NAME = msg('chatSearchBar.searchAriaLabel')

/** 三行会话:lastMessageAt 留空 → 全部落进"本月"桶,分组头不影响按标题 query */
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
const CONV_C = {
  id: '33333333-3333-4333-8333-333333333333',
  title: 'API 设计讨论',
  model: 'gpt-4o',
  lastMessageAt: '',
  messageCount: 1,
}
const CONVERSATIONS = [CONV_A, CONV_B, CONV_C]
const TITLES = CONVERSATIONS.map((c) => c.title)
// 具名常量而非 TITLES[0] / CONVERSATIONS[0].id:web 端开了 noUncheckedIndexedAccess,
// 下标取元素要判空 —— 夹具用名字反而读得清楚(哪一行是"匹配行"、哪一行是"被筛掉的行")。
const TITLE_A = CONV_A.title
const TITLE_B = CONV_B.title
const TITLE_C = CONV_C.title
const ID_A = CONV_A.id
const ID_B = CONV_B.id
const ID_C = CONV_C.id

// vi.hoisted:mock 工厂引用的可变对象必须比 vi.mock 更早就位
const h = vi.hoisted(() => ({
  batchSpy: vi.fn(),
  openPanelSpy: vi.fn(),
  setConversationIdSpy: vi.fn(),
  successSpy: vi.fn(),
  errorSpy: vi.fn(),
  // D188:chat store 可变状态面(mock 工厂把它同时挂到 h,测试可按用例改字段后 rerender)
  chatState: null as Record<string, unknown> | null,
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
  archiveConversation: vi.fn(async () => ({ success: true, data: {} })),
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
    // D188:侧栏运行中徽标读这一键(mock 状态挂在 h.chatState,测试可变)
    isStreaming: false,
    setConversationId: h.setConversationIdSpy,
  }
  h.chatState = state
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

// 旁支模块摘掉:本票不测它们,且避免把无关依赖面拖进挂载
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
// D187/D190:真实 store(未读标记)+ mock 出口(翻页覆盖)
import { useConversationUnreadMarkStore } from '@/stores/conversation-unread-mark'
import { fetchApi } from '@/lib/api'
import type { Mock } from 'vitest'

function renderSidebar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(
    <TooltipProvider>
      <QueryClientProvider client={client}>
        <SidebarChatHistory collapsed={false} />
      </QueryClientProvider>
    </TooltipProvider>,
  )
  return { view, client }
}

const checkbox = (id: string) =>
  screen.getByTestId(`conversation-checkbox-${id}`) as HTMLElement & {
    getAttribute(name: string): string | null
  }
const countLabel = (n: number) => msg('chatHistory.selectedCount', { count: n })
function groupLabel(): string | null {
  const bar = screen.getByTestId('conversation-batch-bar')
  return bar.getAttribute('aria-label')
}
function checkedTestId(): string[] {
  return screen
    .getAllByRole('checkbox')
    .filter((c) => c.getAttribute('aria-checked') === 'true')
    .map((c) => c.getAttribute('data-testid') ?? '')
    .sort()
}
function openSearch() {
  fireEvent.click(screen.getByTestId('conversation-search-toggle'))
  return screen.getByRole('textbox', { name: SEARCH_NAME })
}
function typeSearch(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } })
}
function enterSelectionMode() {
  fireEvent.click(screen.getByTestId('conversation-select-toggle'))
}

beforeEach(() => {
  h.batchSpy.mockReset()
  h.batchSpy.mockResolvedValue({ success: true, data: { action: 'archive', affected: 3 } })
  h.openPanelSpy.mockReset()
  h.setConversationIdSpy.mockReset()
  h.successSpy.mockReset()
  h.errorSpy.mockReset()
  // D187/D188:每用例干净状态(未读标记集 + chat store 运行态)
  if (h.chatState) {
    h.chatState.conversationId = null
    h.chatState.isStreaming = false
  }
  useConversationUnreadMarkStore.setState({ byUser: {} })
})

// 本仓 vitest 未开 globals ⇒ RTL 的自动 cleanup 不会挂上 afterEach,必须显式清
afterEach(() => cleanup())

describe('判据 1:侧栏搜索栏出现在界面上且可用', () => {
  it('默认收起:有开关但没有输入框;点开关后输入框进 DOM 且带无障碍名', async () => {
    renderSidebar()
    const toggle = await screen.findByTestId('conversation-search-toggle')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('textbox', { name: SEARCH_NAME })).toBeNull()

    fireEvent.click(toggle)
    expect(screen.getByRole('textbox', { name: SEARCH_NAME })).toBeTruthy()
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })

  it('输入关键词 → 列表真的收窄(不匹配的行从 DOM 消失)', async () => {
    renderSidebar()
    await screen.findByText(TITLE_A)
    typeSearch(openSearch(), 'q3')

    expect(screen.getByText(TITLE_A)).toBeTruthy()
    expect(screen.queryByText(TITLE_B)).toBeNull()
    expect(screen.queryByText(TITLE_C)).toBeNull()
  })

  it('无匹配 → 空态有明确文案(取语言包真值,不是空 div),且结果区确实一行不剩', async () => {
    renderSidebar()
    await screen.findByText(TITLE_A)
    typeSearch(openSearch(), '绝无此词')

    const empty = screen.getByText(msg('chatHistory.noResults'))
    expect((empty.textContent ?? '').trim()).not.toBe('')
    for (const title of TITLES) expect(screen.queryByText(title as string)).toBeNull()
  })

  it('可清除(键盘路径):Esc 收起搜索并清空关键词,完整列表回到界面', async () => {
    renderSidebar()
    await screen.findByText(TITLE_A)
    const input = openSearch()
    typeSearch(input, 'q3')
    expect(screen.queryByText(TITLE_B)).toBeNull()

    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByRole('textbox', { name: SEARCH_NAME })).toBeNull()
    for (const title of TITLES) expect(screen.getByText(title as string)).toBeTruthy()
  })

  it('可清除(鼠标路径):再点一次开关同样收起并清空', async () => {
    renderSidebar()
    await screen.findByText(TITLE_A)
    const toggle = screen.getByTestId('conversation-search-toggle')
    fireEvent.click(toggle)
    typeSearch(screen.getByRole('textbox', { name: SEARCH_NAME }), 'plan')
    expect(screen.queryByText(TITLE_A)).toBeNull()

    fireEvent.click(toggle)
    for (const title of TITLES) expect(screen.getByText(title as string)).toBeTruthy()
  })

  it('折叠态完全不渲染:collapsed=true 时既没有搜索开关也没有多选开关', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SidebarChatHistory collapsed={true} />
      </QueryClientProvider>,
    )
    expect(screen.queryByTestId('conversation-search-toggle')).toBeNull()
    expect(screen.queryByTestId('conversation-select-toggle')).toBeNull()
  })
})

describe('判据 2:侧栏批量选择(进入 / 勾选 / 动作出口 / 退出 / 单一真相源)', () => {
  it('进入多选态:动作条与行内复选框一起出现;退出后两者一起消失', async () => {
    renderSidebar()
    await screen.findByText(TITLE_A)
    expect(screen.queryByTestId('conversation-batch-bar')).toBeNull()

    const toggle = screen.getByTestId('conversation-select-toggle')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)

    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('conversation-batch-bar')).toBeTruthy()
    // 1 枚动作条"全选" + 3 枚行内框
    expect(screen.getAllByRole('checkbox').length).toBe(1 + CONVERSATIONS.length)

    fireEvent.click(toggle)
    expect(screen.queryByTestId('conversation-batch-bar')).toBeNull()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('勾选两行:动作条无障碍计数与行内复选框读同一份集合(单一真相源)', async () => {
    renderSidebar()
    await screen.findByText(TITLE_A)
    enterSelectionMode()
    fireEvent.click(checkbox(ID_A))
    fireEvent.click(checkbox(ID_B))

    expect(groupLabel()).toBe(countLabel(2))
    expect(checkedTestId()).toEqual([ID_A, ID_B].map((id) => `conversation-checkbox-${id}`).sort())
    expect(screen.getByTestId('batch-select-all').getAttribute('aria-checked')).toBe('mixed')

    // 再勾第三行:计数与"全选"必须同时跟上来(两处不同步就是分叉)
    fireEvent.click(checkbox(ID_C))
    expect(groupLabel()).toBe(countLabel(3))
    expect(screen.getByTestId('batch-select-all').getAttribute('aria-checked')).toBe('true')
  })

  it('判据 3:行内复选框无障碍名带会话标题(只写"选择"脱离上下文不成立)', async () => {
    renderSidebar()
    await screen.findByText(TITLE_A)
    enterSelectionMode()
    expect(
      screen.getByRole('checkbox', { name: `${msg('chatHistory.select')} ${TITLE_A}` }),
    ).toBeTruthy()
  })

  it('判据 3:多选态开关是 aria-pressed 的切换按钮,且有无障碍名', async () => {
    renderSidebar()
    const toggle = await screen.findByTestId('conversation-select-toggle')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    // 已知缺口(不是本断言能证的):chatHistory.selectModeAriaLabel 尚未并进语言包
    // (登记在 .ihui-agent/tmp/i18n-pending-62.json,五语已译,等主会话串行并包),
    // 所以 msg() 现在回落成键名字符串 —— 本条只证明"开关确实挂了无障碍名 prop",
    // 不证明"用户读到的是本地化文案"。并包后同一条断言自动变成后者,无需改测试。
    expect((toggle.getAttribute('aria-label') ?? '').length).toBeGreaterThan(0)
  })

  it('批量归档走 api-client 唯一出口,ids 就是当前可见选中集', async () => {
    renderSidebar()
    await screen.findByText(TITLE_A)
    enterSelectionMode()
    fireEvent.click(screen.getByTestId('batch-select-all'))
    fireEvent.click(screen.getByTestId('batch-archive'))

    await waitFor(() => expect(h.batchSpy).toHaveBeenCalledTimes(1))
    const call = h.batchSpy.mock.calls[0] as [string, string[]]
    expect(call[0]).toBe('archive')
    expect([...call[1]].sort()).toEqual(CONVERSATIONS.map((c) => c.id).sort())
  })

  it('批量删除要二次确认;确认后才发请求,成功即清空选中', async () => {
    renderSidebar()
    await screen.findByText(TITLE_A)
    enterSelectionMode()
    fireEvent.click(checkbox(ID_A))

    fireEvent.click(screen.getByTestId('batch-delete-btn'))
    // 确认框出现时**尚未**发请求 —— 删除不可逆,不能一键直达
    expect(h.batchSpy).not.toHaveBeenCalled()
    const dialog = await screen.findByRole('dialog')
    expect((dialog.textContent ?? '').trim()).toContain(
      msg('chatHistory.confirmBatchDelete', { count: 1 }),
    )

    fireEvent.click(screen.getByTestId('confirm-button'))
    await waitFor(() => expect(h.batchSpy).toHaveBeenCalledWith('delete', [ID_A]))
    await waitFor(() => expect(groupLabel()).toBe(countLabel(0)))
  })

  it('未勾选任何项时批量动作不可用;取消选择始终可用(否则进了多选态出不来)', async () => {
    renderSidebar()
    await screen.findByText(TITLE_A)
    enterSelectionMode()

    expect(screen.getByTestId('batch-archive').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('batch-delete-btn').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('batch-invert').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('batch-cancel').hasAttribute('disabled')).toBe(false)
  })

  it('"取消选择"只清选中、不退出多选态', async () => {
    renderSidebar()
    await screen.findByText(TITLE_A)
    enterSelectionMode()
    fireEvent.click(checkbox(ID_A))
    expect(groupLabel()).toBe(countLabel(1))

    fireEvent.click(screen.getByTestId('batch-cancel'))

    expect(groupLabel()).toBe(countLabel(0))
    expect(screen.getByTestId('conversation-batch-bar')).toBeTruthy()
  })

  it('多选态下点击整行 = 勾选,不再跳转对话(否则批量勾选会一路换页)', async () => {
    renderSidebar()
    await screen.findByText(TITLE_A)
    enterSelectionMode()
    fireEvent.click(screen.getByText(TITLE_A))

    expect(h.openPanelSpy).not.toHaveBeenCalled()
    expect(h.setConversationIdSpy).not.toHaveBeenCalled()
    expect(groupLabel()).toBe(countLabel(1))
  })

  it('非多选态下点击整行仍按原语义跳转(本次改动没有改掉既有行为)', async () => {
    renderSidebar()
    await screen.findByText(TITLE_A)
    fireEvent.click(screen.getByText(TITLE_A))

    expect(h.setConversationIdSpy).toHaveBeenCalledWith(ID_A)
    expect(h.openPanelSpy).toHaveBeenCalledTimes(1)
  })

  it('搜索与多选叠加:筛窄后全选只勾可见项(不会把看不见的会话一起删)', async () => {
    renderSidebar()
    await screen.findByText(TITLE_A)
    typeSearch(openSearch(), 'q3')
    enterSelectionMode()
    fireEvent.click(screen.getByTestId('batch-select-all'))
    fireEvent.click(screen.getByTestId('batch-archive'))

    await waitFor(() => expect(h.batchSpy).toHaveBeenCalledTimes(1))
    expect((h.batchSpy.mock.calls[0] as [string, string[]])[1]).toEqual([ID_A])
  })

  it('反选只在可见集合内取补:搜索态下 1 项全选后反选得空集', async () => {
    renderSidebar()
    await screen.findByText(TITLE_A)
    typeSearch(openSearch(), 'q3')
    enterSelectionMode()
    fireEvent.click(screen.getByTestId('batch-select-all'))
    expect(groupLabel()).toBe(countLabel(1))

    fireEvent.click(screen.getByTestId('batch-invert'))
    expect(groupLabel()).toBe(countLabel(0))
  })

  it('动作在飞时动作条禁用,避免两个批量写并行打架', async () => {
    let release: (v: unknown) => void = () => {}
    h.batchSpy.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve
        }),
    )
    renderSidebar()
    await screen.findByText(TITLE_A)
    enterSelectionMode()
    fireEvent.click(screen.getByTestId('batch-select-all'))
    fireEvent.click(screen.getByTestId('batch-archive'))

    await waitFor(() => expect(h.batchSpy).toHaveBeenCalled())
    expect(screen.getByTestId('batch-delete-btn').hasAttribute('disabled')).toBe(true)

    await act(async () => {
      release({ success: true, data: { action: 'archive', affected: 3 } })
    })
    await waitFor(() => expect(h.successSpy).toHaveBeenCalled())
    expect(screen.getByTestId('batch-delete-btn').hasAttribute('disabled')).toBe(false)
  })

  it('出口报失败时把服务端文案交给 toast,不静默成功', async () => {
    h.batchSpy.mockResolvedValue({ success: false, error: '单次最多 100 个对话' })
    renderSidebar()
    await screen.findByText(TITLE_A)
    enterSelectionMode()
    fireEvent.click(screen.getByTestId('batch-select-all'))
    fireEvent.click(screen.getByTestId('batch-archive'))

    await waitFor(() => expect(h.errorSpy).toHaveBeenCalledWith('单次最多 100 个对话'))
    expect(h.successSpy).not.toHaveBeenCalled()
  })
})

describe('D187/D188/D189/D190:侧栏补格四票(挂载级,语言包真值)', () => {
  /** 翻页夹具:pageSize 固定 2,D190 用 total=40 造出"有下一页" */
  const PAGE = (conversations: unknown[], total: number, page: number) => ({
    success: true,
    data: { conversations, total, page, pageSize: 2 },
  })
  /** D189:后端返回序中的置顶行(排在普通行 A 之后、普通行 B 之前) */
  const PINNED_CONV = {
    id: '44444444-4444-4444-8444-444444444444',
    title: '置顶会话',
    model: 'gpt-4o',
    lastMessageAt: '',
    messageCount: 1,
    pinned: true,
  }
  const PINNED_TITLE = PINNED_CONV.title
  const ALL_TITLES = [TITLE_A, TITLE_B, PINNED_TITLE]

  /** 行序读取:按 li 的 DOM 顺序映射回会话标题(分组头是 div,不影响 li 顺序) */
  const rowTitles = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('ul li')).map((li) =>
      ALL_TITLES.find((title) => (li.textContent ?? '').includes(title)),
    )

  /**
   * 打开 Radix DropdownMenu:happy-dom 下 pointer 事件序列不可靠,
   * 走键盘路径(Enter)—— Radix 触发器的正规 a11y 打开方式。
   */
  const openDropdown = (trigger: HTMLElement) => {
    fireEvent.keyDown(trigger, { key: 'Enter' })
    fireEvent.click(trigger)
  }

  it('D187:菜单「标记为未读」→ 成功 toast + 行内圆点;打开该会话即清除', async () => {
    renderSidebar()
    await screen.findByText(TITLE_A)

    openDropdown(screen.getAllByTestId('conversation-more-menu')[0] as HTMLElement)
    fireEvent.click(screen.getByTestId('conversation-mark-unread-action'))

    await waitFor(() =>
      expect(h.successSpy).toHaveBeenCalledWith(msg('chatHistory.markUnreadSuccess')),
    )
    const dot = screen.getByTestId('conversation-marked-unread')
    expect(dot.getAttribute('aria-label')).toBe(msg('chatHistory.markUnreadSuccess'))
    expect(dot.querySelector('span[aria-hidden]')).toBeTruthy()

    // 打开会话 = 已读:圆点从 DOM 消失
    fireEvent.click(screen.getByText(TITLE_A))
    await waitFor(() => expect(screen.queryByTestId('conversation-marked-unread')).toBeNull())
  })

  it('D188:当前会话流式运行中 → 行内「执行中」徽标(shared 既有词汇);未运行不渲染', async () => {
    if (h.chatState) {
      h.chatState.conversationId = ID_A
      h.chatState.isStreaming = true
    }
    const { view } = renderSidebar()
    await screen.findByText(TITLE_A)

    const badge = screen.getByTestId('attention-badge-running')
    expect(badge.textContent).toContain(ACTIVITY_RUNNING)
    expect(badge.getAttribute('aria-label')).toBe(ACTIVITY_RUNNING)
    // 停止运行(mock 状态翻转 + rerender)→ 徽标消失
    if (h.chatState) h.chatState.isStreaming = false
    view.rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <SidebarChatHistory collapsed={false} />
      </QueryClientProvider>,
    )
    expect(screen.queryByTestId('attention-badge-running')).toBeNull()
  })

  it('D189:排序切换器 — 默认置顶优先把 pinned 行提顶;选「按时间」恢复后端返回序', async () => {
    const fetchApiMock = fetchApi as unknown as Mock
    // 后端返回序:[普通A, 置顶, 普通B](按 lastMessageAt desc 的真实后端序)
    fetchApiMock.mockImplementationOnce(async () => PAGE([CONV_A, PINNED_CONV, CONV_B], 3, 1))
    const { view } = renderSidebar()
    const container = view.container
    await screen.findByText(TITLE_A)

    // 默认 = 置顶优先(既有行为):置顶行提到最前
    expect(rowTitles(container)).toEqual([PINNED_TITLE, TITLE_A, TITLE_B])

    openDropdown(screen.getByTestId('conversation-sort-toggle'))
    fireEvent.click(screen.getByText(msg('chatHistory.sorting.byTime')))
    expect(rowTitles(container)).toEqual([TITLE_A, PINNED_TITLE, TITLE_B])

    // 切回「置顶优先」恢复既有排序
    openDropdown(screen.getByTestId('conversation-sort-toggle'))
    fireEvent.click(screen.getByText(msg('chatHistory.sorting.pinnedFirst')))
    expect(rowTitles(container)).toEqual([PINNED_TITLE, TITLE_A, TITLE_B])
  })

  it('D190:翻页中显示「正在加载…」;翻页失败保留列表并出现「重试加载」,点重试恢复', async () => {
    const fetchApiMock = fetchApi as unknown as Mock
    // 首屏成功(total=40 ⇒ 有下一页);第二页先挂起后失败;重试成功
    fetchApiMock.mockImplementationOnce(async () => PAGE([CONV_A], 40, 1))
    let releaseSecondPage: (v: unknown) => void = () => {}
    fetchApiMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseSecondPage = resolve
        }),
    )
    const { view } = renderSidebar()
    const container = view.container
    await screen.findByText(TITLE_A)

    // 滚动到底(happy-dom 布局面积为 0,条件恒真)触发翻页 → 加载中文案出现
    fireEvent.scroll(container.querySelector('.thin-scroll') as HTMLElement)
    expect(await screen.findByText(msg('chatHistory.loadingMore'))).toBeTruthy()

    // 翻页失败:error 置位但 data 保留 → 列表不被整块替换,底部出重试入口
    releaseSecondPage({ success: false, error: '翻页失败' })
    await waitFor(() => expect(screen.getByTestId('conversation-load-more-retry')).toBeTruthy())
    expect(screen.getByText(TITLE_A)).toBeTruthy()

    // 点重试 → 第三次调用成功返回下一页(每页纯增量,flatMap 累积)→ 重试入口消失
    fetchApiMock.mockImplementationOnce(async () => PAGE([CONV_B], 40, 2))
    fireEvent.click(screen.getByTestId('conversation-load-more-retry'))
    await screen.findByText(TITLE_B)
    expect(screen.queryByTestId('conversation-load-more-retry')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
