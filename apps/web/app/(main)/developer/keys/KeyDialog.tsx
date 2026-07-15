'use client'

import { Loader2 } from 'lucide-react'
import { Button, Input, Label } from '@ihui/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@ihui/ui'
import { cn } from '@/lib/utils'

const ALL_SCOPES = ['read', 'write', 'admin', 'billing', 'webhook']

interface Props {
  open: boolean
  name: string
  scopes: string[]
  isPending: boolean
  onOpenChange: (v: boolean) => void
  onNameChange: (v: string) => void
  onToggleScope: (s: string) => void
  onCreate: () => void
  onCancel: () => void
}

export function KeyDialog({
  open,
  name,
  scopes,
  isPending,
  onOpenChange,
  onNameChange,
  onToggleScope,
  onCreate,
  onCancel,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建 API 密钥</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-sm">密钥名称</Label>
            <Input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="如:生产环境密钥"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">权限范围</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_SCOPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onToggleScope(s)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs transition-colors',
                    scopes.includes(s)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button onClick={onCreate} disabled={!name.trim() || isPending}>
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
