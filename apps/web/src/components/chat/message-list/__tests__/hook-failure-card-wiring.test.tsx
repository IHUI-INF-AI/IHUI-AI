// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-87 Hook 失败可见性卡 · **装车证明 + 成对反例**(2026-10-29 立)。
 *
 * 立因(本仓 §0.9):`packages/shared/src/chat/hook-failures.ts` 的 14 个导出
 * **连测试之外全仓零消费** —— hook 执行失败在界面上完全不存在。本文件从生产入口
 * (`MessageItem`,即消息流真正渲染的那一层)咬住三件事:
 *
 *  ① 有数据 ⇒ 卡片出现,且**状态文案取自 `hookFailureView`**(不是本地映射);
 *  ② 无数据(字段缺失 / 空数组 / 形状坏)⇒ 整段不出现(**不得常驻空卡**);
 *  ③ `resultNotRecorded` ⇒ 必须**显式宣告"未记录最终结果"**(静默留空 = 把"没记录"
 *     伪装成"没问题",这是判定层头注点名的失效型)。
 *
 * 判定层语义(六态各字段值)已由 `packages/shared/src/chat/__tests__/hook-failures.test.ts`
 * 守住,本文件不重测纯函数,只测"接线 + DOM 形态"(§22c 禁复制判据)。
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MessageItem } from '../MessageItem'
import { HookFailureCard, hookFailureRecordsFromMeta } from '../hook-failure-card'
import { TooltipProvider } from '@/components/feedback'
import { useChatStore, type ChatMessage } from '@/stores/chat'
import { HOOK_STATUS_STATES } from '@ihui/shared/chat/hook-failures'

const takeWordCalls: Array<{ ns: string; key: string }> = []
vi.mock('next-intl', () => ({
  useTranslations:
    (ns: string) =>
    (key: string): string => {
      takeWordCalls.push({ ns, key })
      return `[${ns}:${key}]`
    },
  useLocale: () => 'zh-CN',
}))

const NOW = Date.UTC(2026, 9, 29, 12, 0, 0)
const ID = 'a-hook'

function assistant(patch: Partial<ChatMessage> = {}): ChatMessage {
  return { id: ID, role: 'assistant', content: '回答', createdAt: NOW, model: 'm', ...patch }
}

function renderMessage(m: ChatMessage) {
  useChatStore.setState({ messages: [m] })
  return render(
    <TooltipProvider>
      <MessageItem message={m} isLast isStreaming={false} assistantLabel="AI" />
    </TooltipProvider>,
  )
}

beforeEach(() => {
  takeWordCalls.length = 0
})

afterEach(() => {
  cleanup()
  useChatStore.setState({ messages: [] })
})

describe('G-87 hook 失败卡 · 有数据(正向)', () => {
  it('meta.hookFailures 有一条 failed ⇒ 卡片出现,标题/动作取自判定层的键', () => {
    renderMessage(
      assistant({
        meta: {
          hookFailures: [
            {
              id: 'hf-1',
              state: 'failed',
              hookName: 'pre-commit',
              hookEvent: 'tool.before',
              command: 'pnpm lint',
              stderr: 'exit 1',
              exitCode: 1,
              durationMs: 1234,
            },
          ],
        },
      }),
    )

    const card = screen.getByTestId('hook-failure-card')
    expect(card.getAttribute('data-hook-failure-count')).toBe('1')
    const row = screen.getByTestId('hook-failure-row')
    // 状态格的值必须就是判定层那一格 —— 本地映射会漂
    expect(row.getAttribute('data-hook-state')).toBe('failed')
    expect(row.getAttribute('data-hook-tone')).toBe('danger')
    expect(row.getAttribute('data-hook-terminal')).toBe('true')

    // 标题取的是 `state.failed` 这个键(判定层的 titleKey),不是端内自己写的文案
    expect(screen.getByTestId('hook-failure-state').textContent).toBe(
      '[ai.pane.hookFailures:state.failed]',
    )
  })

  it('给到 onAction ⇒ 动作位按判定层的 action 上屏(MessageItem 不传 ⇒ 不摆死按钮)', () => {
    const onAction = vi.fn()
    render(
      <HookFailureCard
        records={[{ id: 'hf-1', state: 'failed', context: { hookName: 'pre-commit' } }]}
        onAction={onAction}
      />,
    )
    const action = screen.getByTestId('hook-failure-action')
    expect(action.getAttribute('data-hook-action')).toBe('retry')
    expect(action.textContent).toContain('[ai.pane.hookFailures:action.retry]')
    action.click()
    expect(onAction).toHaveBeenCalledWith('retry', expect.objectContaining({ id: 'hf-1' }))
  })

  it('resultNotRecorded 的动作是 inspect(DLQ 里没有条目,重试无处可去)', () => {
    render(<HookFailureCard records={[{ state: 'resultNotRecorded' }]} onAction={() => {}} />)
    expect(screen.getByTestId('hook-failure-action').getAttribute('data-hook-action')).toBe(
      'inspect',
    )
  })

  it('六字段证据照实上屏(空字段不渲染空标签)', () => {
    renderMessage(
      assistant({
        meta: {
          hookFailures: [
            {
              state: 'failed',
              hookName: 'h',
              hookEvent: 'e',
              command: '',
              stderr: 'x',
              exitCode: 2,
            },
          ],
        },
      }),
    )
    expect(
      screen.getByTestId('hook-failure-row').querySelector('[data-hook-field-value="hookName"]'),
    ).not.toBeNull()
    // command 是空串 ⇒ 没有证据 ⇒ 不渲染空标签(不能画一个空 dd 冒充"命令为空")
    expect(
      screen.getByTestId('hook-failure-row').querySelector('[data-hook-field-value="command"]'),
    ).toBeNull()
    expect(
      screen.getByTestId('hook-failure-row').querySelector('[data-hook-field-value="exitCode"]')
        ?.textContent,
    ).toBe('2')
  })

  it('resultNotRecorded ⇒ 显式宣告"未记录最终结果"(不得静默留空)', () => {
    renderMessage(assistant({ meta: { hookFailures: [{ state: 'resultNotRecorded' }] } }))

    const row = screen.getByTestId('hook-failure-row')
    expect(row.getAttribute('data-hook-state')).toBe('resultNotRecorded')
    expect(row.getAttribute('data-hook-evidence-missing')).toBe('true')
    // 这一格是本票的核心:没有证据本身就是必须呈现的事实
    expect(screen.getByTestId('hook-failure-evidence-missing')).not.toBeNull()
    // MessageItem 不传 onAction ⇒ 动作位整体不渲染(不摆点了没反应的按钮)
    expect(screen.queryByTestId('hook-failure-action')).toBeNull()
  })

  it('多个失败记录 ⇒ 逐条渲染(不是只显示最后一条)', () => {
    renderMessage(
      assistant({
        meta: {
          hookFailures: [
            { id: 'a', state: 'failed', hookName: 'one' },
            { id: 'b', state: 'timedOut', hookName: 'two' },
          ],
        },
      }),
    )
    expect(screen.getByTestId('hook-failure-card').getAttribute('data-hook-failure-count')).toBe(
      '2',
    )
    const states = screen
      .getAllByTestId('hook-failure-row')
      .map((el) => el.getAttribute('data-hook-state'))
    expect(states).toEqual(['failed', 'timedOut'])
  })
})

describe('G-87 hook 失败卡 · 无数据(反向,成对)', () => {
  it('meta 缺失 ⇒ 整段不出现(不常驻空卡)', () => {
    renderMessage(assistant())
    expect(screen.queryByTestId('hook-failure-card')).toBeNull()
  })

  it('hookFailures 是空数组 ⇒ 不出现(空数组 = 确实没有,不是"有一条空记录")', () => {
    renderMessage(assistant({ meta: { hookFailures: [] } }))
    expect(screen.queryByTestId('hook-failure-card')).toBeNull()
  })

  it('形状坏(非数组 / 条目非对象 / state 认不出)⇒ 不出现,不猜不兜底', () => {
    const bad: unknown[] = [
      { hookFailures: 'not-an-array' },
      { hookFailures: [null, 42, 'x'] },
      // 认不出的 state 必须丢弃:不许兜底成 resultNotRecorded(那一格的真事实不能被赝品占用)
      { hookFailures: [{ state: 'exploded' }] },
      {},
    ]
    for (const meta of bad) {
      cleanup()
      renderMessage(assistant({ meta: meta as Record<string, unknown> }))
      expect(screen.queryByTestId('hook-failure-card'), JSON.stringify(meta)).toBeNull()
    }
  })

  it('纯函数自证:六态全认、非六态全丢(与 shared 名单同源)', () => {
    const all = hookFailureRecordsFromMeta({
      hookFailures: HOOK_STATUS_STATES.map((state) => ({ state })),
    })
    expect(all.map((r) => r.state)).toEqual([...HOOK_STATUS_STATES])

    const mixed = hookFailureRecordsFromMeta({
      hookFailures: [{ state: 'failed' }, { state: 'nope' }, { state: 'timedOut' }],
    })
    expect(mixed.map((r) => r.state)).toEqual(['failed', 'timedOut'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
