// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * D41 Office/PDF 产物预览测试(2026-09-24 立)。
 *  - 四态各 1 用例:可用(docx 渲染即覆盖)/过大/过期/不支持
 *  - 每类渲染 1 用例:docx 文本 / xlsx sheet 切换+选区 / pptx 大纲含备注 / pdf 页码跳转
 *  - 词表键五语言直锁 1 条(参照 mobile-rn steer-frames 的 disclosureOf 模式)
 * Office 二进制 fixture 用最小构造:xlsx 用 SheetJS 现场生成,pptx 用 jszip 现场打包,
 * docx 与 pdfjs 走模块 mock(不强求真文件)。
 */

// ---- 取词面:合成词直出,断言"有键取键"且插值到位 ----
const WORDS: Record<string, string> = {
  officeTooLarge: 'WORD_TOO_LARGE',
  officeExpired: 'WORD_EXPIRED',
  officeUnsupported: 'WORD_UNSUPPORTED',
  officeLazyLoad: 'WORD_LAZY',
  officeLoading: 'WORD_LOADING',
  officeFailed: 'WORD_FAILED',
  officeDownload: 'WORD_DOWNLOAD',
  officeSelectedCell: 'WORD_SELECTED({cell})',
  officeRowsTruncated: 'WORD_TRUNC({rows})',
  pdfPageIndicator: 'WORD_PAGE({page})/({total})',
  pdfPageOnly: 'WORD_PAGEONLY({page})',
  pdfPageJump: 'WORD_JUMP',
  pdfPageJumpLabel: 'WORD_JUMPLABEL',
  pptxNotes: 'WORD_NOTES',
}

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, values?: Record<string, string | number>): string => {
      const word = WORDS[key] ?? key
      return word.replace(/\{(\w+)\}/g, (_m, n: string) => String(values?.[n] ?? ''))
    },
}))

vi.mock('docx-preview', () => ({
  renderAsync: vi.fn(async (_data: unknown, container: HTMLElement) => {
    const p = document.createElement('p')
    p.setAttribute('data-testid', 'docx-rendered')
    p.textContent = 'DOCX_RENDERED_TEXT'
    container.appendChild(p)
  }),
}))

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {} as { workerSrc: string },
  getDocument: vi.fn(() => ({ promise: Promise.resolve({ numPages: 5 }) })),
}))

import {
  OfficePreview,
  buildDocxReviewBlocks,
  buildXlsxReviewBlocks,
  buildXlsxWorkbookReviewBlocks,
  xlsxCellCss,
  xlsxColumnRef,
  xlsxRangeStart,
} from '../office-preview'
import { PdfEmbed } from '../message-file-preview'

// ------------------------------------------------------------- fixtures ----

function toArrayBuffer(x: unknown): ArrayBuffer {
  const u8 = new Uint8Array(x as ArrayBuffer)
  return u8.slice().buffer
}

/** 用 SheetJS 现场生成最小 xlsx:两个 sheet,内容可辨识。 */
function makeXlsx(): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ['A1', 'A2'],
    ['A3', 'A4'],
  ])
  ws['!cols'] = [{ wch: 20 }, { wch: 8 }]
  XLSX.utils.book_append_sheet(wb, ws, '表A')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['B1']]), '表B')
  return toArrayBuffer(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))
}

/** 合并表头:首行 A:B 跨两列,用来锁 colSpan 与覆盖格去重。 */
function makeMergedXlsx(): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([
    ['合并表头', ''],
    ['左', '右'],
  ])
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]
  XLSX.utils.book_append_sheet(wb, ws, '合并表')
  return toArrayBuffer(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))
}

/** 带公式的单元格:值用于表格展示,公式用于选中后的公式栏。 */
function makeFormulaXlsx(): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([['值'], [2]])
  ws['A2'] = { t: 'n', f: 'SUM(1,1)', v: 2 }
  XLSX.utils.book_append_sheet(wb, ws, '公式表')
  return toArrayBuffer(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))
}

/** 用 jszip 现场打包最小 pptx:2 slide + 1 notesSlide。 */
async function makePptx(): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file('ppt/slides/slide1.xml', '<p:sld><a:p><a:r><a:t>标题一</a:t></a:r></a:p></p:sld>')
  zip.file('ppt/slides/slide2.xml', '<p:sld><a:t>第二页</a:t></p:sld>')
  zip.file('ppt/notesSlides/notesSlide1.xml', '<p:notes><a:t>备注甲</a:t></p:notes>')
  const u8 = await zip.generateAsync({ type: 'uint8array' })
  return u8.slice().buffer
}

// ---------------------------------------------------------- fetch stubs ----

interface FetchPlan {
  readonly head?: {
    readonly ok?: boolean
    readonly reject?: boolean
    readonly size?: number | null
  }
  readonly get?: { readonly ok?: boolean; readonly body?: ArrayBuffer }
}

function stubFetch(plan: FetchPlan): ReturnType<typeof vi.fn> {
  const impl = vi.fn(async (input: string | URL, init?: { method?: string }): Promise<Response> => {
    void input
    if (init?.method === 'HEAD') {
      const head = plan.head ?? {}
      if (head.reject) throw new Error('network down')
      return {
        ok: head.ok ?? true,
        status: head.ok === false ? 404 : 200,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'content-length' && head.size !== null && head.size !== undefined
              ? String(head.size)
              : null,
        },
      } as unknown as Response
    }
    const get = plan.get ?? {}
    return {
      ok: get.ok ?? true,
      status: get.ok === false ? 404 : 200,
      headers: { get: () => null },
      arrayBuffer: async () => get.body ?? new ArrayBuffer(0),
    } as unknown as Response
  })
  vi.stubGlobal('fetch', impl)
  return impl
}

const MB = 1024 * 1024

// ---------------------------------------------------------------- tests ----

describe('OfficePreview 四态降级', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('不支持态:未知扩展名直接落 unsupported,且不发任何请求', async () => {
    const spy = stubFetch({})
    render(<OfficePreview src="https://x/file.xyz" ext="xyz" />)
    await waitFor(() =>
      expect(screen.getByTestId('office-preview').dataset.officeState).toBe('unsupported'),
    )
    expect(screen.getByTestId('office-unsupported').textContent).toBe('WORD_UNSUPPORTED')
    expect(spy).not.toHaveBeenCalled()
  })

  it('过期态:HEAD 网络失败落 expired(产物 URL 失效)', async () => {
    stubFetch({ head: { reject: true } })
    render(<OfficePreview src="https://x/a.docx" ext="docx" />)
    await waitFor(() =>
      expect(screen.getByTestId('office-preview').dataset.officeState).toBe('expired'),
    )
    expect(screen.getByTestId('office-expired').textContent).toBe('WORD_EXPIRED')
  })

  it('过大态:HEAD content-length 超硬阈值落 too-large,不出 GET 流量', async () => {
    const spy = stubFetch({ head: { size: 60 * MB } })
    render(<OfficePreview src="https://x/a.xlsx" ext="xlsx" />)
    await waitFor(() =>
      expect(screen.getByTestId('office-preview').dataset.officeState).toBe('too-large'),
    )
    expect(screen.getByTestId('office-too-large').textContent).toBe('WORD_TOO_LARGE')
    const getCalls = spy.mock.calls.filter((c) => (c[1] as { method?: string })?.method !== 'HEAD')
    expect(getCalls).toHaveLength(0)
  })

  it('xls:SheetJS 读旧版二进制工作簿并渲染表格', async () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['OLD_A1']]), '旧表')
    const body = toArrayBuffer(XLSX.write(wb, { type: 'array', bookType: 'xls' }))
    stubFetch({ head: { size: 100 }, get: { body } })
    render(<OfficePreview src="https://x/legacy.xls" ext="xls" />)
    await waitFor(() => expect(screen.getByTestId('xlsx-table').textContent).toContain('OLD_A1'))
  })

  it('懒加载态:超 10MB 先出按钮,点击后才拉取并渲染(xlsx)', async () => {
    stubFetch({ head: { size: 15 * MB }, get: { body: makeXlsx() } })
    render(<OfficePreview src="https://x/big.xlsx" ext="xlsx" />)
    const lazyBtn = await screen.findByTestId('office-lazy-btn')
    expect(lazyBtn.textContent).toBe('WORD_LAZY')
    fireEvent.click(lazyBtn)
    await waitFor(() =>
      expect(screen.getByTestId('office-preview').dataset.officeState).toBe('ready'),
    )
    await screen.findByTestId('xlsx-table')
    await waitFor(() => expect(screen.getByTestId('xlsx-table').textContent).toContain('A1'))
  })

  it('blob: 地址跳过 HEAD 直接 GET(统一查看器交来的已是内存字节)', async () => {
    const spy = stubFetch({ get: { body: makeXlsx() } })
    render(<OfficePreview src="blob:http://localhost/abc" ext="xlsx" />)
    await waitFor(() =>
      expect(screen.getByTestId('office-preview').dataset.officeState).toBe('ready'),
    )
    const headCalls = spy.mock.calls.filter((c) => (c[1] as { method?: string })?.method === 'HEAD')
    expect(headCalls).toHaveLength(0)
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('OfficePreview 渲染面', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('docx:动态 docx-preview 渲染进容器', async () => {
    stubFetch({ head: { size: null }, get: { body: new ArrayBuffer(8) } })
    render(<OfficePreview src="https://x/a.docx" ext="docx" />)
    const rendered = await screen.findByTestId('docx-rendered')
    expect(rendered.textContent).toBe('DOCX_RENDERED_TEXT')
  })

  it('docx:段落 pin 落到对应段落,点击选中批注线程', async () => {
    stubFetch({ head: { size: null }, get: { body: new ArrayBuffer(8) } })
    const onSelect = vi.fn()
    render(
      <OfficePreview
        src="https://x/a.docx"
        ext="docx"
        documentId="doc-1"
        annotationPins={[
          {
            id: 'docx-pin-1',
            kind: 'docx',
            label: '文档第 1 段',
            body: '核对甲方整改期限',
            excerpt: '整改期限',
            status: 'open',
            paragraph: 1,
          },
        ]}
        onAnnotationSelect={onSelect}
      />,
    )
    await screen.findByTestId('docx-rendered')
    const pin = await screen.findByTestId('docx-annotation-pin')
    expect(pin.getAttribute('data-annotation-id')).toBe('docx-pin-1')
    fireEvent.click(pin)
    expect(onSelect).toHaveBeenCalledWith('docx-pin-1')
  })

  it('xlsx:单元格 pin 按 sheet+range 起点落点,点击选中批注线程', async () => {
    stubFetch({ head: { size: 100 }, get: { body: makeXlsx() } })
    const onSelect = vi.fn()
    render(
      <OfficePreview
        src="https://x/a.xlsx"
        ext="xlsx"
        documentId="doc-2"
        annotationPins={[
          {
            id: 'xlsx-pin-1',
            kind: 'xlsx',
            label: '表A · A2',
            body: '核对进度',
            excerpt: null,
            status: 'open',
            sheet: '表A',
            range: 'A2',
          },
        ]}
        onAnnotationSelect={onSelect}
      />,
    )
    await waitFor(() => expect(screen.getByTestId('xlsx-table').textContent).toContain('A1'))
    const pin = await screen.findByTestId('xlsx-annotation-pin')
    expect(pin.getAttribute('data-annotation-id')).toBe('xlsx-pin-1')
    fireEvent.click(pin)
    expect(onSelect).toHaveBeenCalledWith('xlsx-pin-1')
  })

  it('docx/xlsx 全文预审入口只有 documentId 时出现,段落就绪后解除禁用', async () => {
    stubFetch({ head: { size: null }, get: { body: new ArrayBuffer(8) } })
    render(<OfficePreview src="https://x/a.docx" ext="docx" documentId="doc-3" />)
    const button = await screen.findByTestId('office-ai-full-review')
    expect((button as HTMLButtonElement).disabled).toBe(true)
    await screen.findByTestId('docx-rendered')
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  })

  it('DOCX 段落 block 保留首尾段坐标,不应把页码冒充段落', () => {
    const built = buildDocxReviewBlocks(['第一段文字足够长', '第二段文字也足够长'])
    expect(built.blocks).toHaveLength(1)
    expect(built.truncated).toBe(false)
    expect(built.blocks[0]!.anchor).toMatchObject({ kind: 'docx', paragraph: 1, paragraphEnd: 2 })
    const sheet = buildXlsxReviewBlocks('表A', [['标题', '值'], ['A', '1']])
    expect(sheet.truncated).toBe(false)
    expect(sheet.blocks[0]!.anchor).toMatchObject(
      { kind: 'xlsx', sheet: '表A', range: 'A1:B2' },
    )
    expect(xlsxRangeStart('A2:C9')).toEqual({ row: 2, col: 0 })
    expect(xlsxRangeStart('')).toBeNull()

    const workbook = buildXlsxWorkbookReviewBlocks([
      { sheet: '表A', rows: [['标题', '值'], ['A', '1']], total: 2 },
      { sheet: '表B', rows: [['标题2', '值2'], ['B', '2']], total: 3 },
    ])
    expect(workbook.blocks).toHaveLength(2)
    expect(workbook.blocks.map((block) => block.anchor.sheet)).toEqual(['表A', '表B'])
    expect(workbook.truncated).toBe(true) // 表B 只送了 2 行,真实 3 行 ⇒ 必须披露未通读
  })

  it('xlsx:默认首 sheet 渲染,tab 切换换内容,点单元格显示选区行列号', async () => {
    stubFetch({ head: { size: 100 }, get: { body: makeXlsx() } })
    render(<OfficePreview src="https://x/a.xlsx" ext="xlsx" />)
    await waitFor(() => expect(screen.getByTestId('xlsx-table').textContent).toContain('A1'))

    // 切到表B
    fireEvent.click(screen.getByText('表B'))
    await waitFor(() => expect(screen.getByTestId('xlsx-table').textContent).toContain('B1'))
    expect(screen.getByTestId('xlsx-table').textContent).not.toContain('A1')

    // 选区:点击表B唯一单元格(sheet 第 1 行第 A 列 → B 有点歧义,这里用回表A验证引用)
    fireEvent.click(screen.getByText('表A'))
    await waitFor(() => expect(screen.getByTestId('xlsx-table').textContent).toContain('A3'))
    fireEvent.click(screen.getByText('A3')) // body 第 1 行(工作表第 2 行)第 1 列 → A2
    expect(screen.getByTestId('xlsx-selection').textContent).toBe('WORD_SELECTED(A2)')
  })

  it('xlsx:ARGB 填充/字体/对齐映射成 CSS,缺少样式时不强行改表格默认', () => {
    const cell = {
      s: {
        fill: { fgColor: { rgb: 'FFFFFF00' } },
        font: { bold: true, color: { rgb: 'FFFF0000' }, sz: 14 },
        alignment: { horizontal: 'center' },
      },
    } as unknown as Parameters<typeof xlsxCellCss>[0]
    expect(xlsxCellCss(cell)).toEqual({
      backgroundColor: '#FFFF00',
      color: '#FF0000',
      fontWeight: 700,
      fontSize: '14px',
      textAlign: 'center',
    })
    expect(xlsxCellCss(undefined)).toBeUndefined()
  })

  it('xlsx:合并单元格按 colSpan 渲染,被覆盖格不重复出格', async () => {
    stubFetch({ head: { size: 100 }, get: { body: makeMergedXlsx() } })
    render(<OfficePreview src="https://x/merged.xlsx" ext="xlsx" />)
    await waitFor(() => expect(screen.getByTestId('xlsx-table').textContent).toContain('合并表头'))
    const merged = screen.getByText('合并表头').closest('th')
    expect(merged?.getAttribute('colspan')).toBe('2')
    expect(screen.getAllByTestId('xlsx-cell')).toHaveLength(2)
  })

  it('xlsx:选中带公式的单元格后,公式栏显示公式而不是只显示结果', async () => {
    stubFetch({ head: { size: 100 }, get: { body: makeFormulaXlsx() } })
    render(<OfficePreview src="https://x/formula.xlsx" ext="xlsx" />)
    await waitFor(() => expect(screen.getByTestId('xlsx-table').textContent).toContain('2'))
    fireEvent.click(screen.getByText('2'))
    expect(screen.getByTestId('xlsx-formula').textContent).toContain('=SUM(1,1)')
  })

  it('pptx:jszip 降级解析出逐 slide 文本大纲,slide1 带讲者备注', async () => {
    stubFetch({ head: { size: 100 }, get: { body: await makePptx() } })
    render(<OfficePreview src="https://x/a.pptx" ext="pptx" />)
    const outline = await screen.findByTestId('pptx-outline')
    await waitFor(() => expect(outline.textContent).toContain('标题一'))
    expect(outline.textContent).toContain('第二页')
    const notes = screen.getByTestId('pptx-notes')
    expect(notes.textContent).toContain('WORD_NOTES')
    expect(notes.textContent).toContain('备注甲')
  })

  it('pdf:PdfEmbed 显示页码(1/5),跳转输入 3 后 iframe 锚更新为 #page=3', async () => {
    render(<PdfEmbed src="https://x/a.pdf" />)
    await screen.findByTestId('pdf-embed')
    const indicator = await screen.findByText('WORD_PAGE(1)/(5)')
    expect(indicator).toBeTruthy()
    const input = screen.getByTestId('pdf-page-input')
    fireEvent.change(input, { target: { value: '3' } })
    fireEvent.click(screen.getByTestId('pdf-page-jump'))
    const iframe = document.querySelector('iframe[title="pdf-preview"]')
    expect(iframe?.getAttribute('src')).toBe('https://x/a.pdf#page=3')
  })
})

describe('词表键五语言直锁(D41)', () => {
  const KEYS = [
    'officeTooLarge',
    'officeExpired',
    'officeUnsupported',
    'officeLazyLoad',
    'officeLoading',
    'officeFailed',
    'officeDownload',
    'officeSelectedCell',
    'officeRowsTruncated',
    'pdfPageIndicator',
    'pdfPageOnly',
    'pdfPageJump',
    'pdfPageJumpLabel',
    'pptxNotes',
  ]
  const here = path.dirname(fileURLToPath(import.meta.url))
  // __tests__ → media → components → src → web → apps → repo root
  const repoRoot = path.resolve(here, '..', '..', '..', '..', '..', '..')

  it('14 个 D41 键在五语言 chat 命名空间全部存在且非空', () => {
    for (const locale of ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']) {
      const file = path.join(repoRoot, 'packages', 'i18n', 'messages', 'web', `${locale}.json`)
      const data = JSON.parse(readFileSync(file, 'utf-8')) as {
        chat: Record<string, string>
      }
      for (const key of KEYS) {
        expect(data.chat[key], `${locale}/${key}`).toBeTruthy()
      }
    }
  })

  it('xlsxColumnRef:0基列号 → 表格列标', () => {
    expect(xlsxColumnRef(0)).toBe('A')
    expect(xlsxColumnRef(25)).toBe('Z')
    expect(xlsxColumnRef(26)).toBe('AA')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
