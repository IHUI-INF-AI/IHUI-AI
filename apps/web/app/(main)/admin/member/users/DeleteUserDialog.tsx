'use client'

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import type { MemberUser } from './types'

interface Props {
  target: MemberUser | null
  onOpenChange: (open: boolean) => void
  submitting: boolean
  onConfirm: () => void
}

export function DeleteUserDialog({ target, onOpenChange, submitting, onConfirm }: Props) {
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>删除用户</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          确认要删除用户
          <span className="mx-1 font-medium text-foreground">
            "
            {target?.nickname || target?.phone || target?.email || target?.id}
            "
          </span>
          吗?此操作不可恢复。
        </p>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={submitting}>
            {submitting ? '删除中…' : '删除'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
