'use client'

import * as React from 'react'
import { Loader2, Upload, FileText, X } from 'lucide-react'
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
} from '@ihui/ui'

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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">资源信息</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">标题</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="请输入资源标题"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="intro">描述</Label>
          <textarea
            id="intro"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="请输入资源描述"
            rows={3}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cidList">分类(多选,逗号分隔 ID)</Label>
          <Input
            id="cidList"
            value={cidList}
            onChange={(e) => setCidList(e.target.value)}
            placeholder="如:uuid1, uuid2"
          />
          {categories.length > 0 && (
            <p className="text-xs text-muted-foreground">
              可选分类: {categories.map((c) => c.name).join(' / ')}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>资源类型</Label>
          <Select value={type} onValueChange={(v) => setType(v as ResourceType)}>
            <SelectTrigger className={selectClass} aria-label="资源类型">
              <SelectValue placeholder="请选择资源类型" />
            </SelectTrigger>
            <SelectContent>
              {RESOURCE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="productId">产品 ID</Label>
          <Input
            id="productId"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder="请输入关联产品 ID"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tagIdList">标签(多选,逗号分隔 ID)</Label>
          <Input
            id="tagIdList"
            value={tagIdList}
            onChange={(e) => setTagIdList(e.target.value)}
            placeholder="如:tag-id-1, tag-id-2"
          />
        </div>

        <div className="space-y-2">
          <Label>展示图</Label>
          <ImageUpload
            value={image || undefined}
            onChange={(v) => setImage(typeof v === 'string' ? v : (v[0] ?? ''))}
            uploadUrl="/api/files/upload"
            placeholder="上传展示图"
          />
        </div>

        <div className="space-y-2">
          <Label>资源简介(富文本)</Label>
          <TiptapRichText
            value={introduction}
            onChange={setIntroduction}
            placeholder="请输入资源详细介绍..."
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label>文件上传</Label>
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
                aria-label="移除文件"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input px-3 py-6 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-primary">
              <Upload className="h-5 w-5" />
              {uploadPending ? '上传中...' : '点击上传文件'}
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
            {isEdit ? '保存修改' : '发布资源'}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
