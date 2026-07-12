'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'

import { PlazaHeader } from './PlazaHeader'
import { CirclesPanel } from './CirclesPanel'
import { AsksPanel } from './AsksPanel'
import { PREVIEW_SIZE, api } from './helpers'
import type { CirclesData, AsksData, Tab } from './types'

export default function PlazaPage() {
  const [tab, setTab] = React.useState<Tab>('circles')

  const circlesQuery = useQuery({
    queryKey: ['plaza-circles'],
    queryFn: () => api<CirclesData>(`/api/circles?page=1&pageSize=${PREVIEW_SIZE}`),
  })

  const asksQuery = useQuery({
    queryKey: ['plaza-asks'],
    queryFn: () => api<AsksData>(`/api/asks?page=1&pageSize=${PREVIEW_SIZE}`),
  })

  const circles = circlesQuery.data?.list ?? []
  const asks = asksQuery.data?.list ?? []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PlazaHeader
        tab={tab}
        setTab={setTab}
        circlesTotal={circlesQuery.data?.total}
        asksTotal={asksQuery.data?.total}
      />

      <div key={tab} className="animate-in fade-in-0 duration-200">
        {tab === 'circles' && (
          <CirclesPanel
            isLoading={circlesQuery.isLoading}
            error={circlesQuery.error}
            circles={circles}
          />
        )}

        {tab === 'asks' && (
          <AsksPanel isLoading={asksQuery.isLoading} error={asksQuery.error} asks={asks} />
        )}
      </div>
    </div>
  )
}
