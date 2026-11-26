// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 请假审批规则(多级审批链)—— 2026-11-23 立。
 *
 * 规则 = 假别 + 天数区间 → 有序审批链。以前这套规则只能在库里改,
 * HR 加一个"3 天以上病假要两级批"要写 SQL。这里落成表单:
 * 假别/区间/审批链(可多级)/代理审批人/超时小时/超时升级目标。
 */

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { apiOrThrow as api } from '@/lib/api'
import { ApproverChain, appField } from './approvers'

const BASE = '/api/hr-approval'

interface FlowRow {
  id: string
  leaveType: string
  minDays: number
  maxDays: number | null
  approverIds: string[]
  approverProxyId: string | null
  timeoutHours: number
  escalationApproverId: string | null
  status: string
}

interface FormState {
  id?: string
  leaveType: string
  minDays: string
  maxDays: string
  approverIds: string[]
  approverProxyId: string
  timeoutHours: string
  escalationApproverId: string
  status: 'active' | 'disabled'
}

const EMPTY: FormState = {
  leaveType: '',
  minDays: '0',
  maxDays: '',
  approverIds: [],
  approverProxyId: '',
  timeoutHours: '24',
  escalationApproverId: '',
  status: 'active',
}

export function FlowsPanel() {
  const t = useTranslations('hrApproval')
  const qc = useQueryClient()
  const [form, setForm] = React.useState<FormState>(EMPTY)

  const listQuery = useQuery({
    queryKey: ['hr', 'approval', 'flows'],
    queryFn: () => api<{ list: FlowRow[] }>(`${BASE}/flows`),
  })
  const flows = listQuery.data?.list ?? []

  const saveMut = useMutation({
    mutationFn: () => {
      if (!form.leaveType.trim()) throw new Error(t('leaveTypeRequired'))
      if (form.approverIds.length === 0) throw new Error(t('approverRequired'))
      const maxDays = form.maxDays.trim() ? Number(form.maxDays) : null
      const body = {
        ...(form.id ? { id: form.id } : {}),
        leaveType: form.leaveType.trim(),
        minDays: Number(form.minDays || '0'),
        maxDays,
        approverIds: form.approverIds,
        approverProxyId: form.approverProxyId.trim() || null,
        timeoutHours: Number(form.timeoutHours || '24'),
        escalationApproverId: form.escalationApproverId.trim() || null,
        status: form.status,
      }
      return api(`${BASE}/flows`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(t('flowSaved'))
      setForm(EMPTY)
      void qc.invalidateQueries({ queryKey: ['hr', 'approval', 'flows'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const edit = (f: FlowRow) => {
    setForm({
      id: f.id,
      leaveType: f.leaveType,
      minDays: String(f.minDays),
      maxDays: f.maxDays === null ? '' : String(f.maxDays),
      approverIds: [...f.approverIds],
      approverProxyId: f.approverProxyId ?? '',
      timeoutHours: String(f.timeoutHours),
      escalationApproverId: f.escalationApproverId ?? '',
      status: f.status === 'disabled' ? 'disabled' : 'active',
    })
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{t('tabFlows')}</h2>

      <div className="space-y-2 rounded-lg border border-stroke-subtle p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-body">
            {t('leaveType')}
            <input
              className={appField}
              value={form.leaveType}
              onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
              placeholder={t('leaveTypePlaceholder')}
            />
          </label>
          <label className="w-20 text-body">
            {t('minDays')}
            <input
              className={`${appField} w-full`}
              value={form.minDays}
              onChange={(e) => setForm({ ...form, minDays: e.target.value })}
              inputMode="numeric"
            />
          </label>
          <label className="w-24 text-body">
            {t('maxDays')}
            <input
              className={`${appField} w-full`}
              value={form.maxDays}
              onChange={(e) => setForm({ ...form, maxDays: e.target.value })}
              placeholder={t('maxDaysHint')}
              inputMode="numeric"
            />
          </label>
          <label className="w-24 text-body">
            {t('timeoutHours')}
            <input
              className={`${appField} w-full`}
              value={form.timeoutHours}
              onChange={(e) => setForm({ ...form, timeoutHours: e.target.value })}
              inputMode="numeric"
            />
          </label>
          <label className="text-body">
            {t('flowStatus')}
            <select
              className={appField}
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as 'active' | 'disabled' })
              }
            >
              <option value="active">{t('flowActive')}</option>
              <option value="disabled">{t('flowDisabled')}</option>
            </select>
          </label>
        </div>

        <ApproverChain
          label={t('approverChain')}
          value={form.approverIds}
          onChange={(ids) => setForm({ ...form, approverIds: ids })}
        />

        <div className="flex flex-wrap items-end gap-2">
          <label className="text-body">
            {t('proxyApprover')}
            <input
              className={appField}
              value={form.approverProxyId}
              onChange={(e) => setForm({ ...form, approverProxyId: e.target.value })}
              placeholder={t('optionalUuid')}
            />
          </label>
          <label className="text-body">
            {t('escalationApprover')}
            <input
              className={appField}
              value={form.escalationApproverId}
              onChange={(e) => setForm({ ...form, escalationApproverId: e.target.value })}
              placeholder={t('optionalUuid')}
            />
          </label>
          <button
            className="font-[weight:inherit] rounded-md bg-primary px-3 py-1.5 text-body text-primary-foreground disabled:opacity-50"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            {form.id ? t('saveFlow') : t('createFlow')}
          </button>
          {form.id && (
            <button
              className="font-[weight:inherit] rounded-md border border-stroke-default px-3 py-1.5 text-body hover:bg-muted"
              onClick={() => setForm(EMPTY)}
            >
              {t('cancel')}
            </button>
          )}
        </div>
      </div>

      {listQuery.isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : flows.length === 0 ? (
        <p className="text-muted-foreground">{t('noFlows')}</p>
      ) : (
        <table className="w-full text-body">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-1">{t('leaveType')}</th>
              <th className="px-2 py-1">{t('dayRange')}</th>
              <th className="px-2 py-1">{t('approverChain')}</th>
              <th className="px-2 py-1">{t('timeoutHours')}</th>
              <th className="px-2 py-1">{t('flowStatus')}</th>
              <th className="px-2 py-1">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {flows.map((f) => (
              <tr key={f.id} className="border-t">
                <td className="px-2 py-1">{f.leaveType}</td>
                <td className="px-2 py-1">
                  {f.minDays} ~ {f.maxDays === null ? t('noUpper') : f.maxDays}
                </td>
                <td className="px-2 py-1">{t('levelCount', { count: f.approverIds.length })}</td>
                <td className="px-2 py-1">{f.timeoutHours}</td>
                <td className="px-2 py-1">
                  {f.status === 'disabled' ? t('flowDisabled') : t('flowActive')}
                </td>
                <td className="px-2 py-1">
                  <button className="text-primary hover:underline" onClick={() => edit(f)}>
                    {t('edit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
