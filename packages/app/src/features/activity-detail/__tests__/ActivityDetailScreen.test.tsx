// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 返工票(BUG-NEW-01)— ActivityDetailScreen 错误/空态返回入口回归。
 *
 * 事实链:
 *  - `2b43c08fe1`(屏幕状态四件套铺量第二批)把错误分支的 `<header> + BackChevron` 整段
 *    换成裸 `<ErrorState onRetry={onBack} retryLabel={common.back}>` ⇒ 页头返回键消失;
 *  - `f8e651a83b` 又把 `onRetry={onBack}` 改成 `onRetry={onRetry}`,而本屏调用方并不传 onRetry
 *    ⇒ ErrorState 连那个"伪装成返回的重试按钮"也不再渲染 ⇒ 错误/空态**没有任何返回入口**。
 *  - `check-glyph-arrow-icon` 的 GA7 反向锁(要求该屏 3 套互斥页头各带 BackChevron)因此转红,
 *    锁是对的,是组件少了第 3 个返回入口 ⇒ 补回组件,不改锁。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ActivityDetailItem, TFunction } from '@ihui/types'
import { ActivityDetailScreen } from '../ActivityDetailScreen'

const t = ((key: string) => key) as unknown as TFunction

const item: ActivityDetailItem = {
  id: 'a1',
  title: '晨读会',
  content: '共读一章',
  startAt: '2026-11-07 08:00',
  endAt: '2026-11-07 09:00',
  location: '线上',
}

const baseProps = {
  t,
  item,
  loading: false,
  error: '',
  onBack: vi.fn(),
  colorScheme: 'light' as const,
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ActivityDetailScreen 返回入口(BUG-NEW-01)', () => {
  it('错误态保留页头返回键,且点击回调 onBack', () => {
    const onBack = vi.fn()
    render(<ActivityDetailScreen {...baseProps} item={null} error="加载失败" onBack={onBack} />)

    expect(screen.getByText('加载失败')).toBeTruthy()
    const back = screen.getByLabelText('common.back')
    fireEvent.click(back)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('空态(无 error、item=null)同样保留页头返回键', () => {
    const onBack = vi.fn()
    render(<ActivityDetailScreen {...baseProps} item={null} onBack={onBack} />)

    const back = screen.getByLabelText('common.back')
    fireEvent.click(back)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('错误态未注入 onRetry ⇒ 不出现"重试"按钮(返回入口只由页头承担,不拿重试冒充)', () => {
    render(<ActivityDetailScreen {...baseProps} item={null} error="加载失败" />)
    expect(screen.queryByText('重试')).toBeNull()
  })

  it('错误态注入 onRetry ⇒ 重试与返回是两个独立 affordance,各自回调各的', () => {
    const onBack = vi.fn()
    const onRetry = vi.fn()
    render(
      <ActivityDetailScreen
        {...baseProps}
        item={null}
        error="加载失败"
        onBack={onBack}
        {...({ onRetry } as { onRetry: () => void })}
      />,
    )

    fireEvent.click(screen.getByText('重试'))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onBack).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('common.back'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('成功态页头返回键仍在', () => {
    const onBack = vi.fn()
    render(<ActivityDetailScreen {...baseProps} onBack={onBack} />)
    expect(screen.getByText('晨读会')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('common.back'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
