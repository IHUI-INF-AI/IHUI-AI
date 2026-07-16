'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, UserPlus } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import { selectClass, api } from './helpers'
import type { MemberGroup } from './types'

interface Props {
  group: MemberGroup | null
  onClose: () => void
}

export function MembersDialog({ group, onClose }: Props) {
  const qc = useQueryClient()
  const [userId, setUserId] = React.useState('')
  const [role, setRole] = React.useState('member')

  const addMut = useMutation({
    mutationFn: () =>
      api(`/api/groups/${group?.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: userId.trim(), role: role || 'member' }),
      }),
    onSuccess: () => {
      toast.success('添加成员成功')
      qc.invalidateQueries({ queryKey: ['admin', 'member-groups'] })
      setUserId('')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  React.useEffect(() => {
    if (!group) {
      setUserId('')
      setRole('member')
    }
  }, [group])

  return (
    <Dialog open={group !== null} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            成员管理 · {group?.name}
          </DialogTitle>
          <DialogDescription>当前成员数：{group?.memberCount ?? 0}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!userId.trim()) return
            addMut.mutate()
          }}
          className="space-y-3"
        >
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">用户 ID</Label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="h-9"
              placeholder="用户 UUID"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">角色</Label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={selectClass}>
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={addMut.isPending}>
              关闭
            </Button>
            <Button type="submit" disabled={addMut.isPending || !userId.trim()}>
              {addMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              添加成员
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
