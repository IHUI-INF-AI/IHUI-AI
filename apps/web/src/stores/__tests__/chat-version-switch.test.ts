// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票59(消息级版本切换 2/3)状态面用例(2026-10-22 立)。咬四件:
//  ① 切换态是可写的 rootId → messageId 映射,不做二次判族(判族只许一份);
//  ② 同值重复设置不换引用(MessageList 的 memo 依赖它,抖动=整列表重渲染);
//  ③ 新 sibling 入族 ⇒ 该族切换态必须清掉,否则用户点「重新生成」看不到新回复;
//  ④ clearMessages(会话域)一并清空 —— 消息 id 是会话局部坐标。
import { beforeEach, describe, expect, it } from 'vitest'

import { useChatStore, type ChatMessage } from '../chat'

const msg = (id: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  role: 'assistant',
  content: id,
  createdAt: 1,
  ...extra,
})

describe('票59 2/3:activeVersionByRoot', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], activeVersionByRoot: {} })
  })

  it('setActiveMessageVersion 写入 rootId → messageId', () => {
    useChatStore.getState().setActiveMessageVersion('root-a', 'v1')
    expect(useChatStore.getState().activeVersionByRoot).toEqual({ 'root-a': 'v1' })
  })

  it('同值重复设置不换引用(memo 稳定)', () => {
    useChatStore.getState().setActiveMessageVersion('root-a', 'v1')
    const first = useChatStore.getState().activeVersionByRoot
    useChatStore.getState().setActiveMessageVersion('root-a', 'v1')
    expect(useChatStore.getState().activeVersionByRoot).toBe(first)
  })

  it('mergeVersionMessage 清掉本族切换态,保留其他族', () => {
    useChatStore.setState({
      messages: [
        msg('root-a', { parentMessageId: null, siblingIndex: 0 }),
        msg('a-v1', { parentMessageId: 'root-a', siblingIndex: 1 }),
        msg('root-b', { parentMessageId: null, siblingIndex: 0 }),
        msg('b-v1', { parentMessageId: 'root-b', siblingIndex: 1 }),
      ],
      activeVersionByRoot: { 'root-a': 'root-a', 'root-b': 'root-b' },
    })
    useChatStore.getState().mergeVersionMessage(msg('a-v2'), 'root-a', 2)
    expect(useChatStore.getState().activeVersionByRoot).toEqual({ 'root-b': 'root-b' })
    // 新行仍按族尾插入(不跑到整段对话末尾)
    expect(useChatStore.getState().messages.map((m) => m.id)).toEqual([
      'root-a',
      'a-v1',
      'a-v2',
      'root-b',
      'b-v1',
    ])
  })

  it('clearMessages 清空切换态(消息 id 是会话局部坐标)', () => {
    useChatStore.getState().setActiveMessageVersion('root-a', 'v1')
    useChatStore.getState().clearMessages()
    expect(useChatStore.getState().activeVersionByRoot).toEqual({})
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
