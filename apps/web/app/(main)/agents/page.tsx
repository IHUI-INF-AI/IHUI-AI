'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui-react'

import { AgentsHeader } from './AgentsHeader'
import { MarketFilters } from './MarketFilters'
import { AgentGrid } from './AgentGrid'
import { MarketPagination } from './MarketPagination'
import { MyAgentsTab } from './MyAgentsTab'
import { PAGE_SIZE, fetchAgents, fetchCategories } from './helpers'

export default function AgentsMarketPage() {
  const t = useTranslations('agents')

  const [keyword, setKeyword] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [categoryId, setCategoryId] = React.useState('all')
  const [page, setPage] = React.useState(1)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(keyword)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [keyword])

  const { data: catData } = useQuery({
    queryKey: ['agents', 'categories'],
    queryFn: fetchCategories,
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['agents', 'list', debounced, categoryId, page],
    queryFn: () => fetchAgents({ page, keyword: debounced, categoryId }),
  })

  const categories = catData?.list ?? []
  const agents = data?.list ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <AgentsHeader />

      <Tabs defaultValue="market" className="space-y-4">
        <TabsList>
          <TabsTrigger value="market">{t('marketTab')}</TabsTrigger>
          <TabsTrigger value="mine">{t('mineTab')}</TabsTrigger>
        </TabsList>
        <TabsContent value="market" className="space-y-6">
          <MarketFilters
            keyword={keyword}
            setKeyword={setKeyword}
            categoryId={categoryId}
            setCategoryId={(v) => {
              setCategoryId(v)
              setPage(1)
            }}
            categories={categories}
          />

          <AgentGrid agents={agents} isLoading={isLoading} error={error} />

          <MarketPagination
            total={total}
            page={page}
            totalPages={totalPages}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => p + 1)}
          />
        </TabsContent>
        <TabsContent value="mine">
          <MyAgentsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
