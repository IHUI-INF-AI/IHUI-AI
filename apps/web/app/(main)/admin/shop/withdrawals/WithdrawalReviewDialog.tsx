'use client'

import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

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

  const t = useTranslations('admin.shop')

  return (
    <Dialog
      open={reviewOpen}
      onOpenChange={(o) => (o ? setReviewOpen(true) : (setReviewOpen(false), setReviewForm(null)))}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('withdrawals.review.title')}</DialogTitle>
          <DialogDescription>{t('withdrawals.review.description')}</DialogDescription>
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
                ¥{(reviewForm.amount / 100).toFixed(2)} ·{' '}
                {t(CHANNEL_LABEL[reviewForm.channel] ?? '')}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('withdrawals.review.notes')}</Label>
              <textarea
                className={textareaClass}
                rows={4}
                value={reviewForm.notes ?? ''}
                onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
                placeholder={t('withdrawals.review.notesPlaceholder')}
              />
            </div>
            {reviewForm.weChatMsg && (
              <div className="space-y-2">
                <Label>{t('withdrawals.review.trace')}</Label>
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
        <DialogFooter className="gap-2 min-[640px]:flex-nowrap">
          <Button variant="outline" onClick={() => setReviewOpen(false)} className="shrink-0">
            <span className="whitespace-nowrap">{t('withdrawals.review.close')}</span>
          </Button>
          <Button
            variant="destructive"
            disabled={reviewMut.isPending}
            onClick={() => submitReview('reject')}
            className="shrink-0"
          >
            <span className="whitespace-nowrap">{t('withdrawals.review.return')}</span>
          </Button>
          <Button
            disabled={reviewMut.isPending}
            onClick={() => submitReview('approve')}
            className="shrink-0"
          >
            {reviewMut.isPending && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
            <span className="whitespace-nowrap">{t('withdrawals.review.approve')}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
