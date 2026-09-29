// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​

// D162 web 侧用例:按钮不可用态展示**具体拒因**(非笼统文案);
// 队列并发变更走 queueChanged 分支且输入框内容保留(草稿不清空、不写回过期队列)。
// 文案一律走 key;真实词包覆盖由「读真实词包」那组用例守住。

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  QUEUE_ACTION_BLOCK_REASONS,
  QUEUE_SEND_OUTCOMES,
  queueInteractionPerms,
  type QueueActionBlockContext,
  type QueueBlockableAction,
} from '@ihui/shared/chat/input-notices'
import type { FollowUpMode } from '@ihui/shared/chat/queue-interactions'

import { InputNoticeBanner } from '../input-notice-banner'
import { QueueInteractionBar, type QueuedItemView } from '../queue-interaction-bar'

// mock 的 useTranslations 必须返回稳定引用(factory 只求值一次,t 无状态,
// 组件内 effect 依赖不含 t ⇒ 无无限重跑风险,与既有 D38/D69 用例同款)
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const here = dirname(fileURLToPath(import.meta.url))
// __tests__ → chat → components → src → web(apps/web) → apps → 仓库根,共 6 级
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

const items: QueuedItemView[] = [{ id: 'q1', text: '第一条排队消息' }]

/** 全绿许可:队列非空 + 非流式 + Runtime 支持插话 */
const fullPerms = () =>
  queueInteractionPerms({
    runtimeSupportsInterjection: true,
    streaming: false,
    hasQueuedMessages: true,
  })

/** 全绿六格上下文(不拦任何动作) */
const allClearCtx: QueueActionBlockContext = {
  runtimeSupportsInterjection: true,
  hasRunningTurn: true,
  hasWaitingRequests: false,
  isControlCommand: false,
  queueChanged: false,
  sourceMatches: true,
}

const queueChangedCtx: QueueActionBlockContext = { ...allClearCtx, queueChanged: true }

const baseProps = (overrides?: Partial<Parameters<typeof QueueInteractionBar>[0]>) => ({
  items,
  perms: fullPerms(),
  mode: 'queue' as FollowUpMode,
  runtimeSupportsInterjection: true,
  ...overrides,
})

describe('D162 QueueInteractionBar / 按钮不可用态展示具体拒因(非笼统)', () => {
  it('队列并发变更:undo/edit/reorder 被六格拦下 → 拒因串 blocked.queueChanged(非笼统 denied.*)', () => {
    const { container } = render(<QueueInteractionBar {...baseProps({ blockCtx: queueChangedCtx })} />)
    for (const kind of ['undo', 'edit', 'reorder'] as const) {
      const hint = container.querySelector(`[data-queue-denied="${kind}"]`)
      expect(hint, kind).not.toBeNull()
      const blockedSpan = hint?.querySelector('[data-queue-blocked-reason]')
      expect(blockedSpan?.getAttribute('data-queue-blocked-reason'), kind).toBe('queueChanged')
      expect(blockedSpan?.getAttribute('data-blocked-key'), kind).toBe('blocked.queueChanged')
      expect(blockedSpan?.textContent, kind).toBe('queue.blocked.queueChanged')
    }
  })

  it('队列并发变更:被拦按钮挂具体拒因 tooltip(title)与 data-blocked-reason;点击不上抛', () => {
    const onUndo = vi.fn()
    const onEdit = vi.fn()
    const onReorder = vi.fn()
    const { container } = render(
      <QueueInteractionBar
        {...baseProps({ blockCtx: queueChangedCtx, onUndo, onEdit, onReorder })}
      />,
    )
    const undo = container.querySelector('[data-queue-op="undo"]') as HTMLButtonElement
    expect(undo.getAttribute('aria-disabled')).toBe('true')
    expect(undo.getAttribute('title')).toBe('queue.blocked.queueChanged')
    expect(undo.getAttribute('data-blocked-reason')).toBe('queueChanged')
    const edit = container.querySelector('[data-queue-op="edit"]') as HTMLButtonElement
    expect(edit.getAttribute('title')).toBe('queue.blocked.queueChanged')
    const handle = container.querySelector('[data-queue-op="reorderHandle"]') as HTMLElement
    expect(handle.getAttribute('title')).toBe('queue.blocked.queueChanged')
    fireEvent.click(undo)
    fireEvent.click(edit)
    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    expect(onUndo).not.toHaveBeenCalled()
    expect(onEdit).not.toHaveBeenCalled()
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('Runtime 不支持插话 + blockCtx 注入:interruptAndRun 展示 blocked.runtimeNoInterject(具体拒因)', () => {
    const onInterruptAndRun = vi.fn()
    const { container } = render(
      <QueueInteractionBar
        {...baseProps({
          perms: queueInteractionPerms({
            runtimeSupportsInterjection: false,
            streaming: false,
            hasQueuedMessages: true,
          }),
          runtimeSupportsInterjection: false,
          blockCtx: { ...allClearCtx, runtimeSupportsInterjection: false },
          onInterruptAndRun,
        })}
      />,
    )
    const hint = container.querySelector('[data-queue-denied="interruptAndRun"]')
    expect(hint).not.toBeNull()
    expect(hint?.querySelector('[data-queue-blocked-reason]')?.getAttribute('data-blocked-key')).toBe(
      'blocked.runtimeNoInterject',
    )
    const btn = container.querySelector('[data-queue-op="interruptAndRun"]') as HTMLButtonElement
    expect(btn.getAttribute('aria-disabled')).toBe('true')
    expect(btn.getAttribute('title')).toBe('queue.blocked.runtimeNoInterject')
    fireEvent.click(btn)
    expect(onInterruptAndRun).not.toHaveBeenCalled()
  })

  it('六格未命中(全绿上下文)时不挂 title/data-blocked-reason,动作照常可用(不误导)', () => {
    const onUndo = vi.fn()
    const { container } = render(
      <QueueInteractionBar {...baseProps({ blockCtx: allClearCtx, onUndo })} />,
    )
    expect(container.querySelector('[data-queue-denied]')).toBeNull()
    const undo = container.querySelector('[data-queue-op="undo"]') as HTMLButtonElement
    expect(undo.getAttribute('aria-disabled')).toBe('false')
    expect(undo.getAttribute('title')).toBeNull()
    expect(undo.getAttribute('data-blocked-reason')).toBeNull()
    fireEvent.click(undo)
    expect(onUndo).toHaveBeenCalledWith('q1')
  })

  it('未注入 blockCtx 时行为与 D38/D162① 一致:零 title、拒绝提示走 perms 笼统键', () => {
    const { container } = render(
      <QueueInteractionBar
        {...baseProps({
          perms: queueInteractionPerms({
            runtimeSupportsInterjection: true,
            streaming: true,
            hasQueuedMessages: true,
          }),
        })}
      />,
    )
    const handle = container.querySelector('[data-queue-op="reorderHandle"]') as HTMLElement
    expect(handle.getAttribute('title')).toBeNull()
    const hint = container.querySelector('[data-queue-denied="reorder"]')
    expect(hint?.getAttribute('data-denied-key')).toBe('denied.reorder')
    expect(hint?.querySelector('[data-queue-blocked-reason]')).toBeNull()
  })
})

describe('D162 QueueInteractionBar / 队列并发变更走 queueChanged 分支且输入框内容保留', () => {
  it('并发变更下编辑确认被拦:草稿保留在输入框、不清空不写回(onEdit 不回调)', () => {
    const onEdit = vi.fn()
    const props = baseProps({ onEdit })
    const view = render(<QueueInteractionBar {...props} blockCtx={allClearCtx} />)
    // 队列未变更时进入编辑态并输入草稿
    fireEvent.click(
      view.container.querySelector('[data-queue-op="edit"][data-item-id="q1"]') as HTMLButtonElement,
    )
    const input = view.container.querySelector('[data-queue-op="editInput"]') as HTMLInputElement
    expect(input).not.toBeNull()
    fireEvent.change(input, { target: { value: '我要改的内容' } })
    expect(input.value).toBe('我要改的内容')
    // 队列在"取数→展示"之间被并发变更 → queueChanged 分支
    view.rerender(<QueueInteractionBar {...props} blockCtx={queueChangedCtx} />)
    fireEvent.click(
      view.container.querySelector('[data-queue-op="editConfirm"]') as HTMLButtonElement,
    )
    expect(onEdit).not.toHaveBeenCalled()
    // 输入框内容保留(草稿不被清空,不得让用户以为编辑已落到过期队列上)
    const inputAfter = view.container.querySelector('[data-queue-op="editInput"]') as HTMLInputElement
    expect(inputAfter).not.toBeNull()
    expect(inputAfter.value).toBe('我要改的内容')
    view.unmount()
  })

  it('并发变更时队列项正文原样保留(不静默吞掉用户排队内容)', () => {
    const { container } = render(
      <QueueInteractionBar {...baseProps({ blockCtx: queueChangedCtx })} />,
    )
    expect(container.querySelector('[data-queued-text="第一条排队消息"]')).not.toBeNull()
  })
})

describe('D162 InputNoticeBanner / 六格具体拒因面 + 终态面', () => {
  const SIX_CASES: ReadonlyArray<{
    readonly action: QueueBlockableAction
    readonly ctx: QueueActionBlockContext
    readonly expected: (typeof QUEUE_ACTION_BLOCK_REASONS)[number]
  }> = [
    { action: 'interject', ctx: { ...allClearCtx, runtimeSupportsInterjection: false }, expected: 'runtimeNoInterject' },
    { action: 'interject', ctx: { ...allClearCtx, hasRunningTurn: false }, expected: 'noRunningTurn' },
    { action: 'interject', ctx: { ...allClearCtx, isControlCommand: true }, expected: 'controlCommandNoInterject' },
    { action: 'steer', ctx: { ...allClearCtx, hasWaitingRequests: true }, expected: 'waitingRequestFirst' },
    { action: 'reorder', ctx: { ...allClearCtx, queueChanged: true }, expected: 'queueChanged' },
    { action: 'steer', ctx: { ...allClearCtx, sourceMatches: false }, expected: 'sourceMismatch' },
  ]

  it('六种不可用态逐格渲染,拒因值互不相同(非一句"当前不可用"覆盖全部)', () => {
    const rendered = new Set<string>()
    for (const tc of SIX_CASES) {
      const { container, unmount } = render(
        <InputNoticeBanner actionBlockAction={tc.action} actionBlockCtx={tc.ctx} />,
      )
      const node = container.querySelector('[data-queue-action-block]')
      expect(node, tc.expected).not.toBeNull()
      expect(node?.getAttribute('data-queue-action-block'), tc.expected).toBe(tc.expected)
      expect(
        container.querySelector('[data-queue-action-block-reason]')?.textContent,
        tc.expected,
      ).toBe(`queue.blocked.${tc.expected}`)
      rendered.add(tc.expected)
      unmount()
    }
    expect(rendered.size).toBe(6)
  })

  it('deferred(未发送)与 failed(发送失败)两条终态键互不相同;未给终态不渲染', () => {
    const deferred = render(<InputNoticeBanner sendOutcome="deferred" />)
    expect(deferred.container.querySelector('[data-queue-send-outcome="deferred"]')?.textContent).toBe(
      'queue.outcome.deferred',
    )
    deferred.unmount()
    const failed = render(<InputNoticeBanner sendOutcome="failed" />)
    expect(failed.container.querySelector('[data-queue-send-outcome="failed"]')?.textContent).toBe(
      'queue.outcome.failed',
    )
    failed.unmount()
    const none = render(<InputNoticeBanner />)
    expect(none.container.querySelector('[data-queue-send-outcome]')).toBeNull()
    expect(none.container.querySelector('[data-queue-action-block]')).toBeNull()
    none.unmount()
  })
})

describe('D162 词包覆盖(读真实词包,不 mock)', () => {
  const readQueue = (locale: string): Record<string, unknown> => {
    const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
    const parsed = JSON.parse(raw) as {
      ai?: { pane?: { inputNotices?: { queue?: Record<string, unknown> } } }
    }
    const node = parsed.ai?.pane?.inputNotices?.queue
    if (!node) throw new Error(`missing ai.pane.inputNotices.queue in ${locale}.json`)
    return node
  }

  it('六格 blocked.* 五语言齐、非空、逐语言互不相同(同串即未落实)', () => {
    for (const locale of LOCALES) {
      const blocked = readQueue(locale).blocked as Record<string, string>
      expect(blocked, locale).toBeTruthy()
      const texts = QUEUE_ACTION_BLOCK_REASONS.map((reason) => blocked[reason])
      for (const text of texts) {
        expect(typeof text === 'string' && text.trim().length > 0, `${locale} blocked`).toBe(true)
      }
      expect(new Set(texts).size, `${locale} 六格文案互不相同`).toBe(6)
    }
  })

  it('outcome.deferred / outcome.failed 五语言齐、非空、两条互不相同', () => {
    for (const locale of LOCALES) {
      const outcome = readQueue(locale).outcome as Record<string, string>
      expect(outcome, locale).toBeTruthy()
      const texts = QUEUE_SEND_OUTCOMES.map((o) => outcome[o])
      for (const text of texts) {
        expect(typeof text === 'string' && text.trim().length > 0, `${locale} outcome`).toBe(true)
      }
      expect(texts[0]).not.toBe(texts[1])
    }
  })

  it('blocked/outcome 键集五语言 parity(不得单语缺键)', () => {
    const keysOf = (locale: string): string[] => {
      const queue = readQueue(locale)
      return [
        ...Object.keys(queue.blocked as Record<string, unknown>).map((k) => `blocked.${k}`),
        ...Object.keys(queue.outcome as Record<string, unknown>).map((k) => `outcome.${k}`),
      ].sort()
    }
    const base = keysOf('zh-CN')
    expect(base).toEqual(
      [...QUEUE_ACTION_BLOCK_REASONS.map((r) => `blocked.${r}`), ...QUEUE_SEND_OUTCOMES.map((o) => `outcome.${o}`)].sort(),
    )
    for (const locale of LOCALES) {
      expect(keysOf(locale), locale).toEqual(base)
    }
  })
})
// ⁠​‌​​
