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
  const [itemOpen, setItemOpen] = React.useState(false)
  const [itemParent, setItemParent] = React.useState<DictType | null>(null)
  const [editingItem, setEditingItem] = React.useState<DictItem | null>(null)
  const [search, setSearch] = React.useState('')

  const { data: list, isLoading } = useQuery({
    queryKey: ['admin', 'dict'],
    queryFn: fetchDictList,
  })

  const saveTypeMut = useMutation({
    mutationFn: async (input: { name: string; code: string; description: string }) => {
      const body = {
        dictName: input.name,
        dictType: input.code,
        remark: input.description,
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
    mutationFn: async (input: {
      label: string
      value: string
      sort: number
      dictType: string
      cssClass: string
      listClass: string
      status: 0 | 1
      remark: string
    }) => {
      const body = {
        dictLabel: input.label,
        dictValue: input.value,
        dictSort: input.sort,
        dictType: input.dictType || itemParent?.code,
        cssClass: input.cssClass,
        listClass: input.listClass,
        status: input.status,
        remark: input.remark,
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
    setTypeOpen(true)
  }
  function openEditType(d: DictType) {
    setEditingType(d)
    setTypeOpen(true)
  }
  function closeType() {
    if (saveTypeMut.isPending) return
    setTypeOpen(false)
    setEditingType(null)
  }
  function onValidType(v: { name: string; code: string; description: string }) {
    saveTypeMut.mutate(v)
  }
  function onValidItem(v: {
    label: string
    value: string
    sort: number
    dictType: string
    cssClass: string
    listClass: 'default' | 'primary' | 'success' | 'info' | 'warning' | 'danger'
    status: 0 | 1
    remark: string
  }) {
    saveItemMut.mutate(v)
  }
  function openCreateItem(d: DictType) {
    setItemParent(d)
    setEditingItem(null)
    setItemOpen(true)
  }
  function openEditItem(d: DictType, it: DictItem) {
    setItemParent(d)
    setEditingItem(it)
    setItemOpen(true)
  }
  function closeItem() {
    if (saveItemMut.isPending) return
    setItemOpen(false)
    setItemParent(null)
    setEditingItem(null)
  }
  function handleExport() {
    exportToExcel(t('dict.exportName'), EXPORT_COLUMNS, buildDictExportRows(filteredList))
  }

  const filteredList = filterDictList(list ?? [], search)

  const typeDefault: { name: string; code: string; description: string } = editingType
    ? { name: editingType.name, code: editingType.code, description: editingType.description }
    : EMPTY_TYPE
  const itemDefault = editingItem
    ? {
        label: editingItem.label,
        value: editingItem.value,
        sort: editingItem.sort,
        cssClass: editingItem.cssClass,
        listClass: editingItem.listClass,
        status: editingItem.status,
        remark: editingItem.remark,
        dictType: editingItem.dictType || itemParent?.code || '',
      }
    : { ...EMPTY_ITEM, dictType: itemParent?.code ?? '' }

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
        defaultValues={typeDefault}
        isPending={saveTypeMut.isPending}
        onValid={onValidType}
        onClose={closeType}
      />

      <DictItemDialog
        open={itemOpen}
        editing={editingItem}
        parent={itemParent}
        defaultValues={itemDefault}
        isPending={saveItemMut.isPending}
        onValid={onValidItem}
        onClose={closeItem}
      />
    </div>
  )
}
