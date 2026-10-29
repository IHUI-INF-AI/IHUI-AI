// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * D58 ⇄ D21 联动接线锁(2026-10-29 立)。
 *
 * 立因:`fold-policy.ts` 的 `resolveCategoryInitialOpen` 是 D58 类目卡与 D21 折叠策略的
 * 正式联动出口,但全仓**零消费** —— 类目卡此前直写 `run.expandStrategy === 'expand'`,
 * 于是 'auto' 档的 15 个类目一律按折叠开,用户在 FoldPolicyButton 里选"强制展开"
 * 对类目卡完全无效(判据在、消费者为 0 的那一型)。
 *
 * 本件咬三件事(不复制判据,全部经生产出口断言):
 *  ① 'expand' / 'collapse' 两档照旧(行为零回归);
 *  ② 'auto' 档真的跟随 D21:轻任务(工具少)展开、重任务(工具多)折叠;
 *  ③ 用户在设置里切模式后,已挂载且未被亲手操作过的卡会跟着重算。
 */
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string =>
      `[${key}]`,
  useLocale: () => 'zh-CN',
}))

vi.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({ track: vi.fn() }),
}))

import { ToolCallSummaryCard } from '@/components/ai/progress-sections/tool-call-summary-card'
import { TooltipProvider } from '@/components/feedback'
import {
  FOLD_POLICY_EVENT,
  FOLD_POLICY_KEY,
  AUTO_COLLAPSE_TOOL_CALLS,
} from '@/components/chat/message-list/fold-policy'

type ToolCall = { id: string; toolName: string; status: string; args: Record<string, unknown> }

function calls(toolName: string, n: number): ToolCall[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${toolName}-${i}`,
    toolName,
    status: 'success',
    args: {},
  }))
}

function renderCard(toolCalls: ToolCall[]) {
  render(
    <TooltipProvider>
      <ToolCallSummaryCard toolCalls={toolCalls} isStreaming={false} />
    </TooltipProvider>,
  )
}

/** 展开态读法:FoldableSection 的 aria-expanded 是既有可判据,不另立 DOM 断言。 */
function isCategoryOpen(categoryKey: string): boolean | null {
  const card = screen.getByTestId(`tool-call-category-${categoryKey}`)
  const trigger = card.querySelector('[aria-expanded]')
  if (!trigger) return null
  return trigger.getAttribute('aria-expanded') === 'true'
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('D58 ⇄ D21 语义例外集 · 渲染侧阳性对照(2026-10-29)', () => {
  // 同一套"远超阈值"的读数:工具数 = 阈值 × 10
  const heavy = AUTO_COLLAPSE_TOOL_CALLS * 10

  it('对照 (b):重任务 + 含 AskUserQuestion ⇒ user_interaction 卡不折叠', () => {
    window.localStorage.setItem(FOLD_POLICY_KEY, 'auto')
    renderCard([
      ...calls('read_file', heavy),
      { id: 'ask-1', toolName: 'AskUserQuestion', status: 'running', args: {} },
    ])
    expect(isCategoryOpen('user_interaction')).toBe(true)
  })

  it('对照 (a):同规格但不含例外 ⇒ file_read 卡折叠(阈值判据未被削弱)', () => {
    window.localStorage.setItem(FOLD_POLICY_KEY, 'auto')
    renderCard(calls('read_file', heavy))
    expect(isCategoryOpen('file_read')).toBe(false)
    expect(screen.queryByTestId('tool-call-category-user_interaction')).toBeNull()
  })

  it('混合语义:类目内混有例外工具 ⇒ 整卡展开,同类重任务的普通卡仍折叠', () => {
    window.localStorage.setItem(FOLD_POLICY_KEY, 'auto')
    renderCard([
      { id: 'a1', toolName: 'ask_user', status: 'success', args: {} },
      { id: 'a2', toolName: 'AskUserQuestion', status: 'running', args: {} },
      ...calls('read_file', heavy),
    ])
    expect(isCategoryOpen('user_interaction')).toBe(true)
    expect(isCategoryOpen('file_read')).toBe(false)
  })

  it('用户「强制折叠」仍压过语义例外(D21 规则①:用户意志最高)', () => {
    window.localStorage.setItem(FOLD_POLICY_KEY, 'collapsed')
    renderCard([
      ...calls('read_file', heavy),
      { id: 'ask-1', toolName: 'AskUserQuestion', status: 'running', args: {} },
    ])
    expect(isCategoryOpen('user_interaction')).toBe(false)
  })
})

describe('D58 ⇄ D21 联动:类目卡初值经 resolveCategoryInitialOpen 解析', () => {
  it('auto 档 · 轻任务(工具数 ≤ 阈值)⇒ 类目卡展开', () => {
    window.localStorage.setItem(FOLD_POLICY_KEY, 'auto')
    renderCard(calls('read_file', 1))
    expect(isCategoryOpen('file_read')).toBe(true)
  })

  it('auto 档 · 重任务(工具数 > 阈值)⇒ 类目卡折叠', () => {
    window.localStorage.setItem(FOLD_POLICY_KEY, 'auto')
    renderCard(calls('read_file', AUTO_COLLAPSE_TOOL_CALLS + 2))
    expect(isCategoryOpen('file_read')).toBe(false)
  })

  it('expanded 档 · 重任务也强制展开(此前该配置对类目卡完全无效)', () => {
    window.localStorage.setItem(FOLD_POLICY_KEY, 'expanded')
    renderCard(calls('read_file', AUTO_COLLAPSE_TOOL_CALLS + 5))
    expect(isCategoryOpen('file_read')).toBe(true)
  })

  it('collapsed 档 · 轻任务也强制折叠', () => {
    window.localStorage.setItem(FOLD_POLICY_KEY, 'collapsed')
    renderCard(calls('read_file', 1))
    expect(isCategoryOpen('file_read')).toBe(false)
  })

  it('设置变更广播 ⇒ 已挂载且未被亲手操作过的卡跟随重算', () => {
    window.localStorage.setItem(FOLD_POLICY_KEY, 'collapsed')
    renderCard(calls('read_file', 1))
    expect(isCategoryOpen('file_read')).toBe(false)

    // 用户在设置里切到"强制展开",FoldPolicyButton 的真实写入路径
    act(() => {
      window.localStorage.setItem(FOLD_POLICY_KEY, 'expanded')
      window.dispatchEvent(new Event(FOLD_POLICY_EVENT))
    })

    expect(isCategoryOpen('file_read')).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
