'use client'

import * as React from 'react'
import { Input, Button } from '@ihui/ui-react'
import { Modal } from '@/components/feedback'
import type { AdminUser } from './types'

interface Props {
  user: AdminUser | null
  pending: boolean
  onConfirm: (password: string) => void
  onCancel: () => void
}

export function ResetPasswordDialog({ user, pending, onConfirm, onCancel }: Props) {
  const [pwd, setPwd] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [err, setErr] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (user) {
      setPwd('')
      setConfirm('')
      setErr(null)
      inputRef.current?.focus()
    }
  }, [user])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pwd.length < 6 || pwd.length > 20) return setErr('密码长度需为 6-20 位')
    if (!/[A-Za-z]/.test(pwd) || !/\d/.test(pwd)) return setErr('密码需同时包含字母和数字')
    if (pwd !== confirm) return setErr('两次输入不一致')
    onConfirm(pwd)
  }

  return (
    <Modal
      open={!!user}
      onClose={onCancel}
      title="重置密码"
      description={user ? `为 "${user.nickname || user.phone || user.id}" 设置新密码` : undefined}
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            取消
          </Button>
          <Button type="submit" form="reset-pwd-form" disabled={pending}>
            {pending ? '提交中…' : '确认重置'}
          </Button>
        </>
      }
    >
      <form id="reset-pwd-form" onSubmit={submit} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="reset-pwd" className="text-sm font-medium">
            新密码(6-20 位, 需含字母和数字)
          </label>
          <Input
            id="reset-pwd"
            ref={inputRef}
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="请输入新密码"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="reset-pwd-confirm" className="text-sm font-medium">
            确认新密码
          </label>
          <Input
            id="reset-pwd-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="请再次输入"
          />
        </div>
        {err && <p className="text-xs text-destructive">{err}</p>}
      </form>
    </Modal>
  )
}
