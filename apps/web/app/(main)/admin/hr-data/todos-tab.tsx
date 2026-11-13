// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

'use client'

import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import type { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ClipboardCheck, AlertTriangle, Info, Hand, Check } from 'lucide-react'

import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui-react'

import { TODO_RESOURCE, IMPORT_PERM, severityTone, type TodoSeverity } from './helpers'
import { api } from './types'

/**
 * 流程待办标签页(HR-6 第 5 期,2026-11-13 立)。
 *
 * 后端已有「需人工决策的点 → 待办」的完整能力(幂等上报、不复活、可认领),
 * 但没有界面等于没有:HR 看不到待办,流程跑完只知道"有事"却不知道什么事。
 * 本页把待办变成可操作列表:看规模、点处理入口、认领、结清。
 *
 * 交互上的两个刻意选择:
 *   · 结清必须填说明 —— 与后端 TODO_NOTE_REQUIRED 对应,前端不给"空着关门"的路;
 *   · 已忽略/已结清的默认不显示 —— 但它们没有消失,切"全部"能看到,便于复盘。
 */

export interface TodoItem {
  id: string
  dedupeKey: string
  sourceType: string
  sourceRef: string | null
  severity: string
  title: string
  detail: string | null
  affectedCount: number | null
  affectedAmountCents: number | null
  actionPath: string | null
  actionHint: string | null
  status: string
  assigneeId: string | null
  resolvedAt: string | null
  resolutionNote: string | null
  createdAt: string
  lastSeenAt: string
}

export interface TodoSummary {
  open: number
  blocker: number
  warn: number
  info: number
}

const inputCls =
  'rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary'

/** 严重度图标与配色 */
function SeverityIcon({ severity }: { severity: string }) {
  const tone = severityTone(severity)
  const cls =
    tone === 'danger' ? 'text-destructive' : tone === 'warn' ? 'text-warning' : 'text-muted-foreground'
  if (severity === 'blocker') return <AlertTriangle className={`h-4 w-4 ${cls}`} />
  if (severity === 'warn') return <AlertTriangle className={`h-4 w-4 ${cls}`} />
  return <Info className={`h-4 w-4 ${cls}`} />
}

export function TodosTab({ t }: { t: ReturnType<typeof useTranslations> }) {
  const [statusFilter, setStatusFilter] = React.useState<'open' | 'all'>('open')
  const [resolving, setResolving] = React.useState<TodoItem | null>(null)
  const [note, setNote] = React.useState('')
  const [resolveAs, setResolveAs] = React.useState<'resolved' | 'ignored'>('resolved')

  // 用显式 state + effect 拉取,不用 useQuery。
  // 立因(2026-11-13 实测):同一份 api() 在别处正常,但本页 useQuery 的 queryFn
  // 在浏览器里一次都没执行(抓包 0 请求),页面恒显"待处理 0 项"。
  // 待办是低频、需强一致的操作面,直接拉反而更可控:每次切换筛选/操作后显式 reload。
  const [summary, setSummary] = React.useState<TodoSummary | null>(null)
  const [todos, setTodos] = React.useState<TodoItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [reloadTick, setReloadTick] = React.useState(0)

  const reload = React.useCallback(() => setReloadTick((n) => n + 1), [])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const [sum, list] = await Promise.all([
          api<TodoSummary>(`${TODO_RESOURCE}/summary`),
          api<{ list: TodoItem[]; total: number }>(
            `${TODO_RESOURCE}?status=${statusFilter}&limit=50`,
          ),
        ])
        if (cancelled) return
        setSummary(sum)
        setTodos(list.list ?? [])
      } catch (e) {
        if (cancelled) return
        setLoadError(e instanceof Error ? e.message : '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [statusFilter, reloadTick])

  const claimMut = useMutation({
    mutationFn: (p: { id: string; assign: boolean }) =>
      api(`${TODO_RESOURCE}/${p.id}/claim`, {
        method: 'POST',
        body: JSON.stringify({ assign: p.assign }),
      }),
    onSuccess: () => {
      reload()
      toast.success(t('todoClaimed'))
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const resolveMut = useMutation({
    mutationFn: (p: { id: string; status: 'resolved' | 'ignored'; note: string }) =>
      api(`${TODO_RESOURCE}/${p.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ status: p.status, note: p.note }),
      }),
    onSuccess: () => {
      reload()
      toast.success(t('todoResolved'))
      setResolving(null)
      setNote('')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const sum = summary

  return (
    <section className="space-y-4">
      {/* 角标:一眼看到有多少事等着 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          <span className="text-body">
            {t('todoOpenCount', { count: sum?.open ?? 0 })}
          </span>
        </div>
        {sum && sum.blocker > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-1 text-label text-destructive">
            <AlertTriangle className="h-3 w-3" />
            {t('todoBlockerCount', { count: sum.blocker })}
          </span>
        )}
        {sum && sum.warn > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-warning/10 px-2 py-1 text-label text-warning">
            {t('todoWarnCount', { count: sum.warn })}
          </span>
        )}
        <label className="text-body">
          {t('todoFilter')}
          <select
            className={inputCls}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'open' | 'all')}
          >
            <option value="open">{t('todoStatusOpen')}</option>
            <option value="all">{t('todoStatusAll')}</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : loadError ? (
        <p className="text-destructive">{loadError}</p>
      ) : todos.length === 0 ? (
        <p className="text-muted-foreground">{t('todoEmpty')}</p>
      ) : (
        <ul className="space-y-2">
          {todos.map((todo) => (
            <li key={todo.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <SeverityIcon severity={todo.severity} />
                    <span className="font-medium">{todo.title}</span>
                    {todo.status !== 'open' && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-label text-muted-foreground">
                        {todo.status === 'resolved' ? t('todoStatusResolved') : t('todoStatusIgnored')}
                      </span>
                    )}
                  </div>

                  {todo.detail && (
                    <p className="whitespace-pre-line text-label text-muted-foreground">
                      {todo.detail}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-label text-muted-foreground">
                    {todo.sourceRef && (
                      <span>
                        {t('todoPeriod')}: {todo.sourceRef}
                      </span>
                    )}
                    {todo.affectedCount !== null && (
                      <span>
                        {t('todoAffected')}: {todo.affectedCount}
                      </span>
                    )}
                    {todo.assigneeId && <span>{t('todoClaimedBy')}</span>}
                  </div>

                  {todo.resolutionNote && (
                    <p className="text-label text-muted-foreground">
                      {t('todoResolutionNote')}: {todo.resolutionNote}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  {todo.actionPath && (
                    <a
                      className="text-label text-primary underline"
                      href={todo.actionPath}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('todoGoHandle')}
                    </a>
                  )}
                  {todo.status === 'open' && (
                    <>
                      <HasPermi code={IMPORT_PERM}>
                        <button
                          className="text-label text-muted-foreground underline"
                          onClick={() => claimMut.mutate({ id: todo.id, assign: true })}
                        >
                          <Hand className="mr-0.5 inline h-3 w-3" />
                          {t('todoClaim')}
                        </button>
                      </HasPermi>
                      <HasPermi code={IMPORT_PERM}>
                        <button
                          className="text-label text-success underline"
                          onClick={() => {
                            setResolving(todo)
                            setResolveAs('resolved')
                            setNote('')
                          }}
                        >
                          <Check className="mr-0.5 inline h-3 w-3" />
                          {t('todoResolve')}
                        </button>
                      </HasPermi>
                    </>
                  )}
                </div>
              </div>

              {/* 结清面板:必须填说明(与后端 TODO_NOTE_REQUIRED 对应) */}
              {resolving?.id === todo.id && (
                <div className="mt-3 space-y-2 border-t pt-3">
                  <div className="flex gap-2 text-label">
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        checked={resolveAs === 'resolved'}
                        onChange={() => setResolveAs('resolved')}
                      />
                      {t('todoStatusResolved')}
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        checked={resolveAs === 'ignored'}
                        onChange={() => setResolveAs('ignored')}
                      />
                      {t('todoStatusIgnored')}
                    </label>
                  </div>
                  <textarea
                    className={`${inputCls} w-full`}
                    rows={2}
                    placeholder={t('todoNotePlaceholder')}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      disabled={!note.trim() || resolveMut.isPending}
                      onClick={() =>
                        resolveMut.mutate({ id: todo.id, status: resolveAs, note: note.trim() })
                      }
                    >
                      {t('todoSubmitResolve')}
                    </Button>
                    <button
                      className="text-label text-muted-foreground underline"
                      onClick={() => {
                        setResolving(null)
                        setNote('')
                      }}
                    >
                      {t('close')}
                    </button>
                    {!note.trim() && (
                      <span className="text-label text-warning">{t('todoNoteRequired')}</span>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export type { TodoSeverity }
