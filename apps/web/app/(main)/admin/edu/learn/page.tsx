'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, BookOpen, FolderTree, GraduationCap } from 'lucide-react'
import { eduApi, buildQs, type PageData } from '@/lib/edu'
import { Button, Card, CardContent } from '@ihui/ui'

import { LearnFilter } from './LearnFilter'
import { LearnTable } from './LearnTable'
import { LearnDialog } from './LearnDialog'
import { PAGE_SIZE, EMPTY, SUB_LINKS, lessonToForm } from './helpers'
import type { Category, Lesson, LForm } from './types'

export default function EduLearnPage() {
  const qc = useQueryClient()
  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [categoryId, setCategoryId] = React.useState('all')
  const [page, setPage] = React.useState(1)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Lesson | null>(null)
  const [form, setForm] = React.useState<LForm>(EMPTY)
  const [err, setErr] = React.useState<string | null>(null)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [search])
  React.useEffect(() => {
    setPage(1)
  }, [categoryId])

  const { data: categoriesData } = useQuery({
    queryKey: ['edu', 'learn', 'categories'],
    queryFn: () =>
      eduApi<{ list: Category[] }>(`/api/admin/learn/categories`).then((d) => d.list ?? []),
  })
  const categories = categoriesData ?? []

  const { data, isLoading, error } = useQuery({
    queryKey: ['edu', 'learn', 'lessons', debounced, categoryId, page],
    queryFn: () =>
      eduApi<PageData<Lesson>>(
        `/api/admin/learn/lessons${buildQs({ page, pageSize: PAGE_SIZE, search: debounced, categoryId: categoryId === 'all' ? '' : categoryId })}`,
      ),
  })

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        title: form.title.trim(),
        categoryId: form.categoryId || null,
        intro: form.intro.trim() || null,
        lecturerName: form.lecturerName.trim() || null,
        price: form.price,
        isFree: form.isFree,
        isPublished: form.isPublished,
        sort: Number(form.sort) || 0,
      }
      if (editing)
        return eduApi(`/api/admin/learn/lessons/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      return eduApi(`/api/admin/learn/lessons`, { method: 'POST', body: JSON.stringify(body) })
    },
    onSuccess: () => {
      toast.success(editing ? '更新成功' : '创建成功')
      qc.invalidateQueries({ queryKey: ['edu', 'learn', 'lessons'] })
      closeDialog()
    },
    onError: (e: Error) => setErr(e.message),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => eduApi(`/api/admin/learn/lessons/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('删除成功')
      qc.invalidateQueries({ queryKey: ['edu', 'learn', 'lessons'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setErr(null)
    setOpen(true)
  }
  function openEdit(l: Lesson) {
    setEditing(l)
    setForm(lessonToForm(l))
    setErr(null)
    setOpen(true)
  }
  function closeDialog() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
    setErr(null)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!form.title.trim()) return setErr('课程标题不能为空')
    saveMut.mutate()
  }
  function handleDelete(l: Lesson) {
    if (window.confirm('确定删除？')) deleteMut.mutate(l.id)
  }

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const lessons = data?.list ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">学习管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          课程学习、直播录播、资料作业、记录进度、计划提醒、社区排行
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {SUB_LINKS.map((s) => {
          const Icon = s.icon
          return (
            <Link
              key={s.href}
              href={s.href}
              className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-accent"
            >
              <Icon className="h-4 w-4 text-primary" />
              <span>{s.label}</span>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-700 text-white">
              <BookOpen className="h-7 w-7" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">课程总数</div>
              <div className="mt-1 text-2xl font-semibold">{total}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-400 text-white">
              <FolderTree className="h-7 w-7" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">分类数</div>
              <div className="mt-1 text-2xl font-semibold">{categories.length}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 text-white">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div>
              <div className="text-sm text-muted-foreground">报名总数</div>
              <div className="mt-1 text-2xl font-semibold">
                {lessons.reduce((a, l) => a + l.signupCount, 0)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <LearnFilter
        search={search}
        onSearchChange={setSearch}
        categoryId={categoryId}
        onCategoryChange={setCategoryId}
        categories={categories}
        onCreate={openCreate}
      />

      <LearnTable
        rows={lessons}
        isLoading={isLoading}
        error={error as Error | null}
        onEdit={openEdit}
        onDelete={handleDelete}
        deletePending={deleteMut.isPending}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">共 {total} 门课程</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <LearnDialog
        open={open}
        editing={editing}
        form={form}
        setForm={setForm}
        err={err}
        savePending={saveMut.isPending}
        categories={categories}
        onSubmit={submit}
        onClose={closeDialog}
      />
    </div>
  )
}
