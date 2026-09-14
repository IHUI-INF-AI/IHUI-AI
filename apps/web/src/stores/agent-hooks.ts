// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { toast } from '@/components/common'
import { forwardToChannels } from '@/stores/integrations'
import { createPersistConfig } from '@/stores/persist-helpers'

/**
 * Agent Hooks 事件系统(W28,2026-09-14 立,对标 CodeBuddy Hooks):
 * - 9 类事件:tool.before / tool.after / message.send / message.receive /
 *   session.start / session.end / error / commit.before / commit.after
 * - zustand persist 本地持久化(localStorage key: ihui-agent-hooks)
 * - emitHook() 为全局事件引擎:按事件匹配启用的 hook,执行动作(log/toast/notify)
 * - 触发点接线:send-message.ts(消息/会话/错误)、stream-handlers.ts(工具调用)、
 *   slash-commands.ts /commit(Smart Commit 前后)
 */

export type AgentHookEvent =
  | 'tool.before'
  | 'tool.after'
  | 'message.send'
  | 'message.receive'
  | 'session.start'
  | 'session.end'
  | 'error'
  | 'commit.before'
  | 'commit.after'

export const AGENT_HOOK_EVENTS: AgentHookEvent[] = [
  'tool.before',
  'tool.after',
  'message.send',
  'message.receive',
  'session.start',
  'session.end',
  'error',
  'commit.before',
  'commit.after',
]

export type AgentHookAction = 'log' | 'toast' | 'notify'

export const AGENT_HOOK_ACTIONS: AgentHookAction[] = ['log', 'toast', 'notify']

/** 事件触发时的上下文快照,用于消息模板插值与工具名过滤 */
export interface AgentHookContext {
  /** 工具事件:被调用工具名(tool.before/after) */
  toolName?: string
  /** 事件摘要文本(如提交信息、错误消息) */
  summary?: string
}

export interface AgentHookConfig {
  id: string
  event: AgentHookEvent
  action: AgentHookAction
  /** 工具事件可选过滤:仅匹配该工具名时触发(空=全部) */
  matchTool?: string
  enabled: boolean
  createdAt: number
}

interface AgentHooksState {
  hooks: AgentHookConfig[]
  /** 发出事件日志(最近 50 条,供面板展示) */
  events: { id: string; event: AgentHookEvent; summary: string; at: number }[]
  addHook: (event: AgentHookEvent, action: AgentHookAction, matchTool?: string) => void
  removeHook: (id: string) => void
  toggleHook: (id: string) => void
  recordEvent: (event: AgentHookEvent, summary: string) => void
  clearEvents: () => void
}

function genHookId(): string {
  return `hook-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function genEventId(): string {
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 执行单个 hook 动作。log 走 console,toast 走 Sonner 统一入口,
 * notify 走浏览器 Notification(无权限时降级 toast)。
 */
function executeHookAction(config: AgentHookConfig, ctx: AgentHookContext, summary: string): void {
  const label = ctx.toolName ? `${config.event}[${ctx.toolName}]` : config.event
  switch (config.action) {
    case 'log':
      console.info(`[AgentHook] ${label}: ${summary}`)
      break
    case 'toast':
      toast.info(`[AgentHook] ${label}`, { description: summary })
      break
    case 'notify': {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            new Notification(`[AgentHook] ${label}`, { body: summary })
          } catch {
            toast.info(`[AgentHook] ${label}`, { description: summary })
          }
        } else if (Notification.permission === 'default') {
          void Notification.requestPermission()
          toast.info(`[AgentHook] ${label}`, { description: summary })
        } else {
          toast.info(`[AgentHook] ${label}`, { description: summary })
        }
      } else {
        toast.info(`[AgentHook] ${label}`, { description: summary })
      }
      break
    }
  }
}

/**
 * 全局事件引擎:遍历启用的 hook,按 event 过滤(工具事件还按 matchTool 过滤),
 * 逐个执行动作并记录事件日志(最近 50 条)。
 * 必须在 store 创建之后调用,内部用 getState 避免循环依赖。
 */
export function emitAgentHook(event: AgentHookEvent, ctx: AgentHookContext = {}): void {
  const state = useAgentHooksStore.getState()
  const matched = state.hooks.filter(
    (h) =>
      h.enabled &&
      h.event === event &&
      (!h.matchTool || !ctx.toolName || h.matchTool === ctx.toolName),
  )
  const summary = ctx.summary ?? (ctx.toolName ? `tool=${ctx.toolName}` : '')
  if (matched.length > 0) {
    for (const config of matched) {
      executeHookAction(config, ctx, summary)
    }
  }
  // 无论是否有 hook 匹配都记录事件,便于面板调试观察
  state.recordEvent(event, summary)
  // W30 多入口集成:命中启用通道(事件子集)时转发到外部入口(push/slack),失败静默
  forwardToChannels(event, summary)
}

export const useAgentHooksStore = create<AgentHooksState>()(
  persist(
    (set) => ({
      hooks: [],
      events: [],
      addHook: (event, action, matchTool) =>
        set((s) => ({
          hooks: [
            ...s.hooks,
            {
              id: genHookId(),
              event,
              action,
              matchTool: matchTool?.trim() || undefined,
              enabled: true,
              createdAt: Date.now(),
            },
          ],
        })),
      removeHook: (id) => set((s) => ({ hooks: s.hooks.filter((h) => h.id !== id) })),
      toggleHook: (id) =>
        set((s) => ({
          hooks: s.hooks.map((h) => (h.id === id ? { ...h, enabled: !h.enabled } : h)),
        })),
      recordEvent: (event, summary) =>
        set((s) => ({
          events: [...s.events, { id: genEventId(), event, summary, at: Date.now() }].slice(-50),
        })),
      clearEvents: () => set({ events: [] }),
    }),
    createPersistConfig<AgentHooksState>('ihui-agent-hooks', (s) => ({ hooks: s.hooks })),
  ),
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
