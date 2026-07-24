'use client'

import * as React from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button, Card, CardContent } from '@ihui/ui-react'
import { Alert } from '@/components/feedback/Alert'
import { fetchApi } from '@/lib/api'

interface Preset {
  id: string
  name: string
  baseColor: string
  accentColor: string
  bgColor: string
  textColor: string
  borderColor: string
  radius: number
}

const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'default',
    name: '默认',
    baseColor: '#ffffff',
    accentColor: '#3b82f6',
    bgColor: '#ffffff',
    textColor: '#1f2937',
    borderColor: '#e5e7eb',
    radius: 8,
  },
  {
    id: 'ocean',
    name: '海洋',
    baseColor: '#e0f2fe',
    accentColor: '#0ea5e9',
    bgColor: '#f0f9ff',
    textColor: '#0c4a6e',
    borderColor: '#bae6fd',
    radius: 12,
  },
  {
    id: 'forest',
    name: '森林',
    baseColor: '#dcfce7',
    accentColor: '#16a34a',
    bgColor: '#f0fdf4',
    textColor: '#14532d',
    borderColor: '#bbf7d0',
    radius: 10,
  },
  {
    id: 'sunset',
    name: '日落',
    baseColor: '#fed7aa',
    accentColor: '#f97316',
    bgColor: '#fff7ed',
    textColor: '#7c2d12',
    borderColor: '#fed7aa',
    radius: 14,
  },
  {
    id: 'aurora',
    name: '极光',
    baseColor: '#ddd6fe',
    accentColor: '#8b5cf6',
    bgColor: '#f5f3ff',
    textColor: '#4c1d95',
    borderColor: '#ddd6fe',
    radius: 16,
  },
  {
    id: 'retro',
    name: '复古',
    baseColor: '#fef3c7',
    accentColor: '#a16207',
    bgColor: '#fffbeb',
    textColor: '#451a03',
    borderColor: '#fde68a',
    radius: 4,
  },
  {
    id: 'minimal',
    name: '极简',
    baseColor: '#ffffff',
    accentColor: '#000000',
    bgColor: '#ffffff',
    textColor: '#000000',
    borderColor: '#000000',
    radius: 2,
  },
  {
    id: 'business',
    name: '商务',
    baseColor: '#e2e8f0',
    accentColor: '#475569',
    bgColor: '#f8fafc',
    textColor: '#0f172a',
    borderColor: '#cbd5e1',
    radius: 6,
  },
  {
    id: 'vibrant',
    name: '活力',
    baseColor: '#fce7f3',
    accentColor: '#ec4899',
    bgColor: '#fdf2f8',
    textColor: '#831843',
    borderColor: '#fbcfe8',
    radius: 12,
  },
  {
    id: 'elegant',
    name: '优雅',
    baseColor: '#f5f5f4',
    accentColor: '#78716c',
    bgColor: '#fafaf9',
    textColor: '#1c1917',
    borderColor: '#e7e5e4',
    radius: 8,
  },
]

export default function PresetsPage() {
  const router = useRouter()
  const [presets, setPresets] = React.useState<Preset[]>(DEFAULT_PRESETS)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [appliedId, setAppliedId] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetchApi<Preset[]>('/api/admin/themes/presets').then((r) => {
      if (r.success && r.data && r.data.length) setPresets(r.data)
      setLoading(false)
    })
  }, [])

  async function apply(p: Preset) {
    setError(null)
    const r = await fetchApi('/api/admin/themes/apply-preset', {
      method: 'POST',
      body: JSON.stringify({ presetId: p.id }),
    })
    if (r.success) setAppliedId(p.id)
    else setError(r.error ?? '应用失败')
  }

  async function copyEdit(p: Preset) {
    const r = await fetchApi<{ id?: string }>('/api/admin/themes', {
      method: 'POST',
      body: JSON.stringify({ ...p, name: `${p.name} (副本)` }),
    })
    if (r.success && r.data?.id) router.push(`/admin/theme/edit/${r.data.id}`)
    else if (r.success) router.push('/admin/theme')
    else setError(r.error ?? '复制失败')
  }

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">预设主题</h1>
        <p className="mt-1 text-sm text-muted-foreground">一键应用内置主题</p>
      </div>

      {error && <Alert variant="danger" description={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {presets.map((p) => (
          <Card key={p.id}>
            <div
              className="flex h-28 items-center justify-center"
              style={{
                backgroundColor: p.bgColor,
                color: p.textColor,
                borderRadius: p.radius,
              }}
            >
              <div className="text-center">
                <p className="text-base font-semibold">{p.name}</p>
                <span
                  className="mt-2 inline-block rounded-md px-3 py-1 text-xs"
                  style={{ backgroundColor: p.accentColor, color: '#fff' }}
                >
                  Button
                </span>
              </div>
            </div>
            <CardContent className="flex items-center justify-between p-3">
              <div className="flex gap-1">
                {[p.baseColor, p.accentColor, p.borderColor].map((c, i) => (
                  <span key={i} className="h-4 w-4 rounded border" style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => copyEdit(p)}>
                  <Copy className="h-3.5 w-3.5" />
                  复制编辑
                </Button>
                <Button size="sm" onClick={() => apply(p)}>
                  {appliedId === p.id ? <Check className="h-3.5 w-3.5" /> : null}
                  {appliedId === p.id ? '已应用' : '应用'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
