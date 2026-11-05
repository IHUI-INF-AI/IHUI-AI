// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// A3 T7 换锚前置证明(A13–A15):15 锚矩阵里三条"换锚"必须在源码锚上真的可观测,
// 否则删掉锚点后测试仍绿,矩阵就是自欺。
import { createElement, type ReactNode } from 'react'
import { render } from '@testing-library/react'
import { Text } from 'react-native'
import { describe, expect, it } from 'vitest'

import { ChatScreen } from '../src/features/chat/ChatScreen'
import { ChatMessageList } from '../src/features/chat/ChatMessageList'
import type { ChatScreenMessage, TFunction } from '../src/types'

const t: TFunction = (key) => key

const noop = () => undefined
// ChatScreen 的必填端口走 assertRequiredPort,而 `() => undefined` 是它拉黑的空实现形态。
const onNavigate = (_url: string) => {
  /* 测试内不需要真跳转 */
}
const onToast = (_message: string) => {
  /* 测试内不需要真提示 */
}

function element(label: string): ReactNode {
  return createElement(Text, null, label)
}

describe('A13/A14 槽位顺序(statusSlot → queueSlot → 输入区)', () => {
  it('statusSlot 在 queueSlot 之前,且两者都在输入区之前(顺序与现状一致)', () => {
    const r = render(
      createElement(ChatScreen, {
        t,
        messages: [],
        inputText: '',
        isStreaming: false,
        models: [],
        model: '',
        pickerOpen: false,
        navItems: [],
        showHeader: false,
        showModelBar: false,
        showInput: false,
        onInputTextChange: noop,
        onSend: noop,
        onStop: noop,
        onModelChange: noop,
        onPickerOpenChange: noop,
        statusSlot: element('STATUS_SLOT'),
        queueSlot: element('QUEUE_SLOT'),
        inputSlot: element('INPUT_SLOT'),
        onNavigate,
        onToast,
      } as never),
    )
    const text = r.container.textContent ?? ''
    expect(text, 'Missing: statusSlot').toContain('STATUS_SLOT')
    expect(text, 'Missing: queueSlot').toContain('QUEUE_SLOT')
    expect(text, 'Missing: inputSlot').toContain('INPUT_SLOT')
    const statusAt = text.indexOf('STATUS_SLOT')
    const queueAt = text.indexOf('QUEUE_SLOT')
    const inputAt = text.indexOf('INPUT_SLOT')
    expect(statusAt, 'Missing: statusSlot 在 queueSlot 之前').toBeLessThan(queueAt)
    expect(queueAt, 'Missing: queueSlot 在输入区之前').toBeLessThan(inputAt)
  })
})

describe('A15 尾注按 item.id 挂在对应行之后', () => {
  it('tailNodes.get(assistant.id) 渲染在该条之后;锚不到行的尾注落列表尾', () => {
    const data: ChatScreenMessage[] = [
      { id: 'u1', role: 'user', content: 'USER_ROW' },
      { id: 'a1', role: 'assistant', content: 'ASSISTANT_ROW' },
    ]
    const tailNodes = new Map<string, ReactNode>([['a1', element('TAIL_AFTER_A1')]])
    const r = render(
      createElement(ChatMessageList, {
        t,
        data,
        renderItem: (item: ChatScreenMessage) => element(item.content),
        tailNodes,
        orphanTailNode: element('ORPHAN_TAIL'),
        showThinkingPlaceholder: false,
      } as never),
    )
    const text = r.container.textContent ?? ''
    expect(text, 'Missing: tailNodes?.get(item.id)').toContain('TAIL_AFTER_A1')
    expect(text, 'Missing: orphanTailNode').toContain('ORPHAN_TAIL')
    const assistAt = text.indexOf('ASSISTANT_ROW')
    const tailAt = text.indexOf('TAIL_AFTER_A1')
    expect(tailAt, 'Missing: tailNodes?.get(item.id) 在对应行之后').toBeGreaterThan(assistAt)
  })
})

describe('条尾锚阴性对照:尾注不得串到别的行', () => {
  it('tailNodes 只认 item.id,同节点不会挂到相邻行', () => {
    const data: ChatScreenMessage[] = [
      { id: 'u1', role: 'user', content: 'USER_ROW' },
      { id: 'a1', role: 'assistant', content: 'ASSISTANT_ROW' },
    ]
    const tail = element('TAIL_ONLY_ON_U1')
    const tailNodes = new Map<string, ReactNode>([['u1', tail]])
    const r = render(
      createElement(ChatMessageList, {
        t,
        data,
        renderItem: (item: ChatScreenMessage) => element(item.content),
        tailNodes,
        showThinkingPlaceholder: false,
      } as never),
    )
    const text = r.container.textContent ?? ''
    const userAt = text.indexOf('USER_ROW')
    const assistAt = text.indexOf('ASSISTANT_ROW')
    const tailAt = text.indexOf('TAIL_ONLY_ON_U1')
    expect(tailAt, 'Missing: tailNodes?.get(item.id)').toBeGreaterThan(userAt)
    expect(tailAt, 'tailNodes 必须锚在 u1 之前(不得串到 a1)').toBeLessThan(assistAt)
  })
})
