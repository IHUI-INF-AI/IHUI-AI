// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本站 App 扫码登录落点的组件级接线断言(2026-10-17 立)。
 *
 * 扫码完成此前只 `setToken` + 关弹窗,不导航 ⇒ admin 扫完后原地停留。本测试真渲染 AppQrPanel、
 * 真跑轮询回调,断言:
 *   - 扫码确认后补拉 /auth/me 拿到 admin 身份 ⇒ 关弹窗后跳到 /admin/monitor/wallboard;
 *   - 普通用户 ⇒ 只关弹窗,不跳大屏(维持原行为)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

const h = vi.hoisted(() => {
  const push = vi.fn()
  const authState: any = {
    user: null,
    setToken: vi.fn(),
    setUser: vi.fn((u: unknown) => {
      authState.user = u
    }),
  }
  const dialogState: any = { close: vi.fn() }
  return {
    push,
    router: { push, replace: vi.fn(), prefetch: () => {} },
    authState,
    dialogState,
    fetchApi: vi.fn(),
    roleId: 1,
  }
})

vi.mock('next/navigation', () => ({ useRouter: () => h.router }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }))
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

import { AppQrPanel } from '../AppQrPanel'

beforeEach(() => {
  vi.useFakeTimers()
  h.push.mockReset()
  h.dialogState.close.mockReset()
  h.fetchApi.mockReset()
  h.authState.user = null
  h.roleId = 1
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
    if (url.includes('/qr/status')) {
      return {
        success: true,
        data: { status: 'confirmed', accessToken: 'a', refreshToken: 'r', userId: 'u1' },
      }
    }
    if (url.includes('/auth/me')) {
      return { success: true, data: { user: { id: 'u1', roleId: h.roleId } } }
    }
    return { success: false, error: `unexpected: ${url}` }
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

async function flush() {
  await vi.advanceTimersByTimeAsync(50)
  await vi.advanceTimersByTimeAsync(1000)
}

describe('AppQrPanel 扫码登录落点', () => {
  it('admin 扫码确认 → 关弹窗并跳到监控大屏', async () => {
    h.roleId = 1
    render(<AppQrPanel refreshKey={0} />)
    await flush()
    expect(h.dialogState.close).toHaveBeenCalled()
    expect(h.push).toHaveBeenCalledWith('/admin/monitor/wallboard')
  })

  it('普通用户扫码确认 → 只关弹窗,不跳大屏', async () => {
    h.roleId = 0
    render(<AppQrPanel refreshKey={0} />)
    await flush()
    expect(h.dialogState.close).toHaveBeenCalled()
    expect(h.push).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
