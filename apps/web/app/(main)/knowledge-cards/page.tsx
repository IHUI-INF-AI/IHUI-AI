// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

'use client'

/**
 * Knowledge Card 页面 (2026-09-10 新增,2-1 项目知识引擎)
 *
 * 仓库级任务经验卡:按仓库名管理"经验/事实/最佳实践/踩坑"四类卡片。
 * - 上半区:仓库名 + 加载列表;创建/编辑表单(kind/title/content/tags/confidence)
 * - 下半区:卡片列表(kind 标签/使用次数/标签),支持查看详情、编辑、复用打点、删除;
 *   另有关键词检索(命中含 content,按 useCount 降序)
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Bookmark,
  Check,
  Eye,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { Alert, confirmDialog } from '@/components/feedback'
import { Input, Select, Textarea } from '@/components/form'
import { MarkdownStream } from '@/components/ai/markdown-stream'
import {
  createKnowledgeCard,
  deleteKnowledgeCard,
  getKnowledgeCard,
  listKnowledgeCards,
  markCardUsed,
  searchKnowledgeCards,
  updateKnowledgeCard,
  type KnowledgeCardKind,
  type KnowledgeCardSummary,
} from '@ihui/api-client'

const KIND_VALUES: KnowledgeCardKind[] = ['experience', 'fact', 'practices', 'pitfall']

function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

/** 逗号/中文逗号分隔的标签串 → 数组 */
function parseTags(str: string): string[] {
  return str
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20)
}

export default function KnowledgeCardsPage() {
  const t = useTranslations('knowledgeCard')

  // ---- 仓库与列表 ----
  const [repoName, setRepoName] = React.useState('')
  const [cards, setCards] = React.useState<KnowledgeCardSummary[]>([])
  const [loadingList, setLoadingList] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const loadCards = React.useCallback(async (name: string) => {
    if (!name.trim()) return
    setLoadingList(true)
    setError(null)
    try {
      const rows = await listKnowledgeCards({ repoName: name.trim() })
      setCards(rows)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoadingList(false)
    }
  }, [])

  // ---- 创建/编辑表单 ----
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [formKind, setFormKind] = React.useState<KnowledgeCardKind>('experience')
  const [formTitle, setFormTitle] = React.useState('')
  const [formContent, setFormContent] = React.useState('')
  const [formTags, setFormTags] = React.useState('')
  const [formConfidence, setFormConfidence] = React.useState(100)
  const [submitting, setSubmitting] = React.useState(false)

  const openCreateForm = React.useCallback(() => {
    setEditingId(null)
    setFormKind('experience')
    setFormTitle('')
    setFormContent('')
    setFormTags('')
    setFormConfidence(100)
    setFormOpen(true)
  }, [])

  const openEditForm = React.useCallback(async (card: KnowledgeCardSummary) => {
    setError(null)
    try {
      const detail = await getKnowledgeCard(card.id)
      setEditingId(detail.id)
      setFormKind(detail.kind)
      setFormTitle(detail.title)
      setFormContent(detail.content)
      setFormTags(detail.tags.join(', '))
      setFormConfidence(detail.confidence)
      setFormOpen(true)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  const handleSubmit = React.useCallback(async () => {
    setError(null)
    if (!repoName.trim()) {
      setError(t('needRepoName'))
      return
    }
    if (!formTitle.trim() || !formContent.trim()) {
      setError(t('needTitleContent'))
      return
    }
    setSubmitting(true)
    try {
      if (editingId) {
        await updateKnowledgeCard(editingId, {
          kind: formKind,
          title: formTitle.trim(),
          content: formContent.trim(),
          tags: parseTags(formTags),
          confidence: formConfidence,
        })
      } else {
        await createKnowledgeCard({
          repoName: repoName.trim(),
          kind: formKind,
          title: formTitle.trim(),
          content: formContent.trim(),
          tags: parseTags(formTags),
          confidence: formConfidence,
        })
      }
      setFormOpen(false)
      setEditingId(null)
      await loadCards(repoName)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }, [
    repoName,
    editingId,
    formKind,
    formTitle,
    formContent,
    formTags,
    formConfidence,
    loadCards,
    t,
  ])

  // ---- 检索 ----
  const [searchQ, setSearchQ] = React.useState('')
  const [searchResults, setSearchResults] = React.useState<
    (KnowledgeCardSummary & { content: string })[] | null
  >(null)
  const [searching, setSearching] = React.useState(false)

  const handleSearch = React.useCallback(async () => {
    if (!searchQ.trim()) {
      setSearchResults(null)
      return
    }
    setSearching(true)
    setError(null)
    try {
      const rows = await searchKnowledgeCards({
        q: searchQ.trim(),
        repoName: repoName.trim() || undefined,
      })
      setSearchResults(rows)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSearching(false)
    }
  }, [searchQ, repoName])

  // ---- 详情查看 ----
  const [viewingId, setViewingId] = React.useState<string | null>(null)
  const [viewingTitle, setViewingTitle] = React.useState('')
  const [detailContent, setDetailContent] = React.useState<string | null>(null)
  const [loadingDetail, setLoadingDetail] = React.useState(false)

  const handleView = React.useCallback(async (card: KnowledgeCardSummary, content?: string) => {
    if (content !== undefined) {
      // 搜索结果已带 content,直接展示
      setViewingId(card.id)
      setViewingTitle(card.title)
      setDetailContent(content)
      return
    }
    setViewingId(card.id)
    setViewingTitle(card.title)
    setDetailContent(null)
    setLoadingDetail(true)
    try {
      const detail = await getKnowledgeCard(card.id)
      setDetailContent(detail.content)
    } catch (e) {
      setError((e as Error).message)
      setViewingId(null)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  // ---- 复用打点 / 删除 ----
  const [markingId, setMarkingId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const handleMarkUsed = React.useCallback(async (card: KnowledgeCardSummary) => {
    setMarkingId(card.id)
    setError(null)
    try {
      await markCardUsed(card.id)
      setCards((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, useCount: c.useCount + 1 } : c)),
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setMarkingId(null)
    }
  }, [])

  const handleDelete = React.useCallback(
    async (card: KnowledgeCardSummary) => {
      const ok = await confirmDialog({ title: t('deleteConfirm'), variant: 'danger' })
      if (!ok) return
      setDeletingId(card.id)
      setError(null)
      try {
        await deleteKnowledgeCard(card.id)
        setCards((prev) => prev.filter((c) => c.id !== card.id))
        if (viewingId === card.id) {
          setViewingId(null)
          setDetailContent(null)
        }
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setDeletingId(null)
      }
    },
    [t, viewingId],
  )

  const kindLabel = React.useCallback(
    (kind: KnowledgeCardKind) => {
      switch (kind) {
        case 'experience':
          return t('kindExperience')
        case 'fact':
          return t('kindFact')
        case 'practices':
          return t('kindPractices')
        case 'pitfall':
          return t('kindPitfall')
      }
    },
    [t],
  )

  const kindOptions = React.useMemo(
    () =>
      KIND_VALUES.map((k) => ({
        value: k,
        label: kindLabel(k),
      })),
    [kindLabel],
  )

  /** 列表行(普通列表与搜索结果共用) */
  const renderCardRow = (card: KnowledgeCardSummary & { content?: string }) => (
    <li
      key={card.id}
      className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
      data-testid={`card-${card.id}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{card.title}</span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {kindLabel(card.kind)}
          </span>
          {card.source === 'agent' && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {t('sourceAgent')}
            </span>
          )}
        </div>
        {card.content && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{card.content}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {t('useCount', { count: card.useCount })}
          {card.tags.length > 0 && ` · ${card.tags.map((tag) => `#${tag}`).join(' ')}`}
          {card.createdAt ? ` · ${formatDate(card.createdAt)}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleView(card, card.content)}
          disabled={viewingId === card.id}
        >
          <Eye className="h-4 w-4" aria-hidden />
          {t('view')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void openEditForm(card)}>
          <Pencil className="h-4 w-4" aria-hidden />
          {t('edit')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleMarkUsed(card)}
          disabled={markingId === card.id}
        >
          {markingId === card.id ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Check className="h-4 w-4" aria-hidden />
          )}
          {t('markUsed')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleDelete(card)}
          disabled={deletingId === card.id}
        >
          {deletingId === card.id ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden />
          )}
          {t('delete')}
        </Button>
      </div>
    </li>
  )

  return (
    <div className="px-4 py-4 mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {error && <Alert variant="danger" description={error} className="items-start" />}

      {/* 仓库区:仓库名 + 加载 + 新建 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bookmark className="h-4 w-4" aria-hidden />
            {t('repoSection')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="w-20 shrink-0 text-sm font-medium" htmlFor="kc-repo-name">
              {t('repoNameLabel')}
            </label>
            <Input
              id="kc-repo-name"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder={t('repoNamePlaceholder')}
              className="max-w-xs"
            />
            <Button
              variant="outline"
              onClick={() => void loadCards(repoName)}
              disabled={loadingList || !repoName.trim()}
            >
              {loadingList ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-4 w-4" aria-hidden />
              )}
              {t('load')}
            </Button>
            <Button onClick={openCreateForm} disabled={!repoName.trim()}>
              <Plus className="h-4 w-4" aria-hidden />
              {t('create')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 创建/编辑表单 */}
      {formOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? t('editSection') : t('createSection')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="w-20 shrink-0 text-sm font-medium" htmlFor="kc-kind">
                {t('kindLabel')}
              </label>
              <Select
                options={kindOptions}
                value={formKind}
                onChange={(v) => setFormKind(v as KnowledgeCardKind)}
                className="max-w-xs"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="w-20 shrink-0 text-sm font-medium" htmlFor="kc-title">
                {t('titleLabel')}
              </label>
              <Input
                id="kc-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={t('titlePlaceholder')}
                className="max-w-xl"
              />
            </div>
            <div className="flex flex-wrap items-start gap-3">
              <label className="w-20 shrink-0 pt-2 text-sm font-medium" htmlFor="kc-content">
                {t('contentLabel')}
              </label>
              <Textarea
                id="kc-content"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder={t('contentPlaceholder')}
                rows={6}
                className="max-w-xl flex-1"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="w-20 shrink-0 text-sm font-medium" htmlFor="kc-tags">
                {t('tagsLabel')}
              </label>
              <Input
                id="kc-tags"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder={t('tagsPlaceholder')}
                className="max-w-md"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="w-20 shrink-0 text-sm font-medium" htmlFor="kc-confidence">
                {t('confidenceLabel')}
              </label>
              <Input
                id="kc-confidence"
                type="number"
                min={0}
                max={100}
                value={formConfidence}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  setFormConfidence(Number.isNaN(n) ? 100 : Math.min(100, Math.max(0, n)))
                }}
                className="max-w-24"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => void handleSubmit()} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {editingId ? t('update') : t('submit')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setFormOpen(false)
                  setEditingId(null)
                }}
                disabled={submitting}
              >
                {t('cancelEdit')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 查看详情 */}
      {viewingId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>{viewingTitle}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setViewingId(null)
                  setDetailContent(null)
                }}
              >
                {t('backToList')}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDetail || detailContent === null ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t('loadingDetail')}
              </div>
            ) : (
              <MarkdownStream content={detailContent} collapseLines={0} />
            )}
          </CardContent>
        </Card>
      )}

      {/* 列表 / 搜索结果 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
            <span>{searchResults !== null ? t('searchResults') : t('listTitle')}</span>
            <div className="flex items-center gap-2">
              <Input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSearch()
                }}
                placeholder={t('searchPlaceholder')}
                className="max-w-56"
                aria-label={t('searchLabel')}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSearch()}
                disabled={searching}
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Search className="h-4 w-4" aria-hidden />
                )}
                {t('search')}
              </Button>
              {searchResults !== null && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchResults(null)
                    setSearchQ('')
                  }}
                >
                  {t('clearSearch')}
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {searchResults !== null ? (
            searchResults.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">{t('searchEmpty')}</p>
            ) : (
              <ul className="flex flex-col gap-3">{searchResults.map(renderCardRow)}</ul>
            )
          ) : loadingList ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('loadingList')}
            </div>
          ) : cards.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">{t('emptyList')}</p>
          ) : (
            <ul className="flex flex-col gap-3">{cards.map(renderCardRow)}</ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
