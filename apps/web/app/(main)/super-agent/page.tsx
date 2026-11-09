// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * RP-43：超级智能体 web 工单面板。
 *
 * 只消费控制面真实支持的能力：读面板、读派工/租约、停单、确认已记账请求。
 * 报工/心跳/派单是 worker 侧通道，面板不造对应按钮。
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@ihui/ui-react'
import type {
  SuperAgentPanelTicket,
  SuperAgentReportState,
  SuperAgentTicketStage,
} from '@ihui/api-client'

import {
  SUPER_AGENT_PANEL_POLL_MS,
  useAcceptSuperAgentRecorded,
  useStopSuperAgentTicket,
  useSuperAgentPanel,
  useSuperAgentTicketDetail,
} from './use-super-agent-panel'

type Translator = (key: string, values?: Record<string, string | number>) => string

/**
 * 人工转单时上行的规则编号。
 *
 * 路由 `POST /recorded/:id/accept` 强制要求非空 ruleId（作为开工闸与归属标记），
 * 但面板侧不暴露规则表，也不应该假装知道某条规则命中。这里用固定的人工通道标记：
 * 非空、且不是 `model-slow-path`（那条只属于慢路径自动腿，见 engine.acceptRecorded）。
 */
const MANUAL_ACCEPT_RULE_ID = 'manual-panel-accept'

function verdictLabel(verdict: 'act' | 'ignore' | 'unclear', t: Translator): string {
  if (verdict === 'act') return t('verdictAct')
  if (verdict === 'ignore') return t('verdictIgnore')
  return t('verdictUnclear')
}

function stageLabel(stage: SuperAgentTicketStage, t: Translator): string {
  if (stage.stage === 'person') {
    switch (stage.action) {
      case 'delivery':
        return t('stagePersonDelivery')
      case 'answer':
        return t('stagePersonAnswer')
      case 'review':
        return t('stagePersonReview')
      case 'blocked':
        return t('stagePersonBlocked')
      case 'failed':
        return t('stagePersonFailed')
    }
  }
  if (stage.stage === 'working') {
    return stage.action === 'queued' ? t('stageWorkingQueued') : t('stageWorking')
  }
  if (stage.stage === 'idle') return t('stageIdle')
  return t('stageEnded')
}

function reportLabel(state: SuperAgentReportState, t: Translator): string {
  switch (state) {
    case 'progress':
      return t('reportProgress')
    case 'waiting':
      return t('reportWaiting')
    case 'ready':
      return t('reportReady')
    case 'blocked':
      return t('reportBlocked')
    case 'failed':
      return t('reportFailed')
    case 'dropped':
      return t('reportDropped')
  }
}

/** 进度列：派工状态 + 最新收报，读不到就不编。 */
function progressLabel(ticket: SuperAgentPanelTicket, t: Translator): string {
  const parts: string[] = []
  if (ticket.assignment) {
    if (ticket.assignment.state === 'pending') parts.push(t('assignmentPending'))
    else if (ticket.assignment.state === 'running') parts.push(t('assignmentRunning'))
    else parts.push(t('assignmentEnded'))
  }
  if (ticket.report) parts.push(reportLabel(ticket.report.state, t))
  return parts.length > 0 ? parts.join(' · ') : t('noProgress')
}

function createdAtLabel(createdAt: number | null, t: Translator): string {
  if (createdAt === null) return t('unknownTime')
  return new Date(createdAt).toLocaleString()
}

function actionErrorLabel(error: unknown, t: Translator): string {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? (error as { status?: unknown }).status
      : undefined
  if (status === 401 || status === 403) return t('actionAuthFailed')
  const message = error instanceof Error ? error.message : String(error)
  return t('actionFailed', { message })
}

export default function SuperAgentPanelPage() {
  const t = useTranslations('superAgent')
  const panel = useSuperAgentPanel()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const detail = useSuperAgentTicketDetail(selectedId)
  const stopTicket = useStopSuperAgentTicket()
  const acceptRecorded = useAcceptSuperAgentRecorded()

  const tickets = panel.data?.tickets ?? []
  const selected = tickets.find((ticket) => ticket.ticketId === selectedId) ?? null

  // 票可能已被停单/回收，选中项消失时收起详情，避免详情停在过期快照上。
  React.useEffect(() => {
    if (selectedId !== null && panel.data !== undefined && selected === null) {
      setSelectedId(null)
    }
  }, [panel.data, selected, selectedId])

  const actionError = stopTicket.error ?? acceptRecorded.error

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-heading font-bold tracking-tight min-[768px]:text-display">
            {t('title')}
          </h1>
          <p className="text-body text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => void panel.refetch()} disabled={panel.isFetching}>
          {panel.isFetching ? t('refreshing') : t('refresh')}
        </Button>
      </div>

      <p className="text-caption text-muted-foreground" data-testid="panel-poll-hint">
        {t('pollHint', { seconds: SUPER_AGENT_PANEL_POLL_MS / 1000 })}
      </p>

      {panel.failure !== null && panel.data !== undefined ? (
        <div
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-body text-amber-900"
          data-testid="panel-stale"
        >
          {t('staleWarning', { message: panel.failure.message })}
        </div>
      ) : null}

      {panel.isPending ? (
        <div
          className="rounded-lg border px-4 py-8 text-center text-body"
          data-testid="panel-loading"
        >
          {t('loading')}
        </div>
      ) : panel.failure !== null && panel.data === undefined ? (
        panel.failure.kind === 'auth' ? (
          <div
            className="space-y-2 rounded-lg border px-4 py-8 text-center"
            data-testid="panel-auth"
          >
            <p className="text-body font-medium">{t('authTitle')}</p>
            <p className="text-caption text-muted-foreground">{t('authHint')}</p>
            <p className="text-caption text-muted-foreground">{panel.failure.message}</p>
          </div>
        ) : (
          <div
            className="space-y-3 rounded-lg border border-red-300 px-4 py-8 text-center"
            data-testid="panel-error"
          >
            <p className="text-body font-medium text-red-700">{t('errorTitle')}</p>
            <p className="text-caption text-muted-foreground">{t('errorHint')}</p>
            <p className="text-caption text-muted-foreground">{panel.failure.message}</p>
            <Button variant="outline" onClick={() => void panel.refetch()}>
              {t('retry')}
            </Button>
          </div>
        )
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 text-caption text-muted-foreground">
            <span>{t('summaryQuietDrops', { count: panel.data?.quietDrops ?? 0 })}</span>
            <span>{t('summaryRecorded', { count: panel.data?.recorded ?? 0 })}</span>
          </div>

          {tickets.length === 0 ? (
            <div className="rounded-lg border px-4 py-8 text-center" data-testid="panel-empty">
              <p className="text-body font-medium">{t('empty')}</p>
              <p className="text-caption text-muted-foreground">{t('emptyHint')}</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[720px] border-collapse text-body">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="px-3 py-2">{t('colStatus')}</th>
                      <th className="px-3 py-2">{t('colSource')}</th>
                      <th className="px-3 py-2">{t('colCreatedAt')}</th>
                      <th className="px-3 py-2">{t('colOwner')}</th>
                      <th className="px-3 py-2">{t('colProgress')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket) => (
                      <tr
                        key={ticket.ticketId}
                        className="border-b last:border-b-0"
                        data-testid="ticket-row"
                        data-ticket-id={ticket.ticketId}
                        data-stage={ticket.stage.stage}
                      >
                        <td className="max-w-[280px] px-3 py-2 align-top">
                          <button
                            type="button"
                            className="block text-left font-mono text-caption underline-offset-2 hover:underline"
                            data-testid="open-ticket"
                            onClick={() => setSelectedId(ticket.ticketId)}
                            aria-pressed={selectedId === ticket.ticketId}
                          >
                            {ticket.ticketId}
                          </button>
                          <span className="mt-1 block line-clamp-2 text-caption text-muted-foreground">
                            {ticket.scope}
                          </span>
                          <span className="mt-1 block text-caption font-medium">
                            {stageLabel(ticket.stage, t)}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top font-mono text-caption">
                          {ticket.sourceId}
                        </td>
                        <td className="px-3 py-2 align-top text-caption">
                          {createdAtLabel(ticket.createdAt, t)}
                        </td>
                        <td className="px-3 py-2 align-top font-mono text-caption">
                          {ticket.ownerUserId}
                        </td>
                        <td className="px-3 py-2 align-top text-caption">
                          {progressLabel(ticket, t)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selected !== null ? (
                <aside className="rounded-lg border p-3" data-testid="ticket-detail">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="break-all font-mono text-caption font-semibold">
                      {t('detailTitle')} · {selected.ticketId}
                    </h2>
                    <button
                      type="button"
                      className="text-caption text-muted-foreground hover:underline"
                      onClick={() => setSelectedId(null)}
                    >
                      {t('closeDetail')}
                    </button>
                  </div>

                  <p className="mt-2 whitespace-pre-wrap text-body">{selected.scope}</p>

                  <section className="mt-3 space-y-1">
                    <h3 className="text-caption font-semibold">{t('detailTrigger')}</h3>
                    {selected.inputs.length === 0 ? (
                      <p className="text-caption text-muted-foreground">{t('detailNone')}</p>
                    ) : (
                      <ul className="space-y-1">
                        {selected.inputs.map((input) => (
                          <li
                            key={`${input.triggerId}-${input.text}`}
                            className="break-all text-caption"
                          >
                            <span className="font-mono text-muted-foreground">
                              {input.triggerId}
                            </span>{' '}
                            {input.text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="mt-3 space-y-1">
                    <h3 className="text-caption font-semibold">{t('detailWorker')}</h3>
                    <p className="break-all font-mono text-caption">
                      {t('detailSession')}: {selected.sessionId}
                    </p>
                    <p className="break-all font-mono text-caption">
                      {t('detailDirectory')}: {selected.directory}
                    </p>
                    <p className="text-caption">
                      {t('detailAssignment')}: {progressLabel(selected, t)}
                    </p>
                    {detail.isPending ? (
                      <p
                        className="text-caption text-muted-foreground"
                        data-testid="detail-loading"
                      >
                        {t('detailLoading')}
                      </p>
                    ) : detail.error ? (
                      <div className="space-y-1" data-testid="detail-error">
                        <p className="text-caption text-red-700">{t('detailError')}</p>
                        <Button variant="outline" size="sm" onClick={() => void detail.refetch()}>
                          {t('detailRetry')}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-1" data-testid="detail-assignment">
                        <p className="break-all text-caption">
                          {t('detailGoal')}: {detail.data?.assignment?.goal ?? t('detailNone')}
                        </p>
                        <p className="whitespace-pre-wrap text-caption">
                          {t('detailConstraints')}:{' '}
                          {detail.data?.assignment?.constraints ?? t('detailNone')}
                        </p>
                        <p className="whitespace-pre-wrap text-caption">
                          {t('detailDeliverables')}:{' '}
                          {detail.data?.assignment?.deliverables ?? t('detailNone')}
                        </p>
                      </div>
                    )}
                  </section>

                  <section className="mt-3 space-y-1">
                    <h3 className="text-caption font-semibold">{t('detailReport')}</h3>
                    {selected.report === null ? (
                      <p
                        className="text-caption text-muted-foreground"
                        data-testid="detail-report-empty"
                      >
                        {t('detailReportEmpty')}
                      </p>
                    ) : (
                      <p className="whitespace-pre-wrap text-caption" data-testid="detail-report">
                        {reportLabel(selected.report.state, t)}: {selected.report.text}
                      </p>
                    )}
                  </section>

                  <section className="mt-3 space-y-1">
                    <h3 className="text-caption font-semibold">{t('detailFailure')}</h3>
                    {failureReason(selected) === null ? (
                      <p className="text-caption text-muted-foreground">{t('detailNone')}</p>
                    ) : (
                      <p className="whitespace-pre-wrap text-caption text-red-700">
                        {failureReason(selected)}
                      </p>
                    )}
                    {selected.ended !== null ? (
                      <p className="text-caption text-muted-foreground">
                        {t('detailEnded')}:{' '}
                        {selected.ended.by === 'person'
                          ? t('detailEndedByPerson')
                          : t('detailEndedByExecutor')}{' '}
                        · {selected.ended.outcome}
                      </p>
                    ) : null}
                  </section>

                  <section className="mt-3 space-y-1">
                    <h3 className="text-caption font-semibold">{t('detailLease')}</h3>
                    <p className="text-caption text-muted-foreground">
                      {t('detailLeaseLost', { count: selected.lostLeaseCount })}
                    </p>
                    {detail.data ? (
                      <p className="text-caption text-muted-foreground">
                        {t('detailLeaseRemaining', {
                          seconds: Math.max(0, Math.round(detail.data.lease.remainingMs / 1000)),
                        })}
                      </p>
                    ) : null}
                  </section>

                  {selected.stage.stage !== 'ended' ? (
                    <Button
                      variant="outline"
                      className="mt-4 w-full"
                      data-testid="stop-ticket"
                      disabled={stopTicket.isPending}
                      onClick={() => stopTicket.mutate(selected.ticketId)}
                    >
                      {stopTicket.isPending ? t('stopping') : t('stop')}
                    </Button>
                  ) : null}
                </aside>
              ) : null}
            </div>
          )}

          {panel.data !== undefined && panel.data.pendingRecords.length > 0 ? (
            <section className="rounded-lg border p-3" data-testid="pending-records">
              <h2 className="text-body font-semibold">{t('recordedTitle')}</h2>
              <ul className="mt-2 space-y-2">
                {panel.data.pendingRecords.map((record) => {
                  return (
                    <li
                      key={record.id}
                      className="space-y-1 border-t pt-2 first:border-t-0 first:pt-0"
                    >
                      <p className="break-all font-mono text-caption">{record.id}</p>
                      <p className="whitespace-pre-wrap text-caption">{record.text}</p>
                      <p className="text-caption text-muted-foreground">
                        {t('recordedReason')}: {record.reason}
                      </p>
                      <p
                        className="text-caption text-muted-foreground"
                        data-testid="record-decision"
                      >
                        {t('recordedVerdict')}:{' '}
                        {record.decision
                          ? `${verdictLabel(record.decision.verdict, t)} · ${record.decision.reason}`
                          : t('detailNone')}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="accept-record"
                        disabled={acceptRecorded.isPending}
                        onClick={() =>
                          acceptRecorded.mutate({
                            triggerId: record.id,
                            ruleId: MANUAL_ACCEPT_RULE_ID,
                          })
                        }
                      >
                        {acceptRecorded.isPending ? t('accepting') : t('acceptRule')}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          {actionError ? (
            <div
              className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-body text-red-700"
              data-testid="action-error"
              role="alert"
            >
              {actionErrorLabel(actionError, t)}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

/** 失败原因优先取派送失败；报告失败/阻塞的正文也算原因；否则没有原因可展示。 */
function failureReason(ticket: SuperAgentPanelTicket): string | null {
  if (ticket.deliveryError !== null) return ticket.deliveryError
  if (ticket.report?.state === 'failed' || ticket.report?.state === 'blocked') {
    return ticket.report.text
  }
  return null
}
