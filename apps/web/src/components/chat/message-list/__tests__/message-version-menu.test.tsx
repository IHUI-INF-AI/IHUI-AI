// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 票59(消息级版本切换 2/3)交互面用例(2026-10-22 立)。咬三件:
//  ① 单版本不渲染控件(1/1 是假控件,点了没有语义);
//  ② 触发按钮显示的是**当前激活版本**的 n/N,不是"最新版";
//  ③ 点选回传的 id 是点的那一版(不是相邻版/不是 rootId),选完即关。
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => `[${key}]`,
  useLocale: () => 'zh-CN',
}))

import { MessageVersionMenu } from '@/components/chat/message-list/message-version-menu'
import { TooltipProvider } from '@/components/feedback'

const VERSIONS = [
  { id: 'v0', ordinal: 1, summary: '第一版正文' },
  { id: 'v1', ordinal: 2, summary: '第二版正文' },
  { id: 'v2', ordinal: 3, summary: '第三版正文' },
]

afterEach(cleanup)

describe('MessageVersionMenu(票59 2/3)', () => {
  it('单版本不渲染控件(没有可切的东西)', () => {
    const { container } = render(
      <MessageVersionMenu versions={[VERSIONS[0]!]} activeId="v0" onSelect={() => {}} />,
    )
    expect(container.querySelector('[data-testid="message-version-menu"]')).toBeNull()
  })

  it('触发按钮显示当前激活版本的 n/N', () => {
    render(
      <TooltipProvider>
        <MessageVersionMenu versions={VERSIONS} activeId="v1" onSelect={() => {}} />
      </TooltipProvider>,
    )
    expect(screen.getByTestId('message-version-menu').textContent).toContain('2/3')
  })

  it('点开列出全部版本,当前版本带 aria-current;点选回传该版 id 并关闭', () => {
    const onSelect = vi.fn()
    render(
      <TooltipProvider>
        <MessageVersionMenu versions={VERSIONS} activeId="v2" onSelect={onSelect} />
      </TooltipProvider>,
    )
    fireEvent.click(screen.getByTestId('message-version-menu'))
    expect(screen.getByTestId('message-version-item-v0').textContent).toContain('第一版正文')
    expect(screen.getByTestId('message-version-item-v2').getAttribute('aria-current')).toBe('true')
    expect(screen.getByTestId('message-version-item-v0').getAttribute('aria-current')).toBeNull()

    fireEvent.click(screen.getByTestId('message-version-item-v0'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('v0')
    expect(screen.queryByTestId('message-version-item-v0')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
