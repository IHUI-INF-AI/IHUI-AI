// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WallboardChoiceDialog 组件行为断言(2026-10-18 立)。
 *
 * 弹窗本体挂在常驻根布局的 LoginDialog 里,由 requestWallboardChoice 模块级订阅驱动。
 * 这里真渲染组件、真派发请求、真点击按钮,验的是**实际行为**:
 *   - 「看大屏」⇒ 跳到建议落点(250ms 遮罩余量后);
 *   - 不带 stayFallback ⇒ 点「先不用」只收起弹窗,不导航(主站场景:留在当前页);
 *   - 带 stayFallback('/')⇒ 点「先不用」后跳回落路径(OAuth 回调页等中间页场景)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, cleanup, screen, fireEvent } from '@testing-library/react'

const pushMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
}))
vi.mock('@ihui/ui-react', () => ({
  Button: ({ children, ...rest }: any) => <button {...rest}>{children}</button>,
  Dialog: ({ open, children }: { open?: boolean; children?: never }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children?: never }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children?: never }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children?: never }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: never }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: never }) => <div>{children}</div>,
}))

import { WallboardChoiceDialog, requestWallboardChoice } from '../WallboardChoiceDialog'

beforeEach(() => {
  pushMock.mockReset()
})

afterEach(() => cleanup())

describe('WallboardChoiceDialog', () => {
  it('「看大屏」→ 跳到建议落点', async () => {
    render(<WallboardChoiceDialog />)
    requestWallboardChoice('/admin/monitor/wallboard')
    fireEvent.click(await screen.findByText('看大屏'))
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/admin/monitor/wallboard')
    })
  })

  it('不带 stayFallback:「先不用」→ 只收起,不导航(主站场景)', async () => {
    render(<WallboardChoiceDialog />)
    requestWallboardChoice('/admin/monitor/wallboard')
    fireEvent.click(await screen.findByText('先不用'))
    await new Promise((r) => setTimeout(r, 400))
    expect(pushMock).not.toHaveBeenCalled()
    expect(screen.queryByText('要看数据大屏吗？')).toBeNull()
  })

  it('带 stayFallback("/"):「先不用」→ 跳回落路径(OAuth 中间页场景)', async () => {
    render(<WallboardChoiceDialog />)
    requestWallboardChoice('/admin/monitor/wallboard', { stayFallback: '/' })
    fireEvent.click(await screen.findByText('先不用'))
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/')
    })
    expect(pushMock).not.toHaveBeenCalledWith('/admin/monitor/wallboard')
  })

  it('「先不用」回落路径是一次性的:下次不带 fallback 时不导航', async () => {
    render(<WallboardChoiceDialog />)
    requestWallboardChoice('/admin/monitor/wallboard', { stayFallback: '/' })
    fireEvent.click(await screen.findByText('先不用'))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/'))
    // 第二轮:不带 fallback(主站场景),「先不用」不应再跳 '/'
    pushMock.mockReset()
    requestWallboardChoice('/admin/monitor/wallboard')
    fireEvent.click(await screen.findByText('先不用'))
    await new Promise((r) => setTimeout(r, 400))
    expect(pushMock).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
