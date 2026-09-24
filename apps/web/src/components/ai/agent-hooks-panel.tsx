// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Bell, Plus, Trash2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  AGENT_HOOK_ACTIONS,
  AGENT_HOOK_EVENTS,
  emitAgentHook,
  useAgentHooksStore,
  type AgentHookAction,
  type AgentHookEvent,
} from '@/stores/agent-hooks'

/**
 * AgentHooksPanel — Hooks 事件系统配置面板(W28,2026-09-14 立,对标 CodeBuddy Hooks)。
 *
 * - 9 类事件(tool.before/after、message.send/receive、session.start/end、
 *   error、commit.before/after)可各自配置动作(log/toast/notify)
 * - 工具事件可选 matchTool 过滤(仅匹配该工具名触发)
 * - 事件日志(最近 50 条)实时展示 emitAgentHook 触发记录 + 清空
 * - 测试触发按钮:手动 emit 一条 session.start 验证动作链路
 */

export function AgentHooksPanel() {
  const t = useTranslations('agentHooks')
  const hooks = useAgentHooksStore((s) => s.hooks)
  const events = useAgentHooksStore((s) => s.events)
  const addHook = useAgentHooksStore((s) => s.addHook)
  const removeHook = useAgentHooksStore((s) => s.removeHook)
  const toggleHook = useAgentHooksStore((s) => s.toggleHook)
  const clearEvents = useAgentHooksStore((s) => s.clearEvents)

  const [event, setEvent] = React.useState<AgentHookEvent>('tool.before')
  const [action, setAction] = React.useState<AgentHookAction>('log')
  const [matchTool, setMatchTool] = React.useState('')

  const handleAdd = () => {
    addHook(event, action, matchTool.trim() || undefined)
    setMatchTool('')
  }

  const handleTest = () => {
    emitAgentHook(event, { summary: t('testSummary'), toolName: matchTool.trim() || undefined })
  }

  const selectCls =
    'h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

  return (
    <div data-testid="agent-hooks-panel" className="space-y-3 text-sm">
      <p className="text-xs leading-relaxed text-muted-foreground">{t('description')}</p>

      {/* 新增 hook 表单 */}
      <div data-testid="agent-hooks-form" className="space-y-2 rounded-md border border-border p-2">
        <div className="flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <select
            aria-label={t('eventLabel')}
            data-testid="agent-hooks-event-select"
            value={event}
            onChange={(e) => setEvent(e.target.value as AgentHookEvent)}
            className={cn(selectCls, 'min-w-0 flex-1')}
          >
            {AGENT_HOOK_EVENTS.map((ev) => (
              <option key={ev} value={ev}>
                {t(`event.${ev}`)}
              </option>
            ))}
          </select>
          <select
            aria-label={t('actionLabel')}
            data-testid="agent-hooks-action-select"
            value={action}
            onChange={(e) => setAction(e.target.value as AgentHookAction)}
            className={selectCls}
          >
            {AGENT_HOOK_ACTIONS.map((ac) => (
              <option key={ac} value={ac}>
                {t(`action.${ac}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={matchTool}
            onChange={(e) => setMatchTool(e.target.value)}
            placeholder={t('matchToolPlaceholder')}
            data-testid="agent-hooks-match-tool-input"
            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            data-testid="agent-hooks-add"
            onClick={handleAdd}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-cta px-2 py-1.5 text-xs font-medium text-cta-foreground transition-colors hover:bg-cta/90"
          >
            <Plus className="h-3 w-3" />
            {t('add')}
          </button>
          <button
            type="button"
            data-testid="agent-hooks-test"
            onClick={handleTest}
            className="rounded-md border border-border px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-accent/50"
          >
            {t('test')}
          </button>
        </div>
      </div>

      {/* 已配置 hook 列表 */}
      <div data-testid="agent-hooks-list" className="space-y-1.5">
        {hooks.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">{t('empty')}</p>
        ) : (
          hooks.map((h) => (
            <div
              key={h.id}
              data-testid={`agent-hook-item-${h.id}`}
              className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5"
            >
              <button
                type="button"
                data-testid={`agent-hook-toggle-${h.id}`}
                aria-pressed={h.enabled}
                onClick={() => toggleHook(h.id)}
                // @allow-rounded-full 自制 Switch 开关轨道(16x28 胶囊,豁免 2 Switch 语义)
                className={cn(
                  'h-4 w-7 shrink-0 rounded-full transition-colors',
                  h.enabled ? 'bg-primary' : 'bg-muted-foreground/40',
                )}
              >
                <span
                  className={cn(
                    'block h-3 w-3 rounded-full bg-background transition-transform',
                    h.enabled ? 'translate-x-3.5' : 'translate-x-0.5',
                  )}
                />
              </button>
              <span className="min-w-0 flex-1 truncate text-xs">
                <span className="font-medium">{t(`event.${h.event}`)}</span>
                <span className="text-muted-foreground">
                  {' '}
                  → {t(`action.${h.action}`)}
                  {h.matchTool ? ` · ${h.matchTool}` : ''}
                </span>
              </span>
              <button
                type="button"
                data-testid={`agent-hook-remove-${h.id}`}
                onClick={() => removeHook(h.id)}
                aria-label={t('remove')}
                className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* 事件日志(最近 50 条) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">{t('eventLog')}</p>
          {events.length > 0 && (
            <button
              type="button"
              data-testid="agent-hooks-clear-events"
              onClick={clearEvents}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {t('clearLog')}
            </button>
          )}
        </div>
        <div data-testid="agent-hooks-events" className="max-h-40 space-y-1 overflow-y-auto">
          {events.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">{t('noEvents')}</p>
          ) : (
            [...events].reverse().map((e) => (
              <div
                key={e.id}
                data-testid={`agent-hook-event-${e.id}`}
                className="flex items-baseline gap-1.5 rounded-md bg-muted/50 px-2 py-1 text-[11px]"
              >
                <span className="shrink-0 font-mono text-muted-foreground">
                  {new Date(e.at).toLocaleTimeString()}
                </span>
                <span className="shrink-0 font-medium">{t(`event.${e.event}`)}</span>
                {e.summary && (
                  <span className="min-w-0 truncate text-muted-foreground">{e.summary}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
