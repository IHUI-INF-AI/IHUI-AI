'use client'

import { Loader2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, Button, Input, Label } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import type { AddressInput } from './types'

interface Props {
  editing: AddressInput
  isPending: boolean
  errorMessage?: string
  onChange: <K extends keyof AddressInput>(key: K, value: AddressInput[K]) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

export function AddressForm({
  editing,
  isPending,
  errorMessage,
  onChange,
  onSubmit,
  onCancel,
}: Props) {
  const t = useTranslations('memberAddressFormPage')
  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t('recipient')}</Label>
              <Input
                value={editing.name}
                onChange={(e) => onChange('name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('phone')}</Label>
              <Input
                value={editing.phone}
                onChange={(e) => onChange('phone', e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              placeholder={t('province')}
              value={editing.province}
              onChange={(e) => onChange('province', e.target.value)}
            />
            <Input
              placeholder={t('city')}
              value={editing.city}
              onChange={(e) => onChange('city', e.target.value)}
            />
            <Input
              placeholder={t('district')}
              value={editing.district}
              onChange={(e) => onChange('district', e.target.value)}
            />
          </div>
          <Input
            placeholder={t('detailAddress')}
            value={editing.detail}
            onChange={(e) => onChange('detail', e.target.value)}
            required
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!editing.isDefault}
              onChange={(e) => onChange('isDefault', e.target.checked)}
              className="h-4 w-4 rounded"
            />
            {t('setDefault')}
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              <X className="h-4 w-4" />
              {t('cancel')}
            </Button>
          </div>
          {errorMessage && <Alert variant="danger" description={errorMessage} />}
        </form>
      </CardContent>
    </Card>
  )
}
