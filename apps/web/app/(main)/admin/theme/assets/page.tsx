'use client'

import * as React from 'react'
import { Upload, Trash2, Loader2, Image as ImageIcon } from 'lucide-react'

import { Button, Card, CardContent } from '@ihui/ui'
import { Alert } from '@/components/feedback/Alert'
import { fetchApi } from '@/lib/api'

interface Asset {
  id: string
  type: 'logo-light' | 'logo-dark' | 'favicon' | 'image'
  url: string
  name?: string
}

const UPLOAD_TYPES: { label: string; type: Asset['type'] }[] = [
  { label: 'Logo (亮色)', type: 'logo-light' },
  { label: 'Logo (暗色)', type: 'logo-dark' },
  { label: 'Favicon', type: 'favicon' },
]

export default function AssetsPage() {
  const [assets, setAssets] = React.useState<Asset[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const refs = React.useRef<Record<string, HTMLInputElement | null>>({})
  const imageRef = React.useRef<HTMLInputElement>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    const r = await fetchApi<Asset[]>('/api/admin/themes/assets')
    if (!r.success) setError(r.error ?? '加载失败')
    else setAssets(r.data ?? [])
    setLoading(false)
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  async function upload(type: Asset['type'], file: File) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', type)
    const r = await fetchApi('/api/admin/themes/assets', { method: 'POST', body: fd })
    if (r.success) load()
    else setError(r.error ?? '上传失败')
  }

  async function remove(id: string) {
    if (!window.confirm('确定删除此资产?')) return
    const r = await fetchApi(`/api/admin/themes/assets/${id}`, { method: 'DELETE' })
    if (r.success) load()
  }

  const findByType = (t: Asset['type']) => assets.find((a) => a.type === t)
  const images = assets.filter((a) => a.type === 'image')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">品牌资产</h1>
        <p className="mt-1 text-sm text-muted-foreground">管理 Logo / Favicon / 品牌图片</p>
      </div>

      {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {error && <Alert variant="danger" description={error} />}

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
          {UPLOAD_TYPES.map(({ label, type }) => {
            const cur = findByType(type)
            return (
              <div key={type} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-muted">
                    {cur ? (
                      <img src={cur.url} alt={label} className="h-full w-full object-contain" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => refs.current[type]?.click()}>
                      <Upload className="h-3.5 w-3.5" />
                      上传
                    </Button>
                    {cur && (
                      <Button variant="ghost" size="icon" onClick={() => remove(cur.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <input
                    ref={(el) => {
                      refs.current[type] = el
                    }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) upload(type, f)
                      e.target.value = ''
                    }}
                  />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">品牌图片库</p>
            <Button variant="outline" size="sm" onClick={() => imageRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />
              上传图片
            </Button>
            <input
              ref={imageRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                Array.from(e.target.files ?? []).forEach((f) => upload('image', f))
                e.target.value = ''
              }}
            />
          </div>
          {images.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">暂无图片</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {images.map((a) => (
                <div
                  key={a.id}
                  className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
                >
                  <img src={a.url} alt={a.name ?? ''} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    className="absolute right-1 top-1 rounded bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
