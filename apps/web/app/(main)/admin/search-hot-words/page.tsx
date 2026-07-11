'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Search } from 'lucide-react'

import { fetchApi } from '@/lib/api'

interface HotWord {
  id: string
  word: string
  searchCount?: number
  status: number
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const th = 'px-4 py-2.5 font-medium'

export default function AdminSearchHotWordsPage() {
  const t = useTranslations('admin.searchHotWords')
  const qc = useQueryClient()
  const [currentPage] = React.useState(1)
  const [newWord, setNewWord] = React.useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'search-hot-words', currentPage],
    queryFn: () => api<{ list: HotWord[] }>('/api/search/hot-words'),
  })

  const addMut = useMutation({
    mutationFn: (word: string) =>
      api<void>('/api/search/hot-words', {
        method: 'POST',
        body: JSON.stringify({ word }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'search-hot-words'] })
      setNewWord('')
      toast.success(t('addSuccess'))
    },
  })

  const toggleMut = useMutation({
    mutationFn: (item: { id: string; status: number }) =>
      api<void>(`/api/search/hot-words/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: item.status === 1 ? 0 : 1 }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'search-hot-words'] })
      toast.success(t('toggleSuccess'))
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api<void>(`/api/search/hot-words/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'search-hot-words'] })
      toast.success(t('deleteSuccess'))
    },
  })

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const w = newWord.trim()
    if (!w) return
    addMut.mutate(w)
  }

  const list = data?.list ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>

      <form onSubmit={onAdd} className="flex items-center gap-2">
        <input
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          placeholder={t('wordPlaceholder')}
          className="h-9 flex-1 max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          disabled={addMut.isPending || !newWord.trim()}
        >
          {addMut.isPending ? t('adding') : t('add')}
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className={th}>{t('colWord')}</th>
              <th className={th}>{t('colSearchCount')}</th>
              <th className={th}>{t('colStatus')}</th>
              <th className={th}>{t('colActions')}</th>
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
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  <Search className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t('noData')}
                </td>
              </tr>
            ) : (
              list.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{item.word}</td>
                  <td className="px-4 py-2.5">{item.searchCount ?? 0}</td>
                  <td className="px-4 py-2.5">
                    {item.status === 1 ? t('enabled') : t('disabled')}
                  </td>
                  <td className="px-4 py-2.5 space-x-2">
                    <button
                      className="text-primary hover:underline"
                      onClick={() => toggleMut.mutate(item)}
                      disabled={toggleMut.isPending}
                    >
                      {item.status === 1 ? t('disable') : t('enable')}
                    </button>
                    <button
                      className="text-destructive hover:underline"
                      onClick={() => deleteMut.mutate(item.id)}
                      disabled={deleteMut.isPending}
                    >
                      {t('delete')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
