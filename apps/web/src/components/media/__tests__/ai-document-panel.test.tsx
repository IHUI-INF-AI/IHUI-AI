// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchApi } from '@/lib/api'
import { AiDocumentPanel } from '../ai-document-panel'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { chars?: number }) =>
    values?.chars ? `${key}:${values.chars}` : key,
}))

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(),
  getToken: () => 'test-token',
  getBaseUrl: () => '',
}))

vi.mock('@/components/docs/markdown-body', () => ({
  MarkdownBody: ({ content }: { content: string }) => (
    <div data-testid="markdown-body">{content}</div>
  ),
}))

const fetchApiMock = vi.mocked(fetchApi)

beforeEach(() => {
  vi.stubGlobal('fetch', undefined)
  fetchApiMock.mockResolvedValue({
    success: true,
    data: {
      answer: '**总结**：季度营收增长。',
      mode: 'summary',
      model: 'test-model',
      usage: null,
      extractedChars: 42,
      truncated: false,
    },
  })
})

afterEach(() => {
  cleanup()
  fetchApiMock.mockReset()
  vi.unstubAllGlobals()
})

function fileOf(name: string) {
  return new File(['季度营收 1200 万元'], name, { type: 'text/plain' })
}

describe('AiDocumentPanel', () => {
  it('点击生成摘要后展示 AI 结果与字符来源', async () => {
    render(<AiDocumentPanel file={fileOf('报告.txt')} name="报告.txt" autoRun={false} />)

    fireEvent.click(screen.getByText('aiStart'))
    expect((await screen.findByTestId('markdown-body')).textContent).toContain('季度营收增长')
    expect(screen.getByText('aiSource:42')).toBeTruthy()
    expect(screen.getByText('test-model')).toBeTruthy()
    const [url] = fetchApiMock.mock.calls[0] ?? []
    expect(String(url)).toContain('/api/office/analyze?mode=summary')
  })

  it('优先走流式接口,chunk 到达即渲染', async () => {
    const sse = [
      'data: {"type":"meta","extractedChars":24,"truncated":false}\n\n',
      'data: {"type":"chunk","content":"**流式摘要**"}\n\n',
      'data: {"type":"chunk","content":"：季度营收 1200 万元"}\n\n',
      'data: {"type":"done","model":"stream-model","usage":{"total_tokens":12}}\n\n',
    ].join('')
    const fetchMock = vi.fn(
      async () =>
        new Response(sse, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<AiDocumentPanel file={fileOf('报告.txt')} name="报告.txt" autoRun={false} />)
    fireEvent.click(screen.getByText('aiStart'))

    await waitFor(() =>
      expect(screen.getByTestId('markdown-body').textContent).toContain('流式摘要'),
    )
    expect(screen.getByText('aiSource:24')).toBeTruthy()
    expect(screen.getByText('stream-model')).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const streamCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit] | undefined
    expect(String(streamCall?.[0])).toContain('/api/office/analyze/stream')
    expect(fetchApiMock).not.toHaveBeenCalled()
  })

  it('问答模式把问题编码到请求地址', async () => {
    render(<AiDocumentPanel file={fileOf('报告.txt')} name="报告.txt" autoRun={false} />)

    fireEvent.change(screen.getByPlaceholderText('aiQuestionPlaceholder'), {
      target: { value: '续约率是多少？' },
    })
    fireEvent.click(screen.getByLabelText('aiSend'))

    await waitFor(() => expect(fetchApiMock).toHaveBeenCalledTimes(1))
    const [url] = fetchApiMock.mock.calls[0] ?? []
    expect(String(url)).toContain('mode=qa')
    expect(String(url)).toContain(encodeURIComponent('续约率是多少？'))
  })

  it('接口失败时展示错误与重试入口', async () => {
    fetchApiMock.mockResolvedValueOnce({ success: false, error: '模型暂不可用' })
    render(<AiDocumentPanel file={fileOf('报告.txt')} name="报告.txt" autoRun={false} />)

    fireEvent.click(screen.getByText('aiStart'))
    expect(await screen.findByText('模型暂不可用')).toBeTruthy()
    expect(screen.getByText('retry')).toBeTruthy()
  })

  it('不支持的文件类型直接给说明,不发起请求', () => {
    render(<AiDocumentPanel file={new File(['img'], 'photo.png')} name="photo.png" />)
    expect(screen.getByText('aiUnsupported')).toBeTruthy()
    expect(fetchApiMock).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
