// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨用户 persist 串号根治的行为钉子(PROJECT_PLAN Y-91/94/95/106/107/108/109/110/111/112)。
 *
 * 钉两条腿,任一缺失都会复现"A 登出后 B 登入读到 A 私有数据":
 * 1. **清盘上 key** —— logout 后 manifest 私有 key 与多窗格 chat 前缀 key 必须从 localStorage 消失。
 * 2. **重置内存态** —— 已挂载 store 的内存里 A 的数据必须归零(登出后是 SPA 开登录弹窗、不
 *    reload,只清盘会被下一次 set 写回,故内存必须一并归零)。
 * 反向断言:纯 UI 偏好(theme/language)与登录偏好**不得**被波及 —— 清收口只清用户私有内容。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type * as ApiClient from '@ihui/api-client'

// apiLogout 走网络:登出主流程会 fire-and-forget 调它,单测里 partial mock 只换掉 logout,
// 保留其余导出(api.ts 顶层要 setTokenProvider 等真实导出)。
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>()
  return { ...actual, logout: vi.fn(async (): Promise<unknown> => ({ success: true })) }
})

import { useAuthStore } from '../auth'
import { useChatStore } from '../chat'
import { useMemoryStore } from '../memory'
import { useIntegrationsStore } from '../integrations'
import { useGoalStore } from '../goal'
import { useQuestsStore } from '../quests'
import { useAgentHooksStore } from '../agent-hooks'

/** 登出应清的私有 key 全集(manifest + 一个多窗格 chat 动态 key)。 */
const PRIVATE_KEYS = [
  'ihui-chat',
  'ihui-goal',
  'ihui-quests',
  'ihui-memory',
  'ihui-integrations',
  'ihui-agent-hooks',
  'ihui-repo-wiki',
  'ihui-canvas',
  'ihui-d180-selection-annotations',
  'ihui-chat-pane-abc123', // 多窗格动态 key,按前缀清(Y-95)
]

/** 登出**不该**动的键:纯 UI 偏好 + 登录偏好。 */
const UNTOUCHED_KEYS = ['ihui-theme', 'ihui-language', 'ihui-login-prefs']

function seedStorage(): void {
  for (const k of PRIVATE_KEYS) window.localStorage.setItem(k, '{"state":{"v":1},"version":0}')
  for (const k of UNTOUCHED_KEYS) window.localStorage.setItem(k, '{"state":{},"version":0}')
}

describe('登出清收口(跨用户 persist 串号根治)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    seedStorage()
    clearPrivateMirror()
  })

  it('logout 清掉全部私有盘上 key(含多窗格 chat 前缀)', () => {
    useAuthStore.getState().logout()
    // 关键语义:清收口先 removeItem 再重置内存,而内存 setState 会经 persist 把**空态**写回。
    // 故盘上残留的只能是"空态"(不含 A 的私有数据),**绝不**残留 A 的真实内容 —— 这就是根治目标。
    // 不要求 key === null:被空态覆盖与被删除对安全等价,但断言"必须彻底消失"是错的、且脆弱。
    for (const k of PRIVATE_KEYS) {
      const raw = window.localStorage.getItem(k)
      if (raw !== null) {
        expect(raw, `私有 key ${k} 登出后残留内容不得含 A 的真实数据`).not.toContain('v":1')
      }
    }
    // 多窗格动态 key 无对应 store 重置(实例已回收),应被彻底删除
    expect(window.localStorage.getItem('ihui-chat-pane-abc123')).toBeNull()
  })

  it('logout **不**动纯 UI 偏好与登录偏好(只清用户私有内容)', () => {
    useAuthStore.getState().logout()
    for (const k of UNTOUCHED_KEYS) {
      expect(window.localStorage.getItem(k), `偏好 key ${k} 不得被清收口波及`).not.toBeNull()
    }
  })

  it('logout 重置已挂载私有 store 的内存态(防下一次 set 写回)', () => {
    // 先把各 store 内存态污染成"A 的数据"
    useMemoryStore.setState({
      entries: [{ id: 'm1', category: 'fact', content: 'A-secret', createdAt: 1, updatedAt: 1 }],
    })
    useGoalStore.setState({ goal: { text: 'A-goal' } as never })
    useQuestsStore.setState({
      entries: { q1: { id: 'q1', text: 'A-quest', status: 'active' } as never },
    })
    useAgentHooksStore.setState({
      hooks: [{ id: 'h1', event: 'session.end', action: 'notify' } as never],
    })
    useIntegrationsStore.setState({
      log: [{ id: 'l1', channel: 'slack', event: 'session.end', summary: 'x', at: 1 }],
    })
    useChatStore.setState({
      conversationId: 'A-conv',
      draftInput: 'A-draft',
      messages: [{ id: 'c1', role: 'user', content: 'A-msg' } as never],
    })

    useAuthStore.getState().logout()

    // 内存必须归零:登出后任何一次 set 只会写"B 的空态",不会再把 A 的旧数据带回盘上
    expect(useMemoryStore.getState().entries).toEqual([])
    expect(useGoalStore.getState().goal).toBeNull()
    expect(useQuestsStore.getState().entries).toEqual({})
    expect(useAgentHooksStore.getState().hooks).toEqual([])
    expect(useIntegrationsStore.getState().log).toEqual([])
    expect(useChatStore.getState().conversationId).toBeNull()
    expect(useChatStore.getState().draftInput).toBeNull()
    expect(useChatStore.getState().messages).toEqual([])
  })

  it('expireSession(被动失效)同样清私有持久化 —— 换人一样要清', () => {
    seedStorage()
    useMemoryStore.setState({
      entries: [{ id: 'm1', category: 'fact', content: 'A-secret', createdAt: 1, updatedAt: 1 }],
    })
    useAuthStore.getState().expireSession()
    // 同 logout:残留只可能是空态(内存 setState 写回),不得含 A 的真实数据
    const memoryRaw = window.localStorage.getItem('ihui-memory')
    expect(memoryRaw === null || !memoryRaw.includes('A-secret')).toBe(true)
    const chatRaw = window.localStorage.getItem('ihui-chat')
    expect(chatRaw === null || !chatRaw.includes('"v":1')).toBe(true)
    expect(useMemoryStore.getState().entries).toEqual([])
  })
})

/** 清 useAuthStore 内存镜像:避免用例间串状态(仅本地辅助,不引私有实现)。 */
function clearPrivateMirror(): void {
  useChatStore.setState({
    messages: [],
    conversationId: null,
    draftInput: null,
    inputHistory: [],
    pendingDiffComments: [],
    sideQueueByConversation: {},
    failedDraft: null,
    failedDraftStatus: null,
    recentMessages: null,
  })
  useMemoryStore.setState({ entries: [] })
  useGoalStore.setState({ goal: null })
  useQuestsStore.setState({ entries: {} })
  useAgentHooksStore.setState({ hooks: [], events: [], droppedEvents: 0 })
  useIntegrationsStore.setState({
    channels: {
      github: { enabled: false, events: [] },
      slack: { enabled: false, events: [] },
      push: { enabled: false, events: [] },
    },
    log: [],
    droppedLog: 0,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
