'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { LayoutGrid, Save, RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import {
  DEFAULT_HOME_SCHEMA,
  safeGetHomeSchema,
  type HomeSchema,
} from '@/components/marketing/home-schema'
import { SortableSection } from './SortableSection'

/** admin configs API 返回的配置行 */
interface AdminConfig {
  id: string
  key: string
  value: string
  type: string
  category: string
  isPublic: boolean
  description: string | null
}

/** fetchApi 包装:失败抛异常(适配 react-query) */
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

function normList(d: unknown): AdminConfig[] {
  return Array.isArray(d) ? (d as AdminConfig[]) : ((d as { list?: AdminConfig[] })?.list ?? [])
}

export default function HomeSchemaEditorPage() {
  const qc = useQueryClient()
  const [draft, setDraft] = React.useState<HomeSchema | null>(null)
  const [savedSchema, setSavedSchema] = React.useState<HomeSchema | null>(null)
  const [configId, setConfigId] = React.useState<string | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  // 加载 admin configs,找 home_schema
  const { isLoading } = useQuery({
    queryKey: ['admin', 'configs', 'home-schema'],
    queryFn: async () => {
      const list = normList(await api('/api/admin/configs'))
      const cfg = list.find((c) => c.key === 'home_schema')
      if (!cfg) {
        // 未配置 → 用默认
        setDraft(DEFAULT_HOME_SCHEMA)
        setSavedSchema(DEFAULT_HOME_SCHEMA)
        return null
      }
      const parsed = safeGetHomeSchema(JSON.parse(cfg.value))
      setDraft(parsed)
      setSavedSchema(parsed)
      setConfigId(cfg.id)
      return cfg
    },
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const hasChanges = draft !== null && savedSchema !== null && JSON.stringify(draft) !== JSON.stringify(savedSchema)

  function handleDragEnd(e: DragEndEvent) {
    if (!draft || e.over === null || e.active.id === e.over.id) return
    setDraft((prev) => {
      if (!prev) return prev
      const oldIndex = prev.sections.findIndex((s) => s.id === e.active.id)
      const newIndex = prev.sections.findIndex((s) => s.id === e.over!.id)
      if (oldIndex < 0 || newIndex < 0) return prev
      return { ...prev, sections: arrayMove(prev.sections, oldIndex, newIndex) }
    })
  }

  function toggleSection(id: string) {
    setDraft((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        sections: prev.sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
      }
    })
  }

  function resetToDefault() {
    setDraft(DEFAULT_HOME_SCHEMA)
    setErr(null)
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!draft) return
      const value = JSON.stringify(draft)
      if (configId) {
        // 更新现有配置
        await api(`/api/admin/configs/${configId}`, {
          method: 'PUT',
          body: JSON.stringify({ key: 'home_schema', value, type: 'json', category: 'home_schema', isPublic: true, description: '首页/营销页 section schema(Server-Driven UI)' }),
        })
      } else {
        // 创建新配置(config 不存在时)
        const created = await api<AdminConfig>('/api/admin/configs', {
          method: 'POST',
          body: JSON.stringify({ key: 'home_schema', value, type: 'json', category: 'home_schema', isPublic: true, description: '首页/营销页 section schema(Server-Driven UI)' }),
        })
        setConfigId(created.id)
      }
    },
    onSuccess: () => {
      setSavedSchema(draft)
      setErr(null)
      qc.invalidateQueries({ queryKey: ['admin', 'configs'] })
    },
    onError: (e: Error) => setErr(e.message),
  })

  if (isLoading || draft === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 标题 + 操作按钮 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <LayoutGrid className="h-6 w-6 text-primary" />
            首页布局编辑
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            拖拽调整 section 顺序,开关控制显隐。保存后营销页(/)与工作区首页(/home)实时生效。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetToDefault} disabled={!hasChanges && JSON.stringify(draft) === JSON.stringify(DEFAULT_HOME_SCHEMA)}>
            <RotateCcw className="h-4 w-4" />
            重置默认
          </Button>
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={!hasChanges || saveMut.isPending}>
            {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {err && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
          {err}
        </div>
      )}

      {/* 未保存提示 */}
      {hasChanges && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
          有未保存的改动
        </div>
      )}

      {/* 可拖拽 section 列表 */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={draft.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {draft.sections.map((section, i) => (
              <SortableSection key={section.id} section={section} index={i} onToggle={toggleSection} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* 底部说明 */}
      <p className="text-xs text-muted-foreground">
        共 {draft.sections.length} 个 section,其中 {draft.sections.filter((s) => s.enabled).length} 个启用。
        保存后前端自动加载新 schema,无需刷新代码。
      </p>
    </div>
  )
}
