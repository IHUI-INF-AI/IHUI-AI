// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

import { UploadZone } from '../upload-zone'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// '@/components/common' 桶文件会连带加载 20+ 组件(SafeHtml/PWA 等),本测试只需 toast,整体隔离
vi.mock('@/components/common', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('lucide-react', () => ({
  UploadCloud: () => <span data-testid="upload-cloud" />,
  Loader2: () => <span data-testid="loader2" />,
}))

/**
 * G-815968 UploadZone dragleave 守卫(正反成对)。
 *
 * dragleave 在指针于区域内子元素间移动时也会触发;若无 relatedTarget 守卫,
 * 遮罩(dragging 态,体现为 border-brand-accent-deep + bg-primary/5)会被误闪掉。
 * ① relatedTarget 落在区域内 ⇒ dragging 保持 true;② 落在容器外 ⇒ 复位 false。
 */

const DRAGGING_CLASS = 'border-brand-accent-deep'
const IDLE_CLASS = 'border-input'

/**
 * happy-dom / jsdom 都没有 DragEvent 构造器,fireEvent.dragLeave 的 relatedTarget
 * 会被回退的 base Event 静默丢弃;React 合成事件的 relatedTarget 取值函数只读
 * nativeEvent.relatedTarget(非 undefined 即返回),故用 defineProperty 手工挂载。
 */
function dragLeaveWithRelatedTarget(zone: HTMLElement, relatedTarget: EventTarget | null) {
  const event = new Event('dragleave', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'relatedTarget', { value: relatedTarget })
  fireEvent(zone, event)
}

/** 渲染并 dragOver 进入 dragging 态(断言两个方向的类名翻转都真实生效) */
function renderDraggedZone() {
  render(<UploadZone onFiles={vi.fn()} />)
  const zone = screen.getByRole('button')
  expect(zone.className).toContain(IDLE_CLASS)
  fireEvent.dragOver(zone)
  expect(zone.className).toContain(DRAGGING_CLASS)
  return zone
}

describe('UploadZone — dragleave relatedTarget 守卫 (G-815968)', () => {
  afterEach(() => {
    cleanup()
  })

  it('① 指针移到区域内子元素触发 dragleave ⇒ 遮罩仍在(dragging 保持 true)', () => {
    const zone = renderDraggedZone()
    const child = screen.getByText('dragUpload') // 区域内的 <p>
    expect(zone.contains(child)).toBe(true)
    dragLeaveWithRelatedTarget(zone, child)
    expect(zone.className).toContain(DRAGGING_CLASS)
    expect(zone.className).not.toContain(IDLE_CLASS)
  })

  it('② 指针移出容器外触发 dragleave ⇒ 遮罩消失(dragging 复位 false)', () => {
    const zone = renderDraggedZone()
    const outside = document.createElement('div')
    document.body.appendChild(outside)
    expect(zone.contains(outside)).toBe(false)
    dragLeaveWithRelatedTarget(zone, outside)
    expect(zone.className).toContain(IDLE_CLASS)
    expect(zone.className).not.toContain(DRAGGING_CLASS)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
