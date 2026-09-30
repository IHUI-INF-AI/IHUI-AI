// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D199(2026-09-30 立,对标竞品 misc terminalPanel.switchToDark|switchToLight):终端面板深浅色切换装车证明。
// 判据:① 解析纯函数「显式档优先,未显式跟随应用主题」;② 工具条切换钮在位,档位标签描述
//   「点击后将切到的目标档」(亮色时=switchToDark,暗色时=switchToLight,与竞品串口径一致),
//   点击真实回调 onToggleTheme(TerminalViewport 里驱动 xterm theme,此处只证接线)。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'

import { resolveTerminalTheme } from '../terminal-panel/constants'
import { TerminalPaneToolbar } from '../terminal-panel/TerminalPaneToolbar'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function renderToolbar(terminalDark: boolean, onToggleTheme: () => void) {
  return render(
    <TerminalPaneToolbar
      isActive={false}
      aiSuggestOpen={false}
      onOpenSuggest={() => {}}
      onSplitRequest={() => {}}
      onClosePane={() => {}}
      canClosePane={false}
      terminalDark={terminalDark}
      onToggleTheme={onToggleTheme}
    />,
  )
}

describe('D199 resolveTerminalTheme(显式档优先,未显式跟随应用主题)', () => {
  it('显式档优先于应用主题;null 跟随应用主题,非 dark 一律按 light', () => {
    expect(resolveTerminalTheme('light', 'dark')).toBe('light')
    expect(resolveTerminalTheme('dark', 'light')).toBe('dark')
    expect(resolveTerminalTheme(null, 'dark')).toBe('dark')
    expect(resolveTerminalTheme(null, 'light')).toBe('light')
    expect(resolveTerminalTheme(null, undefined)).toBe('light')
  })
})

describe('D199 终端工具条深浅色切换钮', () => {
  beforeEach(() => {})
  afterEach(() => cleanup())

  it('亮色面板:钮在位,aria=switchToDark(将切到的目标档),点击回调 onToggleTheme', () => {
    const onToggle = vi.fn()
    renderToolbar(false, onToggle)
    const btn = screen.getByTestId('terminal-toggle-theme')
    expect(btn.getAttribute('aria-label')).toBe('terminalPanel.switchToDark')
    fireEvent.click(btn)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('暗色面板:aria=switchToLight,点击同样回调(档位标签随态翻转)', () => {
    const onToggle = vi.fn()
    renderToolbar(true, onToggle)
    const btn = screen.getByTestId('terminal-toggle-theme')
    expect(btn.getAttribute('aria-label')).toBe('terminalPanel.switchToLight')
    fireEvent.click(btn)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
