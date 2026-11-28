// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// @vitest-environment jsdom
/**
 * 通知中心批量动作回归锁(2026-11-27):
 * ① 「全部删除」只在有 onDeleteAll 且有可见条目时出现;
 * ② 点击只回调,不在组件内部直接调 API(便于父层做乐观更新/失败回滚);
 * ③ 没传 onDeleteAll 的只读场景不出现破坏性入口。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { NotificationCenter } from '../NotificationCenter'

vi.mock('next-intl', () => ({
  useTranslations: (_ns: string) => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

afterEach(cleanup)

const ITEM = {
  id: 'ntf_1',
  title: '夜间巡检结果',
  description: '第一段完整正文。',
  type: 'success' as const,
  read: false,
  createdAt: '2026-11-27T10:00:00.000Z',
  rawType: 'automation',
}

describe('NotificationCenter delete-all', () => {
  it('有回调且有条目时出现「全部删除」,点击只回调一次', () => {
    const onDeleteAll = vi.fn()
    render(<NotificationCenter items={[ITEM]} onDeleteAll={onDeleteAll} />)
    const btn = screen.getByTestId('notification-center-delete-all')
    fireEvent.click(btn)
    expect(onDeleteAll).toHaveBeenCalledTimes(1)
  })

  it('没有回调不出现破坏性入口', () => {
    render(<NotificationCenter items={[ITEM]} />)
    expect(screen.queryByTestId('notification-center-delete-all')).toBeNull()
  })

  it('空列表不出现「全部删除」', () => {
    render(<NotificationCenter items={[]} onDeleteAll={vi.fn()} />)
    expect(screen.queryByTestId('notification-center-delete-all')).toBeNull()
  })
})
