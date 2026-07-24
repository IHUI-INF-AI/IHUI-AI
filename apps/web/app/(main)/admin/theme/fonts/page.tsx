'use client'

import * as React from 'react'
import { Upload, Trash2, Loader2, Type } from 'lucide-react'

import { Button, Card, CardContent, Switch } from '@ihui/ui-react'
import { Alert } from '@/components/feedback/Alert'
import { fetchApi } from '@/lib/api'

interface FontItem {
  id: string
  name: string
  url?: string
  isSystem: boolean
  isActive: boolean
}

const SYSTEM_FONTS = [
  'system-ui',
  'PingFang SC',
  'Microsoft YaHei',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
]

export default function FontsPage() {
  const [list, setList] = React.useState<FontItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    const r = await fetchApi<FontItem[]>('/api/admin/themes/fonts')
    if (!r.success) setError(r.error ?? '加载失败')
    else setList(r.data ?? [])
    setLoading(false)
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  async function upload(file: File) {
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetchApi<FontItem>('/api/admin/themes/fonts', { method: 'POST', body: fd })
    if (r.success) load()
    else setError(r.error ?? '上传失败')
  }

  async function toggleActive(f: FontItem) {
    const r = await fetchApi(`/api/admin/themes/fonts/${f.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !f.isActive }),
    })
    if (r.success) load()
  }

  async function remove(id: string) {
    if (!window.confirm('确定删除此字体?')) return
    const r = await fetchApi(`/api/admin/themes/fonts/${id}`, { method: 'DELETE' })
    if (r.success) load()
  }

  async function addSystem(name: string) {
    const r = await fetchApi('/api/admin/themes/fonts', {
      method: 'POST',
      body: JSON.stringify({ name, isSystem: true }),
    })
    if (r.success) load()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">字体配置</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理自定义与系统字体</p>
      </div>

      {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {error && <Alert variant="danger" description={error} />}

      <Card>
        <CardContent className="space-y-3 p-4">
          <p className="text-sm font-medium">上传字体文件</p>
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileRef.current?.click()
              }
            }}
            role="button"
            tabIndex={0}
          >
            <Upload className="h-6 w-6" />
            <span>点击选择 .woff / .woff2 / .ttf 文件</span>
            <input
              ref={fileRef}
              type="file"
              accept=".woff,.woff2,.ttf,.otf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) upload(f)
                e.target.value = ''
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <p className="text-sm font-medium">系统字体</p>
          <div className="flex flex-wrap gap-2">
            {SYSTEM_FONTS.map((f) => (
              <Button key={f} variant="outline" size="sm" onClick={() => addSystem(f)}>
                + {f}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {list.map((f) => (
          <Card key={f.id}>
            <CardContent className="flex items-center gap-3 p-3">
              <Type className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="truncate text-xs" style={{ fontFamily: f.name }}>
                  永和九年,岁在癸丑,暮春之初。The quick brown fox.
                </p>
              </div>
              {f.isSystem && <span className="text-xs text-muted-foreground">系统</span>}
              <Switch checked={f.isActive} onCheckedChange={() => toggleActive(f)} />
              <Button variant="ghost" size="icon" onClick={() => remove(f.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
