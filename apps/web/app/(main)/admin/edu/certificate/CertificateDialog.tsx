'use client'
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { selectClass } from '@/lib/edu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { useTranslations } from 'next-intl'
import type { CForm, Template } from './types'

interface Props {
  open: boolean
  form: CForm
  onFormChange: (patch: Partial<CForm>) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  pending: boolean
  err: string | null
  templates: Template[]
}

export function CertificateDialog({
  open,
  form,
  onFormChange,
  onClose,
  onSubmit,
  pending,
  err,
  templates,
}: Props) {
  const t = useTranslations('admin.edu.certificate')
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('issueCertificate')}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="cert-uid">{t('userId')}</Label>
            <Input
              id="cert-uid"
              value={form.userId}
              onChange={(e) => onFormChange({ userId: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cert-title">{t('certificateTitle')}</Label>
            <Input
              id="cert-title"
              value={form.title}
              onChange={(e) => onFormChange({ title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cert-recipient">{t('recipientName')}</Label>
              <Input
                id="cert-recipient"
                value={form.recipientName}
                onChange={(e) => onFormChange({ recipientName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cert-source">{t('source')}</Label>
              <Select value={form.source} onValueChange={(v) => onFormChange({ source: v })}>
                <SelectTrigger className={selectClass} id="cert-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">{t('sourceLabel.manual')}</SelectItem>
                  <SelectItem value="exam">{t('sourceLabel.exam')}</SelectItem>
                  <SelectItem value="learn">{t('sourceLabel.learn')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cert-tpl">{t('template')}</Label>
              <Select
                value={form.templateId || 'none'}
                onValueChange={(v) => onFormChange({ templateId: v === 'none' ? '' : v })}
              >
                <SelectTrigger className={selectClass} id="cert-tpl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noTemplate')}</SelectItem>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cert-date">{t('issueDate')}</Label>
              <Input
                id="cert-date"
                type="datetime-local"
                value={form.issuedAt}
                onChange={(e) => onFormChange({ issuedAt: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('issue')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
