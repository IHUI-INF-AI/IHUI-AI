// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  addAnnotation,
  buildAnnotationContext,
  getAnnotations,
  locateAnnotation,
  readContainerText,
  removeAnnotation,
  selectionToAnchor,
  updateAnnotationComment,
  type Annotation,
} from '../annotations'

const CONV = 'conv-d87'
const MSG = 'msg-d87'

function seed(ann: Partial<Annotation> & Pick<Annotation, 'id' | 'messageId' | 'anchorText'>): Annotation {
  return {
    anchorPrefix: '',
    anchorSuffix: '',
    comment: '批注正文',
    lineCount: 1,
    createdAt: Date.now(),
    ...ann,
  }
}

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('locateAnnotation 定位算法', () => {
  it('anchorText 精确命中 → valid(跨刷新可定位)', () => {
    const text = 'AI 建议把变量改为 const 以提升可读性'
    const ann = seed({ id: 'a1', messageId: MSG, anchorText: '改为 const' })
    const loc = locateAnnotation(text, ann)
    expect(loc.state).toBe('valid')
    expect(loc.start).toBe(text.indexOf('改为 const'))
    expect(loc.end).toBe(text.indexOf('改为 const') + '改为 const'.length)
  })

  it('文本被编辑后 anchorText 消失 → invalid(失效态,不抛错)', () => {
    const ann = seed({ id: 'a1', messageId: MSG, anchorText: '改为 const', anchorPrefix: '建议把' })
    // 原文本
    expect(locateAnnotation('AI 建议把变量改为 const 以提升可读性', ann).state).toBe('valid')
    // 重新生成后的文本(锚点消失)
    const loc = locateAnnotation('AI 建议把变量换成 let 以提升可读性', ann)
    expect(loc.state).toBe('invalid')
  })

  it('anchorText 消失但前缀仍在 → invalid 且 start 指向原锚点估计位置', () => {
    const ann = seed({ id: 'a1', messageId: MSG, anchorText: '旧结论', anchorPrefix: '最终' })
    const text = '最终我们得出了新结论'
    const loc = locateAnnotation(text, ann)
    expect(loc.state).toBe('invalid')
    expect(loc.start).toBe(text.indexOf('最终') + '最终'.length)
  })
})

describe('selectionToAnchor 选区捕获 + 多行 lineCount', () => {
  it('单行选区映射为 anchorText + 前后缀指纹', () => {
    const container = document.createElement('div')
    container.innerHTML = '前缀文本 ABCDEF 后缀文本'
    document.body.appendChild(container)
    const node = container.firstChild as Text
    const sel = window.getSelection() as Selection
    const range = document.createRange()
    range.setStart(node, 5) // 'ABCDEF' 起点
    range.setEnd(node, 11) // 'ABCDEF' 终点
    sel.removeAllRanges()
    sel.addRange(range)
    const input = selectionToAnchor(container, sel, MSG)
    expect(input).not.toBeNull()
    expect(input!.anchorText).toBe('ABCDEF')
    expect(input!.anchorPrefix).toBe('前缀文本 ')
    expect(input!.anchorSuffix).toBe(' 后缀文本')
    expect(input!.lineCount).toBe(1)
    document.body.removeChild(container)
  })

  it('块级元素边界补 \\n,多行选区 lineCount > 1', () => {
    const container = document.createElement('div')
    container.innerHTML = '行一<div>行二</div>'
    document.body.appendChild(container)
    const { text } = readContainerText(container)
    expect(text).toBe('行一\n行二') // 块级边界补换行
    container.textContent = '甲\n乙' // 单文本节点含换行
    const node = container.firstChild as Text
    const sel = window.getSelection() as Selection
    const range = document.createRange()
    range.setStart(node, 0)
    range.setEnd(node, 3) // '甲\n乙'
    sel.removeAllRanges()
    sel.addRange(range)
    const input = selectionToAnchor(container, sel, MSG)
    expect(input!.anchorText).toBe('甲\n乙')
    expect(input!.lineCount).toBe(2)
    document.body.removeChild(container)
  })

  it('折叠选区 / 空文本 → 返回 null', () => {
    const container = document.createElement('div')
    container.textContent = 'hello'
    document.body.appendChild(container)
    const sel = window.getSelection() as Selection
    sel.removeAllRanges()
    expect(selectionToAnchor(container, sel, MSG)).toBeNull()
    document.body.removeChild(container)
  })
})

describe('localStorage 持久化 + 删除失败反馈', () => {
  it('新增 / 查询 / 编辑 / 删除 全链路', () => {
    const created = addAnnotation(CONV, {
      messageId: MSG,
      anchorText: '锚点',
      anchorPrefix: '前',
      anchorSuffix: '后',
      comment: '第一条',
      lineCount: 1,
    })
    expect(created).not.toBeNull()
    expect(getAnnotations(CONV, MSG)).toHaveLength(1)

    const ok = updateAnnotationComment(CONV, MSG, created!.id, '改后正文')
    expect(ok).toBe(true)
    expect(getAnnotations(CONV, MSG)[0]!.comment).toBe('改后正文')

    const removed = removeAnnotation(CONV, MSG, created!.id)
    expect(removed).toBe(true)
    expect(getAnnotations(CONV, MSG)).toHaveLength(0)
  })

  it('删除遇存储异常 → 返回 false(非静默),数据仍在', () => {
    const created = addAnnotation(CONV, {
      messageId: MSG,
      anchorText: '锚点',
      anchorPrefix: '前',
      anchorSuffix: '后',
      comment: '待删',
      lineCount: 1,
    })
    // 模拟存储写入失败(happy-dom 的 localStorage 实例方法,直接 spy 实例)
    const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    const result = removeAnnotation(CONV, MSG, created!.id)
    expect(result).toBe(false)
    // 旧数据仍在(localStorage 写入被拦截)
    expect(getAnnotations(CONV, MSG)).toHaveLength(1)
    setItemSpy.mockRestore()
  })

  it('addAnnotation 写入异常 → 返回 null', () => {
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    try {
      const created = addAnnotation(CONV, {
        messageId: MSG,
        anchorText: '锚点',
        anchorPrefix: '前',
        anchorSuffix: '后',
        comment: 'x',
        lineCount: 1,
      })
      expect(created).toBeNull()
    } finally {
      spy.mockRestore()
    }
  })
})

describe('buildAnnotationContext 上下文回流', () => {
  it('无批注返回空串', () => {
    expect(buildAnnotationContext(CONV, MSG)).toBe('')
  })

  it('有批注返回 <reply_annotation> 块,含条数摘要', () => {
    addAnnotation(CONV, {
      messageId: MSG,
      anchorText: '某段回复',
      anchorPrefix: '前',
      anchorSuffix: '后',
      comment: '这里要改',
      lineCount: 1,
    })
    const ctx = buildAnnotationContext(CONV, MSG)
    expect(ctx).toContain('<reply_annotation>')
    expect(ctx).toContain('关于此回复的批注：1 条')
    expect(ctx).toContain('这里要改')
    expect(ctx).toContain('</reply_annotation>')
  })
})
