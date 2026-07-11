'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import {
  Loader2,
  MessageSquare,
  Edit,
  Plus,
  Trash2,
  Download,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@ihui/ui'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui'
import {
  api as fbApi,
  TYPE_ICON,
  TYPE_BADGE,
  STATUS_BADGE,
  PRIORITY_BADGE,
  type FeedbackItem,
  type FeedbackType,
  type FeedbackStatus,
  type Priority,
} from '@/lib/feedback'
import { HasPermi } from '@/components/auth/HasPermi'
import { ImageUpload } from '@/components/form/ImageUpload'
import { exportToExcel } from '@/lib/export-utils'

interface AdminFeedbackItem extends FeedbackItem {
  context?: string
  filePath?: string
  feedback?: string
  feedbackPath?: string
  creator?: string
  isDel?: number
}

interface ListData {
  list: AdminFeedbackItem[]
  total: number
}

const TYPE_TABS: { value: string; labelKey: 'all' | FeedbackType }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'bug', labelKey: 'bug' },
  { value: 'feature', labelKey: 'feature' },
  { value: 'improvement', labelKey: 'improvement' },
  { value: 'other', labelKey: 'other' },
]
const STATUS_TABS: { value: string; labelKey: 'all' | FeedbackStatus }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'pending', labelKey: 'pending' },
  { value: 'reviewing', labelKey: 'reviewing' },
  { value: 'resolved', labelKey: 'resolved' },
  { value: 'closed', labelKey: 'closed' },
]
const STATUS_OPTIONS: FeedbackStatus[] = ['pending', 'reviewing', 'resolved', 'closed']
const PRIORITY_OPTIONS: Priority[] = ['low', 'medium', 'high']
const PAGE_SIZE = 10

const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
const inputSm =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

const EMPTY_CREATE = {
  title: '',
  context: '',
  filePath: '',
  isDel: '0',
  feedback: '',
  feedbackPath: '',
}

const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'title', title: '标题' },
  { key: 'context', title: '内容' },
  { key: 'filePath', title: '图片' },
  { key: 'status', title: '状态' },
  { key: 'feedback', title: '反馈' },
  { key: 'feedbackPath', title: '反馈图片' },
  { key: 'creator', title: '创建人' },
  { key: 'createdAt', title: '创建时间' },
]

export default function AdminFeedbacksPage() {
  const t = useTranslations('admin.feedbacks')
  const tf = useTranslations('feedback')
  const tc = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const qc = useQueryClient()

  const [type, setType] = React.useState('all')
  const [status, setStatus] = React.useState('all')
  const [search, setSearch] = React.useState({ title: '', creator: '', createdAt: '' })
  const [debounced, setDebounced] = React.useState({ title: '', creator: '', createdAt: '' })
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AdminFeedbackItem | null>(null)
  const [form, setForm] = React.useState({
    status: 'pending' as FeedbackStatus,
    priority: 'low' as Priority,
    adminReply: '',
  })
  const [err, setErr] = React.useState<string | null>(null)
  const [openCreate, setOpenCreate] = React.useState(false)
  const [createForm, setCreateForm] = React.useState(EMPTY_CREATE)
  const [createErr, setCreateErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 400)
    return () => clearTimeout(timer)
  }, [search])

  const qs = React.useMemo(() => {
    const q = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (type !== 'all') q.set('type', type)
    if (status !== 'all') q.set('status', status)
    if (debounced.title) q.set('title', debounced.title)
    if (debounced.creator) q.set('creator', debounced.creator)
    if (debounced.createdAt) q.set('createdAt', debounced.createdAt)
    return q.toString()
  }, [type, status, debounced, page])

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'feedbacks', type, status, debounced, page],
    queryFn: () => fbApi<ListData>(`/api/admin/feedbacks?${qs}`),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { status: form.status, priority: form.priority }
      if (form.adminReply.trim()) body.adminReply = form.adminReply.trim()
      return fetchApi(`/api/admin/feedbacks/${editing?.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      toast.success('更新成功')
      qc.invalidateQueries({ queryKey: ['admin', 'feedbacks'] })
      close()
    },
    onError: (e: Error) => setErr(e.message),
  })

  const createMut = useMutation({
    mutationFn: () => {
      const body = {
        title: createForm.title.trim(),
        context: createForm.context.trim(),
        filePath: createForm.filePath || undefined,
        isDel: Number(createForm.isDel) || 0,
        feedback: createForm.feedback.trim() || undefined,
        feedbackPath: createForm.feedbackPath || undefined,
      }
      return fetchApi('/api/admin/feedbacks', { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success('新增成功')
      qc.invalidateQueries({ queryKey: ['admin', 'feedbacks'] })
      closeCreate()
    },
    onError: (e: Error) => setCreateErr(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => fetchApi(`/api/admin/feedbacks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['admin', 'feedbacks'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openEdit(fb: AdminFeedbackItem) {
    setEditing(fb)
    setForm({ status: fb.status, priority: fb.priority, adminReply: fb.adminReply ?? '' })
    setErr(null)
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    saveMut.mutate()
  }
  function openCreateDialog() {
    setCreateForm(EMPTY_CREATE)
    setCreateErr(null)
    setOpenCreate(true)
  }
  function closeCreate() {
    if (createMut.isPending) return
    setOpenCreate(false)
    setCreateErr(null)
  }
  function submitCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateErr(null)
    if (!createForm.title.trim()) {
      setCreateErr('请输入标题')
      return
    }
    createMut.mutate()
  }
  function handleDelete(fb: AdminFeedbackItem) {
    if (!confirm(`确认删除反馈 "${fb.title}"?`)) return
    deleteMut.mutate(fb.id)
  }
  function handleReset() {
    setSearch({ title: '', creator: '', createdAt: '' })
    setType('all')
    setStatus('all')
    setPage(1)
  }
  function handleExport() {
    const list = data?.list ?? []
    exportToExcel(
      `feedbacks_${Date.now()}`,
      EXPORT_COLUMNS,
      list as unknown as Record<string, unknown>[],
    )
  }

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const list = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const renderTabs = (
    tabs: { value: string; labelKey: string }[],
    value: string,
    onChange: (v: string) => void,
    prefix: 'type' | 'status',
  ) => (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === tab.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tf(`${prefix}_${tab.labelKey}`)}
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <HasPermi code="ai:userFeedback:export">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              {tc('export')}
            </Button>
          </HasPermi>
          <HasPermi code="ai:userFeedback:add">
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              {tc('add')}
            </Button>
          </HasPermi>
        </div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        {renderTabs(TYPE_TABS, type, setType, 'type')}
        {renderTabs(STATUS_TABS, status, setStatus, 'status')}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{t('title_col')}</Label>
          <Input
            className={inputSm}
            value={search.title}
            onChange={(e) => setSearch({ ...search, title: e.target.value })}
            placeholder={t('title_col')}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">创建人</Label>
          <Input
            className={inputSm}
            value={search.creator}
            onChange={(e) => setSearch({ ...search, creator: e.target.value })}
            placeholder="创建人"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">创建时间</Label>
          <Input
            type="date"
            className={inputSm}
            value={search.createdAt}
            onChange={(e) => setSearch({ ...search, createdAt: e.target.value })}
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
          {tc('reset')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t('user')}</th>
              <th className="px-4 py-2.5 font-medium">{t('type')}</th>
              <th className="px-4 py-2.5 font-medium">{t('title_col')}</th>
              <th className="px-4 py-2.5 font-medium">图片</th>
              <th className="px-4 py-2.5 font-medium">{t('status')}</th>
              <th className="px-4 py-2.5 font-medium">{t('priority')}</th>
              <th className="px-4 py-2.5 font-medium">反馈</th>
              <th className="px-4 py-2.5 font-medium">反馈图片</th>
              <th className="px-4 py-2.5 font-medium">{t('createdAt')}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </td>
              </tr>
            ) : (
              list.map((fb) => {
                const TypeIcon = TYPE_ICON[fb.type]
                return (
                  <tr
                    key={fb.id}
                    onClick={() => router.push(`/feedback/${fb.id}`)}
                    className="cursor-pointer transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5 font-medium">{fb.user ?? fb.creator ?? '-'}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          TYPE_BADGE[fb.type],
                        )}
                      >
                        <TypeIcon className="h-3 w-3" />
                        {tf(`type_${fb.type}`)}
                      </span>
                    </td>
                    <td className="max-w-xs break-words px-4 py-2.5">{fb.title}</td>
                    <td className="px-4 py-2.5">
                      {fb.filePath ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fb.filePath} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          STATUS_BADGE[fb.status],
                        )}
                      >
                        {tf(`status_${fb.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          PRIORITY_BADGE[fb.priority],
                        )}
                      >
                        {tf(`priority_${fb.priority}`)}
                      </span>
                    </td>
                    <td className="max-w-xs break-words px-4 py-2.5">{fb.feedback ?? '-'}</td>
                    <td className="px-4 py-2.5">
                      {fb.feedbackPath ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={fb.feedbackPath}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {dateFmt.format(new Date(fb.createdAt))}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEdit(fb)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                          {t('edit')}
                        </Button>
                        <HasPermi code="ai:userFeedback:remove">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(fb)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </HasPermi>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            共 {total} 条 · 第 {page}/{totalPages} 页
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t('editTitle')}</DialogTitle>
              <DialogDescription>{t('editDesc')}</DialogDescription>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            {editing && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                <div className="font-medium">{editing.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {editing.user ?? '-'} · {tf(`type_${editing.type}`)}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="fb-status">{tf('field_status')}</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as FeedbackStatus })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {tf(`status_${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb-priority">{tf('field_priority')}</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v as Priority })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {tf(`priority_${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb-reply">{t('fieldReply')}</Label>
              <textarea
                id="fb-reply"
                value={form.adminReply}
                onChange={(e) => setForm({ ...form, adminReply: e.target.value })}
                placeholder={t('replyPlaceholder')}
                rows={4}
                className={textareaClass}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={saveMut.isPending}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openCreate} onOpenChange={(o) => (o ? setOpenCreate(true) : closeCreate())}>
        <DialogContent>
          <form onSubmit={submitCreate} className="space-y-4">
            <DialogHeader>
              <DialogTitle>新增反馈</DialogTitle>
              <DialogDescription>填写反馈信息</DialogDescription>
            </DialogHeader>
            {createErr && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {createErr}
              </div>
            )}
            <div className="space-y-2">
              <Label>标题 *</Label>
              <Input
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                placeholder="请输入标题"
                className={inputSm}
              />
            </div>
            <div className="space-y-2">
              <Label>内容</Label>
              <textarea
                value={createForm.context}
                onChange={(e) => setCreateForm({ ...createForm, context: e.target.value })}
                placeholder="请输入内容"
                rows={3}
                className={textareaClass}
              />
            </div>
            <div className="space-y-2">
              <Label>反馈图片</Label>
              <ImageUpload
                value={createForm.filePath}
                onChange={(v) =>
                  setCreateForm({ ...createForm, filePath: Array.isArray(v) ? (v[0] ?? '') : v })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>是否删除</Label>
              <Select
                value={createForm.isDel}
                onValueChange={(v) => setCreateForm({ ...createForm, isDel: v })}
              >
                <SelectTrigger className={selectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">正常</SelectItem>
                  <SelectItem value="1">已删除</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>反馈内容</Label>
              <textarea
                value={createForm.feedback}
                onChange={(e) => setCreateForm({ ...createForm, feedback: e.target.value })}
                placeholder="请输入反馈内容"
                rows={3}
                className={textareaClass}
              />
            </div>
            <div className="space-y-2">
              <Label>反馈图片</Label>
              <ImageUpload
                value={createForm.feedbackPath}
                onChange={(v) =>
                  setCreateForm({
                    ...createForm,
                    feedbackPath: Array.isArray(v) ? (v[0] ?? '') : v,
                  })
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeCreate}
                disabled={createMut.isPending}
              >
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
