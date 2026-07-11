'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  BookMarked,
  Plus,
  Edit,
  Trash2,
  Loader2,
  ChevronRight,
  ChevronDown,
  Search,
  Download,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { exportToExcel } from '@/lib/export-utils'
import { HasPermi } from '@/components/auth/HasPermi'
import {
  Button,
  Input,
  Label,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@ihui/ui'
import { cn } from '@/lib/utils'

interface DictItem {
  id: string
  label: string
  value: string
  sort: number
}

interface DictType {
  id: string
  name: string
  code: string
  description: string
  itemCount: number
  items: DictItem[]
}

const MOCK_DICTS: DictType[] = [
  {
    id: '1',
    name: '订单状态',
    code: 'order_status',
    description: '订单的流转状态',
    itemCount: 5,
    items: [
      { id: '11', label: '待支付', value: 'pending', sort: 1 },
      { id: '12', label: '已支付', value: 'paid', sort: 2 },
      { id: '13', label: '已完成', value: 'completed', sort: 3 },
      { id: '14', label: '已取消', value: 'cancelled', sort: 4 },
      { id: '15', label: '已退款', value: 'refunded', sort: 5 },
    ],
  },
  {
    id: '2',
    name: '用户角色',
    code: 'user_role',
    description: '系统用户角色类型',
    itemCount: 4,
    items: [
      { id: '21', label: '管理员', value: 'admin', sort: 1 },
      { id: '22', label: '普通用户', value: 'user', sort: 2 },
      { id: '23', label: '讲师', value: 'lecturer', sort: 3 },
      { id: '24', label: '访客', value: 'guest', sort: 4 },
    ],
  },
  {
    id: '3',
    name: '支付方式',
    code: 'payment_method',
    description: '支持的支付方式',
    itemCount: 3,
    items: [
      { id: '31', label: '微信支付', value: 'wechat', sort: 1 },
      { id: '32', label: '支付宝', value: 'alipay', sort: 2 },
      { id: '33', label: '余额支付', value: 'balance', sort: 3 },
    ],
  },
]

const EMPTY_TYPE = { name: '', code: '', description: '' }
const EMPTY_ITEM = { label: '', value: '', sort: 0 }
const th = 'px-4 py-2.5 font-medium'
const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

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

  const { data: list = MOCK_DICTS, isLoading } = useQuery({
    queryKey: ['admin', 'dict'],
    queryFn: async () => {
      const r = await fetchApi<{
        list: { dictId: number; dictName: string; dictType: string; remark?: string | null }[]
      }>('/api/admin/dict/type/list')
      if (r.success && r.data?.list) {
        const result: DictType[] = await Promise.all(
          r.data.list.map(async (t) => {
            const dr = await fetchApi<{
              list: { dictCode: number; dictLabel: string; dictValue: string; dictSort?: number }[]
            }>(`/api/admin/dict/data/type/${t.dictType}`)
            const items: DictItem[] =
              dr.success && dr.data?.list
                ? dr.data.list.map((d) => ({
                    id: String(d.dictCode),
                    label: d.dictLabel,
                    value: d.dictValue,
                    sort: d.dictSort ?? 0,
                  }))
                : []
            return {
              id: String(t.dictId),
              name: t.dictName,
              code: t.dictType,
              description: t.remark ?? '',
              itemCount: items.length,
              items,
            }
          }),
        )
        return result
      }
      return MOCK_DICTS
    },
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
    const rows: Record<string, unknown>[] = []
    filteredList.forEach((d) => {
      if (d.items.length === 0) {
        rows.push({ typeName: d.name, typeCode: d.code, label: '', value: '', sort: '' })
      } else {
        d.items.forEach((it) => {
          rows.push({
            typeName: d.name,
            typeCode: d.code,
            label: it.label,
            value: it.value,
            sort: it.sort,
          })
        })
      }
    })
    exportToExcel(
      '字典数据',
      [
        { key: 'typeName', title: '字典名称' },
        { key: 'typeCode', title: '字典编码' },
        { key: 'label', title: '字典标签' },
        { key: 'value', title: '字典值' },
        { key: 'sort', title: '排序' },
      ],
      rows,
    )
  }

  const filteredList = search.trim()
    ? list.filter(
        (d) =>
          d.name.toLowerCase().includes(search.toLowerCase()) ||
          d.code.toLowerCase().includes(search.toLowerCase()),
      )
    : list

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

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索字典名称 / 编码..."
            className="h-9 pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {tc('search')}
        </div>
      ) : filteredList.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          {t('dict.noData')}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredList.map((d) => {
            const isOpen = expanded.has(d.id)
            return (
              <div key={d.id} className="overflow-hidden rounded-lg border">
                <div className="flex items-center justify-between bg-muted/30 px-4 py-3">
                  <button
                    onClick={() => toggle(d.id)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">{d.name}</span>
                    <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                      {d.code}
                    </code>
                    <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {d.itemCount}
                    </span>
                  </button>
                  <div className="flex gap-1">
                    <HasPermi code="ai:dictionary:edit">
                      <Button size="sm" variant="ghost" onClick={() => openEditType(d)}>
                        <Edit className="h-4 w-4" />
                        {tc('edit')}
                      </Button>
                    </HasPermi>
                    <HasPermi code="ai:dictionary:add">
                      <Button size="sm" variant="ghost" onClick={() => openCreateItem(d)}>
                        <Plus className="h-4 w-4" />
                        {t('dict.addItem')}
                      </Button>
                    </HasPermi>
                    <HasPermi code="ai:dictionary:remove">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={delTypeMut.isPending}
                        onClick={() => {
                          if (confirm(t('dict.deleteConfirm'))) delTypeMut.mutate(d.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </HasPermi>
                  </div>
                </div>
                {d.description && (
                  <div className="px-4 py-2 text-xs text-muted-foreground">{d.description}</div>
                )}
                {isOpen && (
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className={th}>{t('dict.colLabel')}</th>
                        <th className={th}>{t('dict.colValue')}</th>
                        <th className={th}>{t('dict.colSort')}</th>
                        <th className={cn(th, 'text-right')}>{t('dict.colActions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {d.items.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                            {t('dict.noItems')}
                          </td>
                        </tr>
                      ) : (
                        d.items.map((it) => (
                          <tr key={it.id} className="transition-colors hover:bg-muted/30">
                            <td className="px-4 py-2.5 font-medium">{it.label}</td>
                            <td className="px-4 py-2.5">
                              <code className="font-mono text-xs text-muted-foreground">
                                {it.value}
                              </code>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">{it.sort}</td>
                            <td className="px-4 py-2.5 text-right">
                              <HasPermi code="ai:dictionary:edit">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditItem(d, it)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </HasPermi>
                              <HasPermi code="ai:dictionary:remove">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  disabled={delItemMut.isPending}
                                  onClick={() => {
                                    if (confirm(t('dict.deleteConfirm'))) delItemMut.mutate(it.id)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </HasPermi>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 字典类型 Dialog */}
      <Dialog open={typeOpen} onOpenChange={(o) => (o ? setTypeOpen(true) : closeType())}>
        <DialogContent>
          <form onSubmit={submitType} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {editingType ? t('dict.editTypeTitle') : t('dict.createTypeTitle')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="dt-name">{t('dict.fieldName')}</Label>
              <Input
                id="dt-name"
                value={typeForm.name}
                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                placeholder={t('dict.namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dt-code">{t('dict.fieldCode')}</Label>
              <Input
                id="dt-code"
                value={typeForm.code}
                onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })}
                placeholder="order_status"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dt-desc">{t('dict.fieldDescription')}</Label>
              <textarea
                id="dt-desc"
                value={typeForm.description}
                onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
                rows={2}
                className={textareaClass}
                placeholder={t('dict.descriptionPlaceholder')}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeType}
                disabled={saveTypeMut.isPending}
              >
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saveTypeMut.isPending}>
                {saveTypeMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 字典条目 Dialog */}
      <Dialog open={itemOpen} onOpenChange={(o) => (o ? setItemOpen(true) : closeItem())}>
        <DialogContent>
          <form onSubmit={submitItem} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? t('dict.editItemTitle') : t('dict.createItemTitle')}
                {itemParent && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({itemParent.name})
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="di-label">{t('dict.fieldLabel')}</Label>
              <Input
                id="di-label"
                value={itemForm.label}
                onChange={(e) => setItemForm({ ...itemForm, label: e.target.value })}
                placeholder={t('dict.labelPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="di-value">{t('dict.fieldValue')}</Label>
              <Input
                id="di-value"
                value={itemForm.value}
                onChange={(e) => setItemForm({ ...itemForm, value: e.target.value })}
                placeholder="pending"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="di-sort">{t('dict.fieldSort')}</Label>
              <Input
                id="di-sort"
                type="number"
                value={itemForm.sort}
                onChange={(e) => setItemForm({ ...itemForm, sort: Number(e.target.value) })}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeItem}
                disabled={saveItemMut.isPending}
              >
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={saveItemMut.isPending}>
                {saveItemMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
