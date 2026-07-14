'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Save, X } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@ihui/ui'
import { Alert } from '@/components/feedback/Alert'
import { fetchApi } from '@/lib/api'

interface ThemeForm {
  name: string
  description: string
  baseColor: string
  accentColor: string
  bgColor: string
  textColor: string
  borderColor: string
  radius: string
  font: string
}

const EMPTY_FORM: ThemeForm = {
  name: '',
  description: '',
  baseColor: '#ffffff',
  accentColor: '#3b82f6',
  bgColor: '#ffffff',
  textColor: '#1f2937',
  borderColor: '#e5e7eb',
  radius: '8',
  font: 'system-ui',
}

const FONTS = ['system-ui', 'PingFang SC', 'Microsoft YaHei', 'Arial', 'Helvetica', 'Georgia']

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

export default function CreateThemePage() {
  const router = useRouter()
  const [form, setForm] = React.useState<ThemeForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  const set = <K extends keyof ThemeForm>(k: K, v: ThemeForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.name.trim()) {
      setErr('请输入主题名称')
      return
    }
    setSaving(true)
    const r = await fetchApi('/api/admin/themes', {
      method: 'POST',
      body: JSON.stringify({ ...form, radius: Number(form.radius) || 0 }),
    })
    setSaving(false)
    if (r.success) router.push('/admin/theme')
    else setErr(r.error ?? '保存失败')
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">创建主题</h1>

      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基础信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">主题名称 *</Label>
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="例如:默认主题"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">描述</Label>
              <Input
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="主题用途说明"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ColorField
                label="基础色"
                value={form.baseColor}
                onChange={(v) => set('baseColor', v)}
              />
              <ColorField
                label="强调色"
                value={form.accentColor}
                onChange={(v) => set('accentColor', v)}
              />
              <ColorField label="背景色" value={form.bgColor} onChange={(v) => set('bgColor', v)} />
              <ColorField
                label="文字色"
                value={form.textColor}
                onChange={(v) => set('textColor', v)}
              />
              <ColorField
                label="边框色"
                value={form.borderColor}
                onChange={(v) => set('borderColor', v)}
              />
              <div className="space-y-1.5">
                <Label className="text-xs">圆角 (px)</Label>
                <Input
                  type="number"
                  value={form.radius}
                  onChange={(e) => set('radius', e.target.value)}
                  className="h-8"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">字体</Label>
              <select
                value={form.font}
                onChange={(e) => set('font', e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">实时预览</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="space-y-3 p-4"
              style={{
                backgroundColor: form.bgColor,
                color: form.textColor,
                borderRadius: Number(form.radius) || 0,
                borderColor: form.borderColor,
                borderWidth: 1,
                fontFamily: form.font,
              }}
            >
              <p className="text-lg font-semibold">示例标题</p>
              <p className="text-sm opacity-80">这是一段示例正文,展示当前主题的视觉效果。</p>
              <div className="flex gap-2">
                <span
                  className="rounded-md px-3 py-1 text-xs font-medium"
                  style={{ backgroundColor: form.accentColor, color: '#fff' }}
                >
                  主按钮
                </span>
                <span
                  className="rounded-md px-3 py-1 text-xs font-medium"
                  style={{ borderColor: form.borderColor, borderWidth: 1, color: form.textColor }}
                >
                  次按钮
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: form.baseColor }}
                />
                <span className="text-xs">基础色</span>
                <span
                  className="ml-2 h-4 w-4 rounded-full"
                  style={{ backgroundColor: form.accentColor }}
                />
                <span className="text-xs">强调色</span>
              </div>
            </div>

            {err && <Alert variant="danger" description={err} className="mt-3" />}

            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.back()}
                disabled={saving}
              >
                <X className="h-4 w-4" />
                取消
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                <Save className="h-4 w-4" />
                保存
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
