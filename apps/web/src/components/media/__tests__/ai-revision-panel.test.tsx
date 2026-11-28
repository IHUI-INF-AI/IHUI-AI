// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AiRevisionPanel } from '../ai-revision-panel'

const { fetchApiMock } = vi.hoisted(() => ({ fetchApiMock: vi.fn() }))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (!values) return key
    return `${key}:${Object.values(values).join('/')}`
  },
}))

vi.mock('@/lib/api', () => ({
  getToken: () => 'test-token',
  getBaseUrl: () => '',
  fetchApi: fetchApiMock,
}))

vi.mock('@/components/common', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}))

const ORIGINAL = '第一条 甲方应在三日内付款。\n第二条 乙方应交付。'
const REVISED = '第一条 甲方应在五个工作日内付款。\n第二条 乙方应交付。'

function fileOf(name: string) {
  return new File(['合同正文'], name, { type: 'text/plain' })
}

/** 行内高亮会把整行拆成 前缀+span+后缀 多个文本节点,按整段文本断言要看 textContent。 */
async function expectBodyContains(text: string): Promise<void> {
  await waitFor(() => expect(document.body.textContent ?? '').toContain(text))
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
  fetchApiMock.mockReset()
  fetchApiMock.mockResolvedValue({
    success: true,
    data: { file: { id: 'file-1', name: '合同-修订稿.txt' } },
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('AiRevisionPanel', () => {
  it('生成修订稿后展示双栏差异与逐处接受/驳回', async () => {
    render(<AiRevisionPanel file={fileOf('合同.txt')} name="合同.txt" />)

    fireEvent.click(screen.getByText('reviseRun'))

    await expectBodyContains('第一条 甲方应在五个工作日内付款。')
    expect(document.body.textContent ?? '').toContain('第一条 甲方应在三日内付款。')
    expect(screen.getByText('test-model')).toBeTruthy()

    const hunk = document.querySelector('[data-hunk-id]')
    expect(hunk).toBeTruthy()
    expect(hunk?.getAttribute('data-accepted')).toBe('true')

    // 行内高亮只罩住真正改动的片段,而不是整行
    expect(document.querySelector('[data-inline-change="old"]')?.textContent).toBe('三')
    expect(document.querySelector('[data-inline-change="new"]')?.textContent).toBe('五个工作')

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

    await expectBodyContains('第一条 甲方应在五个工作日内付款。')
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
    await expectBodyContains('第一条 甲方应在五个工作日内付款。')

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

  it('窄屏默认单栏视图,不让双栏 42rem 在手机上横向溢出', async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 420 })
    try {
      render(<AiRevisionPanel file={fileOf('合同.txt')} name="合同.txt" />)
      fireEvent.click(screen.getByText('reviseRun'))
      await expectBodyContains('第一条 甲方应在五个工作日内付款。')
      expect(
        screen.getByText('reviseViewUnified').closest('button')?.getAttribute('aria-pressed'),
      ).toBe('true')
      expect(
        screen.getByText('reviseViewSplit').closest('button')?.getAttribute('aria-pressed'),
      ).toBe('false')
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
    }
  })

  it('项目文件可一键保存回文档中心:按项目上传修订稿,不改动原文件', async () => {
    render(<AiRevisionPanel file={fileOf('合同.txt')} name="合同.txt" projectId="p-1" />)
    fireEvent.click(screen.getByText('reviseRun'))
    await expectBodyContains('第一条 甲方应在五个工作日内付款。')

    const onFilesChanged = vi.fn()
    window.addEventListener('ihui:project-files-changed', onFilesChanged)
    fireEvent.click(screen.getByText('reviseSaveToDocs'))
    await waitFor(() => expect(fetchApiMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchApiMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/workspace/projects/p-1/files')
    const sent = (init.body as FormData).get('file') as File
    expect(sent.name).toBe('合同-修订稿.txt')
    expect(await sent.text()).toContain('第一条 甲方应在五个工作日内付款。')
    expect(sent.name).not.toBe('合同.txt')
    await waitFor(() => expect(onFilesChanged).toHaveBeenCalledTimes(1))
    window.removeEventListener('ihui:project-files-changed', onFilesChanged)
  })

  it('项目文件保存为版本:changeLog 在 file 之前,走文件版本接口', async () => {
    fetchApiMock.mockResolvedValueOnce({
      success: true,
      data: { version: { version: 3 }, file: { id: 'f-1' } },
    })
    render(
      <AiRevisionPanel file={fileOf('合同.txt')} name="合同.txt" projectId="p-1" fileId="f-1" />,
    )
    fireEvent.click(screen.getByText('reviseRun'))
    await expectBodyContains('第一条 甲方应在五个工作日内付款。')

    fireEvent.click(screen.getByText('reviseSaveToDocs'))
    await waitFor(() => expect(fetchApiMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchApiMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/workspace/files/f-1/versions')
    const form = init.body as FormData
    // @fastify/multipart 读到 file 即停止解析字段:changeLog 必须在前面
    expect(Array.from(form.keys())).toEqual(['changeLog', 'file'])
    expect(String(form.get('changeLog'))).toContain('reviseVersionChangeLog')
    const sent = form.get('file') as File
    expect(sent.name).toBe('合同-修订稿.txt')
  })

  it('对话附件无项目归属:先选项目再保存,上传到所选项目', async () => {
    fetchApiMock.mockImplementation(async (url: string) =>
      url === '/api/workspace/projects'
        ? { success: true, data: { projects: [{ id: 'p-9', name: '项目九' }] } }
        : { success: true, data: { file: { id: 'f-9', name: '合同-修订稿.txt' } } },
    )
    render(<AiRevisionPanel file={fileOf('合同.txt')} name="合同.txt" />)
    fireEvent.click(screen.getByText('reviseRun'))
    await expectBodyContains('第一条 甲方应在五个工作日内付款。')

    fireEvent.click(screen.getByText('reviseSaveToDocs'))
    await waitFor(() => expect(screen.getByTestId('revision-project-picker')).toBeTruthy())
    const select = screen.getByLabelText('revisePickProject') as HTMLSelectElement
    expect(select.value).toBe('p-9')

    fireEvent.click(screen.getByText('reviseSaveConfirm'))
    await waitFor(() => expect(fetchApiMock).toHaveBeenCalledTimes(2))
    expect((fetchApiMock.mock.calls[1] as [string])[0]).toBe('/api/workspace/projects/p-9/files')
    await waitFor(() => expect(screen.queryByTestId('revision-project-picker')).toBeNull())
  })

  it('长文逐处导航:上一处/下一处切换定位并高亮当前 hunk', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 0,
              data: {
                instruction: '改两处',
                originalText:
                  '第一条 甲方应在三日内付款。\n第二条 乙方应交付。\n第三条 保密三年。\n第四条 其他。',
                revisedText:
                  '第一条 甲方应在五日内付款。\n第二条 乙方应交付。\n第三条 保密五年。\n第四条 其他。',
                extractedChars: 48,
                suspicious: null,
                model: 'test-model',
              },
            }),
            { status: 200 },
          ),
      ),
    )
    render(<AiRevisionPanel file={fileOf('合同.txt')} name="合同.txt" />)
    fireEvent.click(screen.getByText('reviseRun'))
    await waitFor(() =>
      expect(screen.getByTestId('revision-hunk-position').textContent).toBe(
        'reviseHunkPosition:1/2',
      ),
    )
    const hunks = document.querySelectorAll('[data-hunk-id]')
    expect(hunks.length).toBe(2)
    expect(hunks[0]?.getAttribute('data-active')).toBe('true')

    fireEvent.click(screen.getByLabelText('reviseNextHunk'))
    await waitFor(() =>
      expect(screen.getByTestId('revision-hunk-position').textContent).toBe(
        'reviseHunkPosition:2/2',
      ),
    )
    expect(document.querySelectorAll('[data-hunk-id]')[1]?.getAttribute('data-active')).toBe('true')
    expect(screen.getByLabelText('reviseNextHunk').hasAttribute('disabled')).toBe(true)
  })

  it('全部驳回后导出禁用,避免导出与原文相同的“修订稿”', async () => {
    render(<AiRevisionPanel file={fileOf('合同.txt')} name="合同.txt" />)
    fireEvent.click(screen.getByText('reviseRun'))
    await expectBodyContains('第一条 甲方应在五个工作日内付款。')

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
