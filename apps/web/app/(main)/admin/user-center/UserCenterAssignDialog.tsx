'use client'
import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui-react'
import { api, RESOURCE, th } from './helpers'
import type { UserCenter, AssignUser } from './types'

interface Props {
  target: UserCenter | null
  onClose: () => void
}

export function UserCenterAssignDialog({ target, onClose }: Props) {
  const [assignList, setAssignList] = React.useState<AssignUser[]>([])
  const [assignLoading, setAssignLoading] = React.useState(false)
  const [selectedAssign, setSelectedAssign] = React.useState<AssignUser | null>(null)

  React.useEffect(() => {
    if (!target) return
    setSelectedAssign(null)
    setAssignLoading(true)
    api<{ list: AssignUser[] }>('/api/admin/users/course-users')
      .then((res) => setAssignList(res.list ?? []))
      .catch(() => setAssignList([]))
      .finally(() => setAssignLoading(false))
  }, [target])

  const assignMut = useMutation({
    mutationFn: () =>
      api(`${RESOURCE}/assign`, {
        method: 'POST',
        body: JSON.stringify({ userUuid: target?.uuid, sysUserId: selectedAssign?.userId }),
      }),
    onSuccess: () => {
      toast.success('分配用户成功')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function submitAssign() {
    if (!selectedAssign) {
      toast.error('请选择用户')
      return
    }
    assignMut.mutate()
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>分配用户</DialogTitle>
          <DialogDescription>选择要关联的系统用户</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto rounded-md border">
          {assignLoading ? (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              加载中…
            </div>
          ) : assignList.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">暂无可分配用户</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className={th}>用户名</th>
                  <th className={th}>昵称</th>
                  <th className={th}>角色</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {assignList.map((u) => (
                  <tr
                    key={u.userId}
                    className={`cursor-pointer hover:bg-muted/30 ${selectedAssign?.userId === u.userId ? 'bg-primary/10' : ''}`}
                    onClick={() => setSelectedAssign(u)}
                  >
                    <td className="px-4 py-2.5 font-medium">{u.userName ?? '-'}</td>
                    <td className="px-4 py-2.5">{u.nickname ?? '-'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{u.roles ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={assignMut.isPending}>
            取消
          </Button>
          <Button
            type="button"
            disabled={!selectedAssign || assignMut.isPending}
            onClick={submitAssign}
          >
            {assignMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}确认分配
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
