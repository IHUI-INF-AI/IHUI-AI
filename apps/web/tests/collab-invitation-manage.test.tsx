// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D125 邀请收件箱 + 邀请管理面板组件测试(2026-10-23 另批收口,设计稿 §6/§7)。
 *
 * 覆盖:收件箱渲染待处理邀请/接受调用与出声/空列表不渲染/`collab:invitation` 帧失效重取;
 * 管理面板折叠门控(未点开不发查询)、名单渲染、档位 PATCH、撤销 confirm 门与 revoked 行收口、
 * 发言锁三态(空麦抢麦 / 他人持麦接管 / 本人持麦交麦)、`collab:lock` 帧失效重取(含跨会话不误触)。
 * mock 模式与 conversation-import-panel.test.tsx 同款(next-intl / api-client / ui-react 全隔离);
 * 断言一律用原生 DOM API —— 本仓库未安装 @testing-library/jest-dom(见 task-status-bar.test.tsx 同注)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { CollabInvitationInbox } from '../src/components/chat/collab/CollabInvitationInbox'
import { CollabManagePanel } from '../src/components/chat/collab/CollabManagePanel'

const {
  mockT,
  IconSpan,
  UiButton,
  toastSuccess,
  toastError,
  subscribeMock,
  capturedHandlers,
  listInvitationsMock,
  acceptInvitationMock,
  listCollaboratorsMock,
  updateTierMock,
  revokeMock,
  getLockMock,
  acquireLockMock,
  releaseLockMock,
  authStoreMock,
} = vi.hoisted(() => {
  const map: Record<string, string> = {
    invitationAccept: '接受邀请',
    invitationAcceptDone: '已接受邀请',
    invitationAccepting: '接受中…',
    invitationConversation: '会话',
    invitationInvitedBy: '邀请人',
    invitationTitle: '待处理协作邀请',
    collaboratorsEmpty: '暂无协作者',
    collaboratorsTitle: '协作者',
    lockAcquire: '开始发言',
    lockFree: '当前无人发言',
    lockHeldBy: '{user} 正在发言',
    lockRelease: '交麦',
    lockTakeover: '接管发言',
    lockTitle: '发言锁',
    manageTitle: '协作管理',
    revoke: '撤销',
    revokeConfirm: '确定撤销该协作者？',
    statusAccepted: '已接受',
    statusPending: '待接受',
    statusRevoked: '已撤销',
    tierAcceptEdits: '接受编辑（可发言）',
    tierBypassPermissions: '绕过权限（可发言）',
    tierDefault: '默认档（可发言）',
    tierLabel: '权限档',
    tierPlan: '只读+评论',
    tierUpdated: '档位已更新',
    tierUpdateFailed: '档位更新失败',
    you: '你',
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

  const UiButton = ({ children, ...rest }: React.ComponentProps<'button'>) => (
    <button type="button" {...rest}>
      {children}
    </button>
  )

  const toastSuccess = vi.fn()
  const toastError = vi.fn()
  const capturedHandlers: Array<Record<string, (evt: { data: Record<string, unknown> }) => void>> =
    []
  const subscribeMock = vi.fn(
    (
      _config: unknown,
      handlers: Record<string, (evt: { data: Record<string, unknown> }) => void>,
    ) => {
      capturedHandlers.push(handlers)
      return { close: vi.fn() }
    },
  )
  const listInvitationsMock = vi.fn()
  const acceptInvitationMock = vi.fn()
  const listCollaboratorsMock = vi.fn()
  const updateTierMock = vi.fn()
  const revokeMock = vi.fn()
  const getLockMock = vi.fn()
  const acquireLockMock = vi.fn()
  const releaseLockMock = vi.fn()

  // zustand store 的 hook + getState 双形态(组件里两种都在用)
  const authState = { user: { id: 'me-1' }, token: 'tok' }
  const authStoreMock = ((selector: (s: typeof authState) => unknown) => selector(authState)) as ((
    selector: (s: typeof authState) => unknown,
  ) => unknown) & {
    getState: () => typeof authState
  }
  authStoreMock.getState = () => authState

  return {
    mockT,
    IconSpan,
    UiButton,
    toastSuccess,
    toastError,
    subscribeMock,
    capturedHandlers,
    listInvitationsMock,
    acceptInvitationMock,
    listCollaboratorsMock,
    updateTierMock,
    revokeMock,
    getLockMock,
    acquireLockMock,
    releaseLockMock,
    authStoreMock,
  }
})

vi.mock('next-intl', () => ({
  useTranslations: () => mockT,
}))

vi.mock('@ihui/api-client', () => ({
  subscribeUserBroadcast: subscribeMock,
  listMyCollaboratorInvitations: listInvitationsMock,
  acceptCollaboratorInvitation: acceptInvitationMock,
  listConversationCollaborators: listCollaboratorsMock,
  updateConversationCollaboratorTier: updateTierMock,
  revokeConversationCollaborator: revokeMock,
  getConversationCollabLock: getLockMock,
  acquireConversationCollabLock: acquireLockMock,
  releaseConversationCollabLock: releaseLockMock,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: authStoreMock,
}))

vi.mock('@/components/common', () => ({
  toast: { success: toastSuccess, error: toastError },
}))

vi.mock('@ihui/ui-react', () => ({
  Button: UiButton,
  // useConfirm 的 ConfirmDialog 走这套 Dialog 家族(原生 confirm() 已被 AGENTS §4 禁用);
  // 透传壳只保留可点性,Radix 的焦点/portal 语义与本次断言无关。
  Dialog: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('lucide-react', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    __esModule: true,
    ...actual,
    ChevronDown: IconSpan,
    ChevronRight: IconSpan,
    Inbox: IconSpan,
    Loader2: IconSpan,
    Mic: IconSpan,
    Users: IconSpan,
  }
})

const INVITATION_ROW = {
  conversationId: 'c-1',
  invitationId: 'i-1',
  invitedBy: 'owner-9',
  tier: 'plan',
  createdAt: '2026-10-23T00:00:00.000Z',
}

const COLLABORATOR_ROWS = [
  {
    id: 'row-1',
    conversationId: 'c-1',
    userId: 'u-2',
    invitedBy: 'me-1',
    tier: 'plan',
    status: 'accepted' as const,
    createdAt: '2026-10-23T00:00:00.000Z',
    updatedAt: '2026-10-23T00:00:00.000Z',
  },
  {
    id: 'row-2',
    conversationId: 'c-1',
    userId: 'u-3',
    invitedBy: 'me-1',
    tier: 'plan',
    status: 'revoked' as const,
    createdAt: '2026-10-23T00:00:00.000Z',
    updatedAt: '2026-10-23T00:00:00.000Z',
  },
]

/** 每个用例独立 QueryClient(关 retry)+ invalidate 侦测 */
function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
  const wrapper = ({ children }: { children?: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  render(ui, { wrapper })
  return { invalidateSpy }
}

beforeEach(() => {
  capturedHandlers.length = 0
  toastSuccess.mockReset()
  toastError.mockReset()
  listInvitationsMock.mockReset().mockResolvedValue({
    success: true,
    data: { invitations: [INVITATION_ROW] },
  })
  acceptInvitationMock.mockReset().mockResolvedValue({
    success: true,
    data: { collaborator: { ...COLLABORATOR_ROWS[0] } },
  })
  listCollaboratorsMock.mockReset().mockResolvedValue({
    success: true,
    data: { collaborators: COLLABORATOR_ROWS },
  })
  updateTierMock.mockReset().mockResolvedValue({
    success: true,
    data: { collaborator: { ...COLLABORATOR_ROWS[0], tier: 'accept-edits' } },
  })
  revokeMock.mockReset().mockResolvedValue({ success: true, data: { revoked: true } })
  getLockMock.mockReset().mockResolvedValue({ success: true, data: { lock: null } })
  acquireLockMock.mockReset().mockResolvedValue({
    success: true,
    data: {
      lock: { holderUserId: 'me-1', acquiredAt: '2026-10-23T00:00:00.000Z' },
      takenFrom: null,
    },
  })
  releaseLockMock.mockReset().mockResolvedValue({ success: true, data: { released: true } })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('CollabInvitationInbox — 待处理邀请与接受出口', () => {
  it('渲染待处理邀请,点接受调端点并成功出声', async () => {
    renderWithQuery(<CollabInvitationInbox />)
    const box = await screen.findByTestId('collab-invitation-inbox')
    expect(box.textContent).toContain('待处理协作邀请')
    expect(box.textContent).toContain('c-1')
    expect(box.textContent).toContain('owner-9')
    expect(box.textContent).toContain('只读+评论')

    fireEvent.click(screen.getByText('接受邀请'))
    await waitFor(() => expect(acceptInvitationMock).toHaveBeenCalledWith('c-1'))
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('已接受邀请'))
  })

  it('空邀请列表不渲染(面板头部保持安静)', async () => {
    listInvitationsMock.mockResolvedValue({ success: true, data: { invitations: [] } })
    renderWithQuery(<CollabInvitationInbox />)
    await waitFor(() => expect(listInvitationsMock).toHaveBeenCalled())
    expect(screen.queryByTestId('collab-invitation-inbox')).toBeNull()
  })

  it('collab:invitation 帧 ⇒ 失效重取邀请列表(拉取制)', async () => {
    const { invalidateSpy } = renderWithQuery(<CollabInvitationInbox />)
    await waitFor(() => expect(capturedHandlers.length).toBeGreaterThan(0))
    const handlers = capturedHandlers[capturedHandlers.length - 1]
    handlers['collab:invitation']({
      data: { conversationId: 'c-1', invitationId: 'i-1', invitedBy: 'owner-9', state: 'pending' },
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['chat', 'collab-invitations'],
    })
  })
})

describe('CollabManagePanel — 名单/档位/撤销/发言锁管理面', () => {
  it('折叠门控:未点开不发名单与锁查询,点开后渲染两行', async () => {
    renderWithQuery(<CollabManagePanel conversationId="c-1" />)
    expect(listCollaboratorsMock).not.toHaveBeenCalled()
    expect(getLockMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('协作管理'))
    await waitFor(() => expect(listCollaboratorsMock).toHaveBeenCalledWith('c-1'))
    await waitFor(() => expect(getLockMock).toHaveBeenCalledWith('c-1'))
    expect(await screen.findAllByTestId('collab-collaborator-row')).toHaveLength(2)
  })

  it('档位下拉 ⇒ PATCH 端点;revoked 行下拉禁用且无撤销钮', async () => {
    renderWithQuery(<CollabManagePanel conversationId="c-1" />)
    fireEvent.click(screen.getByText('协作管理'))
    const selects = await screen.findAllByTestId('collab-tier-select')
    expect((selects[0] as HTMLSelectElement).value).toBe('plan')
    expect((selects[1] as HTMLSelectElement).disabled).toBe(true)

    fireEvent.change(selects[0], { target: { value: 'accept-edits' } })
    await waitFor(() => expect(updateTierMock).toHaveBeenCalledWith('c-1', 'u-2', 'accept-edits'))
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('档位已更新'))
    // 只有 accepted 的 u-2 行有撤销钮,revoked 的 u-3 行没有
    expect(screen.getAllByTestId('collab-revoke-button')).toHaveLength(1)
  })

  it('撤销走 confirm 门 ⇒ DELETE 端点', async () => {
    renderWithQuery(<CollabManagePanel conversationId="c-1" />)
    fireEvent.click(screen.getByText('协作管理'))
    const revokeBtn = await screen.findByTestId('collab-revoke-button')
    fireEvent.click(revokeBtn)
    // 门是项目自有 ConfirmDialog(原生 confirm 被 AGENTS §4 禁用):先出对话框,点确认才发请求
    expect(await screen.findByText('确定撤销该协作者？')).toBeTruthy()
    expect(revokeMock).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('confirm'))
    await waitFor(() => expect(revokeMock).toHaveBeenCalledWith('c-1', 'u-2'))
  })

  it('空麦:显示无人发言,抢麦走 acquire(takeover=false)', async () => {
    renderWithQuery(<CollabManagePanel conversationId="c-1" />)
    fireEvent.click(screen.getByText('协作管理'))
    expect((await screen.findByTestId('collab-lock-holder')).textContent).toContain('当前无人发言')
    fireEvent.click(screen.getByText('开始发言'))
    await waitFor(() => expect(acquireLockMock).toHaveBeenCalledWith('c-1', { takeover: false }))
  })

  it('他人持麦:点名持麦人并给接管入口,acquire(takeover=true)', async () => {
    getLockMock.mockResolvedValue({
      success: true,
      data: { lock: { holderUserId: 'u-9', acquiredAt: '2026-10-23T00:00:00.000Z' } },
    })
    renderWithQuery(<CollabManagePanel conversationId="c-1" />)
    fireEvent.click(screen.getByText('协作管理'))
    expect((await screen.findByTestId('collab-lock-holder')).textContent).toContain('u-9 正在发言')
    fireEvent.click(screen.getByText('接管发言'))
    await waitFor(() => expect(acquireLockMock).toHaveBeenCalledWith('c-1', { takeover: true }))
  })

  it('本人持麦:显示"你"并给交麦入口 ⇒ release 端点', async () => {
    getLockMock.mockResolvedValue({
      success: true,
      data: { lock: { holderUserId: 'me-1', acquiredAt: '2026-10-23T00:00:00.000Z' } },
    })
    renderWithQuery(<CollabManagePanel conversationId="c-1" />)
    fireEvent.click(screen.getByText('协作管理'))
    expect((await screen.findByTestId('collab-lock-holder')).textContent).toContain('你 正在发言')
    fireEvent.click(screen.getByText('交麦'))
    await waitFor(() => expect(releaseLockMock).toHaveBeenCalledWith('c-1'))
  })

  it('collab:lock 帧命中本会话才失效麦查询(跨会话不误触)', async () => {
    const { invalidateSpy } = renderWithQuery(<CollabManagePanel conversationId="c-1" />)
    fireEvent.click(screen.getByText('协作管理'))
    await waitFor(() => expect(capturedHandlers.length).toBeGreaterThan(0))
    const handlers = capturedHandlers[capturedHandlers.length - 1]
    invalidateSpy.mockClear()

    handlers['collab:lock']({
      data: { conversationId: 'other', holderUserId: 'u-9', state: 'acquired' },
    })
    expect(invalidateSpy).not.toHaveBeenCalled()

    handlers['collab:lock']({
      data: { conversationId: 'c-1', holderUserId: 'u-9', state: 'taken' },
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['chat', 'collab-lock', 'c-1'] })
  })
})
