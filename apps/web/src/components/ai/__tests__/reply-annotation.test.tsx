// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { ReplyAnnotationLayer } from '../reply-annotation'
import { addAnnotation, type Annotation } from '@/lib/annotations'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: { n?: number }) => {
    const map: Record<string, string> = {
      placeholder: '对这段回复提批注…',
      save: '保存',
      edit: '编辑注释',
      delete: '删除注释',
      deleteFailed: '无法删除注释',
      invalid: '目前无法编辑此批注',
      countSummary: `关于此回复的批注：${params?.n ?? 0} 条`,
      badge: '注释',
      lineUnit: '行',
      cancel: '取消',
    }
    return map[key] ?? key
  },
}))

const CONV = 'conv-test'
const MSG = 'msg-test'

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => cleanup())

function seedValid(): Annotation {
  return addAnnotation(CONV, {
    messageId: MSG,
    anchorText: '改为 const',
    anchorPrefix: '建议把',
    anchorSuffix: '以提升',
    comment: '这里要改',
    lineCount: 1,
  })!
}

function seedMissing(): Annotation {
  return addAnnotation(CONV, {
    messageId: MSG,
    anchorText: '已消失的锚点',
    anchorPrefix: '前',
    anchorSuffix: '后',
    comment: '失效批注',
    lineCount: 1,
  })!
}

function renderLayer(childrenText: string) {
  return render(
    <ReplyAnnotationLayer messageId={MSG} conversationId={CONV}>
      <div>{childrenText}</div>
    </ReplyAnnotationLayer>,
  )
}

describe('ReplyAnnotationLayer 批注边栏 + 锚定态', () => {
  it('锚点命中 → 显示有效标记,无失效提示(跨刷新重渲染仍命中)', () => {
    const ann = seedValid()
    renderLayer('AI 建议把变量改为 const 以提升可读性')
    const rail = screen.getByTestId('annotation-rail')
    expect(rail.textContent).toContain('关于此回复的批注：1 条')
    expect(screen.getByTestId(`annotation-item-${ann.id}`).textContent).toContain('这里要改')
    // 有效态:无失效提示
    expect(screen.queryByTestId(`annotation-invalid-${ann.id}`)).toBeNull()
  })

  it('文本变化后锚点消失 → 失效态(显示「目前无法编辑此批注」)', () => {
    const ann = seedMissing()
    renderLayer('AI 重新生成了完全不同的回复内容')
    expect(screen.getByTestId(`annotation-invalid-${ann.id}`).textContent).toBe(
      '目前无法编辑此批注',
    )
  })
})

describe('ReplyAnnotationLayer 删除 / 再编辑', () => {
  it('删除成功 → 列表清空', () => {
    const ann = seedValid()
    renderLayer('AI 建议把变量改为 const 以提升可读性')
    fireEvent.click(screen.getByTestId(`annotation-delete-${ann.id}`))
    expect(screen.queryByTestId('annotation-rail')).toBeNull()
  })

  it('删除遇存储异常 → 显示「无法删除注释」反馈(非静默)', () => {
    const ann = seedValid()
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    renderLayer('AI 建议把变量改为 const 以提升可读性')
    fireEvent.click(screen.getByTestId(`annotation-delete-${ann.id}`))
    expect(screen.getByTestId('annotation-delete-error').textContent).toBe('无法删除注释')
    // 数据仍在
    expect(screen.getByTestId(`annotation-item-${ann.id}`)).not.toBeNull()
    spy.mockRestore()
  })

  it('编辑保存 → 批注正文更新', () => {
    const ann = seedValid()
    renderLayer('AI 建议把变量改为 const 以提升可读性')
    fireEvent.click(screen.getByTestId(`annotation-edit-${ann.id}`))
    const input = screen.getByTestId(`annotation-edit-input-${ann.id}`) as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: '改成 let 更合适' } })
    fireEvent.click(screen.getByTestId(`annotation-edit-save-${ann.id}`))
    expect(screen.getByTestId(`annotation-item-${ann.id}`).textContent).toContain('改成 let 更合适')
  })
})
