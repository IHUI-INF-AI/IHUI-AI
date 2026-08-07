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
import { LayoutGrid, Save, RotateCcw, Loader2, Eye, Upload, Trash2 } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import {
  DEFAULT_HOME_SCHEMA,
  safeGetHomeSchema,
  type HomeSchema,
} from '@/components/marketing/home-schema'
import { SortableSection } from './SortableSection'
import { BackButton } from '@/components/common'
import { Tooltip } from '@/components/feedback'

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

const DRAFT_KEY = 'home_schema_draft'
const PROD_KEY = 'home_schema'
const DRAFT_DESC = '首页/营销页 section schema 草稿(Server-Driven UI P3-4.6,预览用)'
const PROD_DESC = '首页/营销页 section schema(Server-Driven UI)'

export default function HomeSchemaEditorPage() {
  const qc = useQueryClient()
  // 当前编辑的草稿(本地 state,未保存前不持久化)
  const [draft, setDraft] = React.useState<HomeSchema | null>(null)
  // 已保存到后端的草稿(用于检测未保存改动)
  const [savedDraft, setSavedDraft] = React.useState<HomeSchema | null>(null)
  // 生产 schema(用于"发布"判断 + "丢弃草稿"重置 + 显示差异提示)
  const [production, setProduction] = React.useState<HomeSchema | null>(null)
  // 草稿配置 ID(未保存过草稿时为 null)
  const [draftConfigId, setDraftConfigId] = React.useState<string | null>(null)
  // 生产配置 ID(发布时用)
  const [prodConfigId, setProdConfigId] = React.useState<string | null>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const [info, setInfo] = React.useState<string | null>(null)

  // 加载 admin configs,同时找 home_schema(生产)和 home_schema_draft(草稿)
  const { isLoading } = useQuery({
    queryKey: ['admin', 'configs', 'home-schema'],
    queryFn: async () => {
      const list = normList(await api('/api/admin/configs'))
      const prodCfg = list.find((c) => c.key === PROD_KEY)
      const draftCfg = list.find((c) => c.key === DRAFT_KEY)

      // 生产 schema(migration 已 seed,正常必存在;若不存在用 DEFAULT 兜底)
      const prodSchema = prodCfg
        ? safeGetHomeSchema(JSON.parse(prodCfg.value))
        : DEFAULT_HOME_SCHEMA
      setProduction(prodSchema)
      if (prodCfg) setProdConfigId(prodCfg.id)

      // 草稿 schema(可能不存在 → fallback 生产 schema,即"草稿与生产一致")
      const draftSchema = draftCfg ? safeGetHomeSchema(JSON.parse(draftCfg.value)) : prodSchema
      setDraft(draftSchema)
      setSavedDraft(draftSchema)
      if (draftCfg) setDraftConfigId(draftCfg.id)

      return { prodCfg, draftCfg }
    },
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // 草稿是否有未保存改动(本地 draft vs 已保存 savedDraft)
  const hasUnsavedChanges =
    draft !== null && savedDraft !== null && JSON.stringify(draft) !== JSON.stringify(savedDraft)
  // 草稿是否与生产有差异(用于"发布"按钮启用判断 + 显示差异提示)
  const hasDraftDiff =
    draft !== null && production !== null && JSON.stringify(draft) !== JSON.stringify(production)
  // 草稿是否已保存到后端且与生产一致(等同无草稿,发布按钮禁用)
  const draftEqualsProduction =
    savedDraft !== null &&
    production !== null &&
    JSON.stringify(savedDraft) === JSON.stringify(production)

  function handleDragEnd(e: DragEndEvent) {
    if (!draft || e.over === null || e.active.id === e.over.id) return
    setDraft((prev) => {
      if (!prev) return prev
      const oldIndex = prev.sections.findIndex((s) => s.id === e.active.id)
      const newIndex = prev.sections.findIndex((s) => s.id === e.over!.id)
      if (oldIndex < 0 || newIndex < 0) return prev
      return { ...prev, sections: arrayMove(prev.sections, oldIndex, newIndex) }
    })
    setErr(null)
    setInfo(null)
  }

  function toggleSection(id: string) {
    setDraft((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        sections: prev.sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
      }
    })
    setErr(null)
    setInfo(null)
  }

  function resetToDefault() {
    setDraft(DEFAULT_HOME_SCHEMA)
    setErr(null)
    setInfo(null)
  }

  /** 保存草稿到后端(PUT 已有 / POST 新建) */
  const saveDraftMut = useMutation({
    mutationFn: async () => {
      if (!draft) return
      const value = JSON.stringify(draft)
      if (draftConfigId) {
        await api(`/api/admin/configs/${draftConfigId}`, {
          method: 'PUT',
          body: JSON.stringify({
            key: DRAFT_KEY,
            value,
            type: 'json',
            category: 'home_schema_draft',
            isPublic: true,
            description: DRAFT_DESC,
          }),
        })
      } else {
        const created = await api<AdminConfig>('/api/admin/configs', {
          method: 'POST',
          body: JSON.stringify({
            key: DRAFT_KEY,
            value,
            type: 'json',
            category: 'home_schema_draft',
            isPublic: true,
            description: DRAFT_DESC,
          }),
        })
        setDraftConfigId(created.id)
      }
    },
    onSuccess: () => {
      setSavedDraft(draft)
      setErr(null)
      setInfo('草稿已保存,可点"预览"查看效果,确认后点"发布"生效到生产')
      qc.invalidateQueries({ queryKey: ['admin', 'configs'] })
    },
    onError: (e: Error) => setErr(e.message),
  })

  /** 预览草稿(新窗口打开 /?preview=draft)。有未保存改动时提示先保存 */
  function handlePreview() {
    if (hasUnsavedChanges) {
      setErr('有未保存的改动,请先点"保存草稿"再预览')
      setInfo(null)
      return
    }
    setErr(null)
    window.open('/?preview=draft', '_blank', 'noopener,noreferrer')
  }

  /** 发布:把当前草稿拷贝到生产 schema key */
  const publishMut = useMutation({
    mutationFn: async () => {
      if (!draft) return
      const value = JSON.stringify(draft)
      if (prodConfigId) {
        await api(`/api/admin/configs/${prodConfigId}`, {
          method: 'PUT',
          body: JSON.stringify({
            key: PROD_KEY,
            value,
            type: 'json',
            category: 'home_schema',
            isPublic: true,
            description: PROD_DESC,
          }),
        })
      } else {
        // 生产配置不存在(理论上 migration 已 seed,兜底 POST)
        const created = await api<AdminConfig>('/api/admin/configs', {
          method: 'POST',
          body: JSON.stringify({
            key: PROD_KEY,
            value,
            type: 'json',
            category: 'home_schema',
            isPublic: true,
            description: PROD_DESC,
          }),
        })
        setProdConfigId(created.id)
      }
    },
    onSuccess: () => {
      setProduction(draft)
      setSavedDraft(draft)
      setErr(null)
      setInfo('已发布到生产,营销页(/)与工作区首页(/home)实时生效')
      qc.invalidateQueries({ queryKey: ['admin', 'configs'] })
    },
    onError: (e: Error) => setErr(e.message),
  })

  /** 丢弃草稿:DELETE 草稿 key + 重置 draft/savedDraft 为生产 schema */
  const discardDraftMut = useMutation({
    mutationFn: async () => {
      if (!draftConfigId) return
      await api(`/api/admin/configs/${draftConfigId}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      setDraft(production)
      setSavedDraft(production)
      setDraftConfigId(null)
      setErr(null)
      setInfo('草稿已丢弃,编辑器已重置为生产 schema')
      qc.invalidateQueries({ queryKey: ['admin', 'configs'] })
    },
    onError: (e: Error) => setErr(e.message),
  })

  if (isLoading || draft === null || production === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <BackButton />
      {/* 标题 + 操作按钮组 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <LayoutGrid className="h-6 w-6 text-primary" />
            首页布局编辑
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            编辑草稿 → 预览确认 →
            发布生效。改动不会立即影响生产,需点&ldquo;发布&rdquo;才同步到营销页(/)与工作区首页(/home)。
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handlePreview}>
            <Eye className="h-4 w-4" />
            预览
          </Button>
          <Tooltip
            content={
              !draftConfigId
                ? '当前无草稿,无需丢弃'
                : draftEqualsProduction
                  ? '草稿与生产一致,无需丢弃'
                  : '删除草稿,重置为生产 schema'
            }
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => discardDraftMut.mutate()}
              disabled={!draftConfigId || draftEqualsProduction || discardDraftMut.isPending}
            >
              {discardDraftMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              丢弃草稿
            </Button>
          </Tooltip>
          <Button
            variant="outline"
            size="sm"
            onClick={resetToDefault}
            disabled={
              !hasUnsavedChanges && JSON.stringify(draft) === JSON.stringify(DEFAULT_HOME_SCHEMA)
            }
          >
            <RotateCcw className="h-4 w-4" />
            重置默认
          </Button>
          <Button
            size="sm"
            onClick={() => saveDraftMut.mutate()}
            disabled={!hasUnsavedChanges || saveDraftMut.isPending}
          >
            {saveDraftMut.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            保存草稿
          </Button>
          <Tooltip
            content={!hasDraftDiff ? '草稿与生产一致,无需发布' : '把当前草稿同步到生产 schema'}
          >
            <Button
              size="sm"
              variant="default"
              onClick={() => publishMut.mutate()}
              disabled={!hasDraftDiff || publishMut.isPending}
            >
              {publishMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              发布
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* 错误提示 */}
      {err && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
          {err}
        </div>
      )}

      {/* 成功提示 */}
      {info && !err && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          {info}
        </div>
      )}

      {/* 未保存改动提示 */}
      {hasUnsavedChanges && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
          有未保存的改动(预览前请先&ldquo;保存草稿&rdquo;)
        </div>
      )}

      {/* 草稿与生产差异提示 */}
      {hasDraftDiff && !hasUnsavedChanges && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-2 text-sm text-blue-600 dark:text-blue-400">
          草稿已保存,与生产存在差异 → 可&ldquo;预览&rdquo;确认,或直接&ldquo;发布&rdquo;生效
        </div>
      )}

      {/* 可拖拽 section 列表 */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={draft.sections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {draft.sections.map((section, i) => (
              <SortableSection
                key={section.id}
                section={section}
                index={i}
                onToggle={toggleSection}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* 底部说明 */}
      <p className="text-xs text-muted-foreground">
        共 {draft.sections.length} 个 section,其中 {draft.sections.filter((s) => s.enabled).length}{' '}
        个启用。
        {hasDraftDiff ? ' 草稿与生产存在差异,发布后生效。' : ' 草稿与生产一致。'}
      </p>
    </div>
  )
}
