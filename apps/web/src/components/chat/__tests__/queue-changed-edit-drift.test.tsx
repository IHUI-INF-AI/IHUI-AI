// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D162 a)G-171 队列拒因残余:queueChanged 的真实输入 —— 编辑窗口内的队列漂移。
//
// 覆盖:
// - 编辑窗口打开后目标项正文被外部改动 ⇒ 命中 D69 `queueActionBlockView` 的 queueChanged
//   (拒因键/文案与唯一判定出口逐字一致),确认被拦且草稿留在输入框、onEdit 不回调;
// - 正向对照:正文未变时同一确认路径照常上抛(证明拦截不是恒红);
// - 取消后重新进入编辑:基线刷新为新正文,可正常提交(不是死锁);
// - 缺省(未注入 blockCtx)行为不变 —— 六格面本就不启用,不臆造条件。

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  queueActionBlockView,
  queueInteractionPerms,
  type QueueActionBlockContext,
} from '@ihui/shared/chat/input-notices'
import type { FollowUpMode } from '@ihui/shared/chat/queue-interactions'

import { QueueInteractionBar, type QueuedItemView } from '../queue-interaction-bar'

// 只断言结构与判据;文案覆盖由既有 D162 词包用例守住
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

afterEach(() => {
  // vitest 配置未开 globals,RTL 自动 cleanup 不注册;不显式卸载会跨用例残留多份 bar
  cleanup()
})

const perms = () =>
  queueInteractionPerms({
    runtimeSupportsInterjection: true,
    streaming: false,
    hasQueuedMessages: true,
  })

/** 全绿六格上下文(不拦任何动作;queueChanged 由组件本地漂移检测补充) */
const allClearCtx: QueueActionBlockContext = {
  runtimeSupportsInterjection: true,
  hasRunningTurn: true,
  hasWaitingRequests: false,
  isControlCommand: false,
  queueChanged: false,
  sourceMatches: true,
}

const baseProps = (items: QueuedItemView[], onEdit: (id: string, text: string) => void) => ({
  items,
  perms: perms(),
  mode: 'queue' as FollowUpMode,
  runtimeSupportsInterjection: true,
  blockCtx: allClearCtx,
  onEdit,
})

const editButtonOf = (root: ParentNode, id: string): HTMLButtonElement =>
  root.querySelector(`[data-queue-op="edit"][data-item-id="${id}"]`) as HTMLButtonElement

describe('G-171 queueChanged 真实输入 / 编辑窗口漂移', () => {
  it('编辑期间目标项正文被外部改动 ⇒ 命中唯一判定出口的 queueChanged,确认被拦、草稿保留', () => {
    const onEdit = vi.fn()
    const view = render(
      <QueueInteractionBar {...baseProps([{ id: 'q1', text: '原始正文' }], onEdit)} />,
    )
    fireEvent.click(editButtonOf(view.container, 'q1'))
    const input = view.container.querySelector('[data-queue-op="editInput"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '我的草稿' } })
    expect(input.value).toBe('我的草稿')

    // 外部(另一窗格 / 流结束出队回写)改了该项正文 —— 队列在编辑窗口内发生变化
    view.rerender(
      <QueueInteractionBar {...baseProps([{ id: 'q1', text: '外部改过的正文' }], onEdit)} />,
    )

    // 拒因值与唯一判定出口逐字一致(本组件只供事实,不复制 reason→键表)
    const expected = queueActionBlockView('edit', { ...allClearCtx, queueChanged: true })
    expect(expected.reason).toBe('queueChanged')
    const hint = view.container.querySelector('[data-queue-denied="edit"]')
    expect(hint).not.toBeNull()
    const blockedSpan = hint?.querySelector('[data-queue-blocked-reason]')
    expect(blockedSpan?.getAttribute('data-queue-blocked-reason')).toBe(expected.reason)
    expect(blockedSpan?.getAttribute('data-blocked-key')).toBe(expected.reasonKey)
    expect(blockedSpan?.textContent).toBe(`queue.${expected.reasonKey}`)

    const confirm = view.container.querySelector(
      '[data-queue-op="editConfirm"]',
    ) as HTMLButtonElement
    expect(confirm.getAttribute('aria-disabled')).toBe('true')
    expect(confirm.getAttribute('title')).toBe('queue.blocked.queueChanged')
    fireEvent.click(confirm)
    expect(onEdit).not.toHaveBeenCalled()
    // 草稿不清空、不写回过期队列;队列项正文仍是外部的新值
    const inputAfter = view.container.querySelector(
      '[data-queue-op="editInput"]',
    ) as HTMLInputElement
    expect(inputAfter).not.toBeNull()
    expect(inputAfter.value).toBe('我的草稿')
    // 编辑行仍在(未因外部改动被吞掉),只是确认路径被 queueChanged 拦下
    expect(view.container.querySelector('[data-queued-item="q1"]')).not.toBeNull()
  })

  it('正向对照:正文未变时同一确认路径照常上抛(拦截不是恒红)', () => {
    const onEdit = vi.fn()
    const view = render(
      <QueueInteractionBar {...baseProps([{ id: 'q1', text: '原始正文' }], onEdit)} />,
    )
    fireEvent.click(editButtonOf(view.container, 'q1'))
    const input = view.container.querySelector('[data-queue-op="editInput"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '  我的草稿  ' } })
    const confirm = view.container.querySelector(
      '[data-queue-op="editConfirm"]',
    ) as HTMLButtonElement
    expect(confirm.getAttribute('aria-disabled')).toBe('false')
    expect(confirm.getAttribute('title')).toBeNull()
    fireEvent.click(confirm)
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onEdit).toHaveBeenCalledWith('q1', '我的草稿')
    expect(view.container.querySelector('[data-queue-denied]')).toBeNull()
  })

  it('取消后重新进入编辑:基线刷新为新正文,可正常提交(不是死锁)', () => {
    const onEdit = vi.fn()
    const view = render(
      <QueueInteractionBar {...baseProps([{ id: 'q1', text: '原始正文' }], onEdit)} />,
    )
    fireEvent.click(editButtonOf(view.container, 'q1'))
    view.rerender(
      <QueueInteractionBar {...baseProps([{ id: 'q1', text: '外部改过的正文' }], onEdit)} />,
    )
    expect(
      view.container.querySelector('[data-queue-denied="edit"] [data-queue-blocked-reason]'),
    ).not.toBeNull()

    fireEvent.click(
      view.container.querySelector('[data-queue-op="editCancel"]') as HTMLButtonElement,
    )
    // 取消后拒因面消失(旧基线已作废)
    expect(view.container.querySelector('[data-queue-denied="edit"]')).toBeNull()
    fireEvent.click(editButtonOf(view.container, 'q1'))
    const input = view.container.querySelector('[data-queue-op="editInput"]') as HTMLInputElement
    expect(input.value).toBe('外部改过的正文')
    fireEvent.change(input, { target: { value: '第二稿' } })
    fireEvent.click(
      view.container.querySelector('[data-queue-op="editConfirm"]') as HTMLButtonElement,
    )
    expect(onEdit).toHaveBeenCalledWith('q1', '第二稿')
  })

  it('缺省(未注入 blockCtx)行为不变:六格面不启用,不臆造队列变化', () => {
    const onEdit = vi.fn()
    const props = {
      items: [{ id: 'q1', text: '原始正文' }] as QueuedItemView[],
      perms: perms(),
      mode: 'queue' as FollowUpMode,
      runtimeSupportsInterjection: true,
      onEdit,
    }
    const view = render(<QueueInteractionBar {...props} />)
    fireEvent.click(editButtonOf(view.container, 'q1'))
    view.rerender(<QueueInteractionBar {...props} items={[{ id: 'q1', text: '外部改过的正文' }]} />)
    expect(view.container.querySelector('[data-queue-blocked-reason]')).toBeNull()
    fireEvent.click(
      view.container.querySelector('[data-queue-op="editConfirm"]') as HTMLButtonElement,
    )
    expect(onEdit).toHaveBeenCalledWith('q1', '原始正文')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
