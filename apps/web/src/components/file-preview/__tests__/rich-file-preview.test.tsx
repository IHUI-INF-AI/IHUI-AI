// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
/**
 * V3 #70 富预览渲染层用例。
 *
 * PDFViewer / OfficePreview 走模块 mock:本票的任务是"把它们接进会话流并补三型
 * 缺失的降级与诚实提示",不是重测 pdf.js 与 SheetJS。装车证明(W 组)才是这里的
 * 关键断言 —— 判据存在但没人调用 = 没有(守门 70/76/81 同型)。
 */

const HERE = path.dirname(fileURLToPath(import.meta.url))
/** apps/web 根(用于量 public/ 下的 vendored 素材是否在位)。 */
const WEB_ROOT = path.resolve(HERE, '..', '..', '..', '..')

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, values?: Record<string, string | number>): string => {
      const out = `[[${key}]]`
      return out.replace(/\{(\w+)\}/g, (_m, n: string) => String(values?.[n] ?? ''))
    },
}))

vi.mock('@/components/media/PDFViewer', () => ({
  PDFViewer: ({ url, className }: { url: string; className?: string }) =>
    React.createElement('div', {
      'data-testid': 'pdf-viewer-stub',
      'data-url': url,
      'data-class': className ?? '',
    }),
}))

vi.mock('@/components/media/office-preview', () => ({
  SUPPORTED_EXTS: new Set(['docx', 'xlsx', 'pptx']),
  OfficePreview: ({ src, ext }: { src: string; ext: string }) =>
    React.createElement('div', { 'data-testid': 'office-stub', 'data-src': src, 'data-ext': ext }),
}))

import { DelimitedFilePreview } from '../delimited-file-preview'
import { PreviewErrorCard } from '../preview-error-card'
import { RichFilePreview } from '../rich-file-preview'

// ------------------------------------------------------------- fetch 替身 ----

interface FetchShape {
  ok?: boolean
  status?: number
  contentLength?: string | null
  body?: string
  reject?: boolean
}

const fetchMock = vi.fn()

function stubFetch(shape: FetchShape) {
  fetchMock.mockImplementation(async () => {
    if (shape.reject) throw new TypeError('network down')
    return {
      ok: shape.ok ?? true,
      status: shape.status ?? 200,
      headers: {
        get: (k: string) =>
          k.toLowerCase() === 'content-length' ? (shape.contentLength ?? null) : null,
      },
      text: async () => shape.body ?? '',
    }
  })
  vi.stubGlobal('fetch', fetchMock)
}

/** 61 行(1 表头 + 60 数据行)的确定性语料。 */
const BIG_CSV = ['h1,h2', ...Array.from({ length: 60 }, (_, i) => `r${i},v`)].join('\n')

beforeEach(() => {
  fetchMock.mockReset()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ------------------------------------------------------------- W 组:装车 ----

describe('W 组:派发器装车与判型分流', () => {
  it('pdf 走真 PDFViewer(不是 iframe),并把 url 传到底', () => {
    render(<RichFilePreview href="/uploads/a.pdf" ext="pdf" />)
    expect(screen.getByTestId('pdf-viewer-stub').getAttribute('data-url')).toBe('/uploads/a.pdf')
  })

  it('csv 与 tsv 都进分隔符表格(此前 tsv 一条判据都没有)', async () => {
    stubFetch({ body: 'a\tb\n1\t2\n' })
    render(<RichFilePreview href="/d/x.tsv" ext="tsv" />)
    const box = await screen.findByTestId('delimited-file-preview')
    expect(box.getAttribute('data-preview-kind')).toBe('tsv')
  })

  it('xlsx 转交既有 OfficePreview(SUPPORTED_EXTS 是唯一支持表)', () => {
    render(<RichFilePreview href="/d/b.xlsx" ext="xlsx" />)
    expect(screen.getByTestId('office-stub').getAttribute('data-ext')).toBe('xlsx')
  })

  it('office 族里 SUPPORTED_EXTS 不收的扩展名(老 .xls)判不支持,不转交', () => {
    render(<RichFilePreview href="/d/old.xls" ext="xls" />)
    expect(screen.getByTestId('file-preview-error-card').getAttribute('data-preview-failure')).toBe(
      'unsupported',
    )
    expect(screen.queryByTestId('office-stub')).toBeNull()
  })

  it('未知扩展名给错误卡而不是空白', () => {
    render(<RichFilePreview href="/d/z.zip" ext="zip" />)
    expect(screen.getByTestId('file-preview-error-card').getAttribute('data-preview-failure')).toBe(
      'unsupported',
    )
  })

  it('反向锁:pdf-file-preview 必须 import 真 PDFViewer 且不自立第二个 worker 路径', () => {
    const src = readFileSync(path.join(HERE, '..', 'pdf-file-preview.tsx'), 'utf8')
    expect(src).toContain("from '@/components/media/PDFViewer'")
    // worker 真相源在 PDFViewer;这里出现第二个 workerSrc 就是两份真相
    expect(src).not.toContain('workerSrc')
  })

  it('反向锁:会话流渲染位必须真的引用派发器(改了判据没接线 = 一路绿灯)', () => {
    const wired = readFileSync(
      path.join(HERE, '..', '..', 'ai', 'markdown-stream.tsx'),
      'utf8',
    )
    expect(wired).toContain("from '@/components/file-preview'")
    expect(wired).toContain('<RichFilePreview')
    // 旧的三行分支不得复活成第二套并行实现
    expect(wired).not.toContain('<PdfEmbed')
    expect(wired).not.toContain('<CsvPreview')
  })

  it('反向锁:逗号口径不得在判型模块里复制第二份 parseCsv', () => {
    const lib = readFileSync(
      path.join(HERE, '..', '..', '..', 'lib', 'file-preview-attachment.ts'),
      'utf8',
    )
    expect(lib).toContain("from './csv-preview'")
    expect(lib).toContain("if (delimiter === ',') return parseCsv(text)")
  })

  it('worker 素材在位且以同源绝对路径引用(CSP script-src/default-src 已放行)', () => {
    const viewer = readFileSync(
      path.join(HERE, '..', '..', '..', 'components', 'media', 'PDFViewer.tsx'),
      'utf8',
    )
    expect(viewer).toContain("workerSrc = '/pdfjs/pdf.worker.min.mjs'")
    // 文件必须真在 public/ 下 —— 路径写对但素材缺失表现为"预览能开、文字层永久转圈"
    expect(existsSync(path.join(WEB_ROOT, 'public', 'pdfjs', 'pdf.worker.min.mjs'))).toBe(true)
  })

  it('vendored worker 不得被我方水印横幅主张归属(守门 107 P8 的本地预检)', () => {
    const head = readFileSync(path.join(WEB_ROOT, 'public', 'pdfjs', 'pdf.worker.min.mjs'), 'utf8')
      .slice(0, 4000)
      .toLowerCase()
    expect(head).not.toContain('provenance-watermarked')
    expect(head).not.toContain('ihui ai')
  })
})

// ------------------------------------------------------ 分隔符表格三要件 ----

describe('分隔符表格:表头固定 / 列宽自适应 / 行数诚实', () => {
  it('表头带 sticky top-0,且描边不取墨档', async () => {
    stubFetch({ body: 'name,qty\na,1\n' })
    render(<DelimitedFilePreview src="/d/a.csv" format="csv" delimiter="," />)
    const ths = await screen.findAllByTestId('delimited-header-cell')
    const thead = ths[0]?.parentElement?.parentElement
    expect(thead?.tagName).toBe('THEAD')
    expect(thead?.className).toContain('sticky')
    expect(thead?.className).toContain('top-0')
    // 粘住时不得透出正文:不透明 bg-muted,不是半透明 bg-muted/xx
    expect(ths[0]?.className).toContain('bg-muted')
    expect(ths[0]?.className).not.toContain('bg-muted/')
  })

  it('列宽由内容算出并写成 ch(不是硬编码 px)', async () => {
    stubFetch({ body: 'short,a-very-long-header-value-here\n1,2\n' })
    render(<DelimitedFilePreview src="/d/a.csv" format="csv" delimiter="," />)
    const cells = await screen.findAllByTestId('delimited-header-cell')
    const widths = cells.map((c) => (c as HTMLElement).style.width)
    expect(widths.every((w) => /^\d+ch$/.test(w))).toBe(true)
    expect(Number(widths[1]?.replace('ch', ''))).toBeGreaterThan(Number(widths[0]?.replace('ch', '')))
  })

  it('超出上限:共 N 行与仅预览前 M 行同时可见,DOM 真的只有 M 行', async () => {
    stubFetch({ body: BIG_CSV })
    render(<DelimitedFilePreview src="/d/a.csv" format="csv" delimiter="," maxRows={50} />)
    const box = await screen.findByTestId('delimited-file-preview')
    // 61 行原文 = 1 表头 + 60 数据行;total/shown 都按**数据行**计(表头不算被预览的数据)
    expect(box.getAttribute('data-delimited-total')).toBe('60')
    expect(box.getAttribute('data-delimited-shown')).toBe('50')
    expect(box.getAttribute('data-delimited-truncated')).toBe('true')
    expect(screen.getByText(/\[\[csvPreviewMeta\]\] · \[\[officeRowsTruncated\]\]/)).toBeTruthy()
    // 可见数据行 50 行 × 2 列(不含表头)
    expect(screen.getAllByTestId('delimited-cell').length).toBe(100)
  })

  it('展开后显示全部行,truncated 翻 false,总数不变', async () => {
    stubFetch({ body: BIG_CSV })
    render(<DelimitedFilePreview src="/d/a.csv" format="csv" delimiter="," maxRows={50} />)
    const toggle = await screen.findByTestId('delimited-expand-toggle')
    fireEvent.click(toggle)
    await waitFor(() => {
      const box = screen.getByTestId('delimited-file-preview')
      expect(box.getAttribute('data-delimited-truncated')).toBe('false')
      expect(box.getAttribute('data-delimited-shown')).toBe('60')
      expect(box.getAttribute('data-delimited-total')).toBe('60')
    })
    expect(screen.queryByTestId('delimited-expand-toggle')).toBeNull()
    expect(screen.getAllByTestId('delimited-cell').length).toBe(120)
  })

  it('未超上限时不得出现截断提示(绝不多报一个不存在的截断)', async () => {
    stubFetch({ body: 'a,b\n1,2\n' })
    render(<DelimitedFilePreview src="/d/a.csv" format="csv" delimiter="," maxRows={50} />)
    const box = await screen.findByTestId('delimited-file-preview')
    expect(box.getAttribute('data-delimited-truncated')).toBe('false')
    expect(screen.queryByText(/\[\[officeRowsTruncated\]\]/)).toBeNull()
  })

  it('切源码档不再发第二次 fetch(原文已在手)', async () => {
    stubFetch({ body: 'a,b\n1,2\n' })
    render(<DelimitedFilePreview src="/d/a.csv" format="csv" delimiter="," />)
    await screen.findByTestId('delimited-table')
    const before = fetchMock.mock.calls.length
    fireEvent.click(screen.getByTestId('preview-view-source'))
    await screen.findByTestId('delimited-source-text')
    expect(fetchMock.mock.calls.length).toBe(before)
  })
})

// ------------------------------------------------------------------ 失败态 ----

const NUL = String.fromCharCode(0)

describe('失败态:每型各一条文案 + 始终保留下载出口,不得白屏', () => {
  it('HTTP 非 2xx 判 failed,并把实测状态码带进卡面', async () => {
    stubFetch({ ok: false, status: 404 })
    render(<DelimitedFilePreview src="/d/a.csv" format="csv" delimiter="," />)
    const card = await screen.findByTestId('file-preview-error-card')
    expect(card.getAttribute('data-preview-failure')).toBe('failed')
    expect(card.textContent).toContain('404')
    expect(screen.getByTestId('file-preview-error-download')).toBeTruthy()
  })

  it('Content-Length 超上限判 tooLarge,并且不去拉正文', async () => {
    const text = vi.fn(async () => 'MUST_NOT_BE_READ')
    fetchMock.mockImplementation(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => String(64 * 1024 * 1024) },
      text,
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<DelimitedFilePreview src="/d/big.csv" format="csv" delimiter="," />)
    const card = await screen.findByTestId('file-preview-error-card')
    expect(card.getAttribute('data-preview-failure')).toBe('tooLarge')
    expect(text).not.toHaveBeenCalled()
  })

  it('扩展名写 csv 而正文含空字节判 typeMismatch(与"损坏"分两态)', async () => {
    stubFetch({ body: `a,b\n1${NUL}2\n` })
    render(<DelimitedFilePreview src="/d/fake.csv" format="csv" delimiter="," />)
    const card = await screen.findByTestId('file-preview-error-card')
    expect(card.getAttribute('data-preview-failure')).toBe('typeMismatch')
    expect(card.textContent).toContain('[[filePreviewTypeMismatch]]')
    expect(card.textContent).toContain('csv')
  })

  it('全空白正文判 empty,单独一态(不得混进"损坏")', async () => {
    stubFetch({ body: '  \n\t\n' })
    render(<DelimitedFilePreview src="/d/e.csv" format="csv" delimiter="," />)
    const card = await screen.findByTestId('file-preview-error-card')
    expect(card.getAttribute('data-preview-failure')).toBe('empty')
    expect(card.textContent).toContain('[[filePreviewEmpty]]')
  })

  it('解析后零数据行也判 empty(有表头分隔符但全是空字段)', async () => {
    stubFetch({ body: ',,\n,,\n' })
    render(<DelimitedFilePreview src="/d/z.csv" format="csv" delimiter="," />)
    expect((await screen.findByTestId('file-preview-error-card')).getAttribute('data-preview-failure')).toBe(
      'empty',
    )
  })

  it('fetch 抛异常判 failed 而不是白屏或挂起', async () => {
    stubFetch({ reject: true })
    render(<DelimitedFilePreview src="/d/a.csv" format="csv" delimiter="," />)
    const card = await screen.findByTestId('file-preview-error-card')
    expect(card.getAttribute('data-preview-failure')).toBe('failed')
  })

  it('加载中是可见文案,不是空白档', () => {
    stubFetch({ body: 'a,b\n1,2\n' })
    render(<DelimitedFilePreview src="/d/a.csv" format="csv" delimiter="," />)
    expect(screen.getByText('[[csvLoading]]')).toBeTruthy()
  })
})

// --------------------------------------------------------------- 错误卡本体 ----

describe('PreviewErrorCard:六态各一条文案,永不缺出口', () => {
  const cases: readonly ('tooLarge' | 'typeMismatch' | 'corrupt' | 'empty' | 'unsupported' | 'failed')[] = [
    'tooLarge',
    'typeMismatch',
    'corrupt',
    'empty',
    'unsupported',
    'failed',
  ]

  it.each(cases)('%s:有 role=status 的卡、图标、下载出口', (failure) => {
    render(<PreviewErrorCard failure={failure} ext="csv" href="/d/a.csv?sig=1" />)
    const card = screen.getByTestId('file-preview-error-card')
    expect(card.getAttribute('data-preview-failure')).toBe(failure)
    expect(card.getAttribute('role')).toBe('status')
    expect(card.querySelector('svg')).toBeTruthy()
    expect(screen.getByTestId('file-preview-error-download')).toBeTruthy()
    // 文件名剥掉 query,卡面显示的是可读名
    expect(card.textContent).toContain('a.csv')
  })

  it('failed 带 detail 时把细节拼上,不带时不得出现空括号', () => {
    const a = render(<PreviewErrorCard failure="failed" href="/d/a.csv" detail="500" />)
    expect(screen.getByTestId('file-preview-error-card').textContent).toContain('(500)')
    a.unmount()
    render(<PreviewErrorCard failure="failed" href="/d/a.csv" />)
    expect(screen.getByTestId('file-preview-error-card').textContent).not.toContain('()')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
