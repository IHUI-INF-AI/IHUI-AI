// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * RichTextEditor chord 归属回归(2026-09-22)
 *
 * 全局注册表(use-global-shortcuts)在 **window** 上监听 keydown,本编辑器在 textarea 上
 * 自有 Ctrl+{B,I,K,1,2,3}。React 19 的事件挂在根容器上,早于 window,因此编辑器若不
 * stopPropagation,一次按键会"既插标题又切对话模式"两件事同时发生。
 * 本文件把该归属关系钉成断言:自有 chord 绝不到达 window,非自有 chord 仍照常到达。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { RichTextEditor } from '../src/components/publish/RichTextEditor'
import { TooltipProvider } from '@/components/feedback'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

describe('RichTextEditor — 自有 chord 不与全局注册表撞键', () => {
  let windowHits: string[] = []
  const onWindowKey = (e: KeyboardEvent) => {
    windowHits.push(e.key)
  }

  beforeEach(() => {
    windowHits = []
    window.addEventListener('keydown', onWindowKey)
  })
  afterEach(() => {
    window.removeEventListener('keydown', onWindowKey)
    cleanup()
  })

  const press = (key: string, opts: { shiftKey?: boolean } = {}) => {
    const el = document.querySelector('textarea') as HTMLTextAreaElement
    el.setSelectionRange(0, 0)
    fireEvent.keyDown(el, { key, ctrlKey: true, ...opts })
    return el
  }

  it.each(['b', 'i', 'k', '1', '2', '3'])(
    'Ctrl+%s 由编辑器消化:不到达 window 且 onChange 生效',
    (key) => {
      const onChange = vi.fn()
      render(
        <TooltipProvider>
          <RichTextEditor value="正文" onChange={onChange} />
        </TooltipProvider>,
      )
      press(key)
      expect(windowHits).toEqual([])
      expect(onChange).toHaveBeenCalledTimes(1)
    },
  )

  it('Ctrl+Shift+K(行内代码)同样截断冒泡', () => {
    const onChange = vi.fn()
    render(
      <TooltipProvider>
        <RichTextEditor value="正文" onChange={onChange} />
      </TooltipProvider>,
    )
    press('k', { shiftKey: true })
    expect(windowHits).toEqual([])
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('非自有 chord(Ctrl+P 搜索)仍冒泡到 window —— 不是无差别截断', () => {
    const onChange = vi.fn()
    render(
      <TooltipProvider>
        <RichTextEditor value="正文" onChange={onChange} />
      </TooltipProvider>,
    )
    press('p')
    expect(windowHits).toEqual(['p'])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('裸键(无 Ctrl)不进入自有分支,也不截断', () => {
    const onChange = vi.fn()
    render(
      <TooltipProvider>
        <RichTextEditor value="正文" onChange={onChange} />
      </TooltipProvider>,
    )
    const el = document.querySelector('textarea') as HTMLTextAreaElement
    fireEvent.keyDown(el, { key: '1' })
    expect(windowHits).toEqual(['1'])
    expect(onChange).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
