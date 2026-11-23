// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 客户登记维护(2026-11-23):客户 tab 原来只有"新建",没有改与停用。
 *
 * 三件事:改资料(PATCH /clients/:id)、归档(POST /clients/:id/archive,停账不停数据)、
 * 绑账套(POST /clients/:id/bind-ledger,让申报任务能追到账)。
 */
import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ArchiveRestore, Link2, Save } from 'lucide-react'

import { Button } from '@ihui/ui-react'
import { api, FIN_RESOURCE, type FinClient, type FinLedger } from './types'
import { Card, Empty, field } from './tabs'

/** 客户资料维护 + 归档 + 绑账套 */
export function ClientOps({ clients, ledgers }: { clients: FinClient[]; ledgers: FinLedger[] }) {
  const t = useTranslations('finAccounting')
  const qc = useQueryClient()
  const [clientId, setClientId] = React.useState('')
  const [form, setForm] = React.useState({
    name: '',
    taxNo: '',
    taxpayerType: 'small',
    industry: '',
    contactName: '',
    contactPhone: '',
    remark: '',
  })
  const [confirmArchive, setConfirmArchive] = React.useState(false)
  const [ledgerToBind, setLedgerToBind] = React.useState('')

  const pick = (id: string) => {
    setClientId(id)
    setConfirmArchive(false)
    const c = clients.find((x) => x.id === id)
    setForm({
      name: c?.name ?? '',
      taxNo: c?.taxNo ?? '',
      taxpayerType: c?.taxpayerType ?? 'small',
      industry: c?.industry ?? '',
      contactName: c?.contactName ?? '',
      contactPhone: c?.contactPhone ?? '',
      remark: c?.remark ?? '',
    })
  }

  const done = () => {
    toast.success(t('actionDone'))
    setConfirmArchive(false)
    qc.invalidateQueries({ queryKey: ['fin'] })
  }
  const failed = (e: Error) => toast.error(e.message)

  const saveMut = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { name: form.name.trim() }
      if (form.taxNo.trim()) body.taxNo = form.taxNo.trim()
      body.taxpayerType = form.taxpayerType
      if (form.industry.trim()) body.industry = form.industry.trim()
      if (form.contactName.trim()) body.contactName = form.contactName.trim()
      if (form.contactPhone.trim()) body.contactPhone = form.contactPhone.trim()
      if (form.remark.trim()) body.remark = form.remark.trim()
      return api(`${FIN_RESOURCE}/clients/${clientId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
    },
    onSuccess: done,
    onError: failed,
  })

  const archiveMut = useMutation({
    mutationFn: () => api(`${FIN_RESOURCE}/clients/${clientId}/archive`, { method: 'POST' }),
    onSuccess: done,
    onError: failed,
  })

  const bindMut = useMutation({
    mutationFn: () =>
      api(`${FIN_RESOURCE}/clients/${clientId}/bind-ledger`, {
        method: 'POST',
        body: JSON.stringify({ ledgerId: ledgerToBind }),
      }),
    onSuccess: done,
    onError: failed,
  })

  if (clients.length === 0) return <Empty text={t('noClients')} />

  return (
    <Card title={t('clientOpsTitle')}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className={field} value={clientId} onChange={(e) => pick(e.target.value)}>
          <option value="">{t('selectClient')}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {!clientId ? (
        <Empty text={t('pickClientHint')} />
      ) : (
        <div className="space-y-2 text-xs">
          <div className="flex flex-wrap gap-2">
            <input
              className={field}
              placeholder={t('name')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className={field}
              placeholder={t('taxNo')}
              value={form.taxNo}
              onChange={(e) => setForm({ ...form, taxNo: e.target.value })}
            />
            <select
              className={field}
              value={form.taxpayerType}
              onChange={(e) => setForm({ ...form, taxpayerType: e.target.value })}
            >
              <option value="small">{t('small')}</option>
              <option value="general">{t('general')}</option>
            </select>
            <input
              className={field}
              placeholder={t('industry')}
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className={field}
              placeholder={t('contactName')}
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            />
            <input
              className={field}
              placeholder={t('contactPhone')}
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
            />
            <input
              className={field}
              placeholder={t('remark')}
              value={form.remark}
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!form.name.trim() || saveMut.isPending}
              onClick={() => saveMut.mutate()}
            >
              <Save className="h-3.5 w-3.5" />
              {t('save')}
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-2 pt-1">
            <select
              className={field}
              value={ledgerToBind}
              onChange={(e) => setLedgerToBind(e.target.value)}
            >
              <option value="">{t('selectLedger')}</option>
              {ledgers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={!ledgerToBind || bindMut.isPending}
              onClick={() => bindMut.mutate()}
            >
              <Link2 className="h-3.5 w-3.5" />
              {t('bindLedger')}
            </Button>
            {confirmArchive ? (
              <Button
                size="sm"
                variant="outline"
                disabled={archiveMut.isPending}
                onClick={() => archiveMut.mutate()}
              >
                <ArchiveRestore className="h-3.5 w-3.5" />
                {t('confirmArchive')}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setConfirmArchive(true)}>
                <ArchiveRestore className="h-3.5 w-3.5" />
                {t('archiveClient')}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
