'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CreditCard, Loader2, Save, User } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@ihui/ui'

interface BusinessCard {
  id: string
  name: string
  title?: string | null
  company?: string | null
  phone?: string | null
  email?: string | null
  wechat?: string | null
  address?: string | null
  avatar?: string | null
  bio?: string | null
  template?: string
}

interface CardForm {
  name: string
  title: string
  company: string
  phone: string
  email: string
  wechat: string
  address: string
  avatar: string
  bio: string
  template: string
}

const TEMPLATES = [
  { value: 'minimal', label: '简约' },
  { value: 'business', label: '商务' },
  { value: 'creative', label: '创意' },
]

const FIELDS: { key: keyof CardForm; label: string; placeholder: string; type?: string }[] = [
  { key: 'name', label: '姓名 *', placeholder: '张三' },
  { key: 'title', label: '职位', placeholder: '产品经理' },
  { key: 'company', label: '公司', placeholder: 'XX 科技有限公司' },
  { key: 'phone', label: '电话', placeholder: '13800138000' },
  { key: 'email', label: '邮箱', placeholder: 'zhangsan@example.com', type: 'email' },
  { key: 'wechat', label: '微信', placeholder: 'zhangsan_wx' },
  { key: 'address', label: '地址', placeholder: '北京市朝阳区...' },
  { key: 'avatar', label: '头像 URL', placeholder: 'https://...' },
]

const EMPTY_FORM: CardForm = {
  name: '',
  title: '',
  company: '',
  phone: '',
  email: '',
  wechat: '',
  address: '',
  avatar: '',
  bio: '',
  template: 'minimal',
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export default function BusinessCardEditPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const qc = useQueryClient()

  const [form, setForm] = React.useState<CardForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)
  const [loaded, setLoaded] = React.useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['business-card', editId],
    queryFn: () => api<BusinessCard>(`/api/business-card/${editId}`),
    enabled: !!editId,
  })

  React.useEffect(() => {
    if (data && !loaded) {
      setForm({
        name: data.name,
        title: data.title ?? '',
        company: data.company ?? '',
        phone: data.phone ?? '',
        email: data.email ?? '',
        wechat: data.wechat ?? '',
        address: data.address ?? '',
        avatar: data.avatar ?? '',
        bio: data.bio ?? '',
        template: data.template ?? 'minimal',
      })
      setLoaded(true)
    }
  }, [data, loaded])

  const saveMut = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { template: form.template }
      for (const f of FIELDS) {
        const v = form[f.key].trim()
        body[f.key] = v || undefined
      }
      const url = editId ? `/api/business-card/${editId}` : '/api/business-card'
      return api(url, { method: editId ? 'PUT' : 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-card'] })
      router.push('/business-card')
    },
    onError: (e: Error) => setErr(e.message),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.name.trim()) {
      setErr('请输入姓名')
      return
    }
    saveMut.mutate()
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {editId ? '编辑名片' : '新建名片'}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">填写名片信息并选择模板样式</p>
      </header>

      <Link
        href="/business-card"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        返回列表
      </Link>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">名片信息</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              {err && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {err}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <div key={f.key} className="space-y-2">
                    <Label htmlFor={`bc-${f.key}`}>{f.label}</Label>
                    <Input
                      id={`bc-${f.key}`}
                      type={f.type ?? 'text'}
                      value={form[f.key]}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bc-bio">简介</Label>
                <textarea
                  id="bc-bio"
                  value={form.bio}
                  onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="一句话介绍自己..."
                />
              </div>

              <div className="space-y-2">
                <Label>模板</Label>
                <div className="flex gap-2">
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.value}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, template: tpl.value }))}
                      className={cn(
                        'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                        form.template === tpl.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-input text-muted-foreground hover:bg-accent',
                      )}
                    >
                      <User className="h-4 w-4" />
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/business-card')}
                  disabled={saveMut.isPending}
                >
                  取消
                </Button>
                <Button type="submit" disabled={saveMut.isPending}>
                  {saveMut.isPending ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-4 w-4" />
                  )}
                  保存
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
