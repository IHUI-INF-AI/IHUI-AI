'use client'

import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { selectClass } from './helpers'
import { STATUS_OPTIONS } from './types'

interface Props {
  status: number
  pending: boolean
  onChange: (status: number) => void
  t: (k: string) => string
}

export function SignupRowStatus({ status, pending, onChange, t }: Props) {
  return (
    <Select value={String(status)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className={cn(selectClass, 'ml-auto w-32 text-left')} disabled={pending}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {t(opt.key)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
