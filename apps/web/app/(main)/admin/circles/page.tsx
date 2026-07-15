'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@ihui/ui'

import { CirclesFilter } from './CirclesFilter'
import { CirclesTable } from './CirclesTable'
import { CircleDialog } from './CircleDialog'
import { EMPTY_FORM, MOCK_CIRCLES, PAGE_SIZE, circleToForm, slugify } from './helpers'
import type { Circle, CircleForm } from './types'

// TODO 后端对接:
// - GET /api/admin/circles 列表端点尚未实现,当前使用本地 mock 数据。
// - DELETE /api/admin/circles/:id 已实现(后端 community.ts),后端就绪后可接入。
// - PUT /api/admin/circles/:id/show 已实现(后端 community.ts),后端就绪后可接入。
// - POST/PUT /api/admin/circles 创建/编辑端点尚未实现。

export default function AdminCirclesPage() {
  const t = useTranslations('admin.circles')

  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [items, setItems] = React.useState<Circle[]>(MOCK_CIRCLES)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Circle | null>(null)
  const [form, setForm] = React.useState<CircleForm>(EMPTY_FORM)
  const [err, setErr] = React.useState<string | null>(null)
  const [savePending, setSavePending] = React.useState(false)
  const [togglePending, setTogglePending] = React.useState(false)
  const [deletePending, setDeletePending] = React.useState(false)

  const filtered = React.useMemo(() => {
    if (!search.trim()) return items
    const q = search.trim().toLowerCase()
    return items.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q))
  }, [items, search])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setErr(null)
    setOpen(true)
  }
  function openEdit(item: Circle) {
    setEditing(item)
    setForm(circleToForm(item))
    setErr(null)
    setOpen(true)
  }
  function closeDialog() {
    if (savePending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }

  function genId(): string {
    return `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.name.trim()) return setErr(t('nameRequired'))
    if (!form.slug.trim()) return setErr(t('slugRequired'))
    setSavePending(true)
    // 模拟异步保存;后端就绪后改为调用 api() 真实接口
    setTimeout(() => {
      const slug = form.slug.trim() || slugify(form.name)
      if (editing) {
        setItems((prev) =>
          prev.map((c) =>
            c.id === editing.id
              ? {
                  ...c,
                  name: form.name.trim(),
                  slug,
                  description: form.description.trim() || null,
                  coverImage: form.coverImage.trim() || null,
                  isPublished: form.isPublished,
                }
              : c,
          ),
        )
        toast.success(t('updateSuccess'))
      } else {
        const now = new Date().toISOString()
        const newItem: Circle = {
          id: genId(),
          name: form.name.trim(),
          slug,
          description: form.description.trim() || null,
          coverImage: form.coverImage.trim() || null,
          categoryId: null,
          memberCount: 0,
          postCount: 0,
          isPublished: form.isPublished,
          createdBy: null,
          creatorName: '管理员',
          createdAt: now,
        }
        setItems((prev) => [newItem, ...prev])
        toast.success(t('createSuccess'))
      }
      setSavePending(false)
      closeDialog()
    }, 200)
  }

  function handleToggle(item: Circle) {
    if (!window.confirm(t('toggleConfirm'))) return
    setTogglePending(true)
    // 后端就绪后:await api(`/api/admin/circles/${item.id}/show`, { method: 'PUT', body: JSON.stringify({ isPublished: !item.isPublished }) })
    setTimeout(() => {
      setItems((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, isPublished: !c.isPublished } : c)),
      )
      toast.success(t('toggleSuccess'))
      setTogglePending(false)
    }, 150)
  }

  function handleDelete(item: Circle) {
    if (!window.confirm(t('deleteConfirm'))) return
    setDeletePending(true)
    // 后端就绪后:await api(`/api/admin/circles/${item.id}`, { method: 'DELETE' })
    setTimeout(() => {
      setItems((prev) => prev.filter((c) => c.id !== item.id))
      toast.success(t('deleteSuccess'))
      setDeletePending(false)
    }, 150)
  }

  return (
    <div className="space-y-4">
      <CirclesFilter search={search} setSearch={setSearch} onCreate={openCreate} mockMode />
      <CirclesTable
        list={pageItems}
        isLoading={false}
        togglePending={togglePending}
        deletePending={deletePending}
        onEdit={openEdit}
        onToggle={handleToggle}
        onDelete={handleDelete}
      />
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{t('total', { total })}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">{t('pageOf', { page, totalPages })}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <CircleDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        err={err}
        savePending={savePending}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}
