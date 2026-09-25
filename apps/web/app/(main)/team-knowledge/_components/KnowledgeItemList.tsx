// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 空间条目列表 + 修订历史入口(G-35,2026-09-26)
 * kind/status/keyword 过滤;行操作:编辑(乐观并发修订)/ 发布 / 归档 / 历史。
 * editor+ 才可写,按钮按 space.myRole 致灰,权限最终判定在服务端。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Archive, History, Pencil, Plus, Rocket, Search } from 'lucide-react'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { Input } from '@/components/form'
import {
  listKnowledgeSpaceItems,
  setKnowledgeItemStatus,
  type KnowledgeItemDTO,
  type KnowledgeSpaceDTO,
  type TeamKnowledgeKind,
  type TeamKnowledgeStatus,
} from '@ihui/api-client'
import { ItemEditDialog } from './ItemEditDialog'
import { RevisionHistoryDialog } from './RevisionHistoryDialog'

const KINDS: TeamKnowledgeKind[] = ['memory', 'wiki', 'card']
const STATUSES: TeamKnowledgeStatus[] = ['draft', 'published', 'archived']

/** 状态徽章:draft 灰 / published 绿(§4);archived 用中性深色区分 */
const STATUS_BADGE: Record<TeamKnowledgeStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  archived: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400',
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function KnowledgeItemList({ space }: { space: KnowledgeSpaceDTO }) {
  const t = useTranslations('teamKnowledge')

  const [kindFilter, setKindFilter] = React.useState<TeamKnowledgeKind | ''>('')
  const [statusFilter, setStatusFilter] = React.useState<TeamKnowledgeStatus | ''>('')
  const [keyword, setKeyword] = React.useState('')
  const [rows, setRows] = React.useState<KnowledgeItemDTO[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [editTarget, setEditTarget] = React.useState<{ item: KnowledgeItemDTO | null } | null>(null)
  const [historyItem, setHistoryItem] = React.useState<KnowledgeItemDTO | null>(null)

  const canEdit = space.myRole === 'owner' || space.myRole === 'editor'

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(
        await listKnowledgeSpaceItems(space.id, {
          kind: kindFilter || undefined,
          status: statusFilter || undefined,
          keyword: keyword.trim() || undefined,
        }),
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [space.id, kindFilter, statusFilter, keyword])

  React.useEffect(() => {
    void load()
  }, [load])

  const changeStatus = async (row: KnowledgeItemDTO, status: TeamKnowledgeStatus) => {
    setError(null)
    try {
      await setKnowledgeItemStatus(row.id, { status })
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">{t('itemsTitle')}</h2>
          <Button size="sm" onClick={() => setEditTarget({ item: null })} disabled={!canEdit}>
            <Plus className="size-4" />
            <span>{t('newItemBtn')}</span>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="w-56"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
          />
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <Search className="size-4" />
            <span>{t('searchBtn')}</span>
          </Button>
          <div className="ml-auto flex items-center gap-1">
            {(['', ...KINDS] as const).map((k) => (
              <button
                key={k || 'kind-all'}
                type="button"
                onClick={() => setKindFilter(k)}
                className={`rounded px-2 py-1 text-xs ${
                  kindFilter === k ? 'bg-cta text-cta-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {k ? t(`kind.${k}`) : t('kindAll')}
              </button>
            ))}
            {(['', ...STATUSES] as const).map((s) => (
              <button
                key={s || 'status-all'}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded px-2 py-1 text-xs ${
                  statusFilter === s
                    ? 'bg-cta text-cta-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {s ? t(`status.${s}`) : t('statusAll')}
              </button>
            ))}
          </div>
        </div>

        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}

        {rows.length === 0 && !loading ? (
          <div className="text-muted-foreground text-sm">{t('emptyItems')}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <div key={row.id} className="bg-muted/40 flex flex-col gap-1 rounded px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="bg-background rounded px-1.5 py-0.5 text-xs">
                    {t(`kind.${row.kind}`)}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_BADGE[row.status]}`}>
                    {t(`status.${row.status}`)}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium">{row.title}</span>
                  <span className="text-muted-foreground text-xs">r{row.revision}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditTarget({ item: row })}
                    disabled={!canEdit}
                    aria-label={t('editBtn')}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  {row.status === 'draft' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => changeStatus(row, 'published')}
                      disabled={!canEdit}
                      aria-label={t('publishBtn')}
                    >
                      <Rocket className="size-4" />
                    </Button>
                  )}
                  {row.status !== 'archived' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => changeStatus(row, 'archived')}
                      disabled={!canEdit}
                      aria-label={t('archiveBtn')}
                    >
                      <Archive className="size-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setHistoryItem(row)}
                    aria-label={t('historyBtn')}
                  >
                    <History className="size-4" />
                  </Button>
                </div>
                {row.plainText && (
                  <p className="text-muted-foreground line-clamp-2 text-xs whitespace-pre-wrap">
                    {row.plainText}
                  </p>
                )}
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  {row.tags.map((tag: string) => (
                    <span key={tag} className="bg-background rounded px-1.5 py-0.5">
                      {tag}
                    </span>
                  ))}
                  <span className="ml-auto">{formatDate(row.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {editTarget && (
          <ItemEditDialog
            space={space}
            item={editTarget.item}
            onClose={() => setEditTarget(null)}
            onSaved={() => {
              setEditTarget(null)
              void load()
            }}
          />
        )}
        {historyItem && (
          <RevisionHistoryDialog item={historyItem} onClose={() => setHistoryItem(null)} />
        )}
      </CardContent>
    </Card>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
