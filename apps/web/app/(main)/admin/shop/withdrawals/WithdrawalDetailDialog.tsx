'use client'

import { Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'

import { selectClass, inputSm, CHANNEL_LABEL, STATUS_LABEL, type WithdrawalItem } from './types'
import type { useWithdrawalDetail } from './useWithdrawalDetail'

type Props = ReturnType<typeof useWithdrawalDetail>

export function WithdrawalDetailDialog(props: Props) {
  const { dOpen, setDOpen, dEditing, dForm, setDForm, dErr, closeDetail, submitDetail, dSaveMut } =
    props

  return (
    <Dialog open={dOpen} onOpenChange={(o) => (o ? setDOpen(true) : closeDetail())}>
      <DialogContent>
        <form onSubmit={submitDetail} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{dEditing ? '编辑提现' : '新增提现'}</DialogTitle>
          </DialogHeader>
          {dErr && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {dErr}
            </div>
          )}
          <div className="space-y-2">
            <Label>用户 *</Label>
            <Input
              className={inputSm}
              value={dForm.user}
              onChange={(e) => setDForm({ ...dForm, user: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>金额(分) *</Label>
            <Input
              className={inputSm}
              type="number"
              value={dForm.amount}
              onChange={(e) => setDForm({ ...dForm, amount: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>渠道</Label>
            <Select
              value={dForm.channel}
              onValueChange={(v) => setDForm({ ...dForm, channel: v as WithdrawalItem['channel'] })}
            >
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>账户</Label>
            <Input
              className={inputSm}
              value={dForm.account}
              onChange={(e) => setDForm({ ...dForm, account: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>状态</Label>
            <Select
              value={dForm.status}
              onValueChange={(v) => setDForm({ ...dForm, status: v as WithdrawalItem['status'] })}
            >
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDetail}
              disabled={dSaveMut.isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={dSaveMut.isPending}>
              {dSaveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
