// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D64 ④(2026-09-26):后台子任务八态展示 + 「停止失败」显式文案与重试/忽略出口。
// 判据唯一来源 @ihui/shared/chat/element-pack(backgroundTaskView/fromAgentStatus);
// stopping/stopFailed 由既有 abort 通道(onCancel 返回 {ok,error})本地派生,不造第二套状态机。
import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, fireEvent, act } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))
// 通知副作用(Notification 权限/可见性)与本票无关,隔离
vi.mock('@/hooks/use-background-agent-notify', () => ({
  useBackgroundAgentNotify: () => {},
}))
// Tooltip 在 jsdom 走 portal,测试只关心内容结构 → 平替直出
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { BackgroundAgentsPanel } from '../background-agents-panel'
import type { BackgroundAgent } from '../types'
import { fromAgentStatus } from '@ihui/shared/chat/element-pack'

function makeAgent(partial: Partial<BackgroundAgent> = {}): BackgroundAgent {
  return {
    agent_id: 'a1',
    status: 'running',
    prompt: '后台跑个活',
    created_at: '2026-09-26T00:00:00Z',
    ...partial,
  }
}

/** 可控 promise:停止通道的在途/成败由测试精确驱动 */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function badgeOf(container: HTMLElement, id = 'a1'): HTMLElement {
  const el = container.querySelector(`[data-testid="bg-task-state-${id}"]`)
  if (!(el instanceof HTMLElement)) throw new Error('state badge not found')
  return el
}

/** 按文案键定位动作按钮(头部刷新/通知钮只含 SVG 无文本,不会误中) */
function buttonByText(container: HTMLElement, key: string): HTMLButtonElement {
  const el = [...container.querySelectorAll('button')].find((b) => b.textContent === key)
  if (!(el instanceof HTMLButtonElement)) throw new Error(`button "${key}" not found`)
  return el
}

describe('D64 ④ 后台子任务八态面板', () => {
  afterEach(() => cleanup())

  it('底层十态经 fromAgentStatus 归并后徽章逐态正确(零 default 由判定层锁死)', () => {
    const cases = [
      { status: 'running', expectState: 'running' },
      { status: 'thinking', expectState: 'running' },
      { status: 'completed', expectState: 'completed' },
      { status: 'failed', expectState: 'failed' },
      { status: 'cancelled', expectState: 'cancelled' },
      { status: 'pending', expectState: 'pending' },
      { status: 'idle', expectState: 'pending' },
    ] as const
    for (const c of cases) {
      const { container, unmount } = render(
        <BackgroundAgentsPanel agents={[makeAgent({ status: c.status })]} />,
      )
      const badge = badgeOf(container)
      expect(badge.getAttribute('data-task-state')).toBe(c.expectState)
      expect(badge.textContent).toBe(`state.${c.expectState}`)
      expect(badge.textContent).toBe(`state.${fromAgentStatus(c.status)}`)
      unmount()
    }
  })

  it('pending 态动作=stop:给取消入口(判定层 pending.action=stop)', async () => {
    const onCancel = vi.fn()
    const { container } = render(
      <BackgroundAgentsPanel agents={[makeAgent({ status: 'pending' })]} onCancel={onCancel} />,
    )
    expect(container.querySelector('[data-task-state="pending"]')).toBeTruthy()
    fireEvent.click(buttonByText(container, 'cancel'))
    // 通道同步返回 void ⇒ 视为请求已受理,不落入 stopFailed
    await act(async () => {})
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(badgeOf(container).getAttribute('data-task-state')).toBe('pending')
  })

  it('停止在途:stopping + hint.stopping,不给任何停止入口(action=none 防重复点击)', async () => {
    const d = deferred<{ ok: boolean; error?: string }>()
    const { container } = render(
      <BackgroundAgentsPanel agents={[makeAgent()]} onCancel={() => d.promise} />,
    )
    fireEvent.click(buttonByText(container, 'cancel'))
    const badge = badgeOf(container)
    expect(badge.getAttribute('data-task-state')).toBe('stopping')
    expect(container.querySelector('[data-testid="bg-task-hint-a1"]')?.textContent).toBe(
      'hint.stopping',
    )
    expect(container.textContent).not.toContain('action.retryStop')
    await act(async () => {
      d.resolve({ ok: true })
    })
  })

  it('停止失败({ok:false}):显式 stopFailed + hint.stopFailed + 重试停止/忽略两出口', async () => {
    const d = deferred<{ ok: boolean; error?: string }>()
    const { container } = render(
      <BackgroundAgentsPanel agents={[makeAgent()]} onCancel={() => d.promise} />,
    )
    fireEvent.click(buttonByText(container, 'cancel'))
    await act(async () => {
      d.resolve({ ok: false, error: '仍在运行' })
    })
    const badge = badgeOf(container)
    expect(badge.getAttribute('data-task-state')).toBe('stopFailed')
    expect(container.querySelector('[data-testid="bg-task-hint-a1"]')?.textContent).toBe(
      'hint.stopFailed',
    )
    expect(container.textContent).toContain('action.retryStop')
    expect(container.textContent).toContain('action.ignore')
  })

  it('忽略出口:清本地 stopFailed,回到底层真实态并重给停止入口', async () => {
    const d = deferred<{ ok: boolean; error?: string }>()
    const onCancel = vi.fn(() => d.promise)
    const { container } = render(
      <BackgroundAgentsPanel agents={[makeAgent()]} onCancel={onCancel} />,
    )
    fireEvent.click(buttonByText(container, 'cancel'))
    await act(async () => {
      d.resolve({ ok: false })
    })
    fireEvent.click(buttonByText(container, 'action.ignore'))
    expect(badgeOf(container).getAttribute('data-task-state')).toBe('running')
    expect(container.querySelector('[data-testid="bg-task-hint-a1"]')).toBeNull()
    expect(container.textContent).not.toContain('action.retryStop')
  })

  it('重试停止:再次走同一 abort 通道,成功后回底层态(共调用两次)', async () => {
    const first = deferred<{ ok: boolean; error?: string }>()
    const second = deferred<{ ok: boolean; error?: string }>()
    const onCancel = vi.fn()
    onCancel.mockImplementationOnce(() => first.promise)
    onCancel.mockImplementationOnce(() => second.promise)
    const { container } = render(
      <BackgroundAgentsPanel agents={[makeAgent()]} onCancel={onCancel} />,
    )
    fireEvent.click(buttonByText(container, 'cancel'))
    await act(async () => {
      first.resolve({ ok: false })
    })
    expect(badgeOf(container).getAttribute('data-task-state')).toBe('stopFailed')
    fireEvent.click(buttonByText(container, 'action.retryStop'))
    expect(badgeOf(container).getAttribute('data-task-state')).toBe('stopping')
    await act(async () => {
      second.resolve({ ok: true })
    })
    expect(badgeOf(container).getAttribute('data-task-state')).toBe('running')
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('停止通道抛错同样判为 stopFailed(不得静默吞)', async () => {
    const d = deferred<never>()
    const { container } = render(
      <BackgroundAgentsPanel
        agents={[makeAgent()]}
        onCancel={() => {
          d.reject(new Error('network down'))
          return d.promise
        }}
      />,
    )
    fireEvent.click(buttonByText(container, 'cancel'))
    await act(async () => {
      try {
        await d.promise
      } catch {
        // 预期拒绝
      }
    })
    expect(badgeOf(container).getAttribute('data-task-state')).toBe('stopFailed')
  })

  it('取消(成功)后不产生 stopFailed:回到底层态,不等轮询回填', async () => {
    const d = deferred<{ ok: boolean; error?: string }>()
    const { container } = render(
      <BackgroundAgentsPanel agents={[makeAgent()]} onCancel={() => d.promise} />,
    )
    fireEvent.click(buttonByText(container, 'cancel'))
    await act(async () => {
      d.resolve({ ok: true })
    })
    expect(badgeOf(container).getAttribute('data-task-state')).toBe('running')
    expect(container.textContent).not.toContain('action.ignore')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
