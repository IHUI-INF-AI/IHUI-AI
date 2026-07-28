'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Tag } from 'lucide-react'
import { useTranslations } from 'next-intl'
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
} from '@ihui/ui-react'
import { type Category, api } from './types'

export function CategoriesPanel() {
  const t = useTranslations('admin.customerService')
  const qc = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState({ name: '', slug: '', description: '', sortOrder: 0 })
  const [err, setErr] = React.useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'cs-categories'],
    queryFn: () => api<{ list: Category[] }>(`/api/customer-service/categories`),
  })

  const createMut = useMutation({
    mutationFn: () =>
      api<{ category: Category }>('/api/admin/customer-service/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          description: form.description || null,
          sortOrder: form.sortOrder,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'cs-categories'] })
      setOpen(false)
      setForm({ name: '', slug: '', description: '', sortOrder: 0 })
      setErr(null)
    },
    onError: (e: Error) => setErr(e.message),
  })

  const list = data?.list ?? []

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>+ {t('addCategory')}</Button>
      </div>

      {err && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t('colName')}</th>
              <th className="px-4 py-2.5 font-medium">{t('colSlug')}</th>
              <th className="px-4 py-2.5 font-medium">{t('colDescription')}</th>
              <th className="px-4 py-2.5 font-medium">{t('colSort')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  {t('loading')}
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-destructive">
                  {(error as Error).message}
                </td>
              </tr>
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  <Tag className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noCategories')}
                </td>
              </tr>
            ) : (
              list.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5 font-medium">{c.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{c.slug}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.description || '-'}</td>
                  <td className="px-4 py-2.5">{c.sortOrder}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : setOpen(false))}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setErr(null)
              createMut.mutate()
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>{t('addCategoryTitle')}</DialogTitle>
              <DialogDescription>{t('addCategoryDesc')}</DialogDescription>
            </DialogHeader>
            {err && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {err}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="cat-name">{t('fieldCatName')}</Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-slug">{t('fieldSlug')}</Label>
              <Input
                id="cat-slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                placeholder={t('slugPlaceholder')}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">{t('fieldDescription')}</Label>
              <Input
                id="cat-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-sort">{t('fieldSort')}</Label>
              <Input
                id="cat-sort"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={createMut.isPending}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {t('create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
