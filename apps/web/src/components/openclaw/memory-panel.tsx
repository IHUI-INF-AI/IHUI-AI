'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Brain, Search, Plus, Trash2, Loader2, MessageSquareText } from 'lucide-react'

import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@ihui/ui'
import {
  searchMemory,
  getMemoryContext,
  createMemory,
  clearMemory,
  type MemoryType,
  type MemoryItem,
} from '@/lib/openclaw-api'

const MEMORY_TYPES: MemoryType[] = ['fact', 'preference', 'event']

export function MemoryPanel() {
  const t = useTranslations('floatingChat.openclaw')
  const queryClient = useQueryClient()

  const [keyword, setKeyword] = React.useState('')
  const [content, setContent] = React.useState('')
  const [type, setType] = React.useState<MemoryType>('fact')

  const contextQuery = useQuery({
    queryKey: ['openclaw', 'memory', 'context'],
    queryFn: getMemoryContext,
  })

  const searchQuery = useQuery({
    queryKey: ['openclaw', 'memory', 'search', keyword],
    queryFn: () => searchMemory(keyword),
    enabled: keyword.trim().length > 0,
  })

  const createMutation = useMutation({
    mutationFn: () => createMemory({ type, content: content.trim() }),
    onSuccess: () => {
      toast.success(t('addMemory'))
      setContent('')
      queryClient.invalidateQueries({ queryKey: ['openclaw', 'memory'] })
    },
    onError: () => toast.error(t('addMemory')),
  })

  const clearMutation = useMutation({
    mutationFn: clearMemory,
    onSuccess: () => {
      toast.success(t('cleared'))
      queryClient.invalidateQueries({ queryKey: ['openclaw', 'memory'] })
    },
    onError: () => toast.error(t('cleared')),
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (keyword.trim()) searchQuery.refetch()
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    createMutation.mutate()
  }

  const memories: MemoryItem[] =
    keyword.trim() && searchQuery.data ? searchQuery.data : (contextQuery.data?.memories ?? [])

  const count = contextQuery.data?.count ?? memories.length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4" />
            {t('searchMemory')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('searchPlaceholder')}
            />
            <Button type="submit" variant="outline" disabled={searchQuery.isFetching}>
              {searchQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquareText className="h-4 w-4" />
            {t('currentContext')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {contextQuery.isLoading ? t('noContext') : t('memoriesCount', { n: count })}
          </p>
          {memories.length === 0 ? (
            <p className="rounded-md bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
              {t('noMemory')}
            </p>
          ) : (
            <ul className="space-y-2">
              {memories.map((m) => (
                <li
                  key={m.id}
                  className="flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <span className="shrink-0 rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                    {m.type === 'fact'
                      ? t('typeFact')
                      : m.type === 'preference'
                        ? t('typePreference')
                        : t('typeEvent')}
                  </span>
                  <span className="break-words">{m.content}</span>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending || count === 0}
          >
            <Trash2 className="h-4 w-4" />
            {t('clearMemory')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" />
            {t('addMemory')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="memory-content">{t('addMemoryPlaceholder')}</Label>
              <Input
                id="memory-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t('addMemoryPlaceholder')}
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="space-y-2">
                <Label>{t('addMemory')}</Label>
                <Select value={type} onValueChange={(v) => setType(v as MemoryType)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMORY_TYPES.map((mt) => (
                      <SelectItem key={mt} value={mt}>
                        {mt === 'fact'
                          ? t('typeFact')
                          : mt === 'preference'
                            ? t('typePreference')
                            : t('typeEvent')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={!content.trim() || createMutation.isPending}>
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4" />
                )}
                {t('addMemory')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default MemoryPanel
