'use client'

import * as React from 'react'
import { Loader2, Upload, FileText, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui-react'

import { TiptapRichText } from '@/components/form/TiptapRichText'
import { ImageUpload } from '@/components/form/ImageUpload'
import { selectClass, RESOURCE_TYPES } from './helpers'
import type { ResourceType } from './types'

interface Props {
  title: string
  setTitle: (v: string) => void
  intro: string
  setIntro: (v: string) => void
  cidList: string
  setCidList: (v: string) => void
  categories: { id: string; name: string }[]
  type: ResourceType
  setType: (v: ResourceType) => void
  productId: string
  setProductId: (v: string) => void
  tagIdList: string
  setTagIdList: (v: string) => void
  image: string
  setImage: (v: string) => void
  introduction: string
  setIntroduction: (v: string) => void
  fileName: string
  uploadPending: boolean
  uploadIsError: boolean
  uploadError: unknown
  formError: string | null
  savePending: boolean
  saveIsError: boolean
  saveError: unknown
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveFile: () => void
  onSubmit: () => void
  onCancel: () => void
  isEdit: boolean
}

export function ResourceForm({
  title,
  setTitle,
  intro,
  setIntro,
  cidList,
  setCidList,
  categories,
  type,
  setType,
  productId,
  setProductId,
  tagIdList,
  setTagIdList,
  image,
  setImage,
  introduction,
  setIntroduction,
  fileName,
  uploadPending,
  uploadIsError,
  uploadError,
  formError,
  savePending,
  saveIsError,
  saveError,
  onFileChange,
  onRemoveFile,
  onSubmit,
  onCancel,
  isEdit,
}: Props) {
  const t = useTranslations('resourceFormPage')
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('cardTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">{t('fields.title.label')}</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('fields.title.placeholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="intro">{t('fields.intro.label')}</Label>
          <textarea
            id="intro"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder={t('fields.intro.placeholder')}
            rows={3}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cidList">{t('fields.cidList.label')}</Label>
          <Input
            id="cidList"
            value={cidList}
            onChange={(e) => setCidList(e.target.value)}
            placeholder={t('fields.cidList.placeholder')}
          />
          {categories.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('fields.cidList.available')}: {categories.map((c) => c.name).join(' / ')}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>{t('fields.type.label')}</Label>
          <Select value={type} onValueChange={(v) => setType(v as ResourceType)}>
            <SelectTrigger className={selectClass} aria-label={t('fields.type.label')}>
              <SelectValue placeholder={t('fields.type.placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {RESOURCE_TYPES.map((rt) => (
                <SelectItem key={rt.value} value={rt.value}>
                  {rt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="productId">{t('fields.productId.label')}</Label>
          <Input
            id="productId"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder={t('fields.productId.placeholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tagIdList">{t('fields.tagIdList.label')}</Label>
          <Input
            id="tagIdList"
            value={tagIdList}
            onChange={(e) => setTagIdList(e.target.value)}
            placeholder={t('fields.tagIdList.placeholder')}
          />
        </div>

        <div className="space-y-2">
          <Label>{t('fields.image.label')}</Label>
          <ImageUpload
            value={image || undefined}
            onChange={(v) => setImage(typeof v === 'string' ? v : (v[0] ?? ''))}
            uploadUrl="/api/files/upload"
            placeholder={t('fields.image.placeholder')}
          />
        </div>

        <div className="space-y-2">
          <Label>{t('fields.introduction.label')}</Label>
          <TiptapRichText
            value={introduction}
            onChange={setIntroduction}
            placeholder={t('fields.introduction.placeholder')}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label>{t('fields.file.label')}</Label>
          {fileName ? (
            <div className="flex items-center justify-between rounded-md border border-input px-3 py-2">
              <span className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                {fileName}
              </span>
              <button
                type="button"
                onClick={onRemoveFile}
                className="text-muted-foreground hover:text-destructive"
                aria-label={t('fields.file.removeLabel')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input px-3 py-6 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-primary">
              <Upload className="h-5 w-5" />
              {uploadPending ? t('fields.file.uploading') : t('fields.file.select')}
              <input
                type="file"
                className="hidden"
                onChange={onFileChange}
                disabled={uploadPending}
              />
            </label>
          )}
          {uploadIsError && (
            <p className="text-xs text-destructive">{(uploadError as Error)?.message}</p>
          )}
        </div>

        {formError && <p className="text-sm text-destructive">{formError}</p>}
        {saveIsError && !formError && (
          <p className="text-sm text-destructive">{(saveError as Error)?.message}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button onClick={onSubmit} disabled={savePending}>
            {savePending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? t('submit.edit') : t('submit.create')}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            {t('submit.cancel')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
