'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@ihui/ui'
import type { OAuthApp, OAuthAppForm } from './types'

interface CreateDialogProps {
  open: boolean
  form: OAuthAppForm
  setForm: React.Dispatch<React.SetStateAction<OAuthAppForm>>
  err: string | null
  savePending: boolean
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}

export function OauthAppCreateDialog({
  open,
  form,
  setForm,
  err,
  savePending,
  onSubmit,
  onClose,
}: CreateDialogProps) {
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
            <DialogTitle>新建 OAuth 应用</DialogTitle>
            <DialogDescription>创建开放平台 OAuth 应用</DialogDescription>
          </DialogHeader>
          {err && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {err}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="oa-name">应用名称</Label>
            <Input
              id="oa-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="oa-owner">所属用户ID</Label>
            <Input
              id="oa-owner"
              value={form.ownerId}
              onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="oa-redirect">回调地址（逗号分隔）</Label>
            <Input
              id="oa-redirect"
              value={form.redirectUris}
              onChange={(e) => setForm({ ...form, redirectUris: e.target.value })}
              placeholder="https://example.com/callback"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="oa-scopes">权限（逗号分隔）</Label>
            <Input
              id="oa-scopes"
              value={form.scopes}
              onChange={(e) => setForm({ ...form, scopes: e.target.value })}
              placeholder="user:read,user:write"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={savePending}>
              取消
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface DeleteDialogProps {
  target: OAuthApp | null
  err: string | null
  deletePending: boolean
  onConfirm: () => void
  onClose: () => void
}

export function OauthAppDeleteDialog({
  target,
  err,
  deletePending,
  onConfirm,
  onClose,
}: DeleteDialogProps) {
  return (
    <Dialog
      open={!!target}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>删除应用</DialogTitle>
          <DialogDescription>该操作不可恢复</DialogDescription>
        </DialogHeader>
        {err && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </div>
        )}
        <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
          <span className="font-medium">{target?.name}</span>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={deletePending}>
            取消
          </Button>
          <Button type="button" variant="destructive" disabled={deletePending} onClick={onConfirm}>
            {deletePending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
