// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
//
// 消息常驻轻评分(reaction 档)接线契约(2026-10-28 立):
//  ① like 点击 ⇒ POST 现成 D49① 端点,body 精确 {messageId,rating:'like'};成功静默(按压态即反馈);
//  ② dislike 点击 ⇒ 同一端点 + chat.toast.dislikeThanks 轻提示;
//  ③ 网络失败 ⇒ chat.toast.feedbackFailed 错误 toast,按压态不变(不演成功);
//  ④ 同值重点 = 撤销(DELETE 出口,三态闭环);改判 like→dislike 允许(upsert 覆盖);
//  ⑤ 'ihui:feedback-rating-sync' 事件 ⇒ 同 messageId 回显合流,异 id 不动;
//  ⑥ disabled ⇒ 按钮不可点且点击零请求(流式消息禁评分)。
// 本件钉的是"直连现成端点"的接线面;survey 卡与 MessageItem 挂载由内核自有测试族守。
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const postSpy = vi.hoisted(() => vi.fn())
const successToastSpy = vi.hoisted(() => vi.fn())
const errorToastSpy = vi.hoisted(() => vi.fn())

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}))
vi.mock('@/lib/api', () => ({
  fetchApi: (url: string, init: { method: string; body: string }) => postSpy(url, init),
}))
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ success: successToastSpy, error: errorToastSpy }),
}))
// 样式基类出处件带重依赖,测试只消费字符串常量
vi.mock('@/components/chat/message-list/message-item-parts', () => ({
  ACTION_BTN_CLASS: 'action-btn-base',
}))

import { MessageFeedbackActions } from '@/components/chat/message-list/message-feedback-actions'

beforeEach(() => {
  postSpy.mockReset()
  successToastSpy.mockClear()
  errorToastSpy.mockClear()
})
afterEach(cleanup)

function ok(rating: 'like' | 'dislike') {
  return Promise.resolve({ success: true, data: { rated: true, rating } })
}

describe('message-feedback-actions 契约', () => {
  it('① like:直连 D49① 端点,body 精确;成功静默无 toast', async () => {
    postSpy.mockImplementation(ok)
    render(<MessageFeedbackActions messageId="m-1" />)
    fireEvent.click(screen.getByTestId('message-feedback-like-m-1'))
    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1))
    const [url, init] = postSpy.mock.calls[0]
    expect(url).toBe('/api/chat/messages/feedback')
    expect(JSON.parse(init.body)).toEqual({ messageId: 'm-1', rating: 'like' })
    expect(successToastSpy).not.toHaveBeenCalled()
    expect(screen.getByTestId('message-feedback-like-m-1').getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('② dislike:同端点改票 + dislikeThanks 轻提示', async () => {
    postSpy.mockImplementation(ok)
    render(<MessageFeedbackActions messageId="m-2" />)
    fireEvent.click(screen.getByTestId('message-feedback-dislike-m-2'))
    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1))
    expect(JSON.parse(postSpy.mock.calls[0][1].body)).toEqual({
      messageId: 'm-2',
      rating: 'dislike',
    })
    expect(successToastSpy).toHaveBeenCalledWith('chat.toast.dislikeThanks')
  })

  it('③ 失败:error toast 且按压态不变', async () => {
    postSpy.mockResolvedValue({ success: false, error: 'boom' })
    render(<MessageFeedbackActions messageId="m-3" />)
    fireEvent.click(screen.getByTestId('message-feedback-like-m-3'))
    await waitFor(() => expect(errorToastSpy).toHaveBeenCalledWith('chat.toast.feedbackFailed'))
    expect(screen.getByTestId('message-feedback-like-m-3').getAttribute('aria-pressed')).toBe(
      'false',
    )
  })

  it('④ 同值重点 = 撤销(DELETE 出口);改判放行(upsert 覆盖)', async () => {
    postSpy.mockImplementation(ok)
    render(<MessageFeedbackActions messageId="m-4" />)
    const like = screen.getByTestId('message-feedback-like-m-4')
    fireEvent.click(like)
    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1))
    // 首次 like:POST 现成端点
    expect(postSpy.mock.calls[0][0]).toBe('/api/chat/messages/feedback')
    expect(JSON.parse(postSpy.mock.calls[0][1].body)).toEqual({ messageId: 'm-4', rating: 'like' })
    // 再点已选中的 like = 撤销(三态闭环:DELETE 出口)
    fireEvent.click(like)
    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(2))
    expect(postSpy.mock.calls[1][0]).toBe('/api/chat/messages/m-4/feedback')
    expect(postSpy.mock.calls[1][1].method).toBe('DELETE')
    // 改判 dislike:再次 POST,覆盖票
    fireEvent.click(screen.getByTestId('message-feedback-dislike-m-4'))
    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(3))
    expect(JSON.parse(postSpy.mock.calls[2][1].body).rating).toBe('dislike')
  })

  it('⑤ survey 同步:同 id 回显合流,异 id 不动', async () => {
    postSpy.mockImplementation(ok)
    render(<MessageFeedbackActions messageId="m-5" />)
    // 异 id:不匹配 ⇒ 按压态不动
    window.dispatchEvent(
      new CustomEvent('ihui:feedback-rating-sync', {
        detail: { messageId: 'other', rating: 'dislike' },
      }),
    )
    expect(screen.getByTestId('message-feedback-dislike-m-5').getAttribute('aria-pressed')).toBe(
      'false',
    )
    // 同 id:回显合流。事件监听回调里的 setRating 走 React 异步刷新,需等一拍
    window.dispatchEvent(
      new CustomEvent('ihui:feedback-rating-sync', {
        detail: { messageId: 'm-5', rating: 'dislike' },
      }),
    )
    await waitFor(() =>
      expect(screen.getByTestId('message-feedback-dislike-m-5').getAttribute('aria-pressed')).toBe(
        'true',
      ),
    )
  })

  it('⑥ disabled(流式中):按钮禁用且点击零请求', () => {
    postSpy.mockImplementation(ok)
    render(<MessageFeedbackActions messageId="m-6" disabled />)
    const like = screen.getByTestId('message-feedback-like-m-6')
    expect((like as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(like)
    expect(postSpy).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
