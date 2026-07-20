'use client'

import * as React from 'react'
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react'

import { Button, Card, CardContent, Input, Label } from '@ihui/ui'
import { Alert, Tooltip } from '@/components/feedback'
import { fetchApi } from '@/lib/api'

interface ColorScheme {
  id: string
  name: string
  colors: string[]
}

const EMPTY_FORM = { name: '', colors: ['#ffffff', '#3b82f6', '#1f2937'] }

export default function ColorsPage() {
  const [list, setList] = React.useState<ColorScheme[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<ColorScheme | null>(null)
  const [form, setForm] = React.useState(EMPTY_FORM)
  const [showForm, setShowForm] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    const r = await fetchApi<ColorScheme[]>('/api/admin/themes/colors')
    if (!r.success) setError(r.error ?? '加载失败')
    else setList(r.data ?? [])
    setLoading(false)
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(c: ColorScheme) {
    setEditing(c)
    setForm({ name: c.name, colors: c.colors.length ? c.colors : ['#ffffff'] })
    setShowForm(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    const body = { name: form.name, colors: form.colors }
    const r = editing
      ? await fetchApi(`/api/admin/themes/colors/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      : await fetchApi('/api/admin/themes/colors', { method: 'POST', body: JSON.stringify(body) })
    if (r.success) {
      setShowForm(false)
      load()
    }
  }

  async function remove(id: string) {
    if (!window.confirm('确定删除此颜色方案?')) return
    const r = await fetchApi(`/api/admin/themes/colors/${id}`, { method: 'DELETE' })
    if (r.success) load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">颜色方案</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理可复用的颜色方案</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          新建颜色方案
        </Button>
      </div>

      {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {error && <Alert variant="danger" description={error} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <Card key={c.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-1">
                {c.colors.map((color, i) => (
                  <Tooltip key={i} content={color}>
                    <div
                      className="h-8 flex-1 rounded border"
                      style={{ backgroundColor: color }}
                    />
                  </Tooltip>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={save} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">方案名称</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="例如:海洋风"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">色板</Label>
                <div className="flex flex-wrap gap-2">
                  {form.colors.map((color, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            colors: f.colors.map((c, idx) => (idx === i ? e.target.value : c)),
                          }))
                        }
                        className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            colors: f.colors.filter((_, idx) => idx !== i),
                          }))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, colors: [...f.colors, '#000000'] }))}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    添加
                  </Button>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowForm(false)
                    setForm(EMPTY_FORM)
                  }}
                >
                  取消
                </Button>
                <Button type="submit" size="sm">
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
