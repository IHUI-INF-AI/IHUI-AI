// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D38 小程序端侧问队列宿主验收。
 *
 * 三条线各钉一件"会静默失效"的事:
 *  ① **队列演算**(纯动词):入队/编辑/撤回/重排/出队 —— 重排必须保持 W27 不变式
 *     (length 与元素集恒等),编辑不动 createdAt,出队恒取队首;
 *  ② **交互条渲染**:词包键全走 `t()`(渲染产物里不得出现任何汉字 ⇒ 禁硬编码中文),
 *     被拒动作**显式**给出"不能做什么 + 为什么不能"两串,steer 偏好必须渲染降级句;
 *  ③ **装车证明**:`pkg-ai/ai/chat.tsx` 必须真的挂上 `useSideQueue` 与 `QueueInteractionBar`
 *     —— 组件可以永远不被任何人 import(守门 64/70/115/138 同族:造好没装车等于没做),
 *     且流式中发送必须进队列而不是被丢弃。
 *
 * 取证边界(如实):本机无微信真机,本文件证的是**静态渲染输出**(renderToStaticMarkup)
 * 与源码结构,**不是**"真机已渲染"。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tarojs/components', () => {
  const make = (tag: string) => {
    const Comp = (props: Record<string, unknown>) => createElement(tag, props)
    Comp.displayName = `TaroStub_${tag}`
    return Comp
  }
  return { View: make('div'), Text: make('span'), Input: make('input') }
})

// 取词一律回显键:渲染产物里出现汉字 ⇒ 有人硬编码了文案(下面的 CJK 扫描会点名)
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => `«${key}»`,
    tList: () => [],
    locale: 'zh-CN',
    setLocale: () => {},
  }),
  useTt: () => (k: string, fb: string) => fb,
}))

vi.mock('@/components/LineIcon', () => ({
  default: (props: Record<string, unknown>) =>
    createElement('i', { 'data-icon': String(props.name ?? '') }),
}))

import {
  editQueueItem,
  enqueueItem,
  removeQueueItem,
  reorderQueueItems,
  takeHeadItem,
  type SideQueueItem,
} from '@/pkg-ai/ai/side-queue-host'
import QueueInteractionBar from '@/pkg-ai/ai/queue-interaction-bar'

const HERE = dirname(fileURLToPath(import.meta.url))
const CHAT_SOURCE = join(HERE, '../src/pkg-ai/ai/chat.tsx')
const BAR_SOURCE = join(HERE, '../src/pkg-ai/ai/queue-interaction-bar.tsx')
const HOST_SOURCE = join(HERE, '../src/pkg-ai/ai/side-queue-host.ts')

const item = (id: string, text: string, createdAt = 1_000): SideQueueItem => ({
  id,
  text,
  createdAt,
})

/** 渲染产物里是否含汉字(禁硬编码中文的判据:i18n 已 mock 成回显键) */
const CJK_RE = /[一-鿿]/

describe('D38 宿主:队列四动词的纯演算', () => {
  it('入队:追加到队尾;空白文本不入队(不得给"已排队"的假反馈)', () => {
    const { items, item: created } = enqueueItem([], '  第一条  ', (n) => `sq-${n}`, 1, 1_000)
    expect(created).toEqual({ id: 'sq-1', text: '第一条', createdAt: 1_000 })
    expect(items).toHaveLength(1)
    const blank = enqueueItem(items, '   ', (n) => `sq-${n}`, 2, 2_000)
    expect(blank.item).toBeNull()
    expect(blank.items).toBe(items) // 同一引用:调用方可据此跳过重渲染
  })

  it('编辑:只改目标项 text,createdAt 与其余项引用不动(W27 同不变式)', () => {
    const a = item('a', 'A', 111)
    const b = item('b', 'B', 222)
    const next = editQueueItem([a, b], 'a', ' A2 ')
    expect(next.map((q) => q.text)).toEqual(['A2', 'B'])
    expect(next[0]?.createdAt).toBe(111)
    expect(next[1]).toBe(b)
    // 空文本不得把队列项清空(编辑成空 = 没编辑)
    expect(editQueueItem([a, b], 'a', '  ')).toEqual([a, b])
  })

  it('撤回:移除目标项并返回文本(供调用方退回输入框),非目标项不受影响', () => {
    const a = item('a', 'A')
    const b = item('b', 'B')
    const res = removeQueueItem([a, b], 'a')
    expect(res.removedText).toBe('A')
    expect(res.items).toEqual([b])
    const miss = removeQueueItem([a, b], 'ghost')
    expect(miss.removedText).toBeNull()
    expect(miss.items).toEqual([a, b])
  })

  it('重排:先摘后插,length 与元素集恒等(不得打乱 W27 出队集合)', () => {
    const q = [item('a', 'A'), item('b', 'B'), item('c', 'C')]
    const next = reorderQueueItems(q, 2, 0)
    expect(next.map((x) => x.id)).toEqual(['c', 'a', 'b'])
    expect(next).toHaveLength(q.length)
    expect(new Set(next.map((x) => x.id))).toEqual(new Set(q.map((x) => x.id)))
    // 越界/同位 ⇒ 队列不动(同一引用)
    expect(reorderQueueItems(q, 1, 1)).toBe(q)
    expect(reorderQueueItems(q, -1, 0)).toBe(q)
  })

  it('出队:恒取队首;空队列 head 为 null 且队列不动', () => {
    const q = [item('a', 'A'), item('b', 'B')]
    const first = takeHeadItem(q)
    expect(first.head?.id).toBe('a')
    expect(first.rest.map((x) => x.id)).toEqual(['b'])
    const empty = takeHeadItem([])
    expect(empty.head).toBeNull()
    expect(empty.rest).toHaveLength(0)
  })
})

describe('D38 交互条:渲染面(词包全走 t(),被拒显式说因)', () => {
  const items = [item('a', 'AAA'), item('b', 'BBB')]

  it('队列空 ⇒ 返回 null,零占位', () => {
    const html = renderToStaticMarkup(
      createElement(QueueInteractionBar, { items: [], streaming: false, mode: 'queue' }),
    )
    expect(html).toBe('')
  })

  it('渲染产物零汉字(禁硬编码中文)且词包键来自 queueOps 命名空间', () => {
    const html = renderToStaticMarkup(
      createElement(QueueInteractionBar, { items, streaming: false, mode: 'queue' }),
    )
    expect(CJK_RE.test(html)).toBe(false)
    expect(html).toContain('«ai.pane.queueOps.undo»')
    expect(html).toContain('«ai.pane.queueOps.edit»')
    expect(html).toContain('«ai.pane.queueOps.interruptAndRun»')
    expect(html).toContain('«ai.pane.queueOps.mode.label»')
    // 队列项正文是用户文本(不是词包),必须原样上屏
    expect(html).toContain('AAA')
  })

  it('steer 偏好遇不支持插话的 Runtime ⇒ 显式渲染降级句(不得静默降级)', () => {
    const html = renderToStaticMarkup(
      createElement(QueueInteractionBar, { items, streaming: false, mode: 'steer' }),
    )
    expect(html).toContain('«ai.pane.queueOps.degraded.runtimeNoInterject»')
    const plain = renderToStaticMarkup(
      createElement(QueueInteractionBar, { items, streaming: false, mode: 'queue' }),
    )
    expect(plain).not.toContain('degraded.runtimeNoInterject')
  })
})

describe('D38 装车证明:chat.tsx 必须真的接上宿主与交互条', () => {
  const chat = readFileSync(CHAT_SOURCE, 'utf8')
  const bar = readFileSync(BAR_SOURCE, 'utf8')
  const host = readFileSync(HOST_SOURCE, 'utf8')

  it('chat.tsx 挂了 useSideQueue 与 <QueueInteractionBar />(造好没装车等于没做)', () => {
    expect(chat).toMatch(/useSideQueue\(/)
    expect(chat).toMatch(/<QueueInteractionBar/)
  })

  it('流式中发送 ⇒ 入队而不是丢弃(W27 预备消息优先规则)', () => {
    // 判据 = sendMessage 之前那道分支必须落到宿主入队;丢掉它,"排队"二字就名不副实。
    expect(chat).toMatch(/thinking[\s\S]{0,200}enqueue\(/)
  })

  it('流结束 ⇒ 出队队首补答(队列不会自己发消息)', () => {
    expect(chat).toMatch(/takeHead\(/)
    expect(chat).toMatch(/effectiveMode\(/)
  })

  it('端内不得自建第二套许可判定(判定一律引自 @ihui/shared)', () => {
    expect(bar).toMatch(/from '@ihui\/shared\/chat\/input-notices'/)
    expect(bar).toMatch(/from '@ihui\/shared\/chat\/queue-interactions'/)
    expect(bar).toMatch(/queueInteractionPerms\(/)
    expect(bar).toMatch(/interactionAllowed\(/)
    // 端内不得出现 canReorder/canUndo 的本地重算
    expect(bar).not.toMatch(/canReorder\s*:/)
    expect(host).toMatch(/reorderQueue\(|reorderQueueItems\(/)
  })
})
