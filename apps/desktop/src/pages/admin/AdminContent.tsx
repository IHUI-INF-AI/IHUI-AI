/**
 * AdminContent — 内容运营总览(10 个子模块配置驱动)。
 *
 * 单页内嵌 10 Tab + CRUD 按钮,统一调 `/api/admin/content/:type/:id` 端点
 * (subagent A 实装的统一内容 CRUD 路由,支持全部 10 种 type)。
 *
 * 10 type 列表(配置见 `lib/admin-content-types.ts`):
 *   announcement / help-article / help-category / doc / article / advertise /
 *   about-us / contact / recommendation / mobile-adapter
 *
 * 复用 useAdminCrud + ContentDialog + AdminDialog 模板,实现完整化(从 4/10 → 10/10)。
 */
import { useMemo, useState } from 'react'
import type { ApiResult } from '@ihui/types'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ihui/ui'
import { useAdminCrud } from '../../hooks/use-admin-crud'
import { useI18n } from '../../i18n'
import {
  ALL_CONTENT_TYPES,
  TYPE_CONFIGS,
  listAdminContent,
  createAdminContent,
  updateAdminContent,
  deleteAdminContent,
  formValuesToBody,
  type ContentType,
  type ContentRow,
} from '../../lib/admin-content-types'
import {
  ContentDialog,
  type ContentDialogMode,
  type ContentFormValues,
} from '../../components/admin/ContentDialog'

interface ContentListParams {
  page: number
  pageSize: number
  search: string | undefined
  [key: string]: string | number | undefined | null
}

const DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' })

function preview(value: unknown, max = 60): string {
  if (typeof value !== 'string') return '—'
  return `${value.slice(0, max)}${value.length > max ? '…' : ''}`
}

function statusBadge(row: ContentRow, t: (k: string) => string) {
  const published = row.isPublished === true
  return (
    <span className={`admin-badge ${published ? 'admin-badge-ok' : 'admin-badge-muted'}`}>
      {published ? t('admin.content.statusPublished') : t('admin.content.statusDraft')}
    </span>
  )
}

function sortCell(row: ContentRow): string {
  const v = row.sortOrder ?? row.sort
  return v === undefined || v === null ? '—' : String(v)
}

export default function AdminContent() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<ContentType>('announcement')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [search, setSearch] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<ContentDialogMode>('create')
  const [editingRow, setEditingRow] = useState<ContentRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const params = useMemo<ContentListParams>(
    () =>
      ({
        page,
        pageSize,
        search: search.trim() || undefined,
        _tab: activeTab,
      }) as ContentListParams,
    [page, pageSize, search, activeTab],
  )

  const { rows, total, loading, error, mutate } = useAdminCrud<ContentListParams, ContentRow>({
    fetcher: async (p) => {
      const tab: ContentType = (p as ContentListParams & { _tab: ContentType })._tab || activeTab
      const res: ApiResult<{ list: ContentRow[]; total: number }> = await listAdminContent(tab, p)
      if (!res.success) throw new Error(res.error || t('admin.common.loadFailed'))
      return { list: res.data.list, total: res.data.total }
    },
    params,
  })

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const openCreate = () => {
    setDialogMode('create')
    setEditingRow(null)
    setDialogOpen(true)
    setActionError('')
  }

  const openEdit = (row: ContentRow) => {
    setDialogMode('edit')
    setEditingRow(row)
    setDialogOpen(true)
    setActionError('')
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingRow(null)
  }

  const handleSubmit = async (values: ContentFormValues) => {
    setActionError('')
    setSuccessMessage('')
    const body = formValuesToBody(values.values)
    try {
      if (dialogMode === 'create') {
        const res = await createAdminContent(values.type, body)
        if (!res.success) {
          setActionError(res.error || t('admin.content.createSuccess').replace('创建', '创建失败'))
          return
        }
        setSuccessMessage(t('admin.content.createSuccess'))
      } else if (editingRow) {
        const editType: ContentType = (editingRow.type as ContentType) || activeTab
        const res = await updateAdminContent(editType, String(editingRow.id), body)
        if (!res.success) {
          setActionError(res.error || t('admin.content.updateSuccess').replace('更新', '更新失败'))
          return
        }
        setSuccessMessage(t('admin.content.updateSuccess'))
      }
      await mutate(async () => Promise.resolve())
      closeDialog()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '操作失败')
    }
  }

  const handleDelete = async (row: ContentRow) => {
    if (deletingId) return
    if (!window.confirm(t('admin.content.deleteConfirm'))) return
    setDeletingId(String(row.id))
    setActionError('')
    setSuccessMessage('')
    try {
      const deleteType: ContentType = (row.type as ContentType) || activeTab
      const res = await deleteAdminContent(deleteType, String(row.id))
      if (!res.success) {
        setActionError(res.error || t('admin.content.deleteSuccess').replace('删除', '删除失败'))
        return
      }
      setSuccessMessage(t('admin.content.deleteSuccess'))
      await mutate(async () => Promise.resolve())
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="admin-page" data-testid="admin-content">
      <header className="admin-page-header">
        <h2>{t('admin.content.title')}</h2>
        <div className="admin-toolbar">
          <input
            type="search"
            placeholder={t('admin.content.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setPage(1)
              setSearch(e.target.value)
            }}
            className="admin-search"
            data-testid="admin-content-search"
          />
          <button
            type="button"
            onClick={openCreate}
            className="admin-refresh-btn"
            data-testid="admin-content-create"
          >
            {t('admin.content.create')}
          </button>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}
      {actionError ? (
        <div className="error-banner" data-testid="admin-content-action-error">
          {actionError}
        </div>
      ) : null}
      {successMessage ? (
        <div className="admin-muted" data-testid="admin-content-success" style={{ marginLeft: 0 }}>
          {successMessage}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            {t('admin.content.title')}{' '}
            <span className="admin-muted">{t('admin.common.totalCount', { count: total })}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="admin-tabs" role="tablist" data-testid="admin-content-tabs">
            {ALL_CONTENT_TYPES.map((tp) => (
              <button
                key={tp}
                type="button"
                role="tab"
                aria-selected={activeTab === tp}
                className={`admin-tab ${activeTab === tp ? 'admin-tab-active' : ''}`}
                onClick={() => {
                  setPage(1)
                  setActiveTab(tp)
                }}
                data-testid={`admin-content-tab-${tp}`}
              >
                {t(`admin.content.${TYPE_CONFIGS[tp].tabKey}`)}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="empty-state">{t('common.loading')}</div>
          ) : rows.length === 0 ? (
            <div className="empty-state">{t('admin.common.noData')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.content.colTitle')}</TableHead>
                  <TableHead>{t('admin.content.colContent')}</TableHead>
                  <TableHead>{t('admin.content.colStatus')}</TableHead>
                  <TableHead>{t('admin.content.colSort')}</TableHead>
                  <TableHead>{t('admin.content.colCreatedAt')}</TableHead>
                  <TableHead>{t('admin.content.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const displayTitle =
                    typeof row.title === 'string'
                      ? row.title
                      : typeof row.name === 'string'
                        ? row.name
                        : typeof row.key === 'string'
                          ? row.key
                          : '—'
                  return (
                    <TableRow key={String(row.id)} data-testid={`admin-content-row-${row.id}`}>
                      <TableCell>{displayTitle}</TableCell>
                      <TableCell className="admin-muted">{preview(row.content)}</TableCell>
                      <TableCell>{statusBadge(row, t)}</TableCell>
                      <TableCell className="admin-num">{sortCell(row)}</TableCell>
                      <TableCell className="admin-muted">
                        {row.createdAt ? DATE_FORMATTER.format(new Date(row.createdAt)) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="admin-row-actions">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            data-testid={`admin-content-edit-${row.id}`}
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => void handleDelete(row)}
                            disabled={deletingId === String(row.id)}
                            data-testid={`admin-content-delete-${row.id}`}
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          {t('admin.common.prevPage')}
        </button>
        <span>{t('admin.common.pageIndicator', { page, total: totalPages })}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          {t('admin.common.nextPage')}
        </button>
      </div>

      <ContentDialog
        open={dialogOpen}
        mode={dialogMode}
        row={editingRow}
        defaultType={activeTab}
        onClose={closeDialog}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
