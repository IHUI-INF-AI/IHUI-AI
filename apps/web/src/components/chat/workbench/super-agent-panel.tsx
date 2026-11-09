// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 超级智能体值守面板(web 对话工作台专用)。
 *
 * 控制面判据全在服务端(@ihui/shared/super-agent),本组件只做只读投影与
 * 既有点名出口(stop / recorded accept);不复制任何授权/阶段逻辑。
 * 空态由账面无"要人处理"单自然得出 —— 没有单就不编内容。
 */
'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Bot, CircleCheck, CirclePause, X } from 'lucide-react'

import { Badge, Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { useSuperAgentPanel } from '@/components/chat/workbench/use-super-agent-panel'

// 完整字面量键(动态拼键会被 i18n 扫描面漏判)
const PERSON_ACTION_KEYS: Record<'delivery' | 'review' | 'answer' | 'blocked' | 'failed', string> =
  {
    delivery: 'superAgentActionDelivery',
    review: 'superAgentActionReview',
    answer: 'superAgentActionAnswer',
    blocked: 'superAgentActionBlocked',
    failed: 'superAgentActionFailed',
  }

export function SuperAgentPanel() {
  const t = useTranslations('chat')
  const { panel, busy, stop, approveRecorded } = useSuperAgentPanel()
  const [open, setOpen] = React.useState(false)

  const needs = panel?.needsPerson ?? []
  const records = panel?.pendingRecords ?? []
  const count = needs.length + records.length

  return (
    <section className="shrink-0" data-super-agent-panel="">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-1.5 text-label text-muted-foreground',
          'hover:text-foreground',
        )}
        data-super-agent-toggle=""
      >
        <Bot className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{t('superAgentPanelTitle')}</span>
        <span
          className="inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-muted px-1 text-[10px] font-semibold leading-none tabular-nums"
          data-super-agent-count=""
        >
          {count.toString()}
        </span>
      </button>

      {(open || count > 0) && (
        <div className="flex flex-col gap-1 px-3 pb-2" data-super-agent-body="">
          {count === 0 && (
            <p className="text-label text-muted-foreground">{t('superAgentEmpty')}</p>
          )}

          {needs.map((row) => (
            <div
              key={row.ticketId}
              className="flex items-start gap-2 py-1"
              data-super-agent-ticket={row.ticketId}
              data-stage-action={row.stage.stage === 'person' ? row.stage.action : ''}
            >
              <CirclePause
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-label" title={row.scope}>
                  {row.scope}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {row.stage.stage === 'person'
                    ? t(PERSON_ACTION_KEYS[row.stage.action])
                    : t('superAgentStageIdle')}
                  {row.attention ? ` · ${row.attention}` : ''}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={busy}
                onClick={() => void stop(row.ticketId)}
                className="shrink-0 gap-1 px-2"
                title={t('superAgentStop')}
                aria-label={t('superAgentStop')}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </div>
          ))}

          {records.map((rec) => (
            <div
              key={rec.id}
              className="flex items-start gap-2 py-1"
              data-super-agent-record={rec.id}
              data-verdict={rec.decision?.verdict ?? 'none'}
            >
              <CircleCheck
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-label" title={rec.text}>
                  {rec.text}
                </p>
                {rec.decision ? (
                  <Badge
                    variant={rec.decision.verdict === 'act' ? 'secondary' : 'outline'}
                    className="mt-0.5"
                  >
                    {rec.decision.verdict === 'act'
                      ? t('superAgentVerdictAct')
                      : rec.decision.verdict === 'ignore'
                        ? t('superAgentVerdictIgnore')
                        : t('superAgentVerdictUnclear')}
                  </Badge>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={busy}
                onClick={() => void approveRecorded(rec.id)}
                className="shrink-0 px-2"
              >
                {t('superAgentApprove')}
              </Button>
            </div>
          ))}

          {panel && panel.quietDrops > 0 && (
            <p className="text-[11px] text-muted-foreground" data-super-agent-quiet="">
              {t('superAgentQuietDrops', { count: panel.quietDrops })}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
