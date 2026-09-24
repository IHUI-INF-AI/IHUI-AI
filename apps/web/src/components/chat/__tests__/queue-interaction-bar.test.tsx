// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { queueInteractionPerms } from '@ihui/shared/chat/input-notices'
import { QUEUE_INTERACTION_KINDS, type FollowUpMode } from '@ihui/shared/chat/queue-interactions'

import { useChatStore, type SideQueueItem } from '@/stores/chat'
import { QueueInteractionBar, type QueuedItemView } from '../queue-interaction-bar'

// 只断言**结构与判据**(四动作入口 / 拒绝显式渲染 / 降级键 / 模式切换),文案一律走 key,
// 真实文案覆盖由下面「读真实词包」那组用例守住 —— 组件测试不依赖文案措辞变动。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const here = dirname(fileURLToPath(import.meta.url))
// __tests__ → chat → components → src → web(apps/web) → apps → 仓库根,共 6 级
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

/** ai.pane.queueOps 词包是否已落(键由 i18n 子任务独占写入;键清单见本组用例与交付报告)。
 *  未落时该组用例整体 **skip(不删不弱化)** —— 键一落地自动恢复执行,缺任意键即红。 */
const queueOpsAvailable = LOCALES.every((loc) => {
  try {
    const parsed = JSON.parse(readFileSync(join(MESSAGES_ROOT, `${loc}.json`), 'utf8')) as {
      ai?: { pane?: { queueOps?: unknown } }
    }
    return !!parsed.ai?.pane?.queueOps
  } catch {
    return false
  }
})

const items: QueuedItemView[] = [
  { id: 'q1', text: '第一条' },
  { id: 'q2', text: '第二条' },
]

/** 全绿许可:队列非空 + 非流式 + Runtime 支持插话 */
const fullPerms = () =>
  queueInteractionPerms({
    runtimeSupportsInterjection: true,
    streaming: false,
    hasQueuedMessages: true,
  })

const baseProps = (overrides?: Partial<Parameters<typeof QueueInteractionBar>[0]>) => ({
  items,
  perms: fullPerms(),
  mode: 'queue' as FollowUpMode,
  runtimeSupportsInterjection: true,
  ...overrides,
})

describe('D38 QueueInteractionBar / 渲染结构与四动作', () => {
  it('队列空不渲染任何内容(不空转)', () => {
    const { container } = render(<QueueInteractionBar {...baseProps({ items: [] })} />)
    expect(container.querySelector('[data-queue-ops]')).toBeNull()
  })

  it('每项渲染重排把手 + 正文 + 撤回 + 编辑;尾部渲染打断执行 + 模式两钮', () => {
    const { container } = render(<QueueInteractionBar {...baseProps()} />)
    expect(container.querySelectorAll('[data-queue-op="reorderHandle"]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-queue-op="undo"]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-queue-op="edit"]')).toHaveLength(2)
    expect(container.querySelector('[data-queue-op="interruptAndRun"]')).not.toBeNull()
    expect(container.querySelector('[data-queue-op="mode"][data-mode="steer"]')).not.toBeNull()
    expect(container.querySelector('[data-queue-op="mode"][data-mode="queue"]')).not.toBeNull()
    // 正文有值(不得留空壳)
    const text = container.querySelector('[data-queued-item="q1"] [data-queued-text="第一条"]')
    expect(text).not.toBeNull()
  })

  it('撤回点击回调带目标项 id', () => {
    const onUndo = vi.fn()
    const { container } = render(<QueueInteractionBar {...baseProps({ onUndo })} />)
    ;(
      container.querySelector('[data-queue-op="undo"][data-item-id="q2"]') as HTMLButtonElement
    ).click()
    expect(onUndo).toHaveBeenCalledWith('q2')
  })

  it('「打断并执行」上抛 interruptPlan:流式中 stopFirst=true、thenRun=队首(不自行选择队首)', () => {
    const onInterruptAndRun = vi.fn()
    const { container } = render(
      <QueueInteractionBar {...baseProps({ streaming: true, onInterruptAndRun })} />,
    )
    ;(container.querySelector('[data-queue-op="interruptAndRun"]') as HTMLButtonElement).click()
    expect(onInterruptAndRun).toHaveBeenCalledWith({ stopFirst: true, thenRun: 'q1' })
  })

  it('非流式打断计划 stopFirst=false', () => {
    const onInterruptAndRun = vi.fn()
    const { container } = render(
      <QueueInteractionBar {...baseProps({ streaming: false, onInterruptAndRun })} />,
    )
    ;(container.querySelector('[data-queue-op="interruptAndRun"]') as HTMLButtonElement).click()
    expect(onInterruptAndRun).toHaveBeenCalledWith({ stopFirst: false, thenRun: 'q1' })
  })

  it('模式切换:点击回调目标模式;当前模式 aria-pressed=true', () => {
    const onModeChange = vi.fn()
    const { container } = render(
      <QueueInteractionBar {...baseProps({ mode: 'steer', onModeChange })} />,
    )
    const steerBtn = container.querySelector('[data-queue-op="mode"][data-mode="steer"]')
    expect(steerBtn?.getAttribute('aria-pressed')).toBe('true')
    ;(
      container.querySelector('[data-queue-op="mode"][data-mode="queue"]') as HTMLButtonElement
    ).click()
    expect(onModeChange).toHaveBeenCalledWith('queue')
  })

  it('编辑流:点编辑 → 行内输入出现 → 确认回调(已 trim);取消不回调', () => {
    const onEdit = vi.fn()
    const { container } = render(<QueueInteractionBar {...baseProps({ onEdit })} />)
    fireEvent.click(
      container.querySelector('[data-queue-op="edit"][data-item-id="q1"]') as HTMLButtonElement,
    )
    const input = container.querySelector('[data-queue-op="editInput"]') as HTMLInputElement
    expect(input).not.toBeNull()
    fireEvent.change(input, { target: { value: '  改后的第一条  ' } })
    fireEvent.click(container.querySelector('[data-queue-op="editConfirm"]') as HTMLButtonElement)
    expect(onEdit).toHaveBeenCalledWith('q1', '改后的第一条')
    // 取消路径
    fireEvent.click(
      container.querySelector('[data-queue-op="edit"][data-item-id="q2"]') as HTMLButtonElement,
    )
    fireEvent.click(container.querySelector('[data-queue-op="editCancel"]') as HTMLButtonElement)
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('进入编辑态后焦点落在输入框(ref 聚焦,替代被 jsx-a11y 拦下的 autoFocus)', () => {
    const { container } = render(<QueueInteractionBar {...baseProps()} />)
    fireEvent.click(
      container.querySelector('[data-queue-op="edit"][data-item-id="q1"]') as HTMLButtonElement,
    )
    const input = container.querySelector('[data-queue-op="editInput"]') as HTMLInputElement
    expect(document.activeElement).toBe(input)
  })

  it('编辑确认空文本不回调(拒绝把队列项清空)', () => {
    const onEdit = vi.fn()
    const { container } = render(<QueueInteractionBar {...baseProps({ onEdit })} />)
    fireEvent.click(
      container.querySelector('[data-queue-op="edit"][data-item-id="q1"]') as HTMLButtonElement,
    )
    const input = container.querySelector('[data-queue-op="editInput"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.click(container.querySelector('[data-queue-op="editConfirm"]') as HTMLButtonElement)
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('键盘重排:把手 ↑↓ 上抛 onReorder(先摘后插语义);端点方向不越界', () => {
    const onReorder = vi.fn()
    const three: QueuedItemView[] = [
      { id: 'q1', text: '第一条' },
      { id: 'q2', text: '第二条' },
      { id: 'q3', text: '第三条' },
    ]
    const { container } = render(
      <QueueInteractionBar {...baseProps({ items: three, onReorder })} />,
    )
    const handle = container.querySelector(
      '[data-queue-op="reorderHandle"][data-index="1"]',
    ) as HTMLElement
    fireEvent.keyDown(handle, { key: 'ArrowUp' })
    expect(onReorder).toHaveBeenLastCalledWith(1, 0)
    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    expect(onReorder).toHaveBeenLastCalledWith(1, 2)
    // 首项↑ / 末项↓ 不越界(均不得再上抛)
    const first = container.querySelector(
      '[data-queue-op="reorderHandle"][data-index="0"]',
    ) as HTMLElement
    fireEvent.keyDown(first, { key: 'ArrowUp' })
    const last = container.querySelector(
      '[data-queue-op="reorderHandle"][data-index="2"]',
    ) as HTMLElement
    fireEvent.keyDown(last, { key: 'ArrowDown' })
    expect(onReorder).toHaveBeenCalledTimes(2)
  })
})

describe('D38 QueueInteractionBar / 许可拒绝 deniedKey 显式渲染', () => {
  it('流式中:reorder 被拒 → 显式渲染 data-denied-key="denied.reorder";把手点击不回调;撤回不受影响', () => {
    const onReorder = vi.fn()
    const onUndo = vi.fn()
    const { container } = render(
      <QueueInteractionBar
        {...baseProps({
          perms: queueInteractionPerms({
            runtimeSupportsInterjection: true,
            streaming: true,
            hasQueuedMessages: true,
          }),
          onReorder,
          onUndo,
        })}
      />,
    )
    const hint = container.querySelector('[data-queue-denied="reorder"]')
    expect(hint).not.toBeNull()
    expect(hint?.getAttribute('data-denied-key')).toBe('denied.reorder')
    expect((hint?.textContent ?? '').length).toBeGreaterThan(0)
    const handle = container.querySelector(
      '[data-queue-op="reorderHandle"][data-index="0"]',
    ) as HTMLElement
    fireEvent.keyDown(handle, { key: 'ArrowDown' })
    expect(onReorder).not.toHaveBeenCalled()
    ;(
      container.querySelector('[data-queue-op="undo"][data-item-id="q1"]') as HTMLButtonElement
    ).click()
    expect(onUndo).toHaveBeenCalledWith('q1')
  })

  it('Runtime 不支持插话:interruptAndRun 被拒 → data-denied-key="denied.interject",点击不回调', () => {
    const onInterruptAndRun = vi.fn()
    const { container } = render(
      <QueueInteractionBar
        {...baseProps({
          perms: queueInteractionPerms({
            runtimeSupportsInterjection: false,
            streaming: false,
            hasQueuedMessages: true,
          }),
          onInterruptAndRun,
        })}
      />,
    )
    const hint = container.querySelector('[data-queue-denied="interruptAndRun"]')
    expect(hint?.getAttribute('data-denied-key')).toBe('denied.interject')
    ;(container.querySelector('[data-queue-op="interruptAndRun"]') as HTMLButtonElement).click()
    expect(onInterruptAndRun).not.toHaveBeenCalled()
  })

  it('全绿许可时不渲染任何拒绝提示', () => {
    const { container } = render(<QueueInteractionBar {...baseProps()} />)
    expect(container.querySelector('[data-queue-denied]')).toBeNull()
  })
})

describe('D38 QueueInteractionBar / 模式降级提示', () => {
  it('steer 偏好 + Runtime 不支持插话 → 降级键显式渲染(不得静默降级)', () => {
    const { container } = render(
      <QueueInteractionBar {...baseProps({ mode: 'steer', runtimeSupportsInterjection: false })} />,
    )
    const degraded = container.querySelector('[data-mode-degraded="degraded.runtimeNoInterject"]')
    expect(degraded).not.toBeNull()
    expect((degraded?.textContent ?? '').length).toBeGreaterThan(0)
  })

  it('queue 偏好 + Runtime 不支持 → 不降级不提示;全绿 → 无降级提示', () => {
    const a = render(
      <QueueInteractionBar {...baseProps({ mode: 'queue', runtimeSupportsInterjection: false })} />,
    )
    expect(a.container.querySelector('[data-mode-degraded]')).toBeNull()
    a.unmount()
    const b = render(
      <QueueInteractionBar {...baseProps({ mode: 'steer', runtimeSupportsInterjection: true })} />,
    )
    expect(b.container.querySelector('[data-mode-degraded]')).toBeNull()
  })

  it('生效模式落在根节点 data-queue-ops-mode 上(降级后为 queue)', () => {
    const { container } = render(
      <QueueInteractionBar {...baseProps({ mode: 'steer', runtimeSupportsInterjection: false })} />,
    )
    expect(container.querySelector('[data-queue-ops-mode="queue"]')).not.toBeNull()
  })
})

describe.skipIf(!queueOpsAvailable)(
  'D38 词包覆盖(读真实词包,不 mock;ai.pane.queueOps 键落地后自动启用)',
  () => {
    const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
      Object.entries(obj).flatMap(([k, v]) =>
        v && typeof v === 'object'
          ? flat(v as Record<string, unknown>, `${prefix}${k}.`)
          : [`${prefix}${k}`],
      )

    const readQueueOps = (locale: string): Record<string, unknown> => {
      const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
      const parsed = JSON.parse(raw) as { ai?: { pane?: Record<string, unknown> } }
      const node = parsed.ai?.pane?.queueOps
      if (!node) throw new Error(`missing ai.pane.queueOps in ${locale}.json`)
      return node as Record<string, unknown>
    }

    it('五语言键集完全一致(parity)', () => {
      const base = flat(readQueueOps('zh-CN')).sort()
      expect(base.length).toBeGreaterThanOrEqual(13)
      for (const locale of LOCALES) {
        expect(flat(readQueueOps(locale)).sort(), locale).toEqual(base)
      }
    })

    it('四动作 + 模式 + 降级 + 三拒绝键全齐(五语言)', () => {
      for (const locale of LOCALES) {
        const keys = flat(readQueueOps(locale))
        expect(keys, `${locale} reorderAria`).toContain('reorderAria')
        expect(keys, `${locale} undo`).toContain('undo')
        expect(keys, `${locale} edit`).toContain('edit')
        expect(keys, `${locale} interruptAndRun`).toContain('interruptAndRun')
        expect(keys, `${locale} mode.steer`).toContain('mode.steer')
        expect(keys, `${locale} mode.queue`).toContain('mode.queue')
        expect(keys, `${locale} degraded`).toContain('degraded.runtimeNoInterject')
        expect(keys, `${locale} denied.reorder`).toContain('denied.reorder')
        expect(keys, `${locale} denied.undo`).toContain('denied.undo')
        expect(keys, `${locale} denied.interject`).toContain('denied.interject')
      }
    })

    it('zh-CN 逐字对齐判据原文(任务原文 + D69 同族句)', () => {
      const node = readQueueOps('zh-CN') as Record<string, string | Record<string, string>>
      expect(node.reorderAria).toBe('拖动调整排队顺序；聚焦后可使用上下方向键')
      expect(node.undo).toBe('撤回')
      expect(node.edit).toBe('编辑')
      expect(node.interruptAndRun).toBe('打断并执行')
      expect(node.mode).toEqual({
        label: '队列模式',
        steer: '插话优先',
        queue: '排队优先',
      })
      expect(node.degraded).toEqual({
        runtimeNoInterject: '当前 Runtime 不支持插话，消息将继续排队',
      })
      expect(node.denied).toEqual({
        reorder: '无法调整排队顺序',
        undo: '无法撤回排队消息',
        interject: '当前 Runtime 不支持插话，消息将继续排队',
      })
    })

    it('所有语言取值非空(不得留空串占位)', () => {
      for (const locale of LOCALES) {
        const walk = (obj: Record<string, unknown>): void => {
          for (const value of Object.values(obj)) {
            if (value && typeof value === 'object') walk(value as Record<string, unknown>)
            else
              expect(typeof value === 'string' && value.trim().length > 0, `${locale}`).toBe(true)
          }
        }
        walk(readQueueOps(locale))
      }
    })

    it('ja 文案不残留简体中文词(抽检高频误留字)', () => {
      const raw = JSON.stringify(readQueueOps('ja'))
      for (const zh of ['排队', '消息', '调整', '无法', '执行', '优先']) {
        expect(raw.includes(zh), `ja 不应含简体词「${zh}」`).toBe(false)
      }
    })
  },
)

describe('D38 同批键存活(与 queueOps 键是否落地无关,恒执行)', () => {
  it('ai.pane.inputNotices 五语言仍在;ai.pane.multiPane 存在则为对象', () => {
    for (const locale of LOCALES) {
      const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
      const parsed = JSON.parse(raw) as { ai?: { pane?: Record<string, unknown> } }
      expect(parsed.ai?.pane?.inputNotices, `${locale} inputNotices`).toBeTruthy()
      const multiPane = parsed.ai?.pane?.multiPane
      if (multiPane !== undefined) {
        expect(multiPane, `${locale} multiPane`).toBeTypeOf('object')
      }
    }
  })
})

describe('D38 store 四动作(真实 store,不 mock;W27 消费点不动)', () => {
  const seed = (entry: SideQueueItem[]): void => {
    useChatStore.setState({ sideQueueByConversation: { 'conv-1': entry } })
  }
  const mk = (id: string, text: string, createdAt: number): SideQueueItem => ({
    id,
    text,
    createdAt,
  })

  beforeEach(() => {
    useChatStore.setState({ sideQueueByConversation: {} })
  })

  it('requeue 重排(先摘后插);越界/同位 no-op', () => {
    seed([mk('a', 'A', 1), mk('b', 'B', 2), mk('c', 'C', 3)])
    useChatStore.getState().requeue('conv-1', 0, 2)
    expect(useChatStore.getState().sideQueueByConversation['conv-1']?.map((q) => q.id)).toEqual([
      'b',
      'c',
      'a',
    ])
    useChatStore.getState().requeue('conv-1', -1, 1)
    useChatStore.getState().requeue('conv-1', 1, 1)
    useChatStore.getState().requeue('conv-1', 0, 99)
    expect(useChatStore.getState().sideQueueByConversation['conv-1']?.map((q) => q.id)).toEqual([
      'b',
      'c',
      'a',
    ])
  })

  it('removeQueued 移除指定项;桶空删键', () => {
    seed([mk('a', 'A', 1), mk('b', 'B', 2)])
    useChatStore.getState().removeQueued('conv-1', 'a')
    expect(useChatStore.getState().sideQueueByConversation['conv-1']?.map((q) => q.id)).toEqual([
      'b',
    ])
    useChatStore.getState().removeQueued('conv-1', 'b')
    expect(useChatStore.getState().sideQueueByConversation['conv-1']).toBeUndefined()
  })

  it('editQueued 只改 text,createdAt 元数据不动;空文本 no-op', () => {
    seed([mk('a', 'A', 111)])
    useChatStore.getState().editQueued('conv-1', 'a', '  A2  ')
    const item = useChatStore.getState().sideQueueByConversation['conv-1']?.[0]
    expect(item?.text).toBe('A2')
    expect(item?.createdAt).toBe(111)
    useChatStore.getState().editQueued('conv-1', 'a', '   ')
    expect(useChatStore.getState().sideQueueByConversation['conv-1']?.[0]?.text).toBe('A2')
  })

  it('interruptAndRun 返回队首并移除(执行由调用方负责);桶空返回 null 且队列不动', () => {
    seed([mk('a', 'A', 1), mk('b', 'B', 2)])
    const head = useChatStore.getState().interruptAndRun('conv-1')
    expect(head?.id).toBe('a')
    expect(useChatStore.getState().sideQueueByConversation['conv-1']?.map((q) => q.id)).toEqual([
      'b',
    ])
    expect(useChatStore.getState().interruptAndRun('nope')).toBeNull()
    expect(useChatStore.getState().sideQueueByConversation['conv-1']?.map((q) => q.id)).toEqual([
      'b',
    ])
  })

  it('互不回归:既有 enqueue/shift 消费语义不变(shift 仍取当前队首;enqueue 追加尾部不动既有项)', () => {
    seed([mk('a', 'A', 1), mk('b', 'B', 2)])
    useChatStore.getState().enqueueSideQuestion('conv-1', '  C  ')
    let bucket = useChatStore.getState().sideQueueByConversation['conv-1']
    expect(bucket?.slice(0, 2).map((q) => q.id)).toEqual(['a', 'b'])
    expect(bucket?.[2]?.text).toBe('C')
    const shifted = useChatStore.getState().shiftSideQuestion('conv-1')
    expect(shifted?.id).toBe('a')
    bucket = useChatStore.getState().sideQueueByConversation['conv-1']
    expect(bucket?.[0]?.id).toBe('b')
  })

  it('验收:重排后发送顺序 —— 流结束逐条 shift 的消费顺序 == 重排后的数组顺序', () => {
    seed([mk('a', 'A', 1), mk('b', 'B', 2), mk('c', 'C', 3)])
    useChatStore.getState().requeue('conv-1', 2, 0) // [c, a, b]
    expect(useChatStore.getState().sideQueueByConversation['conv-1']?.map((q) => q.id)).toEqual([
      'c',
      'a',
      'b',
    ])
    // 消费端(message-input 流结束 effect / answerCurrentSideQuestion)唯一读取路径是队首 shift;
    // 逐条 shift 的返回序列必须与重排结果逐位相等
    const consumed: string[] = []
    for (let i = 0; i < 3; i += 1) {
      const item = useChatStore.getState().shiftSideQuestion('conv-1')
      if (item) consumed.push(item.id)
    }
    expect(consumed).toEqual(['c', 'a', 'b'])
    expect(useChatStore.getState().sideQueueByConversation['conv-1']).toBeUndefined()
  })

  it('验收:编辑/撤回参与重排后顺序 —— editQueued 不改变位置,interruptAndRun 取重排后队首', () => {
    seed([mk('a', 'A', 1), mk('b', 'B', 2), mk('c', 'C', 3)])
    useChatStore.getState().requeue('conv-1', 0, 2) // [b, c, a]
    useChatStore.getState().editQueued('conv-1', 'c', 'C2')
    useChatStore.getState().removeQueued('conv-1', 'a') // [b, c]
    expect(useChatStore.getState().sideQueueByConversation['conv-1']?.map((q) => q.id)).toEqual([
      'b',
      'c',
    ])
    const head = useChatStore.getState().interruptAndRun('conv-1')
    expect(head?.id).toBe('b') // 队首 = 重排后的 queue[0](既有读取路径,未另立选择逻辑)
    expect(useChatStore.getState().shiftSideQuestion('conv-1')?.id).toBe('c')
    expect(useChatStore.getState().shiftSideQuestion('conv-1')).toBeNull()
  })

  it('setMode 落点:store.followUpQueueMode 默认 queue;setFollowUpQueueMode 可切;同值 no-op(状态引用不变)', () => {
    expect(useChatStore.getState().followUpQueueMode).toBe('queue')
    useChatStore.getState().setFollowUpQueueMode('steer')
    expect(useChatStore.getState().followUpQueueMode).toBe('steer')
    const before = useChatStore.getState()
    useChatStore.getState().setFollowUpQueueMode('steer')
    expect(useChatStore.getState()).toBe(before) // 同值不产生新状态引用
    useChatStore.getState().setFollowUpQueueMode('queue')
    expect(useChatStore.getState().followUpQueueMode).toBe('queue')
  })

  it('/side 互不回归:D38 四动作只改变 sideQueueByConversation 一个顶层状态键', () => {
    seed([mk('a', 'A', 1), mk('b', 'B', 2), mk('c', 'C', 3)])
    const before = useChatStore.getState()
    const s = before
    s.requeue('conv-1', 0, 2)
    s.editQueued('conv-1', 'b', 'B2')
    s.removeQueued('conv-1', 'c')
    s.interruptAndRun('conv-1')
    const after = useChatStore.getState()
    const changedKeys = Object.keys(after).filter(
      (k) =>
        !Object.is(
          (after as unknown as Record<string, unknown>)[k],
          (before as unknown as Record<string, unknown>)[k],
        ),
    )
    expect(changedKeys).toEqual(['sideQueueByConversation'])
  })
})

// 防御性回归:QUEUE_INTERACTION_KINDS 五动词在 web 侧同样可达(深路径 import 有效性)
describe('D38 shared 深路径可达性', () => {
  it('QUEUE_INTERACTION_KINDS 恰为五种', () => {
    expect(QUEUE_INTERACTION_KINDS).toHaveLength(5)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
