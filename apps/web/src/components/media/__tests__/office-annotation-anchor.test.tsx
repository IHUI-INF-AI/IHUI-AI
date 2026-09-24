// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D91 四类文档批注锚点 —— XLSX/DOCX 选区采集 + 注事件派发(2026-09-24 立)。
 *  - XLSX 坐标格式化(sheet+range → `{sheet} · {range}`)与次标签(已选择 {range})
 *  - DOCX 段锚坐标(选中文本 → 段落序号)
 *  - 事件派发:ihui:add-text-reference CustomEvent detail 结构(text 兼容 D22 消费者)
 *  - 取消/删除态(shared 单一状态机)
 *  - 词表五语言直锁(label.docxText)
 * PDF/PPTX 无选区采集能力(D41 二期),登记不做。
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import * as XLSX from 'xlsx'

// ---- 取词面:坐标文案用 zh-CN 原文逐字锁,其余键占位 ----
const WORDS: Record<string, string> = {
  'chat.officeLoading': 'WORD_LOADING',
  'chat.officeFailed': 'WORD_FAILED',
  'chat.officeDownload': 'WORD_DOWNLOAD',
  'chat.officeSelectedCell': 'SELCELL {cell}',
  'chat.officeRowsTruncated': 'TRUNC {rows}',
  'ai.pane.annotationAnchors.label.pdf': 'PDF 第 {page} 页',
  'ai.pane.annotationAnchors.label.docx': '文档第 {page} 页',
  'ai.pane.annotationAnchors.label.docxText': '文档第 {paragraph} 段',
  'ai.pane.annotationAnchors.label.pptx': '第 {slide} 张 · {element}',
  'ai.pane.annotationAnchors.label.pptxSlide': '第 {slide} 张',
  'ai.pane.annotationAnchors.label.pptxComment': '批注 {element}',
  'ai.pane.annotationAnchors.label.xlsx': '{sheet} · {range}',
  'ai.pane.annotationAnchors.label.xlsxSheet': '{sheet}',
  'ai.pane.annotationAnchors.label.xlsxSelected': '已选择 {range}',
  'ai.pane.annotationAnchors.taskInputPlaceholder': 'PLACEHOLDER',
  'ai.pane.annotationAnchors.addToTask': '添加到任务',
  'ai.pane.annotationAnchors.cancel': '取消',
  'ai.pane.annotationAnchors.delete': '删除',
  'ai.pane.annotationAnchors.relabel': '重新标注',
  'ai.pane.annotationAnchors.ariaLabel': '文档批注锚点',
}

vi.mock('next-intl', () => ({
  useTranslations:
    (ns: string) =>
    (key: string, values?: Record<string, string | number>): string => {
      const raw = WORDS[`${ns}.${key}`] ?? key
      return raw.replace(/\{(\w+)\}/g, (_m, n: string) => String(values?.[n] ?? ''))
    },
}))

vi.mock('docx-preview', () => ({
  renderAsync: vi.fn(async (_data: unknown, container: HTMLElement) => {
    for (const text of ['第一段内容', '第二段内容']) {
      const p = document.createElement('p')
      p.textContent = text
      container.appendChild(p)
    }
  }),
}))

import {
  AnnotationAnchorCapture,
  emitAnchorReference,
  ADD_TEXT_REFERENCE_EVENT,
  type AnchorReferenceDetail,
} from '@/components/chat/annotation-anchor'
import { OfficePreview } from '../office-preview'

// ------------------------------------------------------------- fixtures ----

function toArrayBuffer(x: unknown): ArrayBuffer {
  const u8 = new Uint8Array(x as ArrayBuffer)
  return u8.slice().buffer
}

function makeXlsx(): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['H1', 'H2'],
      ['V1', 'V2'],
    ]),
    '表A',
  )
  return toArrayBuffer(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }))
}

interface FetchPlan {
  readonly head: { ok: boolean; size: number }
  readonly get: { ok: boolean; body: ArrayBuffer }
}

function stubFetch(plan: FetchPlan): void {
  type StubResponse = {
    ok: boolean
    headers: { get: (name: string) => string | null }
    arrayBuffer?: () => Promise<ArrayBuffer>
  }
  const impl = async (_url: string, init?: { method?: string }): Promise<StubResponse> => {
    if (init?.method === 'HEAD') {
      const size: string = String(plan.head.size)
      return { ok: plan.head.ok, headers: { get: (_name: string) => size } }
    }
    const body: ArrayBuffer = plan.get.body
    return {
      ok: plan.get.ok,
      headers: { get: (_name: string) => null },
      arrayBuffer: async () => body,
    }
  }
  vi.stubGlobal('fetch', vi.fn(impl))
}

// ------------------------------------------------------ event capture ----

function captureEvents(): AnchorReferenceDetail[] & { release: () => void } {
  const received: AnchorReferenceDetail[] = []
  const listener = (e: Event): void => {
    received.push((e as CustomEvent<AnchorReferenceDetail>).detail)
  }
  window.addEventListener(ADD_TEXT_REFERENCE_EVENT, listener)
  return Object.assign(received, {
    release: () => window.removeEventListener(ADD_TEXT_REFERENCE_EVENT, listener),
  }) as AnchorReferenceDetail[] & { release: () => void }
}

beforeEach(() => {
  window.localStorage?.clear?.()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// -------------------------------------------------------------- tests ----

describe('D91 XLSX 单元格选区 → 批注锚 → 注事件', () => {
  it('点单元格出现采集卡,坐标 `{sheet} · {range}` + 次标签 `已选择 {range}`', async () => {
    stubFetch({ head: { ok: true, size: 100 }, get: { ok: true, body: makeXlsx() } })
    render(<OfficePreview src="/f.xlsx" ext="xlsx" />)
    const grid = await screen.findByTestId('xlsx-grid', {}, { timeout: 5000 })
    const cell = await waitFor(() => {
      const el = grid.querySelector('[data-testid="xlsx-cell"]') as HTMLElement | null
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    fireEvent.click(cell)
    const card = document.querySelector('[data-testid="xlsx-anchor-capture"]') as HTMLElement
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-anchor-kind')).toBe('xlsx')
    expect(card.getAttribute('data-anchor-state')).toBe('labeled')
    const labels = card.querySelectorAll('[data-anchor-label]')
    expect(labels[0]?.textContent).toBe('表A · A1')
    expect(labels[1]?.textContent).toBe('已选择 A1')
  })

  it('添加到任务:派发 ihui:add-text-reference,detail 含 text(兼容 D22)+ 结构化 anchor/sheet/range', async () => {
    stubFetch({ head: { ok: true, size: 100 }, get: { ok: true, body: makeXlsx() } })
    render(<OfficePreview src="/f.xlsx" ext="xlsx" />)
    const grid = await screen.findByTestId('xlsx-grid', {}, { timeout: 5000 })
    const cell = await waitFor(() => {
      const el = grid.querySelector('[data-testid="xlsx-cell"]') as HTMLElement | null
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    fireEvent.click(cell)
    const card = document.querySelector('[data-testid="xlsx-anchor-capture"]') as HTMLElement
    const note = card.querySelector('[data-testid="annotation-anchor-note"]') as HTMLTextAreaElement
    expect(note.placeholder).toBe('PLACEHOLDER')
    fireEvent.change(note, { target: { value: '把表头加粗' } })
    const received = captureEvents()
    fireEvent.click(card.querySelector('[data-action="add"]') as HTMLButtonElement)
    expect(received).toHaveLength(1)
    expect(received[0]?.text).toBe('[表A · A1] 把表头加粗')
    expect(received[0]?.anchor).toEqual({ kind: 'xlsx', sheet: '表A', range: 'A1' })
    expect(received[0]?.source).toBe('xlsx-selection')
    expect(received[0]?.sheet).toBe('表A')
    expect(received[0]?.range).toBe('A1')
    received.release()
  })

  it('备注为空时添加按钮禁用(不臆断描述,不派发)', async () => {
    stubFetch({ head: { ok: true, size: 100 }, get: { ok: true, body: makeXlsx() } })
    render(<OfficePreview src="/f.xlsx" ext="xlsx" />)
    const grid = await screen.findByTestId('xlsx-grid', {}, { timeout: 5000 })
    const cell = await waitFor(() => {
      const el = grid.querySelector('[data-testid="xlsx-cell"]') as HTMLElement | null
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    fireEvent.click(cell)
    const card = document.querySelector('[data-testid="xlsx-anchor-capture"]') as HTMLElement
    const addBtn = card.querySelector('[data-action="add"]') as HTMLButtonElement
    expect(addBtn.disabled).toBe(true)
    const received = captureEvents()
    fireEvent.click(addBtn)
    expect(received).toHaveLength(0)
    received.release()
  })

  it('切换 sheet tab 清锚(不残留上一张表的坐标)', async () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['A'], ['A2']]), '表A')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['B'], ['B2']]), '表B')
    stubFetch({
      head: { ok: true, size: 100 },
      get: { ok: true, body: toArrayBuffer(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })) },
    })
    render(<OfficePreview src="/f.xlsx" ext="xlsx" />)
    const grid = await screen.findByTestId('xlsx-grid', {}, { timeout: 5000 })
    const cell = await waitFor(() => {
      const el = grid.querySelector('[data-testid="xlsx-cell"]') as HTMLElement | null
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    fireEvent.click(cell)
    expect(document.querySelector('[data-testid="xlsx-anchor-capture"]')).not.toBeNull()
    const tabs = [...grid.querySelectorAll('[data-testid="xlsx-sheet-tab"]')]
    fireEvent.click(tabs.find((el) => el.textContent === '表B') as HTMLElement)
    await waitFor(() =>
      expect(document.querySelector('[data-testid="xlsx-anchor-capture"]')).toBeNull(),
    )
  })
})

describe('D91 DOCX 文本选区 → 段落锚 → 注事件', () => {
  function stubSelection(node: Node | null, text: string): void {
    ;(document as unknown as { getSelection: () => unknown }).getSelection = () => ({
      isCollapsed: !node,
      anchorNode: node,
      toString: () => text,
    })
  }

  it('选中第二段文本 → 采集卡坐标 `文档第 2 段`,备注预填选中文本摘要', async () => {
    stubFetch({ head: { ok: true, size: 100 }, get: { ok: true, body: new ArrayBuffer(8) } })
    render(<OfficePreview src="/f.docx" ext="docx" />)
    const body = await screen.findByTestId('docx-body', {}, { timeout: 5000 })
    await waitFor(() => expect(body.querySelectorAll('p').length).toBe(2))
    const p2 = body.querySelectorAll('p')[1] as HTMLParagraphElement
    stubSelection(p2.firstChild, '第二段内容选区')
    fireEvent.mouseUp(body)
    const card = document.querySelector('[data-testid="docx-anchor-capture"]') as HTMLElement
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-anchor-kind')).toBe('docx')
    expect(card.querySelector('[data-anchor-label="main"]')?.textContent).toBe('文档第 2 段')
    expect(
      (card.querySelector('[data-testid="annotation-anchor-note"]') as HTMLTextAreaElement).value,
    ).toBe('第二段内容选区')
  })

  it('添加到任务:detail.text = [文档第 N 段] 描述,带 paragraph/excerpt 结构化字段', async () => {
    stubFetch({ head: { ok: true, size: 100 }, get: { ok: true, body: new ArrayBuffer(8) } })
    render(<OfficePreview src="/f.docx" ext="docx" />)
    const body = await screen.findByTestId('docx-body', {}, { timeout: 5000 })
    await waitFor(() => expect(body.querySelectorAll('p').length).toBe(2))
    const p1 = body.querySelectorAll('p')[0] as HTMLParagraphElement
    stubSelection(p1.firstChild, '第一段选区')
    fireEvent.mouseUp(body)
    const card = document.querySelector('[data-testid="docx-anchor-capture"]') as HTMLElement
    const note = card.querySelector('[data-testid="annotation-anchor-note"]') as HTMLTextAreaElement
    fireEvent.change(note, { target: { value: '检查措辞' } })
    const received = captureEvents()
    fireEvent.click(card.querySelector('[data-action="add"]') as HTMLButtonElement)
    expect(received[0]?.text).toBe('[文档第 1 段] 检查措辞')
    expect(received[0]?.anchor).toEqual({ kind: 'docx' })
    expect(received[0]?.source).toBe('docx-selection')
    expect(received[0]?.paragraph).toBe(1)
    expect(received[0]?.excerpt).toBe('第一段选区')
    received.release()
  })

  it('选区塌陷/越界(mouseup 无有效选区)→ 不出采集卡', async () => {
    stubFetch({ head: { ok: true, size: 100 }, get: { ok: true, body: new ArrayBuffer(8) } })
    render(<OfficePreview src="/f.docx" ext="docx" />)
    const body = await screen.findByTestId('docx-body', {}, { timeout: 5000 })
    await waitFor(() => expect(body.querySelectorAll('p').length).toBe(2))
    stubSelection(null, '')
    fireEvent.mouseUp(body)
    expect(document.querySelector('[data-testid="docx-anchor-capture"]')).toBeNull()
  })
})

describe('D91 AnnotationAnchorCapture / 取消与删除态(单一状态机)', () => {
  const xlsxAnchor = { kind: 'xlsx' as const, sheet: '明细', range: 'B2:C9' }

  it('取消 → cancelled + 重新标注;重新标注回 labeled;删除回调带锚点', () => {
    const onDispose = vi.fn()
    const { container } = render(
      <AnnotationAnchorCapture anchor={xlsxAnchor} source="xlsx-selection" onDispose={onDispose} />,
    )
    fireEvent.click(container.querySelector('[data-action="cancel"]') as HTMLButtonElement)
    const root = container.querySelector('[data-anchor-kind="xlsx"]') as HTMLElement
    expect(root.getAttribute('data-anchor-state')).toBe('cancelled')
    expect(onDispose).toHaveBeenCalledWith(xlsxAnchor)
    fireEvent.click(container.querySelector('[data-action="relabel"]') as HTMLButtonElement)
    expect(root.getAttribute('data-anchor-state')).toBe('labeled')
    fireEvent.click(container.querySelector('[data-action="delete"]') as HTMLButtonElement)
    expect(root.getAttribute('data-anchor-state')).toBe('deleted')
    expect(root.querySelector('[data-action]')).toBeNull()
  })

  it('删除为终态:动作区消失、标签划线', () => {
    const { container } = render(
      <AnnotationAnchorCapture anchor={xlsxAnchor} source="xlsx-selection" />,
    )
    fireEvent.click(container.querySelector('[data-action="delete"]') as HTMLButtonElement)
    const root = container.querySelector('[data-anchor-kind="xlsx"]') as HTMLElement
    expect(root.getAttribute('data-anchor-state')).toBe('deleted')
    expect(root.querySelector('[data-testid="annotation-anchor-note"]')).toBeNull()
    expect(root.querySelector('[data-anchor-label="main"]')?.className).toContain('line-through')
  })

  it('添加后 add 幂等:重复点击不再派发', () => {
    const { container } = render(
      <AnnotationAnchorCapture anchor={xlsxAnchor} source="xlsx-selection" />,
    )
    const note = container.querySelector(
      '[data-testid="annotation-anchor-note"]',
    ) as HTMLTextAreaElement
    fireEvent.change(note, { target: { value: '改这格' } })
    const received = captureEvents()
    const addBtn = container.querySelector('[data-action="add"]') as HTMLButtonElement
    fireEvent.click(addBtn)
    expect(
      (container.querySelector('[data-anchor-kind="xlsx"]') as HTMLElement).getAttribute(
        'data-anchor-state',
      ),
    ).toBe('added')
    expect(addBtn.disabled).toBe(true)
    fireEvent.click(addBtn)
    expect(received).toHaveLength(1)
    received.release()
  })

  it('XLSX 坐标格式化(无 range 退化形)与 PDF/PPTX 类型驱动分支', () => {
    const noRange = render(
      <AnnotationAnchorCapture anchor={{ kind: 'xlsx', sheet: '明细' }} source="xlsx-selection" />,
    )
    expect(noRange.container.querySelector('[data-anchor-label="main"]')?.textContent).toBe('明细')
    expect(noRange.container.querySelector('[data-anchor-label="secondary"]')).toBeNull()
    noRange.unmount()

    const pdf = render(
      <AnnotationAnchorCapture anchor={{ kind: 'pdf', page: 4 }} source="xlsx-selection" />,
    )
    expect(pdf.container.querySelector('[data-anchor-label="main"]')?.textContent).toBe(
      'PDF 第 4 页',
    )
    pdf.unmount()
  })
})

describe('D91 emitAnchorReference 直派(D22 通道)', () => {
  it('window 级 CustomEvent,事件名与 detail 形状稳定', () => {
    const received = captureEvents()
    emitAnchorReference({
      text: '[明细 · B2] 改',
      anchor: { kind: 'xlsx', sheet: '明细', range: 'B2' },
      source: 'xlsx-selection',
      sheet: '明细',
      range: 'B2',
    })
    expect(received).toHaveLength(1)
    expect(typeof received[0]?.text).toBe('string')
    received.release()
  })
})

describe('D91 词表五语言直锁(label.docxText)', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const MESSAGES_ROOT = join(here, '../../../../../..', 'packages/i18n/messages/web')
  const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
  const EXPECTED: Record<(typeof LOCALES)[number], string> = {
    'zh-CN': '文档第 {paragraph} 段',
    'zh-TW': '文件第 {paragraph} 段',
    en: 'Document paragraph {paragraph}',
    ja: 'ドキュメントの段落 {paragraph}',
    ko: '문서 {paragraph} 단락',
  }

  it('五语言 label.docxText 存在且逐字一致(含 {paragraph} 插值)', () => {
    for (const locale of LOCALES) {
      const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
      const data = JSON.parse(raw) as {
        ai: { pane: { annotationAnchors: { label: Record<string, string> } } }
      }
      expect(data.ai.pane.annotationAnchors.label.docxText, locale).toBe(EXPECTED[locale])
    }
  })

  it('既有 label.docx(页码形)未被本次插入破坏(五语言 parity 防踩踏)', () => {
    for (const locale of LOCALES) {
      const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
      const data = JSON.parse(raw) as {
        ai: { pane: { annotationAnchors: { label: Record<string, string> } } }
      }
      expect(typeof data.ai.pane.annotationAnchors.label.docx, locale).toBe('string')
      expect(data.ai.pane.annotationAnchors.label.xlsx, locale).toContain('{range}')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
