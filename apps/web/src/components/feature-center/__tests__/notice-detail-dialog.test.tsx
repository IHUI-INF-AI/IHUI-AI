// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

// @vitest-environment jsdom
/**
 * 站内消息全文弹窗的装车证明(2026-11-27):
 * ① 正文必须整段渲染(换行保留),不是列表里的两行截断;
 * ② 有 sessionId 且传了回调才出现「查看会话」,点击只回调 sessionId;
 * ③ 关闭按钮回调 onClose。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { NoticeDetailDialog } from '../NoticeDetailDialog'

vi.mock('next-intl', () => ({
  useTranslations: (_ns: string) => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

afterEach(cleanup)

const LONG = ['第一段完整正文,列表里只会显示两行。', '', '第二段带空行,必须换行保留。'].join('\n')

const DETAIL = {
  id: 'ntf_1',
  title: '夜间巡检结果',
  content: LONG,
  type: 'automation',
  level: 'success' as const,
  createdAt: '2026-11-27T10:00:00.000Z',
  read: true,
  sessionId: 'auto_7fc2',
}

describe('NoticeDetailDialog', () => {
  it('整段正文 + 标题 + 时间都在弹层里;空行不被吃掉', () => {
    render(<NoticeDetailDialog detail={DETAIL} onClose={vi.fn()} onOpenSession={vi.fn()} />)
    expect(screen.getByText('title')).toBeTruthy()
    expect(screen.getByText('夜间巡检结果')).toBeTruthy()
    const body = screen.getByText(
      (_, el) => el?.classList?.contains('whitespace-pre-wrap') === true && el.textContent === LONG,
    )
    expect(body.textContent).toBe(LONG)
  })

  it('sessionId + 回调才渲染「查看会话」,点击只回调 sessionId', () => {
    const onOpenSession = vi.fn()
    render(<NoticeDetailDialog detail={DETAIL} onClose={vi.fn()} onOpenSession={onOpenSession} />)
    const btn = screen.getByText('viewSession').closest('button')
    expect(btn).toBeTruthy()
    fireEvent.click(btn!)
    expect(onOpenSession).toHaveBeenCalledWith('auto_7fc2')
  })

  it('没有 sessionId 不制造假入口', () => {
    render(
      <NoticeDetailDialog
        detail={{ ...DETAIL, sessionId: null }}
        onClose={vi.fn()}
        onOpenSession={vi.fn()}
      />,
    )
    expect(screen.queryByText('viewSession')).toBeNull()
  })

  it('关闭按钮回调 onClose', () => {
    const onClose = vi.fn()
    render(<NoticeDetailDialog detail={DETAIL} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('notice-detail-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('detail 为 null 时不渲染内容', () => {
    render(<NoticeDetailDialog detail={null} onClose={vi.fn()} />)
    expect(screen.queryByText('夜间巡检结果')).toBeNull()
  })
})
