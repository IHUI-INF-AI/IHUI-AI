// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'

import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'
import { ImageUpload } from '@/components/form/ImageUpload'
import { TYPES, selectClass } from './helpers'
import { TYPE_KEY } from '@/lib/feedback'
import type { FeedbackType } from './types'

/**
 * D192:截图类型白名单 —— 逐一对齐服务端图片档。
 *
 * 唯一真相源是 `apps/api/src/utils/file-type-validator.ts` 的 `EXT_MIME_MAP`,
 * 其中图片档只有 jpg / jpeg / png / gif / webp(bmp、tiff、svg、avif 均无键 ⇒
 * 服务端回 400「不支持的文件类型: .<ext>」)。此前反馈表单走 ImageUpload 的默认
 * `accept='image/*'`:选择器放行全部 image/*,用户挑到 bmp 只会看到一行
 * 「上传失败:HTTP 400」——静默过滤 + 无提示文案就是本格的缺口。
 * 收窄 accept 到真实白名单,并把白名单说成人话(`t('unsupportedImage')`)。
 */
const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/gif,image/webp'

interface Props {
  type: FeedbackType
  setType: (v: FeedbackType) => void
  title: string
  setTitle: (v: string) => void
  content: string
  setContent: (v: string) => void
  contact: string
  setContact: (v: string) => void
  images: string[]
  setImages: (v: string[]) => void
  formError: string | null
  isPending: boolean
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

export function FeedbackForm({
  type,
  setType,
  title,
  setTitle,
  content,
  setContent,
  contact,
  setContact,
  images,
  setImages,
  formError,
  isPending,
  onSubmit,
  onCancel,
}: Props) {
  const t = useTranslations('feedback')
  const tc = useTranslations('common')

  return (
    <Card>
      <CardContent className="min-[640px]:p-3 p-3">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fb-type">{t('type')}</Label>
            <Select value={type} onValueChange={(v) => setType(v as FeedbackType)}>
              <SelectTrigger className={selectClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {t(TYPE_KEY[v] ?? 'typeUnknown')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fb-title">{t('field_title')}</Label>
            <Input
              id="fb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('titlePlaceholder')}
              maxLength={128}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fb-content">{t('field_content')}</Label>
            <textarea
              id="fb-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('contentPlaceholder')}
              maxLength={5000}
              rows={6}
              className="flex w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fb-contact">{t('field_contact')}</Label>
            <Input
              id="fb-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={t('contactPlaceholder')}
              maxLength={128}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fb-images">{t('field_images')}</Label>
            <ImageUpload
              value={images}
              onChange={(v) => setImages(Array.isArray(v) ? v : [v])}
              multiple
              maxCount={5}
              accept={ACCEPTED_IMAGE_TYPES}
              placeholder={t('imagesPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">{t('unsupportedImage')}</p>
          </div>

          {formError && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? t('submitting') : t('submit')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
