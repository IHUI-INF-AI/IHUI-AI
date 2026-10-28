// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
//
// /chat/workbench 壳接线契约(2026-10-28 立):
//  ① 有会话 ⇒ 中央必须挂既有内核 ChatPaneBody(paneId=WORKBENCH_PANE_ID),壳不另画消息流;
//  ② 无深链 + 列表就绪 ⇒ 自动续接"最近一条"(置顶优先),走 URL 而非旁路 state;
//  ③ 无会话可续(空列表)⇒ 新任务引导只走 URL,不挂第二条发送链路;
//  ④ rail 点击 ⇒ router.push 到 spec 拼出的深链(视图不私拼串);
//  ⑤ 进入工作台收起停靠侧栏(同屏两份内核会并排显示同一会话)。
// 内核件/取数/面板 store 全部 mock:本档钉的是"壳怎么接线",不是内核自己的测试面。
import * as React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const pushSpy = vi.hoisted(() => vi.fn())
const replaceSpy = vi.hoisted(() => vi.fn())
const closePanelSpy = vi.hoisted(() => vi.fn())
const panelOpenRef = vi.hoisted(() => ({ current: true }))
const conversationsRef = vi.hoisted(() => ({
  data: undefined as undefined | { conversations: Array<Record<string, unknown>> },
  isLoading: false,
}))

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  useLocale: () => 'zh-CN',
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushSpy, replace: replaceSpy }),
}))

vi.mock('@/components/ai/chat-pane-body', () => ({
  ChatPaneBody: (props: { paneId: string; conversationId: string }) => (
    <div data-chat-pane-body="" data-pane-id={props.paneId} data-conv-id={props.conversationId} />
  ),
}))

const paneStoreSetStateSpy = vi.hoisted(() => vi.fn())
vi.mock('@/stores/chat-pane-context', () => ({
  ChatPaneProvider: (props: { children: React.ReactNode }) => <>{props.children}</>,
  // 新任务 pane 的清台 effect 会调 store.setState;mock 面留 spy 给 ⑥b
  usePaneChatStore: () => {
    const selector = <T,>(_fn: (s: unknown) => T) => undefined as T
    return Object.assign(selector, { setState: paneStoreSetStateSpy })
  },
}))

// 新任务 pane 的内核依赖:mock 后钉"本 pane 只把 useChat 出口递给输入面"这一条接线
const sendSpy = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-chat', () => ({
  useChat: () => ({
    messages: [] as unknown[],
    isStreaming: false,
    currentModel: 'model-x',
    sendMessage: sendSpy,
    stop: vi.fn(),
    setModel: vi.fn(),
  }),
}))
vi.mock('@/components/chat/message-input', () => ({
  MessageInput: (props: { onSend: (text: string) => unknown }) => (
    <button type="button" data-fake-send="" onClick={() => props.onSend('hello')}>
      send
    </button>
  ),
}))
vi.mock('@/components/ai/context-usage-ring', () => ({
  ContextUsageRing: (props: { model: string }) => (
    <div data-fake-ring="" data-model={props.model} />
  ),
}))

// rail 一档升级(搜索+分组)的三枚依赖:判定层出口走近似 stub(真件在 sidebar 自有测试族),
// 本壳测只钉"连线在位 + 输入过滤联动渲染"。
vi.mock('@/components/sidebar-chat-history', () => ({
  filterConversationsByKeyword: <T extends { title: string }>(items: readonly T[], kw: string) =>
    kw ? items.filter((i) => i.title.toLowerCase().includes(kw.toLowerCase())) : [...items],
  groupByDate: (items: unknown[]) => [{ key: 'today', items: items as [] }],
}))
vi.mock('@/components/chat/mode-switcher', () => ({
  ModeSwitcher: () => <div data-fake-mode-switcher="" />,
}))
vi.mock('@/components/chat/message-list/MessageList', () => ({
  MessageList: () => <div data-fake-list="" />,
}))

// 片B 分屏接线:布局树 store/同步钩子/容器三件 mock —— 容器行为自有测试族
// (pane-split-container.test.tsx 17 例),壳测只钉"壳把委托面接上、叶数决定形态"。
const paneTreeRef = vi.hoisted(() => ({
  current: { kind: 'leaf', id: 'pane-root', conversationId: null } as unknown,
}))
const splitPaneSpy = vi.hoisted(() => vi.fn())
const dropConversationSpy = vi.hoisted(() => vi.fn())
vi.mock('@/stores/pane-split', () => {
  const state = () => ({
    tree: paneTreeRef.current,
    splitPane: splitPaneSpy,
    dropConversation: dropConversationSpy,
  })
  // zustand bound store 形:selector 调用 + getState 命令面,同一份 state 读数
  const useStore = Object.assign(
    (selector: (s: ReturnType<typeof state>) => unknown) => selector(state()),
    { getState: state },
  )
  return { usePaneSplitStore: useStore, rehydratePaneSplitLayout: vi.fn() }
})
vi.mock('@/hooks/use-chat-pane-sync', () => ({ useChatPaneSync: vi.fn() }))
vi.mock('@/components/ai/pane-split-container', () => ({
  PaneSplitContainer: (props: {
    renderPaneContent: (conv: string | null, paneId: string) => React.ReactNode
  }) => (
    <div data-fake-split="">
      {props.renderPaneContent('leaf-2-conv', 'leaf-2')}
      {props.renderPaneContent(null, 'leaf-empty')}
    </div>
  ),
  PANE_DROP_CONVERSATION_TYPE: 'application/x-ihui-conversation',
}))

// rail 二档(行菜单)依赖:动作出口 stub(真件有共享测试面) + Radix 族/ConfirmDialog 轻量桩
const rowActionMutateSpy = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-conversation-row-actions', () => ({
  useConversationRowActions: () => ({
    invalidateAll: vi.fn(),
    deleteMutation: { mutate: rowActionMutateSpy },
    favMutation: { mutate: rowActionMutateSpy },
    pinMutation: { mutate: rowActionMutateSpy },
    archiveMutation: { mutate: rowActionMutateSpy },
    unarchiveMutation: { mutate: rowActionMutateSpy },
    renameMutation: { mutate: rowActionMutateSpy },
  }),
}))
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: (props: { children: React.ReactNode }) => <>{props.children}</>,
  DropdownMenuTrigger: (props: { children: React.ReactNode }) => <>{props.children}</>,
  DropdownMenuContent: (props: { children: React.ReactNode }) => (
    <div data-fake-menu="">{props.children}</div>
  ),
  DropdownMenuItem: (props: { children: React.ReactNode }) => (
    <button type="button">{props.children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
}))
vi.mock('@/components/feedback/ConfirmDialog', () => ({
  ConfirmDialog: () => <div data-fake-confirm="" />,
}))
// PromptTemplates(欢迎面 chips)内核件内部吃 TooltipProvider,壳测桩之:
// 本测只钉"欢迎面在位 + onPrefill 出口",chips 行为自有挂载测试族
vi.mock('@/components/ai/prompt-templates', () => ({
  PromptTemplates: (props: { templates: Array<{ id: string; name: string }> }) => (
    <div data-fake-chips="" data-count={props.templates.length} />
  ),
}))

vi.mock('@/stores/ai-panel', () => ({
  useAiPanelStore: {
    getState: () => ({ open: panelOpenRef.current, closePanel: closePanelSpy }),
  },
}))

vi.mock('@/components/chat/workbench/use-workbench-conversations', () => ({
  useWorkbenchConversations: () => conversationsRef.current,
}))

vi.mock('@ihui/ui-react', () => ({
  Button: (props: {
    children?: React.ReactNode
    onClick?: () => void
    className?: string
    'aria-label'?: string
    title?: string
  }) => (
    <button
      type="button"
      className={props.className}
      onClick={props.onClick}
      aria-label={props['aria-label']}
      title={props.title}
    >
      {props.children}
    </button>
  ),
  SearchInput: (props: {
    value: string
    onChange: (e: { target: { value: string } }) => void
    placeholder?: string
  }) => (
    <input
      data-fake-search=""
      value={props.value}
      placeholder={props.placeholder}
      onChange={props.onChange}
    />
  ),
  Dialog: (props: { children: React.ReactNode; open?: boolean }) =>
    props.open ? <div data-fake-dialog="">{props.children}</div> : null,
  DialogContent: (props: { children: React.ReactNode }) => <>{props.children}</>,
  DialogHeader: (props: { children: React.ReactNode }) => <>{props.children}</>,
  DialogTitle: (props: { children: React.ReactNode }) => <>{props.children}</>,
  Input: (props: { id?: string; value?: string; onChange?: unknown }) => (
    <input id={props.id} defaultValue={props.value} />
  ),
}))

import { WORKBENCH_PANE_ID, WORKBENCH_ROUTE } from '@ihui/shared/ui/chat-workbench-shell-spec'
import { WorkbenchShell } from '@/components/chat/workbench/workbench-shell'

function conv(
  id: string,
  opts: Partial<{ title: string; pinned: boolean; lastMessageAt: string }> = {},
) {
  return {
    id,
    title: opts.title ?? `会话-${id}`,
    model: 'm',
    lastMessageAt: opts.lastMessageAt ?? '2026-10-28T00:00:00.000Z',
    messageCount: 1,
    favorite: false,
    pinned: opts.pinned ?? false,
  }
}

afterEach(() => {
  cleanup()
  pushSpy.mockClear()
  replaceSpy.mockClear()
  closePanelSpy.mockClear()
  sendSpy.mockClear()
  paneStoreSetStateSpy.mockClear()
  splitPaneSpy.mockClear()
  dropConversationSpy.mockClear()
  rowActionMutateSpy.mockClear()
  panelOpenRef.current = true
  conversationsRef.current = { data: undefined, isLoading: false }
  paneTreeRef.current = { kind: 'leaf', id: 'pane-root', conversationId: null }
})

describe('workbench 壳接线', () => {
  it('① 有会话:中央挂 ChatPaneBody 内核(paneId 走 spec 常量,与根窗格不同域)', () => {
    conversationsRef.current = { data: { conversations: [conv('c1')] }, isLoading: false }
    render(<WorkbenchShell conversationId="c1" />)
    const body = screen.getByTestId ? document.querySelector('[data-chat-pane-body]') : null
    expect(body).not.toBeNull()
    expect(body!.getAttribute('data-pane-id')).toBe(WORKBENCH_PANE_ID)
    expect(body!.getAttribute('data-conv-id')).toBe('c1')
  })

  it('② 深链缺省:数据就绪后自动续接最近会话(置顶压轴前),URL 走 spec 拼装', () => {
    conversationsRef.current = {
      data: {
        conversations: [
          conv('old'),
          conv('new'),
          conv('top', { pinned: true, lastMessageAt: '2026-01-01T00:00:00.000Z' }),
        ],
      },
      isLoading: false,
    }
    render(<WorkbenchShell conversationId={null} />)
    expect(replaceSpy).toHaveBeenCalledWith(`${WORKBENCH_ROUTE}?conversationId=top`)
    // 注:断言只钉"续接动作走 URL"这一条;渲染面何时从引导切到窗格,由"URL 是真相"的
    // 上层路由回灌决定(mock 的 router 不回灌 props,这里不越层猜两层行为)。
  })

  it('②b 空列表:不得出现自动续接的死循环 replace,落新任务引导', () => {
    conversationsRef.current = { data: { conversations: [] }, isLoading: false }
    render(<WorkbenchShell conversationId={null} />)
    expect(replaceSpy).not.toHaveBeenCalled()
    expect(document.querySelector('[data-workbench-new-task]')).not.toBeNull()
  })

  it('③ rail 点击:push 到该会话深链,不旁路写 state', () => {
    conversationsRef.current = {
      data: { conversations: [conv('a'), conv('b', { title: '会话-B' })] },
      isLoading: false,
    }
    render(<WorkbenchShell conversationId="a" />)
    const row = Array.from(document.querySelectorAll('button')).find((el) =>
      el.textContent?.includes('会话-B'),
    )
    expect(row).toBeDefined()
    row!.click()
    expect(pushSpy).toHaveBeenCalledWith(`${WORKBENCH_ROUTE}?conversationId=b`)
  })

  it('④ 挂载即收起停靠侧栏(open=false 时不动全局态)', async () => {
    panelOpenRef.current = false
    conversationsRef.current = { data: { conversations: [conv('c1')] }, isLoading: false }
    render(<WorkbenchShell conversationId="c1" />)
    await waitFor(() => expect(closePanelSpy).not.toHaveBeenCalled())
    panelOpenRef.current = true
    render(<WorkbenchShell conversationId="c1" />)
    await waitFor(() => expect(closePanelSpy).toHaveBeenCalled())
  })

  it('⑥ 新任务态:消息为空画欢迎面(指令卡+chips 内核件),发送直连 useChat 内核出口', () => {
    conversationsRef.current = { data: { conversations: [] }, isLoading: false }
    panelOpenRef.current = false
    render(<WorkbenchShell conversationId={null} />)
    expect(document.querySelector('[data-workbench-header]')).not.toBeNull()
    expect(document.querySelector('[data-fake-mode-switcher]')).not.toBeNull()
    expect(document.querySelector('[data-fake-ring]')?.getAttribute('data-model')).toBe('model-x')
    // 片D:空窗格 = WorkbenchWelcome(messages=[] 且未流式),不挂空 MessageList
    expect(document.querySelector('[data-workbench-welcome]')).not.toBeNull()
    expect(document.querySelector('[data-fake-list]')).toBeNull()
    const sendBtn = document.querySelector('[data-fake-send]')
    expect(sendBtn).not.toBeNull()
    sendBtn!.click()
    expect(sendSpy).toHaveBeenCalledWith('hello')
  })

  it('⑦ rail 一档升级:搜索框连线过滤(与侧栏同一把尺的出口),分桶标题渲染', () => {
    conversationsRef.current = {
      data: { conversations: [conv('a', { title: 'alpha' }), conv('b', { title: 'beta' })] },
      isLoading: false,
    }
    panelOpenRef.current = false
    render(<WorkbenchShell conversationId="a" />)
    expect(document.querySelector('[data-fake-search]')).not.toBeNull()
    expect(document.body.textContent).toContain('aiChat.today')
  })

  it('⑧ 片B 多叶树:主体换容器托管,委托渲染接真叶(有会话 Body/空叶拖入提示)', () => {
    paneTreeRef.current = {
      kind: 'split',
      direction: 'horizontal',
      sizes: [0.5, 0.5],
      children: [
        { kind: 'leaf', id: 'pane-root', conversationId: 'c1' },
        { kind: 'leaf', id: 'leaf-2', conversationId: 'x' },
      ],
    }
    conversationsRef.current = { data: { conversations: [conv('c1')] }, isLoading: false }
    panelOpenRef.current = false
    render(<WorkbenchShell conversationId="c1" />)
    expect(document.querySelector('[data-fake-split]')).not.toBeNull()
    // 委托面:非根有会话叶 ⇒ ChatPaneBody(paneId=叶 id);空叶 ⇒ 拖入提示(工作台自键)
    const body = document.querySelector('[data-chat-pane-body]')
    expect(body?.getAttribute('data-pane-id')).toBe('leaf-2')
    expect(document.querySelector('[data-pane-marker="leaf-empty"]')).not.toBeNull()
    expect(document.body.textContent).toContain('chat.workbenchDropHere')
    paneTreeRef.current = { kind: 'leaf', id: 'pane-root', conversationId: null }
  })

  it('⑨ 拆分按钮:根叶先登记承载(与侧栏 d73 同口径),再向右裂叶', () => {
    paneTreeRef.current = { kind: 'leaf', id: 'pane-root', conversationId: null }
    conversationsRef.current = { data: { conversations: [conv('c9')] }, isLoading: false }
    panelOpenRef.current = false
    render(<WorkbenchShell conversationId="c9" />)
    const splitBtn = Array.from(document.querySelectorAll('button')).find(
      (el) => el.getAttribute('aria-label') === 'chat.workbenchSplit',
    )
    expect(splitBtn).toBeDefined()
    splitBtn!.click()
    expect(dropConversationSpy).toHaveBeenCalledWith('pane-root', 'c9')
    expect(splitPaneSpy).toHaveBeenCalledWith('pane-root', 'right', null)
  })

  it('⑥b 点"新会话":URL 回纯路由 + pane store 清台(resetSeq>0 才清,首轮挂载不误清草稿)', () => {
    conversationsRef.current = {
      data: { conversations: [conv('c1'), conv('c2')] },
      isLoading: false,
    }
    panelOpenRef.current = false
    render(<WorkbenchShell conversationId="a" />)
    // 首挂载(resetSeq=0)不得清台
    expect(paneStoreSetStateSpy).not.toHaveBeenCalled()
    const newBtn = Array.from(document.querySelectorAll('button')).find((el) =>
      el.textContent?.includes('chat.newConversation'),
    )
    expect(newBtn).toBeDefined()
    newBtn!.click()
    expect(replaceSpy).toHaveBeenCalledWith(WORKBENCH_ROUTE)
    // 点新会话后 resetSeq=1 ⇒ WorkbenchNewTask(此处仍挂 body 档,清台发生在 new-task 挂载档)
    // 有会话时壳挂的是 ChatPaneBody 不是 new-task,故 setState 只在无深链档被验证(见 ⑥ 首挂载不清)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
