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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
  // initialText 默认给**有内容**的草稿:本组要验的是 IME 三条腿,不是空内容那一档。
  // G-815941 起"空内容不提交"也是判据的一档,初值若为空,三条腿的用例会被那一档盖住
  // (Enter 无论组合与否都不发送,IME 腿拆掉也照样绿)。空内容那一档由下一条用例单独验。
  function Core({ onSend, initialText = '草稿' }: { onSend: () => void; initialText?: string }) {
    const [text, setText] = React.useState(initialText)
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

    // G-815941 腿三:compositionend 之后**第一次** Enter 仍不得提交 —— 部分引擎里"确认候选词"
    // 的那一次 Enter 排在 compositionend 之后,此刻本地腿已翻回 false、事件腿也是 false,
    // 两腿并集放行 ⇒ 半截中文被当正文发出去。这是本票的关键漏点。
    fireEvent.compositionEnd(ta())
    fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false, isComposing: false })
    expect(onSend).toHaveBeenCalledTimes(0)

    // 闩锁只消费一次:再按一次 Enter(用户真正想发)⇒ 恢复正常
    fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false, isComposing: false })
    expect(onSend).toHaveBeenCalledTimes(1)
  })

  it('G-815941:空内容 + 无 IME 腿 ⇒ 不提交(空命令应落回 awaiting/空态,不发明塞消息)', () => {
    const onSend = vi.fn()
    render(<Core onSend={onSend} initialText="" />)
    expect(ta().value).toBe('')

    fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false, isComposing: false })
    expect(onSend).toHaveBeenCalledTimes(0)
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
    // G-815941 腿三:compositionEnd 之后第一次 Enter 也不发送(确认候选词那一次),
    // 第二次才恢复 —— 证明拦截是腿在起作用,不是键序坏了。
    fireEvent.compositionEnd(ta())
    fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false, isComposing: false })
    expect(Number(screen.getByTestId('sends').textContent)).toBe(0)
    fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false, isComposing: false })
    expect(Number(screen.getByTestId('sends').textContent)).toBe(1)
  })

  it('只置事件腿(nativeEvent.isComposing=true、未触发 compositionStart)⇒ 不发送', () => {
    render(<Harness />)
    fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false, isComposing: true })
    expect(Number(screen.getByTestId('sends').textContent)).toBe(0)
  })
})

// G-862 —— 守卫必须排在 contextSelector **之前**。
// 本组分两层,两层都必要:
//  (1) 组 D 组件级:Harness 复刻生产的两行判序,用 withGuardFirst 显式给出"在前/在后"两序,
//      证明这一型缺陷**有可观测差异**(否则改对了也无从分辨)。
//  (2) 组 F 源码形状级:直接读 message-input.tsx 逐行量"守卫行号 < contextSelector 行号"。
//      只做(1)的话,把生产文件改回错位序测试照样全绿 —— Harness 复刻的那份不是被改的那份。
//      (2)才是真正锁住生产落点的那一层,判据就是票面说的"顺序"。
describe('组 D — G-862 组合守卫必须先于 contextSelector', () => {
  function Harness({
    initialText,
    withGuardFirst,
  }: {
    initialText: string
    withGuardFirst: boolean
  }) {
    const [value, setValue] = React.useState(initialText)
    const inputCoreRef = React.useRef<WebInputCoreHandle>(null)
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, localComposing = false) => {
      if (withGuardFirst) {
        // 正确序(G-862 落地形态):守卫在前,组合期整段键盘交还输入法
        if (e.nativeEvent.isComposing || localComposing) return
        if (contextSelector.handleKeyDown(e)) return
      } else {
        // 变异序:守卫在后 —— 这正是本票修掉的那一型(第一行先被面板吃掉)
        if (contextSelector.handleKeyDown(e)) return
        if (e.nativeEvent.isComposing || localComposing) return
      }
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
      </div>
    )
  }

  // 正例(事件腿):票面点名的那一条 —— 组合态 + 面板打开且有匹配项 + Enter ⇒ 既不发送也不选中
  it('正例(事件腿):组合态 + 面板有匹配项 + Enter ⇒ 既不发送也不选中', () => {
    render(<Harness initialText="#fi" withGuardFirst />)
    // 前置:面板确实开着且有匹配项(否则正反例是同一件事)
    expect(Number(screen.getByTestId('matches').textContent)).toBeGreaterThan(0)

    act(() => {
      fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false, isComposing: true })
    })

    expect(screen.getByTestId('selections').textContent).toBe('0')
    expect(screen.getByTestId('sends').textContent).toBe('0')
    // 草稿逐字不变 = 没被"选中"改写
    expect(ta().value).toBe('#fi')
  })

  // 正例(本地腿):事件腿为 false、只有 compositionStart 撑起本地腿 ⇒ 同样不许消费。
  // 只测事件腿的话,把守卫写成单腿也能全绿 —— 这一条就是拆腿会翻红的那一格。
  it('正例(本地腿):只有 compositionStart 撑起本地腿、事件腿为 false ⇒ 既不发送也不选中', () => {
    render(<Harness initialText="#fi" withGuardFirst />)
    expect(Number(screen.getByTestId('matches').textContent)).toBeGreaterThan(0)

    act(() => {
      fireEvent.compositionStart(ta())
    })
    act(() => {
      fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false, isComposing: false })
    })

    expect(screen.getByTestId('selections').textContent).toBe('0')
    expect(screen.getByTestId('sends').textContent).toBe('0')
    expect(ta().value).toBe('#fi')
  })

  // 反例:非组合期同一形状的 Enter 必须照常被面板消费(守卫不得改成"永不触发")
  it('反例:非组合期 + 面板有匹配项 + Enter ⇒ 照常选中(守卫不是永不触发)', () => {
    render(<Harness initialText="#fi" withGuardFirst />)
    expect(Number(screen.getByTestId('matches').textContent)).toBeGreaterThan(0)

    // 组合结束后两条腿都清 ⇒ 同一形状的 Enter 必须恢复消费
    act(() => {
      fireEvent.compositionStart(ta())
    })
    act(() => {
      fireEvent.compositionEnd(ta())
    })
    act(() => {
      fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false, isComposing: false })
    })

    expect(screen.getByTestId('selections').textContent).toBe('1')
    expect(screen.getByTestId('sends').textContent).toBe('0')
    expect(ta().value).toBe('#File ')
  })

  // 反例的另一半:守卫只拦组合期,不拦非组合期的面板键盘导航(ArrowDown 仍移动高亮)
  it('反例:守卫只拦组合期,不拦非组合期的面板键盘导航(ArrowDown 仍移动高亮)', () => {
    render(<Harness initialText="#" withGuardFirst />)
    expect(Number(screen.getByTestId('matches').textContent)).toBeGreaterThan(1)

    act(() => {
      fireEvent.keyDown(ta(), { key: 'ArrowDown' })
    })
    act(() => {
      fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false, isComposing: false })
    })

    // 落到第二项(#Folder)而不是第一项 ⇒ ArrowDown 没被守卫误吞
    expect(ta().value).toBe('#Folder ')
    expect(screen.getByTestId('sends').textContent).toBe('0')
  })

  // 变异取证(在用例内):守卫退到 contextSelector 之后 ⇒ 组合期 Enter 被面板吃掉。
  // 这一条把"错位确实产生可观测差异"钉成常驻用例,而不是只靠人工跑一次变异。
  it('变异对照(守卫退到 contextSelector 之后):组合期 Enter 被面板吃掉 ⇒ 用例本身能分辨这一型', () => {
    render(<Harness initialText="#fi" withGuardFirst={false} />)
    expect(Number(screen.getByTestId('matches').textContent)).toBeGreaterThan(0)

    act(() => {
      fireEvent.keyDown(ta(), { key: 'Enter', shiftKey: false, isComposing: true })
    })

    // 错位序的可观测后果:面板消费了组合期的 Enter ⇒ 选中了(这正是票面描述的缺陷形态)
    expect(screen.getByTestId('selections').textContent).toBe('1')
    expect(ta().value).toBe('#File ')
  })
})

// G-845 —— 空输入框上按 Backspace 删最后一个附件。
// 判据与消费在 WebInputCore 的 onKeyDown(单档),附件清单与 remove 出口由上层传进来
// (生产是 use-message-references 的 references/removeReference);本组用受控 state 复刻那份接线。
describe('组 E — G-845 空输入框 Backspace 删最后一个附件', () => {
  function Harness({
    initialText = '',
    fileNames = [] as string[],
  }: {
    initialText?: string
    fileNames?: string[]
  }) {
    const [text, setText] = React.useState(initialText)
    // 附件清单用 state 而非 ref:删除必须产生一次可见渲染,否则测不到"附件没了"
    const [attachments, setAttachments] = React.useState(fileNames)
    const [sends, setSends] = React.useState(0)

    return (
      <div>
        <WebInputCore
          text={text}
          placeholder="请输入消息"
          isStreaming={false}
          t={(k) => k}
          onTextChange={setText}
          onSend={() => {
            setSends((n) => n + 1)
          }}
          onStop={() => {}}
          onClear={() => setText('')}
          onRemoveLastAttachment={() => {
            // 与生产同语义:摘掉最后一个;没有可摘的返回 false = 不消费这一下
            if (attachments.length === 0) return false
            setAttachments((prev) => prev.slice(0, -1))
            return true
          }}
        />
        <span data-testid="attachments">{attachments.join(',')}</span>
        <span data-testid="sends">{sends}</span>
      </div>
    )
  }

  // 正例:票面点名的那一条
  it('正例:有 1 个附件且文本为空 ⇒ Backspace 移除该附件,且不清空输入', () => {
    render(<Harness fileNames={['a.png']} />)
    expect(screen.getByTestId('attachments').textContent).toBe('a.png')

    const ev = new KeyboardEvent('keydown', {
      key: 'Backspace',
      bubbles: true,
      cancelable: true,
    })
    act(() => {
      ta().dispatchEvent(ev)
    })

    expect(screen.getByTestId('attachments').textContent).toBe('')
    // 与两条反例成对:这一档成立时必须真的把这一一下消费掉 —— 不 preventDefault 就等于
    // 一边摘附件、一边让浏览器顺手删字符(交还默认语义),那仍是 bug 而不是"没行为"。
    expect(ev.defaultPrevented).toBe(true)
    // 输入框保持原样(空),且绝不触发发送
    expect(ta().value).toBe('')
    expect(screen.getByTestId('sends').textContent).toBe('0')
  })

  it('正例:多个附件时只删最后一个,前面的不动', () => {
    render(<Harness fileNames={['a.png', 'b.pdf']} />)

    act(() => {
      fireEvent.keyDown(ta(), { key: 'Backspace' })
    })

    expect(screen.getByTestId('attachments').textContent).toBe('a.png')
  })

  // 反例 ①:文本非空 ⇒ Backspace 属于删字符,绝不能顺手删附件
  it('反例:文本非空时 Backspace 只删字符,不得删附件', () => {
    render(<Harness initialText="草稿" fileNames={['a.png']} />)

    const ev = new KeyboardEvent('keydown', {
      key: 'Backspace',
      bubbles: true,
      cancelable: true,
    })
    act(() => {
      ta().dispatchEvent(ev)
    })

    expect(screen.getByTestId('attachments').textContent).toBe('a.png')
    // 未被 preventDefault ⇒ 这一档没成立,键交还文本编辑
    expect(ev.defaultPrevented).toBe(false)
    expect(screen.getByTestId('sends').textContent).toBe('0')
  })

  // 反例 ②:没有附件 ⇒ 这一档不成立,键完全交还
  it('反例:无附件时 Backspace 不被消费(不 preventDefault)', () => {
    render(<Harness fileNames={[]} />)

    const ev = new KeyboardEvent('keydown', {
      key: 'Backspace',
      bubbles: true,
      cancelable: true,
    })
    act(() => {
      ta().dispatchEvent(ev)
    })

    expect(ev.defaultPrevented).toBe(false)
    expect(screen.getByTestId('attachments').textContent).toBe('')
  })

  // 反例 ③:组合期的 Backspace 归输入法,不得删附件(事件腿与本地腿各一次)
  it('反例:IME 组合期的 Backspace 不得删附件(事件腿与本地腿各一条)', () => {
    const first = render(<Harness fileNames={['a.png']} />)
    act(() => {
      fireEvent.keyDown(ta(), { key: 'Backspace', isComposing: true })
    })
    expect(screen.getByTestId('attachments').textContent).toBe('a.png')
    first.unmount()

    render(<Harness fileNames={['a.png']} />)
    act(() => {
      fireEvent.compositionStart(ta())
    })
    act(() => {
      fireEvent.keyDown(ta(), { key: 'Backspace', isComposing: false })
    })
    expect(screen.getByTestId('attachments').textContent).toBe('a.png')
  })

  // 反例 ④:Backspace 不是 Enter ⇒ 这一档绝不能顺手把消息发出去
  it('反例:Backspace 绝不触发发送(不与 Enter 档串味)', () => {
    render(<Harness fileNames={['a.png']} />)

    act(() => {
      fireEvent.keyDown(ta(), { key: 'Backspace' })
    })

    expect(screen.getByTestId('sends').textContent).toBe('0')
  })
})

// G-862 落点锁 —— 直接量 message-input.tsx 生产源里那两行的先后。
// 为什么必须读源码而不是只靠组件级:Harness 复刻的是"判序的形状",改生产文件不影响 Harness,
// 只锁组件级的话,把守卫挪回 contextSelector 之后测试仍全绿(那正是本票的缺陷本身)。
// 判据与票面逐字同形:守卫行号必须 < contextSelector 行号。
describe('组 F — G-862 生产落点源码形状:守卫行号必须小于 contextSelector 行号', () => {
  // vitest 的 root 是 apps/web(见 vitest 配置),从 cwd 上溯定位生产文件。
  // 不用 import.meta.url —— 本仓 vitest 下它不是 file: 方案,fileURLToPath 会抛。
  const MESSAGE_INPUT_PATH = resolve(process.cwd(), 'src/components/chat/message-input.tsx')

  it('message-input.tsx 的 IME 守卫排在 contextSelector.handleKeyDown 之前', () => {
    const src = readFileSync(MESSAGE_INPUT_PATH, 'utf8')
    const lines = src.split('\n')

    // 只认 handleKeyDown 函数体以内的那一处 contextSelector 调用,避免误量到别的文件片段
    const handlerStart = lines.findIndex((l) =>
      l.includes('const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>'),
    )
    expect(handlerStart).toBeGreaterThan(-1)

    const guardIdx = lines.findIndex(
      (l, i) =>
        i > handlerStart && l.includes('if (e.nativeEvent.isComposing || localComposing) return'),
    )
    const selectorIdx = lines.findIndex(
      (l, i) => i > handlerStart && l.includes('if (contextSelector.handleKeyDown(e)) return'),
    )

    expect(guardIdx).toBeGreaterThan(-1)
    expect(selectorIdx).toBeGreaterThan(-1)
    // 票面判据:守卫在前。移回错位序 ⇒ 本条立刻翻红(变异取证见交付报告)
    expect(guardIdx).toBeLessThan(selectorIdx)
  })

  it('G-845 的附件回调取 references(用户附件)而非 allReferences(并了 agent 规则块)', () => {
    const src = readFileSync(MESSAGE_INPUT_PATH, 'utf8')
    // Backspace 删的是"最后一个附件";allReferences 里还并了自动加载的 agent 规则块,
    // 那是工作区上下文、不是附件,用它会把规则块也摘掉。
    expect(src).toMatch(/const last = references\[references\.length - 1\]/)
    expect(src).not.toMatch(/const last = allReferences\[allReferences\.length - 1\]/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
