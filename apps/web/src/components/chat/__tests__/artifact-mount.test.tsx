// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

/**
 * D76 挂载接线票(2026-09-24):徽章/导航/反向监听真正上产物面。
 *  ① 产物卡(ArtifactCanvas)渲染出轮次徽章 + 分型徽章(消息流 fixture 派生 turn);
 *  ② 点击轮次徽章触发 scrollIntoView + 既有 ihui:scroll-to-message 事件;
 *  ③ 面板侧 useArtifactTurnNav(真实 chat store fixture)在产物 turn 序列上
 *     前后移动 + 首末边界禁用 + onChange 联动跳消息与 focus-artifact 事件;
 *  ④ MessageList 容器侧 useFocusArtifactScroll 监听 ihui:focus-artifact →
 *     定位(scrollIntoView)+ 描边高亮对应产物卡。
 */

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string =>
      `T_${key}`,
  useLocale: () => 'zh-CN',
}))

import { ArtifactCanvas } from '../artifact-canvas'
import {
  ArtifactTurnNav,
  useArtifactTurnNav,
  useFocusArtifactScroll,
  emitFocusArtifact,
  tryFocusArtifactFromLink,
  FOCUS_ARTIFACT_EVENT,
  SCROLL_TO_MESSAGE_EVENT,
} from '@/components/media/artifact-turn-badge'
import { useChatStore, type ChatMessage } from '@/stores/chat'
// ArtifactCanvas 的 Copy/Fullscreen 按钮走 radix Tooltip → 单测透传 Provider(仓内惯例)
import { TooltipProvider } from '@/components/feedback'

function withProviders(ui: React.ReactElement): React.ReactElement {
  return <TooltipProvider>{ui}</TooltipProvider>
}

/** 最小 ChatMessage fixture(store 类型面,禁 any):cast 一次,字段按需给。 */
function msg(p: Record<string, unknown>): ChatMessage {
  return p as unknown as ChatMessage
}

const FIXTURE_MESSAGES: ChatMessage[] = [
  msg({ id: 'u1', role: 'user', content: '', createdAt: 1 }),
  msg({
    id: 'a1',
    role: 'assistant',
    content: '',
    createdAt: 2,
    toolCalls: [
      {
        id: 't1',
        toolName: 'summarize_artifacts',
        status: 'success',
        summary_data: { artifacts: [{ type: 'file', path: 'tmp/artifacts/报告.docx' }] },
      },
    ],
  }),
  msg({ id: 'a2', role: 'assistant', content: '', createdAt: 3 }),
  msg({
    id: 'a3',
    role: 'assistant',
    content: '',
    createdAt: 4,
    toolCalls: [
      {
        id: 't2',
        toolName: 'summarize_artifacts',
        status: 'success',
        summary_data: { artifacts: [{ type: 'file', path: 'tmp/artifacts/t.csv' }] },
      },
    ],
  }),
]

beforeEach(() => {
  useChatStore.setState({ messages: FIXTURE_MESSAGES })
})

afterEach(() => {
  cleanup()
  useChatStore.setState({ messages: [] })
})

// ------------------------------------------- ① 产物卡渲染轮次/分型徽章 ----

describe('ArtifactCanvas 挂载 D76 徽章(①)', () => {
  it('给定含产物的消息流 fixture,产物卡渲染出"第 N 轮"徽章(turn=assistant 序号)与分型徽章', () => {
    render(
      withProviders(
        <ArtifactCanvas
          artifact={{
            type: 'html',
            content: '<!DOCTYPE html><html><body>ok</body></html>',
            name: 'report.html',
          }}
          turnMessageId="a3"
        />,
      ),
    )
    const turnBadge = screen.getByTestId('artifact-turn-badge')
    // a3 是第 3 条 assistant(a1/a2/a3)→ 第 3 轮(不依赖该消息是否有 summary_data 产物)
    expect(turnBadge.getAttribute('data-turn')).toBe('3')
    expect(turnBadge.textContent).toContain('T_turn')
    // 分型徽章:html → 'file' 型(判据唯一真相源 = artifactKindOf)
    const kindBadge = screen.getByTestId('artifact-kind-badge')
    expect(kindBadge.getAttribute('data-kind')).toBe('file')
  })

  it('反向定位锚:根节点带 data-artifact-path(path 优先于 name)', () => {
    render(
      withProviders(
        <ArtifactCanvas
          artifact={{ type: 'html', content: '<html><body>x</body></html>', path: 'tmp/a.docx' }}
          turnMessageId="a1"
        />,
      ),
    )
    expect(screen.getByTestId('artifact-turn-badge').getAttribute('data-turn')).toBe('1')
    const card = document.querySelector('[data-artifact-path="tmp/a.docx"]')
    expect(card).not.toBeNull()
  })

  it('无 turnMessageId 时不渲染轮次徽章(既有调用方零破坏)', () => {
    render(withProviders(<ArtifactCanvas artifact={{ content: '<html><body>x</body></html>' }} />))
    expect(screen.queryByTestId('artifact-turn-badge')).toBeNull()
  })
})

// ------------------------------------------- ② 点击徽章跳回 origin 消息 ----

describe('ArtifactCanvas 轮次徽章点击跳转(②)', () => {
  it('点击徽章 scrollIntoView 到 [data-message-id] 锚点并派发既有事件', () => {
    render(
      withProviders(
        <div>
          <div data-message-id="a1" />
          <ArtifactCanvas
            artifact={{ content: '<html><body>x</body></html>', path: 'tmp/a.docx' }}
            turnMessageId="a1"
          />
        </div>,
      ),
    )
    const anchor = document.querySelector('[data-message-id="a1"]') as HTMLElement
    const scrollSpy = vi.spyOn(anchor, 'scrollIntoView').mockImplementation(() => {})
    const onScroll = vi.fn()
    window.addEventListener(SCROLL_TO_MESSAGE_EVENT, onScroll)
    fireEvent.click(screen.getByTestId('artifact-turn-badge'))
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(onScroll).toHaveBeenCalledTimes(1)
    window.removeEventListener(SCROLL_TO_MESSAGE_EVENT, onScroll)
    scrollSpy.mockRestore()
  })
})

// --------------------------- ③ 面板侧 TurnNav 在产物 turn 序列上移动 ----

function PanelNavHarness({ onChange }: { onChange?: (n: number) => void }) {
  const messages = useChatStore((s) => s.messages)
  const nav = useArtifactTurnNav(messages)
  return (
    <ArtifactTurnNav
      count={nav.count}
      activeIndex={nav.activeIndex}
      onChangeIndex={(n) => {
        nav.onChangeIndex(n)
        onChange?.(n)
      }}
    />
  )
}

describe('面板头部 ArtifactTurnNav × useArtifactTurnNav(③)', () => {
  it('产物 turn 序列上前后移动,首末边界禁用,onChange 联动滚消息 + focus-artifact', () => {
    // fixture:a1=第1轮(docx) a2=第2轮(无产物) a3=第3轮(csv) → 有产物 turn 序列 [a1, a3]
    render(
      withProviders(
        <div>
          <div data-message-id="a1" />
          <div data-message-id="a3" />
          <PanelNavHarness />
        </div>,
      ),
    )
    const back = screen.getByTestId('artifact-step-back') as HTMLButtonElement
    const forward = screen.getByTestId('artifact-step-forward') as HTMLButtonElement
    const position = screen.getByTestId('artifact-turn-position')

    // 边界:首个 → step-back 禁用
    expect(back.disabled).toBe(true)
    expect(forward.disabled).toBe(false)
    expect(position.textContent).toBe('1/2')

    const spyA1 = vi
      .spyOn(document.querySelector('[data-message-id="a1"]') as HTMLElement, 'scrollIntoView')
      .mockImplementation(() => {})
    const spyA3 = vi
      .spyOn(document.querySelector('[data-message-id="a3"]') as HTMLElement, 'scrollIntoView')
      .mockImplementation(() => {})
    const onFocus = vi.fn()
    window.addEventListener(FOCUS_ARTIFACT_EVENT, onFocus)

    // forward:→ a3(无产物的 a2 被跳过),滚到 a3 + focus 该轮首个产物
    fireEvent.click(forward)
    expect(position.textContent).toBe('2/2')
    expect(forward.disabled).toBe(true)
    expect(spyA3).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    const detail = (onFocus.mock.calls[0]?.[0] as CustomEvent | undefined)?.detail as
      { path: string } | undefined
    expect(detail?.path).toBe('tmp/artifacts/t.csv')

    // back:→ a1
    fireEvent.click(back)
    expect(position.textContent).toBe('1/2')
    expect(spyA1).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })

    window.removeEventListener(FOCUS_ARTIFACT_EVENT, onFocus)
    spyA1.mockRestore()
    spyA3.mockRestore()
  })
})

// --------------------------- ④ 容器侧 ihui:focus-artifact 监听定位 ----

function FocusHarness() {
  const ref = React.useRef<HTMLDivElement>(null)
  useFocusArtifactScroll(ref)
  return (
    <div ref={ref}>
      <div data-artifact-path="tmp/artifacts/report.docx" data-testid="artifact-card" />
    </div>
  )
}

describe('useFocusArtifactScroll 反向监听(④)', () => {
  it('事件派发 → 容器定位对应产物卡(scrollIntoView + 描边高亮)', () => {
    render(<FocusHarness />)
    const card = screen.getByTestId('artifact-card')
    const scrollSpy = vi.spyOn(card, 'scrollIntoView').mockImplementation(() => {})
    emitFocusArtifact('tmp/artifacts/report.docx')
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(card.style.outline).toContain('solid')
    scrollSpy.mockRestore()
  })

  it('未知 path 不误定位;监听随容器卸载移除(无 dead dispatch)', () => {
    const { unmount } = render(<FocusHarness />)
    const card = screen.getByTestId('artifact-card')
    const scrollSpy = vi.spyOn(card, 'scrollIntoView').mockImplementation(() => {})
    emitFocusArtifact('tmp/other.xlsx')
    expect(scrollSpy).not.toHaveBeenCalled()
    // 卸载后再派发不抛错、不再触发
    unmount()
    expect(() => emitFocusArtifact('tmp/artifacts/report.docx')).not.toThrow()
    scrollSpy.mockRestore()
  })
})

// ------------- 残余①(2026-09-25):同轮多产物按产物 id 精确聚焦 ----------------
//
// 反向对照:本票前 useArtifactTurnNav **没有** focusArtifact(只有 turn 粒度的
// onChangeIndex,反向聚焦恒取该轮 artifacts[0])。旧实现在这组用例上必红:
// 点击"第 2 个产物"要么 TypeError(API 不存在),要么 detail.path 落回第 1 个。

function FocusArtifactHarness() {
  const messages = useChatStore((s) => s.messages)
  const nav = useArtifactTurnNav(messages)
  return (
    <div>
      <button
        type="button"
        data-testid="focus-first"
        onClick={() => nav.focusArtifact('tmp/artifacts/one.docx')}
      />
      <button
        type="button"
        data-testid="focus-second"
        onClick={() => nav.focusArtifact('tmp/artifacts/two.csv')}
      />
      <button
        type="button"
        data-testid="focus-unknown"
        onClick={() => nav.focusArtifact('tmp/absent.pptx')}
      />
      <span data-testid="nav-position">{nav.activeIndex}</span>
    </div>
  )
}

describe('useArtifactTurnNav.focusArtifact 残余①(按产物 id 精确聚焦)', () => {
  it('同轮 2 产物分别点第 1 / 第 2 个 → 聚焦目标不同(不恒等于轮内首个),activeIndex 同步', () => {
    useChatStore.setState({
      messages: [
        msg({
          id: 'a1',
          role: 'assistant',
          content: '',
          createdAt: 1,
          toolCalls: [
            {
              id: 't1',
              toolName: 'summarize_artifacts',
              status: 'success',
              summary_data: {
                artifacts: [
                  { type: 'file', path: 'tmp/artifacts/one.docx' },
                  { type: 'file', path: 'tmp/artifacts/two.csv' },
                ],
              },
            },
          ],
        }),
        msg({
          id: 'a2',
          role: 'assistant',
          content: '',
          createdAt: 2,
          toolCalls: [
            {
              id: 't2',
              toolName: 'summarize_artifacts',
              status: 'success',
              summary_data: { artifacts: [{ type: 'file', path: 'tmp/deck.pptx' }] },
            },
          ],
        }),
      ],
    })
    render(
      withProviders(
        <div>
          <div data-message-id="a1" />
          <div data-message-id="a2" />
          <FocusArtifactHarness />
        </div>,
      ),
    )
    const spyA1 = vi
      .spyOn(document.querySelector('[data-message-id="a1"]') as HTMLElement, 'scrollIntoView')
      .mockImplementation(() => {})
    const spyA2 = vi
      .spyOn(document.querySelector('[data-message-id="a2"]') as HTMLElement, 'scrollIntoView')
      .mockImplementation(() => {})
    const emitted: unknown[] = []
    const onFocus = (e: Event) => emitted.push((e as CustomEvent<{ path?: string }>).detail?.path)
    window.addEventListener(FOCUS_ARTIFACT_EVENT, onFocus)

    // 点第 2 个 → 聚焦的是它本身(旧实现唯一可表达的是轮内第 1 个 → 此断言必红)
    fireEvent.click(screen.getByTestId('focus-second'))
    // 点第 1 个 → 目标与上一步不同
    fireEvent.click(screen.getByTestId('focus-first'))
    // 未知产物 → 不派发(派发到空气防回归)
    fireEvent.click(screen.getByTestId('focus-unknown'))
    window.removeEventListener(FOCUS_ARTIFACT_EVENT, onFocus)

    expect(emitted).toEqual(['tmp/artifacts/two.csv', 'tmp/artifacts/one.docx'])
    // 两次都滚回同一 origin 消息(a1),activeIndex 随聚焦轮次落位(未知产物不动)
    expect(spyA1).toHaveBeenCalledTimes(2)
    expect(spyA2).not.toHaveBeenCalled()
    expect(screen.getByTestId('nav-position').textContent).toBe('0')
    spyA1.mockRestore()
    spyA2.mockRestore()
  })

  it('聚焦第 2 轮的产物 → 滚回第 2 轮消息且 detail 即被点锚点', () => {
    useChatStore.setState({
      messages: [
        msg({
          id: 'a1',
          role: 'assistant',
          content: '',
          createdAt: 1,
          toolCalls: [
            {
              id: 't1',
              toolName: 'summarize_artifacts',
              status: 'success',
              summary_data: { artifacts: [{ type: 'file', path: 'tmp/deck.pptx' }] },
            },
          ],
        }),
        msg({
          id: 'a2',
          role: 'assistant',
          content: '',
          createdAt: 2,
          toolCalls: [
            {
              id: 't2',
              toolName: 'summarize_artifacts',
              status: 'success',
              summary_data: {
                artifacts: [
                  { type: 'file', path: 'tmp/artifacts/one.docx' },
                  { type: 'file', path: 'tmp/artifacts/two.csv' },
                ],
              },
            },
          ],
        }),
      ],
    })
    render(
      withProviders(
        <div>
          <div data-message-id="a1" />
          <div data-message-id="a2" />
          <FocusArtifactHarness />
        </div>,
      ),
    )
    const spyA1 = vi
      .spyOn(document.querySelector('[data-message-id="a1"]') as HTMLElement, 'scrollIntoView')
      .mockImplementation(() => {})
    const spyA2 = vi
      .spyOn(document.querySelector('[data-message-id="a2"]') as HTMLElement, 'scrollIntoView')
      .mockImplementation(() => {})
    const onFocus = vi.fn()
    window.addEventListener(FOCUS_ARTIFACT_EVENT, onFocus)
    fireEvent.click(screen.getByTestId('focus-second'))
    window.removeEventListener(FOCUS_ARTIFACT_EVENT, onFocus)
    expect((onFocus.mock.calls[0]?.[0] as CustomEvent).detail?.path).toBe('tmp/artifacts/two.csv')
    expect(spyA2).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(spyA1).not.toHaveBeenCalled()
    expect(screen.getByTestId('nav-position').textContent).toBe('1')
    spyA1.mockRestore()
    spyA2.mockRestore()
  })
})

// ------------- 残余②(2026-09-25):链接发起端接管判据(通道级) ------------------

describe('tryFocusArtifactFromLink 残余②(有卡接管 / 无卡放行)', () => {
  it('页面上有同锚点产物卡 → 接管(true)+派发既有事件+监听端定位高亮', () => {
    render(<FocusHarness />)
    const card = screen.getByTestId('artifact-card')
    const scrollSpy = vi.spyOn(card, 'scrollIntoView').mockImplementation(() => {})
    expect(tryFocusArtifactFromLink('tmp/artifacts/report.docx')).toBe(true)
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(card.style.outline).toContain('solid')
    scrollSpy.mockRestore()
  })

  it('无对应卡 → false 且不派发(调用方保持原下载 / 打开面板行为)', () => {
    render(<FocusHarness />)
    const onFocus = vi.fn()
    window.addEventListener(FOCUS_ARTIFACT_EVENT, onFocus)
    expect(tryFocusArtifactFromLink('https://example.com/loose.docx')).toBe(false)
    expect(onFocus).not.toHaveBeenCalled()
    window.removeEventListener(FOCUS_ARTIFACT_EVENT, onFocus)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
