// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { render, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  ANNOTATION_ANCHOR_KINDS,
  type AnnotationAnchor,
} from '@ihui/shared/chat/annotation-anchors'

import { AnnotationAnchorLabel } from '../annotation-anchor-label'

// 只断言**结构与判据**(kind / 状态 / 动作可见性),文案一律走 key,
// 真实文案覆盖由下面「读真实词包」那组用例守住。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${JSON.stringify(values)})` : key,
}))

const anchors: Record<(typeof ANNOTATION_ANCHOR_KINDS)[number], AnnotationAnchor> = {
  pdf: { kind: 'pdf', page: 3 },
  pptx: { kind: 'pptx', slide: 5, element: '标题文本框' },
  docx: { kind: 'docx', page: 12 },
  xlsx: { kind: 'xlsx', sheet: '季度汇总', range: 'A1:C9' },
}

const mainKeyOf = (anchor: AnnotationAnchor): string => {
  switch (anchor.kind) {
    case 'pdf':
      return 'label.pdf'
    case 'pptx':
      return 'label.pptx'
    case 'docx':
      return 'label.docx'
    case 'xlsx':
      return 'label.xlsx'
  }
}

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../../../packages/i18n/messages/web')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

describe('D91 AnnotationAnchorLabel / 四坐标标签渲染', () => {
  it('四类各渲染出 data-anchor-kind 与对应主标签键(含极易漏掉的 docx)', () => {
    for (const kind of ANNOTATION_ANCHOR_KINDS) {
      const { container, unmount } = render(<AnnotationAnchorLabel anchor={anchors[kind]} />)
      const root = container.querySelector(`[data-anchor-kind="${kind}"]`)
      expect(root, kind).not.toBeNull()
      expect(root?.getAttribute('data-anchor-state')).toBe('labeled')
      expect(root?.querySelector(`[data-anchor-label="${mainKeyOf(anchors[kind])}"]`), kind).not.toBeNull()
      unmount()
    }
  })

  it('pptx 次标签 label.pptxComment(批注 {element});xlsx 次标签 label.xlsxSelected(已选择 {range})', () => {
    const pptx = render(<AnnotationAnchorLabel anchor={anchors.pptx} />)
    expect(pptx.container.querySelector('[data-anchor-secondary="label.pptxComment"]')).not.toBeNull()
    const xlsx = render(<AnnotationAnchorLabel anchor={anchors.xlsx} />)
    expect(xlsx.container.querySelector('[data-anchor-secondary="label.xlsxSelected"]')).not.toBeNull()
  })

  it('pptx 无 element / xlsx 无 range 时无次标签(退化形),不留空壳', () => {
    const pptx = render(<AnnotationAnchorLabel anchor={{ kind: 'pptx', slide: 2 }} />)
    expect(pptx.container.querySelector('[data-anchor-secondary]')).toBeNull()
    expect(pptx.container.querySelector('[data-anchor-label="label.pptxSlide"]')).not.toBeNull()
    const xlsx = render(<AnnotationAnchorLabel anchor={{ kind: 'xlsx', sheet: '明细' }} />)
    expect(xlsx.container.querySelector('[data-anchor-secondary]')).toBeNull()
    expect(xlsx.container.querySelector('[data-anchor-label="label.xlsxSheet"]')).not.toBeNull()
  })

  it('统一动作占位符走 taskInputPlaceholder 键(描述希望 Agent 修改或检查的内容)', () => {
    const { container } = render(<AnnotationAnchorLabel anchor={anchors.pdf} />)
    const note = container.querySelector('[data-testid="annotation-anchor-note"]') as HTMLTextAreaElement
    expect(note).not.toBeNull()
    expect(note.getAttribute('placeholder')).toBe('taskInputPlaceholder')
  })
})

describe('D91 AnnotationAnchorLabel / 动作与状态转移(单一状态机)', () => {
  it('添加到任务:回调收到回流文本 [坐标标签] 备注,态转 added 且按钮禁用(不可重复添加)', () => {
    const onAddToTask = vi.fn()
    const { container } = render(<AnnotationAnchorLabel anchor={anchors.pdf} onAddToTask={onAddToTask} />)
    const note = container.querySelector('[data-testid="annotation-anchor-note"]') as HTMLTextAreaElement
    fireEvent.change(note, { target: { value: '修改这段公式' } })
    const addBtn = container.querySelector('[data-action="add"]') as HTMLButtonElement
    expect(addBtn.disabled).toBe(false)
    fireEvent.click(addBtn)
    expect(onAddToTask).toHaveBeenCalledTimes(1)
    expect(onAddToTask.mock.calls[0]?.[0]).toBe(
      '[label.pdf({"page":3})] 修改这段公式',
    )
    const root = container.querySelector('[data-anchor-kind="pdf"]')
    expect(root?.getAttribute('data-anchor-state')).toBe('added')
    expect((container.querySelector('[data-action="add"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('备注为空时添加按钮禁用(不臆断内容)', () => {
    const onAddToTask = vi.fn()
    const { container } = render(<AnnotationAnchorLabel anchor={anchors.pdf} onAddToTask={onAddToTask} />)
    const addBtn = container.querySelector('[data-action="add"]') as HTMLButtonElement
    expect(addBtn.disabled).toBe(true)
    fireEvent.click(addBtn)
    expect(onAddToTask).not.toHaveBeenCalled()
  })

  it('取消 → cancelled 态 + 重新标注按钮出现;点重新标注回 labeled', () => {
    const onCancel = vi.fn()
    const { container } = render(<AnnotationAnchorLabel anchor={anchors.xlsx} onCancel={onCancel} />)
    fireEvent.click(container.querySelector('[data-action="cancel"]') as HTMLButtonElement)
    expect(onCancel).toHaveBeenCalledTimes(1)
    const root = container.querySelector('[data-anchor-kind="xlsx"]')
    expect(root?.getAttribute('data-anchor-state')).toBe('cancelled')
    const relabel = container.querySelector('[data-action="relabel"]') as HTMLButtonElement
    expect(relabel).not.toBeNull()
    fireEvent.click(relabel)
    expect(root?.getAttribute('data-anchor-state')).toBe('labeled')
  })

  it('删除 → deleted 终态:动作区整个消失,标签划线,删除回调带上锚点', () => {
    const onDelete = vi.fn()
    const { container } = render(<AnnotationAnchorLabel anchor={anchors.docx} onDelete={onDelete} />)
    fireEvent.click(container.querySelector('[data-action="delete"]') as HTMLButtonElement)
    expect(onDelete).toHaveBeenCalledWith(anchors.docx)
    const root = container.querySelector('[data-anchor-kind="docx"]')
    expect(root?.getAttribute('data-anchor-state')).toBe('deleted')
    expect(root?.querySelector('[data-action]')).toBeNull()
    expect(root?.querySelector('[data-testid="annotation-anchor-note"]')).toBeNull()
    const labelEl = root?.querySelector('[data-anchor-label]') as HTMLElement
    expect(labelEl.className).toContain('line-through')
  })

  it('labeled / added 态不得出现重新标注入口(canRelabel=false 时不给按钮)', () => {
    const labeled = render(<AnnotationAnchorLabel anchor={anchors.pdf} />)
    expect(labeled.container.querySelector('[data-action="relabel"]')).toBeNull()
    const added = render(<AnnotationAnchorLabel anchor={anchors.pdf} initialState="added" />)
    expect(added.container.querySelector('[data-action="relabel"]')).toBeNull()
  })

  it('initialState="added" 直接渲染已添加态', () => {
    const { container } = render(<AnnotationAnchorLabel anchor={anchors.pdf} initialState="added" />)
    expect(container.querySelector('[data-anchor-state="added"]')).not.toBeNull()
  })
})

describe('D91 词包覆盖(读真实词包,不 mock)', () => {
  const flat = (obj: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
    )

  const readNode = (locale: string, path: string[]): Record<string, unknown> => {
    const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
    let node: unknown = JSON.parse(raw)
    for (const seg of path) {
      node = (node as Record<string, unknown>)[seg]
      if (!node) throw new Error(`missing ai.${[...path].join('.')} in ${locale}.json`)
    }
    return node as Record<string, unknown>
  }

  it('五语言 ai.pane.annotationAnchors 键集完全一致(parity)', () => {
    const base = flat(readNode('zh-CN', ['ai', 'pane', 'annotationAnchors'])).sort()
    expect(base.length).toBeGreaterThan(0)
    for (const locale of LOCALES) {
      expect(flat(readNode(locale, ['ai', 'pane', 'annotationAnchors'])).sort(), locale).toEqual(base)
    }
  })

  it('词包标签 id 集齐(label 下 8 个键) + 顶层动作键全齐', () => {
    for (const locale of LOCALES) {
      const keys = flat(readNode(locale, ['ai', 'pane', 'annotationAnchors']))
      for (const key of keys) {
        if (key.startsWith('label.')) {
          expect(key, `${locale} ${key}`).toBe(`label.${key.slice('label.'.length)}`)
        }
      }
      expect(keys, `${locale}`).toContain('taskInputPlaceholder')
      expect(keys, `${locale}`).toContain('addToTask')
      expect(keys, `${locale}`).toContain('cancel')
      expect(keys, `${locale}`).toContain('delete')
      expect(keys, `${locale}`).toContain('relabel')
      expect(keys, `${locale}`).toContain('ariaLabel')
    }
  })

  it('防踩踏验证:ai.pane.voiceSubtitles 键在其他语言中仍存活(五语言非空)', () => {
    for (const locale of LOCALES) {
      const keys = flat(readNode(locale, ['ai', 'pane', 'voiceSubtitles']))
      expect(keys.length, locale).toBeGreaterThan(0)
      expect(keys, locale).toContain('muteAndShowSubtitles')
      expect(keys, locale).toContain('ariaLabel')
    }
  })

  it('zh-CN 关键文案与任务原文逐字一致(防自创措辞)', () => {
    const node = readNode('zh-CN', ['ai', 'pane', 'annotationAnchors']) as {
      label: Record<string, string>
      taskInputPlaceholder: string
      addToTask: string
      cancel: string
      delete: string
    }
    expect(node.label.pdf).toBe('PDF 第 {page} 页')
    expect(node.label.docx).toBe('文档第 {page} 页')
    expect(node.label.pptx).toBe('第 {slide} 张 · {element}')
    expect(node.label.pptxSlide).toBe('第 {slide} 张')
    expect(node.label.pptxComment).toBe('批注 {element}')
    expect(node.label.xlsx).toBe('{sheet} · {range}')
    expect(node.label.xlsxSheet).toBe('{sheet}')
    expect(node.label.xlsxSelected).toBe('已选择 {range}')
    expect(node.taskInputPlaceholder).toBe('描述希望 Agent 修改或检查的内容')
    expect(node.addToTask).toBe('添加到任务')
    expect(node.cancel).toBe('取消')
    expect(node.delete).toBe('删除')
  })

  it('ja 无简体中文残留(协作/概览/绑定/标注/任务/检查等须为和制或片假名表记)', () => {
    const raw = JSON.stringify(readNode('ja', ['ai', 'pane', 'annotationAnchors']))
    for (const banned of ['协作', '概览', '绑定', '标注', '注释锚点', '设置中']) {
      expect(raw.includes(banned), banned).toBe(false)
    }
    const node = readNode('ja', ['ai', 'pane', 'annotationAnchors']) as Record<string, string>
    expect(node.addToTask).toBe('タスクに追加')
    expect(node.cancel).toBe('キャンセル')
    expect(node.delete).toBe('削除')
  })

  it('所有语言取值非空(不得留空串占位)', () => {
    for (const locale of LOCALES) {
      const walk = (obj: Record<string, unknown>): void => {
        for (const value of Object.values(obj)) {
          if (value && typeof value === 'object') walk(value as Record<string, unknown>)
          else expect(typeof value === 'string' && value.trim().length > 0, `${locale}`).toBe(true)
        }
      }
      walk(readNode(locale, ['ai', 'pane', 'annotationAnchors']))
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
