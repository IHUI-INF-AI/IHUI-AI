'use client'

import { MapPin, Pencil, Trash2, Check } from 'lucide-react'
import { Card, CardContent, Button } from '@ihui/ui-react'
import type { Address } from './types'

interface Props {
  list: Address[]
  delPending: boolean
  defaultPending: boolean
  onEdit: (a: Address) => void
  onDelete: (id: string) => void
  onSetDefault: (id: string) => void
}

export function AddressesList({
  list,
  delPending,
  defaultPending,
  onEdit,
  onDelete,
  onSetDefault,
}: Props) {
  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
        <MapPin className="h-8 w-8 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">还没有添加收货地址</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {list.map((a) => (
        <Card key={a.id} className="transition-colors hover:bg-accent">
          <CardContent className="space-y-1 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{a.name}</span>
                <span className="text-xs text-muted-foreground">{a.phone}</span>
                {a.isDefault && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                    默认
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(a)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onDelete(a.id)}
                  disabled={delPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {a.province}
              {a.city}
              {a.district}
              {a.detail}
            </p>
            {!a.isDefault && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onSetDefault(a.id)}
                disabled={defaultPending}
              >
                <Check className="h-3 w-3" />
                设为默认
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
