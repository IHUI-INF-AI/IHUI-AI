'use client'

import * as React from 'react'
import Link from 'next/link'
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react'

import { Button, Card, CardContent, Switch } from '@ihui/ui'
import { Alert } from '@/components/feedback/Alert'
import { fetchApi } from '@/lib/api'

interface Theme {
  id: string
  name: string
  description?: string
  baseColor: string
  accentColor: string
  bgColor: string
  textColor: string
  borderColor: string
  radius: number
  font?: string
  isActive: boolean
  createdAt?: string
}

export default function ThemeListPage() {
  const [themes, setThemes] = React.useState<Theme[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const r = await fetchApi<Theme[]>('/api/admin/themes')
    if (r.success && r.data) setThemes(r.data)
    else if (!r.success) setError(r.error ?? '加载失败')
    setLoading(false)
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  async function toggleActive(t: Theme) {
    const r = await fetchApi(`/api/admin/themes/${t.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !t.isActive }),
    })
    if (r.success) load()
  }

  async function handleDelete(t: Theme) {
    if (!window.confirm(`确定删除主题"${t.name}"吗?`)) return
    const r = await fetchApi(`/api/admin/themes/${t.id}`, { method: 'DELETE' })
    if (r.success) load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">主题列表</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理站点主题与外观配置</p>
        </div>
        <Button size="sm" asChild>
          <Link href="/admin/theme/create">
            <Plus className="h-4 w-4" />
            创建主题
          </Link>
        </Button>
      </div>

      {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {error && <Alert variant="danger" description={error} />}

      {!loading && !error && themes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            暂无主题,点击右上角&quot;创建主题&quot;开始
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((t) => (
          <Card key={t.id} className="overflow-hidden">
            <div
              className="flex h-24 items-center justify-center"
              style={{
                backgroundColor: t.bgColor,
                color: t.textColor,
                borderRadius: t.radius,
                fontFamily: t.font,
              }}
            >
              <span className="text-base font-semibold">{t.name}</span>
            </div>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t.name}</p>
                  {t.description && (
                    <p className="truncate text-xs text-muted-foreground">{t.description}</p>
                  )}
                </div>
                <Switch checked={t.isActive} onCheckedChange={() => toggleActive(t)} />
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="h-4 w-4 rounded-full border"
                  style={{ backgroundColor: t.baseColor }}
                />
                <span
                  className="h-4 w-4 rounded-full border"
                  style={{ backgroundColor: t.accentColor }}
                />
                <span
                  className="h-4 w-4 rounded-full border"
                  style={{ backgroundColor: t.borderColor }}
                />
                <div className="ml-auto flex gap-1">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/admin/theme/edit/${t.id}`}>
                      <Edit className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(t)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
