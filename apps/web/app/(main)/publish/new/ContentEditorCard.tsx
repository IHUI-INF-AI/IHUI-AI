'use client'

/**
 * 内容编辑卡片(从 new/page.tsx 抽出)
 *
 * 包含:标题输入 + 格式选择 + 内容区(文本/文件)+ 封面上传。
 * 上传时显示 UploadProgress 进度条(XHR 真实进度)。
 *
 * AGENTS.md §4:rounded-md(禁 rounded-full)/ 无分割线 / 无渐变遮罩 / 中文字体对齐
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Upload } from 'lucide-react'
import { Card, CardContent, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@ihui/ui-react'
import { CONTENT_FORMAT_KEY } from '../helpers'
import { UploadProgress } from '@/components/publish/UploadProgress'
import { RichTextEditor } from '@/components/publish/RichTextEditor'

const FORMATS = ['md', 'docx', 'html', 'pdf', 'image', 'video'] as const
type Format = (typeof FORMATS)[number]

export interface UploadResult {
  readonly file_path: string
  readonly filename: string
  readonly format: string
  readonly size: number
  readonly content_type: string
}

export interface ContentEditorCardProps {
  readonly title: string
  readonly onTitleChange: (v: string) => void
  readonly format: Format
  readonly onFormatChange: (v: Format) => void
  readonly textContent: string
  readonly onTextContentChange: (v: string) => void
  readonly fileMeta: UploadResult | null
  readonly coverMeta: UploadResult | null
  readonly uploadingKey: 'file' | 'cover' | null
  readonly fileProgress: number
  readonly coverProgress: number
  readonly onUploadFile: (file: File) => void
  readonly onUploadCover: (file: File) => void
}

export function ContentEditorCard({
  title,
  onTitleChange,
  format,
  onFormatChange,
  textContent,
  onTextContentChange,
  fileMeta,
  coverMeta,
  uploadingKey,
  fileProgress,
  coverProgress,
  onUploadFile,
  onUploadCover,
}: ContentEditorCardProps) {
  const t = useTranslations('publish')
  const isTextFormat = format === 'md' || format === 'html'
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const coverInputRef = React.useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onUploadFile(file)
  }
  function handleCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onUploadCover(file)
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="space-y-2">
          <Label>{t('new.titleField')}</Label>
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={t('new.titlePlaceholder')}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>{t('new.contentFormat')}</Label>
          <Select value={format} onValueChange={(v) => onFormatChange(v as Format)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMATS.map((f) => (
                <SelectItem key={f} value={f}>
                  {t(CONTENT_FORMAT_KEY[f] ?? 'new.contentFormatUnknown')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{isTextFormat ? t('new.contentText') : t('new.uploadFile')}</Label>
          {format === 'md' ? (
            <RichTextEditor
              value={textContent}
              onChange={onTextContentChange}
              placeholder={t('new.contentTextPlaceholder')}
            />
          ) : format === 'html' ? (
            <textarea
              value={textContent}
              onChange={(e) => onTextContentChange(e.target.value)}
              rows={8}
              placeholder={t('new.contentTextPlaceholder')}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          ) : (
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-3 text-xs text-muted-foreground transition-colors hover:bg-accent">
                <Upload className="h-4 w-4" />
                <span>
                  {fileMeta
                    ? `${fileMeta.filename} · ${fileMeta.format}`
                    : t('new.uploadFileHint')}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  disabled={uploadingKey !== null}
                  onChange={handleFile}
                />
              </label>
              {uploadingKey === 'file' && (
                <UploadProgress
                  progress={fileProgress}
                  status="uploading"
                  fileName={fileMeta?.filename}
                />
              )}
              {fileMeta && uploadingKey !== 'file' && (
                <UploadProgress
                  progress={100}
                  status="success"
                  fileName={fileMeta.filename}
                  fileSize={fileMeta.size}
                />
              )}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t('new.coverImage')}</Label>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent">
            <Upload className="h-4 w-4" />
            <span>
              {coverMeta ? coverMeta.filename : t('new.coverImage')}
            </span>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingKey !== null}
              onChange={handleCover}
            />
          </label>
          {uploadingKey === 'cover' && (
            <UploadProgress
              progress={coverProgress}
              status="uploading"
              fileName={coverMeta?.filename}
            />
          )}
          {coverMeta && uploadingKey !== 'cover' && (
            <UploadProgress
              progress={100}
              status="success"
              fileName={coverMeta.filename}
              fileSize={coverMeta.size}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export type { Format }
export { FORMATS }
