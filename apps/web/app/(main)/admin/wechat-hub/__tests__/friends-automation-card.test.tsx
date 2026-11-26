// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍‌​‌‌​‌‌‌​‌​​‌‌‌​‍‍‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 新朋友卡片：默认关闭时通过按钮不可用；确认弹窗通过后才带 confirmed:true 调 accept；
 * 审计区能渲染最近记录，空态写「暂无操作记录」；桥 disabled / failed 有独立文案。
 * 断言一律用原生 DOM API —— 本仓库未安装 @testing-library/jest-dom。
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FriendsAutomationCard from '../FriendsAutomationCard'
import { wechatHubApi } from '../wechat-hub-api'
import type { WechatFriendsOverview } from '@ihui/types'

const { confirmMock } = vi.hoisted(() => ({ confirmMock: vi.fn() }))

vi.mock('../wechat-hub-api', () => ({
  wechatHubApi: {
    friendsOverview: vi.fn(),
    acceptFriend: vi.fn(),
    updateFriendsPolicy: vi.fn(),
  },
}))

vi.mock('@/hooks/use-confirm', () => ({
  useConfirm: () => ({ confirm: confirmMock, ConfirmDialogRenderer: () => null }),
}))

vi.mock('@/components/feedback', () => ({
  Alert: ({ title, description }: { title?: string; description?: React.ReactNode }) => (
    <div data-testid="alert">
      {title ? <p>{title}</p> : null}
      {description ? <p>{description}</p> : null}
    </div>
  ),
}))

const BASE_AT = 1_764_000_000_000

function makeOverview(overrides: Partial<WechatFriendsOverview> = {}): WechatFriendsOverview {
  return {
    policy: { enabled: false, maxAcceptsPerHour: 5 },
    scan: {
      ok: true,
      status: 'ok',
      reason: null,
      requests: [],
      scannedAt: BASE_AT,
      rawCount: 0,
    },
    audit: [],
    ...overrides,
  }
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <FriendsAutomationCard accountId="account-1" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(wechatHubApi.friendsOverview).mockReset()
  vi.mocked(wechatHubApi.acceptFriend).mockReset()
  vi.mocked(wechatHubApi.updateFriendsPolicy).mockReset()
  confirmMock.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('FriendsAutomationCard', () => {
  it('策略关闭时显示关闭文案，通过按钮不可用且不发起请求', async () => {
    vi.mocked(wechatHubApi.friendsOverview).mockResolvedValue(
      makeOverview({
        scan: {
          ok: true,
          status: 'ok',
          reason: null,
          scannedAt: BASE_AT,
          rawCount: 1,
          requests: [
            {
              requestId: 'req-1',
              nickname: '张三',
              source: '二维码名片',
              kind: 'friend',
              clickable: true,
              seenAt: BASE_AT,
            },
          ],
        },
      }),
    )

    renderCard()

    await waitFor(() =>
      expect(screen.getByText('已关闭，开启后才会点客户端')).toBeTruthy(),
    )
    const button = screen.getByRole('button', { name: '通过' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(button)
    expect(wechatHubApi.acceptFriend).not.toHaveBeenCalled()
    expect(confirmMock).not.toHaveBeenCalled()
  })

  it('开启状态下点通过先弹确认，确认后才带 confirmed:true 调 acceptFriend', async () => {
    confirmMock.mockResolvedValue(true)
    vi.mocked(wechatHubApi.friendsOverview).mockResolvedValue(
      makeOverview({
        policy: { enabled: true, maxAcceptsPerHour: 5 },
        scan: {
          ok: true,
          status: 'ok',
          reason: null,
          scannedAt: BASE_AT,
          rawCount: 1,
          requests: [
            {
              requestId: 'req-1',
              nickname: '张三',
              source: '群聊推荐',
              kind: 'group-invite',
              clickable: true,
              seenAt: BASE_AT,
            },
          ],
        },
      }),
    )
    vi.mocked(wechatHubApi.acceptFriend).mockResolvedValue({
      ok: true,
      status: 'accepted',
      requestId: 'req-1',
      reason: null,
      errorCode: null,
    })

    renderCard()

    await waitFor(() => expect(screen.getByRole('button', { name: '通过' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '通过' }))

    await waitFor(() => expect(confirmMock).toHaveBeenCalled())
    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringContaining('张三') }),
    )
    await waitFor(() =>
      expect(wechatHubApi.acceptFriend).toHaveBeenCalledWith('account-1', 'req-1', true),
    )
  })

  it('确认弹窗取消时不发起 accept 请求', async () => {
    confirmMock.mockResolvedValue(false)
    vi.mocked(wechatHubApi.friendsOverview).mockResolvedValue(
      makeOverview({
        policy: { enabled: true, maxAcceptsPerHour: 5 },
        scan: {
          ok: true,
          status: 'ok',
          reason: null,
          scannedAt: BASE_AT,
          rawCount: 1,
          requests: [
            {
              requestId: 'req-1',
              nickname: '张三',
              source: '二维码名片',
              kind: 'friend',
              clickable: true,
              seenAt: BASE_AT,
            },
          ],
        },
      }),
    )

    renderCard()

    await waitFor(() => expect(screen.getByRole('button', { name: '通过' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '通过' }))
    await waitFor(() => expect(confirmMock).toHaveBeenCalled())
    expect(wechatHubApi.acceptFriend).not.toHaveBeenCalled()
  })

  it('审计区渲染最近记录的昵称、成功失败结果与错误码', async () => {
    vi.mocked(wechatHubApi.friendsOverview).mockResolvedValue(
      makeOverview({
        audit: [
          {
            at: BASE_AT,
            requestId: 'req-1',
            nickname: '李四',
            ok: true,
            status: 'accepted',
            errorCode: null,
          },
          {
            at: BASE_AT + 60_000,
            requestId: 'req-2',
            nickname: '王五',
            ok: false,
            status: 'failed',
            errorCode: 'RATE_LIMITED',
          },
        ],
      }),
    )

    renderCard()

    await waitFor(() => expect(screen.getByText('李四')).toBeTruthy())
    expect(screen.getByText('王五')).toBeTruthy()
    expect(screen.getByText('成功')).toBeTruthy()
    expect(screen.getByText('失败')).toBeTruthy()
    expect(screen.getByText('RATE_LIMITED')).toBeTruthy()
  })

  it('审计为空时显示暂无操作记录，请求列表为空时显示暂无待处理申请', async () => {
    vi.mocked(wechatHubApi.friendsOverview).mockResolvedValue(makeOverview())

    renderCard()

    await waitFor(() => expect(screen.getByText('暂无操作记录')).toBeTruthy())
    expect(screen.getByText('暂无待处理申请。')).toBeTruthy()
  })

  it('桥侧关闭时显示扫描不可用提示', async () => {
    vi.mocked(wechatHubApi.friendsOverview).mockResolvedValue(
      makeOverview({
        scan: {
          ok: false,
          status: 'disabled',
          reason: 'friends-automation-off',
          requests: [],
          scannedAt: BASE_AT,
          rawCount: 0,
        },
      }),
    )

    renderCard()

    await waitFor(() =>
      expect(
        screen.getByText('桥未开启好友自动化（BRIDGE_FRIENDS_AUTOMATION），扫描不可用'),
      ).toBeTruthy(),
    )
  })

  it('扫描失败时在卡片上展示失败原因，不渲染空列表', async () => {
    vi.mocked(wechatHubApi.friendsOverview).mockResolvedValue(
      makeOverview({
        scan: {
          ok: false,
          status: 'failed',
          reason: 'UIA 挂不到微信窗口',
          requests: [],
          scannedAt: BASE_AT,
          rawCount: 0,
        },
      }),
    )

    renderCard()

    await waitFor(() => expect(screen.getByText('申请扫描失败')).toBeTruthy())
    expect(screen.getByText('UIA 挂不到微信窗口')).toBeTruthy()
  })
})
