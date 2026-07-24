'use client'

import { Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Label,
} from '@ihui/ui-react'

import { textareaClass, CHANNEL_LABEL } from './types'
import type { useWithdrawalDetail } from './useWithdrawalDetail'

type Props = ReturnType<typeof useWithdrawalDetail>

export function WithdrawalReviewDialog(props: Props) {
  const {
    reviewOpen,
    setReviewOpen,
    reviewForm,
    setReviewForm,
    reviewErr,
    submitReview,
    reviewMut,
  } = props

  return (
    <Dialog
      open={reviewOpen}
      onOpenChange={(o) => (o ? setReviewOpen(true) : (setReviewOpen(false), setReviewForm(null)))}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>审核提现</DialogTitle>
          <DialogDescription>审核提现申请并填写备注</DialogDescription>
        </DialogHeader>
        {reviewErr && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {reviewErr}
          </div>
        )}
        {reviewForm && (
          <div className="space-y-3">
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
              <div className="font-medium">{reviewForm.user ?? reviewForm.userName ?? '-'}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                ¥{(reviewForm.amount / 100).toFixed(2)} · {CHANNEL_LABEL[reviewForm.channel] ?? '-'}
              </div>
            </div>
            <div className="space-y-2">
              <Label>审核备注</Label>
              <textarea
                className={textareaClass}
                rows={4}
                value={reviewForm.notes ?? ''}
                onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
                placeholder="请输入审核备注"
              />
            </div>
            {reviewForm.weChatMsg && (
              <div className="space-y-2">
                <Label>提现记录(溯源)</Label>
                <textarea
                  className={textareaClass}
                  rows={6}
                  value={reviewForm.weChatMsg}
                  disabled
                />
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setReviewOpen(false)}>
            关闭
          </Button>
          <Button
            variant="destructive"
            disabled={reviewMut.isPending}
            onClick={() => submitReview('reject')}
          >
            退回
          </Button>
          <Button disabled={reviewMut.isPending} onClick={() => submitReview('approve')}>
            {reviewMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}通过
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
