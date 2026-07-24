'use client'
import {
  Card,
  CardContent,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import { STATUS_OPTIONS } from './helpers'

interface Props {
  status: string
  onStatusChange: (v: string) => void
}

export function WithdrawalsFilter({ status, onStatusChange }: Props) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3">
        <span className="text-sm text-muted-foreground">状态</span>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  )
}
