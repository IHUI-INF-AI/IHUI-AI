// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 扫码面板「状态轮询瞬失」行为锁(2026-10-27 立)。
 *
 * 现读缺陷:web 端每 2s 轮一次 /qr/status = 30 帧/分钟,而该端点限流原本恰是 30/分钟 ——
 * 只要多出一帧(同 IP 开两个标签页、代理重试),服务端就回 429;面板把**任何一次**失败当
 * 终态:清定时器、进 error 态,一张名义还有效 300s 的二维码当场作废,用户只能重刷重扫。
 * 修法是把瞬失与终态分开:连续 STATUS_POLL_FAIL_TOLERANCE 帧都取不到才判死。
 *
 * 两档成对钉:
 *   ① 瞬失后恢复 ⇒ 不许进 error 态、必须继续轮询直到 confirmed(摘掉容忍 ⇒ 本条翻红);
 *   ② 一直取不到 ⇒ 到容忍上限必须真进 error 态(把容忍改成"永不判死"⇒ 本条翻红)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'

const h = vi.hoisted(() => {
  const authState: any = { user: null, setToken: vi.fn(), setUser: vi.fn() }
  const dialogState: any = { close: vi.fn() }
  return {
    router: { push: vi.fn(), replace: vi.fn(), prefetch: () => {} },
    requestChoice: vi.fn(),
    authState,
    dialogState,
    fetchApi: vi.fn(),
    /** 必须给**同一个对象**:useQueryClient() 每次返回新引用会让被测组件的 effect 反复重启,
     *  于是每次重试都从零计数 —— 测出来的是装具的抖动,不是容忍逻辑(2026-10-27 踩过)。 */
    queryClient: { invalidateQueries: vi.fn() },
    /** /qr/status 每次调用的返回档;超出数组长度则复用最后一档 */
    statusQueue: [] as Array<{ ok: boolean }>,
    statusCalls: 0,
  }
})

vi.mock('next/navigation', () => ({ useRouter: () => h.router }))
vi.mock('../../WallboardChoiceDialog', () => ({ requestWallboardChoice: h.requestChoice }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => h.queryClient }))
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
  h.requestChoice.mockReset()
  h.dialogState.close.mockReset()
  h.authState.setToken.mockReset()
  h.fetchApi.mockReset()
  h.statusQueue = []
  h.statusCalls = 0
  h.fetchApi.mockImplementation(async (url: string) => {
    if (url.includes('/qr/generate')) {
      return {
        success: true,
        data: {
          ticket: 'qr_test-ticket',
          qrContent: 'qr_test-ticket',
          expiresAt: new Date(Date.now() + 300_000).toISOString(),
        },
      }
    }
    if (url.includes('/qr/status')) {
      const idx = h.statusCalls++
      const step = h.statusQueue[idx] ?? h.statusQueue[h.statusQueue.length - 1] ?? { ok: true }
      if (!step.ok) return { success: false, error: '请求过于频繁,请稍后重试' }
      return {
        success: true,
        data: { status: 'confirmed', accessToken: 'a', refreshToken: 'r', userId: 'u1' },
      }
    }
    if (url.includes('/auth/me')) {
      return { success: true, data: { user: { id: 'u1', roleId: 0 } } }
    }
    return { success: false, error: `unexpected: ${url}` }
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** 一帧轮询 = 2000ms;首帧在挂载后立即发出。 */
async function tickFrames(n: number) {
  await vi.advanceTimersByTimeAsync(50)
  for (let i = 0; i < n; i++) await vi.advanceTimersByTimeAsync(2000)
}

describe('AppQrPanel 状态轮询的瞬失容忍', () => {
  it('连续两帧 429 后恢复 ⇒ 不进 error 态、继续轮询到 confirmed', async () => {
    h.statusQueue = [{ ok: false }, { ok: false }, { ok: true }]
    render(<AppQrPanel refreshKey={0} agreementAccepted />)
    await tickFrames(1)
    // 首帧瞬失:码还在屏上,没有失败态
    expect(screen.queryByText('appQrFailed')).toBeNull()
    expect(h.dialogState.close).not.toHaveBeenCalled()

    await tickFrames(3)
    expect(h.statusCalls).toBeGreaterThanOrEqual(3)
    expect(h.authState.setToken).toHaveBeenCalledWith('a', 'r')
    expect(h.dialogState.close).toHaveBeenCalled()
    expect(screen.queryByText('appQrFailed')).toBeNull()
  })

  it('一直取不到 ⇒ 到容忍上限必须真进 error 态(容忍不等于永不判死)', async () => {
    h.statusQueue = [{ ok: false }]
    render(<AppQrPanel refreshKey={0} agreementAccepted />)
    await tickFrames(5)
    expect(screen.queryByText('appQrFailed')).not.toBeNull()
    expect(h.dialogState.close).not.toHaveBeenCalled()
    expect(h.authState.setToken).not.toHaveBeenCalled()
    // 判死后不得继续烧轮次(停轮由 clearInterval 完成)
    const callsAtDeath = h.statusCalls
    await tickFrames(4)
    expect(h.statusCalls).toBe(callsAtDeath)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
