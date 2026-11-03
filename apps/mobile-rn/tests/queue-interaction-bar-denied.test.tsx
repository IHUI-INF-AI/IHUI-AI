// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * QueueInteractionBar(mobile-rn)D38 收口组件测试
 *
 * 覆盖三条链路:
 * 1. 被拒动作的场景提示:流式中按重排 → 渲染 queue-denied-notice
 *    (denied.reorder + denied.cause.streaming,同一 Text 拼接,断言 textContent 包含键)
 * 2. 允许的动作不上抛拒绝提示:非流式重排直接回调 onReorder,denied 行不出现
 * 3. 插话被拒(Runtime 无插话能力,与宿主同口径恒 false)→ denied.interject + cause
 *
 * 注:react-native mock 把 Pressable 渲染成 <button>(onPress→onClick),a11y label 是
 * DOM 属性而非文本,故点击目标按 button 序定位;RN mock 渲染的 t() 返回键名,断言键路径。
 * '@ihui/shared/chat/*' 走 vitest.config 真实源码别名,无需 mock —— 测的就是真相源。
 */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

vi.mock('../src/i18n', () => {
  const t = (key: string) => key
  return { useI18n: () => ({ t, locale: 'zh-CN', setLocale: async () => {} }) }
})

import { QueueInteractionBar } from '../src/components/ai/QueueInteractionBar'

describe('QueueInteractionBar 被拒动作场景提示(D38 收口:不静默吞)', () => {
  it('流式中按重排 → 渲染 denied.reorder + denied.cause.streaming,不回调', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <QueueInteractionBar
        items={[{ id: 'sq-1', text: '补一条测试' }]}
        streaming={true}
        mode="queue"
        onReorder={onReorder}
      />,
    )
    // 第一个可点按钮 = 队首条目的 ↑(流式中被许可门锁定)
    const buttons = Array.from(container.querySelectorAll('button'))
    fireEvent.click(buttons[0]!)
    expect(onReorder).not.toHaveBeenCalled()
    expect(container.textContent).toContain('ai.pane.inputNotices.queue.denied.reorder')
    expect(container.textContent).toContain('ai.pane.inputNotices.queue.denied.cause.streaming')
  })

  it('非流式按重排(非边界)→ 直接上抛 onReorder,不渲染 denied 提示', () => {
    const onReorder = vi.fn()
    const { container } = render(
      <QueueInteractionBar
        items={[
          { id: 'sq-1', text: '第一条' },
          { id: 'sq-2', text: '第二条' },
        ]}
        streaming={false}
        mode="queue"
        onReorder={onReorder}
      />,
    )
    const buttons = Array.from(container.querySelectorAll('button'))
    // 按钮序:↑0 ↓0 ↑1 ↓1 …;↓0 允许(非流式且非末位)
    fireEvent.click(buttons[1]!)
    expect(onReorder).toHaveBeenCalledWith(0, 1)
    expect(container.textContent).not.toContain('ai.pane.inputNotices.queue.denied.reorder')
  })

  it('按「打断并执行」(Runtime 无插话能力)→ 渲染 denied.interject + cause.runtimeNoInterject', () => {
    const onInterruptAndRun = vi.fn()
    const { container, getByText } = render(
      <QueueInteractionBar
        items={[{ id: 'sq-1', text: '补一条测试' }]}
        streaming={true}
        mode="steer"
        onInterruptAndRun={onInterruptAndRun}
      />,
    )
    fireEvent.click(getByText('ai.pane.queueOps.interruptAndRun'))
    expect(onInterruptAndRun).not.toHaveBeenCalled()
    expect(container.textContent).toContain('ai.pane.inputNotices.queue.denied.interject')
    expect(container.textContent).toContain(
      'ai.pane.inputNotices.queue.denied.cause.runtimeNoInterject',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
