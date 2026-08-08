'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, Mail, MessageSquare, Search } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { Card, Input } from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { Alert } from '@/components/feedback'
import { cn } from '@/lib/utils'
import { ChatWindow } from './ChatWindow'
import { formatLetterTime } from './helpers'
import type { LetterMember, LetterMembersData } from './types'

const PAGE_SIZE = 100

export default function LettersPage() {
  const t = useTranslations('eduAi.letters')

  const [keyword, setKeyword] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

  // 昵称搜索防抖 300ms
  React.useEffect(() => {
    const tm = setTimeout(() => setDebounced(keyword), 300)
    return () => clearTimeout(tm)
  }, [keyword])

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['private-letters', 'members', debounced],
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: '1',
        pageSize: String(PAGE_SIZE),
        memberNameKeyword: debounced,
      })
      const r = await fetchApi<LetterMembersData>(`/api/private-letters/members?${qs.toString()}`)
      if (!r.success) throw new Error(r.error)
      return r.data
    },
    // 会话列表 15s 自动刷新
    refetchInterval: 15000,
  })

  const members = React.useMemo(() => data?.list ?? [], [data?.list])

  // 保持当前选中会话与列表同步；搜索过滤后若无该会话则右侧展示空态
  const selected = React.useMemo(
    () => members.find((m) => m.counterpartId === selectedId) ?? null,
    [members, selectedId],
  )

  // 未读：该条未读且是对方发来的
  const isUnread = (m: LetterMember) => !m.letter.isRead && m.letter.senderId === m.counterpartId

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton fallbackHref="/" />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Mail className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <Card className="h-[70vh] overflow-hidden">
        <div className="flex h-full">
          {/* 左侧会话列表 */}
          <div className="flex w-[280px] shrink-0 flex-col border-r">
            <div className="border-b p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="h-9 pl-8"
                  aria-label={t('searchPlaceholder')}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('loading')}
                </div>
              ) : isError ? (
                <div className="p-3">
                  <Alert variant="danger" description={(error as Error).message} />
                </div>
              ) : members.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                  <MessageSquare className="h-8 w-8" />
                  <p className="text-sm">{t('empty')}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {members.map((m) => {
                    const active = selectedId === m.counterpartId
                    return (
                      <button
                        key={m.counterpartId}
                        type="button"
                        onClick={() => setSelectedId(m.counterpartId)}
                        className={cn(
                          'flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent/60',
                          active && 'bg-accent',
                        )}
                      >
                        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                          {(m.counterpartName || '?').slice(0, 1)}
                          {isUnread(m) && (
                            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-destructive" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium">{m.counterpartName}</p>
                            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                              {formatLetterTime(m.letter.createdAt)}
                            </span>
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{m.letter.content}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 右侧聊天窗 */}
          <div className="min-w-0 flex-1">
            {selected ? (
              <ChatWindow
                key={selected.counterpartId}
                memberId={selected.counterpartId}
                memberName={selected.counterpartName}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <MessageSquare className="h-10 w-10" />
                <p className="text-sm">{t('noConversation')}</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
