/**
 * P1-2.2: 创建租户弹窗
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Button,
} from '@ihui/ui-react'

import { selectClass } from '../helpers'
import type { TenantForm } from '../types'

export const EMPTY_TENANT_FORM: TenantForm = {
  slug: '',
  memory: '2G',
  cpu: '1.0',
  plan: 'free',
}

const SLUG_REGEX = /^[a-z0-9-]{3,20}$/

interface CreateTenantDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  form: TenantForm
  onChange: (f: TenantForm) => void
  submitting: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function CreateTenantDialog({
  open,
  onOpenChange,
  form,
  onChange,
  submitting,
  onSubmit,
}: CreateTenantDialogProps) {
  const t = useTranslations('admin.saas')
  const [touched, setTouched] = React.useState(false)
  const slugValid = SLUG_REGEX.test(form.slug)
  const showError = touched && form.slug.length > 0 && !slugValid
  const canSubmit = slugValid && form.slug.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('createTenant')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tenant-slug">{t('form.slug')}</Label>
            <Input
              id="tenant-slug"
              value={form.slug}
              onChange={(e) => onChange({ ...form, slug: e.target.value })}
              onBlur={() => setTouched(true)}
              placeholder="demo-customer"
              aria-invalid={showError}
              className={showError ? 'border-rose-500' : ''}
            />
            <p className="text-xs text-muted-foreground">{t('form.slugHint')}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tenant-memory">{t('form.memory')}</Label>
              <Input
                id="tenant-memory"
                value={form.memory ?? '2G'}
                onChange={(e) => onChange({ ...form, memory: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tenant-cpu">{t('form.cpu')}</Label>
              <Input
                id="tenant-cpu"
                value={form.cpu ?? '1.0'}
                onChange={(e) => onChange({ ...form, cpu: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('form.plan')}</label>
            <select
              className={selectClass + ' w-full'}
              value={form.plan ?? 'free'}
              onChange={(e) =>
                onChange({ ...form, plan: e.target.value as TenantForm['plan'] })
              }
              aria-label={t('form.plan')}
            >
              <option value="free">{t('form.planFree')}</option>
              <option value="pro">{t('form.planPro')}</option>
              <option value="enterprise">{t('form.planEnterprise')}</option>
            </select>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              {t('confirm.cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit || submitting}>
              {submitting ? t('creating') : t('confirm.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
