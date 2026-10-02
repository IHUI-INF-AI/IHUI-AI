// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// G-843 / G-844 —— web 输入框 Enter 键序与输入法组合态双保险。
//
// 为什么要有这一份(缺陷形态,三条取证见交付报告):
//   web-input-core.tsx 的 textarea onKeyDown 原先「内部先吃 Enter(preventDefault + onSend),
//   外部 onKeyDown?.(e) 只在 else 分支调用」⇒ 上层 message-input.tsx 的 handleKeyDown 第一行
//   contextSelector.handleKeyDown(e) 对 Enter 结构上永不可达 —— `#` 上下文选择器开着且有匹配项时,
//   按 Enter 直接发消息而不是选中。
// 判序修法对齐上游 prompt-input-textarea.tsx:33-41:先透传 → 外部已 preventDefault 即 return →
// 内部才提交。于是 Enter 恰好被消费一次(不得"既选中又发送")。
//
// 组 A 在被改的组件本身上钉"外部否决权";组 B 用真实 useContextSelector + 真实 WebInputCore
// 复刻 message-input.tsx 的 handleKeyDown 接线(HEAD :825-835 与 :1240 逐字同形),
// 因为 message-input.tsx 此刻由另一枚代理持有(G-833),本票禁改,只能在 Harness 里复刻同一结构。
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'

import { WebInputCore, type WebInputCoreHandle } from '@/components/chat/web-input-core'
import { useContextSelector } from '@/hooks/use-context-selector'

// Tooltip 与本票判据无关,但它来自 @/components/feedback 整桶导出(会牵进 next 运行时依赖);
// 换成透明容器,断言面不受影响。
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode; content?: string }) => <>{children}</>,
}))

const ta = () => screen.getByRole('textbox') as HTMLTextAreaElement

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('组 A — WebInputCore 的 Enter 键序:外部处理器握有否决权(G-843)', () => {
  function Core({
    external,
    onSend,
  }: {
    external?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
    onSend: () => void
  }) {
    const [text, setText] = React.useState('草稿')
    return (
      <WebInputCore
        text={text}
        placeholder="请输入消息"
        isStreaming={false}
        t={(k) => k}
        onTextChange={setText}
        onSend={onSend}
        onStop={() => {}}
        onClear={() => setText('')}
        onKeyDown={external}
      />
    )
  }

  it('外部处理器对 Enter 调了 preventDefault ⇒ 内部不发送(选中语义赢过发送语义)', () => {
    const onSend = vi.fn()
    // 这一枚就是 contextSelector 有匹配项时的形态:消费 Enter 并 preventDefault
    const external = vi.fn((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter') e.preventDefault()
    })
    render(<Core external={external} onSend={onSend} />)

    fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false })

    // ① 外部真的收到了 Enter(排序证据:改前它只在 else 分支被调用,永远收不到)
    expect(external).toHaveBeenCalledTimes(1)
    expect(external.mock.calls[0]![0].key).toBe('Enter')
    // ② 内部让位:一次都没发
    expect(onSend).toHaveBeenCalledTimes(0)
  })

  it('外部处理器不 preventDefault ⇒ Enter 仍由内部提交,且恰好一次(不双重消费)', () => {
    const onSend = vi.fn()
    // 同步取样:React 17+ 事件不池化,断言时再读 e.defaultPrevented 已被内部提交改掉,
    // 只能在外部分支里当场记下"那时还没被消费"。
    const sawPreventedAtExternal: boolean[] = []
    const external = vi.fn((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      sawPreventedAtExternal.push(e.defaultPrevented)
    })
    render(<Core external={external} onSend={onSend} />)

    fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false })

    expect(onSend).toHaveBeenCalledTimes(1)
    // 排序证据:外部在内部提交之前就被调用,且到达外部那一刻事件尚未被 preventDefault
    // (若内部先吃 Enter,外部永远收不到 Enter —— 就是本票修掉的那一型)
    expect(external).toHaveBeenCalledTimes(1)
    expect(sawPreventedAtExternal).toEqual([false])
  })

  it('Shift+Enter 不发送,但外部仍被调用(不得回退成 else 分支才透传)', () => {
    const onSend = vi.fn()
    const external = vi.fn()
    render(<Core external={external} onSend={onSend} />)

    fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: true })

    expect(onSend).toHaveBeenCalledTimes(0)
    expect(external).toHaveBeenCalledTimes(1)
  })
})

describe('组 A2 — 输入法组合态双保险(G-844)', () => {
  function Core({ onSend }: { onSend: () => void }) {
    const [text, setText] = React.useState('')
    return (
      <WebInputCore
        text={text}
        placeholder="请输入消息"
        isStreaming={false}
        t={(k) => k}
        onTextChange={setText}
        onSend={onSend}
        onStop={() => {}}
        onClear={() => setText('')}
      />
    )
  }

  it('本地腿:compositionstart 之后即便事件不带 isComposing,Enter 也不发送', () => {
    const onSend = vi.fn()
    render(<Core onSend={onSend} />)

    fireEvent.compositionStart(ta())
    // 关键:这条 Enter 的 nativeEvent.isComposing 是 false —— 只有本地标志拦得住
    fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false, isComposing: false })
    expect(onSend).toHaveBeenCalledTimes(0)

    // 收尾后恢复正常
    fireEvent.compositionEnd(ta())
    fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false, isComposing: false })
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('事件腿:nativeEvent.isComposing 为 true 时 Enter 不发送(未触发 compositionstart 也拦得住)', () => {
    const onSend = vi.fn()
    render(<Core onSend={onSend} />)

    fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false, isComposing: true })
    expect(onSend).toHaveBeenCalledTimes(0)
  })
})

describe('组 B — 真实链路(useContextSelector × WebInputCore):有匹配项选中 / 无匹配项发送', () => {
  function Harness({ initialText }: { initialText: string }) {
    const [value, setValue] = React.useState(initialText)
    const inputCoreRef = React.useRef<WebInputCoreHandle>(null)
    // 计数必须是 state 而非 ref:两个反例里"发送成功"不产生任何 state 变更,
    // 用 ref + DOM 文本读会让面板永远停在首帧的 0(测的是渲染时机,不是行为)。
    const [sends, setSends] = React.useState(0)
    const [selections, setSelections] = React.useState(0)

    const contextSelector = useContextSelector({
      value,
      setValue,
      inputRef: inputCoreRef,
      onSelect: () => {
        setSelections((n) => n + 1)
      },
    })

    // 逐字复刻 message-input.tsx(G-816019 修后形态)的外部处理器结构:
    // Enter 提交支已删 —— 提交完全由 WebInputCore 内部 shouldSubmitOnEnter 双腿裁决,
    // 外部只留 contextSelector 拦截与 ↑↓/Shift+Tab/Esc(那些分支与本文件判据无关,故不列)。
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (contextSelector.handleKeyDown(e)) return
    }

    return (
      <div>
        <WebInputCore
          ref={inputCoreRef}
          text={value}
          placeholder="请输入消息"
          isStreaming={false}
          t={(k) => k}
          onTextChange={setValue}
          onSend={() => {
            setSends((n) => n + 1)
          }}
          onStop={() => {}}
          onClear={() => setValue('')}
          onChange={() => {}}
          onKeyDown={handleKeyDown}
          onPaste={() => {}}
        />
        <span data-testid="sends">{sends}</span>
        <span data-testid="selections">{selections}</span>
        <span data-testid="matches">{contextSelector.filtered.length}</span>
        <span data-testid="open">{String(contextSelector.open)}</span>
      </div>
    )
  }

  it('正例:`#fi` 开着且有匹配项时按 Enter ⇒ 选中 #File,一次都不发送', () => {
    render(<Harness initialText="#fi" />)
    // 前置:这一条确实"开着且有匹配项"(否则正反例是同一件事)
    expect(screen.getByTestId('open').textContent).toBe('true')
    expect(Number(screen.getByTestId('matches').textContent)).toBeGreaterThan(0)

    act(() => {
      fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false })
    })

    expect(screen.getByTestId('selections').textContent).toBe('1')
    expect(screen.getByTestId('sends').textContent).toBe('0')
    expect(ta().value).toBe('#File ')
  })

  it('反例:`#zz` 开着但无匹配项时按 Enter ⇒ 正常发送一次,不产生选中(hook 的 return false 分支)', () => {
    render(<Harness initialText="#zz" />)
    expect(screen.getByTestId('open').textContent).toBe('true')
    expect(screen.getByTestId('matches').textContent).toBe('0')

    act(() => {
      fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false })
    })

    expect(screen.getByTestId('sends').textContent).toBe('1')
    expect(screen.getByTestId('selections').textContent).toBe('0')
    expect(ta().value).toBe('#zz')
  })

  it('反例:无 `#` 触发段(选择器根本没开)时按 Enter ⇒ 正常发送一次', () => {
    render(<Harness initialText="帮我改一下这段代码" />)
    expect(screen.getByTestId('open').textContent).toBe('false')

    act(() => {
      fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false })
    })

    expect(screen.getByTestId('sends').textContent).toBe('1')
    expect(screen.getByTestId('selections').textContent).toBe('0')
    expect(ta().value).toBe('帮我改一下这段代码')
  })

  it('键盘导航仍可用:`#` 开着时 ArrowDown 移动高亮,不发送', () => {
    render(<Harness initialText="#" />)
    const before = Number(screen.getByTestId('matches').textContent)
    expect(before).toBeGreaterThan(1)

    act(() => {
      fireEvent.keyDown(ta(), { key: 'ArrowDown' })
    })
    act(() => {
      fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false })
    })

    expect(screen.getByTestId('sends').textContent).toBe('0')
    // 高亮下移后 Enter 选中的是第二项(#Folder),不是第一项
    expect(ta().value).toBe('#Folder ')
  })
})

describe('组 C — message-input 接线形态下的 IME 单腿对(G-816019)', () => {
  // 复刻 G-816019 修后 message-input.tsx 的真实接线:外部处理器无 Enter 提交支,
  // onSend 就是生产里那个 submit 出口(计数代替)。两条用例各置**一条** IME 腿 ——
  // 拆成单腿必翻红:若 shouldSubmitOnEnter 退回事件腿单腿,第一条红;退回本地腿单腿,第二条红。
  function Harness() {
    const [text, setText] = React.useState('正在打的中文')
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

  it('只置本地腿(compositionStart 已到、事件 isComposing=false)⇒ 不发送', () => {
    render(<Harness />)
    fireEvent.compositionStart(ta())
    fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false, isComposing: false })
    expect(Number(screen.getByTestId('sends').textContent)).toBe(0)
    // compositionEnd 之后同一形状的 Enter 恢复发送(证明拦截是腿在起作用,不是键序坏了)
    fireEvent.compositionEnd(ta())
    fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false, isComposing: false })
    expect(Number(screen.getByTestId('sends').textContent)).toBe(1)
  })

  it('只置事件腿(nativeEvent.isComposing=true、未触发 compositionStart)⇒ 不发送', () => {
    render(<Harness />)
    fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false, isComposing: true })
    expect(Number(screen.getByTestId('sends').textContent)).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
