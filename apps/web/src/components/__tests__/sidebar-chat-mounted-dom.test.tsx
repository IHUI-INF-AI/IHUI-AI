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

function msg(path: string, vars?: Record<string, number | string>): string {
  let cur: unknown = pack
  for (const s of path.split('.')) {
    if (cur && typeof cur === 'object') cur = (cur as Record<string, unknown>)[s]
    else return path
  }
  if (typeof cur !== 'string') return path
  return vars ? cur.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')) : cur
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

function renderSidebar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SidebarChatHistory collapsed={false} />
    </QueryClientProvider>,
  )
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
