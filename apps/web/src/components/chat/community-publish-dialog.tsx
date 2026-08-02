'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Image as ImageIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@ihui/ui-react'
import { useCommunityPublish } from '@/hooks/use-community-publish'
import { toast } from '@/components/common'

interface CommunityPublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** AI 消息正文(markdown 纯文本) */
  content: string
  /** 从 toolCalls 提取的图片 URL 列表 */
  images: string[]
}

/**
 * 社区发布对话框(2026-08-02 立,对齐原项目 AIChat.vue publishToCommunity)
 *
 * 用户点击 Megaphone 按钮后弹出,选择圈子 + 输入标题 → 发布。
 * 内容和图片自动从 AI 消息填充,用户只需选圈子 + 改标题即可。
 */
export function CommunityPublishDialog({
  open,
  onOpenChange,
  content,
  images,
}: CommunityPublishDialogProps) {
  const t = useTranslations('chat')
  const { circles, loadingCircles, publishing, fetchCircles, publish } = useCommunityPublish()
  const [circleId, setCircleId] = React.useState('')
  const [title, setTitle] = React.useState('')

  // 打开时拉取圈子列表 + 自动填充标题(取正文前 50 字符)
  React.useEffect(() => {
    if (open) {
      fetchCircles()
      setTitle(content.slice(0, 50).trim() || t('communityPublishDefaultTitle'))
    }
  }, [open, content, fetchCircles, t])

  const handlePublish = React.useCallback(async () => {
    if (!circleId) {
      toast.error(t('communityPublishSelectCircle'))
      return
    }
    if (!title.trim()) {
      toast.error(t('communityPublishTitleRequired'))
      return
    }
    const ok = await publish(circleId, title.trim(), content, images)
    if (ok) {
      toast.success(t('communityPublishSuccess'))
      onOpenChange(false)
    } else {
      toast.error(t('communityPublishFailed'))
    }
  }, [circleId, title, content, images, publish, onOpenChange, t])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('communityPublishTitle')}</DialogTitle>
          <DialogDescription>{t('communityPublishDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cp-circle">{t('communityPublishCircle')}</Label>
            {loadingCircles ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('communityPublishLoading')}</span>
              </div>
            ) : circles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('communityPublishNoCircles')}</p>
            ) : (
              <Select value={circleId} onValueChange={setCircleId}>
                <SelectTrigger id="cp-circle">
                  <SelectValue placeholder={t('communityPublishSelectCircle')} />
                </SelectTrigger>
                <SelectContent>
                  {circles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-title">{t('communityPublishTitleLabel')}</Label>
            <Input
              id="cp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('communityPublishTitlePlaceholder')}
            />
          </div>
          {images.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5" />
              <span>{t('communityPublishImagesCount', { count: images.length })}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>
            {t('communityPublishCancel')}
          </Button>
          <Button
            onClick={handlePublish}
            disabled={publishing || !circleId || circles.length === 0}
          >
            {publishing ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                {t('communityPublishing')}
              </>
            ) : (
              t('communityPublish')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
