'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@ihui/ui'
import { Textarea } from '@/components/form'
import { Avatar } from '@/components/data/Avatar'
import type { CommunityPost } from './community-feed-panel'

interface CommentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  post: CommunityPost | null
  onSubmitSuccess?: (post: CommunityPost) => void
}

/**
 * CommentDialog - 评论对话框
 * 顶部展示原帖(头像/用户名/内容),下方评论输入框 + 提交按钮
 */
export function CommentDialog({ open, onOpenChange, post, onSubmitSuccess }: CommentDialogProps) {
  const tc = useTranslations('community')
  const tCommon = useTranslations('common')
  const [content, setContent] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setContent('')
      setSubmitting(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!post) return
    if (!content.trim()) {
      toast.error(tc('commentContentRequired'))
      return
    }
    setSubmitting(true)
    // mock:模拟异步提交
    await new Promise((r) => setTimeout(r, 300))
    toast.success(tc('commentSuccess'))
    onSubmitSuccess?.({ ...post, comments: post.comments + 1 })
    onOpenChange(false)
  }

  if (!post) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{tc('comment')}</DialogTitle>
        </DialogHeader>

        {/* 原帖展示 */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex gap-3">
            <Avatar src={post.userAvatar} name={post.userName} size="md" />
            <div className="flex-1 min-w-0">
              <div className="mb-1 text-sm font-semibold">{post.userName}</div>
              <div className="text-sm text-muted-foreground line-clamp-3">{post.content}</div>
            </div>
          </div>
        </div>

        {/* 评论输入框 */}
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={tc('writeComment')}
          maxLength={500}
          showCounter
          rows={4}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <span>{tCommon('cancel')}</span>
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            <span>{submitting ? '...' : tc('submitComment')}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
