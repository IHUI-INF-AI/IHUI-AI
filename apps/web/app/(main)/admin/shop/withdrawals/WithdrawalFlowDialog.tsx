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
} from '@ihui/ui-react'

import { selectClass, inputSm, textareaClass, FLOW_STATUS } from './types'
import type { useWithdrawalFlow } from './useWithdrawalFlow'

type Props = ReturnType<typeof useWithdrawalFlow>

export function WithdrawalFlowDialog(props: Props) {
  const { fOpen, setFOpen, fEditing, fForm, setFForm, fErr, closeFlow, submitFlow, fSaveMut } =
    props

  return (
    <Dialog open={fOpen} onOpenChange={(o) => (o ? setFOpen(true) : closeFlow())}>
      <DialogContent>
        <form onSubmit={submitFlow} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{fEditing ? '编辑流水' : '新增流水'}</DialogTitle>
          </DialogHeader>
          {fErr && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {fErr}
            </div>
          )}
          <div className="space-y-2">
            <Label>用户ID *</Label>
            <Input
              className={inputSm}
              value={fForm.userId}
              onChange={(e) => setFForm({ ...fForm, userId: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>金额(分) *</Label>
            <Input
              className={inputSm}
              type="number"
              value={fForm.amount}
              onChange={(e) => setFForm({ ...fForm, amount: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>外部单号 *</Label>
            <Input
              className={inputSm}
              value={fForm.outBillNo}
              onChange={(e) => setFForm({ ...fForm, outBillNo: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>状态</Label>
            <Select value={fForm.status} onValueChange={(v) => setFForm({ ...fForm, status: v })}>
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FLOW_STATUS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>转账详情</Label>
            <textarea
              className={textareaClass}
              rows={3}
              value={fForm.transferDetail}
              onChange={(e) => setFForm({ ...fForm, transferDetail: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeFlow}
              disabled={fSaveMut.isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={fSaveMut.isPending}>
              {fSaveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
