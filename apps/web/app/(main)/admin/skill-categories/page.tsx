'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'

import { Button } from '@ihui/ui-react'

import { CategoryTable } from './CategoryTable'
import { CategoryFormDialog, CategoryDeleteDialog } from './CategoryDialog'
import { api, fetchCategories, createCategory, updateCategory, EMPTY_FORM, categoryToForm } from './helpers'
import type { SkillCategory, SkillCategoryForm } from './types'
import { BackButton } from '@/components/common'

export default function AdminSkillCategoriesPage() {
  const t = useTranslations('admin.skillCategories')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<SkillCategory | null>(null)
  const [delId, setDelId] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'skill-categories'],
    queryFn: fetchCategories,
  })

  const saveMut = useMutation({
    mutationFn: (input: SkillCategoryForm) => {
      if (editing) {
        return updateCategory(editing.id, {
          name: input.name.trim(),
          slug: input.slug.trim() || undefined,
          icon: input.icon || undefined,
          sort: input.sort,
        })
      }
      return createCategory({
        name: input.name.trim(),
        slug: input.slug.trim(),
        icon: input.icon || undefined,
        sort: input.sort,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'skill-categories'] })
      close()
    },
  })

  const delMut = useMutation({
    mutationFn: (id: string) => api(`/api/skill-categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'skill-categories'] })
      setDelId(null)
    },
  })

  function openCreate() {
    setEditing(null)
    setOpen(true)
  }
  function openEdit(cat: SkillCategory) {
    setEditing(cat)
    setOpen(true)
  }
  function close() {
    if (saveMut.isPending) return
    setOpen(false)
    setEditing(null)
  }
  function onValid(values: SkillCategoryForm) {
    saveMut.mutate(values)
  }

  const categories = (data ?? []).sort((a, b) => a.sort - b.sort)

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          {t('create')}
        </Button>
      </div>

      <CategoryTable
        categories={categories}
        isLoading={isLoading}
        error={error as Error | null}
        onEdit={openEdit}
        onDelete={(id) => setDelId(id)}
      />

      <CategoryFormDialog
        open={open}
        editing={editing}
        defaultValues={editing ? categoryToForm(editing) : EMPTY_FORM}
        savePending={saveMut.isPending}
        onValid={onValid}
        onClose={close}
      />

      <CategoryDeleteDialog
        delId={delId}
        delPending={delMut.isPending}
        onConfirm={() => {
          if (delId) delMut.mutate(delId)
        }}
        onClose={() => setDelId(null)}
      />
    </div>
  )
}