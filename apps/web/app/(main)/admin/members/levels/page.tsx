'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Plus, Download, Search, Crown, Users } from 'lucide-react'
import { fetchApi } from '@/lib/api'
import { exportFromApi, exportToExcel, type ExportColumn } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { DatePicker } from '@/components/form/DatePicker'
import { cn } from '@/lib/utils'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'

interface Item {
  id: string
  [k: string]: unknown
}
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const PAGE_SIZE = 10
type FormState = Record<string, string>

// ===== VIP Level config =====
const LEVEL_RESOURCE = '/api/admin/auth-vip-level'
const LEVEL_PERM = 'ai:vip_level'
const LEVEL_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'title', label: '标题', required: true },
  { key: 'level', label: '等级', required: true },
  { key: 'remark', label: '备注', required: true },
  { key: 'progress', label: '进度', required: true },
  { key: 'model1', label: '模型1', required: true },
  { key: 'model2', label: '模型2', required: true },
  { key: 'creator', label: '创建人' },
]
const LEVEL_SEARCH: { key: string; label: string }[] = [
  { key: 'title', label: '标题' },
  { key: 'level', label: '等级' },
  { key: 'progress', label: '进度' },
  { key: 'model1', label: '模型1' },
]
const LEVEL_DATE_FIELDS: { key: string; label: string }[] = [
  { key: 'createdTime', label: '创建时间' },
]
const LEVEL_ALL_KEYS = [...LEVEL_FIELDS.map((f) => f.key), ...LEVEL_DATE_FIELDS.map((d) => d.key)]
const LEVEL_LABELS: Record<string, string> = Object.fromEntries(
  [...LEVEL_FIELDS, ...LEVEL_DATE_FIELDS].map((f) => [f.key, f.label]),
)
const LEVEL_EMPTY: FormState = Object.fromEntries(LEVEL_ALL_KEYS.map((k) => [k, '']))
const LEVEL_EXPORT: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  ...LEVEL_ALL_KEYS.map((k) => ({ key: k, title: LEVEL_LABELS[k] ?? '' })),
]

// ===== User VIP config =====
const USER_RESOURCE = '/api/admin/user-vip'
const USER_PERM = 'ai:user_vip'
const USER_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'userId', label: '用户ID' },
  { key: 'openId', label: 'openId', required: true },
  { key: 'vipId', label: 'VIP ID', required: true },
  { key: 'progress', label: '进度', required: true },
  { key: 'creator', label: '创建人' },
]
const USER_SEARCH: { key: string; label: string }[] = [
  { key: 'userId', label: '用户ID' },
  { key: 'openId', label: 'openId' },
  { key: 'vipId', label: 'VIP ID' },
  { key: 'progress', label: '进度' },
]
const USER_DATE_FIELDS: { key: string; label: string }[] = [
  { key: 'createdTime', label: '创建时间' },
]
const USER_ALL_KEYS = [...USER_FIELDS.map((f) => f.key), ...USER_DATE_FIELDS.map((d) => d.key)]
const USER_LABELS: Record<string, string> = Object.fromEntries(
  [...USER_FIELDS, ...USER_DATE_FIELDS].map((f) => [f.key, f.label]),
)
const USER_EMPTY: FormState = Object.fromEntries(USER_ALL_KEYS.map((k) => [k, '']))
const USER_EXPORT: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  ...USER_ALL_KEYS.map((k) => ({ key: k, title: USER_LABELS[k] ?? '' })),
]

const th = 'px-4 py-2.5 font-medium'

export default function VipLevelPage() {
  const qc = useQueryClient()
  const [tab, setTab] = React.useState<'level' | 'user'>('level')

  // ===== Level state =====
  const [levelSearch, setLevelSearch] = React.useState<FormState>(
    Object.fromEntries(LEVEL_SEARCH.map((f) => [f.key, ''])),
  )
  const [levelPage, setLevelPage] = React.useState(1)
  const [levelOpen, setLevelOpen] = React.useState(false)
  const [levelEditing, setLevelEditing] = React.useState<Item | null>(null)
  const [levelForm, setLevelForm] = React.useState<FormState>(LEVEL_EMPTY)
  const [levelDelId, setLevelDelId] = React.useState<string | null>(null)

  // ===== User VIP state =====
  const [userSearch, setUserSearch] = React.useState<FormState>(
    Object.fromEntries(USER_SEARCH.map((f) => [f.key, ''])),
  )
  const [userPage, setUserPage] = React.useState(1)
  const [userOpen, setUserOpen] = React.useState(false)
  const [userEditing, setUserEditing] = React.useState<Item | null>(null)
  const [userForm, setUserForm] = React.useState<FormState>(USER_EMPTY)
  const [userDelId, setUserDelId] = React.useState<string | null>(null)

  // ===== Level query/mutations =====
  const levelParams = React.useMemo(() => {
    const p: Record<string, string> = { pageNum: String(levelPage), pageSize: String(PAGE_SIZE) }
    for (const f of LEVEL_SEARCH) {
      const v = levelSearch[f.key]?.trim()
      if (v) p[f.key] = v
    }
    return p
  }, [levelSearch, levelPage])

  const { data: levelData, isLoading: levelLoading } = useQuery({
    queryKey: ['admin', LEVEL_PERM, levelParams],
    queryFn: () =>
      api<{ list: Item[]; total: number }>(`${LEVEL_RESOURCE}?${new URLSearchParams(levelParams)}`),
  })
  const levelList = levelData?.list ?? []
  const levelTotal = levelData?.total ?? 0
  const levelTotalPages = Math.max(1, Math.ceil(levelTotal / PAGE_SIZE))

  const levelSaveMut = useMutation({
    mutationFn: () =>
      levelEditing
        ? api(`${LEVEL_RESOURCE}/${levelEditing.id}`, {
            method: 'PUT',
            body: JSON.stringify(levelForm),
          })
        : api(LEVEL_RESOURCE, { method: 'POST', body: JSON.stringify(levelForm) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', LEVEL_PERM] })
      toast.success(levelEditing ? '更新成功' : '创建成功')
      closeLevel()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const levelDelMut = useMutation({
    mutationFn: (id: string) => api(`${LEVEL_RESOURCE}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', LEVEL_PERM] })
      toast.success('删除成功')
      setLevelDelId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ===== User VIP query/mutations =====
  const userParams = React.useMemo(() => {
    const p: Record<string, string> = { pageNum: String(userPage), pageSize: String(PAGE_SIZE) }
    for (const f of USER_SEARCH) {
      const v = userSearch[f.key]?.trim()
      if (v) p[f.key] = v
    }
    return p
  }, [userSearch, userPage])

  const { data: userData, isLoading: userLoading } = useQuery({
    queryKey: ['admin', USER_PERM, userParams],
    queryFn: () =>
      api<{ list: Item[]; total: number }>(`${USER_RESOURCE}?${new URLSearchParams(userParams)}`),
    enabled: tab === 'user',
  })
  const userList = userData?.list ?? []
  const userTotal = userData?.total ?? 0
  const userTotalPages = Math.max(1, Math.ceil(userTotal / PAGE_SIZE))

  const userSaveMut = useMutation({
    mutationFn: () =>
      userEditing
        ? api(`${USER_RESOURCE}/${userEditing.id}`, {
            method: 'PUT',
            body: JSON.stringify(userForm),
          })
        : api(USER_RESOURCE, { method: 'POST', body: JSON.stringify(userForm) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', USER_PERM] })
      toast.success(userEditing ? '更新成功' : '创建成功')
      closeUser()
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const userDelMut = useMutation({
    mutationFn: (id: string) => api(`${USER_RESOURCE}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', USER_PERM] })
      toast.success('删除成功')
      setUserDelId(null)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  // ===== Level handlers =====
  function openLevelCreate() {
    setLevelEditing(null)
    setLevelForm(LEVEL_EMPTY)
    setLevelOpen(true)
  }
  function openLevelEdit(item: Item) {
    setLevelEditing(item)
    const next: FormState = { ...LEVEL_EMPTY }
    for (const k of LEVEL_ALL_KEYS) next[k] = String(item[k] ?? '')
    setLevelForm(next)
    setLevelOpen(true)
  }
  function closeLevel() {
    if (levelSaveMut.isPending) return
    setLevelOpen(false)
    setLevelEditing(null)
  }
  function submitLevel(e: React.FormEvent) {
    e.preventDefault()
    for (const f of LEVEL_FIELDS)
      if (f.required && !levelForm[f.key]?.trim()) {
        toast.error(`${f.label}为必填项`)
        return
      }
    levelSaveMut.mutate()
  }
  function handleLevelReset() {
    setLevelSearch(Object.fromEntries(LEVEL_SEARCH.map((f) => [f.key, ''])))
    setLevelPage(1)
  }
  async function handleLevelExport() {
    const ok = await exportFromApi(
      `${LEVEL_RESOURCE}?${new URLSearchParams(levelParams)}`,
      'VIP等级',
      LEVEL_EXPORT,
    )
    if (!ok) toast.error('导出失败')
  }

  // ===== User VIP handlers =====
  function openUserCreate() {
    setUserEditing(null)
    setUserForm(USER_EMPTY)
    setUserOpen(true)
  }
  function openUserEdit(item: Item) {
    setUserEditing(item)
    const next: FormState = { ...USER_EMPTY }
    for (const k of USER_ALL_KEYS) next[k] = String(item[k] ?? '')
    setUserForm(next)
    setUserOpen(true)
  }
  function closeUser() {
    if (userSaveMut.isPending) return
    setUserOpen(false)
    setUserEditing(null)
  }
  function submitUser(e: React.FormEvent) {
    e.preventDefault()
    for (const f of USER_FIELDS)
      if (f.required && !userForm[f.key]?.trim()) {
        toast.error(`${f.label}为必填项`)
        return
      }
    userSaveMut.mutate()
  }
  function handleUserReset() {
    setUserSearch(Object.fromEntries(USER_SEARCH.map((f) => [f.key, ''])))
    setUserPage(1)
  }
  function handleUserExport() {
    exportToExcel('用户VIP', USER_EXPORT, userList as unknown as Record<string, unknown>[])
  }

  const tabCls = (active: boolean) =>
    cn(
      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
      active
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground',
    )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Crown className="h-6 w-6 text-primary" />
          VIP管理
        </h1>
      </div>

      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
        <button onClick={() => setTab('level')} className={tabCls(tab === 'level')}>
          <Crown className="mr-1 inline h-4 w-4" />
          VIP等级
        </button>
        <button onClick={() => setTab('user')} className={tabCls(tab === 'user')}>
          <Users className="mr-1 inline h-4 w-4" />
          用户VIP
        </button>
      </div>

      {tab === 'level' && (
        <>
          <div className="flex gap-2">
            <HasPermi code={`${LEVEL_PERM}:export`}>
              <Button variant="outline" size="sm" onClick={handleLevelExport}>
                <Download className="h-4 w-4" />
                导出
              </Button>
            </HasPermi>
            <HasPermi code={`${LEVEL_PERM}:add`}>
              <Button size="sm" onClick={openLevelCreate} className="ml-auto">
                <Plus className="h-4 w-4" />
                新增
              </Button>
            </HasPermi>
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
            {LEVEL_SEARCH.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  className="h-9 w-36"
                  value={levelSearch[f.key] ?? ''}
                  onChange={(e) => setLevelSearch({ ...levelSearch, [f.key]: e.target.value })}
                  placeholder={`搜索${f.label}`}
                />
              </div>
            ))}
            <Button size="sm" onClick={() => setLevelPage(1)}>
              <Search className="h-4 w-4" />
              搜索
            </Button>
            <Button variant="outline" size="sm" onClick={handleLevelReset}>
              重置
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className={th}>ID</th>
                  {LEVEL_ALL_KEYS.map((k) => (
                    <th key={k} className={th}>
                      {LEVEL_LABELS[k]}
                    </th>
                  ))}
                  <th className={th}>操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {levelLoading ? (
                  <tr>
                    <td
                      colSpan={2 + LEVEL_ALL_KEYS.length}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      加载中…
                    </td>
                  </tr>
                ) : levelList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2 + LEVEL_ALL_KEYS.length}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      <Crown className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  levelList.map((item) => (
                    <tr key={String(item.id)} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5">{String(item.id)}</td>
                      {LEVEL_ALL_KEYS.map((k) => (
                        <td key={k} className="px-4 py-2.5">
                          {String(item[k] ?? '-')}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 space-x-2">
                        <HasPermi code={`${LEVEL_PERM}:edit`}>
                          <button
                            className="text-primary hover:underline"
                            onClick={() => openLevelEdit(item)}
                          >
                            编辑
                          </button>
                        </HasPermi>
                        <HasPermi code={`${LEVEL_PERM}:remove`}>
                          <button
                            className="text-destructive hover:underline"
                            onClick={() => setLevelDelId(String(item.id))}
                          >
                            删除
                          </button>
                        </HasPermi>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {levelTotal > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                共 {levelTotal} 条 · {levelPage}/{levelTotalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={levelPage <= 1}
                  onClick={() => setLevelPage(levelPage - 1)}
                >
                  上一页
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={levelPage >= levelTotalPages}
                  onClick={() => setLevelPage(levelPage + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'user' && (
        <>
          <div className="flex gap-2">
            <HasPermi code={`${USER_PERM}:export`}>
              <Button variant="outline" size="sm" onClick={handleUserExport}>
                <Download className="h-4 w-4" />
                导出
              </Button>
            </HasPermi>
            <HasPermi code={`${USER_PERM}:add`}>
              <Button size="sm" onClick={openUserCreate} className="ml-auto">
                <Plus className="h-4 w-4" />
                新增
              </Button>
            </HasPermi>
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
            {USER_SEARCH.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  className="h-9 w-36"
                  value={userSearch[f.key] ?? ''}
                  onChange={(e) => setUserSearch({ ...userSearch, [f.key]: e.target.value })}
                  placeholder={`搜索${f.label}`}
                />
              </div>
            ))}
            <Button size="sm" onClick={() => setUserPage(1)}>
              <Search className="h-4 w-4" />
              搜索
            </Button>
            <Button variant="outline" size="sm" onClick={handleUserReset}>
              重置
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className={th}>ID</th>
                  {USER_ALL_KEYS.map((k) => (
                    <th key={k} className={th}>
                      {USER_LABELS[k]}
                    </th>
                  ))}
                  <th className={th}>操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {userLoading ? (
                  <tr>
                    <td
                      colSpan={2 + USER_ALL_KEYS.length}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                      加载中…
                    </td>
                  </tr>
                ) : userList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2 + USER_ALL_KEYS.length}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  userList.map((item) => (
                    <tr key={String(item.id)} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5">{String(item.id)}</td>
                      {USER_ALL_KEYS.map((k) => (
                        <td key={k} className="px-4 py-2.5">
                          {String(item[k] ?? '-')}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 space-x-2">
                        <HasPermi code={`${USER_PERM}:edit`}>
                          <button
                            className="text-primary hover:underline"
                            onClick={() => openUserEdit(item)}
                          >
                            编辑
                          </button>
                        </HasPermi>
                        <HasPermi code={`${USER_PERM}:remove`}>
                          <button
                            className="text-destructive hover:underline"
                            onClick={() => setUserDelId(String(item.id))}
                          >
                            删除
                          </button>
                        </HasPermi>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {userTotal > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                共 {userTotal} 条 · {userPage}/{userTotalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={userPage <= 1}
                  onClick={() => setUserPage(userPage - 1)}
                >
                  上一页
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={userPage >= userTotalPages}
                  onClick={() => setUserPage(userPage + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Level Dialog */}
      <Dialog open={levelOpen} onOpenChange={(o) => (o ? setLevelOpen(true) : closeLevel())}>
        <DialogContent>
          <form onSubmit={submitLevel} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{levelEditing ? '编辑VIP等级' : '新增VIP等级'}</DialogTitle>
              <DialogDescription>
                {levelEditing ? '修改VIP等级' : '添加新的VIP等级'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {LEVEL_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label>
                    {f.label}
                    {f.required ? ' *' : ''}
                  </Label>
                  <Input
                    value={levelForm[f.key]}
                    onChange={(e) => setLevelForm({ ...levelForm, [f.key]: e.target.value })}
                  />
                </div>
              ))}
              {LEVEL_DATE_FIELDS.map((d) => (
                <DatePicker
                  key={d.key}
                  label={d.label}
                  value={levelForm[d.key]}
                  onChange={(v) => setLevelForm({ ...levelForm, [d.key]: v })}
                />
              ))}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeLevel}
                disabled={levelSaveMut.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={levelSaveMut.isPending}>
                {levelSaveMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Level Delete Dialog */}
      <Dialog
        open={levelDelId !== null}
        onOpenChange={(o) => {
          if (!o) setLevelDelId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>确定要删除该记录吗？此操作不可撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLevelDelId(null)}
              disabled={levelDelMut.isPending}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={levelDelMut.isPending}
              onClick={() => levelDelId && levelDelMut.mutate(levelDelId)}
            >
              {levelDelMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User VIP Dialog */}
      <Dialog open={userOpen} onOpenChange={(o) => (o ? setUserOpen(true) : closeUser())}>
        <DialogContent>
          <form onSubmit={submitUser} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{userEditing ? '编辑用户VIP' : '新增用户VIP'}</DialogTitle>
              <DialogDescription>
                {userEditing ? '修改用户VIP进度' : '添加新的用户VIP'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {USER_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label>
                    {f.label}
                    {f.required ? ' *' : ''}
                  </Label>
                  <Input
                    value={userForm[f.key]}
                    onChange={(e) => setUserForm({ ...userForm, [f.key]: e.target.value })}
                  />
                </div>
              ))}
              {USER_DATE_FIELDS.map((d) => (
                <DatePicker
                  key={d.key}
                  label={d.label}
                  value={userForm[d.key]}
                  onChange={(v) => setUserForm({ ...userForm, [d.key]: v })}
                />
              ))}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeUser}
                disabled={userSaveMut.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={userSaveMut.isPending}>
                {userSaveMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* User VIP Delete Dialog */}
      <Dialog
        open={userDelId !== null}
        onOpenChange={(o) => {
          if (!o) setUserDelId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>确定要删除该记录吗？此操作不可撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setUserDelId(null)}
              disabled={userDelMut.isPending}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={userDelMut.isPending}
              onClick={() => userDelId && userDelMut.mutate(userDelId)}
            >
              {userDelMut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
