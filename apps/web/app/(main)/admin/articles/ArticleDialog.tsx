'use client'

import { Loader2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Switch,
} from '@ihui/ui'

import type { ArticleForm } from './types'

export interface ArticleDialogProps {
  open: boolean
  setOpen: (v: boolean) => void
  editing: boolean
  form: ArticleForm
  setForm: (v: ArticleForm) => void
  err: string | null
  saving: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export function ArticleDialog(props: ArticleDialogProps) {
  const { open, setOpen, editing, form, setForm, err, saving, onClose, onSubmit } = props
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : onClose())}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑文章' : '新建文章'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="art-title">标题</Label>
            <Input
              id="art-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="请输入文章标题"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="art-author">作者</Label>
              <Input
                id="art-author"
                value={form.authorName}
                onChange={(e) => setForm({ ...form, authorName: e.target.value })}
                placeholder="作者名称"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="art-summary">摘要</Label>
              <Input
                id="art-summary"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="文章摘要"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="art-content">正文</Label>
            <textarea
              id="art-content"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="文章正文"
              className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="art-published"
              checked={form.published}
              onCheckedChange={(v) => setForm({ ...form, published: v })}
            />
            <Label htmlFor="art-published">发布</Label>
            <span className="text-sm text-muted-foreground">
              {form.published ? '已发布' : '草稿'}
            </span>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              取消
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
