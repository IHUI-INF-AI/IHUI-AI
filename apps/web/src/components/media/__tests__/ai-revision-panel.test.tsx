// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AiRevisionPanel } from '../ai-revision-panel'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (!values) return key
    return `${key}:${Object.values(values).join('/')}`
  },
}))

vi.mock('@/lib/api', () => ({
  getToken: () => 'test-token',
  getBaseUrl: () => '',
}))

vi.mock('@/components/common', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))

const ORIGINAL = '第一条 甲方应在三日内付款。\n第二条 乙方应交付。'
const REVISED = '第一条 甲方应在五个工作日内付款。\n第二条 乙方应交付。'

function fileOf(name: string) {
  return new File(['合同正文'], name, { type: 'text/plain' })
}

function mockRevisionResponse(
  body: Record<string, unknown> = {
    instruction: '改付款期限',
    originalText: ORIGINAL,
    revisedText: REVISED,
    extractedChars: ORIGINAL.length,
    suspicious: null,
    model: 'test-model',
  },
): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ code: 0, data: body }), { status: 200 })),
  )
}

beforeEach(() => {
  mockRevisionResponse()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AiRevisionPanel', () => {
  it('生成修订稿后展示双栏差异与逐处接受/驳回', async () => {
    render(<AiRevisionPanel file={fileOf('合同.txt')} name="合同.txt" />)

    fireEvent.click(screen.getByText('reviseRun'))

    expect(await screen.findByText('第一条 甲方应在五个工作日内付款。')).toBeTruthy()
    expect(screen.getAllByText('第一条 甲方应在三日内付款。').length).toBeGreaterThan(0)
    expect(screen.getByText('test-model')).toBeTruthy()

    const hunk = document.querySelector('[data-hunk-id]')
    expect(hunk).toBeTruthy()
    expect(hunk?.getAttribute('data-accepted')).toBe('true')

    const reject = screen.getAllByText('reviseReject')[0]!
    fireEvent.click(reject)
    await waitFor(() => expect(hunk?.getAttribute('data-accepted')).toBe('false'))
  })

  it('对话侧带指令挂载即自动出稿,指令原样进 multipart', async () => {
    render(
      <AiRevisionPanel
        file={fileOf('合同.txt')}
        name="合同.txt"
        initialInstruction="把付款条款改成 30 天"
        autoRun
      />,
    )

    expect(await screen.findByText('第一条 甲方应在五个工作日内付款。')).toBeTruthy()
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit
    const body = init.body as FormData
    expect(body.get('instruction')).toBe('把付款条款改成 30 天')
    expect((screen.getByLabelText('reviseInstructionLabel') as HTMLTextAreaElement).value).toBe(
      '把付款条款改成 30 天',
    )
  })

  it('接受后可在此稿上继续修订:第二轮以合并稿为输入,不是重新读原文件', async () => {
    render(<AiRevisionPanel file={fileOf('合同.docx')} name="合同.docx" />)
    fireEvent.click(screen.getByText('reviseRun'))
    await screen.findByText('第一条 甲方应在五个工作日内付款。')

    fireEvent.click(screen.getByText('reviseContinue'))
    expect(screen.getByTestId('revision-base-hint')).toBeTruthy()

    fireEvent.click(screen.getByText('reviseRun'))
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2))
    const init = vi.mocked(fetch).mock.calls[1]?.[1] as RequestInit
    const body = init.body as FormData
    const sent = body.get('file') as File
    expect(sent.name).toBe('合同.txt')
    expect(await sent.text()).toContain('第一条 甲方应在五个工作日内付款。')
    expect(await sent.text()).not.toContain('合同正文')
  })

  it('全部驳回后导出禁用,避免导出与原文相同的“修订稿”', async () => {
    render(<AiRevisionPanel file={fileOf('合同.txt')} name="合同.txt" />)
    fireEvent.click(screen.getByText('reviseRun'))
    await screen.findByText('第一条 甲方应在五个工作日内付款。')

    fireEvent.click(screen.getByText('reviseRejectAll'))
    await waitFor(() => {
      const exportButton = screen.getByText('reviseExport').closest('button')
      expect(exportButton?.disabled).toBe(true)
    })
    expect(screen.getByText('reviseNothingAccepted')).toBeTruthy()
  })

  it('服务端拒绝时展示原始错误文案,不吞成通用失败', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ code: 413, message: '文档正文 13000 字符，超过 12000 字符上限' }),
            { status: 413 },
          ),
      ),
    )
    render(<AiRevisionPanel file={fileOf('合同.txt')} name="合同.txt" />)
    fireEvent.click(screen.getByText('reviseRun'))
    expect(await screen.findByText(/超过 12000 字符上限/)).toBeTruthy()
  })

  it('未生成时不请求模型,先说明修订步骤', () => {
    render(<AiRevisionPanel file={fileOf('合同.txt')} name="合同.txt" />)
    expect(screen.getByText('reviseHint')).toBeTruthy()
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
