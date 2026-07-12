'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { fetchApi } from '@/lib/api'
import { Button, Input, Label } from '@ihui/ui'
import { Loader2, ShieldCheck, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export default function SsoLoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectUrl = searchParams.get('redirect') || '/'
  const clientId = searchParams.get('client_id') || 'web'

  const { token, user } = useAuthStore()
  const [account, setAccount] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [exchanging, setExchanging] = React.useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!account.trim() || !password) {
      toast.error('请输入账号和密码')
      return
    }
    setLoading(true)
    try {
      const r = await fetchApi<{
        accessToken: string
        user: {
          id: string
          nickname: string
          avatar?: string
          roleId?: number
          permissions?: string[]
        }
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ account, password }),
      })
      if (r.success && r.data) {
        useAuthStore.getState().setToken(r.data.accessToken)
        useAuthStore.getState().setUser({
          ...r.data.user,
          permissions: r.data.user.permissions ?? [],
        })
        toast.success('登录成功')
        await generateCodeAndRedirect()
      } else {
        toast.error(!r.success ? r.error : '登录失败')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  async function generateCodeAndRedirect() {
    const currentToken = useAuthStore.getState().token
    if (!currentToken) return
    setExchanging(true)
    try {
      const r = await fetchApi<{ code: string; redirectUri: string }>('/api/auth/sso/code', {
        method: 'POST',
        body: JSON.stringify({ clientId, redirectUri: redirectUrl }),
      })
      if (r.success && r.data?.code) {
        const separator = redirectUrl.includes('?') ? '&' : '?'
        router.push(`${redirectUrl}${separator}sso_code=${r.data.code}`)
      } else {
        toast.error(!r.success ? r.error : '生成授权码失败')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '生成授权码失败')
    } finally {
      setExchanging(false)
    }
  }

  if (token && user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 shadow-sm">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-semibold">已登录</h1>
            <p className="text-sm text-muted-foreground">
              正在为 <span className="font-medium text-foreground">{clientId}</span> 授权…
            </p>
          </div>
          <Button
            className="w-full"
            onClick={() => generateCodeAndRedirect()}
            disabled={exchanging}
          >
            {exchanging ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            授权并跳转
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">统一登录</h1>
          <p className="text-sm text-muted-foreground">
            登录后将为 <span className="font-medium text-foreground">{clientId}</span> 授权并跳转
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label>账号</Label>
            <Input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="手机号 / 邮箱 / 用户名"
              autoComplete="username"
            />
          </div>
          <div className="space-y-1.5">
            <Label>密码</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || exchanging}>
            {loading || exchanging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            登录并授权
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          授权后将自动跳转回目标应用，登录态将在各子项目间共享。
        </p>
      </div>
    </div>
  )
}
