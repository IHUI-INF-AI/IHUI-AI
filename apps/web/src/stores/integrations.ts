// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { AgentHookEvent } from '@/stores/agent-hooks'
import { createPersistConfig } from '@/stores/persist-helpers'

/**
 * 多入口集成(W30,2026-09-14 立,对标 Codex GitHub/Slack/iOS 多端入口):
 * - 三类出口通道:github(外部触发端点)/ slack(incoming webhook)/ push(浏览器通知)
 * - 与 W28 Hooks 事件系统打通:emitAgentHook → forwardToChannels,
 *   按「通道启用 + 事件子集」把 agent 事件转发到外部入口(反向:Codex 由外部入口触发 agent,
 *   本端复用后端已就绪的 POST /api/webhooks/trigger/:id + IM 网关,前端负责出口转发与配置)
 * - zustand persist 本地持久化(localStorage key: ihui-integrations,
 *   敏感字段 slack webhookUrl 一并本地保存,不落服务端)
 */

export type IntegrationChannel = 'github' | 'slack' | 'push'

export const INTEGRATION_CHANNELS: IntegrationChannel[] = ['github', 'slack', 'push']

export interface IntegrationChannelConfig {
  enabled: boolean
  /** 转发的事件子集(W28 9 类事件) */
  events: AgentHookEvent[]
  /** github:仓库(owner/repo,展示用) */
  repo?: string
  /** github:后端 webhooks-trigger id(POST /api/webhooks/trigger/:id 唤醒 agent) */
  triggerId?: string
  /** slack:incoming webhook URL */
  webhookUrl?: string
}

const DEFAULT_CHANNEL: IntegrationChannelConfig = { enabled: false, events: [] }

interface IntegrationsState {
  channels: Record<IntegrationChannel, IntegrationChannelConfig>
  /** 转发日志(最近 50 条,供面板调试) */
  log: {
    id: string
    channel: IntegrationChannel
    event: AgentHookEvent
    summary: string
    at: number
  }[]
  updateChannel: (channel: IntegrationChannel, patch: Partial<IntegrationChannelConfig>) => void
  toggleChannelEvent: (channel: IntegrationChannel, event: AgentHookEvent) => void
  recordLog: (channel: IntegrationChannel, event: AgentHookEvent, summary: string) => void
  clearLog: () => void
}

function genLogId(): string {
  return `int-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const useIntegrationsStore = create<IntegrationsState>()(
  persist(
    (set) => ({
      channels: {
        github: { ...DEFAULT_CHANNEL },
        slack: { ...DEFAULT_CHANNEL },
        push: { ...DEFAULT_CHANNEL },
      },
      log: [],
      updateChannel: (channel, patch) =>
        set((s) => ({
          channels: { ...s.channels, [channel]: { ...s.channels[channel], ...patch } },
        })),
      toggleChannelEvent: (channel, event) =>
        set((s) => {
          const cur = s.channels[channel]
          const events = cur.events.includes(event)
            ? cur.events.filter((e) => e !== event)
            : [...cur.events, event]
          return { channels: { ...s.channels, [channel]: { ...cur, events } } }
        }),
      recordLog: (channel, event, summary) =>
        set((s) => ({
          log: [...s.log, { id: genLogId(), channel, event, summary, at: Date.now() }].slice(-50),
        })),
      clearLog: () => set({ log: [] }),
    }),
    createPersistConfig<IntegrationsState>('ihui-integrations', (s) => ({ channels: s.channels })),
  ),
)

/** SW 注册句柄(仅客户端) */
async function getSwRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    return (await navigator.serviceWorker.ready) ?? null
  } catch {
    return null
  }
}

/** push 通道:SW showNotification(无 SW 时退回页面内 Notification) */
async function pushNotify(title: string, body: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission !== 'granted') return false
  const reg = await getSwRegistration()
  if (reg) {
    await reg.showNotification(title, { body })
    return true
  }
  try {
    new Notification(title, { body })
    return true
  } catch {
    return false
  }
}

/** slack 通道:incoming webhook 直发(no-cors,无法读响应,失败按异常计) */
async function slackSend(webhookUrl: string, text: string): Promise<boolean> {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    return true
  } catch {
    return false
  }
}

/**
 * 事件转发引擎:emitAgentHook 末尾调用(fire-and-forget)。
 * 遍历启用通道,事件命中子集则分发:
 *  - push:SW showNotification
 *  - slack:incoming webhook POST
 *  - github:仅记录(外部触发由后端 POST /api/webhooks/trigger/:id 承担,前端不回环触发)
 * 所有命中都写入转发日志;任何失败静默。
 */
export function forwardToChannels(event: AgentHookEvent, summary: string): void {
  const { channels, recordLog } = useIntegrationsStore.getState()
  const title = `[IHUI] ${event}`
  for (const channel of INTEGRATION_CHANNELS) {
    const cfg = channels[channel]
    if (!cfg.enabled || !cfg.events.includes(event)) continue
    recordLog(channel, event, summary)
    if (channel === 'push') {
      void pushNotify(title, summary).catch(() => undefined)
    } else if (channel === 'slack' && cfg.webhookUrl) {
      void slackSend(cfg.webhookUrl, `${title}: ${summary}`).catch(() => undefined)
    }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
