// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

'use client'

/**
 * 团队共享记忆页 (2026-09-08 新增,对标竞品团队知识引擎)
 *
 * 按 scopeId(teamId 或 workspaceKey)隔离的跨用户共享知识层:
 * 列表(kind 徽章过滤 + 关键词搜索) + 新建/编辑内联面板 + 删除确认。
 * scopeId 保存在 localStorage,刷新后自动恢复。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Plus, RefreshCw, Search } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { Alert, confirmDialog } from '@/components/feedback'
import { Input } from '@/components/form'
import {
  createTeamMemory,
  deleteTeamMemory,
  listTeamMemories,
  updateTeamMemory,
  type TeamMemoryDTO,
  type TeamMemoryKind,
} from '@ihui/api-client'
import { MemoryEditPanel, type EditingState } from './_components/MemoryEditPanel'
import { MemoryCard } from './_components/MemoryCard'

const SCOPE_STORAGE_KEY = 'ihui:team-memory:scopeId'
const KINDS: TeamMemoryKind[] = ['decision', 'convention', 'pitfall', 'fingerprint']

const EMPTY_EDIT: EditingState = { id: null, kind: 'decision', title: '', content: '', tags: '' }

export default function TeamMemoryPage() {
  const t = useTranslations('teamMemory')

  const [scopeId, setScopeId] = React.useState('')
  const [kindFilter, setKindFilter] = React.useState<TeamMemoryKind | ''>('')
  const [keyword, setKeyword] = React.useState('')
  const [rows, setRows] = React.useState<TeamMemoryDTO[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState<EditingState | null>(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    const saved = window.localStorage.getItem(SCOPE_STORAGE_KEY)
    if (saved) setScopeId(saved)
  }, [])

  const load = React.useCallback(async (scope: string, kind: TeamMemoryKind | '', kw: string) => {
    if (!scope.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await listTeamMemories({
        scopeId: scope.trim(),
        kind: kind || undefined,
        keyword: kw.trim() || undefined,
      })
      setRows(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleScopeChange = (value: string) => {
    setScopeId(value)
    window.localStorage.setItem(SCOPE_STORAGE_KEY, value)
  }

  const startCreate = () => {
    if (!scopeId.trim()) {
      setError(t('needScope'))
      return
    }
    setError(null)
    setEditing({ ...EMPTY_EDIT })
  }

  const startEdit = (row: TeamMemoryDTO) => {
    setError(null)
    setEditing({
      id: row.id,
      kind: row.kind,
      title: row.title,
      content: row.content,
      tags: row.tags.join(', '),
    })
  }

  const handleSave = async () => {
    if (!editing) return
    if (!editing.title.trim()) {
      setError(t('needTitle'))
      return
    }
    if (!editing.content.trim()) {
      setError(t('needContent'))
      return
    }
    setSaving(true)
    setError(null)
    const tags = editing.tags
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      if (editing.id) {
        await updateTeamMemory(editing.id, {
          kind: editing.kind,
          title: editing.title.trim(),
          content: editing.content.trim(),
          tags,
        })
      } else {
        await createTeamMemory({
          scopeId: scopeId.trim(),
          kind: editing.kind,
          title: editing.title.trim(),
          content: editing.content.trim(),
          tags,
        })
      }
      setEditing(null)
      await load(scopeId, kindFilter, keyword)
    } catch (e) {
      setError(`${t('saveFailed')}:${(e as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row: TeamMemoryDTO) => {
    const ok = await confirmDialog({ title: t('deleteConfirm'), variant: 'danger' })
    if (!ok) return
    try {
      await deleteTeamMemory(row.id)
      await load(scopeId, kindFilter, keyword)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
      <div>
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">{t('description')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="w-56"
          value={scopeId}
          onChange={(e) => handleScopeChange(e.target.value)}
          placeholder={t('scopePlaceholder')}
          aria-label={t('scopeLabel')}
        />
        <Input
          className="w-56"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
        />
        <Button
          variant="outline"
          onClick={() => load(scopeId, kindFilter, keyword)}
          disabled={!scopeId.trim() || loading}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          <span>{t('searchBtn')}</span>
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {(['', ...KINDS] as const).map((k) => (
            <button
              key={k || 'all'}
              type="button"
              onClick={() => {
                setKindFilter(k)
                if (scopeId.trim()) void load(scopeId, k, keyword)
              }}
              className={`rounded px-2 py-1 text-xs ${
                kindFilter === k ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}
            >
              {k ? t(`kind.${k}`) : t('kindAll')}
            </button>
          ))}
        </div>
      </div>

      {error && <Alert variant="danger" description={error} className="items-start" />}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{t('listTitle')}</h2>
        <Button size="sm" onClick={startCreate}>
          <Plus className="size-4" />
          <span>{t('newBtn')}</span>
        </Button>
      </div>

      {editing && (
        <MemoryEditPanel
          editing={editing}
          saving={saving}
          onChange={setEditing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {loading && !rows.length ? (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          <span>{t('loading')}</span>
        </div>
      ) : rows.length === 0 && scopeId.trim() ? (
        <div className="text-muted-foreground text-sm">{t('empty')}</div>
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <MemoryCard key={row.id} row={row} onEdit={startEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {!scopeId.trim() && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <RefreshCw className="size-4" />
          <span>{t('needScope')}</span>
        </div>
      )}
    </div>
  )
}
