'use client'

import { Loader2, X } from 'lucide-react'
import { Card, CardContent, Button, Input, Label } from '@ihui/ui'
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
  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">收货人</Label>
              <Input
                value={editing.name}
                onChange={(e) => onChange('name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">手机号</Label>
              <Input
                value={editing.phone}
                onChange={(e) => onChange('phone', e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              placeholder="省"
              value={editing.province}
              onChange={(e) => onChange('province', e.target.value)}
            />
            <Input
              placeholder="市"
              value={editing.city}
              onChange={(e) => onChange('city', e.target.value)}
            />
            <Input
              placeholder="区"
              value={editing.district}
              onChange={(e) => onChange('district', e.target.value)}
            />
          </div>
          <Input
            placeholder="详细地址"
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
            设为默认地址
          </label>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              保存
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              <X className="h-4 w-4" />
              取消
            </Button>
          </div>
          {errorMessage && <Alert variant="danger" description={errorMessage} />}
        </form>
      </CardContent>
    </Card>
  )
}
