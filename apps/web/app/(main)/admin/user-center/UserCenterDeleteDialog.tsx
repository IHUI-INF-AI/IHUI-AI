'use client'
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
} from '@ihui/ui'
import { api, RESOURCE } from './helpers'

interface Props {
  target: string | null
  onClose: () => void
  onInvalidate: () => void
}

export function UserCenterDeleteDialog({ target, onClose, onInvalidate }: Props) {
  const delMut = useMutation({
    mutationFn: (uuid: string) => api(`${RESOURCE}/${uuid}`, { method: 'DELETE' }),
    onSuccess: () => {
      onInvalidate()
      toast.success('删除成功')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>确定要删除该用户记录吗？此操作不可撤销。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={delMut.isPending}>
            取消
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={delMut.isPending}
            onClick={() => target && delMut.mutate(target)}
          >
            {delMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
