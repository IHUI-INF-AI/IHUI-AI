'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { FlaskConical, Plus, Power, Loader2 } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Button, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface GrayRule {
  id: string
  name: string
  description: string
  percentage: number
  isEnabled: boolean
  target: string
}

const MOCK_RULES: GrayRule[] = [
  { id: '1', name: '新版聊天界面', description: '渐进式发布新聊天 UI,先开放给 10% 用户', percentage: 10, isEnabled: true, target: 'chat-ui-v2' },
  { id: '2', name: 'AI 推荐算法 v3', description: '新版推荐算法灰度,验证点击率提升', percentage: 25, isEnabled: true, target: 'recommend-v3' },
  { id: '3', name: '订单结算流程改版', description: '精简结算步骤,降低放弃率', percentage: 0, isEnabled: false, target: 'checkout-v2' },
  { id: '4', name: '会员体系升级', description: '新会员等级与权益体系', percentage: 50, isEnabled: true, target: 'membership-v2' },
]

const EMPTY = { name: '', description: '', percentage: 10, target: '' }
const textareaClass = 'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const th = 'px-4 py-2.5 font-medium'

export default function GrayReleasePage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY)

  const { data: rules = MOCK_RULES, isLoading } = useQuery({
    queryKey: ['admin', 'gray-release'],
    queryFn: async () => {
      const r = await fetchApi<GrayRule[]>('/api/admin/gray-release')
      if (r.success && r.data) return r.data
      return MOCK_RULES
    },
  })

  const toggleMut = useMutation({
    mutationFn: (_id: string) => Promise.resolve(), // TODO: 后端 API 待实现
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'gray-release'] })
      toast.success(t('grayRelease.toggleSuccess'))
    },
  })
  const createMut = useMutation({
    mutationFn: () => Promise.resolve(), // TODO: 后端 API 待实现
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'gray-release'] })
      setOpen(false)
      setForm(EMPTY)
      toast.success(t('grayRelease.createSuccess'))
    },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error(t('grayRelease.nameRequired'))
      return
    }
    createMut.mutate()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FlaskConical className="h-6 w-6 text-primary" />
            {t('grayRelease.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('grayRelease.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          {t('grayRelease.create')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tc('search')}
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          {t('grayRelease.noData')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className={th}>{t('grayRelease.colName')}</th>
                <th className={th}>{t('grayRelease.colDescription')}</th>
                <th className={th}>{t('grayRelease.colPercentage')}</th>
                <th className={th}>{t('grayRelease.colStatus')}</th>
                <th className={cn(th, 'text-right')}>{t('grayRelease.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rules.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.target}</div>
                  </td>
                  <td className="max-w-[280px] truncate px-4 py-2.5 text-muted-foreground" title={r.description}>
                    {r.description}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${r.percentage}%` }} />
                      </div>
                      <span className="text-xs font-medium">{r.percentage}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        r.isEnabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', r.isEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
                      {r.isEnabled ? t('grayRelease.enabled') : t('grayRelease.disabled')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={toggleMut.isPending}
                      onClick={() => toggleMut.mutate(r.id)}
                    >
                      <Power className="h-4 w-4" />
                      {r.isEnabled ? t('grayRelease.disable') : t('grayRelease.enable')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : !createMut.isPending && setOpen(false))}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t('grayRelease.createTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="g-name">{t('grayRelease.fieldName')}</Label>
              <Input
                id="g-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('grayRelease.namePlaceholder')}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-target">{t('grayRelease.fieldTarget')}</Label>
              <Input
                id="g-target"
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
                placeholder={t('grayRelease.targetPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-desc">{t('grayRelease.fieldDescription')}</Label>
              <textarea
                id="g-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className={textareaClass}
                placeholder={t('grayRelease.descriptionPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-pct">{t('grayRelease.fieldPercentage')}</Label>
              <Input
                id="g-pct"
                type="number"
                min={0}
                max={100}
                value={form.percentage}
                onChange={(e) => setForm({ ...form, percentage: Number(e.target.value) })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createMut.isPending}>
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
