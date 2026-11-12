// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D2 末帧守门(MarkdownStream 的 leading/trailing 节流)
//
// 三件事都是用户能直接看见的"文字少了/迟了",各有一例钉住:
// ① 最后两帧落进同一节流窗口且其后无帧 ⇒ 到期必须写**最后那一版**(旧实现写的是倒数第二版);
// ② 流结束时末帧**立刻**上屏,不再等一个节流窗口(此后不会再有下一帧来落盘);
// ③ 整体替换(切会话/回放/清空)不走节流 —— 它既非追加也不会有后续帧。
// 另有一例防回退:流式追加仍须走节流,不能退化成"整坨蹦"。
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import React from 'react'
import MarkdownStream from '../markdown-stream'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** 渲染层真正上屏的文本 —— 折叠/代码块等结构不影响 textContent 里是否含目标片段 */
function shown(container: HTMLElement): string {
  return container.textContent ?? ''
}

describe('MarkdownStream 末帧不丢', () => {
  it('最后两帧同窗口:到期写最后一版,不写倒数第二版', () => {
    const base = 'A'.repeat(40)
    const { container, rerender } = render(<MarkdownStream content={base} isStreaming />)
    expect(shown(container)).toContain(base)

    // 第一帧落在节流窗口内 ⇒ 挂 trailing timer
    act(() => {
      rerender(<MarkdownStream content={`${base}第一段`} isStreaming />)
    })
    // 第二帧(最后一帧)同窗口,且此后无帧
    act(() => {
      rerender(<MarkdownStream content={`${base}第一段末`} isStreaming />)
    })
    // timer 到期
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(shown(container)).toContain('第一段末')
  })

  it('流结束(isStreaming→false)时末帧立即上屏,无需再推进定时器', () => {
    const base = 'B'.repeat(40)
    const { container, rerender } = render(<MarkdownStream content={base} isStreaming />)
    act(() => {
      rerender(<MarkdownStream content={`${base}X`} isStreaming />)
    })
    act(() => {
      rerender(<MarkdownStream content={`${base}XY`} isStreaming={false} />)
    })
    // 不推进任何定时器
    expect(shown(container)).toContain('XY')
  })

  it('整体替换(切会话/清空)立即上屏,不排队等节流窗口', () => {
    const first = 'C'.repeat(200)
    const { container, rerender } = render(<MarkdownStream content={first} isStreaming />)
    // 先把 lastFlush 推到"刚刷过"的位置,确保后续走的是 trailing 分支
    act(() => {
      vi.advanceTimersByTime(5)
      rerender(<MarkdownStream content={`${first}C`} isStreaming />)
    })
    // 整体换成完全不同且更短的内容(非前缀延长)
    act(() => {
      rerender(<MarkdownStream content="全新会话正文" isStreaming />)
    })
    expect(shown(container)).toContain('全新会话正文')
    // 且必须已经不再显示旧内容
    expect(shown(container)).not.toContain('C'.repeat(200))
  })

  it('流式追加仍走节流:第一帧不立刻等于全量(防回退成整坨蹦)', () => {
    const base = 'D'.repeat(40)
    const { container, rerender } = render(<MarkdownStream content={base} isStreaming />)
    act(() => {
      rerender(<MarkdownStream content={`${base}追加内容`} isStreaming />)
    })
    // 刚 rerender 的这一刻(未推进定时器),trailing 分支尚未落盘
    expect(shown(container)).not.toContain('追加内容')
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(shown(container)).toContain('追加内容')
  })

  it('卸载后 trailing timer 到期不得触发 setState 告警', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const base = 'E'.repeat(40)
    const { rerender, unmount } = render(<MarkdownStream content={base} isStreaming />)
    act(() => {
      rerender(<MarkdownStream content={`${base}挂在 timer 里`} isStreaming />)
    })
    unmount()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
