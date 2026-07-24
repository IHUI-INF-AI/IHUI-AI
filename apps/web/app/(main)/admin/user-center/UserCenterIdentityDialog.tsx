'use client'
import * as React from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui-react'
import { api, RESOURCE, IDENTITY_OPTIONS, selectClass } from './helpers'
import type { UserCenter } from './types'

interface Props {
  target: UserCenter | null
  onClose: () => void
  onInvalidate: () => void
}

export function UserCenterIdentityDialog({ target, onClose, onInvalidate }: Props) {
  const [idForm, setIdForm] = React.useState({ uuid: '', type: '', tokenQuantity: '0' })

  React.useEffect(() => {
    if (target) {
      setIdForm({
        uuid: target.uuid,
        type: String(target.isVip ?? ''),
        tokenQuantity: '0',
      })
    }
  }, [target])

  const identityMut = useMutation({
    mutationFn: () =>
      api(`${RESOURCE}/identity`, {
        method: 'PUT',
        body: JSON.stringify({
          uuid: idForm.uuid,
          type: Number(idForm.type),
          tokenQuantity: Number(idForm.tokenQuantity),
        }),
      }),
    onSuccess: () => {
      onInvalidate()
      toast.success('身份修改成功')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function submitIdentity(e: React.FormEvent) {
    e.preventDefault()
    if (!idForm.type) {
      toast.error('请选择身份类型')
      return
    }
    identityMut.mutate()
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent>
        <form onSubmit={submitIdentity} className="space-y-4">
          <DialogHeader>
            <DialogTitle>修改身份</DialogTitle>
            <DialogDescription>设置用户身份类型和Token数量</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>身份类型</Label>
              <Select value={idForm.type} onValueChange={(v) => setIdForm({ ...idForm, type: v })}>
                <SelectTrigger className={selectClass}>
                  <SelectValue placeholder="请选择身份" />
                </SelectTrigger>
                <SelectContent>
                  {IDENTITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Token数量</Label>
              <Input
                type="number"
                value={idForm.tokenQuantity}
                onChange={(e) => setIdForm({ ...idForm, tokenQuantity: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={identityMut.isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={identityMut.isPending}>
              {identityMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}确认
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
