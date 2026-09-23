// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Badge,
} from '@ihui/ui-react'
import { type Term } from './types'

export function TermDialog({
  open,
  onOpenChange,
  terms,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  terms: Term[]
  onSave: (data: Partial<Term>) => Promise<void>
}) {
  const t = useTranslations('eduStudyPlan')
  const [editTerm, setEditTerm] = React.useState<Term | null>(null)
  const [name, setName] = React.useState('')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [isCurrent, setIsCurrent] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const resetForm = (term?: Term | null) => {
    if (term) {
      setName(term.name)
      setStartDate(term.startDate)
      setEndDate(term.endDate)
      setIsCurrent(term.isCurrent)
      setEditTerm(term)
    } else {
      setName('')
      setStartDate('')
      setEndDate('')
      setIsCurrent(false)
      setEditTerm(null)
    }
  }

  React.useEffect(() => {
    if (open) resetForm(null)
  }, [open])

  const handleSave = async () => {
    if (!name.trim() || !startDate || !endDate) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), startDate, endDate, isCurrent })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('termManagement')}</DialogTitle>
        </DialogHeader>

        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
          {terms.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t('noTerms')}</p>
          ) : (
            terms.map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                onClick={() => resetForm(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') resetForm(item)
                }}
              >
                <span className={cn(editTerm?.id === item.id && 'font-medium')}>
                  {item.name}
                  {item.isCurrent && (
                    <Badge variant="default" className="ml-2 text-[10px]">
                      {t('current')}
                    </Badge>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.startDate} ~ {item.endDate}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">{editTerm ? t('editTermTitle') : t('newTermTitle')}</p>
          <div className="grid gap-1.5">
            <Label>{t('termName')}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('termNamePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>{t('startDate')}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>{t('endDate')}</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
            />
            <span>{t('setAsCurrentTerm')}</span>
          </label>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={saving || !name.trim() || !startDate || !endDate}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {editTerm ? t('saveChanges') : t('createTerm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
