// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-152:失败回复的「重试」取词逻辑(extension 端内纯函数)。
// 关键是**没有可重发的用户消息时不得给按钮** —— 空文案的重试点了只会静默无事发生。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  pickRetryTarget,
  planChatSyncSurfaceMerge,
} from '../entrypoints/sidepanel/pages/chat-send-utils'

const u = (content: string) => ({ role: 'user' as const, content })
const a = (content: string) => ({ role: 'assistant' as const, content })

describe('pickRetryTarget(G-152)', () => {
  it('无错误时一律不给重试', () => {
    expect(pickRetryTarget([u('你好'), a('')], false)).toBe('')
  })

  it('有错误时取最后一条非空用户消息', () => {
    expect(pickRetryTarget([u('第一问'), a('答'), u('第二问'), a('')], true)).toBe('第二问')
  })

  it('跳过空白用户消息', () => {
    expect(pickRetryTarget([u('有效问题'), a('答'), u('   '), a('')], true)).toBe('有效问题')
  })

  it('只有 assistant 消息时返回空串(不给死按钮)', () => {
    expect(pickRetryTarget([a('答')], true)).toBe('')
    expect(pickRetryTarget([], true)).toBe('')
  })
})

// G-20261114:扩展端 chat-sync 投影判据(帧判据在共享 store,这里只量最小变更集)。
describe('planChatSyncSurfaceMerge(多端同步投影)', () => {
  it('零变化 ⇒ null(调用方据此不得 setMessages,否则每帧重渲染)', () => {
    const local = [{ id: 'm1', role: 'assistant', content: '全文' }]
    expect(
      planChatSyncSurfaceMerge(local, [{ id: 'm1', role: 'assistant', content: '全文' }]),
    ).toBeNull()
  })

  it('同 id 就地更新不追加;content / reasoning 两维都判', () => {
    const local = [{ id: 'm1', role: 'assistant', content: '前' }]
    const plan = planChatSyncSurfaceMerge(local, [
      { id: 'm1', role: 'assistant', content: '前后', reasoning: '思考' },
    ])
    expect(plan?.updates).toEqual([{ index: 0, content: '前后', reasoning: '思考' }])
    expect(plan?.appends).toEqual([])
  })

  it('终态落到 update;不带 terminal 的后续 snapshot 不得清掉终态(契约 §4 粘性)', () => {
    const terminal = { rev: 0, reason: 'stop' } as const
    const local = [{ id: 'm1', role: 'assistant', content: '全文' }]
    const first = planChatSyncSurfaceMerge(local, [
      { id: 'm1', role: 'assistant', content: '全文', terminal },
    ])
    expect(first?.updates[0]?.terminal).toEqual(terminal)
    // 反向牙:同样内容但不带 terminal ⇒ 零变化。若实现把终态清成 undefined,
    // 这里就会误判出一条 update(另一端又回到「生成中」)。
    const after = [{ id: 'm1', role: 'assistant', content: '全文', terminal }]
    expect(
      planChatSyncSurfaceMerge(after, [{ id: 'm1', role: 'assistant', content: '全文' }]),
    ).toBeNull()
  })

  it('内容逐字相同的同角色本地行 ⇒ 判回声,不追加重复气泡', () => {
    const local = [{ id: 'local-1', role: 'assistant', content: '同一段回答' }]
    expect(
      planChatSyncSurfaceMerge(local, [
        { id: 'svr-1', role: 'assistant', content: '同一段回答' },
      ]),
    ).toBeNull()
  })

  it('真正的新消息 ⇒ 追加', () => {
    const plan = planChatSyncSurfaceMerge([], [
      { id: 'svr-2', role: 'assistant', content: '新回答' },
    ])
    expect(plan?.appends.map((s) => s.id)).toEqual(['svr-2'])
    expect(plan?.updates).toEqual([])
  })
})

// G-20261114:扩展端三层接线的源码对账。本机不跑扩展真机,用形状锁钉「真调用」
// 而不是「只定义了函数」—— 帧进 store 但页面零消费、订阅只写不挂,都是历史回归形态。
describe('ChatPage chat-sync 接线(形状锁)', () => {
  const PAGE = join(
    dirname(fileURLToPath(import.meta.url)),
    '../entrypoints/sidepanel/pages/ChatPage.tsx',
  )

  it('订阅 → 共享 store → 页级投影 → 卸载清理,四格都在组件体内真调用', () => {
    const src = readFileSync(PAGE, 'utf8')
    expect(src).toContain('subscribeChatSync(config, conversationId, (evt) => {')
    expect(src).toContain('chatSyncStore.applyEvent(evt.data as ChatSyncEvent)')
    expect(src).toContain('return () => sub.close()')
    expect(src).toContain('planChatSyncSurfaceMerge(prev, surfaces)')
    expect(src).toContain('return chatSyncStore.subscribe(project)')
  })

  it('生成端坐标与 metadata 上行同源(不再二次落库 assistant)', () => {
    const src = readFileSync(PAGE, 'utf8')
    expect(src).toContain('const assistantLocalId = crypto.randomUUID()')
    expect(src).toContain('metadata: { conversationId: cid, messageId: assistantLocalId }')
    // 反向牙:persistTurnMessage 仍服务 user 消息,但不得再拿 assistantLocalId 落第二行
    expect(src).not.toContain('persistTurnMessage(assistantLocalId')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
