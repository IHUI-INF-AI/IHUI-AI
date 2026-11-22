// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Esc 无层栈协议 · 已接线代表浮层的栈语义增量用例(台账 L10421 票,2026-10-09)。
 *
 * overlay-stack-three-layer.test.tsx 守的是"纯栈 + Dialog 家族"的通用语义;
 * 本文件守本票新接线的代表真的进了栈、并且按栈顶独占语义消费 Esc:
 *  - 自绘层 TerminalHistorySearch(挂载 push / 卸载 pop,Esc 首行栈顶守卫);
 *  - PortalPanel 承载层 UnifiedSuggestionPanel / SlashCommandPalette
 *    (稳定 overlayId 传给 PortalPanel 统一注册,组件自有 Esc 与 PortalPanel
 *    统一 Esc 共用同一 isTopOverlay 判定)。
 * 解阻判据:三层叠开按一次 Esc 只关最上层,其余层保持打开。
 *
 * 判别力凭据(2026-10-30 现跑变异档,证本文件"有牙"而非恒绿 —— 改
 * `packages/ui-react/src/lib/overlay-stack.ts` 的 `isTopOverlay` 函数体后跑
 * `cd apps/web && npx vitest run src/lib/overlay-stack.test.ts
 * src/lib/overlay-stack-three-layer.test.tsx src/lib/overlay-stack-wired.test.tsx`,
 * 跑完按开工前的磁盘原字节还原并核验 `git hash-object` == HEAD blob):
 *   · 基线(HEAD 字节)          ⇒ 20 passed / 0 failed
 *   · 恒真 `return true`(过度放行)⇒ **10 failed / 10 passed**,本文件的
 *     「三层叠开按一次 Esc 只关最上层,关闭后下层仍响应下一次 Esc」与
 *     「自绘层 TerminalHistorySearch:…非栈顶不吃 Esc」都在红名单里。
 *   · 恒假 `return false`(过度拦截)⇒ 17 failed / 3 passed。
 * 两向都翻红 ⇒ 变异确实经 `@ihui/ui-react` 的 `main: ./src/index.ts` 直达测试图,
 * 且本文件的断言打在**本仓那一层**(自绘组件自己的 `isTopOverlay` 守卫)而非 Radix 内建。
 * 这直接否证了 `e2e/esc-overlay-stack.spec.ts` 头部旧注记的"过度放行那一维要咬住必须
 * 有登录态"——真机维仍未证,但组件维在本文件已咬住(见该文件 2026-10-30 更正)。
 */

import * as React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// feedback barrel 在本测试图里只被用到 Tooltip;mock 成透传壳,避免 barrel 拖大依赖面。
// PortalPanel 走独立路径 '@/components/feedback/portal-panel',不受此 mock 影响。
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

import { SlashCommandPalette } from '@/components/ai/slash-command-palette'
import { UnifiedSuggestionPanel } from '@/components/chat/unified-suggestion-panel'
import { TerminalHistorySearch } from '@/components/ide/terminal-panel/TerminalHistorySearch'
import { __resetOverlayStack, getOverlayStack, popOverlay, pushOverlay } from '@/lib/overlay-stack'

const HISTORY_ID = 'terminal-history-search'
const PANEL_ID = 'unified-suggestion-panel'
const SLASH_ID = 'slash-command-palette'
const UPPER_ID = 'test:upper-layer'

const noop = () => {}

function renderHistory(onClose: () => void) {
  return render(
    <TerminalHistorySearch
      query=""
      setQuery={noop}
      index={0}
      setIndex={noop}
      entries={[{ command: 'ls', cwd: '/w', timestamp: 1, exitCode: 0, frequency: 1 }]}
      allEntries={[]}
      onSelect={noop}
      onClose={onClose}
      inputRef={{ current: null } as React.RefObject<HTMLInputElement | null>}
    />,
  )
}

/** 历史搜索条的搜索框(aria-label 由 ide.terminalPanel.historySearchAria 键透传) */
function historyInput(): HTMLElement {
  return screen.getByLabelText('terminalPanel.historySearchAria')
}

/** 统一建议面板的搜索框:PortalPanel portal 到 body,不能在 render container 里找 */
function panelInput(): HTMLElement {
  const input = screen.getByTestId('unified-suggestion-panel').querySelector('input')
  if (!input) throw new Error('unified-suggestion-panel 内未渲染 input')
  return input
}

describe('Esc 无层栈协议 · 已接线代表浮层', () => {
  beforeEach(() => __resetOverlayStack())
  afterEach(() => cleanup())

  it('自绘层 TerminalHistorySearch:挂载入栈、卸载出栈;非栈顶不吃 Esc,栈顶才关自己', () => {
    const onClose = vi.fn()
    const { unmount } = renderHistory(onClose)
    expect([...getOverlayStack()]).toEqual([HISTORY_ID])

    // 上方还有别的层 → Esc 不消费,自己保持打开
    pushOverlay(UPPER_ID)
    fireEvent.keyDown(historyInput(), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()

    // 上层出栈、自己成为栈顶 → Esc 才关自己
    popOverlay(UPPER_ID)
    fireEvent.keyDown(historyInput(), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    unmount()
    expect(getOverlayStack()).not.toContain(HISTORY_ID)
  })

  it('PortalPanel 承载层:稳定 overlayId 随 open 入栈、close 出栈(斜杠命令面板)', () => {
    const onOpenChange = vi.fn()
    const view = render(
      <SlashCommandPalette commands={[]} open onOpenChange={onOpenChange} onSelect={noop}>
        <button type="button">/</button>
      </SlashCommandPalette>,
    )
    expect(getOverlayStack()).toContain(SLASH_ID)

    view.rerender(
      <SlashCommandPalette commands={[]} open={false} onOpenChange={onOpenChange} onSelect={noop}>
        <button type="button">/</button>
      </SlashCommandPalette>,
    )
    expect(getOverlayStack()).not.toContain(SLASH_ID)
  })

  it('三层叠开按一次 Esc 只关最上层,关闭后下层仍响应下一次 Esc', async () => {
    const historyClose = vi.fn()
    const panelClose = vi.fn()
    renderHistory(historyClose)
    const panel = render(
      <UnifiedSuggestionPanel
        open
        anchorRef={{ current: null } as React.RefObject<HTMLElement | null>}
        onClose={panelClose}
        states={[]}
        onSelect={noop}
      />,
    )
    pushOverlay(UPPER_ID)
    expect([...getOverlayStack()]).toEqual([HISTORY_ID, PANEL_ID, UPPER_ID])

    // 焦点在中间层输入框按 Esc:非栈顶 → 中间层与底层都不消费
    fireEvent.keyDown(panelInput(), { key: 'Escape' })
    expect(panelClose).not.toHaveBeenCalled()
    expect(historyClose).not.toHaveBeenCalled()

    // 上层出栈后,再按一次 Esc:只关中间层,底层历史搜索条保持打开
    popOverlay(UPPER_ID)
    fireEvent.keyDown(panelInput(), { key: 'Escape' })
    expect(panelClose).toHaveBeenCalled()
    expect(historyClose).not.toHaveBeenCalled()

    // 中间层真正关闭出栈后,底层成为栈顶 → 下一次 Esc 由它消费
    panel.rerender(
      <UnifiedSuggestionPanel
        open={false}
        anchorRef={{ current: null } as React.RefObject<HTMLElement | null>}
        onClose={panelClose}
        states={[]}
        onSelect={noop}
      />,
    )
    await waitFor(() => expect(getOverlayStack()).toEqual([HISTORY_ID]))
    fireEvent.keyDown(historyInput(), { key: 'Escape' })
    expect(historyClose).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
