// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

/**
 * 站内消息详情抽屉(三端共用组件)回归锁 —— 2026-11-27。
 * 判据:全文整段渲染(含空行)、类型/时间可见、复制回调带回本条、深链按钮仅在
 * sessionId+回调都存在时出现、关闭回调只有一条出口。
 */
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { NoticeDetailSheet } from '../src/features/message-center/NoticeDetailSheet'
import type { NoticeDetailData } from '@ihui/types'

afterEach(cleanup)

const DETAIL: NoticeDetailData = {
  id: 'ntf_1',
  title: '夜间巡检结果',
  content: '第一段完整正文。\n\n第二段带空行,必须保留。',
  type: 'automation',
  level: 'success',
  createdAt: '2026-11-27T10:00:00.000Z',
  read: true,
  sessionId: 'auto_7fc2',
}

const t = (key: string) => key

describe('NoticeDetailSheet', () => {
  it('整段正文与标题都渲染,不是列表摘要', () => {
    render(createElement(NoticeDetailSheet, { t, visible: true, detail: DETAIL, onClose: vi.fn() }))
    expect(screen.getByText('夜间巡检结果')).toBeTruthy()
    expect(
      screen.getByText((_, el) => el?.children?.length === 0 && el.textContent === DETAIL.content),
    ).toBeTruthy()
    expect(screen.getByText('messageDetail.title')).toBeTruthy()
  })

  it('复制回调带回本条详情,并在组件内给出「已复制」反馈', () => {
    const onCopy = vi.fn()
    render(
      createElement(NoticeDetailSheet, {
        t,
        visible: true,
        detail: DETAIL,
        onClose: vi.fn(),
        onCopy,
      }),
    )
    fireEvent.click(screen.getByText('messageDetail.copy'))
    expect(onCopy).toHaveBeenCalledWith(DETAIL)
    expect(screen.getByText('messageDetail.copied')).toBeTruthy()
  })

  it('深链按钮只在 sessionId + 回调都在时出现', () => {
    const onOpenSession = vi.fn()
    render(
      createElement(NoticeDetailSheet, {
        t,
        visible: true,
        detail: DETAIL,
        onClose: vi.fn(),
        onOpenSession,
      }),
    )
    fireEvent.click(screen.getByText('messageDetail.viewSession'))
    expect(onOpenSession).toHaveBeenCalledWith('auto_7fc2')
  })

  it('没有 sessionId 时不制造假入口', () => {
    render(
      createElement(NoticeDetailSheet, {
        t,
        visible: true,
        detail: { ...DETAIL, sessionId: null },
        onClose: vi.fn(),
        onOpenSession: vi.fn(),
      }),
    )
    expect(screen.queryByText('messageDetail.viewSession')).toBeNull()
  })

  it('关闭按钮与遮罩都走唯一 onClose', () => {
    const onClose = vi.fn()
    render(createElement(NoticeDetailSheet, { t, visible: true, detail: DETAIL, onClose }))
    fireEvent.click(screen.getByText('common.close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('visible=false 或 detail=null 不渲染正文', () => {
    render(
      createElement(NoticeDetailSheet, { t, visible: false, detail: DETAIL, onClose: vi.fn() }),
    )
    expect(screen.queryByText('夜间巡检结果')).toBeNull()
  })
})
