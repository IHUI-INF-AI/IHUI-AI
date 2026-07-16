'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { textareaClass, selectClass } from '@/lib/edu'
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
  Switch,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import type { Template, TForm } from './types'

interface Props {
  open: boolean
  editing: Template | null
  form: TForm
  setForm: React.Dispatch<React.SetStateAction<TForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function CertTemplateDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  const t = useTranslations('admin.eduCertTemplate')
  const [showPreview, setShowPreview] = React.useState(false)
  const validityLabel = (v: string) => {
    if (v === 'one_year') return t('validityOneYear')
    if (v === 'three_years') return t('validityThreeYears')
    if (v === 'five_years') return t('validityFiveYears')
    if (v === 'custom_days') return t('validityCustomDays')
    if (v === 'date_range') return t('validityDateRange')
    return t('validityPermanent')
  }
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
            <DialogTitle>
              {showPreview ? t('previewTitle') : editing ? t('editTitle') : t('createTitle')}
            </DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          {showPreview ? (
            <div className="space-y-3">
              {form.backgroundImage.trim() ? (
                <div className="overflow-hidden rounded-md border">
                  <img
                    src={form.backgroundImage.trim()}
                    alt={form.name}
                    className="max-h-64 w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center rounded-md border text-sm text-muted-foreground">
                  {t('placeholderBackgroundImage')}
                </div>
              )}
              <div className="space-y-1 rounded-md border p-3 text-sm">
                <div className="text-base font-semibold">{form.name || t('labelName')}</div>
                {form.description && (
                  <div className="text-muted-foreground">{form.description}</div>
                )}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <span className="text-muted-foreground">{t('fieldAwardingOrganization')}</span>
                  <span>{form.awardingOrganization || '-'}</span>
                  <span className="text-muted-foreground">{t('fieldAwarderName')}</span>
                  <span>{form.awarderName || '-'}</span>
                  <span className="text-muted-foreground">{t('fieldValidityPolicy')}</span>
                  <span>{validityLabel(form.validityPolicy)}</span>
                </div>
                {form.awardConditions && (
                  <div className="pt-2">
                    <span className="text-muted-foreground">{t('fieldAwardConditions')}</span>
                    <span className="ml-2">{form.awardConditions}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="tpl-name">{t('labelName')}</Label>
                <Input
                  id="tpl-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-desc">{t('labelDescription')}</Label>
                <textarea
                  id="tpl-desc"
                  className={textareaClass}
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="tpl-org">{t('fieldAwardingOrganization')}</Label>
                  <Input
                    id="tpl-org"
                    value={form.awardingOrganization}
                    onChange={(e) => setForm({ ...form, awardingOrganization: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tpl-awarder">{t('fieldAwarderName')}</Label>
                  <Input
                    id="tpl-awarder"
                    value={form.awarderName}
                    onChange={(e) => setForm({ ...form, awarderName: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-cond">{t('fieldAwardConditions')}</Label>
                <textarea
                  id="tpl-cond"
                  className={textareaClass}
                  rows={3}
                  value={form.awardConditions}
                  onChange={(e) => setForm({ ...form, awardConditions: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-validity">{t('fieldValidityPolicy')}</Label>
                <Select
                  value={form.validityPolicy}
                  onValueChange={(v) => setForm({ ...form, validityPolicy: v })}
                >
                  <SelectTrigger className={selectClass} id="tpl-validity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanent">{t('validityPermanent')}</SelectItem>
                    <SelectItem value="one_year">{t('validityOneYear')}</SelectItem>
                    <SelectItem value="three_years">{t('validityThreeYears')}</SelectItem>
                    <SelectItem value="five_years">{t('validityFiveYears')}</SelectItem>
                    <SelectItem value="custom_days">{t('validityCustomDays')}</SelectItem>
                    <SelectItem value="date_range">{t('validityDateRange')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.validityPolicy === 'custom_days' && (
                <div className="space-y-2">
                  <Label htmlFor="tpl-vdays">{t('fieldValidDays')}</Label>
                  <Input
                    id="tpl-vdays"
                    type="number"
                    min="1"
                    value={form.validDays}
                    onChange={(e) => setForm({ ...form, validDays: e.target.value })}
                  />
                </div>
              )}
              {form.validityPolicy === 'date_range' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="tpl-vfrom">{t('fieldValidFrom')}</Label>
                    <Input
                      id="tpl-vfrom"
                      type="date"
                      value={form.validFrom}
                      onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tpl-vto">{t('fieldValidTo')}</Label>
                    <Input
                      id="tpl-vto"
                      type="date"
                      value={form.validTo}
                      onChange={(e) => setForm({ ...form, validTo: e.target.value })}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="tpl-bg">{t('labelBackgroundImage')}</Label>
                <Input
                  id="tpl-bg"
                  value={form.backgroundImage}
                  onChange={(e) => setForm({ ...form, backgroundImage: e.target.value })}
                  placeholder={t('placeholderBackgroundImage')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-config">{t('labelTemplateConfig')}</Label>
                <textarea
                  id="tpl-config"
                  className={cn(textareaClass, 'font-mono')}
                  rows={4}
                  value={form.templateConfig}
                  onChange={(e) => setForm({ ...form, templateConfig: e.target.value })}
                  placeholder='{"fields":["name","title"]}'
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="tpl-status"
                  checked={form.status}
                  onCheckedChange={(v) => setForm({ ...form, status: v })}
                />
                <Label htmlFor="tpl-status">{t('labelStatus')}</Label>
              </div>
            </>
          )}
          <DialogFooter>
            {showPreview ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPreview(false)}
                disabled={savePending}
              >
                {t('backToEdit')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPreview(true)}
                disabled={savePending}
              >
                {t('preview')}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
