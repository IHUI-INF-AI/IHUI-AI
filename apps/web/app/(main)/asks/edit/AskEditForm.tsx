'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { Input, Textarea } from '@/components/form'

interface Props {
  title: string
  setTitle: (v: string) => void
  content: string
  setContent: (v: string) => void
  tagsText: string
  setTagsText: (v: string) => void
  formError: string | null
  pending: boolean
  onSubmit: () => void
  onCancel: () => void
  isEdit: boolean
}

export function AskEditForm({
  title,
  setTitle,
  content,
  setContent,
  tagsText,
  setTagsText,
  formError,
  pending,
  onSubmit,
  onCancel,
  isEdit,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{isEdit ? '编辑问题' : '发布问题'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          label="标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="请输入问题标题"
          maxLength={200}
        />
        <Textarea
          label="内容"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="请详细描述您的问题"
          rows={6}
        />
        <Input
          label="标签"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="多个标签用逗号分隔"
        />
        {formError && <p className="text-sm text-destructive">{formError}</p>}
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={onSubmit} disabled={pending}>
            {pending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {isEdit ? '保存修改' : '发布问题'}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
