// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 401 的两型必须分开(2026-10-23 立)。
 *
 * 现场证据:未登录把小程序启动页设成「我的」,端内仍发 `GET /api/ai/history` →
 * 线上 api 日志 `[01:32:05] incoming request … 401` → `unwrapApi` 的 401 出口
 * `expireAuth()` + 800ms `reLaunch('/pages/login/login')`。于是"该由用户主动点开的登录弹窗"
 * 永远走不到 —— 机主要拆的那道登录墙,是这一发** involuntary **跳转,不是登录页本身。
 *
 * 两臂成对留:只测"游客不跳"会空跑 —— 万一判据整个失效,两型都不跳,测试照样绿。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ApiResult } from '@ihui/types'

const { mockGetToken, mockExpireAuth, mockGoToLogin, mockToast } = vi.hoisted(() => ({
  mockGetToken: vi.fn((): string => ''),
  mockExpireAuth: vi.fn(),
  mockGoToLogin: vi.fn(),
  mockToast: vi.fn(),
}))

vi.mock('@/utils/auth', () => ({
  getToken: mockGetToken,
  expireAuth: mockExpireAuth,
  // 登录页已删 ⇒ 401 的去向只剩这一个出口,测试也照它断言,不再断言具体路由串
  goToLogin: mockGoToLogin,
}))
vi.mock('@tarojs/taro', () => ({
  default: { showToast: mockToast },
  showToast: mockToast,
}))
vi.mock('@/i18n', () => ({ t: (k: string) => k }))

import { unwrapApi } from '../src/utils/api-bridge'

const expired = (): Promise<ApiResult<never>> =>
  Promise.resolve({ success: false, error: '未授权', status: 401 } as ApiResult<never>)

const otherFailure = (): Promise<ApiResult<never>> =>
  Promise.resolve({ success: false, error: '服务端炸了', status: 500 } as ApiResult<never>)

describe('unwrapApi 的 401 分型', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockGetToken.mockReset().mockReturnValue('')
    mockExpireAuth.mockClear()
    mockToast.mockClear()
    mockGoToLogin.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('A1 游客(本地无凭据)打到鉴权端点:不清凭据、不 toast、不跳登录页,只抛', async () => {
    mockGetToken.mockReturnValue('')
    await expect(unwrapApi(expired())).rejects.toThrow('未授权')
    expect(mockExpireAuth).not.toHaveBeenCalled()
    expect(mockToast).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2000)
    expect(mockGoToLogin).not.toHaveBeenCalled()
  })

  it('A2 正向对照:带着凭据被打回 401 ⇒ 清凭据 + 提示 + 跳登录页(三件都要发生)', async () => {
    mockGetToken.mockReturnValue('a-real-looking-jwt')
    await expect(unwrapApi(expired())).rejects.toThrow('未授权')
    expect(mockExpireAuth).toHaveBeenCalledTimes(1)
    expect(mockToast).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(900)
    expect(mockGoToLogin).toHaveBeenCalledTimes(1)
    expect(mockGoToLogin).toHaveBeenCalledWith()
  })

  it('A3 凭据有没有必须在发请求之前读:请求期间被清掉也不算游客', async () => {
    // 模拟"刷新失败清票"发生在 await 期间:进入 unwrapApi 时还有票,await 之后已没有。
    let first = true
    mockGetToken.mockImplementation(() => {
      if (first) {
        first = false
        return 'jwt-at-issue-time'
      }
      return ''
    })
    await expect(unwrapApi(expired())).rejects.toThrow()
    expect(mockExpireAuth).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(900)
    expect(mockGoToLogin).toHaveBeenCalledTimes(1)
  })

  it('A4 非 401 的失败:照旧 toast + 抛,但不碰会话', async () => {
    mockGetToken.mockReturnValue('jwt')
    await expect(unwrapApi(otherFailure())).rejects.toThrow('服务端炸了')
    expect(mockToast).toHaveBeenCalledTimes(1)
    expect(mockExpireAuth).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2000)
    expect(mockGoToLogin).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
