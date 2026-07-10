'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'

export interface DistributionOverview {
  totalCommission: number
  pendingCommission: number
  withdrawnCommission: number
  invitedCount: number
  inviteCode: string
  inviteUrl: string
}

export interface InvitedUser {
  id: string
  nickname: string
  avatar?: string
  joinedAt: string
  commission: number
  status: string
}

export interface UseDistributionReturn {
  overview: DistributionOverview | null
  invitedUsers: InvitedUser[]
  commission: number
  fetchOverview: () => Promise<void>
  fetchInvitedUsers: () => Promise<void>
}

/** 分销管理 Hook（本地 state + fetchApi） */
export function useDistribution(): UseDistributionReturn {
  const [overview, setOverview] = React.useState<DistributionOverview | null>(null)
  const [invitedUsers, setInvitedUsers] = React.useState<InvitedUser[]>([])

  const fetchOverview = React.useCallback(async () => {
    const res = await fetchApi<DistributionOverview>('/api/distribution/overview')
    if (res.success) setOverview(res.data)
  }, [])

  const fetchInvitedUsers = React.useCallback(async () => {
    const res = await fetchApi<InvitedUser[]>('/api/distribution/invited-users')
    if (res.success) setInvitedUsers(res.data)
  }, [])

  return {
    overview,
    invitedUsers,
    commission: overview?.pendingCommission ?? 0,
    fetchOverview,
    fetchInvitedUsers,
  }
}
