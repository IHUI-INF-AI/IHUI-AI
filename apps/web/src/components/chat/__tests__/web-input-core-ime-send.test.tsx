// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 2026-11-26 —— "中文输入后按 Enter 发不出去、界面无反应"的根治回归锁。
//
// 缺陷形态(线上实测):用中文输入法打完字,按 Enter 发不出去,再按一次才发。
// 根因:WebInputCore 的腿三原先等于 `latch.justEnded`(无条件)。空格/数字键选词上屏时
// compositionend 刚落地、又没被任何 keydown 消费过 ⇒ 紧接着用户按下的**真·发送 Enter**
// 被当成"确认候选词"吃掉,且完全静默。
//
// 现在腿三由"按键抬起(keyup)立刻清闩锁 + 有效期兜底"裁决。本文件的第 1、2 组是根治锁:
// 旧实现下它们必红(发送次数 0),因为旧实现只认"闩锁还没被 keydown 消费过"。
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'

import { WebInputCore } from '@/components/chat/web-input-core'

// Tooltip 来自 @/components/feedback 整桶导出(会牵进 next 运行时依赖),与本判据无关,换成透明容器。
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode; content?: string }) => <>{children}</>,
}))

const ta = () => screen.getByRole('textbox') as HTMLTextAreaElement

/** 真实等待:用来制造"远超闩锁有效期"的间隔(鼠标点选上屏那条路径没有 keyup 可用)。 */
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function Harness({ initialText = '帮我写个方案' }: { initialText?: string }) {
  const [text, setText] = React.useState(initialText)
  const [sends, setSends] = React.useState(0)
  return (
    <div>
      <WebInputCore
        text={text}
        placeholder="请输入消息"
        isStreaming={false}
        t={(k) => k}
        onTextChange={setText}
        onSend={() => setSends((n) => n + 1)}
        onStop={() => {}}
        onClear={() => setText('')}
      />
      <span data-testid="sends">{sends}</span>
    </div>
  )
}

const sends = () => Number(screen.getByTestId('sends').textContent)

describe('腿三根治:上屏后的发送 Enter 不得被吞', () => {
  it('【根治锁①】空格选词上屏:compositionend → 松开空格(keyup)→ 按 Enter ⇒ 一次就发送', () => {
    render(<Harness />)

    act(() => {
      fireEvent.compositionStart(ta())
    })
    // 选词那一下是空格,它发生在 compositionend **之前**,所以闩锁此刻还没被任何 keydown 消费
    act(() => {
      fireEvent.keyDown(ta(), { key: ' ', keyCode: 32, isComposing: true })
    })
    act(() => {
      fireEvent.compositionEnd(ta())
    })
    // 松开空格:这一次按键已经完整发生过了
    act(() => {
      fireEvent.keyUp(ta(), { key: ' ', keyCode: 32 })
    })

    act(() => {
      fireEvent.keyDown(ta(), { key: 'Enter', keyCode: 13, isComposing: false })
    })
    // 旧实现:0(这一下被当成"确认候选词"吃掉,用户看到的就是"按 Enter 没反应、要按第二次")
    expect(sends()).toBe(1)
  })

  it('【根治锁②】回车确认候选词:确认 Enter 被拦 → 松开 Enter(keyup)→ 发送 Enter 一次发出', () => {
    render(<Harness />)

    act(() => {
      fireEvent.compositionStart(ta())
    })
    // 确认候选词的那一次 Enter:事件腿仍为组合态 ⇒ 这一下必须被拦
    act(() => {
      fireEvent.keyDown(ta(), { key: 'Enter', keyCode: 229, isComposing: true })
    })
    act(() => {
      fireEvent.compositionEnd(ta())
    })
    expect(sends()).toBe(0)

    act(() => {
      fireEvent.keyUp(ta(), { key: 'Enter', keyCode: 229 })
    })
    act(() => {
      fireEvent.keyDown(ta(), { key: 'Enter', keyCode: 13, isComposing: false })
    })
    expect(sends()).toBe(1)
  })

  it('同一次按键(compositionend 与 Enter keydown 之间没有 keyup)⇒ 不发送,且只吃这一次', () => {
    render(<Harness />)

    act(() => {
      fireEvent.compositionStart(ta())
    })
    act(() => {
      fireEvent.compositionEnd(ta())
    })
    // 引擎把"确认候选词"的 Enter 排在 compositionend 之后,且这次按键还没抬起
    act(() => {
      fireEvent.keyDown(ta(), { key: 'Enter', keyCode: 13, isComposing: false })
    })
    expect(sends()).toBe(0)

    // 同一按键也绝不吃第二次:抬起后再按就是发消息
    act(() => {
      fireEvent.keyUp(ta(), { key: 'Enter', keyCode: 13 })
    })
    act(() => {
      fireEvent.keyDown(ta(), { key: 'Enter', keyCode: 13, isComposing: false })
    })
    expect(sends()).toBe(1)
  })

  it('鼠标点选候选词上屏(没有 keyup)⇒ 有效期过后按 Enter 一次发出', async () => {
    render(<Harness />)

    act(() => {
      fireEvent.compositionStart(ta())
    })
    act(() => {
      fireEvent.compositionEnd(ta())
    })

    // 鼠标点选上屏这条路径只有 compositionstart/end,没有 keyup 可等 —— 靠有效期兜底
    await wait(200)

    act(() => {
      fireEvent.keyDown(ta(), { key: 'Enter', keyCode: 13, isComposing: false })
    })
    expect(sends()).toBe(1)
  })

  it('腿四:keyCode 229 的 Enter 一律不发送(旧引擎 IME 哨兵)', () => {
    render(<Harness />)

    act(() => {
      fireEvent.keyDown(ta(), { key: 'Enter', keyCode: 229, isComposing: false })
    })
    expect(sends()).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
