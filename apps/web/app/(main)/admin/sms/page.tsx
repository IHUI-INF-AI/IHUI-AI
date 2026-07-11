'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { MessageSquare, Plus, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

interface SmsTemplate {
  id: string
  name: string
  content: string
  type: 'verify' | 'notice' | 'marketing'
  status: 'approved' | 'pending' | 'rejected'
}

interface SmsRecord {
  id: string
  phone: string
  content: string
  status: 'success' | 'failed' | 'sending'
  time: string
}

const TYPE_LABEL: Record<SmsTemplate['type'], string> = {
  verify: 'Verify',
  notice: 'Notice',
  marketing: 'Marketing',
}
const TYPE_STYLE: Record<SmsTemplate['type'], string> = {
  verify: 'bg-emerald-500/10 text-emerald-600',
  notice: 'bg-amber-500/10 text-amber-600',
  marketing: 'bg-purple-500/10 text-purple-600',
}
const STATUS_STYLE: Record<SmsTemplate['status'], { bg: string; text: string; label: string }> = {
  approved: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'Approved' },
  pending: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Pending' },
  rejected: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Rejected' },
}
const RECORD_STATUS: Record<SmsRecord['status'], { bg: string; text: string; label: string }> = {
  success: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', label: 'Success' },
  failed: { bg: 'bg-red-500/10', text: 'text-red-600', label: 'Failed' },
  sending: { bg: 'bg-amber-500/10', text: 'text-amber-600', label: 'Sending' },
}

const EMPTY = { name: '', content: '', type: 'verify' as SmsTemplate['type'] }
const th = 'px-4 py-2.5 font-medium'
const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export default function SmsPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY)

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['admin', 'sms', 'templates'],
    queryFn: async () => {
      const r = await fetchApi<{ list: SmsTemplate[] } | SmsTemplate[]>('/api/admin/sms/templates')
      if (r.success && r.data) {
        return Array.isArray(r.data) ? r.data : (r.data.list ?? [])
      }
      return []
    },
  })
  const { data: records = [] } = useQuery({
    queryKey: ['admin', 'sms', 'records'],
    queryFn: async () => {
      const r = await fetchApi<{ list: SmsRecord[] } | SmsRecord[]>('/api/admin/sms/records')
      if (r.success && r.data) {
        return Array.isArray(r.data) ? r.data : (r.data.list ?? [])
      }
      return []
    },
  })

  const createMut = useMutation({
    mutationFn: async () => {
      const r = await fetchApi('/api/admin/sms/templates', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sms', 'templates'] })
      setOpen(false)
      setForm(EMPTY)
      toast.success(t('sms.createSuccess'))
    },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.content.trim()) {
      toast.error(t('sms.required'))
      return
    }
    createMut.mutate()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MessageSquare className="h-6 w-6 text-primary" />
          {t('sms.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('sms.subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tc('search')}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 短信模板 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">{t('sms.templates')}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" />
                {t('sms.createTemplate')}
              </Button>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('sms.noData')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className={th}>{t('sms.colName')}</th>
                        <th className={th}>{t('sms.colType')}</th>
                        <th className={th}>{t('sms.colStatus')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {templates.map((tp) => {
                        const st = STATUS_STYLE[tp.status]
                        return (
                          <tr key={tp.id} className="transition-colors hover:bg-muted/30">
                            <td className="px-4 py-2.5">
                              <div className="font-medium">{tp.name}</div>
                              <div
                                className="max-w-[200px] break-words text-xs text-muted-foreground"
                                title={tp.content}
                              >
                                {tp.content}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={cn(
                                  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                  TYPE_STYLE[tp.type],
                                )}
                              >
                                {TYPE_LABEL[tp.type]}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={cn(
                                  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                  st.bg,
                                  st.text,
                                )}
                              >
                                {st.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 发送记录 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('sms.records')}</CardTitle>
            </CardHeader>
            <CardContent>
              {records.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">{t('sms.noData')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className={th}>{t('sms.colPhone')}</th>
                        <th className={th}>{t('sms.colContent')}</th>
                        <th className={th}>{t('sms.colStatus')}</th>
                        <th className={th}>{t('sms.colTime')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {records.map((r) => {
                        const st = RECORD_STATUS[r.status]
                        return (
                          <tr key={r.id} className="transition-colors hover:bg-muted/30">
                            <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">
                              {r.phone}
                            </td>
                            <td
                              className="max-w-[180px] break-words px-4 py-2.5 text-muted-foreground"
                              title={r.content}
                            >
                              {r.content}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={cn(
                                  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                  st.bg,
                                  st.text,
                                )}
                              >
                                {st.label}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                              {r.time}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : !createMut.isPending && setOpen(false))}
      >
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t('sms.createTemplateTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="s-name">{t('sms.fieldName')}</Label>
              <Input
                id="s-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('sms.namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-type">{t('sms.fieldType')}</Label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as SmsTemplate['type'] })}
                className={selectClass}
              >
                <option value="verify">{t('sms.typeVerify')}</option>
                <option value="notice">{t('sms.typeNotice')}</option>
                <option value="marketing">{t('sms.typeMarketing')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-content">{t('sms.fieldContent')}</Label>
              <textarea
                id="s-content"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={4}
                className={textareaClass}
                placeholder={t('sms.contentPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('sms.contentHint')}</p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={createMut.isPending}
              >
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
