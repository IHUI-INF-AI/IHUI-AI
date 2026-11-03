// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扫码 tab 的协议同意采集接线断言(2026-10-27 立)。
 *
 * 背景:共享 LoginForm 只在 agreementMode==='inline' 且 tab!=='qr' 时渲染勾选框,
 * web 走 notice-dialog 且扫码 tab 不触发提交 ⇒ 停在扫码面板的访客从未被要求同意条款。
 * 本测试钉住扫码面板侧的行为:
 *   - 进入扫码即弹**现有** AgreementNoticeDialog(测试用轻量替身,只保留 open/回调契约);
 *   - 未同意 ⇒ 不挂载 AppQrPanel、不发 /api/auth/qr/generate;
 *   - 同意后 ⇒ 出码,且 /qr/generate 请求体带 agreementAccepted:true(后端唯一真相源的写入点);
 *   - 拒绝后 ⇒ 显示现有 auth.agreeRequired 文案,可重新打开同一弹窗。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => {
  const authState: any = {
    user: null,
    setToken: vi.fn(),
    setUser: vi.fn(),
  }
  const dialogState: any = { close: vi.fn() }
  return {
    fetchApi: vi.fn(),
    authState,
    dialogState,
    invalidateQueries: vi.fn(),
    requestChoice: vi.fn(),
  }
})

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))
// @ihui/ui-react 轻量替身(同 login/__tests__ 范式):只保留协议弹窗的 open / 回调契约。
vi.mock('@ihui/ui-react', () => ({
  AgreementNoticeDialog: ({
    open,
    onAgree,
    onCancel,
  }: {
    open: boolean
    onAgree: () => void
    onCancel: () => void
  }) =>
    open ? (
      <div data-testid="agreement-notice-dialog">
        <button type="button" data-testid="agreement-notice-agree" onClick={onAgree}>
          agree
        </button>
        <button type="button" data-testid="agreement-notice-disagree" onClick={onCancel}>
          disagree
        </button>
      </div>
    ) : null,
}))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: h.invalidateQueries }),
}))
vi.mock('qrcode.react', () => ({ QRCodeSVG: () => null }))
vi.mock('@/lib/api', () => ({ fetchApi: h.fetchApi }))
vi.mock('@/stores/auth', () => {
  const store: any = (selector?: (s: unknown) => unknown) =>
    selector ? selector(h.authState) : h.authState
  store.getState = () => h.authState
  return { useAuthStore: store }
})
vi.mock('@/stores/login-dialog', () => {
  const store: any = (selector?: (s: unknown) => unknown) =>
    selector ? selector(h.dialogState) : h.dialogState
  store.getState = () => h.dialogState
  return { useLoginDialogStore: store }
})
// 注意路径:vi.mock 相对本测试文件解析,`../` = login/,与 AppQrPanel 的 `../WallboardChoiceDialog` 同指向。
vi.mock('../../WallboardChoiceDialog', () => ({ requestWallboardChoice: h.requestChoice }))

import { QrCodeLogin } from '../../QrCodeLogin'

beforeEach(() => {
  h.fetchApi.mockReset()
  h.invalidateQueries.mockReset()
  h.dialogState.close.mockReset()
  h.fetchApi.mockImplementation(async (url: string) => {
    if (url.includes('/qr/generate')) {
      return {
        success: true,
        data: {
          ticket: 't',
          qrContent: 'x',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      }
    }
    if (url.includes('/qr/status')) return { success: true, data: { status: 'pending' } }
    return { success: false, error: `unexpected: ${url}` }
  })
})

afterEach(() => {
  cleanup()
})

describe('QrCodeLogin 协议同意采集', () => {
  it('进入扫码即弹协议弹窗,未同意不发 /qr/generate', async () => {
    render(<QrCodeLogin platform="app" refreshKey={0} />)

    expect(await screen.findByTestId('agreement-notice-dialog')).toBeTruthy()
    await new Promise((r) => setTimeout(r, 50))
    expect(h.fetchApi).not.toHaveBeenCalled()
  })

  it('同意后出码,且 /qr/generate 请求体带 agreementAccepted:true', async () => {
    render(<QrCodeLogin platform="app" refreshKey={0} />)
    fireEvent.click(await screen.findByTestId('agreement-notice-agree'))

    await waitFor(() => {
      expect(h.fetchApi).toHaveBeenCalledWith(
        '/api/auth/qr/generate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ agreementAccepted: true }),
        }),
      )
    })
    // 弹窗关闭后不再重复弹出
    expect(screen.queryByTestId('agreement-notice-dialog')).toBeNull()
  })

  it('拒绝同意 → 不出码、不发请求,显示现有文案并可重开弹窗', async () => {
    render(<QrCodeLogin platform="app" refreshKey={0} />)
    fireEvent.click(await screen.findByTestId('agreement-notice-disagree'))

    expect(await screen.findByText('auth.agreeRequired')).toBeTruthy()
    expect(h.fetchApi).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText('auth.agreementNoticeAgree'))
    expect(await screen.findByTestId('agreement-notice-dialog')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
