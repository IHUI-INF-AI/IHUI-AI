'use client'
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { selectClass } from '@/lib/edu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import type { Paper, PaperForm } from './types'

interface Props {
  open: boolean
  editing: Paper | null
  form: PaperForm
  onFormChange: (patch: Partial<PaperForm>) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  pending: boolean
  err: string | null
}

export function ExamDialog({
  open,
  editing,
  form,
  onFormChange,
  onClose,
  onSubmit,
  pending,
  err,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑试卷' : '新建试卷'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="p-title">标题</Label>
            <Input
              id="p-title"
              value={form.title}
              onChange={(e) => onFormChange({ title: e.target.value })}
              placeholder="请输入试卷标题"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-desc">描述</Label>
            <Input
              id="p-desc"
              value={form.description}
              onChange={(e) => onFormChange({ description: e.target.value })}
              placeholder="试卷描述(选填)"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="p-total">总分</Label>
              <Input
                id="p-total"
                type="number"
                min="0"
                value={form.totalScore}
                onChange={(e) => onFormChange({ totalScore: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-pass">及格分</Label>
              <Input
                id="p-pass"
                type="number"
                min="0"
                value={form.passScore}
                onChange={(e) => onFormChange({ passScore: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-dur">时长(分钟)</Label>
              <Input
                id="p-dur"
                type="number"
                min="1"
                max="600"
                value={form.duration}
                onChange={(e) => onFormChange({ duration: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="p-pub">发布状态</Label>
              <Select
                value={form.isPublished ? 'true' : 'false'}
                onValueChange={(v) => onFormChange({ isPublished: v === 'true' })}
              >
                <SelectTrigger className={selectClass} id="p-pub">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">未发布</SelectItem>
                  <SelectItem value="true">已发布</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-rand">随机组卷</Label>
              <Select
                value={form.isRandom ? 'true' : 'false'}
                onValueChange={(v) => onFormChange({ isRandom: v === 'true' })}
              >
                <SelectTrigger className={selectClass} id="p-rand">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">否</SelectItem>
                  <SelectItem value="true">是</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              取消
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
