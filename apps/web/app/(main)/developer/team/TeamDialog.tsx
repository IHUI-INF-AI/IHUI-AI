'use client'

import { Loader2 } from 'lucide-react'
import { Button, Input, Label } from '@ihui/ui-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { ROLE_CONFIG, ROLE_OPTIONS } from './types'
import type { TeamMember } from './types'

interface Props {
  open: boolean
  isEdit: boolean
  email: string
  role: TeamMember['role']
  isPending: boolean
  onOpenChange: (v: boolean) => void
  onEmailChange: (v: string) => void
  onRoleChange: (r: TeamMember['role']) => void
  onSave: () => void
  onCancel: () => void
}

export function TeamDialog({
  open,
  isEdit,
  email,
  role,
  isPending,
  onOpenChange,
  onEmailChange,
  onRoleChange,
  onSave,
  onCancel,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? '修改角色' : '邀请成员'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-sm">邮箱</Label>
            <Input
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="member@example.com"
              disabled={isEdit}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">角色</Label>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onRoleChange(r)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs transition-colors',
                    role === r
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  {ROLE_CONFIG[r].label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button onClick={onSave} disabled={!email.trim() || isPending}>
            {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {isEdit ? '保存' : '邀请'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
