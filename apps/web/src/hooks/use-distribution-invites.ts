'use client'

import * as React from 'react'

import { getInvitedUsers, type InvitedUser } from '@/lib/distribution-api'

export interface UseDistributionInvitesReturn {
  invites: InvitedUser[]
  total: number
  page: number
  pageSize: number
  loading: boolean
  fetchInvites: (page?: number, status?: string) => Promise<void>
}

/** 分销邀请列表 Hook，分页获取被邀请用户 */
export function useDistributionInvites(initialPageSize = 10): UseDistributionInvitesReturn {
  const [invites, setInvites] = React.useState<InvitedUser[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(false)

  const fetchInvites = React.useCallback(
    async (p = 1, status?: string) => {
      setLoading(true)
      try {
        const res = await getInvitedUsers({ page: p, pageSize: initialPageSize, status })
        if (res.success) {
          setInvites(res.data.list)
          setTotal(res.data.total)
          setPage(p)
        }
      } finally {
        setLoading(false)
      }
    },
    [initialPageSize],
  )

  return {
    invites,
    total,
    page,
    pageSize: initialPageSize,
    loading,
    fetchInvites,
  }
}
