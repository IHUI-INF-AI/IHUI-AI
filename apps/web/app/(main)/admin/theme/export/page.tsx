'use client'

import * as React from 'react'
import { Download, Upload, Loader2 } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle, Label } from '@ihui/ui'
import { Alert } from '@/components/feedback/Alert'
import { fetchApi } from '@/lib/api'

interface Theme {
  id: string
  name: string
}

type ExportFormat = 'json' | 'css' | 'tailwind'

const FORMAT_LABELS: { value: ExportFormat; label: string }[] = [
  { value: 'json', label: 'JSON' },
  { value: 'css', label: 'CSS Variables' },
  { value: 'tailwind', label: 'Tailwind Config' },
]

export default function ExportPage() {
  const [themes, setThemes] = React.useState<Theme[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [themeId, setThemeId] = React.useState('')
  const [format, setFormat] = React.useState<ExportFormat>('json')
  const [preview, setPreview] = React.useState('')
  const [importPreview, setImportPreview] = React.useState<string | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    fetchApi<Theme[]>('/api/admin/themes').then((r) => {
      if (r.success && r.data) {
        setThemes(r.data)
        if (r.data[0]) setThemeId(r.data[0].id)
      }
      setLoading(false)
    })
  }, [])

  async function genPreview() {
    if (!themeId) return
    setError(null)
    const r = await fetchApi<{ content: string }>(
      `/api/admin/themes/export?themeId=${themeId}&format=${format}`,
    )
    if (!r.success) setError(r.error ?? '生成失败')
    else if (r.data) setPreview(r.data.content)
  }

  async function download() {
    if (!themeId) return
    setError(null)
    const r = await fetchApi<{ content: string; filename?: string }>(
      `/api/admin/themes/export?themeId=${themeId}&format=${format}`,
    )
    if (!r.success || !r.data) {
      setError(!r.success ? (r.error ?? '导出失败') : '导出失败')
      return
    }
    const ext = format === 'json' ? 'json' : format === 'css' ? 'css' : 'js'
    const blob = new Blob([r.data.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = r.data.filename ?? `theme-${themeId}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  function onImportFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      try {
        JSON.parse(text)
        setImportPreview(text)
      } catch {
        setError('无效的 JSON 文件')
      }
    }
    reader.readAsText(file)
  }

  async function confirmImport() {
    if (!importPreview) return
    setError(null)
    const r = await fetchApi('/api/admin/themes/import', {
      method: 'POST',
      body: JSON.stringify({ content: importPreview }),
    })
    if (r.success) {
      setImportPreview(null)
      const rr = await fetchApi<Theme[]>('/api/admin/themes')
      if (rr.success && rr.data) setThemes(rr.data)
    } else {
      setError(r.error ?? '导入失败')
    }
  }

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">导出 / 导入</h1>
        <p className="mt-1 text-sm text-muted-foreground">主题配置的导出与导入</p>
      </div>

      {error && <Alert variant="danger" description={error} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">导出</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">选择主题</Label>
              <select
                value={themeId}
                onChange={(e) => setThemeId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                {themes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">格式</Label>
              <div className="flex gap-2">
                {FORMAT_LABELS.map((f) => (
                  <Button
                    key={f.value}
                    type="button"
                    variant={format === f.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFormat(f.value)}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={genPreview}>
                预览
              </Button>
              <Button type="button" size="sm" onClick={download}>
                <Download className="h-4 w-4" />
                下载
              </Button>
            </div>
            {preview && (
              <pre className="max-h-60 overflow-auto rounded-md bg-muted p-3 text-xs">
                {preview}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">导入</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileRef.current?.click()
                }
              }}
            >
              <Upload className="h-6 w-6" />
              <span>点击选择 .json 文件</span>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onImportFile(f)
                  e.target.value = ''
                }}
              />
            </div>
            {importPreview && (
              <>
                <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {importPreview}
                </pre>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setImportPreview(null)}
                  >
                    取消
                  </Button>
                  <Button type="button" size="sm" onClick={confirmImport}>
                    确认导入
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
