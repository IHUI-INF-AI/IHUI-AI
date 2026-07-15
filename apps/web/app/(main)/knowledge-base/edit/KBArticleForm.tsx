'use client'

import { Loader2, Send } from 'lucide-react'
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
import { selectClass, type KBCategory, type KBForm } from './helpers'
import { TagInput } from './TagInput'

interface Props {
  form: KBForm
  categories: KBCategory[]
  tagInput: string
  err: string | null
  submitting: boolean
  submitLabel?: string
  onFormChange: (form: KBForm) => void
  onTagInputChange: (v: string) => void
  onAddTag: () => void
  onRemoveTag: (tag: string) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

export function KBArticleForm({
  form,
  categories,
  tagInput,
  err,
  submitting,
  submitLabel = '发布',
  onFormChange,
  onTagInputChange,
  onAddTag,
  onRemoveTag,
  onSubmit,
  onCancel,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">文章信息</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="kb-title">标题</Label>
            <Input
              id="kb-title"
              value={form.title}
              onChange={(e) => onFormChange({ ...form, title: e.target.value })}
              placeholder="输入文章标题"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kb-summary">摘要</Label>
            <Input
              id="kb-summary"
              value={form.summary}
              onChange={(e) => onFormChange({ ...form, summary: e.target.value })}
              placeholder="一句话描述文章内容"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kb-category">分类</Label>
            <Select
              value={form.categoryId}
              onValueChange={(v) => onFormChange({ ...form, categoryId: v })}
            >
              <SelectTrigger className={selectClass} id="kb-category">
                <SelectValue placeholder="选择分类" />
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
            <Label htmlFor="kb-tags">标签</Label>
            <TagInput
              tags={form.tags}
              value={tagInput}
              onChange={onTagInputChange}
              onAdd={onAddTag}
              onRemove={onRemoveTag}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kb-content">正文(Markdown)</Label>
            <textarea
              id="kb-content"
              value={form.content}
              onChange={(e) => onFormChange({ ...form, content: e.target.value })}
              rows={14}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="支持 Markdown 语法..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4" />
              )}
              {submitLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
