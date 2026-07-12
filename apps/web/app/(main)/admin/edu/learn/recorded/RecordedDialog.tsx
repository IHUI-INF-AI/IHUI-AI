'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import { ImageUpload } from '@/components/form/ImageUpload'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { selectClass } from '@/lib/edu'
import { TEXT_FIELDS } from './helpers'
import type { CForm, Video } from './types'

interface Props {
  open: boolean
  editing: Video | null
  form: CForm
  setForm: React.Dispatch<React.SetStateAction<CForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function RecordedDialog({
  open,
  editing,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? '编辑课程视频' : '新建课程视频'}</DialogTitle>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {TEXT_FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label>{f.label}</Label>
                <Input
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>付费</Label>
              <Select value={form.isPay} onValueChange={(v) => setForm({ ...form, isPay: v })}>
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">免费</SelectItem>
                  <SelectItem value="1">付费</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">初级</SelectItem>
                  <SelectItem value="1">中级</SelectItem>
                  <SelectItem value="2">高级</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>审核</Label>
              <Select
                value={form.auditStatus}
                onValueChange={(v) => setForm({ ...form, auditStatus: v })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">待审核</SelectItem>
                  <SelectItem value="1">审核中</SelectItem>
                  <SelectItem value="2">待整改</SelectItem>
                  <SelectItem value="3">已驳回</SelectItem>
                  <SelectItem value="4">已通过</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>封面图</Label>
            <ImageUpload
              value={form.binding}
              onChange={(v) => setForm({ ...form, binding: v as string })}
            />
          </div>
          <div className="space-y-2">
            <Label>内容</Label>
            <RichTextEditor
              value={form.content}
              onChange={(html) => setForm({ ...form, content: html })}
              placeholder="请输入视频内容"
            />
          </div>
          <div className="space-y-2">
            <Label>备注</Label>
            <RichTextEditor
              value={form.remark}
              onChange={(html) => setForm({ ...form, remark: html })}
              placeholder="请输入备注"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              取消
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="h-4 w-4 animate-spin" />}保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
