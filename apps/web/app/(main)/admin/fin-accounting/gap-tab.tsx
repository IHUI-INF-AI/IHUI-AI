// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RefreshCw, Upload, CalendarCheck2 } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { api, FIN_RESOURCE, type FinLedger } from './types'
import { Card, Empty, field, th, td } from './tabs'

/**
 * 财务补口页(2026-11-24):账簿四报表 / 年结 / 凭证附件 / 申报取数。
 * 此前这些能力只有后端路由,会计在页面上无处可点。
 */

type Row = Record<string, unknown>

function num(v: unknown): string {
  return v === null || v === undefined || v === '' ? '-' : String(v)
}

function SimpleTable({ rows, cols }: { rows: Row[]; cols: Array<[string, string]> }) {
  if (rows.length === 0) return <Empty text="暂无数据" />
  return (
    <div className="overflow-auto">
      <table className="w-full">
        <thead>
          <tr>
            {cols.map(([k, label]) => (
              <th key={k} className={th}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 60).map((r, i) => (
            <tr key={String(r.id ?? i)} className="border-t border-stroke-subtle">
              {cols.map(([k]) => (
                <td key={k} className={td}>
                  {num(r[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function GapTab({ ledgers }: { ledgers: FinLedger[] }) {
  const qc = useQueryClient()
  const [ledgerId, setLedgerId] = React.useState('')
  const [period, setPeriod] = React.useState('')
  const ledger = ledgers.find((l) => l.id === ledgerId)
  const p = period || ledger?.currentPeriod || ''
  const [view, setView] = React.useState<'detail' | 'general' | 'journal'>('detail')
  const [voucherId, setVoucherId] = React.useState('')

  const q = useQuery({
    queryKey: ['fin', 'gap', view, ledgerId, p],
    queryFn: () =>
      api<unknown>(
        `${FIN_RESOURCE}/ledgers/${ledgerId}/${view === 'detail' ? 'detail-ledger' : view === 'general' ? 'general-ledger' : 'journal'}?period=${p}&limit=100`,
      ),
    enabled: !!ledgerId && !!p,
  })
  const cashQ = useQuery({
    queryKey: ['fin', 'cashflow', ledgerId, p],
    queryFn: () =>
      api<{ rows?: Row[]; netChange?: string; reconciled?: boolean; warnings?: string[] }>(
        `${FIN_RESOURCE}/ledgers/${ledgerId}/cash-flow?period=${p}`,
      ),
    enabled: !!ledgerId && !!p,
  })
  const vouchersQ = useQuery({
    queryKey: ['fin', 'gap-vouchers', ledgerId],
    queryFn: () => api<unknown>(`${FIN_RESOURCE}/ledgers/${ledgerId}/vouchers?limit=100`),
    enabled: !!ledgerId,
  })
  const attQ = useQuery({
    queryKey: ['fin', 'attachments', voucherId],
    queryFn: () => api<unknown>(`${FIN_RESOURCE}/vouchers/${voucherId}/attachments`),
    enabled: !!voucherId,
  })

  const rows = Array.isArray(q.data)
    ? (q.data as Row[])
    : ((q.data as { rows?: Row[] })?.rows ?? [])
  const vouchers = (vouchersQ.data as { rows?: Row[] })?.rows ?? []
  const attachments = (attQ.data as { rows?: Row[] })?.rows ?? []

  const yearEndMut = useMutation({
    mutationFn: () =>
      api(`${FIN_RESOURCE}/year-end`, {
        method: 'POST',
        body: JSON.stringify({ year: Number(p.slice(0, 4)) }),
      }),
    onSuccess: () => {
      toast.success('年结已完成')
      qc.invalidateQueries({ queryKey: ['fin'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      const up = await api<{
        id: string
        name: string
        size: number
        mimeType: string
        path: string
      }>('/api/files/upload/form', { method: 'POST', body: form })
      return api(`${FIN_RESOURCE}/vouchers/${voucherId}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          fileId: up.id,
          name: up.name,
          url: up.path,
          size: up.size,
          mimeType: up.mimeType,
        }),
      })
    },
    onSuccess: () => {
      toast.success('附件已挂到凭证')
      qc.invalidateQueries({ queryKey: ['fin', 'attachments', voucherId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deriveMut = useMutation({
    mutationFn: (taskId: string) =>
      api(`${FIN_RESOURCE}/filing-tasks/${taskId}/derive`, { method: 'POST', body: '{}' }),
    onSuccess: () => {
      toast.success('申报取数已完成')
      qc.invalidateQueries({ queryKey: ['fin', 'filing'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const filingQ = useQuery({
    queryKey: ['fin', 'gap-filing'],
    queryFn: () => api<unknown>(`${FIN_RESOURCE}/filing-tasks?limit=20`),
  })
  const filing = (filingQ.data as { rows?: Row[] })?.rows ?? []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className={field} value={ledgerId} onChange={(e) => setLedgerId(e.target.value)}>
          <option value="">选择账套</option>
          {ledgers.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <input
          className={field}
          placeholder="期间 YYYY-MM"
          value={p}
          onChange={(e) => setPeriod(e.target.value)}
          disabled={!ledgerId}
        />
        <select
          className={field}
          value={view}
          onChange={(e) => setView(e.target.value as typeof view)}
        >
          <option value="detail">明细账</option>
          <option value="general">总账</option>
          <option value="journal">序时账</option>
        </select>
        <Button size="sm" variant="outline" disabled={!ledgerId} onClick={() => q.refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />
          刷新
        </Button>
      </div>

      {!ledgerId ? (
        <Empty text="先选账套" />
      ) : (
        <>
          <Card title={view === 'detail' ? '明细账' : view === 'general' ? '总账' : '序时账'}>
            <SimpleTable
              rows={rows}
              cols={
                view === 'journal'
                  ? [
                      ['voucherDate', '日期'],
                      ['voucherNo', '凭证号'],
                      ['summary', '摘要'],
                      ['accountCode', '科目'],
                      ['debit', '借方'],
                      ['credit', '贷方'],
                    ]
                  : [
                      ['accountCode', '科目'],
                      ['accountName', '名称'],
                      ['openingBalance', '期初'],
                      ['debit', '借方'],
                      ['credit', '贷方'],
                      ['closingBalance', '期末'],
                      ['direction', '方向'],
                    ]
              }
            />
          </Card>

          <Card title="现金流量表(直接法·简化)">
            {!cashQ.data ? (
              <Empty text="加载中" />
            ) : (
              <div className="space-y-2">
                <div className="font-[weight:inherit] flex flex-wrap gap-4 text-label">
                  <span>
                    现金净变动: <b>{num(cashQ.data.netChange)}</b>
                  </span>
                  <span className={cashQ.data.reconciled ? 'text-success' : 'text-warning'}>
                    {cashQ.data.reconciled ? '勾稽一致' : '勾稽有差异'}
                  </span>
                  {(cashQ.data.warnings ?? []).map((w) => (
                    <span key={w} className="text-[11px] text-muted-foreground">
                      {w}
                    </span>
                  ))}
                </div>
                <SimpleTable
                  rows={cashQ.data.rows ?? []}
                  cols={[
                    ['section', '类别'],
                    ['accountCode', '对方科目'],
                    ['amount', '金额'],
                  ]}
                />
              </div>
            )}
          </Card>

          <Card
            title="年结(本年利润 → 利润分配)"
            actions={
              <Button
                size="sm"
                variant="outline"
                disabled={!p || yearEndMut.isPending}
                onClick={() => yearEndMut.mutate()}
              >
                <CalendarCheck2 className="h-3.5 w-3.5" />
                {p.slice(0, 4)} 年结
              </Button>
            }
          >
            <p className="font-[weight:inherit] text-label text-muted-foreground">
              前置:12 月已结账、次年 1 月未结账;年结凭证开在次年 1 月 1 日。
            </p>
          </Card>

          <Card title="凭证附件">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <select
                className={field}
                value={voucherId}
                onChange={(e) => setVoucherId(e.target.value)}
              >
                <option value="">选择凭证</option>
                {vouchers.map((v) => (
                  <option key={String(v.id)} value={String(v.id)}>
                    {String(v.voucherNo)} {String(v.summary ?? '')}
                  </option>
                ))}
              </select>
              <label className="font-[weight:inherit] inline-flex cursor-pointer items-center gap-1 rounded-md border border-stroke-default px-2 py-1 text-label">
                <Upload className="h-3.5 w-3.5" />
                上传附件
                <input
                  type="file"
                  className="hidden"
                  disabled={!voucherId || uploadMut.isPending}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) uploadMut.mutate(f)
                  }}
                />
              </label>
            </div>
            {!voucherId ? (
              <Empty text="先选凭证" />
            ) : (
              <SimpleTable
                rows={attachments}
                cols={[
                  ['name', '文件名'],
                  ['size', '字节'],
                  ['mimeType', '类型'],
                  ['createdAt', '上传时间'],
                ]}
              />
            )}
          </Card>

          <Card title="申报取数(按发票/账簿生成税额)">
            {filing.length === 0 ? (
              <Empty text="暂无申报任务" />
            ) : (
              <ul className="space-y-1">
                {filing.slice(0, 12).map((t) => (
                  <li key={String(t.id)} className="font-[weight:inherit] flex flex-wrap items-center gap-2 text-label">
                    <span>{String(t.taxType)}</span>
                    <span className="text-muted-foreground">{String(t.period)}</span>
                    <b>{num(t.taxAmount)}</b>
                    <button
                      className="text-[11px] underline disabled:opacity-50"
                      disabled={deriveMut.isPending}
                      onClick={() => deriveMut.mutate(String(t.id))}
                    >
                      取数
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
