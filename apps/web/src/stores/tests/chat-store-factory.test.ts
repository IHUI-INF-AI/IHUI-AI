// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票60(2026-10-18 立,第一切片):chat store 工厂化与多窗格实例隔离用例。
// 咬四件事:
//  ① 两份实例(messages/isStreaming/conversationId)互不串话 —— 单例缺陷的否定面;
//  ② 同一 paneId 恒取同一实例,不同 paneId 恒不同实例(懒建 + 复用);
//  ③ persist name 按实例隔离 —— 共用 key 的两实例会在 localStorage 上互相覆盖;
//  ④ 空 paneId 显式抛错(静默回落单例 = 两窗格悄悄共用一份状态,正是本票要消灭的形态)。

import { afterEach, describe, expect, it } from 'vitest'

import {
  chatPaneStoreCount,
  disposeChatStoreForPane,
  getChatStoreForPane,
  resetChatPaneStores,
} from '@/stores/chat-panes'
import { createChatStore, useChatStore } from '@/stores/chat'

afterEach(() => {
  resetChatPaneStores()
  window.localStorage.clear()
})

describe('createChatStore 工厂', () => {
  it('两份实例状态互不串话', () => {
    const a = createChatStore('ihui-chat-test-a')
    const b = createChatStore('ihui-chat-test-b')
    a.getState().setConversationId('conv-a')
    a.getState().setStreaming(true)
    b.getState().setConversationId('conv-b')
    expect(a.getState().conversationId).toBe('conv-a')
    expect(b.getState().conversationId).toBe('conv-b')
    expect(b.getState().isStreaming).toBe(false)
    expect(useChatStore.getState().conversationId).toBeNull()
  })

  it('addMessage 落在各自实例,默认单例不受影响', () => {
    const a = createChatStore('ihui-chat-test-a2')
    a.getState().setConversationId('conv-a')
    a.getState().addMessage({ role: 'user', content: 'hello-a' })
    expect(a.getState().messages).toHaveLength(1)
    expect(a.getState().messages[0]!.content).toBe('hello-a')
    expect(useChatStore.getState().messages).toHaveLength(0)
  })

  it('persist name 按实例隔离(写 A 不影响 B 的恢复源)', () => {
    const a = createChatStore('ihui-chat-test-pa')
    a.getState().setConversationId('conv-a')
    // zustand persist 写 localStorage 是同步的(ssrStorage 透传)
    expect(window.localStorage.getItem('ihui-chat-test-pa')).not.toBeNull()
    expect(window.localStorage.getItem('ihui-chat-test-pb')).toBeNull()
    createChatStore('ihui-chat-test-pb')
    expect(window.localStorage.getItem('ihui-chat-test-pb')).toBeNull()
  })
})

describe('getChatStoreForPane 注册表', () => {
  it('同一 paneId 恒同一实例,不同 paneId 恒不同实例', () => {
    const p1a = getChatStoreForPane('pane-1')
    const p1b = getChatStoreForPane('pane-1')
    const p2 = getChatStoreForPane('pane-2')
    expect(p1a).toBe(p1b)
    expect(p1a).not.toBe(p2)
    expect(chatPaneStoreCount()).toBe(2)
  })

  it('窗格实例与默认单例互相独立', () => {
    const p = getChatStoreForPane('pane-x')
    p.getState().setStreaming(true)
    expect(useChatStore.getState().isStreaming).toBe(false)
    expect(p).not.toBe(useChatStore)
  })

  it('dispose 后重取得到全新实例;持久化快照仍在 ⇒ 同名新实例恢复上一会话(特性语义)', () => {
    const p1 = getChatStoreForPane('pane-d')
    p1.getState().setConversationId('conv-d')
    disposeChatStoreForPane('pane-d')
    const p2 = getChatStoreForPane('pane-d')
    expect(p2).not.toBe(p1)
    // persist 按 name 恢复快照:重开窗格回到上次会话是特性而非串话
    // (要"关闭即忘"需 dispose 时连快照一起清 —— 待产品拍板,本切片不代决)
    expect(p2.getState().conversationId).toBe('conv-d')
  })

  it('空 paneId 抛错,不静默回落单例', () => {
    expect(() => getChatStoreForPane('')).toThrow(/paneId 不能为空/)
    expect(() => getChatStoreForPane('   ')).toThrow(/paneId 不能为空/)
    expect(chatPaneStoreCount()).toBe(0)
  })
})

// 票64(2026-10-18 立):AI 消息编辑并入版本族 sibling 行。咬四件事:
//  ① 族根补 siblingIndex=0 —— 不补则读投影判不出族,原版本与新版本同时渲染成两个气泡;
//  ② 新版本按族尾插入而非追加末尾 —— 追加会让激活版本跳到整段对话最下面;
//  ③ 同 id 重复并入幂等(双击保存/重放不产生第二行);
//  ④ 族根不在集合(分页切割)时退化为追加,不丢内容。
describe('mergeVersionMessage', () => {
  const versionRow = (id: string, content = `content-${id}`) => ({
    id,
    role: 'assistant' as const,
    content,
    createdAt: Date.now(),
  })

  it('族根补 siblingIndex=0,新版本紧跟族根而非追加末尾', () => {
    const store = createChatStore(`ihui-chat-test-vf-${Date.now()}-1`)
    store.getState().addMessage({ role: 'user', content: 'q' })
    const rootId = store.getState().addMessage({ role: 'assistant', content: 'a1' })
    store.getState().addMessage({ role: 'user', content: 'later' })

    store.getState().mergeVersionMessage(versionRow('v2'), rootId, 1)

    const list = store.getState().messages
    const root = list.find((m) => m.id === rootId)!
    expect(root.siblingIndex).toBe(0)
    expect(root.parentMessageId).toBeNull()
    const rootIdx = list.findIndex((m) => m.id === rootId)
    const v2 = list.find((m) => m.id === 'v2')!
    expect(list.findIndex((m) => m.id === 'v2')).toBe(rootIdx + 1)
    expect(v2.parentMessageId).toBe(rootId)
    expect(v2.siblingIndex).toBe(1)
  })

  it('已有 sibling 时新版本插在族尾(族根 → v2 → v3)', () => {
    const store = createChatStore(`ihui-chat-test-vf-${Date.now()}-2`)
    const rootId = store.getState().addMessage({ role: 'assistant', content: 'a1' })
    store.getState().addMessage({ role: 'user', content: 'later' })
    store.getState().mergeVersionMessage(versionRow('v2'), rootId, 1)
    store.getState().mergeVersionMessage(versionRow('v3'), rootId, 2)

    const ids = store.getState().messages.map((m) => m.id)
    const rootIdx = ids.indexOf(rootId)
    expect(ids.slice(rootIdx, rootIdx + 3)).toEqual([rootId, 'v2', 'v3'])
  })

  it('同一条新版本重复并入不产生第二行', () => {
    const store = createChatStore(`ihui-chat-test-vf-${Date.now()}-3`)
    const rootId = store.getState().addMessage({ role: 'assistant', content: 'a1' })
    store.getState().mergeVersionMessage(versionRow('v2'), rootId, 1)
    const before = store.getState().messages.length
    store.getState().mergeVersionMessage(versionRow('v2'), rootId, 1)
    expect(store.getState().messages.length).toBe(before)
    expect(store.getState().messages.filter((m) => m.id === 'v2')).toHaveLength(1)
  })

  it('族根不在集合时追加到末尾,不丢内容', () => {
    const store = createChatStore(`ihui-chat-test-vf-${Date.now()}-4`)
    store.getState().addMessage({ role: 'user', content: 'q' })
    store.getState().mergeVersionMessage(versionRow('orphan'), 'missing-root', 1)
    const list = store.getState().messages
    expect(list[list.length - 1]!.id).toBe('orphan')
    expect(list.find((m) => m.id === 'orphan')!.parentMessageId).toBe('missing-root')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
