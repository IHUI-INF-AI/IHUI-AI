/**
 * AdminUsers — 用户管理(列表 + 创建/编辑/删除 + 状态切换)。
 *
 * 数据源:`listAdminUsers / addAdminUser / updateAdminUser / delAdminUser`(来自 @ihui/api-client)。
 * 状态机由 useAdminCrud 统一管理,弹窗通过 UserDialog 复用。
 */
import { useMemo, useState } from 'react'
import {
  listAdminUsers,
  addAdminUser,
  updateAdminUser,
  delAdminUser,
  type MemberUser,
  type PageData,
} from '@ihui/api-client'
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
import { UserDialog, type UserDialogMode, type UserFormValues } from '../../components/admin/UserDialog'

type StatusFilter = 'all' | 'active' | 'disabled'

interface UserListParams {
  page: number
  pageSize: number
  search: string | undefined
  status: number | undefined
  [key: string]: string | number | undefined | null
}

const DATE_FORMATTER = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' })

export default function AdminUsers() {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<UserDialogMode>('create')
  const [editingUser, setEditingUser] = useState<MemberUser | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const params = useMemo<UserListParams>(
    () => ({
      page,
      pageSize,
      search: keyword.trim() || undefined,
      status: status === 'all' ? undefined : status === 'active' ? 1 : 0,
    }),
    [page, pageSize, keyword, status],
  )

  const { rows, total, loading, error, mutate } = useAdminCrud<UserListParams, MemberUser>({
    fetcher: async (p) => {
      const res: ApiResult<PageData<MemberUser>> = await listAdminUsers(p)
      if (!res.success) throw new Error(res.error || t('admin.common.loadFailed'))
      return { list: res.data.list, total: res.data.total }
    },
    params,
  })

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const openCreate = () => {
    setDialogMode('create')
    setEditingUser(null)
    setDialogOpen(true)
    setActionError('')
  }

  const openEdit = (u: MemberUser) => {
    setDialogMode('edit')
    setEditingUser(u)
    setDialogOpen(true)
    setActionError('')
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingUser(null)
  }

  const handleSubmit = async (values: UserFormValues) => {
    setActionError('')
    setSuccessMessage('')
    try {
      if (dialogMode === 'create') {
        const res = await addAdminUser({
          nickname: values.nickname.trim(),
          phone: values.phone.trim() || undefined,
          email: values.email.trim() || undefined,
          password: values.password,
          roleId: values.roleId,
          status: values.status,
        })
        if (!res.success) {
          setActionError(res.error || t('admin.users.createSuccess').replace('成功', '失败'))
          return
        }
        setSuccessMessage(t('admin.users.createSuccess'))
      } else if (editingUser) {
        const res = await updateAdminUser(editingUser.id, {
          role: values.roleId,
          status: values.status,
        })
        if (!res.success) {
          setActionError(res.error || t('admin.users.updateSuccess').replace('成功', '失败'))
          return
        }
        setSuccessMessage(t('admin.users.updateSuccess'))
      }
      await mutate(async () => Promise.resolve())
      closeDialog()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '操作失败')
    }
  }

  const handleDelete = async (u: MemberUser) => {
    if (deletingId) return
    if (!window.confirm(t('admin.users.deleteConfirm'))) return
    setDeletingId(u.id)
    setActionError('')
    setSuccessMessage('')
    try {
      const res = await delAdminUser(u.id)
      if (!res.success) {
        setActionError(res.error || t('admin.users.deleteSuccess').replace('成功', '失败'))
        return
      }
      setSuccessMessage(t('admin.users.deleteSuccess'))
      await mutate(async () => Promise.resolve())
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="admin-page" data-testid="admin-users">
      <header className="admin-page-header">
        <h2>{t('admin.users.title')}</h2>
        <div className="admin-toolbar">
          <input
            type="search"
            placeholder={t('admin.users.searchPlaceholder')}
            value={keyword}
            onChange={(e) => {
              setPage(1)
              setKeyword(e.target.value)
            }}
            className="admin-search"
            data-testid="admin-users-search"
          />
          <select
            value={status}
            onChange={(e) => {
              setPage(1)
              setStatus(e.target.value as StatusFilter)
            }}
            className="admin-select"
            data-testid="admin-users-status"
          >
            <option value="all">{t('admin.users.filterAll')}</option>
            <option value="active">{t('admin.users.filterActive')}</option>
            <option value="disabled">{t('admin.users.filterDisabled')}</option>
          </select>
          <button
            type="button"
            onClick={openCreate}
            className="admin-refresh-btn"
            data-testid="admin-users-create"
          >
            {t('admin.users.create')}
          </button>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}
      {actionError ? <div className="error-banner" data-testid="admin-users-action-error">{actionError}</div> : null}
      {successMessage ? (
        <div className="admin-muted" data-testid="admin-users-success" style={{ marginLeft: 0 }}>
          {successMessage}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            {t('admin.users.title')}{' '}
            <span className="admin-muted">
              {t('admin.common.totalCount', { count: total })}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="empty-state">{t('common.loading')}</div>
          ) : rows.length === 0 ? (
            <div className="empty-state">{t('admin.common.noData')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.users.colNickname')}</TableHead>
                  <TableHead>{t('admin.users.colAccount')}</TableHead>
                  <TableHead>{t('admin.users.colRole')}</TableHead>
                  <TableHead>{t('admin.users.colLevel')}</TableHead>
                  <TableHead>{t('admin.users.colStatus')}</TableHead>
                  <TableHead>{t('admin.users.colCreatedAt')}</TableHead>
                  <TableHead>{t('admin.users.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => {
                  const roleLabel = u.isSystemAdmin
                    ? t('admin.users.roleSystem')
                    : u.roleId
                      ? t('admin.users.roleAdmin')
                      : t('admin.users.roleUser')
                  const statusLabel = u.status === 1 ? t('admin.users.statusActive') : t('admin.users.statusDisabled')
                  return (
                    <TableRow key={u.id} data-testid={`admin-users-row-${u.id}`}>
                      <TableCell>{u.nickname || '—'}</TableCell>
                      <TableCell className="admin-mono">{u.phone || u.email || u.username || '—'}</TableCell>
                      <TableCell>{roleLabel}</TableCell>
                      <TableCell>L{u.level}</TableCell>
                      <TableCell>
                        <span
                          className={`admin-badge ${u.status === 1 ? 'admin-badge-ok' : 'admin-badge-muted'}`}
                        >
                          {statusLabel}
                        </span>
                      </TableCell>
                      <TableCell className="admin-muted">
                        {DATE_FORMATTER.format(new Date(u.createdAt))}
                      </TableCell>
                      <TableCell>
                        <div className="admin-row-actions">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            data-testid={`admin-users-edit-${u.id}`}
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => void handleDelete(u)}
                            disabled={deletingId === u.id}
                            data-testid={`admin-users-delete-${u.id}`}
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
        <span>
          {t('admin.common.pageIndicator', { page, total: totalPages })}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          {t('admin.common.nextPage')}
        </button>
      </div>

      <UserDialog
        open={dialogOpen}
        mode={dialogMode}
        user={editingUser}
        onClose={closeDialog}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
