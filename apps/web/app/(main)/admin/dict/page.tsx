'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { BookMarked, Plus, Download } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import { Button } from '@ihui/ui'
import { DictFilter } from './DictFilter'
import { DictTable } from './DictTable'
import { DictTypeDialog, DictItemDialog } from './DictDialog'
import {
  EMPTY_TYPE,
  EMPTY_ITEM,
  EXPORT_COLUMNS,
  fetchDictList,
  filterDictList,
  buildDictExportRows,
} from './helpers'
import type { DictItem, DictType } from './types'

export default function DictPage() {
  const t = useTranslations('adminTools')
  const tc = useTranslations('common')
  const qc = useQueryClient()
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set(['1']))
  const [typeOpen, setTypeOpen] = React.useState(false)
  const [editingType, setEditingType] = React.useState<DictType | null>(null)
  const [typeForm, setTypeForm] = React.useState(EMPTY_TYPE)
  const [itemOpen, setItemOpen] = React.useState(false)
  const [itemParent, setItemParent] = React.useState<DictType | null>(null)
  const [editingItem, setEditingItem] = React.useState<DictItem | null>(null)
  const [itemForm, setItemForm] = React.useState(EMPTY_ITEM)
  const [search, setSearch] = React.useState('')

  const { data: list, isLoading } = useQuery({
    queryKey: ['admin', 'dict'],
    queryFn: fetchDictList,
  })

  const saveTypeMut = useMutation({
    mutationFn: async () => {
      const body = {
        dictName: typeForm.name,
        dictType: typeForm.code,
        remark: typeForm.description,
      }
      const r = editingType
        ? await fetchApi(`/api/admin/dict/type/${editingType.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : await fetchApi('/api/admin/dict/type', { method: 'POST', body: JSON.stringify(body) })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'dict'] })
      closeType()
      toast.success(t('dict.saveSuccess'))
    },
  })
  const delTypeMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi(`/api/admin/dict/type/${id}`, { method: 'DELETE' })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'dict'] })
      toast.success(t('dict.deleteSuccess'))
    },
  })
  const saveItemMut = useMutation({
    mutationFn: async () => {
      const body = {
        dictLabel: itemForm.label,
        dictValue: itemForm.value,
        dictSort: itemForm.sort,
        dictType: itemParent?.code,
      }
      const r = editingItem
        ? await fetchApi(`/api/admin/dict/data/${editingItem.id}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : await fetchApi('/api/admin/dict/data', { method: 'POST', body: JSON.stringify(body) })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'dict'] })
      closeItem()
      toast.success(t('dict.saveSuccess'))
    },
  })
  const delItemMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetchApi(`/api/admin/dict/data/${id}`, { method: 'DELETE' })
      if (!r.success) throw new Error(r.error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'dict'] })
      toast.success(t('dict.deleteSuccess'))
    },
  })

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function openCreateType() {
    setEditingType(null)
    setTypeForm(EMPTY_TYPE)
    setTypeOpen(true)
  }
  function openEditType(d: DictType) {
    setEditingType(d)
    setTypeForm({ name: d.name, code: d.code, description: d.description })
    setTypeOpen(true)
  }
  function closeType() {
    if (saveTypeMut.isPending) return
    setTypeOpen(false)
    setEditingType(null)
    setTypeForm(EMPTY_TYPE)
  }
  function submitType(e: React.FormEvent) {
    e.preventDefault()
    if (!typeForm.name.trim() || !typeForm.code.trim()) {
      toast.error(t('dict.nameRequired'))
      return
    }
    saveTypeMut.mutate()
  }
  function openCreateItem(d: DictType) {
    setItemParent(d)
    setEditingItem(null)
    setItemForm(EMPTY_ITEM)
    setItemOpen(true)
  }
  function openEditItem(d: DictType, it: DictItem) {
    setItemParent(d)
    setEditingItem(it)
    setItemForm({ label: it.label, value: it.value, sort: it.sort })
    setItemOpen(true)
  }
  function closeItem() {
    if (saveItemMut.isPending) return
    setItemOpen(false)
    setItemParent(null)
    setEditingItem(null)
    setItemForm(EMPTY_ITEM)
  }
  function submitItem(e: React.FormEvent) {
    e.preventDefault()
    if (!itemForm.label.trim() || !itemForm.value.trim()) {
      toast.error(t('dict.itemRequired'))
      return
    }
    saveItemMut.mutate()
  }
  function handleExport() {
    exportToExcel(t('dict.exportName'), EXPORT_COLUMNS, buildDictExportRows(filteredList))
  }

  const filteredList = filterDictList(list ?? [], search)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BookMarked className="h-6 w-6 text-primary" />
            {t('dict.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('dict.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            {tc('export')}
          </Button>
          <HasPermi code="ai:dictionary:add">
            <Button size="sm" onClick={openCreateType}>
              <Plus className="h-4 w-4" />
              {t('dict.createType')}
            </Button>
          </HasPermi>
        </div>
      </div>

      <DictFilter search={search} onSearchChange={setSearch} />

      <DictTable
        list={filteredList}
        isLoading={isLoading}
        expanded={expanded}
        delTypePending={delTypeMut.isPending}
        delItemPending={delItemMut.isPending}
        onToggle={toggle}
        onEditType={openEditType}
        onCreateItem={openCreateItem}
        onDeleteType={delTypeMut.mutate}
        onEditItem={openEditItem}
        onDeleteItem={delItemMut.mutate}
      />

      <DictTypeDialog
        open={typeOpen}
        editing={editingType}
        form={typeForm}
        isPending={saveTypeMut.isPending}
        onFormChange={setTypeForm}
        onClose={closeType}
        onSubmit={submitType}
      />

      <DictItemDialog
        open={itemOpen}
        editing={editingItem}
        parent={itemParent}
        form={itemForm}
        isPending={saveItemMut.isPending}
        onFormChange={setItemForm}
        onClose={closeItem}
        onSubmit={submitItem}
      />
    </div>
  )
}
