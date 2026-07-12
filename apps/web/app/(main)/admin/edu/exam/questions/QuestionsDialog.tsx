'use client'
import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { selectClass, textareaClass } from '@/lib/edu'
import { cn } from '@/lib/utils'
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
import { TYPES } from './helpers'
import type { QForm, QType, Question } from './types'

interface Props {
  open: boolean
  editing: Question | null
  form: QForm
  onFormChange: (patch: Partial<QForm>) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  pending: boolean
  err: string | null
}

export function QuestionsDialog({
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
      <DialogContent className="max-w-2xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑题目' : '新建题目'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="q-type">题型</Label>
              <Select value={form.type} onValueChange={(v) => onFormChange({ type: v as QType })}>
                <SelectTrigger className={selectClass} id="q-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="q-score">分值</Label>
              <Input
                id="q-score"
                type="number"
                min="0"
                value={form.score}
                onChange={(e) => onFormChange({ score: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-title">题干</Label>
            <textarea
              id="q-title"
              value={form.title}
              onChange={(e) => onFormChange({ title: e.target.value })}
              rows={2}
              className={cn(textareaClass, 'font-sans')}
              placeholder="请输入题干内容"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="q-options">选项 (JSON)</Label>
              <textarea
                id="q-options"
                value={form.options}
                onChange={(e) => onFormChange({ options: e.target.value })}
                rows={4}
                className={textareaClass}
                placeholder='[{"key":"A","text":"选项一"}]'
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="q-answer">答案 (JSON)</Label>
              <textarea
                id="q-answer"
                value={form.answer}
                onChange={(e) => onFormChange({ answer: e.target.value })}
                rows={4}
                className={textareaClass}
                placeholder='"A" 或 ["A","B"] 或 true'
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="q-sort">排序</Label>
              <Input
                id="q-sort"
                type="number"
                min="0"
                value={form.sortOrder}
                onChange={(e) => onFormChange({ sortOrder: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="q-analysis">解析</Label>
              <Input
                id="q-analysis"
                value={form.analysis}
                onChange={(e) => onFormChange({ analysis: e.target.value })}
                placeholder="解析(选填)"
              />
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
