// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:IHUI-AI·智汇AI·李春川·LC·aizhs.top·PROVENANCE-2026

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

import { OfficePreview, xlsxColumnRef } from '../office-preview'
import { PdfEmbed } from '../message-file-preview'

// ------------------------------------------------------------- fixtures ----

function toArrayBuffer(x: unknown): ArrayBuffer {
  const u8 = new Uint8Array(x as ArrayBuffer)
  return u8.slice().buffer
}

/** 用 SheetJS 现场生成最小 xlsx:两个 sheet,内容可辨识。 */
function makeXlsx(): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['A1', 'A2'], ['A3', 'A4']]), '表A')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['B1']]), '表B')
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
  readonly head?: { readonly ok?: boolean; readonly reject?: boolean; readonly size?: number | null }
  readonly get?: { readonly ok?: boolean; readonly body?: ArrayBuffer }
}

function stubFetch(plan: FetchPlan): ReturnType<typeof vi.fn> {
  const impl = vi.fn(
    async (input: string | URL, init?: { method?: string }): Promise<Response> => {
      void input
      if (init?.method === 'HEAD') {
        const head = plan.head ?? {}
        if (head.reject) throw new Error('network down')
        return {
          ok: head.ok ?? true,
          status: head.ok === false ? 404 : 200,
          headers: {
            get: (name: string) =>
              name.toLowerCase() === 'content-length' && head.size != null
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
    },
  )
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
