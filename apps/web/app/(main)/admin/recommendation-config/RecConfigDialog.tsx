'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import { selectClass } from './helpers'
import type { RecommendSlot, RecommendForm } from './types'

interface Props {
  open: boolean
  editing: RecommendSlot | null
  form: RecommendForm
  setForm: React.Dispatch<React.SetStateAction<RecommendForm>>
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function RecConfigDialog({
  open,
  editing,
  form,
  setForm,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? t('rec.editTitle') : t('rec.createTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="r-pos">{t('rec.fieldPosition')}</Label>
            <Input
              id="r-pos"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              placeholder="home_banner"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="r-name">{t('rec.fieldName')}</Label>
            <Input
              id="r-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('rec.namePlaceholder')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="r-type">{t('rec.fieldContentType')}</Label>
              <select
                value={form.contentType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    contentType: e.target.value as RecommendSlot['contentType'],
                  })
                }
                className={selectClass}
              >
                <option value="agent">Agent</option>
                <option value="article">Article</option>
                <option value="course">Course</option>
                <option value="activity">Activity</option>
                <option value="live">Live</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-sort">{t('rec.fieldSort')}</Label>
              <Input
                id="r-sort"
                type="number"
                value={form.sort}
                onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="h-4 w-4 animate-spin" />}
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
