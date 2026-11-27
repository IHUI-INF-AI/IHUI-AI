// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(),
}))

import { fetchApi } from '@/lib/api'
import { ADD_TEXT_REFERENCE_EVENT, type AnchorReferenceDetail } from '@/components/chat/annotation-anchor'
import {
  DocumentAnnotationsPanel,
  type DocumentAnnotationRecord,
} from './document-annotations-panel'

/**
 * 文档批注线程接线锁(2026-11-27):
 *  - 主批注按 parentId 分组,回复不再浮到顶层;
 *  - 发表批注必须带 documentId 走 POST,成功后本地立刻出现,不等刷新;
 *  - resolved 是线程状态,点“标记已解决”走 PATCH。
 */

const fetchMock = vi.mocked(fetchApi)

function record(overrides: Partial<DocumentAnnotationRecord> = {}): DocumentAnnotationRecord {
  return {
    id: 'a1',
    documentId: 'file:developer/demo.pdf',
    parentId: null,
    author: '系统管理员',
    body: '把这一段的日期改成今天',
    label: 'PDF 第 1 页',
    anchorKind: 'pdf',
    anchor: { kind: 'pdf', page: 1 },
    excerpt: '版本日期：2026 年 11 月 23 日',
    status: 'open',
    createdAt: '2026-11-27T04:00:00.000Z',
    updatedAt: '2026-11-27T04:00:00.000Z',
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  fetchMock.mockReset()
})

describe('DocumentAnnotationsPanel', () => {
  it('加载主批注与回复,回复挂在主线程下而不是顶层', async () => {
    fetchMock.mockResolvedValueOnce({
      success: true,
      data: [
        record(),
        record({
          id: 'a2',
          parentId: 'a1',
          body: '已改好',
          label: '',
          anchorKind: null,
          anchor: null,
          excerpt: null,
          createdAt: '2026-11-27T05:00:00.000Z',
        }),
      ],
    } as never)

    render(<DocumentAnnotationsPanel documentId="file:developer/demo.pdf" />)

    expect(await screen.findByText('把这一段的日期改成今天')).toBeTruthy()
    expect(screen.getByText('已改好')).toBeTruthy()
    expect(screen.getAllByTestId('document-annotation-thread')).toHaveLength(1)
    expect(screen.getByText('PDF 第 1 页')).toBeTruthy()
  })

  it('focusId 命中线程根时打上聚焦标记', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: [record()] } as never)

    render(<DocumentAnnotationsPanel documentId="file:developer/demo.pdf" focusId="a1" />)

    await waitFor(() =>
      expect(
        screen.getByTestId('document-annotation-thread').getAttribute('data-annotation-focused'),
      ).toBe('true'),
    )
  })

  it('发表批注 POST 带 documentId,成功后无需刷新即可看到新线程', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: [] } as never)
    fetchMock.mockResolvedValueOnce({
      success: true,
      data: record({ id: 'new', body: '新增一条批注' }),
    } as never)

    render(<DocumentAnnotationsPanel documentId="file:developer/demo.pdf" />)
    await screen.findByText('还没有批注')

    fireEvent.change(screen.getByTestId('annotation-composer'), {
      target: { value: '新增一条批注' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发表批注' }))

    expect(await screen.findByText('新增一条批注')).toBeTruthy()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const [url, init] = fetchMock.mock.calls[1] ?? []
    expect(url).toBe('/api/feature-center/documents/annotations')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toMatchObject({
      documentId: 'file:developer/demo.pdf',
      body: '新增一条批注',
    })
  })

  it('标记已解决走 PATCH,线程状态变为 resolved', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: [record()] } as never)
    fetchMock.mockResolvedValueOnce({ success: true, data: record({ status: 'resolved' }) } as never)

    render(<DocumentAnnotationsPanel documentId="file:developer/demo.pdf" />)
    const thread = await screen.findByTestId('document-annotation-thread')
    fireEvent.click(screen.getByRole('button', { name: /标记已解决/ }))

    await waitFor(() => expect(thread.getAttribute('data-annotation-status')).toBe('resolved'))
    const [url, init] = fetchMock.mock.calls[1] ?? []
    expect(url).toBe('/api/feature-center/documents/annotations/a1')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(String(init?.body))).toEqual({
      documentId: 'file:developer/demo.pdf',
      status: 'resolved',
    })
  })

  it('AI 线程可把带坐标的结论交回主 AI 对话', async () => {
    fetchMock.mockResolvedValueOnce({
      success: true,
      data: [
        record({
          author: 'AI 审阅官',
          origin: 'ai',
          label: 'PDF 第 2 页 · AI 全文',
          body: '【高】第 2 页缺少兜底\n\n正文承诺不依赖服务端,但没有兜底策略。',
          anchor: { kind: 'pdf', page: 2 },
        }),
      ],
    } as never)

    render(<DocumentAnnotationsPanel documentId="file:developer/demo.pdf" />)
    const received: AnchorReferenceDetail[] = []
    const listener = (e: Event): void => {
      received.push((e as CustomEvent<AnchorReferenceDetail>).detail)
    }
    window.addEventListener(ADD_TEXT_REFERENCE_EVENT, listener)
    fireEvent.click(await screen.findByTestId('annotation-ai-handoff'))
    window.removeEventListener(ADD_TEXT_REFERENCE_EVENT, listener)

    expect(received).toHaveLength(1)
    expect(received[0]?.source).toBe('ai-finding')
    expect(received[0]?.paneId).toBeNull()
    expect(received[0]?.anchor).toEqual({ kind: 'pdf', page: 2 })
    expect(received[0]?.page).toBe(2)
    expect(received[0]?.text).toContain('PDF 第 2 页 · AI 全文')
    expect(received[0]?.text).toContain('请基于这条 AI 预审意见')
    expect(received[0]?.autoSend).toBe(true)
    expect(received[0]?.autoSendPrompt).toContain('可执行')
  })
})
