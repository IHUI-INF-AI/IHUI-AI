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

import { selectClass } from './helpers'
import type { Category } from './types'

interface Props {
  title: string
  setTitle: (v: string) => void
  description: string
  setDescription: (v: string) => void
  categoryId: string
  setCategoryId: (v: string) => void
  categories: Category[]
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
  description,
  setDescription,
  categoryId,
  setCategoryId,
  categories,
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
          <Label htmlFor="description">描述</Label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="请输入资源描述"
            rows={4}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <Label>分类</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className={selectClass} aria-label="分类">
              <SelectValue placeholder="请选择分类" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
