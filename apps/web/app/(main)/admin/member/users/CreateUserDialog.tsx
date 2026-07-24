'use client'

import {
  Input,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui-react'
import type { CreateUserForm } from './types'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  form: CreateUserForm
  onChange: (f: CreateUserForm) => void
  submitting: boolean
  onSubmit: (e: React.FormEvent) => void
}

export function CreateUserDialog({ open, onOpenChange, form, onChange, submitting, onSubmit }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建用户</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="member-create-nickname" className="text-sm font-medium">
              昵称
            </label>
            <Input
              id="member-create-nickname"
              aria-label="昵称"
              value={form.nickname}
              onChange={(e) => onChange({ ...form, nickname: e.target.value })}
              placeholder="请输入昵称"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="member-create-phone" className="text-sm font-medium">
                手机号
              </label>
              <Input
                id="member-create-phone"
                aria-label="手机号"
                value={form.phone}
                onChange={(e) => onChange({ ...form, phone: e.target.value })}
                placeholder="可选"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="member-create-email" className="text-sm font-medium">
                邮箱
              </label>
              <Input
                id="member-create-email"
                aria-label="邮箱"
                type="email"
                value={form.email}
                onChange={(e) => onChange({ ...form, email: e.target.value })}
                placeholder="可选"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="member-create-password" className="text-sm font-medium">
              密码(至少 6 位)
            </label>
            <Input
              id="member-create-password"
              aria-label="密码"
              type="password"
              value={form.password}
              onChange={(e) => onChange({ ...form, password: e.target.value })}
              placeholder="请输入密码"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '创建中…' : '创建'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
