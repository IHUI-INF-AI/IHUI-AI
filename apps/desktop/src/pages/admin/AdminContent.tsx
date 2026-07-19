/**
 * AdminContent — 内容运营总览(4 个子模块:announcement / help-article / article / advertise)。
 *
 * 单页内嵌 4 Tab + CRUD 按钮,统一调 `/api/admin/content/:type/:id` 端点
 * (subagent A 实装的统一内容 CRUD 路由,支持 10 种 type,本页面用 4 种)。
 * 复用 useAdminCrud + ContentDialog + AdminDialog 模板,实现完整化(从 80% → 95%+)。
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
  CONTENT_TYPES,
  listAdminContent,
  createAdminContent,
  updateAdminContent,
  deleteAdminContent,
  type ContentType,
  type ContentRow,
} from '../../lib/api/admin-content'
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

function tabKey(t: ContentType): string {
  return `admin.content.tab${t.replace(/-(.)/g, (_, c) => c.toUpperCase()).replace(/^./, (c) => c.toUpperCase())}`
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
    try {
      if (dialogMode === 'create') {
        const res = await createAdminContent(values.type, {
          title: values.title.trim(),
          content: values.content.trim(),
          isPublished: values.isPublished,
          sortOrder: values.sortOrder,
        })
        if (!res.success) {
          setActionError(res.error || t('admin.content.createSuccess').replace('创建', '创建失败'))
          return
        }
        setSuccessMessage(t('admin.content.createSuccess'))
      } else if (editingRow) {
        const res = await updateAdminContent(activeTab, String(editingRow.id), {
          title: values.title.trim(),
          content: values.content.trim(),
          isPublished: values.isPublished,
          sortOrder: values.sortOrder,
        })
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
      const res = await deleteAdminContent(activeTab, String(row.id))
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
            {CONTENT_TYPES.map((tp) => (
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
                {t(tabKey(tp))}
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
                  const published = row.isPublished === true
                  return (
                    <TableRow key={String(row.id)} data-testid={`admin-content-row-${row.id}`}>
                      <TableCell>{row.title || '—'}</TableCell>
                      <TableCell className="admin-muted">
                        {typeof row.content === 'string'
                          ? `${row.content.slice(0, 60)}${row.content.length > 60 ? '…' : ''}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`admin-badge ${published ? 'admin-badge-ok' : 'admin-badge-muted'}`}
                        >
                          {published
                            ? t('admin.content.statusPublished')
                            : t('admin.content.statusDraft')}
                        </span>
                      </TableCell>
                      <TableCell className="admin-num">
                        {String(row.sortOrder ?? row.sort ?? '—')}
                      </TableCell>
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
