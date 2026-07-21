'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ihui/ui'
import { Textarea } from '@/components/form'

interface CommunityPublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const CONTENT_TYPES = ['image', 'video', 'audio', 'music', 'article', 'code'] as const
type ContentType = (typeof CONTENT_TYPES)[number]

const AI_SOURCES = [
  { value: 'midjourney', label: 'Midjourney' },
  { value: 'dall-e', label: 'DALL-E' },
  { value: 'sora', label: 'Sora' },
  { value: 'suno', label: 'Suno' },
  { value: 'claude', label: 'Claude' },
  { value: 'gpt-4', label: 'GPT-4' },
] as const

interface PublishForm {
  title: string
  contentType: ContentType | ''
  content: string
  description: string
  prompt: string
  tags: string
  aiSource: string
}

const INITIAL_FORM: PublishForm = {
  title: '',
  contentType: '',
  content: '',
  description: '',
  prompt: '',
  tags: '',
  aiSource: '',
}

/**
 * CommunityPublishDialog - 发布创作弹窗
 * 字段:title(2-100) + contentType(必选) + content(URL) + description(选填) +
 *      prompt(选填) + tags(选填) + aiSource(必选)
 * 校验失败 toast 提示,提交成功 toast + 重置表单
 */
export function CommunityPublishDialog({ open, onOpenChange, onSuccess }: CommunityPublishDialogProps) {
  const tc = useTranslations('community')
  const tCommon = useTranslations('common')
  const [form, setForm] = React.useState<PublishForm>(INITIAL_FORM)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setForm(INITIAL_FORM)
      setSubmitting(false)
    }
  }, [open])

  const update = <K extends keyof PublishForm>(key: K, value: PublishForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const validate = (): string | null => {
    if (!form.title.trim()) return tc('publish.titleRequired')
    if (form.title.trim().length < 2 || form.title.trim().length > 100) return tc('publish.titleLength')
    if (!form.contentType) return tc('publish.typeRequired')
    if (!form.content.trim()) return tc('publish.contentRequired')
    if (!form.aiSource) return tc('publish.aiSourceRequired')
    return null
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) {
      toast.error(err)
      return
    }
    setSubmitting(true)
    // mock:模拟异步提交
    await new Promise((r) => setTimeout(r, 500))
    toast.success(tc('publish.success'))
    onOpenChange(false)
    onSuccess?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[600px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tc('publish.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* 标题 */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="publish-title">{tc('publish.titleLabel')}</Label>
            <Input
              id="publish-title"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder={tc('publish.titlePlaceholder')}
              maxLength={100}
            />
          </div>

          {/* 内容类型 */}
          <div className="flex flex-col gap-1.5">
            <Label>{tc('publish.contentType')}</Label>
            <Select value={form.contentType} onValueChange={(v) => update('contentType', v as ContentType)}>
              <SelectTrigger>
                <SelectValue placeholder={tc('publish.typeRequired')} />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {tc(`types.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 内容 URL */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="publish-content">{tc('publish.content')}</Label>
            <Input
              id="publish-content"
              value={form.content}
              onChange={(e) => update('content', e.target.value)}
              placeholder={tc('publish.contentUrlPlaceholder')}
            />
          </div>

          {/* 描述(选填) */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="publish-desc">{tc('publish.description')}</Label>
            <Textarea
              id="publish-desc"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder={tc('publish.descriptionPlaceholder')}
              rows={3}
            />
          </div>

          {/* 提示词(选填) */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="publish-prompt">{tc('publish.prompt')}</Label>
            <Textarea
              id="publish-prompt"
              value={form.prompt}
              onChange={(e) => update('prompt', e.target.value)}
              placeholder={tc('publish.promptPlaceholder')}
              rows={3}
            />
          </div>

          {/* 标签(选填) */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="publish-tags">{tc('publish.tags')}</Label>
            <Input
              id="publish-tags"
              value={form.tags}
              onChange={(e) => update('tags', e.target.value)}
              placeholder={tc('publish.addTag')}
            />
          </div>

          {/* AI 来源(必选) */}
          <div className="flex flex-col gap-1.5">
            <Label>{tc('publish.aiSource')}</Label>
            <Select value={form.aiSource} onValueChange={(v) => update('aiSource', v)}>
              <SelectTrigger>
                <SelectValue placeholder={tc('publish.selectAiSource')} />
              </SelectTrigger>
              <SelectContent>
                {AI_SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <span>{tCommon('cancel')}</span>
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            <span>{submitting ? '...' : tc('publish.submit')}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
