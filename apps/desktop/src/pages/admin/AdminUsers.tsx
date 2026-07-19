/**
 * AdminUsers — 用户管理列表。
 *
 * 数据源:`listAdminUsers({ search, role, status, page, pageSize })`。
 * 仅读 + 关键字搜索 + 状态筛选;变更/创建走 web 后台(本子任务范围内不重复实装)。
 */
import { useEffect, useMemo, useState } from 'react'
import { listAdminUsers, type MemberUser } from '@ihui/api-client'
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

type StatusFilter = 'all' | 'active' | 'disabled'

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: '全部',
  active: '正常',
  disabled: '禁用',
}

const STATUS_CLASS: Record<StatusFilter, string> = {
  all: '',
  active: 'admin-badge-ok',
  disabled: 'admin-badge-muted',
}

export default function AdminUsers() {
  const [users, setUsers] = useState<MemberUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const params = useMemo(
    () => ({
      page,
      pageSize,
      search: keyword.trim() || undefined,
      status: status === 'all' ? undefined : status === 'active' ? 1 : 0,
    }),
    [page, pageSize, keyword, status],
  )

  const load = () => {
    setLoading(true)
    setError('')
    void (async () => {
      const res = await listAdminUsers(params)
      if (res.success) {
        setUsers(res.data.list)
        setTotal(res.data.total)
      } else {
        setError(res.error || '加载失败')
      }
      setLoading(false)
    })()
  }

  useEffect(() => {
    load()
  }, [params])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="admin-page" data-testid="admin-users">
      <header className="admin-page-header">
        <h2>用户管理</h2>
        <div className="admin-toolbar">
          <input
            type="search"
            placeholder="搜索昵称/手机/邮箱"
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
            {(['all', 'active', 'disabled'] as StatusFilter[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>
            用户列表 <span className="admin-muted">共 {total} 条</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="empty-state">加载中...</div>
          ) : users.length === 0 ? (
            <div className="empty-state">暂无用户</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>昵称</TableHead>
                  <TableHead>账号</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>等级</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>注册时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.nickname || '—'}</TableCell>
                    <TableCell className="admin-mono">{u.phone || u.email || u.username || '—'}</TableCell>
                    <TableCell>{u.isSystemAdmin ? '超管' : u.roleId ? '管理员' : '用户'}</TableCell>
                    <TableCell>L{u.level}</TableCell>
                    <TableCell>
                      <span className={`admin-badge ${u.status === 1 ? STATUS_CLASS.active : STATUS_CLASS.disabled}`}>
                        {u.status === 1 ? '正常' : '禁用'}
                      </span>
                    </TableCell>
                    <TableCell className="admin-muted">
                      {new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(u.createdAt))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          上一页
        </button>
        <span>
          第 {page} / {totalPages} 页
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  )
}
