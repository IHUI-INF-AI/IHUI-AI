// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Bell, Copy, GitBranch, MessageSquare, Trash2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { toast } from '@/components/common'
import { cn } from '@/lib/utils'
import { AGENT_HOOK_EVENTS, type AgentHookEvent } from '@/stores/agent-hooks'
import {
  INTEGRATION_CHANNELS,
  useIntegrationsStore,
  type IntegrationChannel,
} from '@/stores/integrations'

/**
 * IntegrationsPanel — 多入口集成面板(W30,2026-09-14 立,对标 Codex GitHub/Slack/iOS)。
 *
 * 三类出口通道,每个通道:启用开关 + 转发事件子集(W28 9 类事件)+ 通道特有配置:
 *  - github:仓库标注 + 触发端点(webhooks-trigger id)复制/测试(反向:外部入口唤醒 agent)
 *  - slack:incoming webhook URL + 测试消息
 *  - push:浏览器通知权限请求 + 测试通知(SW showNotification)
 * 底部:转发日志(最近 50 条)+ 清空。
 */

const CHANNEL_ICON: Record<IntegrationChannel, React.ComponentType<{ className?: string }>> = {
  github: GitBranch,
  slack: MessageSquare,
  push: Bell,
}

export function IntegrationsPanel() {
  const t = useTranslations('integrations')
  const channels = useIntegrationsStore((s) => s.channels)
  const log = useIntegrationsStore((s) => s.log)
  const updateChannel = useIntegrationsStore((s) => s.updateChannel)
  const toggleChannelEvent = useIntegrationsStore((s) => s.toggleChannelEvent)
  const clearLog = useIntegrationsStore((s) => s.clearLog)

  const [testing, setTesting] = React.useState<IntegrationChannel | null>(null)
  const [permission, setPermission] = React.useState<string>('default')

  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.warning(t('pushUnsupported'))
      return
    }
    const p = await Notification.requestPermission()
    setPermission(p)
    if (p === 'granted') toast.success(t('pushGranted'))
    else if (p === 'denied') toast.warning(t('pushDenied'))
  }

  const handlePushTest = async () => {
    if (permission !== 'granted') {
      await handleRequestPermission()
      if (Notification.permission !== 'granted') return
    }
    try {
      const reg = await navigator.serviceWorker?.ready
      if (reg) {
        await reg.showNotification('[IHUI] push', { body: t('pushTestBody') })
      } else {
        new Notification('[IHUI] push', { body: t('pushTestBody') })
      }
      toast.success(t('pushTestSent'))
    } catch {
      toast.error(t('pushTestFailed'))
    }
  }

  const handleSlackTest = async () => {
    const url = channels.slack.webhookUrl?.trim()
    if (!url) {
      toast.warning(t('slackNeedUrl'))
      return
    }
    setTesting('slack')
    try {
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '[IHUI] Slack 通道测试消息' }),
      })
      toast.success(t('slackTestSent'))
    } catch {
      toast.error(t('slackTestFailed'))
    } finally {
      setTesting(null)
    }
  }

  const triggerUrl = (id: string) =>
    `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/trigger/${id}`

  const handleGithubCopy = async () => {
    const id = channels.github.triggerId?.trim()
    if (!id) {
      toast.warning(t('githubNeedTrigger'))
      return
    }
    try {
      await navigator.clipboard.writeText(triggerUrl(id))
      toast.success(t('githubCopied'))
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  const handleGithubTest = async () => {
    const id = channels.github.triggerId?.trim()
    if (!id) {
      toast.warning(t('githubNeedTrigger'))
      return
    }
    setTesting('github')
    try {
      const r = await fetchApi(`/api/webhooks/trigger/${id}`, { method: 'POST' })
      if (r.success) toast.success(t('githubTestSent'))
      else toast.error(t('githubTestFailed'), { description: r.error || '' })
    } catch (e) {
      toast.error(t('githubTestFailed'), {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setTesting(null)
    }
  }

  const renderChannel = (ch: IntegrationChannel) => {
    const Icon = CHANNEL_ICON[ch]
    const cfg = channels[ch]
    return (
      <div
        key={ch}
        data-testid={`integrations-channel-${ch}`}
        className="space-y-1.5 rounded-md border px-2 py-2 text-xs"
      >
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          <span className="font-medium">{t(ch)}</span>
          <button
            type="button"
            data-testid={`integrations-${ch}-toggle`}
            onClick={() => updateChannel(ch, { enabled: !cfg.enabled })}
            aria-pressed={cfg.enabled}
            // @allow-rounded-full 通道开关胶囊(aria-pressed toggle,豁免 2 Switch 语义)
            className={cn(
              'ml-auto rounded-full border px-2 py-0.5 transition-colors',
              cfg.enabled
                ? 'bg-accent font-medium text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50',
            )}
          >
            {cfg.enabled ? t('enabled') : t('disabled')}
          </button>
        </div>

        {/* 事件子集选择 */}
        <div className="flex flex-wrap gap-1">
          {AGENT_HOOK_EVENTS.map((ev) => {
            const on = cfg.events.includes(ev)
            return (
              <button
                key={ev}
                type="button"
                data-testid={`integrations-${ch}-event-${ev}`}
                aria-pressed={on}
                onClick={() => toggleChannelEvent(ch, ev as AgentHookEvent)}
                className={cn(
                  'rounded border px-1.5 py-0.5 text-[10px] transition-colors',
                  on
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50',
                )}
              >
                {t(`event.${ev}`)}
              </button>
            )
          })}
        </div>

        {/* 通道特有配置 */}
        {ch === 'github' && (
          <div className="space-y-1">
            <input
              data-testid="integrations-github-repo"
              value={cfg.repo ?? ''}
              onChange={(e) => updateChannel(ch, { repo: e.target.value })}
              placeholder={t('githubRepoPlaceholder')}
              className="w-full rounded-md border bg-transparent px-2 py-1 outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
            />
            <input
              data-testid="integrations-github-trigger-id"
              value={cfg.triggerId ?? ''}
              onChange={(e) => updateChannel(ch, { triggerId: e.target.value })}
              placeholder={t('githubTriggerPlaceholder')}
              className="w-full rounded-md border bg-transparent px-2 py-1 outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
            />
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                data-testid="integrations-github-copy-url"
                onClick={() => void handleGithubCopy()}
                className="flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Copy className="h-3 w-3" />
                {t('githubCopyUrl')}
              </button>
              <button
                type="button"
                data-testid="integrations-github-test"
                onClick={() => void handleGithubTest()}
                disabled={testing === 'github'}
                className="rounded-md border px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('githubTest')}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">{t('githubHint')}</p>
          </div>
        )}

        {ch === 'slack' && (
          <div className="space-y-1">
            <input
              data-testid="integrations-slack-url"
              value={cfg.webhookUrl ?? ''}
              onChange={(e) => updateChannel(ch, { webhookUrl: e.target.value })}
              placeholder={t('slackUrlPlaceholder')}
              className="w-full rounded-md border bg-transparent px-2 py-1 outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
            />
            <button
              type="button"
              data-testid="integrations-slack-test"
              onClick={() => void handleSlackTest()}
              disabled={testing === 'slack'}
              className="w-full rounded-md border px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('slackTest')}
            </button>
          </div>
        )}

        {ch === 'push' && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">
              {t('pushPermission')}: {t(`pushPerm.${permission}`)}
            </p>
            <button
              type="button"
              data-testid="integrations-push-test"
              onClick={() => void handlePushTest()}
              className="w-full rounded-md border px-2 py-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {permission === 'granted' ? t('pushTest') : t('pushRequest')}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div data-testid="integrations-panel" className="space-y-3 text-sm">
      <p className="text-[10px] text-muted-foreground">{t('description')}</p>

      <div className="space-y-2">{INTEGRATION_CHANNELS.map(renderChannel)}</div>

      {/* 转发日志 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">{t('forwardLog')}</span>
          <button
            type="button"
            data-testid="integrations-log-clear"
            onClick={clearLog}
            disabled={log.length === 0}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            {t('clearLog')}
          </button>
        </div>
        <div data-testid="integrations-log" className="space-y-1">
          {log.length === 0 ? (
            <p
              data-testid="integrations-log-empty"
              className="rounded-lg border border-dashed px-3 py-3 text-center text-xs text-muted-foreground"
            >
              {t('noLog')}
            </p>
          ) : (
            [...log].reverse().map((e, i) => (
              <div
                key={e.id}
                data-testid={`integrations-log-item-${i}`}
                className="rounded-md border px-2 py-1 text-[10px]"
              >
                <span className="font-medium">{t(e.channel)}</span>
                <span className="mx-1 text-muted-foreground">·</span>
                <span className="text-muted-foreground">{e.event}</span>
                <span className="ml-1 break-all">{e.summary}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
