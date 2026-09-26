// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import JSZip from 'jszip'

/**
 * D41 最后一格(2026-09-26 立):Office/PDF 产物预览的「渲染视图 ↔ 源码视图」切换。
 *
 * 覆盖四条票面验收:
 *  1. 切换两态渲染**不同**内容(不是同一块换个样式)
 *  2. 切到源码视图**不触发新的取数**(fetch 调用数逐条前后对照)
 *  3. too-large / expired / unsupported 三态下降级的形态 = **禁用 + 说明**,且按钮仍在 DOM 里
 *     (隐藏等于把可发现面抹掉;留空白等于伪造可用性)
 *  4. 键盘可达(真实 `<button>`,无 tabIndex=-1,源码档在可用态 disabled=false)
 * 另加两条关系锁:officeSourceAvailability 是状态机的**纯投影**(逐态表),
 * 以及解析失败/超长各有一条可见文案(不许静默)。
 */

const WORDS: Record<string, string> = {
  officeDownload: 'W_DOWNLOAD',
  officeLazyLoad: 'W_LAZY',
  officeLoading: 'W_LOADING',
  officeTooLarge: 'W_TOO_LARGE_BODY',
  officeExpired: 'W_EXPIRED_BODY',
  officeUnsupported: 'W_UNSUPPORTED_BODY',
  csvPreviewMeta: 'W_CSV_META',
  csvLoading: 'W_CSV_LOADING',
  csvExpand: 'W_CSV_EXPAND',
  csvCollapse: 'W_CSV_COLLAPSE',
  pdfPageJump: 'W_PDF_JUMP',
  pdfPageJumpLabel: 'W_PDF_JUMPLABEL',
  pdfOpenExternal: 'W_PDF_OPEN',
  pdfPageOnly: 'W_PDF_PAGE({page})',
  previewViewGroupLabel: 'W_VIEW_GROUP',
  previewViewPreview: 'W_VIEW_PREVIEW',
  previewViewSource: 'W_VIEW_SOURCE',
  previewSourceExtracting: 'W_SOURCE_EXTRACTING',
  previewSourceExtractFailed: 'W_SOURCE_FAILED',
  previewSourceTruncated: 'W_SOURCE_TRUNCATED({chars})',
  previewSourceUnavailableLoad: 'W_SOURCE_NEED_LOAD',
  previewSourceUnavailableTooLarge: 'W_SOURCE_TOO_LARGE',
  previewSourceUnavailableExpired: 'W_SOURCE_EXPIRED',
  previewSourceUnavailableUnsupported: 'W_SOURCE_UNSUPPORTED',
  previewSourceUnavailableBinary: 'W_SOURCE_PDF_BINARY',
}

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, values?: Record<string, string | number>): string => {
      const word = WORDS[key] ?? key
      return word.replace(/\{(\w+)\}/g, (_m, n: string) => String(values?.[n] ?? ''))
    },
}))

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {} as { workerSrc: string },
  getDocument: vi.fn(() => ({ promise: Promise.resolve({ numPages: 5 }) })),
}))

import {
  OfficePreview,
  extractOfficeSourceText,
  officeSourceAvailability,
  type OfficePreviewStatus,
} from '../office-preview'
import { CsvPreview, PdfEmbed } from '../message-file-preview'

// ---------------------------------------------------------------- fixtures ----

function toArrayBuffer(x: unknown): ArrayBuffer {
  const u8 = new Uint8Array(x as ArrayBuffer)
  return u8.slice().buffer
}

/** 最小 pptx:2 slide + 1 notesSlide,部件名与正文均可辨识。 */
async function makePptx(): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file('ppt/slides/slide1.xml', '<p:sld><a:r><a:t>标题一</a:t></a:r></p:sld>')
  zip.file('ppt/slides/slide2.xml', '<p:sld><a:t>第二页</a:t></p:sld>')
  zip.file('ppt/notesSlides/notesSlide1.xml', '<p:notes><a:t>备注甲</a:t></p:notes>')
  zip.file('ppt/media/logo.png', 'PNGBINARY')
  return toArrayBuffer(await zip.generateAsync({ type: 'uint8array' }))
}

interface FetchPlan {
  readonly headSize?: number | null
  readonly headOk?: boolean
  readonly headThrow?: boolean
  readonly getOk?: boolean
  readonly body?: ArrayBuffer
  readonly text?: string
}

function stubFetch(plan: FetchPlan): ReturnType<typeof vi.fn> {
  const impl = vi.fn(async (input: string | URL, init?: { method?: string }): Promise<Response> => {
    void input
    if (init?.method === 'HEAD') {
      if (plan.headThrow) throw new Error('network down')
      const size = plan.headSize ?? null
      return {
        ok: plan.headOk ?? true,
        status: plan.headOk === false ? 404 : 200,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'content-length' && size !== null ? String(size) : null,
        },
      } as unknown as Response
    }
    return {
      ok: plan.getOk ?? true,
      status: plan.getOk === false ? 404 : 200,
      headers: { get: () => null },
      arrayBuffer: async () => plan.body ?? new ArrayBuffer(0),
      text: async () => plan.text ?? '',
    } as unknown as Response
  })
  vi.stubGlobal('fetch', impl)
  return impl
}

const MB = 1024 * 1024

function sourceBtn(): HTMLElement {
  return screen.getByTestId('preview-view-source')
}

function previewBtn(): HTMLElement {
  return screen.getByTestId('preview-view-preview')
}

function viewAttr(): string | undefined {
  return (screen.getByTestId('office-preview') as HTMLElement).dataset.previewView
}

/** 数 GET(懒加载点一次算一次),HEAD 探针不计入"取数"结论的分子。 */
function getCount(spy: ReturnType<typeof vi.fn>): number {
  return spy.mock.calls.filter((c) => (c[1] as { method?: string })?.method !== 'HEAD').length
}

// ------------------------------------------------- 状态机 ↔ 源码档(纯函数) ----

describe('officeSourceAvailability:状态机的逐态投影', () => {
  const TABLE: ReadonlyArray<readonly [OfficePreviewStatus, string]> = [
    ['ready', 'available'],
    ['too-large', 'previewSourceUnavailableTooLarge'],
    ['expired', 'previewSourceUnavailableExpired'],
    ['unsupported', 'previewSourceUnavailableUnsupported'],
    ['probing', 'previewSourceUnavailableLoad'],
    ['lazy', 'previewSourceUnavailableLoad'],
    ['loading', 'previewSourceUnavailableLoad'],
  ]

  it('七个状态各有唯一结论:ready 可用,其余五态各带自己的原因', () => {
    for (const [status, expectOut] of TABLE) {
      const got = officeSourceAvailability(status)
      if (expectOut === 'available') {
        expect(got.available, status).toBe(true)
      } else {
        expect(got.available, status).toBe(false)
        expect(
          got.available ? null : got.reason,
          `${status} 的 reason 不是 ${expectOut}(降级原因不得串门)`,
        ).toBe(expectOut)
      }
    }
  })
})

// -------------------------------------------------------------- Office 切换 ----

describe('OfficePreview preview ↔ 源码切换', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('两态渲染不同内容:预览出大纲,源码出 OOXML 部件原文', async () => {
    const body = await makePptx()
    stubFetch({ headSize: 100, body })
    render(<OfficePreview src="https://x/a.pptx" ext="pptx" />)
    await screen.findByTestId('pptx-outline')
    expect(viewAttr()).toBe('preview')
    expect(screen.queryByTestId('preview-source-text')).toBeNull()

    fireEvent.click(sourceBtn())
    await waitFor(() => expect(viewAttr()).toBe('source'))
    // 每轮重新取元素:解析中是 <p>、就绪是 <div>,持有旧引用会对着已卸载的节点断言
    await waitFor(() =>
      expect((screen.getByTestId('preview-source-text') as HTMLElement).dataset.sourceState).toBe(
        'ready',
      ),
    )
    const pane = screen.getByTestId('preview-source-text')
    expect(pane.textContent).toContain('--- ppt/slides/slide1.xml ---')
    expect(pane.textContent).toContain('<a:t>标题一</a:t>')
    // 源码档是原文,不是渲染结果:渲染视图的大纲容器不得同时在场
    expect(screen.queryByTestId('pptx-outline')).toBeNull()
  })

  it('切到源码不触发新取数:GET 调用数在切换前后一字不动', async () => {
    const body = await makePptx()
    const spy = stubFetch({ headSize: 100, body })
    render(<OfficePreview src="https://x/a.pptx" ext="pptx" />)
    await screen.findByTestId('pptx-outline')
    const before = spy.mock.calls.length
    const beforeGet = getCount(spy)

    fireEvent.click(sourceBtn())
    await waitFor(() => expect(viewAttr()).toBe('source'))
    await waitFor(() =>
      expect((screen.getByTestId('preview-source-text') as HTMLElement).dataset.sourceState).toBe(
        'ready',
      ),
    )
    // 来回切两次也一样(源码文本缓存在手里,不是每次重新拉)
    fireEvent.click(previewBtn())
    fireEvent.click(sourceBtn())
    await waitFor(() => expect(viewAttr()).toBe('source'))

    expect(spy.mock.calls.length).toBe(before)
    expect(getCount(spy)).toBe(beforeGet)
  })

  it('键盘可达:两枚都是真 button、参与 Tab 序,可用态 disabled=false', async () => {
    const body = await makePptx()
    stubFetch({ headSize: 100, body })
    render(<OfficePreview src="https://x/a.pptx" ext="pptx" />)
    await screen.findByTestId('pptx-outline')
    const group = screen.getByRole('group', { name: 'W_VIEW_GROUP' })
    expect(group.contains(previewBtn())).toBe(true)
    expect(group.contains(sourceBtn())).toBe(true)
    for (const btn of [previewBtn(), sourceBtn()]) {
      expect(btn.tagName).toBe('BUTTON')
      expect(btn.hasAttribute('disabled')).toBe(false)
      expect(btn.tabIndex).toBe(0)
    }
    expect(sourceBtn().getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(sourceBtn())
    await waitFor(() => expect(sourceBtn().getAttribute('aria-pressed')).toBe('true'))
  })

  it('过大态:源码档禁用 + 说明,按钮不消失、视图不空白', async () => {
    const spy = stubFetch({ headSize: 60 * MB })
    render(<OfficePreview src="https://x/a.xlsx" ext="xlsx" />)
    await waitFor(() =>
      expect(screen.getByTestId('office-preview').getAttribute('data-office-state')).toBe(
        'too-large',
      ),
    )
    expect(screen.getByTestId('office-too-large').textContent).toBe('W_TOO_LARGE_BODY')
    expect(sourceBtn()).toBeTruthy()
    expect(sourceBtn().hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('preview-view-source-reason').textContent).toBe('W_SOURCE_TOO_LARGE')
    fireEvent.click(sourceBtn())
    expect(viewAttr()).toBe('preview')
    expect(spy.mock.calls.length).toBe(1)
  })

  it('过期态:源码档禁用 + 原因与过大态不同形(不得共用一条说法)', async () => {
    stubFetch({ headThrow: true })
    render(<OfficePreview src="https://x/a.docx" ext="docx" />)
    await waitFor(() =>
      expect(screen.getByTestId('office-preview').getAttribute('data-office-state')).toBe(
        'expired',
      ),
    )
    expect(sourceBtn().hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('preview-view-source-reason').textContent).toBe('W_SOURCE_EXPIRED')
  })

  it('不支持态:源码档禁用 + 原因,渲染区仍是那一条 unsupported 说明', async () => {
    const spy = stubFetch({})
    render(<OfficePreview src="https://x/file.xyz" ext="xyz" />)
    await waitFor(() =>
      expect(screen.getByTestId('office-preview').getAttribute('data-office-state')).toBe(
        'unsupported',
      ),
    )
    expect(screen.getByTestId('office-unsupported').textContent).toBe('W_UNSUPPORTED_BODY')
    expect(sourceBtn().hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('preview-view-source-reason').textContent).toBe(
      'W_SOURCE_UNSUPPORTED',
    )
    expect(spy).not.toHaveBeenCalled()
  })

  it('懒加载态:未取回时源码档禁用;点加载拿到内容后源码档自动可用', async () => {
    const body = await makePptx()
    stubFetch({ headSize: 15 * MB, body })
    render(<OfficePreview src="https://x/big.pptx" ext="pptx" />)
    const lazyBtn = await screen.findByTestId('office-lazy-btn')
    expect(sourceBtn().hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('preview-view-source-reason').textContent).toBe('W_SOURCE_NEED_LOAD')

    fireEvent.click(lazyBtn)
    await waitFor(() =>
      expect(screen.getByTestId('office-preview').getAttribute('data-office-state')).toBe('ready'),
    )
    await waitFor(() => expect(sourceBtn().hasAttribute('disabled')).toBe(false))
    expect(screen.queryByTestId('preview-view-source-reason')).toBeNull()
  })

  it('解析失败有可见文案:坏 zip 落 failed,不静默空白', async () => {
    stubFetch({ headSize: 100, body: new ArrayBuffer(8) })
    render(<OfficePreview src="https://x/broken.pptx" ext="pptx" />)
    await waitFor(() =>
      expect(screen.getByTestId('office-preview').getAttribute('data-office-state')).toBe('ready'),
    )
    fireEvent.click(sourceBtn())
    await waitFor(() =>
      expect((screen.getByTestId('preview-source-text') as HTMLElement).dataset.sourceState).toBe(
        'failed',
      ),
    )
    expect(screen.getByTestId('preview-source-text').textContent).toBe('W_SOURCE_FAILED')
  })

  it('超长如实截断:上限写进说明,不做"看起来完整"的静默变短', async () => {
    const body = await makePptx()
    stubFetch({ headSize: 100, body })
    render(<OfficePreview src="https://x/a.pptx" ext="pptx" sourceMaxChars={40} />)
    await screen.findByTestId('pptx-outline')
    fireEvent.click(sourceBtn())
    await waitFor(() =>
      expect((screen.getByTestId('preview-source-text') as HTMLElement).dataset.sourceState).toBe(
        'ready',
      ),
    )
    expect(screen.getByTestId('preview-source-text').textContent).toContain(
      'W_SOURCE_TRUNCATED(40)',
    )
  })

  it('extractOfficeSourceText:只收文本部件,二进制部件不进源码视图', async () => {
    const body = await makePptx()
    const out = await extractOfficeSourceText(body, 10_000)
    expect(out.text).toContain('ppt/slides/slide2.xml')
    expect(out.text).not.toContain('ppt/media/logo.png')
    expect(out.text).not.toContain('PNGBINARY')
    expect(out.truncated).toBe(false)
  })
})

// ------------------------------------------------------------------ CSV/PDF ----

describe('CsvPreview / PdfEmbed 的同一型', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('CSV:源码档用已经在手的原文,切换前后 fetch 只发过一次', async () => {
    const raw = '名称,备注\n"甲,乙","多\n行"\n'
    const spy = stubFetch({ text: raw })
    render(<CsvPreview src="https://x/a.csv" />)
    await screen.findByTestId('csv-table')
    expect(spy).toHaveBeenCalledTimes(1)

    fireEvent.click(sourceBtn())
    const pane = screen.getByTestId('csv-source-text')
    expect(pane.dataset.sourceState).toBe('ready')
    // 原文逐字可见(含被表格语义吃掉的引号内逗号与换行)
    expect(pane.textContent).toBe(raw)
    expect(screen.queryByTestId('csv-table')).toBeNull()
    expect(spy).toHaveBeenCalledTimes(1)

    fireEvent.click(previewBtn())
    await screen.findByTestId('csv-table')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('CSV:文本还没回来时源码档禁用 + 说明,拿到后自动可用', async () => {
    stubFetch({ text: 'a,b\n1,2\n' })
    render(<CsvPreview src="https://x/a.csv" />)
    expect(sourceBtn().hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('preview-view-source-reason').textContent).toBe('W_SOURCE_NEED_LOAD')
    await screen.findByTestId('csv-table')
    await waitFor(() => expect(sourceBtn().hasAttribute('disabled')).toBe(false))
  })

  it('PDF:源码档恒定禁用 + 写明"需要重新下载"这一原因,点击不改视图、不产生取数', async () => {
    const spy = stubFetch({})
    render(<PdfEmbed src="https://x/a.pdf" />)
    await screen.findByTestId('pdf-embed')
    expect((screen.getByTestId('pdf-embed') as HTMLElement).dataset.previewView).toBe('preview')
    expect(sourceBtn().hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('preview-view-source-reason').textContent).toBe('W_SOURCE_PDF_BINARY')
    fireEvent.click(sourceBtn())
    expect(screen.queryByTestId('preview-source-text')).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
