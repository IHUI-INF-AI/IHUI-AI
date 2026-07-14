'use client'

import * as React from 'react'
import { Save, Loader2, Moon } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Switch } from '@ihui/ui'
import { Alert } from '@/components/feedback/Alert'
import { fetchApi } from '@/lib/api'

interface DarkConfig {
  enabled: boolean
  bgColor: string
  textColor: string
  borderColor: string
  accentColor: string
}

const DEFAULT: DarkConfig = {
  enabled: false,
  bgColor: '#0f172a',
  textColor: '#f1f5f9',
  borderColor: '#1e293b',
  accentColor: '#3b82f6',
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-xs" />
      </div>
    </div>
  )
}

export default function DarkModePage() {
  const [cfg, setCfg] = React.useState<DarkConfig>(DEFAULT)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const set = <K extends keyof DarkConfig>(k: K, v: DarkConfig[K]) =>
    setCfg((c) => ({ ...c, [k]: v }))

  React.useEffect(() => {
    fetchApi<DarkConfig>('/api/admin/themes/dark-mode').then((r) => {
      if (r.success && r.data) setCfg({ ...DEFAULT, ...r.data })
      else if (!r.success) setError(r.error ?? '加载失败')
      setLoading(false)
    })
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const r = await fetchApi('/api/admin/themes/dark-mode', {
      method: 'PUT',
      body: JSON.stringify(cfg),
    })
    setSaving(false)
    if (!r.success) setError(r.error ?? '保存失败')
  }

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">暗色模式</h1>
          <p className="mt-1 text-sm text-muted-foreground">配置站点暗色主题</p>
        </div>
        <Button type="submit" size="sm" disabled={saving}>
          <Save className="h-4 w-4" />
          保存
        </Button>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">全局启用暗色模式</p>
              <p className="text-xs text-muted-foreground">关闭后用户无法切换至暗色</p>
            </div>
          </div>
          <Switch checked={cfg.enabled} onCheckedChange={(v) => set('enabled', v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">暗色配色</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ColorField label="背景色" value={cfg.bgColor} onChange={(v) => set('bgColor', v)} />
          <ColorField label="文字色" value={cfg.textColor} onChange={(v) => set('textColor', v)} />
          <ColorField
            label="边框色"
            value={cfg.borderColor}
            onChange={(v) => set('borderColor', v)}
          />
          <ColorField
            label="强调色"
            value={cfg.accentColor}
            onChange={(v) => set('accentColor', v)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">亮色 / 暗色对比预览</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-slate-900">
            <p className="text-sm font-semibold">亮色模式</p>
            <p className="text-xs opacity-80">示例正文内容</p>
            <span className="inline-block rounded-md bg-blue-500 px-2 py-1 text-xs text-white">
              主按钮
            </span>
          </div>
          <div
            className="space-y-2 rounded-lg p-4"
            style={{
              backgroundColor: cfg.bgColor,
              color: cfg.textColor,
              borderColor: cfg.borderColor,
              borderWidth: 1,
            }}
          >
            <p className="text-sm font-semibold">暗色模式</p>
            <p className="text-xs opacity-80">示例正文内容</p>
            <span
              className="inline-block rounded-md px-2 py-1 text-xs text-white"
              style={{ backgroundColor: cfg.accentColor }}
            >
              主按钮
            </span>
          </div>
        </CardContent>
      </Card>

      {error && <Alert variant="danger" description={error} />}
    </form>
  )
}
